import { db } from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { TransactionType } from '../db/models';

export interface Anomaly {
  id: string;
  transactionId: string;
  categoryId: string;
  amount: number;
  averageSpend: number;
  detectedAt: number;
  acknowledged: number; // 0 or 1
}

export class AnomalyDetector {
  /**
   * Scan a new transaction to check if it's an anomaly.
   * If it exceeds 2.5x the average spend of its category (minimum 5 past transactions), flags it.
   */
  static async scanTransaction(transactionId: string): Promise<boolean> {
    const tx = await db.transactions.get(transactionId);
    if (!tx || tx.type !== TransactionType.DEBIT || tx.isDeleted === 1) return false;

    // Fetch past transactions in the same category
    const pastTxs = await db.transactions
      .where('categoryId')
      .equals(tx.categoryId)
      .and(t => t.type === TransactionType.DEBIT && t.id !== transactionId && t.isDeleted === 0)
      .limit(30)
      .toArray();

    // We need at least 3 transactions in this category to establish a reliable baseline
    if (pastTxs.length < 3) return false;

    const totalSpent = pastTxs.reduce((sum, t) => sum + t.amount, 0);
    const avgSpend = totalSpent / pastTxs.length;

    // Threshold of 2.5x average, and minimum transaction value of ₹500 to avoid flagging small relative jumps (e.g. ₹10 to ₹50)
    if (tx.amount > avgSpend * 2.5 && tx.amount >= 500) {
      const anomalyId = uuidv4();
      await db.anomalies.add({
        id: anomalyId,
        transactionId,
        categoryId: tx.categoryId,
        amount: tx.amount,
        averageSpend: parseFloat(avgSpend.toFixed(2)),
        detectedAt: Date.now(),
        acknowledged: 0
      });
      return true;
    }

    return false;
  }

  static async getUnacknowledgedAnomalies(): Promise<(Anomaly & { merchantName?: string; categoryName?: string })[]> {
    const anomalies = await db.anomalies.where('acknowledged').equals(0).toArray();
    const enriched: any[] = [];

    for (const anom of anomalies) {
      const tx = await db.transactions.get(anom.transactionId);
      const cat = await db.categories.get(anom.categoryId);
      if (tx && tx.isDeleted === 0) {
        enriched.push({
          ...anom,
          merchantName: tx.merchantName || 'Unknown Merchant',
          categoryName: cat ? cat.name : 'Other'
        });
      }
    }

    return enriched;
  }

  static async acknowledgeAnomaly(id: string): Promise<void> {
    await db.anomalies.update(id, { acknowledged: 1 });
  }
}
