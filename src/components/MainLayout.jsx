import React, { useState, useRef, useEffect } from 'react';
import Sidebar from './Sidebar';
import RequestBuilder from './RequestBuilder';
import ResponsePanel from './ResponsePanel';
import Header from './Header';
import PythonScriptModal from './PythonScriptModal';
import MCPConfig from './MCPConfig';
import ArduinoCliConfig from './ArduinoCliConfig';
import SettingsPanel from './SettingsPanel';
import SystemMonitor from './SystemMonitor';
import FirmwareUpdate from './FirmwareUpdate';
import CertificateManager from './CertificateManager';
import SerialTerminal from './SerialTerminal';
import BusConfig from './BusConfig';
import RemotePage from './RemotePage';
import MongoDBManager from './MongoDBManager';
import GitHubSync from './GitHubSync';
import Maintenance from './Maintenance';
import useStore from '../store';
import {
  FiFolder,
  FiGlobe,
  FiCpu,
  FiSettings,
  FiTerminal,
  FiRefreshCcw,
  FiTrash2,
  FiShuffle,
  FiLayers,
  FiPower,
  FiDatabase,
  FiCode,
  FiInfo,
  FiShield,
  FiSliders,
  FiWifi,
  FiGithub,
  FiZap
} from 'react-icons/fi';
import '../styles/MainLayout.css';

function MainLayout({ onThemeChange, currentTheme }) {
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [responseHeight, setResponseHeight] = useState(300);
  const containerRef = useRef(null);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingResponse, setIsResizingResponse] = useState(false);
  const [showPythonModal, setShowPythonModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSystemMonitor, setShowSystemMonitor] = useState(false);
  const [pythonScriptOutput, setPythonScriptOutput] = useState('');
  const [isRunningScript, setIsRunningScript] = useState(false);
  const [showMCPModal, setShowMCPModal] = useState(false);
  const [showArduinoModal, setShowArduinoModal] = useState(false);

  const {
    user,
    apis,
    sessionToken,
    clearResponseHistory,
    shuffleAPIs,
    clearBatchResults,
    toggleComparisonMode,
    comparisonMode,
    selectedSidebar,
    setSelectedSidebar,
    backendMessage,
    setBackendMessage,
    environments,
    activeEnvironment,
    setActiveEnvironment,
    updateEnvironment,
    addEnvironment,
    deleteEnvironment,
    responseHistory,
    setCurrentAPI,
  } = useStore();

  const isAdmin = user && user.email && user.email.toLowerCase().includes('admin');

  const [localBackendMessage, setLocalBackendMessage] = useState('');
  const [newEnvName, setNewEnvName] = useState('');
  const [newEnvUrl, setNewEnvUrl] = useState('');

  const handleMouseDown = (side) => {
    if (side === 'sidebar') {
      setIsResizingSidebar(true);
    } else if (side === 'response') {
      setIsResizingResponse(true);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;

      if (isResizingSidebar) {
        const newWidth = e.clientX - containerRef.current.getBoundingClientRect().left - 60; // adjust for vertical switcher
        if (newWidth > 200 && newWidth < 500) {
          setSidebarWidth(newWidth);
        }
      } else if (isResizingResponse) {
        const containerBottom = containerRef.current.getBoundingClientRect().bottom;
        const newHeight = containerBottom - e.clientY;
        if (newHeight > 150 && newHeight < window.innerHeight - 250) {
          setResponseHeight(newHeight);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      setIsResizingResponse(false);
    };

    if (isResizingSidebar || isResizingResponse) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizingSidebar, isResizingResponse]);

  useEffect(() => {
    const handleReset = () => {
      handleResetLayout();
    };
    window.addEventListener('reset-layout', handleReset);
    return () => window.removeEventListener('reset-layout', handleReset);
  }, []);

  const handleRunPythonScript = async () => {
    if (!sessionToken) {
      setPythonScriptOutput('Error: Please authenticate first to get a token.');
      setShowPythonModal(true);
      return;
    }

    setIsRunningScript(true);
    setPythonScriptOutput('Preparing API configurations and executing Python automation script...\n');

    try {
      const activeEnvObj = environments?.find((env) => env.id === activeEnvironment) || environments?.[0];
      const currentBaseUrl = activeEnvObj ? activeEnvObj.baseUrl : 'http://localhost:5000';

      const apisToRun = apis.map(api => {
        let fullUrl = api.endpoint;
        if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
          const base = currentBaseUrl.endsWith('/') ? currentBaseUrl.slice(0, -1) : currentBaseUrl;
          const path = api.endpoint.startsWith('/') ? api.endpoint : `/${api.endpoint}`;
          fullUrl = `${base}${path}`;
        }

        const headers = { ...api.headers };
        if (sessionToken && !headers['Authorization'] && !headers['authorization']) {
          headers['Authorization'] = `Bearer ${sessionToken}`;
        }

        return {
          id: api.id,
          name: api.name,
          method: api.method || 'GET',
          url: fullUrl,
          headers: headers,
          body: api.body || '',
          bodyType: api.bodyType || 'none'
        };
      });

      const result = await window.electronAPI.runPythonScript({
        token: sessionToken,
        apis: apisToRun
      });

      if (result.success) {
        setPythonScriptOutput(`✓ Script completed successfully!\n\n${result.stdout || ''}\n\nFiles saved:\n- output.json\n- output.csv`);
      } else {
        setPythonScriptOutput(`✗ Script failed:\n${result.error || result.stderr || 'Unknown error'}\n\nConsole logs:\n${result.stdout || ''}`);
      }
    } catch (error) {
      setPythonScriptOutput(`✗ Error executing script:\n${error.message}`);
    } finally {
      setIsRunningScript(false);
    }
  };

  const handleRestartBackend = async () => {
    try {
      setLocalBackendMessage('Restarting backend server...');
      if (window.electronAPI?.restartBackend) {
        await window.electronAPI.restartBackend();
        setLocalBackendMessage('Backend restarted successfully!');
      } else {
        setLocalBackendMessage('Backend restart requested (electronAPI unavailable)');
        window.electronAPI?.reloadApp?.();
      }
      setTimeout(() => setLocalBackendMessage(''), 3000);
    } catch (error) {
      setLocalBackendMessage(`Backend restart failed: ${error.message}`);
      setTimeout(() => setLocalBackendMessage(''), 5000);
    }
  };

  const handleStopBackend = async () => {
    try {
      setLocalBackendMessage('Stopping backend server...');
      if (window.electronAPI?.stopBackend) {
        await window.electronAPI.stopBackend();
        setLocalBackendMessage('Backend stopped successfully!');
      } else {
        setLocalBackendMessage('Backend stop requested (electronAPI unavailable)');
      }
      setTimeout(() => setLocalBackendMessage(''), 3000);
    } catch (error) {
      setLocalBackendMessage(`Backend stop failed: ${error.message}`);
      setTimeout(() => setLocalBackendMessage(''), 5000);
    }
  };

  const handleResetLayout = () => {
    setSidebarWidth(280);
    setResponseHeight(300);
  };

  const handleAddEnvironment = () => {
    if (!newEnvName.trim() || !newEnvUrl.trim()) return;
    const newEnv = {
      id: Math.random().toString(36).substr(2, 9),
      name: newEnvName.trim(),
      baseUrl: newEnvUrl.trim(),
      values: {}
    };
    addEnvironment(newEnv);
    setNewEnvName('');
    setNewEnvUrl('');
  };

  const renderEnvironmentsSidebar = () => {
    return (
      <div className="sidebar-details-inner">
        <div className="sidebar-detail-header">
          <h3>Environments</h3>
        </div>
        <div className="sidebar-detail-search">
          <div className="search-pill">Active environment selector</div>
        </div>
        <div className="environments-list">
          {environments.map((env) => (
            <div
              key={env.id}
              className={`env-item ${activeEnvironment === env.id ? 'active' : ''}`}
              onClick={() => setActiveEnvironment(env.id)}
            >
              <div className="env-item-header">
                <span className="env-bullet" />
                <span className="env-name">{env.name}</span>
              </div>
              <div className="env-item-url">{env.baseUrl}</div>
              {activeEnvironment === env.id && (
                <div className="env-edit-box" onClick={(e) => e.stopPropagation()}>
                  <div className="env-edit-row" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                    <label>Name:</label>
                    <input
                      type="text"
                      value={env.name}
                      onChange={(e) => updateEnvironment(env.id, { name: e.target.value })}
                    />
                  </div>
                  <div className="env-edit-row" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                    <label>Base URL:</label>
                    <input
                      type="text"
                      value={env.baseUrl}
                      onChange={(e) => updateEnvironment(env.id, { baseUrl: e.target.value })}
                    />
                  </div>
                  <button
                    className="env-delete-btn"
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to delete environment "${env.name}"?`)) {
                        deleteEnvironment(env.id);
                      }
                    }}
                  >
                    Delete Environment
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="add-environment-box" style={{ marginTop: '20px' }}>
          <h4>Create Environment</h4>
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="Environment Name"
              value={newEnvName}
              onChange={(e) => setNewEnvName(e.target.value)}
              style={{ width: '100%', padding: '8px', fontSize: '12px' }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="Base URL (e.g. http://localhost)"
              value={newEnvUrl}
              onChange={(e) => setNewEnvUrl(e.target.value)}
              style={{ width: '100%', padding: '8px', fontSize: '12px' }}
            />
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleAddEnvironment}
            disabled={!newEnvName.trim() || !newEnvUrl.trim()}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Add Environment
          </button>
        </div>
      </div>
    );
  };

  const renderSettingsSidebar = () => {
    return (
      <div className="sidebar-details-inner">
        <div className="sidebar-detail-header">
          <h3>Settings & Tools</h3>
        </div>
        <div className="settings-nav-list">
          <button className="settings-nav-item" onClick={() => setShowSettings(true)}>
            <FiSettings size={16} /> General Settings
          </button>
          <button className="settings-nav-item" onClick={() => setShowMCPModal(true)}>
            <FiDatabase size={16} /> MCP Configuration
          </button>
          <button className="settings-nav-item" onClick={() => setShowArduinoModal(true)}>
            <FiCode size={16} /> Arduino CLI settings
          </button>
          <button className="settings-nav-item" onClick={() => setShowSystemMonitor(true)}>
            <FiTerminal size={16} /> System Monitor
          </button>
        </div>
      </div>
    );
  };

  const renderHistorySidebar = () => {
    return (
      <div className="sidebar-details-inner" style={{ padding: 0 }}>
        <div className="sidebar-detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Request History</h4>
          {responseHistory.length > 0 && (
            <button
              className="btn btn-icon-only"
              onClick={clearResponseHistory}
              title="Clear History"
              style={{ padding: '2px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <FiTrash2 size={14} style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>
        <div className="history-list animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {responseHistory.length === 0 ? (
            <div className="empty-state" style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', padding: '20px 10px', border: '1px dashed var(--border)', borderRadius: '6px' }}>
              No history yet. Send a request!
            </div>
          ) : (
            responseHistory.map((item) => {
              const statusColor = item.status >= 200 && item.status < 300 ? 'var(--success)' : 'var(--error)';
              const methodClass = `method-${item.method?.toLowerCase()}`;
              return (
                <div
                  key={item.id}
                  className={`history-item ${methodClass}`}
                  onClick={() => {
                    setCurrentAPI({
                      id: item.id || Math.random().toString(36).substr(2, 9),
                      name: item.apiName || `${item.method} Request`,
                      method: item.method,
                      endpoint: item.endpoint,
                      headers: item.headers || {},
                      params: item.params || {},
                      body: item.body || '',
                      bodyType: item.bodyType || 'none',
                      auth: item.auth || { type: 'none', token: '' },
                    });
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'rgba(30, 41, 59, 0.25)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={`method-badge ${methodClass}`} style={{ fontSize: '9px', padding: '1px 4px', fontWeight: 'bold' }}>
                      {item.method}
                    </span>
                    <span style={{ fontSize: '10px', color: statusColor, fontWeight: '600' }}>
                      {item.status || 'ERROR'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.endpoint}>
                    {item.endpoint}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '8.5px', color: 'var(--text-muted)' }}>
                    <span>{item.responseTime ? `${item.responseTime}ms` : ''}</span>
                    <span>{item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ''}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderAutomationSidebar = () => {
    return (
      <div className="sidebar-details-inner">
        <div className="sidebar-detail-header" style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>Automation</h3>
        </div>

        <div className="automation-actions animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <button
            className="btn btn-secondary gradient-hover"
            onClick={handleRunPythonScript}
            disabled={isRunningScript}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', width: '100%' }}
          >
            <FiTerminal /> {isRunningScript ? 'Running...' : 'Run Script.py'}
          </button>

          <div className="automation-workflows-section">
            <h4 style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '15px 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Automation Workflows
            </h4>
            <div className="empty-workflows" style={{ padding: '24px 16px', textAlign: 'center', background: 'rgba(30, 41, 59, 0.2)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
              <FiDatabase size={24} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                No active automation tasks configured. Create workflow triggers inside script actions.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="main-layout">
      {/* Top Header */}
      <Header
        onThemeChange={onThemeChange}
        currentTheme={currentTheme}
        onOpenSettings={() => setShowSettings(true)}
        onOpenSystemMonitor={() => setShowSystemMonitor(true)}
      />

      <div className="layout-body-wrapper">
        <div className="layout-container" ref={containerRef}>

          {/* Column 1: Leftmost Vertical Switcher Bar */}
          <div className="vertical-switcher">
            <button
              className={`switcher-btn ${selectedSidebar === 'collections' ? 'active' : ''}`}
              onClick={() => setSelectedSidebar('collections')}
              title="Collections"
            >
              <FiFolder size={20} />
              <span className="switcher-text">Collections</span>
            </button>
            <button
              className={`switcher-btn ${selectedSidebar === 'environments' ? 'active' : ''}`}
              onClick={() => setSelectedSidebar('environments')}
              title="Environments"
            >
              <FiGlobe size={20} />
              <span className="switcher-text">Environments</span>
            </button>

            <button
              className={`switcher-btn ${selectedSidebar === 'automation' ? 'active' : ''}`}
              onClick={() => setSelectedSidebar('automation')}
              title="Automation"
            >
              <FiTerminal size={20} />
              <span className="switcher-text">Automation</span>
            </button>
            <button
              className={`switcher-btn ${selectedSidebar === 'firmware' ? 'active' : ''}`}
              onClick={() => setSelectedSidebar('firmware')}
              title="Firmware Update"
            >
              <FiCpu size={20} />
              <span className="switcher-text">Firmware</span>
            </button>
            <button
              className={`switcher-btn ${selectedSidebar === 'certificate' ? 'active' : ''}`}
              onClick={() => setSelectedSidebar('certificate')}
              title="Certificate Provisioning"
            >
              <FiShield size={20} />
              <span className="switcher-text">Certificate</span>
            </button>
            <button
              className={`switcher-btn ${selectedSidebar === 'remote' ? 'active' : ''}`}
              onClick={() => setSelectedSidebar('remote')}
              title="Remote Device Endpoint"
            >
              <FiWifi size={20} />
              <span className="switcher-text">Remote Page</span>
            </button>
            <button
              className={`switcher-btn ${selectedSidebar === 'bus_config' ? 'active' : ''}`}
              onClick={() => setSelectedSidebar('bus_config')}
              title="Bus Configuration"
            >
              <FiSliders size={20} />
              <span className="switcher-text">Bus Config</span>
            </button>
            {isAdmin && (
              <button
                className={`switcher-btn ${selectedSidebar === 'mongodb' ? 'active' : ''}`}
                onClick={() => setSelectedSidebar('mongodb')}
                title="MongoDB Connection Manager"
              >
                <FiDatabase size={20} />
                <span className="switcher-text">MongoDB</span>
              </button>
            )}
            <button
              className={`switcher-btn ${selectedSidebar === 'terminal' ? 'active' : ''}`}
              onClick={() => setSelectedSidebar('terminal')}
              title="Terminal"
            >
              <FiTerminal size={20} />
              <span className="switcher-text">Terminal</span>
            </button>
            <button
              className={`switcher-btn ${selectedSidebar === 'maintenance' ? 'active' : ''}`}
              onClick={() => setSelectedSidebar('maintenance')}
              title="Maintenance"
            >
              <FiZap size={20} />
              <span className="switcher-text">Maintenance</span>
            </button>
            <button
              className={`switcher-btn ${selectedSidebar === 'github_sync' ? 'active' : ''}`}
              onClick={() => setSelectedSidebar('github_sync')}
              title="GitHub Sync"
            >
              <FiGithub size={20} />
              <span className="switcher-text">GitHub Sync</span>
            </button>
            <div className="switcher-spacer"></div>
            <button
              className={`switcher-btn ${selectedSidebar === 'settings' ? 'active' : ''}`}
              onClick={() => setSelectedSidebar('settings')}
              title="Settings"
            >
              <FiSettings size={20} />
              <span className="switcher-text">Settings</span>
            </button>
          </div>

          {selectedSidebar && selectedSidebar !== 'history' && selectedSidebar !== 'firmware' && selectedSidebar !== 'boot' && selectedSidebar !== 'certificate' && selectedSidebar !== 'terminal' && selectedSidebar !== 'bus_config' && selectedSidebar !== 'mongodb' && selectedSidebar !== 'remote' && selectedSidebar !== 'github_sync' && selectedSidebar !== 'maintenance' && (
            <div className="sidebar-panel" style={{ width: `${sidebarWidth}px` }}>
              {selectedSidebar === 'collections' && <Sidebar />}
              {selectedSidebar === 'environments' && renderEnvironmentsSidebar()}
              {selectedSidebar === 'automation' && renderAutomationSidebar()}
              {selectedSidebar === 'settings' && renderSettingsSidebar()}

              <div
                className="resize-handle resize-handle-right"
                onMouseDown={() => handleMouseDown('sidebar')}
              />
            </div>
          )}

          {/* Column 3: Workspace / Content split */}
          <div className="main-content-split">
            {selectedSidebar === 'firmware' || selectedSidebar === 'boot' ? (
              <div className="workspace-panel full-height">
                <FirmwareUpdate defaultFlashMode={selectedSidebar === 'boot' ? 'multiple' : 'single'} />
              </div>
            ) : selectedSidebar === 'certificate' ? (
              <div className="workspace-panel full-height">
                <CertificateManager />
              </div>
            ) : selectedSidebar === 'terminal' ? (
              <div className="workspace-panel full-height">
                <SerialTerminal />
              </div>
            ) : selectedSidebar === 'bus_config' ? (
              <div className="workspace-panel full-height">
                <BusConfig />
              </div>
            ) : selectedSidebar === 'remote' ? (
              <div className="workspace-panel full-height">
                <RemotePage />
              </div>
            ) : selectedSidebar === 'mongodb' ? (
              <div className="workspace-panel full-height">
                {isAdmin ? <MongoDBManager /> : <div style={{ padding: '24px', color: 'var(--error)' }}>Access Denied: Admin permission required.</div>}
              </div>
            ) : selectedSidebar === 'github_sync' ? (
              <div className="workspace-panel full-height">
                <GitHubSync />
              </div>
            ) : selectedSidebar === 'maintenance' ? (
              <div className="workspace-panel full-height">
                <Maintenance />
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flex: 1, width: '100%', overflow: 'hidden' }}>
                  {/* Active Request Builder */}
                  <div className="workspace-panel flex-grow" style={{ overflow: 'auto' }}>
                    <RequestBuilder />
                  </div>

                  {/* History Right Sidebar */}
                  <div className="history-right-sidebar glass-panel" style={{ 
                    width: '230px', 
                    borderLeft: '1px solid var(--border)',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto',
                    flexShrink: 0,
                    boxSizing: 'border-box'
                  }}>
                    {renderHistorySidebar()}
                  </div>
                </div>

                {/* Horizontal Resizer */}
                <div
                  className="resize-handle resize-handle-bottom"
                  onMouseDown={() => handleMouseDown('response')}
                />

                {/* Bottom Response Panel */}
                <div className="response-panel" style={{ height: `${responseHeight}px` }}>
                  <ResponsePanel />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <footer className="status-bar">
        <div className="status-bar-left">
          <span className="git-branch"><FiCode size={12} /> main</span>
          <span className="server-status-pill">Local Node Server Port: 5000</span>
          {(backendMessage || localBackendMessage) && (
            <span className="backend-notification animate-pulse">
              {backendMessage || localBackendMessage}
            </span>
          )}
        </div>
        <div className="status-bar-right">
          <button className="status-btn" onClick={() => setShowPythonModal(true)} title="Run Script.py Automation">
            <FiTerminal size={12} /> Run Automation
          </button>
          <button className="status-btn" onClick={() => toggleComparisonMode()} title="Toggle Response Comparison Mode">
            <FiLayers size={12} /> {comparisonMode ? 'Comparison Mode: ON' : 'Comparison Mode: OFF'}
          </button>
          <button className="status-btn" onClick={() => shuffleAPIs()} title="Randomize APIs order">
            <FiShuffle size={12} /> Shuffle APIs
          </button>
          <button className="status-btn" onClick={clearResponseHistory} title="Clear API responses history">
            <FiTrash2 size={12} /> Clear Logs
          </button>
          <button className="status-btn" onClick={handleRestartBackend} title="Restart local Express API server">
            <FiRefreshCcw size={12} /> Restart Server
          </button>
          <button className="status-btn danger" onClick={handleStopBackend} title="Stop local Express API server">
            <FiPower size={12} /> Stop Server
          </button>
          <button className="status-btn" onClick={handleResetLayout} title="Reset panel layouts to defaults">
            <FiRefreshCcw size={12} /> Reset Layout
          </button>
        </div>
      </footer>

      {/* Modals & Dialogs */}
      <PythonScriptModal
        isOpen={showPythonModal}
        onClose={() => setShowPythonModal(false)}
        onRun={handleRunPythonScript}
        isRunning={isRunningScript}
        output={pythonScriptOutput}
        token={sessionToken}
      />

      <MCPConfig
        isOpen={showMCPModal}
        onClose={() => setShowMCPModal(false)}
      />

      <ArduinoCliConfig
        isOpen={showArduinoModal}
        onClose={() => setShowArduinoModal(false)}
      />
      <SystemMonitor isOpen={showSystemMonitor} onClose={() => setShowSystemMonitor(false)} />
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}

export default MainLayout;
