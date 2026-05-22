import { db } from '../database';
import { BudgetEntity, Result } from '../models';

export class BudgetRepository {
  // Equivalent to `getActive()`
  getActiveQuery() {
    // Note: IndexedDB doesn't natively map boolean to indexed fields simply,
    // so we evaluate in memory using JS filter if bools, or numeric 1/0
    // assuming 'isActive' is boolean and works with `.filter`
    return db.budgets.filter(b => b.isActive === 1);
  }

  // Equivalent to `getByCategory(categoryId)`
  getByCategoryQuery(categoryId: string) {
    return db.budgets.where('categoryId').equals(categoryId);
  }

  // Equivalent to `checkAlerts()`
  async checkAlerts(): Promise<Result<BudgetEntity[]>> {
    try {
      const activeBudgets = await db.budgets.filter(b => b.isActive === 1).toArray();
      const currentEpoch = Date.now();
      
      const alerts = activeBudgets.filter(b => {
        // Find if we are currently inside the budget period
        if (currentEpoch >= b.startDate && currentEpoch <= b.endDate) {
          // This returns budgets that are active.
          // Real alert checking would require summing linked transactions via TransactionRepo
          // and comparing `summedAmount >= b.amount * (b.alertThreshold / 100)`
          return true; 
        }
        return false;
      });
      
      return { success: true, data: alerts };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  async save(budget: BudgetEntity): Promise<Result<string>> {
    try {
      await db.budgets.put(budget);
      return { success: true, data: budget.id };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}

export const budgetRepo = new BudgetRepository();
