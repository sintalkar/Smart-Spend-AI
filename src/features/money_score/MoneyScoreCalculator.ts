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
    // If there are no transactions at all, score is 0
    if (totalSpent === 0 && totalIncome === 0) {
      return {
        total: 0,
        breakdown: { savingsRate: 0, budgetAdherence: 0, spendingConsistency: 0, incomeExpenseRatio: 0, categoryDiversity: 0, monthlyStreak: 0, total: 0 },
        grade: 'Critical',
        trend: 0,
        percentile: 0
      };
    }

    // 1. Savings Rate (30 pts)
    let savingsRateScore = 0;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalSpent) / totalIncome) * 100 : 0;
    if (savingsRate >= 30) savingsRateScore = 30;
    else if (savingsRate >= 20) savingsRateScore = 20;
    else if (savingsRate >= 10) savingsRateScore = 15;
    else if (savingsRate >= 5) savingsRateScore = 8;
    else if (savingsRate > 0) savingsRateScore = 5;

    // 2. Budget Adherence (25 pts)
    let budgetScore = 0;
    if (totalBudgets > 0) {
      budgetScore = Math.floor((budgetsMet / totalBudgets) * 25);
    }

    // 3. Spending Consistency (15 pts) - Lower variance is better
    let consistencyScore = 15;
    if (dailySpends.length > 0) {
      const mean = dailySpends.reduce((a,b)=>a+b,0) / dailySpends.length;
      const variance = dailySpends.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / dailySpends.length;
      const stdDev = Math.sqrt(variance);
      const cv = mean === 0 ? 0 : stdDev / mean; // Coefficient of variation
      // If CV is low (e.g. < 0.5), it's very consistent. If CV > 1.5, very inconsistent.
      // 0 CV = 15 pt, 1 CV = 7.5 pt, >= 1.5 CV = 0 pt
      consistencyScore = Math.max(0, Math.floor(15 - (cv * 10)));
    }

    // 4. Income/Expense Ratio (15 pts)
    let ratioScore = 0;
    if (totalIncome > 0) {
      const ratio = totalSpent / totalIncome;
      if (ratio <= 0.6) ratioScore = 15;
      else if (ratio <= 0.8) ratioScore = 10;
      else if (ratio <= 1.0) ratioScore = 5;
    } else {
      if (totalSpent === 0) ratioScore = 15;
    }

    // 5. Category Diversity (10 pts)
    let diversityScore = 10;
    if (totalSpent > 0) {
      let maxCatProp = 0;
      for (const amount of Object.values(categoryTotals)) {
        const prop = amount / totalSpent;
        if (prop > maxCatProp) maxCatProp = prop;
      }
      if (maxCatProp > 0.7) diversityScore = 0; // Penalize if one category dominates > 70%
      else if (maxCatProp > 0.5) diversityScore = 5;
    }

    // 6. Monthly Streak (5 pts)
    let streakScore = 0;
    let currentStreak = 0;
    for (let i = previousScores.length - 1; i >= 0; i--) {
      if (previousScores[i] >= 50) currentStreak++;
      else break;
    }
    if (currentStreak >= 3) streakScore = 5;
    else if (currentStreak >= 1) streakScore = 2;

    const total = savingsRateScore + budgetScore + consistencyScore + ratioScore + diversityScore + streakScore;

    let grade: MoneyScoreResult['grade'] = 'Fair';
    if (total >= 85) grade = 'Excellent';
    else if (total >= 70) grade = 'Good';
    else if (total >= 50) grade = 'Fair';
    else if (total >= 30) grade = 'Needs Work';
    else grade = 'Critical';

    const lastScore = previousScores.length > 0 ? previousScores[previousScores.length - 1] : total;
    const trend = previousScores.length > 0 ? total - lastScore : 0;

    // Percentile logic is mock, normally calculated server-side based on population
    const percentile = Math.min(99, Math.floor(total * 0.9 + 5));

    return {
      total,
      breakdown: {
        savingsRate: savingsRateScore,
        budgetAdherence: budgetScore,
        spendingConsistency: consistencyScore,
        incomeExpenseRatio: ratioScore,
        categoryDiversity: diversityScore,
        monthlyStreak: streakScore,
        total: total
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
