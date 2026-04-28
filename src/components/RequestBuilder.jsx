import React, { useState, useEffect, useRef } from 'react';
import useStore from '../store';
import Editor from '@monaco-editor/react';
import {
  FiSend,
  FiCopy,
  FiSave,
  FiEdit2,
  FiX,
  FiPlus,
} from 'react-icons/fi';
import OTPModal from './OTPModal';
import '../styles/RequestBuilder.css';

function RequestBuilder() {
  const {
    currentAPI,
    updateAPI,
    serverUrl,
    authToken,
    setAuthToken,
    addResponse,
    comparisonMode,
    apis,
    collections,
    sessionToken,
    sessionTokenExpiry,
    setSessionToken,
    clearSessionToken,
  } = useStore();

  const [activeTab, setActiveTab] = useState('body');
  const [isSending, setIsSending] = useState(false);
  const [apiName, setApiName] = useState(currentAPI?.name || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [method, setMethod] = useState(currentAPI?.method || 'GET');
  const [endpoint, setEndpoint] = useState(currentAPI?.endpoint || '');
  const [headers, setHeaders] = useState(currentAPI?.headers || {});
  const [params, setParams] = useState(currentAPI?.params || {});
  const [body, setBody] = useState(currentAPI?.body || '');
  const [authType, setAuthType] = useState(currentAPI?.auth?.type || 'none');
  const [authTokenState, setAuthTokenLocal] = useState(
    currentAPI?.auth?.token || ''
  );
  const [certFile, setCertFile] = useState(currentAPI?.auth?.certFile || '');
  const [keyFile, setKeyFile] = useState(currentAPI?.auth?.keyFile || '');
  const [caFile, setCaFile] = useState(currentAPI?.auth?.caFile || '');
  const [newHeaderKey, setNewHeaderKey] = useState('');
  const [newHeaderValue, setNewHeaderValue] = useState('');
  const [newParamKey, setNewParamKey] = useState('');
  const [newParamValue, setNewParamValue] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const pendingSendRef = useRef(false);

  // Periodically check if session token has expired
  useEffect(() => {
    const interval = setInterval(() => {
      if (sessionTokenExpiry && Date.now() > sessionTokenExpiry) {
        clearSessionToken();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [sessionTokenExpiry, clearSessionToken]);

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
    };
    updateAPI(currentAPI.id, updatedAPI);
    // Auto-save
    if (window.electronAPI && window.electronAPI.saveCollections) {
      window.electronAPI.saveCollections(collections);
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
    let url = serverUrl + endpoint;
    const queryParams = new URLSearchParams(params).toString();
    if (queryParams) {
      url += '?' + queryParams;
    }
    return url;
  };

  const buildRequestHeaders = () => {
    const requestHeaders = { ...headers };
    if (authType === 'bearer' && authTokenState) {
      requestHeaders['Authorization'] = `Bearer ${authTokenState}`;
    } else if (authType === 'basic' && authTokenState) {
      requestHeaders['Authorization'] = `Basic ${authTokenState}`;
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

  const handleSendRequest = async () => {
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
        </div>
      </div>

      <div className="tabs">
        {['body', 'headers', 'params', 'auth'].map((tab) => (
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
            <div className="editor-label">Request Body (JSON)</div>
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

            <div className="info-box">
              💡 Your auth credentials and certificates are only stored locally in your system.
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
