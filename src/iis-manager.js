const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

function runPowerShell(command) {
  return new Promise((resolve, reject) => {
    const psCmd = `powershell -NoProfile -Command "${command.replace(/"/g, '\\"')}"`;
    exec(psCmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`PowerShell error: ${stderr || error.message}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function getApplicationPools() {
  try {
    const cmd = `Import-Module WebAdministration; Get-ChildItem IIS:\\AppPools | Select-Object Name, State, ManagedRuntimeVersion, ManagedPipelineMode | ConvertTo-Json -Compress`;
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
    const cmd = `Import-Module WebAdministration; Get-ChildItem IIS:\\Sites | Select-Object Name, ID, State, PhysicalPath | ConvertTo-Json -Compress`;
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
    const cmd = `Import-Module WebAdministration; Get-WebApplication -Site '${siteName}' | Select-Object @{Name='Path';Expression={$_.path}}, @{Name='PhysicalPath';Expression={$_.PhysicalPath}}, @{Name='ApplicationPool';Expression={$_.applicationPool}} | ConvertTo-Json -Compress`;
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
