export enum TransactionType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT'
}

export enum CategoryType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME'
}

export enum BudgetPeriod {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY'
}

// Equivalent to Kotlin's Sealed Result class for error handling
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Entities mapping Room specification
export interface TransactionEntity {
  id: string; // UUID
  amount: number;
  type: TransactionType;
  categoryId: string;
  merchantName?: string;
  merchantUpiId?: string;
  note?: string;
  tags: string[]; // List<String> - Natively handled as JSON in Dexie
  dateTime: number; // Unix epoch
  source: string;
  rawSmsText?: string;
  bankName?: string;
  accountLast4?: string;
  upiRefId?: string;
  receiptImagePath?: string;
  isConfirmed: number;
  isRecurring: number;
  currency: string;
  createdAt: number;
  updatedAt: number;
  isDeleted: number; // For soft-delete implementation (0 or 1)
}

export interface CategoryEntity {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
  isCustom: number;
  parentId?: string;
  budgetLimit?: number;
  sortOrder: number;
}

export interface BudgetEntity {
  id: string;
  categoryId?: string; // nullable
  amount: number;
  period: BudgetPeriod;
  startDate: number; // Unix epoch
  endDate: number; 
  alertThreshold: number;
  isActive: number;
}

export interface SmsPatternEntity {
  id: string;
  bankName: string;
  senderPattern: string;
  amountRegex: string;
  merchantRegex: string;
  typeKeywords: string[];
  dateRegex?: string;
  priority: number;
  successCount: number;
  lastMatched?: number;
}

export interface InsightsCacheEntity {
  id: string;
  period: string;
  insightType: string;
  contentJson: any; // Equivalent to JSON object/String
  generatedAt: number;
  expiresAt: number;
}

export interface MoneyScoreHistoryEntity {
  id: string;
  score: number;
  componentsJson: any;
  calculatedAt: number;
  period: string;
}

export interface AdminEventEntity {
  id: string;
  eventType: string;
  payloadJson: any;
  deviceId?: string;
  appVersion: string;
  createdAt: number;
}

export interface GoalEntity {
  id: string;
  name: string;
  emoji: string;
  targetAmount: number;
  currentAmount: number;
  color: string; // hex accent colour
  deadline?: number; // epoch ms, optional
  isCompleted: number; // 0 | 1
  createdAt: number;
  updatedAt: number;
}

export interface GoalContributionEntity {
  id: string;
  goalId: string;
  amount: number;
  note?: string;
  createdAt: number;
}

// Queries DTO Models
export interface DailyTotal {
  date: string; // YYYY-MM-DD
  total: number;
}

export interface CategoryTotal {
  categoryId: string;
  total: number;
}
