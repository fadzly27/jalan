import { createPortal } from 'react-dom';
import { ChevronLeft, LayoutGrid, CalendarDays, Luggage, FileText, Wallet } from 'lucide-react';
import { useStore } from '../store.jsx';
import { useNav } from '../App.jsx';
import { cx } from '../ui.jsx';
import Overview from './Overview.jsx';
import Itinerary from './Itinerary.jsx';
import Packing from './Packing.jsx';
import Docs from './Docs.jsx';
import Budget from './Budget.jsx';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'itinerary', label: 'Itinerary', icon: CalendarDays },
  { id: 'packing', label: 'Packing', icon: Luggage },
  { id: 'docs', label: 'Docs', icon: FileText },
  { id: 'budget', label: 'Budget', icon: Wallet },
];

export function BackButton() {
  const { pop } = useNav();
  return (
    <button onClick={pop} className="press min-h-[44px] flex items-center text-accent text-[17px] pr-2 -ml-1">
      <ChevronLeft size={28} strokeWidth={2} className="-mr-0.5" /> Trips
    </button>
  );
}

export default function Trip({ id, tab }) {
  const { trips } = useStore();
  const { replaceTop, pop } = useNav();
  const trip = trips.find((t) => t.id === id);
  if (!trip) {
    return (
      <div className="pt-safe px-4">
        <div className="h-11 flex items-center"><BackButton /></div>
        <p className="mt-10 text-center text-tertiary">This trip no longer exists. <button className="text-accent" onClick={pop}>Go back</button></p>
      </div>
    );
  }
  const go = (t) => { replaceTop({ tab: t }); window.scrollTo(0, 0); };
  const props = { trip, go };

  return (
    <div className="min-h-full pb-tabbar">
      <div key={tab} className="anim-tab">
        {tab === 'overview' && <Overview {...props} />}
        {tab === 'itinerary' && <Itinerary {...props} />}
        {tab === 'packing' && <Packing {...props} />}
        {tab === 'docs' && <Docs {...props} />}
        {tab === 'budget' && <Budget {...props} />}
      </div>
      {createPortal(<nav className="fixed bottom-0 inset-x-0 z-40 blurbar border-t hairline pb-safe">
        <div className="mx-auto max-w-[560px] flex">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                aria-current={active ? 'page' : undefined}
                className={cx('flex-1 min-h-[50px] pt-1.5 pb-1 flex flex-col items-center justify-center gap-0.5', active ? 'text-accent' : 'text-tertiary')}
              >
                <t.icon size={24} strokeWidth={active ? 2 : 1.6} />
                <span className="text-[10px] font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>, document.body)}
    </div>
  );
}
