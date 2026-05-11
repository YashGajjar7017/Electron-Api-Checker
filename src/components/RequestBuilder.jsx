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
  FiEye,
  FiEyeOff,
  FiShare2,
  FiExternalLink,
} from 'react-icons/fi';
import OTPModal from './OTPModal';
import { applyTemplateVariables } from '../utils/variableUtils';
import { useSaveStatusEffect } from './useSaveStatusEffect.js';
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
    environments,
    activeEnvironment,
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
  const [bodyParams, setBodyParams] = useState(currentAPI?.bodyParams || {});
  const [newBodyKey, setNewBodyKey] = useState('');
  const [newBodyValue, setNewBodyValue] = useState('');
  const [bodyType, setBodyType] = useState(currentAPI?.bodyType || 'none');
  const [authType, setAuthType] = useState(currentAPI?.auth?.type || 'none');
  const [authTokenState, setAuthTokenLocal] = useState(
    currentAPI?.auth?.token || ''
  );
  const [manualTokenExpiry, setManualTokenExpiry] = useState(null);
  const [certFile, setCertFile] = useState(currentAPI?.auth?.certFile || '');
  const [keyFile, setKeyFile] = useState(currentAPI?.auth?.keyFile || '');
  const [caFile, setCaFile] = useState(currentAPI?.auth?.caFile || '');
  const [skipOtp, setSkipOtp] = useState(currentAPI?.skipOtp || false);
  const [newHeaderKey, setNewHeaderKey] = useState('');
  const [newHeaderValue, setNewHeaderValue] = useState('');
  const [newParamKey, setNewParamKey] = useState('');
  const [newParamValue, setNewParamValue] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  useSaveStatusEffect(saveStatus, setSaveStatus);
  const pendingSendRef = useRef(false);
  const abortAutomationRef = useRef(false);
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
  const [pythonScriptOutput, setPythonScriptOutput] = useState('');
  const [runningScript, setRunningScript] = useState(false);

// Sync form state when currentAPI changes
  useEffect(() => {
    if (currentAPI) {
      setApiName(currentAPI.name || '');
      setMethod(currentAPI.method || 'GET');
      setEndpoint(currentAPI.endpoint || '');
      setHeaders(currentAPI.headers || {});
      setParams(currentAPI.params || {});
      setBody(currentAPI.body || '');
      setBodyParams(currentAPI.bodyParams || {});
      setNewBodyKey('');
      setNewBodyValue('');
      setAuthType(currentAPI.auth?.type || 'none');
      setAuthTokenLocal(currentAPI.auth?.token || '');
      setCertFile(currentAPI.auth?.certFile || '');
      setKeyFile(currentAPI.auth?.keyFile || '');
      setCaFile(currentAPI.auth?.caFile || '');
      setSkipOtp(currentAPI.skipOtp || false);
      setShowAuthToken(false);
      setIsEditingName(false);
      setShowAuthToken(false);
      // Sync automation state
      setAutomationEnabled(currentAPI.automation?.enabled || false);
      setAutomationVariable(currentAPI.automation?.variable || '{{id}}');
      setAutomationStart(currentAPI.automation?.start || 1);
      setAutomationEnd(currentAPI.automation?.end || 10);
      setAutomationStep(currentAPI.automation?.step || 1);
      setAutomationPadding(currentAPI.automation?.padding || 0);
      setAutomationDelay(currentAPI.automation?.delay || 500);
    }
  }, [currentAPI]); // Only sync when the API changes

  // Periodically check if tokens have expired
  useEffect(() => {
    const checkTokenExpiry = () => {
      if (sessionTokenExpiry && Date.now() > sessionTokenExpiry) {
        clearSessionToken();
      }
      if (manualTokenExpiry && Date.now() > manualTokenExpiry) {
        setManualTokenExpiry(null);
      }
    };
    
    checkTokenExpiry();
    const interval = setInterval(checkTokenExpiry, 1000);
    return () => clearInterval(interval);
  }, [sessionTokenExpiry, manualTokenExpiry, clearSessionToken]);

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
        bodyType,
        bodyParams,
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
}, [apiName, method, endpoint, headers, params, body, bodyType, bodyParams, authType, authTokenState, certFile, keyFile, caFile, skipOtp, automationEnabled, automationVariable, automationStart, automationEnd, automationStep, automationPadding, automationDelay, currentAPI, updateAPI, apis]);

  // Clear save status after timeout
  useEffect(() => {
    if (saveStatus) {
      const timeoutId = setTimeout(() => setSaveStatus(''), 2500);
      return () => clearTimeout(timeoutId);
    }
  }, [saveStatus]);

  if (!currentAPI) {
    return (
      <div className="request-builder glass-lg empty-state">
        <p>Select an API from the left panel to get started</p>
      </div>
    );
  }

  const handleShareRequest = async () => {
    const url = buildURL();
    const debugText = `URL: ${url}\nMethod: ${method}\nHeaders: ${JSON.stringify(headers, null, 2)}\nBody: ${body || JSON.stringify(bodyParams, null, 2)}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(debugText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = debugText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showActionMessage('Request details copied to clipboard');
    } catch (err) {
      console.error('Copy failed', err);
      showActionMessage('Unable to copy request details');
    }
  };

  const handleUpdateAPI = async () => {
    if (!currentAPI?.id) return;

    const updatedAPI = {
      ...currentAPI,
      name: apiName,
      method,
      endpoint,
      headers,
      params,
      body,
      bodyType,
      bodyParams,
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

    if (window.electronAPI && window.electronAPI.saveAPIs) {
      const updatedAPIs = apis.map((api) =>
        api.id === currentAPI.id ? updatedAPI : api
      );
      const result = await window.electronAPI.saveAPIs(updatedAPIs);
      if (result?.success) {
        setSaveStatus('Saved successfully');
      } else {
        setSaveStatus(result?.error ? `Save failed: ${result.error}` : 'Saved locally');
      }
    } else {
      setSaveStatus('Changes saved in memory');
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

  const addBodyParam = () => {
    if (newBodyKey && newBodyValue) {
      const updatedBodyParams = {
        ...bodyParams,
        [newBodyKey]: newBodyValue,
      };
      setBodyParams(updatedBodyParams);
      setNewBodyKey('');
      setNewBodyValue('');
    }
  };

  const removeBodyParam = (key) => {
    const updatedBodyParams = { ...bodyParams };
    delete updatedBodyParams[key];
    setBodyParams(updatedBodyParams);
  };

  const buildURL = () => {
    const environment = environments.find((env) => env.id === activeEnvironment) || environments[0] || {};
    const base = environment.baseUrl || serverUrl;
    let url = endpoint;

    // Apply variable substitution to endpoint and query params
    const resolvedEndpoint = applyTemplateVariables(endpoint, {
      baseUrl: base,
      token: authTokenState || sessionToken || '',
      timestamp: String(Date.now()),
      uuid: undefined,
      randomIntMax: 1000000,
    });

    if (!resolvedEndpoint.startsWith('http://') && !resolvedEndpoint.startsWith('https://')) {
      url = `${base.replace(/\/$/, '')}/${resolvedEndpoint.replace(/^\//, '')}`;
    } else {
      url = resolvedEndpoint;
    }

    // Handle params as URL query parameters
    if (params && Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          queryParams.append(
            encodeURIComponent(key),
            encodeURIComponent(applyTemplateVariables(String(value), {
              baseUrl: base,
              token: authTokenState || sessionToken || '',
              timestamp: String(Date.now()),
              uuid: undefined,
              randomIntMax: 1000000,
            }))
          );
        }
      });
      const queryString = queryParams.toString();
      if (queryString) {
        const hasExistingParams = url.includes('?');
        url += (hasExistingParams ? '&' : '?') + queryString;
      }
    }

    console.log('📍 Built URL:', url);
    return url;
  };

  const buildRequestHeaders = (overrideAuthToken) => {
    const requestHeaders = {};

    Object.entries(headers || {}).forEach(([key, value]) => {
      requestHeaders[key] = value;
      const normalizedKey = key.toLowerCase();
      if (normalizedKey === 'authorization') {
        requestHeaders['Authorization'] = value;
      }
      if (normalizedKey === 'content-type') {
        requestHeaders['Content-Type'] = value;
      }
    });

    if (overrideAuthToken) {
      requestHeaders['Authorization'] = `Bearer ${overrideAuthToken}`;
      console.log('🔑 Using override auth token');
    } else {
      console.log('🔑 Token priority check - Manual:', !!authTokenState?.trim(), 'Session:', !!(sessionToken && sessionTokenExpiry && Date.now() < sessionTokenExpiry), 'API:', !!(useStore.getState().getAPIResponseToken()));
      
      if (!requestHeaders['Authorization']) {
        if (authType === 'bearer' && authTokenState && authTokenState.trim().length > 0 && (!manualTokenExpiry || Date.now() < manualTokenExpiry)) {
          requestHeaders['Authorization'] = `Bearer ${authTokenState}`;
          console.log('🔑 Using MANUAL bearer token');
        } else if (authType === 'basic' && authTokenState && authTokenState.trim().length > 0 && (!manualTokenExpiry || Date.now() < manualTokenExpiry)) {
          requestHeaders['Authorization'] = `Basic ${authTokenState}`;
          console.log('🔑 Using MANUAL basic auth');
        }
      }

      if (!requestHeaders['Authorization']) {
        const hasValidSessionToken = sessionToken && sessionTokenExpiry && Date.now() < sessionTokenExpiry;
        if (hasValidSessionToken) {
          requestHeaders['Authorization'] = `Bearer ${sessionToken}`;
          console.log('🔑 Using SESSION token');
        }
      }

      if (!requestHeaders['Authorization']) {
        const apiToken = useStore.getState().getAPIResponseToken();
        if (apiToken) {
          requestHeaders['Authorization'] = `Bearer ${apiToken}`;
          console.log('🔑 Using API response token');
        }
      }
      
      if (!requestHeaders['Authorization']) {
        console.log('⚠️  No authorization token available');
      }
    }

    // Ensure Content-Type is set for POST/PUT/PATCH requests with body
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);
    if (hasBody && !requestHeaders['Content-Type']) {
      if (bodyType === 'json') {
        requestHeaders['Content-Type'] = 'application/json';
      } else if (bodyType === 'form-data' || bodyType === 'x-www-form-urlencoded') {
        requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
      } else if (bodyType === 'graphql') {
        requestHeaders['Content-Type'] = 'application/graphql';
      } else if (body.trim().startsWith('{') || body.trim().startsWith('[')) {
        requestHeaders['Content-Type'] = 'application/json';
      } else if (body.includes('=') && !body.includes('{')) {
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


  const getRequestBody = () => {
    if (['GET', 'HEAD', 'DELETE'].includes(method)) return undefined;

    if (bodyType === 'form-data' || bodyType === 'x-www-form-urlencoded') {
      const bodyParamsData = new URLSearchParams();
      Object.entries(bodyParams).forEach(([key, value]) => {
        if (key !== '' && value !== undefined && value !== null) {
          bodyParamsData.append(
            key,
            applyTemplateVariables(String(value), {
              baseUrl: serverUrl,
              token: authTokenState || sessionToken || '',
              timestamp: String(Date.now()),
              uuid: undefined,
              randomIntMax: 1000000,
            })
          );
        }
      });
      return bodyParamsData.toString();
    }

    return applyTemplateVariables(body, {
      baseUrl: serverUrl,
      token: authTokenState || sessionToken || '',
      timestamp: String(Date.now()),
      uuid: undefined,
      randomIntMax: 1000000,
    }) || undefined;
  };

  const handleRunPythonScript = async () => {
    const tokenToUse = authTokenState || sessionToken || '';
    if (!tokenToUse) {
      setPythonScriptOutput('Please set an auth token before running the Python script.');
      return;
    }

    setRunningScript(true);
    setPythonScriptOutput('Running automation script...');

    try {
      const result = await window.electronAPI.runPythonScript({ token: tokenToUse });
      if (result.success) {
        setPythonScriptOutput(`Script finished successfully.\n${result.stdout || ''}`);
      } else {
        setPythonScriptOutput(`Script failed: ${result.error || result.stderr || 'Unknown error'}`);
      }
    } catch (error) {
      setPythonScriptOutput(`Script execution error: ${error.message}`);
    }

    setRunningScript(false);
  };

  const showActionMessage = (message, duration = 3000) => {
    setActionMessage(message);
    if (duration > 0) {
      setTimeout(() => setActionMessage(''), duration);
    }
  };

  const handleShareToGitHub = async () => {
    const apiConfig = {
      name: apiName,
      method,
      endpoint,
      headers,
      params,
      body,
      bodyType,
      auth: {
        type: authType,
        // Don't include actual tokens for security
        token: authTokenState ? '[REDACTED]' : '',
      },
      docs,
    };

    const shareData = {
      title: `API Configuration: ${apiName}`,
      body: `## API Configuration\n\n\`\`\`json\n${JSON.stringify(apiConfig, null, 2)}\n\`\`\`\n\nShared from Electron API Checker`,
      labels: ['api', 'configuration', 'electron-app']
    };

    // Create GitHub issue URL
    const githubUrl = `https://github.com/issues/new?title=${encodeURIComponent(shareData.title)}&body=${encodeURIComponent(shareData.body)}&labels=${encodeURIComponent(shareData.labels.join(','))}`;

    if (window.electronAPI?.openExternalUrl) {
      await window.electronAPI.openExternalUrl(githubUrl);
      showActionMessage('Opened GitHub issue page');
    } else {
      window.open(githubUrl, '_blank');
      showActionMessage('Opened GitHub issue page in browser');
    }
  };

  const handleDebugUrl = async () => {
    const url = buildURL();
    if (!url) {
      showActionMessage('Cannot debug: invalid URL');
      return;
    }
    if (window.electronAPI?.openExternalUrl) {
      await window.electronAPI.openExternalUrl(url);
      showActionMessage('Opened URL in external browser');
    } else {
      window.open(url, '_blank');
      showActionMessage('Opened URL in browser');
    }
  };

  const handleResendRequest = async () => {
    if (isSending) return;
    if (shouldSkipOtp()) {
      await executeRequest();
      return;
    }
    const isTokenValid = sessionToken && sessionTokenExpiry && Date.now() < sessionTokenExpiry;
    if (!isTokenValid) {
      pendingSendRef.current = true;
      setShowOtpModal(true);
      showActionMessage('Session expired. Enter OTP to resend request');
      return;
    }
    await executeRequest();
  };

  const handleOtpVerify = async (otp) => {
    const hasManualToken = authTokenState && authTokenState.trim().length > 0;
    const hasAPIToken = useStore.getState().apiResponseToken;
    const validForMinutes = 10;
    let sessionTokenFromVerify = null;

    try {
      const verifyUrl = `${serverUrl.replace(/\/$/, '')}/auth/verify-otp`;
      const otpPayload = { otp, source: 'electron-app' };
      const verifyResult = await window.electronAPI.sendRequest({
        url: verifyUrl,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(otpPayload),
      });

      if (verifyResult.success && verifyResult.status >= 200 && verifyResult.status < 300) {
        const response = JSON.parse(verifyResult.body || '{}');
        sessionTokenFromVerify = response.token || response.Data?.token || null;
      }
    } catch (verifyError) {
      console.log('OTP verification request failed, falling back to local session token', verifyError.message);
    }

    const finalToken = sessionTokenFromVerify || `sess-${otp}-${Date.now()}`;
    if (!hasManualToken && !hasAPIToken) {
      setSessionToken(finalToken, validForMinutes);
      console.log('✅ Session token set for 10 min');
    } else {
      console.log('⚠️ Session token not stored because manual/API token already active');
    }

    setShowOtpModal(false);
    showActionMessage('OTP accepted. Retrying pending request...');
    if (pendingSendRef.current) {
      pendingSendRef.current = false;
      await executeRequest();
    }
  };

  const executeRequest = async (overrideAuthToken) => {
    setIsSending(true);
    handleUpdateAPI();

    try {
      const url = buildURL();
      const requestHeaders = buildRequestHeaders(overrideAuthToken);

      const sslOptions =
        authType === 'ssl'
          ? { certFile, keyFile, caFile }
          : undefined;

      const startTime = performance.now();

      const result = await window.electronAPI.sendRequest({
        url,
        method,
        headers: requestHeaders,
        body: getRequestBody(),
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

      // Print the response to console
      console.log('API Response:', {
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
        body: responseData,
        rawBody: result.body,
        responseTime: Math.round(responseTime),
        responseSize: new Blob([result.body]).size,
      });

      // Check if response contains a token (from login API)
      if (responseData && typeof responseData === 'object' && responseData.Data && responseData.Data.token) {
        const token = responseData.Data.token;
        const validForMinutes = responseData.Data.valid_for ? Math.ceil(responseData.Data.valid_for / 60) : 10;
        useStore.getState().setAPIResponseToken(token, validForMinutes);
        console.log(`Token captured: ${token.substring(0, 10)}... (expires in ${validForMinutes} min)`);
      }

      // Detect response format from content-type header
      const contentType = result.headers['content-type'] || result.headers['Content-Type'] || '';
      let dataFormat = 'text';
      if (contentType.includes('application/json')) {
        dataFormat = 'json';
      } else if (contentType.includes('text/html')) {
        dataFormat = 'html';
      } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
        dataFormat = 'xml';
      }

      addResponse({
        id: Math.random().toString(36).substr(2, 9),
        apiName,
        method,
        endpoint,
        requestUrl: url, // Include full built URL for reference
        status: result.status,
        statusText: result.statusText,
        responseTime: Math.round(responseTime),
        responseSize: new Blob([result.body]).size,
        headers: result.headers,
        body: typeof responseData === 'string' ? responseData : JSON.stringify(responseData, null, 2),
        rawBody: result.body,
        dataFormat,
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
    // Auto-skip OTP for auth/login/OTP endpoints
    const authKeywords = ['/login', '/auth', '/signin', '/authenticate', '/otp'];
    const isAuthEndpoint = authKeywords.some(keyword => 
      endpoint.toLowerCase().includes(keyword) || 
      apiName.toLowerCase().includes(keyword)
    );
    return skipOtp || isAuthEndpoint;
  };

  const handleSendRequest = async () => {
    if (shouldSkipOtp()) {
      await executeRequest();
      return;
    }
    const isTokenValid = sessionToken && sessionTokenExpiry && Date.now() < sessionTokenExpiry;
    if (!isTokenValid) {
      pendingSendRef.current = true;
      setShowOtpModal(true);
      showActionMessage('OTP required before sending this request');
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
            className="btn btn-primary"
            onClick={handleResendRequest}
            disabled={isSending}
            title="Resend the same request"
          >
            <FiRefreshCw size={18} />
            Resend
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleUpdateAPI}
            title="Save API configuration"
            disabled={isSending}
          >
            <FiSave size={18} />
            {isSending ? 'Save configuration...' : 'Save Data'}            
          </button>
          <button
            className="btn btn-ghost"
            onClick={handleShareRequest}
            type="button"
            title="Copy URL and request details"
          >
            <FiShare2 size={18} />
            Share
          </button>
          <button
            className="btn btn-ghost"
            onClick={handleShareToGitHub}
            type="button"
            title="Share API configuration to GitHub"
          >
            <FiExternalLink size={18} />
            Share to GitHub
          </button>
          <button
            className="btn btn-ghost"
            onClick={handleDebugUrl}
            type="button"
            title="Open built URL in browser for debugging"
          >
            <FiExternalLink size={18} />
            Debug URL
          </button>
          <span className="save-status-message">{saveStatus || actionMessage}</span>
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
                    value={newBodyKey}
                    onChange={(e) => setNewBodyKey(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={newBodyValue}
                    onChange={(e) => setNewBodyValue(e.target.value)}
                  />
                  <button className="btn btn-primary btn-sm" onClick={addBodyParam}>
                    <FiPlus size={16} />
                  </button>
                </div>
                <div className="rows-list">
                  {Object.entries(bodyParams).map(([key, value]) => (
                    <div key={key} className="row">
                      <span className="key">{key}</span>
                      <span className="value">{value}</span>
                      <button
                        className="btn-delete"
                        onClick={() => removeBodyParam(key)}
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
                    value={newBodyKey}
                    onChange={(e) => setNewBodyKey(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={newBodyValue}
                    onChange={(e) => setNewBodyValue(e.target.value)}
                  />
                  <button className="btn btn-primary btn-sm" onClick={addBodyParam}>
                    <FiPlus size={16} />
                  </button>
                </div>
                <div className="rows-list">
                  {Object.entries(bodyParams).map(([key, value]) => (
                    <div key={key} className="row">
                      <span className="key">{key}</span>
                      <span className="value">{value}</span>
                      <button
                        className="btn-delete"
                        onClick={() => removeBodyParam(key)}
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
              <div className="form-group auth-token-group">
                <label>Bearer Token</label>
                <div className="token-input-row">
                  <input
                    type={showAuthToken ? 'text' : 'password'}
                    value={authTokenState}
                    onChange={(e) => {
                      setAuthTokenLocal(e.target.value);
                      // Reset manual token expiry when user changes the token
                      setManualTokenExpiry(null);
                    }}
                    placeholder="Enter your bearer token"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm token-toggle-btn"
                    onClick={() => setShowAuthToken((prev) => !prev)}
                    title={showAuthToken ? 'Hide token' : 'Show token'}
                  >
                    {showAuthToken ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                  {authTokenState && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        setAuthTokenLocal('');
                        setManualTokenExpiry(null);
                      }}
                      title="Clear token"
                    >
                      <FiX size={16} />
                    </button>
                  )}
                </div>
                {authTokenState && !manualTokenExpiry && sessionToken === '' && (
                  <button
                    className="btn btn-secondary btn-sm" 
                    onClick={() => {
                      const expiryTime = Date.now() + 10 * 60 * 1000;
                      setManualTokenExpiry(expiryTime);
                    }}
                    style={{ marginTop: '0.5rem' }}
                  >
                    Set 10-Min Expiry
                  </button>
                )}
                {manualTokenExpiry && (
                  <div className="token-expiry-info">
                    ⏱ Expires in {Math.ceil((manualTokenExpiry - Date.now()) / 1000)}s
                  </div>
                )}
                {sessionToken && sessionTokenExpiry && (
                  <div className="token-expiry-info" style={{ color: 'var(--success)' }}>
                    ✓ Session Token - Expires in {Math.ceil((sessionTokenExpiry - Date.now()) / 1000)}s
                  </div>
                )}
              </div>
            )}

            {authType === 'basic' && (
              <div className="form-group auth-token-group">
                <label>Credentials</label>
                <div className="token-input-row">
                  <input
                    type={showAuthToken ? 'text' : 'password'}
                    value={authTokenState}
                    onChange={(e) => {
                      setAuthTokenLocal(e.target.value);
                      setManualTokenExpiry(null);
                    }}
                    placeholder="Base64 encoded username:password"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm token-toggle-btn"
                    onClick={() => setShowAuthToken((prev) => !prev)}
                    title={showAuthToken ? 'Hide token' : 'Show token'}
                  >
                    {showAuthToken ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                  {authTokenState && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        setAuthTokenLocal('');
                        setManualTokenExpiry(null);
                      }}
                      title="Clear credentials"
                    >
                      <FiX size={16} />
                    </button>
                  )}
                </div>
                {authTokenState && !manualTokenExpiry && sessionToken === '' && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const expiryTime = Date.now() + 10 * 60 * 1000;
                      setManualTokenExpiry(expiryTime);
                    }}
                    style={{ marginTop: '0.5rem' }}
                  >
                    Set 10-Min Expiry
                  </button>
                )}
                {manualTokenExpiry && (
                  <div className="token-expiry-info">
                    ⏱ Expires in {Math.ceil((manualTokenExpiry - Date.now()) / 1000)}s
                  </div>
                )}
                {sessionToken && sessionTokenExpiry && (
                  <div className="token-expiry-info" style={{ color: 'var(--success)' }}>
                    ✓ Session Token - Expires in {Math.ceil((sessionTokenExpiry - Date.now()) / 1000)}s
                  </div>
                )}
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
            <div className="form-group script-runner-group">
              <label>Run Python Automation</label>
              <div className="script-runner-controls">
                <input
                  type="text"
                  value={authTokenState || sessionToken || ''}
                  readOnly
                  placeholder="Auth token used by Script.py"
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleRunPythonScript}
                  disabled={runningScript}
                >
                  <FiPlay size={14} /> {runningScript ? 'Running...' : 'Run Script.py'}
                </button>
              </div>
              <textarea
                className="script-output"
                value={pythonScriptOutput}
                readOnly
                rows={5}
                placeholder="Script output will appear here"
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
                />
              </div>
              <div className="form-group">
                <label>End Value</label>
                <input
                  type="number"
                  value={automationEnd}
                  onChange={(e) => setAutomationEnd(parseInt(e.target.value) || 10)}
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
                />
              </div>
              <div className="form-group">
                <label>Zero Padding</label>
                <input
                  type="number"
                  value={automationPadding}
                  onChange={(e) => setAutomationPadding(parseInt(e.target.value) || 0)}
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

                  const actualStep = Math.max(1, automationStep);
                  if (automationEnd < automationStart) {
                    alert('Automation end value must be greater than or equal to start value');
                    return;
                  }

                  const totalRuns = Math.max(0, Math.floor((automationEnd - automationStart) / actualStep) + 1);
                  if (totalRuns <= 0) {
                    alert('Please configure a valid automation range');
                    return;
                  }

                  abortAutomationRef.current = false;
                  setIsAutomating(true);
                  const results = [];
                  setAutomationProgress({ current: 0, total: totalRuns, results: [] });

                  const updateFrequency = Math.max(1, Math.floor(totalRuns / 10));

                  for (let runIndex = 0; runIndex < totalRuns; runIndex += 1) {
                    if (abortAutomationRef.current) {
                      break;
                    }

                    const i = automationStart + runIndex * actualStep;
                    const currentProgress = runIndex + 1;

                    try {
                      const paddedValue = automationPadding > 0
                        ? String(i).padStart(automationPadding, '0')
                        : i;

                      let url = endpoint.replace(
                        new RegExp(automationVariable.replace('{{', '\\{{').replace('}}', '\\}}'), 'g'),
                        paddedValue
                      );

                      if (!url.startsWith('http://') && !url.startsWith('https://')) {
                        url = serverUrl + url;
                      }

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

                      if (currentProgress % updateFrequency === 0 || currentProgress === totalRuns) {
                        setAutomationProgress({
                          current: currentProgress,
                          total: totalRuns,
                          results,
                        });
                      }

                      if (i + actualStep <= automationEnd && !abortAutomationRef.current) {
                        await new Promise((resolve) => setTimeout(resolve, automationDelay));
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
                  onClick={() => {
                    abortAutomationRef.current = true;
                    setIsAutomating(false);
                  }}
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
