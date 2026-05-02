import React, { useState } from 'react';
import useStore from '../store';
import {
  FiCopy,
  FiTrash2,
  FiChevronDown,
  FiPlay,
  FiCheck,
  FiDownload,
  FiSave,
  FiMaximize2,
  FiExternalLink,
} from 'react-icons/fi';
import OutputModal from './OutputModal';
import '../styles/ResponseViewer.css';

function ResponseViewer() {
  const {
    responseHistory,
    clearResponseHistory,
    apis,
    addResponse,
    startBatchTesting,
    stopBatchTesting,
    addBatchResult,
    serverUrl,
    batchStats,
    isBatchTesting,
  } = useStore();

const [expandedResponses, setExpandedResponses] = useState(new Set());
  const [responseTabs, setResponseTabs] = useState({});
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [showBatchSelector, setShowBatchSelector] = useState(false);
  const [selectedAPIs, setSelectedAPIs] = useState(
    new Set(apis.map((api) => api.id))
  );
  const [selectedResponse, setSelectedResponse] = useState(null);

  const toggleResponseExpand = (responseId) => {
    const newExpanded = new Set(expandedResponses);
    if (newExpanded.has(responseId)) {
      newExpanded.delete(responseId);
    } else {
      newExpanded.add(responseId);
    }
    setExpandedResponses(newExpanded);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(
      typeof text === 'string' ? text : JSON.stringify(text, null, 2)
    );
  };

  const getStatusColor = (status) => {
    if (status >= 200 && status < 300) return 'success';
    if (status >= 300 && status < 400) return 'info';
    if (status >= 400 && status < 500) return 'warning';
    if (status >= 500) return 'error';
    return 'default';
  };

  const setResponseTab = (responseId, tab) => {
    setResponseTabs((prev) => ({ ...prev, [responseId]: tab }));
  };

const runBatchTests = async () => {
    const apisToRun = apis.filter((api) => selectedAPIs.has(api.id));

    if (apisToRun.length === 0) {
      alert('Please select at least one API to test');
      return;
    }

    setIsBatchRunning(true);
    startBatchTesting();

    for (const api of apisToRun) {
      try {
        const headers = api.headers || {};
        if (api.auth?.type === 'bearer' && api.auth?.token) {
          headers['Authorization'] = `Bearer ${api.auth.token}`;
        } else if (api.auth?.type === 'basic' && api.auth?.token) {
          headers['Authorization'] = `Basic ${api.auth.token}`;
        }

        const url = serverUrl + api.endpoint;
        const startTime = performance.now();

        const result = await window.electronAPI.sendRequest({
          url,
          method: api.method,
          headers,
          body: ['GET', 'HEAD', 'DELETE'].includes(api.method) ? undefined : api.body,
        });

        const responseTime = performance.now() - startTime;

        if (!result.success) {
          throw new Error(result.error || 'Request failed');
        }

        let responseData;
        try {
          responseData = JSON.parse(result.body);
        } catch {
          responseData = result.body;
        }

        const batchResult = {
          id: Math.random().toString(36).substr(2, 9),
          apiName: api.name,
          method: api.method,
          endpoint: api.endpoint,
          status: result.status,
          statusText: result.statusText,
          responseTime: Math.round(responseTime),
          responseSize: new Blob([result.body]).size,
          headers: result.headers,
          body: responseData,
          rawBody: result.body,
          success: result.status >= 200 && result.status < 300,
        };

        addBatchResult(batchResult);
        addResponse(batchResult);
        setExpandedResponses((prev) => new Set(prev).add(batchResult.id));

        // Add small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        const batchResult = {
          id: Math.random().toString(36).substr(2, 9),
          apiName: api.name,
          method: api.method,
          endpoint: api.endpoint,
          error: error.message,
          status: 0,
          success: false,
        };
        addBatchResult(batchResult);
        addResponse(batchResult);
      }
    }

    stopBatchTesting();
    setIsBatchRunning(false);
  };

  // Export batch results to JSON or CSV
  const exportBatchResults = (format) => {
    if (responseHistory.length === 0) {
      alert('No results to export');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let data, filename, mimeType;

    if (format === 'json') {
      // Export as JSON
      data = JSON.stringify(responseHistory, null, 2);
      filename = `batch-test-results-${timestamp}.json`;
      mimeType = 'application/json';
    } else {
      // Export as CSV
      const headers = ['#', 'API Name', 'Method', 'Endpoint', 'Status', 'Status Text', 'Response Time (ms)', 'Response Size (KB)', 'Success', 'Error'];
      const rows = responseHistory.map((r, i) => [
        i + 1,
        r.apiName || '',
        r.method || '',
        r.endpoint || '',
        r.status || 0,
        r.statusText || '',
        r.responseTime || 0,
        r.responseSize ? (r.responseSize / 1024).toFixed(2) : '0.00',
        r.success ? 'Yes' : 'No',
        r.error || ''
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));

      data = [headers.join(','), ...rows].join('\n');
      filename = `batch-test-results-${timestamp}.csv`;
      mimeType = 'text/csv';
    }

    // Create and download the file
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert(`Batch results exported to ${filename}`);
  };

  const renderJSON = (data) => {
    try {
      const json =
        typeof data === 'string' ? JSON.parse(data) : data;
      return JSON.stringify(json, null, 2);
    } catch {
      return String(data);
    }
  };

  const renderDataFormat = (data, format) => {
    if (format === 'json') {
      return renderJSON(data);
    } else if (format === 'html') {
      return `[HTML Content - ${typeof data === 'string' ? data.length : 0} bytes]`;
    } else if (format === 'xml') {
      return data;
    } else {
      return String(data);
    }
  };

  const getDataFormatLabel = (format) => {
    const labels = {
      json: 'JSON',
      html: 'HTML',
      xml: 'XML',
      text: 'Text',
      string: 'String',
      object: 'Object',
    };
    return labels[format] || format;
  };

  return (
    <div className="response-viewer glass-lg">
      <div className="viewer-header">
        <h3>Responses</h3>
        <div className="viewer-controls">
          {apis.length > 0 && (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowBatchSelector(!showBatchSelector)}
                title="Select APIs to run"
              >
                <FiCheck size={16} />
                Select APIs ({selectedAPIs.size}/{apis.length})
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={runBatchTests}
                disabled={isBatchRunning}
                title="Run selected APIs sequentially"
              >
                <FiPlay size={16} />
                {isBatchRunning ? 'Running...' : 'Batch Test'}
              </button>
            </>
          )}



{responseHistory.length > 0 && (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => exportBatchResults('json')}
                title="Export results to JSON"
              >
                <FiDownload size={16} />
                JSON
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => exportBatchResults('csv')}
                title="Export results to CSV"
              >
                <FiDownload size={16} />
                CSV
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={clearResponseHistory}
                title="Clear all responses"
              >
                <FiTrash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {showBatchSelector && apis.length > 0 && (
        <div className="batch-selector-panel">
          <div className="batch-selector-header">
            <h4>Select APIs to Test</h4>
            <button
              className="btn btn-sm"
              onClick={() => setSelectedAPIs(new Set(apis.map((a) => a.id)))}
            >
              Select All
            </button>
            <button
              className="btn btn-sm"
              onClick={() => setSelectedAPIs(new Set())}
            >
              Deselect All
            </button>
          </div>
          <div className="batch-selector-list">
            {apis.map((api) => (
              <div key={api.id} className="batch-selector-item">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedAPIs.has(api.id)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedAPIs);
                      if (e.target.checked) {
                        newSelected.add(api.id);
                      } else {
                        newSelected.delete(api.id);
                      }
                      setSelectedAPIs(newSelected);
                    }}
                  />
                  <span className={`method-badge method-${api.method.toLowerCase()}`}>
                    {api.method}
                  </span>
                  <span className="api-name">{api.name}</span>
                  <span className="api-endpoint">{api.endpoint}</span>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {batchStats && batchStats.total > 0 && (
        <div className="batch-stats-panel">
          <h4>Batch Test Statistics</h4>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Total Requests</span>
              <span className="stat-value">{batchStats.total}</span>
            </div>
            <div className="stat-card success">
              <span className="stat-label">Successful</span>
              <span className="stat-value">{batchStats.success}</span>
              <span className="stat-percent">({Math.round((batchStats.success / batchStats.total) * 100)}%)</span>
            </div>
            <div className="stat-card error">
              <span className="stat-label">Failed</span>
              <span className="stat-value">{batchStats.failed}</span>
              <span className="stat-percent">({Math.round((batchStats.failed / batchStats.total) * 100)}%)</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Avg Response Time</span>
              <span className="stat-value">{batchStats.avgResponseTime}ms</span>
            </div>
          </div>
        </div>
      )}

      <div className="responses-list">
        {responseHistory.length > 0 ? (
          [...responseHistory].reverse().map((response, index) => (
            <div key={response.id} className="response-item">
              <div className="response-header" onClick={() => toggleResponseExpand(response.id)}>
                <div className="response-title">
                  <FiChevronDown
                    className={`expand-icon ${
                      expandedResponses.has(response.id) ? 'expanded' : ''
                    }`}
                    size={18}
                  />
                  <span className={`method-badge method-${response.method?.toLowerCase()}`}>
                    {response.method}
                  </span>
                  <span className="endpoint">{response.endpoint}</span>
                  <span className={`api-name`}>{response.apiName}</span>
                </div>

                <div className="response-meta">
                  {response.status ? (
                    <>
                      <span className={`status-badge status-${getStatusColor(response.status)}`}>
                        {response.status}
                      </span>
                      <span className="response-time">
                        {response.responseTime}ms
                      </span>
                      <span className="response-size">
                        {(response.responseSize / 1024).toFixed(2)}KB
                      </span>
                      <button
                        className="open-modal-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedResponse(response);
                        }}
                        title="Open in clean view"
                      >
                        <FiExternalLink size={16} />
                      </button>
                    </>
                  ) : (
                    <span className="error-badge">Error</span>
                  )}
                </div>
              </div>

              {expandedResponses.has(response.id) && (
                <div className="response-body">
                  {response.error ? (
                    <div className="error-message">
                      <strong>Error:</strong> {response.error}
                    </div>
                  ) : (
                    <>
                      {response.headers && response.headers.length > 0 && (
                        <div className="headers-section">
                          <h4>Response Headers</h4>
                          <div className="headers-list">
                            {response.headers.map(([key, value], idx) => (
                              <div key={`${key}-${idx}`} className="header-row">
                                <span className="key">{key}:</span>
                                <span className="value">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="response-tabs">
                        {['Output', 'Raw', 'Headers', 'Error'].map((tab) => {
                          if (tab === 'Error' && !response.error) return null;
                          const activeTab = responseTabs[response.id] || 'Output';
                          return (
                            <button
                              key={tab}
                              className={`tab ${activeTab === tab ? 'active' : ''}`}
                              onClick={() => setResponseTab(response.id, tab)}
                            >
                              {tab}
                            </button>
                          );
                        })}
                      </div>

                      <div className="tab-content">
                        {(responseTabs[response.id] || 'Output') === 'Output' && (
<div className="body-section">
                            <div className="body-header">
                              <h4>Response Body {response.dataFormat && <span className="data-format">{getDataFormatLabel(response.dataFormat)}</span>}</h4>
                              <div className="body-actions">
                                <button
                                  className="action-btn"
                                  onClick={() => setSelectedResponse(response)}
                                  title="Open in clean view"
                                >
                                  <FiExternalLink size={16} />
                                </button>
                                <button
                                  className="copy-btn"
                                  onClick={() => copyToClipboard(response.body)}
                                  title="Copy to clipboard"
                                >
                                  <FiCopy size={16} />
                                </button>
                              </div>
                            </div>
                            <pre className="response-code">
                              {renderDataFormat(response.body, response.dataFormat)}
                            </pre>
                          </div>
                        )}

                        {(responseTabs[response.id] || 'Output') === 'Raw' && (
                          <div className="body-section">
                            <div className="body-header">
                              <h4>Raw Response</h4>
                              <button
                                className="copy-btn"
                                onClick={() => copyToClipboard(response.rawBody || response.body)}
                                title="Copy to clipboard"
                              >
                                <FiCopy size={16} />
                              </button>
                            </div>
                            <pre className="response-code raw">
                              {response.rawBody || JSON.stringify(response.body, null, 2)}
                            </pre>
                          </div>
                        )}

                        {(responseTabs[response.id] || 'Output') === 'Headers' && response.headers && (
                          <div className="body-section">
                            <div className="body-header">
                              <h4>Response Headers</h4>
                            </div>
                            <div className="headers-list expanded">
                              {Object.entries(response.headers).map(([key, value]) => (
                                <div key={key} className="header-row">
                                  <span className="key">{key}:</span>
                                  <span className="value">{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(responseTabs[response.id] || 'Output') === 'Error' && response.error && (
                          <div className="body-section">
                            <div className="body-header">
                              <h4>Error Details</h4>
                              <button
                                className="copy-btn"
                                onClick={() => copyToClipboard(response.error)}
                                title="Copy to clipboard"
                              >
                                <FiCopy size={16} />
                              </button>
                            </div>
                            <pre className="response-code error">
                              {response.error}
                            </pre>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>No responses yet</p>
            <p className="text-muted">
              Send a request to see the response here
            </p>
          </div>
)}
      </div>
      {selectedResponse && (
        <OutputModal
          response={selectedResponse}
          onClose={() => setSelectedResponse(null)}
        />
      )}
    </div>
  );
}

export default ResponseViewer;
