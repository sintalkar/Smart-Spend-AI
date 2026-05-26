/// <reference types="vite/client" />
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handler to catch [object Object] and log them properly
window.addEventListener('error', (event) => {
  const error = event.error;
  if (error && typeof error === 'object') {
    console.warn('[Global Error Object]', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
  } else {
    console.warn('[Global Error]', error || event.message);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (reason instanceof Error) {
    console.warn('[Unhandled Rejection Error]', reason.message, reason.stack);
  } else if (reason && typeof reason === 'object') {
    console.warn('[Unhandled Rejection Object]', JSON.stringify(reason, Object.getOwnPropertyNames(reason), 2));
  } else {
    console.warn('[Unhandled Rejection]', reason);
  }
});

// Capture browser's default install prompt and prevent it
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as any).deferredInstallPrompt = e;
  window.dispatchEvent(new CustomEvent('pwa-install-prompt-available'));
});

// Only register the generated service worker in production builds.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => console.log('[PWA] Service Worker registered successfully scope:', reg.scope))
      .catch((err) => console.error('[PWA] Service Worker registration failed:', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
