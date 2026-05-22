import { db } from '../database';
import { MoneyScoreHistoryEntity, Result } from '../models';
import { subMonths } from 'date-fns';

export class MoneyScoreHistoryRepository {
  // Equivalent to `getLast6Months()`
  async getLast6Months(): Promise<Result<MoneyScoreHistoryEntity[]>> {
    try {
      // Get JS timestamp 6 months ago as reference
      const sixMonthsAgo = subMonths(new Date(), 6).getTime();
      
      const data = await db.moneyScoreHistory
        .where('calculatedAt')
        .aboveOrEqual(sixMonthsAgo)
        // Sort chronologically using Dexie's built-in array methods after query
        .sortBy('calculatedAt');
        
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  // Equivalent to `insertScore()`
  async insertScore(score: MoneyScoreHistoryEntity): Promise<Result<boolean>> {
    try {
      await db.moneyScoreHistory.add(score);
      return { success: true, data: true };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}

export const moneyScoreRepo = new MoneyScoreHistoryRepository();
