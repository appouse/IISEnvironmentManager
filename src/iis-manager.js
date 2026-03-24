const { execFile } = require('child_process');

function runPowerShell(command) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command],
      { maxBuffer: 1024 * 1024 * 10 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`PowerShell error: ${stderr || error.message}`));
          return;
        }
        resolve(stdout.trim());
      }
    );
  });
}

async function getApplicationPools() {
  try {
    const cmd = `Import-Module WebAdministration; Get-ChildItem 'IIS:\\AppPools' | ForEach-Object { [PSCustomObject]@{ Name = $_.Name; State = $_.State.ToString(); ManagedRuntimeVersion = $_.ManagedRuntimeVersion; ManagedPipelineMode = $_.ManagedPipelineMode.ToString() } } | ConvertTo-Json -Compress`;
    const result = await runPowerShell(cmd);
    if (!result) return [];
    const parsed = JSON.parse(result);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    console.error('getApplicationPools error:', err);
    return [];
  }
}

async function getSites() {
  try {
    const cmd = `Import-Module WebAdministration; Get-ChildItem 'IIS:\\Sites' | ForEach-Object { [PSCustomObject]@{ Name = $_.Name; ID = $_.ID; State = $_.State.ToString(); PhysicalPath = $_.PhysicalPath } } | ConvertTo-Json -Compress`;
    const result = await runPowerShell(cmd);
    if (!result) return [];
    const parsed = JSON.parse(result);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    console.error('getSites error:', err);
    return [];
  }
}

async function getApplications(siteName) {
  try {
    const cmd = `Import-Module WebAdministration; Get-WebApplication -Site '${siteName}' | ForEach-Object { [PSCustomObject]@{ Path = $_.Path; PhysicalPath = $_.PhysicalPath; ApplicationPool = $_.ApplicationPool } } | ConvertTo-Json -Compress`;
    const result = await runPowerShell(cmd);
    if (!result) return [];
    const parsed = JSON.parse(result);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    console.error('getApplications error:', err);
    return [];
  }
}

async function getSitePhysicalPath(siteName) {
  try {
    const cmd = `Import-Module WebAdministration; (Get-WebSite -Name '${siteName}').PhysicalPath`;
    const result = await runPowerShell(cmd);
    return result || '';
  } catch (err) {
    console.error('getSitePhysicalPath error:', err);
    return '';
  }
}

module.exports = {
  getApplicationPools,
  getSites,
  getApplications,
  getSitePhysicalPath
};
