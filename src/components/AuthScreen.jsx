import React, { useState } from 'react';
import useStore from '../store';
import { FiLock, FiLogIn, FiUser, FiEye, FiEyeOff, FiShield } from 'react-icons/fi';
import '../styles/AuthScreen.css';

function AuthScreen({ onThemeChange, currentTheme }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    loginUser,
    setSecurityRole,
    setSessionToken,
    environments,
    activeEnvironment,
    serverUrl,
  } = useStore((state) => ({
    loginUser: state.loginUser,
    setSecurityRole: state.setSecurityRole,
    setSessionToken: state.setSessionToken,
    environments: state.environments,
    activeEnvironment: state.activeEnvironment,
    serverUrl: state.serverUrl,
  }));

  const getBaseUrl = () => {
    const activeEnv = environments?.find((e) => e.id === activeEnvironment) || environments?.[0];
    return (activeEnv?.baseUrl || serverUrl || 'http://192.168.4.1').replace(/\/$/, '');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      const baseUrl = getBaseUrl();
      const loginUrl = `${baseUrl}/api/login`;

      let result = null;

      // Try via Electron native (no CORS restriction)
      if (window.electronAPI && typeof window.electronAPI.sendRequest === 'function') {
        result = await window.electronAPI.sendRequest({
          url: loginUrl,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password }),
        });
      } else {
        // Fallback: browser fetch
        const resp = await fetch(loginUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password }),
        });
        result = {
          success: resp.ok,
          status: resp.status,
          body: await resp.text(),
        };
      }

      if (!result.success && result.status !== 200) {
        setError(`Login failed (${result.status || 'Network Error'}). Check your credentials.`);
        setIsLoading(false);
        return;
      }

      // Parse the response body
      let responseData = {};
      try {
        responseData = JSON.parse(result.body || '{}');
      } catch {
        responseData = {};
      }

      // Extract session token — support multiple common response shapes
      const sessionTokenValue =
        responseData?.Data?.token ||
        responseData?.data?.token ||
        responseData?.token ||
        responseData?.access_token ||
        responseData?.session ||
        responseData?.sessionToken ||
        null;

      // Extract role from response if present
      const responseRole =
        responseData?.Data?.role ||
        responseData?.data?.role ||
        responseData?.role ||
        null;

      // Map response role strings to internal role IDs
      const roleMap = {
        viewer: 'viewer',
        operator: 'operator',
        sysadmin: 'sysadmin',
        'sys admin': 'sysadmin',
        'system admin': 'sysadmin',
        secadmin: 'secadmin',
        'sec admin': 'secadmin',
        'security admin': 'secadmin',
        admin: 'sysadmin',
      };
      const resolvedRole = responseRole
        ? roleMap[String(responseRole).toLowerCase()] || 'operator'
        : 'operator';

      // Build user profile
      const userProfile = {
        id: `session-${Date.now()}`,
        username: username.trim(),
        email: `${username.trim()}@device.local`,
        role: resolvedRole,
        displayName: username.trim(),
        loginTime: new Date().toISOString(),
      };

      // Persist session cookie
      try {
        const expiry = new Date(Date.now() + 8 * 60 * 60 * 1000).toUTCString();
        document.cookie = `securityRole=${resolvedRole}; expires=${expiry}; path=/; SameSite=Strict`;
        document.cookie = `sessionAuth=true; expires=${expiry}; path=/; SameSite=Strict`;
      } catch {}

      // Save user in Electron storage
      if (window.electronAPI?.saveUser) {
        await window.electronAPI.saveUser(userProfile);
      }

      // Store session token (valid for 60 min by default; adjust if API says otherwise)
      if (sessionTokenValue) {
        const validMinutes = responseData?.Data?.valid_for
          ? Math.ceil(responseData.Data.valid_for / 60)
          : responseData?.valid_for
          ? Math.ceil(responseData.valid_for / 60)
          : 60;
        setSessionToken(sessionTokenValue, validMinutes);
        console.log(`✅ Session token stored for ${validMinutes} min`);
      } else {
        console.warn('⚠️ No session token found in login response — APIs will run without auth header');
      }

      setSecurityRole(resolvedRole);
      loginUser(userProfile);
    } catch (err) {
      console.error('Login error:', err);
      setError(`Connection error: ${err.message || 'Unable to reach device'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-background">
        <div className="gradient-blob blob-1" style={{ background: 'radial-gradient(circle, #7c3aed55 0%, transparent 70%)' }} />
        <div className="gradient-blob blob-2" style={{ background: 'radial-gradient(circle, #6366f133 0%, transparent 70%)' }} />
        <div className="gradient-blob blob-3" />
        <div className="auth-grid-overlay" />
      </div>

      <div className="auth-content">
        <div className="auth-split auth-split--centered">

          {/* Left: Brand panel */}
          <div className="auth-role-panel">
            <div className="auth-brand">
              <div className="auth-brand-icon" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1aa 100%)', boxShadow: '0 0 30px rgba(124,58,237,0.3)' }}>
                <FiShield size={28} />
              </div>
              <div>
                <h2 className="auth-brand-name">IoT Monitor</h2>
                <p className="auth-brand-sub">Secure Access Portal</p>
              </div>
            </div>

            <div className="auth-role-card-wrap">
              <div
                className="auth-role-card"
                style={{
                  borderColor: 'rgba(124,58,237,0.4)',
                  background: 'linear-gradient(135deg, rgba(13,18,34,0.95) 0%, rgba(124,58,237,0.08) 100%)',
                  boxShadow: '0 0 40px rgba(124,58,237,0.18), inset 0 1px 0 rgba(124,58,237,0.2)',
                }}
              >
                <div className="role-card-icon" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(124,58,237,0.3) 100%)', border: '2px solid rgba(124,58,237,0.4)', color: '#7c3aed' }}>
                  <span style={{ fontSize: '32px' }}>🔐</span>
                </div>
                <div className="role-card-body">
                  <div className="role-card-number" style={{ color: '#7c3aed' }}>SESSION BASED AUTH</div>
                  <h3 className="role-card-title" style={{ color: '#7c3aed' }}>Device Login</h3>
                  <p className="role-card-desc">Sign in with your device credentials. A session token will be automatically captured and applied to all API requests.</p>
                  <div className="role-card-permissions">
                    {[
                      { label: 'Auto Session Token', active: true },
                      { label: 'Auto-injects into APIs', active: true },
                      { label: 'Encrypted Locally', active: true },
                    ].map((p) => (
                      <div
                        key={p.label}
                        className="perm-pill perm-active"
                        style={{ background: 'rgba(124,58,237,0.15)', borderColor: 'rgba(124,58,237,0.4)', color: '#7c3aed' }}
                      >
                        <span>✓</span> {p.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Login Form */}
          <div className="auth-form-panel">
            <div className="auth-card glass-lg" style={{ borderColor: 'rgba(124,58,237,0.3)' }}>
              <div className="auth-header">
                <div className="logo" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1cc 100%)', boxShadow: '0 0 24px rgba(124,58,237,0.35)' }}>
                  <FiLogIn size={28} />
                </div>
                <h1 style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #fff 100%)' }}>
                  Sign In
                </h1>
                <p className="subtitle">Enter your device credentials to continue</p>
              </div>

              <form onSubmit={handleLogin} className="auth-form">
                {error && (
                  <div className="error-message animate-shake">
                    🔒 {error}
                  </div>
                )}

                {/* Username */}
                <div className="form-group">
                  <label htmlFor="username">Username</label>
                  <div className="input-wrapper">
                    <FiUser className="input-icon" />
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username"
                      autoComplete="username"
                      style={{ borderColor: username ? 'rgba(124,58,237,0.4)' : undefined }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <div className="input-wrapper">
                    <FiLock className="input-icon" style={{ color: '#7c3aed' }} />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      style={{ borderColor: password ? 'rgba(124,58,237,0.4)' : undefined }}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((s) => !s)}
                      tabIndex={-1}
                    >
                      {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg auth-btn"
                  disabled={isLoading}
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1cc 100%)',
                    boxShadow: '0 4px 20px rgba(124,58,237,0.35)',
                  }}
                >
                  {isLoading ? (
                    <span className="auth-loading">
                      <span className="auth-spinner" />
                      Authenticating...
                    </span>
                  ) : (
                    <>
                      <FiLogIn size={16} />
                      Sign In
                    </>
                  )}
                </button>
              </form>

              <div className="auth-role-hint" style={{ borderColor: 'rgba(124,58,237,0.25)', background: 'rgba(124,58,237,0.06)' }}>
                <span style={{ color: '#7c3aed' }}>🔑</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                  Session token from the device will be <strong style={{ color: '#7c3aed' }}>auto-injected</strong> into all API requests.
                </span>
              </div>
            </div>
          </div>

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
  );
}

export default AuthScreen;
