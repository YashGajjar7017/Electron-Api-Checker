import React, { useState, useEffect } from 'react';
import { FiX, FiPlus, FiTrash2, FiSave, FiRefreshCw } from 'react-icons/fi';
import '../styles/ArduinoCliConfig.css';

function ArduinoCliConfig({ isOpen, onClose }) {
  const [config, setConfig] = useState({
    cliPath: '',
    boardCore: '',
    boardPackage: '',
    boardName: '',
    port: '',
    serialBaud: '115200',
    outputPath: '',
    debugMode: false,
    useThread: false,
    compileOptions: [],
    uploadOptions: [],
    monitorOptions: [],
  });

  const [newOption, setNewOption] = useState('');
  const [selectedOptionType, setSelectedOptionType] = useState('compile');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Load config from electron storage on mount
  useEffect(() => {
    if (isOpen && window.electronAPI?.loadArduinoConfig) {
      window.electronAPI.loadArduinoConfig().then((savedConfig) => {
        if (savedConfig) {
          setConfig(savedConfig);
        }
      });
    }
  }, [isOpen]);

  const handleInputChange = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
    setErrorMessage('');
  };

  const handleToggleChange = (field) => {
    setConfig((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const addOption = () => {
    if (!newOption.trim()) {
      setErrorMessage('Option cannot be empty');
      return;
    }

    setConfig((prev) => ({
      ...prev,
      [`${selectedOptionType}Options`]: [
        ...(prev[`${selectedOptionType}Options`] || []),
        newOption.trim(),
      ],
    }));

    setNewOption('');
    setErrorMessage('');
  };

  const removeOption = (type, index) => {
    setConfig((prev) => ({
      ...prev,
      [`${type}Options`]: prev[`${type}Options`].filter((_, i) => i !== index),
    }));
  };

  const validateConfig = () => {
    if (!config.cliPath.trim()) {
      setErrorMessage('Arduino CLI path is required');
      return false;
    }
    if (!config.boardCore.trim()) {
      setErrorMessage('Board core is required');
      return false;
    }
    if (!config.boardName.trim()) {
      setErrorMessage('Board name is required');
      return false;
    }
    if (!config.port.trim()) {
      setErrorMessage('Serial port is required');
      return false;
    }
    return true;
  };

  const handleSaveConfig = async () => {
    if (!validateConfig()) {
      return;
    }

    try {
      if (window.electronAPI?.saveArduinoConfig) {
        const result = await window.electronAPI.saveArduinoConfig(config);
        if (result?.success) {
          setSuccessMessage('Arduino CLI configuration saved successfully!');
          setTimeout(() => setSuccessMessage(''), 3000);
        } else {
          setErrorMessage(result?.error || 'Failed to save configuration');
        }
      } else {
        setSuccessMessage('Configuration saved in memory');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      setErrorMessage(`Error saving configuration: ${error.message}`);
    }
  };

  const handleTestConnection = async () => {
    if (!config.cliPath.trim()) {
      setErrorMessage('Please provide Arduino CLI path first');
      return;
    }

    try {
      if (window.electronAPI?.testArduinoConnection) {
        const result = await window.electronAPI.testArduinoConnection(config.cliPath);
        if (result?.success) {
          setSuccessMessage('✓ Arduino CLI connection successful!');
          setTimeout(() => setSuccessMessage(''), 3000);
        } else {
          setErrorMessage(`Connection failed: ${result?.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      setErrorMessage(`Error testing connection: ${error.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="arduino-config-overlay">
      <div className="arduino-config-modal glass-lg">
        <button className="config-close" onClick={onClose}>
          <FiX size={24} />
        </button>

        <div className="config-header">
          <h2>Arduino CLI Configuration</h2>
          <p>Configure Arduino CLI settings for automation and debugging</p>
        </div>

        <div className="config-content">
          {/* Path Configuration */}
          <section className="config-section">
            <h3>CLI Path & Core</h3>
            <div className="config-group">
              <label>Arduino CLI Path *</label>
              <input
                type="text"
                placeholder="/usr/local/bin/arduino-cli or C:\Program Files\Arduino\arduino-cli.exe"
                value={config.cliPath}
                onChange={(e) => handleInputChange('cliPath', e.target.value)}
                className="config-input"
              />
            </div>

            <div className="config-row">
              <div className="config-group">
                <label>Board Package *</label>
                <input
                  type="text"
                  placeholder="e.g., arduino:avr"
                  value={config.boardPackage}
                  onChange={(e) => handleInputChange('boardPackage', e.target.value)}
                  className="config-input"
                />
              </div>
              <div className="config-group">
                <label>Board Core *</label>
                <input
                  type="text"
                  placeholder="e.g., avr, esp32, arm"
                  value={config.boardCore}
                  onChange={(e) => handleInputChange('boardCore', e.target.value)}
                  className="config-input"
                />
              </div>
            </div>

            <div className="config-group">
              <label>Board Name *</label>
              <input
                type="text"
                placeholder="e.g., Arduino Uno (arduino:avr:uno)"
                value={config.boardName}
                onChange={(e) => handleInputChange('boardName', e.target.value)}
                className="config-input"
              />
            </div>
          </section>

          {/* Serial Configuration */}
          <section className="config-section">
            <h3>Serial Communication</h3>
            <div className="config-row">
              <div className="config-group">
                <label>Serial Port *</label>
                <input
                  type="text"
                  placeholder="e.g., /dev/ttyUSB0 or COM3"
                  value={config.port}
                  onChange={(e) => handleInputChange('port', e.target.value)}
                  className="config-input"
                />
              </div>
              <div className="config-group">
                <label>Baud Rate</label>
                <select
                  value={config.serialBaud}
                  onChange={(e) => handleInputChange('serialBaud', e.target.value)}
                  className="config-input"
                >
                  <option value="9600">9600</option>
                  <option value="14400">14400</option>
                  <option value="19200">19200</option>
                  <option value="38400">38400</option>
                  <option value="57600">57600</option>
                  <option value="115200">115200</option>
                  <option value="230400">230400</option>
                </select>
              </div>
            </div>
          </section>

          {/* Output Configuration */}
          <section className="config-section">
            <h3>Output & Debugging</h3>
            <div className="config-group">
              <label>Output Directory</label>
              <input
                type="text"
                placeholder="/output or C:\builds"
                value={config.outputPath}
                onChange={(e) => handleInputChange('outputPath', e.target.value)}
                className="config-input"
              />
            </div>

            <div className="config-checkboxes">
              <label className="config-checkbox">
                <input
                  type="checkbox"
                  checked={config.debugMode}
                  onChange={() => handleToggleChange('debugMode')}
                />
                <span>Debug Mode (verbose output)</span>
              </label>
              <label className="config-checkbox">
                <input
                  type="checkbox"
                  checked={config.useThread}
                  onChange={() => handleToggleChange('useThread')}
                />
                <span>Use Threading (async compilation)</span>
              </label>
            </div>
          </section>

          {/* Compilation Options */}
          <section className="config-section">
            <h3>Compilation Options</h3>
            <div className="config-options-list">
              {config.compileOptions?.map((option, index) => (
                <div key={`compile-${index}`} className="option-item">
                  <span>{option}</span>
                  <button
                    className="option-remove"
                    onClick={() => removeOption('compile', index)}
                    title="Remove option"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            {selectedOptionType === 'compile' && (
              <div className="option-input-group">
                <input
                  type="text"
                  placeholder="e.g., -Wall -Wextra"
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  className="config-input"
                  onKeyPress={(e) => e.key === 'Enter' && addOption()}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={addOption}
                  title="Add compilation option"
                >
                  <FiPlus size={16} />
                </button>
              </div>
            )}
          </section>

          {/* Upload Options */}
          <section className="config-section">
            <h3>Upload Options</h3>
            <div className="config-options-list">
              {config.uploadOptions?.map((option, index) => (
                <div key={`upload-${index}`} className="option-item">
                  <span>{option}</span>
                  <button
                    className="option-remove"
                    onClick={() => removeOption('upload', index)}
                    title="Remove option"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            {selectedOptionType === 'upload' && (
              <div className="option-input-group">
                <input
                  type="text"
                  placeholder="e.g., --use-1200bps-touch"
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  className="config-input"
                  onKeyPress={(e) => e.key === 'Enter' && addOption()}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={addOption}
                  title="Add upload option"
                >
                  <FiPlus size={16} />
                </button>
              </div>
            )}
          </section>

          {/* Monitor Options */}
          <section className="config-section">
            <h3>Monitor Options</h3>
            <div className="config-options-list">
              {config.monitorOptions?.map((option, index) => (
                <div key={`monitor-${index}`} className="option-item">
                  <span>{option}</span>
                  <button
                    className="option-remove"
                    onClick={() => removeOption('monitor', index)}
                    title="Remove option"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            {selectedOptionType === 'monitor' && (
              <div className="option-input-group">
                <input
                  type="text"
                  placeholder="e.g., --config timestamp=true"
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  className="config-input"
                  onKeyPress={(e) => e.key === 'Enter' && addOption()}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={addOption}
                  title="Add monitor option"
                >
                  <FiPlus size={16} />
                </button>
              </div>
            )}
          </section>

          {/* Option Type Selector */}
          <div className="option-type-selector">
            <label>Add Options To:</label>
            <div className="selector-buttons">
              {['compile', 'upload', 'monitor'].map((type) => (
                <button
                  key={type}
                  className={`selector-btn ${selectedOptionType === type ? 'active' : ''}`}
                  onClick={() => setSelectedOptionType(type)}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          {errorMessage && (
            <div className="config-message error-message">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="config-message success-message">
              {successMessage}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="config-footer">
          <button
            className="btn btn-secondary"
            onClick={handleTestConnection}
            title="Test Arduino CLI connection"
          >
            <FiRefreshCw size={16} />
            Test Connection
          </button>
          <div className="footer-spacer"></div>
          <button className="btn btn-text" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSaveConfig}
            title="Save configuration"
          >
            <FiSave size={16} />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}

export default ArduinoCliConfig;
