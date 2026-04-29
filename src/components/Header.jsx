import React, { useState } from 'react';
import useStore from '../store';
import { FiLogOut, FiWifi } from 'react-icons/fi';
import BackendStatus from './BackendStatus';
import '../styles/Header.css';

function Header({ onThemeChange, currentTheme }) {
  const [pinging, setPinging] = useState(false);
  const [pingStatus, setPingStatus] = useState(null);
  
  const { user, logoutUser, serverUrl, setServerUrl } = useStore(
    (state) => ({
      user: state.user,
      logoutUser: state.logoutUser,
      serverUrl: state.serverUrl,
      setServerUrl: state.setServerUrl,
    })
  );

  const handleLogout = async () => {
    if (window.electronAPI && window.electronAPI.saveUser) {
      await window.electronAPI.saveUser(null);
    }
    logoutUser();
  };

  const handleServerUrlChange = (e) => {
    const newUrl = e.target.value;
    setServerUrl(newUrl);
    setPingStatus(null);
    if (window.electronAPI && window.electronAPI.saveCollections) {
      // Could save server config here
    }
  };

  const handlePing = async () => {
    if (!serverUrl.trim()) {
      alert('Please enter a server URL');
      return;
    }

    setPinging(true);
    setPingStatus(null);

    try {
      const result = await window.electronAPI.pingServer(serverUrl);
      if (result.success) {
        setPingStatus({
          type: 'success',
          message: `✓ Connected (${result.responseTime}ms)`,
        });
      } else {
        setPingStatus({
          type: 'error',
          message: `✗ Connection failed: ${result.error}`,
        });
      }
    } catch (error) {
      setPingStatus({
        type: 'error',
        message: `✗ Error: ${error.message}`,
      });
    } finally {
      setPinging(false);
      setTimeout(() => setPingStatus(null), 5000);
    }
  };

  return (
    <header className="header glass">
      <div className="header-left">
        <div className="logo-section">
          <div className="logo-icon">🚀</div>
          <span className="logo-text">API Checker</span>
        </div>
      </div>

      <div className="header-center">
        <div className="server-url-input">
          <label>Base URL:</label>
          <input
            type="text"
            value={serverUrl}
            onChange={handleServerUrlChange}
            placeholder="http://192.168.4.1"
            className="url-input"
          />
        </div>
      </div>

      <div className="header-right">
        <BackendStatus />
        
        <div className="user-info">
          <span className="user-email">{user?.email}</span>
        </div>

        <button
          className={`header-btn ping-btn ${pingStatus?.type}`}
          onClick={handlePing}
          disabled={pinging}
          title="Test server connectivity"
        >
          {pinging ? <FiWifi size={18} className="spinning" /> : <FiWifi size={18} />}
        </button>
        {pingStatus && (
          <span className={`ping-status ${pingStatus.type}`}>
            {pingStatus.message}
          </span>
        )}

        <button
          className="header-btn"
          onClick={() => onThemeChange(currentTheme === 'dark' ? 'light' : 'dark')}
          title="Toggle theme"
        >
          {currentTheme === 'dark' ? '☀️' : '🌙'}
        </button>

        <button
          className="header-btn logout-btn"
          onClick={handleLogout}
          title="Logout"
        >
          <FiLogOut size={18} />
        </button>
      </div>
    </header>
  );
}

export default Header;
