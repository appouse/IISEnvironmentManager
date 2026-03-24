const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const parser = new xml2js.Parser({ explicitArray: true, preserveChildrenOrder: true, xmldec: { version: '1.0', encoding: 'utf-8' } });
const builder = new xml2js.Builder({ xmldec: { version: '1.0', encoding: 'utf-8' }, renderOpts: { pretty: true, indent: '  ', newline: '\r\n' } });

function findWebConfigPath(physicalPath) {
  // Resolve environment variables like %SystemDrive%
  const resolved = physicalPath.replace(/%([^%]+)%/g, (_, key) => process.env[key] || `%${key}%`);
  const configPath = path.join(resolved, 'web.config');
  return configPath;
}

async function readWebConfig(physicalPath) {
  const configPath = findWebConfigPath(physicalPath);
  if (!fs.existsSync(configPath)) {
    return null;
  }
  const xml = fs.readFileSync(configPath, 'utf-8');
  const result = await parser.parseStringPromise(xml);
  return result;
}

async function getEnvironmentVariables(physicalPath) {
  try {
    const config = await readWebConfig(physicalPath);
    if (!config) return { error: 'web.config bulunamadı', variables: [] };

    const variables = [];
    
    // Navigate: configuration > system.webServer > aspNetCore > environmentVariables > environmentVariable
    const aspNetCore = config?.configuration?.['system.webServer']?.[0]?.aspNetCore?.[0];
    if (aspNetCore && aspNetCore.environmentVariables) {
      const envVars = aspNetCore.environmentVariables[0];
      if (envVars.environmentVariable) {
        for (const v of envVars.environmentVariable) {
          variables.push({
            name: v.$.name,
            value: v.$.value
          });
        }
      }
    }

    // Also check appSettings
    const appSettings = config?.configuration?.appSettings?.[0];
    if (appSettings && appSettings.add) {
      for (const a of appSettings.add) {
        variables.push({
          name: `[appSettings] ${a.$.key}`,
          value: a.$.value,
          type: 'appSettings'
        });
      }
    }

    return { variables, configPath: findWebConfigPath(physicalPath) };
  } catch (err) {
    return { error: err.message, variables: [] };
  }
}

async function setEnvironmentVariable(physicalPath, key, value) {
  try {
    const configPath = findWebConfigPath(physicalPath);
    if (!fs.existsSync(configPath)) {
      return { success: false, error: 'web.config bulunamadı' };
    }

    const xml = fs.readFileSync(configPath, 'utf-8');
    const config = await parser.parseStringPromise(xml);

    // Check if it's an appSettings key
    if (key.startsWith('[appSettings] ')) {
      const actualKey = key.replace('[appSettings] ', '');
      const appSettings = config?.configuration?.appSettings?.[0];
      if (appSettings && appSettings.add) {
        const entry = appSettings.add.find(a => a.$.key === actualKey);
        if (entry) {
          entry.$.value = value;
        }
      }
    } else {
      // aspNetCore environmentVariables
      const aspNetCore = config?.configuration?.['system.webServer']?.[0]?.aspNetCore?.[0];
      if (aspNetCore && aspNetCore.environmentVariables) {
        const envVars = aspNetCore.environmentVariables[0];
        if (envVars.environmentVariable) {
          const entry = envVars.environmentVariable.find(v => v.$.name === key);
          if (entry) {
            entry.$.value = value;
          }
        }
      }
    }

    const newXml = builder.buildObject(config);
    fs.writeFileSync(configPath, newXml, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function addEnvironmentVariable(physicalPath, key, value) {
  try {
    const configPath = findWebConfigPath(physicalPath);
    if (!fs.existsSync(configPath)) {
      return { success: false, error: 'web.config bulunamadı' };
    }

    const xml = fs.readFileSync(configPath, 'utf-8');
    const config = await parser.parseStringPromise(xml);

    // Ensure structure exists
    if (!config.configuration) config.configuration = {};
    if (!config.configuration['system.webServer']) config.configuration['system.webServer'] = [{}];
    if (!config.configuration['system.webServer'][0].aspNetCore) {
      config.configuration['system.webServer'][0].aspNetCore = [{ $: { processPath: 'dotnet' } }];
    }
    const aspNetCore = config.configuration['system.webServer'][0].aspNetCore[0];
    if (!aspNetCore.environmentVariables) aspNetCore.environmentVariables = [{}];
    if (!aspNetCore.environmentVariables[0].environmentVariable) {
      aspNetCore.environmentVariables[0].environmentVariable = [];
    }

    // Check duplicate
    const existing = aspNetCore.environmentVariables[0].environmentVariable.find(v => v.$.name === key);
    if (existing) {
      return { success: false, error: `'${key}' adlı değişken zaten mevcut` };
    }

    aspNetCore.environmentVariables[0].environmentVariable.push({ $: { name: key, value: value } });

    const newXml = builder.buildObject(config);
    fs.writeFileSync(configPath, newXml, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function deleteEnvironmentVariable(physicalPath, key) {
  try {
    const configPath = findWebConfigPath(physicalPath);
    if (!fs.existsSync(configPath)) {
      return { success: false, error: 'web.config bulunamadı' };
    }

    const xml = fs.readFileSync(configPath, 'utf-8');
    const config = await parser.parseStringPromise(xml);

    if (key.startsWith('[appSettings] ')) {
      const actualKey = key.replace('[appSettings] ', '');
      const appSettings = config?.configuration?.appSettings?.[0];
      if (appSettings && appSettings.add) {
        appSettings.add = appSettings.add.filter(a => a.$.key !== actualKey);
      }
    } else {
      const aspNetCore = config?.configuration?.['system.webServer']?.[0]?.aspNetCore?.[0];
      if (aspNetCore && aspNetCore.environmentVariables) {
        const envVars = aspNetCore.environmentVariables[0];
        if (envVars.environmentVariable) {
          envVars.environmentVariable = envVars.environmentVariable.filter(v => v.$.name !== key);
        }
      }
    }

    const newXml = builder.buildObject(config);
    fs.writeFileSync(configPath, newXml, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function bulkDeleteEnvironmentVariables(physicalPath, keys) {
  try {
    const configPath = findWebConfigPath(physicalPath);
    if (!fs.existsSync(configPath)) {
      return { success: false, error: 'web.config bulunamadı' };
    }

    const xml = fs.readFileSync(configPath, 'utf-8');
    const config = await parser.parseStringPromise(xml);

    for (const key of keys) {
      if (key.startsWith('[appSettings] ')) {
        const actualKey = key.replace('[appSettings] ', '');
        const appSettings = config?.configuration?.appSettings?.[0];
        if (appSettings && appSettings.add) {
          appSettings.add = appSettings.add.filter(a => a.$.key !== actualKey);
        }
      } else {
        const aspNetCore = config?.configuration?.['system.webServer']?.[0]?.aspNetCore?.[0];
        if (aspNetCore && aspNetCore.environmentVariables) {
          const envVars = aspNetCore.environmentVariables[0];
          if (envVars.environmentVariable) {
            envVars.environmentVariable = envVars.environmentVariable.filter(v => v.$.name !== key);
          }
        }
      }
    }

    const newXml = builder.buildObject(config);
    fs.writeFileSync(configPath, newXml, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function exportVariables(physicalPath, outputPath) {
  try {
    const result = await getEnvironmentVariables(physicalPath);
    if (result.error) return { success: false, error: result.error };
    
    const exportData = {
      exportDate: new Date().toISOString(),
      source: findWebConfigPath(physicalPath),
      variables: result.variables
    };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
    return { success: true, count: result.variables.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function importVariables(physicalPath, inputPath) {
  try {
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
    if (!data.variables || !Array.isArray(data.variables)) {
      return { success: false, error: 'Geçersiz JSON formatı' };
    }

    const configPath = findWebConfigPath(physicalPath);
    if (!fs.existsSync(configPath)) {
      return { success: false, error: 'web.config bulunamadı' };
    }

    const xml = fs.readFileSync(configPath, 'utf-8');
    const config = await parser.parseStringPromise(xml);

    // Ensure structure
    if (!config.configuration) config.configuration = {};
    if (!config.configuration['system.webServer']) config.configuration['system.webServer'] = [{}];
    if (!config.configuration['system.webServer'][0].aspNetCore) {
      config.configuration['system.webServer'][0].aspNetCore = [{ $: { processPath: 'dotnet' } }];
    }
    const aspNetCore = config.configuration['system.webServer'][0].aspNetCore[0];
    if (!aspNetCore.environmentVariables) aspNetCore.environmentVariables = [{}];
    if (!aspNetCore.environmentVariables[0].environmentVariable) {
      aspNetCore.environmentVariables[0].environmentVariable = [];
    }

    let added = 0, updated = 0;
    for (const v of data.variables) {
      if (v.type === 'appSettings') continue; // skip appSettings for import
      
      const existing = aspNetCore.environmentVariables[0].environmentVariable.find(
        e => e.$.name === v.name
      );
      if (existing) {
        existing.$.value = v.value;
        updated++;
      } else {
        aspNetCore.environmentVariables[0].environmentVariable.push({
          $: { name: v.name, value: v.value }
        });
        added++;
      }
    }

    const newXml = builder.buildObject(config);
    fs.writeFileSync(configPath, newXml, 'utf-8');
    return { success: true, added, updated };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  readWebConfig,
  getEnvironmentVariables,
  setEnvironmentVariable,
  addEnvironmentVariable,
  deleteEnvironmentVariable,
  bulkDeleteEnvironmentVariables,
  exportVariables,
  importVariables
};
