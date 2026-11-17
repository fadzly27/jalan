import { useEffect, useRef, useState } from 'react';
import { CircleAlert, FilePlus2, HeartPulse, Lock, MinusCircle, Phone, Plus, Share, Upload, Eye, Trash2, Building2, ExternalLink } from 'lucide-react';
import { Badge, Card, Field, Group, Header, IconButton, PrimaryButton, Segmented, Sheet, SW, TextButton, cx, inputCls, toast } from '../ui.jsx';
import { useStore } from '../store.jsx';
import { BackButton } from './Trip.jsx';
import PinPad from './PinPad.jsx';
import { DOC_LABEL, DOC_STATUSES, DOC_TYPES, STATUS_LABEL, docWarnings } from '../lib/logic.js';
import { DOC_META, STATUS_TONE } from '../meta.jsx';
import { fmtDayYear } from '../lib/dates.js';
import { shrinkImage } from '../lib/files.js';
import { uid } from '../lib/db.js';

export function useFileURL(id) {
  const { getFile } = useStore();
  const [state, setState] = useState({ url: null, type: null });
  useEffect(() => {
    let url, alive = true;
    if (!id) { setState({ url: null, type: null }); return; }
    getFile(id).then((b) => {
      if (!alive || !b) return;
      url = URL.createObjectURL(b);
      setState({ url, type: b.type });
    });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [id, getFile]);
  return state;
}

export function FileViewer({ fileId, title, open, onClose }) {
  const { url, type } = useFileURL(open ? fileId : null);
  return (
    <Sheet open={open} onClose={onClose} title={title} left={null} right={<TextButton bold onClick={onClose}>Done</TextButton>} full noPad>
      <div className="h-full flex flex-col">
        {url && type?.startsWith('image/') && <img src={url} alt={title} className="w-full flex-1 object-contain bg-black" />}
        {url && type === 'application/pdf' && <iframe title={title} src={url} className="w-full flex-1 bg-white" />}
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="press m-4 mb-8 min-h-[48px] rounded-[14px] bg-card flex items-center justify-center gap-2 text-accent text-[15px] font-medium">
            <ExternalLink size={17} strokeWidth={SW} /> Open full screen
          </a>
        )}
        {!url && <p className="p-8 text-center text-tertiary">Loading…</p>}
      </div>
    </Sheet>
  );
}

function DocCard({ doc, onClick }) {
  const { url, type } = useFileURL(doc.fileId);
  const M = DOC_META[doc.type] || DOC_META.other;
  return (
    <Card onClick={onClick} className="overflow-hidden flex flex-col">
      <div className="h-[92px] relative flex items-center justify-center" style={{ background: M.color + '18' }}>
        {url && type?.startsWith('image/') ? (
          <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <M.icon size={34} strokeWidth={1.4} style={{ color: M.color }} />
        )}
        {url && type === 'application/pdf' && <span className="absolute bottom-2 left-2 rounded-md bg-black/50 text-white text-[11px] font-semibold px-1.5 py-0.5">PDF</span>}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <div className="text-[15px] font-semibold leading-snug line-clamp-2">{doc.title || DOC_LABEL[doc.type]}</div>
        <div className="text-[12px] text-tertiary mt-0.5">{doc.expiry ? `Expires ${fmtDayYear(doc.expiry)}` : DOC_LABEL[doc.type]}</div>
        <div className="mt-2 flex items-center justify-between gap-1">
          <Badge tone={STATUS_TONE[doc.status]} solid={doc.status === 'missing'}>{STATUS_LABEL[doc.status]}</Badge>
          {!doc.fileId && <span className="text-[11px] text-tertiary">No file</span>}
        </div>
      </div>
    </Card>
  );
}

export default function Docs({ trip }) {
  const { settings, unlocked, setUnlocked } = useStore();
  const [sheet, setSheet] = useState(null);
  const [emergency, setEmergency] = useState(false);
  const warnings = docWarnings(trip);

  if (settings.pinHash && !unlocked) {
    return (
      <div>
        <Header left={<BackButton />} title="Documents" />
        <PinPad mode="verify" hash={settings.pinHash} onSuccess={() => setUnlocked(true)} title="Documents are locked" />
      </div>
    );
  }

  const share = async () => {
    const e = trip.emergency;
    const lines = [
      `Emergency info – ${trip.name}`,
      ...e.contacts.map((c) => `Contact: ${c.name}${c.phone ? ` ${c.phone}` : ''}`),
      e.bloodType && `Blood type: ${e.bloodType}`,
      e.medical && `Medical: ${e.medical}`,
      e.embassy?.name && `Embassy: ${e.embassy.name}${e.embassy.phone ? `, ${e.embassy.phone}` : ''}${e.embassy.address ? `, ${e.embassy.address}` : ''}`,
    ].filter(Boolean);
    const text = lines.join('\n');
    try {
      if (navigator.share) await navigator.share({ title: 'Emergency info', text });
      else { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); }
    } catch (err) {
      if (err?.name !== 'AbortError') toast('Sharing is not available');
    }
  };
  const e = trip.emergency;

  return (
    <div>
      <Header
        left={<BackButton />}
        right={<>
          {settings.pinHash && <IconButton icon={Lock} label="Lock documents" onClick={() => setUnlocked(false)} />}
          <IconButton icon={Plus} label="Add document" onClick={() => setSheet({ new: true })} />
        </>}
        title="Documents"
      />
      <div className="px-4">
        {warnings.map((w) => (
          <div key={w.id} className="mt-3 rounded-card p-3.5 flex gap-3 bg-warn/[0.12]">
            <CircleAlert size={20} strokeWidth={SW} className="text-warn shrink-0 mt-px" />
            <button className="text-left flex-1" onClick={() => {
              if (w.docId) setSheet({ doc: trip.docs.find((d) => d.id === w.docId) });
              else setSheet({ new: true, type: w.id === 'insurance' ? 'insurance' : w.id === 'nopassport' ? 'passport' : 'other' });
            }}>
              <div className="text-[15px] font-semibold text-warn">{w.text}</div>
              <div className="text-[14px] text-label/70 leading-snug">{w.detail}</div>
            </button>
          </div>
        ))}

        {trip.docs.length ? (
          <div className="grid grid-cols-2 gap-3 mt-4">
            {trip.docs.map((d) => <DocCard key={d.id} doc={d} onClick={() => setSheet({ doc: d })} />)}
          </div>
        ) : (
          <Card className="mt-4 p-6 flex flex-col items-center text-center" onClick={() => setSheet({ new: true })}>
            <FilePlus2 size={36} strokeWidth={1.25} className="text-tertiary mb-2" />
            <p className="text-[15px] text-tertiary">Tap + to save your passport, tickets and bookings for offline use.</p>
          </Card>
        )}

        <section className="mt-7">
          <div className="flex items-end justify-between px-4 pb-1.5">
            <h2 className="text-[13px] uppercase tracking-wide text-tertiary">Emergency card</h2>
            <button onClick={() => setEmergency(true)} className="text-[15px] text-accent min-h-[32px]">Edit</button>
          </div>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-[15px] font-semibold">
              <HeartPulse size={20} strokeWidth={SW} className="text-danger" /> In case of emergency
            </div>
            {e.contacts.length === 0 && !e.bloodType && !e.embassy?.name ? (
              <p className="text-[15px] text-tertiary mt-2">Tap Edit to add contacts, blood type and your embassy.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {e.contacts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0"><div className="text-[13px] text-tertiary">Contact</div><div className="text-[17px] truncate">{c.name}</div></div>
                    {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="press min-h-[44px] inline-flex items-center gap-1.5 rounded-full bg-ok/[0.14] text-ok px-3.5 text-[15px] font-medium"><Phone size={15} strokeWidth={SW} />{c.phone}</a>}
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  {e.bloodType && <div><div className="text-[13px] text-tertiary">Blood type</div><div className="text-[17px] font-semibold">{e.bloodType}</div></div>}
                  {e.medical && <div><div className="text-[13px] text-tertiary">Medical</div><div className="text-[15px]">{e.medical}</div></div>}
                </div>
                {e.embassy?.name && (
                  <div className="flex gap-2">
                    <Building2 size={18} strokeWidth={SW} className="text-tertiary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[15px] font-medium">{e.embassy.name}</div>
                      {e.embassy.address && <div className="text-[14px] text-tertiary">{e.embassy.address}</div>}
                      {e.embassy.phone && <a href={`tel:${e.embassy.phone.replace(/[^\d+]/g, '')}`} className="text-[15px] text-accent">{e.embassy.phone}</a>}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button onClick={share} className="press mt-4 w-full min-h-[46px] rounded-[12px] bg-fill/[0.12] text-accent text-[15px] font-semibold flex items-center justify-center gap-2">
              <Share size={17} strokeWidth={SW} /> Share
            </button>
          </Card>
        </section>
      </div>

      <DocSheet trip={trip} state={sheet} onClose={() => setSheet(null)} />
      <EmergencySheet trip={trip} open={emergency} onClose={() => setEmergency(false)} />
    </div>
  );
}

function DocSheet({ trip, state, onClose }) {
  const { updateTrip, saveFile, deleteFile } = useStore();
  const editing = state?.doc;
  const [f, setF] = useState({});
  const [viewing, setViewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const original = useRef(null);

  useEffect(() => {
    if (state) {
      const base = editing ? { ...editing } : { type: state.type || 'passport', title: '', status: 'check', number: '', expiry: '', fileId: null, notes: '' };
      setF(base);
      original.current = base.fileId;
    }
  }, [state]); // eslint-disable-line
  const set = (p) => setF((x) => ({ ...x, ...p }));

  const onFile = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    setBusy(true);
    const blob = await shrinkImage(file, 2400, 0.88);
    const id = await saveFile(blob);
    if (f.fileId && f.fileId !== original.current) deleteFile(f.fileId);
    set({ fileId: id, fileName: file.name, status: f.status === 'missing' || f.status === 'check' ? (f.type === 'flight' || f.type === 'hotel' ? 'booked' : 'valid') : f.status });
    setBusy(false);
  };

  const close = () => {
    if (f.fileId && f.fileId !== original.current) deleteFile(f.fileId); // discard unsaved upload
    onClose();
  };
  const save = () => {
    updateTrip(trip.id, (t) => {
      const data = { ...f, title: (f.title || '').trim() || DOC_LABEL[f.type] };
      if (editing) t.docs = t.docs.map((d) => (d.id === editing.id ? data : d));
      else t.docs.push({ ...data, id: uid() });
    });
    if (original.current && original.current !== f.fileId) deleteFile(original.current);
    original.current = f.fileId;
    onClose();
  };
  const del = () => {
    if (!window.confirm('Delete this document from this device?')) return;
    updateTrip(trip.id, (t) => {
      t.docs = t.docs.filter((d) => d.id !== editing.id);
      t.plans.forEach((p) => { if (p.docId === editing.id) p.docId = null; });
    });
    deleteFile(editing.fileId);
    if (f.fileId !== editing.fileId) deleteFile(f.fileId);
    original.current = null;
    onClose();
  };
  const removeFile = () => {
    if (f.fileId !== original.current) deleteFile(f.fileId);
    set({ fileId: null, fileName: null });
  };

  const showExpiry = ['passport', 'visa', 'insurance', 'other'].includes(f.type);

  return (
    <Sheet open={!!state} onClose={close} title={editing ? 'Document' : 'New Document'} right={<TextButton bold onClick={save}>{editing ? 'Save' : 'Add'}</TextButton>}>
      <div className="grid grid-cols-3 gap-2 mt-3">
        {DOC_TYPES.map((t) => {
          const M = DOC_META[t];
          const active = f.type === t;
          return (
            <button key={t} onClick={() => set({ type: t })} className={cx('press min-h-[64px] rounded-[14px] bg-card flex flex-col items-center justify-center gap-1 text-[12px] font-medium border-2 px-1 text-center', active ? '' : 'border-transparent')} style={active ? { borderColor: M.color } : undefined}>
              <M.icon size={20} strokeWidth={SW} style={{ color: M.color }} />
              {DOC_LABEL[t]}
            </button>
          );
        })}
      </div>

      <Group>
        <Field label="Title"><input className={inputCls} value={f.title || ''} onChange={(e) => set({ title: e.target.value })} placeholder={DOC_LABEL[f.type]} /></Field>
        <Field label="Number" last={!showExpiry}><input className={inputCls} value={f.number || ''} onChange={(e) => set({ number: e.target.value })} placeholder="Reference or number" /></Field>
        {showExpiry && <Field label="Expires" last><input type="date" className={inputCls} value={f.expiry || ''} onChange={(e) => set({ expiry: e.target.value })} /></Field>}
      </Group>

      <h3 className="px-4 pt-6 pb-1.5 text-[13px] uppercase tracking-wide text-tertiary">Status</h3>
      <Segmented value={f.status} onChange={(v) => set({ status: v })} options={DOC_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />

      <Group title="File" footer="Photos and PDFs are stored on this device and work offline.">
        {f.fileId ? (
          <>
            <button onClick={() => setViewing(true)} className="tap w-full flex items-center gap-3 px-4 min-h-[52px] border-b hairline text-accent text-[17px]"><Eye size={20} strokeWidth={SW} /> View {f.fileName ? <span className="text-tertiary text-[14px] truncate">{f.fileName}</span> : 'file'}</button>
            <button onClick={() => fileRef.current?.click()} className="tap w-full flex items-center gap-3 px-4 min-h-[52px] border-b hairline text-accent text-[17px]"><Upload size={20} strokeWidth={SW} /> Replace</button>
            <button onClick={removeFile} className="tap w-full flex items-center gap-3 px-4 min-h-[52px] text-danger text-[17px]"><MinusCircle size={20} strokeWidth={SW} /> Remove file</button>
          </>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="tap w-full flex items-center gap-3 px-4 min-h-[52px] text-accent text-[17px]">
            <Upload size={20} strokeWidth={SW} /> {busy ? 'Saving…' : 'Add photo or PDF'}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
      </Group>

      <Group title="Notes">
        <textarea className={inputCls + ' px-4 min-h-[80px] resize-none'} value={f.notes || ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Anything to remember" />
      </Group>

      {editing && <PrimaryButton tone="danger" className="mt-6" onClick={del}><span className="inline-flex items-center gap-2"><Trash2 size={18} strokeWidth={SW} /> Delete Document</span></PrimaryButton>}
      <FileViewer open={viewing} onClose={() => setViewing(false)} fileId={f.fileId} title={f.title || DOC_LABEL[f.type] || 'Document'} />
    </Sheet>
  );
}

function EmergencySheet({ trip, open, onClose }) {
  const { updateTrip } = useStore();
  const [e, setE] = useState(trip.emergency);
  useEffect(() => { if (open) setE(structuredClone(trip.emergency)); }, [open]); // eslint-disable-line
  const setC = (id, p) => setE((x) => ({ ...x, contacts: x.contacts.map((c) => (c.id === id ? { ...c, ...p } : c)) }));
  const save = () => {
    updateTrip(trip.id, (t) => { t.emergency = { ...e, contacts: e.contacts.filter((c) => c.name.trim() || c.phone.trim()) }; });
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Emergency Card" right={<TextButton bold onClick={save}>Save</TextButton>}>
      <Group title="Contacts" className="mt-3">
        {e.contacts.map((c) => (
          <div key={c.id} className="flex items-center pl-2 border-b hairline">
            <button aria-label="Remove contact" onClick={() => setE((x) => ({ ...x, contacts: x.contacts.filter((y) => y.id !== c.id) }))} className="press h-11 w-10 flex items-center justify-center text-danger"><MinusCircle size={20} strokeWidth={SW} /></button>
            <div className="flex-1 min-w-0">
              <input className={inputCls + ' border-b hairline'} value={c.name} onChange={(ev) => setC(c.id, { name: ev.target.value })} placeholder="Name and relation" />
              <input className={inputCls} type="tel" value={c.phone} onChange={(ev) => setC(c.id, { phone: ev.target.value })} placeholder="Phone" />
            </div>
          </div>
        ))}
        <button onClick={() => setE((x) => ({ ...x, contacts: [...x.contacts, { id: uid(), name: '', phone: '' }] }))} className="tap w-full flex items-center gap-2 px-4 min-h-[48px] text-accent text-[17px]"><Plus size={20} strokeWidth={SW} /> Add contact</button>
      </Group>
      <Group title="Health">
        <Field label="Blood type"><input className={inputCls} value={e.bloodType} onChange={(ev) => setE({ ...e, bloodType: ev.target.value })} placeholder="e.g. O+" /></Field>
        <Field label="Medical" last><input className={inputCls} value={e.medical} onChange={(ev) => setE({ ...e, medical: ev.target.value })} placeholder="Allergies, conditions" /></Field>
      </Group>
      <Group title="Embassy">
        <Field label="Name"><input className={inputCls} value={e.embassy.name} onChange={(ev) => setE({ ...e, embassy: { ...e.embassy, name: ev.target.value } })} placeholder="Embassy or consulate" /></Field>
        <Field label="Phone"><input type="tel" className={inputCls} value={e.embassy.phone} onChange={(ev) => setE({ ...e, embassy: { ...e.embassy, phone: ev.target.value } })} placeholder="Phone" /></Field>
        <Field label="Address" last><input className={inputCls} value={e.embassy.address} onChange={(ev) => setE({ ...e, embassy: { ...e.embassy, address: ev.target.value } })} placeholder="Address" /></Field>
      </Group>
    </Sheet>
  );
}
