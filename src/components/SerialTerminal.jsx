import React, { useState, useEffect, useRef } from 'react';
import { FiPlay, FiSquare, FiRefreshCw, FiTrash2, FiDownload, FiTerminal, FiSend } from 'react-icons/fi';
import '../styles/SerialTerminal.css';

function SerialTerminal() {
  const [ports, setPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState('COM3');
  const [selectedBaud, setSelectedBaud] = useState(115200);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [terminalTheme, setTerminalTheme] = useState('cyan'); // cyan, green, amber, white
  const [refreshingPorts, setRefreshingPorts] = useState(false);
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const logsEndRef = useRef(null);

  // Load available serial ports
  const fetchPorts = async () => {
    setRefreshingPorts(true);
    try {
      if (window.electronAPI?.listSerialPorts) {
        const portList = await window.electronAPI.listSerialPorts();
        setPorts(portList);
        if (portList.length > 0 && !portList.includes(selectedPort)) {
          setSelectedPort(portList[0]);
        }
      }
    } catch (e) {
      console.error('Failed to list serial ports:', e);
    } finally {
      setRefreshingPorts(false);
    }
  };

  useEffect(() => {
    fetchPorts();

    // Listen to serial output from Electron main process
    let unsubscribeOutput = null;
    let unsubscribeClosed = null;

    if (window.electronAPI?.onSerialOutput) {
      unsubscribeOutput = window.electronAPI.onSerialOutput((data) => {
        setLogs((prev) => [...prev, data]);
      });
    }

    if (window.electronAPI?.onSerialClosed) {
      unsubscribeClosed = window.electronAPI.onSerialClosed((code) => {
        setIsConnected(false);
        setLogs((prev) => [...prev, `\n[System] Connection closed. (Exit code: ${code})\n`]);
      });
    }

    // Auto-disconnect on unmount
    return () => {
      if (unsubscribeOutput) unsubscribeOutput();
      if (unsubscribeClosed) unsubscribeClosed();
      if (window.electronAPI?.stopSerialMonitor) {
        window.electronAPI.stopSerialMonitor();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleConnect = async () => {
    if (isConnected) {
      // Disconnect
      setLoading(true);
      try {
        if (window.electronAPI?.stopSerialMonitor) {
          await window.electronAPI.stopSerialMonitor();
        }
        setIsConnected(false);
        setLogs((prev) => [...prev, `\n[System] Disconnected from ${selectedPort}.\n`]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    } else {
      // Connect
      setLoading(true);
      setLogs([`[System] Connecting to ${selectedPort} at ${selectedBaud} baud...\n`]);
      try {
        if (window.electronAPI?.startSerialMonitor) {
          const res = await window.electronAPI.startSerialMonitor({
            port: selectedPort,
            baud: selectedBaud,
          });
          if (res?.success) {
            setIsConnected(true);
          } else {
            setLogs((prev) => [...prev, `[System Error] ${res?.error || 'Failed to start serial monitor.'}\n`]);
          }
        }
      } catch (err) {
        setLogs((prev) => [...prev, `[System Error] ${err.message}\n`]);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSend = async () => {
    if (!inputVal.trim()) return;
    try {
      if (window.electronAPI?.sendSerialData) {
        const success = await window.electronAPI.sendSerialData(inputVal.trim());
        if (success) {
          setLogs((prev) => [...prev, `> ${inputVal}\n`]);
          setCommandHistory((prev) => [inputVal.trim(), ...prev].slice(0, 50));
          setHistoryIndex(-1);
          setInputVal('');
        } else {
          setLogs((prev) => [...prev, `[System Error] Failed to send command.\n`]);
        }
      }
    } catch (err) {
      setLogs((prev) => [...prev, `[System Error] ${err.message}\n`]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setInputVal(commandHistory[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInputVal(commandHistory[nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputVal('');
      }
    }
  };

  const handleExport = () => {
    const rawText = logs.join('');
    const blob = new Blob([rawText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `serial_logs_${selectedPort}_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="serial-terminal-page page-transition">
      <div className="terminal-header">
        <div className="header-title-section">
          <h2>Serial Terminal</h2>
          <p>Read from and interact with connected serial port hardware devices in real time.</p>
        </div>
      </div>

      <div className="terminal-grid">
        {/* Connection panel */}
        <div className="terminal-card connection-card glass-lg">
          <h3>Connection</h3>

          <div className="form-group">
            <label>Serial Port</label>
            <div className="input-with-button">
              <select
                value={selectedPort}
                onChange={(e) => setSelectedPort(e.target.value)}
                disabled={isConnected || loading}
              >
                {ports.map((port) => (
                  <option key={port} value={port}>
                    {port}
                  </option>
                ))}
                {ports.length === 0 && <option value="COM3">COM3 (Default)</option>}
              </select>
              <button
                className="btn btn-icon-only"
                onClick={fetchPorts}
                disabled={refreshingPorts || isConnected || loading}
                title="Refresh serial ports"
              >
                <FiRefreshCw className={refreshingPorts ? 'spinning' : ''} />
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Baud Rate</label>
            <select
              value={selectedBaud}
              onChange={(e) => setSelectedBaud(Number(e.target.value))}
              disabled={isConnected || loading}
            >
              <option value={9600}>9600</option>
              <option value={19200}>19200</option>
              <option value={38400}>38400</option>
              <option value={57600}>57600</option>
              <option value={115200}>115200 (Standard)</option>
              <option value={230400}>230400</option>
              <option value={460800}>460800</option>
              <option value={921600}>921600 (High Speed)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Console Theme</label>
            <select
              value={terminalTheme}
              onChange={(e) => setTerminalTheme(e.target.value)}
            >
              <option value="cyan">Neon Cyan</option>
              <option value="green">Classic Green</option>
              <option value="amber">Amber Phosphor</option>
              <option value="white">Retro White</option>
            </select>
          </div>

          <div className="form-group autoscroll-toggle">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
              />
              <span>Auto-Scroll Logs</span>
            </label>
          </div>

          <button
            className={`btn connect-btn ${isConnected ? 'btn-danger' : 'btn-primary gradient-btn'}`}
            onClick={handleConnect}
            disabled={loading}
          >
            {loading ? (
              <FiRefreshCw className="spinning" />
            ) : isConnected ? (
              <FiSquare />
            ) : (
              <FiPlay />
            )}
            {isConnected ? 'Disconnect Port' : 'Connect Port'}
          </button>
        </div>

        {/* Console panel */}
        <div className="terminal-card console-card glass-lg">
          <div className="console-header">
            <span className="console-title">
              <FiTerminal size={14} /> Console Output
            </span>
            <div className="console-actions">
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleExport}
                disabled={logs.length === 0}
                title="Export output logs to text file"
              >
                <FiDownload size={12} /> Export
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setLogs([])}
                disabled={logs.length === 0}
                title="Clear console output"
              >
                <FiTrash2 size={12} /> Clear
              </button>
            </div>
          </div>

          <div className={`console-viewport theme-${terminalTheme}`}>
            <pre className="console-text">
              {logs.join('')}
              {logs.length === 0 && <span className="console-placeholder">Terminal ready. Choose COM port and click Connect to start viewing serial outputs...</span>}
            </pre>
            <div ref={logsEndRef} />
          </div>

          <div className="console-input-bar">
            <input
              type="text"
              placeholder={isConnected ? "Type command and press Enter..." : "Connect serial port to send commands..."}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!isConnected}
            />
            <button
              className="btn btn-primary btn-sm send-btn"
              onClick={handleSend}
              disabled={!isConnected || !inputVal.trim()}
              title="Send to serial port"
            >
              <FiSend size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SerialTerminal;
