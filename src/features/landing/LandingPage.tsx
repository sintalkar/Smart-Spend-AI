import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Bot, Shield, ChevronRight, Zap, Target, ArrowRight, 
  Menu, X, Check, Star, Play, Mic, Camera, BarChart3, TrendingUp, Cpu
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis } from 'recharts';

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<'insights' | 'automation' | 'scanner'>('insights');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  // Simulated chart data for the Analytics Preview
  const mockChartData = [
    { name: 'Mon', spent: 1200 },
    { name: 'Tue', spent: 800 },
    { name: 'Wed', spent: 3100 },
    { name: 'Thu', spent: 1500 },
    { name: 'Fri', spent: 2200 },
    { name: 'Sat', spent: 4500 },
    { name: 'Sun', spent: 1800 }
  ];

  const handleLaunchApp = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white overflow-x-hidden font-sans selection:bg-primary selection:text-white relative">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -z-10 animate-pulse pointer-events-none" />
      <div className="absolute top-[1200px] right-1/4 w-[600px] h-[600px] bg-secondary/5 rounded-full blur-[140px] -z-10 pointer-events-none" />
      <div className="absolute bottom-[800px] left-1/3 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none" />

      {/* 1. Header / Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-[100] bg-[#0A0A0C]/75 backdrop-blur-xl border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={handleLaunchApp}>
            <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(108,99,255,0.4)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white"/>
                <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-white to-gray-500 bg-clip-text text-transparent">SmartSpend AI</span>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#demo" className="hover:text-white transition-colors">Interactive Demo</a>
            <a href="#security" className="hover:text-white transition-colors">Security</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button 
              onClick={handleLaunchApp}
              className="px-6 py-2.5 bg-white text-black font-extrabold rounded-2xl text-sm transition-all hover:bg-gray-200 active:scale-95 shadow-lg shadow-white/5 cursor-pointer"
            >
              Open Web App
            </button>
          </div>

          {/* Mobile Menu Trigger */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-full left-0 right-0 bg-[#0A0A0C] border-b border-white/5 p-6 flex flex-col gap-6 md:hidden z-50 shadow-2xl"
            >
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 font-semibold text-lg">Features</a>
              <a href="#demo" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 font-semibold text-lg">Interactive Demo</a>
              <a href="#security" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 font-semibold text-lg">Security</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 font-semibold text-lg">Pricing</a>
              
              <button 
                onClick={handleLaunchApp}
                className="w-full py-3.5 bg-primary text-white font-extrabold rounded-2xl text-center active:scale-95 transition-all shadow-lg shadow-primary/20"
              >
                Get Started
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* 2. Hero Section */}
      <section className="pt-32 pb-24 px-6 max-w-7xl mx-auto flex flex-col items-center text-center relative">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6 max-w-4xl"
        >
          {/* Tag */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-xs font-bold tracking-wider text-primary uppercase mb-2 animate-bounce">
            <Sparkles size={14} className="animate-spin" />
            <span>Introducing Gemini-Powered CA Assistant</span>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-7xl font-black tracking-tighter leading-none bg-gradient-to-b from-white via-white to-gray-500 bg-clip-text text-transparent">
            Take Control of Your Spends <br className="hidden md:block"/>
            With Absolute Intelligence.
          </h1>

          {/* Subtitle */}
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-medium">
            Smart Spend AI aggregates SMS alerts, scans raw receipt photos, and hosts a proactive CA assistant to build your wealth automatically.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button 
              onClick={handleLaunchApp}
              className="w-full sm:w-auto px-8 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all hover:bg-primary-light flex items-center justify-center gap-2 cursor-pointer border border-white/10"
            >
              <span>Get Started Free</span>
              <ArrowRight size={18} />
            </button>
            <a 
              href="#demo"
              className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-gray-300 font-bold hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play size={16} fill="currentColor" />
              <span>Watch Live Demo</span>
            </a>
          </div>
        </motion.div>

        {/* Floating Mockup Preview */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, type: 'spring' }}
          className="mt-16 w-full max-w-5xl bg-surface border border-white/10 rounded-[32px] p-6 shadow-2xl overflow-hidden glass-card relative"
        >
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
          
          {/* Header Mockup */}
          <div className="flex items-center justify-between pb-6 border-b border-white/5 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
              <div className="w-3 h-3 bg-green-500 rounded-full" />
            </div>
            <span className="text-xs text-gray-500 font-mono">dashboard.smartspend.ai</span>
            <div className="w-10" />
          </div>

          {/* Content Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
            {/* Main Stats */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-black/30 border border-white/5 rounded-3xl p-6 relative overflow-hidden">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-2">Available Balance</span>
                <span className="text-4xl font-display font-bold text-white">₹78,450.00</span>
                <div className="mt-4 flex gap-6">
                  <div>
                    <span className="text-[9px] text-success font-bold uppercase block">Monthly Income</span>
                    <span className="text-sm font-bold text-white">₹1,20,000</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-primary font-bold uppercase block">Spent so far</span>
                    <span className="text-sm font-bold text-white">₹41,550</span>
                  </div>
                </div>
              </div>

              {/* Mini Area Chart */}
              <div className="bg-black/30 border border-white/5 rounded-3xl p-6 h-56">
                <h4 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider">Weekly Trends</h4>
                <div className="w-full h-full">
                  <ResponsiveContainer width="100%" height="75%">
                    <AreaChart data={mockChartData}>
                      <defs>
                        <linearGradient id="landingChart" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#6C63FF" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" tick={{fill: '#666', fontSize: 9}} axisLine={false} tickLine={false} />
                      <Area type="monotone" dataKey="spent" stroke="#6C63FF" strokeWidth={3} fillOpacity={1} fill="url(#landingChart)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Sidebar Alerts */}
            <div className="space-y-6">
              {/* Financial Health Widget */}
              <div className="bg-[#121217] border border-white/10 rounded-3xl p-6 text-center relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-success/5 blur-xl rounded-full" />
                <div className="w-14 h-14 bg-success/10 border border-success/20 rounded-2xl flex items-center justify-center text-success mx-auto mb-3">
                  <Shield size={24} />
                </div>
                <h4 className="text-[10px] font-black uppercase text-success tracking-widest mb-1">Financial Money Score</h4>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-extrabold text-white">88</span>
                  <span className="text-xs text-gray-500 font-bold uppercase">/ 100</span>
                </div>
              </div>

              {/* AI CA Advice Card */}
              <div className="bg-primary/10 border border-primary/20 rounded-3xl p-6 relative overflow-hidden">
                <div className="flex gap-3 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
                    <Bot size={16} />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">Personal CA Assistant</h5>
                    <span className="text-[8px] text-primary uppercase tracking-widest font-black">Proactive Tip</span>
                  </div>
                </div>
                <p className="text-[11px] text-gray-300 leading-relaxed font-medium">
                  "You spent ₹4,200 on Swiggy delivery. Cooking at home just 4 days a week could save ₹2,000, which invested in mutual funds becomes ₹1.6 Lakhs in 5 years! Let's lock this limit."
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 3. Core Features Showcase */}
      <section id="features" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-primary">Unprecedented Features</h2>
          <h3 className="text-3xl md:text-5xl font-extrabold tracking-tight">The ultimate financial suite built for the next generation.</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="bg-[#121217] border border-white/5 hover:border-white/10 rounded-[32px] p-8 shadow-xl transition-all hover:-translate-y-1 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-xl rounded-full" />
            <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center text-primary mb-6">
              <Cpu size={24} />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Gemini AI Engine</h4>
            <p className="text-gray-400 text-sm leading-relaxed">
              Our advanced LLM load-balancer reads complex banking transactions, flags duplicates, and provides tailored, non-generic cost savings tips.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-[#121217] border border-white/5 hover:border-white/10 rounded-[32px] p-8 shadow-xl transition-all hover:-translate-y-1 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-secondary/5 blur-xl rounded-full" />
            <div className="w-12 h-12 bg-secondary/10 border border-secondary/20 rounded-2xl flex items-center justify-center text-secondary mb-6">
              <Mic size={24} />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Conversational Additions</h4>
            <p className="text-gray-400 text-sm leading-relaxed">
              Just talk to the app. Our real-time speech recognizer extracts categories, notes, and values instantly ("spent 200 rupees on auto ride").
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-[#121217] border border-white/5 hover:border-white/10 rounded-[32px] p-8 shadow-xl transition-all hover:-translate-y-1 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-success/5 blur-xl rounded-full" />
            <div className="w-12 h-12 bg-success/10 border border-success/20 rounded-2xl flex items-center justify-center text-success mb-6">
              <Camera size={24} />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Multi-Receipt Scanner</h4>
            <p className="text-gray-400 text-sm leading-relaxed">
              Upload photos of grocery bills or invoices. We scan, split, tax, and auto-categorize line items in seconds.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Interactive Showcase Tabs */}
      <section id="demo" className="py-24 px-6 bg-[#0E0E12] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-xs font-black uppercase tracking-[0.25em] text-primary">Interactive Demo</h2>
              <h3 className="text-3xl md:text-5xl font-extrabold tracking-tight">Explore the interface in real-time.</h3>
              <p className="text-gray-400 text-base leading-relaxed">
                Click the pillars below to experience the beautiful visual representation of the core tracking system.
              </p>

              {/* Tabs list */}
              <div className="space-y-4 pt-4">
                {[
                  { id: 'insights', title: 'Interactive AI Insights', desc: 'Predictive alert monitors and Swiggy/Zomato limit controllers.' },
                  { id: 'automation', title: 'SMS Transaction Tracker', desc: 'Android background listener alerts parsing UPI and credit cards.' },
                  { id: 'scanner', title: 'Full Receipt Scanner', desc: 'Auto-math validation, currency mapping, and split reports.' }
                ].map(tab => (
                  <div 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`p-5 rounded-3xl border transition-all cursor-pointer text-left ${
                      activeTab === tab.id 
                        ? 'bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(108,99,255,0.15)]' 
                        : 'bg-transparent border-white/5 hover:bg-white/5'
                    }`}
                  >
                    <h4 className="font-bold text-white text-base mb-1">{tab.title}</h4>
                    <p className="text-gray-400 text-xs">{tab.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Display Pane */}
            <div className="bg-[#121217] border border-white/10 rounded-[32px] p-6 min-h-[360px] flex items-center justify-center relative overflow-hidden glass-card">
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 blur-3xl rounded-full" />
              
              <AnimatePresence mode="wait">
                {activeTab === 'insights' && (
                  <motion.div 
                    key="insights"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="w-full space-y-4 text-left"
                  >
                    <div className="p-4 bg-error/10 border border-error/20 rounded-2xl flex items-center gap-3">
                      <div className="w-10 h-10 bg-error/20 text-error rounded-xl flex items-center justify-center">
                        <Star size={20} />
                      </div>
                      <div>
                        <span className="text-[10px] text-error font-black uppercase tracking-wider block">Budget Warning</span>
                        <p className="text-xs text-white/90 font-medium">Warning! You've used 82% of your monthly food budget limit.</p>
                      </div>
                    </div>

                    <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Top Overspent</span>
                        <span className="text-xs text-error font-mono font-bold">₹2,400 Excess</span>
                      </div>
                      <h4 className="text-sm font-bold text-white">Restaurants & Dining</h4>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'automation' && (
                  <motion.div 
                    key="automation"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="w-full space-y-4 text-left"
                  >
                    <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/20 text-primary rounded-xl flex items-center justify-center">
                        <Zap size={20} />
                      </div>
                      <div>
                        <span className="text-[10px] text-primary font-black uppercase tracking-wider block">Background SMS Read</span>
                        <p className="text-xs text-white/90 font-medium">Detected UPI transaction of ₹120 to HDFC Bank.</p>
                      </div>
                    </div>

                    <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex justify-between items-center">
                      <div>
                        <span className="text-[9px] text-gray-500 font-mono block">UPI REF CODE</span>
                        <span className="text-xs text-white font-mono font-bold">TXN8972164920</span>
                      </div>
                      <span className="px-3 py-1 bg-success/20 text-success text-[10px] font-bold rounded-lg uppercase">Auto-Parsed</span>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'scanner' && (
                  <motion.div 
                    key="scanner"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="w-full space-y-4 text-left"
                  >
                    <div className="p-4 bg-success/10 border border-success/20 rounded-2xl flex items-center gap-3">
                      <div className="w-10 h-10 bg-success/20 text-success rounded-xl flex items-center justify-center">
                        <Camera size={20} />
                      </div>
                      <div>
                        <span className="text-[10px] text-success font-black uppercase tracking-wider block">OCR Scan Completed</span>
                        <p className="text-xs text-white/90 font-medium">Extracted 4 individual line items from DMart bill.</p>
                      </div>
                    </div>

                    <div className="bg-black/30 border border-white/5 rounded-2xl p-4 space-y-2">
                      <div className="flex justify-between text-xs text-gray-300">
                        <span>1. Amul Butter 500g</span>
                        <span className="font-mono font-semibold">₹275.00</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-300">
                        <span>2. Basmati Rice 5kg</span>
                        <span className="font-mono font-semibold">₹650.00</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Security & Privacy */}
      <section id="security" className="py-24 px-6 max-w-7xl mx-auto text-center relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-success/5 blur-[120px] rounded-full -z-10" />
        
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="w-16 h-16 bg-success/10 border border-success/20 rounded-3xl flex items-center justify-center text-success mx-auto mb-4 animate-pulse">
            <Shield size={32} />
          </div>
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-success">Premium Bank-grade Security</h2>
          <h3 className="text-3xl md:text-5xl font-extrabold tracking-tight">Your financial books remain exclusively yours.</h3>
          <p className="text-gray-400 text-base max-w-xl mx-auto leading-relaxed font-medium">
            Smart Spend AI does not store raw bank statements. All transaction data parsing runs locally on your device via secure client sandboxes before synchronizing encrypted data blocks.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 text-left">
            <div className="p-6 bg-[#121217] border border-white/5 rounded-2xl">
              <h4 className="font-bold text-white mb-2">AES-256 Encryption</h4>
              <p className="text-gray-400 text-xs leading-relaxed">Transactions are fully encrypted in transit and at rest using modern secure encryption protocols.</p>
            </div>
            <div className="p-6 bg-[#121217] border border-white/5 rounded-2xl">
              <h4 className="font-bold text-white mb-2">Non-Custodial Data</h4>
              <p className="text-gray-400 text-xs leading-relaxed">We never sell your transactional histories to credit score providers or financial advertisers.</p>
            </div>
            <div className="p-6 bg-[#121217] border border-white/5 rounded-2xl">
              <h4 className="font-bold text-white mb-2">Biometric Lock</h4>
              <p className="text-gray-400 text-xs leading-relaxed">Secure your transaction logs behind your mobile device’s native Fingerprint or Face ID prompt.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Testimonials */}
      <section className="py-24 px-6 bg-[#0E0E12] border-t border-white/5">
        <div className="max-w-7xl mx-auto text-center space-y-12">
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-primary">User Reviews</h2>
            <h3 className="text-3xl font-extrabold tracking-tight">Trusted by young Indian professionals.</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: 'Vishwesh S.', role: 'Tech Lead, Bangalore', quote: 'The Gemini budget calculations are wittily accurate. Calculating Swiggy wasteful orders against a potential 5-year Mutual Fund SIP actually helped me cut non-essentials by ₹5,000/month!' },
              { name: 'Megha Sharma', role: 'Freelancer, Pune', quote: 'OCR receipt scanning makes bookkeeping seamless. I simply photograph invoices and the AI itemizes taxes and values without typing. It has become an essential companion.' },
              { name: 'Kabir Mehta', role: 'Student, IIT Bombay', quote: 'The Voice recognition is outstanding. I just click the Mic tab and say "spent 45 rupees on chai at tapri" while walking, and it categorizes it instantly. Incredible UX!' }
            ].map((t, idx) => (
              <div key={idx} className="p-8 bg-[#121217] border border-white/5 rounded-3xl text-left relative overflow-hidden">
                <div className="flex text-amber-500 mb-4 gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-6 italic">"{t.quote}"</p>
                <div>
                  <h4 className="font-bold text-white text-sm">{t.name}</h4>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{t.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Pricing Section */}
      <section id="pricing" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-primary">Simple Transparent Pricing</h2>
          <h3 className="text-3xl md:text-5xl font-extrabold tracking-tight">Plans that scale with your wallet.</h3>
          
          {/* Toggle */}
          <div className="flex bg-surface p-1 rounded-full w-fit mx-auto mt-6 border border-white/5">
            <button 
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${
                billingPeriod === 'monthly' ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button 
              onClick={() => setBillingPeriod('yearly')}
              className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${
                billingPeriod === 'yearly' ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'
              }`}
            >
              Yearly (Save 30%)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Plan 1 */}
          <div className="bg-[#121217] border border-white/5 rounded-[32px] p-8 flex flex-col justify-between relative overflow-hidden group">
            <div className="space-y-6">
              <span className="text-xs font-black text-gray-500 uppercase tracking-widest block">Core Companion</span>
              <h4 className="text-lg font-bold text-white">SmartSpend Lite</h4>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white">₹0</span>
                <span className="text-xs text-gray-500 font-bold uppercase">/ Forever Free</span>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed">Perfect starting tool to log expenses and check scores manually.</p>
              
              <div className="border-t border-white/5 pt-6 space-y-3 text-xs text-gray-300">
                <div className="flex items-center gap-2"><Check size={14} className="text-success" /> <span>Quick Manual Logging</span></div>
                <div className="flex items-center gap-2"><Check size={14} className="text-success" /> <span>Weekly Financial Money Score</span></div>
                <div className="flex items-center gap-2"><Check size={14} className="text-success" /> <span>Standard Budget Limits</span></div>
                <div className="flex items-center gap-2"><Check size={14} className="text-success" /> <span>Local Offline DB Sync</span></div>
              </div>
            </div>

            <button 
              onClick={handleLaunchApp}
              className="mt-8 w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl active:scale-95 transition-all text-sm border border-white/10"
            >
              Get Started Free
            </button>
          </div>

          {/* Plan 2 */}
          <div className="bg-primary/5 border border-primary/20 rounded-[32px] p-8 flex flex-col justify-between relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-2xl rounded-full" />
            <div className="absolute top-6 right-6 bg-primary/20 border border-primary/30 rounded-full px-3 py-1 text-[9px] font-black text-primary uppercase tracking-widest">Premium</div>
            
            <div className="space-y-6">
              <span className="text-xs font-black text-primary uppercase tracking-widest block">Pro Companion</span>
              <h4 className="text-lg font-bold text-white">SmartSpend PRO</h4>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white">
                  {billingPeriod === 'monthly' ? '₹99' : '₹69'}
                </span>
                <span className="text-xs text-gray-500 font-bold uppercase">/ month</span>
              </div>
              <p className="text-gray-300 text-xs leading-relaxed">For high earners, students, and freelancers who demand automated insights.</p>
              
              <div className="border-t border-primary/10 pt-6 space-y-3 text-xs text-gray-300">
                <div className="flex items-center gap-2"><Check size={14} className="text-primary" /> <span className="font-semibold text-white">Infinite OCR Receipt Scanners</span></div>
                <div className="flex items-center gap-2"><Check size={14} className="text-primary" /> <span className="font-semibold text-white">Proactive AI CA Chat Assistant</span></div>
                <div className="flex items-center gap-2"><Check size={14} className="text-primary" /> <span className="font-semibold text-white">Voice Entry & speech recognizer</span></div>
                <div className="flex items-center gap-2"><Check size={14} className="text-primary" /> <span className="font-semibold text-white">Android Background SMS Autodetect</span></div>
              </div>
            </div>

            <button 
              onClick={handleLaunchApp}
              className="mt-8 w-full py-4 bg-primary text-white font-black rounded-2xl active:scale-95 transition-all text-sm shadow-xl shadow-primary/20 border border-white/10 hover:bg-primary-light"
            >
              Get SmartSpend PRO
            </button>
          </div>
        </div>
      </section>

      {/* 8. CTA Footer Section */}
      <footer className="bg-[#050507] border-t border-white/5 py-16 px-6 text-center">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="max-w-3xl mx-auto space-y-4">
            <h3 className="text-3xl md:text-5xl font-extrabold tracking-tight">Ready to master your cash flow?</h3>
            <p className="text-gray-400 text-base max-w-xl mx-auto font-medium">
              Join thousands of Indian users securing their financial future with Gemini-powered automations.
            </p>
            <div className="pt-4">
              <button 
                onClick={handleLaunchApp}
                className="px-10 py-4 bg-white text-black font-extrabold rounded-2xl text-sm transition-all hover:bg-gray-200 active:scale-95 shadow-xl shadow-white/5 cursor-pointer"
              >
                Launch Smart Spend AI
              </button>
            </div>
          </div>

          <div className="border-t border-white/5 pt-12 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3 cursor-pointer" onClick={handleLaunchApp}>
              <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white"/>
                  <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="font-bold text-white tracking-tight">SmartSpend AI</span>
            </div>
            
            <p className="text-xs text-gray-500 font-mono">
              © {new Date().getFullYear()} SmartSpend AI. Under Apache-2.0 License.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
