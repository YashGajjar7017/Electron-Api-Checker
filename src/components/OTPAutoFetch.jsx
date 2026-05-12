import React, { useState, useEffect, useCallback } from 'react';
import useStore from '../store';
import { FiClock, FiRefreshCw, FiCheckCircle } from 'react-icons/fi';
import '../styles/OTPSystem.css';

function OTPAutoFetch() {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, fetching, cached, expired, error
  const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState('');

  const { serverUrl, sessionToken, setSessionToken } = useStore((state) => ({
    serverUrl: state.serverUrl,
    sessionToken: state.sessionToken,
    setSessionToken: state.setSessionToken,
  }));

  const OTP_STORAGE_KEY = 'api_checker_otp_cache';
  const OTP_EXPIRY_KEY = 'api_checker_otp_expiry';

  // Fetch OTP from backend
  const fetchOTP = useCallback(async () => {
    setIsLoading(true);
    setStatus('fetching');
    setError('');

    try {
      const response = await window.electronAPI.sendRequest({
        url: `${serverUrl.replace(/\/$/, '')}/auth/generate-otp`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'electron-app', timestamp: Date.now() }),
      });

      if (response.success && response.status >= 200 && response.status < 300) {
        const data = JSON.parse(response.body || '{}');
        const fetchedOtp = data.otp || data.code || '';

        if (fetchedOtp) {
          // Store OTP in local storage with expiry
          const expiryTime = Date.now() + 600000; // 10 minutes
          localStorage.setItem(OTP_STORAGE_KEY, fetchedOtp);
          localStorage.setItem(OTP_EXPIRY_KEY, expiryTime.toString());

          setOtp(fetchedOtp);
          setStatus('cached');
          setTimeRemaining(600);
          setAttempts(0);

          // Auto-validate after short delay
          await new Promise((resolve) => setTimeout(resolve, 500));
          validateOTP(fetchedOtp);
        } else {
          setStatus('error');
          setError('No OTP in response');
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
  }, [serverUrl]);

  // Validate OTP
  const validateOTP = useCallback(
    async (otpCode) => {
      try {
        const verifyUrl = `${serverUrl.replace(/\/$/, '')}/auth/verify-otp`;
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
            setAttempts(0);
            return true;
          }
        }

        setAttempts((prev) => prev + 1);
        if (attempts >= 2) {
          setStatus('expired');
          localStorage.removeItem(OTP_STORAGE_KEY);
          localStorage.removeItem(OTP_EXPIRY_KEY);
        }
        return false;
      } catch (err) {
        console.error('OTP validation error:', err);
        return false;
      }
    },
    [serverUrl, setSessionToken, attempts]
  );

  // Auto-fetch OTP on mount and set up polling
  useEffect(() => {
    // Check if cached OTP is still valid
    const cachedOtp = localStorage.getItem(OTP_STORAGE_KEY);
    const cachedExpiry = localStorage.getItem(OTP_EXPIRY_KEY);

    if (cachedOtp && cachedExpiry && Date.now() < parseInt(cachedExpiry)) {
      setOtp(cachedOtp);
      setStatus('cached');
      setTimeRemaining(Math.max(0, Math.floor((parseInt(cachedExpiry) - Date.now()) / 1000)));
    } else {
      // Fetch new OTP
      fetchOTP();
    }

    // Set up countdown timer
    const countdownInterval = setInterval(() => {
      const expiry = localStorage.getItem(OTP_EXPIRY_KEY);
      if (expiry) {
        const remaining = Math.max(0, Math.floor((parseInt(expiry) - Date.now()) / 1000));
        setTimeRemaining(remaining);

        if (remaining === 0) {
          setStatus('expired');
          localStorage.removeItem(OTP_STORAGE_KEY);
          localStorage.removeItem(OTP_EXPIRY_KEY);
        }
      }
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [fetchOTP]);

  const handleRefreshOTP = () => {
    localStorage.removeItem(OTP_STORAGE_KEY);
    localStorage.removeItem(OTP_EXPIRY_KEY);
    fetchOTP();
  };

  const copyOTP = () => {
    navigator.clipboard.writeText(otp);
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
            Ready to use
          </div>
        )}

        {status === 'expired' && (
          <div className="otp-status-badge expired">
            <span>OTP Expired</span>
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
