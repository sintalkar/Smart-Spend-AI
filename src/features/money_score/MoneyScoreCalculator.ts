export interface ScoreBreakdown {
  savingsRate: number;
  budgetAdherence: number;
  spendingConsistency: number;
  incomeExpenseRatio: number;
  categoryDiversity: number;
  monthlyStreak: number;
  total: number;
}

export interface MoneyScoreResult {
  total: number;
  breakdown: ScoreBreakdown;
  grade: 'Excellent' | 'Good' | 'Fair' | 'Needs Work' | 'Critical';
  trend: number; // e.g. +5 or -2
  percentile: number; // e.g. 85 (meaning top 15%)
}

export class MoneyScoreCalculator {
  public calculateScore(
    totalSpent: number,
    totalIncome: number,
    categoryTotals: Record<string, number>,
    dailySpends: number[],
    budgetsMet: number,
    totalBudgets: number,
    previousScores: number[]
  ): MoneyScoreResult {
    // If there are no transactions at all, score starts at 0
    if (totalSpent === 0 && totalIncome === 0) {
      return {
        total: 0,
        breakdown: { savingsRate: 0, budgetAdherence: 0, spendingConsistency: 0, incomeExpenseRatio: 0, categoryDiversity: 0, monthlyStreak: 0, total: 0 },
        grade: 'Critical',
        trend: 0,
        percentile: 0
      };
    }

    // Simple direct formula based on Income and Spent totals:
    // Score = ((Total Income - Total Spent) / Total Income) * 100
    // Capped between 0 and 100
    let rawScore = 0;
    if (totalIncome > 0) {
      rawScore = ((totalIncome - totalSpent) / totalIncome) * 100;
    }
    const total = Math.max(0, Math.min(100, Math.round(rawScore)));

    let grade: MoneyScoreResult['grade'] = 'Critical';
    if (total >= 85) grade = 'Excellent';
    else if (total >= 70) grade = 'Good';
    else if (total >= 50) grade = 'Fair';
    else if (total >= 30) grade = 'Needs Work';

    const lastScore = previousScores.length > 0 ? previousScores[previousScores.length - 1] : total;
    const trend = previousScores.length > 0 ? total - lastScore : 0;
    const percentile = Math.min(99, Math.floor(total * 0.9 + 5));

    // Breakdown mapped proportionally from the single score
    const savingsRate = Math.round(total * 0.30);
    const budgetAdherence = Math.round(total * 0.25);
    const spendingConsistency = Math.round(total * 0.15);
    const incomeExpenseRatio = Math.round(total * 0.15);
    const categoryDiversity = Math.round(total * 0.10);
    const monthlyStreak = Math.round(total * 0.05);

    return {
      total,
      breakdown: {
        savingsRate,
        budgetAdherence,
        spendingConsistency,
        incomeExpenseRatio,
        categoryDiversity,
        monthlyStreak,
        total
      },
      grade,
      trend,
      percentile
    };
  }

  public calculateScoreFromFirebase(
    creditedMoney: number,
    debitedMoney: number,
    expenses: number,
    previousScores: number[] = []
  ): MoneyScoreResult {
    // If there are no transactions at all, score starts at 0
    if (creditedMoney === 0 && debitedMoney === 0 && expenses === 0) {
      return {
        total: 0,
        breakdown: { savingsRate: 0, budgetAdherence: 0, spendingConsistency: 0, incomeExpenseRatio: 0, categoryDiversity: 0, monthlyStreak: 0, total: 0 },
        grade: 'Critical',
        trend: 0,
        percentile: 0
      };
    }

    // Simple direct formula based on Firebase totals:
    // Score = ((Credited - Expenses) / Credited) * 100
    // Capped between 0 and 100
    // Note: debitedMoney and expenses are the same value in Firebase,
    // so we use only expenses to avoid double-counting.
    let rawScore = 0;
    if (creditedMoney > 0) {
      rawScore = ((creditedMoney - expenses) / creditedMoney) * 100;
    }
    const total = Math.max(0, Math.min(100, Math.round(rawScore)));

    let grade: MoneyScoreResult['grade'] = 'Critical';
    if (total >= 85) grade = 'Excellent';
    else if (total >= 70) grade = 'Good';
    else if (total >= 50) grade = 'Fair';
    else if (total >= 30) grade = 'Needs Work';

    const lastScore = previousScores.length > 0 ? previousScores[previousScores.length - 1] : total;
    const trend = previousScores.length > 0 ? total - lastScore : 0;
    const percentile = Math.min(99, Math.floor(total * 0.9 + 5));

    // Breakdown mapped proportionally from the single score
    const savingsRate = Math.round(total * 0.30);
    const budgetAdherence = Math.round(total * 0.25);
    const spendingConsistency = Math.round(total * 0.15);
    const incomeExpenseRatio = Math.round(total * 0.15);
    const categoryDiversity = Math.round(total * 0.10);
    const monthlyStreak = Math.round(total * 0.05);

    return {
      total,
      breakdown: {
        savingsRate,
        budgetAdherence,
        spendingConsistency,
        incomeExpenseRatio,
        categoryDiversity,
        monthlyStreak,
        total
      },
      grade,
      trend,
      percentile
    };
  }
}

export const scoreCalculator = new MoneyScoreCalculator();
