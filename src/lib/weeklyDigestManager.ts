import { db } from '../db/database';
import { TransactionType } from '../db/models';

export interface WeeklyDigest {
  totalSpent: number;
  topCategory: { name: string; amount: number } | null;
  changePercent: number; // e.g. +12 (meaning spent 12% more than last week)
  daysCount: number;
}

export class WeeklyDigestManager {
  static async generateDigest(): Promise<WeeklyDigest> {
    const today = new Date();
    const now = today.getTime();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

    // This week's debit transactions
    const thisWeekTxs = await db.transactions
      .where('dateTime')
      .aboveOrEqual(sevenDaysAgo)
      .and(t => t.type === TransactionType.DEBIT && t.isDeleted === 0)
      .toArray();

    // Last week's debit transactions
    const lastWeekTxs = await db.transactions
      .where('dateTime')
      .between(fourteenDaysAgo, sevenDaysAgo, true, false)
      .and(t => t.type === TransactionType.DEBIT && t.isDeleted === 0)
      .toArray();

    const thisWeekTotal = thisWeekTxs.reduce((sum, t) => sum + t.amount, 0);
    const lastWeekTotal = lastWeekTxs.reduce((sum, t) => sum + t.amount, 0);

    // Group this week by category
    const catSpends: Record<string, number> = {};
    for (const tx of thisWeekTxs) {
      catSpends[tx.categoryId] = (catSpends[tx.categoryId] || 0) + tx.amount;
    }

    let topCatId = '';
    let topAmt = 0;
    Object.entries(catSpends).forEach(([catId, amt]) => {
      if (amt > topAmt) {
        topAmt = amt;
        topCatId = catId;
      }
    });

    let topCatName = null;
    if (topCatId) {
      const cat = await db.categories.get(topCatId);
      topCatName = cat ? cat.name : 'Other';
    }

    let changePercent = 0;
    if (lastWeekTotal > 0) {
      changePercent = parseFloat((((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100).toFixed(1));
    }

    return {
      totalSpent: thisWeekTotal,
      topCategory: topCatName ? { name: topCatName, amount: topAmt } : null,
      changePercent,
      daysCount: 7
    };
  }

  static async triggerSundayPushNotification(): Promise<void> {
    const today = new Date();
    // Check if it's Sunday (0 = Sunday)
    if (today.getDay() !== 0) return;

    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const digest = await this.generateDigest();
    if (digest.totalSpent === 0) return;

    let bodyMsg = `You spent ₹${digest.totalSpent} this week.`;
    if (digest.topCategory) {
      bodyMsg += ` Top category: ${digest.topCategory.name} (₹${digest.topCategory.amount}).`;
    }
    if (digest.changePercent !== 0) {
      bodyMsg += ` That's ${Math.abs(digest.changePercent)}% ${digest.changePercent > 0 ? 'more' : 'less'} than last week.`;
    }

    new Notification('Your Sunday Weekly Digest 📊', {
      body: bodyMsg,
      icon: '/pwa-192x192.png',
      tag: `weekly-digest-${today.getFullYear()}-W${Math.ceil(today.getDate() / 7)}`
    });
  }
}
