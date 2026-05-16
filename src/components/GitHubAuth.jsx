import React, { useEffect, useState, useCallback } from 'react';
import useStore from '../store';
import { FiGithub, FiLogOut, FiRefreshCw } from 'react-icons/fi';
import '../styles/GitHubAuth.css';

// ── Environment-provided configuration (CRA REACT_APP_ prefix) ───────────────
const GITHUB_CLIENT_ID     = process.env.REACT_APP_GITHUB_CLIENT_ID     || process.env.GITHUB_CLIENT_ID     || '';
const GITHUB_CLIENT_SECRET = process.env.REACT_APP_GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_REDIRECT_URI  = process.env.REACT_APP_GITHUB_REDIRECT_URI  || process.env.GITHUB_CALLBACK_URL    || 'myapp://github-auth';
const BACKEND_URL          = process.env.REACT_APP_BACKEND_URL         || process.env.BACKEND_URL          || 'http://localhost:5000';
const AUTH_SCOPE           = process.env.REACT_APP_GITHUB_SCOPE         || process.env.GITHUB_SCOPE         || 'user:email read:user';

// ── Constants ─────────────────────────────────────────────────────────────────
const NIP07_NAMESPACE  = 'nip07';           // scheme sent by the OAuth provider
const GITHUB_AUTH_URL  = 'https://github.com/login/oauth/authorize';
const AUTHORIZE_PARAMS = ['client_id', 'redirect_uri', 'scope', 'state', 'allow_signup'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build the redirect URI that the provider calls back to (already registered at GitHub App settings). */
const buildRedirectURL = () => {
  if (typeof window === 'undefined') return GITHUB_REDIRECT_URI;

  const isCustomOAuthScheme = window.location.protocol === 'myapp:'
    || window.location.protocol === `${NIP07_NAMESPACE}:`;

  return isCustomOAuthScheme ? GITHUB_REDIRECT_URI : `${window.location.origin}/`;
};

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
    const payload = { code };
    if (GITHUB_CLIENT_SECRET) {
      payload.client_secret = GITHUB_CLIENT_SECRET;
    }
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);

    const data = text ? JSON.parse(text) : {};
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
      body:    JSON.stringify({ profile, accessToken }),
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
  const [detail,   setDetail]   = useState('');
  const [githubResponse, setGitHubResponse] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);

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
      async (data = {}) => {
        const { accessToken, refreshToken } = data;
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

        setGitHubResponse(data);
        await persistSessionToBackend(profile, token);
        setIsLoading(false);
      },
      (err) => {
        const message = err.message || 'Token exchange failed';
        setError(message);
        setDetail(err.stack || JSON.stringify(err, null, 2));
        setShowErrorModal(true);
        setIsLoading(false);
      }
    );
  }, [loginUser]);

  // ── 2. Initiate OAuth flow ───────────────────────────────────────────────────
  const handleGitHubLogin = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setDetail('');

    try {
      if (!GITHUB_CLIENT_ID) {
        throw new Error('GitHub OAuth client ID is not configured. Please set REACT_APP_GITHUB_CLIENT_ID in .env.');
      }

      const state = Math.random().toString(36).slice(2, 17);
      localStorage.setItem('github_oauth_state', state);

      const params = new URLSearchParams();
      const values = {
        client_id:    GITHUB_CLIENT_ID,
        redirect_uri: buildRedirectURL(),
        scope:        AUTH_SCOPE,
        state,
        allow_signup: 'true',
      };

      AUTHORIZE_PARAMS.forEach((key) => {
        if (values[key]) {
          params.set(key, values[key]);
        }
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
    setGitHubResponse(null);
    setDetail('');

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
          disabled={isLoading}
          title={GITHUB_CLIENT_ID ? 'Sign in with GitHub' : 'GitHub OAuth not configured (REACT_APP_GITHUB_CLIENT_ID missing)'}
        >
          <FiGithub size={18} />
          Sign in with GitHub
        </button>
        {!GITHUB_CLIENT_ID && (
          <div className="auth-error" style={{ marginTop: '8px' }}>
            ⚠ GitHub OAuth is not configured. Set REACT_APP_GITHUB_CLIENT_ID in .env to enable sign-in.
          </div>
        )}
        {error && <div className="auth-error">{error}</div>}
        {githubResponse && (
          <div className="github-response">
            <strong>GitHub auth response:</strong>
            <pre>{JSON.stringify(githubResponse, null, 2)}</pre>
          </div>
        )}
        {showErrorModal && detail && (
          <div className="github-error-modal" role="dialog" aria-modal="true">
            <div className="github-error-modal-content">
              <h3>GitHub sign-in failed</h3>
              <pre>{detail}</pre>
              <button className="github-error-modal-close" onClick={() => setShowErrorModal(false)}>
                Close
              </button>
            </div>
          </div>
        )}
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
