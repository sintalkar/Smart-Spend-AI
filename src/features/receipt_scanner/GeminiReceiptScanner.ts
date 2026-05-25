
import { auth } from '../../firebase';

export interface ReceiptItem {
  id?: string;
  name: string;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  category: string | null;
  selected?: boolean;
}

export interface ReceiptData {
  merchant_name: string | null;
  date: string | null;
  items: ReceiptItem[];
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  total: number | null;
  payment_method: string | null;
  currency: string | null;
  confidence: 'High' | 'Medium' | 'Low';
}

export class GeminiReceiptScanner {
  private async handleResponse(response: Response, errorMessage: string) {
    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch (e) { /* ignore */ }

      if (response.status === 403 && errorData.code === 'MISSING_API_KEY') {
        throw new Error("API_KEY_MISSING");
      }
      
      console.warn(`${errorMessage}:`, response.status, errorData);
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  public async scanReceipt(base64Image: string, mimeType: string, isBankStatement = false): Promise<ReceiptData | null> {
    try {
      const response = await fetch('/api/gemini/parse-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: base64Image, 
          mimeType,
          userId: auth.currentUser?.uid,
          isBankStatement
        })
      });

      const parsedData = await this.handleResponse(response, "Receipt Scanning Error");
      
      // Give items unique IDs for UI selection state
      if (parsedData.items) {
        parsedData.items = parsedData.items.map((item: any, index: number) => ({
          ...item,
          id: `item-${index}`,
          selected: true
        }));
      }
      
      return parsedData as ReceiptData;
    } catch (e: any) {
      if (e.message === "API_KEY_MISSING") {
        throw e; // Let UI handle missing key specifically
      }
      console.warn("Receipt Scanning Error", e);
      return null;
    }
  }
}

export const receiptScannerService = new GeminiReceiptScanner();

