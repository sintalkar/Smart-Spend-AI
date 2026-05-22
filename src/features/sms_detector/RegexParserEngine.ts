import { TransactionType } from '../../db/models';

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
  // Amount Extraction Regex
  private static AMOUNT_REGEX = /(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)|(?:amount\s+of\s+(?:Rs\.?|INR|₹)?\s*)([\d,]+\.?\d*)/i;
  
  // Transaction Type Keywords
  private static DEBIT_KEYWORDS = ['debited', 'spent', 'paid', 'sent'];
  private static CREDIT_KEYWORDS = ['credited', 'received', 'added', 'deposited'];
  
  // Merchant Extraction Regex (Common Indian formats)
  private static MERCHANT_REGEXES = [
    /(?:to|at|vpa)\s+([a-zA-Z0-9\s@\-\.]+?)(?:\s+on|\s+ref|\s+upi|\.|$)/i,
    /transfer\s+to\s+([a-zA-Z0-9\s]+?)(?:\s+ref|$)/i
  ];

  // UPI Ref regex
  private static UPI_REF_REGEX = /(?:upi ref|ref no|ref id|txn id)[:\-\s]*([0-9]{12})/i;
  
  // Account Last 4 regex
  private static ACCOUNT_REGEX = /(?:a\/c|acct|account).*(?:no|ending).*[xX\*]+([0-9]{3,4})/i;

  public parse(smsBody: string, senderTitle: string): ParsedTransaction | null {
    const rawText = smsBody;
    const lowerBody = rawText.toLowerCase();

    // 1. Determine Type
    let type = TransactionType.DEBIT; // Default
    if (RegexParserEngine.CREDIT_KEYWORDS.some(kw => lowerBody.includes(kw))) {
      type = TransactionType.CREDIT;
    } else if (!RegexParserEngine.DEBIT_KEYWORDS.some(kw => lowerBody.includes(kw))) {
      // If no explicit keyword matches, we might fail or lower confidence.
    }

    // 2. Extract Amount
    let amountStr: string | undefined;
    const amountMatch = rawText.match(RegexParserEngine.AMOUNT_REGEX);
    if (amountMatch) {
      amountStr = amountMatch[1] || amountMatch[2];
    }
    
    if (!amountStr) {
      return null; // Amount is absolutely required
    }
    
    // Clean amount
    const amount = parseFloat(amountStr.replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) return null;

    // 3. Extract Merchant
    let merchantName: string | undefined;
    for (const regex of RegexParserEngine.MERCHANT_REGEXES) {
      const match = rawText.match(regex);
      if (match && match[1]) {
        merchantName = match[1].trim();
        break;
      }
    }

    // 4. Extract UPI Ref
    let upiRefId: string | undefined;
    const upiMatch = rawText.match(RegexParserEngine.UPI_REF_REGEX);
    if (upiMatch && upiMatch[1]) {
      upiRefId = upiMatch[1];
    }

    // 5. Account Last 4
    let accountLast4: string | undefined;
    const accountMatch = rawText.match(RegexParserEngine.ACCOUNT_REGEX);
    if (accountMatch && accountMatch[1]) {
      accountLast4 = accountMatch[1];
    }

    // Calculate Confidence
    let confidence = 0.4;
    if (amount > 0) confidence += 0.2;
    if (merchantName) confidence += 0.2;
    if (accountLast4) confidence += 0.1;
    if (upiRefId) confidence += 0.1;

    // Reject if below 0.6 threshold as per requirements
    if (confidence < 0.6) {
      return null;
    }

    return {
      amount,
      type,
      merchantName,
      dateTime: Date.now(), // Fallback to current time if no explicit time inside sms
      upiRefId,
      rawText,
      source: senderTitle || 'Unknown SMS',
      confidence,
      bankName: this.inferBankName(senderTitle),
      accountLast4
    };
  }

  private inferBankName(sender: string): string | undefined {
    const s = sender.toUpperCase();
    if (s.includes('HDFC')) return 'HDFC';
    if (s.includes('ICICI')) return 'ICICI';
    if (s.includes('SBI')) return 'SBI';
    if (s.includes('AXIS')) return 'AXIS';
    if (s.includes('KOTAK')) return 'KOTAK';
    if (s.includes('PHONPE')) return 'PhonePe';
    if (s.includes('PAYTM')) return 'Paytm';
    if (s.includes('GPAY')) return 'GPay';
    return undefined;
  }
}
