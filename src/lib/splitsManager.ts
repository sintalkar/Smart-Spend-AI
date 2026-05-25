import { db } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

export interface SplitExpense {
  id: string;
  transactionId: string;
  name: string; // Person name
  amount: number; // Share they owe
  settled: number; // 0 or 1
}

export class SplitsManager {
  static async getSplitsForTransaction(transactionId: string): Promise<SplitExpense[]> {
    return db.splits.where('transactionId').equals(transactionId).toArray();
  }

  static async getAllOutstandingSplits(): Promise<(SplitExpense & { merchantName?: string; date?: number })[]> {
    const unsettled = await db.splits.where('settled').equals(0).toArray();
    const enriched: any[] = [];

    for (const item of unsettled) {
      const tx = await db.transactions.get(item.transactionId);
      if (tx && tx.isDeleted === 0) {
        enriched.push({
          ...item,
          merchantName: tx.merchantName || 'Shared Transaction',
          date: tx.dateTime
        });
      }
    }

    return enriched;
  }

  static async addSplits(transactionId: string, splits: { name: string; amount: number }[]): Promise<void> {
    const tx = await db.transactions.get(transactionId);
    if (!tx) throw new Error('Transaction does not exist');

    for (const split of splits) {
      const id = uuidv4();
      await db.splits.add({
        id,
        transactionId,
        name: split.name,
        amount: split.amount,
        settled: 0
      });
    }
  }

  static async settleSplit(id: string): Promise<void> {
    await db.splits.update(id, { settled: 1 });
  }

  static async calculateBalances(): Promise<Record<string, number>> {
    const unsettled = await db.splits.where('settled').equals(0).toArray();
    const balances: Record<string, number> = {};

    unsettled.forEach(item => {
      balances[item.name] = (balances[item.name] || 0) + item.amount;
    });

    return balances;
  }
}
