import React, { useState, useEffect, useRef } from 'react';
import { FiDownload, FiCpu, FiRefreshCw, FiZap, FiTrash2, FiPlay, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import '../styles/FirmwareUpdate.css';

function FirmwareUpdate() {
  const [firmwareUrl, setFirmwareUrl] = useState('http://localhost:3000/firmware.bin');
  const [downloading, setDownloading] = useState(false);
  const [downloadedFile, setDownloadedFile] = useState(null);
  const [ports, setPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState('COM3');
  const [selectedChip, setSelectedChip] = useState('esp32');
  const [flashOffset, setFlashOffset] = useState('0x10000');
  const [uploadSpeed, setUploadSpeed] = useState('921600');
  const [flashing, setFlashing] = useState(false);
  const [flashLogs, setFlashLogs] = useState([]);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [refreshingPorts, setRefreshingPorts] = useState(false);

  const logsEndRef = useRef(null);

  // Load available serial ports
  const fetchPorts = async () => {
    setRefreshingPorts(true);
    try {
      if (window.electronAPI?.listSerialPorts) {
        const portList = await window.electronAPI.listSerialPorts();
        setPorts(portList);
        if (portList.length > 0) {
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

    // Listen to flash logs from main process
    let unsubscribe = null;
    if (window.electronAPI?.onFlashLog) {
      unsubscribe = window.electronAPI.onFlashLog((data) => {
        setFlashLogs((prev) => [...prev, data]);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [flashLogs]);

  // Download firmware binary
  const handleDownload = async () => {
    if (!firmwareUrl.trim()) {
      setStatus({ type: 'error', message: 'Please enter a valid firmware URL' });
      return;
    }

    setDownloading(true);
    setStatus({ type: 'info', message: 'Downloading firmware binary...' });
    setDownloadedFile(null);

    try {
      if (window.electronAPI?.downloadFirmware) {
        const result = await window.electronAPI.downloadFirmware(firmwareUrl);
        if (result.success) {
          setDownloadedFile(result);
          setStatus({
            type: 'success',
            message: `✓ Downloaded firmware successfully! Size: ${Math.round(result.size / 1024)} KB`,
          });
        } else {
          setStatus({ type: 'error', message: `✗ Download failed: ${result.error}` });
        }
      } else {
        setStatus({ type: 'error', message: 'Download API is not available' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: `✗ Error: ${err.message}` });
    } finally {
      setDownloading(false);
    }
  };

  // Flash firmware to device
  const handleFlash = async () => {
    if (!downloadedFile) {
      setStatus({ type: 'error', message: 'Please download the firmware binary first' });
      return;
    }

    if (!selectedChip.trim()) {
      setStatus({ type: 'error', message: 'Please specify a Target Chip' });
      return;
    }

    if (!flashOffset.trim()) {
      setStatus({ type: 'error', message: 'Please specify a Flash Offset Address' });
      return;
    }

    setFlashing(true);
    setFlashLogs([`[Client] Initializing upload procedure on port ${selectedPort}...\r\n`]);
    setStatus({ type: 'info', message: `Flashing firmware to ${selectedChip.toUpperCase()}...` });

    try {
      if (window.electronAPI?.flashFirmware) {
        const result = await window.electronAPI.flashFirmware({
          port: selectedPort,
          binaryPath: downloadedFile.path,
          uploadSpeed,
          chip: selectedChip,
          offset: flashOffset,
        });

        if (result.success) {
          setStatus({ type: 'success', message: '✓ Firmware flashed successfully!' });
        } else {
          setStatus({ type: 'error', message: `✗ Flashing failed: ${result.error || 'Check console logs'}` });
        }
      } else {
        setStatus({ type: 'error', message: 'Flashing API is not available' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: `✗ Flashing error: ${err.message}` });
    } finally {
      setFlashing(false);
    }
  };

  // Erase flash on ESP device
  const handleErase = async () => {
    setFlashing(true);
    setFlashLogs([`[Client] Initializing erase procedure on port ${selectedPort}...\r\n`]);
    setStatus({ type: 'info', message: `Erasing flash on ${selectedChip.toUpperCase()}...` });

    try {
      if (window.electronAPI?.eraseFlash) {
        const result = await window.electronAPI.eraseFlash({
          port: selectedPort,
          chip: selectedChip,
          uploadSpeed,
        });

        if (result.success) {
          setStatus({ type: 'success', message: '✓ Flash erased successfully!' });
        } else {
          setStatus({ type: 'error', message: `✗ Erasing failed: ${result.error || 'Check console logs'}` });
        }
      } else {
        setStatus({ type: 'error', message: 'Erase API is not available' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: `✗ Erase error: ${err.message}` });
    } finally {
      setFlashing(false);
    }
  };

  // Stop active operation
  const handleStop = async () => {
    try {
      if (window.electronAPI?.stopFlash) {
        await window.electronAPI.stopFlash();
        setStatus({ type: 'info', message: 'Operation stopped by user' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: `✗ Error stopping operation: ${err.message}` });
    }
  };

  return (
    <div className="firmware-update-page page-transition">
      <div className="firmware-header">
        <div className="header-title-section">
          <h2>Firmware Update</h2>
          <p>Download precompiled binaries from web servers and flash them directly to your ESP devices.</p>
        </div>
      </div>

      <div className="firmware-grid">
        {/* Settings Column */}
        <div className="firmware-card settings-card glass-lg">
          <h3>Configuration</h3>
          
          <div className="form-group">
            <label>Firmware Binary URL</label>
            <div className="input-with-button">
              <input
                type="text"
                placeholder="http://localhost:3000/firmware.bin"
                value={firmwareUrl}
                onChange={(e) => setFirmwareUrl(e.target.value)}
                disabled={downloading || flashing}
              />
              <button
                className="btn btn-secondary gradient-hover"
                onClick={handleDownload}
                disabled={downloading || flashing}
              >
                {downloading ? <FiRefreshCw className="spinning" /> : <FiDownload />}
                {downloading ? 'Downloading...' : 'Download'}
              </button>
            </div>
          </div>

          {downloadedFile && (
            <div className="download-info-pill animate-scaleIn">
              <FiCheckCircle size={16} />
              <span>
                Ready: <strong>{downloadedFile.filename}</strong> ({Math.round(downloadedFile.size / 1024)} KB)
              </span>
            </div>
          )}

          <hr className="divider" />

          <div className="form-group">
            <label>Serial Connection Port</label>
            <div className="input-with-button">
              <select
                value={selectedPort}
                onChange={(e) => setSelectedPort(e.target.value)}
                disabled={flashing}
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
                disabled={refreshingPorts || flashing}
                title="Refresh serial ports"
              >
                <FiRefreshCw className={refreshingPorts ? 'spinning' : ''} />
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Target Chip Type</label>
            <select
              value={selectedChip}
              onChange={(e) => {
                setSelectedChip(e.target.value);
                // Auto-adjust default offset address based on selected chip type
                if (e.target.value === 'esp8266') {
                  setFlashOffset('0x0');
                } else if (e.target.value === 'esp32s3' || e.target.value === 'esp32c3') {
                  setFlashOffset('0x0');
                } else {
                  setFlashOffset('0x10000');
                }
              }}
              disabled={flashing}
            >
              <option value="esp32">ESP32 (Dev Module)</option>
              <option value="esp32s3">ESP32-S3</option>
              <option value="esp32c3">ESP32-C3</option>
              <option value="esp32s2">ESP32-S2</option>
              <option value="esp8266">ESP8266</option>
            </select>
          </div>

          <div className="form-group">
            <label>Flash Offset Address</label>
            <input
              type="text"
              placeholder="0x10000"
              value={flashOffset}
              onChange={(e) => setFlashOffset(e.target.value)}
              disabled={flashing}
            />
          </div>

          <div className="form-group">
            <label>Flashing Baud Rate</label>
            <select
              value={uploadSpeed}
              onChange={(e) => setUploadSpeed(e.target.value)}
              disabled={flashing}
            >
              <option value="921600">921600 (High Speed)</option>
              <option value="460800">460800</option>
              <option value="230400">230400</option>
              <option value="115200">115200 (Standard)</option>
            </select>
          </div>

          <div className="flash-action-group" style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              className="btn btn-primary flash-btn gradient-btn"
              onClick={handleFlash}
              disabled={!downloadedFile || flashing || downloading}
              style={{ flex: 2, justifyContent: 'center' }}
            >
              {flashing ? <FiRefreshCw className="spinning" /> : <FiZap />}
              {flashing ? 'Flashing ESP...' : 'Flash Firmware'}
            </button>
            <button
              className="btn btn-secondary erase-btn"
              onClick={handleErase}
              disabled={flashing || downloading}
              title="Erase Flash (esptool)"
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <FiTrash2 /> Erase
            </button>
            {flashing && (
              <button
                className="btn btn-danger stop-btn"
                onClick={handleStop}
                title="Stop current operation"
                style={{ flex: 1, justifyContent: 'center', background: 'var(--error)' }}
              >
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Logs Column */}
        <div className="firmware-card logs-card glass-lg">
          <div className="logs-header">
            <h3>Console Output Log</h3>
            <button
              className="btn btn-text btn-sm"
              onClick={() => setFlashLogs([])}
              disabled={flashing}
            >
              <FiTrash2 /> Clear Logs
            </button>
          </div>

          <div className="terminal-console">
            {flashLogs.length === 0 ? (
              <span className="terminal-placeholder">Awaiting flashing commands...</span>
            ) : (
              flashLogs.map((log, index) => (
                <span key={index} className="terminal-line">
                  {log}
                </span>
              ))
            )}
            <div ref={logsEndRef} />
          </div>

          {status.message && (
            <div className={`status-banner banner-${status.type} animate-fadeIn`}>
              {status.type === 'error' ? (
                <FiAlertCircle size={18} />
              ) : status.type === 'success' ? (
                <FiCheckCircle size={18} />
              ) : (
                <FiRefreshCw className="spinning" size={18} />
              )}
              <span>{status.message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FirmwareUpdate;
