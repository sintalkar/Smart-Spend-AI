import Anthropic from '@anthropic-ai/sdk';
import Expense from '../models/Expense.js';
import Budget from '../models/Budget.js';

const getAIAnalysis = async (userId, month) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY environment variable.");
  }

  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  // Fetch user budget and expenses
  const budgetDoc = await Budget.findOne({ userId, month });
  const expenses = await Expense.find({ userId, month });

  const totalBudget = budgetDoc ? budgetDoc.totalBudget : 0;
  const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  // Group by category
  const categoriesMap = {};
  expenses.forEach(e => {
    categoriesMap[e.category] = (categoriesMap[e.category] || 0) + e.amount;
  });

  const categoryBreakdown = Object.keys(categoriesMap).map(cat => ({
    category: cat,
    totalSpent: categoriesMap[cat],
    transactionCount: expenses.filter(e => e.category === cat).length,
    percentageOfBudget: totalBudget > 0 ? Number(((categoriesMap[cat] / totalBudget) * 100).toFixed(1)) : 0
  }));

  const systemPrompt = `You are Smart Spend AI, a hyper-accurate personal finance advisor for Indian users.
You will receive a user's monthly budget, total spending, and category-wise breakdown.
Analyze it and return ONLY raw valid JSON — no markdown, no backticks, no extra text.

Response format:
{
  "alert": true | false,
  "alert_message": "Short urgent message if spending >= 60%",
  "spending_percentage": number,
  "summary": "2-sentence analysis mentioning exact ₹ figures",
  "top_overspending_categories": [
    {
      "category": "name",
      "amount_spent": number,
      "recommended_max": number,
      "excess": number,
      "insight": "Specific insight referencing exact ₹ amounts and behavior",
      "tip": "One concrete actionable fix"
    }
  ],
  "savings_suggestions": [
    {
      "title": "Short title",
      "detail": "Specific advice with ₹ numbers and concrete steps",
      "estimated_monthly_savings": number
    }
  ],
  "investment_suggestions": [
    {
      "title": "Investment option name",
      "detail": "Specific advice mentioning platform and expected outcome",
      "amount": number,
      "platform": "App or platform name",
      "expected_return": "X% p.a.",
      "time_horizon": "short/medium/long term"
    }
  ],
  "motivational_message": "Short encouraging closing message"
}

RULES:
- Use ₹ INR. Be hyper-specific — reference exact amounts from user data.
- Max 3 items per array.
- Never give generic advice. Always tie suggestions to actual numbers.
- If spending > 70%, recommend emergency fund before investments.
- If spending < 60%, still suggest savings and investment opportunities.
- Compare category spend to healthy benchmarks:
    Food: 25-30% of budget | Bills: 30-35% | Transport: 10-15%
    Entertainment: 5-10% | Shopping: 5-10% | Savings target: 20%`;

  const userMessage = `Monthly Budget: ₹${totalBudget}
Total Spending: ₹${totalSpent}
Category Breakdown: ${JSON.stringify(categoryBreakdown)}
Individual Expenses Note Details: ${JSON.stringify(expenses.map(e => ({ name: e.name, amount: e.amount, category: e.category, note: e.note })))}`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2500,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const responseText = msg.content[0].text;
    let cleanText = responseText.trim();
    if (cleanText.includes("```json")) {
      cleanText = cleanText.replace(/```json/g, "").replace(/```/g, "").trim();
    } else if (cleanText.includes("```")) {
      cleanText = cleanText.replace(/```/g, "").trim();
    }

    return JSON.parse(cleanText);
  } catch (error) {
    console.error("[Claude API Error]", error);
    throw error;
  }
};

export { getAIAnalysis };
