const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');
const { pathToFileURL } = require('url');
const { spawn, exec } = require('child_process');
const dotenv = require('dotenv');

// Load environment variables from .env.electron for the main process.
// CRA/REACT_APP_* variables are injected by webpack DefinePlugin at build time
// and are automatically available in the renderer bundle.
dotenv.config({ path: path.join(__dirname, '.env.electron') });

let mainWindow;
let backendServer;
let backendPort = null;
let activeFlashProcess = null;
const isDev = !app.isPackaged;
const dataPath = app.isPackaged
  ? path.join(path.dirname(app.getPath('exe')), 'data')
  : path.join(app.getAppPath(), 'data');
const devServerUrl = 'http://localhost:3000';

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
        const url = new URL(deepLink);
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
      mainWindow.show();
      mainWindow.focus();
      // On Windows, setting always-on-top briefly pulls the window to the foreground
      mainWindow.setAlwaysOnTop(true);
      mainWindow.setAlwaysOnTop(false);
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
      // Prefer graceful termination then force kill if needed
      try {
        backendServer.kill('SIGTERM');
      } catch (e) {
        try {
          process.kill(backendServer.pid);
        } catch (err) {
          console.error('Force kill failed:', err);
        }
      }
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

// App state helpers
const getAppStateFile = () => path.join(dataPath, 'user.json');
const loadAppState = () => {
  const filePath = getAppStateFile();
  const defaultState = { user: null, apis: [], collections: [], settings: {} };
  if (!fs.existsSync(filePath)) return defaultState;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) || defaultState;
  } catch {
    return defaultState;
  }
};
const saveAppState = (partialState) => {
  const filePath = getAppStateFile();
  const currentState = loadAppState();
  const nextState = {
    ...currentState,
    ...partialState,
  };
  fs.writeFileSync(filePath, JSON.stringify(nextState, null, 2));
  return nextState;
};

// IPC Handlers for data persistence
ipcMain.handle('save-collections', async (event, collections) => {
  try {
    const filePath = path.join(dataPath, 'collections.json');
    fs.writeFileSync(filePath, JSON.stringify(collections, null, 2));
    saveAppState({ collections });
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
    const state = loadAppState();
    return { success: true, data: state.collections || [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-user', async (event, user) => {
  try {
    const currentState = loadAppState();
    const nextUser = user === null ? null : { ...currentState.user, ...user };
    saveAppState({ user: nextUser });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-user', async () => {
  try {
    const state = loadAppState();
    return { success: true, data: state.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-app-state', async (event, state) => {
  try {
    saveAppState(state);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-app-state', async () => {
  try {
    return { success: true, data: loadAppState() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-apis', async (event, apis) => {
  try {
    const filePath = path.join(dataPath, 'apis.json');
    fs.writeFileSync(filePath, JSON.stringify(apis, null, 2));
    saveAppState({ apis });
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
    const state = loadAppState();
    return { success: true, data: state.apis || [] };
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

// Expose save/load Arduino configuration
ipcMain.handle('save-arduino-config', async (event, config) => {
  try {
    const filePath = path.join(dataPath, 'arduino-config.json');
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-arduino-config', async () => {
  try {
    const filePath = path.join(dataPath, 'arduino-config.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('Error loading Arduino config:', error);
    return null;
  }
});

// Expose testing Arduino CLI connection
ipcMain.handle('test-arduino-connection', async (event, cliPath) => {
  return new Promise((resolve) => {
    const arduinoCli = cliPath || 'arduino-cli';
    exec(`"${arduinoCli}" version`, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
      } else {
        resolve({ success: true, version: stdout.trim() });
      }
    });
  });
});

// Dynamic Serial Port list handler
ipcMain.handle('list-serial-ports', async () => {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec('powershell -Command "[System.IO.Ports.SerialPort]::GetPortNames()"', (error, stdout, stderr) => {
        if (error) {
          exec('wmic path Win32_SerialPort get DeviceID', (err, wmicOut) => {
            if (err) {
              resolve(['COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9']);
            } else {
              const lines = wmicOut.split('\n').map(l => l.trim()).filter(l => l && l !== 'DeviceID');
              resolve(lines.length > 0 ? lines : ['COM3']);
            }
          });
        } else {
          const ports = stdout.split('\r\n').map(p => p.trim()).filter(p => p);
          resolve(ports.length > 0 ? ports : ['COM3']);
        }
      });
    } else {
      exec('ls /dev/tty.* /dev/ttyUSB* /dev/ttyACM* 2>/dev/null', (error, stdout) => {
        if (error) {
          resolve(['/dev/ttyUSB0']);
        } else {
          const ports = stdout.split('\n').map(p => p.trim()).filter(p => p);
          resolve(ports.length > 0 ? ports : ['/dev/ttyUSB0']);
        }
      });
    }
  });
});// Helper to download a file from URL to path
const downloadFile = async (url, targetPath) => {
  const axios = require('axios');
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
    timeout: 15000,
  });

  if (response.status !== 200) {
    throw new Error(`HTTP Error ${response.status}`);
  }

  const contentType = response.headers['content-type'] || '';
  if (contentType.toLowerCase().includes('text/html')) {
    throw new Error('Server returned HTML fallback instead of a binary file.');
  }

  const writer = fs.createWriteStream(targetPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
};

// Download firmware binary file and companion dependencies (bootloader, partitions)
ipcMain.handle('download-firmware', async (event, downloadUrl) => {
  try {
    const tempDir = path.join(dataPath, 'firmware');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const binaryPath = path.join(tempDir, 'firmware.bin');

    console.log(`Downloading main firmware from: ${downloadUrl}`);
    await downloadFile(downloadUrl, binaryPath);

    const stats = fs.statSync(binaryPath);
    if (stats.size === 0) {
      throw new Error('Downloaded main firmware file is empty (0 bytes).');
    }

    // Construct companion URLs: e.g. firmware.bootloader.bin, firmware.partitions.bin
    const ext = path.extname(downloadUrl);
    let bootloaderUrl, partitionsUrl;
    if (ext.toLowerCase() === '.bin') {
      const urlWithoutExt = downloadUrl.slice(0, -ext.length);
      bootloaderUrl = urlWithoutExt + '.bootloader.bin';
      partitionsUrl = urlWithoutExt + '.partitions.bin';
    } else {
      bootloaderUrl = downloadUrl + '.bootloader.bin';
      partitionsUrl = downloadUrl + '.partitions.bin';
    }

    const bootloaderPath = path.join(tempDir, 'firmware.bootloader.bin');
    const partitionsPath = path.join(tempDir, 'firmware.partitions.bin');

    // Download bootloader companion if it exists
    try {
      console.log(`Attempting to download bootloader companion: ${bootloaderUrl}`);
      await downloadFile(bootloaderUrl, bootloaderPath);
      console.log('✓ Bootloader companion downloaded.');
    } catch (e) {
      console.log(`Companion bootloader not found or failed (ignoring): ${e.message}`);
      if (fs.existsSync(bootloaderPath)) {
        try { fs.unlinkSync(bootloaderPath); } catch { }
      }
    }

    // Download partitions companion if it exists
    try {
      console.log(`Attempting to download partitions companion: ${partitionsUrl}`);
      await downloadFile(partitionsUrl, partitionsPath);
      console.log('✓ Partitions companion downloaded.');
    } catch (e) {
      console.log(`Companion partitions not found or failed (ignoring): ${e.message}`);
      if (fs.existsSync(partitionsPath)) {
        try { fs.unlinkSync(partitionsPath); } catch { }
      }
    }

    return {
      success: true,
      path: binaryPath,
      size: stats.size,
      filename: path.basename(binaryPath)
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

function findEsptool() {
  const fs = require('fs');
  const os = require('os');

  // 1. Try to find it in the Arduino15 directory dynamically
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const arduinoEsp32Dir = path.join(localAppData, 'Arduino15', 'packages', 'esp32', 'tools', 'esptool_py');

  if (fs.existsSync(arduinoEsp32Dir)) {
    const versions = fs.readdirSync(arduinoEsp32Dir);
    if (versions.length > 0) {
      versions.sort();
      const latestVersion = versions[versions.length - 1];
      const exePath = path.join(arduinoEsp32Dir, latestVersion, 'esptool.exe');
      if (fs.existsSync(exePath)) {
        return exePath;
      }
    }
  }

  // 2. Check the user's explicit Python script scripts and other locations
  const fallbackPaths = [
    'A:\\All-Windows-Download\\esptool-windows-amd64\\esptool.exe',
    path.join(os.homedir(), 'AppData\\Local\\Programs\\Python\\Python314\\Scripts\\esptool.exe'),
    path.join(os.homedir(), 'AppData\\Local\\Programs\\Python\\Python37\\Scripts\\esptool.exe')
  ];

  for (const p of fallbackPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // 3. Fallback to just executing 'esptool' (using system PATH resolution)
  return 'esptool';
}

// Flash firmware using esptool or arduino-cli upload
ipcMain.handle('flash-firmware', async (event, options) => {
  return new Promise((resolve) => {
    const { tool, port, binaryPath, uploadSpeed, chip, offset, flashMode } = options;

    if (tool === 'esptool') {
      const esptool = findEsptool();
      const initialBaud = uploadSpeed || '115200';
      const targetChip = chip || 'esp32';
      const appOffset = offset || '0x10000';

      const runEsptool = (baudRate) => {
        return new Promise((resolveRun) => {
          const args = [
            '--chip', targetChip,
            '--port', port,
            '--baud', baudRate,
            'write_flash'
          ];

          if (flashMode === 'multiple') {
            const tempDir = path.dirname(binaryPath);
            const bootloaderPath = path.join(tempDir, 'firmware.bootloader.bin');
            const partitionsPath = path.join(tempDir, 'firmware.partitions.bin');

            const bootloaderOffset = (targetChip === 'esp32s3' || targetChip === 'esp32c3') ? '0x0' : '0x1000';
            const partitionsOffset = '0x8000';

            if (fs.existsSync(bootloaderPath) && fs.existsSync(partitionsPath)) {
              args.push(
                bootloaderOffset, bootloaderPath,
                partitionsOffset, partitionsPath,
                appOffset, binaryPath
              );
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('flash-log', `[Client] Flashing multiple binaries:\r\n`);
                mainWindow.webContents.send('flash-log', `  - Bootloader: ${path.basename(bootloaderPath)} at ${bootloaderOffset}\r\n`);
                mainWindow.webContents.send('flash-log', `  - Partitions: ${path.basename(partitionsPath)} at ${partitionsOffset}\r\n`);
                mainWindow.webContents.send('flash-log', `  - App: ${path.basename(binaryPath)} at ${appOffset}\r\n\r\n`);
              }
            } else {
              args.push(appOffset, binaryPath);
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('flash-log', `[Client] Companion files (bootloader/partitions) not found in directory. Falling back to app binary only.\r\n`);
              }
            }
          } else {
            args.push(appOffset, binaryPath);
          }

          console.log(`Executing flashing via esptool: "${esptool}" ${args.join(' ')}`);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('flash-log', `[Client] Flashing using esptool (Baud: ${baudRate}): ${esptool}\r\n`);
            mainWindow.webContents.send('flash-log', `Command: esptool ${args.join(' ')}\r\n\r\n`);
          }

          if (activeFlashProcess) {
            try {
              activeFlashProcess.kill();
            } catch (e) {
              console.error('Failed to kill active flash process:', e);
            }
            activeFlashProcess = null;
          }

          const child = spawn(esptool, args, { shell: true });
          activeFlashProcess = child;

          child.stdout.on('data', (data) => {
            const logStr = data.toString();
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('flash-log', logStr);
            }
          });

          child.stderr.on('data', (data) => {
            const logStr = data.toString();
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('flash-log', logStr);
            }
          });

          child.on('error', (err) => {
            activeFlashProcess = null;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('flash-log', `CRITICAL ERROR: ${err.message}\r\n`);
            }
            resolveRun({ success: false, error: err.message });
          });

          child.on('close', (code) => {
            activeFlashProcess = null;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('flash-log', `\r\nFlashing process completed with exit code: ${code}\r\n`);
            }
            resolveRun({ success: code === 0, code });
          });
        });
      };

      runEsptool(initialBaud).then((result) => {
        if (!result.success && initialBaud !== '115200') {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('flash-log', `\r\n[Client] ⚠️ Flashing failed at ${initialBaud} baud rate.\r\n`);
            mainWindow.webContents.send('flash-log', `[Client] Automatically retrying with standard 115200 baud rate...\r\n\r\n`);
          }
          runEsptool('115200').then((retryResult) => {
            resolve(retryResult);
          });
        } else {
          resolve(result);
        }
      });
      return;
    }

    // Load arduino-cli configuration
    const arduinoConfigPath = path.join(dataPath, 'arduino-config.json');
    let arduinoCli = 'arduino-cli';
    let fqbn = 'esp32:esp32:esp32';
    if (fs.existsSync(arduinoConfigPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(arduinoConfigPath, 'utf-8'));
        if (config.cliPath) arduinoCli = config.cliPath;
        if (config.fqbn) fqbn = config.fqbn;
      } catch (e) {
        console.error('Error loading Arduino config:', e);
      }
    }

    const args = [
      'upload',
      '-p', port,
      '--fqbn', fqbn,
      '--input-file', binaryPath
    ];

    console.log(`Executing flashing via Arduino CLI: "${arduinoCli}" ${args.join(' ')}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('flash-log', `[Client] Flashing using arduino-cli: ${arduinoCli}\r\n`);
      mainWindow.webContents.send('flash-log', `Command: arduino-cli upload -p ${port} --fqbn ${fqbn} --input-file ${path.basename(binaryPath)}\r\n\r\n`);
    }

    if (activeFlashProcess) {
      try {
        activeFlashProcess.kill();
      } catch (e) {
        console.error('Failed to kill active flash process:', e);
      }
      activeFlashProcess = null;
    }

    const child = spawn(arduinoCli, args, { shell: true });
    activeFlashProcess = child;

    child.stdout.on('data', (data) => {
      const logStr = data.toString();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('flash-log', logStr);
      }
    });

    child.stderr.on('data', (data) => {
      const logStr = data.toString();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('flash-log', `STDERR: ${logStr}`);
      }
    });

    child.on('error', (err) => {
      activeFlashProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('flash-log', `CRITICAL ERROR: ${err.message}\r\n`);
      }
      resolve({ success: false, error: err.message });
    });

    child.on('close', (code) => {
      activeFlashProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('flash-log', `\r\nFlashing process completed with exit code: ${code}\r\n`);
      }
      resolve({ success: code === 0, code });
    });
  });
});

// Compile sketch using arduino-cli
ipcMain.handle('compile-sketch', async (event, options) => {
  return new Promise((resolve) => {
    const { sketchPath, fqbn } = options;

    const arduinoConfigPath = path.join(dataPath, 'arduino-config.json');
    let arduinoCli = 'arduino-cli';
    if (fs.existsSync(arduinoConfigPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(arduinoConfigPath, 'utf-8'));
        if (config.cliPath) arduinoCli = config.cliPath;
      } catch (e) {
        console.error('Error loading Arduino CLI path:', e);
      }
    }

    const outputDir = path.join(dataPath, 'firmware', 'build');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const args = [
      'compile',
      '--fqbn', fqbn,
      '--output-dir', outputDir,
      sketchPath
    ];

    console.log(`Executing compilation via Arduino CLI: "${arduinoCli}" ${args.join(' ')}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('flash-log', `[Client] Compiling sketch using arduino-cli: ${arduinoCli}\r\n`);
      mainWindow.webContents.send('flash-log', `Command: arduino-cli compile --fqbn ${fqbn} --output-dir "${outputDir}" "${sketchPath}"\r\n\r\n`);
    }

    if (activeFlashProcess) {
      try {
        activeFlashProcess.kill();
      } catch (e) {
        console.error('Failed to kill active process:', e);
      }
      activeFlashProcess = null;
    }

    const child = spawn(arduinoCli, args, { shell: true });
    activeFlashProcess = child;

    child.stdout.on('data', (data) => {
      const logStr = data.toString();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('flash-log', logStr);
      }
    });

    child.stderr.on('data', (data) => {
      const logStr = data.toString();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('flash-log', `STDERR: ${logStr}`);
      }
    });

    child.on('error', (err) => {
      activeFlashProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('flash-log', `CRITICAL ERROR: ${err.message}\r\n`);
      }
      resolve({ success: false, error: err.message });
    });

    child.on('close', (code) => {
      activeFlashProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('flash-log', `\r\nCompilation process completed with exit code: ${code}\r\n`);
      }

      if (code === 0) {
        try {
          const files = fs.readdirSync(outputDir);
          const binFile = files.find(f => f.endsWith('.bin'));
          if (binFile) {
            resolve({ success: true, binaryPath: path.join(outputDir, binFile) });
          } else {
            resolve({ success: false, error: 'Compilation succeeded but no binary file was found in output directory.' });
          }
        } catch (e) {
          resolve({ success: false, error: `Failed to locate compiled binary: ${e.message}` });
        }
      } else {
        resolve({ success: false, error: `Compilation failed with exit code: ${code}` });
      }
    });
  });
});

// Select directory dialog
ipcMain.handle('select-directory', async () => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] };
    }
    return { success: false, error: 'Directory selection canceled' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Select sketch file dialog
ipcMain.handle('select-sketch-file', async () => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Arduino Sketches', extensions: ['ino'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] };
    }
    return { success: false, error: 'File selection canceled' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Select binary (.bin) file dialog
ipcMain.handle('select-bin-file', async () => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Binary Files', extensions: ['bin'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const stats = fs.statSync(filePath);
      return {
        success: true,
        path: filePath,
        filename: path.basename(filePath),
        size: stats.size
      };
    }
    return { success: false, error: 'File selection canceled' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});


// Certificate Provisioning flow
ipcMain.handle('provision-certificates', async (event, options) => {
  const sendLog = (msg) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('provision-log', msg + '\r\n');
    }
  };

  try {
    const { imei, password, bearerToken, downloadUrls, postUrls, ackUrl, payloadType } = options;
    const axios = require('axios');

    if (!imei) {
      return { success: false, error: 'IMEI number is required' };
    }

    const cleanUrl = (url) => {
      if (!url) return '';
      // Support both {IMEI} and misspelled {IEMI} placeholders
      let u = url.replace(/\{(IMEI|IEMI)\}/gi, imei);
      // Support {PASSWORD} placeholder
      u = u.replace(/\{PASSWORD\}/gi, password || '');
      return u;
    };

    const dlUrls = downloadUrls.map(cleanUrl);
    const upUrls = postUrls.map(cleanUrl);
    const aUrl = cleanUrl(ackUrl);

    sendLog(`[Client] Initializing certificate provisioning for IMEI: ${imei}...`);

    // Helper to format/redact headers for logging
    const formatRedactedHeaders = (headers) => {
      const copy = { ...headers };
      if (copy['Authorization']) {
        const val = copy['Authorization'];
        if (typeof val === 'string' && val.length > 15) {
          copy['Authorization'] = `${val.substring(0, 11)}...${val.substring(val.length - 4)}`;
        } else {
          copy['Authorization'] = '***';
        }
      }
      return JSON.stringify(copy);
    };

    // Step 1-3: Download certificates
    const certContents = [];
    for (let i = 0; i < 3; i++) {
      const url = dlUrls[i];
      if (!url) {
        sendLog(`[Client] Step ${i + 1}/7: Skipping (No download URL specified for Certificate ${i + 1})`);
        certContents.push(null);
        continue;
      }

      sendLog(`[Client] Step ${i + 1}/7: Downloading Certificate ${i + 1} from: ${url}`);

      let headers = {};
      if (bearerToken) {
        headers['Authorization'] = `Bearer ${bearerToken}`;
      }
      sendLog(`   -> GET Request Headers: ${formatRedactedHeaders(headers)}`);

      try {
        const startTime = Date.now();
        const response = await axios.get(url, { headers, timeout: 15000 });
        const duration = Date.now() - startTime;

        sendLog(`   <- GET Response received in ${duration}ms. Status: ${response.status} ${response.statusText || ''}`);
        if (response.headers) {
          sendLog(`   <- GET Response Headers: Content-Type: ${response.headers['content-type'] || 'unknown'}, Content-Length: ${response.headers['content-length'] || 'unknown'}`);
        }

        if (response.status === 200) {
          const data = typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : response.data;
          certContents.push(data);
          sendLog(`✓ Certificate ${i + 1} downloaded successfully! Size: ${data.length} characters.`);
        } else {
          throw new Error(`HTTP Status ${response.status}`);
        }
      } catch (e) {
        sendLog(`   <- GET Request failed: ${e.message}`);
        if (e.response) {
          sendLog(`   <- GET Response Status Code: ${e.response.status}`);
          sendLog(`   <- GET Response Headers: ${JSON.stringify(e.response.headers || {})}`);
          const errData = typeof e.response.data === 'object' ? JSON.stringify(e.response.data) : e.response.data;
          sendLog(`   <- GET Response Body Preview: ${errData ? errData.toString().substring(0, 300) : '(Empty)'}`);
        }
        sendLog(`✗ Failed to download Certificate ${i + 1}: ${e.message}`);
        return { success: false, error: `Failed to download Certificate ${i + 1}: ${e.message}` };
      }
    }

    // Step 4-6: Upload certificates to device
    for (let i = 0; i < 3; i++) {
      const cert = certContents[i];
      const url = upUrls[i];
      if (!cert) {
        sendLog(`[Client] Step ${i + 4}/7: Skipping upload (No downloaded content for Certificate ${i + 1})`);
        continue;
      }
      if (!url) {
        sendLog(`[Client] Step ${i + 4}/7: Skipping upload (No POST URL specified for Certificate ${i + 1})`);
        continue;
      }

      sendLog(`[Client] Step ${i + 4}/7: Uploading Certificate ${i + 1} to: ${url}`);

      let headers = {};
      if (bearerToken) {
        headers['Authorization'] = `Bearer ${bearerToken}`;
      }

      let dataToSend = cert;
      if (payloadType === 'json') {
        headers['Content-Type'] = 'application/json';
        dataToSend = JSON.stringify({ certificate: cert, imei });
        sendLog(`   -> POST Request Payload: JSON Object { certificate: "...", imei: "${imei}" }`);
      } else if (payloadType === 'form-data') {
        const FormData = require('form-data');
        const form = new FormData();
        form.append('certificate', cert);
        form.append('imei', imei);
        headers = { ...headers, ...form.getHeaders() };
        dataToSend = form;
        sendLog(`   -> POST Request Payload: Multipart Form Data`);
      } else {
        headers['Content-Type'] = 'text/plain';
        sendLog(`   -> POST Request Payload: Raw text (Size: ${cert.length} characters)`);
      }

      sendLog(`   -> POST Request Headers: ${formatRedactedHeaders(headers)}`);

      try {
        const startTime = Date.now();
        const response = await axios.post(url, dataToSend, { headers, timeout: 15000 });
        const duration = Date.now() - startTime;

        sendLog(`   <- POST Response received in ${duration}ms. Status: ${response.status} ${response.statusText || ''}`);
        if (response.headers) {
          sendLog(`   <- POST Response Headers: Content-Type: ${response.headers['content-type'] || 'unknown'}`);
        }

        if (response.status >= 200 && response.status < 300) {
          sendLog(`✓ Certificate ${i + 1} uploaded successfully! Response status: ${response.status}`);
        } else {
          throw new Error(`HTTP Status ${response.status}`);
        }
      } catch (e) {
        sendLog(`   <- POST Request failed: ${e.message}`);
        if (e.response) {
          sendLog(`   <- POST Response Status Code: ${e.response.status}`);
          sendLog(`   <- POST Response Headers: ${JSON.stringify(e.response.headers || {})}`);
          const errData = typeof e.response.data === 'object' ? JSON.stringify(e.response.data) : e.response.data;
          sendLog(`   <- POST Response Body Preview: ${errData ? errData.toString().substring(0, 300) : '(Empty)'}`);
        }
        sendLog(`✗ Failed to upload Certificate ${i + 1}: ${e.message}`);
        return { success: false, error: `Failed to upload Certificate ${i + 1}: ${e.message}` };
      }
    }

    // Step 7/7: Acknowledgement
    if (aUrl) {
      sendLog(`[Client] Step 7/7: Sending acknowledgement to: ${aUrl}`);

      let headers = {};
      if (bearerToken) {
        headers['Authorization'] = `Bearer ${bearerToken}`;
      }

      try {
        sendLog(`   -> POST Request Payload: JSON Object { imei: "${imei}", status: "success" }`);
        sendLog(`   -> POST Request Headers: ${formatRedactedHeaders(headers)}`);

        const startTime = Date.now();
        const response = await axios.post(aUrl, { imei, status: 'success' }, { headers, timeout: 15000 });
        const duration = Date.now() - startTime;

        sendLog(`   <- POST Response received in ${duration}ms. Status: ${response.status} ${response.statusText || ''}`);

        if (response.status >= 200 && response.status < 300) {
          sendLog(`✓ Acknowledgement sent successfully! Response status: ${response.status}`);
        } else {
          throw new Error(`HTTP Status ${response.status}`);
        }
      } catch (e) {
        sendLog(`[Client] POST acknowledgement failed: ${e.message}. Trying GET fallback...`);
        if (e.response) {
          sendLog(`   <- POST Response Status Code: ${e.response.status}`);
          const errData = typeof e.response.data === 'object' ? JSON.stringify(e.response.data) : e.response.data;
          sendLog(`   <- POST Response Body Preview: ${errData ? errData.toString().substring(0, 300) : '(Empty)'}`);
        }

        try {
          sendLog(`   -> GET Fallback Request to acknowledgement endpoint`);
          sendLog(`   -> GET Request Headers: ${formatRedactedHeaders(headers)}`);

          const startTime = Date.now();
          const response = await axios.get(aUrl, { headers, timeout: 10000 });
          const duration = Date.now() - startTime;

          sendLog(`   <- GET Response received in ${duration}ms. Status: ${response.status} ${response.statusText || ''}`);

          if (response.status >= 200 && response.status < 300) {
            sendLog(`✓ Acknowledgement GET fallback successful! Response status: ${response.status}`);
          } else {
            throw new Error(`HTTP Status ${response.status}`);
          }
        } catch (getErr) {
          sendLog(`   <- GET Fallback Request failed: ${getErr.message}`);
          if (getErr.response) {
            sendLog(`   <- GET Response Status Code: ${getErr.response.status}`);
            const errData = typeof getErr.response.data === 'object' ? JSON.stringify(getErr.response.data) : getErr.response.data;
            sendLog(`   <- GET Response Body Preview: ${errData ? errData.toString().substring(0, 300) : '(Empty)'}`);
          }
          sendLog(`✗ Acknowledgement failed: ${getErr.message}`);
          return { success: false, error: `Acknowledgement failed: ${getErr.message}` };
        }
      }
    } else {
      sendLog(`[Client] Step 7/7: Skipping acknowledgement (No URL specified)`);
    }

    sendLog(`[Client] Certificate provisioning flow completed successfully!`);
    return { success: true };
  } catch (error) {
    sendLog(`[Client] CRITICAL ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// Erase flash using esptool
ipcMain.handle('erase-flash', async (event, options) => {
  return new Promise((resolve) => {
    const { port, chip, uploadSpeed } = options;
    const esptool = findEsptool();
    const baud = uploadSpeed || '921600';
    const targetChip = chip || 'esp32';

    const args = [
      '--chip', targetChip,
      '--port', port,
      '--baud', baud,
      'erase_flash'
    ];

    console.log(`Executing erase: "${esptool}" ${args.join(' ')}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('flash-log', `[Client] Erasing flash using esptool: ${esptool}\r\n`);
      mainWindow.webContents.send('flash-log', `Command: esptool --chip ${targetChip} --port ${port} --baud ${baud} erase_flash\r\n\r\n`);
    }

    if (activeFlashProcess) {
      try {
        activeFlashProcess.kill();
      } catch (e) {
        console.error('Failed to kill active flash process:', e);
      }
      activeFlashProcess = null;
    }

    const child = spawn(esptool, args, { shell: true });
    activeFlashProcess = child;

    child.stdout.on('data', (data) => {
      const logStr = data.toString();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('flash-log', logStr);
      }
    });

    child.stderr.on('data', (data) => {
      const logStr = data.toString();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('flash-log', `STDERR: ${logStr}`);
      }
    });

    child.on('error', (err) => {
      activeFlashProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('flash-log', `CRITICAL ERROR: ${err.message}\r\n`);
      }
      resolve({ success: false, error: err.message });
    });

    child.on('close', (code) => {
      activeFlashProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('flash-log', `\r\nErase process completed with exit code: ${code}\r\n`);
      }
      resolve({ success: code === 0, code });
    });
  });
});

// Stop flash/erase operation
ipcMain.handle('stop-flash', async () => {
  if (activeFlashProcess) {
    try {
      console.log('Terminating active flashing process...');
      activeFlashProcess.kill();
      activeFlashProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('flash-log', `\r\n[Client] Operation stopped by user.\r\n`);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: true, message: 'No active flashing process to stop' };
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
