import { useEffect, useRef, useState } from 'react';
import { ImagePlus, MinusCircle, Plus, Trash2, Unlink, X } from 'lucide-react';
import { Avatar, Field, Group, PrimaryButton, Sheet, SW, TextButton, Toggle, cx, inputCls, toast } from '../ui.jsx';
import { CountryPicker } from '../pickers.jsx';
import { useStore } from '../store.jsx';
import { uid } from '../lib/db.js';
import { addDays, todayISO, diffDays } from '../lib/dates.js';
import { countryName, symbol, countryCurrency } from '../lib/currency.js';
import { assignDayCountries, localCurrenciesFor, DEFAULT_TRIP_COLOR, budgetCats } from '../lib/logic.js';
import { YOU, TRAVELLER_COLORS, emptyFund, homeCountryOf, isDomesticDests, nextColor, syncFundMembers, toSen, fromSen } from '../lib/model.js';
import { readAsDataURL, shrinkImage } from '../lib/files.js';

const you = { id: YOU, name: 'You', color: TRAVELLER_COLORS[0] };

const blank = () => ({
  name: '', destinations: [{ country: '', city: '' }], start: addDays(todayISO(), 30), end: addDays(todayISO(), 35), cover: null, budget: '',
  domestic: false, domesticAuto: true, travellers: [you], fundEnabled: false, fundPer: '',
});

export default function TripForm({ open, onClose, trip, onSaved, onDeleted }) {
  const { settings, addTrip, updateTrip, deleteTrip } = useStore();
  const [f, setF] = useState(blank);
  const [pickFor, setPickFor] = useState(null);
  const [tried, setTried] = useState(false);
  const [newName, setNewName] = useState(null); // null = not adding
  const fileRef = useRef(null);
  const home = settings.homeCurrency;
  const homeCountry = homeCountryOf(settings);

  useEffect(() => {
    if (!open) return;
    setTried(false);
    setNewName(null);
    setF(trip ? {
      name: trip.name, destinations: trip.destinations.length ? trip.destinations : [{ country: '', city: '' }], start: trip.start, end: trip.end,
      cover: trip.cover, budget: String(trip.budget || ''),
      domestic: !!trip.domestic, domesticAuto: trip.domestic === isDomesticDests(trip.destinations, settings),
      travellers: trip.travellers, fundEnabled: !!trip.fund?.enabled, fundPer: trip.fund?.perPerson ? String(fromSen(trip.fund.perPerson)) : '',
    } : blank());
  }, [open, trip]); // eslint-disable-line

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const setDest = (i, patch) => setF((x) => {
    const destinations = x.destinations.map((d, j) => (j === i ? { ...d, ...patch } : d));
    return { ...x, destinations, domestic: x.domesticAuto ? isDomesticDests(destinations, settings) : x.domestic };
  });

  const onCover = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const small = await shrinkImage(file, 1400, 0.8);
    set({ cover: await readAsDataURL(small) });
  };

  const addPerson = () => {
    const n = (newName || '').trim();
    if (!n) { setNewName(null); return; }
    setF((x) => ({ ...x, travellers: [...x.travellers, { id: uid(), name: n, color: nextColor(x.travellers) }] }));
    setNewName('');
  };

  const dests = f.destinations.filter((d) => d.country || d.city.trim());
  const problem = !dests.length
    ? 'Add a destination: tap Choose country'
    : dests.some((d) => !d.country)
      ? 'Choose a country for each destination'
      : !f.start || !f.end || f.end < f.start
        ? 'The end date must be on or after the start date'
        : null;

  const save = async () => {
    if (problem) { setTried(true); toast(problem); return; }
    const name = f.name.trim() || dests.map((d) => d.city.trim() || countryName(d.country)).join(' – ');
    const budget = Number(String(f.budget).replace(/,/g, '')) || 0;
    const destinations = dests.map((d) => ({ country: d.country, city: d.city.trim() }));
    const perSen = toSen(String(f.fundPer).replace(/,/g, ''));
    const ids = new Set(f.travellers.map((t) => t.id));
    if (trip) {
      updateTrip(trip.id, (t) => {
        Object.assign(t, { name, destinations, start: f.start, end: f.end, cover: f.cover, budget, domestic: f.domestic, travellers: f.travellers });
        for (const c of localCurrenciesFor(destinations, home)) {
          if (!t.localCurrencies.includes(c)) t.localCurrencies.push(c);
          if (!t.rates[c]) t.rates[c] = { mode: 'live', manual: null, locked: null };
        }
        t.dayCountry = assignDayCountries(t);
        t.plans.forEach((p) => { if (p.who && !ids.has(p.who)) p.who = null; });
        const old = t.fund.perPerson;
        t.fund.members.forEach((m) => { if (m.target === old) m.target = perSen; });
        t.fund.enabled = f.fundEnabled;
        t.fund.perPerson = perSen;
        syncFundMembers(t);
      });
      onSaved?.(trip.id);
    } else {
      const locals = localCurrenciesFor(destinations, home);
      const t = {
        id: uid(), name, destinations, start: f.start, end: f.end, cover: f.cover,
        color: DEFAULT_TRIP_COLOR, domestic: f.domestic, travellers: f.travellers,
        budget, categoryBudgets: Object.fromEntries(budgetCats({ domestic: f.domestic }).map((c) => [c, 0])),
        localCurrencies: locals, rates: Object.fromEntries(locals.map((c) => [c, { mode: 'live', manual: null, locked: null }])),
        dayCountry: {}, plans: [], packing: [], todos: [], docs: [], expenses: [],
        fund: { ...emptyFund(perSen), enabled: f.fundEnabled },
        emergency: { contacts: [], bloodType: '', medical: '', embassy: { name: '', phone: '', address: '' } },
        journeyId: null, createdAt: Date.now(),
      };
      t.dayCountry = assignDayCountries(t);
      await addTrip(t);
      onSaved?.(t.id);
      toast('Trip created');
    }
    onClose();
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${trip.name}"? Its plans, packing list, documents and expenses will be removed from this device.`)) return;
    await deleteTrip(trip.id);
    onClose();
    onDeleted?.();
  };

  const n = f.start && f.end && f.end >= f.start ? diffDays(f.end, f.start) : null;
  const destNames = [...new Set(dests.map((d) => d.country).filter(Boolean))].map(countryName).join(', ');
  const autoLine = f.domesticAuto
    ? (destNames ? `Set automatically: ${countryName(homeCountry)} → ${destNames}` : 'Set automatically from your destination')
    : 'Changed by you';

  return (
    <Sheet open={open} onClose={onClose} title={trip ? 'Edit trip' : 'New trip'} right={<TextButton bold onClick={save}>{trip ? 'Save' : 'Create'}</TextButton>}>
      <Group className="mt-3">
        <Field label="Trip name" last><input className={inputCls} value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Cameron Highlands" /></Field>
      </Group>

      <Group title="Destination" footer={f.domestic ? 'Add each stop. Choose the country, then type the city.' : 'Tap Choose country for each stop. The local currency is set from the country.'}>
        {f.destinations.map((d, i) => (
          <div key={i} className="flex items-center pl-2 min-h-[52px] border-b hairline last:border-b-0">
            {f.destinations.length > 1 ? (
              <button aria-label="Remove destination" onClick={() => setF((x) => {
                const destinations = x.destinations.filter((_, j) => j !== i);
                return { ...x, destinations, domestic: x.domesticAuto ? isDomesticDests(destinations, settings) : x.domestic };
              })} className="press h-11 w-10 flex items-center justify-center text-danger">
                <MinusCircle size={20} strokeWidth={SW} />
              </button>
            ) : <span className="w-2" />}
            <button onClick={() => setPickFor(i)} className="press min-h-[44px] text-left w-[44%] shrink-0 pr-2">
              {d.country ? (
                <span className="text-[17px]">{countryName(d.country)} {!f.domestic && <span className="text-tertiary text-[13px]">{symbol(countryCurrency[d.country])}</span>}</span>
              ) : <span className={cx('text-[17px]', tried ? 'text-warn font-semibold' : 'text-accent')}>Choose country</span>}
            </button>
            <input className={inputCls + ' pr-4'} value={d.city} onChange={(e) => setDest(i, { city: e.target.value })} placeholder="City or area" />
          </div>
        ))}
        <button onClick={() => set({ destinations: [...f.destinations, { country: f.domestic ? homeCountry || '' : '', city: '' }] })} className="tap w-full flex items-center gap-2 px-4 min-h-[48px] text-accent text-[17px] border-t hairline">
          <Plus size={20} strokeWidth={SW} /> Add destination
        </button>
      </Group>

      <Group>
        <div className="flex items-center gap-3 pl-4 pr-3 min-h-[60px] py-1.5">
          <div className="flex-1 min-w-0">
            <div className="text-[17px]">Domestic trip</div>
            <div className="text-[13px] text-tertiary truncate">{autoLine}</div>
          </div>
          <Toggle label="Domestic trip" checked={f.domestic} onChange={(v) => set({ domestic: v, domesticAuto: false })} />
        </div>
      </Group>
      <div className="mt-2 rounded-[14px] bg-fill/[0.1] px-4 py-3 text-[14px] text-tertiary leading-snug">
        {f.domestic
          ? 'All amounts in RM, no exchange rates. No passport, visa or insurance warnings. Local to-dos. Budget adds Petrol, Toll and Parking.'
          : 'Local currency and exchange rates are shown in Budget, and Docs checks your passport, visa and travel insurance.'}
      </div>

      <Group title="Dates" footer={n != null ? `${n} night${n === 1 ? '' : 's'}` : 'The end date must be after the start date.'}>
        <Field label="Start"><input type="date" className={inputCls} value={f.start} onChange={(e) => set({ start: e.target.value, end: f.end < e.target.value ? e.target.value : f.end })} /></Field>
        <Field label="End" last><input type="date" className={inputCls} value={f.end} min={f.start} onChange={(e) => set({ end: e.target.value })} /></Field>
      </Group>

      <Group title="My budget" footer="What you plan to spend yourself. Optional.">
        <Field label={`Total (${symbol(home)})`} last>
          <input inputMode="decimal" className={inputCls} value={f.budget} onChange={(e) => set({ budget: e.target.value.replace(/[^\d.,]/g, '') })} placeholder="0" />
        </Field>
      </Group>

      <section className="mt-6">
        <h2 className="px-4 pb-1.5 text-[13px] uppercase tracking-wide text-tertiary">Travellers</h2>
        <div className="bg-card rounded-card p-3 flex flex-wrap gap-2">
          {f.travellers.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1.5 min-h-[40px] rounded-full bg-fill/[0.1] pl-1 pr-1">
              <Avatar name={t.name} color={t.color} size={30} />
              <span className="text-[15px] px-0.5">{t.id === YOU ? 'You' : t.name}</span>
              {t.id !== YOU ? (
                <button aria-label={`Remove ${t.name}`} onClick={() => set({ travellers: f.travellers.filter((x) => x.id !== t.id) })} className="press h-9 w-9 flex items-center justify-center text-tertiary">
                  <X size={16} strokeWidth={2} />
                </button>
              ) : <span className="w-2" />}
            </span>
          ))}
          {newName === null ? (
            <button onClick={() => setNewName('')} className="press min-h-[40px] rounded-full px-3.5 text-[15px] font-medium text-accent flex items-center gap-1 border border-sep/60">
              <Plus size={16} strokeWidth={2} /> Add
            </button>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); addPerson(); }} className="flex items-center gap-1 min-h-[40px] rounded-full border border-accent pl-3 pr-1">
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onBlur={() => !newName.trim() && setNewName(null)} placeholder="Name" className="bg-transparent outline-none text-[15px] w-28" enterKeyHint="done" aria-label="Traveller name" />
              <button type="submit" className="press min-h-[36px] px-3 rounded-full bg-accent text-white text-[14px] font-semibold">Add</button>
            </form>
          )}
        </div>
        <p className="px-4 pt-1.5 text-[13px] text-tertiary">Names only. Nobody gets an invite or needs the app.</p>
      </section>

      <Group title="Group fund">
        <div className="flex items-center gap-3 pl-4 pr-3 min-h-[60px] py-1.5">
          <div className="flex-1 min-w-0">
            <div className="text-[17px]">Group fund</div>
            <div className="text-[13px] text-tertiary">You collect money and pay shared costs from it</div>
          </div>
          <Toggle label="Group fund" checked={f.fundEnabled} onChange={(v) => set({ fundEnabled: v })} />
        </div>
        {f.fundEnabled && (
          <label className="flex items-center gap-2 pl-4 pr-4 min-h-[52px] border-t hairline">
            <span className="text-[17px] shrink-0">Collect {symbol(home)}</span>
            <input inputMode="decimal" className={inputCls + ' text-right font-semibold'} value={f.fundPer} onChange={(e) => set({ fundPer: e.target.value.replace(/[^\d.]/g, '') })} placeholder="150" aria-label="Amount per person" />
            <span className="text-[17px] shrink-0">each</span>
          </label>
        )}
      </Group>

      <Group title="Cover photo" footer="Optional. Without a photo the trip uses the theme colour.">
        {f.cover ? (
          <div className="relative">
            <img src={f.cover} alt="" className="w-full h-40 object-cover" />
            <div className="flex">
              <button onClick={() => fileRef.current?.click()} className="tap flex-1 min-h-[48px] text-accent text-[17px]">Change</button>
              <button onClick={() => set({ cover: null })} className="tap flex-1 min-h-[48px] text-danger text-[17px] border-l hairline">Remove</button>
            </div>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} className="tap w-full flex items-center gap-2 px-4 min-h-[52px] text-accent text-[17px]">
            <ImagePlus size={20} strokeWidth={SW} /> Add cover photo
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onCover} />
      </Group>

      {trip && (
        <div className="mt-8 space-y-3">
          {trip.journeyId && (
            <button onClick={() => { updateTrip(trip.id, (t) => { t.journeyId = null; }); toast('Removed from journey'); }} className="press w-full bg-card rounded-card min-h-[50px] text-accent text-[17px] flex items-center justify-center gap-2">
              <Unlink size={18} strokeWidth={SW} /> Unlink from journey
            </button>
          )}
          <PrimaryButton tone="danger" onClick={remove}><span className="inline-flex items-center gap-2"><Trash2 size={18} strokeWidth={SW} /> Delete trip</span></PrimaryButton>
        </div>
      )}

      <CountryPicker open={pickFor != null} onClose={() => setPickFor(null)} value={pickFor != null ? f.destinations[pickFor]?.country : null} onPick={(c) => setDest(pickFor, { country: c })} />
    </Sheet>
  );
}
