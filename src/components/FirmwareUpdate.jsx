import React, { useState, useEffect, useRef } from 'react';
import { 
  FiDownload, 
  FiRefreshCw, 
  FiZap, 
  FiTrash2, 
  FiAlertCircle, 
  FiCheckCircle, 
  FiFolder, 
  FiFile, 
  FiLayers,
  FiCode
} from 'react-icons/fi';
import '../styles/FirmwareUpdate.css';

function FirmwareUpdate({ defaultFlashMode }) {
  const [sourceMode, setSourceMode] = useState('download'); // 'download' | 'sketch' | 'local'
  const [flashTool, setFlashTool] = useState('esptool'); // 'esptool' | 'arduino-cli'
  const [flashMode, setFlashMode] = useState(defaultFlashMode || 'single'); // 'single' | 'multiple'

  // Multiple files selector states
  const [bootloaderFile, setBootloaderFile] = useState(null);
  const [partitionsFile, setPartitionsFile] = useState(null);
  const [appFile, setAppFile] = useState(null);

  const [bootloaderOffset, setBootloaderOffset] = useState('0x1000');
  const [partitionsOffset, setPartitionsOffset] = useState('0x8000');
  const [appOffset, setAppOffset] = useState('0x10000');

  const [firmwareUrl, setFirmwareUrl] = useState('http://localhost:3000/firmware.bin');
  const [downloading, setDownloading] = useState(false);
  const [downloadedFile, setDownloadedFile] = useState(null);

  // Sketch compilation states
  const [sketchPath, setSketchPath] = useState('');
  const [fqbn, setFqbn] = useState('esp32:esp32:esp32');
  const [compiling, setCompiling] = useState(false);

  // Serial & flash settings
  const [ports, setPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState('COM3');
  const [selectedChip, setSelectedChip] = useState('esp32');
  const [flashOffset, setFlashOffset] = useState('0x10000');
  const [uploadSpeed, setUploadSpeed] = useState('115200');
  
  const [flashing, setFlashing] = useState(false);
  const [flashLogs, setFlashLogs] = useState([]);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [refreshingPorts, setRefreshingPorts] = useState(false);

  const logsEndRef = useRef(null);

  // Sync flashMode with defaultFlashMode prop when it changes
  useEffect(() => {
    if (defaultFlashMode) {
      setFlashMode(defaultFlashMode);
    }
  }, [defaultFlashMode]);

  // File pickers for multiple flashing layout
  const handleSelectBootloader = async () => {
    try {
      if (window.electronAPI?.selectBinFile) {
        const result = await window.electronAPI.selectBinFile();
        if (result?.success) {
          setBootloaderFile({
            path: result.path,
            filename: result.filename,
            size: result.size
          });
        }
      }
    } catch (e) {
      console.error('Failed to select bootloader binary:', e);
    }
  };

  const handleSelectPartitions = async () => {
    try {
      if (window.electronAPI?.selectBinFile) {
        const result = await window.electronAPI.selectBinFile();
        if (result?.success) {
          setPartitionsFile({
            path: result.path,
            filename: result.filename,
            size: result.size
          });
        }
      }
    } catch (e) {
      console.error('Failed to select partitions binary:', e);
    }
  };

  const handleSelectApp = async () => {
    try {
      if (window.electronAPI?.selectBinFile) {
        const result = await window.electronAPI.selectBinFile();
        if (result?.success) {
          setAppFile({
            path: result.path,
            filename: result.filename,
            size: result.size
          });
          // Also set standard downloadedFile so the flash check succeeds
          setDownloadedFile({
            success: true,
            path: result.path,
            filename: result.filename,
            size: result.size
          });
        }
      }
    } catch (e) {
      console.error('Failed to select app binary:', e);
    }
  };

  // Automatically update bootloader offset based on the selected chip
  useEffect(() => {
    if (selectedChip === 'esp32s3' || selectedChip === 'esp32c3') {
      setBootloaderOffset('0x0');
    } else {
      setBootloaderOffset('0x1000');
    }
  }, [selectedChip]);

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

  // Compile sketch
  const handleSelectSketch = async (type) => {
    try {
      if (type === 'file' && window.electronAPI?.selectSketchFile) {
        const result = await window.electronAPI.selectSketchFile();
        if (result?.success) {
          setSketchPath(result.path);
        }
      } else if (type === 'dir' && window.electronAPI?.selectDirectory) {
        const result = await window.electronAPI.selectDirectory();
        if (result?.success) {
          setSketchPath(result.path);
        }
      }
    } catch (e) {
      console.error('Failed to select sketch:', e);
    }
  };

  const handleCompile = async () => {
    if (!sketchPath.trim()) {
      setStatus({ type: 'error', message: 'Please select a sketch (.ino) file or directory first.' });
      return;
    }
    if (!fqbn.trim()) {
      setStatus({ type: 'error', message: 'Please specify the Target Board FQBN.' });
      return;
    }

    setCompiling(true);
    setFlashLogs([`[Client] Initializing sketch compilation sequence...\r\n`]);
    setStatus({ type: 'info', message: 'Compiling sketch...' });
    setDownloadedFile(null);

    try {
      if (window.electronAPI?.compileSketch) {
        const result = await window.electronAPI.compileSketch({
          sketchPath: sketchPath.trim(),
          fqbn: fqbn.trim()
        });

        if (result.success) {
          setDownloadedFile({
            success: true,
            path: result.binaryPath,
            filename: result.binaryPath.split(/[\\/]/).pop(),
            size: 0
          });
          setStatus({ type: 'success', message: '✓ Sketch compiled successfully!' });
        } else {
          const errMsg = result.error || (result.code !== undefined ? `Exit code: ${result.code}` : 'Check logs');
          setStatus({ type: 'error', message: `✗ Compilation failed: ${errMsg}` });
        }
      } else {
        setStatus({ type: 'error', message: 'Compilation API is not available' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: `✗ Error during compile: ${err.message}` });
    } finally {
      setCompiling(false);
    }
  };

  // Switch source tab and reset ready states
  const handleSourceModeChange = (mode) => {
    setSourceMode(mode);
    setDownloadedFile(null);
    setStatus({ type: '', message: '' });
  };

  // Direct local binary selection
  const handleSelectLocalBin = async () => {
    try {
      if (window.electronAPI?.selectBinFile) {
        const result = await window.electronAPI.selectBinFile();
        if (result?.success) {
          setDownloadedFile({
            success: true,
            path: result.path,
            filename: result.filename,
            size: result.size
          });
          setStatus({
            type: 'success',
            message: `✓ Selected local binary successfully! Size: ${Math.round(result.size / 1024)} KB`,
          });
        }
      } else {
        setStatus({ type: 'error', message: 'Binary file picker is not available' });
      }
    } catch (e) {
      console.error('Failed to select local binary:', e);
      setStatus({ type: 'error', message: `✗ Selection error: ${e.message}` });
    }
  };

  // Flash firmware to device
  const handleFlash = async () => {
    if (!downloadedFile) {
      setStatus({ type: 'error', message: 'Please download or compile the firmware binary first' });
      return;
    }

    if (flashTool === 'esptool' && !selectedChip.trim()) {
      setStatus({ type: 'error', message: 'Please specify a Target Chip' });
      return;
    }

    if (flashTool === 'esptool' && !flashOffset.trim()) {
      setStatus({ type: 'error', message: 'Please specify a Flash Offset Address' });
      return;
    }

    setFlashing(true);
    setFlashLogs([`[Client] Initializing upload procedure on port ${selectedPort} using ${flashTool}...\r\n`]);
    setStatus({ type: 'info', message: `Flashing firmware to device...` });

    try {
      if (window.electronAPI?.flashFirmware) {
        const result = await window.electronAPI.flashFirmware({
          tool: flashTool,
          port: selectedPort,
          binaryPath: downloadedFile.path,
          uploadSpeed,
          chip: selectedChip,
          offset: flashOffset,
          flashMode,
          files: flashMode === 'multiple' && sourceMode === 'local' ? [
            { path: bootloaderFile?.path, offset: bootloaderOffset },
            { path: partitionsFile?.path, offset: partitionsOffset },
            { path: appFile?.path, offset: appOffset }
          ].filter(f => f.path) : undefined
        });

        if (result.success) {
          setStatus({ type: 'success', message: '✓ Firmware flashed successfully!' });
        } else {
          const errMsg = result.error || (result.code !== undefined ? `Exit code: ${result.code}` : 'Check console logs');
          setStatus({ type: 'error', message: `✗ Flashing failed: ${errMsg}` });
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
          const errMsg = result.error || (result.code !== undefined ? `Exit code: ${result.code}` : 'Check console logs');
          setStatus({ type: 'error', message: `✗ Erasing failed: ${errMsg}` });
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
          <p>Flash precompiled binaries directly or compile local Arduino sketches to program your boards.</p>
        </div>
      </div>

      <div className="firmware-grid">
        {/* Settings Column */}
        <div className="firmware-card settings-card glass-lg">
          <h3>Configuration</h3>

          {/* Flash Tool & Mode Dropdowns */}
          <div className="form-group-row">
            <div className="form-group flex-1">
              <label>Flashing Tool</label>
              <select
                value={flashTool}
                onChange={(e) => {
                  setFlashTool(e.target.value);
                  if (e.target.value === 'arduino-cli') {
                    setSourceMode('sketch');
                  }
                }}
                disabled={flashing || compiling}
              >
                <option value="esptool">ESPTool (Raw flashing)</option>
                <option value="arduino-cli">Arduino CLI (Upload sketch)</option>
              </select>
            </div>

            <div className="form-group flex-1">
              <label>Flashing Layout</label>
              <select
                value={flashMode}
                onChange={(e) => setFlashMode(e.target.value)}
                disabled={flashing || compiling}
              >
                <option value="single">Single App Bin Only</option>
                <option value="multiple">Multiple Bin Layout (Bootloader/Partitions)</option>
              </select>
            </div>
          </div>

          <hr className="divider" />

          {/* Source Toggle Tabs */}
          <div className="source-tabs">
            <button
              className={`source-tab-btn ${sourceMode === 'download' ? 'active' : ''}`}
              onClick={() => handleSourceModeChange('download')}
              disabled={flashing || compiling || flashTool === 'arduino-cli'}
              title={flashTool === 'arduino-cli' ? 'Must use Sketch mode with Arduino CLI' : ''}
            >
              <FiDownload size={14} /> Download URL
            </button>
            <button
              className={`source-tab-btn ${sourceMode === 'local' ? 'active' : ''}`}
              onClick={() => handleSourceModeChange('local')}
              disabled={flashing || compiling || flashTool === 'arduino-cli'}
              title={flashTool === 'arduino-cli' ? 'Must use Sketch mode with Arduino CLI' : ''}
            >
              <FiFile size={14} /> Local Binary (.bin)
            </button>
            <button
              className={`source-tab-btn ${sourceMode === 'sketch' ? 'active' : ''}`}
              onClick={() => handleSourceModeChange('sketch')}
              disabled={flashing || compiling}
            >
              <FiCode size={14} /> Local Sketch (.ino)
            </button>
          </div>

          {/* Download URL Section */}
          {sourceMode === 'download' && (
            <div className="form-group animate-fadeIn">
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
          )}

          {/* Local Binary Picker Section */}
          {sourceMode === 'local' && flashMode === 'single' && (
            <div className="form-group animate-fadeIn">
              <label>Local Firmware Binary (.bin)</label>
              <div className="input-with-button">
                <input
                  type="text"
                  placeholder="Select local firmware.bin file..."
                  value={downloadedFile && sourceMode === 'local' ? downloadedFile.path : ''}
                  readOnly
                  disabled={flashing}
                />
                <button
                  className="btn btn-secondary gradient-hover"
                  onClick={handleSelectLocalBin}
                  disabled={flashing}
                >
                  <FiFolder /> Browse
                </button>
              </div>
            </div>
          )}

          {/* Multiple Local Binaries Picker Section */}
          {sourceMode === 'local' && flashMode === 'multiple' && (
            <div className="multiple-bin-selectors animate-fadeIn">
              <div className="bin-selector-row">
                <div className="form-group flex-3" style={{ marginBottom: 0 }}>
                  <label>Bootloader Binary (.bin)</label>
                  <div className="input-with-button">
                    <input
                      type="text"
                      placeholder="Select bootloader.bin..."
                      value={bootloaderFile ? bootloaderFile.path : ''}
                      readOnly
                      disabled={flashing}
                    />
                    <button className="btn btn-secondary btn-sm" onClick={handleSelectBootloader} disabled={flashing}>
                      <FiFolder /> Browse
                    </button>
                  </div>
                </div>
                <div className="form-group flex-1" style={{ marginBottom: 0 }}>
                  <label>Address Offset</label>
                  <input
                    type="text"
                    placeholder="0x1000"
                    value={bootloaderOffset}
                    onChange={(e) => setBootloaderOffset(e.target.value)}
                    disabled={flashing}
                  />
                </div>
              </div>

              <div className="bin-selector-row">
                <div className="form-group flex-3" style={{ marginBottom: 0 }}>
                  <label>Partitions Binary (.bin)</label>
                  <div className="input-with-button">
                    <input
                      type="text"
                      placeholder="Select partitions.bin..."
                      value={partitionsFile ? partitionsFile.path : ''}
                      readOnly
                      disabled={flashing}
                    />
                    <button className="btn btn-secondary btn-sm" onClick={handleSelectPartitions} disabled={flashing}>
                      <FiFolder /> Browse
                    </button>
                  </div>
                </div>
                <div className="form-group flex-1" style={{ marginBottom: 0 }}>
                  <label>Address Offset</label>
                  <input
                    type="text"
                    placeholder="0x8000"
                    value={partitionsOffset}
                    onChange={(e) => setPartitionsOffset(e.target.value)}
                    disabled={flashing}
                  />
                </div>
              </div>

              <div className="bin-selector-row">
                <div className="form-group flex-3" style={{ marginBottom: 0 }}>
                  <label>App/Firmware Binary (.bin) *</label>
                  <div className="input-with-button">
                    <input
                      type="text"
                      placeholder="Select firmware.bin..."
                      value={appFile ? appFile.path : ''}
                      readOnly
                      disabled={flashing}
                    />
                    <button className="btn btn-secondary btn-sm" onClick={handleSelectApp} disabled={flashing}>
                      <FiFolder /> Browse
                    </button>
                  </div>
                </div>
                <div className="form-group flex-1" style={{ marginBottom: 0 }}>
                  <label>Address Offset</label>
                  <input
                    type="text"
                    placeholder="0x10000"
                    value={appOffset}
                    onChange={(e) => setAppOffset(e.target.value)}
                    disabled={flashing}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Local Sketch Selection & Compile Section */}
          {sourceMode === 'sketch' && (
            <div className="sketch-compile-section animate-fadeIn">
              <div className="form-group">
                <label>Board FQBN *</label>
                <input
                  type="text"
                  placeholder="e.g. esp32:esp32:esp32 or arduino:avr:uno"
                  value={fqbn}
                  onChange={(e) => setFqbn(e.target.value)}
                  disabled={compiling || flashing}
                />
              </div>

              <div className="form-group">
                <label>Sketch Path (.ino or directory)</label>
                <div className="sketch-path-inputs">
                  <input
                    type="text"
                    placeholder="Select sketch file or directory..."
                    value={sketchPath}
                    onChange={(e) => setSketchPath(e.target.value)}
                    disabled={compiling || flashing}
                  />
                  <div className="sketch-pickers-row">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleSelectSketch('file')}
                      disabled={compiling || flashing}
                      title="Select .ino file"
                    >
                      <FiFile /> File
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleSelectSketch('dir')}
                      disabled={compiling || flashing}
                      title="Select project directory"
                    >
                      <FiFolder /> Folder
                    </button>
                  </div>
                </div>
              </div>

              <button
                className="btn btn-secondary compile-btn"
                onClick={handleCompile}
                disabled={compiling || flashing || !sketchPath.trim()}
              >
                {compiling ? <FiRefreshCw className="spinning" /> : <FiLayers />}
                {compiling ? 'Compiling sketch...' : 'Compile Sketch'}
              </button>
            </div>
          )}

          {downloadedFile && (
            <div className="download-info-pill animate-scaleIn">
              <FiCheckCircle size={16} />
              <span>
                Ready: <strong>{downloadedFile.filename}</strong> {downloadedFile.size > 0 && `(${Math.round(downloadedFile.size / 1024)} KB)`}
              </span>
            </div>
          )}

          <hr className="divider" />

          {/* Serial Port Section */}
          <div className="form-group">
            <label>Serial Connection Port</label>
            <div className="input-with-button">
              <select
                value={selectedPort}
                onChange={(e) => setSelectedPort(e.target.value)}
                disabled={flashing || compiling}
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
                disabled={refreshingPorts || flashing || compiling}
                title="Refresh serial ports"
              >
                <FiRefreshCw className={refreshingPorts ? 'spinning' : ''} />
              </button>
            </div>
          </div>

          {/* Target Chip Type - Only for esptool */}
          {flashTool === 'esptool' && (
            <div className="form-group animate-fadeIn">
              <label>Target Chip Type</label>
              <select
                value={selectedChip}
                onChange={(e) => {
                  setSelectedChip(e.target.value);
                  if (e.target.value === 'esp8266') {
                    setFlashOffset('0x0');
                  } else if (e.target.value === 'esp32s3' || e.target.value === 'esp32c3') {
                    setFlashOffset('0x0');
                  } else {
                    setFlashOffset('0x10000');
                  }
                }}
                disabled={flashing || compiling}
              >
                <option value="esp32">ESP32 (Dev Module)</option>
                <option value="esp32s3">ESP32-S3</option>
                <option value="esp32c3">ESP32-C3</option>
                <option value="esp32s2">ESP32-S2</option>
                <option value="esp8266">ESP8266</option>
              </select>
            </div>
          )}

          {/* Flash Offset - Only for esptool/single or specific layout configurations */}
          {flashTool === 'esptool' && flashMode === 'single' && (
            <div className="form-group animate-fadeIn">
              <label>Flash Offset Address</label>
              <input
                type="text"
                placeholder="0x10000"
                value={flashOffset}
                onChange={(e) => setFlashOffset(e.target.value)}
                disabled={flashing || compiling}
              />
            </div>
          )}

          <div className="form-group">
            <label>Flashing Baud Rate</label>
            <select
              value={uploadSpeed}
              onChange={(e) => setUploadSpeed(e.target.value)}
              disabled={flashing || compiling}
            >
              <option value="921600">921600 (High Speed)</option>
              <option value="460800">460800</option>
              <option value="230400">230400</option>
              <option value="115200">115200 (Standard)</option>
            </select>
          </div>

          {/* Troubleshooting Warning */}
          <div className="troubleshooting-tip glass-sm">
            <FiAlertCircle className="tip-icon" />
            <div className="tip-content">
              <strong>Connection Timeout?</strong> Hold down the <strong>BOOT / FLASH</strong> button on your ESP32 board while the logs show connecting, then release it once flashing starts.
            </div>
          </div>

          <div className="flash-action-group" style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              className="btn btn-primary flash-btn gradient-btn"
              onClick={handleFlash}
              disabled={!downloadedFile || flashing || downloading || compiling}
              style={{ flex: 2, justifyContent: 'center' }}
            >
              {flashing ? <FiRefreshCw className="spinning" /> : <FiZap />}
              {flashing ? 'Flashing...' : 'Flash Firmware'}
            </button>
            
            {/* Erase button - Only available for ESP Tool */}
            {flashTool === 'esptool' && (
              <button
                className="btn btn-secondary erase-btn"
                onClick={handleErase}
                disabled={flashing || downloading || compiling}
                title="Erase Flash (esptool)"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <FiTrash2 /> Erase
              </button>
            )}
            
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
            <h3>Console Operations Log</h3>
            <button
              className="btn btn-text btn-sm"
              onClick={() => setFlashLogs([])}
              disabled={flashing || compiling}
            >
              <FiTrash2 /> Clear Logs
            </button>
          </div>

          <div className="terminal-console">
            {flashLogs.length === 0 ? (
              <span className="terminal-placeholder">Awaiting flash/compile commands...</span>
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
