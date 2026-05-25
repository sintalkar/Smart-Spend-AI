import { format, subDays, previousDay, parseISO } from 'date-fns';

export interface VoiceParsedTransaction {
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  merchant: string;
  category: string;
  date: string;
  note: string;
  confidence: number;
}

export class VoiceExpenseParser {
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

      if ((response.status === 403 && errorData.code === 'MISSING_API_KEY') || errorData.error === 'MISSING_API_KEY') {
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

  public async parseVoiceInput(transcription: string): Promise<VoiceParsedTransaction | null> {
    try {
      const { auth } = await import('../../firebase');
      const response = await fetch('/api/gemini/parse-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: transcription,
          userId: auth.currentUser?.uid
        })
      });
      
      const data = await this.handleResponse(response, "Gemini Parsing Error");
      
      // Map server format to frontend expected format if necessary
      return {
        amount: data.amount,
        type: data.type,
        merchant: data.merchant || data.description,
        category: data.categoryId,
        date: data.dateTime ? new Date(data.dateTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        note: data.description || '',
        confidence: data.confidence || 1.0
      };
    } catch (e: any) {
      if (e.message === "API_KEY_MISSING") {
        throw new Error("Gemini API key is missing. Please add it in 'Settings > Secrets'.");
      }
      console.warn("Gemini Parsing Error", e);
      return null;
    }
  }
}

export const voiceExpenseParser = new VoiceExpenseParser();
