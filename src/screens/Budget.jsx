import { useEffect, useState } from 'react';
import { ArrowLeftRight, CircleAlert, Lock, Pencil, Plus, Receipt, RefreshCw, Wifi, WifiOff, Trash2, Paperclip } from 'lucide-react';
import { Card, Empty, Field, Group, Header, IconButton, Money, PrimaryButton, ProgressBar, Segmented, Sheet, SW, TextButton, cx, inputCls, toast } from '../ui.jsx';
import { OptionList, CurrencyPicker } from '../pickers.jsx';
import { useStore } from '../store.jsx';
import { BackButton } from './Trip.jsx';
import AddExpense from './AddExpense.jsx';
import { BUDGET_CATS, budgetStats, expenseHome, rateFor, rateSource } from '../lib/logic.js';
import { BUDGET_META } from '../meta.jsx';
import { currencyName, fmtNumber, money, symbol } from '../lib/currency.js';
import { fmtDateTime, fmtDay } from '../lib/dates.js';

const shortName = (code) => {
  const n = currencyName(code);
  return n.split(' ').pop();
};

const fmtRate = (r, code) => {
  if (!r) return '—';
  const dp = r >= 100 ? 0 : r >= 1 ? 2 : 4;
  return fmtNumber(r, code, dp);
};

export default function Budget({ trip }) {
  const { settings, updateTrip } = useStore();
  const home = settings.homeCurrency;
  const locals = trip.localCurrencies;
  const [disp, setDisp] = useState(home);
  const [adding, setAdding] = useState(false);
  const [editExp, setEditExp] = useState(null);
  const [rateCode, setRateCode] = useState(null);
  const [editBudget, setEditBudget] = useState(false);
  const [addCur, setAddCur] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => { if (disp !== home && !locals.includes(disp)) setDisp(home); }, [locals.join(), home]); // eslint-disable-line

  const b = budgetStats(trip, settings);
  const other = disp === home ? locals[0] : home;
  const conv = (h, code) => { const r = rateFor(trip, code, settings); return r ? h * r : null; };

  // Primary in the selected currency, the other currency in small grey text.
  const Dual = ({ h, big, light, align = 'left' }) => {
    const p = conv(h, disp);
    const o = other ? conv(h, other) : null;
    return (
      <div className={align === 'right' ? 'text-right' : ''}>
        <div className={cx('font-semibold tabular-nums', big ? 'text-[34px] leading-tight tracking-tight' : 'text-[17px]')}>
          {p == null ? '—' : <Money amount={p} code={disp} short={!big} whole={!big} />}
        </div>
        {o != null && other && <div className={cx('text-[13px] tabular-nums', light ? 'text-white/55' : 'text-tertiary')}>≈ <Money amount={o} code={other} /></div>}
      </div>
    );
  };

  const expenses = [...trip.expenses].sort((a, b2) => b2.date.localeCompare(a.date) || b2.createdAt - a.createdAt);
  const shown = showAll ? expenses : expenses.slice(0, 15);

  return (
    <div>
      <Header left={<BackButton />} right={<IconButton icon={Plus} label="Add expense" onClick={() => setAdding(true)} />} title="Budget" />
      <div className="px-4">
        {locals.length > 0 && (
          <Segmented
            className="mt-2"
            value={disp}
            onChange={setDisp}
            options={[home, ...locals].map((c) => ({ value: c, label: c === home ? symbol(c) : `${symbol(c)} ${shortName(c)}` }))}
          />
        )}

        <div className="mt-3 rounded-card p-5 bg-[#1C1C1E] dark:bg-card2 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[13px] font-semibold uppercase tracking-wide text-white/55">Spent</div>
              <Dual h={b.spent} big light />
            </div>
            <button onClick={() => setEditBudget(true)} aria-label="Edit budget" className="press h-11 w-11 -mr-2 -mt-1 rounded-full flex items-center justify-center text-white/70">
              <Pencil size={18} strokeWidth={SW} />
            </button>
          </div>
          <ProgressBar pct={b.total ? (b.spent / b.total) * 100 : 0} tone={b.left < 0 ? 'warn' : 'ok'} className="mt-3 !bg-white/15" />
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div><div className="text-[12px] text-white/55 uppercase tracking-wide">Budget</div><Dual h={b.total} light /></div>
            <div><div className={cx('text-[12px] uppercase tracking-wide', b.left < 0 ? 'text-warn' : 'text-white/55')}>{b.left < 0 ? 'Over' : 'Left'}</div><Dual h={Math.abs(b.left)} light /></div>
            <div><div className="text-[12px] text-white/55 uppercase tracking-wide">Per day</div><Dual h={Math.max(0, b.perDay)} light /><div className="text-[11px] text-white/45">{b.daysLeft} day{b.daysLeft === 1 ? '' : 's'} left</div></div>
          </div>
        </div>

        {/* Exchange rates */}
        <section className="mt-6">
          <div className="flex items-end justify-between px-4 pb-1.5">
            <h2 className="text-[13px] uppercase tracking-wide text-tertiary">Exchange rate</h2>
            <button onClick={() => setAddCur(true)} className="text-[15px] text-accent min-h-[32px]">Add currency</button>
          </div>
          {locals.length === 0 ? (
            <Card className="p-4"><p className="text-[15px] text-tertiary">This trip only uses {currencyName(home)}. Tap Add currency if you will pay in another one.</p></Card>
          ) : (
            <div className="bg-card rounded-card overflow-hidden">
              {locals.map((c, i) => {
                const r = rateFor(trip, c, settings);
                const src = rateSource(trip, c, settings);
                const Icon = src.mode === 'locked' ? Lock : src.mode === 'manual' ? Pencil : src.stale ? WifiOff : Wifi;
                return (
                  <div key={c} className={cx('flex items-center gap-3 px-4 min-h-[64px] py-2.5', i < locals.length - 1 && 'border-b hairline')}>
                    <ArrowLeftRight size={20} strokeWidth={SW} className="text-tertiary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[17px] font-semibold tabular-nums">{symbol(home)} 1 = {symbol(c)} {fmtRate(r, c)}</div>
                      <div className={cx('text-[13px] flex items-center gap-1', src.stale || !r ? 'text-warn' : 'text-tertiary')}>
                        <Icon size={12} strokeWidth={2} />
                        {!r ? 'No rate yet – tap Change to enter one' : src.label}{src.time ? ` · updated ${fmtDateTime(src.time)}` : ''}
                      </div>
                    </div>
                    <button onClick={() => setRateCode(c)} className="press min-h-[36px] rounded-full bg-fill/[0.12] px-3.5 text-[15px] font-semibold text-accent">Change</button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Categories */}
        <section className="mt-6">
          <h2 className="px-4 pb-1.5 text-[13px] uppercase tracking-wide text-tertiary">Categories</h2>
          <div className="bg-card rounded-card overflow-hidden">
            {BUDGET_CATS.map((c, i) => {
              const M = BUDGET_META[c];
              const spent = b.byCat[c] || 0;
              const cap = trip.categoryBudgets?.[c] || 0;
              const over = cap > 0 && spent > cap;
              const sp = conv(spent, disp);
              const cp = conv(cap, disp);
              return (
                <button key={c} onClick={() => setEditBudget(true)} className={cx('tap w-full text-left flex items-start gap-3 px-4 py-3', i < BUDGET_CATS.length - 1 && 'border-b hairline')}>
                  <span className="h-[30px] w-[30px] rounded-[8px] flex items-center justify-center shrink-0 mt-0.5" style={{ background: M.color }}><M.icon size={17} strokeWidth={SW} color="#fff" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[17px]">{c}</span>
                      <span className={cx('text-[15px] tabular-nums', over ? 'text-warn font-semibold' : 'text-tertiary')}>
                        {sp == null ? '—' : <Money amount={sp} code={disp} />}{cap > 0 && cp != null && <> / <Money amount={cp} code={disp} /></>}
                      </span>
                    </div>
                    {cap > 0 ? <ProgressBar pct={(spent / cap) * 100} tone={over ? 'warn' : spent / cap > 0.85 ? 'warn' : 'ok'} className="mt-2" /> : <div className="text-[13px] text-tertiary">No budget set</div>}
                    {over && <div className="text-[13px] text-warn mt-1 flex items-center gap-1"><CircleAlert size={13} strokeWidth={2} /> Over budget by {money(conv(spent - cap, disp) ?? 0, disp, { short: true })}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Expenses */}
        <section className="mt-6">
          <h2 className="px-4 pb-1.5 text-[13px] uppercase tracking-wide text-tertiary">Recent expenses</h2>
          {expenses.length === 0 ? (
            <Card><Empty icon={Receipt} text="No expenses yet. Tap + to log what you spend." /></Card>
          ) : (
            <div className="bg-card rounded-card overflow-hidden">
              {shown.map((e, i) => {
                const M = BUDGET_META[e.category] || BUDGET_META.Activities;
                const h = expenseHome(e, settings);
                const second = e.currency === home ? (locals[0] ? { amt: conv(h, locals[0]), code: locals[0] } : null) : { amt: h, code: home };
                return (
                  <button key={e.id} onClick={() => setEditExp(e)} className="tap w-full text-left flex items-center gap-3 pl-4 min-h-[60px]">
                    <span className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ background: M.color + '1F' }}><M.icon size={18} strokeWidth={SW} style={{ color: M.color }} /></span>
                    <div className={cx('flex-1 min-w-0 flex items-center gap-2 pr-4 py-2.5 self-stretch', i < shown.length - 1 && 'border-b hairline')}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[17px] truncate flex items-center gap-1">{e.note || e.category}{e.receiptId && <Paperclip size={13} strokeWidth={SW} className="text-tertiary shrink-0" />}</div>
                        <div className="text-[13px] text-tertiary">{e.category} · {fmtDay(e.date)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[17px] font-semibold tabular-nums"><Money amount={e.amount} code={e.currency} /></div>
                        {second?.amt != null && <div className="text-[13px] text-tertiary tabular-nums">≈ <Money amount={second.amt} code={second.code} /></div>}
                      </div>
                    </div>
                  </button>
                );
              })}
              {expenses.length > 15 && (
                <button onClick={() => setShowAll(!showAll)} className="tap w-full min-h-[48px] border-t hairline text-accent text-[15px]">{showAll ? 'Show less' : `Show all ${expenses.length}`}</button>
              )}
            </div>
          )}
          {expenses.length > 0 && <p className="px-4 pt-1.5 text-[13px] text-tertiary">Each expense keeps the rate used when it was added. Tap to edit or delete.</p>}
        </section>
      </div>

      <AddExpense trip={trip} open={adding || !!editExp} expense={editExp} onClose={() => { setAdding(false); setEditExp(null); }} />
      <RateSheet trip={trip} code={rateCode} onClose={() => setRateCode(null)} />
      <BudgetSheet trip={trip} open={editBudget} onClose={() => setEditBudget(false)} />
      <CurrencyPicker open={addCur} onClose={() => setAddCur(false)} exclude={[home, ...locals]} onPick={(c) => updateTrip(trip.id, (t) => { t.localCurrencies.push(c); t.rates[c] = t.rates[c] || { mode: 'live', manual: null, locked: null }; })} />
    </div>
  );
}

function RateSheet({ trip, code, onClose }) {
  const { settings, updateTrip, refreshRates } = useStore();
  const home = settings.homeCurrency;
  const [mode, setMode] = useState('live');
  const [manual, setManual] = useState('');
  const [payHome, setPayHome] = useState('');
  const [payLocal, setPayLocal] = useState('');
  const [lockVal, setLockVal] = useState('');
  const [picking, setPicking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const live = settings.live?.base === home ? settings.live.rates?.[code] : null;

  useEffect(() => {
    if (!code) return;
    const cfg = trip.rates[code] || { mode: 'live' };
    setMode(cfg.mode || 'live');
    setManual(cfg.manual ? String(cfg.manual) : '');
    setLockVal(String(cfg.locked || rateFor(trip, code, settings) || ''));
    setPayHome(''); setPayLocal('');
  }, [code]); // eslint-disable-line

  useEffect(() => {
    const h = Number(payHome), l = Number(String(payLocal).replace(/,/g, ''));
    if (h > 0 && l > 0) setManual(String(Math.round((l / h) * 10000) / 10000));
  }, [payHome, payLocal]);

  if (!code) return <Sheet open={false} onClose={onClose} />;
  const num = (s) => Number(String(s).replace(/,/g, ''));

  const save = () => {
    const m = num(manual), lk = num(lockVal);
    if (mode === 'manual' && !(m > 0)) return toast('Enter your rate first');
    if (mode === 'locked' && !(lk > 0)) return toast('Enter a rate to lock');
    updateTrip(trip.id, (t) => {
      t.rates[code] = { ...(t.rates[code] || {}), mode, manual: m > 0 ? m : t.rates[code]?.manual || null, locked: mode === 'locked' ? lk : null, fallback: live || t.rates[code]?.fallback };
    });
    onClose();
  };

  const replaceCurrency = (c) => {
    updateTrip(trip.id, (t) => {
      t.localCurrencies = t.localCurrencies.map((x) => (x === code ? c : x)).filter((x, i, a) => a.indexOf(x) === i);
      t.rates[c] = t.rates[c] || { mode: 'live', manual: null, locked: null };
    });
    onClose();
  };
  const removeCurrency = () => {
    if (trip.expenses.some((e) => e.currency === code)) return toast(`Some expenses are in ${code}`);
    updateTrip(trip.id, (t) => { t.localCurrencies = t.localCurrencies.filter((x) => x !== code); });
    onClose();
  };

  const refresh = async () => {
    setRefreshing(true);
    const ok = await refreshRates(true);
    setRefreshing(false);
    toast(ok ? 'Rates updated' : 'You are offline. Using the last saved rate.');
  };

  return (
    <Sheet open={!!code} onClose={onClose} title={`${symbol(code)} ${code} rate`} right={<TextButton bold onClick={save}>Save</TextButton>}>
      <div className="mt-3">
        <OptionList
          value={mode}
          onChange={setMode}
          options={[
            { value: 'live', label: 'Live rate', sub: live ? `${symbol(home)} 1 = ${symbol(code)} ${fmtRate(live, code)} · updated ${fmtDateTime(settings.live.time)}` : 'Not downloaded yet. Connect to the internet once.' },
            { value: 'manual', label: 'My own rate', sub: 'From your money changer receipt' },
            { value: 'locked', label: 'Lock for this trip', sub: 'Keep one fixed rate for the whole trip' },
          ]}
        />
      </div>

      {mode === 'live' && (
        <button onClick={refresh} disabled={refreshing} className="press mt-3 w-full min-h-[48px] rounded-[14px] bg-card text-accent text-[15px] font-medium flex items-center justify-center gap-2">
          <RefreshCw size={17} strokeWidth={SW} className={refreshing ? 'animate-spin' : ''} /> Refresh live rate
        </button>
      )}

      {mode === 'manual' && (
        <>
          <Group title="Your rate">
            <Field label={`${symbol(home)} 1 =`} last>
              <span className="text-tertiary mr-1">{symbol(code)}</span>
              <input inputMode="decimal" className={inputCls} value={manual} onChange={(e) => setManual(e.target.value.replace(/[^\d.,]/g, ''))} placeholder={live ? fmtRate(live, code) : '0'} />
            </Field>
          </Group>
          <Group title="Or enter what you exchanged" footer="We work out the rate for you.">
            <Field label={`Paid ${symbol(home)}`}><input inputMode="decimal" className={inputCls} value={payHome} onChange={(e) => setPayHome(e.target.value.replace(/[^\d.]/g, ''))} placeholder="e.g. 1000" /></Field>
            <Field label={`Got ${symbol(code)}`} last><input inputMode="decimal" className={inputCls} value={payLocal} onChange={(e) => setPayLocal(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="e.g. 312,000" /></Field>
          </Group>
        </>
      )}

      {mode === 'locked' && (
        <Group title="Locked rate" footer="All new expenses on this trip use this rate, even when online.">
          <Field label={`${symbol(home)} 1 =`} last>
            <span className="text-tertiary mr-1">{symbol(code)}</span>
            <input inputMode="decimal" className={inputCls} value={lockVal} onChange={(e) => setLockVal(e.target.value.replace(/[^\d.,]/g, ''))} />
          </Field>
        </Group>
      )}

      <Group title="Currency">
        <button onClick={() => setPicking(true)} className="tap w-full text-left px-4 min-h-[52px] border-b hairline text-accent text-[17px]">Change currency ({currencyName(code)})</button>
        <button onClick={removeCurrency} className="tap w-full text-left px-4 min-h-[52px] text-danger text-[17px] flex items-center gap-2"><Trash2 size={18} strokeWidth={SW} /> Remove from trip</button>
      </Group>
      <CurrencyPicker open={picking} onClose={() => setPicking(false)} value={code} exclude={[home]} onPick={replaceCurrency} />
    </Sheet>
  );
}

function BudgetSheet({ trip, open, onClose }) {
  const { settings, updateTrip } = useStore();
  const home = settings.homeCurrency;
  const [total, setTotal] = useState('');
  const [cats, setCats] = useState({});
  useEffect(() => {
    if (open) {
      setTotal(trip.budget ? String(trip.budget) : '');
      setCats(Object.fromEntries(BUDGET_CATS.map((c) => [c, trip.categoryBudgets?.[c] ? String(trip.categoryBudgets[c]) : ''])));
    }
  }, [open]); // eslint-disable-line
  const n = (s) => Number(String(s).replace(/,/g, '')) || 0;
  const sum = BUDGET_CATS.reduce((a, c) => a + n(cats[c]), 0);
  const save = () => {
    updateTrip(trip.id, (t) => {
      t.budget = n(total);
      t.categoryBudgets = Object.fromEntries(BUDGET_CATS.map((c) => [c, n(cats[c])]));
    });
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Budget" right={<TextButton bold onClick={save}>Save</TextButton>}>
      <Group title={`Total (${home})`} className="mt-3">
        <Field label="Total" last><span className="text-tertiary mr-1">{symbol(home)}</span><input inputMode="decimal" className={inputCls} value={total} onChange={(e) => setTotal(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" /></Field>
      </Group>
      <Group title="Per category" footer={`Categories add up to ${money(sum, home)}${n(total) ? ` of ${money(n(total), home)}` : ''}.`}>
        {BUDGET_CATS.map((c, i) => (
          <Field key={c} label={c} last={i === BUDGET_CATS.length - 1}>
            <span className="text-tertiary mr-1">{symbol(home)}</span>
            <input inputMode="decimal" className={inputCls} value={cats[c] || ''} onChange={(e) => setCats({ ...cats, [c]: e.target.value.replace(/[^\d.]/g, '') })} placeholder="0" />
          </Field>
        ))}
      </Group>
      {sum > 0 && n(total) === 0 && <PrimaryButton className="mt-4" onClick={() => setTotal(String(sum))}>Use {money(sum, home)} as total</PrimaryButton>}
    </Sheet>
  );
}
