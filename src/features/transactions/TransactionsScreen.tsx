import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trash2, ShoppingBag, Coffee, Car, Activity, FileText,
  Search, X, Filter, Download, RefreshCw, Repeat,
} from 'lucide-react';
import { db } from '../../db';
import { TransactionType } from '../../db/models';
import { hapticFeedback } from '../../core/utils/haptics';
import { TransactionEditModal } from './TransactionEditModal';
import { generateMonthlyReport } from './MonthlyReportGenerator';
import clsx from 'clsx';
import { EmptyState } from '../../core/ui/EmptyState';
import { startOfMonth, endOfMonth, startOfWeek, subMonths } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const categoryIcons: Record<string, any> = {
  food_dining: Coffee, transportation: Car, shopping: ShoppingBag,
  entertainment: Activity, bills_utilities: FileText, salary: Activity,
  groceries: ShoppingBag, other: Activity,
};
const categoryNames: Record<string, string> = {
  food_dining: 'Food & Dining', transportation: 'Transport',
  shopping: 'Shopping', entertainment: 'Entertainment',
  bills_utilities: 'Bills', salary: 'Salary',
  groceries: 'Groceries', other: 'Other',
};

type TypeFilter   = 'all' | 'debit' | 'credit';
type PeriodFilter = 'all' | 'this_month' | 'last_month' | 'this_week';

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  all: 'All Time', this_month: 'This Month',
  last_month: 'Last Month', this_week: 'This Week',
};

const PAGE_SIZE = 20;

export default function TransactionsScreen() {
  const navigate = useNavigate();

  // ── search & filter state ──────────────────────────────────────────────
  const [search, setSearch]           = useState('');
  const [typeFilter, setTypeFilter]   = useState<TypeFilter>('all');
  const [period, setPeriod]           = useState<PeriodFilter>('all');
  const [catFilter, setCatFilter]     = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // ── pagination ─────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);

  // reset page when filters change
  useEffect(() => { setPage(1); }, [search, typeFilter, period, catFilter]);

  // ── edit modal ─────────────────────────────────────────────────────────
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);

  // ── PDF state ──────────────────────────────────────────────────────────
  const [isExporting, setIsExporting]       = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const now = new Date();
  const [reportYear, setReportYear]   = useState(now.getFullYear());
  const [reportMonth, setReportMonth] = useState(now.getMonth() + 1);

  // ── data ───────────────────────────────────────────────────────────────
  const allTransactions = useLiveQuery(
    () => db.transactions.where('isDeleted').equals(0).reverse().sortBy('dateTime')
  ) || [];

  // Distinct categories present in data (for category filter chips)
  const distinctCats = useMemo(() => {
    const seen = new Set<string>();
    allTransactions.forEach(t => seen.add(t.categoryId));
    return Array.from(seen);
  }, [allTransactions]);

  // ── filtered list ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();

    const periodBounds: Record<PeriodFilter, [number, number]> = {
      all:        [0, Infinity],
      this_month: [startOfMonth(now).getTime(), endOfMonth(now).getTime()],
      last_month: [startOfMonth(subMonths(now, 1)).getTime(), endOfMonth(subMonths(now, 1)).getTime()],
      this_week:  [startOfWeek(now, { weekStartsOn: 1 }).getTime(), now],
    };
    const [pStart, pEnd] = periodBounds[period];

    return allTransactions.filter(t => {
      if (typeFilter === 'debit'  && t.type !== TransactionType.DEBIT)  return false;
      if (typeFilter === 'credit' && t.type !== TransactionType.CREDIT) return false;
      if (catFilter !== 'all' && t.categoryId !== catFilter) return false;
      if (t.dateTime < pStart || t.dateTime > pEnd) return false;
      if (q) {
        const inNote     = t.note?.toLowerCase().includes(q) ?? false;
        const inMerchant = t.merchantName?.toLowerCase().includes(q) ?? false;
        if (!inNote && !inMerchant) return false;
      }
      return true;
    });
  }, [allTransactions, search, typeFilter, period, catFilter]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore   = paginated.length < filtered.length;

  const activeFilterCount = [
    typeFilter !== 'all', period !== 'all', catFilter !== 'all',
  ].filter(Boolean).length;

  // ── handlers ───────────────────────────────────────────────────────────
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    hapticFeedback.warning();
    try {
      await db.transactions.update(id, { isDeleted: 1 });
      hapticFeedback.success();
    } catch {
      hapticFeedback.error();
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    setShowMonthPicker(false);
    try {
      await generateMonthlyReport(reportYear, reportMonth);
    } catch (e) {
      console.error('PDF export failed', e);
    } finally {
      setIsExporting(false);
    }
  };

  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];

  return (
    <div className="flex flex-col h-full bg-background pt-safe pb-32 overflow-y-auto no-scrollbar">

      {/* ── Header ── */}
      <header className="px-6 py-4 sticky top-0 bg-background/40 backdrop-blur-3xl z-30 border-b border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="title-bold !mb-0 text-sm uppercase tracking-[0.2em] text-white">History</h2>
          <div className="flex items-center gap-2">
            {/* Recurring detector shortcut */}
            <button
              onClick={() => navigate('/recurring')}
              className="w-9 h-9 rounded-xl glass flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
              aria-label="Recurring payments"
              title="Recurring payments"
            >
              <Repeat size={15} />
            </button>
            {/* Monthly report */}
            {allTransactions.length > 0 && (
              <button
                onClick={() => setShowMonthPicker(v => !v)}
                className="w-9 h-9 rounded-xl glass flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                aria-label="Export monthly report"
                title="Export monthly report"
              >
                {isExporting
                  ? <RefreshCw size={15} className="animate-spin" />
                  : <Download size={15} />}
              </button>
            )}
            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(v => !v)}
              className={clsx(
                'w-9 h-9 rounded-xl glass flex items-center justify-center transition-colors relative',
                showFilters ? 'text-primary bg-primary/10 border border-primary/30' : 'text-gray-400 hover:text-white',
              )}
              aria-label="Toggle filters"
            >
              <Filter size={15} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-[9px] font-black text-white flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search merchant or note…"
            className="w-full h-10 bg-white/5 border border-white/8 rounded-2xl pl-9 pr-9 text-sm text-white placeholder:text-white/25 outline-none focus:border-primary/50 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden space-y-3"
            >
              {/* Type chips */}
              <div className="flex gap-2">
                {(['all', 'debit', 'credit'] as TypeFilter[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={clsx(
                      'px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border',
                      typeFilter === t
                        ? 'bg-primary text-white border-primary/50 shadow-lg shadow-primary/20'
                        : 'bg-white/5 text-gray-400 border-white/8 hover:bg-white/10',
                    )}
                  >
                    {t === 'all' ? 'All' : t === 'debit' ? 'Expense' : 'Income'}
                  </button>
                ))}
              </div>

              {/* Period chips */}
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={clsx(
                      'px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border',
                      period === p
                        ? 'bg-primary text-white border-primary/50'
                        : 'bg-white/5 text-gray-400 border-white/8 hover:bg-white/10',
                    )}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>

              {/* Category chips */}
              {distinctCats.length > 0 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  <button
                    onClick={() => setCatFilter('all')}
                    className={clsx(
                      'shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all',
                      catFilter === 'all'
                        ? 'bg-primary text-white border-primary/50'
                        : 'bg-white/5 text-gray-400 border-white/8',
                    )}
                  >
                    All Categories
                  </button>
                  {distinctCats.map(cid => (
                    <button
                      key={cid}
                      onClick={() => setCatFilter(cid)}
                      className={clsx(
                        'shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all',
                        catFilter === cid
                          ? 'bg-primary text-white border-primary/50'
                          : 'bg-white/5 text-gray-400 border-white/8',
                      )}
                    >
                      {categoryNames[cid] ?? cid}
                    </button>
                  ))}
                </div>
              )}

              {/* Clear all */}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setTypeFilter('all'); setPeriod('all'); setCatFilter('all'); }}
                  className="text-[10px] text-error font-black uppercase tracking-widest hover:text-white transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Month Picker Modal ── */}
      <AnimatePresence>
        {showMonthPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowMonthPicker(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.92, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 30, opacity: 0 }}
              className="relative w-full max-w-sm bg-[#121217] border border-white/10 rounded-[28px] p-6 shadow-2xl z-10"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 blur-[60px] rounded-full -z-10" />
              <h3 className="text-lg font-extrabold text-white mb-1">Monthly Report</h3>
              <p className="text-xs text-white/40 font-bold mb-5">Select a month to export as PDF</p>

              {/* Year */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setReportYear(y => y - 1)}
                  className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
                >‹</button>
                <span className="text-white font-extrabold text-base">{reportYear}</span>
                <button
                  onClick={() => setReportYear(y => Math.min(y + 1, new Date().getFullYear()))}
                  className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
                >›</button>
              </div>

              {/* Month grid */}
              <div className="grid grid-cols-4 gap-2 mb-6">
                {months.map((m, i) => {
                  const isFuture = reportYear === now.getFullYear() && i + 1 > now.getMonth() + 1;
                  const isSelected = reportMonth === i + 1;
                  return (
                    <button
                      key={m}
                      disabled={isFuture}
                      onClick={() => setReportMonth(i + 1)}
                      className={clsx(
                        'h-10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border',
                        isSelected
                          ? 'bg-primary text-white border-primary/50 shadow-lg shadow-primary/20'
                          : isFuture
                          ? 'bg-white/3 text-white/15 border-white/5 cursor-not-allowed'
                          : 'bg-white/5 text-gray-400 border-white/8 hover:bg-white/10 hover:text-white',
                      )}
                    >
                      {m.slice(0, 3)}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowMonthPicker(false)}
                  className="flex-1 h-12 rounded-2xl bg-white/5 text-gray-300 font-semibold text-sm hover:bg-white/10 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="flex-1 h-12 rounded-2xl bg-primary text-white font-semibold text-sm shadow-lg shadow-primary/20 active:scale-95 transition-all border border-white/10 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isExporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                  {isExporting ? 'Generating…' : 'Export PDF'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Result count ── */}
      {(search || activeFilterCount > 0) && (
        <div className="px-6 pt-4">
          <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            {search && ` for "${search}"`}
          </p>
        </div>
      )}

      {/* ── Transaction list ── */}
      <div className="px-6 py-4 space-y-3">
        {filtered.length === 0 ? (
          allTransactions.length === 0 ? (
            <EmptyState
              title="Empty Vault"
              description="No transactions yet. Start by adding one manually."
            />
          ) : (
            <EmptyState
              title="No matches"
              description="Try adjusting your search or filters."
            />
          )
        ) : (
          <>
            <AnimatePresence>
              {paginated.map((tx, idx) => {
                const Icon     = categoryIcons[tx.categoryId] || Activity;
                const isCredit = tx.type === TransactionType.CREDIT;
                const dateStr  = new Date(tx.dateTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -80 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                    className="relative glass-card rounded-3xl overflow-hidden border-white/5 cursor-pointer"
                    onClick={() => setSelectedTransaction(tx)}
                  >
                    {/* Delete reveal */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-20 bg-error flex items-center justify-end px-5 cursor-pointer"
                      onClick={e => handleDelete(tx.id, e)}
                    >
                      <Trash2 size={18} className="text-white" />
                    </div>

                    <motion.div
                      drag="x"
                      dragConstraints={{ left: -72, right: 0 }}
                      dragElastic={0.1}
                      className="relative glass p-4 flex items-center gap-4 z-10"
                    >
                      <div className={clsx(
                        'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border',
                        isCredit
                          ? 'bg-success/10 border-success/20 text-success'
                          : 'bg-primary/10 border-primary/20 text-primary',
                      )}>
                        <Icon size={20} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-[9px] text-white/35 font-black uppercase tracking-[0.2em]">
                            {categoryNames[tx.categoryId] ?? tx.categoryId}
                          </p>
                          {tx.isRecurring === 1 && (
                            <span className="text-[8px] font-black text-primary/70 bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                              Recurring
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-white font-bold tracking-tight truncate">
                          {tx.merchantName || tx.note || 'Untitled entry'}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={clsx(
                          'text-base font-mono font-black tracking-tight',
                          isCredit ? 'text-success' : 'text-white',
                        )}>
                          {isCredit ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                        </p>
                        <p className="text-[9px] text-white/25 font-bold uppercase tracking-widest">{dateStr}</p>
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {hasMore && (
              <button
                onClick={() => setPage(p => p + 1)}
                className="w-full py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary glass-button rounded-3xl mt-2"
              >
                Load {Math.min(PAGE_SIZE, filtered.length - paginated.length)} more
              </button>
            )}
          </>
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
