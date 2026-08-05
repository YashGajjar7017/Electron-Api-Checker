import React, { useState, useEffect, useRef } from 'react';
import useStore from '../store';
import { ROLE_META, ROLE_PERMISSIONS } from '../store';
import { FiLogOut, FiWifi, FiGithub, FiCloud, FiRefreshCcw, FiPower, FiShuffle, FiLayers, FiSettings, FiZap, FiPlay, FiTrash2, FiActivity, FiKey, FiShield } from 'react-icons/fi';
import BackendStatus from './BackendStatus';
import SystemMonitor from './SystemMonitor';
import SettingsPanel from './SettingsPanel';
import GitHubAuth from './GitHubAuth';
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
  const [token, setToken] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [showTokenPopup, setShowTokenPopup] = useState(false);
  const tokenPopupRef = useRef(null);
  
  const { 
    user, 
    logoutUser, 
    serverUrl, 
    setServerUrl, 
    clearResponseHistory, 
    shuffleAPIs, 
    toggleComparisonMode, 
    comparisonMode,
    environments,
    activeEnvironment,
    setActiveEnvironment,
    updateEnvironment,
    authToken,
    setAuthToken,
    sessionToken,
    setSessionToken,
    clearSessionToken,
    sessionTokenExpiry,
    securityRole,
    setSecurityRole,
  } = useStore(
    (state) => ({
      user: state.user,
      logoutUser: state.logoutUser,
      serverUrl: state.serverUrl,
      setServerUrl: state.setServerUrl,
      clearResponseHistory: state.clearResponseHistory,
      shuffleAPIs: state.shuffleAPIs,
      toggleComparisonMode: state.toggleComparisonMode,
      comparisonMode: state.comparisonMode,
      environments: state.environments,
      activeEnvironment: state.activeEnvironment,
      setActiveEnvironment: state.setActiveEnvironment,
      updateEnvironment: state.updateEnvironment,
      authToken: state.authToken,
      setAuthToken: state.setAuthToken,
      sessionToken: state.sessionToken,
      setSessionToken: state.setSessionToken,
      clearSessionToken: state.clearSessionToken,
      sessionTokenExpiry: state.sessionTokenExpiry,
      securityRole: state.securityRole,
      setSecurityRole: state.setSecurityRole,
    })
  );

  const roleMeta = securityRole ? ROLE_META[securityRole] : null;
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

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (tokenPopupRef.current && !tokenPopupRef.current.contains(e.target)) {
        setShowTokenPopup(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleGlobalTokenChange = (e) => {
    const val = e.target.value;
    setAuthToken(val);
    if (val) {
      setSessionToken(val, 10);
    } else {
      clearSessionToken();
    }
  };

  const activeEnvObj = environments?.find((env) => env.id === activeEnvironment) || environments?.[0];
  const currentBaseUrl = activeEnvObj ? activeEnvObj.baseUrl : serverUrl;
  
  // GitHub JWT token handler
  useEffect(() => {
    if (window.electronAPI?.onGithubToken) {
      window.electronAPI.onGithubToken((jwtToken) => {
        console.log('JWT Token received:', jwtToken);
        localStorage.setItem('github_jwt', jwtToken);
        setToken(jwtToken);
      });
    }
  }, []);
  
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
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <select
              id="security-role-select"
              className="env-select security-role-select"
              value={securityRole || ''}
              onChange={(e) => setSecurityRole(e.target.value)}
              style={{
                borderColor: roleColor,
                color: roleColor,
                fontWeight: '700',
                paddingLeft: '10px',
                minWidth: '118px',
              }}
            >
              {ROLE_SELECT_OPTIONS.map(r => (
                <option key={r.id} value={r.id}>
                  {ROLE_META[r.id]?.icon} {r.label}
                </option>
              ))}
            </select>
            <span style={{
              position: 'absolute',
              right: '6px',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: roleColor,
              boxShadow: `0 0 6px ${roleColor}`,
              pointerEvents: 'none'
            }} />
          </div>
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

        <button
          className="header-btn system-monitor-btn"
          onClick={() => onOpenSystemMonitor?.()}
          title="Open system monitor"
        >
          <FiActivity size={18} />
          <span className="status-pulse" />
        </button>

        <div style={{ position: 'relative' }} ref={tokenPopupRef}>
          <button
            className={`header-btn token-menu-btn ${sessionToken ? 'active-token' : ''}`}
            onClick={() => setShowTokenPopup(!showTokenPopup)}
            title="Manage Session Token"
            style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <FiKey size={18} style={{ color: sessionToken ? '#10b981' : 'inherit' }} />
            {timeLeft && (
              <span style={{ 
                position: 'absolute', 
                top: '-5px', 
                right: '-5px', 
                background: '#ef4444', 
                color: '#fff', 
                fontSize: '8px', 
                padding: '1px 3px', 
                borderRadius: '6px',
                fontWeight: 'bold',
                lineHeight: '1'
              }}>
                {timeLeft.split(':')[0]}m
              </span>
            )}
          </button>

          {showTokenPopup && (
            <div className="token-popup-dropdown glass-lg" style={{
              position: 'absolute',
              top: '40px',
              right: '0',
              width: '280px',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(20px)',
              boxShadow: 'var(--shadow-xl)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              animation: 'fadeIn 0.2s ease',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-light)' }}>
                  Manage Session Token
                </span>
                {sessionToken && (
                  <span style={{ fontSize: '10px', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                    Active ({timeLeft})
                  </span>
                )}
              </div>

              <input
                type="text"
                value={sessionToken || authToken || ''}
                onChange={handleGlobalTokenChange}
                placeholder="Enter Bearer Token"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: 'var(--text-light)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />

              {sessionToken ? (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    clearSessionToken();
                    setAuthToken('');
                  }}
                  style={{
                    borderColor: '#ef4444',
                    color: '#ef4444',
                    width: '100%',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: 'transparent'
                  }}
                >
                  Clear Token
                </button>
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  No active session token. Paste a bearer token manually.
                </span>
              )}
            </div>
          )}
        </div>
        
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

        <div className="user-info" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <span className="user-email">{user?.username || user?.email}</span>
          {roleMeta && (
            <span style={{
              fontSize: '9px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: roleColor,
              background: `${roleColor}20`,
              padding: '1px 7px',
              borderRadius: '4px',
              border: `1px solid ${roleColor}44`,
            }}>
              {roleMeta.icon} {roleMeta.label}
            </span>
          )}
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
