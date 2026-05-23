import React, { useEffect, useState } from 'react';
import OutputModal from './OutputModal';
import '../styles/ToastManager.css';

function ToastManager() {
  const [toasts, setToasts] = useState([]);
  const [activeToast, setActiveToast] = useState(null);

  useEffect(() => {
    const handler = (ev) => {
      const { message, detail } = ev.detail || {};
      const id = Math.random().toString(36).slice(2, 9);
      const t = { id, message: message || 'Notification', detail: detail || '' };
      setToasts((s) => [t, ...s]);
      // auto remove
      setTimeout(() => {
        setToasts((s) => s.filter((x) => x.id !== id));
      }, 6000);
    };

    window.addEventListener('app:toast', handler);
    return () => window.removeEventListener('app:toast', handler);
  }, []);

  const handleClick = (toast) => {
    setActiveToast(toast);
  };

  return (
    <>
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="toast-item" onClick={() => handleClick(t)}>
            {t.message}
          </div>
        ))}
      </div>
      {activeToast && (
        <OutputModal
          response={{ error: activeToast.detail || activeToast.message, status: 0, responseTime: 0 }}
          onClose={() => setActiveToast(null)}
        />
      )}
    </>
  );
}

export default ToastManager;
