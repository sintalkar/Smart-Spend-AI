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
  const [attachedFiles, setAttachedFiles] = useState<{ base64: string, name: string, mimeType: string }[]>([]);
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const readPromises = Array.from(files).map(file => {
      return new Promise<{ base64: string, name: string, mimeType: string }>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            base64: reader.result as string,
            name: file.name,
            mimeType: file.type
          });
        };
        reader.readAsDataURL(file);
      });
    });

    const newFiles = await Promise.all(readPromises);
    setAttachedFiles(prev => [...prev, ...newFiles]);
    hapticFeedback.light();
  };

  const sendMessage = async () => {
    if (!input.trim() && attachedFiles.length === 0) return;
    
    const userMessage = input;
    const filesToSend = attachedFiles;
    
    setInput('');
    setAttachedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';

    const displayMessage = userMessage + (filesToSend.length > 0 ? `\n📎 [Attached ${filesToSend.length} Bill(s): ${filesToSend.map(f => f.name).join(', ')}]` : '');
    setMessages(prev => [...prev, { role: 'user', text: displayMessage }]);
    setIsTyping(true);
    hapticFeedback.light();

    const fullMessage = `${userMessage || 'Analyze these uploaded bills.'}\n\n${financialContext}`;
    
    // Lazy import auth to avoid top-level issues if needed, or import at the top
    const { auth } = await import('../../firebase');

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: fullMessage,
          files: filesToSend.map(f => ({ base64: f.base64, mimeType: f.mimeType })),
          userId: auth.currentUser?.uid
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
              {isTyping && <div className="p-3 bg-gray-800 text-gray-400 rounded-2xl">CA is analyzing your statement/bill(s)...</div>}
            </div>

            {attachedFiles.length > 0 && (
              <div className="px-4 py-2 bg-black/40 border-t border-white/10 flex flex-wrap gap-2 text-xs">
                {attachedFiles.map((file, idx) => (
                  <span key={idx} className="bg-primary/20 text-primary border border-primary/30 px-2 py-1 rounded-lg truncate max-w-[200px] flex items-center gap-1.5 font-bold">
                    <Paperclip size={10} />
                    {file.name}
                    <button onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-white p-0.5 ml-1">
                      <X size={12} />
                    </button>
                  </span>
                ))}
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
                multiple
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
                placeholder={attachedFiles.length > 0 ? "Ask to scan, analyze or report..." : "Ask me anything..."}
              />
              <button onClick={sendMessage} className="bg-primary p-3 rounded-xl hover:scale-105 active:scale-95 transition-transform"><Send size={20} className="text-white" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
