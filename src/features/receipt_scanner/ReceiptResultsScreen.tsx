import { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Edit2, Tag, Check, Calendar, Activity, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { ReceiptData, ReceiptItem } from './GeminiReceiptScanner';
import { transactionRepo } from '../../db/repositories/TransactionRepository';
import { v4 as uuidv4 } from 'uuid';
import { TransactionType } from '../../db/models';

interface ReceiptResultsProps {
  receipt: ReceiptData;
  onClose: () => void;
  onRetake: () => void;
}

export function ReceiptResultsScreen({ receipt: initialReceipt, onClose, onRetake }: ReceiptResultsProps) {
  const [receipt, setReceipt] = useState<ReceiptData>(initialReceipt);
  const [splitMode, setSplitMode] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

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
          merchantName: receipt.merchant_name || 'Unknown',
          note: item.name, // The specific item becomes the note
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
      } else {
        // Save as one bulk transaction
        const total = selectedItems.length === receipt.items.length && receipt.total 
          ? receipt.total 
          : getSelectedTotal();
          
        await db.transactions.add({
          id: uuidv4(),
          amount: total,
          type: TransactionType.DEBIT,
          categoryId: selectedItems.length > 0 ? (selectedItems[0].category || 'other') : 'other', // Simplify category
          merchantName: receipt.merchant_name || 'Unknown',
          note: `Receipt: ${selectedItems.map(i => i.name).join(', ')}`,
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
      }

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
           className="w-24 h-24 bg-success/20 rounded-full flex items-center justify-center text-success mb-6"
        >
          <Check size={48} strokeWidth={3} />
        </motion.div>
        <h2 className="title-bold text-3xl mb-2 text-white text-center">Receipt Saved!</h2>
        <p className="text-gray-400 text-center">
          {splitMode ? `Added ${selectedCount} individual expenses.` : 'Added as a single transaction.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background pt-safe">
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/5 relative bg-surface z-10 shadow-lg">
        <button onClick={onRetake} className="text-gray-400 p-2 -ml-2 rounded-full hover:bg-white/5">
          <ChevronLeft size={24} />
        </button>
        <h2 className="title-bold text-lg">Verification</h2>
        <div className={clsx(
          "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider",
          receipt.confidence === 'High' ? "bg-success/20 text-success" : 
          receipt.confidence === 'Medium' ? "bg-yellow-500/20 text-yellow-500" : 
          "bg-error/20 text-error"
        )}>
           <Activity size={12} />
           {receipt.confidence}
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto pb-32 no-scrollbar">
         {/* Summary Hero */}
         <div className="bg-surface border-b border-white/5 px-6 py-8">
            <div className="flex justify-between items-start mb-4">
               <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest font-semibold block mb-1 flex items-center gap-1.5">
                    Merchant <Edit2 size={10} className="ml-1 opacity-50"/>
                  </label>
                  <input 
                    type="text" 
                    value={receipt.merchant_name || ''} 
                    onChange={e => setReceipt({...receipt, merchant_name: e.target.value})}
                    className="bg-transparent text-2xl font-bold text-white outline-none w-full"
                    placeholder="Unknown Merchant"
                  />
               </div>
            </div>
            
            <div className="flex justify-between items-end border-t border-white/10 pt-4">
              <div>
                 <label className="text-xs text-gray-500 uppercase tracking-widest font-semibold block mb-1 flex items-center gap-1.5">
                   <Calendar size={12} /> Date
                 </label>
                 <input 
                   type="date" 
                   value={receipt.date || ''} 
                   onChange={e => setReceipt({...receipt, date: e.target.value})}
                   className="bg-transparent text-sm font-medium text-gray-300 outline-none block"
                 />
              </div>
              <div className="text-right">
                <label className="text-xs text-gray-500 uppercase tracking-widest font-semibold block mb-1">Receipt Total</label>
                <div className="text-3xl font-mono text-white font-bold tracking-tight">
                  <span className="text-gray-500 text-xl mr-1">{receipt.currency || '₹'}</span>
                  {receipt.total?.toFixed(2) || '0.00'}
                </div>
              </div>
            </div>
         </div>

         {/* Line Items */}
         <div className="px-6 py-6">
            <div className="flex justify-between items-end mb-4">
              <h3 className="text-lg title-bold text-gray-200">Scanned Items ({receipt.items.length})</h3>
              <p className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded">Selected: ₹{getSelectedTotal().toFixed(2)}</p>
            </div>
            
            <div className="space-y-3">
              {receipt.items.map((item, index) => (
                 <motion.div 
                   key={item.id}
                   initial={{ x: 20, opacity: 0 }}
                   animate={{ x: 0, opacity: 1 }}
                   transition={{ delay: index * 0.05 }}
                   onClick={() => toggleItem(item.id)}
                   className={clsx(
                     "p-4 rounded-2xl border transition-colors cursor-pointer flex gap-4 items-start",
                     item.selected ? "bg-surface border-primary/30" : "bg-black/20 border-white/5 opacity-60"
                   )}
                 >
                   <div className={clsx(
                     "w-5 h-5 rounded flex-shrink-0 mt-1 flex items-center justify-center transition-colors",
                     item.selected ? "bg-primary text-white" : "border-2 border-white/20"
                   )}>
                     {item.selected && <Check size={14} strokeWidth={3}/>}
                   </div>
                   
                   <div className="flex-1">
                     <p className="font-semibold text-white text-sm mb-1 line-clamp-2">{item.name}</p>
                     <div className="flex gap-2">
                       <span className="text-[10px] text-gray-400 bg-black/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Tag size={10} /> {item.category?.replace('_', ' ') || 'other'}
                       </span>
                       {item.quantity && item.quantity > 1 && (
                         <span className="text-[10px] text-gray-400 bg-black/40 px-2 py-0.5 rounded-full">
                            Qty: {item.quantity}
                         </span>
                       )}
                     </div>
                   </div>
                   
                   <div className="text-right">
                     <p className="font-mono font-medium text-white">₹{item.total_price?.toFixed(2)}</p>
                     {item.unit_price && item.quantity && item.quantity > 1 && (
                        <p className="font-mono text-[10px] text-gray-500 mt-1">₹{item.unit_price} ea</p>
                     )}
                   </div>
                 </motion.div>
              ))}
            </div>
         </div>
      </div>
      
      {/* Bottom Actions Fixed */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-surface/90 backdrop-blur-xl border-t border-white/5 pb-safe z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
         <div className="flex bg-black/40 p-1 rounded-xl mb-4 text-sm font-medium">
            <button 
              className={clsx("flex-1 py-2.5 rounded-lg transition-colors text-center", !splitMode ? "bg-white/10 text-white shadow-sm" : "text-gray-500")}
              onClick={() => setSplitMode(false)}
            >
              Single Entry
            </button>
            <button 
              className={clsx("flex-1 py-2.5 rounded-lg transition-colors text-center", splitMode ? "bg-white/10 text-white shadow-sm" : "text-gray-500")}
              onClick={() => setSplitMode(true)}
            >
              Split by Item
            </button>
         </div>
         
         <button 
           onClick={handleSave}
           disabled={selectedCount === 0 || saving}
           className="w-full bg-primary disabled:opacity-50 disabled:active:scale-100 text-white font-bold text-lg p-4 rounded-xl shadow-lg hover:opacity-90 active:scale-95 transition-all flex justify-center items-center gap-2"
         >
           {saving ? <RefreshCw className="animate-spin" size={20} /> : null}
           {saving ? 'Saving...' : `Add ${selectedCount} ${selectedCount === 1 ? 'Item' : 'Items'}`}
         </button>
      </div>
    </div>
  );
}
