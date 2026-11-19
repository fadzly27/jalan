import { useState } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CheckCircle2, MessageCircle, PiggyBank } from 'lucide-react';
import { Avatar, Badge, Card, Empty, ProgressBar, Segmented, SW, cx, toast } from '../ui.jsx';
import { useStore } from '../store.jsx';
import { fundStats, fromSen, settleUp, YOU } from '../lib/model.js';
import { money, symbol } from '../lib/currency.js';
import { fmtDay } from '../lib/dates.js';
import { fundText, shareText } from '../lib/share.js';

const SOFT = 'text-[#D1D1D6]';

export default function FundView({ trip, onEdit }) {
  const { settings, updateTrip } = useStore();
  const home = settings.homeCurrency;
  const [view, setView] = useState('cash');
  const f = trip.fund;
  const s = fundStats(trip);
  const m = (sen) => money(fromSen(sen), home);
  const nameOf = (id) => { const x = f.members.find((y) => y.id === id); return x ? (x.id === YOU ? 'You' : x.name) : 'Someone'; };
  const n = f.members.length;
  const spentEach = n ? Math.round(s.spent / n) : 0;
  const transfers = settleUp(trip, s);

  return (
    <div>
      {/* Summary */}
      <div className="mt-3 rounded-card p-5 bg-[#1C1C1E] dark:bg-card2 text-white">
        <div className={cx('text-[13px] font-semibold uppercase tracking-wide', SOFT)}>In the fund now</div>
        <div className="text-[38px] font-bold leading-tight tracking-tight tabular-nums">{m(s.balance)}</div>
        <div className={cx('text-[15px]', SOFT)}>{n} {n === 1 ? 'person' : 'people'}{f.perPerson ? ` · ${m(f.perPerson)} each` : ''}</div>
        <ProgressBar pct={s.collected ? (s.spent / s.collected) * 100 : 0} tone={s.spent > s.collected ? 'warn' : 'spent'} className="mt-3 !bg-white/20" />
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <div className={cx('text-[13px] uppercase tracking-wide', SOFT)}>Collected</div>
            <div className="text-[20px] font-semibold tabular-nums">{m(s.collected)}</div>
          </div>
          <div>
            <div className={cx('text-[13px] uppercase tracking-wide', SOFT)}>Spent · {m(spentEach)} each</div>
            <div className="text-[20px] font-semibold tabular-nums">{m(s.spent)}</div>
          </div>
        </div>
      </div>

      <Segmented className="mt-4" value={view} onChange={setView} options={[{ value: 'cash', label: 'Cashflow' }, { value: 'members', label: 'Members' }]} />

      {view === 'cash' && (
        <section className="mt-3">
          {s.newestFirst.length === 0 ? (
            <Card><Empty icon={PiggyBank} text="No money in yet. Tap + to record the first payment." /></Card>
          ) : (
            <div className="bg-card rounded-card overflow-hidden">
              {s.newestFirst.map((e, i) => {
                const isIn = e.type === 'in', isOut = e.type === 'out';
                const title = isIn ? `${nameOf(e.memberId)} paid in` : e.title || e.category;
                const sub = isIn
                  ? `${fmtDay(e.date)} · ${e.method === 'transfer' ? 'Transfer' : 'Cash'}`
                  : isOut ? `${fmtDay(e.date)} · ${e.category}` : `${fmtDay(e.date)} · Paid by ${nameOf(e.paidBy)}`;
                const foreign = e.currency !== home;
                return (
                  <button key={e.id} onClick={() => onEdit(e)} className="tap w-full text-left flex items-center gap-3 pl-4 min-h-[64px]">
                    <span className={cx('h-9 w-9 rounded-full flex items-center justify-center shrink-0', isIn ? 'bg-ok/[0.14] text-ok' : isOut ? 'bg-accent-soft text-accent-ink' : 'bg-fill/[0.14] text-tertiary')}>
                      {isIn ? <ArrowDownLeft size={18} strokeWidth={SW} /> : <ArrowUpRight size={18} strokeWidth={SW} />}
                    </span>
                    <div className={cx('flex-1 min-w-0 flex items-center gap-2 pr-4 py-2.5 self-stretch', i < s.newestFirst.length - 1 && 'border-b hairline')}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[17px] truncate">{title}</div>
                        <div className="text-[13px] text-tertiary truncate">{sub}</div>
                        {e.type === 'own' && <div className="text-[13px] text-tertiary truncate">Not from fund · fund owes {nameOf(e.paidBy)}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className={cx('text-[17px] font-semibold tabular-nums', isIn ? 'text-ok' : isOut ? 'text-accent-ink' : 'text-tertiary')}>
                          {isIn ? '+' : isOut ? '−' : '↗ '}{m(e.sen)}
                        </div>
                        {foreign && <div className="text-[12px] text-tertiary tabular-nums">{money(e.amount, e.currency)}</div>}
                        <div className="text-[12px] text-tertiary tabular-nums">Balance {m(s.running[e.id])}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {s.newestFirst.length > 0 && <p className="px-4 pt-1.5 text-[13px] text-tertiary">Tap an entry to edit or delete it.</p>}
        </section>
      )}

      {view === 'members' && (
        <section className="mt-3">
          <div className="bg-card rounded-card overflow-hidden">
            {f.members.map((mem, i) => {
              const p = s.per[mem.id] || { paid: 0, paidIn: 0, share: 0, result: 0 };
              const due = mem.target > 0 ? Math.max(0, mem.target - p.paidIn) : 0;
              return (
                <div key={mem.id} className="flex items-center gap-3 pl-4 min-h-[64px]">
                  <Avatar name={mem.name} color={mem.color} size={36} />
                  <div className={cx('flex-1 min-w-0 flex items-center gap-2 pr-4 py-2.5 self-stretch', i < f.members.length - 1 && 'border-b hairline')}>
                    <div className="flex-1 min-w-0">
                      <div className="text-[17px] truncate">{mem.id === YOU ? 'You' : mem.name}</div>
                      <div className="text-[13px] text-tertiary">Paid {m(p.paid)} · Share {m(p.share)}</div>
                      {due > 0 && <div className="text-[13px] text-warn font-medium">{m(due)} still to pay</div>}
                    </div>
                    {f.settledAt || p.result === 0
                      ? <Badge tone="grey">Settled</Badge>
                      : p.result > 0 ? <Badge tone="ok">Gets back {m(p.result)}</Badge> : <Badge tone="warn">Owes {m(-p.result)}</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="px-4 pt-1.5 text-[13px] text-tertiary">Paid = money in plus own-pocket payments. Share = their part of every cost they are in.</p>

          <h2 className="px-4 pt-6 pb-1.5 text-[13px] uppercase tracking-wide text-tertiary">Settle up</h2>
          <Card className="p-4">
            {f.settledAt ? (
              <div className="flex items-start gap-3">
                <CheckCircle2 size={22} strokeWidth={SW} className="text-ok shrink-0" />
                <div className="flex-1">
                  <div className="text-[17px] font-semibold">Settled on {fmtDay(new Date(f.settledAt).toISOString().slice(0, 10))}</div>
                  <button onClick={() => updateTrip(trip.id, (t) => { t.fund.settledAt = null; })} className="text-accent text-[15px] min-h-[44px]">Undo</button>
                </div>
              </div>
            ) : transfers.length === 0 ? (
              <p className="text-[15px] text-tertiary">Everyone is level. Nothing to settle.</p>
            ) : (
              <>
                <ul className="space-y-2.5">
                  {transfers.map((t, i) => (
                    <li key={i} className="flex items-center gap-2 text-[15px]">
                      <span className="font-medium">{t.from.id === YOU ? 'You' : t.from.name}</span>
                      <ArrowRight size={15} strokeWidth={2} className="text-tertiary" />
                      <span className="font-medium flex-1 truncate">{t.to.id === YOU ? 'You' : t.to.name}</span>
                      <span className="font-semibold tabular-nums">{m(t.sen)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[13px] text-tertiary mt-3">{transfers.length} transfer{transfers.length === 1 ? '' : 's'}. "The fund" is the cash you are holding.</p>
                <button
                  onClick={() => { if (window.confirm('Mark the group fund as settled?')) updateTrip(trip.id, (t) => { t.fund.settledAt = Date.now(); }); }}
                  className="press mt-3 w-full min-h-[46px] rounded-[12px] bg-accent text-white text-[15px] font-semibold"
                >
                  Mark as settled
                </button>
              </>
            )}
          </Card>
        </section>
      )}

      <button
        onClick={() => shareText(fundText(trip, home, settings.organiser), toast)}
        className="press mt-5 w-full min-h-[48px] rounded-[14px] bg-card text-accent text-[15px] font-semibold flex items-center justify-center gap-2"
      >
        <MessageCircle size={18} strokeWidth={SW} /> Share summary to WhatsApp
      </button>
      {!trip.domestic && <p className="px-4 pt-1.5 text-[13px] text-tertiary text-center">Totals in {symbol(home)}. Foreign payments keep the rate saved with each entry.</p>}
    </div>
  );
}
