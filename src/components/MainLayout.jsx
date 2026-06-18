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
  FiInfo
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
  } = useStore();

  const [localBackendMessage, setLocalBackendMessage] = useState('');

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
                  <label>Base URL:</label>
                  <input
                    type="text"
                    value={env.baseUrl}
                    onChange={(e) => updateEnvironment(env.id, { baseUrl: e.target.value })}
                  />
                </div>
              )}
            </div>
          ))}
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
              className={`switcher-btn ${selectedSidebar === 'firmware' ? 'active' : ''}`} 
              onClick={() => setSelectedSidebar('firmware')}
              title="Firmware Update"
            >
              <FiCpu size={20} />
              <span className="switcher-text">Firmware</span>
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
          {selectedSidebar && selectedSidebar !== 'firmware' && (
            <div className="sidebar-panel" style={{ width: `${sidebarWidth}px` }}>
              {selectedSidebar === 'collections' && <Sidebar />}
              {selectedSidebar === 'environments' && renderEnvironmentsSidebar()}
              {selectedSidebar === 'settings' && renderSettingsSidebar()}
              
              <div
                className="resize-handle resize-handle-right"
                onMouseDown={() => handleMouseDown('sidebar')}
              />
            </div>
          )}

          {/* Column 3: Workspace / Content split */}
          <div className="main-content-split">
            {selectedSidebar === 'firmware' ? (
              <div className="workspace-panel full-height">
                <FirmwareUpdate />
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
