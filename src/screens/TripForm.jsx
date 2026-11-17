import { useEffect, useRef, useState } from 'react';
import { ImagePlus, MinusCircle, Plus, Trash2, Unlink } from 'lucide-react';
import { Field, Group, PrimaryButton, Sheet, SW, TextButton, cx, inputCls, toast } from '../ui.jsx';
import { CountryPicker } from '../pickers.jsx';
import { useStore } from '../store.jsx';
import { uid } from '../lib/db.js';
import { addDays, todayISO, diffDays } from '../lib/dates.js';
import { countryName, symbol, countryCurrency } from '../lib/currency.js';
import { assignDayCountries, localCurrenciesFor, TRIP_COLORS, BUDGET_CATS } from '../lib/logic.js';
import { readAsDataURL, shrinkImage } from '../lib/files.js';

const blank = () => ({
  name: '', destinations: [{ country: '', city: '' }], start: addDays(todayISO(), 30), end: addDays(todayISO(), 35), cover: null, budget: '',
});

export default function TripForm({ open, onClose, trip, onSaved, onDeleted }) {
  const { settings, addTrip, updateTrip, deleteTrip } = useStore();
  const [f, setF] = useState(blank);
  const [pickFor, setPickFor] = useState(null);
  const [tried, setTried] = useState(false);
  const fileRef = useRef(null);
  const home = settings.homeCurrency;

  useEffect(() => {
    if (open) setTried(false);
    if (open) setF(trip ? { name: trip.name, destinations: trip.destinations.length ? trip.destinations : [{ country: '', city: '' }], start: trip.start, end: trip.end, cover: trip.cover, budget: String(trip.budget || '') } : blank());
  }, [open, trip]);

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const setDest = (i, patch) => setF((x) => ({ ...x, destinations: x.destinations.map((d, j) => (j === i ? { ...d, ...patch } : d)) }));

  const onCover = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const small = await shrinkImage(file, 1400, 0.8);
    set({ cover: await readAsDataURL(small) });
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
    if (trip) {
      updateTrip(trip.id, (t) => {
        Object.assign(t, { name, destinations, start: f.start, end: f.end, cover: f.cover, budget });
        for (const c of localCurrenciesFor(destinations, home)) {
          if (!t.localCurrencies.includes(c)) t.localCurrencies.push(c);
          if (!t.rates[c]) t.rates[c] = { mode: 'live', manual: null, locked: null };
        }
        t.dayCountry = assignDayCountries(t);
      });
      onSaved?.(trip.id);
    } else {
      const locals = localCurrenciesFor(destinations, home);
      const t = {
        id: uid(), name, destinations, start: f.start, end: f.end, cover: f.cover,
        color: TRIP_COLORS[Math.floor(Math.random() * TRIP_COLORS.length)],
        budget, categoryBudgets: Object.fromEntries(BUDGET_CATS.map((c) => [c, 0])),
        localCurrencies: locals, rates: Object.fromEntries(locals.map((c) => [c, { mode: 'live', manual: null, locked: null }])),
        dayCountry: {}, plans: [], packing: [], todos: [], docs: [], expenses: [],
        emergency: { contacts: [], bloodType: '', medical: '', embassy: { name: '', phone: '', address: '' } },
        journeyId: null, createdAt: Date.now(),
      };
      t.dayCountry = assignDayCountries(t);
      await addTrip(t);
      onSaved?.(t.id);
      toast('Trip added');
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

  return (
    <Sheet open={open} onClose={onClose} title={trip ? 'Edit Trip' : 'New Trip'} right={<TextButton bold onClick={save}>{trip ? 'Save' : 'Add'}</TextButton>}>
      <Group className="mt-3">
        <Field label="Name" last><input className={inputCls} value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Seoul – Busan" /></Field>
      </Group>

      <Group title="Destinations" footer="Tap Choose country for each stop. The local currency is set from the country, and you can change it later in Budget.">
        {f.destinations.map((d, i) => (
          <div key={i} className="flex items-center pl-2 min-h-[52px] border-b hairline last:border-b-0">
            {f.destinations.length > 1 ? (
              <button aria-label="Remove destination" onClick={() => set({ destinations: f.destinations.filter((_, j) => j !== i) })} className="press h-11 w-10 flex items-center justify-center text-danger">
                <MinusCircle size={20} strokeWidth={SW} />
              </button>
            ) : <span className="w-2" />}
            <button onClick={() => setPickFor(i)} className="press min-h-[44px] text-left w-[44%] shrink-0 pr-2">
              {d.country ? (
                <span className="text-[17px]">{countryName(d.country)} <span className="text-tertiary text-[13px]">{symbol(countryCurrency[d.country])}</span></span>
              ) : <span className={cx('text-[17px]', tried ? 'text-warn font-semibold' : 'text-accent')}>Choose country</span>}
            </button>
            <input className={inputCls + ' pr-4'} value={d.city} onChange={(e) => setDest(i, { city: e.target.value })} placeholder="City" />
          </div>
        ))}
        <button onClick={() => set({ destinations: [...f.destinations, { country: '', city: '' }] })} className="tap w-full flex items-center gap-2 px-4 min-h-[48px] text-accent text-[17px] border-t hairline">
          <Plus size={20} strokeWidth={SW} /> Add destination
        </button>
      </Group>

      <Group title="Dates" footer={n != null ? `${n} night${n === 1 ? '' : 's'}` : 'The end date must be after the start date.'}>
        <Field label="Start"><input type="date" className={inputCls} value={f.start} onChange={(e) => set({ start: e.target.value, end: f.end < e.target.value ? e.target.value : f.end })} /></Field>
        <Field label="End" last><input type="date" className={inputCls} value={f.end} min={f.start} onChange={(e) => set({ end: e.target.value })} /></Field>
      </Group>

      <Group title="Budget">
        <Field label={`Total (${symbol(home)})`} last>
          <input inputMode="decimal" className={inputCls} value={f.budget} onChange={(e) => set({ budget: e.target.value.replace(/[^\d.,]/g, '') })} placeholder="0" />
        </Field>
      </Group>

      <Group title="Cover photo" footer="Optional. Without a photo the trip uses a solid colour.">
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
          <PrimaryButton tone="danger" onClick={remove}><span className="inline-flex items-center gap-2"><Trash2 size={18} strokeWidth={SW} /> Delete Trip</span></PrimaryButton>
        </div>
      )}

      <CountryPicker open={pickFor != null} onClose={() => setPickFor(null)} value={pickFor != null ? f.destinations[pickFor]?.country : null} onPick={(c) => setDest(pickFor, { country: c })} />
    </Sheet>
  );
}
