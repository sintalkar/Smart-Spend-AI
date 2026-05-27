import { BudgetEntity, CategoryEntity, TransactionEntity, TransactionType } from '../../db/models';

export type SpendingPersonality =
  | 'Impulse Spender'
  | 'Emotional Spender'
  | 'Balanced Spender'
  | 'Disciplined Saver'
  | 'Overspender';

export type WasteCategory = {
  categoryId: string;
  name: string;
  amount: number;
  color: string;
  share: number;
};

export type BudgetProgress = {
  categoryId: string;
  name: string;
  actual: number;
  budget: number;
  percent: number;
  color: string;
};

export type InvestmentSuggestion = {
  title: string;
  amount: number;
  description: string;
};

export type OptimizedBudgetItem = {
  categoryId: string;
  name: string;
  current: number;
  recommended: number;
  reason: string;
  color: string;
};

export type AiAdvisorAnalysis = {
  income: number;
  monthlyBudgetGoal: number;
  totalSpent: number;
  remaining: number;
  budgetVariance: number;
  budgetUsagePercent: number;
  budgetStatus: 'under' | 'moderate' | 'over' | 'critical';
  budgetStatusColor: string;
  aiAdviceTitle: string;
  aiAdviceMessage: string;
  nextMonthPrediction: number;
  nextMonthPredictionLabel: string;
  wasteAmount: number;
  wastePercent: number;
  savingsRate: number;
  healthScore: number;
  healthColor: string;
  healthLabel: string;
  personality: SpendingPersonality;
  personalityDescription: string;
  wasteCategories: WasteCategory[];
  budgetProgress: BudgetProgress[];
  investmentSuggestions: InvestmentSuggestion[];
  optimizedBudget: OptimizedBudgetItem[];
  actionableTips: string[];
};

const nonEssentialKeywords = [
  'shopping',
  'entertainment',
  'dining',
  'food_dining',
  'restaurant',
  'subscriptions',
  'subscription',
  'fashion',
  'clothes',
  'lifestyle',
  'movies',
  'gaming',
  'travel',
  'cafe',
];

const defaultCategoryMeta: Record<string, { name: string; color: string }> = {
  groceries: { name: 'Groceries', color: '#4CAF50' },
  food_dining: { name: 'Dining Out', color: '#F97316' },
  transportation: { name: 'Transport', color: '#38BDF8' },
  entertainment: { name: 'Entertainment', color: '#A855F7' },
  bills_utilities: { name: 'Bills & Utilities', color: '#FACC15' },
  salary: { name: 'Salary', color: '#22C55E' },
  shopping: { name: 'Shopping', color: '#FB7185' },
  subscriptions: { name: 'Subscriptions', color: '#F43F5E' },
  fashion: { name: 'Fashion', color: '#EC4899' },
  other: { name: 'Other', color: '#64748B' },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const roundMoney = (value: number) => Math.max(0, Math.round(value));

function isSameMonth(timestamp: number, now = new Date()) {
  const date = new Date(timestamp);
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function getCategoryMeta(categoryId: string, categories: CategoryEntity[]) {
  const category = categories.find((item) => item.id === categoryId);
  const fallback = defaultCategoryMeta[categoryId] || { name: titleCase(categoryId), color: '#64748B' };
  return {
    name: category?.name || fallback.name,
    color: category?.color || fallback.color,
  };
}

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\w\S*/g, (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
}

function isNonEssential(categoryId: string, name: string) {
  const haystack = `${categoryId} ${name}`.toLowerCase();
  return nonEssentialKeywords.some((keyword) => haystack.includes(keyword));
}

function getHealthColor(score: number) {
  if (score >= 75) return '#22C55E';
  if (score >= 50) return '#F59E0B';
  return '#F43F5E';
}

function getHealthLabel(score: number) {
  if (score >= 75) return 'Strong';
  if (score >= 50) return 'Needs Control';
  return 'Critical';
}

function getPersonality(params: {
  income: number;
  totalSpent: number;
  savingsRate: number;
  wastePercent: number;
  wasteByCategory: Record<string, number>;
  categories: CategoryEntity[];
}): { personality: SpendingPersonality; description: string } {
  const { income, totalSpent, savingsRate, wastePercent, wasteByCategory, categories } = params;
  const topWaste = Object.entries(wasteByCategory).sort((a, b) => b[1] - a[1])[0];
  const topWasteName = topWaste ? getCategoryMeta(topWaste[0], categories).name.toLowerCase() : '';

  if (income > 0 && totalSpent > income) {
    return {
      personality: 'Overspender',
      description: 'Your expenses crossed your income this month. The priority is to cap non-essential spending fast.',
    };
  }

  if (savingsRate >= 35 && wastePercent < 18) {
    return {
      personality: 'Disciplined Saver',
      description: 'You protect savings well and keep lifestyle spending under control. Keep this rhythm.',
    };
  }

  if (wastePercent >= 35 && /shopping|fashion|entertainment|gaming|movies/.test(topWasteName)) {
    return {
      personality: 'Impulse Spender',
      description: 'A few tempting categories are pulling money away from your goals. Add a 24-hour pause before buying.',
    };
  }

  if (wastePercent >= 25 && /dining|restaurant|cafe|food/.test(topWasteName)) {
    return {
      personality: 'Emotional Spender',
      description: 'Food and comfort spending look elevated. Plan treats, but give them a fixed weekly limit.',
    };
  }

  return {
    personality: 'Balanced Spender',
    description: 'Your spending pattern is fairly stable. Small category limits can turn this into a stronger savings month.',
  };
}

function buildInvestmentSuggestions(remaining: number): InvestmentSuggestion[] {
  if (remaining <= 0) {
    return [
      {
        title: 'Recovery Buffer',
        amount: 500,
        description: 'Start with a tiny buffer before investing. Even a small reserve prevents next-month borrowing.',
      },
      {
        title: 'Expense Freeze',
        amount: 0,
        description: 'Pause shopping, entertainment, and subscriptions for 7 days to bring cash flow back to positive.',
      },
      {
        title: 'High-Interest Debt First',
        amount: 0,
        description: 'If any credit-card dues exist, clear them before SIPs or fixed deposits.',
      },
    ];
  }

  return [
    {
      title: 'Emergency Fund',
      amount: roundMoney(remaining * 0.4),
      description: 'Move this to a separate savings account for rent, medical, or urgent travel safety.',
    },
    {
      title: 'Monthly SIP',
      amount: roundMoney(remaining * 0.3),
      description: 'Invest steadily in a broad mutual fund SIP instead of waiting for the perfect market timing.',
    },
    {
      title: 'Short-Term FD',
      amount: roundMoney(remaining * 0.2),
      description: 'Park this safely for predictable goals like fees, laptop upgrades, or semester expenses.',
    },
    {
      title: 'Flexible Goal Fund',
      amount: roundMoney(remaining * 0.1),
      description: 'Keep this liquid for learning, certificates, or project-demo expenses.',
    },
  ];
}

function buildTips(params: {
  income: number;
  monthlyBudgetGoal: number;
  wasteAmount: number;
  wastePercent: number;
  remaining: number;
  wasteCategories: WasteCategory[];
  budgetProgress: BudgetProgress[];
}) {
  const { income, monthlyBudgetGoal, wasteAmount, wastePercent, remaining, wasteCategories, budgetProgress } = params;
  const topWaste = wasteCategories[0];
  const overBudget = budgetProgress.find((item) => item.percent > 100);
  const tips: string[] = [];

  if (topWaste) {
    tips.push(`Cut ${topWaste.name} by 25% next month to save about INR ${roundMoney(topWaste.amount * 0.25).toLocaleString('en-IN')}.`);
  }

  if (wastePercent > 30) {
    tips.push(`Your waste spend is ${Math.round(wastePercent)}% of income. Keep it below 20% for a healthier month.`);
  } else if (income > 0) {
    tips.push('Keep non-essential spending below 20% of income and route the difference into savings on salary day.');
  }

  if (monthlyBudgetGoal > 0) {
    tips.push(`Split your monthly budget goal into a weekly limit of INR ${roundMoney(monthlyBudgetGoal / 4).toLocaleString('en-IN')}.`);
  }

  if (overBudget) {
    tips.push(`${overBudget.name} is over budget. Set a weekly cap of INR ${roundMoney(overBudget.budget / 4).toLocaleString('en-IN')} to recover control.`);
  }

  if (remaining > 0) {
    tips.push(`Auto-transfer INR ${roundMoney(remaining * 0.3).toLocaleString('en-IN')} into SIP or emergency savings before casual spending starts.`);
  } else {
    tips.push('Use a 7-day no-spend challenge for shopping, entertainment, and food delivery to create breathing room.');
  }

  tips.push(`Review subscriptions this week; cancelling one unused plan can reduce waste without changing daily life.`);

  if (wasteAmount === 0 && income === 0) {
    return [
      'Add this month\'s income and expenses to unlock a precise advisor report.',
      'Set category budgets first so the advisor can compare planned vs actual spending.',
      'Log dining, shopping, and entertainment separately for better waste detection.',
      'Use the Set Balance button on the dashboard before recording new expenses.',
    ];
  }

  return tips.slice(0, 5);
}

function getBudgetStatus(totalSpent: number, monthlyBudgetGoal: number) {
  if (monthlyBudgetGoal <= 0) {
    return {
      status: 'moderate' as const,
      color: '#F59E0B',
      title: 'Set a budget goal to unlock sharper advice',
      message: 'Add a monthly spending limit first. Smart Spend will compare your real expenses with the target and generate a stronger action plan.',
    };
  }

  const usage = (totalSpent / monthlyBudgetGoal) * 100;
  if (usage >= 125) {
    return {
      status: 'critical' as const,
      color: '#F43F5E',
      title: 'Strong warning: spending is far above budget',
      message: 'Your actual spending is much higher than your goal. Freeze non-essential categories for the next 7 days and reset category limits immediately.',
    };
  }

  if (usage > 100) {
    return {
      status: 'over' as const,
      color: '#F97316',
      title: 'You crossed your monthly budget',
      message: 'You are over budget, but this is still recoverable. Focus on the top waste category and reduce flexible spending this week.',
    };
  }

  if (usage >= 75) {
    return {
      status: 'moderate' as const,
      color: '#F59E0B',
      title: 'Moderate spending: stay alert',
      message: 'You are within budget but close enough to require control. Keep purchases intentional and avoid impulse spending.',
    };
  }

  return {
    status: 'under' as const,
    color: '#22C55E',
    title: 'Great job: you are under budget',
    message: 'Your spending is controlled. Move part of the surplus into savings or investments before it becomes casual spending.',
  };
}

function predictNextMonthSpend(totalSpent: number, wastePercent: number, budgetStatus: AiAdvisorAnalysis['budgetStatus']) {
  if (totalSpent <= 0) return 0;
  const statusMultiplier =
    budgetStatus === 'critical' ? 1.12 :
    budgetStatus === 'over' ? 1.06 :
    budgetStatus === 'moderate' ? 1.02 :
    0.94;
  const wasteMultiplier = wastePercent > 30 ? 1.05 : wastePercent < 15 ? 0.96 : 1;
  return roundMoney(totalSpent * statusMultiplier * wasteMultiplier);
}

export function analyzeSmartAdvisor(params: {
  transactions: TransactionEntity[];
  budgets: BudgetEntity[];
  categories: CategoryEntity[];
  initialBalance: number;
  incomeOverride?: number;
  monthlyBudgetGoal?: number;
  now?: Date;
}): AiAdvisorAnalysis {
  const { transactions, budgets, categories, initialBalance, incomeOverride, monthlyBudgetGoal = 0, now = new Date() } = params;
  const activeTransactions = transactions.filter((tx) => tx.isDeleted === 0 && isSameMonth(tx.dateTime, now));
  const credits = activeTransactions.filter((tx) => tx.type === TransactionType.CREDIT);
  const debits = activeTransactions.filter((tx) => tx.type === TransactionType.DEBIT);
  const incomeFromCredits = credits.reduce((sum, tx) => sum + tx.amount, 0);
  const totalSpent = debits.reduce((sum, tx) => sum + tx.amount, 0);
  const income = incomeOverride && incomeOverride > 0 ? incomeOverride : incomeFromCredits > 0 ? incomeFromCredits : initialBalance;
  const remaining = income - totalSpent;
  const budgetVariance = monthlyBudgetGoal - totalSpent;
  const budgetUsagePercent = monthlyBudgetGoal > 0 ? (totalSpent / monthlyBudgetGoal) * 100 : 0;
  const budgetSignal = getBudgetStatus(totalSpent, monthlyBudgetGoal);

  const spentByCategory = debits.reduce<Record<string, number>>((acc, tx) => {
    acc[tx.categoryId] = (acc[tx.categoryId] || 0) + tx.amount;
    return acc;
  }, {});

  const wasteByCategory = Object.entries(spentByCategory).reduce<Record<string, number>>((acc, [categoryId, amount]) => {
    const meta = getCategoryMeta(categoryId, categories);
    if (isNonEssential(categoryId, meta.name)) {
      acc[categoryId] = amount;
    }
    return acc;
  }, {});

  const wasteAmount = Object.values(wasteByCategory).reduce((sum, amount) => sum + amount, 0);
  const wastePercent = income > 0 ? (wasteAmount / income) * 100 : 0;
  const savingsRate = income > 0 ? ((income - totalSpent) / income) * 100 : 0;
  const overspendPenalty = income > 0 && totalSpent > income ? 25 : 0;
  const score = clamp(
    Math.round(100 - wastePercent * 0.9 - Math.max(0, 25 - savingsRate) * 0.8 - overspendPenalty),
    0,
    100
  );

  const wasteCategories = Object.entries(wasteByCategory)
    .map(([categoryId, amount]) => {
      const meta = getCategoryMeta(categoryId, categories);
      return {
        categoryId,
        name: meta.name,
        amount,
        color: meta.color,
        share: wasteAmount > 0 ? Math.round((amount / wasteAmount) * 100) : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const categoryBudgetMap = new Map(
    budgets
      .filter((budget) => budget.categoryId && budget.categoryId !== 'global' && budget.isActive !== 0)
      .map((budget) => [budget.categoryId!, budget.amount])
  );

  const budgetCategoryIds = Array.from(new Set([...Object.keys(spentByCategory), ...categoryBudgetMap.keys()]));
  const budgetProgress = budgetCategoryIds
    .filter((categoryId) => categoryId !== 'salary')
    .map((categoryId) => {
      const meta = getCategoryMeta(categoryId, categories);
      const actual = spentByCategory[categoryId] || 0;
      const budget = categoryBudgetMap.get(categoryId) || Math.max(actual, monthlyBudgetGoal * 0.1, income * 0.08, 1);
      return {
        categoryId,
        name: meta.name,
        actual,
        budget,
        percent: Math.round((actual / budget) * 100),
        color: meta.color,
      };
    })
    .sort((a, b) => b.actual - a.actual);

  const { personality, description } = getPersonality({
    income,
    totalSpent,
    savingsRate,
    wastePercent,
    wasteByCategory,
    categories,
  });

  const optimizedBudget = budgetProgress.slice(0, 8).map((item) => {
    const nonEssential = isNonEssential(item.categoryId, item.name);
    const reduction = nonEssential ? 0.72 : item.percent > 100 ? 0.9 : 1;
    const recommended = roundMoney(Math.max(item.budget * 0.75, item.actual * reduction));
    return {
      categoryId: item.categoryId,
      name: item.name,
      current: item.actual,
      recommended,
      reason: nonEssential
        ? 'Lifestyle category: reduce by about 25-30% and move the difference to savings.'
        : item.percent > 100
          ? 'Essential category but over budget: tighten slightly without unrealistic cuts.'
          : 'Healthy category: keep this cap stable next month.',
      color: item.color,
    };
  });

  if (optimizedBudget.length === 0 && income > 0) {
    const planBase = monthlyBudgetGoal > 0 ? monthlyBudgetGoal : income;
    optimizedBudget.push(
      {
        categoryId: 'needs',
        name: 'Needs',
        current: 0,
        recommended: roundMoney(planBase * 0.5),
        reason: 'Keep core essentials within half of income.',
        color: '#38BDF8',
      },
      {
        categoryId: 'wants',
        name: 'Wants',
        current: 0,
        recommended: roundMoney(planBase * 0.2),
        reason: 'Limit non-essential spending to protect savings.',
        color: '#F97316',
      },
      {
        categoryId: 'savings',
        name: 'Savings',
        current: 0,
        recommended: roundMoney(Math.max(0, income - planBase)),
        reason: 'Pay yourself first as soon as income arrives.',
        color: '#22C55E',
      }
    );
  }

  return {
    income,
    monthlyBudgetGoal,
    totalSpent,
    remaining,
    budgetVariance,
    budgetUsagePercent,
    budgetStatus: budgetSignal.status,
    budgetStatusColor: budgetSignal.color,
    aiAdviceTitle: budgetSignal.title,
    aiAdviceMessage: budgetSignal.message,
    nextMonthPrediction: predictNextMonthSpend(totalSpent, wastePercent, budgetSignal.status),
    nextMonthPredictionLabel:
      budgetSignal.status === 'under'
        ? 'Likely lower if you keep this discipline'
        : budgetSignal.status === 'moderate'
          ? 'Likely stable, but watch flexible spending'
          : 'Likely higher unless you cut waste now',
    wasteAmount,
    wastePercent,
    savingsRate,
    healthScore: score,
    healthColor: getHealthColor(score),
    healthLabel: getHealthLabel(score),
    personality,
    personalityDescription: description,
    wasteCategories,
    budgetProgress,
    investmentSuggestions: buildInvestmentSuggestions(remaining),
    optimizedBudget,
    actionableTips: buildTips({ income, monthlyBudgetGoal, wasteAmount, wastePercent, remaining, wasteCategories, budgetProgress }),
  };
}
