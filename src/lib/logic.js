import { addDays, diffDays, parse, planTime, todayISO, tripDays, tripStatus, toISO, nights } from './dates.js';
import { countryCurrency, SOUTHERN, TROPICAL, round } from './currency.js';

export const BUDGET_CATS = ['Flights', 'Stay', 'Transport', 'Food', 'Shopping', 'Activities'];
export const PLAN_CATS = ['flight', 'transport', 'stay', 'food', 'sight', 'free'];
export const PACK_CATS = ['Clothes', 'Electronics', 'Toiletries', 'Documents', 'Others'];
export const DOC_TYPES = ['passport', 'flight', 'hotel', 'insurance', 'visa', 'other'];
export const DOC_STATUSES = ['valid', 'booked', 'check', 'missing'];
export const REQUIRED_DOCS = ['passport', 'flight', 'hotel', 'insurance'];

export const DOC_LABEL = { passport: 'Passport', flight: 'Flight ticket', hotel: 'Hotel booking', insurance: 'Travel insurance', visa: 'Visa / entry', other: 'Other' };
export const STATUS_LABEL = { valid: 'Valid', booked: 'Booked', check: 'To check', missing: 'Missing' };

export const TRIP_COLORS = ['#0066CC', '#2F6F5E', '#7A4B8C', '#B4553A', '#3D5A80', '#5E6472'];

// ---------- currencies & rates ----------
export function localCurrenciesFor(destinations, home) {
  const out = [];
  for (const d of destinations) {
    const c = countryCurrency[d.country];
    if (c && c !== home && !out.includes(c)) out.push(c);
  }
  return out;
}

// Units of `code` per 1 unit of home currency.
export function rateFor(trip, code, settings) {
  const home = settings.homeCurrency;
  if (code === home) return 1;
  const cfg = trip.rates?.[code] || { mode: 'live' };
  const live = settings.live && settings.live.base === home ? settings.live.rates?.[code] : null;
  if (cfg.mode === 'manual' && cfg.manual) return cfg.manual;
  if (cfg.mode === 'locked' && cfg.locked) return cfg.locked;
  return live || cfg.manual || cfg.locked || cfg.fallback || null;
}

export function rateSource(trip, code, settings) {
  const cfg = trip.rates?.[code] || { mode: 'live' };
  if (cfg.mode === 'manual' && cfg.manual) return { mode: 'manual', label: 'My own rate' };
  if (cfg.mode === 'locked' && cfg.locked) return { mode: 'locked', label: 'Locked for this trip' };
  const live = settings.live && settings.live.base === settings.homeCurrency && settings.live.rates?.[code];
  if (live) return { mode: 'live', label: 'Live rate', time: settings.live.time };
  return { mode: 'live', label: 'Live rate unavailable – using last known rate', stale: true };
}

export function expenseHome(exp, settings) {
  const home = settings.homeCurrency;
  if (!exp.home || exp.home === home) return exp.homeAmount;
  const r = settings.live && settings.live.base === home ? settings.live.rates?.[exp.home] : null;
  return r ? exp.homeAmount / r : exp.homeAmount;
}

export function tripCountryCurrencies(trip) {
  return [...new Set(trip.destinations.map((d) => d.country).filter(Boolean))];
}

export function dayCountry(trip, date) {
  return trip.dayCountry?.[date] || trip.destinations[0]?.country || null;
}

export function defaultCurrencyFor(trip, date, settings) {
  const c = countryCurrency[dayCountry(trip, date)];
  if (c && (trip.localCurrencies.includes(c) || c === settings.homeCurrency)) return c;
  return trip.localCurrencies[0] || settings.homeCurrency;
}

// Split days across destination countries in order.
export function assignDayCountries(trip) {
  const days = tripDays(trip);
  const countries = [];
  for (const d of trip.destinations) if (d.country && !countries.includes(d.country)) countries.push(d.country);
  const map = {};
  if (!countries.length) return map;
  const per = days.length / countries.length;
  days.forEach((day, i) => (map[day] = trip.dayCountry?.[day] && countries.includes(trip.dayCountry[day]) ? trip.dayCountry[day] : countries[Math.min(countries.length - 1, Math.floor(i / per))]));
  return map;
}

// ---------- budget ----------
export function budgetStats(trip, settings) {
  const byCat = Object.fromEntries(BUDGET_CATS.map((c) => [c, 0]));
  let spent = 0;
  for (const e of trip.expenses) {
    const h = expenseHome(e, settings) || 0;
    spent += h;
    byCat[e.category] = (byCat[e.category] || 0) + h;
  }
  const total = trip.budget || 0;
  const left = total - spent;
  const st = tripStatus(trip);
  const totalDays = diffDays(trip.end, trip.start) + 1;
  const daysLeft = st.phase === 'upcoming' ? totalDays : st.phase === 'ongoing' ? diffDays(trip.end, todayISO()) + 1 : 0;
  const perDay = daysLeft > 0 ? left / daysLeft : 0;
  const over = BUDGET_CATS.filter((c) => (trip.categoryBudgets?.[c] || 0) > 0 && byCat[c] > trip.categoryBudgets[c]);
  return { spent, total, left, perDay, daysLeft, byCat, over, pct: total ? Math.round((spent / total) * 100) : 0 };
}

// ---------- readiness ----------
export function docsSaved(trip) {
  return REQUIRED_DOCS.filter((t) => trip.docs.some((d) => d.type === t && (d.status === 'valid' || d.status === 'booked')));
}

export function readiness(trip) {
  const packTotal = trip.packing.length;
  const packed = trip.packing.filter((p) => p.packed).length;
  const p = packTotal ? packed / packTotal : 0;
  const d = docsSaved(trip).length / REQUIRED_DOCS.length;
  const t = trip.todos.length ? trip.todos.filter((x) => x.done).length / trip.todos.length : 0;
  return { pct: Math.round(((p + d + t) / 3) * 100), packed, packTotal, docs: docsSaved(trip).length, todosDone: trip.todos.filter((x) => x.done).length };
}

export function docWarnings(trip) {
  const out = [];
  if (!trip.docs.some((d) => d.type === 'insurance' && d.status !== 'missing'))
    out.push({ id: 'insurance', text: 'No travel insurance saved', detail: 'Add your policy so it is available offline.' });
  const sixMonths = (() => { const d = parse(trip.start); d.setMonth(d.getMonth() + 6); return toISO(d); })();
  for (const d of trip.docs) {
    if (d.type === 'passport' && d.expiry && d.expiry < sixMonths)
      out.push({ id: 'passport-' + d.id, docId: d.id, text: 'Passport expires within 6 months of your trip', detail: 'Many countries require 6 months validity. Check before you fly.' });
    if (d.status === 'missing' && d.type !== 'insurance')
      out.push({ id: 'missing-' + d.id, docId: d.id, text: `${d.title || DOC_LABEL[d.type]} is missing`, detail: 'Add a photo or PDF so you have it offline.' });
  }
  if (!trip.docs.some((d) => d.type === 'passport'))
    out.push({ id: 'nopassport', text: 'No passport saved', detail: 'Save a photo of your passport page.' });
  return out;
}

// ---------- itinerary ----------
export function sortedPlans(trip, date) {
  return trip.plans.filter((p) => p.date === date).sort((a, b) => a.order - b.order);
}

export function nextPlan(trip, now = Date.now()) {
  const list = [...trip.plans].sort((a, b) => planTime(a) - planTime(b) || a.order - b.order);
  return list.find((p) => planTime(p) + (p.time ? 0 : 86400000) >= now) || null;
}

export function planTip(plan, now = Date.now()) {
  const hrs = (planTime(plan) - now) / 3600000;
  switch (plan.category) {
    case 'flight':
      if (hrs <= 48 && hrs > 0) return 'Online check-in is open. Check in now to choose your seat.';
      return 'Online check-in usually opens 48 hours before departure.';
    case 'stay': return 'Keep your booking reference handy. Check-in is usually from 3 PM.';
    case 'transport': return 'Leave a little buffer time and keep your ticket on screen.';
    case 'food': return 'Popular places fill up fast. Book ahead if you can.';
    case 'sight': return 'Check opening hours before you go.';
    default: return 'Enjoy some free time.';
  }
}

// ---------- packing ----------
export function seasonLabel(trip) {
  const s = season(trip);
  return s.rainy ? 'in tropical weather' : s.cold && s.hot ? 'in mixed weather' : s.cold ? 'in cold weather' : s.hot ? 'in summer' : '';
}

function season(trip) {
  const countries = tripCountryCurrencies(trip);
  const months = new Set();
  for (let s = trip.start; s <= trip.end; s = addDays(s, 1)) months.add(parse(s).getMonth());
  const tropical = countries.length > 0 && countries.every((c) => TROPICAL.has(c));
  if (tropical) return { cold: false, hot: true, rainy: true };
  const south = countries.some((c) => SOUTHERN.has(c));
  const coldMonths = south ? [4, 5, 6, 7, 8] : [10, 11, 0, 1, 2];
  const hotMonths = south ? [11, 0, 1] : [5, 6, 7];
  return {
    cold: [...months].some((m) => coldMonths.includes(m)),
    hot: [...months].some((m) => hotMonths.includes(m)),
    rainy: false,
  };
}

export function packingSuggestions(trip) {
  const n = nights(trip);
  const s = season(trip);
  const pairs = Math.min(n + 1, 8);
  const extra = [];
  if (s.cold) extra.push(['Winter coat', 'Clothes'], ['Thermal innerwear', 'Clothes'], ['Gloves', 'Clothes'], ['Beanie', 'Clothes'], ['Scarf', 'Clothes'], ['Hand warmers', 'Others'], ['Lip balm', 'Toiletries'], ['Moisturiser', 'Toiletries']);
  if (s.hot) extra.push(['Sunglasses', 'Others'], ['Hat', 'Clothes'], ['Light breathable clothes', 'Clothes'], ['Sandals', 'Clothes']);
  if (s.rainy) extra.push(['Compact umbrella', 'Others'], ['Insect repellent', 'Toiletries']);
  const items = [
    ...extra,
    ['Passport', 'Documents'], ['Travel insurance copy', 'Documents'], ['Printed bookings', 'Documents'], ['Cash & cards', 'Documents'],
    [`Underwear (${pairs})`, 'Clothes'], [`Socks (${pairs})`, 'Clothes'], [`Tops (${Math.min(n, 7)})`, 'Clothes'], ['Comfortable walking shoes', 'Clothes'], ['Sleepwear', 'Clothes'],
    ['Phone charger', 'Electronics'], ['Power bank', 'Electronics'], ['Travel adapter', 'Electronics'], ['Earphones', 'Electronics'],
    ['Toothbrush & toothpaste', 'Toiletries'], ['Shampoo', 'Toiletries'], ['Deodorant', 'Toiletries'], ['Medication', 'Toiletries'], ['Sunscreen', 'Toiletries'],
    ['Reusable water bottle', 'Others'], ['Day bag', 'Others'],
  ];
  if (n >= 7) items.push(['Laundry bag', 'Others'], ['Travel detergent', 'Toiletries']);
  if (n >= 4) items.push(['Packing cubes', 'Others']);
  const have = new Set(trip.packing.map((p) => p.name.toLowerCase().replace(/\s*\(\d+\)$/, '')));
  return items
    .filter(([name]) => !have.has(name.toLowerCase().replace(/\s*\(\d+\)$/, '')))
    .map(([name, cat]) => ({ name, cat }));
}

export const TODO_SUGGESTIONS = [
  'Book accommodation', 'Arrange airport transfer', 'Buy travel insurance', 'Get eSIM or local SIM', 'Exchange currency',
  'Tell bank about travel', 'Check visa / entry rules', 'Download offline maps', 'Online check-in', 'Book airport parking',
];

// ---------- reminders ----------
export function getReminders(trips, settings, now = new Date()) {
  const today = toISO(now);
  const out = [];
  for (const trip of trips) {
    const st = tripStatus(trip, today);
    if (st.phase === 'past') continue;
    if (st.phase === 'upcoming') {
      const m = st.days <= 1 ? 1 : st.days <= 7 ? 7 : st.days <= 30 ? 30 : null;
      if (m) {
        const text = m === 1 ? (st.days === 0 ? 'Your trip starts today' : 'Your trip starts tomorrow') : m === 7 ? `${st.days} days to go – one week left to prepare` : `${st.days} days to go – less than a month left`;
        out.push({ id: `${trip.id}:m${m}`, tripId: trip.id, tab: 'overview', tone: 'accent', title: trip.name, text });
      }
    }
    for (const p of trip.plans) {
      if (p.category !== 'flight') continue;
      const hrs = (planTime(p) - now.getTime()) / 3600000;
      if (hrs > 0 && hrs <= 48)
        out.push({ id: `${trip.id}:ci:${p.id}`, tripId: trip.id, tab: 'itinerary', tone: 'warn', title: 'Online check-in is open', text: `${p.title} departs in ${Math.round(hrs)} hours.` });
    }
    if (st.phase === 'upcoming' && st.days <= 1) {
      const left = trip.packing.filter((p) => !p.packed).length;
      if (left) out.push({ id: `${trip.id}:pack:${today}`, tripId: trip.id, tab: 'packing', tone: 'warn', title: 'Finish packing', text: `${left} item${left > 1 ? 's' : ''} still to pack for ${trip.name}.` });
    }
    const w = docWarnings(trip);
    if (w.length) out.push({ id: `${trip.id}:docs:${w.map((x) => x.id).join(',')}`, tripId: trip.id, tab: 'docs', tone: 'warn', title: 'Documents need attention', text: `${w[0].text}${w.length > 1 ? ` and ${w.length - 1} more` : ''}.` });
    const b = budgetStats(trip, settings);
    if (b.over.length) out.push({ id: `${trip.id}:over:${b.over.join(',')}`, tripId: trip.id, tab: 'budget', tone: 'warn', title: 'Over budget', text: `${b.over.join(', ')} ${b.over.length > 1 ? 'are' : 'is'} over budget on ${trip.name}.` });
  }
  const last = settings.lastBackup;
  if (trips.length && (!last || now.getTime() - last > 30 * 86400000)) {
    const month = `${now.getFullYear()}-${now.getMonth()}`;
    out.push({ id: `backup:${month}`, tab: 'settings', tone: 'accent', title: 'Back up your trips', text: last ? 'Your last backup is over a month old.' : 'Export a backup so your data is safe.' });
  }
  return out.filter((r) => !settings.dismissed?.[r.id]);
}

export function backToBack(trips) {
  const list = [...trips].sort((a, b) => a.start.localeCompare(b.start));
  const out = [];
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i], b = list[i + 1];
    const gap = diffDays(b.start, a.end);
    if (gap >= 0 && gap <= 1 && !(a.journeyId && a.journeyId === b.journeyId)) out.push([a, b]);
  }
  return out;
}

export const roundHome = (n, settings) => round(n, settings.homeCurrency);
