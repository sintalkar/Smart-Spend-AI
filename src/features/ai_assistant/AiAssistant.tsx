import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Bot } from 'lucide-react';
import clsx from 'clsx';
import { hapticFeedback } from '../../core/utils/haptics';
import { transactionRepo } from '../../db/repositories/TransactionRepository';

export function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: 'Hi! I am your Smart Spend Assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsTyping(true);
    hapticFeedback.light();

    let context = '';
    if (userMessage.toLowerCase().includes('search') || userMessage.toLowerCase().includes('find') || userMessage.toLowerCase().includes('show')) {
      const results = await transactionRepo.searchQuery(userMessage).toArray();
      if (results.length > 0) {
        context = `\n\nContext - Found transactions: ${JSON.stringify(results.slice(0, 5))}. Use these to answer the user query regarding transactions.`;
      }
    }

    try {
      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage + context })
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
              <h3 className="font-bold text-white flex items-center gap-2"><Bot size={20} className="text-primary" /> Assistant</h3>
              <button onClick={() => setIsOpen(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={clsx("p-3 rounded-2xl max-w-[80%]", m.role === 'user' ? 'bg-primary text-white ml-auto' : 'bg-gray-800 text-gray-200')}>
                  {m.text}
                </div>
              ))}
              {isTyping && <div className="p-3 bg-gray-800 text-gray-400 rounded-2xl">Typing...</div>}
            </div>

            <div className="p-4 border-t border-white/10 flex gap-2">
              <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && sendMessage()}
                className="flex-1 bg-background border border-white/10 rounded-xl p-3 text-white"
                placeholder="Ask me anything..."
              />
              <button onClick={sendMessage} className="bg-primary p-3 rounded-xl"><Send size={20} className="text-white" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
