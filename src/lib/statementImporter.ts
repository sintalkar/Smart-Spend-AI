import { db } from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { TransactionType } from '../db/models';

export interface ParsedStatementTransaction {
  date: string; // YYYY-MM-DD
  amount: number;
  merchant: string;
  type: 'DEBIT' | 'CREDIT';
  balance?: number;
}

export class StatementImporter {
  static async convertFileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  }

  static async parseStatement(file: File, userId: string): Promise<ParsedStatementTransaction[]> {
    try {
      const base64Data = await this.convertFileToBase64(file);
      
      const response = await fetch('/api/gemini/parse-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Data,
          mimeType: file.type,
          userId,
          isBankStatement: true
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to parse statement PDF/image');
      }

      const result = await response.json();
      return result.transactions || [];
    } catch (e: any) {
      console.error('[StatementImporter] Error parsing statement:', e);
      throw e;
    }
  }

  static async importTransactions(transactions: ParsedStatementTransaction[], categoryMapping: Record<string, string>): Promise<number> {
    let importedCount = 0;
    const now = Date.now();

    for (const tx of transactions) {
      const id = uuidv4();
      const txDate = tx.date ? new Date(tx.date).getTime() : now;
      const cleanMerchant = tx.merchant.trim();
      const mappedCategory = categoryMapping[cleanMerchant] || 'groceries'; // default category

      await db.transactions.add({
        id,
        amount: tx.amount,
        type: tx.type === 'DEBIT' ? TransactionType.DEBIT : TransactionType.CREDIT,
        categoryId: mappedCategory,
        merchantName: cleanMerchant,
        note: `Imported from bank statement`,
        tags: ['bank-statement-import'],
        dateTime: txDate,
        source: 'STATEMENT',
        isConfirmed: 1,
        isRecurring: 0,
        currency: 'INR',
        createdAt: now,
        updatedAt: now,
        isDeleted: 0
      });
      importedCount++;
    }

    return importedCount;
  }
}
