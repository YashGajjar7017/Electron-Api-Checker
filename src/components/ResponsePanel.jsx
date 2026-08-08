import React, { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import useStore from '../store';
import { FiCopy, FiSearch, FiAlertTriangle, FiDownload, FiRefreshCw, FiSave } from 'react-icons/fi';
import DebugPanel from './DebugPanel';
import '../styles/ResponsePanel.css';

/* ── helpers ─────────────────────────────────────────────── */
const getStatusClass = (status) => {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'info';
  if (status >= 400 && status < 500) return 'warning';
  if (status >= 500) return 'error';
  return 'running';
};

const safeString = (data) => {
  if (data == null) return '';
  return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
};

/**
 * Parse raw Set-Cookie header strings into structured objects.
 * Input:  ["session=abc123; HttpOnly; Path=/", ...]
 * Output: [{ name, value, domain, path, expires, httpOnly, secure }, ...]
 */
const parseCookiesStructured = (headers = []) => {
  if (!headers || !Array.isArray(headers)) return [];

  // headers is an array of [key, value] pairs
  const setCookieEntries = headers.filter(([k]) => k.toLowerCase() === 'set-cookie');
  if (!setCookieEntries.length) return [];

  const results = [];

  setCookieEntries.forEach(([, raw]) => {
    if (!raw) return;
    // A single set-cookie header can contain one cookie (with multiple attributes)
    const parts = String(raw).split(';').map(p => p.trim());
    const [nameValue, ...attrs] = parts;
    if (!nameValue) return;

    const eqIdx = nameValue.indexOf('=');
    const name = eqIdx >= 0 ? nameValue.slice(0, eqIdx).trim() : nameValue.trim();
    const value = eqIdx >= 0 ? nameValue.slice(eqIdx + 1).trim() : '';

    const attrMap = {};
    attrs.forEach(attr => {
      const eqi = attr.indexOf('=');
      const key = (eqi >= 0 ? attr.slice(0, eqi) : attr).trim().toLowerCase();
      const val = eqi >= 0 ? attr.slice(eqi + 1).trim() : '';
      attrMap[key] = val;
    });

    results.push({
      name,
      value,
      domain: attrMap['domain'] || window.location?.hostname || '—',
      path: attrMap['path'] || '/',
      expires: attrMap['expires'] || attrMap['max-age'] ? (attrMap['expires'] || `Max-Age: ${attrMap['max-age']}`) : 'Session',
      httpOnly: 'httponly' in attrMap,
      secure: 'secure' in attrMap,
      sameSite: attrMap['samesite'] || '—',
    });
  });

  return results;
};

/* ── Component ───────────────────────────────────────────── */
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
  // Response detail tabs: body | cookies | headers | tests
  const [detailTab, setDetailTab] = useState('body');

  const responses = useMemo(
    () =>
      responseHistory.map((item, index) => ({
        ...item,
        id: item.id || `response-${index}`,
      })),
    [responseHistory]
  );

  useEffect(() => {
    if (responses.length) {
      setSelectedId(responses[0].id);
    }
  }, [responses.length]);

  const selectedResponse = responses.find((item) => item.id === selectedId) || responses[0] || null;

  const filteredResponses = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    return responses.filter((response) => {
      if (filterStatus !== 'all') {
        if (filterStatus === 'success' && !(response.status >= 200 && response.status < 300)) return false;
        if (filterStatus === 'warning' && !(response.status >= 400 && response.status < 500)) return false;
        if (filterStatus === 'error' && !(response.status >= 500 || response.error)) return false;
      }
      if (!normalized) return true;
      return (
        String(response.apiName || response.endpoint || '').toLowerCase().includes(normalized) ||
        String(response.endpoint || '').toLowerCase().includes(normalized) ||
        String(response.error || '').toLowerCase().includes(normalized) ||
        String(response.status || '').toLowerCase().includes(normalized)
      );
    });
  }, [responses, filterStatus, searchQuery]);

  const responseText = useMemo(() => {
    if (!selectedResponse) return '';
    if (typeof selectedResponse.body === 'string') return selectedResponse.body;
    if (selectedResponse.rawBody) return String(selectedResponse.rawBody);
    return safeString(selectedResponse.body || selectedResponse.data || selectedResponse.response || 'No response payload');
  }, [selectedResponse]);

  const parsedJson = useMemo(() => {
    try { return JSON.stringify(JSON.parse(responseText), null, 2); }
    catch { return responseText; }
  }, [responseText]);

  const cookies = useMemo(
    () => parseCookiesStructured(selectedResponse?.headers),
    [selectedResponse]
  );

  const headers = useMemo(
    () => (selectedResponse?.headers && Array.isArray(selectedResponse.headers) ? selectedResponse.headers : []),
    [selectedResponse]
  );

  // Compute status badge
  const statusClass = getStatusClass(selectedResponse?.status);
  const statusLabel = selectedResponse?.status
    ? `${selectedResponse.status}${selectedResponse.statusText ? ' ' + selectedResponse.statusText : ''}`
    : (selectedResponse?.error ? 'Error' : '—');

  const handleCopyResponse = async () => {
    const text = safeString(selectedResponse?.body || selectedResponse?.rawBody || '');
    await navigator.clipboard.writeText(text || '');
  };

  const handleExportResponse = async () => {
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
    } finally {
      setIsExporting(false);
    }
  };

  const handleRerun = async () => {
    if (!selectedResponse?.endpoint) return;
    try {
      const url = selectedResponse.url || `${serverUrl.replace(/\/$/, '')}${selectedResponse.endpoint}`;
      await window.electronAPI.sendRequest({
        url,
        method: selectedResponse.method || 'GET',
        headers: selectedResponse.headers || {},
        body: ['GET', 'HEAD', 'DELETE'].includes(selectedResponse.method?.toUpperCase()) ? undefined : selectedResponse.body || selectedResponse.rawBody,
      });
    } catch (error) {
      console.warn('Retry failed', error);
    }
  };

  const openDebug = () => {
    if (!selectedResponse) return;
    setDebugRequest({
      url: selectedResponse.url || `${serverUrl.replace(/\/$/, '')}${selectedResponse.endpoint}`,
      method: selectedResponse.method || 'GET',
      headers: selectedResponse.headers || {},
      body: selectedResponse.body || selectedResponse.rawBody || null,
      timestamp: selectedResponse.timestamp || Date.now(),
    });
    setDebugOpen(true);
  };

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div className="response-panel-new glass-lg">
      {/* ── TOP STATUS BAR ── */}
      {selectedResponse && (
        <div className="rp-status-bar">
          <div className="rp-status-left">
            <span className="rp-endpoint-label">
              {selectedResponse.method && (
                <span className={`rp-method method-${(selectedResponse.method || 'get').toLowerCase()}`}>
                  {selectedResponse.method}
                </span>
              )}
              <span className="rp-endpoint-path">
                {selectedResponse.endpoint || selectedResponse.url || 'Response'}
              </span>
            </span>
          </div>
          <div className="rp-status-right">
            <span className={`rp-status-pill status-${statusClass}`}>{statusLabel}</span>
            {selectedResponse.responseTime && (
              <span className="rp-meta-pill">{selectedResponse.responseTime} ms</span>
            )}
            {selectedResponse.responseSize != null && (
              <span className="rp-meta-pill">{Math.round(selectedResponse.responseSize / 10.24) / 100} KB</span>
            )}
            <button className="rp-icon-btn" onClick={handleCopyResponse} title="Copy response">
              <FiCopy size={13} />
            </button>
            <button className="rp-icon-btn" onClick={handleExportResponse} disabled={isExporting} title="Save response">
              <FiSave size={13} />
            </button>
            <button className="rp-icon-btn" onClick={handleRerun} title="Resend request">
              <FiRefreshCw size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ── DETAIL CONTENT ── */}
      {selectedResponse ? (
        <div className="rp-detail">
          {/* Error banner */}
          {selectedResponse.error && (
            <div className="rp-error-banner">
              <FiAlertTriangle size={14} />
              <span>{selectedResponse.error}</span>
            </div>
          )}

          {/* Tab strip — Postman style */}
          <div className="rp-tab-strip">
            <button
              className={`rp-tab ${detailTab === 'body' ? 'active' : ''}`}
              onClick={() => setDetailTab('body')}
            >
              Body
            </button>
            <button
              className={`rp-tab ${detailTab === 'cookies' ? 'active' : ''}`}
              onClick={() => setDetailTab('cookies')}
            >
              Cookies {cookies.length > 0 && <span className="rp-tab-badge">{cookies.length}</span>}
            </button>
            <button
              className={`rp-tab ${detailTab === 'headers' ? 'active' : ''}`}
              onClick={() => setDetailTab('headers')}
            >
              Headers {headers.length > 0 && <span className="rp-tab-badge">{headers.length}</span>}
            </button>
            <button
              className={`rp-tab ${detailTab === 'tests' ? 'active' : ''}`}
              onClick={() => setDetailTab('tests')}
            >
              Test Results
            </button>
            <div className="rp-tab-spacer" />
            {/* Format info pill */}
            {selectedResponse.dataFormat && (
              <span className="rp-format-pill">{selectedResponse.dataFormat.toUpperCase()}</span>
            )}
          </div>

          {/* ── BODY TAB ── */}
          {detailTab === 'body' && (
            <div className="rp-body-panel">
              <Editor
                height="100%"
                language={selectedResponse.dataFormat || 'json'}
                value={parsedJson}
                theme="vs-dark"
                loading={
                  <div style={{
                    background: '#1e1e1e', color: '#888', height: '100%', width: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontFamily: 'monospace'
                  }}>
                    Loading Editor...
                  </div>
                }
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  lineNumbers: 'on',
                  folding: true,
                  theme: 'vs-dark',
                }}
              />
            </div>
          )}

          {/* ── COOKIES TAB ── */}
          {detailTab === 'cookies' && (
            <div className="rp-cookies-panel">
              {cookies.length > 0 ? (
                <table className="rp-cookie-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Value</th>
                      <th>Domain</th>
                      <th>Path</th>
                      <th>Expires</th>
                      <th>HttpOnly</th>
                      <th>Secure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cookies.map((c, i) => (
                      <tr key={i}>
                        <td className="cookie-name">{c.name}</td>
                        <td className="cookie-value" title={c.value}>
                          <span className="cookie-value-text">{c.value}</span>
                          <button
                            className="cookie-copy-btn"
                            onClick={() => navigator.clipboard.writeText(c.value)}
                            title="Copy cookie value"
                          >
                            <FiCopy size={11} />
                          </button>
                        </td>
                        <td>{c.domain}</td>
                        <td>{c.path}</td>
                        <td className="cookie-expires">{c.expires}</td>
                        <td>
                          <span className={`cookie-bool ${c.httpOnly ? 'bool-true' : 'bool-false'}`}>
                            {c.httpOnly ? 'true' : 'false'}
                          </span>
                        </td>
                        <td>
                          <span className={`cookie-bool ${c.secure ? 'bool-true' : 'bool-false'}`}>
                            {c.secure ? 'true' : 'false'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="rp-empty-tab">
                  <span>🍪</span>
                  <p>No cookies in this response</p>
                  <small>Cookies set via <code>Set-Cookie</code> headers will appear here</small>
                </div>
              )}
            </div>
          )}

          {/* ── HEADERS TAB ── */}
          {detailTab === 'headers' && (
            <div className="rp-headers-panel">
              {headers.length > 0 ? (
                <table className="rp-headers-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map(([key, value], idx) => (
                      <tr key={idx}>
                        <td className="header-key-cell">{key}</td>
                        <td className="header-val-cell">{String(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="rp-empty-tab">
                  <span>📋</span>
                  <p>No headers returned</p>
                </div>
              )}
            </div>
          )}

          {/* ── TESTS TAB ── */}
          {detailTab === 'tests' && (
            <div className="rp-empty-tab">
              <span>🧪</span>
              <p>No test scripts configured</p>
              <small>Add test assertions in the <strong>Scripts</strong> tab of the request editor</small>
            </div>
          )}
        </div>
      ) : (
        <div className="rp-empty-state">
          <span>🚀</span>
          <p>Send a request to see the response</p>
          <small>Pick an API from the left panel and click Send</small>
        </div>
      )}

      <DebugPanel isOpen={debugOpen} request={debugRequest} onClose={() => setDebugOpen(false)} />
    </div>
  );
}

export default ResponsePanel;
