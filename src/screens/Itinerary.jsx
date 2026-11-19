import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, MinusCircle, Paperclip, Plus, CalendarPlus, Navigation, Globe, Share, UserPlus, Car, User } from 'lucide-react';
import { Avatar, AvatarStack, Empty, Field, Group, Header, IconButton, Sheet, SW, TextButton, cx, inputCls, PrimaryButton, toast } from '../ui.jsx';
import { useStore } from '../store.jsx';
import { BackButton } from './Trip.jsx';
import ShareSheet from './ShareSheet.jsx';
import { CountryPicker } from '../pickers.jsx';
import { fmtDay, fmtLong, fmtWeekday, parse, todayISO, tripDays } from '../lib/dates.js';
import { dayCountry, driveLine, sortedPlans, planCatsFor, whoLabel, DOC_LABEL } from '../lib/logic.js';
import { YOU, WHO_NOTES, nextColor, syncFundMembers } from '../lib/model.js';
import { countryCurrency, countryName, symbol } from '../lib/currency.js';
import { PLAN_META } from '../meta.jsx';
import { uid } from '../lib/db.js';

export const mapsLinks = (place) => ({
  apple: `https://maps.apple.com/?q=${encodeURIComponent(place)}`,
  google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`,
});

function travellersLine(trip) {
  if (trip.domestic) return `${trip.travellers.length} traveller${trip.travellers.length === 1 ? '' : 's'}`;
  const others = trip.travellers.filter((t) => t.id !== YOU).map((t) => t.name);
  if (!others.length) return 'Just you so far';
  if (others.length <= 3) return `Travelling with ${others.length === 1 ? others[0] : `${others.slice(0, -1).join(', ')} and ${others[others.length - 1]}`}`;
  return `Travelling with ${others.slice(0, 2).join(', ')} and ${others.length - 2} others`;
}

export default function Itinerary({ trip, go }) {
  const { updateTrip, settings } = useStore();
  const days = tripDays(trip);
  const today = todayISO();
  const [day, setDay] = useState(days.includes(today) ? today : days[0]);
  const [editMode, setEditMode] = useState(false);
  const [sheet, setSheet] = useState(null); // {plan} or {new:true}
  const [pickCountry, setPickCountry] = useState(false);
  const [people, setPeople] = useState(false);
  const [sharing, setSharing] = useState(false);
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
    if (!t.domestic && cc && cc !== settings.homeCurrency && !t.localCurrencies.includes(cc)) {
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
          <IconButton icon={Share} label="Share itinerary" onClick={() => setSharing(true)} />
          <IconButton icon={Plus} label="Add plan" onClick={() => setSheet({ new: true })} />
        </>}
        title="Itinerary"
      />

      <div className="px-4 mt-2">
        <div className="bg-card rounded-card flex items-center gap-3 pl-3.5 pr-2 min-h-[60px] py-2">
          <div className="flex-1 min-w-0">
            <AvatarStack people={trip.travellers} size={30} />
            <div className="text-[14px] leading-snug mt-1 line-clamp-2">{travellersLine(trip)}</div>
          </div>
          <button onClick={() => setPeople(true)} className="press shrink-0 min-h-[44px] px-3 rounded-full text-accent text-[15px] font-semibold flex items-center gap-1.5">
            <UserPlus size={18} strokeWidth={SW} /> Add people
          </button>
        </div>
      </div>

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
              <span className={cx('text-[12px] font-medium uppercase', active ? 'text-white/90' : 'text-tertiary')}>{fmtWeekday(d)}</span>
              <span className="text-[20px] font-semibold leading-tight tabular-nums">{parse(d).getDate()}</span>
              <span className={cx('h-1 w-1 rounded-full mt-0.5', has ? (active ? 'bg-white' : 'bg-accent') : 'bg-transparent', d === today && !active && 'bg-ok')} />
            </button>
          );
        })}
      </div>

      <div className="px-4">
        <div className="text-[13px] font-semibold uppercase tracking-wide text-tertiary">Day {dayIdx}</div>
        <div className="text-[20px] font-semibold">{fmtLong(day)}</div>
        {!trip.domestic && (
          <button onClick={() => setPickCountry(true)} className="press mt-2 inline-flex items-center gap-1.5 min-h-[36px] rounded-full bg-card px-3 text-[14px]">
            <Globe size={15} strokeWidth={SW} className="text-tertiary" />
            {country ? <>{countryName(country)} <span className="text-tertiary">· {symbol(cur)} {cur}</span></> : <span className="text-accent">Set country</span>}
            <ChevronDown size={15} strokeWidth={2} className="text-tertiary" />
          </button>
        )}

        {plans.length === 0 ? (
          <Empty icon={CalendarPlus} text="Nothing planned yet – tap + to add." />
        ) : (
          <ol className="mt-4 relative">
            <div className="absolute left-[55px] top-3 bottom-3 w-px bg-sep" />
            {plans.map((p, i) => {
              const M = PLAN_META[p.category] || PLAN_META.free;
              const doc = p.docId && trip.docs.find((d) => d.id === p.docId);
              const who = whoLabel(trip, p);
              const line = p.category === 'drive' ? driveLine(p) || p.place : p.place;
              return (
                <li key={p.id} className="relative flex items-stretch gap-3 mb-2.5">
                  <div className="w-[42px] shrink-0 text-right pt-3.5 text-[14px] font-semibold tabular-nums">{p.time || <span className="text-tertiary font-normal">–</span>}</div>
                  <div className="relative w-[14px] shrink-0 flex justify-center pt-[19px]">
                    <span className="h-3 w-3 rounded-full ring-4 ring-bg" style={{ background: M.color }} />
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-1">
                    <button onClick={() => !editMode && setSheet({ plan: p })} className="press flex-1 min-w-0 bg-card rounded-[16px] p-3.5 text-left">
                      <div className="text-[17px] font-semibold leading-snug">{p.title}</div>
                      {line && (
                        <div className="text-[14px] text-tertiary truncate flex items-center gap-1 mt-0.5">
                          {p.category === 'drive' ? <Car size={13} strokeWidth={SW} className="shrink-0" /> : <MapPin size={13} strokeWidth={SW} className="shrink-0" />}{line}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[12px] font-semibold" style={{ background: M.color + '1F', color: M.color }}>
                          <M.icon size={12} strokeWidth={2} /> {M.label}
                        </span>
                        {who && <span className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[12px] font-semibold bg-ok/[0.14] text-ok"><User size={12} strokeWidth={2} />{who}</span>}
                        {doc && <span className="inline-flex items-center gap-1 text-[12px] text-tertiary"><Paperclip size={12} strokeWidth={SW} />{doc.title || DOC_LABEL[doc.type]}</span>}
                      </div>
                    </button>
                    {editMode && (
                      <div className="flex flex-col items-center shrink-0">
                        <button aria-label="Move up" disabled={i === 0} onClick={() => move(p.id, -1)} className="press h-11 w-10 flex items-center justify-center text-accent disabled:opacity-30"><ChevronUp size={22} strokeWidth={SW} /></button>
                        <button aria-label="Delete" onClick={() => remove(p.id)} className="press h-11 w-10 flex items-center justify-center text-danger"><MinusCircle size={20} strokeWidth={SW} /></button>
                        <button aria-label="Move down" disabled={i === plans.length - 1} onClick={() => move(p.id, 1)} className="press h-11 w-10 flex items-center justify-center text-accent disabled:opacity-30"><ChevronDown size={22} strokeWidth={SW} /></button>
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
      <PeopleSheet trip={trip} open={people} onClose={() => setPeople(false)} />
      <ShareSheet trip={trip} day={day} open={sharing} onClose={() => setSharing(false)} />
      <CountryPicker open={pickCountry} onClose={() => setPickCountry(false)} value={country} onPick={setDayCountry} />
    </div>
  );
}

export function PeopleSheet({ trip, open, onClose }) {
  const { updateTrip } = useStore();
  const [name, setName] = useState('');
  const add = () => {
    const n = name.trim();
    if (!n) return;
    updateTrip(trip.id, (t) => { t.travellers.push({ id: uid(), name: n, color: nextColor(t.travellers) }); syncFundMembers(t); });
    setName('');
  };
  const del = (p) => {
    if (!window.confirm(`Remove ${p.name} from this trip?`)) return;
    updateTrip(trip.id, (t) => {
      t.travellers = t.travellers.filter((x) => x.id !== p.id);
      t.plans.forEach((pl) => { if (pl.who === p.id) pl.who = null; });
      syncFundMembers(t);
    });
  };
  return (
    <Sheet open={open} onClose={onClose} title="Travellers" left={null} right={<TextButton bold onClick={onClose}>Done</TextButton>}>
      <div className="bg-card rounded-card overflow-hidden mt-3">
        {trip.travellers.map((p) => (
          <div key={p.id} className="flex items-center gap-3 pl-4 min-h-[56px]">
            <Avatar name={p.name} color={p.color} size={34} />
            <div className="flex-1 min-w-0 self-stretch flex items-center border-b hairline pr-2">
              <span className="flex-1 text-[17px] truncate">{p.id === YOU ? 'You' : p.name}</span>
              {p.id === YOU ? <span className="text-[13px] text-tertiary pr-2">Organiser</span> : (
                <button aria-label={`Remove ${p.name}`} onClick={() => del(p)} className="press h-11 w-11 flex items-center justify-center text-danger"><MinusCircle size={20} strokeWidth={SW} /></button>
              )}
            </div>
          </div>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex items-center gap-2 pl-4 pr-2 min-h-[56px]">
          <UserPlus size={20} strokeWidth={SW} className="text-accent shrink-0" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a name" className="flex-1 bg-transparent outline-none text-[17px] py-3 placeholder:text-tertiary" enterKeyHint="done" aria-label="Traveller name" />
          <button type="submit" disabled={!name.trim()} className="press min-h-[36px] px-3.5 rounded-full bg-accent text-white text-[15px] font-semibold disabled:opacity-40">Add</button>
        </form>
      </div>
      <p className="px-4 pt-2 text-[13px] text-tertiary">Names only. No accounts and no access to your contacts. Each person gets a colour automatically.</p>
    </Sheet>
  );
}

const defaultNote = (cat) => (cat === 'drive' ? 'Drives' : cat === 'flight' || cat === 'stay' ? 'Booked by' : cat === 'transport' || cat === 'sight' ? 'Buys tickets' : 'In charge');

function PlanSheet({ trip, state, day, days, onClose, go }) {
  const { updateTrip } = useStore();
  const editing = state?.plan;
  const [f, setF] = useState({});
  useEffect(() => {
    if (state) {
      const cat = trip.domestic ? 'drive' : 'sight';
      setF(editing ? { ...editing } : { title: '', time: '', place: '', category: cat, notes: '', docId: null, date: day, who: null, whoNote: defaultNote(cat), from: '', to: '', durationMin: null });
    }
  }, [state]); // eslint-disable-line
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const isDrive = f.category === 'drive';
  const hrs = f.durationMin ? Math.floor(f.durationMin / 60) : '';
  const mins = f.durationMin ? f.durationMin % 60 : '';
  const setDur = (h, m) => {
    const total = (Number(h) || 0) * 60 + (Number(m) || 0);
    set({ durationMin: total || null });
  };

  const save = () => {
    const title = f.title?.trim() || (isDrive && f.from && f.to ? `Drive to ${f.to.trim()}` : '');
    if (!title) return toast('Give the plan a title');
    updateTrip(trip.id, (t) => {
      const data = { ...f, title, place: (f.place || '').trim(), from: (f.from || '').trim(), to: (f.to || '').trim() };
      if (!data.who) data.whoNote = data.whoNote || '';
      if (editing) {
        const i = t.plans.findIndex((p) => p.id === editing.id);
        if (data.date !== editing.date) data.order = Math.max(-1, ...t.plans.filter((p) => p.date === data.date).map((p) => p.order)) + 1;
        t.plans[i] = data;
      } else {
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
  const mapQuery = isDrive ? f.to || f.place : f.place;
  const links = mapQuery ? mapsLinks(mapQuery) : null;
  const cats = planCatsFor(trip);
  const canSave = !!(f.title?.trim() || (isDrive && f.from && f.to));

  return (
    <Sheet open={!!state} onClose={onClose} title={editing ? 'Edit plan' : 'New plan'} right={<TextButton bold onClick={save} disabled={!canSave}>{editing ? 'Save' : 'Add'}</TextButton>}>
      <Group className="mt-3">
        <Field label="Title"><input className={inputCls} value={f.title || ''} onChange={(e) => set({ title: e.target.value })} placeholder={isDrive ? 'e.g. Drive to Cameron' : 'e.g. Flight to Seoul'} /></Field>
        <Field label="Place" last><input className={inputCls} value={f.place || ''} onChange={(e) => set({ place: e.target.value })} placeholder="Address or name" /></Field>
      </Group>

      <h3 className="px-4 pt-6 pb-1.5 text-[13px] uppercase tracking-wide text-tertiary">Category</h3>
      <div className="grid grid-cols-4 gap-2">
        {cats.map((c) => {
          const M = PLAN_META[c];
          const active = f.category === c;
          return (
            <button key={c} onClick={() => set({ category: c, whoNote: f.who ? f.whoNote : defaultNote(c) })} className={cx('press min-h-[64px] rounded-[14px] bg-card flex flex-col items-center justify-center gap-1 text-[12px] font-medium border-2 px-1', active ? '' : 'border-transparent')} style={active ? { borderColor: M.color, color: M.color } : undefined}>
              <M.icon size={20} strokeWidth={SW} style={{ color: M.color }} />
              {M.label}
            </button>
          );
        })}
      </div>

      {isDrive && (
        <Group title="Drive">
          <Field label="From"><input className={inputCls} value={f.from || ''} onChange={(e) => set({ from: e.target.value })} placeholder="e.g. Kuantan" /></Field>
          <Field label="To"><input className={inputCls} value={f.to || ''} onChange={(e) => set({ to: e.target.value })} placeholder="e.g. Cameron Highlands" /></Field>
          <Field label="About" last>
            <input inputMode="numeric" className={inputCls + ' w-14 text-right'} value={hrs} onChange={(e) => setDur(e.target.value.replace(/\D/g, ''), mins)} placeholder="0" aria-label="Hours" />
            <span className="text-tertiary px-1.5">h</span>
            <input inputMode="numeric" className={inputCls + ' w-14 text-right'} value={mins} onChange={(e) => setDur(hrs, Math.min(59, Number(e.target.value.replace(/\D/g, '')) || 0) || '')} placeholder="0" aria-label="Minutes" />
            <span className="text-tertiary pl-1.5">min</span>
          </Field>
        </Group>
      )}

      <Group title="When">
        <Field label="Day">
          <select className={inputCls + ' appearance-none'} value={f.date || day} onChange={(e) => set({ date: e.target.value })}>
            {days.map((d, i) => <option key={d} value={d}>Day {i + 1} · {fmtWeekday(d)} {fmtDay(d)}</option>)}
          </select>
        </Field>
        <Field label="Time" last><input type="time" className={inputCls} value={f.time || ''} onChange={(e) => set({ time: e.target.value })} /></Field>
      </Group>

      <Group title="Handled by" footer={trip.travellers.length > 1 ? 'Shown on the plan, e.g. "Booked by Adam".' : 'Add people in the travellers card to assign plans to them.'}>
        <Field label="Person">
          <select className={inputCls + ' appearance-none'} value={f.who || ''} onChange={(e) => set({ who: e.target.value || null, whoNote: f.whoNote || defaultNote(f.category) })}>
            <option value="">Nobody</option>
            {trip.travellers.map((t) => <option key={t.id} value={t.id}>{t.id === YOU ? 'You' : t.name}</option>)}
          </select>
        </Field>
        <Field label="Role" last>
          <select className={inputCls + ' appearance-none disabled:opacity-40'} disabled={!f.who} value={f.whoNote || defaultNote(f.category)} onChange={(e) => set({ whoNote: e.target.value })}>
            {WHO_NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
      </Group>

      <Group title="Attach document" footer={trip.docs.length ? null : 'Add documents in the Docs tab to attach them here.'}>
        <Field label="Document" last>
          <select className={inputCls + ' appearance-none'} value={f.docId || ''} onChange={(e) => set({ docId: e.target.value || null })}>
            <option value="">None</option>
            {trip.docs.map((d) => <option key={d.id} value={d.id}>{d.title || DOC_LABEL[d.type]}</option>)}
          </select>
        </Field>
      </Group>

      <Group title="Notes" footer="Notes stay private and are never shared.">
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
      {editing && <PrimaryButton tone="danger" className="mt-6" onClick={del}>Delete plan</PrimaryButton>}
    </Sheet>
  );
}
