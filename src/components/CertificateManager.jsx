import React, { useState, useEffect, useRef } from 'react';
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
  const [imei, setImei] = useState('');
  const [bearerToken, setBearerToken] = useState('');
  const [payloadType, setPayloadType] = useState('json');

  // Download URLs (with placeholders)
  const [downloadUrls, setDownloadUrls] = useState([
    'https://api.example.com/certificates/ca?imei={IMEI}',
    'https://api.example.com/certificates/client?imei={IMEI}',
    'https://api.example.com/certificates/key?imei={IMEI}'
  ]);

  // Upload POST URLs
  const [postUrls, setPostUrls] = useState([
    'http://192.168.4.1/api/cert/ca',
    'http://192.168.4.1/api/cert/client',
    'http://192.168.4.1/api/cert/key'
  ]);

  // Acknowledgement URL
  const [ackUrl, setAckUrl] = useState('https://api.example.com/provision/ack?imei={IMEI}');

  const [provisioning, setProvisioning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState({ type: '', message: '' });

  // Track step statuses: 'idle' | 'running' | 'success' | 'failed' | 'skipped'
  const [stepStatuses, setStepStatuses] = useState(Array(7).fill('idle'));

  const logsEndRef = useRef(null);

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
          bearerToken: bearerToken.trim(),
          downloadUrls,
          postUrls,
          ackUrl: ackUrl.trim(),
          payloadType
        });

        if (result.success) {
          setStatus({ type: 'success', message: '✓ All certificates provisioned and device acknowledged!' });
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
          </div>

          <div className="form-group">
            <label>Bearer Token (Authorization Header)</label>
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

          <hr className="divider" />

          {/* Download URLs Section */}
          <div className="section-title-wrapper">
            <FiDownload size={14} />
            <h4>1. Download Certificate Sources (use `{'{IMEI}'}` variable)</h4>
          </div>
          <div className="form-group">
            <label>RootCA Certificate Downlink</label>
            <input
              type="text"
              value={downloadUrls[0]}
              onChange={(e) => updateDownloadUrl(0, e.target.value)}
              disabled={provisioning}
            />
          </div>
          <div className="form-group">
            <label>Client Certificate Downlink</label>
            <input
              type="text"
              value={downloadUrls[1]}
              onChange={(e) => updateDownloadUrl(1, e.target.value)}
              disabled={provisioning}
            />
          </div>
          <div className="form-group">
            <label>Private Key Downlink</label>
            <input
              type="text"
              value={downloadUrls[2]}
              onChange={(e) => updateDownloadUrl(2, e.target.value)}
              disabled={provisioning}
            />
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
