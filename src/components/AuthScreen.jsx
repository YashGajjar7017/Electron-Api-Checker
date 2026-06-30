import React, { useState } from 'react';
import useStore from '../store';
import { FiMail, FiLock, FiLogIn } from 'react-icons/fi';
import GitHubAuth from './GitHubAuth';
import '../styles/AuthScreen.css';

function AuthScreen({ onThemeChange, currentTheme }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'signup' | 'github'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { loginUser, serverUrl } = useStore();

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (activeTab === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (email.length < 3) {
      setError('Email is invalid');
      return;
    }

    setIsLoading(true);
    const targetUrl = serverUrl || 'http://localhost:5000';

    try {
      const endpoint = activeTab === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const response = await fetch(`${targetUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Authentication failed');
      }

      if (activeTab === 'signup') {
        alert('Registration successful! Please login with your credentials.');
        setActiveTab('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        const loggedUser = {
          id: resData.user.id,
          email: resData.user.email,
          username: resData.user.username,
          role: resData.user.role,
          createdAt: new Date()
        };

        if (window.electronAPI && window.electronAPI.saveUser) {
          await window.electronAPI.saveUser(loggedUser);
        }

        if (resData.token) {
          useStore.getState().setSessionToken?.(resData.token, 10);
        }

        loginUser(loggedUser);
      }
    } catch (err) {
      console.warn('MongoDB auth failed, falling back to local session...', err.message);

      if (activeTab === 'signup') {
        setError(`Registration failed: ${err.message}. (Database is offline or unreachable)`);
      } else {
        // Fallback for login
        const fallbackUser = {
          id: 'local-' + Math.random().toString(36).substr(2, 9),
          email,
          username: email.split('@')[0],
          role: email.toLowerCase().includes('admin') ? 'admin' : 'user',
          createdAt: new Date(),
        };

        if (window.electronAPI && window.electronAPI.saveUser) {
          await window.electronAPI.saveUser(fallbackUser);
        }

        loginUser(fallbackUser);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-background">
        <div className="gradient-blob blob-1"></div>
        <div className="gradient-blob blob-2"></div>
        <div className="gradient-blob blob-3"></div>
      </div>

      <div className="auth-content">
        <div className="auth-card glass-lg">
          <div className="auth-header">
            <div className="logo">
              <FiLogIn size={40} />
            </div>
            <h1>API Checker</h1>
            <p className="subtitle">Modern API Testing & Management</p>
          </div>

          <div className="auth-tabs">
            <button
              className={`tab ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('login');
                setError('');
              }}
            >
              Login
            </button>
            <button
              className={`tab ${activeTab === 'signup' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('signup');
                setError('');
              }}
            >
              Sign Up
            </button>
            <button
              className={`tab ${activeTab === 'github' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('github');
                setError('');
              }}
            >
              GitHub Auth
            </button>
          </div>

          {(activeTab === 'login' || activeTab === 'signup') && (
            <form onSubmit={handleAuth} className="auth-form">
              {error && <div className="error-message">{error}</div>}

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-wrapper">
                  <FiMail className="input-icon" />
                  <input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <FiLock className="input-icon" />
                  <input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {activeTab === 'signup' && (
                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <div className="input-wrapper">
                    <FiLock className="input-icon" />
                    <input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-lg auth-btn" disabled={isLoading}>
                {isLoading ? 'Authenticating...' : (activeTab === 'login' ? 'Login' : 'Create Account')}
              </button>
            </form>
          )}

          {activeTab === 'github' && (
            <div className="auth-github-tab-panel animate-fadeIn">
              <p className="tab-instructions">
                Sign in using your GitHub account to backup and synchronize your collections, API requests, and environment settings to GitHub secure private Gist.
              </p>
              <GitHubAuth />
            </div>
          )}

          <div className="demo-note">
            💡 Tip: Use any email and password to get started
          </div>
        </div>

        <button
          className="theme-toggle"
          onClick={() => onThemeChange(currentTheme === 'dark' ? 'light' : 'dark')}
          title="Toggle theme"
        >
          {currentTheme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </div>
  );
}

export default AuthScreen;
