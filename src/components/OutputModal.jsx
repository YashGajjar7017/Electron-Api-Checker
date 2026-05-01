import React, { useState } from 'react';
import { FiX, FiCopy, FiDownload, FiMaximize2, FiMinimize2 } from 'react-icons/fi';
import '../styles/OutputModal.css';

function OutputModal({ response, onClose }) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeTab, setActiveTab] = useState('output');
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(
      typeof text === 'string' ? text : JSON.stringify(text, null, 2)
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadResponse = () => {
    let content = '';
    let filename = 'response';

    if (activeTab === 'output') {
      content = typeof response.body === 'string' 
        ? response.body 
        : JSON.stringify(response.body, null, 2);
      filename = `response-body-${Date.now()}.json`;
    } else if (activeTab === 'raw') {
      content = response.rawBody || content;
      filename = `response-raw-${Date.now()}.txt`;
    } else if (activeTab === 'headers') {
      content = JSON.stringify(Object.fromEntries(response.headers || []), null, 2);
      filename = `response-headers-${Date.now()}.json`;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderJSON = (data) => {
    try {
      const json = typeof data === 'string' ? JSON.parse(data) : data;
      return JSON.stringify(json, null, 2);
    } catch {
      return String(data);
    }
  };

  const getStatusColor = (status) => {
    if (status >= 200 && status < 300) return 'success';
    if (status >= 300 && status < 400) return 'info';
    if (status >= 400 && status < 500) return 'warning';
    if (status >= 500) return 'error';
    return 'default';
  };

  if (!response) return null;

  const modalClass = isFullScreen ? 'output-modal fullscreen' : 'output-modal';

  return (
    <div className={modalClass}>
      <div className="modal-overlay" onClick={onClose}></div>
      
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-title">
            <span className={`status-badge status-${getStatusColor(response.status)}`}>
              {response.status || 'Error'}
            </span>
            <span className="title-text">Response Viewer</span>
            <span className="response-time">{response.responseTime}ms</span>
          </div>
          
          <div className="modal-actions">
            <button
              className="action-btn"
              onClick={() => copyToClipboard(
                activeTab === 'output' ? response.body 
                : activeTab === 'raw' ? response.rawBody 
                : JSON.stringify(Object.fromEntries(response.headers || []), null, 2)
              )}
              title={copied ? 'Copied!' : 'Copy to clipboard'}
            >
              <FiCopy size={18} />
              {copied && <span className="copy-feedback">Copied!</span>}
            </button>
            
            <button
              className="action-btn"
              onClick={downloadResponse}
              title="Download response"
            >
              <FiDownload size={18} />
            </button>

            <button
              className="action-btn"
              onClick={() => setIsFullScreen(!isFullScreen)}
              title={isFullScreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullScreen ? <FiMinimize2 size={18} /> : <FiMaximize2 size={18} />}
            </button>
            
            <button
              className="action-btn close-btn"
              onClick={onClose}
              title="Close"
            >
              <FiX size={18} />
            </button>
          </div>
        </div>

        <div className="modal-tabs">
          {['output', 'raw', 'headers'].map((tab) => (
            <button
              key={tab}
              className={`tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {response.error ? (
            <div className="error-display">
              <h3>Error</h3>
              <pre>{response.error}</pre>
            </div>
          ) : (
            <>
              {activeTab === 'output' && (
                <div className="output-display">
                  <pre className="response-code">
                    {renderJSON(response.body)}
                  </pre>
                </div>
              )}

              {activeTab === 'raw' && (
                <div className="raw-display">
                  <pre className="response-code raw">
                    {response.rawBody || JSON.stringify(response.body, null, 2)}
                  </pre>
                </div>
              )}

              {activeTab === 'headers' && (
                <div className="headers-display">
                  <div className="headers-content">
                    {response.headers && Array.isArray(response.headers) ? (
                      response.headers.map(([key, value], idx) => (
                        <div key={`${key}-${idx}`} className="header-item">
                          <span className="header-key">{key}:</span>
                          <span className="header-value">{String(value)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="empty-message">No headers available</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <div className="response-info">
            <span className="info-item">Status: {response.status}</span>
            <span className="info-item">Time: {response.responseTime}ms</span>
            <span className="info-item">Size: {response.responseSize ? (response.responseSize / 1024).toFixed(2) : '0'}KB</span>
            <span className="info-item">Method: {response.method}</span>
            <span className="info-item">Endpoint: {response.endpoint}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OutputModal;
