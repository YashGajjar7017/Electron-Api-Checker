import React, { useState, useEffect } from 'react';
import useStore from '../store';
import { FiWifi, FiLock, FiGlobe, FiCpu, FiSend, FiCheckCircle, FiShield, FiAlertTriangle, FiSettings, FiCheck, FiPlay, FiRefreshCw } from 'react-icons/fi';
import '../styles/RemotePage.css';

function RemotePage() {
  const {
    sessionToken,
    sessionTokenExpiry,
    setSessionToken,
    authToken,
    setAuthToken,
    clearSessionToken,
    globalImei,
    setGlobalImei
  } = useStore();

  const [timeLeft, setTimeLeft] = useState('');

  const hasValidSessionToken = sessionToken && sessionTokenExpiry && Date.now() < sessionTokenExpiry;

  // Saved credentials / profile state (Server 0)
  const imei = globalImei || '869742085795508';
  const setImei = setGlobalImei;
  const [password, setPassword] = useState('db4f247f');
  const [serverUrl, setServerUrl] = useState('rms.iotscada-pmsg.com');
  const [serverPort, setServerPort] = useState('8883');
  const [solutionType, setSolutionType] = useState('ongridrooftop');
  const [suffix, setSuffix] = useState('500092');

  // Custom Ids overrides
  const [customIds, setCustomIds] = useState(false);
  const [clientId, setClientId] = useState('');
  const [username, setUsername] = useState('');

  // Server 1 (Backup) config states
  const [showBackupServer, setShowBackupServer] = useState(() => localStorage.getItem('remote_showBackupServer') === 'true');
  const [imei1, setImei1] = useState('869742085795507');
  const [password1, setPassword1] = useState('5555347c');
  const [serverUrl1, setServerUrl1] = useState('rms.iotscada-pmsg.com');
  const [serverPort1, setServerPort1] = useState('8883');
  const [solutionType1, setSolutionType1] = useState('ongridrooftop');
  const [suffix1, setSuffix1] = useState('500092');
  const [customIds1, setCustomIds1] = useState(false);
  const [clientId1, setClientId1] = useState('');
  const [username1, setUsername1] = useState('');

  // Target POST url
  const [postServerUrl, setPostServerUrl] = useState('http://192.168.4.1/api/config/remote-server');

  // HTTP Sync states
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState(() => localStorage.getItem('remote_postError') || null);
  const [postResponse, setPostResponse] = useState(() => {
    const saved = localStorage.getItem('remote_postResponse');
    return saved ? JSON.parse(saved) : null;
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // General HTTP API tester variables (kept as secondary utility)
  const [requestUrl, setRequestUrl] = useState('https://httpbin.org/post');
  const [requestMethod, setRequestMethod] = useState('POST');
  const [paramLocation, setParamLocation] = useState('body'); // query, headers, body
  const [isLoading, setIsLoading] = useState(false);
  const [errorLog, setErrorLog] = useState(() => localStorage.getItem('remote_errorLog') || null);
  const [responseDetails, setResponseDetails] = useState(() => {
    const saved = localStorage.getItem('remote_responseDetails');
    return saved ? JSON.parse(saved) : null;
  });

  // Auto-generate values
  const genClientId = `d:${imei}$${solutionType}$${suffix}`;
  const genUsername = `${imei}$${solutionType}$${suffix}`;
  const genClientId1 = `d:${imei1}$${solutionType1}$${suffix1}`;
  const genUsername1 = `${imei1}$${solutionType1}$${suffix1}`;

  // Sync responses to localStorage
  useEffect(() => {
    if (postResponse) localStorage.setItem('remote_postResponse', JSON.stringify(postResponse));
    else localStorage.removeItem('remote_postResponse');
  }, [postResponse]);

  useEffect(() => {
    if (responseDetails) localStorage.setItem('remote_responseDetails', JSON.stringify(responseDetails));
    else localStorage.removeItem('remote_responseDetails');
  }, [responseDetails]);

  useEffect(() => {
    if (errorLog) localStorage.setItem('remote_errorLog', errorLog);
    else localStorage.removeItem('remote_errorLog');
  }, [errorLog]);

  useEffect(() => {
    if (postError) localStorage.setItem('remote_postError', postError);
    else localStorage.removeItem('remote_postError');
  }, [postError]);

  useEffect(() => {
    localStorage.setItem('remote_showBackupServer', showBackupServer);
  }, [showBackupServer]);

  // Load saved credentials on mount
  useEffect(() => {
    loadSavedConfig();
  }, []);

  const loadSavedConfig = async () => {
    try {
      if (window.electronAPI?.loadRemoteConfig) {
        const saved = await window.electronAPI.loadRemoteConfig();
        if (saved) {
          if (saved.imei && (!globalImei || globalImei === '869742085795508')) {
            setImei(saved.imei);
          }
          if (saved.password) setPassword(saved.password);
          if (saved.server_url) setServerUrl(saved.server_url);
          if (saved.server_port) setServerPort(saved.server_port);
          if (saved.solution_type) setSolutionType(saved.solution_type);
          if (saved.suffix) setSuffix(saved.suffix);
          if (saved.postServerUrl) setPostServerUrl(saved.postServerUrl);

          if (saved.lastUrl) setRequestUrl(saved.lastUrl);
          if (saved.lastMethod) setRequestMethod(saved.lastMethod);
          if (saved.lastParamLocation) setParamLocation(saved.lastParamLocation);

          if (saved.customIds) {
            setCustomIds(saved.customIds);
            setClientId(saved.client_id || '');
            setUsername(saved.username || '');
          }

          if (saved.showBackupServer !== undefined) setShowBackupServer(saved.showBackupServer);
          if (saved.imei1) setImei1(saved.imei1);
          if (saved.password1) setPassword1(saved.password1);
          if (saved.server_url1) setServerUrl1(saved.server_url1);
          if (saved.server_port1) setServerPort1(saved.server_port1);
          if (saved.solution_type1) setSolutionType1(saved.solution_type1);
          if (saved.suffix1) setSuffix1(saved.suffix1);
          if (saved.customIds1) {
            setCustomIds1(saved.customIds1);
            setClientId1(saved.client_id1 || '');
            setUsername1(saved.username1 || '');
          }
        }
      }
    } catch (e) {
      console.error('Failed to load saved remote configurations:', e);
    }
  };

  // Countdown timer for 10-minute session token
  useEffect(() => {
    const updateTimeLeft = () => {
      if (sessionToken && sessionTokenExpiry) {
        const remaining = sessionTokenExpiry - Date.now();
        if (remaining > 0) {
          const minutes = Math.floor(remaining / 60000);
          const seconds = Math.floor((remaining % 60000) / 1000);
          setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
          return;
        }
      }
      setTimeLeft('');
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [sessionToken, sessionTokenExpiry]);



  const getCompiledJson = () => {
    return {
      server_url: serverUrl,
      server_port: parseInt(serverPort) || 8883,
      solution_type: solutionType,
      client_id: customIds ? clientId : genClientId,
      username: customIds ? username : genUsername,
      password: password,
      server_url1: showBackupServer ? serverUrl1 : '',
      server_port1: showBackupServer ? (parseInt(serverPort1) || 0) : 0,
      solution_type1: showBackupServer ? solutionType1 : '',
      client_id1: showBackupServer ? (customIds1 ? clientId1 : genClientId1) : '',
      username1: showBackupServer ? (customIds1 ? username1 : genUsername1) : '',
      password1: showBackupServer ? password1 : '',
      imei: imei,
      imei1: showBackupServer ? imei1 : ''
    };
  };

  const handleSaveCredentials = async () => {
    try {
      if (window.electronAPI?.saveRemoteConfig) {
        const result = await window.electronAPI.saveRemoteConfig({
          imei,
          password,
          server_url: serverUrl,
          server_port: serverPort,
          solution_type: solutionType,
          suffix,
          postServerUrl,
          customIds,
          client_id: clientId,
          username: username,
          lastUrl: requestUrl,
          lastMethod: requestMethod,
          lastParamLocation: paramLocation,
          showBackupServer,
          imei1,
          password1,
          server_url1: serverUrl1,
          server_port1: serverPort1,
          solution_type1: solutionType1,
          suffix1: suffix1,
          customIds1,
          client_id1: clientId1,
          username1: username1
        });
        if (result?.success) {
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        }
      }
    } catch (e) {
      alert('Error saving remote configs: ' + e.message);
    }
  };

  const handlePostServerConfig = async () => {
    if (!postServerUrl.trim()) {
      alert('Please enter target configuration endpoint.');
      return;
    }

    setIsPosting(true);
    setPostError(null);
    setPostResponse(null);

    const payload = getCompiledJson();
    const startTime = performance.now();

    try {
      if (window.electronAPI?.sendRequest) {
        const token = sessionToken || authToken;
        const requestHeaders = {
          'Content-Type': 'application/json'
        };
        if (token) {
          requestHeaders['Authorization'] = `Bearer ${token}`;
        }

        const res = await window.electronAPI.sendRequest({
          url: postServerUrl.trim(),
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify(payload)
        });

        const latency = Math.round(performance.now() - startTime);

        // Parse response body regardless of success flag
        let responseData = {};
        try {
          responseData = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
        } catch (e) {
          responseData = { raw: res.body };
        }

        // Detect 401 / Unauthorized: check HTTP status AND body flag
        const httpStatus = res.status || 0;
        const isUnauth = httpStatus === 401
          || (responseData && typeof responseData === 'object' && responseData.Flag === false && responseData.Message === 'UNAUTHORIZED');

        // Treat any non-2xx as an error (including when Electron marks success=true but status is bad)
        const isHttpError = httpStatus !== 0 && (httpStatus < 200 || httpStatus >= 300);

        if (isUnauth) {
          clearSessionToken();
          setAuthToken('');
          setPostError(`❌ Unauthorized (HTTP ${httpStatus}): Session token rejected by device. Please re-authenticate.\n\nDevice response: ${JSON.stringify(responseData, null, 2)}`);
        } else if (isHttpError) {
          setPostError(`❌ HTTP ${httpStatus} Error: Device rejected the config.\n\nDevice response: ${JSON.stringify(responseData, null, 2)}`);
        } else if (res.success || httpStatus === 200) {
          setPostResponse({
            status: httpStatus || 200,
            statusText: res.statusText || 'OK',
            latency,
            body: res.body
          });
          // Cache successful options
          await handleSaveCredentials();
        } else {
          setPostError(res.error || 'Server rejected synchronization request.');
        }
      }
    } catch (err) {
      setPostError(err.message);
    } finally {
      setIsPosting(false);
    }
  };

  const handleSendGeneralRequest = async () => {
    if (!requestUrl.trim()) return;
    setIsLoading(true);
    setErrorLog(null);
    setResponseDetails(null);

    const startTime = performance.now();
    let headers = { 'Content-Type': 'application/json' };
    const token = sessionToken || authToken;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    let body = null;
    let urlString = requestUrl.trim();

    if (paramLocation === 'query') {
      const urlObj = new URL(urlString);
      urlObj.searchParams.append('imei', imei);
      urlObj.searchParams.append('password', password);
      urlString = urlObj.toString();
    } else if (paramLocation === 'headers') {
      headers['X-IMEI'] = imei;
      headers['X-Password'] = password;
    } else if (paramLocation === 'body') {
      body = { imei, password };
    }

    try {
      if (window.electronAPI?.sendRequest) {
        const res = await window.electronAPI.sendRequest({
          url: urlString,
          method: requestMethod,
          headers,
          body
        });
        const latency = Math.round(performance.now() - startTime);
        if (res.success) {
          let displayBody = res.body;
          try {
            displayBody = JSON.stringify(JSON.parse(res.body), null, 2);
          } catch (e) { }
          setResponseDetails({
            status: res.status,
            statusText: res.statusText || 'OK',
            latency,
            body: displayBody,
            headers: res.headers || []
          });
        } else {
          setErrorLog(res.error || 'Network request failed.');
        }
      }
    } catch (err) {
      setErrorLog(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="remote-page page-transition">
      <div className="remote-header">
        <h2>Remote Configurations Sync</h2>
        <p>Edit variables for remote telemetry servers, monitor live previews, and push to target monitors.</p>
      </div>

      <div className="remote-grid">
        {/* Left Column: Config Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Target Sync Address bar */}
          <div className="glass-panel" style={{ border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <h3 style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <FiGlobe /> POST Config Server Endpoint
            </h3>
            <div className="url-bar-container">
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--success)', padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px' }}>
                POST
              </span>
              <input
                type="text"
                className="url-input"
                value={postServerUrl}
                onChange={(e) => setPostServerUrl(e.target.value)}
                placeholder="Enter hardware API config endpoint..."
              />
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
              This is the hardware config sync URL. Standard default: <code>http://192.168.4.1/api/config/remote-server</code>
            </p>
          </div>

          {/* Token Status / Input Bar */}
          <div className={`glass-panel token-bar ${hasValidSessionToken ? 'token-active' : 'token-manual'}`}
            style={{
              border: hasValidSessionToken ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
              background: hasValidSessionToken ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.03)',
              padding: '16px',
              borderRadius: '12px',
              transition: 'all 0.3s ease'
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{
                color: hasValidSessionToken ? '#10b981' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: 0,
                fontSize: '14px',
                fontWeight: '600'
              }}>
                <FiLock /> {hasValidSessionToken ? 'Session Token Active' : 'Manual Session Token Required'}
              </h3>
              {hasValidSessionToken && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.15)',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}>
                  Valid for: {timeLeft}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={sessionToken || authToken || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setAuthToken(val);
                  if (val) {
                    setSessionToken(val, 10);
                  } else {
                    clearSessionToken();
                  }
                }}
                disabled={hasValidSessionToken}
                placeholder="Enter authorization token manually..."
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: hasValidSessionToken ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.15)',
                  background: hasValidSessionToken ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0,0,0,0.2)',
                  color: hasValidSessionToken ? '#10b981' : '#ffffff',
                  fontWeight: hasValidSessionToken ? '600' : 'normal',
                  transition: 'all 0.3s ease',
                  outline: 'none'
                }}
              />
              {hasValidSessionToken && (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    clearSessionToken();
                    setAuthToken('');
                  }}
                  style={{ padding: '0 16px', borderColor: '#ef4444', color: '#ef4444', cursor: 'pointer', background: 'transparent', borderRadius: '8px' }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Credentials and Form panels */}
          <div className="credentials-card">
            <h3><FiSettings /> Telemetry Server Config</h3>

            {/* Global save notifications */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary-light)' }}>Primary Server (Server 0)</span>
              <button className="btn btn-secondary btn-sm" onClick={handleSaveCredentials}>
                Save Caches
              </button>
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>IMEI / Cert Number</label>
                <input type="text" value={imei} onChange={(e) => setImei(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Password (Auth)</label>
                <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Server Host URL</label>
                <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Server Port</label>
                <input type="text" value={serverPort} onChange={(e) => setServerPort(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Solution Type</label>
                <input type="text" value={solutionType} onChange={(e) => setSolutionType(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Suffix Number</label>
                <input type="text" value={suffix} onChange={(e) => setSuffix(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
              <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" checked={customIds} onChange={(e) => setCustomIds(e.target.checked)} />
                <span>Customize Client ID & Username manually</span>
              </label>

              {customIds && (
                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
                  <div className="form-group">
                    <label>Client ID</label>
                    <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Username</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '12px', marginTop: '12px' }}>
              <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold', color: 'var(--primary-light)' }}>
                <input type="checkbox" checked={showBackupServer} onChange={(e) => setShowBackupServer(e.target.checked)} />
                <span>Configure Backup Server (Server 1)</span>
              </label>

              {showBackupServer && (
                <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary-light)', borderTop: '1px dashed var(--border-light)', paddingTop: '12px' }}>
                    Backup Server (Server 1)
                  </span>
                  
                  <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label>IMEI / Cert Number 1</label>
                      <input type="text" value={imei1} onChange={(e) => setImei1(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Password (Auth) 1</label>
                      <input type="text" value={password1} onChange={(e) => setPassword1(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Server Host URL 1</label>
                      <input type="text" value={serverUrl1} onChange={(e) => setServerUrl1(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Server Port 1</label>
                      <input type="text" value={serverPort1} onChange={(e) => setServerPort1(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Solution Type 1</label>
                      <input type="text" value={solutionType1} onChange={(e) => setSolutionType1(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Suffix Number 1</label>
                      <input type="text" value={suffix1} onChange={(e) => setSuffix1(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed var(--border-light)', paddingTop: '8px' }}>
                    <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={customIds1} onChange={(e) => setCustomIds1(e.target.checked)} />
                      <span>Customize Backup Client ID & Username manually</span>
                    </label>

                    {customIds1 && (
                      <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
                        <div className="form-group">
                          <label>Client ID 1</label>
                          <input type="text" value={clientId1} onChange={(e) => setClientId1(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label>Username 1</label>
                          <input type="text" value={username1} onChange={(e) => setUsername1(e.target.value)} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>



            {saveSuccess && (
              <div className="save-alert">
                <FiCheckCircle size={14} /> Server connections configuration cached!
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live JSON Preview & POST trigger console */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="panel-header-row">
              <h3>Live Sync Payload Preview</h3>
              <span className="status-badge active">JSON Schema valid</span>
            </div>

            <p className="activation-description" style={{ marginBottom: '8px' }}>
              This structured JSON represents the active variables preview which changes dynamically.
            </p>

            <pre className="response-body-terminal" style={{ height: '360px', color: '#60a5fa' }}>
              {JSON.stringify(getCompiledJson(), null, 2)}
            </pre>

            <button
              className="send-trigger-btn"
              onClick={handlePostServerConfig}
              disabled={isPosting}
              style={{ marginTop: '8px', background: 'var(--success-gradient)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' }}
            >
              <FiSend /> {isPosting ? 'Uploading parameters...' : 'Post Config to Device Server'}
            </button>
          </div>

          {/* Posting Logs terminal */}
          {(postResponse || postError) && (
            <div className="glass-panel animate-fadeIn">
              <h3>Synchronization Diagnostics</h3>
              {postResponse && (
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyBetween: 'space-between', alignItems: 'center' }}>
                    <span className="status-pill success">
                      STATUS: {postResponse.status} {postResponse.statusText}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Latency: {postResponse.latency}ms</span>
                  </div>
                  <div className="activation-log-terminal" style={{ height: '100px' }}>
                    {postResponse.body || 'Config posted successfully. Device accepted payload.'}
                  </div>
                </div>
              )}

              {postError && (
                <div style={{ marginTop: '8px' }}>
                  <span className="status-pill error">POST ERROR</span>
                  <div className="response-body-terminal" style={{ height: '100px', color: 'var(--error)', marginTop: '8px' }}>
                    {postError}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Secondary API Tester panel as backup */}
          <div className="glass-panel" style={{ border: '1px solid var(--border-light)', marginTop: '8px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '8px' }}>Generic HTTP Request Tester</h4>
            <div className="url-bar-container">
              <input
                type="text"
                value={requestUrl}
                onChange={(e) => setRequestUrl(e.target.value)}
                style={{ flexGrow: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: '12px', outline: 'none' }}
              />
              <button className="btn btn-primary btn-sm" onClick={handleSendGeneralRequest} disabled={isLoading}>
                Send
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default RemotePage;
