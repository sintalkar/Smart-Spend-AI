import { TransactionEntity, CategoryEntity, BudgetEntity } from '../../db/models';
import { TransactionType } from '../../db/models';

export interface ScoreBreakdown {
  savingsRate: number;         // Max 25
  budgetAdherence: number;     // Max 15
  emergencyBuffer: number;     // Max 15
  incomeExpenseRatio: number;  // Max 10
  investmentRate: number;      // Max 10
  spendingConsistency: number;  // Max 10
  categoryDiversity: number;   // Max 10
  financialStreak: number;     // Max 5
  total: number;
}

export interface MoneyScoreResult {
  total: number;
  breakdown: ScoreBreakdown;
  grade: 'Excellent' | 'Good' | 'Fair' | 'Needs Work' | 'Critical';
  trend: number;
  percentile: number;
}

export class MoneyScoreCalculator {
  public calculate8FactorScore(
    transactions: TransactionEntity[],
    budgets: BudgetEntity[],
    categories: CategoryEntity[],
    initialBalance: number,
    streakCount: number,
    previousScores: number[] = []
  ): MoneyScoreResult {
    if (transactions.length === 0) {
      return {
        total: 0,
        breakdown: {
          savingsRate: 0,
          budgetAdherence: 0,
          emergencyBuffer: 0,
          incomeExpenseRatio: 0,
          investmentRate: 0,
          spendingConsistency: 0,
          categoryDiversity: 0,
          financialStreak: 0,
          total: 0
        },
        grade: 'Critical',
        trend: 0,
        percentile: 0
      };
    }

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Filter transactions
    const activeTxs = transactions.filter(t => t.isDeleted === 0);
    const last30DaysTxs = activeTxs.filter(t => t.dateTime >= thirtyDaysAgo);

    // 1. Income & Expenses (last 30 days)
    let income30 = 0;
    let expense30 = 0;
    let investment30 = 0;

    last30DaysTxs.forEach(t => {
      if (t.type === TransactionType.CREDIT) {
        income30 += t.amount;
      } else {
        if (t.categoryId === 'savings' || t.tags.includes('goal-savings') || t.tags.includes('investment')) {
          investment30 += t.amount;
        } else {
          expense30 += t.amount;
        }
      }
    });

    // 2. Lifetime Income & Expenses for Balance calculation
    let totalIncome = initialBalance;
    let totalExpense = 0;
    activeTxs.forEach(t => {
      if (t.type === TransactionType.CREDIT) {
        totalIncome += t.amount;
      } else {
        totalExpense += t.amount;
      }
    });
    const currentBalance = Math.max(0, totalIncome - totalExpense);

    // --- Factor 1: Savings Rate (Weight: 25%) ---
    // Target: Save 30% or more of monthly income.
    let savingsRateVal = 0;
    if (income30 > 0) {
      const savedAmount = income30 - expense30;
      const rate = savedAmount / income30;
      if (rate >= 0.30) savingsRateVal = 25;
      else if (rate > 0) savingsRateVal = Math.round(rate * (25 / 0.30));
    } else if (expense30 === 0 && activeTxs.length > 0) {
      savingsRateVal = 20; // Default baseline if no recent transactions but active
    }

    // --- Factor 2: Budget Adherence (Weight: 15%) ---
    // Check if user stays within budgets.
    let budgetAdherenceVal = 15;
    if (budgets.length > 0) {
      let overBudgets = 0;
      budgets.forEach(b => {
        if (b.isActive === 1) {
          const catSpend = last30DaysTxs
            .filter(t => t.type === TransactionType.DEBIT && t.categoryId === b.categoryId)
            .reduce((sum, t) => sum + t.amount, 0);
          if (catSpend > b.amount) {
            overBudgets++;
          }
        }
      });
      const ratio = (budgets.length - overBudgets) / budgets.length;
      budgetAdherenceVal = Math.round(ratio * 15);
    }

    // --- Factor 3: Emergency Fund Buffer (Weight: 15%) ---
    // Target emergency buffer: 3 months of average expenses.
    let emergencyBufferVal = 0;
    const avgMonthlyExpense = Math.max(5000, expense30); // baseline min expense ₹5k
    const targetBuffer = avgMonthlyExpense * 3;
    if (currentBalance >= targetBuffer) {
      emergencyBufferVal = 15;
    } else if (currentBalance > 0) {
      emergencyBufferVal = Math.round((currentBalance / targetBuffer) * 15);
    }

    // --- Factor 4: Income to Expense Stability (Weight: 10%) ---
    // Income should ideally exceed expenses. Ratio of 1.5x+ gets max points.
    let incomeExpenseRatioVal = 0;
    if (expense30 > 0) {
      const ratio = income30 / expense30;
      if (ratio >= 1.5) incomeExpenseRatioVal = 10;
      else if (ratio >= 1.0) incomeExpenseRatioVal = 5 + Math.round((ratio - 1.0) * 10);
      else incomeExpenseRatioVal = Math.round(ratio * 5);
    } else if (income30 > 0) {
      incomeExpenseRatioVal = 10;
    }

    // --- Factor 5: Investment Rate (Weight: 10%) ---
    // Target: Put 10% or more of income into goals/savings.
    let investmentRateVal = 0;
    if (income30 > 0) {
      const rate = investment30 / income30;
      if (rate >= 0.10) investmentRateVal = 10;
      else investmentRateVal = Math.round(rate * 100);
    }

    // --- Factor 6: Spending Consistency (Weight: 10%) ---
    // Penalize large anomalies or high standard deviation days.
    // Calculate standard deviation of daily spending in last 30 days.
    let spendingConsistencyVal = 10;
    const dailySpendMap: Record<string, number> = {};
    last30DaysTxs.filter(t => t.type === TransactionType.DEBIT).forEach(t => {
      const dateStr = new Date(t.dateTime).toDateString();
      dailySpendMap[dateStr] = (dailySpendMap[dateStr] || 0) + t.amount;
    });
    const spends = Object.values(dailySpendMap);
    if (spends.length > 3) {
      const avg = spends.reduce((a, b) => a + b, 0) / spends.length;
      const variance = spends.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / spends.length;
      const stdDev = Math.sqrt(variance);
      // High standard deviation relative to avg indicates spiky, inconsistent spending
      const cv = avg > 0 ? stdDev / avg : 0;
      if (cv > 2.0) spendingConsistencyVal = 3;
      else if (cv > 1.0) spendingConsistencyVal = 6;
      else spendingConsistencyVal = 10;
    }

    // --- Factor 7: Category Spread (Weight: 10%) ---
    // Balanced portfolio: Spreading expenses across at least 3 categories.
    let categoryDiversityVal = 0;
    const usedCategories = new Set(last30DaysTxs.filter(t => t.type === TransactionType.DEBIT).map(t => t.categoryId));
    if (usedCategories.size >= 4) categoryDiversityVal = 10;
    else if (usedCategories.size > 0) categoryDiversityVal = usedCategories.size * 2.5;

    // --- Factor 8: App Engagement Streak (Weight: 5%) ---
    // Log daily streak points.
    let financialStreakVal = 0;
    if (streakCount >= 7) financialStreakVal = 5;
    else if (streakCount > 0) financialStreakVal = Math.round((streakCount / 7) * 5);

    const total = Math.max(0, Math.min(100, 
      savingsRateVal + budgetAdherenceVal + emergencyBufferVal + incomeExpenseRatioVal + 
      investmentRateVal + spendingConsistencyVal + categoryDiversityVal + financialStreakVal
    ));

    let grade: MoneyScoreResult['grade'] = 'Critical';
    if (total >= 85) grade = 'Excellent';
    else if (total >= 70) grade = 'Good';
    else if (total >= 50) grade = 'Fair';
    else if (total >= 30) grade = 'Needs Work';

    const lastScore = previousScores.length > 0 ? previousScores[previousScores.length - 1] : total;
    const trend = previousScores.length > 0 ? total - lastScore : 0;
    const percentile = Math.min(99, Math.floor(total * 0.9 + 5));

    return {
      total,
      breakdown: {
        savingsRate: savingsRateVal,
        budgetAdherence: budgetAdherenceVal,
        emergencyBuffer: emergencyBufferVal,
        incomeExpenseRatio: incomeExpenseRatioVal,
        investmentRate: investmentRateVal,
        spendingConsistency: spendingConsistencyVal,
        categoryDiversity: categoryDiversityVal,
        financialStreak: financialStreakVal,
        total
      },
      grade,
      trend,
      percentile
    };
  }

  // Backward compatibility wrapper
  public calculateScore(
    totalSpent: number,
    totalIncome: number,
    categoryTotals: Record<string, number>,
    dailySpends: number[],
    budgetsMet: number,
    totalBudgets: number,
    previousScores: number[]
  ): MoneyScoreResult {
    // Construct dummy objects to run through the sophisticated calculator
    const dummyTransactions: TransactionEntity[] = [];
    const now = Date.now();
    
    // Add dummy Credits
    if (totalIncome > 0) {
      dummyTransactions.push({
        id: 'credit-1',
        amount: totalIncome,
        type: TransactionType.CREDIT,
        categoryId: 'salary',
        tags: [],
        dateTime: now,
        source: 'MANUAL',
        isConfirmed: 1,
        isRecurring: 0,
        currency: 'INR',
        createdAt: now,
        updatedAt: now,
        isDeleted: 0
      });
    }

    // Add dummy Debits
    Object.entries(categoryTotals).forEach(([catId, amt], i) => {
      dummyTransactions.push({
        id: `debit-${i}`,
        amount: amt,
        type: TransactionType.DEBIT,
        categoryId: catId,
        tags: [],
        dateTime: now,
        source: 'MANUAL',
        isConfirmed: 1,
        isRecurring: 0,
        currency: 'INR',
        createdAt: now,
        updatedAt: now,
        isDeleted: 0
      });
    });

    const dummyBudgets: BudgetEntity[] = Array.from({ length: totalBudgets }).map((_, i) => ({
      id: `budget-${i}`,
      amount: 10000,
      period: 1 as any, // Monthly
      startDate: now,
      endDate: now,
      alertThreshold: 0.8,
      isActive: 1,
      categoryId: i < budgetsMet ? `met-${i}` : `over-${i}`
    }));

    return this.calculate8FactorScore(dummyTransactions, dummyBudgets, [], 0, 5, previousScores);
  }

  public calculateScoreFromFirebase(
    creditedMoney: number,
    debitedMoney: number,
    expenses: number,
    previousScores: number[] = []
  ): MoneyScoreResult {
    return this.calculateScore(expenses, creditedMoney, {}, [], 1, 1, previousScores);
  }
}

export const scoreCalculator = new MoneyScoreCalculator();
