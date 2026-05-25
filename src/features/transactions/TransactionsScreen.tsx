import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, ShoppingBag, Coffee, Car, Activity, FileText, Download } from 'lucide-react';
import { db } from '../../db';
import { TransactionType } from '../../db/models';
import { hapticFeedback } from '../../core/utils/haptics';
import { TransactionEditModal } from './TransactionEditModal';
import clsx from 'clsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { EmptyState } from '../../core/ui/EmptyState';

const categoryIcons: Record<string, any> = {
  'food_dining': Coffee,
  'transportation': Car,
  'shopping': ShoppingBag,
  'entertainment': Activity,
  'bills_utilities': FileText,
  'salary': Activity,
  'other': Activity
};

const categoryNames: Record<string, string> = {
  'food_dining': 'Food & Dining',
  'transportation': 'Transport',
  'shopping': 'Shopping',
  'entertainment': 'Entertainment',
  'bills_utilities': 'Bills',
  'salary': 'Salary',
  'other': 'Other'
};

const PAGE_SIZE = 20;

export default function TransactionsScreen() {
  const [page, setPage] = useState(1);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);

  const allTransactions = useLiveQuery(
    () => db.transactions.where('isDeleted').equals(0).reverse().sortBy('dateTime')
  ) || [];

  const paginatedTransactions = useMemo(() => {
    return allTransactions.slice(0, page * PAGE_SIZE);
  }, [allTransactions, page]);

  const hasMore = paginatedTransactions.length < allTransactions.length;

  const handleSwipeDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    hapticFeedback.warning();
    try {
      await db.transactions.update(id, { isDeleted: 1 });
      hapticFeedback.success();
    } catch (e) {
      console.error(e);
      hapticFeedback.error();
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString();
    const totalExpense = allTransactions
      .filter(t => t.type === TransactionType.DEBIT)
      .reduce((sum, t) => sum + t.amount, 0);
    const totalIncome = allTransactions
      .filter(t => t.type === TransactionType.CREDIT)
      .reduce((sum, t) => sum + t.amount, 0);
    const savings = totalIncome - totalExpense;

    // App Header
    doc.setFontSize(24);
    doc.setTextColor(108, 99, 255); // Primary color
    doc.text('SmartSpend', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Your Intelligent Financial Companion', 14, 27);
    
    doc.setFontSize(9);
    doc.text(`Generated: ${timestamp}`, 14, 34);
    doc.text(`Total Records: ${allTransactions.length}`, 14, 39);

    // Summary Section
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text('Financial Summary', 14, 50);
    
    // Expenses Box
    doc.setFillColor(245, 245, 255);
    doc.rect(14, 55, 85, 25, 'F');
    doc.setFontSize(10);
    doc.setTextColor(255, 71, 87); // Red for expense
    doc.text('Regular Expenses', 20, 62);
    doc.setFontSize(14);
    doc.text(`Rs. ${totalExpense.toLocaleString()}`, 20, 72);

    // Savings Box
    doc.setFillColor(245, 255, 245);
    doc.rect(109, 55, 85, 25, 'F');
    doc.setFontSize(10);
    doc.setTextColor(46, 213, 115); // Green for savings
    doc.text('Saved Money', 115, 62);
    doc.setFontSize(14);
    doc.text(`Rs. ${(savings > 0 ? savings : 0).toLocaleString()}`, 115, 72);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text('Transaction Details', 14, 90);
    
    const tableData = allTransactions.map(t => [
      new Date(t.dateTime).toLocaleDateString(),
      (categoryNames[t.categoryId] || t.categoryId).toUpperCase(),
      t.note || '-',
      t.source.toUpperCase(),
      t.type === TransactionType.CREDIT ? `+ Rs. ${t.amount.toLocaleString()}` : `- Rs. ${t.amount.toLocaleString()}`
    ]);

    autoTable(doc, {
      head: [['Date', 'Category', 'Note', 'Source', 'Amount']],
      body: tableData,
      startY: 95,
      theme: 'grid',
      headStyles: { 
        fillColor: [108, 99, 255],
        fontSize: 10,
        halign: 'center'
      },
      columnStyles: {
        4: { halign: 'right', fontStyle: 'bold' }
      },
      styles: { fontSize: 9 }
    });

    const fileName = `SmartSpend_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="flex flex-col h-full bg-background pt-safe pb-32 overflow-y-auto no-scrollbar">
      <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-background/40 backdrop-blur-3xl z-30 border-b border-white/5">
        <h2 className="title-bold !mb-0 text-sm uppercase tracking-[0.2em] text-white">History</h2>
        {allTransactions.length > 0 && (
          <button onClick={handleExportPDF} className="w-10 h-10 rounded-xl glass flex items-center justify-center text-gray-400 hover:text-white transition-colors" aria-label="Export to PDF">
            <Download size={16} />
          </button>
        )}
      </header>

      <div className="px-6 py-8 space-y-8">
        {/* Export Report Card */}
        {allTransactions.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-[2.5rem] p-6 flex items-center justify-between border-primary/20 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-3xl rounded-full" />
            <div className="relative z-10">
              <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-2">Export Summary</h3>
              <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest leading-relaxed">Download full intelligent expense<br/>analysis report as PDF</p>
            </div>
            <button 
              onClick={handleExportPDF}
              className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-xl shadow-primary/30 active:scale-95 transition-transform relative z-10 group-hover:scale-110"
            >
              <Download size={24} />
            </button>
          </motion.div>
        )}

        {allTransactions.length === 0 ? (
          <EmptyState 
            title="Empty Vault"
            description="No transactions detected yet. Start by adding one manually."
          />
        ) : (
          <div className="space-y-4">
             <AnimatePresence>
               {paginatedTransactions.map((tx) => {
                 const Icon = categoryIcons[tx.categoryId] || Activity;
                 const isCredit = tx.type === TransactionType.CREDIT;
                 return (
                   <motion.div
                     key={tx.id}
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, x: -100 }}
                     className="relative glass-card rounded-3xl overflow-hidden border-white/5"
                     onTouchStart={() => setSwipedId(tx.id)}
                   >
                     {/* Swipe background action */}
                     <div className="absolute right-0 top-0 bottom-0 w-24 bg-error flex items-center justify-end px-6 cursor-pointer" onClick={(e) => handleSwipeDelete(tx.id, e)}>
                       <Trash2 size={20} className="text-white" />
                     </div>
                     
                     <motion.div 
                       drag="x"
                       dragConstraints={{ left: -80, right: 0 }}
                       dragElastic={0.1}
                       className="relative glass p-5 flex items-center gap-5 z-10"
                     >
                       <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center shrink-0">
                         <Icon size={24} className="text-primary" />
                       </div>
                       <div className="flex-1 min-w-0">
                         <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-1">{categoryNames[tx.categoryId] || tx.categoryId}</p>
                         <p className="text-sm text-white font-bold tracking-tight truncate">{tx.note || tx.merchantName || 'Untitled entry'}</p>
                       </div>
                       <div className="text-right shrink-0">
                         <p className={clsx("text-lg font-display font-black tracking-tighter", isCredit ? "text-success" : "text-white")}>
                           {isCredit ? '+' : '-'}₹{tx.amount.toLocaleString()}
                         </p>
                         <p className="text-[9px] text-white/30 uppercase font-black tracking-[0.2em]">{tx.source}</p>
                       </div>
                     </motion.div>
                   </motion.div>
                 );
               })}
             </AnimatePresence>
             
             {hasMore && (
               <button 
                 onClick={() => setPage(p => p + 1)}
                 className="w-full py-6 text-[10px] font-black uppercase tracking-[0.2em] text-primary glass-button rounded-3xl mt-4"
               >
                 View More History
               </button>
             )}
          </div>
        )}
      </div>

      {selectedTransaction && (
        <TransactionEditModal 
          transaction={selectedTransaction} 
          onClose={() => setSelectedTransaction(null)} 
        />
      )}
    </div>
  );
}
