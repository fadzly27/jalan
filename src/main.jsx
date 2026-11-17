import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { StoreProvider } from './store.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StoreProvider>
    <App />
  </StoreProvider>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
