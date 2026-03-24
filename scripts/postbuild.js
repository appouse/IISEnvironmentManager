/**
 * Postbuild Script
 * Build sonrası version.json otomatik oluşturur ve exe'nin SHA256 hash'ini hesaplar.
 * Kullanım: node scripts/postbuild.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const pkg = require('../package.json');
const version = pkg.version;

// electron-builder output
const distDir = path.join(__dirname, '..', 'dist');
const exeName = 'IISEnvironmentController.exe';
const exePath = path.join(distDir, exeName);

// GitHub repo bilgisi — package.json'daki repository alanından alınır
const repoUrl = pkg.repository?.url?.replace(/\.git$/, '') || pkg.repository || '';
const githubRepo = repoUrl.replace('https://github.com/', '');

if (!fs.existsSync(exePath)) {
  console.error(`❌ Exe bulunamadı: ${exePath}`);
  console.error('   Önce build çalıştırın: npm run build');
  process.exit(1);
}

// SHA256 hesapla
const fileBuffer = fs.readFileSync(exePath);
const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);

// Download URL — GitHub Releases formatı
const downloadUrl = githubRepo
  ? `https://github.com/${githubRepo}/releases/download/v${version}/${exeName}`
  : `<DOWNLOAD_URL>/${exeName}`;

// version.json oluştur
const versionInfo = {
  version: version,
  url: downloadUrl,
  sha256: sha256,
  releaseNotes: '',
  releasedAt: new Date().toISOString()
};

const outputPath = path.join(distDir, 'version.json');
fs.writeFileSync(outputPath, JSON.stringify(versionInfo, null, 2), 'utf-8');

console.log('');
console.log('✅ version.json oluşturuldu:');
console.log(`   📦 Sürüm:    v${version}`);
console.log(`   🔒 SHA256:   ${sha256}`);
console.log(`   📁 Boyut:    ${fileSizeMB} MB`);
console.log(`   🔗 URL:      ${downloadUrl}`);
console.log(`   📄 Dosya:    ${outputPath}`);
console.log('');
