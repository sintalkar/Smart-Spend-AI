import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import Expense from '../models/Expense.js';
import Budget from '../models/Budget.js';
import User from '../models/User.js';

// Multi-Key Load Balancer for Gemini
const getGeminiKeys = () => {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.Smart_Spend,
    process.env.KEY_AI,
    process.env.ss_key
  ];
  return Array.from(new Set(keys.map(k => (k || '').trim()).filter(Boolean)));
};

let currentKeyIndex = 0;
const getGeminiClient = () => {
  const keys = getGeminiKeys();
  if (keys.length === 0) return null;
  const key = keys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  return new GoogleGenAI({ apiKey: key });
};

const getClaudeClient = () => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
};

// Global rate limiter mutex queue to prevent 429 quota exhaustion
class PacedQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.lastCallTime = 0;
    this.delayMs = 2500; // 2.5s spacer
  }

  async enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const now = Date.now();
          const elapsed = now - this.lastCallTime;
          if (elapsed < this.delayMs) {
            await new Promise(r => setTimeout(r, this.delayMs - elapsed));
          }
          this.lastCallTime = Date.now();
          resolve(await task());
        } catch (e) {
          reject(e);
        }
      });
      this.process();
    });
  }

  async process() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) await task();
    }
    this.isProcessing = false;
  }
}

const apiQueue = new PacedQueue();

// Execute wrapper with fallback (Claude -> Gemini -> Fallback JSON)
const executeAI = async (prompt, systemInstruction, imageBuffer = null, mimeType = null) => {
  const claude = getClaudeClient();
  const gemini = getGeminiClient();

  if (!claude && !gemini) {
    throw new Error("No configured AI credentials (ANTHROPIC_API_KEY or GEMINI_API_KEY) found on the backend.");
  }

  return await apiQueue.enqueue(async () => {
    // Attempt Claude first if key is present and no image is attached (as Claude API differs slightly for images)
    if (claude && !imageBuffer) {
      try {
        console.log("[AI Engine] Querying Claude API...");
        const response = await claude.messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 3000,
          temperature: 0,
          system: systemInstruction,
          messages: [{ role: "user", content: prompt }]
        });
        return response.content[0].text;
      } catch (err) {
        console.warn("[AI Engine] Claude API error, falling back to Gemini:", err.message);
      }
    }

    // Fallback or Direct to Gemini
    if (gemini) {
      try {
        console.log("[AI Engine] Querying Gemini API...");
        const modelName = imageBuffer ? "gemini-2.5-flash" : "gemini-flash-lite-latest";
        
        const contents = [];
        if (imageBuffer && mimeType) {
          contents.push({
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType
            }
          });
        }
        contents.push({ text: prompt });

        const response = await gemini.models.generateContent({
          model: modelName,
          contents,
          config: {
            temperature: 0,
            systemInstruction,
            responseMimeType: "application/json"
          }
        });
        return response.text;
      } catch (err) {
        console.error("[AI Engine] Gemini API error:", err.message);
        throw err;
      }
    }

    throw new Error("AI call failed on all providers.");
  });
};

const parseJSON = (text) => {
  let clean = text.trim();
  if (clean.includes("```json")) {
    clean = clean.replace(/```json/g, "").replace(/```/g, "").trim();
  } else if (clean.includes("```")) {
    clean = clean.replace(/```/g, "").trim();
  }
  return JSON.parse(clean);
};

// 1. UPI Merchant Name & Category Matcher Engine
const preprocessMerchant = (name) => {
  const lower = name.toLowerCase();
  
  // Normalize UPI string structures typical in Indian banks
  // E.g. "UPI/923489234/Ax/Zomato/Restaurant" -> "Zomato"
  let cleanName = name;
  const upiParts = name.split('/');
  if (upiParts.length > 2) {
    // Pick the most likely merchant name from parts
    for (const part of upiParts) {
      const pLower = part.toLowerCase();
      if (pLower !== 'upi' && pLower !== 'transfer' && pLower !== 'pay' && !pLower.match(/^\d+$/) && pLower.length > 2) {
        cleanName = part;
        break;
      }
    }
  }

  const cleanLower = cleanName.toLowerCase();
  
  if (cleanLower.includes('zomato') || cleanLower.includes('swiggy') || cleanLower.includes('starbucks') || cleanLower.includes('restaurant') || cleanLower.includes('cafe')) {
    return { name: "Swiggy / Zomato / Dining", category: "Food & Dining" };
  }
  if (cleanLower.includes('amazon') || cleanLower.includes('flipkart') || cleanLower.includes('myntra') || cleanLower.includes('ajio') || cleanLower.includes('shopping')) {
    return { name: "Amazon / Flipkart / Shopping", category: "Shopping" };
  }
  if (cleanLower.includes('ola') || cleanLower.includes('uber') || cleanLower.includes('rapido') || cleanLower.includes('metro') || cleanLower.includes('petrol') || cleanLower.includes('cng') || cleanLower.includes('fuel')) {
    return { name: "Ola / Uber / Transport", category: "Transport" };
  }
  if (cleanLower.includes('jio') || cleanLower.includes('airtel') || cleanLower.includes('bescom') || cleanLower.includes('electricity') || cleanLower.includes('bill') || cleanLower.includes('recharge')) {
    return { name: "Airtel / Jio / Bills", category: "Bills & Utilities" };
  }
  if (cleanLower.includes('zerodha') || cleanLower.includes('groww') || cleanLower.includes('indmoney') || cleanLower.includes('mutual fund') || cleanLower.includes('sip')) {
    return { name: "Zerodha / Groww / SIP", category: "Investments" };
  }
  if (cleanLower.includes('netflix') || cleanLower.includes('prime') || cleanLower.includes('hotstar') || cleanLower.includes('spotify')) {
    return { name: cleanName, category: "Entertainment" };
  }
  if (cleanLower.includes('doctor') || cleanLower.includes('pharmacy') || cleanLower.includes('hospital') || cleanLower.includes('apollo') || cleanLower.includes('medplus')) {
    return { name: cleanName, category: "Health" };
  }

  return { name: cleanName, category: "Others" };
};

// 2. Main Spending Analysis and Habits Engine
export const getAIAnalysis = async (userId, month) => {
  const expenses = await Expense.find({ userId, month });
  const budgetDoc = await Budget.findOne({ userId, month });
  const user = await User.findById(userId);

  const totalBudget = budgetDoc ? budgetDoc.totalBudget : 15000;
  const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  
  // Clean, preprocess and enrich merchant transaction categories
  const enrichedExpenses = expenses.map(e => {
    const matched = preprocessMerchant(e.name);
    return {
      originalName: e.name,
      normalizedName: matched.name,
      category: e.category || matched.category,
      amount: e.amount,
      date: e.date,
      note: e.note || ""
    };
  });

  // Calculate detailed grouped category expenditures
  const categoriesMap = {};
  enrichedExpenses.forEach(e => {
    categoriesMap[e.category] = (categoriesMap[e.category] || 0) + e.amount;
  });

  const categoryBreakdown = Object.keys(categoriesMap).map(cat => ({
    category: cat,
    totalSpent: categoriesMap[cat],
    transactionCount: enrichedExpenses.filter(e => e.category === cat).length,
    percentageOfBudget: totalBudget > 0 ? Number(((categoriesMap[cat] / totalBudget) * 100).toFixed(1)) : 0
  }));

  const systemInstruction = `You are "Smart Spend Expert AI", a seasoned Indian personal Chartered Accountant (CA) and wealth strategist.
Your job is to analyze Indian users' Mongoose-stored transaction logs and return extremely deep, precise, and custom financial feedback as valid JSON.
Never include markdown markers, formatting text, or comments. Output ONLY JSON.`;

  const prompt = `Analyze this finance report:
User: ${user ? user.name : 'Vishwa'}
Monthly Budget Limit: ₹${totalBudget}
Total Spending Scanned: ₹${totalSpent}
Category Breakdown: ${JSON.stringify(categoryBreakdown)}
Full Transaction Entries: ${JSON.stringify(enrichedExpenses)}

YOUR RESPONSIBILITIES:
1. DETECT INDIAN-SPECIFIC HABITS:
   - Identify food delivery addiction (Swiggy/Zomato orders > 4 times/month).
   - Find stacked streaming entertainment subscriptions.
   - Detect paycheck-to-paycheck cash issues if spending >= 85% of budget.
   - Highlight weekend impulse buy spikes (spends on Friday/Saturday/Sunday nights).

2. CALCULATE PROGRESSIVE AI FINANCIAL SCORE (0-100):
   - 90-100: Excellent (Saves > 30%, no wasteful spends, healthy balance).
   - 75-89: Good (Saves 20%, low non-essential categories).
   - 50-74: Average (Wants > 30% of budget, low savings).
   - Under 50: Critical (Overspent budget, duplicate OTTs, heavy impulse buying).

3. PROJECT NEXT MONTH'S SPENDING (Spending predictions):
   - Project future month spending based on the current spend speed and recurring items.

4. RECOMMEND ACTIONS (Groww/Zerodha/Digital Gold):
   - digital gold or Jar app for under ₹1,000 savings.
   - Index fund SIP via Groww/Zerodha for ₹1,000 - ₹5,000 savings.
   - Diversified portfolio and emergency fund rules.

Always output exactly in this JSON format:
{
  "alert": boolean,
  "alert_message": "string",
  "spending_percentage": number,
  "financial_score": number,
  "financial_score_grade": "EXCELLENT" | "GOOD" | "AVERAGE" | "CRITICAL",
  "predicted_next_month_spend": number,
  "detected_habits": [
    {
      "habit_name": "string",
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "description": "string",
      "impact_cost": number,
      "future_value_5_yr": number,
      "actionable_fix": "string"
    }
  ],
  "savings_suggestions": [
    {
      "title": "string",
      "detail": "string",
      "estimated_monthly_savings": number
    }
  ],
  "investment_suggestions": [
    {
      "title": "string",
      "detail": "string",
      "amount": number,
      "platform": "Groww / Zerodha / Jar App",
      "expected_return": "string"
    }
  ],
  "detected_subscriptions": [
    {
      "name": "string",
      "amount": number,
      "status": "active" | "duplicate" | "unused",
      "recommendation": "string"
    }
  ],
  "motivational_message": "string"
}`;

  try {
    const rawResult = await executeAI(prompt, systemInstruction);
    return parseJSON(rawResult);
  } catch (err) {
    console.error("[AI Engine] Failed, using high-fidelity fallback insights JSON:", err);
    const spendingPercentage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
    
    // Premium fallback builder
    return {
      alert: spendingPercentage >= 60,
      alert_message: spendingPercentage >= 60 ? `⚠️ Budget Alert: You have utilized ${spendingPercentage}% of your ₹${totalBudget} monthly goal.` : "",
      spending_percentage: spendingPercentage,
      financial_score: spendingPercentage > 85 ? 45 : spendingPercentage > 60 ? 70 : 92,
      financial_score_grade: spendingPercentage > 85 ? "CRITICAL" : spendingPercentage > 60 ? "AVERAGE" : "EXCELLENT",
      predicted_next_month_spend: Math.round(totalSpent * 1.05),
      detected_habits: [
        {
          habit_name: "Impulse Dining Detection",
          severity: "MEDIUM",
          description: "Frequent dining and delivery transactions detected this period.",
          impact_cost: 2500,
          future_value_5_yr: 206250,
          actionable_fix: "Reduce Swiggy/Zomato orders down to 2 times a week maximum."
        }
      ],
      savings_suggestions: [
        {
          title: "Optimize Utility Spends",
          detail: "Switch off idle appliances and audit mobile/internet plans to save ₹400.",
          estimated_monthly_savings: 400
        }
      ],
      investment_suggestions: [
        {
          title: "Index Mutual Fund SIP",
          detail: "Setup an automated Nifty 50 Index Mutual Fund SIP to build solid long-term wealth.",
          amount: 2000,
          platform: "Groww / Zerodha",
          expected_return: "12-14% p.a."
        }
      ],
      detected_subscriptions: [],
      motivational_message: "You are making great steps! Maintain consistent tracking to master your wealth goals."
    };
  }
};

// 3. Smart NLP Transaction Parser
export const parseNaturalTransaction = async (text, context = "") => {
  const systemInstruction = `You are a highly specialized natural language financial transaction parsing microservice. 
  Extract variables into exact JSON keys. Return raw JSON only.`;
  
  const prompt = `Parse the transaction text:
  "${text}"
  Context: ${context}
  Current Timestamp: ${new Date().toISOString()}

  Output format:
  {
    "amount": number,
    "description": string,
    "categoryId": "food_dining" | "transportation" | "shopping" | "entertainment" | "bills_utilities" | "other",
    "type": "DEBIT" | "CREDIT",
    "dateTime": number (timestamp ms),
    "merchant": string,
    "confidence": number
  }`;

  try {
    const rawResult = await executeAI(prompt, systemInstruction);
    return parseJSON(rawResult);
  } catch (err) {
    console.error("[AI Engine] NLP parsing failed", err);
    throw err;
  }
};

// 4. Smart NLP Receipt & Invoice OCR Scanner
export const scanInvoiceReceipt = async (imageBuffer, mimeType) => {
  const systemInstruction = `You are an expert financial invoice OCR scanning engine. 
  Extract every line item, tax, and merchant with absolute mathematical precision into the requested JSON schema.`;

  const prompt = `Perform complete scan of this receipt.
  Format output exactly as this JSON:
  {
    "merchant_name": "string",
    "date": "string (YYYY-MM-DD)",
    "items": [
      {
        "name": "string",
        "quantity": number,
        "unit_price": number,
        "total_price": number,
        "category": "groceries" | "food_dining" | "shopping" | "healthcare" | "entertainment" | "other"
      }
    ],
    "subtotal": number,
    "tax": number,
    "discount": number,
    "total": number,
    "payment_method": "string",
    "currency": "INR",
    "confidence_score": "High" | "Medium" | "Low"
  }`;

  try {
    const rawResult = await executeAI(prompt, systemInstruction, imageBuffer, mimeType);
    return parseJSON(rawResult);
  } catch (err) {
    console.error("[AI Engine] Receipt OCR scanning failed", err);
    throw err;
  }
};

// 5. Goal Tips — suggest spending cuts to hit a savings goal faster
export const getGoalTips = async ({ goalName, targetAmount, currentAmount, deadline, monthlyIncome, monthlyExpenses, categoryBreakdown }) => {
  const remaining = Math.max(targetAmount - currentAmount, 0);
  const monthlySurplus = monthlyIncome - monthlyExpenses;
  const etaMonthsNow = monthlySurplus > 0 ? Math.ceil(remaining / monthlySurplus) : null;

  const systemInstruction = `You are Smart Spend AI, a personal finance coach specialising in Indian savings goals.
Return ONLY valid JSON. No markdown, no prose outside JSON.`;

  const prompt = `A user wants to save for: "${goalName}"
Target: ₹${targetAmount} | Saved so far: ₹${currentAmount} | Remaining: ₹${remaining}
${deadline ? `Deadline: ${new Date(deadline).toDateString()}` : 'No fixed deadline'}
Monthly income: ₹${monthlyIncome} | Monthly expenses: ₹${monthlyExpenses}
Current monthly surplus: ₹${monthlySurplus >= 0 ? monthlySurplus : 0}
Estimated months at current rate: ${etaMonthsNow !== null ? etaMonthsNow : 'N/A (no surplus)'}

Category spending this month (₹):
${JSON.stringify(categoryBreakdown, null, 2)}

Return JSON in exactly this shape:
{
  "eta_current": "${etaMonthsNow !== null ? etaMonthsNow + ' months' : 'Not achievable at current rate'}",
  "monthly_needed": <number — how much to save per month to hit deadline, or same as surplus if no deadline>,
  "suggestions": [
    {
      "category": "<category name>",
      "current_monthly_spend": <number>,
      "suggested_cut_percent": <5-40>,
      "monthly_savings": <number>,
      "tip": "<one specific actionable tip, 1 sentence>"
    }
  ],
  "eta_with_cuts": "<e.g. '4 months' — ETA if all suggestions are followed>",
  "motivation": "<one short encouraging sentence personalised to the goal name>"
}
Limit to the top 3 most impactful spending cuts. Be specific and realistic.`;

  try {
    const raw = await executeAI(prompt, systemInstruction);
    return parseJSON(raw);
  } catch (err) {
    console.error('[AI Engine] Goal tips failed, using fallback', err);
    const cats = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return {
      eta_current: etaMonthsNow !== null ? `${etaMonthsNow} months` : 'Not achievable at current rate',
      monthly_needed: remaining > 0 ? Math.ceil(remaining / 12) : 0,
      suggestions: cats.map(([cat, spend]) => ({
        category: cat,
        current_monthly_spend: spend,
        suggested_cut_percent: 20,
        monthly_savings: Math.round(spend * 0.2),
        tip: `Reduce your ${cat} spend by 20% to free up ₹${Math.round(spend * 0.2)} per month.`
      })),
      eta_with_cuts: etaMonthsNow !== null ? `~${Math.ceil(etaMonthsNow * 0.75)} months` : 'Set a budget first',
      motivation: `You're on your way to achieving your "${goalName}" goal. Every rupee saved counts!`
    };
  }
};

// 6. CA Direct Chatbot Assistant
export const chatWithCharteredAccountant = async (message, chatHistory = [], files = []) => {
  const gemini = getGeminiClient();
  if (!gemini) {
    return { text: "I'm having trouble thinking right now. Please set a valid GEMINI_API_KEY to consult your CA assistant." };
  }

  const systemInstruction = `You are "Smart Spend Personal CA", a highly-qualified, firm, caring Chartered Accountant (CA) with deep expertise in Indian personal finance, income tax slabs, mutual fund SIP returns, and wealth preservation.
  
  Identity guidelines:
  - Advise exactly like a veteran Indian CA. You are firm, direct, and protective of the user's hard-earned money.
  - Never give generic advice. Be extremely precise.
  - Use ₹ currency symbol for all monetary figures.
  - Keep comments under 220 words. Use bullet points and bold highlights for critical tips.
  - Indian tax contexts (New vs Old tax slabs, 80C, 80D, LTCG/STCG, tax saving SIPs, digital gold, emergency funds) are your second nature.`;

  try {
    // Map prior turns into the format Gemini expects so the assistant retains context
    const history = chatHistory
      .filter(turn => turn.role && turn.text)
      .map(turn => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.text }]
      }));

    const chat = gemini.chats.create({
      model: "gemini-2.5-flash",
      config: { systemInstruction },
      history
    });

    const msgContents = [];
    if (files && Array.isArray(files)) {
      files.forEach(f => {
        if (f.base64 && f.mimeType) {
          msgContents.push({
            inlineData: {
              data: f.base64.split(',')[1] || f.base64,
              mimeType: f.mimeType
            }
          });
        }
      });
    }
    msgContents.push({ text: message });

    const response = await chat.sendMessage({ message: msgContents });
    return { text: response.text };
  } catch (err) {
    console.error("[AI Engine] CA assistant chat failed", err);
    return { text: "I apologize, but my consulting lines are busy right now. Let me inspect that for you again in a moment." };
  }
};
