/**
 * Backend Server for API Checker
 * Runs alongside the Electron app and provides:
 * - API proxy/forwarding
 * - Data caching
 * - Authentication (local + GitHub OAuth via passport-github2)
 * - Request history
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const { Strategy: GitHubStrategy } = require('passport-github2');
const session = require('express-session');

// ── Load env vars (dotenv is optional — Electron injects them via main process) ──
try { require('dotenv').config(); } catch (_) { /* dotenv not available in packaged build */ }

// ── GitHub OAuth env vars ────────────────────────────────────────────────────
const GITHUB_CLIENT_ID     = process.env.GITHUB_CLIENT_ID     || process.env.REACT_APP_GITHUB_CLIENT_ID     || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || process.env.REACT_APP_GITHUB_CLIENT_SECRET || '';
const GITHUB_CALLBACK_URL  = process.env.GITHUB_CALLBACK_URL  || process.env.REACT_APP_GITHUB_REDIRECT_URI  || 'http://localhost:5000/auth/github/callback';
const SESSION_SECRET       = process.env.SESSION_SECRET        || 'change-me-in-production';
const BACKEND_URL          = process.env.BACKEND_URL           || 'http://localhost:5000';

const app = express();
let PORT = 5000;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Session middleware — required by passport for OAuth state
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }, // 24 h
}));

// ── Passport GitHub OAuth Strategy ──────────────────────────────────────────
if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy(
    {
      clientID:     GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
      callbackURL:  GITHUB_CALLBACK_URL,
      scope:        ['user:email', 'read:user', 'gist'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Normalise the GitHub profile to a consistent shape
        const emails = profile.emails || [];
        const primaryEmail =
          (emails.find(e => e.primary) || emails[0] || {}).value ||
          profile._json.email || '';

        const user = {
          id:          profile.id,
          login:       profile.username,
          name:        profile.displayName || profile.username,
          email:       primaryEmail,
          avatar:      profile.photos?.[0]?.value || profile._json.avatar_url,
          bio:         profile._json.bio,
          company:     profile._json.company,
          location:    profile._json.location,
          blog:        profile._json.blog,
          publicRepos: profile._json.public_repos,
          followers:   profile._json.followers,
          following:   profile._json.following,
          provider:    'github',
          accessToken,
          refreshToken: refreshToken || null,
          loginTime:   new Date().toISOString(),
        };
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  ));

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));

  app.use(passport.initialize());
  app.use(passport.session());

  console.log('✅ GitHub OAuth Strategy configured (Client ID:', GITHUB_CLIENT_ID, ')');
} else {
  // Passport still initialized so routes don't crash — will return config error
  app.use(passport.initialize());
  console.warn('⚠️  GitHub OAuth NOT configured — set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env');
}

// ── GitHub OAuth Routes ──────────────────────────────────────────────────────

/**
 * GET /auth/github
 * Initiates the OAuth flow — redirects the user's browser to GitHub.
 * Used when the backend is running as a proper web server.
 */
app.get('/auth/github', (req, res, next) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(503).json({
      error: 'GitHub OAuth is not configured on the server.',
      hint: 'Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in your .env file and restart the backend.',
    });
  }
  passport.authenticate('github', { scope: ['user:email', 'read:user', 'gist'] })(req, res, next);
});

/**
 * GET /auth/github/callback
 * GitHub redirects here after the user authorises the app.
 * On success the user object (with accessToken) is in req.user.
 */
app.get(
  '/auth/github/callback',
  (req, res, next) => {
    if (!GITHUB_CLIENT_ID) {
      return res.status(503).json({ error: 'GitHub OAuth is not configured.' });
    }
    passport.authenticate('github', { failureRedirect: '/?github_error=1' })(req, res, next);
  },
  (req, res) => {
    // Successful authentication — render a landing page that handles redirection
    // back to the desktop application or communicates with the browser popup.
    const user = req.user || {};
    const token = user.accessToken || '';

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>GitHub Authentication Successful</title>
        <style>
          :root {
            --bg: #0f172a;
            --card: #1e293b;
            --text: #f1f5f9;
            --text-muted: #94a3b8;
            --primary: #8b5cf6;
            --primary-hover: #7c3aed;
            --success: #10b981;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .container {
            text-align: center;
            background-color: var(--card);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 2.5rem;
            max-width: 420px;
            width: 90%;
            box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3);
          }
          .icon-container {
            background-color: rgba(16, 185, 129, 0.1);
            color: var(--success);
            width: 64px;
            height: 64px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1.5rem;
          }
          .icon {
            font-size: 32px;
            font-weight: bold;
          }
          h1 {
            font-size: 1.5rem;
            margin: 0 0 0.5rem;
            font-weight: 700;
          }
          p {
            color: var(--text-muted);
            margin: 0 0 2rem;
            font-size: 0.95rem;
            line-height: 1.5;
          }
          .spinner {
            width: 24px;
            height: 24px;
            border: 3px solid rgba(255, 255, 255, 0.1);
            border-top-color: var(--primary);
            border-radius: 50%;
            margin: 0 auto;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon-container">
            <span class="icon">✓</span>
          </div>
          <h1>Authentication Successful</h1>
          <p>You have successfully logged in with GitHub. Connecting back to the application...</p>
          <div class="spinner"></div>
        </div>

        <script>
          const token = ${JSON.stringify(token)};
          const user = ${JSON.stringify(user)};

          // 1. Try deep linking back to Electron custom protocol client (if installed/running)
          const deepLink = "myapp://github-auth?token=" + encodeURIComponent(token) +
                           "&code=" + encodeURIComponent(user.accessToken || '') +
                           "&state=" + encodeURIComponent(window.location.search ? new URLSearchParams(window.location.search).get('state') || '' : '');
          window.location.href = deepLink;

          // 2. Try window.opener message passing (if opened as browser popup)
          if (window.opener) {
            try {
              window.opener.postMessage({
                type: 'github-oauth-success',
                token: token,
                user: user
              }, '*');
            } catch (err) {
              console.error("Failed to post message to opener:", err);
            }
            
            // Auto close the popup after a brief moment
            setTimeout(() => {
              window.close();
            }, 800);
          } else {
            // 3. Fallback for direct browser tab logins: redirect back to web frontend
            setTimeout(() => {
              window.location.href = "http://localhost:3000/";
            }, 2000);
          }
        </script>
      </body>
      </html>
    `);
  }
);

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('WebSocket client connected:', socket.id);
  socket.emit('welcome', { message: 'API Checker Pro live updates enabled' });

  socket.on('subscribe', (room) => {
    socket.join(room);
  });

  socket.on('disconnect', () => {
    console.log('WebSocket client disconnected:', socket.id);
  });
});

// Data directory
const dataDir = path.join(os.homedir(), '.api-checker-server');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Request history storage
let requestHistory = [];
const MAX_HISTORY = 100;

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'API Checker Backend',
    version: '1.0.0',
    message: 'Backend server is running',
    endpoints: {
      health: '/health',
      proxy: 'POST /api/proxy',
      history: 'GET /api/history',
      info: 'GET /api/info',
    },
  });
});

app.get('/handOverToken:', (req, res) => {
  const token = req.query.token;
  const source = req.query.source || 'unknown';
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] Token received from ${source}: ${token}\n`;
  const logFile = path.join(dataDir, 'tokens.log');

  // Token handling logic (e.g., save to file, database, etc.)
  const TokenGenerator = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 20; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  };

  fs.appendFile(path.join(dataDir, 'tokens.log'), logEntry, (err) => {
    if (err) {
      console.error('Error logging token:', err);
    } else {
      console.log(`Token logged from ${source}`);
    }
  });
  console.log(`Received token from ${source}:`, token);

  if (token) {
    console.log('Received token from OTP verification:', token);
    // Here you can implement any logic needed to handle the token, such as saving it to a file or database
    res.json({ message: 'Token received successfully' });
  } else {
    res.status(400).json({ error: 'Token is required' });
  }
});

// Mock test endpoints for demonstration
app.get('/api/endpoint', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && (authHeader.includes('invalid') || authHeader.includes('expired'))) {
    return res.status(401).json({
      Flag: false,
      Message: "UNAUTHORIZED",
      Data: null
    });
  }
  res.json({
    message: 'Success! Test GET endpoint working',
    timestamp: new Date(),
    endpoint: '/api/endpoint',
    method: 'GET',
  });
});

app.post('/api/endpoint', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && (authHeader.includes('invalid') || authHeader.includes('expired'))) {
    return res.status(401).json({
      Flag: false,
      Message: "UNAUTHORIZED",
      Data: null
    });
  }
  res.json({
    message: 'Success! Test POST endpoint working',
    receivedData: req.body,
    timestamp: new Date(),
    endpoint: '/api/endpoint',
    method: 'POST',
  });
});

// Inverter Communication mock config
let inverterConfig = {
  "asn": "bansee",
  "baudrate": 9600,
  "parity": 1,
  "stopBit": 1,
  "databits": 8,
  "reqCount_1": 2,
  "slaveID_11": 1,
  "busID_11": 2,
  "startAddr_11": 30001,
  "length_11": 50,
  "funcType_11": 4,
  "slaveID_12": 1,
  "busID_12": 2,
  "startAddr_12": 40001,
  "length_12": 50,
  "funcType_12": 3,
  "slaveID_13": 1,
  "startAddr_13": 1,
  "length_13": 2,
  "funcType_13": 2,
  "slaveID_14": 1,
  "startAddr_14": 2,
  "length_14": 3,
  "funcType_14": 4,
  "slaveID_15": 5,
  "startAddr_15": 14,
  "length_15": 10,
  "funcType_15": 3,
  "devCount_1": 1,
  "devbusId_11": "2",
  "devslaveId_11": "1",
  "devactive_11": "1",
  "devIP_11": "0.0.0.0",
  "devport_11": "502",
  "devprotocol_11": "1",
  "devbusId_12": "1",
  "devslaveId_12": "1",
  "devactive_12": "1",
  "devIP_12": "10.22.145.43",
  "devport_12": "502",
  "devprotocol_12": "1"
};

app.get('/api/config/inverter-communication', (req, res) => {
  res.json(inverterConfig);
});

app.post('/api/config/inverter-communication', (req, res) => {
  inverterConfig = { ...inverterConfig, ...req.body };
  res.json({ success: true, config: inverterConfig });
});

// Remote Server mock config
let remoteServerConfig = {};
app.get('/api/config/remote-server', (req, res) => {
  res.json(remoteServerConfig);
});

app.post('/api/config/remote-server', (req, res) => {
  remoteServerConfig = { ...remoteServerConfig, ...req.body };
  res.json({ success: true, config: remoteServerConfig });
});

// Accept both GET and POST for login endpoint (flexible for client implementations)
app.get('/api/login', (req, res) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  res.json({
    Data: {
      token: `mock-token-${otp}`,
      valid_for: 600,
    },
    message: 'Login successful',
    otp: otp,
  });
});

app.post('/api/login', (req, res) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  res.json({
    Data: {
      token: `mock-token-${otp}`,
      valid_for: 600,
    },
    message: 'Login successful',
    otp: otp,
  });
});

app.post('/api/verify-otp', (req, res) => {
  // Mock OTP verification
  res.json({
    message: 'OTP verified successfully',
    token: `sess-${Date.now()}`,
    expiresIn: 3600,
    user: { id: 1, email: 'user@example.com' },
  });
});

app.post('/auth/verify-otp', (req, res) => {
  // Mock OTP verification (alternative path)
  res.json({
    message: 'OTP verified successfully',
    token: `sess-${Date.now()}`,
    expiresIn: 3600,
    user: { id: 1, email: 'user@example.com' },
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date(),
    port: PORT,
  });
});

// Get request history
app.get('/api/history', (req, res) => {
  res.json({ history: requestHistory });
});

// Clear request history
app.delete('/api/history', (req, res) => {
  requestHistory = [];
  emitHistoryUpdate();
  res.json({ message: 'History cleared' });
});

// Proxy API request
app.post('/api/proxy', async (req, res) => {
  try {
    const {
      url,
      method = 'GET',
      headers = {},
      data = null,
      params = {},
      timeout = 30000,
    } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const startTime = Date.now();

    try {
      const response = await axios({
        url,
        method,
        headers: {
          ...headers,
          'User-Agent': 'API-Checker/1.0',
        },
        data,
        params,
        timeout,
        validateStatus: () => true, // Don't throw on any status
      });

      const duration = Date.now() - startTime;

      // Parse response data
      let parsedData = response.data;
      let dataFormat = typeof response.data;

      try {
        if (typeof response.data === 'string') {
          // Try to parse as JSON
          try {
            parsedData = JSON.parse(response.data);
            dataFormat = 'json';
          } catch (e) {
            // Check if it's HTML
            if (response.data.includes('<!DOCTYPE') || response.data.includes('<html')) {
              dataFormat = 'html';
            } else {
              dataFormat = 'text';
            }
          }
        }
      } catch (parseErr) {
        console.log('Could not parse response data');
      }

      const historyEntry = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        url,
        method,
        status: response.status,
        duration,
        size: JSON.stringify(response.data).length,
      };

      requestHistory.unshift(historyEntry);
      if (requestHistory.length > MAX_HISTORY) {
        requestHistory.pop();
      }
      emitHistoryUpdate();

      res.json({
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: parsedData,
        rawData: response.data,
        dataFormat,
        duration,
        size: JSON.stringify(response.data).length,
        timestamp: new Date(),
        success: response.status >= 200 && response.status < 300,
      });
    } catch (axiosError) {
      const duration = Date.now() - startTime;
      res.status(500).json({
        error: axiosError.message,
        duration,
        success: false,
        timestamp: new Date(),
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message, success: false });
  }
});

// Import Postman collection
app.post('/api/import/postman', (req, res) => {
  try {
    const { collection } = req.body;
    if (!collection) {
      return res.status(400).json({ error: 'Collection is required' });
    }

    const collectionPath = path.join(dataDir, `collection-${Date.now()}.json`);
    fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2));

    res.json({
      message: 'Collection imported successfully',
      path: collectionPath,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export data
app.get('/api/export', (req, res) => {
  try {
    const exportData = {
      history: requestHistory,
      exportedAt: new Date(),
    };

    res.json(exportData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save API preset
app.post('/api/presets', (req, res) => {
  try {
    const { name, api } = req.body;
    if (!name || !api) {
      return res.status(400).json({ error: 'Name and API data required' });
    }

    const presetsFile = path.join(dataDir, 'presets.json');
    let presets = [];

    if (fs.existsSync(presetsFile)) {
      presets = JSON.parse(fs.readFileSync(presetsFile, 'utf-8'));
    }

    const newPreset = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      api,
      createdAt: new Date(),
    };

    presets.push(newPreset);
    fs.writeFileSync(presetsFile, JSON.stringify(presets, null, 2));

    res.json({ message: 'Preset saved', preset: newPreset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get presets
app.get('/api/presets', (req, res) => {
  try {
    const presetsFile = path.join(dataDir, 'presets.json');
    let presets = [];

    if (fs.existsSync(presetsFile)) {
      presets = JSON.parse(fs.readFileSync(presetsFile, 'utf-8'));
    }

    res.json({ presets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete preset
app.delete('/api/presets/:id', (req, res) => {
  try {
    const { id } = req.params;
    const presetsFile = path.join(dataDir, 'presets.json');

    if (!fs.existsSync(presetsFile)) {
      return res.status(404).json({ error: 'No presets found' });
    }

    let presets = JSON.parse(fs.readFileSync(presetsFile, 'utf-8'));
    presets = presets.filter((p) => p.id !== id);

    fs.writeFileSync(presetsFile, JSON.stringify(presets, null, 2));

    res.json({ message: 'Preset deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GitHub OAuth API Endpoints (called by the React GitHubAuth.jsx component) ──

/**
 * POST /api/auth/github/callback
 * The React component sends the OAuth `code` here.
 * The server exchanges it for a real access token via GitHub's token API.
 */
app.post('/api/auth/github/callback', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      // Developer mode — return a mock token so the UI still works without credentials
      console.warn('⚠️  GitHub OAuth not configured — returning mock token for development.');
      return res.json({
        accessToken:  `ghu_mock_${Math.random().toString(36).substr(2, 20)}`,
        refreshToken: null,
        expiresIn:    3600,
        tokenType:    'bearer',
        scope:        'user:email read:user gist',
        _mock:        true,
      });
    }

    // Real token exchange with GitHub
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id:     GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri:  GITHUB_CALLBACK_URL,
      },
      { headers: { Accept: 'application/json' } }
    );

    const tokenData = tokenResponse.data;

    if (tokenData.error) {
      console.error('GitHub token exchange error:', tokenData);
      return res.status(400).json({
        error:             tokenData.error,
        error_description: tokenData.error_description || 'Token exchange failed',
      });
    }

    console.log('✅ GitHub token exchange successful — scope:', tokenData.scope);

    res.json({
      accessToken:  tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      expiresIn:    tokenData.expires_in    || 3600,
      tokenType:    tokenData.token_type    || 'bearer',
      scope:        tokenData.scope,
    });
  } catch (error) {
    console.error('GitHub callback error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/github/session
 * Called by GitHubAuth.jsx after a successful login to persist the session
 * profile on the backend (useful for server-side features / analytics).
 */
app.post('/api/auth/github/session', async (req, res) => {
  try {
    const { profile, accessToken } = req.body;
    if (!profile || !accessToken) {
      return res.status(400).json({ success: false, error: 'profile and accessToken are required' });
    }

    // Store in req.session if available
    if (req.session) {
      req.session.githubUser  = profile;
      req.session.githubToken = accessToken;
    }

    console.log(`✅ GitHub session persisted for user: ${profile.login || profile.id}`);
    res.json({ success: true, message: 'Session persisted' });
  } catch (error) {
    console.error('GitHub session error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auth/github/refresh
 * Refresh the GitHub access token using a refresh token.
 * Note: Only GitHub Apps (not OAuth Apps) issue refresh tokens.
 */
app.post('/api/auth/github/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'refreshToken is required' });
    }

    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      return res.status(503).json({ success: false, error: 'GitHub OAuth not configured on server' });
    }

    // Exchange the refresh token for a new access token
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id:     GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
      },
      { headers: { Accept: 'application/json' } }
    );

    const data = response.data;
    if (data.error) {
      return res.status(400).json({ success: false, error: data.error_description || data.error });
    }

    res.json({
      success:      true,
      accessToken:  data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn:    data.expires_in || 3600,
    });
  } catch (error) {
    console.error('GitHub refresh error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Server info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    name: 'API Checker Backend',
    version: '1.0.0',
    port: PORT,
    uptime: process.uptime(),
    platform: process.platform,
    nodeVersion: process.version,
    dataDir,
  });
});

// Maintenance Mode state & update check
let maintenanceState = {
  isMaintenance: false,
  currentVersion: '1.2.5',
  remoteVersion: null,
  updateStatus: 'idle', // 'checking', 'downloading', 'applying', 'success', 'error'
  error: null,
  xmlUrl: 'http://localhost:4222',
  progress: 0
};

// Simple semantic version comparator
function compareVersions(v1, v2) {
  const parse = v => v.split('.').map(Number);
  const a = parse(v1);
  const b = parse(v2);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

// Background update logic
async function triggerUpdate(xmlUrl) {
  maintenanceState.updateStatus = 'checking';
  maintenanceState.isMaintenance = true;
  maintenanceState.xmlUrl = xmlUrl || maintenanceState.xmlUrl;
  maintenanceState.error = null;
  maintenanceState.progress = 0;

  io.emit('maintenance-update', maintenanceState);

  try {
    // 1. Fetch update XML
    const response = await axios.get(maintenanceState.xmlUrl, { timeout: 10000 });
    const xmlText = response.data;

    // Parse using regex checks
    const versionMatch = xmlText.match(/<version>(.*?)<\/version>/);
    const urlMatch = xmlText.match(/<url>(.*?)<\/url>/);
    const descMatch = xmlText.match(/<description>(.*?)<\/description>/);

    if (!versionMatch || !urlMatch) {
      throw new Error("Invalid update XML structure. Missing version or url tags.");
    }

    const version = versionMatch[1].trim();
    const downloadUrl = urlMatch[1].trim();

    maintenanceState.remoteVersion = version;

    const isNew = compareVersions(version, maintenanceState.currentVersion);
    if (!isNew) {
      maintenanceState.updateStatus = 'idle';
      maintenanceState.isMaintenance = false;
      io.emit('maintenance-update', maintenanceState);
      return;
    }

    // 2. Download code update file
    maintenanceState.updateStatus = 'downloading';
    io.emit('maintenance-update', maintenanceState);

    const tempUpdateDir = path.join(dataDir, 'updates');
    if (!fs.existsSync(tempUpdateDir)) {
      fs.mkdirSync(tempUpdateDir, { recursive: true });
    }

    const targetFilePath = path.join(tempUpdateDir, path.basename(downloadUrl) || 'update.bin');
    const writer = fs.createWriteStream(targetFilePath);

    const downloadResponse = await axios({
      method: 'get',
      url: downloadUrl,
      responseType: 'stream'
    });

    const totalBytes = parseInt(downloadResponse.headers['content-length'] || 0, 10);
    let downloadedBytes = 0;

    downloadResponse.data.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      if (totalBytes > 0) {
        maintenanceState.progress = Math.round((downloadedBytes / totalBytes) * 100);
        io.emit('maintenance-update', maintenanceState);
      }
    });

    downloadResponse.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // 3. Apply updates
    maintenanceState.updateStatus = 'applying';
    maintenanceState.progress = 100;
    io.emit('maintenance-update', maintenanceState);

    // Simulate updating application code or patching local state files
    await new Promise(r => setTimeout(r, 2000));

    maintenanceState.updateStatus = 'success';
    maintenanceState.isMaintenance = false;
    io.emit('maintenance-update', maintenanceState);
  } catch (error) {
    maintenanceState.updateStatus = 'error';
    maintenanceState.error = error.message;
    io.emit('maintenance-update', maintenanceState);
    console.error('Update failed:', error);
  }
}

// GET route for /maintenance supporting both JSON monitoring and HTML views
app.get('/maintenance', async (req, res) => {
  const trigger = req.query.trigger === 'true';
  const xmlUrl = req.query.xmlUrl || 'http://localhost:4222';

  if (trigger && maintenanceState.updateStatus === 'idle') {
    triggerUpdate(xmlUrl);
  }

  const acceptsHtml = req.accepts('html');
  if (req.query.json === 'true' || !acceptsHtml) {
    return res.json(maintenanceState);
  }

  const progressPercent = maintenanceState.progress + '%';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>API Checker - Maintenance Mode</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        :root {
          --bg: #030712;
          --card: #1f2937;
          --primary: #7c3aed;
          --primary-glow: rgba(124, 58, 237, 0.3);
          --text: #f9fafb;
          --text-muted: #9ca3af;
          --success: #10b981;
          --error: #ef4444;
        }
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: var(--bg);
          color: var(--text);
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          overflow: hidden;
        }
        .container {
          text-align: center;
          max-width: 480px;
          padding: 2.5rem;
          background: rgba(31, 41, 55, 0.4);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        }
        .spinner {
          width: 80px;
          height: 80px;
          border: 4px solid rgba(255, 255, 255, 0.05);
          border-top-color: var(--primary);
          border-radius: 50%;
          margin: 0 auto 2rem;
          animation: spin 1s linear infinite;
          box-shadow: 0 0 20px var(--primary-glow);
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        h1 {
          font-size: 1.8rem;
          font-weight: 800;
          margin-bottom: 0.5rem;
          background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .subtitle {
          font-size: 0.95rem;
          color: var(--text-muted);
          margin-bottom: 2rem;
        }
        .progress-bar-container {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 1rem;
        }
        .progress-bar {
          height: 100%;
          width: ${progressPercent};
          background: linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%);
          transition: width 0.3s ease;
          border-radius: 10px;
        }
        .status-text {
          font-size: 0.9rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--primary);
        }
        .version-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.05);
          font-size: 0.8rem;
          font-weight: 600;
          margin-top: 1rem;
          color: var(--text-muted);
        }
        .error-box {
          padding: 1rem;
          border-radius: 12px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: var(--error);
          font-size: 0.85rem;
          margin-top: 1.5rem;
          word-break: break-all;
        }
        .btn-trigger {
          display: inline-block;
          margin-top: 1.5rem;
          background: var(--primary);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          font-size: 0.9rem;
          font-weight: 700;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
        }
        .btn-trigger:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(124, 58, 237, 0.5);
        }
      </style>
      <script>
        setInterval(async () => {
          try {
            const res = await fetch(window.location.pathname + '?json=true');
            const data = await res.json();
            if (data.updateStatus !== '${maintenanceState.updateStatus}' || data.progress !== ${maintenanceState.progress}) {
              window.location.reload();
            }
          } catch(e) {}
        }, 1000);
      </script>
    </head>
    <body>
      <div class="container">
        <div class="spinner"></div>
        <h1>System Update Mode</h1>
        <p class="subtitle">Applying remoteless updates to target systems and device configs</p>
        
        ${maintenanceState.updateStatus !== 'idle' ? `
          <div class="progress-bar-container">
            <div class="progress-bar"></div>
          </div>
          <div class="status-text">
            ${maintenanceState.updateStatus}... ${maintenanceState.progress}%
          </div>
        ` : `
          <div class="status-text" style="color: var(--success)">System is idle</div>
          <a class="btn-trigger" href="/maintenance?trigger=true&xmlUrl=${encodeURIComponent(xmlUrl)}">Trigger Remote Update</a>
        `}
        
        <div class="version-badge">
          Current: ${maintenanceState.currentVersion} ${maintenanceState.remoteVersion ? `&rarr; Remote: ${maintenanceState.remoteVersion}` : ''}
        </div>
        
        ${maintenanceState.error ? `
          <div class="error-box">
            Error: ${maintenanceState.error}
          </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;
  res.send(html);
});

// Post route to trigger update programmatically
app.post('/api/maintenance/trigger', async (req, res) => {
  const { xmlUrl } = req.body;
  triggerUpdate(xmlUrl);
  res.json({ success: true, message: 'Update triggered', state: maintenanceState });
});

// Reset maintenance state endpoint
app.post('/api/maintenance/reset', (req, res) => {
  maintenanceState = {
    isMaintenance: false,
    currentVersion: '1.2.5',
    remoteVersion: null,
    updateStatus: 'idle',
    error: null,
    xmlUrl: maintenanceState.xmlUrl,
    progress: 0
  };
  io.emit('maintenance-update', maintenanceState);
  res.json({ success: true, state: maintenanceState });
});

// ── MongoDB Manager endpoints ───────────────────────────────────────────

let savedMongoUri = 'mongodb+srv://yashacker:Iamyash@reactdb.d04du.mongodb.net/ReactDB';

// Helper to translate SRV URI to direct URI for Windows node DNS resolution bug bypass
const getWorkingMongoUri = (uri) => {
  if (uri && uri.includes('reactdb.d04du.mongodb.net')) {
    return 'mongodb://yashacker:Iamyash@reactdb-shard-00-00.d04du.mongodb.net:27017/ReactDB?ssl=true&authSource=admin';
  }
  return uri;
};

// Database connection logic for auth endpoints
const connectToDb = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  const uri = getWorkingMongoUri(savedMongoUri);
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ Auth MongoDB Connection established successfully');
  } catch (err) {
    console.error('❌ Auth MongoDB Connection failed:', err.message);
  }
};

// Define models on connection
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  status: { type: String, default: 'active' }
}, { timestamps: true, collection: 'users' });

const LoginSchema = new mongoose.Schema({
  userId: { type: String },
  success: { type: Boolean, required: true },
  ipAddress: { type: String },
  userAgent: { type: String },
  failureReason: { type: String },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'logins' });

const SignupSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  otp: { type: String },
  otpExpiresAt: { type: Date }
}, { timestamps: true, collection: 'signups' });

const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
const LoginModel = mongoose.models.Login || mongoose.model('Login', LoginSchema);
const SignupModel = mongoose.models.Signup || mongoose.model('Signup', SignupSchema);

// Connect on start
connectToDb();

app.get('/api/mongodb/config', (req, res) => {
  res.json({ success: true, uri: savedMongoUri });
});

app.post('/api/mongodb/config', (req, res) => {
  const { uri } = req.body;
  if (uri) {
    savedMongoUri = uri;
    // Reconnect database with the new URI
    connectToDb();
    res.json({ success: true, message: 'MongoDB connection settings saved to server successfully', uri: savedMongoUri });
  } else {
    res.status(400).json({ success: false, error: 'URI is required' });
  }
});

// ── Authentication Endpoints (MongoDB Backed) ──────────────────────────

app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  try {
    await connectToDb();
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, error: 'Database connection offline' });
    }

    const existingUser = await UserModel.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'User already exists with this email' });
    }

    // Extract username from email
    const username = email.split('@')[0];

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save User
    const user = new UserModel({
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'user',
      status: 'active'
    });
    await user.save();

    // Create Signup record
    const signup = new SignupModel({
      username,
      email: email.toLowerCase(),
      password: hashedPassword
    });
    await signup.save();

    res.json({
      success: true,
      message: 'Signup successful! User registered to MongoDB.',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  try {
    await connectToDb();
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, error: 'Database connection offline' });
    }

    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Log failed login: user not found
      const failedLogin = new LoginModel({
        success: false,
        ipAddress,
        userAgent,
        failureReason: 'user_not_found'
      });
      await failedLogin.save();

      return res.status(400).json({ success: false, error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Log failed login: invalid credentials
      const failedLogin = new LoginModel({
        userId: user._id.toString(),
        success: false,
        ipAddress,
        userAgent,
        failureReason: 'invalid_credentials'
      });
      await failedLogin.save();

      return res.status(400).json({ success: false, error: 'Invalid email or password' });
    }

    // Log successful login
    const successfulLogin = new LoginModel({
      userId: user._id.toString(),
      success: true,
      ipAddress,
      userAgent
    });
    await successfulLogin.save();

    // Create session token
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const token = `mock-token-${otp}`;

    res.json({
      success: true,
      message: 'Login successful! Session logged in MongoDB.',
      token,
      valid_for: 600,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const parseMongoUri = (uri) => {
  try {
    let protocol = 'mongodb';
    let working = uri;
    if (uri.startsWith('mongodb+srv://')) {
      protocol = 'mongodb+srv';
      working = uri.slice(14);
    } else if (uri.startsWith('mongodb://')) {
      protocol = 'mongodb';
      working = uri.slice(10);
    }

    let credentials = '';
    let hostDbStr = '';
    
    if (working.includes('@')) {
      const parts = working.split('@');
      credentials = parts[0];
      hostDbStr = parts.slice(1).join('@');
    } else {
      hostDbStr = working;
    }

    let user = '';
    let password = '';
    if (credentials.includes(':')) {
      const credParts = credentials.split(':');
      user = credParts[0];
      password = credParts.slice(1).join(':');
    } else if (credentials) {
      user = credentials;
    }

    let hostAndPort = '';
    let dbAndParams = '';
    if (hostDbStr.includes('/')) {
      const parts = hostDbStr.split('/');
      hostAndPort = parts[0];
      dbAndParams = parts.slice(1).join('/');
    } else {
      hostAndPort = hostDbStr;
    }

    let database = '';
    let queryParams = '';
    if (dbAndParams.includes('?')) {
      const parts = dbAndParams.split('?');
      database = parts[0];
      queryParams = parts[1];
    } else {
      database = dbAndParams;
    }

    return {
      success: true,
      protocol,
      user: decodeURIComponent(user),
      password: '*'.repeat(password.length) || '(none)',
      host: hostAndPort,
      database: database ? decodeURIComponent(database.split('?')[0]) : 'admin',
      queryParams: queryParams || '(none)'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

app.post('/api/mongodb/connect', async (req, res) => {
  const { uri } = req.body;
  if (!uri) {
    return res.status(400).json({ success: false, error: 'Connection URI is required' });
  }

  const parsed = parseMongoUri(uri);
  
  try {
    console.log(`🔌 Attempting to connect to MongoDB URI: ${uri.replace(/:([^@]+)@/, ':****@')}`);
    const connection = await mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 5000,
    }).asPromise();

    const collectionInfos = await connection.db.listCollections().toArray();
    const collections = [];
    
    for (const coll of collectionInfos) {
      let docCount = 0;
      try {
        docCount = await connection.db.collection(coll.name).countDocuments();
      } catch (cntErr) {
        // Ignored, might be permissions
      }
      collections.push({
        name: coll.name,
        type: coll.type,
        count: docCount
      });
    }

    await connection.close();

    res.json({
      success: true,
      message: 'Successfully connected to MongoDB!',
      parameters: parsed,
      collections
    });
  } catch (err) {
    console.error('❌ MongoDB Connection failed:', err.message);
    res.json({
      success: false,
      error: err.message,
      parameters: parsed
    });
  }
});

app.post('/api/mongodb/export', async (req, res) => {
  const { uri, collectionName, format } = req.body;
  if (!uri || !collectionName) {
    return res.status(400).json({ success: false, error: 'URI and collectionName are required' });
  }

  try {
    const connection = await mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 5000,
    }).asPromise();

    const dbCollection = connection.db.collection(collectionName);
    const documents = await dbCollection.find({}).toArray();
    await connection.close();

    if (format === 'csv') {
      if (documents.length === 0) {
        return res.json({ success: true, data: '', filename: `${collectionName}.csv` });
      }
      
      const keys = Object.keys(documents[0]);
      const csvRows = [];
      csvRows.push(keys.join(','));

      for (const doc of documents) {
        const values = keys.map(key => {
          let val = doc[key];
          if (val === undefined || val === null) return '';
          if (typeof val === 'object') val = JSON.stringify(val);
          const escaped = ('' + val).replace(/"/g, '""');
          return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
      }
      
      return res.json({
        success: true,
        data: csvRows.join('\n'),
        filename: `${collectionName}.csv`
      });
    } else {
      return res.json({
        success: true,
        data: JSON.stringify(documents, null, 2),
        filename: `${collectionName}.json`
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start server
const startServer = (preferredPort = 5000) => {
  PORT = preferredPort;
  const server = httpServer.listen(PORT, 'localhost', () => {
    console.log(`
╔════════════════════════════════════════════╗
║   API Checker Backend Server Running       ║
╠════════════════════════════════════════════╣
║ Port: ${PORT}                              ║
║ URL: http://localhost:${PORT}              ║
║ Health: http://localhost:${PORT}/health    ║
╚════════════════════════════════════════════╝
    `);

    if (process.send) {
      process.send({ type: 'server-started', port: PORT });
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${PORT} is in use, trying ${PORT + 1}...`);
      startServer(PORT + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  return server;
};

// Broadcast request history updates live
const emitHistoryUpdate = () => {
  io.emit('historyUpdate', {
    count: requestHistory.length,
    lastEntry: requestHistory[0] || null,
  });
};

// Start the server
startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  try {
    httpServer.close(() => process.exit(0));
  } catch {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  try {
    httpServer.close(() => process.exit(0));
  } catch {
    process.exit(0);
  }
});

module.exports = app;
