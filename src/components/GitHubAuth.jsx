import React, { useState } from 'react';
import useStore from '../store';
import { FiGithub, FiLogOut, FiRefreshCw } from 'react-icons/fi';
import '../styles/GitHubAuth.css';

// GitHub OAuth configuration
// Note: In production, use environment variables
const GITHUB_CLIENT_ID = process.env.REACT_APP_GITHUB_CLIENT_ID || 'your_client_id';
const GITHUB_REDIRECT_URI = 'http://localhost:3000/auth/github/callback';

function GitHubAuth() {
  const { user, loginUser, logoutUser } = useStore((state) => ({
    user: state.user,
    loginUser: state.loginUser,
    logoutUser: state.logoutUser,
  }));

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Initiate GitHub OAuth flow
  const handleGitHubLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Generate a state token for CSRF protection
      const state = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('github_oauth_state', state);

      // Build the authorization URL
      const authUrl = new URL('https://github.com/login/oauth/authorize');
      authUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', GITHUB_REDIRECT_URI);
      authUrl.searchParams.set('scope', 'user:email read:user');
      authUrl.searchParams.set('state', state);

      // Open the authorization URL
      if (window.electronAPI?.openExternalUrl) {
        await window.electronAPI.openExternalUrl(authUrl.toString());
      } else {
        window.open(authUrl.toString(), 'github-auth', 'width=600,height=700');
      }

      // Listen for the callback
      const handleCallback = (event) => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const returnedState = urlParams.get('state');
        const storedState = localStorage.getItem('github_oauth_state');

        if (returnedState !== storedState) {
          setError('State mismatch - possible CSRF attack');
          window.removeEventListener('message', handleCallback);
          return;
        }

        if (code) {
          exchangeCodeForToken(code);
          window.removeEventListener('message', handleCallback);
        }
      };

      window.addEventListener('message', handleCallback);
    } catch (err) {
      setError(err.message || 'Failed to initiate GitHub login');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Exchange authorization code for access token
  const exchangeCodeForToken = async (code) => {
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3000/api/auth/github/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        throw new Error('Token exchange failed');
      }

      const data = await response.json();
      const { accessToken, user: githubUser } = data;

      // Store token securely
      if (window.electronAPI?.storeToken) {
        await window.electronAPI.storeToken('github', accessToken);
      } else {
        localStorage.setItem('github_token', accessToken);
      }

      // Fetch user profile
      fetchGitHubProfile(accessToken);
    } catch (err) {
      setError(err.message || 'Token exchange failed');
      setIsLoading(false);
    }
  };

  // Step 3: Fetch user profile from GitHub
  const fetchGitHubProfile = async (accessToken) => {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch GitHub profile');
      }

      const profile = await response.json();

      // Fetch user email
      const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      const emails = await emailResponse.json();
      const primaryEmail = emails.find((e) => e.primary)?.email || emails[0]?.email || profile.email;

      // Create user object
      const userData = {
        id: profile.id,
        login: profile.login,
        email: primaryEmail,
        avatar: profile.avatar_url,
        name: profile.name,
        bio: profile.bio,
        company: profile.company,
        location: profile.location,
        blog: profile.blog,
        publicRepos: profile.public_repos,
        followers: profile.followers,
        following: profile.following,
        provider: 'github',
        token: accessToken,
        loginTime: new Date().toISOString(),
      };

      // Save to store and persistent storage
      loginUser(userData);

      if (window.electronAPI?.saveUser) {
        await window.electronAPI.saveUser(userData);
      }

      setIsLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to fetch GitHub profile');
      setIsLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    logoutUser();

    if (window.electronAPI?.storeToken) {
      await window.electronAPI.storeToken('github', null);
    }

    localStorage.removeItem('github_token');
    localStorage.removeItem('github_oauth_state');

    if (window.electronAPI?.saveUser) {
      await window.electronAPI.saveUser(null);
    }
  };

  // Refresh token if needed
  const handleRefreshToken = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3000/api/auth/github/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: user?.refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      const { accessToken } = data;

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
  };

  if (!user || user.provider !== 'github') {
    return (
      <div className="github-auth-container">
        <button
          className="github-login-btn"
          onClick={handleGitHubLogin}
          disabled={isLoading}
          title="Sign in with GitHub"
        >
          <FiGithub size={18} />
          Sign in with GitHub
        </button>
        {error && <div className="auth-error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="github-auth-container github-authenticated">
      <div className="github-profile">
        <img src={user.avatar} alt={user.login} className="github-avatar" />
        <div className="github-info">
          <div className="github-name">{user.name || user.login}</div>
          <div className="github-email">{user.email}</div>
          {user.company && <div className="github-company">@ {user.company}</div>}
        </div>
      </div>

      <div className="github-stats">
        <div className="stat">
          <span>{user.publicRepos}</span>
          <small>Repos</small>
        </div>
        <div className="stat">
          <span>{user.followers}</span>
          <small>Followers</small>
        </div>
        <div className="stat">
          <span>{user.following}</span>
          <small>Following</small>
        </div>
      </div>

      <div className="github-actions">
        <button
          className="action-btn refresh"
          onClick={handleRefreshToken}
          disabled={isLoading}
          title="Refresh authentication token"
        >
          <FiRefreshCw className={isLoading ? 'spinning' : ''} />
          Refresh Token
        </button>
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
