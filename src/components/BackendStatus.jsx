import React, { useEffect, useState } from 'react';
import '../styles/BackendStatus.css';

function BackendStatus() {
  const [backendInfo, setBackendInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBackendInfo = async () => {
      try {
        if (window.electronAPI && window.electronAPI.getBackendInfo) {
          const info = await window.electronAPI.getBackendInfo();
          setBackendInfo(info);
        }
      } catch (error) {
        console.error('Failed to get backend info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBackendInfo();

    // Refresh every 30 seconds
    const interval = setInterval(fetchBackendInfo, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !backendInfo) {
    return null;
  }

  return (
    <div className={`backend-status ${backendInfo.status}`}>
      <div className="status-indicator"></div>
      <span className="status-text">
        Backend: {backendInfo.status === 'running' ? `Port ${backendInfo.port}` : 'Offline'}
      </span>
    </div>
  );
}

export default BackendStatus;
