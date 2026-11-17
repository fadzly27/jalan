import { useRef, useState } from 'react';
import { ChevronLeft, Coins, Download, Lock, Moon, Upload, Trash2, Sparkles, Info, CircleAlert, BookOpen } from 'lucide-react';
import { Group, Header, Row, Segmented, Sheet, TextButton, SW, toast } from '../ui.jsx';
import { CurrencyPicker } from '../pickers.jsx';
import { useStore } from '../store.jsx';
import { useNav } from '../App.jsx';
import PinPad from './PinPad.jsx';
import { currencyName, symbol } from '../lib/currency.js';
import { fmtDateTime } from '../lib/dates.js';

export default function Settings() {
  const { settings, setSettings, trips, exportAll, importAll, clearSample, loadSample, setUnlocked } = useStore();
  const { pop } = useNav();
  const [pickHome, setPickHome] = useState(false);
  const [pinMode, setPinMode] = useState(null); // 'set' | 'verify-remove' | 'verify-change'
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const hasSample = trips.some((t) => t.sample);
  const last = settings.lastBackup;
  const stale = !last || Date.now() - last > 30 * 86400000;

  const doExport = async () => {
    setBusy(true);
    try { if (await exportAll()) toast('Backup exported'); } catch { toast('Export failed'); }
    setBusy(false);
  };
  const doImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm('Restore this backup? It replaces all trips and documents on this device.')) return;
    try { await importAll(file); toast('Backup restored'); } catch (err) { toast(err.message || 'Could not read this file'); }
  };

  return (
    <div className="pb-page">
      <Header
        left={<button onClick={pop} className="press min-h-[44px] flex items-center text-accent text-[17px] pr-2 -ml-1"><ChevronLeft size={28} strokeWidth={2} className="-mr-0.5" /> Trips</button>}
        title="Settings"
      />
      <div className="px-4">
        <Group title="Money" footer="Used for every trip. Totals and budgets are always shown in this currency.">
          <Row icon={Coins} iconColor="#24A648" title="Home currency" value={`${symbol(settings.homeCurrency)} ${settings.homeCurrency}`} onClick={() => setPickHome(true)} last />
        </Group>

        <Group title="Appearance">
          <div className="flex items-center gap-3 pl-4 pr-3 min-h-[56px]">
            <span className="h-[30px] w-[30px] rounded-[8px] flex items-center justify-center shrink-0 bg-[#5856D6]"><Moon size={18} strokeWidth={SW} color="#fff" /></span>
            <Segmented
              className="flex-1"
              value={settings.appearance}
              onChange={(v) => setSettings({ appearance: v })}
              options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
            />
          </div>
        </Group>

        <Group title="Privacy" footer="The PIN locks the Documents tab on this device.">
          {settings.pinHash ? (
            <>
              <Row icon={Lock} iconColor="#0066CC" title="Change PIN" onClick={() => setPinMode('verify-change')} />
              <Row icon={Lock} iconColor="rgb(var(--danger))" title="Turn off PIN" tone="danger" onClick={() => setPinMode('verify-remove')} chevron={false} last />
            </>
          ) : (
            <Row icon={Lock} iconColor="#0066CC" title="Set PIN for Documents" onClick={() => setPinMode('set')} last />
          )}
        </Group>

        <Group
          title="Backup"
          footer={<span className={stale ? 'text-warn' : ''}>{last ? `Last backup ${fmtDateTime(last)}.` : 'No backup yet.'} {stale ? 'Back up at least once a month.' : ''} The file includes trips, plans, packing, expenses and documents.</span>}
        >
          <Row icon={Download} iconColor="#0066CC" title={busy ? 'Exporting…' : 'Export all data'} onClick={busy ? undefined : doExport} right={stale ? <CircleAlert size={18} strokeWidth={SW} className="text-warn" /> : null} />
          <Row icon={Upload} iconColor="#8E8E93" title="Import backup" onClick={() => fileRef.current?.click()} last />
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={doImport} />
        </Group>

        <Group title="Sample data">
          {hasSample ? (
            <Row icon={Trash2} iconColor="rgb(var(--danger))" title="Clear sample data" tone="danger" chevron={false} onClick={async () => { if (window.confirm('Remove the sample Seoul – Busan trip?')) { await clearSample(); toast('Sample data cleared'); } }} last />
          ) : (
            <Row icon={Sparkles} iconColor="#AF52DE" title="Add sample trip" chevron={false} onClick={async () => { await loadSample(); toast('Sample trip added'); }} last />
          )}
        </Group>

        <Group title="About" footer="Jalan keeps everything on this device. No account, no server.">
          <Row icon={BookOpen} iconColor="#0066CC" title="How to use Jalan" onClick={() => { window.location.href = './guide.html'; }} />
          <Row icon={Info} iconColor="#8E8E93" title="Jalan" value="1.0" last />
        </Group>
      </div>

      <CurrencyPicker open={pickHome} onClose={() => setPickHome(false)} value={settings.homeCurrency} onPick={(c) => { setSettings({ homeCurrency: c }); toast(`Home currency: ${currencyName(c)}`); }} />

      <Sheet open={!!pinMode} onClose={() => setPinMode(null)} title={pinMode === 'set' ? 'Set PIN' : pinMode === 'verify-remove' ? 'Turn off PIN' : 'Change PIN'} left={<TextButton onClick={() => setPinMode(null)}>Cancel</TextButton>}>
        {pinMode === 'set' && (
          <PinPad key="set" mode="set" onSuccess={(hash) => { setSettings({ pinHash: hash }); setUnlocked(true); setPinMode(null); toast('PIN set'); }} />
        )}
        {(pinMode === 'verify-remove' || pinMode === 'verify-change') && (
          <PinPad
            key="verify"
            mode="verify"
            hash={settings.pinHash}
            title="Enter current PIN"
            onSuccess={() => {
              if (pinMode === 'verify-remove') { setSettings({ pinHash: null }); setPinMode(null); toast('PIN turned off'); }
              else setPinMode('set');
            }}
          />
        )}
      </Sheet>
    </div>
  );
}
