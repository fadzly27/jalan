// Shared amount entry: big amount, live conversion pill, currency switch and keypad.
// Used by Add Expense and the group-fund entry sheet.
import { ArrowRight } from 'lucide-react';
import { Keypad, Segmented, cx } from '../ui.jsx';
import { decimals, fmtNumber, money, symbol } from '../lib/currency.js';

export function formatTyped(str, code) {
  if (!str) return '0';
  const [i, d] = str.split('.');
  const int = fmtNumber(Number(i || 0), code, 0);
  return d !== undefined ? `${int}.${d}` : int;
}

export function applyKey(a, k, code) {
  const dp = decimals(code);
  if (k === 'del') return a.slice(0, -1);
  if (k === '.') return dp === 0 || a.includes('.') ? a : (a || '0') + '.';
  const frac = a.split('.')[1];
  if (frac !== undefined && frac.length + k.length > dp) return a;
  if (k === '000' && (!a || a === '0')) return a;
  const next = a === '0' ? k : a + k;
  if (next.replace('.', '').length > 12) return a;
  return next;
}

export function trimToCurrency(a, code) {
  if (!a.includes('.')) return a;
  const d = decimals(code);
  const [i, f] = a.split('.');
  return d === 0 ? i : `${i}.${f.slice(0, d)}`;
}

export const keysFor = (code) => ['1', '2', '3', '4', '5', '6', '7', '8', '9', decimals(code) === 0 ? '000' : '.', '0', 'del'];

// amount: number typed; cur: paid currency; rate: units of cur per 1 home; other: currency to show the conversion in.
export function AmountHeader({ amt, cur, home, rate, other, otherRate }) {
  const amount = Number(amt || 0);
  const converted = cur === home ? (otherRate ? amount * otherRate : null) : rate ? amount / rate : null;
  return (
    <div className="text-center pt-3">
      <div className={cx('font-semibold tabular-nums tracking-tight leading-none break-all', amt.length > 9 ? 'text-[40px]' : 'text-[52px]', !amount && 'text-tertiary')}>
        <span className="text-[0.6em] align-[0.25em] mr-1.5 text-tertiary font-medium">{symbol(cur)}</span>{formatTyped(amt, cur)}
      </div>
      <div className="h-9 mt-3 flex justify-center">
        {amount > 0 && converted != null && other && (
          <span className="anim-fade inline-flex items-center gap-1.5 rounded-full bg-ok/[0.14] text-ok px-3.5 text-[15px] font-semibold">
            {money(amount, cur)} <ArrowRight size={15} strokeWidth={2} /> ≈ {money(converted, cur === home ? other : home)}
          </span>
        )}
        {amount > 0 && !rate && <span className="inline-flex items-center rounded-full bg-warn/15 text-warn px-3.5 text-[14px] font-semibold">Set an exchange rate for {cur} in Budget first</span>}
      </div>
    </div>
  );
}

export function CurrencySwitch({ currencies, value, onChange }) {
  if (currencies.length < 2) return null;
  return <Segmented className="mt-2" value={value} onChange={onChange} options={currencies.map((c) => ({ value: c, label: `${symbol(c)} ${c}` }))} />;
}

export function AmountKeypad({ cur, onKey, className = 'mt-4' }) {
  return <Keypad className={className} keys={keysFor(cur)} onKey={onKey} />;
}
