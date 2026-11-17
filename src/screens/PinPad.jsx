import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Keypad, SW, cx } from '../ui.jsx';
import { hashPin } from '../lib/files.js';

// 4-digit PIN entry. mode 'verify' checks against hash; mode 'set' asks twice.
export default function PinPad({ mode = 'verify', hash, onSuccess, title }) {
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState(null);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const fail = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => { setShake(false); setPin(''); }, 380);
  };

  const onKey = async (k) => {
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    setError('');
    if (next.length < 4) return;
    if (mode === 'verify') {
      (await hashPin(next)) === hash ? onSuccess() : fail('Wrong PIN. Try again.');
    } else if (!first) {
      setFirst(next);
      setTimeout(() => setPin(''), 150);
    } else if (first === next) {
      onSuccess(await hashPin(next));
    } else {
      setFirst(null);
      fail('PINs did not match. Start again.');
    }
  };

  const heading = title || (mode === 'verify' ? 'Enter PIN' : first ? 'Confirm new PIN' : 'Choose a 4-digit PIN');
  return (
    <div className="flex flex-col items-center px-6 pt-6">
      <span className="h-12 w-12 rounded-full flex items-center justify-center text-accent" style={{ background: 'rgb(var(--accent) / 0.12)' }}>
        <Lock size={22} strokeWidth={SW} />
      </span>
      <div className="text-[20px] font-semibold mt-3">{heading}</div>
      <div className={cx('flex gap-4 mt-5', shake && 'anim-shake')}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cx('h-3.5 w-3.5 rounded-full border-2 border-label/60', i < pin.length && 'bg-label/80')} />
        ))}
      </div>
      <div className="h-6 mt-3 text-[14px] text-warn">{error}</div>
      <Keypad className="w-full max-w-[300px] mt-2" keys={['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']} onKey={onKey} />
    </div>
  );
}
