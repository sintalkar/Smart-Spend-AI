import { ParsedTransaction } from './RegexParserEngine';
import { TransactionType } from '../../db/models';
import { adminService } from '../admin/AdminService';
import { auth } from '../../firebase';

export class GeminiTransactionParser {
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

  public async parse(sanitizedSms: string, senderInfo: string): Promise<ParsedTransaction | null> {
    const toggles = adminService.getToggles();
    if (!toggles.aiParsing) return null;

    adminService.logEvent('AI_FALLBACK_USED');

    try {
      const response = await fetch('/api/gemini/parse-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: sanitizedSms, 
          context: `Sender: ${senderInfo}`,
          userId: auth.currentUser?.uid
        })
      });
      
      const data = await this.handleResponse(response, "Gemini Parsing Error");

      if (!data.amount || !data.type) return null;

      return {
        amount: data.amount,
        type: data.type === 'CREDIT' ? TransactionType.CREDIT : TransactionType.DEBIT,
        merchantName: data.merchant,
        categoryId: data.categoryId,
        dateTime: data.dateTime || Date.now(), 
        upiRefId: data.upiRefId,
        rawText: sanitizedSms, 
        source: `Gemini (${senderInfo})`,
        confidence: data.confidence || 0.95, 
        bankName: data.bankName,
        accountLast4: data.accountLast4
      };
    } catch (e: any) {
      if (e.message === "API_KEY_MISSING") {
        console.warn("AI Parsing failed: Gemini API key is missing.");
        return null; // Silent fallback to regex
      }
      console.warn("Gemini Parsing Error", e);
      return null;
    }
  }
}

