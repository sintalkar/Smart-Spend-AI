import { db } from '../database';
import { TransactionEntity, Result, TransactionType, DailyTotal, CategoryTotal } from '../models';
import { format } from 'date-fns';

// TransactionDao equivalent
export class TransactionRepository {
  // Equivalent to `getAll() paginated Flow`.
  // Note: We expose Dexie query chains that React components can wrap with `useLiveQuery`
  // mapping elegantly to Kotlin native `Flow`.
  getAllQuery() {
    return db.transactions.filter(t => t.isDeleted === 0).reverse();
  }

  // Pure Promise-based paginated approach for discrete requests
  async getAllPaginated(page: number, pageSize: number): Promise<Result<TransactionEntity[]>> {
    try {
      const data = await db.transactions
        .filter(t => t.isDeleted === 0)
        .reverse()
        .offset(page * pageSize)
        .limit(pageSize)
        .toArray();
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  // Equivalent to `getByDateRange(start, end) Flow`
  getByDateRangeQuery(startEpoch: number, endEpoch: number) {
    return db.transactions
      .where('dateTime').between(startEpoch, endEpoch)
      .filter(t => t.isDeleted === 0);
  }

  // Equivalent to `getByCategory(categoryId) Flow`
  getByCategoryQuery(categoryId: string) {
    return db.transactions
      .where('categoryId').equals(categoryId)
      .filter(t => t.isDeleted === 0);
  }

  // Equivalent to `getTotalByType(type, start, end) Flow<Double>`
  async getTotalByType(type: TransactionType, startEpoch: number, endEpoch: number): Promise<Result<number>> {
    try {
      const txs = await db.transactions
        .where('dateTime').between(startEpoch, endEpoch)
        .filter(t => t.type === type && t.isDeleted === 0)
        .toArray();
      const total = txs.reduce((sum, t) => sum + t.amount, 0);
      return { success: true, data: total };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  // Equivalent to `getDailyTotals(start, end) Flow<List<DailyTotal>>`
  async getDailyTotals(startEpoch: number, endEpoch: number): Promise<Result<DailyTotal[]>> {
    try {
      const txs = await db.transactions
        .where('dateTime').between(startEpoch, endEpoch)
        .filter(t => t.isDeleted === 0)
        .toArray();
        
      const grouped = new Map<string, number>();
      txs.forEach(t => {
        const dateStr = format(new Date(t.dateTime), 'yyyy-MM-dd');
        grouped.set(dateStr, (grouped.get(dateStr) || 0) + (t.type === TransactionType.DEBIT ? -t.amount : t.amount));
      });
      
      const result = Array.from(grouped.entries()).map(([date, total]) => ({ date, total }));
      result.sort((a, b) => a.date.localeCompare(b.date)); // Chronological order
      return { success: true, data: result };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  // Equivalent to `getCategoryTotals(start, end) Flow<List<CategoryTotal>>`
  async getCategoryTotals(startEpoch: number, endEpoch: number): Promise<Result<CategoryTotal[]>> {
    try {
      const txs = await db.transactions
        .where('dateTime').between(startEpoch, endEpoch)
        .filter(t => t.isDeleted === 0)
        .toArray();
        
      const grouped = new Map<string, number>();
      txs.forEach(t => {
        grouped.set(t.categoryId, (grouped.get(t.categoryId) || 0) + t.amount);
      });
      
      const result = Array.from(grouped.entries()).map(([categoryId, total]) => ({ categoryId, total }));
      return { success: true, data: result };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  // Equivalent to `search(query) Flow<List<Transaction>>`
  searchQuery(query: string) {
    const q = query.toLowerCase();
    return db.transactions.filter(t => t.isDeleted === 0 && (
      (t.note?.toLowerCase().includes(q) ?? false) || 
      (t.merchantName?.toLowerCase().includes(q) ?? false) ||
      (t.tags?.some(tag => tag.toLowerCase().includes(q)) ?? false)
    ));
  }

  // Equivalent to `getRecurring() Flow`
  getRecurringQuery() {
    return db.transactions
      .where('isRecurring').equals(1) // Dexie booleans/integers
      .filter(t => t.isDeleted === 0);
  }

  // Equivalent to `softDelete(id)`
  async softDelete(id: string): Promise<Result<boolean>> {
    try {
      await db.transactions.update(id, { 
        isDeleted: 1,
        updatedAt: Date.now()
      });
      return { success: true, data: true };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  // Equivalent to `update(id, updates)`
  async update(id: string, updates: Partial<TransactionEntity>): Promise<Result<void>> {
    try {
      await db.transactions.update(id, { ...updates, updatedAt: Date.now() });
      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  async upsert(transaction: TransactionEntity): Promise<Result<string>> {
    try {
      await db.transactions.put(transaction);
      return { success: true, data: transaction.id };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}

// Singleton export mapping Hilt dependency injection
export const transactionRepo = new TransactionRepository();
