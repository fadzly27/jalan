import { useEffect, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { Avatar, Chip, Field, Group, PrimaryButton, Segmented, Sheet, SW, TextButton, cx, inputCls, toast } from '../ui.jsx';
import { AmountHeader, AmountKeypad, CurrencySwitch, applyKey, trimToCurrency } from './AmountPad.jsx';
import { useStore } from '../store.jsx';
import { budgetCats, defaultCurrencyFor, localsOf, rateFor } from '../lib/logic.js';
import { BUDGET_META } from '../meta.jsx';
import { round } from '../lib/currency.js';
import { todayISO } from '../lib/dates.js';
import { YOU } from '../lib/model.js';
import { uid } from '../lib/db.js';

const TYPES = [
  { value: 'in', label: 'Money in' },
  { value: 'out', label: 'Paid from fund' },
  { value: 'own', label: 'Someone paid' },
];

function MemberChips({ members, value, onChange, multi }) {
  const isOn = (id) => (multi ? value.includes(id) : value === id);
  const toggle = (id) => {
    if (!multi) return onChange(id);
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((m) => (
        <button
          key={m.id}
          onClick={() => toggle(m.id)}
          aria-pressed={isOn(m.id)}
          className={cx('press min-h-[40px] rounded-full pl-1 pr-3 flex items-center gap-1.5 text-[15px] border', isOn(m.id) ? 'bg-accent text-white border-accent' : 'bg-card border-sep/60')}
        >
          <Avatar name={m.name} color={m.color} size={30} />
          {m.id === YOU ? 'You' : m.name}
          {multi && isOn(m.id) && <Check size={15} strokeWidth={2.5} />}
        </button>
      ))}
    </div>
  );
}

export default function FundEntrySheet({ trip, open, onClose, entry, initialType = 'in' }) {
  const { settings, updateTrip } = useStore();
  const home = settings.homeCurrency;
  const locals = localsOf(trip);
  const currencies = [...locals, home];
  const members = trip.fund.members;
  const allIds = members.map((m) => m.id);
  const [type, setType] = useState('in');
  const [amt, setAmt] = useState('');
  const [cur, setCur] = useState(home);
  const [memberId, setMemberId] = useState(YOU);
  const [paidBy, setPaidBy] = useState(YOU);
  const [method, setMethod] = useState('cash');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Food');
  const [split, setSplit] = useState(allIds);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    if (entry) {
      setType(entry.type); setAmt(String(entry.amount)); setCur(entry.currency);
      setMemberId(entry.memberId || YOU); setPaidBy(entry.paidBy || YOU); setMethod(entry.method || 'cash');
      setTitle(entry.title || ''); setCategory(entry.category || 'Food');
      setSplit(entry.splitBetween?.length ? entry.splitBetween : allIds); setDate(entry.date); setNote(entry.note || '');
    } else {
      const d = todayISO();
      setType(initialType); setAmt(''); setCur(initialType === 'in' ? home : defaultCurrencyFor(trip, d, settings));
      setMemberId(members.find((m) => m.id !== YOU)?.id || YOU); setPaidBy(YOU); setMethod('cash');
      setTitle(''); setCategory('Food'); setSplit(allIds); setDate(d); setNote('');
    }
  }, [open]); // eslint-disable-line

  const amount = Number(amt || 0);
  const same = entry && entry.currency === cur;
  const rate = same ? entry.rate : rateFor(trip, cur, settings);
  const other = cur === home ? locals[0] : home;
  const otherRate = other ? rateFor(trip, other, settings) : null;

  const valid = amount > 0 && rate && (type === 'in' ? memberId : split.length > 0) && (type !== 'own' || paidBy);

  const save = () => {
    if (!valid) return toast(!amount ? 'Type an amount first' : split.length === 0 ? 'Choose who shares this cost' : 'Something is missing');
    const sen = Math.round((amount / rate) * 100);
    const base = { type, amount: round(amount, cur), currency: cur, rate, sen, date, note: note.trim() };
    const data = type === 'in'
      ? { ...base, memberId, method }
      : type === 'out'
        ? { ...base, title: title.trim() || category, category, splitBetween: split }
        : { ...base, paidBy, title: title.trim() || category, category, splitBetween: split };
    updateTrip(trip.id, (t) => {
      if (entry) t.fund.entries = t.fund.entries.map((x) => (x.id === entry.id ? { id: x.id, createdAt: x.createdAt, ...data } : x));
      else t.fund.entries.push({ id: uid(), createdAt: Date.now(), ...data });
      t.fund.settledAt = null;
    });
    toast(entry ? 'Entry updated' : 'Entry added');
    onClose();
  };

  const del = () => {
    if (!window.confirm('Delete this entry?')) return;
    updateTrip(trip.id, (t) => { t.fund.entries = t.fund.entries.filter((x) => x.id !== entry.id); t.fund.settledAt = null; });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={entry ? 'Edit entry' : 'Group fund'} right={<TextButton bold disabled={!valid} onClick={save}>Save</TextButton>}>
      <Segmented className="mt-3" value={type} onChange={setType} options={TYPES} />
      <AmountHeader amt={amt} cur={cur} home={home} rate={rate} other={other} otherRate={otherRate} />
      <CurrencySwitch currencies={currencies} value={cur} onChange={(c) => { setCur(c); setAmt((a) => trimToCurrency(a, c)); }} />

      {type === 'in' && (
        <>
          <h3 className="px-1 pt-5 pb-2 text-[13px] uppercase tracking-wide text-tertiary">Who paid in</h3>
          <MemberChips members={members} value={memberId} onChange={setMemberId} />
          <Segmented className="mt-4" value={method} onChange={setMethod} options={[{ value: 'cash', label: 'Cash' }, { value: 'transfer', label: 'Transfer' }]} />
        </>
      )}

      {type === 'own' && (
        <>
          <h3 className="px-1 pt-5 pb-2 text-[13px] uppercase tracking-wide text-tertiary">Who paid with their own money</h3>
          <MemberChips members={members} value={paidBy} onChange={setPaidBy} />
        </>
      )}

      {type !== 'in' && (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar mt-4 -mx-4 px-4">
            {budgetCats(trip).map((c) => <Chip key={c} active={category === c} onClick={() => setCategory(c)} icon={BUDGET_META[c].icon}>{c}</Chip>)}
          </div>
          <div className="flex items-end justify-between px-1 pt-5 pb-2">
            <h3 className="text-[13px] uppercase tracking-wide text-tertiary">Split between</h3>
            <button onClick={() => setSplit(split.length === allIds.length ? [] : allIds)} className="text-[15px] text-accent min-h-[32px]">{split.length === allIds.length ? 'Clear' : 'Everyone'}</button>
          </div>
          <MemberChips members={members} value={split} onChange={setSplit} multi />
          {split.length > 0 && amount > 0 && rate && <p className="px-1 pt-2 text-[13px] text-tertiary">About {(amount / rate / split.length).toFixed(2)} {home} each</p>}
        </>
      )}

      <Group className="mt-4">
        {type !== 'in' && <Field label="What"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'out' ? 'e.g. Dinner at Gwangjang' : 'e.g. Petrol, paid by Adam'} /></Field>}
        <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value || todayISO())} /></Field>
        <Field label="Note" last><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></Field>
      </Group>

      <AmountKeypad cur={cur} onKey={(k) => setAmt((a) => applyKey(a, k, cur))} />
      <PrimaryButton className="mt-3" disabled={!valid} onClick={save}>{entry ? 'Save changes' : type === 'in' ? 'Add money in' : type === 'out' ? 'Add payment' : 'Add own-pocket payment'}</PrimaryButton>
      {entry && (
        <button onClick={del} className="press mt-2 w-full min-h-[48px] text-danger text-[17px] flex items-center justify-center gap-2"><Trash2 size={18} strokeWidth={SW} /> Delete entry</button>
      )}
    </Sheet>
  );
}
