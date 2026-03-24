/**
 * Postbuild Script
 * @electron/packager çıktısını zipleyip version.json oluşturur.
 * Kullanım: node scripts/postbuild.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const pkg = require('../package.json');
const version = pkg.version;

const distDir = path.join(__dirname, '..', 'dist');
const packagerOutput = path.join(distDir, 'IIS Environment Controller-win32-x64');
const zipName = `IISEnvironmentController-v${version}.zip`;
const zipPath = path.join(distDir, zipName);

// GitHub repo bilgisi
const repoUrl = (pkg.repository?.url || pkg.repository || '').replace(/\.git$/, '');
const githubRepo = repoUrl.replace('https://github.com/', '');

// Packager çıktısını kontrol et
if (!fs.existsSync(packagerOutput)) {
  console.error(`❌ Packager çıktısı bulunamadı: ${packagerOutput}`);
  console.error('   Önce build çalıştırın: npm run build');
  process.exit(1);
}

// Eski zip varsa sil
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

// PowerShell ile ziple
console.log('📦 Zipleniyor...');
try {
  execFileSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    `Compress-Archive -Path '${packagerOutput}\\*' -DestinationPath '${zipPath}' -Force`
  ]);
} catch (err) {
  console.error('❌ Zipleme başarısız:', err.message);
  process.exit(1);
}

// SHA256 hesapla
const fileBuffer = fs.readFileSync(zipPath);
const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);

// Download URL
const downloadUrl = githubRepo
  ? `https://github.com/${githubRepo}/releases/download/v${version}/${zipName}`
  : `<DOWNLOAD_URL>/${zipName}`;

// version.json oluştur
const versionInfo = {
  version: version,
  url: downloadUrl,
  sha256: sha256,
  fileName: zipName,
  releaseNotes: '',
  releasedAt: new Date().toISOString()
};

// dist/ ve repo root'a yaz
fs.writeFileSync(path.join(distDir, 'version.json'), JSON.stringify(versionInfo, null, 2), 'utf-8');
fs.writeFileSync(path.join(__dirname, '..', 'version.json'), JSON.stringify(versionInfo, null, 2), 'utf-8');

console.log('');
console.log('✅ Build tamamlandı:');
console.log(`   📦 Sürüm:    v${version}`);
console.log(`   📁 Zip:      ${zipName} (${fileSizeMB} MB)`);
console.log(`   🔒 SHA256:   ${sha256}`);
console.log(`   🔗 URL:      ${downloadUrl}`);
console.log('');
