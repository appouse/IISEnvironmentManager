const { execFile } = require('child_process');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class AutoUpdater {
  constructor(options = {}) {
    this.updateUrl = options.updateUrl || '';
    this.currentVersion = options.currentVersion || '0.0.0';
    this.onUpdateAvailable = null;
    this.onDownloadProgress = null;
    this.onUpdateDownloaded = null;
    this.onError = null;
  }

  async checkForUpdates() {
    if (!this.updateUrl) {
      throw new Error('Update URL tanımlanmamış');
    }

    try {
      const versionInfo = await this._fetchJson(this.updateUrl);
      
      if (!versionInfo || !versionInfo.version) {
        return { updateAvailable: false };
      }

      const isNewer = this._compareVersions(versionInfo.version, this.currentVersion) > 0;
      
      if (isNewer) {
        if (this.onUpdateAvailable) {
          this.onUpdateAvailable(versionInfo);
        }
        return { updateAvailable: true, versionInfo };
      }

      return { updateAvailable: false };
    } catch (err) {
      console.error('Update check failed:', err);
      if (this.onError) this.onError(err);
      return { updateAvailable: false, error: err.message };
    }
  }

  async downloadUpdate(versionInfo) {
    const { url, sha256 } = versionInfo;
    if (!url) throw new Error('Download URL bulunamadı');

    const tempDir = path.join(process.env.TEMP || process.env.TMP || '.', 'iis-env-controller-update');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFile = path.join(tempDir, 'IISEnvironmentController_new.exe');

    try {
      await this._downloadFile(url, tempFile);

      // SHA256 doğrulama
      if (sha256) {
        const fileHash = await this._calculateHash(tempFile);
        if (fileHash.toLowerCase() !== sha256.toLowerCase()) {
          fs.unlinkSync(tempFile);
          throw new Error('SHA256 doğrulaması başarısız — dosya bozuk olabilir');
        }
      }

      if (this.onUpdateDownloaded) {
        this.onUpdateDownloaded(tempFile);
      }

      return { success: true, filePath: tempFile };
    } catch (err) {
      console.error('Download failed:', err);
      if (this.onError) this.onError(err);
      throw err;
    }
  }

  applyUpdate(downloadedExePath) {
    const currentExe = process.execPath;
    const currentDir = path.dirname(currentExe);
    const currentName = path.basename(currentExe);
    const backupPath = path.join(currentDir, `${currentName}.bak`);

    // PowerShell script: eski exe'yi yedekle, yenisini kopyala, başlat
    const psScript = `
      Start-Sleep -Seconds 2
      try {
        if (Test-Path '${backupPath}') { Remove-Item '${backupPath}' -Force }
        Move-Item '${currentExe}' '${backupPath}' -Force
        Copy-Item '${downloadedExePath}' '${currentExe}' -Force
        Start-Process '${currentExe}'
        Remove-Item '${downloadedExePath}' -Force
      } catch {
        # Güncelleme başarısız — eski exe'yi geri yükle
        if (Test-Path '${backupPath}') {
          Move-Item '${backupPath}' '${currentExe}' -Force
        }
        Start-Process '${currentExe}'
      }
    `;

    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], { detached: true, stdio: 'ignore' });
  }

  // ── Private helpers ───────────────────────────

  _fetchJson(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      client.get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Geçersiz JSON yanıtı'));
          }
        });
      }).on('error', reject);
    });
  }

  _downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(destPath);

      client.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // Redirect takibi
          file.close();
          fs.unlinkSync(destPath);
          return this._downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        }

        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(destPath);
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }

        const totalSize = parseInt(res.headers['content-length'], 10) || 0;
        let downloaded = 0;

        res.on('data', (chunk) => {
          downloaded += chunk.length;
          if (this.onDownloadProgress && totalSize > 0) {
            this.onDownloadProgress({
              percent: Math.round((downloaded / totalSize) * 100),
              transferred: downloaded,
              total: totalSize
            });
          }
        });

        res.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });

        file.on('error', (err) => {
          fs.unlinkSync(destPath);
          reject(err);
        });
      }).on('error', (err) => {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        reject(err);
      });
    });
  }

  _calculateHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  _compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    const len = Math.max(parts1.length, parts2.length);
    
    for (let i = 0; i < len; i++) {
      const a = parts1[i] || 0;
      const b = parts2[i] || 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  }
}

module.exports = AutoUpdater;
