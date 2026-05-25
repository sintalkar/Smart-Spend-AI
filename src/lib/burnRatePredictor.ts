import { db } from '../db/database';
import { TransactionType } from '../db/models';

export interface BurnRateProjection {
  spentSoFar: number;
  projectedSpend: number;
  monthlyBudget: number;
  isOverBudget: boolean;
  percentOfBudget: number;
  daysRemaining: number;
}

export class BurnRatePredictor {
  static async calculateProjection(): Promise<BurnRateProjection> {
    const today = new Date();
    const currentDay = today.getDate();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    const totalDays = new Date(year, month + 1, 0).getDate();
    const daysRemaining = totalDays - currentDay;

    // Start of current month timestamp
    const startOfMonth = new Date(year, month, 1).getTime();

    // Query all non-deleted expense transactions for this month
    const monthlyTxs = await db.transactions
      .where('dateTime')
      .aboveOrEqual(startOfMonth)
      .and(t => t.type === TransactionType.DEBIT && t.isDeleted === 0 && t.categoryId !== 'savings')
      .toArray();

    const spentSoFar = monthlyTxs.reduce((sum, t) => sum + t.amount, 0);

    // Fetch total monthly budget limit
    const budgets = await db.budgets.toArray();
    const monthlyBudget = budgets
      .filter(b => b.isActive === 1)
      .reduce((sum, b) => sum + b.amount, 0) || 15000; // default baseline ₹15,000 if not set

    // Project monthly spend
    const projectedSpend = currentDay > 0 ? parseFloat(((spentSoFar / currentDay) * totalDays).toFixed(2)) : spentSoFar;
    const isOverBudget = projectedSpend > monthlyBudget;
    const percentOfBudget = monthlyBudget > 0 ? parseFloat(((projectedSpend / monthlyBudget) * 100).toFixed(2)) : 0;

    return {
      spentSoFar,
      projectedSpend,
      monthlyBudget,
      isOverBudget,
      percentOfBudget,
      daysRemaining
    };
  }
}
