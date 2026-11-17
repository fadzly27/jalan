import { useState } from 'react';
import { CalendarDays, Circle, CheckCircle2, FileText, Lightbulb, Luggage, MinusCircle, Plus, Wallet } from 'lucide-react';
import { Card, Group, Header, Row, ProgressRing, SW, TextButton, cx } from '../ui.jsx';
import { useStore } from '../store.jsx';
import { BackButton } from './Trip.jsx';
import { Hero } from './Home.jsx';
import TripForm from './TripForm.jsx';
import { useNav } from '../App.jsx';
import { fmtDay, fmtRange, fmtWeekday, nights, tripDays, tripStatus } from '../lib/dates.js';
import { budgetStats, docWarnings, nextPlan, planTip, readiness, TODO_SUGGESTIONS } from '../lib/logic.js';
import { PLAN_META } from '../meta.jsx';
import { money, countryName } from '../lib/currency.js';
import { uid } from '../lib/db.js';

export default function Overview({ trip, go }) {
  const { settings, updateTrip } = useStore();
  const { pop } = useNav();
  const [editing, setEditing] = useState(false);
  const [editTodos, setEditTodos] = useState(false);
  const [newTodo, setNewTodo] = useState('');
  const st = tripStatus(trip);
  const r = readiness(trip);
  const b = budgetStats(trip, settings);
  const warnings = docWarnings(trip);
  const next = nextPlan(trip);
  const home = settings.homeCurrency;
  const cities = trip.destinations.map((d) => d.city || countryName(d.country)).filter(Boolean);

  const addTodo = (text) => {
    const t = text.trim();
    if (!t) return;
    updateTrip(trip.id, (x) => { x.todos.push({ id: uid(), text: t, done: false }); });
    setNewTodo('');
  };
  const suggestions = TODO_SUGGESTIONS.filter((s) => !trip.todos.some((t) => t.text.toLowerCase() === s.toLowerCase())).slice(0, 5);

  return (
    <div>
      <Header left={<BackButton />} right={<TextButton onClick={() => setEditing(true)}>Edit</TextButton>} title="Overview" />
      <div className="px-4">
        <Card className="mt-3 overflow-hidden">
          <Hero trip={trip} height="h-[180px]">
            <div className="text-[13px] font-semibold uppercase tracking-wide opacity-90">{cities.join(' · ')}</div>
            <div className="text-[28px] font-bold leading-tight">{trip.name}</div>
            <div className="text-[15px] opacity-90">{fmtRange(trip.start, trip.end)} · {nights(trip)} nights</div>
          </Hero>
        </Card>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <Card className="p-4">
            <div className="text-[13px] font-semibold text-tertiary uppercase tracking-wide">Countdown</div>
            {st.phase === 'upcoming' && <><div className="text-[40px] font-bold leading-tight tabular-nums">{st.days}</div><div className="text-[15px] text-tertiary">{st.days === 1 ? 'day to go' : 'days to go'}</div></>}
            {st.phase === 'ongoing' && <><div className="text-[40px] font-bold leading-tight tabular-nums">Day {st.day}</div><div className="text-[15px] text-tertiary">of {st.total}</div></>}
            {st.phase === 'past' && <><div className="text-[28px] font-bold leading-tight mt-2 text-ok">Done</div><div className="text-[15px] text-tertiary">{st.days} days ago</div></>}
          </Card>
          <Card className="p-4">
            <div className="text-[13px] font-semibold text-tertiary uppercase tracking-wide">Trip ready</div>
            <div className="flex items-center gap-3 mt-1">
              <div className="relative">
                <ProgressRing pct={r.pct} size={62} stroke={7} />
                <div className="absolute inset-0 flex items-center justify-center text-[15px] font-bold tabular-nums">{r.pct}%</div>
              </div>
              <div className="text-[12px] text-tertiary leading-snug">Packing, documents and to-dos</div>
            </div>
          </Card>
        </div>

        {next && (
          <Card className="mt-3 p-4" onClick={() => go('itinerary')}>
            <div className="text-[13px] font-semibold text-tertiary uppercase tracking-wide">Next up</div>
            <div className="flex items-center gap-3 mt-2">
              {(() => { const M = PLAN_META[next.category] || PLAN_META.free; return (
                <span className="h-11 w-11 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: M.color }}><M.icon size={22} strokeWidth={SW} color="#fff" /></span>
              ); })()}
              <div className="min-w-0">
                <div className="text-[17px] font-semibold truncate">{next.title}</div>
                <div className="text-[14px] text-tertiary truncate">{fmtWeekday(next.date)} {fmtDay(next.date)}{next.time ? ` · ${next.time}` : ''}{next.place ? ` · ${next.place}` : ''}</div>
              </div>
            </div>
            <div className="flex gap-2 mt-3 rounded-[12px] bg-fill/[0.08] p-3">
              <Lightbulb size={18} strokeWidth={SW} className="text-accent shrink-0 mt-px" />
              <p className="text-[14px] leading-snug text-label/80">{planTip(next)}</p>
            </div>
          </Card>
        )}

        <Group>
          <Row icon={CalendarDays} iconColor="#0066CC" title="Itinerary" value={`${tripDays(trip).length} days · ${trip.plans.length} plans`} onClick={() => go('itinerary')} />
          <Row icon={Luggage} iconColor="#5856D6" title="Packing" value={`${r.packed} of ${r.packTotal}`} onClick={() => go('packing')} />
          <Row
            icon={FileText}
            iconColor={warnings.length ? 'rgb(var(--warn))' : 'rgb(var(--ok))'}
            title="Documents"
            value={<span className={warnings.length ? 'text-warn' : 'text-ok'}>{warnings.length ? `${warnings.length} warning${warnings.length > 1 ? 's' : ''}` : 'All good'}</span>}
            onClick={() => go('docs')}
          />
          <Row icon={Wallet} iconColor="#24A648" title="Budget" value={<span className={b.left < 0 ? 'text-warn' : ''}>{money(b.spent, home, { short: true, whole: true })} / {money(b.total, home, { short: true, whole: true })}</span>} onClick={() => go('budget')} last />
        </Group>

        <section className="mt-6">
          <div className="flex items-end justify-between px-4 pb-1.5">
            <h2 className="text-[13px] uppercase tracking-wide text-tertiary">To-do · {r.todosDone} of {trip.todos.length}</h2>
            {trip.todos.length > 0 && <button onClick={() => setEditTodos(!editTodos)} className="text-[15px] text-accent min-h-[32px]">{editTodos ? 'Done' : 'Edit'}</button>}
          </div>
          <div className="bg-card rounded-card overflow-hidden">
            {trip.todos.map((t) => (
              <div key={t.id} className="flex items-center pl-2 min-h-[48px] border-b hairline">
                {editTodos ? (
                  <button aria-label="Delete to-do" onClick={() => updateTrip(trip.id, (x) => { x.todos = x.todos.filter((y) => y.id !== t.id); })} className="press h-11 w-11 flex items-center justify-center text-danger">
                    <MinusCircle size={22} strokeWidth={SW} />
                  </button>
                ) : (
                  <button aria-label={t.done ? 'Mark not done' : 'Mark done'} onClick={() => updateTrip(trip.id, (x) => { const y = x.todos.find((z) => z.id === t.id); y.done = !y.done; })} className="press h-11 w-11 flex items-center justify-center">
                    {t.done ? <CheckCircle2 size={24} strokeWidth={SW} className="text-ok" /> : <Circle size={24} strokeWidth={1.5} className="text-tertiary/70" />}
                  </button>
                )}
                <span className={cx('flex-1 text-[17px] pr-4', t.done && 'line-through text-tertiary')}>{t.text}</span>
              </div>
            ))}
            <form onSubmit={(e) => { e.preventDefault(); addTodo(newTodo); }} className="flex items-center pl-2 min-h-[48px]">
              <span className="h-11 w-11 flex items-center justify-center text-accent"><Plus size={22} strokeWidth={SW} /></span>
              <input value={newTodo} onChange={(e) => setNewTodo(e.target.value)} placeholder="Add a to-do" className="flex-1 bg-transparent outline-none text-[17px] py-3 pr-4 placeholder:text-tertiary/70" enterKeyHint="done" />
            </form>
          </div>
          {!trip.todos.length && <p className="px-4 pt-1.5 text-[13px] text-tertiary">Add what you still need to arrange, or tap a suggestion.</p>}
          {suggestions.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 -mx-4 px-4">
              {suggestions.map((s) => (
                <button key={s} onClick={() => addTodo(s)} className="press shrink-0 min-h-[36px] rounded-full bg-card px-3.5 text-[15px] flex items-center gap-1.5 text-accent">
                  <Plus size={15} strokeWidth={2} /> {s}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
      <TripForm open={editing} onClose={() => setEditing(false)} trip={trip} onDeleted={pop} />
    </div>
  );
}
