// PDF building blocks shared by the itinerary and group-fund PDFs, plus the group-fund PDF itself.
import { jsPDF } from 'jspdf';
import { parse, fmtRange } from './dates.js';
import { fmtNumber, money } from './currency.js';
import { fundStats, fromSen, settleUp, YOU } from './model.js';

export const PDF = {
  W: 210, H: 297, M: 15,
  accent: [163, 25, 91], grey: [108, 108, 112], ink: [20, 20, 22], green: [30, 123, 52], orange: [179, 86, 0], line: [225, 225, 230],
};

const today = () => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());

// Built-in PDF fonts only cover Western characters; swap common symbols and drop the rest.
export function pdfText(s) {
  return String(s || '')
    .replace(/→/g, '->').replace(/⇄|↔/g, '<->').replace(/←/g, '<-').replace(/−/g, '-')
    .replace(/[^\x20-\x7E -ÿ–—‘’“”•…€]/g, '')
    .replace(/\s{2,}/g, ' ').trim();
}

export function newDoc() {
  return new jsPDF({ unit: 'mm', format: 'a4' });
}

// Organiser logo and name (if set), trip name and a few grey lines. Returns the y to continue from.
export function pdfHeader(doc, trip, organiser, lines, kicker) {
  const { W, M, accent, grey, ink } = PDF;
  let y = M;
  let textX = M;
  if (organiser?.logo) {
    try {
      const type = organiser.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(organiser.logo, type, M, y, 18, 18);
      textX = M + 23;
    } catch { /* bad image: skip */ }
  }
  const over = [organiser?.name, kicker].filter(Boolean).join('  ·  ');
  if (over) {
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...accent);
    doc.text(pdfText(over).toUpperCase(), textX, y + 4);
    y += 6;
  }
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...ink);
  doc.text(pdfText(trip.name), textX, y + 7);
  y += 13;
  doc.setFont('helvetica', 'normal').setFontSize(10.5).setTextColor(...grey);
  for (const l of lines.filter(Boolean)) {
    const wrapped = doc.splitTextToSize(pdfText(l), W - M - textX);
    doc.text(wrapped, textX, y);
    y += wrapped.length * 4.6 + 0.8;
  }
  return Math.max(y + 4, organiser?.logo ? M + 24 : 0);
}

// Contact details, "Made with Jalan" and page numbers on every page.
export function pdfFooter(doc, organiser) {
  const { W, H, M, grey, line } = PDF;
  const pages = doc.getNumberOfPages();
  const contact = pdfText([organiser?.phone, organiser?.email].filter(Boolean).join('  ·  '));
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...grey);
    doc.setDrawColor(...line).setLineWidth(0.2).line(M, H - M - 5, W - M, H - M - 5);
    if (contact) doc.text(contact, M, H - M);
    doc.text(`Made with Jalan · ${today()}`, W / 2, H - M, { align: 'center' });
    doc.text(`Page ${i} of ${pages}`, W - M, H - M, { align: 'right' });
  }
}

// ---------- group fund PDF ----------
export function fundPDF(trip, { organiser, home = 'MYR' } = {}) {
  const doc = newDoc();
  const { W, H, M, accent, grey, ink, green, orange, line } = PDF;
  const CW = W - 2 * M;
  const f = trip.fund;
  const s = fundStats(trip);
  const m = (sen) => pdfText(money(fromSen(sen), home));
  const nameOf = (id) => { const x = f.members.find((y) => y.id === id); return x ? (x.id === YOU ? 'You' : x.name) : 'Someone'; };
  const day = (d) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(parse(d));
  const n = f.members.length;

  let y = pdfHeader(doc, trip, organiser, [
    fmtRange(trip.start, trip.end),
    `${n} ${n === 1 ? 'member' : 'members'}${f.perPerson ? ` · ${money(fromSen(f.perPerson), home)} each` : ''}`,
  ], 'Group fund');

  const bottom = H - M - 16;
  const ensure = (h) => { if (y + h > bottom) { doc.addPage(); y = M; } };
  const heading = (t) => {
    ensure(18);
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...ink).text(t, M, y + 5);
    y += 9;
  };
  const colX = (cols) => cols.reduce((a, c, i) => { a.push(i ? a[i - 1] + cols[i - 1].w : M); return a; }, []);
  const cell = (cols, xs, i, txt, yy) => {
    if (cols[i].r) doc.text(txt, xs[i] + cols[i].w - 2, yy, { align: 'right' });
    else doc.text(txt, xs[i] + (i ? 3 : 1.5), yy);
  };
  const headerRow = (cols, xs) => {
    ensure(15);
    doc.setFillColor(242, 242, 247).rect(M, y, CW, 7, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...grey);
    cols.forEach((c, i) => cell(cols, xs, i, c.t.toUpperCase(), y + 4.8));
    y += 7;
  };
  const rule = () => doc.setDrawColor(...line).setLineWidth(0.2).line(M, y, M + CW, y);

  // Summary boxes
  const boxes = [['In the fund now', m(s.balance)], ['Collected', m(s.collected)], ['Spent from fund', m(s.spent)]];
  const bw = (CW - 8) / 3;
  boxes.forEach(([label, val], i) => {
    const x = M + i * (bw + 4);
    doc.setFillColor(253, 235, 242).roundedRect(x, y, bw, 19, 2.5, 2.5, 'F');
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...accent).text(label.toUpperCase(), x + 4, y + 6.5);
    doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(...ink).text(val, x + 4, y + 14.5);
  });
  y += 24;
  const notes = [];
  if (n) notes.push(`Spent per person ${m(Math.round(s.spent / n))}`);
  if (s.own) notes.push(`Paid from own pocket ${m(s.own)} (not from the fund)`);
  if (notes.length) {
    doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...grey).text(notes.join('   ·   '), M, y + 1);
    y += 6;
  }
  y += 4;

  // Members
  heading('Members');
  const mc = [{ t: 'Name', w: 44 }, { t: 'Paid in', w: 27, r: true }, { t: 'Own pocket', w: 27, r: true }, { t: 'Share', w: 27, r: true }, { t: 'Result', w: CW - 44 - 27 * 3 }];
  const mx = colX(mc);
  headerRow(mc, mx);
  for (const mem of f.members) {
    const p = s.per[mem.id] || { paid: 0, paidIn: 0, share: 0, result: 0 };
    const due = mem.target > 0 ? Math.max(0, mem.target - p.paidIn) : 0;
    const rh = due ? 12 : 8;
    ensure(rh);
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...ink);
    cell(mc, mx, 0, pdfText(nameOf(mem.id)), y + 5.3);
    if (due) doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...orange).text(`${m(due)} still to pay`, mx[0] + 1.5, y + 9.6);
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...ink);
    cell(mc, mx, 1, m(p.paidIn), y + 5.3);
    cell(mc, mx, 2, p.paid - p.paidIn ? m(p.paid - p.paidIn) : '-', y + 5.3);
    cell(mc, mx, 3, m(p.share), y + 5.3);
    const settled = !!f.settledAt || p.result === 0;
    doc.setFont('helvetica', 'bold').setTextColor(...(settled ? grey : p.result > 0 ? green : orange));
    cell(mc, mx, 4, settled ? 'Settled' : p.result > 0 ? `Gets back ${m(p.result)}` : `Owes ${m(-p.result)}`, y + 5.3);
    y += rh;
    rule();
  }
  ensure(9);
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...grey);
  doc.text(doc.splitTextToSize('Paid in = money put into the fund. Share = their part of every cost they were included in. The results add up to what is left in the fund.', CW), M, y + 4.5);
  y += 13;

  // Settle up
  heading('Settle up');
  doc.setFontSize(10);
  if (f.settledAt) {
    doc.setFont('helvetica', 'normal').setTextColor(...green).text(`Settled on ${day(new Date(f.settledAt).toISOString().slice(0, 10))}.`, M, y + 3);
    y += 9;
  } else {
    const tr = settleUp(trip, s);
    if (!tr.length) { doc.setFont('helvetica', 'normal').setTextColor(...grey).text('Everyone is level. Nothing to settle.', M, y + 3); y += 9; }
    for (const t of tr) {
      ensure(7);
      doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...ink);
      doc.text(pdfText(`${t.from.id === YOU ? 'You' : t.from.name}  ->  ${t.to.id === YOU ? 'You' : t.to.name}`), M + 1.5, y + 3);
      doc.setFont('helvetica', 'bold').text(m(t.sen), M + CW - 2, y + 3, { align: 'right' });
      y += 6.5;
    }
    if (tr.length) {
      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...grey).text('"The fund" is the cash held by the organiser.', M, y + 2);
      y += 8;
    }
  }
  y += 4;

  // Cashflow, oldest first like a statement
  heading('Cashflow');
  const cc = [{ t: 'Date', w: 18 }, { t: 'Entry', w: 54 }, { t: 'Details', w: 54 }, { t: 'Amount', w: 27, r: true }, { t: 'Balance', w: CW - 18 - 54 - 54 - 27, r: true }];
  const cx = colX(cc);
  const entries = s.newestFirst.slice().reverse();
  if (!entries.length) {
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...grey).text('No entries yet.', M, y + 3);
  } else headerRow(cc, cx);
  for (const e of entries) {
    const isIn = e.type === 'in', isOut = e.type === 'out';
    const title = isIn ? `${nameOf(e.memberId)} paid in` : e.title || e.category;
    const split = e.splitBetween?.length && e.splitBetween.length < n ? `split: ${e.splitBetween.map(nameOf).join(', ')}` : 'split: everyone';
    const foreign = e.currency !== home ? `${e.currency} ${fmtNumber(e.amount, e.currency)} · ` : '';
    const details = isIn
      ? `${foreign}${e.method === 'transfer' ? 'Transfer' : 'Cash'}`
      : isOut ? `${foreign}${e.category} · ${split}` : `${foreign}Paid by ${nameOf(e.paidBy)} · ${split}`;
    doc.setFontSize(9.5);
    const tl = doc.splitTextToSize(pdfText(title), cc[1].w - 4);
    const dl = doc.splitTextToSize(pdfText(details), cc[2].w - 4);
    const rh = Math.max(tl.length, dl.length) * 4.2 + 3.4;
    ensure(rh);
    doc.setFont('helvetica', 'normal').setTextColor(...grey).text(day(e.date), cx[0] + 1.5, y + 4.6);
    doc.setFont('helvetica', 'bold').setTextColor(...ink).text(tl, cx[1] + 3, y + 4.6);
    doc.setFont('helvetica', 'normal').setTextColor(...grey).text(dl, cx[2] + 3, y + 4.6);
    doc.setFont('helvetica', 'bold').setTextColor(...(isIn ? green : isOut ? accent : grey));
    cell(cc, cx, 3, isIn ? `+${m(e.sen)}` : isOut ? `-${m(e.sen)}` : `(${m(e.sen)})`, y + 4.6);
    doc.setFont('helvetica', 'normal').setTextColor(...ink);
    cell(cc, cx, 4, m(s.running[e.id]), y + 4.6);
    y += rh;
    rule();
  }
  if (s.own) {
    ensure(9);
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...grey);
    doc.text('Amounts in brackets were paid from someone’s own pocket. They do not change the fund balance.', M, y + 4.5);
  }

  pdfFooter(doc, organiser);
  return doc.output('blob');
}
