export class DataSanitizer {
  public static sanitizeSms(rawText: string): string {
    let sanitized = rawText;
    
    // Mask typical Account/Card numbers (masking digits except last 4 or hiding completely)
    sanitized = sanitized.replace(/(?:a\/c|acct|account).*(?:no|ending).*[xX\*]*([0-9]{3,4})/gi, 'A/C XXXX');
    
    // Mask potential OTPs (4-6 digits with "OTP" nearby)
    sanitized = sanitized.replace(/(?:OTP|code).{0,15}\b(\d{4,6})\b/gi, 'OTP XXXX');

    // Mask Credit/Debit Card numbers
    sanitized = sanitized.replace(/\b(?:4[0-9]{12}(?:[0-9]{3})?|[25][1-7][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})\b/g, 'CARD_XXXX');

    return sanitized;
  }
}
