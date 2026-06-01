import { TransactionType } from '../db/models';

export interface SMSParsedResult {
  amount: number;
  merchant: string;
  type: 'DEBIT' | 'CREDIT';
  balance?: number;
  dateTime: number;
  upiId?: string;
  refNo?: string;
  confidence: 'High' | 'Medium' | 'Low';
  bankName: string;
}

export const SENDER_MAP: Record<string, string> = {
  'HDFCBK': 'HDFC Bank',
  'HDFCCRD': 'HDFC Bank Credit Card',
  'SBICRD': 'SBI Card',
  'SBIUPI': 'SBI',
  'SBI-UPI': 'SBI',
  'SBIINB': 'SBI Net Banking',
  'ICICIB': 'ICICI Bank',
  'ICICICRD': 'ICICI Bank Credit Card',
  'AXISBK': 'Axis Bank',
  'AXISCRD': 'Axis Bank Credit Card',
  'KOTAKB': 'Kotak Mahindra Bank',
  'KOTAKC': 'Kotak Mahindra Bank',
  'YESBNK': 'Yes Bank',
  'YESCRD': 'Yes Bank Credit Card',
  'INDUSI': 'IndusInd Bank',
  'PNBSMS': 'Punjab National Bank',
  'BOISMS': 'Bank of India',
  'CANARA': 'Canara Bank',
  'UNIONB': 'Union Bank',
  'BARODA': 'Bank of Baroda',
  'IDFCFB': 'IDFC First Bank',
  'FEDBNK': 'Federal Bank',
  'RBLBNK': 'RBL Bank',
  'HSBCBK': 'HSBC',
  'AMEX': 'American Express',
  'PHONEPE': 'PhonePe',
  'PAYTM': 'Paytm',
  'GPAY': 'Google Pay',
  'AMZPAY': 'Amazon Pay',
  'BHIM': 'BHIM UPI'
};

export function getCleanSenderName(sender: string): string {
  if (!sender) return '';
  const cleaned = sender.toUpperCase().replace(/[^A-Z0-9\-]/g, '');
  
  for (const [key, name] of Object.entries(SENDER_MAP)) {
    if (cleaned.includes(key.toUpperCase())) {
      return name;
    }
  }
  return cleaned.replace(/^.*[ \-]/g, '') || 'Bank';
}

export function parseSMS(body: string, sender: string): SMSParsedResult | null {
  const lowerBody = body.toLowerCase();
  const cleanSender = getCleanSenderName(sender);

  // 1. Extract Amount
  const amountRegexes = [
    /(?:rs\.?|inr|₹|usd)\s*([\d,]+\.?\d*)/i,
    /(?:amount\s+of|vpa|spent)\s+(?:rs\.?|inr|₹)?\s*([\d,]+\.?\d*)/i,
    /debited\s+by\s*([\d,]+\.?\d*)/i,
    /credited\s+with\s*([\d,]+\.?\d*)/i
  ];

  let amount = 0;
  for (const regex of amountRegexes) {
    const match = body.match(regex);
    if (match && match[1]) {
      const parsed = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed;
        break;
      }
    }
  }

  if (amount === 0) return null; // Amount is required

  // 2. Determine Type (Debit / Credit)
  let type: 'DEBIT' | 'CREDIT' = 'DEBIT';
  
  // Strict regex to check for credit/debit with word boundaries to avoid matching things like "subsCRiption"
  const creditRegex = /\b(credited|received|added|deposited|refunded|refund)\b|(?:\bcr\b|\bcredit\b)(?!\s+card|\s+limit)/i;
  
  if (creditRegex.test(lowerBody)) {
    const match = lowerBody.match(creditRegex);
    if (match && match.index !== undefined) {
      const idx = match.index;
      const preText = lowerBody.substring(Math.max(0, idx - 15), idx);
      if (!preText.includes('not ') && !preText.includes('fail') && !preText.includes('unsuccessful')) {
        type = 'CREDIT';
      }
    }
  }

  // 3. Extract Balance (if present)
  let balance: number | undefined;
  const balanceRegexes = [
    /(?:bal|balance|bal\s+is|available\s+bal|avl\s+bal)[:\-\s]*(?:rs\.?|inr|₹)?\s*([\d,]+\.?\d*)/i,
    /(?:available\s+limit|avl\s+limit|avl\s+lmt|limit\s+avail)[:\-\s]*(?:rs\.?|inr|₹)?\s*([\d,]+\.?\d*)/i
  ];
  for (const regex of balanceRegexes) {
    const match = body.match(regex);
    if (match && match[1]) {
      const parsed = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(parsed)) {
        balance = parsed;
        break;
      }
    }
  }

  // 4. Extract Merchant
  let merchant = '';
  
  // Clean duplicate spaces to make parsing uniform
  const normalizedBody = body.replace(/\s+/g, ' ');
  
  // List of prefixes with negative lookaheads to prevent matching amounts
  const prefixes = [
    /transfer(?:red)?\s+to\s+(?!(?:rs\.?|inr|₹)?\s*\d)/i,
    /to\s+pay\s+to\s+(?!(?:rs\.?|inr|₹)?\s*\d)/i,
    /pay\s+to\s+(?!(?:rs\.?|inr|₹)?\s*\d)/i,
    /spent\s+at\s+(?!(?:rs\.?|inr|₹)?\s*\d)/i,
    /sent\s+to\s+(?!(?:rs\.?|inr|₹)?\s*\d)/i,
    /info[:\-\s]+(?!(?:rs\.?|inr|₹)?\s*\d)/i,
    /from\s+(?!(?:rs\.?|inr|₹)?\s*\d)/i,
    /by\s+(?!(?:rs\.?|inr|₹)?\s*\d)/i,
    /for\s+(?!(?:rs\.?|inr|₹)?\s*\d)/i,
    /at\s+(?!(?:rs\.?|inr|₹)?\s*\d)/i,
    /to\s+(?!(?:rs\.?|inr|₹)?\s*\d)/i
  ];
  
  let earliestIdx = Infinity;
  let bestMatch = '';
  
  for (const prefix of prefixes) {
    // Find all matches for this prefix
    const regex = new RegExp(prefix, 'gi');
    let match;
    while ((match = regex.exec(normalizedBody)) !== null) {
      const matchIdx = match.index;
      if (matchIdx >= earliestIdx) continue; // Not earlier than what we already found
      
      const startIdx = matchIdx + match[0].length;
      let candidate = normalizedBody.substring(startIdx).trim();
      
      // Truncate candidate at first occurrence of boundary keywords
      const boundaries = [
        /\s+on\b/i,
        /\s+at\b/i,
        /\s+via\b/i,
        /\s+using\b/i,
        /\s+ref\b/i,
        /\s+rrn\b/i,
        /\s+txn\b/i,
        /\s+upi\b/i,
        /\s+bal\b/i,
        /\s+balance\b/i,
        /\s+avl\b/i,
        /\s+available\b/i,
        /\s+limit\b/i,
        /\s+info\b/i,
        /\s+card\b/i,
        /\s+ending\b/i,
        /\s+a\/c\b/i,
        /\s+acct\b/i,
        /\s+account\b/i,
        /\s+debited\b/i,
        /\s+credited\b/i,
        /\bRs\.?\b/i,
        /\bINR\b/i,
        /₹/i,
        /\s+for\b/i,
        /\.\s+(?:bal|rrn|ref|info|limit|avl|txn|card)/i
      ];
      
      let truncateIdx = candidate.length;
      for (const boundary of boundaries) {
        const bMatch = candidate.match(boundary);
        if (bMatch && bMatch.index !== undefined && bMatch.index < truncateIdx) {
          truncateIdx = bMatch.index;
        }
      }
      
      candidate = candidate.substring(0, truncateIdx).trim();
      
      // Clean up trailing periods or noise
      candidate = candidate.replace(/\.(?!\d)/g, '').trim(); // Remove periods not followed by digit
      
      // Check if candidate is valid (not pure numbers, and not a bank/account name)
      const lowercaseCand = candidate.toLowerCase();
      const knownBanks = Object.values(SENDER_MAP).map(v => v.toLowerCase());
      const paymentApps = ['paytm', 'phonepe', 'gpay', 'bhim', 'amazon pay', 'amzpay'];
      
      const containsBankName = lowercaseCand.includes('bank') && !lowercaseCand.includes('@');
      const genericWords = [
        'txn', 'transaction', 'trf', 'transfer', 'payment', 'pay', 
        'debit', 'credit', 'ref', 'pmt', 'amount', 'rs', 'inr', 'cash', 
        'withdrawal', 'online', 'netbanking', 'banking', 'bank transfer'
      ];
      
      const isBankOrAccount = 
        lowercaseCand.startsWith('a/c') || 
        lowercaseCand.startsWith('acct') || 
        lowercaseCand.startsWith('account') || 
        lowercaseCand.startsWith('card ending') ||
        lowercaseCand === 'bank' ||
        lowercaseCand === 'card' ||
        containsBankName ||
        genericWords.includes(lowercaseCand) ||
        lowercaseCand === cleanSender.toLowerCase() ||
        (knownBanks.includes(lowercaseCand) && !paymentApps.some(app => lowercaseCand.includes(app)));
        
      if (candidate && 
          !/^[0-9\.\s]+$/.test(candidate) && 
          candidate.toLowerCase() !== 'vpa' &&
          candidate.length > 2 &&
          !isBankOrAccount) {
        earliestIdx = matchIdx;
        bestMatch = candidate;
      }
    }
  }
  
  merchant = bestMatch;

  // 5. Extract UPI ID
  let upiId: string | undefined;
  const upiRegex = /([a-zA-Z0-9\.\-_]+@[a-zA-Z0-9\.\-_]+)/i;
  const upiMatch = body.match(upiRegex);
  if (upiMatch && upiMatch[1]) {
    upiId = upiMatch[1];
  }

  // 6. Extract Ref No
  let refNo: string | undefined;
  
  // 12-digit UPI RRN detection: almost all Indian bank SMS messages have a 12-digit continuous number as RRN.
  const rrnMatch = body.match(/\b([0-9]{12})\b/);
  if (rrnMatch) {
    refNo = rrnMatch[1];
  } else {
    const refRegexes = [
      /(?:ref|ref\s+no|ref\s+id|txn|txn\s+id|upi\s+ref|rrn)[:\-\s]*([0-9]{8,16})/i,
      /rrn\s+([0-9]{8,16})/i
    ];
    for (const regex of refRegexes) {
      const match = body.match(regex);
      if (match && match[1]) {
        refNo = match[1];
        break;
      }
    }
  }

  // 7. Sender fallback & Cleaning
  if (!merchant || merchant.toLowerCase() === 'unknown' || merchant.toLowerCase() === 'unknown merchant') {
    if (cleanSender && cleanSender !== 'UNKNOWN' && cleanSender !== 'BANK') {
      merchant = cleanSender;
    } else {
      // Category fallback
      merchant = 'Bank Transaction';
    }
  }

  // Formatting cleanup
  merchant = merchant
    .replace(/[\*\_]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  // Clean trailing punctuation
  merchant = merchant.replace(/[\.\,\-\:]+$/, '');

  // Capitalize words beautifully
  merchant = merchant.split(' ').map(w => {
    if (w.toLowerCase() === 'upi' || w.toLowerCase() === 'emi' || w.toLowerCase() === 'sip') {
      return w.toUpperCase();
    }
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');

  // 8. Confidence score
  let confidence: 'High' | 'Medium' | 'Low' = 'Low';
  let scoring = 0;
  if (amount > 0) scoring += 30;
  if (merchant && merchant !== 'Bank Transaction' && merchant !== cleanSender) scoring += 30;
  if (refNo) scoring += 20;
  if (balance !== undefined) scoring += 20;

  if (scoring >= 80) confidence = 'High';
  else if (scoring >= 50) confidence = 'Medium';

  return {
    amount,
    merchant,
    type,
    balance,
    dateTime: Date.now(),
    upiId,
    refNo,
    confidence,
    bankName: cleanSender || 'Unknown Bank'
  };
}
