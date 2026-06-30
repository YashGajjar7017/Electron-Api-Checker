import React, { useState } from 'react';
import useStore from '../store';
import Editor from '@monaco-editor/react';
import {
  FiDatabase,
  FiCheckCircle,
  FiAlertTriangle,
  FiDownload,
  FiRefreshCw,
  FiPlay,
  FiServer,
  FiKey,
  FiGlobe,
  FiFolder,
  FiEye,
  FiX
} from 'react-icons/fi';
import axios from 'axios';
import '../styles/MongoDBManager.css';

function MongoDBManager() {
  const { serverUrl } = useStore();
  const [uri, setUri] = useState('mongodb+srv://yashacker:Iamyash@reactdb.d04du.mongodb.net/ReactDB');
  const [status, setStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [collections, setCollections] = useState([]);
  const [parameters, setParameters] = useState(null);
  
  // Export states
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [exportFormat, setExportFormat] = useState('json');
  const [isExporting, setIsExporting] = useState(false);

  // Preview states
  const [previewCollection, setPreviewCollection] = useState(null);
  const [previewDocs, setPreviewDocs] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  React.useEffect(() => {
    const fetchUri = async () => {
      try {
        const response = await axios.get(`${serverUrl || 'http://localhost:5000'}/api/mongodb/config`);
        if (response.data && response.data.success && response.data.uri) {
          setUri(response.data.uri);
        }
      } catch (err) {
        console.error('Failed to fetch MongoDB URI from server:', err);
      }
    };
    fetchUri();
  }, [serverUrl]);

  const handleConnect = async () => {
    if (!uri.trim()) {
      setStatus('error');
      setErrorMsg('MongoDB Connection URI is required');
      return;
    }

    setStatus('connecting');
    setErrorMsg('');
    setCollections([]);
    setParameters(null);
    setPreviewCollection(null);
    setPreviewDocs(null);

    try {
      const response = await axios.post(`${serverUrl}/api/mongodb/connect`, { uri: uri.trim() });
      if (response.data.success) {
        setStatus('connected');
        setCollections(response.data.collections || []);
        setParameters(response.data.parameters);
      } else {
        setStatus('error');
        setErrorMsg(response.data.error || 'Connection failed');
        setParameters(response.data.parameters);
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.response?.data?.error || err.message || 'Connection failed');
    }
  };

  const handleOpenExport = (collection) => {
    setSelectedCollection(collection);
    setShowExportModal(true);
  };

  const handleExport = async () => {
    if (!selectedCollection) return;
    setIsExporting(true);

    try {
      const response = await axios.post(`${serverUrl}/api/mongodb/export`, {
        uri: uri.trim(),
        collectionName: selectedCollection.name,
        format: exportFormat
      });

      if (response.data.success) {
        const dataStr = response.data.data;
        const mimeType = exportFormat === 'csv' ? 'text/csv' : 'application/json';
        const blob = new Blob([dataStr], { type: mimeType });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = response.data.filename || `${selectedCollection.name}.${exportFormat}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
        setShowExportModal(false);
      } else {
        alert('Export failed: ' + (response.data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Export failed: ' + (err.message || 'Network error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handlePreview = async (collection) => {
    setPreviewCollection(collection.name);
    setPreviewLoading(true);
    setPreviewDocs(null);

    try {
      // Fetch data for preview (we'll fetch json format and grab first 5 items)
      const response = await axios.post(`${serverUrl}/api/mongodb/export`, {
        uri: uri.trim(),
        collectionName: collection.name,
        format: 'json'
      });

      if (response.data.success) {
        let docs = [];
        try {
          docs = JSON.parse(response.data.data);
        } catch {
          docs = response.data.data;
        }
        // Slice first 5 documents for clean preview
        if (Array.isArray(docs)) {
          setPreviewDocs(docs.slice(0, 5));
        } else {
          setPreviewDocs(docs);
        }
      } else {
        setPreviewDocs({ error: response.data.error || 'Failed to load preview data' });
      }
    } catch (err) {
      setPreviewDocs({ error: err.message || 'Failed to reach backend server' });
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="mongodb-manager page-transition">
      <div className="mongodb-header">
        <div>
          <h2>MongoDB Connection Manager</h2>
          <p>Parse, test connection parameters, view collections, and run backups/exports on demand.</p>
        </div>
      </div>

      <div className="mongodb-grid">
        {/* Left Column: Form & Connection Status */}
        <div className="glass-panel connection-card">
          <div className="uri-input-group">
            <label>Database Connection URI</label>
            <div className="uri-input-container">
              <input
                type="text"
                className="uri-input"
                placeholder="mongodb+srv://user:pass@host/db"
                value={uri}
                onChange={(e) => setUri(e.target.value)}
              />
              <button
                className="btn btn-primary"
                onClick={handleConnect}
                disabled={status === 'connecting'}
                style={{ minWidth: '130px', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}
              >
                {status === 'connecting' ? (
                  <>
                    <FiRefreshCw className="animate-spin" /> Connecting...
                  </>
                ) : (
                  <>
                    <FiPlay /> Test Connect
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Connection Status Indicator */}
          <div className="status-section">
            <div className={`status-dot ${status}`} />
            <span style={{ fontSize: '13px', fontWeight: '600' }}>
              Status:{' '}
              <span style={{
                color:
                  status === 'connected' ? 'var(--success)' :
                  status === 'error' ? 'var(--error)' :
                  status === 'connecting' ? '#eab308' :
                  'var(--text-muted)'
              }}>
                {status === 'connected' && 'Connected Successfully'}
                {status === 'connecting' && 'Testing Connection...'}
                {status === 'error' && 'Connection Failed'}
                {status === 'disconnected' && 'Disconnected'}
              </span>
            </span>
          </div>

          {/* Error Message if failed */}
          {status === 'error' && errorMsg && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--error)',
              color: 'var(--error)',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}>
              <FiAlertTriangle style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Error Details:</strong>
                <p style={{ margin: '4px 0 0 0', fontFamily: 'monospace', wordBreak: 'break-all' }}>{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Parameter Check list */}
          {parameters && (
            <div>
              <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Parsed Connection Parameters</h4>
              <div className="param-badge-grid">
                <div className="param-badge-card">
                  <span className="label"><FiGlobe size={11} style={{ marginRight: '4px' }} /> Protocol</span>
                  <span className="value">{parameters.protocol}</span>
                </div>
                <div className="param-badge-card">
                  <span className="label"><FiKey size={11} style={{ marginRight: '4px' }} /> Username</span>
                  <span className="value">{parameters.user || '(anonymous)'}</span>
                </div>
                <div className="param-badge-card">
                  <span className="label"><FiKey size={11} style={{ marginRight: '4px' }} /> Password</span>
                  <span className="value" style={{ letterSpacing: '2px' }}>{parameters.password}</span>
                </div>
                <div className="param-badge-card">
                  <span className="label"><FiServer size={11} style={{ marginRight: '4px' }} /> Host Address</span>
                  <span className="value">{parameters.host}</span>
                </div>
                <div className="param-badge-card">
                  <span className="label"><FiDatabase size={11} style={{ marginRight: '4px' }} /> Target Database</span>
                  <span className="value" style={{ color: 'var(--primary-light)' }}>{parameters.database}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Database Collections & Exports */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflow: 'hidden' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: 'var(--text-light)' }}>Collections & Tables</h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
              {status === 'connected' ? `Found ${collections.length} collections` : 'Connect to database to list collections'}
            </p>
          </div>

          {status === 'connected' ? (
            <div className="collections-list">
              {collections.map((coll) => (
                <div key={coll.name} className="collection-item">
                  <div className="collection-info">
                    <span className="collection-name">{coll.name}</span>
                    <span className="collection-meta">
                      <FiFolder size={11} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                      Type: {coll.type} • Documents: {coll.count}
                    </span>
                  </div>
                  <div className="collection-actions">
                    <button
                      className="btn btn-secondary btn-xs"
                      onClick={() => handlePreview(coll)}
                      title="Preview Documents"
                      style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
                    >
                      <FiEye size={12} /> Preview
                    </button>
                    <button
                      className="btn btn-primary btn-xs"
                      onClick={() => handleOpenExport(coll)}
                      title="Export collection"
                      style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
                    >
                      <FiDownload size={12} /> Export
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px',
              border: '1px dashed var(--border)',
              borderRadius: '8px',
              color: 'var(--text-muted)',
              gap: '8px'
            }}>
              <FiDatabase size={28} />
              <span>Offline</span>
            </div>
          )}
        </div>
      </div>

      {/* Document Preview Panel */}
      {previewCollection && (
        <div className="glass-panel" style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-light)' }}>
              📄 Collection Preview: <span style={{ color: 'var(--primary-light)' }}>{previewCollection}</span> (First 5 docs)
            </h3>
            <button
              onClick={() => {
                setPreviewCollection(null);
                setPreviewDocs(null);
              }}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <FiX size={16} />
            </button>
          </div>

          <div style={{ height: '220px', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
            {previewLoading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1e1e', color: '#888' }}>
                <FiRefreshCw className="animate-spin" style={{ marginRight: '8px' }} /> Loading document preview...
              </div>
            ) : (
              <Editor
                height="100%"
                language="json"
                value={previewDocs ? JSON.stringify(previewDocs, null, 2) : '{}'}
                theme="vs-dark"
                options={{ readOnly: true, minimap: { enabled: false }, wordWrap: 'on' }}
                loading={<div style={{ background: '#1e1e1e', height: '100%' }} />}
              />
            )}
          </div>
        </div>
      )}

      {/* Export Modal overlay */}
      {showExportModal && selectedCollection && (
        <div className="export-modal-overlay">
          <div className="export-modal">
            <h3>Export Collection: {selectedCollection.name}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Format</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                style={{
                  padding: '8px',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-light)',
                  borderRadius: '4px'
                }}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
            </div>
            <div className="export-modal-actions">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowExportModal(false)}
                disabled={isExporting}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleExport}
                disabled={isExporting}
                style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
              >
                {isExporting ? <FiRefreshCw className="animate-spin" /> : <FiDownload />}
                {isExporting ? 'Exporting...' : 'Export File'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MongoDBManager;
