const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Data persistence
  saveCollections: (collections) =>
    ipcRenderer.invoke('save-collections', collections),
  loadCollections: () => ipcRenderer.invoke('load-collections'),
  saveUser: (user) => ipcRenderer.invoke('save-user', user),
  loadUser: () => ipcRenderer.invoke('load-user'),
  saveAPIs: (apis) => ipcRenderer.invoke('save-apis', apis),
  loadAPIs: () => ipcRenderer.invoke('load-apis'),
  
  // Network requests
  sendRequest: (requestOptions) => ipcRenderer.invoke('send-request', requestOptions),
  pingServer: (serverUrl) => ipcRenderer.invoke('ping-server', serverUrl),
  runPythonScript: (options) => ipcRenderer.invoke('run-python-script', options),
  
  // Backend info
  getBackendInfo: () => ipcRenderer.invoke('get-backend-info'),
  
  // New features
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  exportData: (data, filename) => ipcRenderer.invoke('export-data', data, filename),
  importData: () => ipcRenderer.invoke('import-data'),
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  
  // Event listeners
  onWindowResized: (callback) => {
    ipcRenderer.on('window-resized', callback);
    return () => ipcRenderer.removeListener('window-resized', callback);
  },
  
  onAppReady: (callback) => {
    ipcRenderer.on('app-ready', callback);
    return () => ipcRenderer.removeListener('app-ready', callback);
  },
});
