const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const iisManager = require('./src/iis-manager');
const configManager = require('./src/config-manager');
const AutoUpdater = require('./src/auto-updater');
const fs = require('fs');

let mainWindow;
let updater;

// ── Update Config ───────────────────────────────
const pkg = require('./package.json');
const UPDATE_URL = pkg.updateConfig?.url || '';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f0f1a',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f0f1a',
      symbolColor: '#a0a0b0',
      height: 36
    },
    webPreferences: {
      preload: path.join(__dirname, 'renderer', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  initAutoUpdater();
});

app.on('window-all-closed', () => {
  app.quit();
});

// ── Auto Updater ────────────────────────────────
function initAutoUpdater() {
  if (!UPDATE_URL) {
    console.log('Update URL not configured, skipping update check');
    return;
  }

  updater = new AutoUpdater({
    updateUrl: UPDATE_URL,
    currentVersion: pkg.version
  });

  updater.onDownloadProgress = (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:progress', progress);
    }
  };

  // Uygulama yüklenince kontrol et
  mainWindow.webContents.on('did-finish-load', async () => {
    try {
      const result = await updater.checkForUpdates();
      if (result.updateAvailable) {
        mainWindow.webContents.send('update:available', result.versionInfo);
      }
    } catch (err) {
      console.error('Auto-update check failed:', err);
    }
  });
}

// ── IPC Handlers ──────────────────────────────────────────

ipcMain.handle('update:download', async (_, versionInfo) => {
  if (!updater) return { success: false, error: 'Updater not initialized' };
  try {
    return await updater.downloadUpdate(versionInfo);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update:apply', async (_, filePath) => {
  if (!updater) return;
  updater.applyUpdate(filePath);
  app.quit();
});

ipcMain.handle('update:getVersion', () => {
  return pkg.version;
});

ipcMain.handle('iis:getAppPools', async () => {
  return await iisManager.getApplicationPools();
});

ipcMain.handle('iis:getSites', async () => {
  return await iisManager.getSites();
});

ipcMain.handle('iis:getApplications', async (_, siteName) => {
  return await iisManager.getApplications(siteName);
});

ipcMain.handle('iis:getSitePhysicalPath', async (_, siteName) => {
  return await iisManager.getSitePhysicalPath(siteName);
});

ipcMain.handle('config:getEnvVars', async (_, physicalPath) => {
  return await configManager.getEnvironmentVariables(physicalPath);
});

ipcMain.handle('config:setEnvVar', async (_, physicalPath, key, value) => {
  return await configManager.setEnvironmentVariable(physicalPath, key, value);
});

ipcMain.handle('config:deleteEnvVar', async (_, physicalPath, key) => {
  return await configManager.deleteEnvironmentVariable(physicalPath, key);
});

ipcMain.handle('config:exportVars', async (_, physicalPath) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Environment Variables',
    defaultPath: 'env-variables.json',
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });
  if (result.canceled) return { canceled: true };
  return await configManager.exportVariables(physicalPath, result.filePath);
});

ipcMain.handle('config:importVars', async (_, physicalPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Environment Variables',
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (result.canceled) return { canceled: true };
  return await configManager.importVariables(physicalPath, result.filePaths[0]);
});

ipcMain.handle('config:bulkDelete', async (_, physicalPath, keys) => {
  return await configManager.bulkDeleteEnvironmentVariables(physicalPath, keys);
});

ipcMain.handle('config:addEnvVar', async (_, physicalPath, key, value) => {
  return await configManager.addEnvironmentVariable(physicalPath, key, value);
});

ipcMain.handle('dialog:confirm', async (_, message) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Evet', 'Hayır'],
    defaultId: 1,
    title: 'Onay',
    message: message
  });
  return result.response === 0;
});
