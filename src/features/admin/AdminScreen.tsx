import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Key, 
  Check, 
  Megaphone, 
  Users, 
  ScrollText, 
  ArrowLeft, 
  RefreshCw, 
  Lock, 
  Unlock, 
  Settings, 
  LogOut,
  AlertTriangle,
  AlertCircle,
  Database,
  Search,
  Sliders
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { hapticFeedback } from '../../core/utils/haptics';
import { adminService, AdminFeatureToggles, AppAnnouncement, AdminUser, AppEvent } from './AdminService';
import { appRoutes } from '../../core/routes';

// SHA-256 hashing function using native Web Crypto API
async function hashPin(pin: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function AdminScreen() {
  const navigate = useNavigate();

  // Auth States
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('admin_authenticated') === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // tab state: 'flags' | 'announcements' | 'users' | 'logs'
  const [activeTab, setActiveTab] = useState<'flags' | 'announcements' | 'users' | 'logs'>('flags');

  // Admin Data States
  const [toggles, setToggles] = useState<AdminFeatureToggles>(adminService.getToggles());
  const [announcement, setAnnouncement] = useState<AppAnnouncement>(adminService.getAnnouncement());
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  
  // Loading & Filtering states
  const [loadingData, setLoadingData] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [eventQuery, setEventQuery] = useState('');

  // Check pin presence on load
  useEffect(() => {
    const checkPin = async () => {
      try {
        const hash = await adminService.getAdminPinHash();
        setHasPin(hash !== null);
      } catch (err) {
        console.error('[Admin] Check pin failed:', err);
        setHasPin(false);
      }
    };
    checkPin();
  }, []);

  // Listen to live feature toggle updates
  useEffect(() => {
    if (!isAuthenticated) return;
    return adminService.subscribe(() => {
      setToggles(adminService.getToggles());
    });
  }, [isAuthenticated]);

  // Listen to live global announcements
  useEffect(() => {
    if (!isAuthenticated) return;
    return adminService.subscribeAnnouncement(() => {
      setAnnouncement(adminService.getAnnouncement());
    });
  }, [isAuthenticated]);

  // Fetch admin dashboard details
  const fetchDashboardData = async () => {
    setLoadingData(true);
    try {
      const fetchedUsers = await adminService.fetchUsers();
      const fetchedEvents = await adminService.fetchEvents(150);
      setUsers(fetchedUsers);
      setEvents(fetchedEvents);
    } catch (err) {
      console.error('[Admin] Data fetch error:', err);
      toast.error('Failed to load remote administrative metadata.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
    }
  }, [isAuthenticated]);

  // --- Handlers ---
  const handlePinSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.length < 4) {
      toast.error('PIN must be at least 4 digits');
      hapticFeedback.error();
      return;
    }
    if (pinInput !== confirmPinInput) {
      toast.error('PINs do not match');
      hapticFeedback.error();
      return;
    }

    setIsSubmitting(true);
    hapticFeedback.light();
    try {
      const hashed = await hashPin(pinInput);
      await adminService.saveAdminPin(hashed);
      toast.success('Admin PIN configured successfully!');
      setHasPin(true);
      setPinInput('');
      setConfirmPinInput('');
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_authenticated', 'true');
      hapticFeedback.success();
    } catch (err) {
      console.error(err);
      toast.error('Failed to register Admin PIN.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput) return;

    setIsSubmitting(true);
    hapticFeedback.light();
    try {
      const hashedInput = await hashPin(pinInput);
      const activeHash = await adminService.getAdminPinHash();
      
      if (hashedInput === activeHash) {
        toast.success('Access Granted. Developer Session active.');
        setIsAuthenticated(true);
        sessionStorage.setItem('admin_authenticated', 'true');
        setPinInput('');
        hapticFeedback.success();
      } else {
        toast.error('Incorrect PIN code. Access Denied.');
        setPinInput('');
        hapticFeedback.error();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to authenticate Developer PIN.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminSignout = () => {
    hapticFeedback.warning();
    sessionStorage.removeItem('admin_authenticated');
    setIsAuthenticated(false);
    toast.success('Developer session terminated.');
  };

  const handleToggleChange = async (key: keyof AdminFeatureToggles, value: any) => {
    hapticFeedback.light();
    try {
      await adminService.updateToggles({ [key]: value });
      toast.success('Feature toggle synchronized!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to toggle feature.');
    }
  };

  const handleAnnouncementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    hapticFeedback.success();
    try {
      await adminService.updateAnnouncement(announcement);
      toast.success('Global announcement synchronized successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to push announcement.');
    }
  };

  // Keyboard keypad inputs for premium touch
  const handleKeypadPress = (val: string) => {
    hapticFeedback.light();
    if (pinInput.length < 6) {
      setPinInput(p => p + val);
    }
  };

  const handleKeypadDelete = () => {
    hapticFeedback.light();
    setPinInput(p => p.slice(0, -1));
  };

  // Filters
  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(userQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(userQuery.toLowerCase()) ||
    u.id.toLowerCase().includes(userQuery.toLowerCase())
  );

  const filteredEvents = events.filter(ev => 
    ev.eventType.toLowerCase().includes(eventQuery.toLowerCase()) ||
    ev.userId.toLowerCase().includes(eventQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen text-white pb-32">
      {/* Dynamic lock gate */}
      <AnimatePresence mode="wait">
        {!isAuthenticated ? (
          <motion.div
            key="lock-screen"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mx-auto max-w-md p-6 pt-16 text-center"
          >
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] bg-primary/12 border border-primary/20 text-primary shadow-[0_0_40px_rgba(108,99,255,0.2)]">
              <Shield size={36} />
            </div>

            <h1 className="title-bold text-3xl mb-2">Developer Security</h1>
            <p className="text-sm text-white/46 mb-8 max-w-xs mx-auto">
              Please authenticate to access the live administrative feature toggles and database configurations.
            </p>

            {hasPin === null ? (
              <div className="flex justify-center items-center py-10">
                <RefreshCw size={24} className="animate-spin text-primary" />
              </div>
            ) : !hasPin ? (
              /* Setup PIN Screen */
              <form onSubmit={handlePinSetup} className="panel-linear rounded-[32px] border border-white/6 p-6 text-left space-y-4">
                <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-[9px] mb-2">
                  <Unlock size={12} />
                  First Time Setup Required
                </div>
                <h3 className="text-base font-bold text-white">Create Developer PIN</h3>
                <p className="text-xs text-white/34 leading-relaxed">
                  No administrative PIN hash exists. Please define a master developer PIN to protect your console.
                </p>

                <div className="space-y-3 pt-2">
                  <label className="block">
                    <span className="text-[10px] font-black uppercase text-white/34 tracking-[0.16em]">Define PIN (Min 4 digits)</span>
                    <input 
                      type="password"
                      maxLength={6}
                      value={pinInput}
                      onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="mt-1.5 h-12 w-full rounded-xl border border-white/8 bg-black/32 px-4 text-center text-lg font-bold font-mono tracking-widest text-white outline-none focus:border-primary/50"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-black uppercase text-white/34 tracking-[0.16em]">Confirm PIN</span>
                    <input 
                      type="password"
                      maxLength={6}
                      value={confirmPinInput}
                      onChange={e => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="mt-1.5 h-12 w-full rounded-xl border border-white/8 bg-black/32 px-4 text-center text-lg font-bold font-mono tracking-widest text-white outline-none focus:border-primary/50"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmitting || pinInput.length < 4}
                    className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/95 text-white font-black uppercase tracking-[0.2em] text-xs transition duration-200 mt-4 active:scale-95 disabled:opacity-40"
                  >
                    {isSubmitting ? 'Configuring Master PIN...' : 'Setup Developer Access'}
                  </button>
                </div>
              </form>
            ) : (
              /* Verify PIN Screen */
              <div className="space-y-6">
                <form onSubmit={handlePinVerify} className="panel-linear rounded-[32px] border border-white/6 p-6 text-left">
                  <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-[9px] mb-3">
                    <Lock size={12} />
                    Console Locked
                  </div>

                  <div className="relative mb-6">
                    <input 
                      type="password"
                      readOnly
                      maxLength={6}
                      value={pinInput}
                      placeholder="••••"
                      className="h-16 w-full rounded-[24px] border border-white/8 bg-black/36 px-4 text-center text-3xl font-black font-mono tracking-widest text-white outline-none"
                    />
                  </div>

                  {/* Keypad */}
                  <div className="grid grid-cols-3 gap-3">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleKeypadPress(val)}
                        className="h-14 rounded-2xl bg-white/4 hover:bg-white/8 border border-white/5 text-xl font-bold font-mono transition cursor-pointer flex items-center justify-center active:scale-90"
                      >
                        {val}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleKeypadDelete}
                      className="h-14 rounded-2xl bg-white/4 hover:bg-white/8 border border-white/5 text-sm font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center active:scale-90 text-white/50"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('0')}
                      className="h-14 rounded-2xl bg-white/4 hover:bg-white/8 border border-white/5 text-xl font-bold font-mono transition cursor-pointer flex items-center justify-center active:scale-90"
                    >
                      0
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || pinInput.length < 4}
                      className="h-14 rounded-2xl bg-primary hover:bg-primary/95 text-white transition cursor-pointer flex items-center justify-center active:scale-90 disabled:opacity-40"
                    >
                      <Check size={22} />
                    </button>
                  </div>
                </form>

                <button 
                  onClick={() => navigate(appRoutes.dashboard)}
                  className="inline-flex items-center gap-2 text-white/44 hover:text-white transition duration-200 text-xs font-black uppercase tracking-wider bg-white/4 border border-white/5 px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  <ArrowLeft size={13} /> Return to Dashboard
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          /* Admin Panel Layout */
          <motion.div
            key="admin-dashboard"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="mx-auto max-w-[1080px] p-4 sm:p-6"
          >
            {/* Header controls */}
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 mt-4">
              <div>
                <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-[9px] mb-1">
                  <Shield size={14} className="text-primary animate-pulse" />
                  Live Developer System Control
                </div>
                <h1 className="title-bold text-4xl tracking-tight leading-tight">Admin Console</h1>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={fetchDashboardData}
                  disabled={loadingData}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/6 bg-white/4 px-4 text-xs font-black uppercase tracking-wider text-white/60 hover:text-white transition duration-200 cursor-pointer disabled:opacity-40"
                >
                  <RefreshCw size={14} className={loadingData ? "animate-spin text-primary" : ""} />
                  Refresh Logs
                </button>

                <button
                  onClick={handleAdminSignout}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-error/20 bg-error/10 px-4 text-xs font-black uppercase tracking-wider text-error transition duration-200 cursor-pointer hover:bg-error/15"
                >
                  <LogOut size={14} />
                  Lock Session
                </button>
              </div>
            </header>

            {/* Premium segmented tab bar */}
            <div className="flex gap-2 p-1 rounded-2xl bg-black/40 border border-white/5 mb-8 overflow-x-auto no-scrollbar">
              {[
                { id: 'flags', label: 'Feature Flags', icon: Sliders },
                { id: 'announcements', label: 'Broadcast Banner', icon: Megaphone },
                { id: 'users', label: 'User Directory', icon: Users },
                { id: 'logs', label: 'Audit Event Logs', icon: ScrollText }
              ].map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      hapticFeedback.light();
                      setActiveTab(tab.id as any);
                    }}
                    className={`flex items-center gap-2 shrink-0 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 cursor-pointer ${
                      active 
                        ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                        : 'text-white/44 hover:text-white/70 hover:bg-white/4'
                    }`}
                  >
                    <Icon size={13} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Contents */}
            <div className="space-y-6">
              {activeTab === 'flags' && (
                <div className="space-y-6">
                  {/* Feature toggles list */}
                  <div className="panel-linear border border-white/6 rounded-[32px] p-6 space-y-6">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">Toggle Client Feature Modules</h3>
                      <p className="text-xs text-white/34 leading-relaxed max-w-2xl">
                        Turn client-side application sections ON or OFF. Changes are dispatched in real-time to all online instances via Firestore document sync.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {[
                        { key: 'voiceEntry', label: 'Gemini Voice Entry', desc: 'Allows users to capture transactions via voice transcription.' },
                        { key: 'receiptScanner', label: 'Gemini Receipt Scanner', desc: 'Allows users to scan cash registers/bills using OCR.' },
                        { key: 'aiParsing', label: 'Gemini SMS Auto-Categorization', desc: 'Enables high-fidelity LLM parsing for transaction text.' },
                        { key: 'smsDetection', label: 'SMS Clipboard Syncing', desc: 'Checks and captures SMS clips from clipboard triggers.' },
                        { key: 'analyticsCollection', label: 'Diagnostics Collection', desc: 'Stores diagnostic appLogs to Firebase Cloud logs.' },
                      ].map(item => {
                        const active = (toggles as any)[item.key];
                        return (
                          <div key={item.key} className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.01]">
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-white">{item.label}</h4>
                              <p className="text-[11px] text-white/34 leading-normal mt-0.5 max-w-xs">{item.desc}</p>
                            </div>
                            <button
                              onClick={() => handleToggleChange(item.key as any, !active)}
                              className={`w-14 h-8 shrink-0 rounded-full border transition-all duration-300 relative cursor-pointer ${
                                active 
                                  ? 'bg-primary border-primary shadow-[0_0_12px_var(--color-primary)]' 
                                  : 'bg-white/4 border-white/8'
                              }`}
                            >
                              <div className={`h-6 w-6 rounded-full bg-white shadow-md absolute top-0.5 transition-all duration-300 ${
                                active ? 'left-7' : 'left-0.5'
                              }`} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Maintenance Mode configuration */}
                  <div className="panel-linear border border-white/6 rounded-[32px] p-6 space-y-6">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                        <AlertTriangle className="text-amber-400" size={20} />
                        Global Maintenance Lockdown
                      </h3>
                      <p className="text-xs text-white/34 leading-relaxed max-w-2xl">
                        Enabling maintenance mode intercepts all client routes and locks the application interface, showing a customizable landing message.
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-red-500/15 bg-red-500/5">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white">Activate System Maintenance Lockdown</h4>
                        <p className="text-[11px] text-white/34 leading-normal mt-0.5">Locks out active users and redirects them to the splash page.</p>
                      </div>
                      <button
                        onClick={() => handleToggleChange('maintenanceMode', !toggles.maintenanceMode)}
                        className={`w-14 h-8 shrink-0 rounded-full border transition-all duration-300 relative cursor-pointer ${
                          toggles.maintenanceMode 
                            ? 'bg-red-500 border-red-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]' 
                            : 'bg-white/4 border-white/8'
                        }`}
                      >
                        <div className={`h-6 w-6 rounded-full bg-white shadow-md absolute top-0.5 transition-all duration-300 ${
                          toggles.maintenanceMode ? 'left-7' : 'left-0.5'
                        }`} />
                      </button>
                    </div>

                    {toggles.maintenanceMode && (
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black uppercase text-white/34 tracking-wider">Lockdown Message Displayed to Clients</label>
                        <input
                          type="text"
                          value={toggles.maintenanceMessage}
                          onChange={e => setToggles(prev => ({ ...prev, maintenanceMessage: e.target.value }))}
                          onBlur={() => handleToggleChange('maintenanceMessage', toggles.maintenanceMessage)}
                          placeholder="Maintenance warning message..."
                          className="h-12 w-full rounded-2xl border border-white/8 bg-black/24 px-4 text-sm text-white outline-none focus:border-red-500/50 transition duration-200"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'announcements' && (
                <form onSubmit={handleAnnouncementSubmit} className="panel-linear border border-white/6 rounded-[32px] p-6 space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Broadcast System Announcement Banners</h3>
                    <p className="text-xs text-white/34 leading-relaxed max-w-2xl">
                      Deliver urgent banners or promotion alerts to all logged-in client screens globally. Banners can easily be custom-themed.
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.01]">
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white">Active Banner Broadcast</h4>
                      <p className="text-[11px] text-white/34 leading-normal mt-0.5">Toggle to immediately display or retract this announcement banner.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAnnouncement(prev => ({ ...prev, active: !prev.active }))}
                      className={`w-14 h-8 shrink-0 rounded-full border transition-all duration-300 relative cursor-pointer ${
                        announcement.active 
                          ? 'bg-primary border-primary shadow-[0_0_12px_var(--color-primary)]' 
                          : 'bg-white/4 border-white/8'
                      }`}
                    >
                      <div className={`h-6 w-6 rounded-full bg-white shadow-md absolute top-0.5 transition-all duration-300 ${
                        announcement.active ? 'left-7' : 'left-0.5'
                      }`} />
                    </button>
                  </div>

                  {announcement.active && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block space-y-1.5">
                        <span className="text-[10px] font-black uppercase text-white/34 tracking-wider">Announcement Title</span>
                        <input
                          type="text"
                          required
                          value={announcement.title}
                          onChange={e => setAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="e.g. Server Upgrade Scheduled"
                          className="h-12 w-full rounded-2xl border border-white/8 bg-black/24 px-4 text-sm text-white outline-none focus:border-primary/50"
                        />
                      </label>

                      <label className="block space-y-1.5">
                        <span className="text-[10px] font-black uppercase text-white/34 tracking-wider">Banner Styling Theme</span>
                        <select
                          value={announcement.type}
                          onChange={e => setAnnouncement(prev => ({ ...prev, type: e.target.value as any }))}
                          className="h-12 w-full rounded-2xl border border-white/8 bg-black/24 px-4 text-sm text-white outline-none focus:border-primary/50"
                        >
                          <option value="info">🔵 Information (Info Blue)</option>
                          <option value="success">🟢 System Success (Emerald Green)</option>
                          <option value="warning">🟡 Maintenance Warning (Amber Orange)</option>
                          <option value="error">🔴 Urgent Error (Rose Red)</option>
                        </select>
                      </label>

                      <label className="block space-y-1.5 md:col-span-2">
                        <span className="text-[10px] font-black uppercase text-white/34 tracking-wider">Announcement Narrative Message</span>
                        <textarea
                          required
                          value={announcement.message}
                          onChange={e => setAnnouncement(prev => ({ ...prev, message: e.target.value }))}
                          placeholder="Provide details about system status, promotional updates, or configuration logs..."
                          className="h-24 w-full rounded-2xl border border-white/8 bg-black/24 p-4 text-sm text-white outline-none focus:border-primary/50 resize-none"
                        />
                      </label>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/95 text-white font-black uppercase tracking-[0.2em] text-xs transition duration-200 shadow-xl shadow-primary/20 active:scale-95"
                  >
                    Broadcast Banner Changes
                  </button>
                </form>
              )}

              {activeTab === 'users' && (
                <div className="panel-linear border border-white/6 rounded-[32px] p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">Registered User Directory</h3>
                      <p className="text-xs text-white/34 leading-relaxed max-w-md">
                        A dynamic overview list of active credentials stored securely in the Firestore databases.
                      </p>
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                      <input
                        type="text"
                        value={userQuery}
                        onChange={e => setUserQuery(e.target.value)}
                        placeholder="Search email or names..."
                        className="h-10 w-full rounded-xl border border-white/8 bg-black/24 pl-10 pr-4 text-xs text-white outline-none focus:border-primary/50"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-white/5">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="bg-white/[0.02] text-white/44 border-b border-white/5">
                        <tr>
                          <th className="p-4 font-black uppercase tracking-wider">User details</th>
                          <th className="p-4 font-black uppercase tracking-wider">UID Reference</th>
                          <th className="p-4 font-black uppercase tracking-wider">Starting Balance</th>
                          <th className="p-4 font-black uppercase tracking-wider">Last Profile Sync</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 bg-white/[0.005]">
                        {filteredUsers.length > 0 ? (
                          filteredUsers.map((usr) => (
                            <tr key={usr.id} className="hover:bg-white/[0.01] transition duration-150">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary text-xs">
                                    {usr.displayName ? usr.displayName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : 'U'}
                                  </div>
                                  <div>
                                    <div className="font-bold text-white text-sm">{usr.displayName || 'Anonymous User'}</div>
                                    <div className="text-[10px] text-white/34 mt-0.5 font-mono">{usr.email || 'No email attached'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 font-mono text-white/42 text-[10px] select-all">{usr.id}</td>
                              <td className="p-4 font-mono font-bold text-emerald-400">
                                {usr.initialBalance ? `₹${Math.round(usr.initialBalance).toLocaleString('en-IN')}` : 'Not Set'}
                              </td>
                              <td className="p-4 text-white/36 font-semibold">
                                {usr.updatedAt ? new Date(usr.updatedAt).toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : 'N/A'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-white/30 font-medium italic">
                              {loadingData ? 'Fetching cloud directories...' : 'No users found matching query.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'logs' && (
                <div className="panel-linear border border-white/6 rounded-[32px] p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">Administrative Event Diagnostics</h3>
                      <p className="text-xs text-white/34 leading-relaxed max-w-md">
                        Audit captured client activity events. Logs are recorded to Firebase Cloud trace in real-time.
                      </p>
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                      <input
                        type="text"
                        value={eventQuery}
                        onChange={e => setEventQuery(e.target.value)}
                        placeholder="Search event type or UID..."
                        className="h-10 w-full rounded-xl border border-white/8 bg-black/24 pl-10 pr-4 text-xs text-white outline-none focus:border-primary/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 no-scrollbar">
                    {filteredEvents.length > 0 ? (
                      filteredEvents.map((ev, i) => (
                        <div key={ev.id || i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-white/5 bg-white/[0.005] hover:bg-white/[0.015] transition">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 text-xs shrink-0">
                              <Database size={14} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-black text-white text-xs select-all uppercase tracking-wide bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
                                  {ev.eventType}
                                </span>
                                <span className="text-[10px] text-white/28 font-mono select-all">User: {ev.userId}</span>
                              </div>
                              {ev.data && Object.keys(ev.data).length > 0 && (
                                <pre className="mt-1.5 text-[9px] font-mono text-white/34 leading-normal bg-black/15 p-2 rounded-lg border border-white/4 select-all max-w-full overflow-x-auto">
                                  {JSON.stringify(ev.data, null, 2)}
                                </pre>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold font-mono text-white/28 self-end sm:self-center shrink-0">
                            {new Date(ev.createdAt).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-12 text-center text-white/30 font-medium italic border border-white/5 rounded-2xl">
                        {loadingData ? 'Retrieving event logs...' : 'No diagnostics events detected.'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
