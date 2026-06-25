import React, { useState, useEffect } from 'react';
import useStore from '../store';
import { 
  FiGithub, 
  FiCloud, 
  FiRefreshCw, 
  FiCopy, 
  FiCheck, 
  FiDownload, 
  FiUpload, 
  FiDatabase, 
  FiAlertTriangle, 
  FiInfo, 
  FiBookOpen,
  FiUserCheck
} from 'react-icons/fi';
import GitHubAuth from './GitHubAuth';
import '../styles/GitHubSync.css';

function GitHubSync() {
  const {
    collections,
    setCollections,
    apis,
    setAPIs,
    settings,
    updateSettings,
    user,
  } = useStore();

  const [gistId, setGistId] = useState(settings?.githubGistId || '');
  const [gistInput, setGistInput] = useState(settings?.githubGistId || '');
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // { type: 'success'|'error'|'info', message: string }
  const [logs, setLogs] = useState([]);
  const [copied, setCopied] = useState(false);

  const token = user?.token;
  const isGithubUser = user && user.provider === 'github';

  // Keep state in sync with global settings changes
  useEffect(() => {
    if (settings?.githubGistId) {
      setGistId(settings.githubGistId);
      setGistInput(settings.githubGistId);
    }
  }, [settings?.githubGistId]);

  const handleCopyGistId = () => {
    if (!gistId) return;
    navigator.clipboard.writeText(gistId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveGistId = () => {
    updateSettings({ githubGistId: gistInput.trim() });
    setGistId(gistInput.trim());
    setLogs(prev => [`✓ Gist ID manually updated to: ${gistInput.trim()}`, ...prev]);
    setSyncStatus({ type: 'success', message: 'Gist ID updated successfully!' });
  };

  const handleExport = async () => {
    if (!token) {
      setSyncStatus({ type: 'error', message: 'You must connect to GitHub first!' });
      return;
    }
    
    setIsLoading(true);
    setSyncStatus({ type: 'info', message: 'Serializing local configurations...' });
    
    try {
      const backupData = {
        version: 1,
        lastSyncedAt: new Date().toISOString(),
        collections,
        apis,
        settings: {
          ...settings,
        }
      };
      
      const payload = {
        description: 'API Checker Backup (Collections, APIs & Settings)',
        public: false,
        files: {
          'api-checker-backup.json': {
            content: JSON.stringify(backupData, null, 2)
          }
        }
      };
      
      let response;
      let url = 'https://api.github.com/gists';
      let method = 'POST';
      
      const currentGistId = gistId || settings?.githubGistId;
      if (currentGistId) {
        url = `https://api.github.com/gists/${currentGistId}`;
        method = 'PATCH';
      }
      
      setSyncStatus({ type: 'info', message: currentGistId ? 'Updating existing private Gist...' : 'Creating new private Gist...' });
      
      response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        // If PATCH fails (e.g. gist was deleted on GitHub), fallback to POST (create new one)
        if (currentGistId && (response.status === 404 || response.status === 403)) {
          setSyncStatus({ type: 'info', message: 'Configured Gist not found on GitHub. Creating a new one...' });
          url = 'https://api.github.com/gists';
          method = 'POST';
          response = await fetch(url, {
            method: method,
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });
        }
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub Gist API error: ${response.status} ${errorText}`);
      }
      
      const responseData = await response.json();
      const newGistId = responseData.id;
      
      // Save gist ID locally
      updateSettings({ githubGistId: newGistId });
      setGistId(newGistId);
      setGistInput(newGistId);
      
      // Update logs
      const logMsg = `✓ [${new Date().toLocaleTimeString()}] Cloud backup successful. Gist ID: ${newGistId}`;
      setLogs(prev => [logMsg, ...prev]);
      setSyncStatus({ type: 'success', message: 'Data successfully backed up to GitHub!' });
      
      // Toast notification
      window.dispatchEvent(
        new CustomEvent('app:toast', {
          detail: {
            message: 'Backup Successful',
            detail: 'Successfully synced your local collections and requests to GitHub private Gist.',
          },
        })
      );
    } catch (err) {
      console.error(err);
      setSyncStatus({ type: 'error', message: `Export failed: ${err.message}` });
      setLogs(prev => [`✗ [${new Date().toLocaleTimeString()}] Export failed: ${err.message}`, ...prev]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async (targetGistId = gistInput) => {
    const activeGistId = targetGistId?.trim();
    if (!token) {
      setSyncStatus({ type: 'error', message: 'You must connect to GitHub first!' });
      return;
    }
    
    if (!activeGistId) {
      setSyncStatus({ type: 'error', message: 'Please specify a Gist ID to import.' });
      return;
    }
    
    setIsLoading(true);
    setSyncStatus({ type: 'info', message: 'Fetching backup Gist from GitHub...' });
    
    try {
      const response = await fetch(`https://api.github.com/gists/${activeGistId}`, {
        method: 'GET',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`GitHub Gist API returned ${response.status}`);
      }
      
      const gistData = await response.json();
      const fileContent = gistData.files['api-checker-backup.json']?.content;
      if (!fileContent) {
        throw new Error('Backup file (api-checker-backup.json) not found in the Gist.');
      }
      
      const backupData = JSON.parse(fileContent);
      
      // Apply the configurations to our local state
      if (Array.isArray(backupData.collections)) {
        setCollections(backupData.collections);
        if (window.electronAPI?.saveCollections) {
          await window.electronAPI.saveCollections(backupData.collections);
        }
      }
      
      if (Array.isArray(backupData.apis)) {
        setAPIs(backupData.apis);
        if (window.electronAPI?.saveAPIs) {
          await window.electronAPI.saveAPIs(backupData.apis);
        }
      }
      
      if (backupData.settings) {
        // preserve the imported gist ID just in case
        const mergedSettings = {
          ...backupData.settings,
          githubGistId: activeGistId
        };
        updateSettings(mergedSettings);
      } else {
        updateSettings({ githubGistId: activeGistId });
      }
      
      setGistId(activeGistId);
      setGistInput(activeGistId);
      
      const logMsg = `✓ [${new Date().toLocaleTimeString()}] Cloud restore successful. Restored from Gist: ${activeGistId}`;
      setLogs(prev => [logMsg, ...prev]);
      setSyncStatus({ type: 'success', message: 'Configurations successfully restored from GitHub!' });
      
      // Toast notification
      window.dispatchEvent(
        new CustomEvent('app:toast', {
          detail: {
            message: 'Restore Successful',
            detail: 'Successfully restored all collections, requests and settings from GitHub private Gist.',
          },
        })
      );
    } catch (err) {
      console.error(err);
      setSyncStatus({ type: 'error', message: `Import failed: ${err.message}` });
      setLogs(prev => [`✗ [${new Date().toLocaleTimeString()}] Import failed: ${err.message}`, ...prev]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="github-sync-panel animate-fadeIn">
      <div className="panel-header-section">
        <div className="panel-title-area">
          <FiCloud className="panel-icon" size={32} />
          <div>
            <h2>GitHub Cloud Sync</h2>
            <p className="subtitle">Securely backup, share, and restore your collection variables & requests</p>
          </div>
        </div>
      </div>

      <div className="panel-content-grid">
        {/* Left Side: Auth & Settings */}
        <div className="grid-column flex-column gap-lg">
          <div className="sync-card glass-lg">
            <div className="card-header">
              <FiGithub size={20} className="card-icon" />
              <h3>GitHub Authentication</h3>
            </div>
            <div className="card-body">
              {isGithubUser ? (
                <div className="auth-status-container">
                  <div className="status-badge connected">
                    <FiUserCheck size={14} /> Connected to GitHub
                  </div>
                  <GitHubAuth />
                </div>
              ) : (
                <div className="auth-status-container">
                  <div className="status-badge disconnected">
                    <FiAlertTriangle size={14} /> GitHub Not Connected
                  </div>
                  <p className="card-description">
                    Connect your GitHub account to enable secure cloud backups. Your data is stored as a <strong>private GitHub Gist</strong> on your own profile, completely under your control.
                  </p>
                  <div className="auth-actions-centered">
                    <GitHubAuth />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={`sync-card glass-lg ${!isGithubUser ? 'card-disabled' : ''}`}>
            <div className="card-header">
              <FiDatabase size={20} className="card-icon" />
              <h3>Gist Storage Configuration</h3>
            </div>
            <div className="card-body">
              <p className="card-description">
                Specify a Gist ID below to restore a backup, or leave it empty to automatically create a new private Gist on your first backup.
              </p>
              
              <div className="form-group margin-top-md">
                <label htmlFor="gist-id-input">GitHub Gist ID</label>
                <div className="input-group">
                  <input
                    id="gist-id-input"
                    type="text"
                    placeholder="Auto-generated on first backup, or paste existing ID"
                    value={gistInput}
                    onChange={(e) => setGistInput(e.target.value)}
                    disabled={!isGithubUser || isLoading}
                  />
                  {gistId && (
                    <button 
                      className="btn btn-icon-only copy-btn"
                      onClick={handleCopyGistId}
                      title="Copy Gist ID to clipboard"
                    >
                      {copied ? <FiCheck size={16} /> : <FiCopy size={16} />}
                    </button>
                  )}
                </div>
              </div>
              
              <div className="card-actions flex gap-sm margin-top-md">
                <button
                  className="btn btn-secondary flex-grow"
                  onClick={handleSaveGistId}
                  disabled={!isGithubUser || isLoading || !gistInput.trim()}
                >
                  Save ID
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Sync Controls & Logs */}
        <div className="grid-column flex-column gap-lg">
          <div className={`sync-card glass-lg ${!isGithubUser ? 'card-disabled' : ''}`}>
            <div className="card-header">
              <FiRefreshCw size={20} className="card-icon" />
              <h3>Sync Controls</h3>
            </div>
            <div className="card-body flex-column gap-md">
              <div className="sync-buttons-row">
                <button
                  className="btn btn-primary sync-btn"
                  onClick={handleExport}
                  disabled={!isGithubUser || isLoading}
                >
                  <FiUpload size={16} />
                  <span>Backup to Cloud</span>
                </button>

                <button
                  className="btn btn-secondary sync-btn"
                  onClick={() => handleImport()}
                  disabled={!isGithubUser || isLoading || !gistInput.trim()}
                >
                  <FiDownload size={16} />
                  <span>Restore from Cloud</span>
                </button>
              </div>

              {syncStatus && (
                <div className={`sync-status-alert alert-${syncStatus.type}`}>
                  <FiInfo size={16} />
                  <span>{syncStatus.message}</span>
                </div>
              )}

              <div className="quick-guide-panel">
                <h4><FiBookOpen size={14} /> Cloud Sync Guide</h4>
                <ul>
                  <li><strong>Backup:</strong> Uploads your current collections, requests, and active settings to GitHub.</li>
                  <li><strong>Restore:</strong> Overwrites your local collections and requests with the data fetched from GitHub.</li>
                  <li><strong>New Device:</strong> Copy the Gist ID from your first device, paste it in the Gist Config on your new device, and click Restore.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="sync-card glass-lg flex-grow">
            <div className="card-header">
              <FiInfo size={20} className="card-icon" />
              <h3>Activity Log</h3>
            </div>
            <div className="card-body log-container">
              {logs.length === 0 ? (
                <div className="empty-log-state">
                  No sync activity recorded in this session.
                </div>
              ) : (
                <div className="logs-list">
                  {logs.map((log, index) => (
                    <div key={index} className="log-entry">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GitHubSync;
