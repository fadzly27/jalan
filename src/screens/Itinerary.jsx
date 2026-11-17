import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, MinusCircle, Paperclip, Plus, CalendarPlus, Navigation, Globe } from 'lucide-react';
import { Empty, Field, Group, Header, IconButton, Sheet, SW, TextButton, cx, inputCls, PrimaryButton } from '../ui.jsx';
import { useStore } from '../store.jsx';
import { BackButton } from './Trip.jsx';
import { CountryPicker } from '../pickers.jsx';
import { fmtDay, fmtLong, fmtWeekday, parse, todayISO, tripDays } from '../lib/dates.js';
import { dayCountry, sortedPlans, PLAN_CATS, DOC_LABEL } from '../lib/logic.js';
import { countryCurrency, countryName, symbol } from '../lib/currency.js';
import { PLAN_META } from '../meta.jsx';
import { uid } from '../lib/db.js';

export const mapsLinks = (place) => ({
  apple: `https://maps.apple.com/?q=${encodeURIComponent(place)}`,
  google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`,
});

export default function Itinerary({ trip, go }) {
  const { updateTrip, settings } = useStore();
  const days = tripDays(trip);
  const today = todayISO();
  const [day, setDay] = useState(days.includes(today) ? today : days[0]);
  const [editMode, setEditMode] = useState(false);
  const [sheet, setSheet] = useState(null); // {plan} or {new:true}
  const [pickCountry, setPickCountry] = useState(false);
  const scroller = useRef(null);

  useEffect(() => {
    if (!days.includes(day)) setDay(days[0]);
  }, [trip.start, trip.end]); // eslint-disable-line

  useEffect(() => {
    const el = scroller.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [day]);

  const plans = sortedPlans(trip, day);
  const country = dayCountry(trip, day);
  const cur = countryCurrency[country];
  const dayIdx = days.indexOf(day) + 1;

  const move = (id, dir) => updateTrip(trip.id, (t) => {
    const list = t.plans.filter((p) => p.date === day).sort((a, b) => a.order - b.order);
    const i = list.findIndex((p) => p.id === id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const a = list[i].order; list[i].order = list[j].order; list[j].order = a;
  });
  const remove = (id) => updateTrip(trip.id, (t) => { t.plans = t.plans.filter((p) => p.id !== id); });

  const setDayCountry = (c) => updateTrip(trip.id, (t) => {
    t.dayCountry = { ...t.dayCountry, [day]: c };
    const cc = countryCurrency[c];
    if (cc && cc !== settings.homeCurrency && !t.localCurrencies.includes(cc)) {
      t.localCurrencies.push(cc);
      t.rates[cc] = t.rates[cc] || { mode: 'live', manual: null, locked: null };
    }
    if (!t.destinations.some((d) => d.country === c)) t.destinations.push({ country: c, city: '' });
  });

  return (
    <div>
      <Header
        left={<BackButton />}
        right={<>
          {plans.length > 0 && <TextButton onClick={() => setEditMode(!editMode)}>{editMode ? 'Done' : 'Edit'}</TextButton>}
          <IconButton icon={Plus} label="Add plan" onClick={() => setSheet({ new: true })} />
        </>}
        title="Itinerary"
      />

      <div ref={scroller} className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3 snap-x">
        {days.map((d) => {
          const active = d === day;
          const has = trip.plans.some((p) => p.date === d);
          return (
            <button
              key={d}
              data-active={active}
              onClick={() => { setDay(d); setEditMode(false); }}
              className={cx('press snap-center shrink-0 w-[52px] h-[68px] rounded-[14px] flex flex-col items-center justify-center', active ? 'bg-accent text-white' : 'bg-card')}
            >
              <span className={cx('text-[12px] font-medium uppercase', active ? 'text-white/85' : 'text-tertiary')}>{fmtWeekday(d)}</span>
              <span className="text-[20px] font-semibold leading-tight tabular-nums">{parse(d).getDate()}</span>
              <span className={cx('h-1 w-1 rounded-full mt-0.5', has ? (active ? 'bg-white' : 'bg-accent') : 'bg-transparent', d === today && !active && 'bg-ok')} />
            </button>
          );
        })}
      </div>

      <div className="px-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-semibold uppercase tracking-wide text-tertiary">Day {dayIdx}</div>
            <div className="text-[20px] font-semibold">{fmtLong(day)}</div>
          </div>
        </div>
        <button onClick={() => setPickCountry(true)} className="press mt-2 inline-flex items-center gap-1.5 min-h-[36px] rounded-full bg-card px-3 text-[14px]">
          <Globe size={15} strokeWidth={SW} className="text-tertiary" />
          {country ? <>{countryName(country)} <span className="text-tertiary">· {symbol(cur)} {cur}</span></> : <span className="text-accent">Set country</span>}
          <ChevronDown size={15} strokeWidth={2} className="text-tertiary" />
        </button>

        {plans.length === 0 ? (
          <Empty icon={CalendarPlus} text="Nothing planned yet – tap + to add." />
        ) : (
          <ol className="mt-4 relative">
            <div className="absolute left-[55px] top-3 bottom-3 w-px bg-sep" />
            {plans.map((p, i) => {
              const M = PLAN_META[p.category] || PLAN_META.free;
              const doc = p.docId && trip.docs.find((d) => d.id === p.docId);
              return (
                <li key={p.id} className="relative flex items-stretch gap-3 mb-2.5">
                  <div className="w-[42px] shrink-0 text-right pt-3.5 text-[14px] font-semibold tabular-nums">{p.time || <span className="text-tertiary font-normal">–</span>}</div>
                  <div className="relative w-[14px] shrink-0 flex justify-center pt-[19px]">
                    <span className="h-3 w-3 rounded-full ring-4 ring-bg" style={{ background: M.color }} />
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-1">
                    <button onClick={() => !editMode && setSheet({ plan: p })} className="press flex-1 min-w-0 bg-card rounded-[16px] p-3.5 text-left">
                      <div className="text-[17px] font-semibold leading-snug">{p.title}</div>
                      {p.place && <div className="text-[14px] text-tertiary truncate flex items-center gap-1 mt-0.5"><MapPin size={13} strokeWidth={SW} className="shrink-0" />{p.place}</div>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[12px] font-semibold" style={{ background: M.color + '1F', color: M.color }}>
                          <M.icon size={12} strokeWidth={2} /> {M.label}
                        </span>
                        {doc && <span className="inline-flex items-center gap-1 text-[12px] text-tertiary"><Paperclip size={12} strokeWidth={SW} />{doc.title || DOC_LABEL[doc.type]}</span>}
                      </div>
                    </button>
                    {editMode && (
                      <div className="flex flex-col items-center shrink-0">
                        <button aria-label="Move up" disabled={i === 0} onClick={() => move(p.id, -1)} className="press h-9 w-10 flex items-center justify-center text-accent disabled:opacity-30"><ChevronUp size={22} strokeWidth={SW} /></button>
                        <button aria-label="Delete" onClick={() => remove(p.id)} className="press h-9 w-10 flex items-center justify-center text-danger"><MinusCircle size={20} strokeWidth={SW} /></button>
                        <button aria-label="Move down" disabled={i === plans.length - 1} onClick={() => move(p.id, 1)} className="press h-9 w-10 flex items-center justify-center text-accent disabled:opacity-30"><ChevronDown size={22} strokeWidth={SW} /></button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <PlanSheet trip={trip} state={sheet} day={day} days={days} onClose={() => setSheet(null)} go={go} />
      <CountryPicker open={pickCountry} onClose={() => setPickCountry(false)} value={country} onPick={setDayCountry} />
    </div>
  );
}

function PlanSheet({ trip, state, day, days, onClose, go }) {
  const { updateTrip } = useStore();
  const editing = state?.plan;
  const [f, setF] = useState({});
  useEffect(() => {
    if (state) setF(editing ? { ...editing } : { title: '', time: '', place: '', category: 'sight', notes: '', docId: null, date: day });
  }, [state]); // eslint-disable-line
  const set = (p) => setF((x) => ({ ...x, ...p }));

  const save = () => {
    if (!f.title?.trim()) return;
    updateTrip(trip.id, (t) => {
      const data = { ...f, title: f.title.trim(), place: (f.place || '').trim() };
      if (editing) {
        const i = t.plans.findIndex((p) => p.id === editing.id);
        if (data.date !== editing.date) data.order = Math.max(-1, ...t.plans.filter((p) => p.date === data.date).map((p) => p.order)) + 1;
        t.plans[i] = data;
      } else {
        // insert by time among the day's plans
        const list = t.plans.filter((p) => p.date === data.date).sort((a, b) => a.order - b.order);
        let pos = list.length;
        if (data.time) {
          const k = list.findIndex((p) => p.time && p.time > data.time);
          if (k >= 0) pos = k;
        }
        list.splice(pos, 0, { ...data, id: uid() });
        const others = t.plans.filter((p) => p.date !== data.date);
        list.forEach((p, idx) => (p.order = idx));
        t.plans = [...others, ...list];
      }
    });
    onClose();
  };
  const del = () => {
    updateTrip(trip.id, (t) => { t.plans = t.plans.filter((p) => p.id !== editing.id); });
    onClose();
  };
  const links = f.place ? mapsLinks(f.place) : null;

  return (
    <Sheet open={!!state} onClose={onClose} title={editing ? 'Edit Plan' : 'New Plan'} right={<TextButton bold onClick={save} disabled={!f.title?.trim()}>{editing ? 'Save' : 'Add'}</TextButton>}>
      <Group className="mt-3">
        <Field label="Title"><input className={inputCls} value={f.title || ''} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Flight to Seoul" /></Field>
        <Field label="Place" last><input className={inputCls} value={f.place || ''} onChange={(e) => set({ place: e.target.value })} placeholder="Address or name" /></Field>
      </Group>

      <h3 className="px-4 pt-6 pb-1.5 text-[13px] uppercase tracking-wide text-tertiary">Category</h3>
      <div className="grid grid-cols-3 gap-2">
        {PLAN_CATS.map((c) => {
          const M = PLAN_META[c];
          const active = f.category === c;
          return (
            <button key={c} onClick={() => set({ category: c })} className={cx('press min-h-[64px] rounded-[14px] flex flex-col items-center justify-center gap-1 text-[13px] font-medium border-2', active ? 'bg-card' : 'bg-card border-transparent')} style={active ? { borderColor: M.color, color: M.color } : undefined}>
              <M.icon size={20} strokeWidth={SW} style={{ color: M.color }} />
              {M.label}
            </button>
          );
        })}
      </div>

      <Group title="When">
        <Field label="Day">
          <select className={inputCls + ' appearance-none'} value={f.date || day} onChange={(e) => set({ date: e.target.value })}>
            {days.map((d, i) => <option key={d} value={d}>Day {i + 1} · {fmtWeekday(d)} {fmtDay(d)}</option>)}
          </select>
        </Field>
        <Field label="Time" last><input type="time" className={inputCls} value={f.time || ''} onChange={(e) => set({ time: e.target.value })} /></Field>
      </Group>

      <Group title="Attach document" footer={trip.docs.length ? null : 'Add documents in the Docs tab to attach them here.'}>
        <Field label="Document" last>
          <select className={inputCls + ' appearance-none'} value={f.docId || ''} onChange={(e) => set({ docId: e.target.value || null })}>
            <option value="">None</option>
            {trip.docs.map((d) => <option key={d.id} value={d.id}>{d.title || DOC_LABEL[d.type]}</option>)}
          </select>
        </Field>
      </Group>

      <Group title="Notes">
        <textarea className={inputCls + ' px-4 min-h-[88px] resize-none'} value={f.notes || ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Booking number, seat, tips" />
      </Group>

      {links && (
        <div className="grid grid-cols-2 gap-2 mt-6">
          <a href={links.apple} target="_blank" rel="noreferrer" className="press min-h-[48px] rounded-[14px] bg-card flex items-center justify-center gap-2 text-accent text-[15px] font-medium"><Navigation size={17} strokeWidth={SW} /> Apple Maps</a>
          <a href={links.google} target="_blank" rel="noreferrer" className="press min-h-[48px] rounded-[14px] bg-card flex items-center justify-center gap-2 text-accent text-[15px] font-medium"><MapPin size={17} strokeWidth={SW} /> Google Maps</a>
        </div>
      )}
      {editing && f.docId && (
        <button onClick={() => { onClose(); setTimeout(() => go('docs'), 260); }} className="press mt-2 w-full min-h-[48px] rounded-[14px] bg-card flex items-center justify-center gap-2 text-accent text-[15px] font-medium"><Paperclip size={17} strokeWidth={SW} /> Open in Docs</button>
      )}
      {editing && <PrimaryButton tone="danger" className="mt-6" onClick={del}>Delete Plan</PrimaryButton>}
    </Sheet>
  );
}
