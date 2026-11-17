import { useMemo, useState } from 'react';
import { Bell, ChevronRight, CircleAlert, Link2, Luggage, Map, Plus, Settings as Gear } from 'lucide-react';
import { Badge, CloseButton, Empty, Header, IconButton, Segmented, Sheet, SW, TextButton, cx, toast } from '../ui.jsx';
import { useStore } from '../store.jsx';
import { useNav } from '../App.jsx';
import { diffDays, fmtLong, fmtRange, nights, todayISO, tripStatus } from '../lib/dates.js';
import { backToBack, budgetStats, getReminders, readiness } from '../lib/logic.js';
import { uid } from '../lib/db.js';
import TripForm from './TripForm.jsx';

export function Hero({ trip, height = 'h-40', children }) {
  return (
    <div className={cx('relative overflow-hidden', height)} style={{ background: trip.color || '#0066CC' }}>
      {trip.cover && <img src={trip.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {trip.cover && <div className="absolute inset-0 bg-black/45" />}
      <div className="relative h-full flex flex-col justify-end p-4 text-white">{children}</div>
    </div>
  );
}

// Full list of reminders (used inside the reminders sheet)
export function Reminders({ reminders, onOpen }) {
  const { dismiss } = useStore();
  if (!reminders.length) return <Empty icon={Bell} text="You're all caught up." />;
  return (
    <div className="space-y-2">
      {reminders.map((r) => (
        <div key={r.id} className="anim-fade bg-card rounded-card flex items-start gap-3 p-3.5 pr-4">
          <span
            className={cx('h-8 w-8 rounded-full flex items-center justify-center shrink-0', r.tone === 'warn' ? 'text-warn' : 'text-accent')}
            style={{ background: r.tone === 'warn' ? 'rgb(var(--warn) / 0.15)' : 'rgb(var(--accent) / 0.12)' }}
          >
            {r.tone === 'warn' ? <CircleAlert size={18} strokeWidth={SW} /> : <Bell size={18} strokeWidth={SW} />}
          </span>
          <button className="flex-1 text-left min-h-[44px]" onClick={() => onOpen(r)}>
            <div className="text-[15px] font-semibold">{r.title}</div>
            <div className="text-[14px] text-tertiary leading-snug">{r.text}</div>
          </button>
          <CloseButton onClick={() => dismiss(r.id)} />
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="flex-1 min-w-0">
      <div className={cx('text-[20px] font-semibold tabular-nums', tone === 'ok' && 'text-ok', tone === 'warn' && 'text-warn')}>{value}</div>
      <div className="text-[12px] text-tertiary uppercase tracking-wide">{label}</div>
    </div>
  );
}

function countdownBadge(trip) {
  const st = tripStatus(trip);
  if (st.phase === 'ongoing') return <Badge tone="ok" solid>Day {st.day}</Badge>;
  if (st.phase === 'past') return <Badge tone="grey">Done</Badge>;
  if (st.days <= 7) return <Badge tone="warn" solid>{st.days === 0 ? 'Today' : `${st.days}d`}</Badge>;
  if (st.days <= 30) return <Badge tone="warn">{st.days}d</Badge>;
  return <Badge tone="accent">{st.days}d</Badge>;
}

export default function Home() {
  const { trips, settings, updateTrips } = useStore();
  const { push } = useNav();
  const [seg, setSeg] = useState('upcoming');
  const [adding, setAdding] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const today = todayISO();

  const upcoming = useMemo(() => trips.filter((t) => t.end >= today).sort((a, b) => a.start.localeCompare(b.start)), [trips, today]);
  const past = useMemo(() => trips.filter((t) => t.end < today).sort((a, b) => b.start.localeCompare(a.start)), [trips, today]);
  const reminders = useMemo(() => getReminders(trips, settings), [trips, settings]);
  const pairs = useMemo(() => backToBack(upcoming), [upcoming]);

  const openTrip = (id, tab = 'overview') => push({ name: 'trip', id, tab });
  const onReminder = (r) => {
    setShowReminders(false);
    setTimeout(() => (r.tab === 'settings' ? push({ name: 'settings' }) : openTrip(r.tripId, r.tab)), 260);
  };

  const featured = upcoming[0] || null;
  const journey = featured ? (featured.journeyId ? upcoming.filter((t) => t.journeyId === featured.journeyId) : [featured]) : [];
  const rest = seg === 'upcoming' ? upcoming.filter((t) => t !== featured) : past;

  const link = () => {
    const [a, b] = pairs[0];
    const jid = a.journeyId || b.journeyId || uid();
    updateTrips([a.id, b.id], (t) => { t.journeyId = jid; });
    toast('Linked into one journey');
  };

  return (
    <div className="pb-page">
      <Header
        overline={fmtLong(today)}
        title="Trips"
        left={<IconButton icon={Gear} label="Settings" onClick={() => push({ name: 'settings' })} />}
        right={<IconButton icon={Plus} label="Add trip" onClick={() => setAdding(true)} />}
      />
      <div className="px-4">
        {featured && (
          <FeaturedCard journey={journey} settings={settings} onOpen={() => openTrip(featured.id)} onLink={pairs.length ? link : null} />
        )}

        {reminders.length > 0 && (
          <button
            onClick={() => setShowReminders(true)}
            className="press mt-3 w-full min-h-[48px] rounded-[14px] flex items-center gap-2.5 px-3.5 text-left"
            style={{ background: 'rgb(var(--warn) / 0.14)' }}
          >
            <CircleAlert size={20} strokeWidth={SW} className="text-warn shrink-0" />
            <span className="flex-1 min-w-0 text-[15px] truncate">
              <span className="font-semibold">{reminders.length} {reminders.length === 1 ? 'thing' : 'things'} to do</span>
              <span className="text-label/80"> · {reminders[0].title}</span>
            </span>
            <ChevronRight size={18} strokeWidth={2} className="text-tertiary shrink-0" />
          </button>
        )}

        <Segmented className="mt-5" value={seg} onChange={setSeg} options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]} />

        {rest.length > 0 && (
          <div className="mt-4 bg-card rounded-card overflow-hidden">
            {rest.map((t, i) => (
              <button key={t.id} onClick={() => openTrip(t.id)} className="tap w-full flex items-center gap-3 pl-3 text-left min-h-[64px]">
                <div className="h-11 w-11 rounded-[10px] overflow-hidden shrink-0" style={{ background: t.color }}>
                  {t.cover && <img src={t.cover} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className={cx('flex-1 min-w-0 flex items-center gap-2 pr-3 self-stretch py-2.5', i < rest.length - 1 && 'border-b hairline')}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[17px] font-medium truncate flex items-center gap-1.5">
                      {t.name}
                      {t.journeyId && <Link2 size={14} strokeWidth={SW} className="text-tertiary shrink-0" aria-label="Part of a journey" />}
                    </div>
                    <div className="text-[13px] text-tertiary">{fmtRange(t.start, t.end)} · {nights(t)} nights</div>
                  </div>
                  {countdownBadge(t)}
                  <ChevronRight size={18} strokeWidth={2} className="text-tertiary/70" />
                </div>
              </button>
            ))}
          </div>
        )}

        {seg === 'upcoming' && !upcoming.length && <Empty icon={Luggage} text="No upcoming trips. Tap + to plan your next one." />}
        {seg === 'upcoming' && upcoming.length === 1 && <p className="text-center text-[14px] text-tertiary mt-6">No other upcoming trips. Tap + to add one.</p>}
        {seg === 'past' && !past.length && <Empty icon={Map} text="Trips you have finished will appear here." />}
      </div>

      <Sheet open={showReminders} onClose={() => setShowReminders(false)} title="To do" left={null} right={<TextButton bold onClick={() => setShowReminders(false)}>Done</TextButton>}>
        <div className="mt-3"><Reminders reminders={reminders} onOpen={onReminder} /></div>
      </Sheet>

      <TripForm open={adding} onClose={() => setAdding(false)} onSaved={(id) => setTimeout(() => openTrip(id), 280)} />
    </div>
  );
}

function FeaturedCard({ journey, settings, onOpen, onLink }) {
  const first = journey[0];
  const isJourney = journey.length > 1;
  const start = first.start;
  const end = journey.reduce((m, t) => (t.end > m ? t.end : m), first.end);
  const span = { start, end };
  const st = tripStatus(isJourney ? span : first);
  const title = journey.map((t) => t.name).join(' → ');
  const ready = Math.round(journey.reduce((s, t) => s + readiness(t).pct, 0) / journey.length);
  const packed = journey.reduce((s, t) => s + readiness(t).packed, 0);
  const packTotal = journey.reduce((s, t) => s + t.packing.length, 0);
  const spent = journey.reduce((s, t) => s + budgetStats(t, settings).spent, 0);
  const total = journey.reduce((s, t) => s + (t.budget || 0), 0);
  const over = journey.some((t) => budgetStats(t, settings).over.length);
  const spentPct = total ? Math.round((spent / total) * 100) : 0;
  const overline = `${st.phase === 'ongoing' ? 'Happening now' : 'Next trip'}${isJourney ? ` · Journey of ${journey.length}` : ''}`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()}
      className="press mt-3 bg-card rounded-card overflow-hidden cursor-pointer"
      aria-label={`Open ${title}`}
    >
      <Hero trip={first} height="h-[150px]">
        <div className="text-[13px] font-semibold uppercase tracking-wide">{overline}</div>
        <div className="text-[26px] font-bold leading-tight line-clamp-2">{title}</div>
        <div className="text-[15px]">{fmtRange(start, end)} · {diffDays(end, start)} nights</div>
      </Hero>
      <div className="p-4">
        <div className="flex items-baseline gap-2">
          {st.phase === 'upcoming' ? (
            <>
              <span className="text-[52px] font-bold leading-none tabular-nums tracking-tight">{st.days}</span>
              <span className="text-[20px] font-semibold text-tertiary">{st.days === 1 ? 'day to go' : 'days to go'}</span>
            </>
          ) : (
            <>
              <span className="text-[52px] font-bold leading-none tabular-nums tracking-tight">Day {st.day}</span>
              <span className="text-[20px] font-semibold text-tertiary">of {st.total}</span>
            </>
          )}
        </div>
        <div className="flex mt-4 pt-3 border-t hairline gap-2">
          <Stat label="Ready" value={`${ready}%`} tone={ready >= 100 ? 'ok' : ready < 50 ? 'warn' : undefined} />
          <Stat label="Packed" value={`${packed}/${packTotal}`} tone={packTotal && packed === packTotal ? 'ok' : undefined} />
          <Stat label="Spent" value={`${spentPct}%`} tone={spentPct > 100 || over ? 'warn' : undefined} />
        </div>
        {onLink && (
          <button
            onClick={(e) => { e.stopPropagation(); onLink(); }}
            className="press mt-2 -mb-2 -ml-1 min-h-[44px] px-1 inline-flex items-center gap-1.5 text-accent text-[15px] font-medium"
          >
            <Link2 size={16} strokeWidth={SW} /> Link trips?
          </button>
        )}
      </div>
    </div>
  );
}
