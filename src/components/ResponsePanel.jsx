import React, { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import useStore from '../store';
import { FiCopy, FiSearch, FiAlertTriangle, FiPlayCircle, FiDownload, FiEye } from 'react-icons/fi';
import DebugPanel from './DebugPanel';
import '../styles/ResponsePanel.css';

const getStatusClass = (status) => {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'info';
  if (status >= 400 && status < 500) return 'warning';
  if (status >= 500) return 'error';
  return 'running';
};

const parseCookies = (headers = []) => {
  if (!headers || !Array.isArray(headers)) return [];
  // Find all set-cookie entries (since there can be multiple)
  const cookieEntries = headers.filter(([key]) => key.toLowerCase() === 'set-cookie');
  if (cookieEntries.length === 0) return [];
  
  const cookies = [];
  cookieEntries.forEach(([, value]) => {
    if (value) {
      String(value)
        .split(/,\s*(?=[^;]+=)/)
        .forEach((cookie) => cookies.push(cookie.trim()));
    }
  });
  return cookies;
};

const safeString = (data) => {
  if (data == null) return '';
  return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
};

function ResponsePanel() {
  const { responseHistory, serverUrl } = useStore((state) => ({
    responseHistory: state.responseHistory,
    serverUrl: state.serverUrl,
  }));

  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugRequest, setDebugRequest] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const responses = useMemo(
    () =>
      responseHistory.map((item, index) => ({
        ...item,
        id: item.id || `response-${index}`,
      })),
    [responseHistory]
  );

  useEffect(() => {
    if (!selectedId && responses.length) {
      setSelectedId(responses[0].id);
    }
  }, [responses, selectedId]);

  const selectedResponse = responses.find((item) => item.id === selectedId) || responses[0] || null;

  const filteredResponses = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    return responses.filter((response) => {
      if (filterStatus !== 'all') {
        if (filterStatus === 'success' && !(response.status >= 200 && response.status < 300)) return false;
        if (filterStatus === 'warning' && !(response.status >= 400 && response.status < 500)) return false;
        if (filterStatus === 'error' && !(response.status >= 500 || response.error)) return false;
        if (filterStatus === 'running' && response.status === 0) return false;
      }
      if (!normalized) return true;
      return (
        String(response.apiName || response.endpoint || '')
          .toLowerCase()
          .includes(normalized) ||
        String(response.endpoint || '')
          .toLowerCase()
          .includes(normalized) ||
        String(response.error || '')
          .toLowerCase()
          .includes(normalized) ||
        String(response.status || '')
          .toLowerCase()
          .includes(normalized)
      );
    });
  }, [responses, filterStatus, searchQuery]);

  const summary = useMemo(() => {
    const total = responses.length;
    const success = responses.filter((r) => r.status >= 200 && r.status < 300).length;
    const failed = responses.filter((r) => r.error || r.status >= 500 || r.status === 0).length;
    const avg = total
      ? Math.round(
          responses.reduce((sum, item) => sum + (item.responseTime || item.duration || 0), 0) / total
        )
      : 0;
    return { total, success, failed, avg };
  }, [responses]);

  const responseText = useMemo(() => {
    if (!selectedResponse) return '';
    if (typeof selectedResponse.body === 'string') return selectedResponse.body;
    if (selectedResponse.rawBody) return String(selectedResponse.rawBody);
    return safeString(selectedResponse.body || selectedResponse.data || selectedResponse.response || 'No response payload');
  }, [selectedResponse]);

  const parsedJson = useMemo(() => {
    try {
      return JSON.stringify(JSON.parse(responseText), null, 2);
    } catch {
      return responseText;
    }
  }, [responseText]);



  const handleRerun = async (response) => {
    if (!response || !response.endpoint) return;
    try {
      const url = response.url || `${serverUrl.replace(/\/$/, '')}${response.endpoint}`;
      await window.electronAPI.sendRequest({
        url,
        method: response.method || 'GET',
        headers: response.headers || {},
        body: ['GET', 'HEAD', 'DELETE'].includes(response.method?.toUpperCase()) ? undefined : response.body || response.rawBody,
      });
      setSelectedId(response.id);
    } catch (error) {
      console.warn('Retry failed', error);
    }
  };

  const handleCopyResponse = async (response) => {
    const text = safeString(response?.body || response?.rawBody || response?.data || response?.response || '');
    await navigator.clipboard.writeText(text || '');
  };

  const handleExportResponse = async (response) => {
    if (!response) return;
    setIsExporting(true);
    try {
      const payload = JSON.stringify(response, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `response-${response.id || 'export'}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn('Export failed', error);
    } finally {
      setIsExporting(false);
    }
  };

  const openDebug = (response) => {
    setDebugRequest({
      url: response.url || `${serverUrl.replace(/\/$/, '')}${response.endpoint}`,
      method: response.method || 'GET',
      headers: response.headers || {},
      body: response.body || response.rawBody || null,
      timestamp: response.timestamp || Date.now(),
    });
    setDebugOpen(true);
  };


  return (
    <div className="response-panel-new glass-lg">
      <div className="response-panel-top">
        <div className="response-panel-summary">
          <div>
            <span className="response-label">Batch Results</span>
            <h3>{summary.total} responses</h3>
          </div>
          <div className="response-stats">
            <div className="stat-block success">
              <span>Success</span>
              <strong>{summary.success}</strong>
            </div>
            <div className="stat-block error">
              <span>Failed</span>
              <strong>{summary.failed}</strong>
            </div>
            <div className="stat-block">
              <span>Avg time</span>
              <strong>{summary.avg} ms</strong>
            </div>
          </div>
        </div>

        <div className="response-panel-actions">
          <div className="search-box">
            <FiSearch />
            <input
              type="search"
              placeholder="Search responses"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="success">Success</option>
            <option value="warning">Client warnings</option>
            <option value="error">Server errors</option>
            <option value="running">Running</option>
          </select>
        </div>
      </div>

      <div className="response-panel-content">
        <div className="response-list-strip">
          {filteredResponses.length === 0 ? (
            <div className="empty-state horizontal-empty">
              <p>No matching responses</p>
              <small>Adjust your search or filter criteria.</small>
            </div>
          ) : (
            filteredResponses.map((response) => (
              <div
                key={response.id}
                className={`response-card response-card-horizontal ${getStatusClass(response.status)} ${selectedId === response.id ? 'active' : ''}`}
                onClick={() => setSelectedId(response.id)}
              >
                <div className="card-header">
                  <span className={`method-badge method-${(response.method || 'GET').toLowerCase()}`}>{response.method || 'GET'}</span>
                  <span className="endpoint-preview">{response.endpoint || response.url || 'Unknown'}</span>
                </div>
                <div className="card-meta horizontal-meta">
                  <span className="status-pill">{response.status || (response.error ? 'error' : 'running')}</span>
                  <span>{response.responseTime ? `${response.responseTime}ms` : '—'}</span>
                  <span>{response.responseSize ? `${Math.round(response.responseSize / 1024)} KB` : '—'}</span>
                </div>
                <div className="card-footer horizontal-footer">
                  <span className="card-summary-text">{response.error ? response.error : response.statusText || 'Completed'}</span>
                  <div className="card-actions">
                    <button onClick={(e) => { e.stopPropagation(); handleCopyResponse(response); }} title="Copy payload">
                      <FiCopy />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleRerun(response); }} title="Retry">
                      <FiPlayCircle />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); openDebug(response); }} title="Open debugger">
                      <FiEye />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleExportResponse(response); }} title="Export">
                      <FiDownload />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="response-detail-panel">
          <div className="detail-header">
            <div>
              <h4>{selectedResponse?.apiName || 'Response details'}</h4>
              <p>{selectedResponse?.endpoint || selectedResponse?.url || 'Pick a response to inspect'}</p>
            </div>
            <div className="detail-actions">
              <button onClick={() => handleCopyResponse(selectedResponse)} disabled={!selectedResponse} title="Copy selected payload">
                <FiCopy /> Copy
              </button>
              <button onClick={() => handleExportResponse(selectedResponse)} disabled={!selectedResponse || isExporting} title="Export selected response">
                <FiDownload /> {isExporting ? 'Exporting…' : 'Export'}
              </button>
            </div>
          </div>

          <div className="detail-viewer">
            {selectedResponse ? (
              <div className="detail-viewer-split">
                {/* Left pane: Response Body */}
                <div className="detail-body-container">
                  <div className="panel-sub-header">
                    <h5>Response Body</h5>
                  </div>
                  <div className="response-panel-body">
                    <Editor
                      height="100%"
                      language={selectedResponse.dataFormat || 'json'}
                      value={parsedJson}
                      options={{ readOnly: true, minimap: { enabled: false }, wordWrap: 'on', theme: 'vs-dark' }}
                    />
                  </div>
                </div>

                {/* Right pane: Response Metadata & Headers */}
                <div className="detail-info-container">
                  <div className="panel-sub-header">
                    <h5>Response Details</h5>
                  </div>
                  
                  <div className="info-summary-grid">
                    <div className={`info-summary-card status-${getStatusClass(selectedResponse.status)}`}>
                      <span className="card-label">Status</span>
                      <strong className="card-value">
                        {selectedResponse.status || (selectedResponse.error ? 'Error' : '0')}
                        {selectedResponse.statusText ? ` ${selectedResponse.statusText}` : ''}
                      </strong>
                    </div>
                    <div className="info-summary-card">
                      <span className="card-label">Time</span>
                      <strong className="card-value">
                        {selectedResponse.responseTime ? `${selectedResponse.responseTime} ms` : '—'}
                      </strong>
                    </div>
                    <div className="info-summary-card">
                      <span className="card-label">Size</span>
                      <strong className="card-value">
                        {selectedResponse.responseSize ? `${(selectedResponse.responseSize / 1024).toFixed(2)} KB` : '—'}
                      </strong>
                    </div>
                  </div>

                  {selectedResponse.error && (
                    <div className="detail-error-box">
                      <FiAlertTriangle className="error-icon" style={{ color: '#ef4444' }} />
                      <div className="error-text">
                        <h6>Error Message</h6>
                        <p>{selectedResponse.error}</p>
                      </div>
                    </div>
                  )}

                  <div className="detail-headers-section">
                    <h6>Headers</h6>
                    <div className="headers-table-container">
                      {selectedResponse.headers && Array.isArray(selectedResponse.headers) && selectedResponse.headers.length > 0 ? (
                        <table className="headers-table">
                          <tbody>
                            {selectedResponse.headers.map(([key, value], idx) => (
                              <tr key={idx}>
                                <td className="header-key">{key}</td>
                                <td className="header-value">{String(value)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="no-headers-text">No headers returned</p>
                      )}
                    </div>
                  </div>

                  {parseCookies(selectedResponse.headers).length > 0 && (
                    <div className="detail-cookies-section">
                      <h6>Cookies</h6>
                      <div className="cookies-list">
                        {parseCookies(selectedResponse.headers).map((cookie, idx) => (
                          <div key={idx} className="cookie-item">{cookie}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>No response selected</p>
                <small>Send a request to see the response payload here.</small>
              </div>
            )}
          </div>
        </div>
      </div>

      <DebugPanel isOpen={debugOpen} request={debugRequest} onClose={() => setDebugOpen(false)} />
    </div>
  );
}

export default ResponsePanel;
