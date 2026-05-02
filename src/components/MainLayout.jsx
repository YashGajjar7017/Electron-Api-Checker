import React, { useState, useRef, useEffect } from 'react';
import Sidebar from './Sidebar';
import RequestBuilder from './RequestBuilder';
import ResponseViewer from './ResponseViewer';
import Header from './Header';
import PythonScriptModal from './PythonScriptModal';
import MCPConfig from './MCPConfig';
import useStore from '../store';
import { FiTerminal, FiRefreshCcw, FiTrash2, FiShuffle, FiLayers, FiSettings } from 'react-icons/fi';
import '../styles/MainLayout.css';

function MainLayout({ onThemeChange, currentTheme }) {
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [responseWidth, setResponseWidth] = useState(400);
  const containerRef = useRef(null);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingResponse, setIsResizingResponse] = useState(false);
  const [showPythonModal, setShowPythonModal] = useState(false);
  const [pythonScriptOutput, setPythonScriptOutput] = useState('');
  const [isRunningScript, setIsRunningScript] = useState(false);
  const [showMCPModal, setShowMCPModal] = useState(false);

  const {
    sessionToken,
    clearResponseHistory,
    shuffleAPIs,
    clearBatchResults,
    toggleComparisonMode,
    comparisonMode,
  } = useStore((state) => ({
    sessionToken: state.sessionToken,
    clearResponseHistory: state.clearResponseHistory,
    shuffleAPIs: state.shuffleAPIs,
    clearBatchResults: state.clearBatchResults,
    toggleComparisonMode: state.toggleComparisonMode,
    comparisonMode: state.comparisonMode,
  }));

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
        const newWidth = e.clientX - containerRef.current.getBoundingClientRect().left;
        if (newWidth > 200 && newWidth < 500) {
          setSidebarWidth(newWidth);
        }
      } else if (isResizingResponse) {
        const containerRight = containerRef.current.getBoundingClientRect().right;
        const newWidth = containerRight - e.clientX;
        if (newWidth > 250 && newWidth < 600) {
          setResponseWidth(newWidth);
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

  const handleResetLayout = () => {
    setSidebarWidth(280);
    setResponseWidth(400);
  };

  return (
    <div className="main-layout">
      <Header onThemeChange={onThemeChange} currentTheme={currentTheme} />

      <div className="layout-controls">
        <button
          className="script-button"
          onClick={() => setShowPythonModal(true)}
          title="Open automation script modal"
        >
          <FiTerminal size={16} />
          Run Automation
        </button>

        <button
          className="control-button"
          onClick={handleResetLayout}
          title="Reset panel widths to defaults"
        >
          <FiRefreshCcw size={16} />
          Reset Layout
        </button>

        <button
          className="control-button"
          onClick={() => clearResponseHistory()}
          title="Clear all response history"
        >
          <FiTrash2 size={16} />
          Clear History
        </button>

        <button
          className="control-button"
          onClick={() => setShowMCPModal(true)}
          title="Open MCP configuration"
        >
          <FiSettings size={16} />
          MCP Configuration
        </button>

        <button
          className="control-button"
          onClick={() => shuffleAPIs()}
          title="Shuffle API list to randomize testing"
        >
          <FiShuffle size={16} />
          Shuffle APIs
        </button>

        <button
          className="control-button"
          onClick={() => clearBatchResults()}
          title="Clear batch testing results"
        >
          <FiLayers size={16} />
          Clear Batch
        </button>

        <button
          className={`control-button ${comparisonMode ? 'active' : ''}`}
          onClick={() => toggleComparisonMode()}
          title="Toggle response comparison mode"
        >
          <FiLayers size={16} />
          {comparisonMode ? 'Comparison On' : 'Comparison Off'}
        </button>
      </div>

      <div className="layout-container" ref={containerRef}>
        <div className="sidebar-panel" style={{ width: `${sidebarWidth}px` }}>
          <Sidebar />
          <div
            className="resize-handle resize-handle-right"
            onMouseDown={() => handleMouseDown('sidebar')}
          />
        </div>

        <div className="workspace-panel" style={{ flex: 1 }}>
          <RequestBuilder />
        </div>

        <div className="response-panel" style={{ width: `${responseWidth}px` }}>
          <ResponseViewer />
          <div
            className="resize-handle resize-handle-left"
            onMouseDown={() => handleMouseDown('response')}
          />
        </div>
      </div>

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
    </div>
  );
}

export default MainLayout;
