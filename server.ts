import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

process.on('uncaughtException', (err) => {
  console.warn('UNCAUGHT EXCEPTION WARN:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.warn('UNHANDLED REJECTION WARN at:', promise, 'reason:', reason);
});

// Derive __dirname for both ESM and CJS compatibility
let __dirname: string = '';
try {
  const __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch (e) {
  // In bundled CJS mode, __dirname is traditionally available.
  // If not, we fallback to process.cwd() to prevent 'undefined' issues.
  __dirname = typeof __dirname !== 'undefined' ? (global as any).__dirname : process.cwd();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

  // Request logging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Gemini Load Balancer Setup
  const allKeysRaw = [
    process.env.GEMINI_API_KEY,
    process.env.Smart_Spend,
    process.env.KEY_AI,
    process.env.ss_key
  ];
  
  const uniqueKeys = Array.from(new Set(allKeysRaw.map(k => (k || '').trim()).filter(Boolean)));
  
  if (uniqueKeys.length === 0) {
    console.warn("CRITICAL: No GEMINI API KEYS are set in the environment variables. AI features will fail.");
  } else {
    console.log(`[AI Load Balancer] Initialized with ${uniqueKeys.length} unique API keys.`);
  }

  let currentKeyIndex = 0;

  const getAI = () => {
    if (uniqueKeys.length === 0) return new GoogleGenAI({ apiKey: '' });
    const key = uniqueKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % uniqueKeys.length;
    return new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  };

  const parseAIJsonResponse = (responseText: string) => {
    let cleanText = responseText || "";
    if (cleanText.includes("```json")) {
      cleanText = cleanText.replace(/```json/g, "").replace(/```/g, "").trim();
    } else if (cleanText.includes("```")) {
      cleanText = cleanText.replace(/```/g, "").trim();
    }
    return JSON.parse(cleanText);
  };

  // Global Pacer / Mutex to prevent hitting 15 RPM limits
  class RateLimiter {
    private queue: (() => void)[] = [];
    private isProcessing = false;
    private lastCallTime = 0;
    private readonly MIN_DELAY_MS = 4100; // 4.1 seconds between requests (~14.6 requests/minute)

    async enqueue<T>(task: () => Promise<T>): Promise<T> {
      return new Promise((resolve, reject) => {
        this.queue.push(async () => {
          try {
            const now = Date.now();
            const timeSinceLastCall = now - this.lastCallTime;
            if (timeSinceLastCall < this.MIN_DELAY_MS) {
              await new Promise(r => setTimeout(r, this.MIN_DELAY_MS - timeSinceLastCall));
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

    private async processQueue() {
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

  const callGeminiWithRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
    const MAX_RETRIES = 5;
    let baseDelay = 2000;

    let lastError: any;
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        return await globalGeminiPacer.enqueue(fn);
      } catch (error: any) {
        lastError = error;
        const isTransientError = error?.status === 503 || error?.status === 429 ||
          error?.message?.includes('503') || error?.message?.includes('429') ||
          error?.message?.includes('high demand') || error?.message?.includes('quota') ||
          error?.message?.includes('Quota exceeded');

        if (isTransientError && i < MAX_RETRIES - 1) {
          let delay = baseDelay;
          
          // Smart Retry parsing: look for "Please retry in [X]s"
          const retryMatch = error?.message?.match(/retry in ([\d\.]+)s/i);
          if (retryMatch && retryMatch[1]) {
             delay = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 1500; // Parse time + 1.5s buffer
             console.warn(`[Gemini Retry] Quota hit. Smart waiting for ${delay}ms as requested by API...`);
          } else {
             console.warn(`[Gemini Retry] Attempt ${i + 1} failed. Retrying in ${delay}ms...`);
             baseDelay *= 2; // Exponential backoff only if no explicit retry time
          }

          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  };

  // Helper to check for API key before calling Gemini
  const ensureApiKey = (res: any) => {
    if (uniqueKeys.length === 0) {
      res.status(403).json({
        error: "Gemini API key is missing. Please select an API key in the 'Settings > Secrets' panel and restart the application.",
        code: "MISSING_API_KEY"
      });
      return false;
    }
    return true;
  };

  // API Routes
  app.post('/api/admin/ai-controller', async (req, res) => {
    if (!ensureApiKey(res)) return;
    const { message } = req.body;

    try {
      const chat = getAI().chats.create({
        model: "gemini-flash-lite-latest",
        config: {
          systemInstruction: `You are "Smart Spend Admin", the powerful and secure administrative AI controller for the Smart Spend application...`,
        },
      });

      const response = await chat.sendMessage({ message });
      res.json({ text: response.text });
    } catch (error: any) {
      console.warn("[Admin AI Error]", error?.message || "Unknown error");
      res.json({ text: "I'm having trouble connecting to the administration AI right now. Please try again in a moment." });
    }
  });

  app.post('/api/ai/insights', async (req, res) => {
    if (!ensureApiKey(res)) return;
    const { period, totalSpent, income, categoryBreakdown, previousPeriodBreakdown } = req.body;

    try {
      const savingsRate = income > 0 ? ((income - totalSpent) / income) * 100 : 0;

      const prompt = `Analyze spending data for the period: ${period}
      Total spent: ₹${totalSpent}, Income: ₹${income}, Savings rate: ${savingsRate.toFixed(1)}%
      Category breakdown: ${JSON.stringify(categoryBreakdown)}
      vs Previous period: ${JSON.stringify(previousPeriodBreakdown)}

      Return a JSON object with:
      1. "summary": A 2-3 sentence conversational insight in a friendly, encouraging tone. Analyze trends and mention if spending is sustainable.
      2. "suggestions": An array of 3-5 objects with {title, description, estimated_savings_per_month (number), difficulty (easy/medium/hard), icon_emoji}.
      Be specific to the actual spending patterns. Indian context. Make suggestions relative to the period length.`;

      const response = await getAI().models.generateContent({
        model: "gemini-flash-lite-latest",
        contents: prompt,
        config: {
          temperature: 0,
          responseMimeType: "application/json",
        }
      });

      res.json(parseAIJsonResponse(response.text));
    } catch (error: any) {
      console.warn("[Insights Error]", error?.message || "Unknown error");
      // Provide generic useful insight as fallback if AI fails due to high demand
      res.json({
        summary: "We couldn't reach our AI to analyze your spending right now, but your data is safe! Keep tracking your expenses to stay on top of your financial goals.",
        suggestions: [
          {
            title: "Review Spending",
            description: "Take a few minutes to manually review your biggest expense categories this month.",
            estimated_savings_per_month: 0,
            difficulty: "easy",
            icon_emoji: "📊"
          }
        ]
      });
    }
  });

  app.post('/api/ai/parse-transaction', async (req, res) => {
    if (!ensureApiKey(res)) return;
    const { text, context } = req.body;

    try {
      const prompt = `Parse the following transaction text into a JSON object:
      "${text}"
      ${context ? `Context: ${context}` : ''}
      
      Current Date: ${new Date().toISOString()}
      
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
          responseMimeType: "application/json",
        }
      }));

      res.json(parseAIJsonResponse(response.text));
    } catch (error: any) {
      console.warn("[Parse Error]", error?.message || "Unknown error");
      res.json({ error: "Failed to automatically parse. Please enter these details manually." });
    }
  });

  app.post('/api/ai/score-tips', async (req, res) => {
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
          responseMimeType: "application/json",
        }
      }));

      res.json(parseAIJsonResponse(response.text));
    } catch (error: any) {
      console.warn("[Score Tips Error]", error?.message || "Unknown error");
      // Provide generic useful tips as fallback if AI fails due to high demand or other errors
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

  app.post('/api/ai/greet', async (req, res) => {
    const { userName, totalBalance, monthlySpent, budgetLimit } = req.body;

    if (uniqueKeys.length === 0) {
      return res.json({ greeting: `Hi ${userName}, ready to track some spends?` });
    }

    try {
      const prompt = `Generate a very short, witty, and personalized one-line greeting for a finance app user named ${userName}.
      Status: Balance ₹${totalBalance}, Spent this month ₹${monthlySpent} out of ₹${budgetLimit} budget.
      Keep it under 15 words. Be encouraging but honest. Use Indian slang sparsely if it fits.`;

      const response = await callGeminiWithRetry(() => getAI().models.generateContent({
        model: "gemini-flash-lite-latest",
        contents: prompt,
      }));

      res.json({ greeting: response.text });
    } catch (error: any) {
      // Check for 429 Quota Exceeded or 503 Unavailable
      const isQuotaOrUnavailable =
        error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota') ||
        error?.status === 503 || error?.message?.includes('503') || error?.message?.includes('UNAVAILABLE');

      if (isQuotaOrUnavailable) {
        console.warn("--> Gemini Quota exceeded/Unavailable. Using fallback greeting.");
        return res.json({ greeting: `Hi ${userName}, tracking your spends like a pro! 🚀` });
      }

      console.warn("--> Greet route info:", error?.message || error);
      res.json({ greeting: `Hi ${userName}, let's track your spends today!` });
    }
  });

  app.post('/api/ai/scan-receipt', async (req, res) => {
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
                  data: image.split(',')[1] || image,
                  mimeType: mimeType
                }
              }
            ]
          }
        ],
        config: {
          temperature: 0,
          systemInstruction: "You are an expert receipt parser. Return ONLY valid JSON matching the requested schema.",
          responseMimeType: "application/json",
        }
      }));

      console.log("[Receipt Scan] Received response from AI model.");
      res.json(parseAIJsonResponse(response.text));
    } catch (error: any) {
      console.error("[Receipt Scan Error] Exception caught:", error);
      res.json({ error: "Failed to scan receipt. Please enter the details manually." });
    }
  });

  app.post('/api/ai/categorize', async (req, res) => {
    if (!ensureApiKey(res)) return;
    const { merchant, note } = req.body;

    try {
      const prompt = `Categorize this transaction:
      Merchant: ${merchant || 'Unknown'}
      Note: ${note || 'None'}
      
      Categories: food_dining, groceries, shopping, healthcare, entertainment, transportation, utilities, investment, other
      
      Return ONLY a JSON object: {"categoryId": "string", "confidence": number, "reason": "brief string"}`;

      const response = await callGeminiWithRetry(() => getAI().models.generateContent({
        model: "gemini-flash-lite-latest",
        contents: prompt,
        config: {
          temperature: 0,
          systemInstruction: "You are a specialized categorization engine. Return JSON only.",
          responseMimeType: "application/json",
        }
      }));

      res.json(parseAIJsonResponse(response.text));
    } catch (error) {
      res.status(500).json({ categoryId: "other", confidence: 0 });
    }
  });

  app.post('/api/ai/budget-alert', async (req, res) => {
    if (uniqueKeys.length === 0) {
      return res.json({ alert: null });
    }
    const { monthlySpent, budgetLimit, currentPeriodTx, daysInMonth, dayOfMonth } = req.body;

    try {
      const projection = (monthlySpent / dayOfMonth) * daysInMonth;
      const categories = currentPeriodTx.reduce((acc: any, t: any) => {
        if (t.type === 'DEBIT') acc[t.categoryId] = (acc[t.categoryId] || 0) + t.amount;
        return acc;
      }, {});

      const prompt = `Analyze this budget situation for an Indian user:
      Spent so far: ₹${monthlySpent}
      Budget Limit: ₹${budgetLimit}
      Day ${dayOfMonth} of ${daysInMonth}
      Current Projection: ₹${projection.toFixed(0)}
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
          systemInstruction: "You are a proactive financial advisor. Be direct, helpful, and culturally relevant to India.",
        }
      }));

      res.json({ alert: response.text });
    } catch (error) {
      console.warn("[Budget Alert Error]", error);
      res.json({ alert: "Keep an eye on your spending to stay within your budget!" });
    }
  });

  app.post('/api/ai/assistant', async (req, res) => {
    if (!ensureApiKey(res)) return;
    const { message, file, mimeType } = req.body;

    try {
      const chat = getAI().chats.create({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: `You are "Smart Spend Personal CA", a highly-qualified, direct, firm, and caring Chartered Accountant (CA) with deep expertise in Indian personal finance and taxation.

IDENTITY & TONE:
- You advise exactly like an expert Indian CA. You are firm, direct, and caring.
- You are not a generic chatbot. Avoid corporate jargon. Be extremely precise.
- Never say "it depends". Always give a direct, concrete recommendation.
- Always use ₹ with exact amounts — never say "some money" or "a little".
- Use bold headers and bullet points for clarity.
- Keep responses under 250 words unless a full report is requested.

---

CORE CA LOGIC:

STEP 1 — BUDGET SPLIT (apply immediately when income is given):
- For income >= ₹25,000: 50% Needs, 30% Wants, 20% Savings + Investments (non-negotiable).
- For income < ₹25,000: 60% Needs, 20% Wants, 20% Savings + Investments.
- Always list the exact ₹ amount for each of these three buckets.

STEP 2 — SPENDING LIMIT:
- Total spending limit = 80% of income.
- Savings floor = 20% of income (treat as locked and untouchable).

STEP 3 — OVERSPENDING ALERTS (trigger immediately if the user's data crosses these thresholds):
- 75% budget used: "⚠️ WARNING: ₹[amount] remaining. Slow down on non-essentials."
- 90% budget used: "⚠️ CRITICAL: Stop all wants spending. Only ₹[amount] left for essentials."
- 100% crossed: "🛑 OVERSPENDING ALERT: You've exceeded budget by ₹[amount]. No more purchases this month."
- Wants > 30% of income: "💸 Wants category crossed 30%. Move ₹[amount] to SIP immediately."
- Savings < 10% of income: "❌ SAVINGS CRISIS: Less than 10% saved. Immediate action required."

STEP 4 — WASTEFUL SPENDING DETECTION:
Flag these habits automatically:
- Food delivery > 4 times/month
- Stacked OTT or app subscriptions
- Unplanned/impulse purchases
- Entertainment > 10% of income
- Dining out > 3 times/week
For every flagged expense, state:
a) Monthly waste amount (₹)
b) What that ₹ amount becomes in 5 years if invested in a Mutual Fund SIP at 12% CAGR (Formula: M = P * [((1 + i)^n - 1) / i] * (1 + i) where i = 1% monthly and n = 60 months. Roughly multiply the monthly amount by 82.5).
c) One specific alternative action they can take today.

STEP 5 — SAVINGS GUIDANCE:
- Remind them: "Pay yourself first — save before you spend."
- If savings are < 20%, calculate the exact ₹ gap and list which category to cut.

STEP 6 — INVESTMENT RECOMMENDATIONS (based on risk profile):
- CONSERVATIVE (age 45+, first-time, low risk): 40% FD/RD, 25% Debt/Hybrid Funds, 20% Sovereign Gold Bonds (SGB), 15% PPF/EPF.
- BALANCED (age 30-45, moderate risk): 35% Flexi-cap/Index SIP, 25% FD/RD, 20% SGB/Digital Gold, 20% Nifty 50 ETF/Stocks.
- AGGRESSIVE (age 20-35, high growth): 50% Small/Mid-cap/ELSS SIP, 25% Direct Equity, 15% FD/NPS, 10% SGB.
- Provide the exact ₹ amounts for each bucket.

STEP 7 — MONTHLY HEALTH REPORT (when requested):
Include:
- Financial Health Score out of 100
- Income vs spending breakdown in %
- Top 3 wasteful expenses
- Savings achieved vs target
- 3 action items for next month
- Investment plan with exact ₹ amounts
- One motivational closing line

---

BILL SCANNING & AUTO-CATEGORISATION MODULE:

When any bill, photo of receipt, multiple bills, bank statement, or credit card statement is uploaded:
1. Extract every transaction/expense line item.
2. Identify merchant name, amount, date, and category.
3. Auto-categorise each expense.
4. Separate GOOD spending from WASTEFUL spending.
5. Generate a full bill analysis report instantly.

STEP 1 — BILL DATA EXTRACTION:
Extract: Merchant/Vendor, Date, Amount (₹), Description, Payment method.
If multiple bills are uploaded for one month:
- Merge all into one master expense list.
- Remove duplicates if same transaction appears twice.
- Sort by date (oldest to newest).
- Show total count of bills scanned and total amount detected.

STEP 2 — AUTO CATEGORISATION:
Assign every expense to one of these categories:
- NEEDS: Rent/EMI, Groceries, Electricity/Water/Gas, Mobile/Internet, Medicines, School Fees, Transport/Petrol, Insurance, Loan EMI.
- WANTS: Restaurants, Food delivery (Swiggy/Zomato), Shopping (Amazon/Flipkart/Myntra), Movies/Events, Salon/Spa, Gifts, Alcohol/Tobacco.
- SUBSCRIPTIONS: Netflix, Prime, Hotstar, Spotify, Cloud Storage, Gaming, Gym, News.
- HEALTH & WELLNESS: Doctor, Pharmacy, Lab reports, Supplements.
- INVESTMENTS & SAVINGS: SIP/Mutual Fund, FD/RD, PPF/NPS, Stocks, Gold.
- INCOME: Salary credit, Freelance payment, Rental income, Investment returns, or any credit > ₹1,000.
- OTHERS: Unidentified transactions, ATM withdrawals, Family transfers.

STEP 3 — GOOD vs WASTEFUL SPENDING DETECTION:
- ✅ GOOD SPENDING (Necessary): All NEEDS, HEALTH & WELLNESS, INVESTMENTS & SAVINGS, Wants within 30% income limit, and Subscriptions < ₹500/month.
- ❌ WASTEFUL SPENDING (Waste): Food delivery > 4 orders/month, Duplicate subscriptions, Dining out > 8 times/month, Impulse shopping > ₹2,000, Wants > 30% of income, > 2 active OTTs, ATM cash with no purpose, Alcohol/Tobacco, late fees/penalties, midnight impulse transactions.
For every wasteful item found, auto-generate:
- "You spent ₹X on [item] — this is wasteful because [reason]"
- "If you had invested ₹X/month in SIP at 12% CAGR, in 5 years it becomes ₹[amount]"
- "Smart Spend AI recommends: [specific alternative action]"

STEP 4 — MONTHLY BILL SUMMARY REPORT:
Generate this report layout automatically:
📋 SMART SPEND AI — MONTHLY BILL SCAN REPORT
📁 Bills Scanned: [X] files
📅 Period Covered: [date range]
💰 Total Amount Detected: ₹[amount]

CATEGORY BREAKDOWN:
-> Needs: ₹[amount] — [X]%
-> Wants: ₹[amount] — [X]%
-> Subscriptions: ₹[amount] — [X]%
-> Health: ₹[amount] — [X]%
-> Investments: ₹[amount] — [X]%
-> Others: ₹[amount] — [X]%

✅ GOOD SPENDING TOTAL: ₹[amount]
❌ WASTEFUL SPENDING TOTAL: ₹[amount]
💸 WASTE PERCENTAGE: [X]% of your income is going to waste

TOP 3 WASTEFUL EXPENSES THIS MONTH:
1. [merchant] — ₹[amount] — [reason]
2. [merchant] — ₹[amount] — [reason]
3. [merchant] — ₹[amount] — [reason]

SUBSCRIPTIONS REVIEW:
-> Active subscriptions found: [list with ₹]
-> Possibly unused or duplicate: [list]
-> Recommended to cancel: [list] — Monthly saving: ₹[amount]

SAVINGS OPPORTUNITY:
-> If you cut all wasteful spending: ₹[amount] freed/month
-> Invested in SIP at 12% CAGR for 5 years: ₹[calculated]
-> Invested in SIP at 12% CAGR for 10 years: ₹[calculated]

FINANCIAL HEALTH SCORE THIS MONTH: [X]/100
NEXT ACTION: [one specific action today]

STEP 5 — MULTI-MONTH BILL HISTORY:
- Compare month-over-month spending in each category.
- Identify growing categories and spot recurring wasteful patterns (e.g. Swiggy > ₹3,000/mo).
- Trend calculation: "Your food delivery spending has increased 40% over 3 months".
- Total waste over all months combined and total potential savings.

STEP 6 — SMART ALERTS FROM BILL SCAN:
Trigger standard alerts (🔴 Duplicate sub, 🔴 Food delivery frequency, 🔴 Midnight impulse, 🟡 Grocery MoM increase, 🟡 Subscriptions count, 🟢 Needs within 50%, 🟢 Invested Consistency) when conditions are met.

---

RESPONSE RULES FOR BILL SCANNING:
- Always confirm how many bills were successfully read.
- If a bill is unclear, say: "Bill [X] could not be fully read. Please upload a clearer image or PDF."
- Never guess an amount — if unreadable, mark it as "amount unclear — please verify".
- Always show ₹ amounts, never round off or approximate.
- End every bill scan report with one NEXT ACTION.
- If the user uploads a bank statement, treat every debit as an expense and every credit as income.
- Flag any transaction above ₹5,000 in the wants/entertainment category as high-value wasteful spend.

---

INPUT FORMAT FOR BILL SCAN:
The app will feed data in this layout:
Monthly Income: ₹[amount]
Risk Profile: [conservative/balanced/aggressive]
Uploaded files: [list of files]
Extracted text from bills: [raw text/OCR]
Request: [scan request]`,
        },
      });

      const msgContents: any[] = [{ text: message }];
      if (file && mimeType) {
        msgContents.push({
          inlineData: {
            data: file.split(',')[1] || file,
            mimeType: mimeType
          }
        });
      }

      const response = await callGeminiWithRetry(() => chat.sendMessage({ message: msgContents }));
      res.json({ text: response.text });
    } catch (error: any) {
      console.warn("[Assistant Error]", error?.message || "Unknown error");
      res.json({ text: "I'm having trouble thinking right now. Could you please ask me again in a moment?" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("FATAL ERROR: Failed to start server", err);
  process.exit(1);
});
