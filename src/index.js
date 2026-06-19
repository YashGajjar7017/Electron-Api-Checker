import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './App';

// Silence ResizeObserver loop errors to prevent dev server overlays
if (typeof window !== 'undefined') {
  const resizeObserverErrorHandler = (e) => {
    if (e && (e.message === 'ResizeObserver loop completed with undelivered notifications' || 
              e.message === 'ResizeObserver loop limit exceeded' ||
              e.message?.includes('ResizeObserver'))) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  };
  window.addEventListener('error', resizeObserverErrorHandler);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
