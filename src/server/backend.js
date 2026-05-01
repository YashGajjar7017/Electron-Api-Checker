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

const app = express();
let PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// Start server
const startServer = (preferredPort = 5000) => {
  PORT = preferredPort;
  const server = app.listen(PORT, 'localhost', () => {
    console.log(`
╔════════════════════════════════════════════╗
║   API Checker Backend Server Running       ║
╠════════════════════════════════════════════╣
║ Port: ${PORT}                              ║
║ URL: http://localhost:${PORT}              ║
║ Health: http://localhost:${PORT}/health    ║
╚════════════════════════════════════════════╝
    `);

    // Send port info to parent process (Electron)
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

// Start the server
startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
