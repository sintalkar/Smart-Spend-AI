import { db } from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { TransactionType } from '../db/models';
import toast from 'react-hot-toast';

export interface RecurringTransaction {
  id: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  categoryId: string;
  merchantName: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  lastRunDate: number;
  nextRunDate: number;
  isPaused: number; // 0 or 1
}

export class RecurringManager {
  static async getAllRecurring(): Promise<RecurringTransaction[]> {
    return db.recurringTransactions.toArray() as Promise<RecurringTransaction[]>;
  }

  static async addRecurring(rec: Omit<RecurringTransaction, 'id' | 'lastRunDate' | 'nextRunDate' | 'isPaused'>): Promise<string> {
    const id = uuidv4();
    const now = Date.now();
    const nextRun = this.calculateNextRun(now, rec.frequency);
    await db.recurringTransactions.add({
      ...rec,
      id,
      lastRunDate: now,
      nextRunDate: nextRun,
      isPaused: 0
    });
    return id;
  }

  static async deleteRecurring(id: string): Promise<void> {
    await db.recurringTransactions.delete(id);
  }

  static async togglePause(id: string): Promise<void> {
    const item = await db.recurringTransactions.get(id);
    if (item) {
      await db.recurringTransactions.update(id, { isPaused: item.isPaused === 1 ? 0 : 1 });
    }
  }

  static calculateNextRun(fromTimestamp: number, frequency: string): number {
    const date = new Date(fromTimestamp);
    switch (frequency) {
      case 'DAILY':
        date.setDate(date.getDate() + 1);
        break;
      case 'WEEKLY':
        date.setDate(date.getDate() + 7);
        break;
      case 'MONTHLY':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'YEARLY':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        date.setDate(date.getDate() + 30);
    }
    return date.getTime();
  }

  static async checkAndProcessDueRecurring(): Promise<void> {
    const now = Date.now();
    const items = await db.recurringTransactions.where('nextRunDate').belowOrEqual(now).toArray();

    let processedCount = 0;

    for (const item of items) {
      if (item.isPaused === 1) continue;

      // 1. Log the transaction in the transactions store
      const transactionId = uuidv4();
      await db.transactions.add({
        id: transactionId,
        amount: item.amount,
        type: item.type === 'DEBIT' ? TransactionType.DEBIT : TransactionType.CREDIT,
        categoryId: item.categoryId,
        merchantName: item.merchantName,
        note: `Auto-generated recurring transaction (${item.frequency.toLowerCase()})`,
        tags: ['recurring-auto'],
        dateTime: now,
        source: 'RECURRING',
        isConfirmed: 1,
        isRecurring: 1,
        currency: 'INR',
        createdAt: now,
        updatedAt: now,
        isDeleted: 0
      });

      // 2. Update recurring lastRunDate & nextRunDate
      const nextRun = this.calculateNextRun(now, item.frequency);
      await db.recurringTransactions.update(item.id, {
        lastRunDate: now,
        nextRunDate: nextRun
      });

      processedCount++;
      
      // Toast notification for user confirmation
      toast.success(`Recurring payment logged: ₹${item.amount} to ${item.merchantName}! 🔁`, {
        duration: 4000
      });
    }

    if (processedCount > 0) {
      console.log(`[RecurringManager] Successfully logged ${processedCount} recurring transactions.`);
    }
  }
}
