import React, { useState, useEffect } from 'react';
import useStore from '../store';
import { ROLE_PASSWORDS, ROLE_META } from '../store';
import { FiLock, FiLogIn, FiShield, FiUser, FiEye, FiEyeOff } from 'react-icons/fi';
import '../styles/AuthScreen.css';

const ROLES = [
  { id: 'viewer',   label: 'Viewer',         number: 1 },
  { id: 'operator', label: 'Operator',        number: 2 },
  { id: 'sysadmin', label: 'System Admin',    number: 3 },
  { id: 'secadmin', label: 'Security Admin',  number: 4 },
];

function AuthScreen({ onThemeChange, currentTheme }) {
  const [selectedRole, setSelectedRole] = useState('viewer');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [prevRole, setPrevRole] = useState(null);
  const [roleCardKey, setRoleCardKey] = useState(0);

  const { loginUser, setSecurityRole } = useStore();

  // Animate card when role changes
  useEffect(() => {
    setPrevRole(selectedRole);
    setRoleCardKey(k => k + 1);
    setError('');
  }, [selectedRole]);

  // Read cookie on mount to restore previous role
  useEffect(() => {
    try {
      const match = document.cookie.match(/(?:^|;\s*)securityRole=([^;]*)/);
      if (match && ROLE_PASSWORDS[match[1]]) {
        setSelectedRole(match[1]);
      }
    } catch (e) {}
  }, []);

  const roleMeta = ROLE_META[selectedRole];

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);

    // Simulate a small delay for UX feedback
    await new Promise(r => setTimeout(r, 600));

    const expectedPassword = ROLE_PASSWORDS[selectedRole];
    if (password !== expectedPassword) {
      setError('Incorrect password for selected role');
      setIsLoading(false);
      return;
    }

    // Build the user profile
    const userProfile = {
      id: `local-${selectedRole}`,
      username: 'admin',
      email: `admin@${selectedRole}.local`,
      role: selectedRole,
      displayName: roleMeta.label,
      loginTime: new Date().toISOString(),
    };

    // Set cookie-based session (8 hours)
    try {
      const expiry = new Date(Date.now() + 8 * 60 * 60 * 1000).toUTCString();
      document.cookie = `securityRole=${selectedRole}; expires=${expiry}; path=/; SameSite=Strict`;
      document.cookie = `sessionAuth=true; expires=${expiry}; path=/; SameSite=Strict`;
    } catch (e) {}

    // Save user & set role in store
    if (window.electronAPI?.saveUser) {
      await window.electronAPI.saveUser(userProfile);
    }

    setSecurityRole(selectedRole);
    loginUser(userProfile);
    setIsLoading(false);
  };

  const roleColors = {
    viewer:   { primary: '#3b82f6', glow: 'rgba(59,130,246,0.25)',  border: 'rgba(59,130,246,0.4)'  },
    operator: { primary: '#f59e0b', glow: 'rgba(245,158,11,0.25)',  border: 'rgba(245,158,11,0.4)'  },
    sysadmin: { primary: '#10b981', glow: 'rgba(16,185,129,0.25)',  border: 'rgba(16,185,129,0.4)'  },
    secadmin: { primary: '#8b5cf6', glow: 'rgba(139,92,246,0.25)',  border: 'rgba(139,92,246,0.4)'  },
  };

  const color = roleColors[selectedRole];

  return (
    <div className="auth-container">
      <div className="auth-background">
        <div className="gradient-blob blob-1" style={{ background: `radial-gradient(circle, ${color.primary}55 0%, transparent 70%)` }} />
        <div className="gradient-blob blob-2" style={{ background: `radial-gradient(circle, ${color.primary}33 0%, transparent 70%)` }} />
        <div className="gradient-blob blob-3" />
        {/* Animated grid */}
        <div className="auth-grid-overlay" />
      </div>

      <div className="auth-content">
        <div className="auth-split">

          {/* Left: Role Preview Card */}
          <div className="auth-role-panel">
            <div className="auth-brand">
              <div className="auth-brand-icon" style={{ background: `linear-gradient(135deg, ${color.primary} 0%, ${color.primary}aa 100%)`, boxShadow: `0 0 30px ${color.glow}` }}>
                <FiShield size={28} />
              </div>
              <div>
                <h2 className="auth-brand-name">IoT Monitor</h2>
                <p className="auth-brand-sub">Secure Access Portal</p>
              </div>
            </div>

            <div className="auth-role-card-wrap">
              <div
                key={roleCardKey}
                className="auth-role-card animate-role-card"
                style={{
                  borderColor: color.border,
                  background: `linear-gradient(135deg, rgba(13,18,34,0.95) 0%, ${color.primary}12 100%)`,
                  boxShadow: `0 0 40px ${color.glow}, inset 0 1px 0 ${color.border}`,
                }}
              >
                <div className="role-card-icon" style={{ background: `linear-gradient(135deg, ${color.primary}22 0%, ${color.primary}44 100%)`, border: `2px solid ${color.border}`, color: color.primary }}>
                  <span style={{ fontSize: '32px' }}>{roleMeta.icon}</span>
                </div>
                <div className="role-card-body">
                  <div className="role-card-number" style={{ color: color.primary }}>
                    ROLE {ROLES.find(r => r.id === selectedRole)?.number} OF 4
                  </div>
                  <h3 className="role-card-title" style={{ color: color.primary }}>{roleMeta.label}</h3>
                  <p className="role-card-desc">{roleMeta.description}</p>
                  <div className="role-card-permissions">
                    {[
                      { label: 'Read Access',     active: true },
                      { label: 'Write Config',    active: selectedRole !== 'viewer' },
                      { label: 'System Control',  active: selectedRole === 'sysadmin' || selectedRole === 'secadmin' },
                      { label: 'Security Admin',  active: selectedRole === 'secadmin' },
                    ].map(p => (
                      <div key={p.label} className={`perm-pill ${p.active ? 'perm-active' : 'perm-inactive'}`} style={p.active ? { background: `${color.primary}22`, borderColor: `${color.primary}55`, color: color.primary } : {}}>
                        <span>{p.active ? '✓' : '✗'}</span> {p.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Role selector pills at bottom */}
            <div className="auth-role-pills">
              {ROLES.map(r => (
                <button
                  key={r.id}
                  className={`role-pill-btn ${selectedRole === r.id ? 'role-pill-active' : ''}`}
                  style={selectedRole === r.id ? {
                    background: roleColors[r.id].primary,
                    borderColor: roleColors[r.id].primary,
                    boxShadow: `0 0 12px ${roleColors[r.id].glow}`,
                    color: '#fff'
                  } : { borderColor: roleColors[r.id].border, color: roleColors[r.id].primary }}
                  onClick={() => setSelectedRole(r.id)}
                  type="button"
                >
                  {ROLE_META[r.id].icon} {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Login Form */}
          <div className="auth-form-panel">
            <div className="auth-card glass-lg" style={{ borderColor: color.border }}>
              <div className="auth-header">
                <div className="logo" style={{
                  background: `linear-gradient(135deg, ${color.primary} 0%, ${color.primary}cc 100%)`,
                  boxShadow: `0 0 24px ${color.glow}`
                }}>
                  <FiLogIn size={28} />
                </div>
                <h1 style={{ backgroundImage: `linear-gradient(135deg, ${color.primary} 0%, #fff 100%)` }}>
                  Sign In
                </h1>
                <p className="subtitle">Select your security role and authenticate</p>
              </div>

              <form onSubmit={handleLogin} className="auth-form">
                {error && (
                  <div className="error-message animate-shake">
                    🔒 {error}
                  </div>
                )}

                {/* Username (fixed) */}
                <div className="form-group">
                  <label htmlFor="username">Username</label>
                  <div className="input-wrapper">
                    <FiUser className="input-icon" />
                    <input
                      id="username"
                      type="text"
                      value="admin"
                      readOnly
                      className="input-readonly"
                    />
                    <span className="input-lock-badge">Fixed</span>
                  </div>
                </div>

                {/* Security Role Dropdown */}
                <div className="form-group">
                  <label htmlFor="role-select">Security Role</label>
                  <div className="input-wrapper role-select-wrapper">
                    <FiShield className="input-icon" style={{ color: color.primary }} />
                    <select
                      id="role-select"
                      className="auth-role-select"
                      value={selectedRole}
                      onChange={e => setSelectedRole(e.target.value)}
                      style={{ borderColor: color.border, boxShadow: `0 0 0 1px ${color.border}` }}
                    >
                      {ROLES.map(r => (
                        <option key={r.id} value={r.id}>
                          {ROLE_META[r.id].icon} {r.label}
                        </option>
                      ))}
                    </select>
                    <div className="role-color-dot" style={{ background: color.primary, boxShadow: `0 0 6px ${color.primary}` }} />
                  </div>
                </div>

                {/* Password */}
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <div className="input-wrapper">
                    <FiLock className="input-icon" style={{ color: color.primary }} />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={`Enter password for ${roleMeta.label}`}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                      style={{ borderColor: password ? color.border : undefined }}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(s => !s)}
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
                    background: `linear-gradient(135deg, ${color.primary} 0%, ${color.primary}cc 100%)`,
                    boxShadow: `0 4px 20px ${color.glow}`,
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
                      Sign In as {roleMeta.label}
                    </>
                  )}
                </button>
              </form>

              {/* Role hint */}
              <div className="auth-role-hint" style={{ borderColor: color.border, background: `${color.primary}0d` }}>
                <span style={{ color: color.primary }}>{roleMeta.icon}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                  <strong style={{ color: color.primary }}>{roleMeta.label}</strong> — {roleMeta.description}
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
