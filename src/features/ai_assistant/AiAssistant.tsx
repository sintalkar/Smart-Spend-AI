import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Bot, Paperclip } from 'lucide-react';
import clsx from 'clsx';
import { hapticFeedback } from '../../core/utils/haptics';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';

export function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: 'Namaste! I am your Smart Spend Personal CA. Let me review your books. How can I help you optimize your budget, savings, or investments today? You can also upload bank statements, credit card PDFs, or receipt photos for a comprehensive analysis!' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ base64: string, name: string, mimeType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const transactions = useLiveQuery(() => db.transactions.where('isDeleted').equals(0).toArray()) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];

  const financialContext = useMemo(() => {
    const now = new Date();
    const currentMonthTx = transactions.filter(t => {
      try {
        const d = new Date(t.dateTime);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } catch (e) {
        return false;
      }
    });

    const debits = currentMonthTx.filter(t => t.type === 'DEBIT');
    const credits = currentMonthTx.filter(t => t.type === 'CREDIT');

    const totalSpent = debits.reduce((acc, t) => acc + t.amount, 0);
    const estimatedIncome = credits.reduce((acc, t) => acc + t.amount, 0) || Number(localStorage.getItem('initial_balance') || 0);

    const globalBudget = budgets.find(b => b.categoryId === 'global');
    const budgetLimit = globalBudget?.amount || 0;
    const budgetUsed = budgetLimit > 0 ? ((totalSpent / budgetLimit) * 100).toFixed(1) : "0";

    const expensesList = debits.map(t => `- ${t.note || 'Expense'}: ₹${t.amount} — ${t.categoryId}`).join('\n');

    return `
=== CURRENT LIVE CA CONTEXT ===
Income: ₹${estimatedIncome}/month
Risk Profile: balanced
Budget used: ${budgetUsed}%
Expenses this month:
${expensesList || 'No expenses logged this month.'}
Total spent: ₹${totalSpent}
Global Budget Limit: ₹${budgetLimit}
===============================`;
  }, [transactions, budgets]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedFile({
        base64: reader.result as string,
        name: file.name,
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
    hapticFeedback.light();
  };

  const sendMessage = async () => {
    if (!input.trim() && !attachedFile) return;
    
    const userMessage = input;
    const fileToSend = attachedFile;
    
    setInput('');
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    const displayMessage = userMessage + (fileToSend ? `\n📎 [Attached Bill/Document: ${fileToSend.name}]` : '');
    setMessages(prev => [...prev, { role: 'user', text: displayMessage }]);
    setIsTyping(true);
    hapticFeedback.light();

    const fullMessage = `${userMessage || 'Analyze this uploaded bill.'}\n\n${financialContext}`;

    try {
      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: fullMessage,
          file: fileToSend?.base64,
          mimeType: fileToSend?.mimeType
        })
      });
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'ai', text: data.text }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: "Sorry, I'm having trouble connecting." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-lg z-40 transition-all hover:scale-105"
      >
        <Bot size={24} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-4 z-50 bg-surface rounded-3xl flex flex-col border border-white/10 shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2"><Bot size={20} className="text-primary" /> CA Assistant</h3>
              <button onClick={() => setIsOpen(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={clsx("p-3 rounded-2xl max-w-[80%] whitespace-pre-wrap", m.role === 'user' ? 'bg-primary text-white ml-auto' : 'bg-gray-800 text-gray-200')}>
                  {m.text}
                </div>
              ))}
              {isTyping && <div className="p-3 bg-gray-800 text-gray-400 rounded-2xl">CA is analyzing your statement/bill...</div>}
            </div>

            {attachedFile && (
              <div className="px-4 py-2 bg-black/40 border-t border-white/10 flex items-center justify-between text-xs text-primary">
                <span className="truncate flex items-center gap-1.5 font-bold">
                  <Paperclip size={12} />
                  {attachedFile.name}
                </span>
                <button onClick={() => setAttachedFile(null)} className="text-gray-400 hover:text-white p-1">
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="p-4 border-t border-white/10 flex gap-2">
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,application/pdf"
                className="hidden"
                id="ca-file-input"
              />
              <label 
                htmlFor="ca-file-input"
                className="bg-white/5 hover:bg-white/10 active:scale-95 transition-all p-3 rounded-xl cursor-pointer flex items-center justify-center border border-white/10 text-gray-400 hover:text-white"
              >
                <Paperclip size={20} />
              </label>

              <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && sendMessage()}
                className="flex-1 bg-background border border-white/10 rounded-xl p-3 text-white"
                placeholder={attachedFile ? "Ask to scan, analyze or report..." : "Ask me anything..."}
              />
              <button onClick={sendMessage} className="bg-primary p-3 rounded-xl hover:scale-105 active:scale-95 transition-transform"><Send size={20} className="text-white" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
