// Trip data model: safe defaults for old trips/backups, travellers, domestic detection and group-fund maths.
// All group-fund amounts are kept in sen (integer cents of the home currency) and rounded only for display.
import { countryCurrency } from './currency.js';

export const YOU = 'you';
export const DEFAULT_TRIP_COLOR = '#A3195B';
// Colours older versions picked at random; migrated to the theme colour on load.
const LEGACY_TRIP_COLORS = ['#0066CC', '#2F6F5E', '#7A4B8C', '#B4553A', '#3D5A80', '#5E6472'];

export const TRAVELLER_COLORS = ['#C81E63', '#0E7490', '#7C3AED', '#B45309', '#15803D', '#1D4ED8', '#BE123C', '#4D7C0F', '#9333EA', '#0F766E'];

export const WHO_NOTES = ['Booked by', 'Buys tickets', 'Drives', 'In charge'];

export function nextColor(list) {
  const used = new Set(list.map((x) => x.color));
  return TRAVELLER_COLORS.find((c) => !used.has(c)) || TRAVELLER_COLORS[list.length % TRAVELLER_COLORS.length];
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function homeCountryOf(settings) {
  if (settings.homeCountry) return settings.homeCountry;
  const c = settings.homeCurrency || 'MYR';
  if (c === 'MYR') return 'MY';
  return Object.keys(countryCurrency).find((k) => countryCurrency[k] === c) || null;
}

export function isDomesticDests(destinations, settings) {
  const hc = homeCountryOf(settings);
  const cs = (destinations || []).map((d) => d.country).filter(Boolean);
  return !!hc && cs.length > 0 && cs.every((c) => c === hc);
}

export const toSen = (n) => Math.round((Number(n) || 0) * 100);
export const fromSen = (s) => (s || 0) / 100;

export function emptyFund(perPerson = 0) {
  return { enabled: false, perPerson, members: [], entries: [], settledAt: null };
}

// Keep fund members aligned with the trip's travellers (a removed traveller stays if entries mention them).
export function syncFundMembers(trip) {
  const f = trip.fund;
  const byId = Object.fromEntries(f.members.map((m) => [m.id, m]));
  const used = new Set(f.entries.flatMap((e) => [e.memberId, e.paidBy, ...(e.splitBetween || [])]).filter(Boolean));
  f.members = [
    ...trip.travellers.map((t) => ({ id: t.id, name: t.name, color: t.color, target: byId[t.id]?.target ?? f.perPerson ?? 0 })),
    ...f.members.filter((m) => !trip.travellers.some((t) => t.id === m.id) && used.has(m.id)),
  ];
  return trip;
}

// Fill in every field newer versions expect, so old trips and old backup files keep working.
export function normalizeTrip(t, settings) {
  const trip = { ...t };
  for (const k of ['destinations', 'plans', 'packing', 'todos', 'docs', 'expenses', 'localCurrencies']) if (!Array.isArray(trip[k])) trip[k] = [];
  trip.rates = trip.rates || {};
  trip.dayCountry = trip.dayCountry || {};
  trip.categoryBudgets = trip.categoryBudgets || {};
  trip.emergency = { contacts: [], bloodType: '', medical: '', embassy: { name: '', phone: '', address: '' }, ...(trip.emergency || {}) };
  if (!trip.color || LEGACY_TRIP_COLORS.includes(trip.color)) trip.color = DEFAULT_TRIP_COLOR;
  if (typeof trip.domestic !== 'boolean') trip.domestic = isDomesticDests(trip.destinations, settings);

  let travellers = Array.isArray(trip.travellers) ? trip.travellers.filter((x) => x && x.id && x.name) : [];
  if (!travellers.some((x) => x.id === YOU)) travellers = [{ id: YOU, name: 'You', color: TRAVELLER_COLORS[0] }, ...travellers];
  trip.travellers = travellers.map((x, i) => ({ ...x, color: x.color || TRAVELLER_COLORS[i % TRAVELLER_COLORS.length] }));

  const f = trip.fund && typeof trip.fund === 'object' ? trip.fund : {};
  trip.fund = {
    ...emptyFund(),
    ...f,
    members: Array.isArray(f.members) ? f.members : [],
    entries: Array.isArray(f.entries) ? f.entries : [],
  };
  syncFundMembers(trip);

  trip.plans = trip.plans.map((p) => ({ who: null, whoNote: '', from: '', to: '', durationMin: null, ...p }));
  return trip;
}

// ---------- group fund ----------
// Split a total in sen across ids so the parts add up exactly; extra sen go to the first ids.
export function splitSen(total, ids) {
  const n = ids.length;
  if (!n) return [];
  const base = Math.floor(total / n);
  let rem = total - base * n;
  return ids.map((id) => [id, base + (rem-- > 0 ? 1 : 0)]);
}

const chrono = (a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0);

export function fundStats(trip) {
  const f = trip.fund;
  const ids = f.members.map((m) => m.id);
  const per = {};
  const ensure = (id) => (per[id] = per[id] || { paid: 0, paidIn: 0, share: 0 });
  ids.forEach(ensure);
  let collected = 0, spent = 0, own = 0, bal = 0;
  const running = {};
  const sorted = [...f.entries].sort(chrono);
  for (const e of sorted) {
    const sen = e.sen || 0;
    if (e.type === 'in') {
      collected += sen; bal += sen;
      ensure(e.memberId).paid += sen;
      per[e.memberId].paidIn += sen;
    } else {
      const split = e.splitBetween && e.splitBetween.length ? e.splitBetween : ids;
      for (const [id, part] of splitSen(sen, split)) ensure(id).share += part;
      if (e.type === 'out') { spent += sen; bal -= sen; }
      else { own += sen; ensure(e.paidBy).paid += sen; }
    }
    running[e.id] = bal;
  }
  const balance = collected - spent;
  for (const id of Object.keys(per)) per[id].result = per[id].paid - per[id].share;
  return { collected, spent, own, balance, running, per, newestFirst: sorted.slice().reverse() };
}

// Fewest transfers (greedy) so everyone ends level. The fund itself pays out what it still holds.
export function settleUp(trip, stats = fundStats(trip)) {
  const parties = trip.fund.members.map((m) => ({ id: m.id, name: m.name, v: stats.per[m.id]?.result || 0 }));
  if (stats.balance) parties.push({ id: 'fund', name: 'The fund', v: -stats.balance });
  const debt = parties.filter((p) => p.v < 0).map((p) => ({ ...p, v: -p.v })).sort((a, b) => b.v - a.v);
  const cred = parties.filter((p) => p.v > 0).sort((a, b) => b.v - a.v);
  const out = [];
  let i = 0, j = 0;
  while (i < debt.length && j < cred.length) {
    const amt = Math.min(debt[i].v, cred[j].v);
    if (amt > 0) out.push({ from: debt[i], to: cred[j], sen: amt });
    debt[i].v -= amt; cred[j].v -= amt;
    if (!debt[i].v) i++;
    if (!cred[j].v) j++;
  }
  return out;
}

export function unpaidMembers(trip, stats = fundStats(trip)) {
  if (!trip.fund.enabled) return [];
  return trip.fund.members
    .filter((m) => m.target > 0 && (stats.per[m.id]?.paidIn || 0) < m.target)
    .map((m) => ({ ...m, due: m.target - (stats.per[m.id]?.paidIn || 0) }));
}
