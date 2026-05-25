import { db } from '../db/database';

export class MerchantMemoryService {
  /**
   * Normalize merchant name for consistent lookup and indexing
   */
  private normalizeMerchant(merchant: string): string {
    return (merchant || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  /**
   * Learns from a user's transaction save or edit.
   * Upserts the merchant-category association and increments the count.
   */
  public async learnMerchant(merchant: string, category: string, icon: string = 'tag'): Promise<void> {
    if (!merchant || !category) return;
    
    const key = this.normalizeMerchant(merchant);
    
    try {
      const existing = await db.merchantMap.get(key);
      if (existing) {
        // If it already matches this category, increment count
        // If it's a new category, update the category and reset/increment count
        const newCount = existing.category === category ? existing.count + 1 : 1;
        await db.merchantMap.put({
          merchant: key,
          category,
          icon: icon || existing.icon,
          count: newCount
        });
      } else {
        await db.merchantMap.add({
          merchant: key,
          category,
          icon,
          count: 1
        });
      }
      console.log(`[Merchant Memory] Learned: "${key}" -> "${category}"`);
    } catch (e) {
      console.error('[Merchant Memory] Failed to learn merchant:', e);
    }
  }

  /**
   * Recalls the learned category and icon for a merchant.
   * Only returns the association if the user has used it at least 2 times (count >= 2).
   */
  public async recallMerchant(merchant: string): Promise<{ category: string; icon: string } | null> {
    if (!merchant) return null;
    const key = this.normalizeMerchant(merchant);
    
    try {
      const entry = await db.merchantMap.get(key);
      if (entry && entry.count >= 2) {
        console.log(`[Merchant Memory] Recalled: "${key}" -> "${entry.category}" (Count: ${entry.count})`);
        return {
          category: entry.category,
          icon: entry.icon
        };
      }
    } catch (e) {
      console.error('[Merchant Memory] Failed to recall merchant:', e);
    }
    return null;
  }
}

export const merchantMemoryService = new MerchantMemoryService();
