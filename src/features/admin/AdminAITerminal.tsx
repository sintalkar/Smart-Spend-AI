import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Send, ChevronRight, Activity, Shield, Sparkles } from 'lucide-react';
import Markdown from 'react-markdown';

interface Message {
  role: 'user' | 'admin';
  content: string;
  timestamp: number;
}

export default function AdminAITerminal() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'admin',
      content: `**Smart Spend Admin Panel**
Status: ✅ Online | Version: 1.2

**Action Taken:** Initializing System

**Current Status:**
• Smart Insights: Enabled
• Maintenance Mode: Off
• Active Users: 124

**Response:**
Welcome, Administrator. I am the Smart Spend Admin AI. I have complete control over the application's core systems and feature toggles. How can I assist you today?

**Next Steps:**
- Type "help" to see available commands
- Toggle a feature (e.g., "disable smart insights")
- View current app health`,
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      role: 'user',
      content: input,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/ai-controller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      });
      
      const data = await response.json();
      
      if (data.error) throw new Error(data.error);

      setMessages(prev => [...prev, {
        role: 'admin',
        content: data.text,
        timestamp: Date.now()
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'admin',
        content: "**Smart Spend Admin Panel**\nStatus: ❌ Error\n\n**Response:**\nFailed to process command. Please check system logs.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-black/40 rounded-3xl border border-white/10 overflow-hidden font-mono shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="px-5 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <Terminal size={14} />
          <span className="text-xs font-bold uppercase tracking-widest">Admin Control System v1.2</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] text-success font-bold">STABLE</span>
          </div>
        </div>
      </div>

      {/* Output */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar"
      >
        {messages.map((m, i) => (
          <div 
            key={i} 
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            {m.role === 'user' ? (
              <div className="bg-primary/20 text-primary-light px-4 py-2 rounded-2xl rounded-tr-none text-sm border border-primary/20 max-w-[80%]">
                <span className="opacity-50 mr-2">$</span> {m.content}
              </div>
            ) : (
              <div className="w-full max-w-[90%] text-gray-300 text-sm leading-relaxed markdown-body">
                <Markdown>{m.content}</Markdown>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-primary animate-pulse">
            <Activity size={14} className="animate-spin" />
            <span className="text-xs uppercase tracking-widest">Processing command...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-white/5 border-t border-white/10">
        <div className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-1 border border-white/10 focus-within:border-primary/50 transition-colors">
          <ChevronRight size={16} className="text-gray-500" />
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type admin command..."
            className="flex-1 bg-transparent border-none outline-none py-3 text-sm text-white placeholder:text-gray-600"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-all disabled:opacity-30"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
