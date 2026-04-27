import React from 'react';
import useStore from '../store';
import { FiLogOut, FiMenu, FiPlay, FiSettings } from 'react-icons/fi';
import '../styles/Header.css';

function Header({ onThemeChange, currentTheme }) {
  const { user, logoutUser, serverUrl, setServerUrl, runBatchTests } = useStore(
    (state) => ({
      user: state.user,
      logoutUser: state.logoutUser,
      serverUrl: state.serverUrl,
      setServerUrl: state.setServerUrl,
      apis: state.apis,
      isBatchTesting: state.isBatchTesting,
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
    if (window.electronAPI && window.electronAPI.saveCollections) {
      // Could save server config here
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
            placeholder="http://localhost:3000"
            className="url-input"
          />
        </div>
      </div>

      <div className="header-right">
        <div className="user-info">
          <span className="user-email">{user?.email}</span>
        </div>

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
