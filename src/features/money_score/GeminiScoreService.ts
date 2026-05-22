import { ScoreBreakdown } from './MoneyScoreCalculator';

export interface ScoreImprovementTip {
  tip: string;
  impact: number;
  effort: 'easy' | 'medium' | 'hard';
}

export class GeminiScoreService {
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

      if (response.status === 403 || errorData.code === 'MISSING_API_KEY') {
        console.log("Debug GeminiScoreService handleResponse: 403 or code MISSING_API_KEY detected.");
        throw new Error("API_KEY_MISSING");
      }
      
      console.error(`${errorMessage}:`, response.status, errorData);
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    try {
      return await response.json();
    } catch (e) {
      console.error("JSON Parse Error in handleResponse:", e);
      throw new Error("Invalid response format from server");
    }
  }

  public async getImprovementTips(score: number, breakdown: ScoreBreakdown): Promise<ScoreImprovementTip[]> {
    try {
      const response = await fetch(`${window.location.origin}/api/ai/score-tips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, breakdown })
      });
      
      return await this.handleResponse(response, "Gemini Score Service Error");
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      console.warn("Gemini Score Service Error logs:", error);
      if (error.message !== "API_KEY_MISSING") {
        console.warn("Gemini Score Service Error details:", error);
      }
      if (error.message === "API_KEY_MISSING") {
        throw new Error("To receive AI-powered financial tips, please add your Gemini API key in Settings > Secrets.");
      }
      if (error.message.includes("Failed to fetch")) {
        throw new Error(`Network error: Failed to connect to the server (URL: ${window.location.origin}/api/ai/score-tips). Please ensure the backend is running and the API key is configured in Settings > Secrets. Original error: ${error.message}`);
      }
      throw error;
    }
  }
}

export const scoreService = new GeminiScoreService();
