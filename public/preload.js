const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── GitHub OAuth ──────────────────────────────────────────────────────────
  loginGithub: () => {
    shell.openExternal("http://localhost:5000/auth/github");
  },
  onGithubToken: (callback) => {
    ipcRenderer.on("github-token", (_, token) => callback(token));
  },
  storeToken: async (_provider, token) => {
    // Persist the auth token via IPC into the main-process data store,
    // merging with any existing saved user state.
    try {
      const existing = await ipcRenderer.invoke('load-user');
      const currentUser = existing?.success && existing.data ? existing.data : null;
      const updatedUser = token
        ? { ...currentUser, token, savedAt: new Date().toISOString() }
        : null;
      await ipcRenderer.invoke('save-user', updatedUser);
    } catch (_e) { /* no-op in browser-only fallback */ }
  },

  saveAppState: (state) => ipcRenderer.invoke('save-app-state', state),
  loadAppState: () => ipcRenderer.invoke('load-app-state'),

  // ── Data persistence ──────────────────────────────────────────────────────
  saveCollections: (collections) => ipcRenderer.invoke('save-collections', collections),
  loadCollections: () => ipcRenderer.invoke('load-collections'),
  saveUser: (user)     => ipcRenderer.invoke('save-user', user),
  loadUser: ()         => ipcRenderer.invoke('load-user'),
  saveAPIs: (apis)     => ipcRenderer.invoke('save-apis', apis),
  loadAPIs: ()         => ipcRenderer.invoke('load-apis'),

  // ── Store settings ─────────────────────────────────────────────────────────
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  loadSettings: ()         => ipcRenderer.invoke('load-settings'),

  // ── Network requests ───────────────────────────────────────────────────────
  sendRequest:     (requestOptions) => ipcRenderer.invoke('send-request', requestOptions),
  pingServer:      (serverUrl)        => ipcRenderer.invoke('ping-server', serverUrl),
  runPythonScript: (options)         => ipcRenderer.invoke('run-python-script', options),
  reloadApp:       ()                => ipcRenderer.invoke('reload-app'),
  restartBackend:  ()                => ipcRenderer.invoke('restart-backend'),
  stopBackend:     ()                => ipcRenderer.invoke('stop-backend'),

  // ── Backend info ───────────────────────────────────────────────────────────
  getBackendInfo: () => ipcRenderer.invoke('get-backend-info'),

  // ── Utilities ──────────────────────────────────────────────────────────────
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  exportData: (data, filename)  => ipcRenderer.invoke('export-data', data, filename),
  importData: ()                => ipcRenderer.invoke('import-data'),
  clearCache: ()                => ipcRenderer.invoke('clear-cache'),
  getAppInfo: ()                => ipcRenderer.invoke('get-app-info'),
  openFileDialog: ()            => ipcRenderer.invoke('open-file-dialog'),
  getSystemInfo: ()             => ipcRenderer.invoke('get-system-info'),

  // ── Arduino & Firmware Flashing ──────────────────────────────────────────
  saveArduinoConfig: (config)   => ipcRenderer.invoke('save-arduino-config', config),
  loadArduinoConfig: ()         => ipcRenderer.invoke('load-arduino-config'),
  testArduinoConnection: (path) => ipcRenderer.invoke('test-arduino-connection', path),
  listSerialPorts: ()           => ipcRenderer.invoke('list-serial-ports'),
  downloadFirmware: (url)       => ipcRenderer.invoke('download-firmware', url),
  flashFirmware: (options)      => ipcRenderer.invoke('flash-firmware', options),
  eraseFlash: (options)         => ipcRenderer.invoke('erase-flash', options),
  stopFlash: ()                 => ipcRenderer.invoke('stop-flash'),
  onFlashLog: (callback) => {
    ipcRenderer.on('flash-log', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('flash-log');
  },
  compileSketch: (options)      => ipcRenderer.invoke('compile-sketch', options),
  selectDirectory: ()           => ipcRenderer.invoke('select-directory'),
  selectSketchFile: ()          => ipcRenderer.invoke('select-sketch-file'),
  selectBinFile: ()             => ipcRenderer.invoke('select-bin-file'),

  // ── Certificate Provisioning ─────────────────────────────────────────────
  provisionCertificates: (options) => ipcRenderer.invoke('provision-certificates', options),
  onProvisionLog: (callback) => {
    ipcRenderer.on('provision-log', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('provision-log');
  },

  // ── Serial Monitor ──────────────────────────────────────────────────────────
  startSerialMonitor: (options) => ipcRenderer.invoke('start-serial-monitor', options),
  stopSerialMonitor: () => ipcRenderer.invoke('stop-serial-monitor'),
  sendSerialData: (data) => ipcRenderer.invoke('send-serial-data', data),
  onSerialOutput: (callback) => {
    ipcRenderer.on('serial-output', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('serial-output');
  },
  onSerialClosed: (callback) => {
    ipcRenderer.on('serial-closed', (_, code) => callback(code));
    return () => ipcRenderer.removeAllListeners('serial-closed');
  },

  // ── Event listeners ────────────────────────────────────────────────────────
  onWindowResized: (callback) => {
    ipcRenderer.on('window-resized', callback);
    return () => ipcRenderer.removeListener('window-resized', callback);
  },
  onAppReady: (callback) => {
    ipcRenderer.on('app-ready', callback);
    return () => ipcRenderer.removeListener('app-ready', callback);
  },
});

