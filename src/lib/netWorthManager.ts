import { db } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

export interface NetWorthItem {
  id: string;
  type: 'asset' | 'liability';
  name: string;
  subType: string; // e.g. "Bank", "Mutual Fund", "Gold", "Home Loan", "Credit Card"
  value: number;
  lastUpdated: number;
}

export class NetWorthManager {
  static async getAllItems(): Promise<NetWorthItem[]> {
    return db.netWorth.toArray();
  }

  static async addItem(item: Omit<NetWorthItem, 'id' | 'lastUpdated'>): Promise<string> {
    const id = uuidv4();
    await db.netWorth.add({
      ...item,
      id,
      lastUpdated: Date.now()
    });
    return id;
  }

  static async updateItem(id: string, value: number): Promise<void> {
    await db.netWorth.update(id, {
      value,
      lastUpdated: Date.now()
    });
  }

  static async deleteItem(id: string): Promise<void> {
    await db.netWorth.delete(id);
  }

  static async calculateNetWorth(): Promise<{
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
  }> {
    const items = await db.netWorth.toArray();
    let totalAssets = 0;
    let totalLiabilities = 0;

    items.forEach(item => {
      if (item.type === 'asset') {
        totalAssets += item.value;
      } else {
        totalLiabilities += item.value;
      }
    });

    return {
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities
    };
  }
}
