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
  FiShield
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
    setPythonScriptOutput('Starting Python script execution...\n');

    try {
      const result = await window.electronAPI.runPythonScript({ token: sessionToken });
      if (result.success) {
        setPythonScriptOutput(`✓ Script completed successfully!\n\n${result.stdout || ''}\n\nFiles saved:\n- output.json\n- output.csv`);
      } else {
        setPythonScriptOutput(`✗ Script failed:\n${result.error || result.stderr || 'Unknown error'}`);
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
      <div className="sidebar-details-inner">
        <div className="sidebar-detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>History</h3>
          {responseHistory.length > 0 && (
            <button
              className="btn btn-icon-only"
              onClick={clearResponseHistory}
              title="Clear History"
              style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <FiTrash2 size={16} style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>
        <div className="history-list animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {responseHistory.length === 0 ? (
            <div className="empty-state" style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '30px 10px', border: '1px dashed var(--border)', borderRadius: '8px' }}>
              No request history yet. Send a request to see it here!
            </div>
          ) : (
            responseHistory.map((item) => {
              const statusColor = item.status >= 200 && item.status < 300 ? 'var(--success)' : 'var(--error)';
              const methodClass = `method-${item.method?.toLowerCase()}`;
              return (
                <div
                  key={item.id}
                  className="history-item"
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
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'rgba(30, 41, 59, 0.3)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={`method-badge ${methodClass}`} style={{ fontSize: '10px', fontWeight: 'bold' }}>
                      {item.method}
                    </span>
                    <span style={{ fontSize: '11px', color: statusColor, fontWeight: '600' }}>
                      {item.status || 'ERROR'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.endpoint}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: 'var(--text-muted)' }}>
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
              className={`switcher-btn ${selectedSidebar === 'history' ? 'active' : ''}`}
              onClick={() => setSelectedSidebar('history')}
              title="History"
            >
              <FiRefreshCcw size={20} />
              <span className="switcher-text">History</span>
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
              className={`switcher-btn ${selectedSidebar === 'terminal' ? 'active' : ''}`}
              onClick={() => setSelectedSidebar('terminal')}
              title="Terminal"
            >
              <FiTerminal size={20} />
              <span className="switcher-text">Terminal</span>
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

          {/* Column 2: Sidebar Details Panel */}
          {selectedSidebar && selectedSidebar !== 'firmware' && selectedSidebar !== 'boot' && selectedSidebar !== 'certificate' && selectedSidebar !== 'terminal' && (
            <div className="sidebar-panel" style={{ width: `${sidebarWidth}px` }}>
              {selectedSidebar === 'collections' && <Sidebar />}
              {selectedSidebar === 'environments' && renderEnvironmentsSidebar()}
              {selectedSidebar === 'history' && renderHistorySidebar()}
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
            ) : (
              <>
                {/* Active Request Builder */}
                <div className="workspace-panel flex-grow">
                  <RequestBuilder />
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
