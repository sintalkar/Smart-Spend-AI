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

  // Gemini Setup
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    console.warn("CRITICAL: GEMINI_API_KEY is not set in the environment variables. AI features will fail.");
  }

  const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const callGeminiWithRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
    const MAX_RETRIES = 5;
    let delay = 2000;
    
    let lastError: any;
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            const isTransientError = error?.status === 503 || error?.status === 429 || 
                                     error?.message?.includes('503') || error?.message?.includes('429') ||
                                     error?.message?.includes('high demand');
            
            if (isTransientError && i < MAX_RETRIES - 1) {
                console.warn(`[Gemini Retry] Attempt ${i + 1} failed. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
                continue;
            }
            throw error;
        }
    }
    throw lastError;
  };

  // Helper to check for API key before calling Gemini
  const ensureApiKey = (res: any) => {
    if (!GEMINI_API_KEY) {
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
      const chat = ai.chats.create({
        model: "gemini-1.5-flash",
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

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: {
          temperature: 0,
          responseMimeType: "application/json",
        }
      });

      res.json(JSON.parse(response.text));
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

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: {
          temperature: 0,
          responseMimeType: "application/json",
        }
      });

      res.json(JSON.parse(response.text));
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

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: {
          temperature: 0,
          responseMimeType: "application/json",
        }
      });

      res.json(JSON.parse(response.text));
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
    
    if (!GEMINI_API_KEY) {
      return res.json({ greeting: `Hi ${userName}, ready to track some spends?` });
    }
    
    try {
      const prompt = `Generate a very short, witty, and personalized one-line greeting for a finance app user named ${userName}.
      Status: Balance ₹${totalBalance}, Spent this month ₹${monthlySpent} out of ₹${budgetLimit} budget.
      Keep it under 15 words. Be encouraging but honest. Use Indian slang sparsely if it fits.`;

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
      });

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
      const response = await callGeminiWithRetry(() => ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
          prompt,
          {
            inlineData: {
              data: image.split(',')[1] || image,
              mimeType: mimeType
            }
          }
        ],
        config: {
          temperature: 0,
          systemInstruction: "You are an expert receipt parser. Return ONLY valid JSON matching the requested schema.",
          responseMimeType: "application/json",
        }
      }));

      console.log("[Receipt Scan] Received response from AI model.");
      let responseText = response.text || "";
      if (responseText.includes("```json")) {
        responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      } else if (responseText.includes("```")) {
        responseText = responseText.replace(/```/g, "").trim();
      }
      res.json(JSON.parse(responseText));
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

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: {
          temperature: 0,
          systemInstruction: "You are a specialized categorization engine. Return JSON only.",
          responseMimeType: "application/json",
        }
      });

      res.json(JSON.parse(response.text));
    } catch (error) {
      res.status(500).json({ categoryId: "other", confidence: 0 });
    }
  });

  app.post('/api/ai/budget-alert', async (req, res) => {
    if (!GEMINI_API_KEY) {
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

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are a proactive financial advisor. Be direct, helpful, and culturally relevant to India.",
        }
      });

      res.json({ alert: response.text });
    } catch (error) {
      console.warn("[Budget Alert Error]", error);
      res.json({ alert: "Keep an eye on your spending to stay within your budget!" });
    }
  });

  app.post('/api/ai/assistant', async (req, res) => {
    if (!ensureApiKey(res)) return;
    const { message } = req.body;
    
    try {
      const chat = ai.chats.create({
        model: "gemini-1.5-flash",
        config: {
          systemInstruction: `You are "Smart Spend Assistant", a friendly, ultra-helpful, and professional financial assistant for the Smart Spend app. 
          Your goals are to help users understand their spending, give actionable advice based on their finance data, and guide them within the app.
          
          When provided with "Context - Found transactions: ..." in the user message, use that data specifically to answer the user's search or question about their transactions.
          Keep responses concise, conversational, and specific.`,
        },
      });

      const response = await chat.sendMessage({ message });
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
