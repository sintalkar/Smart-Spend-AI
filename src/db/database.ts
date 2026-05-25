import Dexie, { type EntityTable } from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import {
  TransactionEntity, CategoryEntity, BudgetEntity, SmsPatternEntity,
  InsightsCacheEntity, MoneyScoreHistoryEntity, AdminEventEntity, CategoryType,
  GoalEntity, GoalContributionEntity
} from './models';

// This is the IndexedDB equivalent of Room Database & Migrations. It operates offline-first.
export class SmartSpendDatabase extends Dexie {
  transactions!: EntityTable<TransactionEntity, 'id'>;
  categories!: EntityTable<CategoryEntity, 'id'>;
  budgets!: EntityTable<BudgetEntity, 'id'>;
  smsPatterns!: EntityTable<SmsPatternEntity, 'id'>;
  insightsCache!: EntityTable<InsightsCacheEntity, 'id'>;
  moneyScoreHistory!: EntityTable<MoneyScoreHistoryEntity, 'id'>;
  adminEvents!: EntityTable<AdminEventEntity, 'id'>;
  budgetHistory!: EntityTable<{id: string, budgetId?: string, categoryId: string, amount?: number, oldAmount?: number, newAmount?: number, reason?: string, changedAt: number}, 'id'>;
  merchantMap!: Dexie.Table<{ merchant: string, category: string, icon: string, count: number }, string>;
  bills!: Dexie.Table<{ id: string, name: string, amount: number, dueDay: number, category: string, isRecurring: number, notifyDaysBefore: number, isPaid: number }, string>;
  goals!: EntityTable<GoalEntity, 'id'>;
  goalContributions!: EntityTable<GoalContributionEntity, 'id'>;
  recurringTransactions!: Dexie.Table<{ id: string, amount: number, type: 'DEBIT' | 'CREDIT', categoryId: string, merchantName: string, frequency: string, lastRunDate: number, nextRunDate: number, isPaused: number }, string>;
  anomalies!: Dexie.Table<{ id: string, transactionId: string, categoryId: string, amount: number, averageSpend: number, detectedAt: number, acknowledged: number }, string>;
  netWorth!: Dexie.Table<{ id: string, type: 'asset' | 'liability', name: string, subType: string, value: number, lastUpdated: number }, string>;
  splits!: Dexie.Table<{ id: string, transactionId: string, name: string, amount: number, settled: number }, string>;

  constructor() {
    super('SmartSpendDB');

    // Database migrations & indexing setup equivalent
    // The keys specified here map directly to frequently queried columns (indexes)
    this.version(4).stores({
      transactions: 'id, dateTime, categoryId, type, isRecurring, isDeleted',
      categories: 'id, parentId, type, isCustom, sortOrder',
      budgets: 'id, categoryId, isActive',
      smsPatterns: 'id, bankName',
      insightsCache: 'id, period',
      moneyScoreHistory: 'id, calculatedAt, period',
      adminEvents: 'id, eventType, createdAt',
      budgetHistory: 'id, categoryId, changedAt',
      merchantMap: 'merchant, category',
      bills: 'id, dueDay, isRecurring',
      goals: 'id, isCompleted, createdAt',
      goalContributions: 'id, goalId, createdAt',
      recurringTransactions: 'id, frequency, nextRunDate',
      anomalies: 'id, transactionId, detectedAt',
      netWorth: 'id, type',
      splits: 'id, transactionId, settled'
    });

    // SeedDataProvider implementation resolving on application first use
    this.on('populate', async () => {
      await this.seedDefaultCategories();
    });
  }

  async clearAllData() {
    await this.transactions.clear();
    await this.budgets.clear();
    await this.insightsCache.clear();
    await this.moneyScoreHistory.clear();
    await this.adminEvents.clear();
    await this.budgetHistory.clear();
    await this.merchantMap.clear();
    await this.bills.clear();
    await this.goals.clear();
    await this.goalContributions.clear();
    await this.recurringTransactions.clear();
    await this.anomalies.clear();
    await this.netWorth.clear();
    await this.splits.clear();
    // We keep categories as they are structural metadata needed for the UI to function
  }

  private async seedDefaultCategories() {
    const defaultCategories: CategoryEntity[] = [
      {
        id: 'groceries',
        name: 'Groceries',
        icon: 'shopping-cart',
        color: '#4CAF50',
        type: CategoryType.EXPENSE,
        isCustom: 0,
        sortOrder: 1
      },
      {
        id: 'food_dining',
        name: 'Dining',
        icon: 'utensils',
        color: '#F44336',
        type: CategoryType.EXPENSE,
        isCustom: 0,
        sortOrder: 2
      },
      {
        id: 'transportation',
        name: 'Transport',
        icon: 'bus',
        color: '#2196F3',
        type: CategoryType.EXPENSE,
        isCustom: 0,
        sortOrder: 3
      },
      {
        id: 'entertainment',
        name: 'Entertainment',
        icon: 'film',
        color: '#9C27B0',
        type: CategoryType.EXPENSE,
        isCustom: 0,
        sortOrder: 4
      },
      {
        id: 'bills_utilities',
        name: 'Bills & Utilities',
        icon: 'zap',
        color: '#FFEB3B',
        type: CategoryType.EXPENSE,
        isCustom: 0,
        sortOrder: 5
      },
      {
        id: 'salary',
        name: 'Salary',
        icon: 'briefcase',
        color: '#8BC34A',
        type: CategoryType.INCOME,
        isCustom: 0,
        sortOrder: 6
      }
    ];

    await this.categories.bulkAdd(defaultCategories);
  }
}

// Singleton database instance representing the Hilt DatabaseModule
export const db = new SmartSpendDatabase();
