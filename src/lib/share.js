// Shared output: itinerary PDF, WhatsApp text, calendar (.ics) and group-fund summary.
// Shared copies show plans, times and places only. Expenses and documents are never included;
// the group-fund summary is added only when the user chooses it.
import { PDF, newDoc, pdfFooter, pdfHeader, pdfText } from './pdf.js';
export { fundPDF } from './pdf.js';
import { parse, addDays, fmtRange } from './dates.js';
import { countryName, money } from './currency.js';
import { dayCountry, driveLine, sortedPlans, whoLabel } from './logic.js';
import { fundStats, fromSen, YOU } from './model.js';
import { PLAN_META } from '../meta.jsx';
import { downloadBlob } from './files.js';

// ---------- helpers ----------
export const slug = (s) => (s || 'trip').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'trip';

export function fmtTime12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
}

const fmtDayHead = (s) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(parse(s));
const nowStamp = () => {
  const d = new Date();
  return `${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d)}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
};
const today = () => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());

// Where the group is on a day: the last stay booked on or before it, else the first destination.
export function dayPlace(trip, date) {
  const stays = trip.plans.filter((p) => p.category === 'stay' && p.date <= date && p.place).sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order);
  if (stays.length) {
    const parts = stays[0].place.split(',').map((x) => x.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  const c = dayCountry(trip, date);
  const dest = trip.destinations.find((d) => d.country === c && d.city) || trip.destinations.find((d) => d.city);
  return dest?.city || countryName(c) || '';
}

const placeOf = (p) => (p.category === 'drive' ? driveLine(p) || p.place : p.place) || '';

export function travellerNames(trip) {
  return trip.travellers.map((t) => (t.id === YOU ? 'You' : t.name));
}

function organiserLine(org) {
  if (!org) return '';
  return [org.name, org.phone, org.email].filter(Boolean).join(' · ');
}

export async function deliverFile(blob, name, title) {
  const file = new File([blob], name, { type: blob.type });
  const mobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  if (mobile && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  downloadBlob(blob, name);
  return 'downloaded';
}

export async function shareText(text, toast) {
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(text); toast('Copied. Paste it into WhatsApp.'); }
  catch { toast('Could not copy. Select and copy the text manually.'); }
}

// ---------- WhatsApp text ----------
export function itineraryText(trip, dates, { change = '', organiser } = {}) {
  const lines = [];
  if (change.trim()) lines.push(`Updated ${nowStamp()}: ${change.trim()}`, '');
  lines.push(`*${trip.name}*`);
  const countries = [...new Set(trip.destinations.map((d) => countryName(d.country)).filter(Boolean))].join(', ');
  lines.push(`${fmtRange(trip.start, trip.end)}${trip.domestic ? '' : countries ? ` · ${countries}` : ''}`);
  const names = travellerNames(trip);
  if (names.length > 1) lines.push(`Travellers: ${names.join(', ')}`);
  for (const d of dates) {
    const plans = sortedPlans(trip, d);
    lines.push('', `*Day ${dayIndex(trip, d)} · ${fmtDayHead(d)}${dayPlace(trip, d) ? ` · ${dayPlace(trip, d)}` : ''}*`);
    if (!plans.length) { lines.push('• Free day'); continue; }
    for (const p of plans) {
      const who = whoLabel(trip, p);
      const place = placeOf(p);
      lines.push(`• ${p.time ? fmtTime12(p.time) + ' ' : ''}${p.title}${place ? ` – ${place}` : ''}${who ? ` (${who})` : ''}`);
    }
  }
  const org = organiserLine(organiser);
  if (org) lines.push('', `— ${org}`);
  return lines.join('\n');
}

const dayIndex = (trip, d) => Math.round((parse(d) - parse(trip.start)) / 86400000) + 1;

// ---------- group fund summary text ----------
export function fundText(trip, home, organiser) {
  const s = fundStats(trip);
  const m = (sen) => money(fromSen(sen), home);
  const lines = [`*${trip.name} – group fund*`, `In the fund now: ${m(s.balance)}`, `Collected ${m(s.collected)} · Spent ${m(s.spent)}`, ''];
  for (const mem of trip.fund.members) {
    const p = s.per[mem.id] || { paid: 0, share: 0, result: 0 };
    const res = p.result > 0 ? `gets back ${m(p.result)}` : p.result < 0 ? `owes ${m(-p.result)}` : 'settled';
    lines.push(`• ${mem.id === YOU ? 'You' : mem.name}: paid ${m(p.paid)}, share ${m(p.share)} → ${res}`);
  }
  const last = s.newestFirst.slice(0, 5);
  if (last.length) {
    lines.push('', 'Last entries:');
    const nameOf = (id) => { const x = trip.fund.members.find((y) => y.id === id); return x ? (x.id === YOU ? 'You' : x.name) : 'Someone'; };
    for (const e of last) {
      const label = e.type === 'in' ? `${nameOf(e.memberId)} paid in` : e.type === 'out' ? e.title || e.category : `${e.title || 'Paid'} (by ${nameOf(e.paidBy)})`;
      lines.push(`${e.type === 'in' ? '+' : e.type === 'out' ? '−' : '↗'} ${m(e.sen)} ${label} · ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(parse(e.date))}`);
    }
  }
  const org = organiserLine(organiser);
  if (org) lines.push('', `— ${org}`);
  return lines.join('\n');
}

// ---------- calendar (.ics) ----------
const TZ = {
  MY: 'Asia/Kuala_Lumpur', SG: 'Asia/Singapore', ID: 'Asia/Jakarta', TH: 'Asia/Bangkok', VN: 'Asia/Ho_Chi_Minh', PH: 'Asia/Manila', KH: 'Asia/Phnom_Penh',
  LA: 'Asia/Vientiane', MM: 'Asia/Yangon', BN: 'Asia/Brunei', KR: 'Asia/Seoul', JP: 'Asia/Tokyo', CN: 'Asia/Shanghai', HK: 'Asia/Hong_Kong', MO: 'Asia/Macau',
  TW: 'Asia/Taipei', IN: 'Asia/Kolkata', LK: 'Asia/Colombo', MV: 'Indian/Maldives', NP: 'Asia/Kathmandu', BD: 'Asia/Dhaka', PK: 'Asia/Karachi',
  AE: 'Asia/Dubai', SA: 'Asia/Riyadh', QA: 'Asia/Qatar', OM: 'Asia/Muscat', KW: 'Asia/Kuwait', BH: 'Asia/Bahrain', JO: 'Asia/Amman', TR: 'Europe/Istanbul',
  EG: 'Africa/Cairo', MA: 'Africa/Casablanca', ZA: 'Africa/Johannesburg', KE: 'Africa/Nairobi', GB: 'Europe/London', IE: 'Europe/Dublin', FR: 'Europe/Paris',
  DE: 'Europe/Berlin', IT: 'Europe/Rome', ES: 'Europe/Madrid', PT: 'Europe/Lisbon', NL: 'Europe/Amsterdam', BE: 'Europe/Brussels', CH: 'Europe/Zurich',
  AT: 'Europe/Vienna', CZ: 'Europe/Prague', PL: 'Europe/Warsaw', HU: 'Europe/Budapest', GR: 'Europe/Athens', SE: 'Europe/Stockholm', NO: 'Europe/Oslo',
  DK: 'Europe/Copenhagen', FI: 'Europe/Helsinki', IS: 'Atlantic/Reykjavik', RU: 'Europe/Moscow', AU: 'Australia/Sydney', NZ: 'Pacific/Auckland',
  US: 'America/New_York', CA: 'America/Toronto', MX: 'America/Mexico_City', BR: 'America/Sao_Paulo', AR: 'America/Argentina/Buenos_Aires',
  UZ: 'Asia/Tashkent', KZ: 'Asia/Almaty', MN: 'Asia/Ulaanbaatar', GE: 'Asia/Tbilisi', FJ: 'Pacific/Fiji',
};

function tzOffset(ts, tz) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ts));
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return Date.UTC(+v.year, +v.month - 1, +v.day, +v.hour % 24, +v.minute, +v.second) - ts;
}

// Wall-clock time in a time zone -> UTC timestamp.
function zonedToUtc(date, time, tz) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let utc = guess - tzOffset(guess, tz);
  const second = guess - tzOffset(utc, tz);
  if (second !== utc) utc = second;
  return utc;
}

const icsDate = (s) => s.replace(/-/g, '');
const icsUtc = (ts) => new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsLocal = (date, time) => `${icsDate(date)}T${time.replace(':', '')}00`;
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

function fold(line) {
  const out = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 74) {
    let cut = 74;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
}

// Flights leave from where you were the day before (home on day 1).
function planZone(trip, p, d, homeCountry) {
  if (p.category === 'flight') {
    const first = d <= trip.start;
    return TZ[first ? homeCountry : dayCountry(trip, addDays(d, -1))] || TZ[dayCountry(trip, d)];
  }
  return TZ[dayCountry(trip, d)];
}

export function itineraryICS(trip, dates, homeCountry = 'MY') {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Jalan//Itinerary//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(trip.name)}`];
  const stamp = icsUtc(Date.now());
  for (const d of dates) {
    for (const p of sortedPlans(trip, d)) {
      const meta = PLAN_META[p.category] || PLAN_META.free;
      L.push('BEGIN:VEVENT', `UID:${p.id}@jalan`, `DTSTAMP:${stamp}`);
      if (p.time) {
        const mins = p.category === 'drive' && p.durationMin ? p.durationMin : 60;
        const tz = planZone(trip, p, d, homeCountry);
        if (tz) {
          const start = zonedToUtc(d, p.time, tz);
          L.push(`DTSTART:${icsUtc(start)}`, `DTEND:${icsUtc(start + mins * 60000)}`);
        } else {
          const [h, m] = p.time.split(':').map(Number);
          const endMin = h * 60 + m + mins;
          const endDate = addDays(d, Math.floor(endMin / 1440));
          const em = endMin % 1440;
          L.push(`DTSTART:${icsLocal(d, p.time)}`, `DTEND:${icsLocal(endDate, `${String(Math.floor(em / 60)).padStart(2, '0')}:${String(em % 60).padStart(2, '0')}`)}`);
        }
      } else {
        L.push(`DTSTART;VALUE=DATE:${icsDate(d)}`, `DTEND;VALUE=DATE:${icsDate(addDays(d, 1))}`);
      }
      L.push(`SUMMARY:${esc(p.title)}`);
      const place = placeOf(p);
      if (place) L.push(`LOCATION:${esc(place)}`);
      const who = whoLabel(trip, p);
      L.push(`DESCRIPTION:${esc([meta.label, who, trip.name].filter(Boolean).join(' · '))}`);
      L.push('END:VEVENT');
    }
  }
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}

// ---------- PDF ----------
export function itineraryPDF(trip, dates, { organiser, includeFund = false, home = 'MYR' } = {}) {
  const doc = newDoc();
  const { W, H, M, grey, ink } = PDF;
  const CW = W - 2 * M;
  const accent = PDF.accent;
  const countries = [...new Set(trip.destinations.map((d) => countryName(d.country)).filter(Boolean))].join(', ');
  const names = travellerNames(trip);
  let y = pdfHeader(doc, trip, organiser, [
    [fmtRange(trip.start, trip.end), countries].filter(Boolean).join('  ·  '),
    names.length ? `Travellers: ${names.join(', ')}` : '',
  ]);

  // Table columns: time | title | place | handled by
  const cols = [{ w: 22 }, { w: 62 }, { w: 58 }, { w: CW - 22 - 62 - 58 }];
  const xs = cols.reduce((acc, c, i) => { acc.push(i ? acc[i - 1] + cols[i - 1].w : M); return acc; }, []);
  const footerSpace = 16;
  const newPage = () => { doc.addPage(); y = M; };
  const ensure = (h) => { if (y + h > H - M - footerSpace) newPage(); };

  for (const d of dates) {
    const plans = sortedPlans(trip, d);
    ensure(18);
    doc.setFillColor(...accent).roundedRect(M, y, CW, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(255, 255, 255);
    doc.text(pdfText(`Day ${dayIndex(trip, d)} · ${fmtDayHead(d)}${dayPlace(trip, d) ? ` · ${dayPlace(trip, d)}` : ''}`), M + 3, y + 5.4);
    y += 11;
    if (!plans.length) {
      doc.setFont('helvetica', 'italic').setFontSize(10).setTextColor(...grey);
      doc.text('Free day', M + 2, y + 3);
      y += 8;
      continue;
    }
    for (const p of plans) {
      doc.setFont('helvetica', 'normal').setFontSize(10);
      const cells = [
        p.time ? fmtTime12(p.time) : 'All day',
        pdfText(p.title),
        pdfText(placeOf(p)),
        pdfText(whoLabel(trip, p)),
      ].map((t, i) => doc.splitTextToSize(t || '', cols[i].w - 3));
      const lines = Math.max(...cells.map((c) => c.length), 1);
      const rh = lines * 4.4 + 3.2;
      ensure(rh);
      cells.forEach((c, i) => {
        doc.setFont('helvetica', i === 1 ? 'bold' : 'normal').setTextColor(...(i === 0 || i === 3 ? grey : ink));
        doc.text(c, xs[i] + 1.5, y + 4.4);
      });
      y += rh;
      doc.setDrawColor(225, 225, 230).setLineWidth(0.2).line(M, y, M + CW, y);
    }
    y += 4;
  }

  if (includeFund && trip.fund?.enabled) {
    const s = fundStats(trip);
    const m = (sen) => pdfText(money(fromSen(sen), home));
    ensure(30);
    y += 2;
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...ink).text('Group fund summary', M, y + 5);
    y += 10;
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...grey);
    doc.text(`In the fund now ${m(s.balance)}   ·   Collected ${m(s.collected)}   ·   Spent ${m(s.spent)}`, M, y + 3);
    y += 8;
    for (const mem of trip.fund.members) {
      const p = s.per[mem.id] || { paid: 0, share: 0, result: 0 };
      const res = p.result > 0 ? `Gets back ${m(p.result)}` : p.result < 0 ? `Owes ${m(-p.result)}` : 'Settled';
      ensure(7);
      doc.setTextColor(...ink).text(pdfText(mem.id === YOU ? 'You' : mem.name), M + 1.5, y + 4);
      doc.setTextColor(...grey).text(`Paid ${m(p.paid)}`, M + 60, y + 4).text(`Share ${m(p.share)}`, M + 100, y + 4);
      doc.setTextColor(...ink).text(res, M + 140, y + 4);
      y += 7;
      doc.setDrawColor(225, 225, 230).line(M, y, M + CW, y);
    }
  }

  pdfFooter(doc, organiser);
  return doc.output('blob');
}
