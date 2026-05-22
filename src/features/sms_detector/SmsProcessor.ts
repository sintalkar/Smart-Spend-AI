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
    
    if (regexResult && regexResult.confidence >= 0.85) {
      adminService.logEvent('SMS_PARSED_SUCCESS', { method: 'regex' });
      return regexResult;
    }

    // AI Fallback if Regex failed or confidence < 0.85
    const fallbackResult = await this.geminiParser.parse(rawSanitized, senderTitle);
    
    if (fallbackResult) {
      adminService.logEvent('SMS_PARSED_SUCCESS', { method: 'ai' });
      return fallbackResult;
    }

    // If AI failed as well, but we had a mediocre regex reading, fallback to the mediocre one.
    if (regexResult && regexResult.confidence >= 0.6) {
      adminService.logEvent('SMS_PARSED_SUCCESS', { method: 'regex_low_conf' });
      return regexResult;
    }

    adminService.logEvent('SMS_PARSED_FAILED');
    return null;
  }
}

export const smsProcessor = new SmsProcessor();
