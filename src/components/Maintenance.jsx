import React, { useState, useEffect } from 'react';
import useStore from '../store';
import {
  FiZap,
  FiRefreshCw,
  FiAlertTriangle,
  FiCheckCircle,
  FiDownload,
  FiInfo,
  FiServer,
  FiActivity
} from 'react-icons/fi';
import '../styles/Maintenance.css';

function Maintenance() {
  const { settings, updateSettings } = useStore();
  const [xmlUrl, setXmlUrl] = useState(localStorage.getItem('update_xml_url') || 'http://localhost:4222');
  const [status, setStatus] = useState('idle'); // 'idle' | 'checking' | 'downloading' | 'applying' | 'success' | 'error'
  const [currentVersion] = useState('1.2.5');
  const [remoteVersion, setRemoteVersion] = useState(null);
  const [description, setDescription] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [backendStatus, setBackendStatus] = useState(null);

  // Poll local Express backend for status if it is in maintenance mode
  useEffect(() => {
    let intervalId;
    const fetchBackendStatus = async () => {
      try {
        const res = await fetch('http://localhost:5000/maintenance?json=true');
        if (res.ok) {
          const data = await res.json();
          setBackendStatus(data);
          if (data.updateStatus && data.updateStatus !== 'idle') {
            setStatus(data.updateStatus);
            setProgress(data.progress);
            if (data.remoteVersion) setRemoteVersion(data.remoteVersion);
            if (data.error) setErrorMsg(data.error);
          }
        }
      } catch (e) {
        // ignore backend unreachable warnings
      }
    };

    fetchBackendStatus();
    intervalId = setInterval(fetchBackendStatus, 1500);
    return () => clearInterval(intervalId);
  }, []);

  const handleSaveXmlUrl = () => {
    localStorage.setItem('update_xml_url', xmlUrl);
    window.dispatchEvent(
      new CustomEvent('app:toast', {
        detail: {
          message: 'Settings Saved',
          detail: 'XML update check path has been updated locally.',
        },
      })
    );
  };

  const handleCheckUpdate = async () => {
    setStatus('checking');
    setErrorMsg('');
    setRemoteVersion(null);
    setDescription('');
    setDownloadUrl('');

    try {
      // Direct CORS-bypassing proxy request or fetch using electron if available
      let xmlText = '';
      if (window.electronAPI && typeof window.electronAPI.sendRequest === 'function') {
        const response = await window.electronAPI.sendRequest({
          url: xmlUrl,
          method: 'GET'
        });
        if (response.success) {
          xmlText = response.data;
        } else {
          throw new Error(response.error || 'Failed to connect to XML server');
        }
      } else {
        const response = await fetch(xmlUrl);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        xmlText = await response.text();
      }

      // Parse XML using DOMParser
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const version = xmlDoc.getElementsByTagName('version')[0]?.textContent?.trim();
      const url = xmlDoc.getElementsByTagName('url')[0]?.textContent?.trim();
      const desc = xmlDoc.getElementsByTagName('description')[0]?.textContent?.trim() || 'No description.';

      if (!version || !url) {
        throw new Error('Invalid XML schema. Missing <version> or <url> tags.');
      }

      setRemoteVersion(version);
      setDownloadUrl(url);
      setDescription(desc);
      setStatus('idle');

      // Compare versions
      const isNew = compareVersions(version, currentVersion);
      if (isNew) {
        window.dispatchEvent(
          new CustomEvent('app:toast', {
            detail: {
              message: 'Update Available!',
              detail: `A new version (${version}) was found on the remote server.`,
            },
          })
        );
      } else {
        window.dispatchEvent(
          new CustomEvent('app:toast', {
            detail: {
              message: 'System Up To Date',
              detail: `You are running the latest version (${currentVersion}).`,
            },
          })
        );
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to download or parse XML file.');
      setStatus('error');
    }
  };

  const compareVersions = (v1, v2) => {
    const parse = v => v.split('.').map(Number);
    const a = parse(v1);
    const b = parse(v2);
    for (let i = 0; i < 3; i++) {
      if ((a[i] || 0) > (b[i] || 0)) return true;
      if ((a[i] || 0) < (b[i] || 0)) return false;
    }
    return false;
  };

  const handleTriggerUpdate = async () => {
    setStatus('checking');
    setErrorMsg('');

    try {
      // Trigger update on Express backend to simulate the remoteless server execution flow
      const res = await fetch(`http://localhost:5000/maintenance?trigger=true&xmlUrl=${encodeURIComponent(xmlUrl)}&json=true`);
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const data = await res.json();
      setStatus(data.updateStatus);
      setProgress(data.progress);
    } catch (err) {
      setErrorMsg(`Failed to trigger remoteless update: ${err.message}`);
      setStatus('error');
    }
  };

  const handleResetBackendStatus = async () => {
    try {
      await fetch('http://localhost:5000/api/maintenance/reset', { method: 'POST' });
      setStatus('idle');
      setProgress(0);
      setErrorMsg('');
    } catch (e) { }
  };

  const isUpdateAvailable = remoteVersion && compareVersions(remoteVersion, currentVersion);

  return (
    <div className="maintenance-panel animate-fadeIn">
      <div className="panel-header-section">
        <div className="panel-title-area">
          <FiZap className="panel-icon" size={32} />
          <div>
            <h2>Remoteless Maintenance & Update</h2>
            <p className="subtitle">Check remote update servers for version upgrades and deploy remoteless updates</p>
          </div>
        </div>
      </div>

      <div className="panel-content-grid">
        {/* Left Side: Server Config & Check */}
        <div className="grid-column flex-column gap-lg">
          <div className="maintenance-card glass-lg">
            <div className="card-header">
              <FiServer size={20} className="card-icon" />
              <h3>Server Configuration</h3>
            </div>
            <div className="card-body flex-column gap-md">
              <p className="card-description">
                Input the URL pointing to the remote server's update XML index file. The application parses this XML to fetch version details and binary download paths.
              </p>

              <div className="form-group">
                <label htmlFor="xml-url-input">Server XML Check Path</label>
                <div className="input-group">
                  <input
                    id="xml-url-input"
                    type="text"
                    placeholder="e.g. http://localhost:4222"
                    value={xmlUrl}
                    onChange={(e) => setXmlUrl(e.target.value)}
                    disabled={status !== 'idle' && status !== 'error'}
                  />
                </div>
              </div>

              <div className="flex gap-sm">
                <button
                  className="btn btn-secondary flex-grow"
                  onClick={handleSaveXmlUrl}
                  disabled={status !== 'idle' && status !== 'error'}
                >
                  Save Path
                </button>
                <button
                  className="btn btn-primary flex-grow"
                  onClick={handleCheckUpdate}
                  disabled={status !== 'idle' && status !== 'error'}
                >
                  <FiRefreshCw size={14} className={status === 'checking' ? 'spinning' : ''} />
                  <span>Check Version</span>
                </button>
              </div>
            </div>
          </div>

          <div className="maintenance-card glass-lg">
            <div className="card-header">
              <FiInfo size={20} className="card-icon" />
              <h3>Application Version Status</h3>
            </div>
            <div className="card-body flex-column gap-md">
              <div className="version-status-row">
                <div className="version-box">
                  <span className="version-label">Current Version</span>
                  <span className="version-value">{currentVersion}</span>
                </div>
                <div className="version-arrow">&rarr;</div>
                <div className="version-box">
                  <span className="version-label">Latest Version</span>
                  <span className="version-value">{remoteVersion || 'Unknown'}</span>
                </div>
              </div>

              {remoteVersion && (
                <div className={`update-notice-box ${isUpdateAvailable ? 'notice-update' : 'notice-ok'}`}>
                  {isUpdateAvailable ? (
                    <>
                      <FiAlertTriangle className="notice-icon" size={18} />
                      <div>
                        <strong>Update Available!</strong> Version {remoteVersion} has been released.
                      </div>
                    </>
                  ) : (
                    <>
                      <FiCheckCircle className="notice-icon" size={18} />
                      <div>
                        <strong>System Up To Date!</strong> You are running the latest compiled application.
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Deployment & Progress */}
        <div className="grid-column flex-column gap-lg">
          <div className="maintenance-card glass-lg">
            <div className="card-header">
              <FiActivity size={20} className="card-icon" />
              <h3>Update Execution</h3>
            </div>
            <div className="card-body flex-column gap-md">
              <p className="card-description">
                Triggering the update launches a remoteless background routine on the Express backend server (`/maintenance`). It downloads the target code and applies the patch.
              </p>

              {description && (
                <div className="release-notes-box">
                  <h4>Release Info:</h4>
                  <p>{description}</p>
                  {downloadUrl && <code className="download-url-code">{downloadUrl}</code>}
                </div>
              )}

              {status !== 'idle' && (
                <div className="progress-section">
                  <div className="progress-labels">
                    <span className="status-badge-inline">{status}</span>
                    <span className="progress-value">{progress}%</span>
                  </div>
                  <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="update-error-box">
                  <FiAlertTriangle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex gap-sm margin-top-md">
                {status !== 'idle' && status !== 'success' && status !== 'error' ? (
                  <button className="btn btn-secondary flex-grow" disabled>
                    Applying Updates...
                  </button>
                ) : (
                  <>
                    <button
                      className="btn btn-primary flex-grow"
                      onClick={handleTriggerUpdate}
                      disabled={!isUpdateAvailable}
                    >
                      <FiDownload size={14} />
                      <span>Trigger Update</span>
                    </button>
                    {status === 'error' || status === 'success' ? (
                      <button
                        className="btn btn-secondary"
                        onClick={handleResetBackendStatus}
                      >
                        Reset Status
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Maintenance;
