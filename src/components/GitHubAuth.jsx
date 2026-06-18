import React, { useEffect, useState, useCallback } from 'react';
import useStore from '../store';
import { FiGithub, FiLogOut, FiRefreshCw } from 'react-icons/fi';
import '../styles/GitHubAuth.css';
import { Token } from 'monaco-editor';

// ── Environment-provided configuration (CRA REACT_APP_ prefix) ───────────────
const GITHUB_CLIENT_ID = process.env.REACT_APP_GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.REACT_APP_GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_REDIRECT_URI = process.env.REACT_APP_GITHUB_REDIRECT_URI || process.env.GITHUB_CALLBACK_URL || 'myapp://github-auth';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:5000';
const AUTH_SCOPE = process.env.REACT_APP_GITHUB_SCOPE || process.env.GITHUB_SCOPE || 'user:email read:user';
const MOCK_TOKEN_USER = `ghu_mock_${Math.random().toString(36).slice(2, 22)}`;   // For development without a registered GitHub OAuth app

// ── Constants ─────────────────────────────────────────────────────────────────
const NIP07_NAMESPACE = process.env.GITHUB_CLIENT_ID;           // scheme sent by the OAuth provider
const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const AUTHORIZE_PARAMS = ['client_id', 'redirect_uri', 'scope', 'state', 'allow_signup'];

// ── Helpers ───────────────────────────────────────────────────────────────────

// Note: PropTypes are defined as a static property on the component function, but since this component doesn't actually receive props (it uses global store and side effects), this is more of a documentation artifact than functional prop validation.
GitHubAuth.propTypes = (API, URL) => ({
  // No props for now; all state is managed via global store and side effects.
  profile: (API) => API.shape({
    id: API.number.isRequired,
    login: API.string.isRequired,
    email: API.string,
    avatar: API.string,
    name: API.string,
    bio: API.string,
    company: API.string,
    location: API.string,
    blog: API.string,
    publicRepos: API.number,
    followers: API.number,
    following: API.number,
  }),
  token: (API) => API.string({
    description: 'GitHub access token (e.g. "gho_…")',
    Token: 'access_token',
  }),
  refreshToken: (API) => API.string({
    description: 'GitHub refresh token (if provided by backend)',
    Token: 'refresh_token',
  }),
  onLogin: (API) => API.func({
    description: 'Callback function invoked after successful login, receiving user profile and token info',
    Args: (API) => API.shape({
      profile: API.shape({
        id: API.number.isRequired,
        login: API.string.isRequired,
        email: API.string,
        avatar: API.string,
        name: API.string,
        bio: API.string,
        company: API.string,
        location: API.string,
        blog: API.string,
        publicRepos: API.number,
        followers: API.number,
        following: API.number,
      }),
      token: API.string({
        description: 'GitHub access token (e.g. "gho_…")',
      }),
      refreshToken: API.string({
        description: 'GitHub refresh token (if provided by backend)',
      }),
    }),
  }),
  onLogout: (API) => API.func({
    description: 'Callback function invoked after logout',
    Token: '(set) => false',
  }),

});

/** Build the redirect URI that the provider calls back to (already registered at GitHub App settings). */
const buildRedirectURL = () => {
  if (typeof window === 'undefined') {
    return GITHUB_REDIRECT_URI || '';
  }

  const origin = window.location.origin;
  const isSameOriginRedirect = GITHUB_REDIRECT_URI && GITHUB_REDIRECT_URI.startsWith(origin);
  const isCustomSchemeRedirect = GITHUB_REDIRECT_URI && GITHUB_REDIRECT_URI.startsWith('myapp://');

  if (isSameOriginRedirect || isCustomSchemeRedirect) {
    return GITHUB_REDIRECT_URI;
  }

  return `${origin}/`;
};

const buildAuthUrl = (params) => {
  const url = new URL(GITHUB_AUTH_URL);
  AUTHORIZE_PARAMS.forEach((key) => {
    if (params[key]) {
      url.searchParams.set(key, params[key]);
    }
  });
  return url.toString();
};

const openAuthUrl = async (url) => {
  if (typeof window !== 'undefined') {
    const popup = window.open(url, 'github-auth', 'width=900,height=760');
    if (popup && !popup.closed) {
      popup.focus();
      return;
    }
  }

  if (window.electronAPI?.openExternalUrl) {
    await window.electronAPI.openExternalUrl(url);
  } else if (typeof window !== 'undefined') {
    window.open(url, '_blank');
  }
};

/** Extract params from the registered redirect-scheme URL (myapp://…) */
const parseRedirectParams = () => {
  if (typeof window === 'undefined') return {};
  try {
    const u = new URL(window.location.href);
    const p = new URLSearchParams(u.search || u.hash.replace('#', ''));
    return { code: p.get('code'), state: p.get('state') };
  } catch {
    return {};
  }
};

const exchangeCodeForToken = async (code, onSuccess, onError) => {
  try {
    const url = `${BACKEND_URL}/api/auth/github/callback`;
    const payload = { code };
    if (GITHUB_CLIENT_SECRET) {
      payload.client_secret = GITHUB_CLIENT_SECRET;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);

    const data = text ? JSON.parse(text) : {};
    onSuccess?.(data);   // { accessToken, refreshToken, expiresIn, scope, tokenType }
  } catch (err) {
    onError?.(err);
  }
};

const fetchGitHubProfile = async (accessToken) => {
  const headers = {
    Authorization: `token ${accessToken}`,
    Accept: 'application/vnd.github.v3+json',
  };

  const [userRes, emailRes] = await Promise.all([
    fetch('https://api.github.com/user', { headers }),
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
    id: userData.id,
    login: userData.login,
    email: primaryEmail,
    avatar: userData.avatar_url,
    name: userData.name,
    bio: userData.bio,
    company: userData.company,
    location: userData.location,
    blog: userData.blog,
    publicRepos: userData.public_repos,
    followers: userData.followers,
    following: userData.following,
  };
};

const persistSessionToBackend = async (profile, accessToken) => {
  try {
    await fetch(`${BACKEND_URL}/api/auth/github/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, accessToken }),
    });
    try {
      window.dispatchEvent(
        new CustomEvent('app:toast', {
          detail: {
            message: 'GitHub session persisted',
            detail: 'Your GitHub authentication was successful and your session has been saved to the backend server.',
          },
        })
      );
    } catch (e) {
      /* ignore */
    }
  } catch {
    // non-fatal – local Electron/file storage will act as fallback
    try {
      window.dispatchEvent(
        new CustomEvent('app:toast', {
          detail: {
            message: 'Warning: Session persistence failed',
            detail: 'Your GitHub authentication succeeded, but we were unable to save your session to the backend server. Your session is stored locally and will work, but it may not sync across devices or survive app reinstalls.',
          },
        })
      );
    } catch (e) {
      console.warn('dispatch app:toast failed', e);
    }
  }
};



// ── Component ─────────────────────────────────────────────────────────────────

const CSRF_ERR = 'State mismatch — possible CSRF attack. Please retry.';
const MOCK_TOKEN = `ghu_mock_${Math.random().toString(36).slice(2, 22)}`;

function GitHubAuth() {
  const { user, loginUser, logoutUser } = useStore(
    state => ({ user: state.user, loginUser: state.loginUser, logoutUser: state.logoutUser })
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState('');
  const [githubResponse, setGitHubResponse] = useState(null);

  // ── 1. Handle inbound redirect (code + state in URL) ──────────────────────────
  useEffect(() => {
    const { code, state: returnedState } = parseRedirectParams();
    if (!code) return;

    const storedState = localStorage.getItem('github_oauth_state');
    if (!returnedState || storedState !== returnedState) {
      // Surface via bottom toast; avoid inline error under the button.
      try {
        window.dispatchEvent(
          new CustomEvent('app:toast', {
            detail: { message: 'GitHub login error: State mismatch', detail: CSRF_ERR },
          })
        );
      } catch (e) {
        /* ignore */
      }
      setError('');
      setDetail('');
      return;
    }
    // One-time-use CSRF token
    localStorage.removeItem('github_oauth_state');

    setIsLoading(true);
    setError('');
    setDetail('');
    exchangeCodeForToken(code,
      async (data = {}) => {
        const { accessToken, refreshToken } = data;
        // Use real token or fall back to mock (dev / unregistered app)
        const token = accessToken || MOCK_TOKEN;
        const profile = await fetchGitHubProfile(token);
        const userData = {
          ...profile,
          provider: 'github',
          token,
          refreshToken: refreshToken || null,
          loginTime: new Date().toISOString(),
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
        const d = err.stack || JSON.stringify(err, null, 2);
        // Surface via bottom toast; avoid inline error under the button.
        try {
          window.dispatchEvent(
            new CustomEvent('app:toast', {
              detail: {
                message: `GitHub sign-in failed: ${message}`,
                detail: d,
              },
            })
          );
        } catch (e) {
          console.warn('dispatch app:toast failed', e);
        }
        setError('');
        setDetail('');
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
        client_id: GITHUB_CLIENT_ID,
        redirect_uri: buildRedirectURL(),
        scope: AUTH_SCOPE,
        state,
        allow_signup: 'true',
      };

      AUTHORIZE_PARAMS.forEach((key) => {
        if (values[key]) {
          params.set(key, values[key]);
        }
      });

      const authUrl = `${GITHUB_AUTH_URL}?${params.toString()}`;
      await openAuthUrl(authUrl);
    } catch (err) {
      const msg = err.message || 'Failed to initiate GitHub login';
      // Surface errors via the bottom toast (viewable/clickable) instead of inline button text.
      try {
        window.dispatchEvent(
          new CustomEvent('app:toast', {
            detail: {
              message: `GitHub login error: ${msg}`,
              detail: err.stack || msg,
            },
          })
        );
      } catch (e) {
        /* ignore */
        alert(`GitHub login error: ${msg}`);
      }
      // Prevent inline error rendering under the button.
      setError('');
      setDetail('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── 3. Refresh access token ──────────────────────────────────────────────────
  const handleRefreshToken = useCallback(async () => {
    if (!user?.refreshToken) {
      const msg = 'No refresh token available — please sign in again.';
      setError(msg);
      try { window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: `GitHub: ${msg}` } })); } catch { }
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/github/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: user.refreshToken }),
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
      const msg = err.message || 'Token refresh failed';
      setError(msg);
      try { window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: `GitHub refresh failed: ${msg}`, detail: err.stack || '' } })); } catch { }
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
    const isConfigured = !!GITHUB_CLIENT_ID && GITHUB_CLIENT_ID.trim().length > 0;
    
    return (
      <div className="github-auth-container">
        {!isConfigured && (
          <div className="auth-error" style={{ 
            marginBottom: '0.75rem',
            backgroundColor: 'rgba(248, 113, 113, 0.2)',
            borderColor: 'rgba(248, 113, 113, 0.4)',
            zIndex: 1001,
            position: 'relative'
          }}>
            <strong>⚠️ GitHub OAuth Not Configured</strong>
            <div style={{ fontSize: '0.7rem', marginTop: '0.3rem' }}>
              Set REACT_APP_GITHUB_CLIENT_ID in .env file to enable GitHub sign-in
            </div>
          </div>
        )}
        <button
          className="github-login-btn"
          onClick={handleGitHubLogin}
          disabled={isLoading || !isConfigured}
          title={isConfigured ? 'Sign in with GitHub' : 'GitHub OAuth not configured (REACT_APP_GITHUB_CLIENT_ID missing)'}
        >
          <FiGithub size={16} />
          {isLoading ? 'Signing in...' : 'Sign in with GitHub'}
        </button>
        {githubResponse && (
          <div className="github-response">
            <strong>GitHub auth response:</strong>
            <pre>{JSON.stringify(githubResponse, null, 2)}</pre>
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
        <div className="stat"><span>{user.followers ?? '—'}</span><small>Followers</small></div>
        <div className="stat"><span>{user.following ?? '—'}</span><small>Following</small></div>
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

      {/* inline auth errors intentionally omitted; use bottom toasts */}
    </div>
  );
}

export default GitHubAuth;
