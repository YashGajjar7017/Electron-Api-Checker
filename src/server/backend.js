/**
 * Backend Server for API Checker
 * Runs alongside the Electron app and provides:
 * - API proxy/forwarding
 * - Data caching
 * - Authentication
 * - Request history
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
let PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
  res.json({
    message: 'Success! Test GET endpoint working',
    timestamp: new Date(),
    endpoint: '/api/endpoint',
    method: 'GET',
  });
});

app.post('/api/endpoint', (req, res) => {
  res.json({
    message: 'Success! Test POST endpoint working',
    receivedData: req.body,
    timestamp: new Date(),
    endpoint: '/api/endpoint',
    method: 'POST',
  });
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

// GitHub OAuth callback endpoint
app.post('/api/auth/github/callback', (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Mock GitHub token exchange (in production, exchange with GitHub API)
    // This is a simplified version for demonstration
    const mockAccessToken = `ghu_mock_${Math.random().toString(36).substr(2, 20)}`;
    const mockUser = {
      id: Math.floor(Math.random() * 1000000),
      login: 'github-user',
      email: 'user@github.com',
      name: 'GitHub User',
      avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
    };

    res.json({
      accessToken: mockAccessToken,
      user: mockUser,
      expiresIn: 3600,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
  xmlUrl: 'http://192.168.4.1/update.xml',
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
  const xmlUrl = req.query.xmlUrl || 'http://192.168.4.1/update.xml';
  
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
