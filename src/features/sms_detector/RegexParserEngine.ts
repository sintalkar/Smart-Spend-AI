import { TransactionType } from '../../db/models';
import { parseSMS, getCleanSenderName } from '../../lib/smsParser';

export interface ParsedTransaction {
  amount: number;
  type: TransactionType;
  merchantName?: string;
  categoryId?: string;
  dateTime: number;
  upiRefId?: string;
  rawText: string;
  source: string;
  confidence: number;
  bankName?: string;
  accountLast4?: string;
}

export class RegexParserEngine {
  public parse(smsBody: string, senderTitle: string): ParsedTransaction | null {
    const parsed = parseSMS(smsBody, senderTitle);
    if (!parsed) return null;

    // Map confidence text to numeric score
    let confidenceScore = 0.5;
    if (parsed.confidence === 'High') confidenceScore = 0.9;
    else if (parsed.confidence === 'Medium') confidenceScore = 0.7;

    // Implement category name + " Transaction" fallback if merchant is unknown
    let finalMerchant = parsed.merchant;
    if (!finalMerchant || finalMerchant.toLowerCase() === 'unknown' || finalMerchant.toLowerCase() === 'unknown merchant' || finalMerchant === 'Bank Transaction') {
      const cleanSender = getCleanSenderName(senderTitle);
      if (cleanSender && cleanSender !== 'UNKNOWN' && cleanSender !== 'BANK') {
        finalMerchant = cleanSender;
      } else {
        // Fallback to Category + " Transaction"
        finalMerchant = 'Other Transaction';
      }
    }

    return {
      amount: parsed.amount,
      type: parsed.type === 'CREDIT' ? TransactionType.CREDIT : TransactionType.DEBIT,
      merchantName: finalMerchant,
      categoryId: parsed.type === 'CREDIT' ? 'salary' : 'other', // default categories
      dateTime: parsed.dateTime || Date.now(),
      upiRefId: parsed.refNo,
      rawText: smsBody,
      source: senderTitle || 'SMS Detection',
      confidence: confidenceScore,
      bankName: parsed.bankName,
      accountLast4: this.extractAccountLast4(smsBody)
    };
  }

  private extractAccountLast4(smsBody: string): string | undefined {
    const match = smsBody.match(/(?:a\/c|acct|account).*(?:no|ending).*[xX\*]+([0-9]{3,4})/i);
    return match ? match[1] : undefined;
  }
}

