import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, Eye, MinusCircle, Trash2 } from 'lucide-react';
import { Chip, Field, Group, PrimaryButton, Sheet, SW, TextButton, inputCls, toast } from '../ui.jsx';
import { AmountHeader, AmountKeypad, CurrencySwitch, applyKey, trimToCurrency } from './AmountPad.jsx';
import { useStore } from '../store.jsx';
import { budgetCats, defaultCurrencyFor, localsOf, rateFor } from '../lib/logic.js';
import { BUDGET_META } from '../meta.jsx';
import { round } from '../lib/currency.js';
import { todayISO } from '../lib/dates.js';
import { shrinkImage } from '../lib/files.js';
import { uid } from '../lib/db.js';
import { FileViewer } from './Docs.jsx';

export default function AddExpense({ trip, open, onClose, expense }) {
  const { settings, updateTrip, saveFile, deleteFile } = useStore();
  const home = settings.homeCurrency;
  const locals = localsOf(trip);
  const currencies = [...locals, home];
  const [amt, setAmt] = useState('');
  const [cur, setCur] = useState(home);
  const [curTouched, setCurTouched] = useState(false);
  const [cat, setCat] = useState('Food');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());
  const [receipt, setReceipt] = useState(null);
  const [viewing, setViewing] = useState(false);
  const fileRef = useRef(null);
  const origReceipt = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (expense) {
      setAmt(String(expense.amount));
      setCur(expense.currency);
      setCurTouched(true);
      setCat(expense.category);
      setNote(expense.note || '');
      setDate(expense.date);
      setReceipt(expense.receiptId);
      origReceipt.current = expense.receiptId;
    } else {
      const d = todayISO();
      setAmt(''); setCat('Food'); setNote(''); setDate(d); setReceipt(null); setCurTouched(false);
      setCur(defaultCurrencyFor(trip, d, settings));
      origReceipt.current = null;
    }
  }, [open]); // eslint-disable-line

  useEffect(() => {
    if (open && !curTouched && !expense) setCur(defaultCurrencyFor(trip, date, settings));
  }, [date]); // eslint-disable-line

  const amount = Number(amt || 0);
  const sameAsOriginal = expense && expense.currency === cur;
  const rate = sameAsOriginal ? expense.rate : rateFor(trip, cur, settings);
  const other = cur === home ? locals[0] : home;
  const otherRate = other ? rateFor(trip, other, settings) : null;
  const homeAmount = rate ? amount / rate : null;

  const onKey = (k) => setAmt((a) => applyKey(a, k, cur));

  const switchCur = (c) => {
    setCur(c);
    setCurTouched(true);
    setAmt((a) => trimToCurrency(a, c));
  };

  const onReceipt = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const id = await saveFile(await shrinkImage(file, 1800, 0.8));
    if (receipt && receipt !== origReceipt.current) deleteFile(receipt);
    setReceipt(id);
  };

  const cancel = () => {
    if (receipt && receipt !== origReceipt.current) deleteFile(receipt);
    onClose();
  };

  const save = () => {
    if (!amount || !rate) return;
    const data = {
      amount: round(amount, cur), currency: cur, rate, home,
      homeAmount: Math.round(homeAmount * 1e4) / 1e4,
      category: cat, note: note.trim(), date, receiptId: receipt,
    };
    updateTrip(trip.id, (t) => {
      if (expense) t.expenses = t.expenses.map((x) => (x.id === expense.id ? { ...x, ...data } : x));
      else t.expenses.push({ ...data, id: uid(), createdAt: Date.now() });
    });
    if (origReceipt.current && origReceipt.current !== receipt) deleteFile(origReceipt.current);
    toast(expense ? 'Expense updated' : 'Expense added');
    onClose();
  };

  const del = () => {
    if (!window.confirm('Delete this expense?')) return;
    updateTrip(trip.id, (t) => { t.expenses = t.expenses.filter((x) => x.id !== expense.id); });
    deleteFile(expense.receiptId);
    if (receipt !== expense.receiptId) deleteFile(receipt);
    onClose();
  };

  return (
    <Sheet open={open} onClose={cancel} title={expense ? 'Edit expense' : 'Add expense'} right={<TextButton bold disabled={!amount || !rate} onClick={save}>Save</TextButton>}>
      <AmountHeader amt={amt} cur={cur} home={home} rate={rate} other={other} otherRate={otherRate} />
      <CurrencySwitch currencies={currencies} value={cur} onChange={switchCur} />

      <div className="flex gap-2 overflow-x-auto no-scrollbar mt-4 -mx-4 px-4">
        {budgetCats(trip).map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)} icon={BUDGET_META[c].icon}>{c}</Chip>)}
      </div>

      <Group className="mt-4">
        <Field label="Note"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></Field>
        <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value || todayISO())} /></Field>
        <div className="flex items-center pl-4 min-h-[48px]">
          <span className="text-[17px] w-[108px] shrink-0">Receipt</span>
          {receipt ? (
            <div className="flex-1 flex items-center justify-end pr-2">
              <button onClick={() => setViewing(true)} className="press min-h-[44px] px-2 text-accent text-[15px] flex items-center gap-1"><Eye size={17} strokeWidth={SW} /> View</button>
              <button aria-label="Remove receipt" onClick={() => { if (receipt !== origReceipt.current) deleteFile(receipt); setReceipt(null); }} className="press h-11 w-11 flex items-center justify-center text-danger"><MinusCircle size={19} strokeWidth={SW} /></button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="press flex-1 min-h-[44px] flex items-center justify-end gap-1.5 pr-4 text-accent text-[15px]"><Camera size={17} strokeWidth={SW} /> Add photo</button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onReceipt} />
        </div>
      </Group>

      <AmountKeypad cur={cur} onKey={onKey} />
      <PrimaryButton className="mt-3" disabled={!amount || !rate} onClick={save}>{expense ? 'Save Changes' : 'Add Expense'}</PrimaryButton>
      {expense && (
        <button onClick={del} className="press mt-2 w-full min-h-[48px] text-danger text-[17px] flex items-center justify-center gap-2"><Trash2 size={18} strokeWidth={SW} /> Delete Expense</button>
      )}
      <FileViewer open={viewing} onClose={() => setViewing(false)} fileId={receipt} title="Receipt" />
    </Sheet>
  );
}
