import { useState } from 'react';
import { CheckCircle2, Circle, Ellipsis, Luggage, MinusCircle, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Card, Chip, Empty, Field, Group, Header, IconButton, PrimaryButton, ProgressBar, Sheet, SW, TextButton, cx, inputCls, toast } from '../ui.jsx';
import { useStore } from '../store.jsx';
import { BackButton } from './Trip.jsx';
import { PACK_CATS, packingSuggestions, seasonLabel } from '../lib/logic.js';
import { PACK_META } from '../meta.jsx';
import { nights } from '../lib/dates.js';
import { uid } from '../lib/db.js';

export default function Packing({ trip }) {
  const { updateTrip } = useStore();
  const [filter, setFilter] = useState('All');
  const [edit, setEdit] = useState(false);
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);
  const [showAllSug, setShowAllSug] = useState(false);

  const items = trip.packing;
  const packed = items.filter((i) => i.packed).length;
  const pct = items.length ? (packed / items.length) * 100 : 0;
  const shown = filter === 'All' ? items : items.filter((i) => i.cat === filter);
  const suggestions = packingSuggestions(trip).filter((s) => filter === 'All' || s.cat === filter);

  const toggle = (id) => updateTrip(trip.id, (t) => { const i = t.packing.find((x) => x.id === id); i.packed = !i.packed; });
  const remove = (id) => updateTrip(trip.id, (t) => { t.packing = t.packing.filter((x) => x.id !== id); });
  const add = (name, cat) => updateTrip(trip.id, (t) => { t.packing.push({ id: uid(), name, cat, packed: false }); });

  const groups = filter === 'All' ? PACK_CATS.map((c) => [c, shown.filter((i) => i.cat === c)]).filter(([, l]) => l.length) : [[filter, shown]];

  return (
    <div>
      <Header
        left={<BackButton />}
        right={<>
          {items.length > 0 && <TextButton onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Edit'}</TextButton>}
          <IconButton icon={Ellipsis} label="Templates" onClick={() => setMenu(true)} />
          <IconButton icon={Plus} label="Add item" onClick={() => setAdding(true)} />
        </>}
        title="Packing"
      />
      <div className="px-4">
        <Card className="mt-3 p-4">
          <div className="flex items-baseline justify-between">
            <div className="text-[17px] font-semibold">{packed} of {items.length} packed</div>
            <div className={cx('text-[15px] font-semibold tabular-nums', pct === 100 ? 'text-ok' : 'text-tertiary')}>{Math.round(pct)}%</div>
          </div>
          <ProgressBar pct={pct} tone={pct === 100 ? 'ok' : 'accent'} className="mt-2.5" />
        </Card>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 mt-4">
        {['All', ...PACK_CATS].map((c) => <Chip key={c} active={filter === c} onClick={() => setFilter(c)} icon={PACK_META[c]}>{c}</Chip>)}
      </div>

      <div className="px-4">
        {groups.map(([cat, list]) => (
          <section key={cat} className="mt-5">
            <h2 className="px-4 pb-1.5 text-[13px] uppercase tracking-wide text-tertiary">{cat} · {list.filter((i) => i.packed).length}/{list.length}</h2>
            <div className="bg-card rounded-card overflow-hidden">
              {list.map((i, k) => (
                <div key={i.id} className="flex items-center pl-2 min-h-[48px]">
                  {edit ? (
                    <button aria-label="Delete item" onClick={() => remove(i.id)} className="press h-11 w-11 flex items-center justify-center text-danger"><MinusCircle size={22} strokeWidth={SW} /></button>
                  ) : null}
                  <button onClick={() => !edit && toggle(i.id)} className={cx('flex-1 flex items-center min-h-[48px] text-left', !edit && 'tap')} aria-pressed={i.packed}>
                    {!edit && (
                      <span className="h-11 w-11 flex items-center justify-center shrink-0">
                        {i.packed ? <CheckCircle2 size={24} strokeWidth={SW} className="text-ok" /> : <Circle size={24} strokeWidth={1.5} className="text-tertiary/70" />}
                      </span>
                    )}
                    <span className={cx('flex-1 text-[17px] py-3 pr-4 self-stretch flex items-center', k < list.length - 1 && 'border-b hairline', i.packed && 'line-through text-tertiary')}>{i.name}</span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
        {!shown.length && <Empty icon={Luggage} text={items.length ? `Nothing in ${filter} yet. Tap + or a suggestion to add.` : 'Your list is empty. Tap + or pick a suggestion below.'} />}

        {suggestions.length > 0 && (
          <section className="mt-7">
            <h2 className="px-4 pb-2 text-[13px] uppercase tracking-wide text-tertiary flex items-center gap-1.5">
              <Sparkles size={14} strokeWidth={SW} /> Suggested for {nights(trip)} nights {seasonLabel(trip)}
            </h2>
            <div className="flex flex-wrap gap-2">
              {(showAllSug ? suggestions : suggestions.slice(0, 10)).map((s) => (
                <button key={s.name} onClick={() => add(s.name, s.cat)} className="press min-h-[36px] rounded-full bg-card px-3.5 text-[15px] flex items-center gap-1.5">
                  <Plus size={15} strokeWidth={2} className="text-accent" /> {s.name}
                </button>
              ))}
              {suggestions.length > 10 && (
                <button onClick={() => setShowAllSug(!showAllSug)} className="press min-h-[36px] px-3 text-[15px] text-accent">{showAllSug ? 'Fewer' : `${suggestions.length - 10} more`}</button>
              )}
            </div>
          </section>
        )}
      </div>

      <AddItemSheet open={adding} onClose={() => setAdding(false)} defaultCat={filter === 'All' ? 'Clothes' : filter} onAdd={add} />
      <TemplateSheet open={menu} onClose={() => setMenu(false)} trip={trip} />
    </div>
  );
}

function AddItemSheet({ open, onClose, defaultCat, onAdd }) {
  const [name, setName] = useState('');
  const [cat, setCat] = useState(defaultCat);
  const [count, setCount] = useState(0);
  const submit = (keepOpen) => {
    const n = name.trim();
    if (!n) return;
    onAdd(n, cat);
    setName('');
    setCount((c) => c + 1);
    if (!keepOpen) onClose();
  };
  return (
    <Sheet open={open} onClose={() => { setCount(0); onClose(); }} title="Add Item" right={<TextButton bold disabled={!name.trim()} onClick={() => submit(false)}>Add</TextButton>}>
      <form onSubmit={(e) => { e.preventDefault(); submit(true); }}>
        <Group className="mt-3">
          <Field label="Item" last><input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rain jacket" enterKeyHint="next" /></Field>
        </Group>
      </form>
      <div className="flex flex-wrap gap-2 mt-4">
        {PACK_CATS.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)} icon={PACK_META[c]}>{c}</Chip>)}
      </div>
      <p className="text-[13px] text-tertiary mt-4 px-1">{count ? `${count} added. Press return to add another.` : 'Press return to add several items in a row.'}</p>
    </Sheet>
  );
}

function TemplateSheet({ open, onClose, trip }) {
  const { settings, setSettings, updateTrip } = useStore();
  const [name, setName] = useState('');
  const save = () => {
    if (!trip.packing.length) return toast('Add some items first');
    const n = name.trim() || `${trip.name} list`;
    setSettings((s) => ({ ...s, templates: [...s.templates, { id: uid(), name: n, items: trip.packing.map(({ name, cat }) => ({ name, cat })) }] }));
    setName('');
    toast('Template saved');
  };
  const use = (tpl) => {
    let added = 0;
    updateTrip(trip.id, (t) => {
      const have = new Set(t.packing.map((p) => p.name.toLowerCase()));
      for (const it of tpl.items) if (!have.has(it.name.toLowerCase())) { t.packing.push({ id: uid(), name: it.name, cat: it.cat, packed: false }); added++; }
    });
    toast(`Template applied`);
    onClose();
  };
  const del = (id) => setSettings((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== id) }));
  const clearPacked = () => { updateTrip(trip.id, (t) => { t.packing.forEach((p) => (p.packed = false)); }); toast('All items unticked'); onClose(); };

  return (
    <Sheet open={open} onClose={onClose} title="Templates" left={null} right={<TextButton bold onClick={onClose}>Done</TextButton>}>
      <Group title="Save this list" className="mt-3" footer="Reuse this packing list on your next trip.">
        <Field label="Name" last><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={`${trip.name} list`} /></Field>
      </Group>
      <PrimaryButton className="mt-3" onClick={save} disabled={!trip.packing.length}>Save as Template</PrimaryButton>

      <Group title="Your templates">
        {settings.templates.length === 0 && <p className="p-4 text-[15px] text-tertiary">No templates yet. Save a list above to reuse it.</p>}
        {settings.templates.map((t, i) => (
          <div key={t.id} className={cx('flex items-center pl-4 min-h-[56px]', i < settings.templates.length - 1 && 'border-b hairline')}>
            <div className="flex-1 min-w-0">
              <div className="text-[17px] truncate">{t.name}</div>
              <div className="text-[13px] text-tertiary">{t.items.length} items</div>
            </div>
            <button onClick={() => use(t)} className="press min-h-[44px] px-3 text-accent text-[15px] font-semibold">Use</button>
            <button aria-label="Delete template" onClick={() => del(t.id)} className="press h-11 w-11 flex items-center justify-center text-danger"><Trash2 size={18} strokeWidth={SW} /></button>
          </div>
        ))}
      </Group>

      {trip.packing.some((p) => p.packed) && (
        <button onClick={clearPacked} className="press mt-6 w-full min-h-[50px] rounded-[14px] bg-card text-accent text-[17px]">Untick all items</button>
      )}
    </Sheet>
  );
}
