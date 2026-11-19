import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useStore } from './store.jsx';
import { Toaster } from './ui.jsx';
import Home from './screens/Home.jsx';
import Settings from './screens/Settings.jsx';
import Trip from './screens/Trip.jsx';

const NavCtx = createContext(null);
export const useNav = () => useContext(NavCtx);

function useTheme(appearance) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = appearance === 'dark' || (appearance === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#000000' : '#C81E63'));
    };
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, [appearance]);
}

export default function App() {
  const { ready, settings } = useStore();
  const [stack, setStack] = useState([{ name: 'home' }]);
  const [dir, setDir] = useState('none');
  useTheme(settings.appearance);

  const push = useCallback((screen) => {
    setDir('push');
    setStack((s) => [...s, screen]);
    history.pushState({ depth: Date.now() }, '');
  }, []);
  const pop = useCallback(() => {
    if (history.state?.depth) history.back();
    else { setDir('pop'); setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)); }
  }, []);
  const replaceTop = useCallback((patch) => setStack((s) => [...s.slice(0, -1), { ...s[s.length - 1], ...patch }]), []);

  useEffect(() => {
    const onPop = () => { setDir('pop'); setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [stack.length]);

  if (!ready) return <div className="min-h-full bg-bg" />;
  const top = stack[stack.length - 1];
  const key = `${stack.length}-${top.name}-${top.id || ''}`;
  const anim = dir === 'push' ? 'anim-push' : dir === 'pop' ? 'anim-pop' : '';

  return (
    <NavCtx.Provider value={{ push, pop, replaceTop, top }}>
      <div key={key} className={`min-h-full bg-bg ${anim}`}>
        {top.name === 'home' && <Home />}
        {top.name === 'settings' && <Settings />}
        {top.name === 'trip' && <Trip id={top.id} tab={top.tab || 'overview'} />}
      </div>
      <Toaster />
    </NavCtx.Provider>
  );
}
