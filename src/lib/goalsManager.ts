import { db } from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { GoalEntity, TransactionType } from '../db/models';

export type { GoalEntity as SavingsGoal };

export class GoalsManager {
  static async getAllGoals(): Promise<GoalEntity[]> {
    return db.goals.toArray();
  }

  static async addGoal(goal: Omit<GoalEntity, 'id' | 'currentAmount' | 'isCompleted' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = uuidv4();
    const now = Date.now();
    await db.goals.add({
      ...goal,
      id,
      currentAmount: 0,
      isCompleted: 0,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  static async updateGoal(id: string, updates: Partial<GoalEntity>): Promise<void> {
    await db.goals.update(id, { ...updates, updatedAt: Date.now() });
  }

  static async deleteGoal(id: string): Promise<void> {
    await db.goals.delete(id);
  }

  static calculateDailySaveRate(goal: GoalEntity): number {
    const remaining = goal.targetAmount - goal.currentAmount;
    if (remaining <= 0) return 0;
    if (!goal.deadline) return 0;

    const msDiff = goal.deadline - Date.now();
    const daysRemaining = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
    if (daysRemaining <= 0) return remaining;
    return parseFloat((remaining / daysRemaining).toFixed(2));
  }

  static async transferToGoal(goalId: string, amount: number): Promise<boolean> {
    const goal = await db.goals.get(goalId);
    if (!goal) return false;

    const newAmount = goal.currentAmount + amount;
    const isCompleted = newAmount >= goal.targetAmount ? 1 : 0;
    await db.goals.update(goalId, { currentAmount: newAmount, isCompleted, updatedAt: Date.now() });

    const now = Date.now();
    await db.transactions.add({
      id: uuidv4(),
      amount,
      type: TransactionType.DEBIT,
      categoryId: 'savings',
      merchantName: `Goal: ${goal.name}`,
      note: `Transferred ₹${amount} towards "${goal.name}"`,
      tags: ['goal-savings'],
      dateTime: now,
      source: 'MANUAL',
      isConfirmed: 1,
      isRecurring: 0,
      currency: 'INR',
      createdAt: now,
      updatedAt: now,
      isDeleted: 0,
    });

    return isCompleted === 1;
  }
}
