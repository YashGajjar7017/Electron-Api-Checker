const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const isDev = require('electron-is-dev');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

let mainWindow;
let backendServer;
let backendPort = null;
const dataPath = path.join(os.homedir(), '.api-checker');

// Ensure data directory exists
if (!fs.existsSync(dataPath)) {
  fs.mkdirSync(dataPath, { recursive: true });
}

// Launch backend server
function launchBackendServer() {
  return new Promise((resolve) => {
    try {
      const backendPath = isDev
        ? path.join(__dirname, '../src/server/backend.js')
        : path.join(__dirname, '../src/server/backend.js');

      // Only launch if backend exists
      if (!fs.existsSync(backendPath)) {
        console.log('Backend server not found, skipping...');
        resolve(null);
        return;
      }

      console.log('Launching backend server...');
      backendServer = spawn('node', [backendPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      let output = '';

      backendServer.stdout.on('data', (data) => {
        output += data.toString();
        console.log('[Backend]', data.toString());

        // Extract port from server output
        const portMatch = output.match(/Port: (\d+)/);
        if (portMatch && !backendPort) {
          backendPort = parseInt(portMatch[1]);
          console.log(`Backend server started on port ${backendPort}`);
          resolve(backendPort);
        }
      });

      backendServer.stderr.on('data', (data) => {
        console.error('[Backend Error]', data.toString());
      });

      backendServer.on('error', (err) => {
        console.error('Failed to start backend:', err);
        resolve(null);
      });

      // Timeout if server doesn't start within 10 seconds
      setTimeout(() => {
        if (!backendPort) {
          console.warn('Backend server startup timeout');
          resolve(null);
        }
      }, 10000);
    } catch (error) {
      console.error('Error launching backend:', error);
      resolve(null);
    }
  });
}

function createWindow() {
  // Get the primary display's work area (screen size minus taskbar)
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  
  mainWindow = new BrowserWindow({
    width: Math.round(width * 0.95),
    height: Math.round(height * 0.95),
    minWidth: 1280,
    minHeight: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, 'icon.png'),
    show: false, // Don't show until ready
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // DevTools disabled - remove comment below to enable
  // if (isDev) {
  //   mainWindow.webContents.openDevTools();
  // }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', async () => {
  // Launch backend server first
  await launchBackendServer();
  
  // Then create the window
  createWindow();
});

app.on('window-all-closed', () => {
  // Kill backend server if it's running
  if (backendServer) {
    console.log('Stopping backend server...');
    try {
      backendServer.kill();
    } catch (error) {
      console.error('Error killing backend:', error);
    }
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers for data persistence
ipcMain.handle('save-collections', async (event, collections) => {
  try {
    const filePath = path.join(dataPath, 'collections.json');
    fs.writeFileSync(filePath, JSON.stringify(collections, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-collections', async () => {
  try {
    const filePath = path.join(dataPath, 'collections.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return { success: true, data: JSON.parse(data) };
    }
    return { success: true, data: [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-user', async (event, user) => {
  try {
    const filePath = path.join(dataPath, 'user.json');
    fs.writeFileSync(filePath, JSON.stringify(user, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-user', async () => {
  try {
    const filePath = path.join(dataPath, 'user.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return { success: true, data: JSON.parse(data) };
    }
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-apis', async (event, apis) => {
  try {
    const filePath = path.join(dataPath, 'apis.json');
    fs.writeFileSync(filePath, JSON.stringify(apis, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-apis', async () => {
  try {
    const filePath = path.join(dataPath, 'apis.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return { success: true, data: JSON.parse(data) };
    }
    return { success: true, data: [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('send-request', async (event, requestOptions) => {
  return new Promise((resolve) => {
    try {
      const { url, method, headers, body, sslOptions } = requestOptions;
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: method || 'GET',
        headers: headers || {},
        timeout: 60000,
      };

      // Handle SSL certificates if provided
      if (isHttps && sslOptions) {
        if (sslOptions.certFile && fs.existsSync(sslOptions.certFile)) {
          options.cert = fs.readFileSync(sslOptions.certFile);
        }
        if (sslOptions.keyFile && fs.existsSync(sslOptions.keyFile)) {
          options.key = fs.readFileSync(sslOptions.keyFile);
        }
        if (sslOptions.caFile && fs.existsSync(sslOptions.caFile)) {
          options.ca = fs.readFileSync(sslOptions.caFile);
        }
      }

      const req = client.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          const responseHeaders = [];
          for (const [key, value] of Object.entries(res.headers)) {
            if (Array.isArray(value)) {
              value.forEach((v) => responseHeaders.push([key, v]));
            } else {
              responseHeaders.push([key, value]);
            }
          }
          resolve({
            success: true,
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: responseHeaders,
            body: responseBody,
          });
        });
      });

      req.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Request timed out after 60 seconds' });
      });

      if (body && method !== 'GET' && method !== 'HEAD') {
        req.write(body);
      }
      req.end();
    } catch (error) {
      resolve({ success: false, error: error.message });
    }
  });
});

// Ping handler - simple connectivity test
ipcMain.handle('ping-server', async (event, serverUrl) => {
  return new Promise((resolve) => {
    try {
      let url = serverUrl;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'http://' + url;
      }
      
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: '/',
        method: 'GET',
        timeout: 5000,
      };
      
      const startTime = Date.now();
      const req = client.request(options, (res) => {
        const responseTime = Date.now() - startTime;
        req.destroy();
        resolve({
          success: true,
          status: res.statusCode,
          responseTime,
          message: `Server responded in ${responseTime}ms`,
        });
      });
      
      req.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Connection timeout (5s)' });
      });
      
      req.end();
    } catch (error) {
      resolve({ success: false, error: error.message });
    }
  });
});

// Get backend server info
ipcMain.handle('get-backend-info', async () => {
  return {
    port: backendPort,
    url: backendPort ? `http://localhost:${backendPort}` : null,
    status: backendServer ? 'running' : 'stopped',
  };
});

// Create application menu
const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Exit',
        accelerator: 'CmdOrCtrl+Q',
        click: () => app.quit(),
      },
    ],
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
    ],
  },
  {
    label: 'Help',
    submenu: [
      {
        label: 'About',
        click: () => {
          // Could open an about window
        },
      },
    ],
  },
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
