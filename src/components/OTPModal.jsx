import React, { useState, useRef, useEffect } from 'react';
import { FiLock, FiShield, FiX } from 'react-icons/fi';
import '../styles/OTPModal.css';

function OTPModal({ isOpen, onVerify, onCancel }) {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setOtp('');
      setError('');
      setIsVerifying(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleVerify = async () => {
    setError('');
    if (!otp || otp.length < 4) {
      setError('Please enter a valid OTP');
      return;
    }

    setIsVerifying(true);
    try {
      // Simulate OTP verification delay
      await new Promise((resolve) => setTimeout(resolve, 800));
      onVerify(otp);
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleVerify();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="otp-modal-overlay">
      <div className="otp-modal glass-lg">
        <button className="otp-modal-close" onClick={onCancel}>
          <FiX size={20} />
        </button>

        <div className="otp-modal-header">
          <div className="otp-icon">
            <FiShield size={32} />
          </div>
          <h2>Authentication Required</h2>
          <p className="otp-subtitle">
            Your session has expired. Enter the OTP to continue.
          </p>
        </div>

        <div className="otp-modal-body">
          {error && <div className="otp-error">{error}</div>}

          <div className="otp-input-group">
            <label>One-Time Password (OTP)</label>
            <div className="otp-input-wrapper">
              <FiLock className="otp-input-icon" />
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                onKeyPress={handleKeyPress}
                autoFocus
              />
            </div>
            <span className="otp-hint">
              Session will be valid for 10 minutes
            </span>
          </div>

          <button
            className="btn btn-primary btn-lg otp-verify-btn"
            onClick={handleVerify}
            disabled={isVerifying}
          >
            {isVerifying ? 'Verifying...' : 'Verify & Continue'}
          </button>

          <button className="btn btn-text otp-cancel-btn" onClick={onCancel}>
            Cancel Request
          </button>
        </div>
      </div>
    </div>
  );
}

export default OTPModal;

