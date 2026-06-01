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

    const finalType = parsed.type === 'CREDIT' ? TransactionType.CREDIT : TransactionType.DEBIT;

    return {
      amount: parsed.amount,
      type: finalType,
      merchantName: finalMerchant,
      categoryId: this.detectCategory(finalMerchant, smsBody, finalType),
      dateTime: parsed.dateTime || Date.now(),
      upiRefId: parsed.refNo,
      rawText: smsBody,
      source: senderTitle || 'SMS Detection',
      confidence: confidenceScore,
      bankName: parsed.bankName,
      accountLast4: this.extractAccountLast4(smsBody)
    };
  }

  private detectCategory(merchantName: string, smsBody: string, type: TransactionType): string {
    const text = (merchantName + " " + smsBody).toLowerCase();
    
    if (type === TransactionType.CREDIT) {
      return 'salary'; // Default credit category
    }

    // Food & Dining
    if (
      text.includes('zomato') || text.includes('swiggy') || text.includes('dining') || 
      text.includes('restaurant') || text.includes('cafe') || text.includes('food') || 
      text.includes('eat') || text.includes('starbucks') || text.includes('mcdonald') || 
      text.includes('kfc') || text.includes('burger') || text.includes('pizza') || 
      text.includes('bakery') || text.includes('sweet') || text.includes('ubereats') ||
      text.includes('instamart') || text.includes('blinkit')
    ) {
      if (text.includes('instamart') || text.includes('blinkit') || text.includes('zepto')) {
        return 'groceries';
      }
      return 'food_dining';
    }

    // Groceries
    if (
      text.includes('grocer') || text.includes('supermarket') || text.includes('bigbasket') || 
      text.includes('dmart') || text.includes('spencer') || text.includes('reliance fresh') || 
      text.includes('milk') || text.includes('vegetable') || text.includes('fruits') ||
      text.includes('mart') || text.includes('quickcommerce')
    ) {
      return 'groceries';
    }

    // Transportation
    if (
      text.includes('uber') || text.includes('ola') || text.includes('rapido') || 
      text.includes('metro') || text.includes('rail') || text.includes('irctc') || 
      text.includes('fuel') || text.includes('petrol') || text.includes('diesel') || 
      text.includes('cng') || text.includes('cab') || text.includes('taxi') || 
      text.includes('transport') || text.includes('bus') || text.includes('travel') ||
      text.includes('flight') || text.includes('airline')
    ) {
      return 'transportation';
    }

    // Entertainment
    if (
      text.includes('netflix') || text.includes('prime') || text.includes('spotify') || 
      text.includes('youtube') || text.includes('disney') || text.includes('hotstar') || 
      text.includes('movie') || text.includes('cinema') || text.includes('bookmyshow') || 
      text.includes('theater') || text.includes('entertainment') || text.includes('game') ||
      text.includes('pub') || text.includes('club') || text.includes('bar')
    ) {
      return 'entertainment';
    }

    // Bills & Utilities
    if (
      text.includes('electricity') || text.includes('water') || text.includes('gas') || 
      text.includes('broadband') || text.includes('wifi') || text.includes('recharge') || 
      text.includes('jio') || text.includes('airtel') || text.includes('vi ') || 
      text.includes('bsnl') || text.includes('bill') || text.includes('utility') || 
      text.includes('power') || text.includes('insurance') || text.includes('premium') || 
      text.includes('loan') || text.includes('emi') || text.includes('postpaid') ||
      text.includes('telecom')
    ) {
      return 'bills_utilities';
    }

    return 'other';
  }

  private extractAccountLast4(smsBody: string): string | undefined {
    const match = smsBody.match(/(?:a\/c|acct|account).*(?:no|ending).*[xX\*]+([0-9]{3,4})/i);
    return match ? match[1] : undefined;
  }
}

