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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
