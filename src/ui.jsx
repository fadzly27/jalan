import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Delete, X } from 'lucide-react';
import { money, SHORT_THRESHOLD } from './lib/currency.js';

export const SW = 1.75; // icon stroke width

export const cx = (...a) => a.filter(Boolean).join(' ');

export function Card({ className, children, onClick, ...rest }) {
  const C = onClick ? 'button' : 'div';
  return (
    <C onClick={onClick} className={cx('bg-card rounded-card block w-full text-left', onClick && 'press', className)} {...rest}>
      {children}
    </C>
  );
}

export function IconButton({ icon: I, onClick, label, className, filled }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cx(
        'press h-11 w-11 shrink-0 rounded-full flex items-center justify-center',
        filled ? 'bg-accent text-white' : 'text-accent',
        className
      )}
    >
      <I size={22} strokeWidth={filled ? 2 : SW} />
    </button>
  );
}

export function TextButton({ children, onClick, className, disabled, bold }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx('press min-h-[44px] px-2 text-[17px] text-accent disabled:opacity-40', bold && 'font-semibold', className)}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({ children, onClick, className, disabled, tone = 'accent' }) {
  const bg = tone === 'danger' ? 'bg-danger' : 'bg-accent';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx('press w-full min-h-[50px] rounded-[14px] text-white text-[17px] font-semibold disabled:opacity-40', bg, className)}
    >
      {children}
    </button>
  );
}

// Large-title header in iOS style
export function Header({ title, overline, left, right, className }) {
  return (
    <div className={cx('pt-safe px-4', className)}>
      <div className="flex h-11 items-center justify-between -mx-2">
        <div className="flex items-center">{left}</div>
        <div className="flex items-center">{right}</div>
      </div>
      {overline && <div className="text-[13px] font-semibold uppercase tracking-wide text-tertiary mt-1">{overline}</div>}
      <h1 className="text-large font-bold">{title}</h1>
    </div>
  );
}

// Compact iOS navigation bar with a centred inline title
export function NavBar({ left, title, right }) {
  return (
    <div className="sticky top-0 z-30 blurbar pt-safe">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center h-11 px-2">
        <div className="justify-self-start flex items-center min-w-0 pl-2">{left}</div>
        <div className="text-[17px] font-semibold truncate max-w-[52vw] text-center">{title}</div>
        <div className="justify-self-end flex items-center">{right}</div>
      </div>
    </div>
  );
}

export function Segmented({ options, value, onChange, className }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={cx('relative flex rounded-[9px] bg-fill/[0.12] p-[2px]', className)} role="tablist">
      <div
        className="absolute top-[2px] bottom-[2px] rounded-[7px] bg-card shadow-[0_3px_8px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.04)] dark:bg-[#636366] transition-transform duration-300 ease-[cubic-bezier(.32,.72,0,1)]"
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${idx * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx('relative z-10 flex-1 min-h-[36px] px-2 text-[14px] truncate', o.value === value ? 'font-semibold' : 'font-medium')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressRing({ pct, size = 64, stroke = 7, tone, track = 'rgb(var(--fill) / 0.18)' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = tone || (pct >= 100 ? 'rgb(var(--ok))' : pct >= 50 ? 'rgb(var(--accent))' : 'rgb(var(--warn))');
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, pct) / 100)}
        style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.32,.72,0,1)' }}
      />
    </svg>
  );
}

export function ProgressBar({ pct, tone = 'accent', className }) {
  const bg = { accent: 'bg-accent', ok: 'bg-ok', warn: 'bg-warn' }[tone];
  return (
    <div className={cx('h-[6px] rounded-full bg-fill/[0.16] overflow-hidden', className)}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', bg)} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export function Badge({ tone = 'accent', solid, children, className }) {
  const map = {
    accent: solid ? 'bg-accent text-white' : 'bg-accent/[0.12] text-accent',
    ok: solid ? 'bg-ok-ink text-white' : 'bg-ok/[0.14] text-ok',
    warn: solid ? 'bg-warn-ink text-white' : 'bg-warn/[0.15] text-warn',
    grey: 'bg-fill/[0.14] text-tertiary',
  };
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-[3px] text-[12px] font-semibold whitespace-nowrap', map[tone], className)}>{children}</span>;
}

export function Chip({ active, onClick, children, icon: I }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'press shrink-0 min-h-[36px] rounded-full px-3.5 text-[15px] flex items-center gap-1.5 border',
        active ? 'bg-accent text-white border-accent' : 'bg-card text-label border-sep/60'
      )}
    >
      {I && <I size={16} strokeWidth={SW} />}
      {children}
    </button>
  );
}

export function Group({ title, footer, children, className }) {
  return (
    <section className={cx('mt-6', className)}>
      {title && <h2 className="px-4 pb-1.5 text-[13px] uppercase tracking-wide text-tertiary">{title}</h2>}
      <div className="bg-card rounded-card overflow-hidden">{children}</div>
      {footer && <p className="px-4 pt-1.5 text-[13px] text-tertiary">{footer}</p>}
    </section>
  );
}

export function Row({ icon: I, iconColor, title, subtitle, value, onClick, chevron = !!onClick, last, right, tone }) {
  const C = onClick ? 'button' : 'div';
  return (
    <C onClick={onClick} className={cx('w-full text-left flex items-center gap-3 pl-4 min-h-[52px]', onClick && 'tap')}>
      {I && (
        <span className="h-[30px] w-[30px] rounded-[8px] flex items-center justify-center shrink-0" style={{ background: iconColor || 'rgb(var(--accent))' }}>
          <I size={18} strokeWidth={SW} color="#fff" />
        </span>
      )}
      <div className={cx('flex-1 min-w-0 flex items-center gap-2 pr-4 py-2.5 self-stretch', !last && 'border-b hairline')}>
        <div className="flex-1 min-w-0">
          <div className={cx('text-[17px] truncate', tone === 'danger' && 'text-danger', tone === 'accent' && 'text-accent')}>{title}</div>
          {subtitle && <div className="text-[13px] text-tertiary truncate">{subtitle}</div>}
        </div>
        {value != null && <div className="text-[17px] text-tertiary shrink-0 text-right">{value}</div>}
        {right}
        {chevron && <ChevronRight size={18} strokeWidth={2} className="text-tertiary/70 shrink-0 -mr-1" />}
      </div>
    </C>
  );
}

export function Empty({ icon: I, text, action }) {
  return (
    <div className="flex flex-col items-center text-center px-8 py-12">
      {I && <I size={40} strokeWidth={1.25} className="text-tertiary mb-3" />}
      <p className="text-[15px] text-tertiary max-w-[260px]">{text}</p>
      {action}
    </div>
  );
}

// Money with tap-to-expand for short forms
export function Money({ amount, code, short = true, whole = false, className }) {
  const [full, setFull] = useState(false);
  const canShort = short && Math.abs(amount) >= SHORT_THRESHOLD;
  const text = money(amount, code, { short: canShort && !full, whole: whole && !full && Math.abs(amount) >= 1000 });
  if (!canShort) return <span className={className}>{text}</span>;
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); setFull((f) => !f); }}
      className={cx('cursor-pointer', className)}
      title={money(amount, code)}
    >
      {text}
    </span>
  );
}

// ---------- Bottom sheet ----------
export function Sheet({ open, onClose, title, left, right, children, full, noPad }) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const panel = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    if (open) { setMounted(true); setClosing(false); }
    else if (mounted) {
      setClosing(true);
      const t = setTimeout(() => { setMounted(false); setClosing(false); }, 250);
      return () => clearTimeout(t);
    }
  }, [open]); // eslint-disable-line

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mounted]);

  if (!mounted) return null;

  // Drag the grabber to dismiss
  const onTouchStart = (e) => { drag.current = { y: e.touches[0].clientY, dy: 0 }; };
  const onTouchMove = (e) => {
    if (!drag.current) return;
    const dy = Math.max(0, e.touches[0].clientY - drag.current.y);
    drag.current.dy = dy;
    if (panel.current) panel.current.style.transform = `translateY(${dy}px)`;
  };
  const onTouchEnd = () => {
    if (!drag.current) return;
    const { dy } = drag.current;
    drag.current = null;
    if (panel.current) {
      panel.current.style.transition = 'transform 250ms cubic-bezier(.32,.72,0,1)';
      panel.current.style.transform = dy > 110 ? 'translateY(100%)' : '';
      setTimeout(() => { if (panel.current) panel.current.style.transition = ''; }, 260);
    }
    if (dy > 110) setTimeout(onClose, 200);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className={cx('absolute inset-0 bg-black/40', closing ? 'backdrop-exit' : 'backdrop-enter')} onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cx(
          'relative w-full max-w-[560px] bg-bg rounded-t-[14px] flex flex-col shadow-2xl',
          full ? 'h-[94vh]' : 'max-h-[94vh]',
          closing ? 'sheet-exit' : 'sheet-enter'
        )}
      >
        <div className="pt-2 pb-1 flex justify-center touch-none" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className="h-[5px] w-9 rounded-full bg-fill/30" />
        </div>
        {(title || left || right) && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center px-2 min-h-[44px] touch-none" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <div className="justify-self-start">{left !== undefined ? left : <TextButton onClick={onClose}>Cancel</TextButton>}</div>
            <div className="text-[17px] font-semibold text-center truncate px-2">{title}</div>
            <div className="justify-self-end">{right}</div>
          </div>
        )}
        <div className={cx('overflow-y-auto overscroll-contain flex-1', !noPad && 'px-4 pb-safe')} style={{ paddingBottom: noPad ? undefined : 'calc(env(safe-area-inset-bottom) + 20px)' }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---------- Inputs ----------
export function Field({ label, children, last }) {
  return (
    <label className={cx('flex items-center gap-3 pl-4 min-h-[48px]')}>
      {label && <span className="text-[17px] w-[108px] shrink-0">{label}</span>}
      <div className={cx('flex-1 min-w-0 flex items-center pr-4 self-stretch', !last && 'border-b hairline')}>{children}</div>
    </label>
  );
}

export const inputCls = 'w-full bg-transparent outline-none text-[17px] py-3 placeholder:text-tertiary/70 min-w-0';

export function Keypad({ onKey, keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'], className }) {
  return (
    <div className={cx('grid grid-cols-3 gap-2', className)}>
      {keys.map((k, i) =>
        k === '' ? <div key={i} /> : (
          <button
            key={k}
            onClick={() => { onKey(k); navigator.vibrate?.(5); }}
            aria-label={k === 'del' ? 'Delete' : k}
            className="press h-[54px] rounded-[12px] bg-card text-[26px] font-normal flex items-center justify-center active:bg-fill/20"
          >
            {k === 'del' ? <Delete size={24} strokeWidth={SW} /> : k}
          </button>
        )
      )}
    </div>
  );
}

// ---------- Toast ----------
const listeners = new Set();
export function toast(msg) { listeners.forEach((l) => l(msg)); }
export function Toaster() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    let t;
    const l = (m) => { setMsg(m); clearTimeout(t); t = setTimeout(() => setMsg(null), 2200); };
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
  if (!msg) return null;
  return createPortal(
    <div className="fixed inset-x-0 z-[60] flex justify-center pointer-events-none" style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}>
      <div className="anim-fade rounded-full bg-label text-bg px-4 py-2.5 text-[15px] font-medium shadow-lg max-w-[90vw] text-center">{msg}</div>
    </div>,
    document.body
  );
}

export function CloseButton({ onClick }) {
  return (
    <button onClick={onClick} aria-label="Dismiss" className="press h-11 w-11 -m-2 flex items-center justify-center text-tertiary shrink-0">
      <X size={18} strokeWidth={2} />
    </button>
  );
}
