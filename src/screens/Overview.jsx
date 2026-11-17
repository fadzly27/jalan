import { useState } from 'react';
import { CalendarDays, ChevronRight, Circle, CheckCircle2, FileText, Lightbulb, Luggage, MinusCircle, Plus, Wallet } from 'lucide-react';
import { Card, NavBar, ProgressRing, Sheet, SW, TextButton, cx } from '../ui.jsx';
import { useStore } from '../store.jsx';
import { BackButton } from './Trip.jsx';
import TripForm from './TripForm.jsx';
import { useNav } from '../App.jsx';
import { fmtDay, fmtRange, fmtWeekday, nights, tripDays, tripStatus } from '../lib/dates.js';
import { budgetStats, docWarnings, nextPlan, readiness, relevantTip, TODO_SUGGESTIONS } from '../lib/logic.js';
import { PLAN_META } from '../meta.jsx';
import { money, fmtNumber, countryName } from '../lib/currency.js';
import { uid } from '../lib/db.js';

function TripHero({ trip, r }) {
  const st = tripStatus(trip);
  const cities = trip.destinations.map((d) => d.city || countryName(d.country)).filter(Boolean);
  return (
    <div className="relative mt-2 rounded-card overflow-hidden text-white" style={{ background: trip.color || '#0066CC' }}>
      {trip.cover && <img src={trip.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {trip.cover && <div className="absolute inset-0 bg-black/50" />}
      <div className="relative p-4">
        <div className="text-[13px] font-semibold uppercase tracking-wide truncate">{cities.join(' · ')}</div>
        <div className="text-[15px]">{fmtRange(trip.start, trip.end)} · {nights(trip)} nights</div>
        <div className="flex items-end justify-between gap-3 mt-7">
          <div className="min-w-0">
            {st.phase === 'upcoming' && (
              <>
                <div className="text-[52px] font-bold leading-none tabular-nums tracking-tight">{st.days}</div>
                <div className="text-[17px] font-semibold mt-1">{st.days === 1 ? 'day to go' : 'days to go'}</div>
              </>
            )}
            {st.phase === 'ongoing' && (
              <>
                <div className="text-[52px] font-bold leading-none tabular-nums tracking-tight">Day {st.day}</div>
                <div className="text-[17px] font-semibold mt-1">of {st.total}</div>
              </>
            )}
            {st.phase === 'past' && (
              <>
                <div className="text-[34px] font-bold leading-none">Completed</div>
                <div className="text-[17px] font-semibold mt-1">{st.days} days ago</div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="text-right">
              <div className="text-[13px] font-semibold uppercase tracking-wide">Trip ready</div>
              <div className="text-[13px]">Packing, docs, to-dos</div>
            </div>
            <div className="relative">
              <ProgressRing pct={r.pct} size={64} stroke={7} tone="#fff" track="rgba(255,255,255,0.28)" />
              <div className="absolute inset-0 flex items-center justify-center text-[16px] font-bold tabular-nums">{r.pct}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ icon: I, color, label, value, onClick }) {
  return (
    <button onClick={onClick} className="press bg-card rounded-card p-3.5 text-left min-h-[96px] flex flex-col justify-between">
      <span className="h-8 w-8 rounded-[9px] flex items-center justify-center" style={{ background: color }}>
        <I size={18} strokeWidth={SW} color="#fff" />
      </span>
      <div className="mt-3">
        <div className="text-[15px] font-semibold">{label}</div>
        <div className="text-[13px] text-tertiary truncate">{value}</div>
      </div>
    </button>
  );
}

function TodoRow({ t, onToggle, editing, onDelete, onRename, last }) {
  return (
    <div className="flex items-center pl-2 min-h-[48px]">
      {editing ? (
        <button aria-label="Delete to-do" onClick={onDelete} className="press h-11 w-11 flex items-center justify-center text-danger shrink-0">
          <MinusCircle size={22} strokeWidth={SW} />
        </button>
      ) : (
        <button aria-label={t.done ? 'Mark not done' : 'Mark done'} onClick={onToggle} className="press h-11 w-11 flex items-center justify-center shrink-0">
          {t.done ? <CheckCircle2 size={24} strokeWidth={SW} className="text-ok" /> : <Circle size={24} strokeWidth={1.5} className="text-tertiary" />}
        </button>
      )}
      <div className={cx('flex-1 min-w-0 self-stretch flex items-center pr-4', !last && 'border-b hairline')}>
        {editing ? (
          <input value={t.text} onChange={(e) => onRename(e.target.value)} className="w-full bg-transparent outline-none text-[17px] py-3" aria-label="To-do text" />
        ) : (
          <span className={cx('text-[17px] py-3', t.done && 'line-through text-tertiary')}>{t.text}</span>
        )}
      </div>
    </div>
  );
}

function TodoSheet({ trip, open, onClose }) {
  const { updateTrip } = useStore();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const add = (s) => {
    const v = s.trim();
    if (!v) return;
    updateTrip(trip.id, (x) => { x.todos.push({ id: uid(), text: v, done: false }); });
    setText('');
  };
  const mut = (id, fn) => updateTrip(trip.id, (x) => { const y = x.todos.find((z) => z.id === id); if (y) fn(y); });
  const suggestions = TODO_SUGGESTIONS.filter((s) => !trip.todos.some((t) => t.text.toLowerCase() === s.toLowerCase()));
  const list = [...trip.todos.filter((t) => !t.done), ...trip.todos.filter((t) => t.done)];

  return (
    <Sheet
      open={open}
      onClose={() => { setEditing(false); onClose(); }}
      title="To-do"
      left={trip.todos.length ? <TextButton onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'}</TextButton> : null}
      right={<TextButton bold onClick={() => { setEditing(false); onClose(); }}>Close</TextButton>}
    >
      <div className="bg-card rounded-card overflow-hidden mt-3">
        {list.map((t) => (
          <TodoRow
            key={t.id}
            t={t}
            editing={editing}
            onToggle={() => mut(t.id, (y) => { y.done = !y.done; })}
            onDelete={() => updateTrip(trip.id, (x) => { x.todos = x.todos.filter((y) => y.id !== t.id); })}
            onRename={(v) => mut(t.id, (y) => { y.text = v; })}
          />
        ))}
        <form onSubmit={(e) => { e.preventDefault(); add(text); }} className="flex items-center pl-2 min-h-[48px]">
          <span className="h-11 w-11 flex items-center justify-center text-accent"><Plus size={22} strokeWidth={SW} /></span>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a to-do" className="flex-1 bg-transparent outline-none text-[17px] py-3 pr-4 placeholder:text-tertiary" enterKeyHint="done" />
        </form>
      </div>
      {editing && <p className="px-4 pt-1.5 text-[13px] text-tertiary">Tap a to-do to rename it, or the red button to delete it.</p>}
      {suggestions.length > 0 && (
        <>
          <h3 className="px-4 pt-6 pb-2 text-[13px] uppercase tracking-wide text-tertiary">Suggestions</h3>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} onClick={() => add(s)} className="press min-h-[44px] rounded-full bg-card px-3.5 text-[15px] flex items-center gap-1.5 text-accent">
                <Plus size={15} strokeWidth={2} /> {s}
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

export default function Overview({ trip, go }) {
  const { settings, updateTrip } = useStore();
  const { pop } = useNav();
  const [editing, setEditing] = useState(false);
  const [todosOpen, setTodosOpen] = useState(false);
  const r = readiness(trip);
  const b = budgetStats(trip, settings);
  const warnings = docWarnings(trip);
  const next = nextPlan(trip);
  const home = settings.homeCurrency;
  const tip = next ? relevantTip(next) : null;

  const preview = [...trip.todos.filter((t) => !t.done), ...trip.todos.filter((t) => t.done)].slice(0, 3);

  return (
    <div>
      <NavBar left={<BackButton />} title={trip.name} right={<TextButton onClick={() => setEditing(true)}>Edit</TextButton>} />
      <div className="px-4">
        <TripHero trip={trip} r={r} />

        {next && (() => {
          const M = PLAN_META[next.category] || PLAN_META.free;
          return (
            <button onClick={() => go('itinerary')} className="press mt-3 w-full bg-card rounded-card p-3.5 flex items-center gap-3 text-left">
              <span className="h-11 w-11 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: M.color }}>
                <M.icon size={22} strokeWidth={SW} color="#fff" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold uppercase tracking-wide text-tertiary">Next up</div>
                <div className="text-[17px] font-semibold truncate">{next.title}</div>
                <div className="text-[13px] text-tertiary truncate">{fmtWeekday(next.date)} {fmtDay(next.date)}{next.time ? ` · ${next.time}` : ''}{next.place ? ` · ${next.place}` : ''}</div>
                {tip && <div className="text-[13px] text-accent mt-0.5 flex items-center gap-1"><Lightbulb size={13} strokeWidth={SW} className="shrink-0" /><span className="truncate">{tip}</span></div>}
              </div>
              <ChevronRight size={18} strokeWidth={2} className="text-tertiary/70 shrink-0" />
            </button>
          );
        })()}

        <div className="grid grid-cols-2 gap-3 mt-3">
          <Tile icon={CalendarDays} color="#0066CC" label="Itinerary" value={`${tripDays(trip).length} days · ${trip.plans.length} plans`} onClick={() => go('itinerary')} />
          <Tile icon={Luggage} color="#5856D6" label="Packing" value={`${r.packed} of ${r.packTotal} packed`} onClick={() => go('packing')} />
          <Tile
            icon={FileText}
            color={warnings.length ? 'rgb(var(--warn-ink))' : 'rgb(var(--ok-ink))'}
            label="Documents"
            value={<span className={warnings.length ? 'text-warn font-medium' : 'text-ok font-medium'}>{warnings.length ? `${warnings.length} warning${warnings.length > 1 ? 's' : ''}` : 'All saved'}</span>}
            onClick={() => go('docs')}
          />
          <Tile
            icon={Wallet}
            color="#1E7B34"
            label="Budget"
            value={<span className={b.left < 0 ? 'text-warn font-medium' : ''}>{money(b.spent, home, { whole: true })} / {fmtNumber(Math.round(b.total), home, 0)}</span>}
            onClick={() => go('budget')}
          />
        </div>

        <section className="mt-6">
          <div className="flex items-end justify-between px-4 pb-1.5">
            <h2 className="text-[13px] uppercase tracking-wide text-tertiary">To-do · {r.todosDone} of {trip.todos.length}</h2>
            <button onClick={() => setTodosOpen(true)} className="text-[15px] text-accent min-h-[44px] -my-3 px-1">{trip.todos.length ? 'See all' : 'Add'}</button>
          </div>
          {preview.length ? (
            <div className="bg-card rounded-card overflow-hidden">
              {preview.map((t, i) => (
                <TodoRow
                  key={t.id}
                  t={t}
                  last={i === preview.length - 1}
                  onToggle={() => updateTrip(trip.id, (x) => { const y = x.todos.find((z) => z.id === t.id); y.done = !y.done; })}
                />
              ))}
            </div>
          ) : (
            <Card onClick={() => setTodosOpen(true)} className="p-4 text-[15px] text-tertiary">Nothing to arrange yet. Tap to add a to-do or pick a suggestion.</Card>
          )}
          {trip.todos.length > 3 && (
            <button onClick={() => setTodosOpen(true)} className="press w-full min-h-[44px] text-[15px] text-accent">
              {trip.todos.length - 3} more
            </button>
          )}
        </section>
      </div>
      <TodoSheet trip={trip} open={todosOpen} onClose={() => setTodosOpen(false)} />
      <TripForm open={editing} onClose={() => setEditing(false)} trip={trip} onDeleted={pop} />
    </div>
  );
}
