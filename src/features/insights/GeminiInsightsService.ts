import { adminService } from '../admin/AdminService';
import { auth } from '../../firebase';

export interface OverspendingCategory {
  category: string;
  amount_spent: number;
  recommended_max: number;
  excess: number;
  insight: string;
}

export interface SavingsSuggestion {
  title: string;
  detail: string;
  estimated_monthly_savings: number;
}

export interface InvestmentSuggestion {
  title: string;
  detail: string;
  amount: number;
  platform: string;
  expected_return: string;
}

export interface InsightsData {
  alert: boolean;
  alert_message: string;
  spending_percentage: number;
  top_overspending_categories: OverspendingCategory[];
  savings_suggestions: SavingsSuggestion[];
  investment_suggestions: InvestmentSuggestion[];
  motivational_message: string;
}

export class GeminiInsightsService {
  private async handleResponse(response: Response, errorMessage: string) {
    if (!response.ok) {
      let errorData: any = {};
      try {
        const text = await response.text();
        try {
          errorData = JSON.parse(text);
        } catch (e) {
          errorData = { error: text || `HTTP ${response.status}` };
        }
      } catch (e) { 
        errorData = { error: `HTTP ${response.status}` };
      }

      if (response.status === 403 || errorData.error === 'MISSING_API_KEY') {
        throw new Error("API_KEY_MISSING");
      }
      
      console.warn(`${errorMessage}:`, response.status, errorData);
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    try {
      return await response.json();
    } catch (e) {
      console.warn("JSON Parse Error in handleResponse:", e);
      throw new Error("Invalid response format from server");
    }
  }

  public async generateInsights(
    period: string,
    totalSpent: number,
    income: number,
    categoryBreakdown: Record<string, number>,
    previousPeriodBreakdown: Record<string, number>,
    totalBudget: number,
    categoryBudgets: Record<string, number>
  ): Promise<InsightsData | null> {
    adminService.logEvent('INSIGHT_GENERATED');

    try {
      const response = await fetch('/api/gemini/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period,
          totalSpent,
          income,
          categoryBreakdown,
          previousPeriodBreakdown,
          totalBudget,
          categoryBudgets,
          userId: auth.currentUser?.uid
        })
      });

      return await this.handleResponse(response, "Insights API Error");
    } catch (e: any) {
      if (e.message === "API_KEY_MISSING") return null;
      console.warn("Insights API Error", e);
      return null;
    }
  }

  private greetingCache: { text: string, timestamp: number } | null = null;
  private GREETING_CACHE_TTL = 1000 * 60 * 30; // 30 minutes cache

  public async getSmartGreeting(userName: string, totalBalance: number, monthlySpent: number, budgetLimit: number): Promise<string> {
    const now = Date.now();

    // Check in-memory cache first (fastest, no parsing overhead)
    if (this.greetingCache && now - this.greetingCache.timestamp < this.GREETING_CACHE_TTL) {
      return this.greetingCache.text;
    }

    // Fall back to localStorage cache (survives page reloads)
    const storedCache = localStorage.getItem('ai_greeting_cache');
    if (storedCache) {
      try {
        const parsed = JSON.parse(storedCache);
        if (now - parsed.timestamp < this.GREETING_CACHE_TTL) {
          this.greetingCache = parsed; // warm the in-memory cache
          return parsed.text;
        }
      } catch (e) {}
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    try {
      const response = await fetch('/api/gemini/greet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userName, 
          totalBalance, 
          monthlySpent, 
          budgetLimit,
          userId: auth.currentUser?.uid
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const data = await this.handleResponse(response, "Smart Greeting API Error");
      
      // Update cache
      this.greetingCache = { text: data.greeting, timestamp: Date.now() };
      localStorage.setItem('ai_greeting_cache', JSON.stringify(this.greetingCache));
      
      return data.greeting;
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        return `Hi ${userName}, how is your day going?`;
      }
      if (e.message === "API_KEY_MISSING") {
        return `Setup AI Key in Settings to get smart greetings ✨`;
      }
      // If it's the fallback greeting from server or any other non-AI response, it won't be "API_KEY_MISSING"
      // but we still want to be silent if it's a known non-critical failure
      if (e.message?.includes('403')) {
        return `Hi ${userName}, ready to track some spends?`;
      }
      
      console.warn("Smart Greeting fetch failed:", e.message);
      return `Hi ${userName}, let's track your spends!`;
    }
  }

  public async parseTransaction(text: string): Promise<any | null> {
    try {
      const response = await fetch('/api/gemini/parse-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text,
          userId: auth.currentUser?.uid
        })
      });
      
      return await this.handleResponse(response, "Parse Transaction API Error");
    } catch (e: any) {
      if (e.message === "API_KEY_MISSING") {
        throw new Error("Gemini API key is missing. Please add it in 'Settings > Secrets'.");
      }
      console.warn("Parse Transaction API Error", e);
      throw e;
    }
  }

  public async scanReceipt(imageData: string, mimeType: string): Promise<any> {
    try {
      const response = await fetch('/api/gemini/parse-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: imageData, 
          mimeType,
          userId: auth.currentUser?.uid
        })
      });
      
      return await this.handleResponse(response, "Scan Receipt API Error");
    } catch (e: any) {
      if (e.message === "API_KEY_MISSING") {
        throw new Error("Gemini API key is missing. Receipt scanning is unavailable until AI is configured.");
      }
      console.warn("Scan Receipt API Error", e);
      throw e;
    }
  }
}

export const insightsService = new GeminiInsightsService();

