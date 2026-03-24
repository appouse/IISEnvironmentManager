const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // IIS operations
  getAppPools: () => ipcRenderer.invoke('iis:getAppPools'),
  getSites: () => ipcRenderer.invoke('iis:getSites'),
  getApplications: (siteName) => ipcRenderer.invoke('iis:getApplications', siteName),
  getSitePhysicalPath: (siteName) => ipcRenderer.invoke('iis:getSitePhysicalPath', siteName),

  // Config operations
  getEnvVars: (physicalPath) => ipcRenderer.invoke('config:getEnvVars', physicalPath),
  setEnvVar: (physicalPath, key, value) => ipcRenderer.invoke('config:setEnvVar', physicalPath, key, value),
  addEnvVar: (physicalPath, key, value) => ipcRenderer.invoke('config:addEnvVar', physicalPath, key, value),
  deleteEnvVar: (physicalPath, key) => ipcRenderer.invoke('config:deleteEnvVar', physicalPath, key),
  bulkDelete: (physicalPath, keys) => ipcRenderer.invoke('config:bulkDelete', physicalPath, keys),
  exportVars: (physicalPath) => ipcRenderer.invoke('config:exportVars', physicalPath),
  importVars: (physicalPath) => ipcRenderer.invoke('config:importVars', physicalPath),
  copyVarsToSites: (sourcePath, targetPaths, variables) => ipcRenderer.invoke('config:copyVarsToSites', sourcePath, targetPaths, variables),

  // Dialog
  confirm: (message) => ipcRenderer.invoke('dialog:confirm', message),

  // Update operations
  downloadUpdate: (versionInfo) => ipcRenderer.invoke('update:download', versionInfo),
  applyUpdate: (filePath) => ipcRenderer.invoke('update:apply', filePath),
  getVersion: () => ipcRenderer.invoke('update:getVersion'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update:available', (_, info) => callback(info)),
  onUpdateProgress: (callback) => ipcRenderer.on('update:progress', (_, progress) => callback(progress)),
});
