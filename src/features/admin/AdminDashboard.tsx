import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Sliders, Megaphone, Users, Activity,
  RefreshCw, LogOut, Wifi, WifiOff, CheckCircle2, XCircle,
  Loader2, Trash2, ChevronDown, ChevronUp, AlertTriangle,
  Bell, BellOff, Info, AlertCircle, CheckCircle, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { adminService, AdminFeatureToggles, AppAnnouncement, AppEvent, AdminUser } from './AdminService';
import { format, formatDistanceToNow } from 'date-fns';

// ─── Types ─────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'features' | 'broadcast' | 'users' | 'events';

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview',   label: 'Overview',  icon: LayoutDashboard },
  { id: 'features',   label: 'Features',  icon: Sliders },
  { id: 'broadcast',  label: 'Broadcast', icon: Megaphone },
  { id: 'users',      label: 'Users',     icon: Users },
  { id: 'events',     label: 'Events',    icon: Activity },
];

const FEATURE_META: Record<keyof Omit<AdminFeatureToggles, 'maintenanceMode' | 'maintenanceMessage'>, { label: string; description: string }> = {
  voiceEntry:          { label: 'Voice Entry',        description: 'Allow users to add expenses via voice commands' },
  receiptScanner:      { label: 'Receipt Scanner',    description: 'AI-powered receipt OCR and auto-categorization' },
  aiParsing:           { label: 'AI Parsing',         description: 'Natural language parsing for manual entries' },
  smsDetection:        { label: 'SMS Detection',      description: 'Auto-detect transactions from bank SMS messages' },
  analyticsCollection: { label: 'Analytics',          description: 'Collect anonymized usage data for improvements' },
};

const ANNOUNCEMENT_TYPES = [
  { id: 'info'    as const, label: 'Info',    icon: Info,         color: 'text-blue-400',   bg: 'bg-blue-500/10  border-blue-500/20'  },
  { id: 'success' as const, label: 'Success', icon: CheckCircle,  color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
  { id: 'warning' as const, label: 'Warning', icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  { id: 'error'   as const, label: 'Urgent',  icon: AlertCircle,  color: 'text-red-400',    bg: 'bg-red-500/10   border-red-500/20'   },
];

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent = false }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={clsx('rounded-2xl border p-4', accent ? 'bg-primary/10 border-primary/30' : 'bg-white/3 border-white/8')}>
      <p className="text-[9px] text-white/35 font-black uppercase tracking-widest mb-1">{label}</p>
      <p className={clsx('text-2xl font-mono font-black', accent ? 'text-primary' : 'text-white')}>{value}</p>
      {sub && <p className="text-[10px] text-white/30 font-semibold mt-0.5">{sub}</p>}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={clsx(
        'relative w-12 h-6 rounded-full transition-colors duration-200 border',
        checked ? 'bg-primary border-primary/50' : 'bg-white/5 border-white/10',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <span className={clsx(
        'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
        checked ? 'left-[26px]' : 'left-0.5'
      )} />
    </button>
  );
}

// ─── Tabs ──────────────────────────────────────────────────────────────────

function OverviewTab({ toggles, users, events }: { toggles: AdminFeatureToggles; users: AdminUser[]; events: AppEvent[] }) {
  const activeFeatures = Object.entries(FEATURE_META).filter(([k]) => toggles[k as keyof typeof FEATURE_META]).length;
  const todayEvents = events.filter(e => e.createdAt > Date.now() - 86_400_000).length;
  const last7Days = events.filter(e => e.createdAt > Date.now() - 7 * 86_400_000);
  const activeUsers = new Set(last7Days.map(e => e.userId).filter(id => id !== 'anonymous')).size;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Users" value={users.length} sub="Firebase registered" accent />
        <StatCard label="Active (7d)" value={activeUsers} sub="unique users" />
        <StatCard label="Events Today" value={todayEvents} sub="logged actions" />
        <StatCard label="Features On" value={`${activeFeatures}/${Object.keys(FEATURE_META).length}`} sub="enabled" />
      </div>

      {/* Maintenance warning */}
      {toggles.maintenanceMode && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl"
        >
          <ShieldAlert size={18} className="text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-yellow-300 font-black text-sm">Maintenance Mode ON</p>
            <p className="text-yellow-400/70 text-xs mt-0.5">{toggles.maintenanceMessage}</p>
          </div>
        </motion.div>
      )}

      {/* Feature status */}
      <div>
        <p className="text-[9px] text-white/35 font-black uppercase tracking-widest mb-3">Feature Status</p>
        <div className="space-y-2">
          {Object.entries(FEATURE_META).map(([key, meta]) => {
            const on = toggles[key as keyof typeof FEATURE_META];
            return (
              <div key={key} className="flex items-center justify-between p-3 bg-white/3 border border-white/8 rounded-xl">
                <span className="text-sm font-semibold text-white/70">{meta.label}</span>
                {on
                  ? <CheckCircle2 size={16} className="text-green-400" />
                  : <XCircle size={16} className="text-red-400/60" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent events */}
      {events.length > 0 && (
        <div>
          <p className="text-[9px] text-white/35 font-black uppercase tracking-widest mb-3">Recent Events</p>
          <div className="space-y-1.5">
            {events.slice(0, 8).map((ev, i) => (
              <div key={ev.id ?? i} className="flex items-center justify-between px-3 py-2 bg-white/3 border border-white/5 rounded-xl">
                <span className="text-xs font-mono text-primary/80">{ev.eventType}</span>
                <span className="text-[10px] text-white/30">{formatDistanceToNow(ev.createdAt, { addSuffix: true })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FeaturesTab({ toggles, onUpdate }: { toggles: AdminFeatureToggles; onUpdate: (patch: Partial<AdminFeatureToggles>) => void }) {
  const [saving, setSaving] = useState<string | null>(null);

  const toggle = async (key: keyof AdminFeatureToggles, value: boolean | string) => {
    setSaving(String(key));
    try {
      await adminService.updateToggles({ [key]: value });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-white/35 font-bold">Changes sync instantly to all connected users via Firestore.</p>

      {/* App features */}
      <div className="space-y-3">
        {Object.entries(FEATURE_META).map(([key, meta]) => {
          const k = key as keyof typeof FEATURE_META;
          const isOn = toggles[k];
          const isSaving = saving === key;
          return (
            <div key={key} className="flex items-center justify-between p-4 bg-[#0e0e14] border border-white/8 rounded-2xl">
              <div className="flex-1 mr-4">
                <p className="text-sm font-bold text-white">{meta.label}</p>
                <p className="text-[11px] text-white/35 mt-0.5">{meta.description}</p>
              </div>
              {isSaving
                ? <Loader2 size={20} className="text-primary animate-spin shrink-0" />
                : <ToggleSwitch checked={isOn} onChange={v => toggle(k, v)} />}
            </div>
          );
        })}
      </div>

      {/* Maintenance mode */}
      <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-yellow-300">Maintenance Mode</p>
            <p className="text-[11px] text-yellow-400/50 mt-0.5">Blocks all users with a message screen</p>
          </div>
          {saving === 'maintenanceMode'
            ? <Loader2 size={20} className="text-yellow-400 animate-spin shrink-0" />
            : <ToggleSwitch checked={toggles.maintenanceMode} onChange={v => toggle('maintenanceMode', v)} />}
        </div>
        {toggles.maintenanceMode && (
          <input
            type="text"
            defaultValue={toggles.maintenanceMessage}
            onBlur={e => toggle('maintenanceMessage', e.target.value)}
            placeholder="Maintenance message for users…"
            className="w-full h-10 bg-black/40 border border-yellow-500/20 rounded-xl px-3 text-yellow-200 text-sm outline-none focus:border-yellow-400/40"
          />
        )}
      </div>
    </div>
  );
}

function BroadcastTab({ current }: { current: AppAnnouncement }) {
  const [form, setForm] = useState<AppAnnouncement>(current);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setForm(current); }, [current.updatedAt]);

  const save = async () => {
    setSaving(true);
    try {
      await adminService.updateAnnouncement(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const activeMeta = ANNOUNCEMENT_TYPES.find(t => t.id === form.type)!;
  const ActiveIcon = activeMeta.icon;

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-white/35 font-bold">Active announcements appear as a banner for all users immediately.</p>

      {/* Active toggle */}
      <div className="flex items-center justify-between p-4 bg-[#0e0e14] border border-white/8 rounded-2xl">
        <div className="flex items-center gap-3">
          {form.active
            ? <Bell size={18} className="text-primary" />
            : <BellOff size={18} className="text-white/30" />}
          <div>
            <p className="text-sm font-bold text-white">Broadcast Active</p>
            <p className="text-[11px] text-white/35">{form.active ? 'Users are seeing this banner' : 'Banner is hidden'}</p>
          </div>
        </div>
        <ToggleSwitch checked={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
      </div>

      {/* Type selector */}
      <div>
        <p className="text-[9px] text-white/35 font-black uppercase tracking-widest mb-2">Announcement Type</p>
        <div className="grid grid-cols-2 gap-2">
          {ANNOUNCEMENT_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setForm(f => ({ ...f, type: t.id }))}
              className={clsx(
                'flex items-center gap-2 p-3 rounded-xl border text-sm font-bold transition-all',
                form.type === t.id ? `${t.bg} ${t.color}` : 'bg-white/3 border-white/8 text-white/40 hover:text-white/60'
              )}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <p className="text-[9px] text-white/35 font-black uppercase tracking-widest mb-2">Title</p>
        <input
          type="text"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="e.g. New Feature Available!"
          className="w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 text-white text-sm outline-none focus:border-primary/50 transition-colors"
          maxLength={60}
        />
      </div>

      {/* Message */}
      <div>
        <p className="text-[9px] text-white/35 font-black uppercase tracking-widest mb-2">Message</p>
        <textarea
          value={form.message}
          onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          placeholder="Your message to all users…"
          rows={3}
          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary/50 transition-colors resize-none"
          maxLength={200}
        />
      </div>

      {/* Expiry */}
      <div>
        <p className="text-[9px] text-white/35 font-black uppercase tracking-widest mb-2">Auto-hide After (optional)</p>
        <input
          type="datetime-local"
          value={form.expiresAt ? new Date(form.expiresAt).toISOString().slice(0, 16) : ''}
          onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value ? new Date(e.target.value).getTime() : null }))}
          className="w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 text-white text-sm outline-none focus:border-primary/50 [color-scheme:dark]"
        />
      </div>

      {/* Preview */}
      {form.title && (
        <div>
          <p className="text-[9px] text-white/35 font-black uppercase tracking-widest mb-2">Preview</p>
          <div className={clsx('flex items-start gap-3 p-4 rounded-2xl border', activeMeta.bg)}>
            <ActiveIcon size={16} className={clsx(activeMeta.color, 'mt-0.5 shrink-0')} />
            <div>
              <p className={clsx('text-sm font-black', activeMeta.color)}>{form.title || '(no title)'}</p>
              {form.message && <p className="text-white/60 text-xs mt-1">{form.message}</p>}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="w-full h-13 py-3.5 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : null}
        {saved ? 'Saved!' : 'Push to All Users'}
      </button>
    </div>
  );
}

function UsersTab({ users, loading, onRefresh }: { users: AdminUser[]; loading: boolean; onRefresh: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-white/35 font-black uppercase tracking-widest">{users.length} Registered Users</p>
        <button onClick={onRefresh} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={24} className="text-primary animate-spin" /></div>
      ) : users.length === 0 ? (
        <p className="text-center text-white/30 text-sm py-10">No users found in Firestore</p>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="p-4 bg-[#0e0e14] border border-white/8 rounded-2xl">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{u.email ?? '(no email)'}</p>
                  {u.displayName && (
                    <p className="text-[11px] text-white/40 truncate">{u.displayName}</p>
                  )}
                </div>
                {u.initialBalance != null && (
                  <span className="text-[10px] font-black text-primary/80 shrink-0">₹{u.initialBalance.toLocaleString('en-IN')}</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px] text-white/25 font-mono">{u.id.slice(0, 12)}…</span>
                {u.lastLogin && (
                  <span className="text-[10px] text-white/25">
                    Last login {formatDistanceToNow(u.lastLogin as number, { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const EVENT_COLORS: Record<string, string> = {
  APP_OPEN: 'text-blue-400',
  MANUAL_ENTRY: 'text-green-400',
  VOICE_ENTRY_USED: 'text-purple-400',
  RECEIPT_SCANNED: 'text-orange-400',
};

function EventsTab({ events, loading, onRefresh }: { events: AppEvent[]; loading: boolean; onRefresh: () => void }) {
  const [filter, setFilter] = useState('');
  const types = [...new Set(events.map(e => e.eventType))];
  const filtered = filter ? events.filter(e => e.eventType === filter) : events;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-white/35 font-black uppercase tracking-widest">{events.length} Events</p>
        <button onClick={onRefresh} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Type filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('')}
          className={clsx('px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all', !filter ? 'bg-primary text-white' : 'bg-white/5 text-white/40')}
        >All</button>
        {types.map(t => (
          <button
            key={t}
            onClick={() => setFilter(f => f === t ? '' : t)}
            className={clsx('px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all', filter === t ? 'bg-primary text-white' : 'bg-white/5 text-white/40')}
          >{t}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={24} className="text-primary animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-white/30 text-sm py-10">No events logged yet</p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((ev, i) => (
            <div key={ev.id ?? i} className="flex items-start gap-3 p-3 bg-[#0e0e14] border border-white/5 rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={clsx('text-xs font-mono font-black', EVENT_COLORS[ev.eventType] ?? 'text-white/60')}>
                    {ev.eventType}
                  </span>
                  <span className="text-[10px] text-white/25 font-mono truncate">{ev.userId.slice(0, 8)}…</span>
                </div>
                <p className="text-[10px] text-white/25 mt-0.5">
                  {format(ev.createdAt, 'dd MMM yyyy, HH:mm:ss')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [toggles, setToggles] = useState<AdminFeatureToggles>(adminService.getToggles());
  const [announcement, setAnnouncement] = useState<AppAnnouncement>(adminService.getAnnouncement());
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  // Live sync indicators
  useEffect(() => {
    const unsubToggles = adminService.subscribe(() => setToggles(adminService.getToggles()));
    const unsubAnnouncement = adminService.subscribeAnnouncement(() => setAnnouncement(adminService.getAnnouncement()));
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      unsubToggles();
      unsubAnnouncement();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try { setUsers(await adminService.fetchUsers()); } finally { setLoadingUsers(false); }
  }, []);

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    try { setEvents(await adminService.fetchEvents(200)); } finally { setLoadingEvents(false); }
  }, []);

  useEffect(() => {
    loadUsers();
    loadEvents();
  }, [loadUsers, loadEvents]);

  // Reload data when switching to relevant tabs
  useEffect(() => {
    if (tab === 'users') loadUsers();
    if (tab === 'events') loadEvents();
  }, [tab, loadUsers, loadEvents]);

  return (
    <div className="min-h-screen bg-[#070709] text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-50 px-5 py-4 bg-[#070709]/90 backdrop-blur-xl border-b border-white/5 flex items-center justify-between">
        <div>
          <h1 className="text-base font-black text-white tracking-tight">Smart Spend Admin</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            {online
              ? <><Wifi size={10} className="text-green-400" /><span className="text-[10px] text-green-400 font-bold">Live sync active</span></>
              : <><WifiOff size={10} className="text-red-400" /><span className="text-[10px] text-red-400 font-bold">Offline</span></>}
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-red-400 transition-colors"
        >
          <LogOut size={14} /> Lock
        </button>
      </header>

      {/* Tab nav */}
      <div className="flex gap-1 px-4 py-3 border-b border-white/5 overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap',
              tab === t.id ? 'bg-primary text-white' : 'text-white/35 hover:text-white/60 hover:bg-white/5'
            )}
          >
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-5 py-5 pb-24 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {tab === 'overview'  && <OverviewTab toggles={toggles} users={users} events={events} />}
            {tab === 'features'  && <FeaturesTab toggles={toggles} onUpdate={p => adminService.updateToggles(p)} />}
            {tab === 'broadcast' && <BroadcastTab current={announcement} />}
            {tab === 'users'     && <UsersTab users={users} loading={loadingUsers} onRefresh={loadUsers} />}
            {tab === 'events'    && <EventsTab events={events} loading={loadingEvents} onRefresh={loadEvents} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
