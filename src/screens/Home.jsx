import { useMemo, useState } from 'react';
import { Bell, ChevronRight, Link2, Luggage, Plus, Settings as Gear, CircleAlert, Map } from 'lucide-react';
import { Badge, Card, CloseButton, Empty, Header, IconButton, Segmented, SW, cx, toast } from '../ui.jsx';
import { useStore } from '../store.jsx';
import { useNav } from '../App.jsx';
import { fmtLong, fmtRange, nights, todayISO, tripStatus } from '../lib/dates.js';
import { backToBack, budgetStats, getReminders, readiness } from '../lib/logic.js';
import { uid } from '../lib/db.js';
import TripForm from './TripForm.jsx';

export function Hero({ trip, height = 'h-40', children }) {
  return (
    <div className={cx('relative overflow-hidden', height)} style={{ background: trip.color || '#0066CC' }}>
      {trip.cover && <img src={trip.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {trip.cover && <div className="absolute inset-0 bg-black/30" />}
      <div className="relative h-full flex flex-col justify-end p-4 text-white">{children}</div>
    </div>
  );
}

export function Reminders({ reminders, onOpen, limit = 2 }) {
  const { dismiss } = useStore();
  const [all, setAll] = useState(false);
  if (!reminders.length) return null;
  const shown = all ? reminders : reminders.slice(0, limit);
  return (
    <div className="mt-3 space-y-2">
      {shown.map((r) => (
        <div key={r.id} className="anim-fade bg-card rounded-card flex items-start gap-3 p-3.5 pr-4">
          <span className={cx('h-8 w-8 rounded-full flex items-center justify-center shrink-0', r.tone === 'warn' ? 'bg-warn/15 text-warn' : 'bg-accent/12 text-accent')} style={r.tone !== 'warn' ? { background: 'rgb(var(--accent) / 0.12)' } : undefined}>
            {r.tone === 'warn' ? <CircleAlert size={18} strokeWidth={SW} /> : <Bell size={18} strokeWidth={SW} />}
          </span>
          <button className="flex-1 text-left min-h-[44px]" onClick={() => onOpen(r)}>
            <div className="text-[15px] font-semibold">{r.title}</div>
            <div className="text-[14px] text-tertiary leading-snug">{r.text}</div>
          </button>
          <CloseButton onClick={() => dismiss(r.id)} />
        </div>
      ))}
      {reminders.length > limit && (
        <button onClick={() => setAll(!all)} className="press w-full min-h-[44px] text-accent text-[15px]">
          {all ? 'Show less' : `Show ${reminders.length - limit} more`}
        </button>
      )}
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
  const { trips, settings, updateTrips, dismiss } = useStore();
  const { push } = useNav();
  const [seg, setSeg] = useState('upcoming');
  const [adding, setAdding] = useState(false);
  const today = todayISO();

  const upcoming = useMemo(() => trips.filter((t) => t.end >= today).sort((a, b) => a.start.localeCompare(b.start)), [trips, today]);
  const past = useMemo(() => trips.filter((t) => t.end < today).sort((a, b) => b.start.localeCompare(a.start)), [trips, today]);
  const reminders = useMemo(() => getReminders(trips, settings), [trips, settings]);
  const pairs = useMemo(() => backToBack(upcoming).filter(([a, b]) => !settings.dismissed?.[`link:${a.id}:${b.id}`]), [upcoming, settings.dismissed]);

  const openTrip = (id, tab = 'overview') => push({ name: 'trip', id, tab });
  const onReminder = (r) => (r.tab === 'settings' ? push({ name: 'settings' }) : openTrip(r.tripId, r.tab));

  const featured = seg === 'upcoming' ? upcoming[0] : null;
  const rest = seg === 'upcoming' ? upcoming.slice(1) : past;
  const journeyCount = (t) => (t.journeyId ? trips.filter((x) => x.journeyId === t.journeyId).length : 0);

  const link = (a, b) => {
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
        <Reminders reminders={reminders} onOpen={onReminder} />

        {pairs.map(([a, b]) => (
          <div key={a.id + b.id} className="mt-3 bg-card rounded-card p-4">
            <div className="flex items-start gap-3">
              <span className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-accent" style={{ background: 'rgb(var(--accent) / 0.12)' }}>
                <Link2 size={18} strokeWidth={SW} />
              </span>
              <div className="flex-1">
                <div className="text-[15px] font-semibold">Back-to-back trips</div>
                <div className="text-[14px] text-tertiary leading-snug">{a.name} and {b.name} run back to back. Link them into one journey?</div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => link(a, b)} className="press flex-1 min-h-[44px] rounded-[12px] bg-accent text-white text-[15px] font-semibold">Link trips</button>
              <button onClick={() => dismiss(`link:${a.id}:${b.id}`)} className="press flex-1 min-h-[44px] rounded-[12px] bg-fill/[0.12] text-[15px] font-semibold text-accent">Not now</button>
            </div>
          </div>
        ))}

        <Segmented
          className="mt-4"
          value={seg}
          onChange={setSeg}
          options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]}
        />

        {featured && <FeaturedCard trip={featured} settings={settings} journey={journeyCount(featured)} onClick={() => openTrip(featured.id)} />}

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
                      {t.journeyId && <Link2 size={14} strokeWidth={SW} className="text-tertiary shrink-0" />}
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

        {seg === 'upcoming' && !upcoming.length && (
          <Empty icon={Luggage} text="No upcoming trips. Tap + to plan your next one." />
        )}
        {seg === 'past' && !past.length && <Empty icon={Map} text="Trips you have finished will appear here." />}
      </div>

      <TripForm open={adding} onClose={() => setAdding(false)} onSaved={(id) => setTimeout(() => openTrip(id), 280)} />
    </div>
  );
}

function FeaturedCard({ trip, settings, journey, onClick }) {
  const st = tripStatus(trip);
  const r = readiness(trip);
  const b = budgetStats(trip, settings);
  return (
    <Card onClick={onClick} className="mt-4 overflow-hidden">
      <Hero trip={trip} height="h-[150px]">
        {journey > 1 && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-[12px] font-semibold">
            <Link2 size={13} strokeWidth={2} /> Journey · {journey} trips
          </span>
        )}
        <div className="text-[13px] font-semibold uppercase tracking-wide opacity-90">{st.phase === 'ongoing' ? 'Happening now' : 'Next trip'}</div>
        <div className="text-[26px] font-bold leading-tight">{trip.name}</div>
        <div className="text-[15px] opacity-90">{fmtRange(trip.start, trip.end)} · {nights(trip)} nights</div>
      </Hero>
      <div className="p-4">
        <div className="flex items-baseline gap-2">
          {st.phase === 'upcoming' ? (
            <>
              <span className="text-[48px] font-bold leading-none tabular-nums tracking-tight">{st.days}</span>
              <span className="text-[20px] font-semibold text-tertiary">{st.days === 1 ? 'day to go' : 'days to go'}</span>
            </>
          ) : (
            <>
              <span className="text-[48px] font-bold leading-none tabular-nums tracking-tight">Day {st.day}</span>
              <span className="text-[20px] font-semibold text-tertiary">of {st.total}</span>
            </>
          )}
        </div>
        <div className="flex mt-4 pt-3 border-t hairline gap-2">
          <Stat label="Ready" value={`${r.pct}%`} tone={r.pct >= 100 ? 'ok' : r.pct < 50 ? 'warn' : undefined} />
          <Stat label="Packed" value={`${r.packed}/${r.packTotal}`} tone={r.packTotal && r.packed === r.packTotal ? 'ok' : undefined} />
          <Stat label="Budget spent" value={`${b.pct}%`} tone={b.pct > 100 || b.over.length ? 'warn' : undefined} />
        </div>
      </div>
    </Card>
  );
}
