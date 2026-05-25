var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_url = require("url");
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_meta = {};
import_dotenv.default.config();
process.on("uncaughtException", (err) => {
  console.warn("UNCAUGHT EXCEPTION WARN:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.warn("UNHANDLED REJECTION WARN at:", promise, "reason:", reason);
});
var __dirname = "";
try {
  const __filename = (0, import_url.fileURLToPath)(import_meta.url);
  __dirname = import_path.default.dirname(__filename);
} catch (e) {
  __dirname = typeof __dirname !== "undefined" ? global.__dirname : process.cwd();
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "20mb" }));
  app.use((req, res, next) => {
    console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${req.method} ${req.url}`);
    next();
  });
  const allKeysRaw = [
    process.env.GEMINI_API_KEY,
    process.env.Smart_Spend,
    process.env.KEY_AI,
    process.env.ss_key
  ];
  const uniqueKeys = Array.from(new Set(allKeysRaw.map((k) => (k || "").trim()).filter(Boolean)));
  if (uniqueKeys.length === 0) {
    console.warn("CRITICAL: No GEMINI API KEYS are set in the environment variables. AI features will fail.");
  } else {
    console.log(`[AI Load Balancer] Initialized with ${uniqueKeys.length} unique API keys.`);
  }
  let currentKeyIndex = 0;
  const getAI = () => {
    if (uniqueKeys.length === 0) return new import_genai.GoogleGenAI({ apiKey: "" });
    const key = uniqueKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % uniqueKeys.length;
    return new import_genai.GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  };
  const parseAIJsonResponse = (responseText) => {
    let cleanText = responseText || "";
    if (cleanText.includes("```json")) {
      cleanText = cleanText.replace(/```json/g, "").replace(/```/g, "").trim();
    } else if (cleanText.includes("```")) {
      cleanText = cleanText.replace(/```/g, "").trim();
    }
    return JSON.parse(cleanText);
  };
  class RateLimiter {
    constructor() {
      this.queue = [];
      this.isProcessing = false;
      this.lastCallTime = 0;
      this.MIN_DELAY_MS = 4100;
    }
    // 4.1 seconds between requests (~14.6 requests/minute)
    async enqueue(task) {
      return new Promise((resolve, reject) => {
        this.queue.push(async () => {
          try {
            const now = Date.now();
            const timeSinceLastCall = now - this.lastCallTime;
            if (timeSinceLastCall < this.MIN_DELAY_MS) {
              await new Promise((r) => setTimeout(r, this.MIN_DELAY_MS - timeSinceLastCall));
            }
            this.lastCallTime = Date.now();
            resolve(await task());
          } catch (e) {
            reject(e);
          }
        });
        this.processQueue();
      });
    }
    async processQueue() {
      if (this.isProcessing || this.queue.length === 0) return;
      this.isProcessing = true;
      while (this.queue.length > 0) {
        const task = this.queue.shift();
        if (task) await task();
      }
      this.isProcessing = false;
    }
  }
  const globalGeminiPacer = new RateLimiter();
  const callGeminiWithRetry = async (fn) => {
    const MAX_RETRIES = 5;
    let baseDelay = 2e3;
    let lastError;
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        return await globalGeminiPacer.enqueue(fn);
      } catch (error) {
        lastError = error;
        const isTransientError = error?.status === 503 || error?.status === 429 || error?.message?.includes("503") || error?.message?.includes("429") || error?.message?.includes("high demand") || error?.message?.includes("quota") || error?.message?.includes("Quota exceeded");
        if (isTransientError && i < MAX_RETRIES - 1) {
          let delay = baseDelay;
          const retryMatch = error?.message?.match(/retry in ([\d\.]+)s/i);
          if (retryMatch && retryMatch[1]) {
            delay = Math.ceil(parseFloat(retryMatch[1]) * 1e3) + 1500;
            console.warn(`[Gemini Retry] Quota hit. Smart waiting for ${delay}ms as requested by API...`);
          } else {
            console.warn(`[Gemini Retry] Attempt ${i + 1} failed. Retrying in ${delay}ms...`);
            baseDelay *= 2;
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  };
  const ensureApiKey = (res) => {
    if (uniqueKeys.length === 0) {
      res.status(403).json({
        error: "Gemini API key is missing. Please select an API key in the 'Settings > Secrets' panel and restart the application.",
        code: "MISSING_API_KEY"
      });
      return false;
    }
    return true;
  };
  app.post("/api/admin/ai-controller", async (req, res) => {
    if (!ensureApiKey(res)) return;
    const { message } = req.body;
    try {
      const chat = getAI().chats.create({
        model: "gemini-flash-lite-latest",
        config: {
          systemInstruction: `You are "Smart Spend Admin", the powerful and secure administrative AI controller for the Smart Spend application...`
        }
      });
      const response = await chat.sendMessage({ message });
      res.json({ text: response.text });
    } catch (error) {
      console.warn("[Admin AI Error]", error?.message || "Unknown error");
      res.json({ text: "I'm having trouble connecting to the administration AI right now. Please try again in a moment." });
    }
  });
  app.post("/api/ai/insights", async (req, res) => {
    if (!ensureApiKey(res)) return;
    const { period, totalSpent, income, categoryBreakdown, previousPeriodBreakdown, totalBudget, categoryBudgets } = req.body;
    try {
      const budget = totalBudget || 1e4;
      const spendingPercentage = budget > 0 ? Math.round(totalSpent / budget * 100) : 0;
      const alertTriggered = spendingPercentage >= 60;
      const prompt = `Analyze financial data for the period: ${period}
      Total Spent: \u20B9${totalSpent}
      Monthly Income: \u20B9${income}
      Total Budget: \u20B9${budget}
      Spending Percentage: ${spendingPercentage}%
      Alert Status: ${alertTriggered ? "Triggered (>=60% spent)" : "Normal (<60% spent)"}
      Category spending breakdown: ${JSON.stringify(categoryBreakdown)}
      Category-specific budget limits (if any): ${JSON.stringify(categoryBudgets || {})}
      vs Previous period category breakdown: ${JSON.stringify(previousPeriodBreakdown || {})}

      YOUR CORE RESPONSIBILITIES to do:

      1. BUDGET ALERT TRIGGER:
      - Since the spending percentage is ${spendingPercentage}%, the "alert" field must be ${alertTriggered}.
      - You MUST write an urgent, friendly, and encouraging alert message in the "alert_message" field if alert is true. Example: "\u26A0\uFE0F Warning! You've used ${spendingPercentage}% of your monthly budget. You're at risk of overspending!"

      2. SPENDING ANALYSIS:
      - Analyze each expense category (food, transport, entertainment, shopping, bills, etc.).
      - Identify the TOP 3 categories where the user overspends the most.
      - Compare category spending to recommended healthy budget percentages:
        * Food: 25-30% of budget
        * Housing/Bills: 30-35%
        * Transport: 10-15%
        * Entertainment: 5-10%
        * Shopping: 5-10%
        * Savings/Investment: 20%
      - Pinpoint EXACT habits causing overspending (e.g., "You ordered food delivery 18 times this month").

      3. SAVINGS SUGGESTIONS (BE VERY SPECIFIC):
      - Give 3-5 highly actionable and specific saving tips based on the user's actual spending data.
      - Do NOT give generic advice. Reference exact categories and amounts.
      - Example: "You spent \u20B94,200 on food delivery. Cooking at home 4 days a week could save you \u20B92,000/month."
      - Suggest specific alternatives, habits, or strategies to cut each overspent category.

      4. INVESTMENT SUGGESTIONS (BE VERY SPECIFIC):
      - Calculate how much the user COULD invest based on their surplus or potential savings.
      - Suggest investment options based on the savings amount:
        * Under \u20B91,000/month \u2192 Digital gold, round-up micro-investing apps (Jar, Groww)
        * \u20B91,000\u2013\u20B95,000/month \u2192 SIP in index mutual funds, recurring deposits
        * \u20B95,000\u2013\u20B920,000/month \u2192 SIP + PPF + ELSS for tax saving
        * Above \u20B920,000/month \u2192 Diversified portfolio: mutual funds, stocks, NPS, REITs
      - Mention expected returns and time horizon.
      - Prioritize emergency fund first (3-6 months of expenses) if user has no savings buffer.

      RESPONSE FORMAT: Always respond in this EXACT JSON format:
      {
        "alert": ${alertTriggered},
        "alert_message": "your alert message here",
        "spending_percentage": ${spendingPercentage},
        "top_overspending_categories": [
          {
            "category": "Food & Dining",
            "amount_spent": 4200,
            "recommended_max": 2500,
            "excess": 1700,
            "insight": "You ordered food delivery 18 times this month."
          }
        ],
        "savings_suggestions": [
          {
            "title": "Cut Food Delivery",
            "detail": "Reducing delivery orders from 18 to 6 per month saves approx \u20B91,800.",
            "estimated_monthly_savings": 1800
          }
        ],
        "investment_suggestions": [
          {
            "title": "Start a SIP in Index Fund",
            "detail": "Invest your projected savings of \u20B92,500/month in a Nifty 50 Index Fund via Groww or Zerodha. Expected annual return: 12-14%.",
            "amount": 2500,
            "platform": "Groww / Zerodha",
            "expected_return": "12-14% annually"
          }
        ],
        "motivational_message": "small encouraging message here"
      }

      RULES:
      - Always be specific \u2014 use the user's actual numbers, never generic percentages alone.
      - Never suggest investments before recommending an emergency fund (3-6 months of expenses).
      - Keep alert messages urgent but encouraging, not scary.
      - Currency should match user's locale (default \u20B9 INR for Indian users).
      - All suggestions must be realistic and implementable immediately.`;
      const response = await getAI().models.generateContent({
        model: "gemini-flash-lite-latest",
        contents: prompt,
        config: {
          temperature: 0,
          responseMimeType: "application/json"
        }
      });
      res.json(parseAIJsonResponse(response.text));
    } catch (error) {
      console.warn("[Insights Error]", error?.message || "Unknown error");
      const budget = totalBudget || 1e4;
      const spendingPercentage = budget > 0 ? Math.round(totalSpent / budget * 100) : 0;
      const alertTriggered = spendingPercentage >= 60;
      res.json({
        alert: alertTriggered,
        alert_message: alertTriggered ? `\u26A0\uFE0F Warning! You've used ${spendingPercentage}% of your monthly budget. You're at risk of overspending!` : "",
        spending_percentage: spendingPercentage,
        top_overspending_categories: [],
        savings_suggestions: [
          {
            title: "Review Spending",
            detail: "Take a few minutes to manually review your biggest expense categories this month.",
            estimated_monthly_savings: 0
          }
        ],
        investment_suggestions: [
          {
            title: "Build Emergency Fund",
            detail: "We recommend keeping 3-6 months of expenses in a liquid savings account before any active mutual fund SIPs.",
            amount: 1e3,
            platform: "Liquid Bank Account",
            expected_return: "3-4% annually"
          }
        ],
        motivational_message: "Keep tracking your expenses to stay on top of your financial goals."
      });
    }
  });
  app.post("/api/ai/parse-transaction", async (req, res) => {
    if (!ensureApiKey(res)) return;
    const { text, context } = req.body;
    try {
      const prompt = `Parse the following transaction text into a JSON object:
      "${text}"
      ${context ? `Context: ${context}` : ""}
      
      Current Date: ${(/* @__PURE__ */ new Date()).toISOString()}
      
      Output format:
      {
        "amount": number,
        "description": string,
        "categoryId": "shopping" | "food_dining" | "transportation" | "entertainment" | "bills_utilities" | "other" | string,
        "type": "DEBIT" | "CREDIT",
        "dateTime": number (timestamp ms),
        "merchant": string,
        "confidence": number (0-1),
        "upiRefId": string (optional),
        "bankName": string (optional),
        "accountLast4": string (optional)
      }
      
      If the user says "spent", it's DEBIT. If "received" or "earned", it's CREDIT.
      Resolve relative dates (yesterday, last Friday, 2 days ago, etc.) to actual timestamps based on Current Date.
      Default category is "other" if unsure.`;
      const response = await callGeminiWithRetry(() => getAI().models.generateContent({
        model: "gemini-flash-lite-latest",
        contents: prompt,
        config: {
          temperature: 0,
          responseMimeType: "application/json"
        }
      }));
      res.json(parseAIJsonResponse(response.text));
    } catch (error) {
      console.warn("[Parse Error]", error?.message || "Unknown error");
      res.json({ error: "Failed to automatically parse. Please enter these details manually." });
    }
  });
  app.post("/api/ai/score-tips", async (req, res) => {
    if (!ensureApiKey(res)) return;
    const { score, breakdown } = req.body;
    try {
      const prompt = `User's Financial Money Score: ${score}/100.
      Breakdown Details: ${JSON.stringify(breakdown)}
      
      Generate 3 highly personalized, ultra-specific, and actionable tips to improve this score.
      Each tip should have:
      1. "tip": The advice (max 120 chars)
      2. "impact": Numeric potential score gain (1-15)
      3. "effort": 'easy' | 'medium' | 'hard'
      
      Output format: JSON array of objects.`;
      const response = await callGeminiWithRetry(() => getAI().models.generateContent({
        model: "gemini-flash-lite-latest",
        contents: prompt,
        config: {
          temperature: 0,
          responseMimeType: "application/json"
        }
      }));
      res.json(parseAIJsonResponse(response.text));
    } catch (error) {
      console.warn("[Score Tips Error]", error?.message || "Unknown error");
      const fallbackTips = [
        {
          tip: "Review your recurring subscriptions and cancel those you haven't used in the past month.",
          impact: 5,
          effort: "easy"
        },
        {
          tip: "Set a strict spending limit for your most frequent non-essential expense category.",
          impact: 10,
          effort: "medium"
        },
        {
          tip: "Automate a portion of your incoming funds to be transferred directly to a savings account.",
          impact: 8,
          effort: "easy"
        }
      ];
      res.json(fallbackTips);
    }
  });
  app.post("/api/ai/greet", async (req, res) => {
    const { userName, totalBalance, monthlySpent, budgetLimit } = req.body;
    if (uniqueKeys.length === 0) {
      return res.json({ greeting: `Hi ${userName}, ready to track some spends?` });
    }
    try {
      const prompt = `Generate a very short, witty, and personalized one-line greeting for a finance app user named ${userName}.
      Status: Balance \u20B9${totalBalance}, Spent this month \u20B9${monthlySpent} out of \u20B9${budgetLimit} budget.
      Keep it under 15 words. Be encouraging but honest. Use Indian slang sparsely if it fits.`;
      const response = await callGeminiWithRetry(() => getAI().models.generateContent({
        model: "gemini-flash-lite-latest",
        contents: prompt
      }));
      res.json({ greeting: response.text });
    } catch (error) {
      const isQuotaOrUnavailable = error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("quota") || error?.status === 503 || error?.message?.includes("503") || error?.message?.includes("UNAVAILABLE");
      if (isQuotaOrUnavailable) {
        console.warn("--> Gemini Quota exceeded/Unavailable. Using fallback greeting.");
        return res.json({ greeting: `Hi ${userName}, tracking your spends like a pro! \u{1F680}` });
      }
      console.warn("--> Greet route info:", error?.message || error);
      res.json({ greeting: `Hi ${userName}, let's track your spends today!` });
    }
  });
  app.post("/api/ai/scan-receipt", async (req, res) => {
    if (!ensureApiKey(res)) return;
    const { image, mimeType } = req.body;
    try {
      const prompt = `Analyze this receipt image. Extract all data as JSON:
      {merchant_name, date, items: [{name, quantity, unit_price, total_price, category}], subtotal, tax, discount, total, payment_method, currency}
      Categories: food_dining, groceries, shopping, healthcare, entertainment, other
      Use null for missing fields. All prices as numbers (no currency symbols). 
      Always find and return the final balance due on the receipt, avoiding other numerical values for the total field.
      Currency should be 3-letter ISO code. Check values carefully to ensure the math generally adds up. Give a confidence score (High, Medium, Low).`;
      console.log("[Receipt Scan] Sending request to AI model...");
      const response = await callGeminiWithRetry(() => getAI().models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: image.split(",")[1] || image,
                  mimeType
                }
              }
            ]
          }
        ],
        config: {
          temperature: 0,
          systemInstruction: "You are an expert receipt parser. Return ONLY valid JSON matching the requested schema.",
          responseMimeType: "application/json"
        }
      }));
      console.log("[Receipt Scan] Received response from AI model.");
      res.json(parseAIJsonResponse(response.text));
    } catch (error) {
      console.error("[Receipt Scan Error] Exception caught:", error);
      res.json({ error: "Failed to scan receipt. Please enter the details manually." });
    }
  });
  app.post("/api/ai/categorize", async (req, res) => {
    if (!ensureApiKey(res)) return;
    const { merchant, note } = req.body;
    try {
      const prompt = `Categorize this transaction:
      Merchant: ${merchant || "Unknown"}
      Note: ${note || "None"}
      
      Categories: food_dining, groceries, shopping, healthcare, entertainment, transportation, utilities, investment, other
      
      Return ONLY a JSON object: {"categoryId": "string", "confidence": number, "reason": "brief string"}`;
      const response = await callGeminiWithRetry(() => getAI().models.generateContent({
        model: "gemini-flash-lite-latest",
        contents: prompt,
        config: {
          temperature: 0,
          systemInstruction: "You are a specialized categorization engine. Return JSON only.",
          responseMimeType: "application/json"
        }
      }));
      res.json(parseAIJsonResponse(response.text));
    } catch (error) {
      res.status(500).json({ categoryId: "other", confidence: 0 });
    }
  });
  app.post("/api/ai/budget-alert", async (req, res) => {
    if (uniqueKeys.length === 0) {
      return res.json({ alert: null });
    }
    const { monthlySpent, budgetLimit, currentPeriodTx, daysInMonth, dayOfMonth } = req.body;
    try {
      const projection = monthlySpent / dayOfMonth * daysInMonth;
      const categories = currentPeriodTx.reduce((acc, t) => {
        if (t.type === "DEBIT") acc[t.categoryId] = (acc[t.categoryId] || 0) + t.amount;
        return acc;
      }, {});
      const prompt = `Analyze this budget situation for an Indian user:
      Spent so far: \u20B9${monthlySpent}
      Budget Limit: \u20B9${budgetLimit}
      Day ${dayOfMonth} of ${daysInMonth}
      Current Projection: \u20B9${projection.toFixed(0)}
      Category Breakdown: ${JSON.stringify(categories)}
      
      The user is likely to exceed their budget. 
      1. Identify the main category causing the high spend.
      2. Provide a specific, friendly reason for the alert.
      3. Give 2 actionable, non-generic pieces of advice to finish the month under budget.
      Keep it brief (max 3 sentences).`;
      const response = await callGeminiWithRetry(() => getAI().models.generateContent({
        model: "gemini-flash-lite-latest",
        contents: prompt,
        config: {
          systemInstruction: "You are a proactive financial advisor. Be direct, helpful, and culturally relevant to India."
        }
      }));
      res.json({ alert: response.text });
    } catch (error) {
      console.warn("[Budget Alert Error]", error);
      res.json({ alert: "Keep an eye on your spending to stay within your budget!" });
    }
  });
  app.post("/api/ai/assistant", async (req, res) => {
    if (!ensureApiKey(res)) return;
    const { message, files } = req.body;
    try {
      const chat = getAI().chats.create({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: `You are "Smart Spend Personal CA", a highly-qualified, direct, firm, and caring Chartered Accountant (CA) with deep expertise in Indian personal finance and taxation.

IDENTITY & TONE:
- You advise exactly like an expert Indian CA. You are firm, direct, and caring.
- You are not a generic chatbot. Avoid corporate jargon. Be extremely precise.
- Never say "it depends". Always give a direct, concrete recommendation.
- Always use \u20B9 with exact amounts \u2014 never say "some money" or "a little".
- Use bold headers and bullet points for clarity.
- Keep responses under 250 words unless a full report is requested.

---

CORE CA LOGIC:

STEP 1 \u2014 BUDGET SPLIT (apply immediately when income is given):
- For income >= \u20B925,000: 50% Needs, 30% Wants, 20% Savings + Investments (non-negotiable).
- For income < \u20B925,000: 60% Needs, 20% Wants, 20% Savings + Investments.
- Always list the exact \u20B9 amount for each of these three buckets.

STEP 2 \u2014 SPENDING LIMIT:
- Total spending limit = 80% of income.
- Savings floor = 20% of income (treat as locked and untouchable).

STEP 3 \u2014 OVERSPENDING ALERTS (trigger immediately if the user's data crosses these thresholds):
- 75% budget used: "\u26A0\uFE0F WARNING: \u20B9[amount] remaining. Slow down on non-essentials."
- 90% budget used: "\u26A0\uFE0F CRITICAL: Stop all wants spending. Only \u20B9[amount] left for essentials."
- 100% crossed: "\u{1F6D1} OVERSPENDING ALERT: You've exceeded budget by \u20B9[amount]. No more purchases this month."
- Wants > 30% of income: "\u{1F4B8} Wants category crossed 30%. Move \u20B9[amount] to SIP immediately."
- Savings < 10% of income: "\u274C SAVINGS CRISIS: Less than 10% saved. Immediate action required."

STEP 4 \u2014 WASTEFUL SPENDING DETECTION:
Flag these habits automatically:
- Food delivery > 4 times/month
- Stacked OTT or app subscriptions
- Unplanned/impulse purchases
- Entertainment > 10% of income
- Dining out > 3 times/week
For every flagged expense, state:
a) Monthly waste amount (\u20B9)
b) What that \u20B9 amount becomes in 5 years if invested in a Mutual Fund SIP at 12% CAGR (Formula: M = P * [((1 + i)^n - 1) / i] * (1 + i) where i = 1% monthly and n = 60 months. Roughly multiply the monthly amount by 82.5).
c) One specific alternative action they can take today.

STEP 5 \u2014 SAVINGS GUIDANCE:
- Remind them: "Pay yourself first \u2014 save before you spend."
- If savings are < 20%, calculate the exact \u20B9 gap and list which category to cut.

STEP 6 \u2014 INVESTMENT RECOMMENDATIONS (based on risk profile):
- CONSERVATIVE (age 45+, first-time, low risk): 40% FD/RD, 25% Debt/Hybrid Funds, 20% Sovereign Gold Bonds (SGB), 15% PPF/EPF.
- BALANCED (age 30-45, moderate risk): 35% Flexi-cap/Index SIP, 25% FD/RD, 20% SGB/Digital Gold, 20% Nifty 50 ETF/Stocks.
- AGGRESSIVE (age 20-35, high growth): 50% Small/Mid-cap/ELSS SIP, 25% Direct Equity, 15% FD/NPS, 10% SGB.
- Provide the exact \u20B9 amounts for each bucket.

STEP 7 \u2014 MONTHLY HEALTH REPORT (when requested):
Include:
- Financial Health Score out of 100
- Income vs spending breakdown in %
- Top 3 wasteful expenses
- Savings achieved vs target
- 3 action items for next month
- Investment plan with exact \u20B9 amounts
- One motivational closing line

---

BILL SCANNING & AUTO-CATEGORISATION MODULE:

When any bill, photo of receipt, multiple bills, bank statement, or credit card statement is uploaded:
1. Extract every transaction/expense line item.
2. Identify merchant name, amount, date, and category.
3. Auto-categorise each expense.
4. Separate GOOD spending from WASTEFUL spending.
5. Generate a full bill analysis report instantly.

STEP 1 \u2014 BILL DATA EXTRACTION:
Extract: Merchant/Vendor, Date, Amount (\u20B9), Description, Payment method.
If multiple bills are uploaded for one month:
- Merge all into one master expense list.
- Remove duplicates if same transaction appears twice.
- Sort by date (oldest to newest).
- Show total count of bills scanned and total amount detected.

STEP 2 \u2014 AUTO CATEGORISATION:
Assign every expense to one of these categories:
- NEEDS: Rent/EMI, Groceries, Electricity/Water/Gas, Mobile/Internet, Medicines, School Fees, Transport/Petrol, Insurance, Loan EMI.
- WANTS: Restaurants, Food delivery (Swiggy/Zomato), Shopping (Amazon/Flipkart/Myntra), Movies/Events, Salon/Spa, Gifts, Alcohol/Tobacco.
- SUBSCRIPTIONS: Netflix, Prime, Hotstar, Spotify, Cloud Storage, Gaming, Gym, News.
- HEALTH & WELLNESS: Doctor, Pharmacy, Lab reports, Supplements.
- INVESTMENTS & SAVINGS: SIP/Mutual Fund, FD/RD, PPF/NPS, Stocks, Gold.
- INCOME: Salary credit, Freelance payment, Rental income, Investment returns, or any credit > \u20B91,000.
- OTHERS: Unidentified transactions, ATM withdrawals, Family transfers.

STEP 3 \u2014 GOOD vs WASTEFUL SPENDING DETECTION:
- \u2705 GOOD SPENDING (Necessary): All NEEDS, HEALTH & WELLNESS, INVESTMENTS & SAVINGS, Wants within 30% income limit, and Subscriptions < \u20B9500/month.
- \u274C WASTEFUL SPENDING (Waste): Food delivery > 4 orders/month, Duplicate subscriptions, Dining out > 8 times/month, Impulse shopping > \u20B92,000, Wants > 30% of income, > 2 active OTTs, ATM cash with no purpose, Alcohol/Tobacco, late fees/penalties, midnight impulse transactions.
For every wasteful item found, auto-generate:
- "You spent \u20B9X on [item] \u2014 this is wasteful because [reason]"
- "If you had invested \u20B9X/month in SIP at 12% CAGR, in 5 years it becomes \u20B9[amount]"
- "Smart Spend AI recommends: [specific alternative action]"

STEP 4 \u2014 MONTHLY BILL SUMMARY REPORT:
Generate this report layout automatically:
\u{1F4CB} SMART SPEND AI \u2014 MONTHLY BILL SCAN REPORT
\u{1F4C1} Bills Scanned: [X] files
\u{1F4C5} Period Covered: [date range]
\u{1F4B0} Total Amount Detected: \u20B9[amount]

CATEGORY BREAKDOWN:
-> Needs: \u20B9[amount] \u2014 [X]%
-> Wants: \u20B9[amount] \u2014 [X]%
-> Subscriptions: \u20B9[amount] \u2014 [X]%
-> Health: \u20B9[amount] \u2014 [X]%
-> Investments: \u20B9[amount] \u2014 [X]%
-> Others: \u20B9[amount] \u2014 [X]%

\u2705 GOOD SPENDING TOTAL: \u20B9[amount]
\u274C WASTEFUL SPENDING TOTAL: \u20B9[amount]
\u{1F4B8} WASTE PERCENTAGE: [X]% of your income is going to waste

TOP 3 WASTEFUL EXPENSES THIS MONTH:
1. [merchant] \u2014 \u20B9[amount] \u2014 [reason]
2. [merchant] \u2014 \u20B9[amount] \u2014 [reason]
3. [merchant] \u2014 \u20B9[amount] \u2014 [reason]

SUBSCRIPTIONS REVIEW:
-> Active subscriptions found: [list with \u20B9]
-> Possibly unused or duplicate: [list]
-> Recommended to cancel: [list] \u2014 Monthly saving: \u20B9[amount]

SAVINGS OPPORTUNITY:
-> If you cut all wasteful spending: \u20B9[amount] freed/month
-> Invested in SIP at 12% CAGR for 5 years: \u20B9[calculated]
-> Invested in SIP at 12% CAGR for 10 years: \u20B9[calculated]

FINANCIAL HEALTH SCORE THIS MONTH: [X]/100
NEXT ACTION: [one specific action today]

STEP 5 \u2014 MULTI-MONTH BILL HISTORY:
- Compare month-over-month spending in each category.
- Identify growing categories and spot recurring wasteful patterns (e.g. Swiggy > \u20B93,000/mo).
- Trend calculation: "Your food delivery spending has increased 40% over 3 months".
- Total waste over all months combined and total potential savings.

STEP 6 \u2014 SMART ALERTS FROM BILL SCAN:
Trigger standard alerts (\u{1F534} Duplicate sub, \u{1F534} Food delivery frequency, \u{1F534} Midnight impulse, \u{1F7E1} Grocery MoM increase, \u{1F7E1} Subscriptions count, \u{1F7E2} Needs within 50%, \u{1F7E2} Invested Consistency) when conditions are met.

---

RESPONSE RULES FOR BILL SCANNING:
- Always confirm how many bills were successfully read.
- If a bill is unclear, say: "Bill [X] could not be fully read. Please upload a clearer image or PDF."
- Never guess an amount \u2014 if unreadable, mark it as "amount unclear \u2014 please verify".
- Always show \u20B9 amounts, never round off or approximate.
- End every bill scan report with one NEXT ACTION.
- If the user uploads a bank statement, treat every debit as an expense and every credit as income.
- Flag any transaction above \u20B95,000 in the wants/entertainment category as high-value wasteful spend.

---

INPUT FORMAT FOR BILL SCAN:
The app will feed data in this layout:
Monthly Income: \u20B9[amount]
Risk Profile: [conservative/balanced/aggressive]
Uploaded files: [list of files]
Extracted text from bills: [raw text/OCR]
Request: [scan request]`
        }
      });
      const msgContents = [{ text: message }];
      if (files && Array.isArray(files)) {
        files.forEach((f) => {
          if (f.base64 && f.mimeType) {
            msgContents.push({
              inlineData: {
                data: f.base64.split(",")[1] || f.base64,
                mimeType: f.mimeType
              }
            });
          }
        });
      }
      const response = await callGeminiWithRetry(() => chat.sendMessage({ message: msgContents }));
      res.json({ text: response.text });
    } catch (error) {
      console.warn("[Assistant Error]", error?.message || "Unknown error");
      res.json({ text: "I'm having trouble thinking right now. Could you please ask me again in a moment?" });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("FATAL ERROR: Failed to start server", err);
  process.exit(1);
});
//# sourceMappingURL=server.cjs.map
