const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const path = require('path');
const fs  = require('fs');
const os  = require('os');
const http = require('http');
const https = require('https');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');
const dotenv = require('dotenv');

// Load environment variables from .env.electron for the main process.
// CRA/REACT_APP_* variables are injected by webpack DefinePlugin at build time
// and are automatically available in the renderer bundle.
dotenv.config({ path: path.join(__dirname, '.env.electron') });

let mainWindow;
let backendServer;
let backendPort = null;
const dataPath = path.join(os.homedir(), '.api-checker');
const devServerUrl = 'http://localhost:3000';
const isDev = !app.isPackaged;

// =============================================================================
// Protocol Handler & Single-Instance Lock
// =============================================================================
// Register custom protocol for OAuth / deep-link callbacks (e.g. myapp://…)
if (process.defaultApp) {
  app.setAsDefaultProtocolClient(
    "myapp",
    process.execPath,
    [path.resolve(process.argv[1])]
  );
} else {
  app.setAsDefaultProtocolClient("myapp");
}

// Enforce single-instance: second launch focuses the existing window
const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const deepLink = argv.find(arg => typeof arg === "string" && arg.startsWith("myapp://"));

    if (deepLink) {
      try {
        const url   = new URL(deepLink);
        const token = url.searchParams.get("token");

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("github-token", token);
        }
      } catch (_err) {
        // malformed deep link – ignore
      }
    }

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Ensure data directory exists
if (!fs.existsSync(dataPath)) {
  fs.mkdirSync(dataPath, { recursive: true });
}

// Launch backend server
function launchBackendServer() {
  return new Promise((resolve) => {
    try {
      const backendPath = !app.isPackaged
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

function stopBackendServer() {
  if (backendServer) {
    console.log('Stopping backend server...');
    try {
      backendServer.kill();
    } catch (error) {
      console.error('Error killing backend:', error);
    }
    backendServer = null;
    backendPort = null;
  }
}

function isUrlAvailable(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });

    request.on('error', () => resolve(false));
    request.setTimeout(1500, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function getStartUrl() {
  // In development, always try dev server first with longer wait
  if (!app.isPackaged) {
    console.log('Development mode - waiting for dev server...');
    for (let i = 0; i < 30; i++) {
      if (await isUrlAvailable(devServerUrl)) {
        console.log('Dev server is available!');
        return devServerUrl;
      }
      // Wait 1 second between checks
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('Dev server not available after 30 seconds');
  }

  // Production: Use built files
  if (app.isPackaged) {
    const builtIndexPath = path.join(__dirname, '../build/index.html');
    if (fs.existsSync(builtIndexPath)) {
      console.log('Loading built app from:', builtIndexPath);
      return pathToFileURL(builtIndexPath).toString();
    }
  }

  // Fallback to public/index.html
  const publicIndexPath = path.join(__dirname, './index.html');
  if (fs.existsSync(publicIndexPath)) {
    console.log('Loading from public:', publicIndexPath);
    return pathToFileURL(publicIndexPath).toString();
  }

  console.log('No suitable app found, returning dev server URL');
  return devServerUrl;
}

async function createWindow() {
  // Get the primary display's work area (screen size minus taskbar)
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  
  mainWindow = new BrowserWindow({
    width: Math.round(width * 0.98),
    height: Math.round(height * 0.98),
    x: Math.round(width * 0.01),
    y: Math.round(height * 0.01),
    minWidth: 1024,
    minHeight: 768,
    maxWidth: width,
    maxHeight: height,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
    },
    icon: path.join(__dirname, 'icon.png'),
    show: false, // Don't show until ready
  });

  // Maximize window on launch
  mainWindow.maximize();

  const startUrl = await getStartUrl();
  console.log('Loading URL:', startUrl);

  try {
    await mainWindow.loadURL(startUrl);
  } catch (error) {
    console.error('Failed to load URL:', error);
    // Try fallback
    const fallbackUrl = devServerUrl;
    try {
      await mainWindow.loadURL(fallbackUrl);
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
    }
  }

  // Prevent external links from opening in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      // Open external links in default browser, not in Electron window
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Handle ready-to-show or show after short delay
  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show');
    mainWindow.show();
  });

  // Fallback: show window after 2 seconds if ready-to-show doesn't fire
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('Forcing window to show after timeout');
      mainWindow.show();
    }
  }, 2000);

  // Open DevTools in development
  // if (isDev) {
  //   // Delay opening devtools to avoid conflicts
  //   setTimeout(() => {
  //     mainWindow.webContents.openDevTools({ mode: 'detach' });
  //   }, 1000);
  // }

  // Handle errors
  mainWindow.webContents.on('crashed', () => {
    console.error('Renderer process crashed');
    mainWindow.reload();
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load page:', errorCode, errorDescription);
  });

  // Handle window resize to refresh layout
  mainWindow.on('resized', () => {
    if (mainWindow) {
      mainWindow.webContents.send('window-resized');
    }
  });

  mainWindow.on('close', (event) => {
    // Ensure backend is stopped even if close is triggered while backend is still starting
    try {
      stopBackendServer();
    } catch (e) {
      console.error('Error stopping backend on window close:', e);
    }
  });

  // In case app is quit without firing close (some OS behaviors), stop backend before quitting
  app.once('before-quit', () => {
    try {
      stopBackendServer();
    } catch (e) {
      console.error('Error stopping backend on before-quit:', e);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create App Menu
function createAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.reload();
          },
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            if (mainWindow) mainWindow.webContents.reloadIgnoringCache();
          },
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            if (mainWindow) {
              const zoomFactor = mainWindow.webContents.getZoomFactor();
              mainWindow.webContents.setZoomFactor(zoomFactor + 0.1);
            }
          },
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+Minus',
          click: () => {
            if (mainWindow) {
              const zoomFactor = mainWindow.webContents.getZoomFactor();
              mainWindow.webContents.setZoomFactor(zoomFactor - 0.1);
            }
          },
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            if (mainWindow) mainWindow.webContents.setZoomFactor(1);
          },
        },
        { type: 'separator' },
        {
          label: 'Fullscreen',
          accelerator: 'F11',
          click: () => {
            if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
          },
        },
{
          label: 'Toggle DevTools',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About API Checker',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About API Checker',
              message: 'API Checker',
              detail: `Version: 1.0.0\n\nA modern desktop application for API testing and management.\n\nPort: ${backendPort || '3000'}`,
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Register Global Keyboard Shortcuts
function registerGlobalShortcuts() {
  const { globalShortcut } = require('electron');

  // Reload app
  globalShortcut.register('CmdOrCtrl+R', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload();
    }
  });

  // DevTools toggle
  globalShortcut.register('CmdOrCtrl+Shift+I', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.toggleDevTools();
    }
  });
}

app.on('ready', async () => {
  // Launch backend server first
  await launchBackendServer();
  
  // Create the window
  await createWindow();
  
  // Setup menu and shortcuts
  createAppMenu();
  registerGlobalShortcuts();
});

app.on('window-all-closed', () => {
  stopBackendServer();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackendServer();
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

ipcMain.handle('restart-backend', async () => {
  try {
    stopBackendServer();
    const port = await launchBackendServer();
    if (port) {
      return { success: true, port };
    }
    return { success: false, error: 'Failed to restart backend server' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-backend', async () => {
  try {
    stopBackendServer();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('reload-app', async () => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Clear cache before reloading
      await mainWindow.webContents.session.clearCache();
      mainWindow.webContents.reloadIgnoringCache();
      return { success: true };
    }
    return { success: false, error: 'Main window not available' };
  } catch (error) {
    console.error('Reload error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('send-request', async (event, requestOptions) => {
  return new Promise((resolve) => {
    try {
      const { url, method, headers, body, sslOptions } = requestOptions;
      
      if (!url) {
        return resolve({ success: false, error: 'URL is required' });
      }
      
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: method || 'GET',
        headers: { ...headers } || {},
        timeout: 60000,
      };

      // Prepare body and set proper headers
      let requestBody = null;
      let bodyToSend = body;

      // Handle body for POST/PUT/PATCH
      if (bodyToSend && method && !['GET', 'HEAD', 'DELETE'].includes(method)) {
        // Handle different body types
        if (typeof bodyToSend === 'string') {
          requestBody = bodyToSend;
          
          // Auto-detect and set Content-Type if not already set
          if (!options.headers['Content-Type']) {
            if (bodyToSend.trim().startsWith('{') || bodyToSend.trim().startsWith('[')) {
              options.headers['Content-Type'] = 'application/json';
            } else if (bodyToSend.includes('=') && !bodyToSend.includes('{')) {
              options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            }
          }
        } else if (typeof bodyToSend === 'object') {
          // Convert object to JSON string
          requestBody = JSON.stringify(bodyToSend);
          if (!options.headers['Content-Type']) {
            options.headers['Content-Type'] = 'application/json';
          }
        }

        // Always set Content-Length for requests with body
        if (requestBody) {
          const contentLength = Buffer.byteLength(requestBody, 'utf-8');
          options.headers['Content-Length'] = contentLength;
        }
      }

      // Handle SSL certificates if provided
      if (isHttps && sslOptions) {
        try {
          if (sslOptions.certFile && fs.existsSync(sslOptions.certFile)) {
            options.cert = fs.readFileSync(sslOptions.certFile, 'utf-8');
            console.log('SSL certificate loaded:', sslOptions.certFile);
          } else if (sslOptions.certFile) {
            console.warn('Certificate file not found:', sslOptions.certFile);
          }
          
          if (sslOptions.keyFile && fs.existsSync(sslOptions.keyFile)) {
            options.key = fs.readFileSync(sslOptions.keyFile, 'utf-8');
            console.log('SSL key loaded:', sslOptions.keyFile);
          } else if (sslOptions.keyFile) {
            console.warn('Key file not found:', sslOptions.keyFile);
          }
          
          if (sslOptions.caFile && fs.existsSync(sslOptions.caFile)) {
            options.ca = fs.readFileSync(sslOptions.caFile, 'utf-8');
            console.log('CA certificate loaded:', sslOptions.caFile);
          } else if (sslOptions.caFile) {
            console.warn('CA file not found:', sslOptions.caFile);
          }
          
          // Disable SSL verification for self-signed certificates (use with caution)
          if (sslOptions.rejectUnauthorized === false) {
            options.rejectUnauthorized = false;
            console.warn('SSL verification disabled - using self-signed certificates');
          }
        } catch (err) {
          console.error('Error loading SSL certificates:', err.message);
        }
      }

      console.log('Making request:', {
        method: options.method,
        url,
        path: options.path,
        headers: options.headers,
        hasBody: !!requestBody,
      });

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
          
          console.log('Response received:', {
            status: res.statusCode,
            statusMessage: res.statusMessage,
            bodyLength: responseBody.length,
            contentType: res.headers['content-type'],
          });
          
          // Log first 500 chars of body for debugging
          if (responseBody) {
            console.log('Response body preview:', responseBody.substring(0, 500));
          }
          
          // Return response regardless of status code (success or error)
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
        console.error('Request error:', error.message);
        resolve({ success: false, error: error.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Request timed out after 60 seconds' });
      });

      // Write body if present
      if (requestBody) {
        console.log('Writing request body:', {
          length: Buffer.byteLength(requestBody, 'utf-8'),
          contentType: options.headers['Content-Type'],
        });
        req.write(requestBody);
      }
      req.end();
    } catch (error) {
      console.error('Send request handler error:', error);
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
      
      // Construct ping path - use provided path or default to /health
      let pingPath = parsedUrl.pathname && parsedUrl.pathname !== '/' ? parsedUrl.pathname : '/health';
      if (parsedUrl.search) pingPath += parsedUrl.search;
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: pingPath,
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

// Run Python automation script from the GUI
ipcMain.handle('run-python-script', async (event, options = {}) => {
  const scriptPath = path.join(__dirname, '../src/server/Script.py');
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

  return new Promise((resolve) => {
    try {
      const child = spawn(pythonCmd, [scriptPath], {
        cwd: path.dirname(scriptPath),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        resolve({ success: false, error: error.message, stderr });
      });

      child.on('close', (code) => {
        resolve({ success: code === 0, stdout, stderr, code });
      });

      if (options.token) {
        child.stdin.write(`${options.token}\n`);
      }
      child.stdin.end();
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

// Open URL in default browser
ipcMain.handle('open-external-url', async (event, url) => {
  try {
    require('electron').shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Export data to file
ipcMain.handle('export-data', async (event, data, filename) => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: filename || 'api-checker-export.json',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
      return { success: true, path: result.filePath };
    }
    return { success: false, error: 'Export canceled' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Import data from file
ipcMain.handle('import-data', async (event) => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const data = fs.readFileSync(result.filePaths[0], 'utf-8');
      return { success: true, data: JSON.parse(data) };
    }
    return { success: false, error: 'Import canceled' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Clear app cache
ipcMain.handle('clear-cache', async (event) => {
  try {
    if (mainWindow) {
      await mainWindow.webContents.session.clearCache();
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get app version and info
ipcMain.handle('get-app-info', async () => {
  return {
    version: '1.0.0',
    platform: process.platform,
    nodeVersion: process.version,
    electronVersion: process.versions.electron,
    dataPath,
  };
});

// Open file dialog
ipcMain.handle('open-file-dialog', async (event) => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] };
    }
    return { success: false, error: 'No file selected' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get system info
ipcMain.handle('get-system-info', async () => {
  const osModule = require('os');
  return {
    platform: process.platform,
    arch: process.arch,
    cpus: osModule.cpus().length,
    memory: Math.round(osModule.totalmem() / 1024 / 1024),
    freeMemory: Math.round(osModule.freemem() / 1024 / 1024),
  };
});

// Create application menu (old template - keeping for backward compatibility)
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
