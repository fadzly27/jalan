import { useState } from 'react';
import { CalendarPlus, ChevronRight, FileDown, Lock, MessageCircle } from 'lucide-react';
import { Segmented, Sheet, SW, TextButton, Toggle, toast } from '../ui.jsx';
import { useStore } from '../store.jsx';
import { tripDays, fmtDay } from '../lib/dates.js';
import { itineraryICS, itineraryPDF, itineraryText, deliverFile, shareText, slug } from '../lib/share.js';
import { downloadBlob } from '../lib/files.js';
import { homeCountryOf } from '../lib/model.js';

export default function ShareSheet({ trip, day, open, onClose }) {
  const { settings } = useStore();
  const [scope, setScope] = useState('trip');
  const [change, setChange] = useState('');
  const [withFund, setWithFund] = useState(false);
  const [busy, setBusy] = useState(false);
  const dates = scope === 'trip' ? tripDays(trip) : [day];
  const suffix = scope === 'trip' ? '' : `-${day}`;
  const plansCount = trip.plans.filter((p) => dates.includes(p.date)).length;

  const pdf = async () => {
    setBusy(true);
    try {
      const blob = itineraryPDF(trip, dates, { organiser: settings.organiser, includeFund: withFund, home: settings.homeCurrency });
      const r = await deliverFile(blob, `${slug(trip.name)}-itinerary${suffix}.pdf`, `${trip.name} itinerary`);
      if (r === 'downloaded') toast('PDF saved');
    } catch (e) {
      toast('Could not make the PDF');
      console.error(e);
    }
    setBusy(false);
  };

  const whatsapp = () => shareText(itineraryText(trip, dates, { change, organiser: settings.organiser }), toast);

  const calendar = () => {
    const ics = itineraryICS(trip, dates, homeCountryOf(settings));
    downloadBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), `${slug(trip.name)}${suffix}.ics`);
    toast('Calendar file ready. Open it to add the events.');
  };

  const Option = ({ icon: I, color, title, sub, onClick }) => (
    <button onClick={onClick} disabled={busy} className="tap w-full flex items-center gap-3 pl-4 min-h-[64px] text-left disabled:opacity-50">
      <span className="h-9 w-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: color }}><I size={19} strokeWidth={SW} color="#fff" /></span>
      <span className="flex-1 min-w-0 flex items-center pr-4 py-2.5 self-stretch border-b hairline">
        <span className="flex-1 min-w-0">
          <span className="block text-[17px]">{title}</span>
          <span className="block text-[13px] text-tertiary">{sub}</span>
        </span>
        <ChevronRight size={18} strokeWidth={2} className="text-tertiary/70" />
      </span>
    </button>
  );

  return (
    <Sheet open={open} onClose={onClose} title="Share itinerary" left={null} right={<TextButton bold onClick={onClose}>Done</TextButton>}>
      <Segmented className="mt-3" value={scope} onChange={setScope} options={[{ value: 'trip', label: 'Whole trip' }, { value: 'day', label: `This day · ${fmtDay(day)}` }]} />
      <p className="px-1 pt-2 text-[13px] text-tertiary">{plansCount ? `${plansCount} plan${plansCount === 1 ? '' : 's'} will be shared.` : 'No plans yet for this selection. Add plans in the itinerary first.'}</p>

      <div className="bg-card rounded-card overflow-hidden mt-3">
        <Option icon={FileDown} color="rgb(var(--accent))" title="Download PDF" sub="A4, works offline" onClick={pdf} />
        <Option icon={MessageCircle} color="#1E7B34" title="Send update to WhatsApp" sub="Plain text, day by day" onClick={whatsapp} />
        <Option icon={CalendarPlus} color="#0066CC" title="Add to Calendar" sub="One event per plan (.ics)" onClick={calendar} />
      </div>

      <h3 className="px-4 pt-6 pb-1.5 text-[13px] uppercase tracking-wide text-tertiary">WhatsApp update</h3>
      <div className="bg-card rounded-card">
        <input
          value={change}
          onChange={(e) => setChange(e.target.value)}
          placeholder="What changed? e.g. Dinner moved to 8 PM"
          className="w-full bg-transparent outline-none text-[17px] px-4 py-3.5 placeholder:text-tertiary"
          aria-label="What changed"
        />
      </div>
      <p className="px-4 pt-1.5 text-[13px] text-tertiary">Optional. Added as the first line with today's date and time.</p>

      {trip.fund?.enabled && (
        <div className="bg-card rounded-card mt-4 flex items-center gap-3 pl-4 pr-3 min-h-[56px]">
          <span className="flex-1 text-[17px]">Include group fund summary in PDF</span>
          <Toggle label="Include group fund summary" checked={withFund} onChange={setWithFund} />
        </div>
      )}

      <div className="mt-5 flex gap-2 px-1 text-[13px] text-tertiary">
        <Lock size={15} strokeWidth={SW} className="shrink-0 mt-px" />
        <p>Shared copies show plans, times and places. Costs and documents stay private.</p>
      </div>
    </Sheet>
  );
}
