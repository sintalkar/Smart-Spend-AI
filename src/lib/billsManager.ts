import { db } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDay: number; // 1-31
  category: string;
  isRecurring: number; // 0 or 1
  notifyDaysBefore: number;
  isPaid: number; // 0 or 1
}

export class BillsManager {
  static async getAllBills(): Promise<Bill[]> {
    return db.bills.toArray();
  }

  static async addBill(bill: Omit<Bill, 'id' | 'isPaid'>): Promise<string> {
    const id = uuidv4();
    await db.bills.add({
      ...bill,
      id,
      isPaid: 0
    });
    return id;
  }

  static async updateBill(id: string, updates: Partial<Bill>): Promise<void> {
    await db.bills.update(id, updates);
  }

  static async deleteBill(id: string): Promise<void> {
    await db.bills.delete(id);
  }

  static async markAsPaid(id: string): Promise<void> {
    await db.bills.update(id, { isPaid: 1 });
  }

  static async resetMonthlyPaidStatus(): Promise<void> {
    const bills = await db.bills.toArray();
    for (const bill of bills) {
      if (bill.isRecurring === 1 && bill.isPaid === 1) {
        await db.bills.update(bill.id, { isPaid: 0 });
      }
    }
  }

  static async checkAndNotifyDueBills(): Promise<void> {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const bills = await db.bills.toArray();
    const today = new Date();
    const currentDay = today.getDate();

    for (const bill of bills) {
      if (bill.isPaid === 1) continue;

      let daysRemaining = bill.dueDay - currentDay;
      // Handle wrap-around of month
      if (daysRemaining < 0) {
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        daysRemaining += daysInMonth;
      }

      if (daysRemaining <= bill.notifyDaysBefore) {
        let msg = `Your bill "${bill.name}" of ₹${bill.amount} is due in ${daysRemaining} days (on day ${bill.dueDay} of the month).`;
        if (daysRemaining === 0) {
          msg = `Your bill "${bill.name}" of ₹${bill.amount} is due TODAY!`;
        }

        new Notification('Bill Due Reminder 💸', {
          body: msg,
          icon: '/pwa-192x192.png',
          tag: `bill-due-${bill.id}-${today.getMonth()}` // Avoid duplicate alerts in same month
        });
      }
    }
  }
}
