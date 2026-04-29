const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveCollections: (collections) =>
    ipcRenderer.invoke('save-collections', collections),
  loadCollections: () => ipcRenderer.invoke('load-collections'),
  saveUser: (user) => ipcRenderer.invoke('save-user', user),
  loadUser: () => ipcRenderer.invoke('load-user'),
  saveAPIs: (apis) => ipcRenderer.invoke('save-apis', apis),
  loadAPIs: () => ipcRenderer.invoke('load-apis'),
  sendRequest: (requestOptions) => ipcRenderer.invoke('send-request', requestOptions),
  pingServer: (serverUrl) => ipcRenderer.invoke('ping-server', serverUrl),
  getBackendInfo: () => ipcRenderer.invoke('get-backend-info'),
});
