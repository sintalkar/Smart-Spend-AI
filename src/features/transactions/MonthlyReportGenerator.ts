import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TransactionEntity, TransactionType } from '../../db/models';
import { db } from '../../db/database';
import { startOfMonth, endOfMonth, format } from 'date-fns';

const PRIMARY = [108, 99, 255] as [number, number, number];
const SUCCESS = [16, 185, 129] as [number, number, number];
const ERROR   = [244, 63, 94]  as [number, number, number];
const SURFACE = [18, 18, 23]   as [number, number, number];
const GRAY    = [120, 120, 140] as [number, number, number];

const CATEGORY_NAMES: Record<string, string> = {
  food_dining: 'Food & Dining',
  transportation: 'Transport',
  shopping: 'Shopping',
  entertainment: 'Entertainment',
  bills_utilities: 'Bills & Utilities',
  salary: 'Salary',
  groceries: 'Groceries',
  other: 'Other',
};

function drawRect(doc: jsPDF, x: number, y: number, w: number, h: number, rgb: [number,number,number], alpha = 1) {
  doc.setFillColor(...rgb);
  doc.roundedRect(x, y, w, h, 2, 2, 'F');
}

function sectionTitle(doc: jsPDF, text: string, y: number) {
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.text(text.toUpperCase(), 14, y);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.4);
  doc.line(14, y + 1.5, 196, y + 1.5);
}

export async function generateMonthlyReport(year: number, month: number): Promise<void> {
  const start = startOfMonth(new Date(year, month - 1)).getTime();
  const end   = endOfMonth(new Date(year, month - 1)).getTime();

  const txs = await db.transactions
    .where('dateTime').between(start, end, true, true)
    .filter(t => t.isDeleted === 0)
    .toArray();

  const budget = await db.budgets.get({ categoryId: 'global' });
  const budgetLimit = budget?.amount ?? 0;

  const totalIncome  = txs.filter(t => t.type === TransactionType.CREDIT).reduce((s, t) => s + t.amount, 0);
  const totalExpense = txs.filter(t => t.type === TransactionType.DEBIT).reduce((s, t) => s + t.amount, 0);
  const savings      = totalIncome - totalExpense;
  const savingsRate  = totalIncome > 0 ? Math.round((savings / totalIncome) * 100) : 0;
  const budgetUsed   = budgetLimit > 0 ? Math.min(Math.round((totalExpense / budgetLimit) * 100), 100) : 0;

  // Category breakdown
  const catMap: Record<string, number> = {};
  txs.filter(t => t.type === TransactionType.DEBIT).forEach(t => {
    catMap[t.categoryId] = (catMap[t.categoryId] ?? 0) + t.amount;
  });
  const categories = Object.entries(catMap)
    .map(([id, amt]) => ({ id, name: CATEGORY_NAMES[id] ?? id, amount: amt }))
    .sort((a, b) => b.amount - a.amount);

  // Top merchants
  const merchantMap: Record<string, number> = {};
  txs.filter(t => t.type === TransactionType.DEBIT && (t.merchantName || t.note)).forEach(t => {
    const key = t.merchantName || t.note || 'Other';
    merchantMap[key] = (merchantMap[key] ?? 0) + t.amount;
  });
  const topMerchants = Object.entries(merchantMap)
    .map(([name, amt]) => ({ name, amount: amt }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy');

  // ── Cover Header ──────────────────────────────────────────────────────────
  drawRect(doc, 0, 0, 210, 38, SURFACE);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY);
  doc.text('SmartSpend', 14, 14);

  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.setFont('helvetica', 'normal');
  doc.text('Your Intelligent Financial Companion', 14, 20);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`Monthly Report — ${monthLabel}`, 14, 30);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(`Generated: ${new Date().toLocaleString()}   ·   ${txs.length} transactions`, 14, 36);

  let y = 48;

  // ── Summary Cards ─────────────────────────────────────────────────────────
  sectionTitle(doc, 'Monthly Summary', y); y += 8;

  const cards = [
    { label: 'Total Income',   value: `₹${totalIncome.toLocaleString('en-IN')}`,  color: SUCCESS },
    { label: 'Total Expense',  value: `₹${totalExpense.toLocaleString('en-IN')}`, color: ERROR },
    { label: 'Net Savings',    value: `₹${Math.max(savings, 0).toLocaleString('en-IN')}`, color: PRIMARY },
    { label: 'Savings Rate',   value: `${savingsRate}%`, color: savingsRate >= 20 ? SUCCESS : ERROR },
  ];

  const cw = (210 - 28 - 9) / 4;
  cards.forEach((card, i) => {
    const cx = 14 + i * (cw + 3);
    drawRect(doc, cx, y, cw, 22, [20, 20, 28]);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY);
    doc.text(card.label.toUpperCase(), cx + 3, y + 7);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...card.color);
    doc.text(card.value, cx + 3, y + 17);
  });
  y += 30;

  // ── Budget Progress ───────────────────────────────────────────────────────
  if (budgetLimit > 0) {
    sectionTitle(doc, 'Budget vs Actual', y); y += 8;

    drawRect(doc, 14, y, 182, 18, [20, 20, 28]);
    // track
    doc.setFillColor(40, 40, 55);
    doc.roundedRect(18, y + 10, 174, 4, 2, 2, 'F');
    // fill
    const fillW = Math.min((totalExpense / budgetLimit) * 174, 174);
    const barColor: [number,number,number] = budgetUsed > 90 ? ERROR : budgetUsed > 70 ? [251, 146, 60] : SUCCESS;
    doc.setFillColor(...barColor);
    doc.roundedRect(18, y + 10, fillW, 4, 2, 2, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 200, 220);
    doc.text(`₹${totalExpense.toLocaleString('en-IN')} spent of ₹${budgetLimit.toLocaleString('en-IN')} limit  (${budgetUsed}%)`, 18, y + 7);
    y += 26;
  }

  // ── Category Breakdown ────────────────────────────────────────────────────
  if (categories.length > 0) {
    sectionTitle(doc, 'Spending by Category', y); y += 8;

    const maxAmt = categories[0].amount;
    categories.slice(0, 7).forEach((cat, i) => {
      const rowY = y + i * 9;
      const barW = (cat.amount / maxAmt) * 110;
      // label
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(200, 200, 220);
      doc.text(cat.name, 14, rowY + 5);
      // bar track
      doc.setFillColor(35, 35, 48);
      doc.roundedRect(72, rowY + 1, 110, 5, 2, 2, 'F');
      // bar fill
      const shade: [number,number,number] = i === 0 ? ERROR : i <= 2 ? [251, 146, 60] : PRIMARY;
      doc.setFillColor(...shade);
      doc.roundedRect(72, rowY + 1, barW, 5, 2, 2, 'F');
      // amount
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...shade);
      doc.text(`₹${cat.amount.toLocaleString('en-IN')}`, 186, rowY + 5, { align: 'right' });
    });
    y += categories.slice(0, 7).length * 9 + 8;
  }

  // ── Top Merchants ─────────────────────────────────────────────────────────
  if (topMerchants.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    sectionTitle(doc, 'Top Merchants', y); y += 8;

    autoTable(doc, {
      head: [['Merchant / Note', 'Amount Spent']],
      body: topMerchants.map(m => [
        m.name,
        `₹${m.amount.toLocaleString('en-IN')}`,
      ]),
      startY: y,
      theme: 'plain',
      headStyles: { fillColor: [25, 25, 35], textColor: [108, 99, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { textColor: [200, 200, 220], fontSize: 8 },
      alternateRowStyles: { fillColor: [20, 20, 28] },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Full Transaction Table ────────────────────────────────────────────────
  if (txs.length > 0) {
    if (y > 200) { doc.addPage(); y = 20; }
    sectionTitle(doc, 'Transaction Log', y); y += 6;

    autoTable(doc, {
      head: [['Date', 'Merchant / Note', 'Category', 'Type', 'Amount']],
      body: txs
        .sort((a, b) => b.dateTime - a.dateTime)
        .map(t => [
          format(new Date(t.dateTime), 'dd MMM'),
          (t.merchantName || t.note || '—').substring(0, 28),
          CATEGORY_NAMES[t.categoryId] ?? t.categoryId,
          t.type === TransactionType.CREDIT ? 'Credit' : 'Debit',
          t.type === TransactionType.CREDIT
            ? `+₹${t.amount.toLocaleString('en-IN')}`
            : `-₹${t.amount.toLocaleString('en-IN')}`,
        ]),
      startY: y,
      theme: 'grid',
      headStyles: { fillColor: PRIMARY, fontSize: 8, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 7.5, textColor: [220, 220, 230] },
      alternateRowStyles: { fillColor: [18, 18, 26] },
      columnStyles: {
        3: { halign: 'center' },
        4: { halign: 'right', fontStyle: 'bold' },
      },
      didParseCell(data) {
        if (data.column.index === 4 && data.section === 'body') {
          const v = String(data.cell.raw);
          data.cell.styles.textColor = v.startsWith('+') ? SUCCESS : [240, 240, 255];
        }
      },
      margin: { left: 14, right: 14 },
    });
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(
      `SmartSpend AI  ·  ${monthLabel}  ·  Page ${p} of ${pageCount}`,
      105, 292, { align: 'center' }
    );
  }

  doc.save(`SmartSpend_${format(new Date(year, month - 1), 'yyyy-MM')}_Report.pdf`);
}
