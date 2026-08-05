import React, { useState, useEffect } from 'react';
import useStore from '../store';
import { FiLogOut, FiWifi, FiGithub, FiSettings, FiActivity, FiShield } from 'react-icons/fi';
import BackendStatus from './BackendStatus';
import GitHubSignup from './GitHubSignup';
import '../styles/Header.css';

const ROLE_SELECT_OPTIONS = [
  { id: 'viewer',   label: 'Viewer' },
  { id: 'operator', label: 'Operator' },
  { id: 'sysadmin', label: 'Sys Admin' },
  { id: 'secadmin', label: 'Sec Admin' },
];

function Header({ onThemeChange, currentTheme, onOpenSettings, onOpenSystemMonitor }) {
  const [pinging, setPinging] = useState(false);
  const [pingStatus, setPingStatus] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  
  const { 
    user, 
    logoutUser, 
    serverUrl, 
    setServerUrl, 
    environments,
    activeEnvironment,
    setActiveEnvironment,
    updateEnvironment,
    sessionToken,
    sessionTokenExpiry,
    securityRole,
    setSecurityRole,
    clearResponseHistory,
  } = useStore(
    (state) => ({
      user: state.user,
      logoutUser: state.logoutUser,
      serverUrl: state.serverUrl,
      setServerUrl: state.setServerUrl,
      environments: state.environments,
      activeEnvironment: state.activeEnvironment,
      setActiveEnvironment: state.setActiveEnvironment,
      updateEnvironment: state.updateEnvironment,
      sessionToken: state.sessionToken,
      sessionTokenExpiry: state.sessionTokenExpiry,
      securityRole: state.securityRole,
      setSecurityRole: state.setSecurityRole,
      clearResponseHistory: state.clearResponseHistory,
    })
  );

  const roleColors = {
    viewer:   '#3b82f6',
    operator: '#f59e0b',
    sysadmin: '#10b981',
    secadmin: '#8b5cf6',
  };
  const roleColor = securityRole ? roleColors[securityRole] : 'var(--primary)';

  useEffect(() => {
    const updateTimeLeft = () => {
      if (sessionToken && sessionTokenExpiry) {
        const remaining = sessionTokenExpiry - Date.now();
        if (remaining > 0) {
          const minutes = Math.floor(remaining / 60000);
          const seconds = Math.floor((remaining % 60000) / 1000);
          setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
          return;
        }
      }
      setTimeLeft('');
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [sessionToken, sessionTokenExpiry]);

  const activeEnvObj = environments?.find((env) => env.id === activeEnvironment) || environments?.[0];
  const currentBaseUrl = activeEnvObj ? activeEnvObj.baseUrl : serverUrl;
  

  
  const handleLogout = async () => {
  if (window.electronAPI && window.electronAPI.saveUser) {
      await window.electronAPI.saveUser(null);
    }
    logoutUser();
  };

  const [showSignup, setShowSignup] = React.useState(false);

  const handleServerUrlChange = (e) => {
    const newUrl = e.target.value;
    if (activeEnvObj) {
      updateEnvironment(activeEnvObj.id, { baseUrl: newUrl });
    } else {
      setServerUrl(newUrl);
    }
    setPingStatus(null);
  };

  const handlePing = async () => {
    const urlToPing = currentBaseUrl;
    if (!urlToPing.trim()) {
      alert('Please enter a server URL');
      return;
    }

    if (!window.electronAPI || typeof window.electronAPI.pingServer !== 'function') {
      setPingStatus({
        type: 'error',
        message: 'Ping is unavailable in this environment.',
      });
      return;
    }

    setPinging(true);
    setPingStatus(null);

    try {
      const result = await window.electronAPI.pingServer(urlToPing);
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
          {/* 1. Environment selector */}
          <label htmlFor="env-select">Env:</label>
          <select
            id="env-select"
            className="env-select"
            value={activeEnvironment}
            onChange={(e) => setActiveEnvironment(e.target.value)}
          >
            {environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>

          {/* 2. Base URL — right after env */}
          <label htmlFor="base-url-input">Base URL:</label>
          <input
            id="base-url-input"
            type="text"
            value={currentBaseUrl}
            onChange={handleServerUrlChange}
            placeholder="http://localhost:3000"
            className="url-input"
          />

          {/* 3. Security Auth Role — AFTER URL */}
          <div className="header-auth-divider" />
          <label htmlFor="security-role-select" style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
            <FiShield size={12} style={{ color: roleColor }} /> Auth:
          </label>
          <select
            id="security-role-select"
            className="env-select"
            value={securityRole || ''}
            onChange={(e) => setSecurityRole(e.target.value)}
            style={{ borderColor: roleColor, color: roleColor, fontWeight: '600' }}
          >
            {ROLE_SELECT_OPTIONS.map(r => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* <div className="header-actions">
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
        </div> */}
      </div>

      <div className="header-right">
        <BackendStatus />

        {/* Session token indicator — shown when a session token is active */}
        {sessionToken && timeLeft && (
          <div title={`Session active — expires in ${timeLeft}`} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '8px',
            background: 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(16,185,129,0.3)',
            fontSize: '11px',
            fontWeight: '600',
            color: '#10b981',
            whiteSpace: 'nowrap',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', display: 'inline-block' }} />
            {timeLeft}
          </div>
        )}

        <button
          className="header-btn system-monitor-btn"
          onClick={() => onOpenSystemMonitor?.()}
          title="Open system monitor"
        >
          <FiActivity size={18} />
          <span className="status-pulse" />
        </button>
        
        <button
          className="header-btn"
          onClick={() => onOpenSettings?.()}
          title="Open settings"
        >
          <FiSettings size={18} />
        </button>
        
        {/* Github Auth */}
        {/* <div className="cloud-auth">
          <GitHubAuth />
        </div> */}

        <button className="header-btn" onClick={() => setShowSignup(true)} title="Sign in with username/password">
          <FiGithub size={18} />
        </button>

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

        <div className="user-info">
          <span className="user-email">{user?.username || user?.email}</span>
        </div>

        <button
          className="header-btn logout-btn"
          onClick={handleLogout}
          title="Logout"
        >
          <FiLogOut size={18} />
        </button>
      </div>

      <GitHubSignup isOpen={showSignup} onClose={() => setShowSignup(false)} />

      {/* SystemMonitor and SettingsPanel are rendered at the application root to avoid fixed-position containment issues */}
    </header>
  );
}

export default Header;
