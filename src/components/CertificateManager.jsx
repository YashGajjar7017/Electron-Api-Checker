import React, { useState, useEffect, useRef } from 'react';
import useStore from '../store';
import {
  FiDownload,
  FiUpload,
  FiRefreshCw,
  FiTrash2,
  FiPlay,
  FiAlertCircle,
  FiCheckCircle,
  FiShield,
  FiKey,
  FiCpu,
  FiTerminal,
  FiLock,
  FiFileText,
  FiGlobe
} from 'react-icons/fi';
import '../styles/CertificateManager.css';

function CertificateManager() {
  const imei = useStore((state) => state.globalImei) || '869742085795508';
  const setImei = useStore((state) => state.setGlobalImei);
  const [password, setPassword] = useState(() => localStorage.getItem('cert_password') || '3376b22');
  const [bearerToken, setBearerToken] = useState(() => localStorage.getItem('cert_bearerToken') || '02453');
  const [payloadType, setPayloadType] = useState(() => localStorage.getItem('cert_payloadType') || 'json');

  // Download URLs (with placeholders)
  const [downloadUrls, setDownloadUrls] = useState(() => {
    const saved = localStorage.getItem('cert_downloadUrls');
    return saved ? JSON.parse(saved) : [
      'https://api.iotscada-pmsg.com/api/SSLCert/certdownload?imei={IMEI}&user={IMEI}&pass={PASSWORD}&ctype=1&PROJCD=re',
      'https://api.iotscada-pmsg.com/api/SSLCert/certdownload?imei={IMEI}&user={IMEI}&pass={PASSWORD}&ctype=2&PROJCD=re',
      'https://api.iotscada-pmsg.com/api/SSLCert/certdownload?imei={IMEI}&user={IMEI}&pass={PASSWORD}&ctype=3&PROJCD=re'
    ];
  });

  // Upload POST URLs
  const [postUrls, setPostUrls] = useState(() => {
    const saved = localStorage.getItem('cert_postUrls');
    return saved ? JSON.parse(saved) : [
      'http://192.168.4.1/write.html?filename=rootCA.pem',
      'http://192.168.4.1/write.html?filename=client.pem',
      'http://192.168.4.1/write.html?filename=key.pem'
    ];
  });

  // Acknowledgement URL
  const [ackUrl, setAckUrl] = useState(() => localStorage.getItem('cert_ackUrl') || 'http://localhost:4000/api/status');

  const [provisioning, setProvisioning] = useState(false);
  const [certSources, setCertSources] = useState(() => {
    const saved = localStorage.getItem('cert_certSources');
    return saved ? JSON.parse(saved) : ['url', 'url', 'url'];
  });
  const [caCert, setCaCert] = useState(() => localStorage.getItem('cert_caCert') || '');
  const [clientCert, setClientCert] = useState(() => localStorage.getItem('cert_clientCert') || '');
  const [privateKey, setPrivateKey] = useState(() => localStorage.getItem('cert_privateKey') || '');
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('cert_logs');
    return saved ? JSON.parse(saved) : [];
  });
  const [status, setStatus] = useState({ type: '', message: '' });

  // Track step statuses: 'idle' | 'running' | 'success' | 'failed' | 'skipped'
  const [stepStatuses, setStepStatuses] = useState(() => {
    const saved = localStorage.getItem('cert_stepStatuses');
    return saved ? JSON.parse(saved) : Array(7).fill('idle');
  });

  const logsEndRef = useRef(null);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('cert_password', password);
  }, [password]);

  useEffect(() => {
    localStorage.setItem('cert_bearerToken', bearerToken);
  }, [bearerToken]);

  useEffect(() => {
    localStorage.setItem('cert_payloadType', payloadType);
  }, [payloadType]);

  useEffect(() => {
    localStorage.setItem('cert_downloadUrls', JSON.stringify(downloadUrls));
  }, [downloadUrls]);

  useEffect(() => {
    localStorage.setItem('cert_postUrls', JSON.stringify(postUrls));
  }, [postUrls]);

  useEffect(() => {
    localStorage.setItem('cert_ackUrl', ackUrl);
  }, [ackUrl]);

  useEffect(() => {
    localStorage.setItem('cert_certSources', JSON.stringify(certSources));
  }, [certSources]);

  useEffect(() => {
    localStorage.setItem('cert_caCert', caCert);
  }, [caCert]);

  useEffect(() => {
    localStorage.setItem('cert_clientCert', clientCert);
  }, [clientCert]);

  useEffect(() => {
    localStorage.setItem('cert_privateKey', privateKey);
  }, [privateKey]);

  useEffect(() => {
    localStorage.setItem('cert_logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('cert_stepStatuses', JSON.stringify(stepStatuses));
  }, [stepStatuses]);

  // Parse logs and match steps
  const updateStep = (index, status) => {
    setStepStatuses((prev) => {
      const next = [...prev];
      next[index] = status;
      return next;
    });
  };

  useEffect(() => {
    let unsubscribe = null;
    if (window.electronAPI?.onProvisionLog) {
      unsubscribe = window.electronAPI.onProvisionLog((data) => {
        setLogs((prev) => [...prev, data]);

        const logText = data.toString();

        /*
        // Match step 1 (Download CA)
        if (logText.includes('Downloading Certificate 1')) updateStep(0, 'running');
        else if (logText.includes('Certificate 1 downloaded successfully')) updateStep(0, 'success');
        else if (logText.includes('Failed to download Certificate 1')) updateStep(0, 'failed');
        else if (logText.includes('Skipping (No download URL specified for Certificate 1)')) updateStep(0, 'skipped');

        // Match step 2 (Download Client Cert)
        else if (logText.includes('Downloading Certificate 2')) updateStep(1, 'running');
        else if (logText.includes('Certificate 2 downloaded successfully')) updateStep(1, 'success');
        else if (logText.includes('Failed to download Certificate 2')) updateStep(1, 'failed');
        else if (logText.includes('Skipping (No download URL specified for Certificate 2)')) updateStep(1, 'skipped');

        // Match step 3 (Download Key)
        else if (logText.includes('Downloading Certificate 3')) updateStep(2, 'running');
        else if (logText.includes('Certificate 3 downloaded successfully')) updateStep(2, 'success');
        else if (logText.includes('Failed to download Certificate 3')) updateStep(2, 'failed');
        else if (logText.includes('Skipping (No download URL specified for Certificate 3)')) updateStep(2, 'skipped');

        // Match step 4 (Upload CA)
        else if (logText.includes('Uploading Certificate 1')) updateStep(3, 'running');
        else if (logText.includes('Certificate 1 uploaded successfully')) updateStep(3, 'success');
        else if (logText.includes('Failed to upload Certificate 1')) updateStep(3, 'failed');
        else if (logText.includes('Skipping upload (No downloaded content for Certificate 1)') || logText.includes('Skipping upload (No POST URL specified for Certificate 1)')) updateStep(3, 'skipped');

        // Match step 5 (Upload Client Cert)
        else if (logText.includes('Uploading Certificate 2')) updateStep(4, 'running');
        else if (logText.includes('Certificate 2 uploaded successfully')) updateStep(4, 'success');
        else if (logText.includes('Failed to upload Certificate 2')) updateStep(4, 'failed');
        else if (logText.includes('Skipping upload (No downloaded content for Certificate 2)') || logText.includes('Skipping upload (No POST URL specified for Certificate 2)')) updateStep(4, 'skipped');

        // Match step 6 (Upload Key)
        else if (logText.includes('Uploading Certificate 3')) updateStep(5, 'running');
        else if (logText.includes('Certificate 3 uploaded successfully')) updateStep(5, 'success');
        else if (logText.includes('Failed to upload Certificate 3')) updateStep(5, 'failed');
        else if (logText.includes('Skipping upload (No downloaded content for Certificate 3)') || logText.includes('Skipping upload (No POST URL specified for Certificate 3)')) updateStep(5, 'skipped');

        // Match step 7 (Acknowledgement)
        else if (logText.includes('Sending acknowledgement')) updateStep(6, 'running');
        else if (logText.includes('Acknowledgement sent successfully') || logText.includes('Acknowledgement GET fallback successful')) updateStep(6, 'success');
        else if (logText.includes('Acknowledgement failed')) updateStep(6, 'failed');
        else if (logText.includes('Skipping acknowledgement')) updateStep(6, 'skipped');
        */

        // Match step 1 (Download CA)
        if (logText.includes('Downloading Certificate 1') || logText.includes('Loading directly pasted Certificate 1')) {
          updateStep(0, 'running');
        } else if (logText.includes('Certificate 1 downloaded successfully') || logText.includes('Certificate 1 loaded from local file')) {
          updateStep(0, 'success');
        } else if (logText.includes('Failed to download Certificate 1') || logText.includes('Failed to load pasted Certificate 1')) {
          updateStep(0, 'failed');
        } else if (logText.includes('Skipping (No download URL specified for Certificate 1)')) {
          updateStep(0, 'skipped');
        }

        // Match step 2 (Download Client Cert)
        if (logText.includes('Downloading Certificate 2') || logText.includes('Loading directly pasted Certificate 2')) {
          updateStep(1, 'running');
        } else if (logText.includes('Certificate 2 downloaded successfully') || logText.includes('Certificate 2 loaded from local file')) {
          updateStep(1, 'success');
        } else if (logText.includes('Failed to download Certificate 2') || logText.includes('Failed to load pasted Certificate 2')) {
          updateStep(1, 'failed');
        } else if (logText.includes('Skipping (No download URL specified for Certificate 2)')) {
          updateStep(1, 'skipped');
        }

        // Match step 3 (Download Key)
        if (logText.includes('Downloading Certificate 3') || logText.includes('Loading directly pasted Certificate 3')) {
          updateStep(2, 'running');
        } else if (logText.includes('Certificate 3 downloaded successfully') || logText.includes('Certificate 3 loaded from local file')) {
          updateStep(2, 'success');
        } else if (logText.includes('Failed to download Certificate 3') || logText.includes('Failed to load pasted Certificate 3')) {
          updateStep(2, 'failed');
        } else if (logText.includes('Skipping (No download URL specified for Certificate 3)')) {
          updateStep(2, 'skipped');
        }

        // Match step 4 (Upload CA)
        if (logText.includes('Uploading Certificate 1')) {
          updateStep(3, 'running');
        } else if (logText.includes('Certificate 1 uploaded successfully')) {
          updateStep(3, 'success');
        } else if (logText.includes('Failed to upload Certificate 1')) {
          updateStep(3, 'failed');
        } else if (logText.includes('Skipping upload (No downloaded content for Certificate 1)') || logText.includes('Skipping upload (No POST URL specified for Certificate 1)')) {
          updateStep(3, 'skipped');
        }

        // Match step 5 (Upload Client Cert)
        if (logText.includes('Uploading Certificate 2')) {
          updateStep(4, 'running');
        } else if (logText.includes('Certificate 2 uploaded successfully')) {
          updateStep(4, 'success');
        } else if (logText.includes('Failed to upload Certificate 2')) {
          updateStep(4, 'failed');
        } else if (logText.includes('Skipping upload (No downloaded content for Certificate 2)') || logText.includes('Skipping upload (No POST URL specified for Certificate 2)')) {
          updateStep(4, 'skipped');
        }

        // Match step 6 (Upload Key)
        if (logText.includes('Uploading Certificate 3')) {
          updateStep(5, 'running');
        } else if (logText.includes('Certificate 3 uploaded successfully')) {
          updateStep(5, 'success');
        } else if (logText.includes('Failed to upload Certificate 3')) {
          updateStep(5, 'failed');
        } else if (logText.includes('Skipping upload (No downloaded content for Certificate 3)') || logText.includes('Skipping upload (No POST URL specified for Certificate 3)')) {
          updateStep(5, 'skipped');
        }

        // Match step 7 (Acknowledgement)
        if (logText.includes('Sending acknowledgement')) {
          updateStep(6, 'running');
        } else if (logText.includes('Acknowledgement sent successfully') || logText.includes('Acknowledgement GET fallback successful')) {
          updateStep(6, 'success');
        } else if (logText.includes('Acknowledgement failed')) {
          updateStep(6, 'failed');
        } else if (logText.includes('Skipping acknowledgement')) {
          updateStep(6, 'skipped');
        }
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleProvision = async () => {
    if (!imei.trim()) {
      setStatus({ type: 'error', message: 'Please enter a valid IMEI number' });
      return;
    }

    setProvisioning(true);
    setLogs([`[Client] Launching automated certificate provisioning sequence...\r\n`]);
    setStepStatuses(Array(7).fill('idle'));
    setStatus({ type: 'info', message: 'Executing provisioning chain...' });

    try {
      if (window.electronAPI?.provisionCertificates) {
        const result = await window.electronAPI.provisionCertificates({
          imei: imei.trim(),
          password: password.trim(),
          bearerToken: bearerToken.trim(),
          downloadUrls,
          postUrls,
          ackUrl: ackUrl.trim(),
          payloadType,
          certSources,
          pastedCerts: [caCert, clientCert, privateKey]
        });

        if (result.success) {
          setStatus({ type: 'success', message: '✓ All certificates provisioned and device acknowledged!' });
          setStepStatuses((prev) => prev.map(s => s === 'running' || s === 'idle' || s === 'skipped' ? 'success' : s));
        } else {
          setStatus({ type: 'error', message: `✗ Provisioning failed: ${result.error}` });
        }
      } else {
        setStatus({ type: 'error', message: 'Provisioning API is not available' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: `✗ Error: ${err.message}` });
    } finally {
      setProvisioning(false);
    }
  };

  const updateCertSource = (index, val) => {
    setCertSources((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const updateDownloadUrl = (index, val) => {
    setDownloadUrls((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const updatePostUrl = (index, val) => {
    setPostUrls((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const stepsList = [
    { title: 'Download CA Certificate', desc: 'GET certificate from root authority' },
    { title: 'Download Client Certificate', desc: 'GET device authentication certificate' },
    { title: 'Download Private Key', desc: 'GET device private RSA/ECC key' },
    { title: 'Upload CA to Device', desc: 'POST CA file with Bearer Authorization' },
    { title: 'Upload Cert to Device', desc: 'POST Client cert with Bearer Authorization' },
    { title: 'Upload Key to Device', desc: 'POST Private key with Bearer Authorization' },
    { title: 'Acknowledgement Signal', desc: 'Send completion confirmation status' }
  ];

  return (
    <div className="certificate-manager-page page-transition">
      <div className="certificate-header">
        <div className="header-title-section">
          <h2>Certificate Provisioning</h2>
          <p>Automate downlinking keys using IMEI numbers and uploading credentials directly to IoT devices.</p>
        </div>
      </div>

      <div className="cert-grid">
        {/* Provision Settings Card */}
        <div className="cert-card settings-card glass-lg">
          <h3>Target Credentials</h3>

          <div className="form-group-row">
            <div className="form-group flex-1">
              <label>Device IMEI Number</label>
              <input
                type="text"
                placeholder="e.g. 866082075799826"
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                disabled={provisioning}
              />
            </div>
            <div className="form-group flex-1">
              <label>Device Password / Key</label>
              <div className="input-with-icon">
                <FiKey className="input-icon" />
                <input
                  type="text"
                  placeholder="e.g. 3376b22"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={provisioning}
                  style={{ paddingLeft: '36px' }}
                />
              </div>
            </div>
          </div>

          <div className="form-group-row">
            <div className="form-group flex-1">
              <label>Payload Structure</label>
              <select
                value={payloadType}
                onChange={(e) => setPayloadType(e.target.value)}
                disabled={provisioning}
              >
                <option value="raw">Raw Certificate text/plain</option>
                <option value="json">JSON Wrapped Object</option>
                <option value="form-data">Multipart Form Data</option>
              </select>
            </div>
            <div className="form-group flex-1">
              <label>Bearer Token</label>
              <div className="input-with-icon">
                <FiLock className="input-icon" />
                <input
                  type="password"
                  placeholder="Insert Bearer Provisioning Token..."
                  value={bearerToken}
                  onChange={(e) => setBearerToken(e.target.value)}
                  disabled={provisioning}
                  style={{ paddingLeft: '36px' }}
                />
              </div>
            </div>
          </div>

          <hr className="divider" />

          {/* Download URLs Section */}
          <div className="section-title-wrapper">
            <FiDownload size={14} />
            <h4>1. Certificate Source Configuration (use `{'{IMEI}'}` or `{'{password}'}` for URL variables)</h4>
          </div>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ marginBottom: 0 }}>RootCA Certificate</label>
              <div className="source-toggle">
                <button
                  type="button"
                  className={`btn-toggle ${certSources[0] === 'url' ? 'active' : ''}`}
                  onClick={() => updateCertSource(0, 'url')}
                  disabled={provisioning}
                >URL</button>
                <button
                  type="button"
                  className={`btn-toggle ${certSources[0] === 'paste' ? 'active' : ''}`}
                  onClick={() => updateCertSource(0, 'paste')}
                  disabled={provisioning}
                >Paste</button>
              </div>
            </div>
            {certSources[0] === 'url' ? (
              <input
                type="text"
                placeholder="RootCA Certificate Downlink URL..."
                value={downloadUrls[0]}
                onChange={(e) => updateDownloadUrl(0, e.target.value)}
                disabled={provisioning}
              />
            ) : (
              <textarea
                placeholder="Paste RootCA Certificate content here..."
                value={caCert}
                onChange={(e) => setCaCert(e.target.value)}
                disabled={provisioning}
                rows={4}
                className="cert-textarea"
              />
            )}
          </div>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ marginBottom: 0 }}>Client Certificate</label>
              <div className="source-toggle">
                <button
                  type="button"
                  className={`btn-toggle ${certSources[1] === 'url' ? 'active' : ''}`}
                  onClick={() => updateCertSource(1, 'url')}
                  disabled={provisioning}
                >URL</button>
                <button
                  type="button"
                  className={`btn-toggle ${certSources[1] === 'paste' ? 'active' : ''}`}
                  onClick={() => updateCertSource(1, 'paste')}
                  disabled={provisioning}
                >Paste</button>
              </div>
            </div>
            {certSources[1] === 'url' ? (
              <input
                type="text"
                placeholder="Client Certificate Downlink URL..."
                value={downloadUrls[1]}
                onChange={(e) => updateDownloadUrl(1, e.target.value)}
                disabled={provisioning}
              />
            ) : (
              <textarea
                placeholder="Paste Client Certificate content here..."
                value={clientCert}
                onChange={(e) => setClientCert(e.target.value)}
                disabled={provisioning}
                rows={4}
                className="cert-textarea"
              />
            )}
          </div>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ marginBottom: 0 }}>Private Key</label>
              <div className="source-toggle">
                <button
                  type="button"
                  className={`btn-toggle ${certSources[2] === 'url' ? 'active' : ''}`}
                  onClick={() => updateCertSource(2, 'url')}
                  disabled={provisioning}
                >URL</button>
                <button
                  type="button"
                  className={`btn-toggle ${certSources[2] === 'paste' ? 'active' : ''}`}
                  onClick={() => updateCertSource(2, 'paste')}
                  disabled={provisioning}
                >Paste</button>
              </div>
            </div>
            {certSources[2] === 'url' ? (
              <input
                type="text"
                placeholder="Private Key Downlink URL..."
                value={downloadUrls[2]}
                onChange={(e) => updateDownloadUrl(2, e.target.value)}
                disabled={provisioning}
              />
            ) : (
              <textarea
                placeholder="Paste Private Key content here..."
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                disabled={provisioning}
                rows={4}
                className="cert-textarea"
              />
            )}
          </div>

          <hr className="divider" />

          {/* Upload POST URLs Section */}
          <div className="section-title-wrapper">
            <FiUpload size={14} />
            <h4>2. Device Upload Target endpoints</h4>
          </div>
          <div className="form-group">
            <label>CA Upload URL</label>
            <input
              type="text"
              value={postUrls[0]}
              onChange={(e) => updatePostUrl(0, e.target.value)}
              disabled={provisioning}
            />
          </div>
          <div className="form-group">
            <label>Client Cert Upload URL</label>
            <input
              type="text"
              value={postUrls[1]}
              onChange={(e) => updatePostUrl(1, e.target.value)}
              disabled={provisioning}
            />
          </div>
          <div className="form-group">
            <label>Private Key Upload URL</label>
            <input
              type="text"
              value={postUrls[2]}
              onChange={(e) => updatePostUrl(2, e.target.value)}
              disabled={provisioning}
            />
          </div>

          <hr className="divider" />

          {/* Acknowledgement section */}
          <div className="section-title-wrapper">
            <FiGlobe size={14} />
            <h4>3. Server Acknowledgement endpoint</h4>
          </div>
          <div className="form-group">
            <label>Acknowledgement URL</label>
            <input
              type="text"
              value={ackUrl}
              onChange={(e) => setAckUrl(e.target.value)}
              disabled={provisioning}
            />
          </div>

          <button
            className="btn btn-primary start-provision-btn gradient-btn"
            onClick={handleProvision}
            disabled={provisioning || !imei.trim()}
            style={{ marginTop: '16px', justifyContent: 'center' }}
          >
            {provisioning ? <FiRefreshCw className="spinning" /> : <FiPlay />}
            {provisioning ? 'Provisioning Device...' : 'Start Certificate Provisioning'}
          </button>
        </div>

        {/* Console / Status Progress Column */}
        <div className="cert-panel-right flex-column">
          {/* Progress Tracker Card */}
          <div className="cert-card progress-card glass-lg">
            <h3>Provisioning Pipeline Progress</h3>
            <div className="steps-container">
              {stepsList.map((step, idx) => {
                const stepState = stepStatuses[idx];
                let stateClass = 'step-idle';
                let stateIcon = <div className="step-bullet" />;

                if (stepState === 'running') {
                  stateClass = 'step-running';
                  stateIcon = <FiRefreshCw className="spinning" size={16} />;
                } else if (stepState === 'success') {
                  stateClass = 'step-success';
                  stateIcon = <FiCheckCircle size={18} />;
                } else if (stepState === 'failed') {
                  stateClass = 'step-failed';
                  stateIcon = <FiAlertCircle size={18} />;
                } else if (stepState === 'skipped') {
                  stateClass = 'step-skipped';
                  stateIcon = <FiFileText size={18} />;
                }

                return (
                  <div key={idx} className={`step-row ${stateClass}`}>
                    <div className="step-icon-col">{stateIcon}</div>
                    <div className="step-text-col">
                      <span className="step-title">{step.title}</span>
                      <span className="step-desc">{step.desc}</span>
                    </div>
                    <span className="step-badge">{stepState.toUpperCase()}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Console Output Log Card */}
          <div className="cert-card logs-card glass-lg flex-grow">
            <div className="logs-header">
              <h3>Console Operations Log</h3>
              <button
                className="btn btn-text btn-sm"
                onClick={() => setLogs([])}
                disabled={provisioning}
              >
                <FiTrash2 /> Clear Logs
              </button>
            </div>

            <div className="terminal-console">
              {logs.length === 0 ? (
                <span className="terminal-placeholder">Awaiting provisioning instructions...</span>
              ) : (
                logs.map((log, index) => (
                  <span key={index} className="terminal-line">
                    {log}
                  </span>
                ))
              )}
              <div ref={logsEndRef} />
            </div>

            {status.message && (
              <div className={`status-banner banner-${status.type} animate-fadeIn`}>
                {status.type === 'error' ? (
                  <FiAlertCircle size={18} />
                ) : status.type === 'success' ? (
                  <FiCheckCircle size={18} />
                ) : (
                  <FiRefreshCw className="spinning" size={18} />
                )}
                <span>{status.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CertificateManager;
