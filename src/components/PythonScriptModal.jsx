import React, { useState } from 'react';
import { FiX, FiPlay, FiCopy, FiDownload, FiRefreshCw } from 'react-icons/fi';
import '../styles/PythonScriptModal.css';

function PythonScriptModal({ isOpen, onClose, onRun, isRunning, output, token }) {
  const [copied, setCopied] = useState(false);

  const handleCopyOutput = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadOutput = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `python-script-output-${timestamp}.txt`;
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="python-script-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Python Automation Script</h2>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close modal"
            title="Close"
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="modal-body">
          <div className="script-info">
            <p>
              <strong>Token being used:</strong> {token ? `${token.substring(0, 20)}...` : 'No token set'}
            </p>
            <p className="script-description">
              This script will run the Python automation to fetch API history data with pagination support.
            </p>
          </div>

          <div className="script-controls">
            <button
              className="btn btn-primary"
              onClick={onRun}
              disabled={isRunning || !token}
              title={!token ? 'Please set an authentication token first' : 'Run the Python script'}
            >
              <FiPlay size={18} />
              {isRunning ? 'Running...' : 'Run Script'}
            </button>
          </div>

          <div className="script-output">
            <div className="output-header">
              <h3>Output</h3>
              <div className="output-controls">
                {output && (
                  <>
                    <button
                      className="action-btn"
                      onClick={handleCopyOutput}
                      title="Copy output to clipboard"
                    >
                      <FiCopy size={16} />
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      className="action-btn"
                      onClick={handleDownloadOutput}
                      title="Download output to file"
                    >
                      <FiDownload size={16} />
                      Download
                    </button>
                  </>
                )}
              </div>
            </div>
            <pre className="output-content">
              {output || (isRunning ? 'Waiting for script execution...' : 'No output yet. Click "Run Script" to start.')}
            </pre>
          </div>
        </div>

        <div className="modal-footer">
          <p className="info-text">
            Note: The script will process the data and save results to <code>output.json</code> and <code>output.csv</code>
          </p>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default PythonScriptModal;
