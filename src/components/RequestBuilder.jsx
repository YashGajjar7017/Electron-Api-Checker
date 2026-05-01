import React, { useState, useEffect, useRef } from 'react';
import useStore from '../store';
import Editor from '@monaco-editor/react';
import {
  FiSend,
  FiSave,
  FiEdit2,
  FiX,
  FiPlus,
  FiTrash2,
  FiPlay,
  FiRefreshCw,
  FiSettings,
} from 'react-icons/fi';
import OTPModal from './OTPModal';
import '../styles/RequestBuilder.css';

function RequestBuilder() {
const {
    currentAPI,
    updateAPI,
    deleteAPI,
    setCurrentAPI,
    serverUrl,
    addResponse,
    apis,
    sessionToken,
    sessionTokenExpiry,
    setSessionToken,
    clearSessionToken,
  } = useStore();

const [activeTab, setActiveTab] = useState('params');
  const [isSending, setIsSending] = useState(false);
  const [apiName, setApiName] = useState(currentAPI?.name || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [method, setMethod] = useState(currentAPI?.method || 'GET');
  const [endpoint, setEndpoint] = useState(currentAPI?.endpoint || '');
  const [headers, setHeaders] = useState(currentAPI?.headers || {});
  const [params, setParams] = useState(currentAPI?.params || {});
  const [body, setBody] = useState(currentAPI?.body || '');
  const [bodyType, setBodyType] = useState(currentAPI?.bodyType || 'none');
  const [authType, setAuthType] = useState(currentAPI?.auth?.type || 'none');
  const [authTokenState, setAuthTokenLocal] = useState(
    currentAPI?.auth?.token || ''
  );
  const [certFile, setCertFile] = useState(currentAPI?.auth?.certFile || '');
  const [keyFile, setKeyFile] = useState(currentAPI?.auth?.keyFile || '');
  const [caFile, setCaFile] = useState(currentAPI?.auth?.caFile || '');
  const [skipOtp, setSkipOtp] = useState(currentAPI?.skipOtp || false);
  const [newHeaderKey, setNewHeaderKey] = useState('');
  const [newHeaderValue, setNewHeaderValue] = useState('');
  const [newParamKey, setNewParamKey] = useState('');
  const [newParamValue, setNewParamValue] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const pendingSendRef = useRef(false);
const [docs, setDocs] = useState(currentAPI?.docs || '');

  // Automation state
  const [automationEnabled, setAutomationEnabled] = useState(currentAPI?.automation?.enabled || false);
  const [automationVariable, setAutomationVariable] = useState(currentAPI?.automation?.variable || '{{id}}');
  const [automationStart, setAutomationStart] = useState(currentAPI?.automation?.start || 1);
  const [automationEnd, setAutomationEnd] = useState(currentAPI?.automation?.end || 10);
  const [automationStep, setAutomationStep] = useState(currentAPI?.automation?.step || 1);
  const [automationPadding, setAutomationPadding] = useState(currentAPI?.automation?.padding || 0);
  const [automationDelay, setAutomationDelay] = useState(currentAPI?.automation?.delay || 500);
  const [isAutomating, setIsAutomating] = useState(false);
  const [automationProgress, setAutomationProgress] = useState({ current: 0, total: 0, results: [] });

// Sync form state when currentAPI changes
  useEffect(() => {
    if (currentAPI) {
      setApiName(currentAPI.name || '');
      setMethod(currentAPI.method || 'GET');
      setEndpoint(currentAPI.endpoint || '');
      setHeaders(currentAPI.headers || {});
      setParams(currentAPI.params || {});
      setBody(currentAPI.body || '');
      setAuthType(currentAPI.auth?.type || 'none');
      setAuthTokenLocal(currentAPI.auth?.token || '');
      setCertFile(currentAPI.auth?.certFile || '');
      setKeyFile(currentAPI.auth?.keyFile || '');
      setCaFile(currentAPI.auth?.caFile || '');
      setSkipOtp(currentAPI.skipOtp || false);
      setIsEditingName(false);
      // Sync automation state
      setAutomationEnabled(currentAPI.automation?.enabled || false);
      setAutomationVariable(currentAPI.automation?.variable || '{{id}}');
      setAutomationStart(currentAPI.automation?.start || 1);
      setAutomationEnd(currentAPI.automation?.end || 10);
      setAutomationStep(currentAPI.automation?.step || 1);
      setAutomationPadding(currentAPI.automation?.padding || 0);
      setAutomationDelay(currentAPI.automation?.delay || 500);
    }
  }, [currentAPI?.id]); // Only sync when the API ID changes, not the entire object

  // Periodically check if session token has expired
  useEffect(() => {
    const interval = setInterval(() => {
      if (sessionTokenExpiry && Date.now() > sessionTokenExpiry) {
        clearSessionToken();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [sessionTokenExpiry, clearSessionToken]);

// Auto-save API configuration with debounce
  useEffect(() => {
    if (!currentAPI?.id) return;

    const timeoutId = setTimeout(() => {
      const updatedAPI = {
        ...currentAPI,
        name: apiName,
        method,
        endpoint,
        headers,
        params,
        body,
        auth: {
          type: authType,
          token: authTokenState,
          certFile,
          keyFile,
          caFile,
        },
        skipOtp,
        automation: {
          enabled: automationEnabled,
          variable: automationVariable,
          start: automationStart,
          end: automationEnd,
          step: automationStep,
          padding: automationPadding,
          delay: automationDelay,
        },
      };
      
      updateAPI(currentAPI.id, updatedAPI);
      
      // Auto-save to electron storage
      if (window.electronAPI && window.electronAPI.saveAPIs) {
        const updatedAPIs = apis.map(api => 
          api.id === currentAPI.id ? updatedAPI : api
        );
        window.electronAPI.saveAPIs(updatedAPIs);
      }
    }, 1500); // Save after 1.5 seconds of inactivity

    return () => clearTimeout(timeoutId);
}, [apiName, method, endpoint, headers, params, body, authType, authTokenState, certFile, keyFile, caFile, skipOtp, automationEnabled, automationVariable, automationStart, automationEnd, automationStep, automationPadding, automationDelay, currentAPI?.id, updateAPI, apis]);

  if (!currentAPI) {
    return (
      <div className="request-builder glass-lg empty-state">
        <p>Select an API from the left panel to get started</p>
      </div>
    );
  }

const handleUpdateAPI = () => {
    const updatedAPI = {
      ...currentAPI,
      name: apiName,
      method,
      endpoint,
      headers,
      params,
      body,
      auth: {
        type: authType,
        token: authTokenState,
        certFile,
        keyFile,
        caFile,
      },
      skipOtp,
    };
    updateAPI(currentAPI.id, updatedAPI);
    // Auto-save to electron storage
    if (window.electronAPI && window.electronAPI.saveAPIs) {
      window.electronAPI.saveAPIs(apis);
    }
  };

  const handleDeleteAPI = () => {
    if (window.confirm(`Are you sure you want to delete "${apiName}"?`)) {
      deleteAPI(currentAPI.id);
      const updatedAPIs = apis.filter(api => api.id !== currentAPI.id);
      // Auto-save to electron storage
      if (window.electronAPI && window.electronAPI.saveAPIs) {
        window.electronAPI.saveAPIs(updatedAPIs);
      }
      setCurrentAPI(null);
    }
  };

  const addHeader = () => {
    if (newHeaderKey && newHeaderValue) {
      const updatedHeaders = {
        ...headers,
        [newHeaderKey]: newHeaderValue,
      };
      setHeaders(updatedHeaders);
      setNewHeaderKey('');
      setNewHeaderValue('');
    }
  };

  const removeHeader = (key) => {
    const updatedHeaders = { ...headers };
    delete updatedHeaders[key];
    setHeaders(updatedHeaders);
  };

  const addParam = () => {
    if (newParamKey && newParamValue) {
      const updatedParams = {
        ...params,
        [newParamKey]: newParamValue,
      };
      setParams(updatedParams);
      setNewParamKey('');
      setNewParamValue('');
    }
  };

  const removeParam = (key) => {
    const updatedParams = { ...params };
    delete updatedParams[key];
    setParams(updatedParams);
  };

  const buildURL = () => {
    let url = endpoint;
    
    // If endpoint is a full URL (starts with http/https), use it directly
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      // Otherwise, combine with serverUrl
      url = serverUrl + endpoint;
    }
    
    // Handle params as URL query parameters
    if (params && Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          queryParams.append(key, value);
        }
      });
      const queryString = queryParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }
    
    return url;
  };

  const buildRequestHeaders = () => {
    const requestHeaders = { ...headers };
    
    // Set Authorization header based on auth type
    if (authType === 'bearer' && authTokenState) {
      requestHeaders['Authorization'] = `Bearer ${authTokenState}`;
    } else if (authType === 'basic' && authTokenState) {
      requestHeaders['Authorization'] = `Basic ${authTokenState}`;
    }
    
    // Ensure Content-Type is set for POST/PUT/PATCH requests with body
    const hasBody = body && ['POST', 'PUT', 'PATCH'].includes(method);
    if (hasBody && !requestHeaders['Content-Type']) {
      // Default to JSON if no content type is set
      if (body.trim().startsWith('{') || body.trim().startsWith('[')) {
        requestHeaders['Content-Type'] = 'application/json';
      } else if (body.includes('=') && !body.includes('{')) {
        // Likely URL-encoded data
        requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    }
    
    return requestHeaders;
  };

  // // Periodically check if session token has expired
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     if (sessionTokenExpiry && Date.now() > sessionTokenExpiry) {
  //       clearSessionToken();
  //     }
  //   }, 5000);
  //   return () => clearInterval(interval);
  // }, [sessionTokenExpiry, clearSessionToken]);


  const handleOtpVerify = (otp) => {
    // Generate a session token from the OTP (simulated auth)
    const token = `sess-${otp}-${Date.now()}`;
    setSessionToken(token);
    setShowOtpModal(false);
    // If a request was pending, retry it
    if (pendingSendRef.current) {
      pendingSendRef.current = false;
      executeRequest();
    }
  };

  const executeRequest = async () => {
    setIsSending(true);
    handleUpdateAPI();

    try {
      const url = buildURL();
      const requestHeaders = buildRequestHeaders();

      // Inject session token if available and not expired
      if (sessionToken && sessionTokenExpiry && Date.now() < sessionTokenExpiry) {
        requestHeaders['Authorization'] = `Bearer ${sessionToken}`;
      }

      const sslOptions =
        authType === 'ssl'
          ? { certFile, keyFile, caFile }
          : undefined;

      const startTime = performance.now();

      const result = await window.electronAPI.sendRequest({
        url,
        method,
        headers: requestHeaders,
        body: ['GET', 'HEAD', 'DELETE'].includes(method) ? undefined : body,
        sslOptions,
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

      addResponse({
        id: Math.random().toString(36).substr(2, 9),
        apiName,
        method,
        endpoint,
        status: result.status,
        statusText: result.statusText,
        responseTime: Math.round(responseTime),
        responseSize: new Blob([result.body]).size,
        headers: result.headers,
        body: responseData,
        rawBody: result.body,
      });
    } catch (error) {
      addResponse({
        id: Math.random().toString(36).substr(2, 9),
        apiName,
        method,
        endpoint,
        error: error.message,
        status: 0,
      });
    }

    setIsSending(false);
  };

  const shouldSkipOtp = () => {
    // Auto-skip OTP for auth/login endpoints
    const authKeywords = ['/login', '/auth', '/signin', '/authenticate'];
    const isAuthEndpoint = authKeywords.some(keyword => 
      endpoint.toLowerCase().includes(keyword) || 
      apiName.toLowerCase().includes(keyword)
    );
    return skipOtp || isAuthEndpoint;
  };

  const handleSendRequest = async () => {
    // Skip OTP for APIs marked with skipOtp (e.g. Auth endpoint) or auto-detected auth endpoints
    if (shouldSkipOtp()) {
      await executeRequest();
      return;
    }
    // Check if session token is valid
    const isTokenValid = sessionToken && sessionTokenExpiry && Date.now() < sessionTokenExpiry;
    if (!isTokenValid) {
      pendingSendRef.current = true;
      setShowOtpModal(true);
      return;
    }
    await executeRequest();
  };

  return (
    <div className="request-builder glass-lg">
      <div className="builder-header">
        <div className="api-name-section">
          {isEditingName ? (
            <div className="name-edit">
              <input
                type="text"
                value={apiName}
                onChange={(e) => setApiName(e.target.value)}
                autoFocus
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  handleUpdateAPI();
                  setIsEditingName(false);
                }}
              >
                Save
              </button>
            </div>
          ) : (
            <div className="name-display">
              <h3>{apiName}</h3>
              <button
                className="edit-btn"
                onClick={() => setIsEditingName(true)}
              >
                <FiEdit2 size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="method-endpoint">
          <select
            className="method-select"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>PATCH</option>
            <option>DELETE</option>
            <option>HEAD</option>
          </select>

          <input
            type="text"
            className="endpoint-input"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="/api/endpoint"
          />
        </div>

<div className="builder-actions">
          <button
            className="btn btn-primary"
            onClick={handleSendRequest}
            disabled={isSending}
          >
            <FiSend size={18} />
            {isSending ? 'Sending...' : 'Send'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleUpdateAPI}
            title="Save API configuration"
          >
            <FiSave size={18} />
            {isSending ? 'Save configuration...' : 'Save Data'}            
          </button>
          <button
            className="btn btn-danger"
            onClick={handleDeleteAPI}
            title="Delete this API"
          >
            <FiTrash2 size={18} />
            Delete
          </button>
        </div>
      </div>

<div className="tabs">
        {['params', 'headers', 'body', 'auth', 'docs', 'scripts', 'automation', 'settings'].map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="tab-content">
{activeTab === 'body' && (
          <div className="body-editor">
            <div className="body-type-selector">
              <label>Body Type:</label>
              <select
                value={bodyType}
                onChange={(e) => setBodyType(e.target.value)}
              >
                <option value="none">None</option>
                <option value="json">JSON</option>
                <option value="form-data">Form Data</option>
                <option value="x-www-form-urlencoded">x-www-form-urlencoded</option>
                <option value="raw">Raw</option>
                <option value="binary">Binary</option>
                <option value="graphql">GraphQL</option>
              </select>
            </div>
            {bodyType === 'none' && (
              <div className="empty-body">
                <p>This request does not have a body</p>
              </div>
            )}
            {bodyType === 'json' && (
              <Editor
                height="100%"
                defaultLanguage="json"
                value={body}
                onChange={(value) => setBody(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  formatOnPaste: true,
                }}
              />
            )}
            {(bodyType === 'raw' || bodyType === 'graphql') && (
              <Editor
                height="100%"
                defaultLanguage={bodyType === 'graphql' ? 'graphql' : 'plaintext'}
                value={body}
                onChange={(value) => setBody(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                }}
              />
            )}
            {bodyType === 'form-data' && (
              <div className="key-value-editor">
                <div className="add-row">
                  <input
                    type="text"
                    placeholder="Key"
                    value={newParamKey}
                    onChange={(e) => setNewParamKey(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={newParamValue}
                    onChange={(e) => setNewParamValue(e.target.value)}
                  />
                  <button className="btn btn-primary btn-sm" onClick={addParam}>
                    <FiPlus size={16} />
                  </button>
                </div>
                <div className="rows-list">
                  {Object.entries(params).map(([key, value]) => (
                    <div key={key} className="row">
                      <span className="key">{key}</span>
                      <span className="value">{value}</span>
                      <button
                        className="btn-delete"
                        onClick={() => removeParam(key)}
                      >
                        <FiX size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {bodyType === 'x-www-form-urlencoded' && (
              <div className="key-value-editor">
                <div className="editor-label">URL Encoded Body</div>
                <div className="add-row">
                  <input
                    type="text"
                    placeholder="Key"
                    value={newParamKey}
                    onChange={(e) => setNewParamKey(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={newParamValue}
                    onChange={(e) => setNewParamValue(e.target.value)}
                  />
                  <button className="btn btn-primary btn-sm" onClick={addParam}>
                    <FiPlus size={16} />
                  </button>
                </div>
                <div className="rows-list">
                  {Object.entries(params).map(([key, value]) => (
                    <div key={key} className="row">
                      <span className="key">{key}</span>
                      <span className="value">{value}</span>
                      <button
                        className="btn-delete"
                        onClick={() => removeParam(key)}
                      >
                        <FiX size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {bodyType === 'binary' && (
              <div className="form-group">
                <label>Select File</label>
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file && currentAPI) {
                      updateAPI(currentAPI.id, {
                        ...currentAPI,
                        binaryFile: file.name,
                      });
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'headers' && (
          <div className="key-value-editor">
            <div className="add-row">
              <input
                type="text"
                placeholder="Header name"
                value={newHeaderKey}
                onChange={(e) => setNewHeaderKey(e.target.value)}
              />
              <input
                type="text"
                placeholder="Header value"
                value={newHeaderValue}
                onChange={(e) => setNewHeaderValue(e.target.value)}
              />
              <button className="btn btn-primary btn-sm" onClick={addHeader}>
                <FiPlus size={16} />
              </button>
            </div>

            <div className="rows-list">
              {Object.entries(headers).map(([key, value]) => (
                <div key={key} className="row">
                  <span className="key">{key}</span>
                  <span className="value">{value}</span>
                  <button
                    className="btn-delete"
                    onClick={() => removeHeader(key)}
                  >
                    <FiX size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'params' && (
          <div className="key-value-editor">
            <div className="add-row">
              <input
                type="text"
                placeholder="Param name"
                value={newParamKey}
                onChange={(e) => setNewParamKey(e.target.value)}
              />
              <input
                type="text"
                placeholder="Param value"
                value={newParamValue}
                onChange={(e) => setNewParamValue(e.target.value)}
              />
              <button className="btn btn-primary btn-sm" onClick={addParam}>
                <FiPlus size={16} />
              </button>
            </div>

            <div className="rows-list">
              {Object.entries(params).map(([key, value]) => (
                <div key={key} className="row">
                  <span className="key">{key}</span>
                  <span className="value">{value}</span>
                  <button
                    className="btn-delete"
                    onClick={() => removeParam(key)}
                  >
                    <FiX size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'auth' && (
          <div className="auth-config">
            <div className="form-group">
              <label>Auth Type</label>
              <select
                value={authType}
                onChange={(e) => setAuthType(e.target.value)}
              >
                <option value="none">None</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth</option>
                <option value="ssl">SSL/TLS Certificate</option>
              </select>
            </div>

            {authType === 'bearer' && (
              <div className="form-group">
                <label>Bearer Token</label>
                <input
                  type="password"
                  value={authTokenState}
                  onChange={(e) => setAuthTokenLocal(e.target.value)}
                  placeholder="Enter your bearer token"
                />
              </div>
            )}

            {authType === 'basic' && (
              <div className="form-group">
                <label>Credentials</label>
                <input
                  type="password"
                  value={authTokenState}
                  onChange={(e) => setAuthTokenLocal(e.target.value)}
                  placeholder="Base64 encoded username:password"
                />
              </div>
            )}

            {authType === 'ssl' && (
              <>
                <div className="form-group">
                  <label>Client Certificate (.pem)</label>
                  <div className="file-input-wrapper">
                    <input
                      type="text"
                      value={certFile}
                      readOnly
                      placeholder="Select client.pem file"
                    />
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => document.getElementById('cert-upload').click()}
                    >
                      Browse
                    </button>
                    <input
                      id="cert-upload"
                      type="file"
                      style={{ display: 'none' }}
                      accept=".pem,.crt"
                      onChange={(e) => setCertFile(e.target.files[0]?.path || '')}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Private Key (.pem)</label>
                  <div className="file-input-wrapper">
                    <input
                      type="text"
                      value={keyFile}
                      readOnly
                      placeholder="Select key.pem file"
                    />
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => document.getElementById('key-upload').click()}
                    >
                      Browse
                    </button>
                    <input
                      id="key-upload"
                      type="file"
                      style={{ display: 'none' }}
                      accept=".pem,.key"
                      onChange={(e) => setKeyFile(e.target.files[0]?.path || '')}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Root CA Certificate (.pem)</label>
                  <div className="file-input-wrapper">
                    <input
                      type="text"
                      value={caFile}
                      readOnly
                      placeholder="Select RootCA.pem file"
                    />
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => document.getElementById('ca-upload').click()}
                    >
                      Browse
                    </button>
                    <input
                      id="ca-upload"
                      type="file"
                      style={{ display: 'none' }}
                      accept=".pem,.crt"
                      onChange={(e) => setCaFile(e.target.files[0]?.path || '')}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={skipOtp}
                  onChange={(e) => setSkipOtp(e.target.checked)}
                />
                <span>Skip OTP for this API (e.g. Auth endpoint)</span>
              </label>
            </div>

<div className="info-box">
              💡 Your auth credentials and certificates are only stored locally in your system.
            </div>
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="docs-editor">
            <div className="form-group">
              <label>API Documentation</label>
              <textarea
                className="docs-textarea"
                value={docs}
                onChange={(e) => setDocs(e.target.value)}
                placeholder="Enter API documentation, description, usage notes..."
                rows={10}
              />
            </div>
          </div>
        )}

{activeTab === 'scripts' && (
          <div className="scripts-editor">
            <div className="form-group">
              <label>Pre-request Script (JavaScript)</label>
              <Editor
                height="150px"
                defaultLanguage="javascript"
                value={currentAPI?.preRequestScript || ''}
                onChange={(value) => {
                  if (currentAPI) {
                    updateAPI(currentAPI.id, { 
                      ...currentAPI, 
                      preRequestScript: value || '' 
                    });
                  }
                }}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
            <div className="form-group">
              <label>Test Script (JavaScript)</label>
              <Editor
                height="150px"
                defaultLanguage="javascript"
                value={currentAPI?.testScript || ''}
                onChange={(value) => {
                  if (currentAPI) {
                    updateAPI(currentAPI.id, { 
                      ...currentAPI, 
                      testScript: value || '' 
                    });
                  }
                }}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          </div>
        )}

        {activeTab === 'automation' && (
          <div className="automation-config">
            <div className="automation-header">
              <h4>Automation Settings</h4>
              <p className="automation-description">
                Configure automated requests with incrementing values. Use {"{{variable}}"} in your endpoint or params.
              </p>
            </div>
            
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={automationEnabled}
                  onChange={(e) => {
                    setAutomationEnabled(e.target.checked);
                    if (currentAPI) {
                      updateAPI(currentAPI.id, { 
                        ...currentAPI, 
                        automation: { 
                          ...currentAPI.automation, 
                          enabled: e.target.checked 
                        } 
                      });
                    }
                  }}
                />
                <span>Enable Automation</span>
              </label>
            </div>

            <div className="form-group">
              <label>Variable Placeholder</label>
              <input
                type="text"
                value={automationVariable}
                onChange={(e) => setAutomationVariable(e.target.value)}
                placeholder="{{id}}"
                disabled={!automationEnabled}
              />
              <small className="form-hint">Use {"{{id}}"} or {"{{page}}"} - will be replaced with incrementing value</small>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Start Value</label>
                <input
                  type="number"
                  value={automationStart}
                  onChange={(e) => setAutomationStart(parseInt(e.target.value) || 1)}
                  disabled={!automationEnabled}
                />
              </div>
              <div className="form-group">
                <label>End Value</label>
                <input
                  type="number"
                  value={automationEnd}
                  onChange={(e) => setAutomationEnd(parseInt(e.target.value) || 10)}
                  disabled={!automationEnabled}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Step</label>
                <input
                  type="number"
                  value={automationStep}
                  onChange={(e) => setAutomationStep(parseInt(e.target.value) || 1)}
                  disabled={!automationEnabled}
                />
              </div>
              <div className="form-group">
                <label>Zero Padding</label>
                <input
                  type="number"
                  value={automationPadding}
                  onChange={(e) => setAutomationPadding(parseInt(e.target.value) || 0)}
                  disabled={!automationEnabled}
                  min="0"
                  max="10"
                />
                <small className="form-hint">e.g., 2 = 01, 02, 03</small>
              </div>
            </div>

            <div className="form-group">
              <label>Delay Between Requests (ms)</label>
              <input
                type="number"
                value={automationDelay}
                onChange={(e) => setAutomationDelay(parseInt(e.target.value) || 500)}
                disabled={!automationEnabled}
                min="0"
              />
            </div>

            <div className="automation-preview">
              <h5>Preview</h5>
              <div className="preview-list">
                {automationEnabled && (
                  <>
                    {Array.from({ length: Math.min(5, automationEnd - automationStart + 1) }, (_, i) => {
                      const value = automationStart + (i * automationStep);
                      const paddedValue = automationPadding > 0 
                        ? String(value).padStart(automationPadding, '0') 
                        : value;
                      const previewEndpoint = endpoint.replace(new RegExp(automationVariable.replace('{{', '\\{{').replace('}}', '\\}}'), 'g'), paddedValue);
                      return (
                        <div key={i} className="preview-item">
                          <span className="preview-value">{value}</span>
                          <span className="preview-url">{serverUrl}{previewEndpoint}</span>
                        </div>
                      );
                    })}
                    {automationEnd - automationStart + 1 > 5 && (
                      <div className="preview-more">...and {automationEnd - automationStart + 1 - 5} more</div>
                    )}
                  </>
                )}
                {!automationEnabled && <p className="preview-empty">Enable automation to see preview</p>}
              </div>
            </div>

            <div className="automation-actions">
              <button
                className="btn btn-primary"
                disabled={!automationEnabled || isAutomating}
                onClick={async () => {
                  if (!automationVariable || !endpoint.includes(automationVariable)) {
                    alert(`Please include ${automationVariable} in your endpoint URL`);
                    return;
                  }
                  
                  setIsAutomating(true);
                  const results = [];
                  const totalRuns = Math.ceil((automationEnd - automationStart) / automationStep) + 1;
                  setAutomationProgress({ current: 0, total: totalRuns, results: [] });
                  
                  // Track batched progress updates to reduce re-renders
                  let batchedProgress = { current: 0, total: totalRuns, results: [] };
                  let updateFrequency = Math.max(1, Math.floor(totalRuns / 10)); // Update 10 times max
                  
                  for (let i = automationStart; i <= automationEnd; i += automationStep) {
                    const runIndex = Math.floor((i - automationStart) / automationStep);
                    const currentProgress = runIndex + 1;
                    
                    try {
                      const paddedValue = automationPadding > 0 
                        ? String(i).padStart(automationPadding, '0') 
                        : i;
                      
                      // Build URL with replaced variable - use our improved buildURL logic
                      let url = endpoint.replace(
                        new RegExp(automationVariable.replace('{{', '\\{{').replace('}}', '\\}}'), 'g'), 
                        paddedValue
                      );
                      
                      // If endpoint is not a full URL, prepend serverUrl
                      if (!url.startsWith('http://') && !url.startsWith('https://')) {
                        url = serverUrl + url;
                      }
                      
                      // Handle params replacement
                      if (params && Object.keys(params).length > 0) {
                        const queryParams = new URLSearchParams();
                        Object.entries(params).forEach(([key, value]) => {
                          const processedValue = String(value).replace(
                            new RegExp(automationVariable.replace('{{', '\\{{').replace('}}', '\\}}'), 'g'),
                            paddedValue
                          );
                          if (processedValue !== '' && processedValue !== null) {
                            queryParams.append(key, processedValue);
                          }
                        });
                        const queryString = queryParams.toString();
                        if (queryString) {
                          url += (url.includes('?') ? '&' : '?') + queryString;
                        }
                      }
                      
                      const requestHeaders = buildRequestHeaders();
                      
                      // Inject session token if available and not expired
                      if (sessionToken && sessionTokenExpiry && Date.now() < sessionTokenExpiry) {
                        requestHeaders['Authorization'] = `Bearer ${sessionToken}`;
                      }

                      const sslOptions = authType === 'ssl' ? { certFile, keyFile, caFile } : undefined;

                      const startTime = performance.now();
                      
                      const result = await window.electronAPI.sendRequest({
                        url,
                        method,
                        headers: requestHeaders,
                        body: ['GET', 'HEAD', 'DELETE'].includes(method) ? undefined : body,
                        sslOptions,
                      });
                      
                      const responseTime = performance.now() - startTime;

                      let responseData;
                      try {
                        responseData = JSON.parse(result.body);
                      } catch {
                        responseData = result.body;
                      }

                      const resultObj = {
                        id: Math.random().toString(36).substr(2, 9),
                        apiName: `${apiName} #${paddedValue}`,
                        method,
                        endpoint: endpoint.replace(automationVariable, paddedValue),
                        status: result.status || 0,
                        statusText: result.statusText || '',
                        responseTime: Math.round(responseTime),
                        responseSize: result.body ? new Blob([result.body]).size : 0,
                        headers: result.headers || {},
                        body: responseData,
                        rawBody: result.body,
                        timestamp: new Date(),
                      };
                      
                      results.push(resultObj);
                      addResponse(resultObj);
                      
                      // Batch progress updates to reduce re-renders
                      if (currentProgress % updateFrequency === 0 || currentProgress === totalRuns) {
                        setAutomationProgress({ 
                          current: currentProgress, 
                          total: totalRuns, 
                          results 
                        });
                      }
                      
                      // Add delay between requests
                      if (i + automationStep <= automationEnd) {
                        await new Promise(resolve => setTimeout(resolve, automationDelay));
                      }
                    } catch (error) {
                      const errorResult = {
                        id: Math.random().toString(36).substr(2, 9),
                        apiName: `${apiName} #${i}`,
                        method,
                        endpoint: endpoint.replace(automationVariable, String(i)),
                        error: error.message,
                        status: 0,
                        timestamp: new Date(),
                      };
                      results.push(errorResult);
                      addResponse(errorResult);
                    }
                  }
                  
                  setIsAutomating(false);
                  setAutomationProgress({ current: 0, total: 0, results: [] });
                }}
              >
                <FiPlay size={18} />
                {isAutomating ? `Running ${automationProgress.current}/${automationProgress.total}...` : 'Run Automation'}
              </button>
              
              {isAutomating && (
                <button
                  className="btn btn-danger"
                  onClick={() => setIsAutomating(false)}
                >
                  <FiX size={18} />
                  Stop
                </button>
              )}
            </div>

            {isAutomating && (
              <div className="automation-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${(automationProgress.current / automationProgress.total) * 100}%` }}
                  />
                </div>
                <span className="progress-text">
                  {automationProgress.current} / {automationProgress.total} requests completed
                </span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-config">
            <div className="form-group">
              <label>Request Timeout (ms)</label>
              <input
                type="number"
                value={currentAPI?.timeout || 30000}
                onChange={(e) => {
                  if (currentAPI) {
                    updateAPI(currentAPI.id, { 
                      ...currentAPI, 
                      timeout: parseInt(e.target.value) || 30000 
                    });
                  }
                }}
                placeholder="30000"
              />
            </div>
            <div className="form-group">
              <label>Follow Redirects</label>
              <select
                value={currentAPI?.followRedirects !== false ? 'true' : 'false'}
                onChange={(e) => {
                  if (currentAPI) {
                    updateAPI(currentAPI.id, { 
                      ...currentAPI, 
                      followRedirects: e.target.value === 'true' 
                    });
                  }
                }}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div className="form-group">
              <label>SSL Verification</label>
              <select
                value={currentAPI?.sslVerify !== false ? 'true' : 'false'}
                onChange={(e) => {
                  if (currentAPI) {
                    updateAPI(currentAPI.id, { 
                      ...currentAPI, 
                      sslVerify: e.target.value === 'true' 
                    });
                  }
                }}
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
            <div className="form-group">
              <label>Response Format</label>
              <select
                value={currentAPI?.responseFormat || 'json'}
                onChange={(e) => {
                  if (currentAPI) {
                    updateAPI(currentAPI.id, { 
                      ...currentAPI, 
                      responseFormat: e.target.value 
                    });
                  }
                }}
              >
                <option value="json">JSON</option>
                <option value="xml">XML</option>
                <option value="text">Text</option>
                <option value="html">HTML</option>
                <option value="binary">Binary</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <OTPModal
        isOpen={showOtpModal}
        onVerify={handleOtpVerify}
        onCancel={() => {
          setShowOtpModal(false);
          pendingSendRef.current = false;
        }}
      />
    </div>
  );
}

export default RequestBuilder;
