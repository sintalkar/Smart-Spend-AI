export interface ReceiptItem {
  id?: string;
  name: string;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  category: string | null;
  selected?: boolean;
}

/**
 * Automatically suggests a category based on item name and/or merchant name keywords
 */
export function suggestCategory(itemName: string, merchantName: string = ''): string {
  const text = `${itemName.toLowerCase()} ${merchantName.toLowerCase()}`;

  // Food & Dining
  if (
    /food|dining|restaurant|cafe|coffee|starbucks|pizza|burger|swiggy|zomato|grill|biryani|paneer|tea|chai|kitchen|bakery|bar|pub|sweet|dhaba|baskin|mcdonald|subway|kfc|domino/.test(text)
  ) {
    return 'food_dining';
  }

  // Groceries
  if (
    /milk|egg|butter|cheese|bread|grocery|groceries|supermarket|dmart|reliance|mart|bigbasket|vegetable|veg|fruit|rice|oil|wheat|dal|flour|soap|shampoo|detergent|toothpaste|spices|salt|sugar/.test(text)
  ) {
    return 'groceries';
  }

  // Shopping
  if (
    /shopping|clothes|shirt|tshirt|jeans|pant|shoes|wear|fashion|mall|amazon|flipkart|zara|h&m|myntra|apparel|electronics|mobile|phone|laptop|gadget|watch|accessory|store|retail|boutique/.test(text)
  ) {
    return 'shopping';
  }

  // Healthcare
  if (
    /pharma|pharmacy|medicine|doctor|hospital|clinic|pill|syrup|dental|health|apollo|medplus|care|diagnostic|lab|medical/.test(text)
  ) {
    return 'healthcare';
  }

  // Entertainment
  if (
    /movie|cinema|pvr|inox|ticket|netflix|prime|spotify|game|gaming|club|concert|theater|fun|amusement|zoo|park|show|stadium/.test(text)
  ) {
    return 'entertainment';
  }

  // Transportation
  if (
    /uber|ola|auto|cab|taxi|metro|train|flight|petrol|diesel|fuel|toll|parking|shell|hpcl|bpcl|garage|mechanic|service|ride/.test(text)
  ) {
    return 'transportation';
  }

  // Bills & Utilities
  if (
    /electricity|power|water|gas|recharge|wifi|broadband|rent|bill|telecom|airtel|jio|bescom|insurance|tax|government/.test(text)
  ) {
    return 'bills_utilities';
  }

  return 'other';
}

/**
 * Robust OCR receipt parser that extracts item name, quantity, unit price, total price and suggests category
 * directly from messy text outputs
 */
export function extractItemsFromReceipt(text: string, merchantName: string = ''): ReceiptItem[] {
  if (!text) return [];

  const items: ReceiptItem[] = [];
  const lines = text.split('\n');
  
  // Regex to match a price (e.g., 99.00, 1,200.50, 45) at the end or middle of a line
  // Catches patterns like: "Item Name   120.00" or "Item Name  x2  240"
  const priceRegex = /(?:rs\.?|inr|₹)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*$/i;
  
  // Exclusion regex to filter out receipt metadata and summary/totals lines
  const exclusionRegex = /total|subtotal|sub-total|tax|cgst|sgst|gst|vat|round\s*off|discount|cash|card|change|balance|visa|mastercard|upi|gpay|phonepe|net\s*amount|amount\s*paid|merchant|date|invoice|receipt|welcome|thank\s*you|visit|phone|tel|cashier|terminal|store|shop/i;

  let idCounter = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.length < 3) continue;

    // Check if the line contains total/metadata keywords
    if (exclusionRegex.test(trimmedLine)) {
      continue;
    }

    // Try to extract price from the end of the line
    const match = trimmedLine.match(priceRegex);
    if (match) {
      const fullPriceText = match[0];
      const priceValStr = match[1].replace(/,/g, '');
      const totalPrice = parseFloat(priceValStr);

      if (isNaN(totalPrice) || totalPrice <= 0) continue;

      // Extract the item name part by removing the price portion from the end
      let namePart = trimmedLine.substring(0, trimmedLine.lastIndexOf(fullPriceText)).trim();

      // Clean up common noise from the name
      // e.g. "1. Milk" -> "Milk", "Item Name  x1" -> "Item Name", "* Item Name" -> "Item Name"
      namePart = namePart.replace(/^[\*\-\+\d\.\s#]+/, ''); // remove leading list markers
      namePart = namePart.replace(/\s+x\s*\d+\s*$/i, ''); // remove trailing quantities like " x2"
      namePart = namePart.replace(/\s+\d+\s*$/, ''); // remove trailing numbers
      namePart = namePart.trim();

      if (namePart.length < 2) continue;

      // Try to parse quantity if written in the line (e.g., "Item Name 2 120.00" or "Item Name @ 60.00")
      let quantity = 1;
      let unitPrice = totalPrice;

      const qtyMatch = trimmedLine.match(/(?:qty|x|\*)\s*(\d+)/i) || trimmedLine.match(/\s+(\d+)\s+@?\s*\d+/);
      if (qtyMatch && qtyMatch[1]) {
        const q = parseInt(qtyMatch[1]);
        if (q > 0) {
          quantity = q;
          unitPrice = parseFloat((totalPrice / quantity).toFixed(2));
        }
      }

      items.push({
        id: `ocr-item-${idCounter++}`,
        name: namePart,
        quantity: quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        category: suggestCategory(namePart, merchantName),
        selected: true
      });
    }
  }

  return items;
}
