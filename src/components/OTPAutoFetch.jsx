import React, { useState, useEffect, useCallback, useRef } from 'react';
import useStore from '../store';
import { FiClock, FiRefreshCw, FiCheckCircle } from 'react-icons/fi';
import '../styles/OTPSystem.css';

function OTPAutoFetch() {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, fetching, cached, validated, expired, error
  const [timeRemaining, setTimeRemaining] = useState(600);
  const [error, setError] = useState('');
  const attemptsRef = useRef(0);

  const { serverUrl, setSessionToken, setOTPData, clearOTPData } = useStore((state) => ({
    serverUrl: state.serverUrl,
    setSessionToken: state.setSessionToken,
    setOTPData: state.setOTPData,
    clearOTPData: state.clearOTPData,
  }));

  const OTP_STORAGE_KEY = 'api_checker_otp_cache';
  const OTP_EXPIRY_KEY = 'api_checker_otp_expiry';

  const resetAttempts = () => {
    attemptsRef.current = 0;
  };

  const clearCachedOtp = () => {
    localStorage.removeItem(OTP_STORAGE_KEY);
    localStorage.removeItem(OTP_EXPIRY_KEY);
    clearOTPData();
  };

  const validateOTP = useCallback(
    async (otpCode) => {
      if (!otpCode) {
        setStatus('error');
        setError('OTP missing for verification');
        return false;
      }

      try {
      const backendUrl = (() => {
        // Robustly map UI base URL -> backend base URL
        // UI default is http://localhost:3000, backend is http://localhost:5000
        const s = String(serverUrl || '');
        if (s.startsWith('http://localhost:5000') || s.startsWith('https://localhost:5000')) return s;
        return s.replace(/localhost:\s*3000\b/i, 'localhost:5000');
      })();
        const verifyUrl = `${backendUrl.replace(/\/$/, '')}/auth/verify-otp`;
        const result = await window.electronAPI.sendRequest({
          url: verifyUrl,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ otp: otpCode, source: 'electron-app' }),
        });

        if (result.success && result.status >= 200 && result.status < 300) {
          const response = JSON.parse(result.body || '{}');
          const token = response.token || response.data?.token;

          if (token) {
            setSessionToken(token, 10);
            setStatus('validated');
            resetAttempts();
            return true;
          }
        }

        attemptsRef.current += 1;
        setStatus('error');
        setError('OTP validation failed');

        if (attemptsRef.current >= 3) {
          setStatus('expired');
          clearCachedOtp();
        }

        return false;
      } catch (err) {
        attemptsRef.current += 1;
        setStatus('error');
        setError(err.message || 'OTP validation failed');
        console.error('OTP validation error:', err);

        if (attemptsRef.current >= 3) {
          setStatus('expired');
          clearCachedOtp();
        }

        return false;
      }
    },
    [serverUrl, setSessionToken, clearCachedOtp]
  );

  const fetchOTP = useCallback(async () => {
    setIsLoading(true);
    setStatus('fetching');
    setError('');

    try {
      // Use backend server at port 5000 instead of frontend at port 3000
      const backendUrl = (() => {
        const s = String(serverUrl || '');
        if (s.startsWith('http://localhost:5000') || s.startsWith('https://localhost:5000')) return s;
        return s.replace(/localhost:\s*3000\b/i, 'localhost:5000');
      })();
      const response = await window.electronAPI.sendRequest({
        // url: `${serverUrl.replace(/\/$/, '')}/auth/generate-otp`,
        url: `${backendUrl.replace(/\/$/, '')}/api/login`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'electron-app', timestamp: Date.now() }),
      });

      if (response.success && response.status >= 200 && response.status < 300) {
        const data = JSON.parse(response.body || '{}');
        // Handle nested data structures from server
        const fetchedOtp = data.otp || data.code || data.Data?.otp || data.Data?.code || '';

        if (fetchedOtp) {
          const expiryTime = Date.now() + 600000;
          localStorage.setItem(OTP_STORAGE_KEY, fetchedOtp);
          localStorage.setItem(OTP_EXPIRY_KEY, expiryTime.toString());
          setOTPData(fetchedOtp, expiryTime);
          setOtp(fetchedOtp);
          setStatus('cached');
          setTimeRemaining(600);
          resetAttempts();

          await new Promise((resolve) => setTimeout(resolve, 500));
          await validateOTP(fetchedOtp);
        } else {
          setStatus('error');
          setError('No OTP returned from server');
        }
      } else {
        setStatus('error');
        setError(response.error || 'Failed to fetch OTP');
      }
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Request failed');
      console.error('OTP fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [serverUrl, setOTPData, validateOTP]);

  useEffect(() => {
    const cachedOtp = localStorage.getItem(OTP_STORAGE_KEY);
    const cachedExpiry = localStorage.getItem(OTP_EXPIRY_KEY);
    const expiryValue = cachedExpiry ? parseInt(cachedExpiry, 10) : 0;

    if (cachedOtp && expiryValue > Date.now()) {
      setOtp(cachedOtp);
      setStatus('cached');
      setTimeRemaining(Math.max(0, Math.floor((expiryValue - Date.now()) / 1000)));
      setOTPData(cachedOtp, expiryValue);
      validateOTP(cachedOtp);
    } else {
      clearCachedOtp();
      fetchOTP();
    }

    const countdownInterval = setInterval(() => {
      const expiry = localStorage.getItem(OTP_EXPIRY_KEY);
      if (expiry) {
        const remaining = Math.max(0, Math.floor((parseInt(expiry, 10) - Date.now()) / 1000));
        setTimeRemaining(remaining);

        if (remaining === 0) {
          setStatus('expired');
          clearCachedOtp();
        }
      }
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [fetchOTP, validateOTP, setOTPData, clearCachedOtp]);

  const handleRefreshOTP = () => {
    clearCachedOtp();
    fetchOTP();
  };

  const copyOTP = () => {
    if (otp) navigator.clipboard.writeText(otp);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`otp-auto-fetch otp-status-${status}`}>
      <div className="otp-content">
        <div className="otp-header">
          <div className="otp-title">
            <FiClock className="otp-icon" />
            <span>One-Time Password</span>
          </div>
          <button onClick={handleRefreshOTP} disabled={isLoading} className="otp-refresh" title="Fetch new OTP">
            <FiRefreshCw className={isLoading ? 'spinning' : ''} />
          </button>
        </div>

        {otp && (
          <div className="otp-display">
            <div className="otp-value" onClick={copyOTP} title="Click to copy">
              {otp}
            </div>
            <div className="otp-timer" style={{ color: timeRemaining < 120 ? '#f87171' : '#22c55e' }}>
              <FiClock size={14} />
              {formatTime(timeRemaining)}
            </div>
          </div>
        )}

        {isLoading && <div className="otp-loading">Fetching OTP...</div>}

        {error && <div className="otp-error">{error}</div>}

        {status === 'cached' && (
          <div className="otp-status-badge success">
            <FiCheckCircle size={14} />
            OTP cached and ready
          </div>
        )}

        {status === 'validated' && (
          <div className="otp-status-badge success">
            <FiCheckCircle size={14} />
            Session token validated
          </div>
        )}

        {status === 'expired' && (
          <div className="otp-status-badge expired">
            <span>OTP expired</span>
            <button onClick={handleRefreshOTP} className="otp-regenerate">
              Regenerate
            </button>
          </div>
        )}

        <div className="otp-footer">
          <small>Automatically generated and cached for 10 minutes</small>
        </div>
      </div>
    </div>
  );
}

export default OTPAutoFetch;
