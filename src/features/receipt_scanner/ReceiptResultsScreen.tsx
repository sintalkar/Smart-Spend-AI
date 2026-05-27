import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Edit2, Tag, Check, Calendar, Activity, RefreshCw, Plus, Trash2, Sparkles, FileText } from 'lucide-react';
import clsx from 'clsx';
import { ReceiptData, ReceiptItem } from './GeminiReceiptScanner';
import { transactionRepo } from '../../db/repositories/TransactionRepository';
import { v4 as uuidv4 } from 'uuid';
import { TransactionType } from '../../db/models';
import { checkAndNotifyHighSpending } from '../../core/utils/notifications';
import { extractItemsFromReceipt, suggestCategory } from './receiptParserUtils';

interface ReceiptResultsProps {
  receipt: ReceiptData;
  onClose: () => void;
  onRetake: () => void;
}

const CATEGORIES = [
  { id: 'food_dining', label: 'Food & Dining', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  { id: 'groceries', label: 'Groceries', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  { id: 'shopping', label: 'Shopping', color: 'text-purple-400', bg: 'bg-purple-400/10' },
  { id: 'healthcare', label: 'Healthcare', color: 'text-red-400', bg: 'bg-red-400/10' },
  { id: 'entertainment', label: 'Entertainment', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { id: 'transportation', label: 'Transport', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  { id: 'bills_utilities', label: 'Bills & Utilities', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { id: 'other', label: 'Other', color: 'text-gray-400', bg: 'bg-gray-400/10' },
];

export function ReceiptResultsScreen({ receipt: initialReceipt, onClose, onRetake }: ReceiptResultsProps) {
  const [receipt, setReceipt] = useState<ReceiptData>(initialReceipt);
  const [splitMode, setSplitMode] = useState<boolean>(true); // Default to Split by Item for premium itemized control
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [rawText, setRawText] = useState(initialReceipt.raw_text_extracted || '');
  const [showRawTextPanel, setShowRawTextPanel] = useState(false);

  const toggleItem = (id: string | undefined) => {
    if (!id) return;
    setReceipt(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === id ? { ...i, selected: !i.selected } : i)
    }));
  };

  const getSelectedTotal = () => {
    return receipt.items.filter(i => i.selected).reduce((acc, i) => acc + (i.total_price || 0), 0);
  };

  const selectedCount = receipt.items.filter(i => i.selected).length;

  const handleItemChange = (id: string | undefined, field: keyof ReceiptItem, value: any) => {
    if (!id) return;
    setReceipt(prev => {
      const updatedItems = prev.items.map(i => {
        if (i.id === id) {
          const updated = { ...i, [field]: value };
          // If name changes, auto-suggest a fresh category
          if (field === 'name') {
            updated.category = suggestCategory(value, prev.merchant_name || '');
          }
          // If unit_price or quantity changes, sync total_price
          if (field === 'total_price') {
            updated.unit_price = Number(value);
            updated.total_price = Number(value);
          }
          if (field === 'unit_price') {
            updated.unit_price = Number(value);
            updated.total_price = Number(value) * (updated.quantity || 1);
          }
          if (field === 'quantity') {
            updated.quantity = Number(value);
            updated.total_price = (updated.unit_price || 0) * Number(value);
          }
          return updated;
        }
        return i;
      });
      return { ...prev, items: updatedItems };
    });
  };

  const handleAddItem = () => {
    const newItem: ReceiptItem = {
      id: `manual-item-${Date.now()}`,
      name: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      category: 'other',
      selected: true
    };
    setReceipt(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const handleDeleteItem = (id: string | undefined) => {
    if (!id) return;
    setReceipt(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== id)
    }));
  };

  const handleExtractFromRawText = () => {
    if (!rawText.trim()) return;
    const extracted = extractItemsFromReceipt(rawText, receipt.merchant_name || '');
    setReceipt(prev => ({
      ...prev,
      items: extracted
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { db } = await import('../../db/database');
      const selectedItems = receipt.items.filter(i => i.selected);
      const timestamp = receipt.date ? new Date(receipt.date).getTime() : Date.now();
      
      if (splitMode) {
        // Save each item as a separate transaction
        const newTxs = selectedItems.map(item => ({
          id: uuidv4(),
          amount: item.total_price || 0,
          type: TransactionType.DEBIT,
          categoryId: item.category || 'other',
          merchantName: receipt.merchant_name || 'Unknown Merchant',
          note: item.name || 'Receipt Item', // The specific item becomes the note
          tags: ['receipt'],
          dateTime: timestamp,
          source: 'ReceiptScanner',
          isConfirmed: 1,
          isRecurring: 0,
          currency: receipt.currency || 'INR',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDeleted: 0,
        }));
        await db.transactions.bulkAdd(newTxs);
        
        // Trigger high spending check on categories
        const uniqueCategories = Array.from(new Set(selectedItems.map(i => i.category || 'other')));
        for (const cat of uniqueCategories) {
          checkAndNotifyHighSpending(cat);
        }
      } else {
        // Save as one bulk transaction
        const total = selectedItems.length === receipt.items.length && receipt.total 
          ? receipt.total 
          : getSelectedTotal();
        
        const mainCategory = selectedItems.length > 0 ? (selectedItems[0].category || 'other') : 'other';
          
        await db.transactions.add({
          id: uuidv4(),
          amount: total,
          type: TransactionType.DEBIT,
          categoryId: mainCategory, // Simplify category
          merchantName: receipt.merchant_name || 'Unknown Merchant',
          note: `Receipt: ${selectedItems.map(i => i.name || 'Unnamed').join(', ')}`,
          tags: ['receipt'],
          dateTime: timestamp,
          source: 'ReceiptScanner',
          isConfirmed: 1,
          isRecurring: 0,
          currency: receipt.currency || 'INR',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDeleted: 0,
        });

        checkAndNotifyHighSpending(mainCategory);
      }

      // Fire advisor change events so AI re-runs suggestions instantly
      window.dispatchEvent(new CustomEvent('advisor_settings_changed'));

      setSaving(false);
      setSuccess(true);
      
      // Hold success for a moment
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error("Failed to save receipt transactions", err);
      setSaving(false);
      alert("Failed to save transaction data. Please try again.");
    }
  };

  if (success) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background p-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="w-24 h-24 bg-success/20 rounded-full flex items-center justify-center text-success mb-6 shadow-[0_12px_36px_rgba(16,185,129,0.3)] animate-pulse"
        >
          <Check size={48} strokeWidth={3} />
        </motion.div>
        <h2 className="title-bold text-3xl mb-2 text-white text-center">Receipt Logged!</h2>
        <p className="text-gray-400 text-center text-sm max-w-xs leading-relaxed">
          {splitMode ? `Added ${selectedCount} individual expenses.` : 'Added as a single combined transaction.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background pt-safe">
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-surface/90 backdrop-blur-xl z-10 shadow-md">
        <button onClick={onRetake} className="text-gray-400 p-2 -ml-2 rounded-full hover:bg-white/5 transition active:scale-95">
          <ChevronLeft size={24} />
        </button>
        <div className="text-center">
          <h2 className="title-bold text-lg text-white">Extracted Receipt Spends</h2>
          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Review &amp; Edit Items</p>
        </div>
        <div className={clsx(
          "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider shadow-sm",
          receipt.confidence === 'High' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : 
          receipt.confidence === 'Medium' ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/20" : 
          "bg-red-500/20 text-red-400 border border-red-500/20"
        )}>
          <Activity size={12} />
          {receipt.confidence} Confidence
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto pb-40 no-scrollbar">
        {/* Summary Card */}
        <div className="bg-surface/40 border-b border-white/5 px-6 py-6 backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-widest font-black block mb-1">
                Merchant / Store
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  value={receipt.merchant_name || ''} 
                  onChange={e => setReceipt({...receipt, merchant_name: e.target.value})}
                  className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none w-full focus:border-primary/50"
                  placeholder="e.g. Swiggy, DMart"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-widest font-black block mb-1">
                Purchase Date
              </label>
              <input 
                type="date" 
                value={receipt.date || ''} 
                onChange={e => setReceipt({...receipt, date: e.target.value})}
                className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold text-white outline-none w-full focus:border-primary/50"
              />
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
            <div className="text-left">
              <label className="text-[10px] text-white/40 uppercase tracking-widest font-black block mb-0.5">Calculated Items Total</label>
              <div className="text-xl font-mono text-white/60 font-bold">
                ₹{getSelectedTotal().toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <label className="text-[10px] text-white/40 uppercase tracking-widest font-black block mb-0.5">Scanned Bill Total</label>
              <div className="text-2xl font-mono text-white font-black tracking-tight flex items-center gap-1.5">
                <span className="text-xs text-white/40">₹</span>
                <input 
                  type="number" 
                  value={receipt.total || 0} 
                  onChange={e => setReceipt({...receipt, total: parseFloat(e.target.value) || 0})}
                  className="bg-transparent text-right outline-none w-28 font-mono font-black text-white focus:border-b focus:border-primary/50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* OCR Raw Text Toggle panel */}
        <div className="px-6 mt-4">
          <button 
            type="button"
            onClick={() => setShowRawTextPanel(!showRawTextPanel)}
            className="w-full rounded-2xl bg-white/5 border border-white/5 px-4 py-3 flex items-center justify-between text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 transition"
          >
            <span className="flex items-center gap-2">
              <FileText size={14} className="text-primary" />
              {showRawTextPanel ? 'Hide Raw Receipt OCR Text' : 'View Raw Receipt OCR Text (Fallback)'}
            </span>
            <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">Heuristics</span>
          </button>

          <AnimatePresence>
            {showRawTextPanel && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-2"
              >
                <div className="bg-black/50 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
                  <textarea
                    rows={6}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Messy OCR text will appear here. You can manually edit this text and press 'Run Robust Extractor' to re-extract items."
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs font-mono text-white outline-none focus:border-primary/50 resize-none leading-relaxed"
                  />
                  <button
                    type="button"
                    onClick={handleExtractFromRawText}
                    className="bg-primary/20 border border-primary/30 text-primary px-4 py-2 rounded-xl text-xs font-bold transition hover:bg-primary hover:text-white flex items-center justify-center gap-2"
                  >
                    <Sparkles size={12} />
                    Run Robust OCR Extractor
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Itemized Scanned Items list */}
        <div className="px-6 py-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-md font-black text-white uppercase tracking-wider">Itemized Breakdown</h3>
              <span className="text-[10px] bg-primary/10 text-primary font-bold px-2.5 py-0.5 rounded-full">
                {receipt.items.length} items
              </span>
            </div>
            <button
              onClick={handleAddItem}
              className="bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-xl text-xs font-black transition hover:scale-105 active:scale-95 flex items-center gap-1"
            >
              <Plus size={14} /> Add Row
            </button>
          </div>
          
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {receipt.items.map((item, index) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className={clsx(
                    "p-4 rounded-2xl border transition-all duration-300 relative",
                    item.selected 
                      ? "bg-surface border-white/10 shadow-[0_12px_28px_rgba(0,0,0,0.2)]" 
                      : "bg-black/10 border-white/5 opacity-60"
                  )}
                >
                  <div className="flex gap-3 items-center mb-3">
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className={clsx(
                        "w-5 h-5 rounded flex-shrink-0 flex items-center justify-center transition-all duration-300 border",
                        item.selected 
                          ? "bg-primary border-primary text-white scale-100" 
                          : "border-white/20 hover:border-white/50 scale-95"
                      )}
                    >
                      {item.selected && <Check size={12} strokeWidth={4}/>}
                    </button>

                    <input
                      type="text"
                      value={item.name}
                      onChange={e => handleItemChange(item.id, 'name', e.target.value)}
                      placeholder="Item Name (e.g. Tomato Soup)"
                      className="bg-transparent text-sm font-bold text-white border-b border-transparent focus:border-white/20 outline-none flex-1 py-0.5 transition"
                    />

                    <button 
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-white/30 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition active:scale-95"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[9px] text-white/30 uppercase tracking-widest font-black block mb-1">Price (₹)</label>
                      <input
                        type="number"
                        value={item.total_price || ''}
                        onChange={e => handleItemChange(item.id, 'total_price', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="bg-black/40 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white outline-none w-full focus:border-primary/50"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] text-white/30 uppercase tracking-widest font-black block mb-1">Qty</label>
                      <input
                        type="number"
                        value={item.quantity || 1}
                        onChange={e => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 1)}
                        placeholder="1"
                        className="bg-black/40 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white outline-none w-full focus:border-primary/50"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] text-white/30 uppercase tracking-widest font-black block mb-1">Category</label>
                      <select
                        value={item.category || 'other'}
                        onChange={e => handleItemChange(item.id, 'category', e.target.value)}
                        className="bg-black/40 border border-white/5 rounded-xl px-2 py-1.5 text-xs font-bold text-white outline-none w-full focus:border-primary/50"
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat.id} value={cat.id} className="bg-surface text-white">
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {receipt.items.length === 0 && (
              <div className="text-center py-8 bg-black/20 border border-dashed border-white/10 rounded-2xl p-6">
                <p className="text-sm text-white/40 mb-2">No individual items detected on this receipt.</p>
                <p className="text-xs text-white/20 mb-4">Click "View Raw Receipt OCR Text" above to paste and extract using our intelligent robust parser.</p>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="bg-primary/20 border border-primary/30 text-primary px-4 py-2 rounded-xl text-xs font-bold transition hover:bg-primary hover:text-white"
                >
                  Create Manual Item Row
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Bottom Actions Fixed */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-surface/90 backdrop-blur-xl border-t border-white/5 pb-safe z-20 shadow-[0_-12px_40px_rgba(0,0,0,0.5)]">
        <div className="flex bg-black/40 p-1 rounded-xl mb-4 text-xs font-medium border border-white/5">
          <button 
            type="button"
            className={clsx(
              "flex-1 py-2.5 rounded-lg transition-all text-xs font-bold text-center tracking-wide uppercase", 
              !splitMode ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60"
            )}
            onClick={() => setSplitMode(false)}
          >
            Combine Single Bill
          </button>
          <button 
            type="button"
            className={clsx(
              "flex-1 py-2.5 rounded-lg transition-all text-xs font-bold text-center tracking-wide uppercase", 
              splitMode ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60"
            )}
            onClick={() => setSplitMode(true)}
          >
            Split by Item List
          </button>
        </div>
         
        <button 
          onClick={handleSave}
          disabled={selectedCount === 0 || saving}
          className="w-full bg-primary disabled:opacity-50 disabled:active:scale-100 text-white font-bold text-lg p-4 rounded-xl shadow-lg hover:opacity-90 active:scale-95 transition-all flex justify-center items-center gap-2"
        >
          {saving ? <RefreshCw className="animate-spin" size={20} /> : null}
          {saving ? 'Processing...' : `Confirm & Save ${selectedCount} ${selectedCount === 1 ? 'Item' : 'Items'}`}
        </button>
      </div>
    </div>
  );
}
