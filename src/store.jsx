import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { db, uid } from './lib/db.js';
import { makeSampleTrip } from './lib/sample.js';
import { dataURLToBlob, readAsDataURL, downloadBlob } from './lib/files.js';

const DEFAULT_SETTINGS = {
  homeCurrency: 'MYR',
  appearance: 'system',
  pinHash: null,
  lastBackup: null,
  recentCurrencies: [],
  dismissed: {},
  templates: [],
  live: null,
  sampleCleared: false,
};

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }) {
  const [trips, setTrips] = useState([]);
  const [settings, setSettingsState] = useState(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const tripsRef = useRef(trips);
  tripsRef.current = trips;

  useEffect(() => {
    (async () => {
      let s = { ...DEFAULT_SETTINGS, ...((await db.get('settings')) || {}) };
      let t = await db.allTrips();
      const seeded = await db.get('seeded');
      if (!seeded && t.length === 0) {
        const sample = makeSampleTrip(s.homeCurrency);
        await db.putTrip(sample);
        await db.set('seeded', true);
        t = [sample];
      }
      setTrips(t);
      setSettingsState(s);
      setReady(true);
    })();
  }, []);

  const setSettings = useCallback((fn) => {
    setSettingsState((prev) => {
      const next = typeof fn === 'function' ? fn(prev) : { ...prev, ...fn };
      db.set('settings', next);
      return next;
    });
  }, []);

  const addTrip = useCallback(async (trip) => {
    await db.putTrip(trip);
    setTrips((t) => [...t, trip]);
  }, []);

  // updater receives a deep copy of the trip and may mutate it.
  const updateTrip = useCallback((id, updater) => {
    setTrips((list) =>
      list.map((t) => {
        if (t.id !== id) return t;
        const draft = structuredClone(t);
        const res = updater(draft);
        const next = res || draft;
        db.putTrip(next);
        return next;
      })
    );
  }, []);

  const updateTrips = useCallback((ids, updater) => {
    for (const id of ids) updateTrip(id, updater);
  }, [updateTrip]);

  const deleteTrip = useCallback(async (id) => {
    const trip = tripsRef.current.find((t) => t.id === id);
    if (trip) {
      const fileIds = [...trip.docs.map((d) => d.fileId), ...trip.expenses.map((e) => e.receiptId)].filter(Boolean);
      for (const f of fileIds) await db.deleteFile(f);
    }
    await db.deleteTrip(id);
    setTrips((t) => t.filter((x) => x.id !== id));
  }, []);

  const saveFile = useCallback(async (blob) => {
    const id = uid();
    await db.putFile(id, blob);
    return id;
  }, []);
  const deleteFile = useCallback((id) => id && db.deleteFile(id), []);
  const getFile = useCallback((id) => db.getFile(id), []);

  const dismiss = useCallback((rid) => setSettings((s) => ({ ...s, dismissed: { ...s.dismissed, [rid]: Date.now() } })), [setSettings]);

  const pushRecentCurrency = useCallback((code) => {
    setSettings((s) => ({ ...s, recentCurrencies: [code, ...s.recentCurrencies.filter((c) => c !== code)].slice(0, 6) }));
  }, [setSettings]);

  // ----- live rates (cached for offline use) -----
  const refreshRates = useCallback(async (force = false) => {
    const s = settingsRef.current;
    const home = s.homeCurrency;
    if (!force && s.live && s.live.base === home && Date.now() - s.live.time < 6 * 3600000) return true;
    if (!navigator.onLine) return false;
    try {
      let rates, time;
      try {
        const r = await fetch(`https://open.er-api.com/v6/latest/${home}`);
        const j = await r.json();
        if (j.result !== 'success') throw new Error('bad');
        rates = j.rates;
        time = Date.now();
      } catch {
        const r = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${home.toLowerCase()}.json`);
        const j = await r.json();
        const raw = j[home.toLowerCase()];
        rates = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toUpperCase(), v]));
        time = Date.now();
      }
      setSettings((p) => ({ ...p, live: { base: home, rates, time } }));
      return true;
    } catch {
      return false;
    }
  }, [setSettings]);

  useEffect(() => {
    if (!ready) return;
    refreshRates();
    const on = () => refreshRates();
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [ready, settings.homeCurrency, refreshRates]);

  // ----- sample data -----
  const clearSample = useCallback(async () => {
    for (const t of tripsRef.current.filter((x) => x.sample)) await deleteTrip(t.id);
    setSettings((s) => ({ ...s, sampleCleared: true }));
  }, [deleteTrip, setSettings]);

  const loadSample = useCallback(async () => {
    const t = makeSampleTrip(settingsRef.current.homeCurrency);
    await addTrip(t);
    setSettings((s) => ({ ...s, sampleCleared: false }));
  }, [addTrip, setSettings]);

  // ----- backup -----
  const exportAll = useCallback(async () => {
    const files = {};
    const keys = await db.allFileKeys();
    for (const k of keys) {
      const b = await db.getFile(k);
      if (b) files[k] = await readAsDataURL(b);
    }
    const s = { ...settingsRef.current, lastBackup: Date.now() };
    const data = { app: 'jalan', version: 1, exportedAt: new Date().toISOString(), settings: s, trips: tripsRef.current, files };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const name = `jalan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([blob], name, { type: 'application/json' });
    let shared = false;
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
      try { await navigator.share({ files: [file], title: 'Jalan backup' }); shared = true; } catch (e) { if (e.name === 'AbortError') return false; }
    }
    if (!shared) downloadBlob(blob, name);
    setSettings((p) => ({ ...p, lastBackup: Date.now() }));
    return true;
  }, [setSettings]);

  const importAll = useCallback(async (file) => {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.app !== 'jalan' || !Array.isArray(data.trips)) throw new Error('This file is not a Jalan backup.');
    await db.clearTrips();
    await db.clearFiles();
    for (const [k, url] of Object.entries(data.files || {})) await db.putFile(k, await dataURLToBlob(url));
    for (const t of data.trips) await db.putTrip(t);
    await db.set('seeded', true);
    const s = { ...DEFAULT_SETTINGS, ...data.settings };
    await db.set('settings', s);
    setTrips(data.trips);
    setSettingsState(s);
    setUnlocked(false);
  }, []);

  const value = useMemo(
    () => ({
      ready, trips, settings, setSettings, addTrip, updateTrip, updateTrips, deleteTrip,
      saveFile, deleteFile, getFile, dismiss, pushRecentCurrency, refreshRates,
      clearSample, loadSample, exportAll, importAll, unlocked, setUnlocked,
    }),
    [ready, trips, settings, setSettings, addTrip, updateTrip, updateTrips, deleteTrip, saveFile, deleteFile, getFile, dismiss, pushRecentCurrency, refreshRates, clearSample, loadSample, exportAll, importAll, unlocked]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
