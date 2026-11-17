import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Sheet, SW, cx } from './ui.jsx';
import { allCountries, allCurrencies, currencyName, symbol } from './lib/currency.js';
import { useStore } from './store.jsx';

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="sticky top-0 z-10 bg-bg pb-2 pt-1">
      <div className="flex items-center gap-2 rounded-[10px] bg-fill/[0.12] px-2.5 min-h-[40px]">
        <Search size={18} strokeWidth={SW} className="text-tertiary" />
        <input
          autoFocus={!/iPhone|iPad/.test(navigator.userAgent)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-[17px] placeholder:text-tertiary"
        />
      </div>
    </div>
  );
}

function ListItem({ selected, onClick, left, title, sub }) {
  return (
    <button onClick={onClick} className="tap w-full flex items-center gap-3 pl-4 min-h-[52px] text-left">
      {left}
      <div className="flex-1 min-w-0 flex items-center border-b hairline self-stretch pr-4 py-2">
        <div className="flex-1 min-w-0">
          <div className="text-[17px] truncate">{title}</div>
          {sub && <div className="text-[13px] text-tertiary truncate">{sub}</div>}
        </div>
        {selected && <Check size={20} strokeWidth={2.25} className="text-accent" />}
      </div>
    </button>
  );
}

export function CurrencyPicker({ open, onClose, value, onPick, exclude = [] }) {
  const { settings, pushRecentCurrency } = useStore();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return allCurrencies.filter((c) => !exclude.includes(c.code) && (!s || c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s) || c.symbol.toLowerCase() === s));
  }, [q, exclude]);
  const recent = settings.recentCurrencies.filter((c) => !exclude.includes(c));
  const pick = (code) => { pushRecentCurrency(code); onPick(code); setQ(''); onClose(); };
  const sym = (code) => <span className="w-11 h-8 rounded-[8px] bg-fill/[0.12] flex items-center justify-center text-[14px] font-semibold shrink-0">{symbol(code)}</span>;
  return (
    <Sheet open={open} onClose={onClose} title="Currency" full>
      <SearchBox value={q} onChange={setQ} placeholder="Search currency or code" />
      {!q && recent.length > 0 && (
        <>
          <h3 className="px-4 pt-3 pb-1.5 text-[13px] uppercase tracking-wide text-tertiary">Recent</h3>
          <div className="bg-card rounded-card overflow-hidden">
            {recent.map((c) => <ListItem key={c} left={sym(c)} title={currencyName(c)} sub={c} selected={c === value} onClick={() => pick(c)} />)}
          </div>
        </>
      )}
      <h3 className="px-4 pt-5 pb-1.5 text-[13px] uppercase tracking-wide text-tertiary">{q ? 'Results' : 'All currencies'}</h3>
      <div className="bg-card rounded-card overflow-hidden">
        {list.map((c) => <ListItem key={c.code} left={sym(c.code)} title={c.name} sub={c.code} selected={c.code === value} onClick={() => pick(c.code)} />)}
        {!list.length && <p className="p-6 text-center text-tertiary text-[15px]">No currency matches. Try the three-letter code.</p>}
      </div>
    </Sheet>
  );
}

export function CountryPicker({ open, onClose, value, onPick }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return allCountries.filter((c) => !s || c.name.toLowerCase().includes(s) || c.code.toLowerCase() === s);
  }, [q]);
  return (
    <Sheet open={open} onClose={onClose} title="Country" full>
      <SearchBox value={q} onChange={setQ} placeholder="Search country" />
      <div className="bg-card rounded-card overflow-hidden mt-1">
        {list.map((c) => (
          <ListItem key={c.code} title={c.name} sub={`${c.currency} · ${symbol(c.currency)}`} selected={c.code === value} onClick={() => { onPick(c.code); setQ(''); onClose(); }} />
        ))}
        {!list.length && <p className="p-6 text-center text-tertiary text-[15px]">No country matches your search.</p>}
      </div>
    </Sheet>
  );
}

export function OptionList({ options, value, onChange }) {
  return (
    <div className="bg-card rounded-card overflow-hidden">
      {options.map((o, i) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={cx('tap w-full text-left flex items-center pl-4 min-h-[52px]')}>
          <div className={cx('flex-1 flex items-center pr-4 py-2.5 self-stretch', i < options.length - 1 && 'border-b hairline')}>
            <div className="flex-1">
              <div className="text-[17px]">{o.label}</div>
              {o.sub && <div className="text-[13px] text-tertiary">{o.sub}</div>}
            </div>
            {o.value === value && <Check size={20} strokeWidth={2.25} className="text-accent" />}
          </div>
        </button>
      ))}
    </div>
  );
}
