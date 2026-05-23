import React, { useState } from 'react';
import useStore from '../store';
import { FiX, FiUser, FiLock, FiCheck } from 'react-icons/fi';
import '../styles/GitHubSignup.css';

function GitHubSignup({ isOpen, onClose }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const { loginUser } = useStore((s) => ({ loginUser: s.loginUser }));

  if (!isOpen) return null;

  const handleSignup = async () => {
    setSaving(true);
    try {
      // For now, persist credentials in electron app state (NOT recommended for production)
      const user = {
        provider: 'github-manual',
        username,
        token: `basic-${btoa(`${username}:${password}`)}`,
        savedAt: new Date().toISOString(),
      };
      if (window.electronAPI?.saveUser) await window.electronAPI.saveUser(user);
      loginUser(user);
      onClose();
    } catch (err) {
      console.error('Signup failed', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="github-signup-overlay">
      <div className="github-signup-panel">
        <div className="signup-header">
          <h3>Sign in / Sign up (GitHub)</h3>
          <button className="close-btn" onClick={onClose}><FiX /></button>
        </div>
        <div className="signup-body">
          <label>
            <FiUser /> Username or email
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label>
            <FiLock /> Password or token
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        </div>
        <div className="signup-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSignup} disabled={saving || !username || !password}>
            <FiCheck /> {saving ? 'Saving...' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GitHubSignup;
