import { addDays, diffDays, parse, planTime, todayISO, tripDays, tripStatus, toISO, nights } from './dates.js';
import { countryCurrency, SOUTHERN, TROPICAL, round } from './currency.js';
import { fundStats, unpaidMembers, YOU } from './model.js';

export { DEFAULT_TRIP_COLOR } from './model.js';

export const BUDGET_CATS = ['Flights', 'Stay', 'Transport', 'Food', 'Shopping', 'Activities'];
export const DOMESTIC_EXTRA_CATS = ['Petrol', 'Toll', 'Parking'];
export const FUND_SHARE_CAT = 'Group fund share';
export const PLAN_CATS = ['flight', 'transport', 'drive', 'stay', 'food', 'sight', 'free'];
export const PACK_CATS = ['Clothes', 'Electronics', 'Toiletries', 'Documents', 'Others'];
export const DOC_TYPES = ['passport', 'flight', 'hotel', 'insurance', 'visa', 'id', 'other'];
export const DOC_STATUSES = ['valid', 'booked', 'check', 'missing'];
export const REQUIRED_DOCS = ['passport', 'flight', 'hotel', 'insurance'];
const REQUIRED_DOCS_DOMESTIC = ['hotel', 'id'];

export const DOC_LABEL = { passport: 'Passport', flight: 'Flight ticket', hotel: 'Hotel booking', insurance: 'Travel insurance', visa: 'Visa / entry', id: 'IC / ID card', other: 'Other' };
export const STATUS_LABEL = { valid: 'Valid', booked: 'Booked', check: 'To check', missing: 'Missing' };

// ---------- domestic vs international ----------
export const budgetCats = (trip) => (trip.domestic ? [...BUDGET_CATS, ...DOMESTIC_EXTRA_CATS] : BUDGET_CATS);
export const localsOf = (trip) => (trip.domestic ? [] : trip.localCurrencies);
export const planCatsFor = (trip) => (trip.domestic ? ['drive', ...PLAN_CATS.filter((c) => c !== 'drive')] : PLAN_CATS);
export const docTypesFor = (trip) => (trip.domestic ? ['hotel', 'flight', 'id', 'other'] : DOC_TYPES);
export const requiredDocs = (trip) => (trip.domestic ? REQUIRED_DOCS_DOMESTIC : REQUIRED_DOCS);

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
  const locals = localsOf(trip);
  const c = countryCurrency[dayCountry(trip, date)];
  if (c && (locals.includes(c) || c === settings.homeCurrency)) return c;
  return locals[0] || settings.homeCurrency;
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
// Your share of the group fund counts as spending (read-only), so nothing is entered twice.
export function fundShareHome(trip) {
  if (!trip.fund?.enabled) return 0;
  return (fundStats(trip).per[YOU]?.share || 0) / 100;
}

export function budgetStats(trip, settings) {
  const cats = budgetCats(trip);
  const byCat = Object.fromEntries(cats.map((c) => [c, 0]));
  let spent = 0;
  for (const e of trip.expenses) {
    const h = expenseHome(e, settings) || 0;
    spent += h;
    byCat[e.category] = (byCat[e.category] || 0) + h;
  }
  const fundShare = fundShareHome(trip);
  spent += fundShare;
  const total = trip.budget || 0;
  const left = total - spent;
  const st = tripStatus(trip);
  const totalDays = diffDays(trip.end, trip.start) + 1;
  const daysLeft = st.phase === 'upcoming' ? totalDays : st.phase === 'ongoing' ? diffDays(trip.end, todayISO()) + 1 : 0;
  const perDay = daysLeft > 0 ? left / daysLeft : 0;
  const over = cats.filter((c) => (trip.categoryBudgets?.[c] || 0) > 0 && byCat[c] > trip.categoryBudgets[c]);
  return { spent, total, left, perDay, daysLeft, byCat, cats, fundShare, over, pct: total ? Math.round((spent / total) * 100) : 0 };
}

// ---------- readiness ----------
export function docsSaved(trip) {
  return requiredDocs(trip).filter((t) => trip.docs.some((d) => d.type === t && (d.status === 'valid' || d.status === 'booked')));
}

export function readiness(trip) {
  const packTotal = trip.packing.length;
  const packed = trip.packing.filter((p) => p.packed).length;
  const p = packTotal ? packed / packTotal : 0;
  const d = docsSaved(trip).length / requiredDocs(trip).length;
  const t = trip.todos.length ? trip.todos.filter((x) => x.done).length / trip.todos.length : 0;
  return { pct: Math.round(((p + d + t) / 3) * 100), packed, packTotal, docs: docsSaved(trip).length, todosDone: trip.todos.filter((x) => x.done).length };
}

export function docWarnings(trip) {
  const out = [];
  if (!trip.domestic) {
    if (!trip.docs.some((d) => d.type === 'insurance' && d.status !== 'missing'))
      out.push({ id: 'insurance', text: 'No travel insurance saved', detail: 'Add your policy so it is available offline.' });
    const sixMonths = (() => { const d = parse(trip.start); d.setMonth(d.getMonth() + 6); return toISO(d); })();
    for (const d of trip.docs) {
      if (d.type === 'passport' && d.expiry && d.expiry < sixMonths)
        out.push({ id: 'passport-' + d.id, docId: d.id, text: 'Passport expires within 6 months of your trip', detail: 'Many countries require 6 months validity. Check before you fly.' });
    }
    if (!trip.docs.some((d) => d.type === 'passport'))
      out.push({ id: 'nopassport', text: 'No passport saved', detail: 'Save a photo of your passport page.' });
  }
  for (const d of trip.docs) {
    if (trip.domestic && ['passport', 'visa', 'insurance'].includes(d.type)) continue;
    if (d.status === 'missing' && d.type !== 'insurance')
      out.push({ id: 'missing-' + d.id, docId: d.id, text: `${d.title || DOC_LABEL[d.type]} is missing`, detail: 'Add a photo or PDF so you have it offline.' });
  }
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

export function fmtDuration(min) {
  if (!min) return '';
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `about ${m} min`;
  return `about ${h} h${m ? ` ${m} min` : ''}`;
}

export function driveLine(p) {
  const route = p.from && p.to ? `${p.from} → ${p.to}` : p.from || p.to || '';
  return [route, fmtDuration(p.durationMin)].filter(Boolean).join(' · ');
}

export function whoLabel(trip, p) {
  if (!p.who) return '';
  const t = trip.travellers.find((x) => x.id === p.who);
  if (!t) return '';
  const name = t.id === YOU ? 'You' : t.name;
  switch (p.whoNote) {
    case 'Drives': return t.id === YOU ? 'You drive' : `${name} drives`;
    case 'Buys tickets': return t.id === YOU ? 'You buy tickets' : `${name} buys tickets`;
    case 'In charge': return `${name} in charge`;
    case 'Booked by': return `Booked by ${name}`;
    default: return name;
  }
}

export function planTip(plan, now = Date.now()) {
  const hrs = (planTime(plan) - now) / 3600000;
  switch (plan.category) {
    case 'flight':
      if (hrs <= 48 && hrs > 0) return 'Online check-in is open. Check in now to choose your seat.';
      return 'Online check-in usually opens 48 hours before departure.';
    case 'drive': return 'Fill up the tank and top up Touch ’n Go before you leave.';
    case 'stay': return 'Keep your booking reference handy. Check-in is usually from 3 PM.';
    case 'transport': return 'Leave a little buffer time and keep your ticket on screen.';
    case 'food': return 'Popular places fill up fast. Book ahead if you can.';
    case 'sight': return 'Check opening hours before you go.';
    default: return 'Enjoy some free time.';
  }
}

// Tip only when it matters now: flight check-in window, or the plan is within a day.
export function relevantTip(plan, now = Date.now()) {
  const hrs = (planTime(plan) - now) / 3600000;
  if (plan.category === 'flight' && hrs > 0 && hrs <= 48) return 'Online check-in is open – check in now to pick your seat.';
  if (hrs > 0 && hrs <= 24) return planTip(plan, now);
  return null;
}

// ---------- packing ----------
const HIGHLAND = /cameron|genting|fraser|highland|kundasang|kinabalu|bukit tinggi|berinchang|brinchang|ranau|bario|tea|mountain|gunung/i;
const BEACH = /beach|pantai|langkawi|redang|perhentian|tioman|pangkor|port dickson|\bpd\b|penang|kapas|lang tengah|tenggol|mabul|sipadan|semporna|island|pulau|desaru|cherating|kuantan|terengganu|kota kinabalu|bali|phuket|krabi/i;

function destinationKind(trip) {
  const text = [trip.name, ...trip.destinations.map((d) => d.city)].join(' ');
  return { highland: HIGHLAND.test(text), beach: BEACH.test(text) };
}

export function seasonLabel(trip) {
  if (trip.domestic) {
    const k = destinationKind(trip);
    return k.highland && k.beach ? 'for highlands and beach' : k.highland ? 'for the highlands' : k.beach ? 'for the beach' : '';
  }
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
  const pairs = Math.min(n + 1, 8);
  const extra = [];
  let docs;
  if (trip.domestic) {
    const k = destinationKind(trip);
    if (k.highland) extra.push(['Jacket', 'Clothes'], ['Sweater', 'Clothes'], ['Long pants', 'Clothes'], ['Socks for the cold', 'Clothes'], ['Compact umbrella', 'Others']);
    if (k.beach) extra.push(['Swimwear', 'Clothes'], ['Flip-flops', 'Clothes'], ['Beach towel', 'Others'], ['Sunglasses', 'Others'], ['Waterproof phone pouch', 'Electronics'], ['After-sun lotion', 'Toiletries']);
    if (!k.highland && !k.beach) extra.push(['Compact umbrella', 'Others'], ['Light breathable clothes', 'Clothes']);
    docs = [['IC / ID card', 'Documents'], ['Driving licence', 'Documents'], ['Touch ’n Go card', 'Documents'], ['Cash & cards', 'Documents']];
    extra.push(['Car charger', 'Electronics'], ['Snacks for the drive', 'Others'], ['Insect repellent', 'Toiletries']);
  } else {
    const s = season(trip);
    if (s.cold) extra.push(['Winter coat', 'Clothes'], ['Thermal innerwear', 'Clothes'], ['Gloves', 'Clothes'], ['Beanie', 'Clothes'], ['Scarf', 'Clothes'], ['Hand warmers', 'Others'], ['Lip balm', 'Toiletries'], ['Moisturiser', 'Toiletries']);
    if (s.hot) extra.push(['Sunglasses', 'Others'], ['Hat', 'Clothes'], ['Light breathable clothes', 'Clothes'], ['Sandals', 'Clothes']);
    if (s.rainy) extra.push(['Compact umbrella', 'Others'], ['Insect repellent', 'Toiletries']);
    docs = [['Passport', 'Documents'], ['Travel insurance copy', 'Documents'], ['Printed bookings', 'Documents'], ['Cash & cards', 'Documents']];
  }
  const items = [
    ...extra,
    ...docs,
    [`Underwear (${pairs})`, 'Clothes'], [`Socks (${pairs})`, 'Clothes'], [`Tops (${Math.min(Math.max(n, 1), 7)})`, 'Clothes'], ['Comfortable walking shoes', 'Clothes'], ['Sleepwear', 'Clothes'],
    ['Phone charger', 'Electronics'], ['Power bank', 'Electronics'], ...(trip.domestic ? [] : [['Travel adapter', 'Electronics']]), ['Earphones', 'Electronics'],
    ['Toothbrush & toothpaste', 'Toiletries'], ['Shampoo', 'Toiletries'], ['Deodorant', 'Toiletries'], ['Medication', 'Toiletries'], ['Sunscreen', 'Toiletries'],
    ['Reusable water bottle', 'Others'], ['Day bag', 'Others'],
  ];
  if (n >= 7) items.push(['Laundry bag', 'Others'], ['Travel detergent', 'Toiletries']);
  if (n >= 4) items.push(['Packing cubes', 'Others']);
  const norm = (s) => s.toLowerCase().replace(/\s*\(\d+\)$/, '');
  const have = new Set(trip.packing.map((p) => norm(p.name)));
  const seen = new Set();
  return items
    .filter(([name]) => !have.has(norm(name)) && !seen.has(norm(name)) && seen.add(norm(name)))
    .map(([name, cat]) => ({ name, cat }));
}

export const TODO_SUGGESTIONS = [
  'Book accommodation', 'Arrange airport transfer', 'Buy travel insurance', 'Get eSIM or local SIM', 'Exchange currency',
  'Tell bank about travel', 'Check visa / entry rules', 'Download offline maps', 'Online check-in', 'Book airport parking',
];
export const TODO_SUGGESTIONS_DOMESTIC = [
  'Service the car', 'Top up Touch ’n Go', 'Book homestay/hotel', 'Check road and weather', 'Download offline maps', 'Pack phone chargers and power bank',
];
export const todoSuggestions = (trip) => (trip.domestic ? TODO_SUGGESTIONS_DOMESTIC : TODO_SUGGESTIONS);

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
      if (trip.domestic && st.days <= 7 && st.days >= 1) {
        const open = trip.todos.filter((t) => !t.done && /service the car|touch.n go/i.test(t.text));
        const hasTodos = trip.todos.some((t) => /service the car|touch.n go/i.test(t.text));
        if (!hasTodos || open.length)
          out.push({ id: `${trip.id}:car`, tripId: trip.id, tab: 'overview', tone: 'warn', title: 'Get the car ready', text: `Service the car and top up Touch ’n Go before ${trip.name}.` });
      }
    }
    if (!trip.domestic) {
      for (const p of trip.plans) {
        if (p.category !== 'flight') continue;
        const hrs = (planTime(p) - now.getTime()) / 3600000;
        if (hrs > 0 && hrs <= 48)
          out.push({ id: `${trip.id}:ci:${p.id}`, tripId: trip.id, tab: 'itinerary', tone: 'warn', title: 'Online check-in is open', text: `${p.title} departs in ${Math.round(hrs)} hours.` });
      }
    }
    if (st.phase === 'upcoming' && st.days <= 1) {
      const left = trip.packing.filter((p) => !p.packed).length;
      if (left) out.push({ id: `${trip.id}:pack:${today}`, tripId: trip.id, tab: 'packing', tone: 'warn', title: 'Finish packing', text: `${left} item${left > 1 ? 's' : ''} still to pack for ${trip.name}.` });
    }
    const w = docWarnings(trip);
    if (w.length) out.push({ id: `${trip.id}:docs:${w.map((x) => x.id).join(',')}`, tripId: trip.id, tab: 'docs', tone: 'warn', title: 'Documents need attention', text: `${w[0].text}${w.length > 1 ? ` and ${w.length - 1} more` : ''}.` });
    const b = budgetStats(trip, settings);
    if (b.over.length) out.push({ id: `${trip.id}:over:${b.over.join(',')}`, tripId: trip.id, tab: 'budget', tone: 'warn', title: 'Over budget', text: `${b.over.join(', ')} ${b.over.length > 1 ? 'are' : 'is'} over budget on ${trip.name}.` });
    const unpaid = unpaidMembers(trip);
    if (unpaid.length) {
      const names = unpaid.map((m) => m.name);
      out.push({ id: `${trip.id}:fund:${unpaid.map((m) => m.id + m.due).join(',')}`, tripId: trip.id, tab: 'budget', tone: 'warn', title: 'Group fund not fully paid', text: `${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''} still ${names.length > 1 ? 'have' : 'has'} to pay for ${trip.name}.` });
    }
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
