import { db } from '../database';
import { InsightsCacheEntity, Result } from '../models';

export class InsightsCacheRepository {
  // Equivalent to `getByPeriod()`
  async getByPeriod(period: string): Promise<Result<InsightsCacheEntity[]>> {
    try {
      const data = await db.insightsCache.where('period').equals(period).toArray();
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  // Equivalent to `insertOrReplace()`
  async insertOrReplace(insight: InsightsCacheEntity): Promise<Result<boolean>> {
    try {
      await db.insightsCache.put(insight); // .put in IndexedDb upserts (insert/replace)
      return { success: true, data: true };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  // Equivalent to `deleteExpired()`
  async deleteExpired(): Promise<Result<boolean>> {
    try {
      const now = Date.now();
      // Using JS array filter vs indexed query appropriately
      const expiredDocs = await db.insightsCache.filter(i => i.expiresAt <= now).toArray();
      const expiredIds = expiredDocs.map(doc => doc.id);
      await db.insightsCache.bulkDelete(expiredIds);
      return { success: true, data: true };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}

export const insightsCacheRepo = new InsightsCacheRepository();
