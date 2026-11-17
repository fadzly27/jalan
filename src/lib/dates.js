// Dates are stored as local 'YYYY-MM-DD' strings.
export const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const todayISO = () => toISO(new Date());
export const addDays = (s, n) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 86400000); // a - b
export const nights = (trip) => Math.max(0, diffDays(trip.end, trip.start));
export const tripDays = (trip) => {
  const out = [];
  for (let s = trip.start; s <= trip.end; s = addDays(s, 1)) out.push(s);
  return out;
};

const fmt = (opts) => new Intl.DateTimeFormat('en-GB', opts);
export const fmtDay = (s) => fmt({ day: 'numeric', month: 'short' }).format(parse(s));
export const fmtDayYear = (s) => fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(parse(s));
export const fmtWeekday = (s) => fmt({ weekday: 'short' }).format(parse(s));
export const fmtLong = (s) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(parse(s));
export const fmtRange = (a, b) => {
  const A = parse(a), B = parse(b);
  const sameYear = A.getFullYear() === B.getFullYear();
  const left = fmt({ day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).format(A);
  return `${left} – ${fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(B)}`;
};
export const fmtTime = (t) => t || '';
export const fmtDateTime = (ts) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));

export function tripStatus(trip, today = todayISO()) {
  if (today < trip.start) return { phase: 'upcoming', days: diffDays(trip.start, today) };
  if (today > trip.end) return { phase: 'past', days: diffDays(today, trip.end) };
  return { phase: 'ongoing', day: diffDays(today, trip.start) + 1, total: diffDays(trip.end, trip.start) + 1 };
}

export function countdownLabel(trip) {
  const st = tripStatus(trip);
  if (st.phase === 'upcoming') return st.days === 1 ? '1 day to go' : `${st.days} days to go`;
  if (st.phase === 'ongoing') return `Day ${st.day} of ${st.total}`;
  return 'Completed';
}

// Date+time of a plan as a timestamp
export const planTime = (p) => {
  const d = parse(p.date);
  if (p.time) {
    const [h, m] = p.time.split(':').map(Number);
    d.setHours(h, m);
  }
  return d.getTime();
};
