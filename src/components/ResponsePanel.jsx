import React, { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import useStore from '../store';
import { FiCopy, FiRefreshCcw, FiSearch, FiCheckCircle, FiAlertTriangle, FiPlayCircle, FiDownload, FiChevronDown, FiEye, FiSliders } from 'react-icons/fi';
import DebugPanel from './DebugPanel';
import '../styles/ResponsePanel.css';

const getStatusClass = (status) => {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'info';
  if (status >= 400 && status < 500) return 'warning';
  if (status >= 500) return 'error';
  return 'running';
};

const parseCookies = (headers = {}) => {
  const raw = headers['set-cookie'] || headers['Set-Cookie'] || '';
  if (!raw) return [];
  return String(raw)
    .split(/,\s*(?=[^;]+=)/)
    .map((cookie) => cookie.trim());
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

  const [activeTab, setActiveTab] = useState('response');
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

  const getPreviewContent = () => {
    if (!responseText) return 'No preview available';
    if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
      return parsedJson;
    }
    return responseText;
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(responseText || '');
  };

  const handleExport = async () => {
    if (!selectedResponse) return;
    setIsExporting(true);
    try {
      const payload = JSON.stringify(selectedResponse, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `response-${selectedResponse.id || 'export'}.json`;
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

  const responseCountLabel = filteredResponses.length === 1 ? 'result' : 'results';

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

          <div className="detail-tabs">
            {/* {['response', 'headers', 'cookies', 'errors', 'timing', 'batch', 'raw', 'preview'].map((tab) => (
              <button
                key={tab}
                className={tab === activeTab ? 'active' : ''}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))} */}
          </div>

          <div className="detail-viewer">
            {activeTab === 'response' && (
              <div className="response-panel-body">
                <Editor
                  height="100%"
                  language="json"
                  value={parsedJson}
                  options={{ readOnly: true, minimap: { enabled: false }, wordWrap: 'on' }}
                />
              </div>
            )}

            {activeTab === 'headers' && (
              <div className="response-fields-grid">
                {selectedResponse?.headers ? (
                  Object.entries(selectedResponse.headers).map(([key, value]) => (
                    <div key={key} className="field-row">
                      <strong>{key}</strong>
                      <span>{String(value)}</span>
                    </div>
                  ))
                ) : (
                  <p>No headers available</p>
                )}
              </div>
            )}

            {activeTab === 'cookies' && (
              <div className="response-fields-grid">
                {parseCookies(selectedResponse?.headers).length > 0 ? (
                  parseCookies(selectedResponse.headers).map((cookie, index) => (
                    <div key={index} className="field-row">
                      <span>{cookie}</span>
                    </div>
                  ))
                ) : (
                  <p>No cookies detected</p>
                )}
              </div>
            )}

            {activeTab === 'errors' && (
              <div className="response-panel-body">
                <pre>{selectedResponse?.error || 'No error logs for this response.'}</pre>
              </div>
            )}

            {activeTab === 'timing' && (
              <div className="response-fields-grid">
                <div className="field-row">
                  <strong>Status</strong>
                  <span>{selectedResponse?.status || 'N/A'}</span>
                </div>
                <div className="field-row">
                  <strong>Duration</strong>
                  <span>{selectedResponse?.responseTime ? `${selectedResponse.responseTime} ms` : 'N/A'}</span>
                </div>
                <div className="field-row">
                  <strong>Payload size</strong>
                  <span>{selectedResponse?.payloadSize ? `${selectedResponse.payloadSize} bytes` : 'N/A'}</span>
                </div>
                <div className="field-row">
                  <strong>Response size</strong>
                  <span>{selectedResponse?.responseSize ? `${Math.round(selectedResponse.responseSize / 1024)} KB` : 'N/A'}</span>
                </div>
                <div className="field-row">
                  <strong>Timestamp</strong>
                  <span>{selectedResponse?.timestamp ? new Date(selectedResponse.timestamp).toLocaleString() : 'N/A'}</span>
                </div>
              </div>
            )}

            {activeTab === 'batch' && (
              <div className="batch-results-grid">
                {responses.slice(0, 10).map((item) => (
                  <div key={item.id} className={`batch-card ${getStatusClass(item.status)}`}>
                    <div className="batch-card-title">
                      <span>{item.apiName || item.endpoint || item.url}</span>
                      <span>{item.status || (item.error ? 'Error' : 'Pending')}</span>
                    </div>
                    <div className="batch-card-meta">
                      <span>{item.method || 'GET'}</span>
                      <span>{item.responseTime ? `${item.responseTime} ms` : '—'}</span>
                      <span>{item.responseSize ? `${Math.round(item.responseSize / 1024)} KB` : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'raw' && (
              <div className="response-panel-body">
                <Editor
                  height="100%"
                  language="text"
                  value={responseText}
                  options={{ readOnly: true, minimap: { enabled: false }, wordWrap: 'on' }}
                />
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="preview-pane">
                <pre>{getPreviewContent()}</pre>
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
