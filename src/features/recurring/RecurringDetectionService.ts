import { db } from '../../db/database';
import { TransactionEntity, TransactionType } from '../../db/models';

export type RecurringCadence = 'weekly' | 'biweekly' | 'monthly';

export interface RecurringGroup {
  key: string;
  merchantName: string;
  categoryId: string;
  type: TransactionType;
  avgAmount: number;
  cadence: RecurringCadence;
  transactions: TransactionEntity[];
  confidence: number;
  nextExpectedDate: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function normalizeMerchant(name: string | undefined): string {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function detectCadence(avgDays: number): RecurringCadence | null {
  if (avgDays >= 5 && avgDays <= 9) return 'weekly';
  if (avgDays >= 12 && avgDays <= 16) return 'biweekly';
  if (avgDays >= 25 && avgDays <= 35) return 'monthly';
  return null;
}

export async function detectRecurringTransactions(): Promise<RecurringGroup[]> {
  const all = await db.transactions
    .where('isDeleted').equals(0)
    .toArray();

  // Group by normalized merchant + type
  const groups = new Map<string, TransactionEntity[]>();
  for (const tx of all) {
    const key = `${normalizeMerchant(tx.merchantName || tx.note)}__${tx.type}__${tx.categoryId}`;
    if (!key.startsWith('__')) {
      const arr = groups.get(key) ?? [];
      arr.push(tx);
      groups.set(key, arr);
    }
  }

  const results: RecurringGroup[] = [];

  for (const [key, txs] of groups) {
    if (txs.length < 2) continue;

    // Sort chronologically
    const sorted = [...txs].sort((a, b) => a.dateTime - b.dateTime);

    // Calculate intervals in days between consecutive transactions
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push((sorted[i].dateTime - sorted[i - 1].dateTime) / DAY_MS);
    }

    const avgDays = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const sd = stdDev(intervals);
    const cadence = detectCadence(avgDays);

    if (!cadence) continue;

    // Tolerance: stddev must be less than 35% of avgDays to be considered regular
    const toleranceRatio = sd / avgDays;
    if (toleranceRatio > 0.35) continue;

    // Confidence: more occurrences + tighter stddev = higher confidence
    const occurrenceScore = Math.min(txs.length / 4, 1); // caps at 4 occurrences
    const consistencyScore = 1 - Math.min(toleranceRatio / 0.35, 1);
    const confidence = Math.round((occurrenceScore * 0.5 + consistencyScore * 0.5) * 100) / 100;

    // Estimate next expected date from last transaction
    const lastTx = sorted[sorted.length - 1];
    const cadenceDays = cadence === 'weekly' ? 7 : cadence === 'biweekly' ? 14 : 30;
    const nextExpectedDate = lastTx.dateTime + cadenceDays * DAY_MS;

    const avgAmount = txs.reduce((s, t) => s + t.amount, 0) / txs.length;
    const displayName = txs[0].merchantName || txs[0].note || txs[0].categoryId;

    results.push({
      key,
      merchantName: displayName,
      categoryId: txs[0].categoryId,
      type: txs[0].type,
      avgAmount: Math.round(avgAmount),
      cadence,
      transactions: sorted,
      confidence,
      nextExpectedDate,
    });
  }

  // Sort by confidence desc
  return results.sort((a, b) => b.confidence - a.confidence);
}

export async function markGroupAsRecurring(group: RecurringGroup): Promise<void> {
  await Promise.all(
    group.transactions.map(tx =>
      db.transactions.update(tx.id, { isRecurring: 1, updatedAt: Date.now() })
    )
  );
}

export async function dismissGroup(group: RecurringGroup): Promise<void> {
  // Mark all as explicitly non-recurring so we don't surface them again
  await Promise.all(
    group.transactions.map(tx =>
      db.transactions.update(tx.id, { isRecurring: 0, updatedAt: Date.now() })
    )
  );
}
