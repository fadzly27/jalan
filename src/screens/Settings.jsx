import { useRef, useState } from 'react';
import { ChevronLeft, Coins, Download, Lock, Moon, Upload, Trash2, Sparkles, Info, CircleAlert, BookOpen, ImagePlus } from 'lucide-react';
import { Field, Group, Header, Row, Segmented, Sheet, TextButton, SW, inputCls, toast } from '../ui.jsx';
import { imageToDataURL } from '../lib/files.js';
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
  const logoRef = useRef(null);
  const org = settings.organiser || { name: '', logo: null, phone: '', email: '' };
  const setOrg = (patch) => setSettings((s) => ({ ...s, organiser: { ...(s.organiser || {}), ...patch } }));
  const onLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { setOrg({ logo: await imageToDataURL(file, 256) }); toast('Logo saved'); } catch { toast('Could not read that image'); }
  };
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

        <Group title="Organiser profile" footer="Optional. Shown on shared PDFs and at the end of WhatsApp messages. Stays on this device.">
          <Field label="Name"><input className={inputCls} value={org.name} onChange={(e) => setOrg({ name: e.target.value })} placeholder="You or your business" /></Field>
          <Field label="Phone"><input type="tel" className={inputCls} value={org.phone} onChange={(e) => setOrg({ phone: e.target.value })} placeholder="+60 12-345 6789" /></Field>
          <Field label="Email"><input type="email" inputMode="email" autoCapitalize="none" className={inputCls} value={org.email} onChange={(e) => setOrg({ email: e.target.value })} placeholder="name@example.com" /></Field>
          <div className="flex items-center gap-3 pl-4 pr-2 min-h-[60px]">
            <span className="text-[17px] w-[108px] shrink-0">Logo</span>
            {org.logo ? (
              <>
                <img src={org.logo} alt="Organiser logo" className="h-10 w-10 rounded-[8px] object-contain bg-white border border-sep/60" />
                <span className="flex-1" />
                <button onClick={() => logoRef.current?.click()} className="press min-h-[44px] px-2 text-accent text-[15px]">Change</button>
                <button onClick={() => setOrg({ logo: null })} className="press min-h-[44px] px-2 text-danger text-[15px]">Remove</button>
              </>
            ) : (
              <button onClick={() => logoRef.current?.click()} className="press flex-1 min-h-[44px] flex items-center gap-1.5 text-accent text-[15px]"><ImagePlus size={18} strokeWidth={SW} /> Add logo</button>
            )}
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={onLogo} />
          </div>
        </Group>

        <Group title="Privacy" footer="The PIN locks the Documents tab on this device.">
          {settings.pinHash ? (
            <>
              <Row icon={Lock} iconColor="rgb(var(--accent))" title="Change PIN" onClick={() => setPinMode('verify-change')} />
              <Row icon={Lock} iconColor="rgb(var(--danger))" title="Turn off PIN" tone="danger" onClick={() => setPinMode('verify-remove')} chevron={false} last />
            </>
          ) : (
            <Row icon={Lock} iconColor="rgb(var(--accent))" title="Set PIN for Documents" onClick={() => setPinMode('set')} last />
          )}
        </Group>

        <Group
          title="Backup"
          footer={<span className={stale ? 'text-warn' : ''}>{last ? `Last backup ${fmtDateTime(last)}.` : 'No backup yet.'} {stale ? 'Back up at least once a month.' : ''} The file includes trips, plans, packing, expenses and documents.</span>}
        >
          <Row icon={Download} iconColor="rgb(var(--accent))" title={busy ? 'Exporting…' : 'Export all data'} onClick={busy ? undefined : doExport} right={stale ? <CircleAlert size={18} strokeWidth={SW} className="text-warn" /> : null} />
          <Row icon={Upload} iconColor="#8E8E93" title="Import backup" onClick={() => fileRef.current?.click()} last />
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={doImport} />
        </Group>

        <Group title="Sample data">
          {hasSample ? (
            <Row icon={Trash2} iconColor="rgb(var(--danger))" title="Clear sample data" tone="danger" chevron={false} onClick={async () => { if (window.confirm('Remove the sample trips (Seoul – Busan and Penang Getaway)?')) { await clearSample(); toast('Sample data cleared'); } }} last />
          ) : (
            <Row icon={Sparkles} iconColor="#AF52DE" title="Add sample trips" chevron={false} onClick={async () => { await loadSample(); toast('Sample trips added'); }} last />
          )}
        </Group>

        <Group title="About" footer="Jalan keeps everything on this device. No account, no server.">
          <Row icon={BookOpen} iconColor="rgb(var(--accent))" title="How to use Jalan" onClick={() => { window.location.href = './guide.html'; }} />
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
