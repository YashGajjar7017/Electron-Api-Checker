import React, { useEffect, useState, useCallback } from 'react';
import useStore from '../store';
import { FiGithub, FiLogOut, FiRefreshCw } from 'react-icons/fi';
import '../styles/GitHubAuth.css';

// ── Environment-provided configuration (CRA REACT_APP_ prefix) ───────────────
const GITHUB_CLIENT_ID     = process.env.REACT_APP_GITHUB_CLIENT_ID       || '';
const GITHUB_CLIENT_SECRET = process.env.REACT_APP_GITHUB_CLIENT_SECRET   || '';
const GITHUB_REDIRECT_URI  = process.env.REACT_APP_GITHUB_REDIRECT_URI    || 'myapp://github-auth';
const BACKEND_URL          = process.env.REACT_APP_BACKEND_URL             || 'http://localhost:5000';
const AUTH_SCOPE           = process.env.REACT_APP_GITHUB_SCOPE            || 'user:email read:user';

// ── Constants ─────────────────────────────────────────────────────────────────
const NIP07_NAMESPACE  = 'nip07';           // scheme sent by the OAuth provider
const GITHUB_AUTH_URL  = 'https://github.com/login/oauth/authorize';
const AUTHORIZE_PARAMS = ['client_id', 'redirect_uri', 'scope', 'state', 'allow_signup'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build the redirect URI that the provider calls back to (already registered at GitHub App settings). */
const buildRedirectURL = () =>
  // In Electron the custom protocol myapp:// is registered in electron.js.
  // In browser fallback it resolves to localhost:3000.
  typeof window !== 'undefined' && window.location.protocol === 'myapp:'
    ? GITHUB_REDIRECT_URI   // e.g. "myapp://github-auth"
    : `${window.location.origin}/`; // browser fallback

/** Extract params from the registered redirect-scheme URL (myapp://…) */
const parseRedirectParams = () => {
  if (typeof window === 'undefined') return {};
  // The protocol handler in electron.js strips the protocol prefix and
  // re-navigates to localhost?code=…&state=…, or the URL stays as myapp://…
  try {
    const u  = new URL(window.location.href);
    const p  = new URLSearchParams(u.search || u.hash.replace('#', ''));
    return { code: p.get('code'), state: p.get('state') };
  } catch {
    return {};
  }
};

/**
 * Exchange a GitHub authorization `code` for an `access_token` using the
 * backend proxy  (the backend calls `POST https://github.com/login/oauth/access_token`).
 */
const exchangeCodeForToken = async (code, onSuccess, onError) => {
  try {
    const url = `${BACKEND_URL}/api/auth/github/callback`;
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    onSuccess?.(data);   // { accessToken, refreshToken, expiresIn, scope, tokenType }
  } catch (err) {
    onError?.(err);
  }
};

/**
 * Fetch the currently authenticated GitHub user profile.
 */
const fetchGitHubProfile = async (accessToken) => {
  const headers = {
    Authorization: `token ${accessToken}`,
    Accept:        'application/vnd.github.v3+json',
  };

  const [userRes, emailRes] = await Promise.all([
    fetch('https://api.github.com/user',      { headers }),
    fetch('https://api.github.com/user/emails', { headers }),
  ]);

  if (!userRes.ok) throw new Error('GitHub profile fetch failed');

  const userData = await userRes.json();
  const emailData = await emailRes.json().catch(() => []);
  const primaryEmail =
    emailData.find(e => e.primary)?.email
    || emailData[0]?.email
    || userData.email
    || '';

  return {
    id:         userData.id,
    login:      userData.login,
    email:      primaryEmail,
    avatar:     userData.avatar_url,
    name:       userData.name,
    bio:        userData.bio,
    company:    userData.company,
    location:   userData.location,
    blog:       userData.blog,
    publicRepos: userData.public_repos,
    followers:  userData.followers,
    following:  userData.following,
  };
};

/**
 * POST the access-token + profile to the backend so it persists them in MongoDB.
 */
const persistSessionToBackend = async (profile, accessToken) => {
  try {
    await fetch(`${BACKEND_URL}/api/auth/github/session`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(profile, accessToken),
    });
  } catch {
    // non-fatal – local Electron/file storage will act as fallback
  }
};

// ── Component ─────────────────────────────────────────────────────────────────

const CSRF_ERR   = 'State mismatch — possible CSRF attack. Please retry.';
const MOCK_TOKEN = `ghu_mock_${ Math.random().toString(36).slice(2, 22) }`;

function GitHubAuth() {
  const { user, loginUser, logoutUser } = useStore(
    state => ({ user: state.user, loginUser: state.loginUser, logoutUser: state.logoutUser })
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error,    setError]    = useState('');

  // ── 1. Handle inbound redirect (code + state in URL) ──────────────────────────
  useEffect(() => {
    const { code, state: returnedState } = parseRedirectParams();
    if (!code) return;

    const storedState = localStorage.getItem('github_oauth_state');
    if (!returnedState || storedState !== returnedState) {
      setError(CSRF_ERR);
      return;
    }
    // One-time-use CSRF token
    localStorage.removeItem('github_oauth_state');

    setIsLoading(true);
    setError('');

    exchangeCodeForToken(code,
      async ({ accessToken, refreshToken } = {}) => {
        // Use real token or fall back to mock (dev / unregistered app)
        const token = accessToken || MOCK_TOKEN;
        const profile = await fetchGitHubProfile(token);
        const userData = {
          ...profile,
          provider:    'github',
          token,
          refreshToken: refreshToken || null,
          loginTime:   new Date().toISOString(),
        };

        loginUser(userData);

        if (window.electronAPI?.saveUser) {
          await window.electronAPI.saveUser(userData);
        }
        if (window.electronAPI?.storeToken) {
          await window.electronAPI.storeToken('github', token);
        } else {
          localStorage.setItem('github_token', token);
        }

        await persistSessionToBackend(profile, token);
        setIsLoading(false);
      },
      (err) => {
        setError(err.message || 'Token exchange failed');
        setIsLoading(false);
      }
    );
  }, []);

  // ── 2. Initiate OAuth flow ───────────────────────────────────────────────────
  const handleGitHubLogin = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const state = Math.random().toString(36).slice(2, 17);
      localStorage.setItem('github_oauth_state', state);

      const params = new URLSearchParams({
        client_id:     GITHUB_CLIENT_ID,
        redirect_uri:  GITHUB_REDIRECT_URI,
        scope:         AUTH_SCOPE,
        state,
        allow_signup:  'true',
      });

      const authUrl = `${GITHUB_AUTH_URL}?${params.toString()}`;

      if (window.electronAPI?.openExternalUrl) {
        await window.electronAPI.openExternalUrl(authUrl);
      } else {
        window.open(authUrl, 'github-auth', 'width=600,height=700');
      }
    } catch (err) {
      setError(err.message || 'Failed to initiate GitHub login');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── 3. Refresh access token ──────────────────────────────────────────────────
  const handleRefreshToken = useCallback(async () => {
    if (!user?.refreshToken) {
      setError('No refresh token available — please sign in again.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/github/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken: user.refreshToken }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const { accessToken } = await res.json();

      if (window.electronAPI?.storeToken) {
        await window.electronAPI.storeToken('github', accessToken);
      } else {
        localStorage.setItem('github_token', accessToken);
      }

      loginUser({ ...user, token: accessToken });
    } catch (err) {
      setError(err.message || 'Token refresh failed');
    } finally {
      setIsLoading(false);
    }
  }, [user, loginUser]);

  // ── 4. Logout ────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    logoutUser();

    if (window.electronAPI?.storeToken) {
      await window.electronAPI.storeToken('github', null);
    }
    localStorage.removeItem('github_token');
    localStorage.removeItem('github_oauth_state');

    if (window.electronAPI?.saveUser) {
      await window.electronAPI.saveUser(null);
    }
  }, [logoutUser]);

  // ── Not logged-in state ──────────────────────────────────────────────────────
  if (!user || user.provider !== 'github') {
    return (
      <div className="github-auth-container">
        <button
          className="github-login-btn"
          onClick={handleGitHubLogin}
          disabled={isLoading || !GITHUB_CLIENT_ID}
          title={GITHUB_CLIENT_ID ? 'Sign in with GitHub' : 'Configure REACT_APP_GITHUB_CLIENT_ID in .env'}
        >
          <FiGithub size={18} />
          Sign in with GitHub
        </button>
        {!GITHUB_CLIENT_ID && (
          <div className="auth-error" style={{ marginTop: '8px' }}>
            ⚠ REACT_APP_GITHUB_CLIENT_ID is not set — add GitHub credentials in .env
          </div>
        )}
        {error && <div className="auth-error">{error}</div>}
      </div>
    );
  }

  // ── Logged-in state ─────────────────────────────────────────────────────────
  return (
    <div className="github-auth-container github-authenticated">
      <div className="github-profile">
        <img src={user.avatar} alt={user.login} className="github-avatar" />
        <div className="github-info">
          <div className="github-name">{user.name || user.login}</div>
          <div className="github-email">{user.email}</div>
          {user.company && <div className="github-company">@{user.company}</div>}
        </div>
      </div>

      <div className="github-stats">
        <div className="stat"><span>{user.publicRepos ?? '—'}</span><small>Repos</small></div>
        <div className="stat"><span>{user.followers  ?? '—'}</span><small>Followers</small></div>
        <div className="stat"><span>{user.following  ?? '—'}</span><small>Following</small></div>
      </div>

      <div className="github-actions">
        {user.refreshToken && (
          <button
            className="action-btn refresh"
            onClick={handleRefreshToken}
            disabled={isLoading}
            title="Refresh access token"
          >
            <FiRefreshCw className={isLoading ? 'spinning' : ''} />
            Refresh Token
          </button>
        )}
        <button className="action-btn logout" onClick={handleLogout} title="Sign out from GitHub">
          <FiLogOut />
          Sign Out
        </button>
      </div>

      {error && <div className="auth-error">{error}</div>}
    </div>
  );
}

export default GitHubAuth;
