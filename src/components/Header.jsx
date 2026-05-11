import React, { useState } from 'react';
import useStore from '../store';
import { FiLogOut, FiWifi, FiGithub, FiCloud, FiRefreshCcw, FiPower, FiShuffle, FiLayers, FiSettings, FiZap, FiPlay, FiTrash2 } from 'react-icons/fi';
import BackendStatus from './BackendStatus';
import '../styles/Header.css';

function Header({ onThemeChange, currentTheme }) {
  const [pinging, setPinging] = useState(false);
  const [pingStatus, setPingStatus] = useState(null);
  
  const { user, logoutUser, serverUrl, setServerUrl, clearResponseHistory, shuffleAPIs, toggleComparisonMode, comparisonMode } = useStore(
    (state) => ({
      user: state.user,
      logoutUser: state.logoutUser,
      serverUrl: state.serverUrl,
      setServerUrl: state.setServerUrl,
      clearResponseHistory: state.clearResponseHistory,
      shuffleAPIs: state.shuffleAPIs,
      toggleComparisonMode: state.toggleComparisonMode,
      comparisonMode: state.comparisonMode,
    })
  );

  const handleLogout = async () => {
    if (window.electronAPI && window.electronAPI.saveUser) {
      await window.electronAPI.saveUser(null);
    }
    logoutUser();
  };

  const handleGitHubAuth = async () => {
    // Placeholder for GitHub authentication
    alert('GitHub authentication coming soon!');
  };

  const handleGoogleAuth = async () => {
    // Placeholder for Google authentication
    alert('Google authentication coming soon!');
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

  const handleRunAutomation = () => {
    showActionToast('Automation runner coming soon.');
  };

  const handleResetLayout = () => {
    window.dispatchEvent(new Event('reset-layout'));
  };

  const handleRestartServer = async () => {
    if (window.electronAPI?.restartBackend) {
      await window.electronAPI.restartBackend();
      alert('Backend server restart requested');
    } else {
      alert('Restart backend API unavailable');
    }
  };

  const handleStopServer = async () => {
    if (window.electronAPI?.stopBackend) {
      await window.electronAPI.stopBackend();
      alert('Backend server stop requested');
    } else {
      alert('Stop backend API unavailable');
    }
  };

  const handleClearHistory = () => {
    clearResponseHistory();
    alert('Response history cleared');
  };

  const showActionToast = (message) => {
    if (window.electronAPI?.showToast) {
      window.electronAPI.showToast(message);
    } else {
      console.log(message);
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
        <div className="header-actions">
          <button className="header-action-btn" onClick={handleRunAutomation} title="Run automation workflows">
            <FiPlay size={16} />
            Run Automation
          </button>
          <button className="header-action-btn" onClick={handleResetLayout} title="Reset layout">
            <FiRefreshCcw size={16} />
            Reset Layout
          </button>
          <button className="header-action-btn" onClick={handleClearHistory} title="Clear all history">
            <FiTrash2 size={16} />
            Clear History
          </button>
          <button className="header-action-btn" onClick={() => window.electronAPI?.reloadApp()} title="Reload development environment">
            <FiRefreshCcw size={16} />
            Dev Reload
          </button>
          <button className="header-action-btn" onClick={handleRestartServer} title="Restart backend server">
            <FiPower size={16} />
            Restart Server
          </button>
          <button className="header-action-btn" onClick={handleStopServer} title="Stop backend server">
            <FiPower size={16} />
            Stop Server
          </button>
        </div>
      </div>

      <div className="header-right">
        <BackendStatus />
        
        <div className="cloud-auth">
          <button
            className="header-btn cloud-btn"
            onClick={handleGitHubAuth}
            title="Connect with GitHub"
          >
            <FiGithub size={18} />
          </button>
          <button
            className="header-btn cloud-btn"
            onClick={handleGoogleAuth}
            title="Connect with Google"
          >
            <FiCloud size={18} />
          </button>
        </div>
        
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
          onClick={() => shuffleAPIs()}
          title="Shuffle API collections"
        >
          <FiShuffle size={18} />
        </button>

        <button
          className={`header-btn ${comparisonMode ? 'active' : ''}`}
          onClick={() => toggleComparisonMode()}
          title="Toggle response comparison"
        >
          <FiLayers size={18} />
        </button>

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
