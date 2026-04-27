const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveCollections: (collections) =>
    ipcRenderer.invoke('save-collections', collections),
  loadCollections: () => ipcRenderer.invoke('load-collections'),
  saveUser: (user) => ipcRenderer.invoke('save-user', user),
  loadUser: () => ipcRenderer.invoke('load-user'),
});
