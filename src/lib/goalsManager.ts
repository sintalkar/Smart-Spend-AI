import { db } from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { TransactionType } from '../db/models';

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  targetDate: number; // Unix epoch
  icon: string;
  color: string;
}

export class GoalsManager {
  static async getAllGoals(): Promise<SavingsGoal[]> {
    return db.goals.toArray();
  }

  static async addGoal(goal: Omit<SavingsGoal, 'id' | 'savedAmount'>): Promise<string> {
    const id = uuidv4();
    await db.goals.add({
      ...goal,
      id,
      savedAmount: 0
    });
    return id;
  }

  static async updateGoal(id: string, updates: Partial<SavingsGoal>): Promise<void> {
    await db.goals.update(id, updates);
  }

  static async deleteGoal(id: string): Promise<void> {
    await db.goals.delete(id);
  }

  static calculateDailySaveRate(goal: SavingsGoal): number {
    const remaining = goal.targetAmount - goal.savedAmount;
    if (remaining <= 0) return 0;

    const today = Date.now();
    const msDiff = goal.targetDate - today;
    const daysRemaining = Math.ceil(msDiff / (1000 * 60 * 60 * 24));

    if (daysRemaining <= 0) return remaining; // Due now or overdue, save entire remaining balance
    return parseFloat((remaining / daysRemaining).toFixed(2));
  }

  static async transferToGoal(goalId: string, amount: number): Promise<boolean> {
    const goal = await db.goals.get(goalId);
    if (!goal) return false;

    // 1. Update the saved amount in Dexie
    const newSaved = goal.savedAmount + amount;
    await db.goals.update(goalId, { savedAmount: newSaved });

    // 2. Log a transaction entry representing the transfer
    const transactionId = uuidv4();
    const now = Date.now();
    await db.transactions.add({
      id: transactionId,
      amount,
      type: TransactionType.DEBIT,
      categoryId: 'savings', // A virtual or custom category
      merchantName: `Goal: ${goal.name}`,
      note: `Transferred ₹${amount} towards savings goal "${goal.name}"`,
      tags: ['goal-savings'],
      dateTime: now,
      source: 'MANUAL',
      isConfirmed: 1,
      isRecurring: 0,
      currency: 'INR',
      createdAt: now,
      updatedAt: now,
      isDeleted: 0
    });

    return newSaved >= goal.targetAmount; // Returns true if goal is completed/celebration is due
  }
}
