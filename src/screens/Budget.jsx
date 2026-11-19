import { useEffect, useState } from 'react';
import { ChevronRight, CircleAlert, Pencil, Plus, Receipt, RefreshCw, Trash2, Paperclip } from 'lucide-react';
import { Card, Empty, Field, Group, Money, NavBar, PrimaryButton, ProgressBar, Segmented, Sheet, SW, TextButton, cx, inputCls, toast } from '../ui.jsx';
import { OptionList, CurrencyPicker } from '../pickers.jsx';
import { useStore } from '../store.jsx';
import { BackButton } from './Trip.jsx';
import AddExpense from './AddExpense.jsx';
import FundView from './FundView.jsx';
import FundEntrySheet from './FundEntrySheet.jsx';
import { budgetCats, budgetStats, expenseHome, localsOf, rateFor, rateSource, FUND_SHARE_CAT } from '../lib/logic.js';
import { BUDGET_META } from '../meta.jsx';
import { currencyName, fmtNumber, money, symbol } from '../lib/currency.js';
import { fmtDateTime, fmtDay } from '../lib/dates.js';

const shortName = (code) => currencyName(code).split(' ').pop();

const fmtRate = (r, code) => {
  if (!r) return '—';
  const dp = r >= 100 ? 0 : r >= 1 ? 2 : 4;
  return fmtNumber(r, code, dp);
};

const fmtUpdated = (ts) => {
  const d = new Date(ts);
  if (d.toDateString() === new Date().toDateString()) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return fmtDateTime(ts);
};

const SOFT = 'text-[#D1D1D6]'; // secondary text inside the dark card (~80% white)

export default function Budget({ trip }) {
  const { settings, updateTrip } = useStore();
  const home = settings.homeCurrency;
  const locals = localsOf(trip);
  const [disp, setDisp] = useState(home);
  const [seg, setSeg] = useState('mine');
  const [fundEntry, setFundEntry] = useState(null);
  const fundOn = !!trip.fund?.enabled;
  const view = fundOn ? seg : 'mine';
  const [adding, setAdding] = useState(false);
  const [editExp, setEditExp] = useState(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [editBudget, setEditBudget] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => { if (disp !== home && !locals.includes(disp)) setDisp(home); }, [locals.join(), home]); // eslint-disable-line

  const b = budgetStats(trip, settings);
  const other = disp === home ? locals[0] : home;
  const conv = (h, code) => { const r = rateFor(trip, code, settings); return r ? h * r : null; };
  const inDisp = (h) => conv(h, disp);

  const spentD = inDisp(b.spent);
  const spentO = other ? conv(b.spent, other) : null;
  const totalD = inDisp(b.total);

  // Rate status line
  const firstLocal = locals[0];
  const firstRate = firstLocal ? rateFor(trip, firstLocal, settings) : null;
  const src = firstLocal ? rateSource(trip, firstLocal, settings) : null;
  const rateOk = firstLocal && firstRate && !src.stale;
  const srcText = !src ? '' : !firstRate ? 'no rate yet' : src.mode === 'manual' ? 'my own rate' : src.mode === 'locked' ? 'locked rate' : src.stale ? 'last known rate' : `live rate, updated ${fmtUpdated(src.time)}`;

  const expenses = [...trip.expenses].sort((a, b2) => b2.date.localeCompare(a.date) || b2.createdAt - a.createdAt);
  const shown = showAll ? expenses : expenses.slice(0, 15);

  return (
    <div>
      <NavBar left={<BackButton />} title="Budget" right={
        <button onClick={() => (view === 'fund' ? setFundEntry({}) : setAdding(true))} aria-label={view === 'fund' ? 'Add group fund entry' : 'Add expense'} className="press h-11 w-11 flex items-center justify-center">
          <span className="h-[30px] w-[30px] rounded-full bg-accent text-white flex items-center justify-center"><Plus size={20} strokeWidth={2.25} /></span>
        </button>
      } />
      <div className="px-4">
        {fundOn && (
          <Segmented className="mt-2" value={seg} onChange={setSeg} options={[{ value: 'mine', label: 'My spending' }, { value: 'fund', label: 'Group fund' }]} />
        )}
        {trip.domestic && <p className="px-1 pt-2 text-[13px] text-tertiary">Domestic trip · all amounts in {symbol(home)}</p>}
        {view === 'fund' ? <FundView trip={trip} onEdit={(e) => setFundEntry({ entry: e })} /> : (<>
        {locals.length > 0 && (
          <Segmented
            className="mt-2"
            value={disp}
            onChange={setDisp}
            options={[home, ...locals].map((c) => ({ value: c, label: c === home ? symbol(c) : `${symbol(c)} ${shortName(c)}` }))}
          />
        )}

        {/* Summary */}
        <div className="mt-3 rounded-card p-5 bg-[#1C1C1E] dark:bg-card2 text-white">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className={cx('text-[13px] font-semibold uppercase tracking-wide', SOFT)}>Spent</div>
              <div className="text-[38px] font-bold leading-tight tracking-tight tabular-nums truncate">
                {spentD == null ? '—' : <Money amount={spentD} code={disp} short={false} />}
              </div>
              <div className={cx('text-[15px] tabular-nums', SOFT)}>
                {spentO != null && <>≈ <Money amount={spentO} code={other} /> · </>}
                of {totalD == null ? '—' : <Money amount={totalD} code={disp} whole />}
              </div>
            </div>
            <button onClick={() => setEditBudget(true)} aria-label="Edit budget" className={cx('press h-11 w-11 -mr-2 -mt-1 rounded-full flex items-center justify-center shrink-0', SOFT)}>
              <Pencil size={18} strokeWidth={SW} />
            </button>
          </div>
          <ProgressBar pct={b.total ? (b.spent / b.total) * 100 : 0} tone={b.left < 0 ? 'warn' : 'spent'} className="mt-3 !bg-white/20" />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <div className={cx('text-[13px] uppercase tracking-wide', b.left < 0 ? 'text-[#FFB340]' : SOFT)}>{b.left < 0 ? 'Over budget' : 'Left'}</div>
              <div className="text-[20px] font-semibold tabular-nums">{inDisp(Math.abs(b.left)) == null ? '—' : <Money amount={inDisp(Math.abs(b.left))} code={disp} short={false} />}</div>
            </div>
            <div>
              <div className={cx('text-[13px] uppercase tracking-wide', SOFT)}>Per day · {b.daysLeft} {b.daysLeft === 1 ? 'day' : 'days'} left</div>
              <div className="text-[20px] font-semibold tabular-nums">{inDisp(Math.max(0, b.perDay)) == null ? '—' : <Money amount={inDisp(Math.max(0, b.perDay))} code={disp} short={false} />}</div>
            </div>
          </div>
        </div>

        {/* Exchange rate line */}
        {!trip.domestic && <button onClick={() => setRateOpen(true)} className="press w-full min-h-[44px] mt-1 flex items-center gap-2 px-1 text-left">
          <span className={cx('h-2 w-2 rounded-full shrink-0', firstLocal ? (rateOk ? 'bg-ok' : 'bg-warn') : 'bg-tertiary')} />
          <span className="flex-1 min-w-0 text-[13px] text-tertiary truncate">
            {firstLocal ? (
              <>
                <span className="text-label font-medium tabular-nums">{symbol(home)} 1 = {symbol(firstLocal)} {fmtRate(firstRate, firstLocal)}</span> · {srcText}
                {locals.length > 1 && <> · +{locals.length - 1} more</>}
              </>
            ) : `Only ${currencyName(home)} on this trip`}
          </span>
          <span className="text-[15px] text-accent shrink-0">{firstLocal ? 'Change' : 'Add currency'}</span>
        </button>}

        {/* Categories */}
        <section className="mt-4">
          <h2 className="px-4 pb-1.5 text-[13px] uppercase tracking-wide text-tertiary">By category</h2>
          <div className="bg-card rounded-card overflow-hidden">
            {b.cats.map((c, i) => {
              const M = BUDGET_META[c];
              const spent = b.byCat[c] || 0;
              const cap = trip.categoryBudgets?.[c] || 0;
              const over = cap > 0 && spent > cap;
              const sp = inDisp(spent);
              const cp = inDisp(cap);
              return (
                <button key={c} onClick={() => setEditBudget(true)} className={cx('tap w-full text-left flex items-start gap-3 px-4 py-3', (i < b.cats.length - 1 || fundOn) && 'border-b hairline')}>
                  <span className="h-[30px] w-[30px] rounded-[8px] flex items-center justify-center shrink-0 mt-0.5" style={{ background: M.color }}><M.icon size={17} strokeWidth={SW} color="#fff" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[17px]">{c}</span>
                      <span className={cx('text-[15px] tabular-nums', over ? 'text-warn font-semibold' : 'text-tertiary')}>
                        {sp == null ? '—' : <Money amount={sp} code={disp} />}{cap > 0 && cp != null && <> / <Money amount={cp} code={disp} whole /></>}
                      </span>
                    </div>
                    {cap > 0 ? <ProgressBar pct={(spent / cap) * 100} tone={over || spent / cap > 0.85 ? 'warn' : 'ok'} className="mt-2" /> : <div className="text-[13px] text-tertiary">No budget set</div>}
                    {over && <div className="text-[13px] text-warn mt-1 flex items-center gap-1"><CircleAlert size={13} strokeWidth={2} /> Over budget by {money(inDisp(spent - cap) ?? 0, disp, { short: true })}</div>}
                  </div>
                </button>
              );
            })}
            {fundOn && (() => {
              const M = BUDGET_META[FUND_SHARE_CAT];
              const sp = inDisp(b.fundShare);
              return (
                <button onClick={() => setSeg('fund')} className="tap w-full text-left flex items-center gap-3 px-4 py-3">
                  <span className="h-[30px] w-[30px] rounded-[8px] flex items-center justify-center shrink-0" style={{ background: M.color }}><M.icon size={17} strokeWidth={SW} color="#fff" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[17px]">Group fund share <span className="text-[13px] text-tertiary">· auto</span></span>
                      <span className="text-[15px] tabular-nums text-tertiary">{sp == null ? '—' : <Money amount={sp} code={disp} />}</span>
                    </div>
                    <div className="text-[13px] text-tertiary">Your part of shared costs, from the group fund</div>
                  </div>
                </button>
              );
            })()}
          </div>
        </section>

        {/* Expenses */}
        <section className="mt-6">
          <h2 className="px-4 pb-1.5 text-[13px] uppercase tracking-wide text-tertiary">Recent</h2>
          {expenses.length === 0 ? (
            <Card><Empty icon={Receipt} text="No expenses yet. Tap + to log what you spend." /></Card>
          ) : (
            <div className="bg-card rounded-card overflow-hidden">
              {shown.map((e, i) => {
                const M = BUDGET_META[e.category] || BUDGET_META.Activities;
                const h = expenseHome(e, settings);
                // Primary: selected currency (exact when paid in it). Secondary: the other currency.
                const primary = e.currency === disp ? e.amount : disp === home ? h : conv(h, disp);
                const sec = disp === home
                  ? (e.currency !== home ? { amt: e.amount, code: e.currency } : locals[0] ? { amt: conv(h, locals[0]), code: locals[0] } : null)
                  : { amt: h, code: home };
                return (
                  <button key={e.id} onClick={() => setEditExp(e)} className="tap w-full text-left flex items-center gap-3 pl-4 min-h-[60px]">
                    <span className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ background: M.color + '1F' }}><M.icon size={18} strokeWidth={SW} style={{ color: M.color }} /></span>
                    <div className={cx('flex-1 min-w-0 flex items-center gap-2 pr-4 py-2.5 self-stretch', i < shown.length - 1 && 'border-b hairline')}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[17px] truncate flex items-center gap-1">{e.note || e.category}{e.receiptId && <Paperclip size={13} strokeWidth={SW} className="text-tertiary shrink-0" aria-label="Has receipt" />}</div>
                        <div className="text-[13px] text-tertiary">{e.category} · {fmtDay(e.date)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[17px] font-semibold tabular-nums">{primary == null ? '—' : <Money amount={primary} code={disp} />}</div>
                        {sec?.amt != null && <div className="text-[13px] text-tertiary tabular-nums">≈ <Money amount={sec.amt} code={sec.code} /></div>}
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
          {expenses.length > 0 && <p className="px-4 pt-1.5 text-[13px] text-tertiary">{trip.domestic ? 'Tap an expense to edit or delete it.' : 'Each expense keeps the rate used when it was added. Tap to edit or delete.'}</p>}
        </section>
        </>)}
      </div>

      <AddExpense trip={trip} open={adding || !!editExp} expense={editExp} onClose={() => { setAdding(false); setEditExp(null); }} />
      <RateSheet trip={trip} open={rateOpen} onClose={() => setRateOpen(false)} />
      <BudgetSheet trip={trip} open={editBudget} onClose={() => setEditBudget(false)} />
      {fundOn && <FundEntrySheet trip={trip} open={!!fundEntry} entry={fundEntry?.entry} onClose={() => setFundEntry(null)} />}
    </div>
  );
}

function RateSheet({ trip, open, onClose }) {
  const { settings, updateTrip, refreshRates } = useStore();
  const home = settings.homeCurrency;
  const locals = trip.localCurrencies;
  const [code, setCode] = useState(locals[0] || null);
  const [mode, setMode] = useState('live');
  const [manual, setManual] = useState('');
  const [payHome, setPayHome] = useState('');
  const [payLocal, setPayLocal] = useState('');
  const [lockVal, setLockVal] = useState('');
  const [picking, setPicking] = useState(null); // 'add' | 'replace'
  const [refreshing, setRefreshing] = useState(false);
  const live = code && settings.live?.base === home ? settings.live.rates?.[code] : null;

  useEffect(() => { if (open) setCode((c) => (c && locals.includes(c) ? c : locals[0] || null)); }, [open, locals.join()]); // eslint-disable-line

  useEffect(() => {
    if (!code) return;
    const cfg = trip.rates[code] || { mode: 'live' };
    setMode(cfg.mode || 'live');
    setManual(cfg.manual ? String(cfg.manual) : '');
    setLockVal(String(cfg.locked || rateFor(trip, code, settings) || ''));
    setPayHome(''); setPayLocal('');
  }, [code, open]); // eslint-disable-line

  useEffect(() => {
    const h = Number(payHome), l = Number(String(payLocal).replace(/,/g, ''));
    if (h > 0 && l > 0) setManual(String(Math.round((l / h) * 10000) / 10000));
  }, [payHome, payLocal]);

  const num = (s) => Number(String(s).replace(/,/g, ''));

  const save = () => {
    if (!code) return onClose();
    const m = num(manual), lk = num(lockVal);
    if (mode === 'manual' && !(m > 0)) return toast('Enter your rate first');
    if (mode === 'locked' && !(lk > 0)) return toast('Enter a rate to lock');
    updateTrip(trip.id, (t) => {
      t.rates[code] = { ...(t.rates[code] || {}), mode, manual: m > 0 ? m : t.rates[code]?.manual || null, locked: mode === 'locked' ? lk : null, fallback: live || t.rates[code]?.fallback };
    });
    onClose();
  };

  const addCurrency = (c) => {
    updateTrip(trip.id, (t) => { if (!t.localCurrencies.includes(c)) t.localCurrencies.push(c); t.rates[c] = t.rates[c] || { mode: 'live', manual: null, locked: null }; });
    setCode(c);
  };
  const replaceCurrency = (c) => {
    updateTrip(trip.id, (t) => {
      t.localCurrencies = t.localCurrencies.map((x) => (x === code ? c : x)).filter((x, i, a) => a.indexOf(x) === i);
      t.rates[c] = t.rates[c] || { mode: 'live', manual: null, locked: null };
    });
    setCode(c);
  };
  const removeCurrency = () => {
    if (trip.expenses.some((e) => e.currency === code)) return toast(`Some expenses are in ${code}`);
    updateTrip(trip.id, (t) => { t.localCurrencies = t.localCurrencies.filter((x) => x !== code); });
    setCode(locals.find((x) => x !== code) || null);
  };

  const refresh = async () => {
    setRefreshing(true);
    const ok = await refreshRates(true);
    setRefreshing(false);
    toast(ok ? 'Rates updated' : 'You are offline. Using the last saved rate.');
  };

  return (
    <Sheet open={open} onClose={onClose} title="Exchange rate" right={<TextButton bold onClick={save}>Save</TextButton>}>
      {locals.length > 1 && (
        <Segmented className="mt-3" value={code} onChange={setCode} options={locals.map((c) => ({ value: c, label: `${symbol(c)} ${c}` }))} />
      )}

      {code ? (
        <>
          <div className="mt-3">
            <OptionList
              value={mode}
              onChange={setMode}
              options={[
                { value: 'live', label: 'Live rate', sub: live ? `${symbol(home)} 1 = ${symbol(code)} ${fmtRate(live, code)} · updated ${fmtUpdated(settings.live.time)}` : 'Not downloaded yet. Connect to the internet once.' },
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
        </>
      ) : (
        <p className="mt-4 px-1 text-[15px] text-tertiary">This trip only uses {currencyName(home)}. Add a currency if you will pay in another one.</p>
      )}

      <Group title="Currencies">
        {code && (
          <>
            <button onClick={() => setPicking('replace')} className="tap w-full text-left pl-4 min-h-[52px] text-accent text-[17px] flex items-center"><span className="flex-1 border-b hairline self-stretch flex items-center pr-4">Change {code} to another currency</span></button>
            <button onClick={removeCurrency} className="tap w-full text-left pl-4 min-h-[52px] text-danger text-[17px] flex items-center gap-2"><span className="flex-1 border-b hairline self-stretch flex items-center gap-2 pr-4"><Trash2 size={18} strokeWidth={SW} /> Remove {code} from trip</span></button>
          </>
        )}
        <button onClick={() => setPicking('add')} className="tap w-full text-left px-4 min-h-[52px] text-accent text-[17px] flex items-center gap-2"><Plus size={18} strokeWidth={SW} /> <span className="flex-1">Add currency</span><ChevronRight size={18} strokeWidth={2} className="text-tertiary/70" /></button>
      </Group>
      <CurrencyPicker
        open={!!picking}
        onClose={() => setPicking(null)}
        value={picking === 'replace' ? code : null}
        exclude={[home, ...locals]}
        onPick={(c) => (picking === 'add' ? addCurrency(c) : replaceCurrency(c))}
      />
    </Sheet>
  );
}

function BudgetSheet({ trip, open, onClose }) {
  const { settings, updateTrip } = useStore();
  const home = settings.homeCurrency;
  const catList = budgetCats(trip);
  const [total, setTotal] = useState('');
  const [cats, setCats] = useState({});
  useEffect(() => {
    if (open) {
      setTotal(trip.budget ? String(trip.budget) : '');
      setCats(Object.fromEntries(catList.map((c) => [c, trip.categoryBudgets?.[c] ? String(trip.categoryBudgets[c]) : ''])));
    }
  }, [open]); // eslint-disable-line
  const n = (s) => Number(String(s).replace(/,/g, '')) || 0;
  const sum = catList.reduce((a, c) => a + n(cats[c]), 0);
  const save = () => {
    updateTrip(trip.id, (t) => {
      t.budget = n(total);
      t.categoryBudgets = Object.fromEntries(catList.map((c) => [c, n(cats[c])]));
    });
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Budget" right={<TextButton bold onClick={save}>Save</TextButton>}>
      <Group title={`Total (${home})`} className="mt-3">
        <Field label="Total" last><span className="text-tertiary mr-1">{symbol(home)}</span><input inputMode="decimal" className={inputCls} value={total} onChange={(e) => setTotal(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" /></Field>
      </Group>
      <Group title="Per category" footer={`Categories add up to ${money(sum, home)}${n(total) ? ` of ${money(n(total), home)}` : ''}.`}>
        {catList.map((c, i) => (
          <Field key={c} label={c} last={i === catList.length - 1}>
            <span className="text-tertiary mr-1">{symbol(home)}</span>
            <input inputMode="decimal" className={inputCls} value={cats[c] || ''} onChange={(e) => setCats({ ...cats, [c]: e.target.value.replace(/[^\d.]/g, '') })} placeholder="0" />
          </Field>
        ))}
      </Group>
      {sum > 0 && n(total) === 0 && <PrimaryButton className="mt-4" onClick={() => setTotal(String(sum))}>Use {money(sum, home)} as total</PrimaryButton>}
    </Sheet>
  );
}
