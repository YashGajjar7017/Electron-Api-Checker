# GitHub OAuth — Setup & Configuration Guide

> **Project**: Electron API Checker  
> **Backend port**: `5000`  
> **Frontend port**: `3000` (React dev server)  

---

## Table of Contents

1. [Overview — How GitHub OAuth Works in This App](#1-overview)
2. [Step 1 — Create a GitHub OAuth App](#2-create-github-oauth-app)
3. [Step 2 — Configure `.env`](#3-configure-env)
4. [Step 3 — Start the Application](#4-start-the-application)
5. [Code Walkthrough — Connection Flow](#5-code-walkthrough)
6. [API Endpoint Reference](#6-api-endpoint-reference)
7. [Troubleshooting](#7-troubleshooting)
8. [Production Deployment](#8-production-deployment)

---

## 1. Overview

This application uses the **OAuth 2.0 Authorization Code flow** to authenticate users with GitHub. The flow is:

```
User clicks "Sign in with GitHub"
        │
        ▼
[React: GitHubAuth.jsx]
  ─ Opens GitHub auth URL in a popup/browser
  ─ GitHub redirects back with ?code=...
        │
        ▼
[Backend: POST /api/auth/github/callback]
  ─ Receives the code
  ─ Exchanges code for real access_token with GitHub
  ─ Returns { accessToken, refreshToken, scope }
        │
        ▼
[React: GitHubAuth.jsx]
  ─ Uses accessToken to call GET https://api.github.com/user
  ─ Stores profile in Zustand store + Electron secure storage
  ─ Calls POST /api/auth/github/session to persist on backend
```

### Key Files

| File | Role |
|---|---|
| `src/components/GitHubAuth.jsx` | React component — initiates OAuth, handles callback |
| `src/server/backend.js` | Express backend — exchanges OAuth code for real token |
| `.env` | Holds your GitHub Client ID and Secret |
| `Document/GITHUB_OAUTH_SETUP.md` | This file |

---

## 2. Create a GitHub OAuth App

### 2a. Go to GitHub Developer Settings

1. Log in to [github.com](https://github.com)
2. Click your profile photo → **Settings**
3. Scroll down → **Developer settings** (bottom left)
4. Click **OAuth Apps** → **New OAuth App**

### 2b. Fill in the Application Details

| Field | Development Value | Production Value |
|---|---|---|
| **Application name** | `API Checker Dev` | `API Checker` |
| **Homepage URL** | `http://localhost:3000` | `https://yourdomain.com` |
| **Authorization callback URL** | `http://localhost:5000/auth/github/callback` | `https://api.yourdomain.com/auth/github/callback` |

> **IMPORTANT**: The **Authorization callback URL** must exactly match `GITHUB_CALLBACK_URL` in your `.env`.
> Even a trailing slash difference causes a `redirect_uri_mismatch` error.

### 2c. Get Your Credentials

After registering:
- **Client ID** — copy this (looks like `Ov23li...`)
- **Client secrets** → click **Generate a new client secret** — copy immediately (shown once only)

---

## 3. Configure `.env`

Edit `.env` in the **project root** (`a:\Coding\Electron\Electron-Api-Checker\.env`):

```bash
# ==========================================
# GitHub OAuth Configuration
# ==========================================

# Frontend (React reads REACT_APP_ prefix)
REACT_APP_GITHUB_CLIENT_ID=your_client_id_here
REACT_APP_GITHUB_CLIENT_SECRET=your_client_secret_here
REACT_APP_GITHUB_REDIRECT_URI=http://localhost:5000/auth/github/callback
REACT_APP_GITHUB_SCOPE=user:email read:user gist
REACT_APP_BACKEND_URL=http://localhost:5000

# Backend (backend.js reads these at runtime)
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
GITHUB_CALLBACK_URL=http://localhost:5000/auth/github/callback

# Security
SESSION_SECRET=replace-with-a-random-32-char-string
JWT_SECRET=replace-with-a-random-64-char-string

# Database
MONOGDB_URI=mongodb://localhost:27017/api_checker
BACKEND_URL=http://localhost:5000
```

> Both `REACT_APP_GITHUB_*` and bare `GITHUB_*` values must be filled.
> React reads `REACT_APP_*` at build/start time; the backend reads the bare `GITHUB_*` at runtime.

### Generate Secure Secrets (PowerShell)

```powershell
# SESSION_SECRET
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# JWT_SECRET
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Maximum 256 }))
```

---

## 4. Start the Application

After saving `.env`, restart everything:

```powershell
# Full Electron dev mode (React + backend + Electron)
npm run electron-dev

# OR just React + backend (no Electron window)
npm start
# In a separate terminal:
node src/server/backend.js
```

On startup, the backend logs one of:
- `✅ GitHub OAuth Strategy configured (Client ID: Ov23li...)` — correctly configured
- `⚠️  GitHub OAuth NOT configured — set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET` — missing

---

## 5. Code Walkthrough — Connection Flow

### 5a. Frontend — `GitHubAuth.jsx`

#### Step 1: Initiate OAuth (user clicks "Sign in with GitHub")

```js
// src/components/GitHubAuth.jsx
const handleGitHubLogin = useCallback(async () => {
  if (!GITHUB_CLIENT_ID) {
    setShowConfigModal(true);   // Shows setup instructions popup
    return;
  }
  const state = Math.random().toString(36).slice(2, 17);
  localStorage.setItem('github_oauth_state', state);  // CSRF token

  const authUrl = `https://github.com/login/oauth/authorize?` +
    `client_id=${GITHUB_CLIENT_ID}&redirect_uri=${buildRedirectURL()}&` +
    `scope=${AUTH_SCOPE}&state=${state}&allow_signup=true`;

  await openAuthUrl(authUrl);  // Opens popup or system browser
}, []);
```

#### Step 2: Handle Redirect (GitHub sends back `?code=...`)

```js
// src/components/GitHubAuth.jsx
useEffect(() => {
  const { code, state: returnedState } = parseRedirectParams();
  if (!code) return;

  // CSRF verification
  const storedState = localStorage.getItem('github_oauth_state');
  if (storedState !== returnedState) { /* show error */ return; }
  localStorage.removeItem('github_oauth_state');  // one-time use

  exchangeCodeForToken(code, onSuccess, onError);
}, [loginUser]);
```

#### Step 3: Exchange Code for Token

```js
// src/components/GitHubAuth.jsx
const exchangeCodeForToken = async (code, onSuccess, onError) => {
  const res = await fetch(`${BACKEND_URL}/api/auth/github/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = await res.json();
  // data = { accessToken, refreshToken, expiresIn, scope }
  onSuccess(data);
};
```

---

### 5b. Backend — `backend.js`

#### Passport Strategy Setup (runs on server start)

```js
// src/server/backend.js
const GITHUB_CLIENT_ID     = process.env.GITHUB_CLIENT_ID     || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_CALLBACK_URL  = process.env.GITHUB_CALLBACK_URL  ||
                              'http://localhost:5000/auth/github/callback';

if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy(
    { clientID: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
      callbackURL: GITHUB_CALLBACK_URL },
    async (accessToken, refreshToken, profile, done) => {
      // Normalise profile fields
      const user = {
        id: profile.id, login: profile.username,
        email: profile.emails?.[0]?.value,
        avatar: profile.photos?.[0]?.value,
        publicRepos: profile._json.public_repos,
        provider: 'github', accessToken, refreshToken
      };
      return done(null, user);
    }
  ));
  app.use(passport.initialize());
  app.use(passport.session());
}
```

#### POST `/api/auth/github/callback` — Real Token Exchange

```js
// src/server/backend.js
app.post('/api/auth/github/callback', async (req, res) => {
  const { code } = req.body;

  // Exchange code with GitHub
  const tokenResponse = await axios.post(
    'https://github.com/login/oauth/access_token',
    { client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: GITHUB_CALLBACK_URL },
    { headers: { Accept: 'application/json' } }
  );

  const { access_token, refresh_token, scope } = tokenResponse.data;
  res.json({ accessToken: access_token, refreshToken: refresh_token, scope });
});
```

#### GET `/auth/github` — Browser-based OAuth Init

```js
app.get('/auth/github',
  passport.authenticate('github', { scope: ['user:email', 'read:user'] })
);
```

#### GET `/auth/github/callback` — Passport-handled Callback

```js
app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/?github_error=1' }),
  (req, res) => {
    // req.user = normalised profile with accessToken
    res.json({ success: true, accessToken: req.user.accessToken });
  }
);
```

---

## 6. API Endpoint Reference

| Method | Path | Called By | Description |
|---|---|---|---|
| `GET` | `/auth/github` | Browser | Starts OAuth — redirects to GitHub |
| `GET` | `/auth/github/callback` | GitHub (redirect) | Passport exchanges code, returns profile |
| `POST` | `/api/auth/github/callback` | `GitHubAuth.jsx` | Direct code→token exchange |
| `POST` | `/api/auth/github/session` | `GitHubAuth.jsx` | Persist user session on backend |
| `POST` | `/api/auth/github/refresh` | `GitHubAuth.jsx` | Refresh expired access token |

---

## 7. Troubleshooting

### "GitHub OAuth Required" popup when clicking Sign in

**Cause**: `REACT_APP_GITHUB_CLIENT_ID` is empty in `.env`.

**Fix**: Add your Client ID to `.env`, then restart `npm start` (React re-reads env vars on start).

---

### `redirect_uri_mismatch` error from GitHub

**Cause**: The callback URL sent by the app doesn't match GitHub's registered value.

**Fix**: In your GitHub OAuth App settings → **Authorization callback URL** set to exactly:
```
http://localhost:5000/auth/github/callback
```
This must exactly match both `GITHUB_CALLBACK_URL` and `REACT_APP_GITHUB_REDIRECT_URI` in `.env`.

---

### `bad_verification_code` from GitHub

**Cause**: OAuth codes are **single-use** and expire in ~10 minutes. Happens if:
- You refreshed the redirect page
- The code was already exchanged

**Fix**: Start a new flow by clicking "Sign in with GitHub" again.

---

### Backend logs `⚠️  GitHub OAuth NOT configured`

**Cause**: Backend cannot read the credentials from `.env`.

**Checklist**:
1. Is `.env` in the project root (same folder as `package.json`)?
2. Are both `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` filled (not just `REACT_APP_*`)?
3. Did you restart the backend after editing `.env`?

**Verify backend is reading env**:
```powershell
node -e "require('dotenv').config(); console.log(process.env.GITHUB_CLIENT_ID)"
```

---

### Token exchange succeeds but profile shows mock data

**Cause**: `REACT_APP_GITHUB_CLIENT_ID` was empty so the frontend used a mock token.

**Fix**: Fill `REACT_APP_GITHUB_CLIENT_ID` in `.env` and restart `npm start`.

---

### OAuth popup is blocked

**Cause**: Browser/OS popup blocker.

**Fix**: Allow popups for `localhost` in browser settings. The app will also fall back to `window.electronAPI.openExternalUrl` to open the system browser.

---

## 8. Production Deployment

### Update GitHub OAuth App

In [github.com/settings/developers](https://github.com/settings/developers) → your app:
- Set **Authorization callback URL** to: `https://api.yourdomain.com/auth/github/callback`

### Production `.env`

```bash
REACT_APP_GITHUB_CLIENT_ID=prod_client_id
REACT_APP_GITHUB_CLIENT_SECRET=prod_client_secret
REACT_APP_GITHUB_REDIRECT_URI=https://api.yourdomain.com/auth/github/callback
REACT_APP_BACKEND_URL=https://api.yourdomain.com

GITHUB_CLIENT_ID=prod_client_id
GITHUB_CLIENT_SECRET=prod_client_secret
GITHUB_CALLBACK_URL=https://api.yourdomain.com/auth/github/callback
BACKEND_URL=https://api.yourdomain.com
```

### Production Security Checklist

- [ ] All URLs use HTTPS
- [ ] `cookie: { secure: true }` in session config
- [ ] `.env` is in `.gitignore` — never commit secrets
- [ ] `SESSION_SECRET` and `JWT_SECRET` are random 32/64+ char strings
- [ ] Rate limiting on `/api/auth/*` endpoints
- [ ] Tokens stored in Electron `safeStorage` (done via `window.electronAPI.storeToken`)

---

## References

- [GitHub: Creating an OAuth App](https://docs.github.com/en/developers/apps/building-oauth-apps/creating-an-oauth-app)
- [GitHub: Authorizing OAuth Apps](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps)
- [passport-github2 on npm](https://www.npmjs.com/package/passport-github2)
- [GitHub REST API — Get authenticated user](https://docs.github.com/en/rest/users/users#get-the-authenticated-user)
