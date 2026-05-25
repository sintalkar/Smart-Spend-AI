import { RegexParserEngine, ParsedTransaction } from './RegexParserEngine';
import { GeminiTransactionParser } from './GeminiTransactionParser';
import { DataSanitizer } from './DataSanitizer';
import { adminService } from '../admin/AdminService';

export class SmsProcessor {
  private regexEngine = new RegexParserEngine();
  private geminiParser = new GeminiTransactionParser();

  /**
   * Processes an incoming SMS, returning the final transaction or throwing an error if unable to parse.
   */
  public async processSms(smsBody: string, senderTitle: string): Promise<ParsedTransaction | null> {
    const toggles = adminService.getToggles();
    if (!toggles.smsDetection) return null;

    const rawSanitized = DataSanitizer.sanitizeSms(smsBody);

    // Try Regex First
    const regexResult = this.regexEngine.parse(rawSanitized, senderTitle);
    
    let resolvedResult: ParsedTransaction | null = null;
    let method = '';

    if (regexResult && regexResult.confidence >= 0.85) {
      resolvedResult = regexResult;
      method = 'regex';
    } else {
      // AI Fallback if Regex failed or confidence < 0.85
      const fallbackResult = await this.geminiParser.parse(rawSanitized, senderTitle);
      if (fallbackResult) {
        resolvedResult = fallbackResult;
        method = 'ai';
      } else if (regexResult && regexResult.confidence >= 0.6) {
        resolvedResult = regexResult;
        method = 'regex_low_conf';
      }
    }

    if (resolvedResult) {
      // Lookup merchant memory map
      if (resolvedResult.merchantName) {
        try {
          const { merchantMemoryService } = await import('../../lib/merchantMemory');
          const learned = await merchantMemoryService.recallMerchant(resolvedResult.merchantName);
          if (learned) {
            resolvedResult.categoryId = learned.category;
            (resolvedResult as any).isLearned = true;
          }
        } catch (e) {
          console.warn("[Merchant Memory recall in SmsProcessor failed]", e);
        }
      }
      adminService.logEvent('SMS_PARSED_SUCCESS', { method });
      return resolvedResult;
    }

    adminService.logEvent('SMS_PARSED_FAILED');
    return null;
  }
}

export const smsProcessor = new SmsProcessor();
