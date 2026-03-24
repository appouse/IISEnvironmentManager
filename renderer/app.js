// ═══════════════════════════════════════════
// IIS Environment Controller - App Logic
// ═══════════════════════════════════════════

let currentPhysicalPath = null;
let currentAppName = null;
let allVariables = [];
let selectedKeys = new Set();

// ── DOM Elements ────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const treeContainer = $('#treeContainer');
const treeLoading = $('#treeLoading');
const emptyState = $('#emptyState');
const varsPanel = $('#varsPanel');
const varsBody = $('#varsBody');
const varsEmpty = $('#varsEmpty');
const selectedAppName = $('#selectedAppName');
const selectedAppPath = $('#selectedAppPath');
const varSearch = $('#varSearch');
const checkAll = $('#checkAll');
const btnBulkDelete = $('#btnBulkDelete');
const selectedCount = $('#selectedCount');
const varCount = $('#varCount');
const configFilePath = $('#configFilePath');
const addVarModal = $('#addVarModal');
const sidebarSearch = $('#sidebarSearch');

// ── Initialize ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadTree();
  bindEvents();
});

function bindEvents() {
  $('#btnRefresh').addEventListener('click', loadTree);
  $('#btnAddVar').addEventListener('click', showAddModal);
  $('#btnExport').addEventListener('click', handleExport);
  $('#btnImport').addEventListener('click', handleImport);
  $('#btnBulkDelete').addEventListener('click', handleBulkDelete);
  
  $('#btnCloseModal').addEventListener('click', hideAddModal);
  $('#btnCancelAdd').addEventListener('click', hideAddModal);
  $('#btnConfirmAdd').addEventListener('click', handleAddVariable);
  
  checkAll.addEventListener('change', handleCheckAll);
  varSearch.addEventListener('input', filterVariables);
  sidebarSearch.addEventListener('input', filterTree);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'r') {
      e.preventDefault();
      loadTree();
    }
    if (e.key === 'Escape') {
      hideAddModal();
    }
  });

  // Modal backdrop click
  addVarModal.addEventListener('click', (e) => {
    if (e.target === addVarModal) hideAddModal();
  });

  // Enter in modal
  $('#newVarValue').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddVariable();
  });
}

// ── Tree Loading ────────────────────────────
async function loadTree() {
  treeLoading.style.display = 'flex';
  treeContainer.querySelectorAll('.tree-section').forEach(el => el.remove());

  try {
    const [appPools, sites] = await Promise.all([
      window.api.getAppPools(),
      window.api.getSites()
    ]);

    treeLoading.style.display = 'none';

    // Render App Pools
    const poolSection = createTreeSection('Application Pools', '🔧');
    for (const pool of appPools) {
      const state = pool.State?.toString() === '1' || pool.State === 'Started' ? 'Started' : 'Stopped';
      const item = createTreeItem(
        '⚡', 
        pool.Name, 
        state,
        null // pools don't have direct config
      );
      poolSection.content.appendChild(item);
    }
    treeContainer.appendChild(poolSection.element);

    // Render Sites with Applications
    const siteSection = createTreeSection('Sites', '🌍');
    for (const site of sites) {
      const state = site.State?.toString() === '1' || site.State === 'Started' ? 'Started' : 'Stopped';
      const siteItem = createTreeItem('🌐', site.Name, state, async () => {
        const physPath = await window.api.getSitePhysicalPath(site.Name);
        if (physPath) selectApplication(site.Name, physPath);
      });

      // Load applications under each site
      const apps = await window.api.getApplications(site.Name);
      if (apps && apps.length > 0) {
        const subContainer = document.createElement('div');
        subContainer.className = 'tree-sub-items';
        
        for (const app of apps) {
          const subItem = document.createElement('div');
          subItem.className = 'tree-sub-item';
          subItem.innerHTML = `
            <span class="item-icon">📁</span>
            <span class="item-name">${app.Path}</span>
          `;
          subItem.addEventListener('click', () => {
            document.querySelectorAll('.tree-sub-item.active').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tree-item.active').forEach(el => el.classList.remove('active'));
            subItem.classList.add('active');
            selectApplication(`${site.Name}${app.Path}`, app.PhysicalPath);
          });
          subContainer.appendChild(subItem);
        }
        
        siteItem.after(subContainer);
        siteSection.content.appendChild(siteItem);
        siteSection.content.appendChild(subContainer);
      } else {
        siteSection.content.appendChild(siteItem);
      }
    }
    treeContainer.appendChild(siteSection.element);

    showToast('success', `${appPools.length} pool, ${sites.length} site yüklendi`);
  } catch (err) {
    treeLoading.style.display = 'none';
    showToast('error', `IIS bilgileri yüklenemedi: ${err.message}`);
    
    // Show error state in tree
    const errorDiv = document.createElement('div');
    errorDiv.className = 'loading-indicator';
    errorDiv.innerHTML = `
      <div style="font-size:32px">⚠️</div>
      <span>IIS bilgileri alınamadı.</span>
      <span style="font-size:11px;color:var(--text-muted)">Uygulamayı yönetici olarak çalıştırın.</span>
    `;
    treeContainer.appendChild(errorDiv);
  }
}

function createTreeSection(title, icon) {
  const section = document.createElement('div');
  section.className = 'tree-section';

  const header = document.createElement('div');
  header.className = 'tree-section-header';
  header.innerHTML = `<span class="chevron">▼</span> ${icon} ${title}`;
  header.addEventListener('click', () => {
    header.classList.toggle('collapsed');
    content.style.display = header.classList.contains('collapsed') ? 'none' : 'block';
  });

  const content = document.createElement('div');
  content.className = 'tree-section-content';

  section.appendChild(header);
  section.appendChild(content);

  return { element: section, content };
}

function createTreeItem(icon, name, state, onClick) {
  const item = document.createElement('div');
  item.className = 'tree-item';
  
  const badgeClass = state === 'Started' ? 'badge-running' : 'badge-stopped';
  const badgeText = state === 'Started' ? 'Çalışıyor' : 'Durdu';
  
  item.innerHTML = `
    <span class="item-icon">${icon}</span>
    <span class="item-name">${name}</span>
    <span class="item-badge ${badgeClass}">${badgeText}</span>
  `;

  if (onClick) {
    item.addEventListener('click', () => {
      document.querySelectorAll('.tree-item.active').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tree-sub-item.active').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      onClick();
    });
  }

  return item;
}

// ── Filter Tree ─────────────────────────────
function filterTree() {
  const query = sidebarSearch.value.toLowerCase();
  const items = treeContainer.querySelectorAll('.tree-item, .tree-sub-item');
  items.forEach(item => {
    const name = item.querySelector('.item-name')?.textContent?.toLowerCase() || '';
    item.style.display = name.includes(query) ? '' : 'none';
  });
}

// ── Select Application & Load Variables ─────
async function selectApplication(name, physicalPath) {
  currentAppName = name;
  currentPhysicalPath = physicalPath;
  selectedKeys.clear();
  updateBulkDeleteBtn();

  emptyState.style.display = 'none';
  varsPanel.style.display = 'flex';
  selectedAppName.textContent = name;
  selectedAppPath.textContent = physicalPath;

  await loadVariables();
}

async function loadVariables() {
  if (!currentPhysicalPath) return;
  
  varsBody.innerHTML = `
    <tr>
      <td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted)">
        <div class="spinner" style="margin:0 auto 12px"></div>
        Yükleniyor...
      </td>
    </tr>
  `;

  const result = await window.api.getEnvVars(currentPhysicalPath);
  
  if (result.error && result.variables.length === 0) {
    varsBody.innerHTML = '';
    varsEmpty.style.display = 'block';
    varsEmpty.querySelector('p').textContent = result.error;
    varCount.textContent = '0 değişken';
    configFilePath.textContent = '';
    return;
  }

  allVariables = result.variables || [];
  configFilePath.textContent = result.configPath || '';
  varsEmpty.style.display = 'none';
  
  renderVariables(allVariables);
}

// ── Render Variables Table ──────────────────
function renderVariables(variables) {
  varsBody.innerHTML = '';
  checkAll.checked = false;

  if (variables.length === 0) {
    varsEmpty.style.display = 'block';
    varCount.textContent = '0 değişken';
    return;
  }

  varsEmpty.style.display = 'none';
  varCount.textContent = `${variables.length} değişken`;

  for (const v of variables) {
    const tr = document.createElement('tr');
    tr.dataset.name = v.name;
    
    const isSelected = selectedKeys.has(v.name);
    if (isSelected) tr.classList.add('selected');

    tr.innerHTML = `
      <td class="col-check">
        <input type="checkbox" class="var-check" data-name="${escapeHtml(v.name)}" ${isSelected ? 'checked' : ''} />
      </td>
      <td class="col-name">
        <span class="var-name">${escapeHtml(v.name)}</span>
        ${v.type ? `<span class="var-type-badge">${v.type}</span>` : ''}
      </td>
      <td class="col-value">
        <span class="var-value">${escapeHtml(v.value)}</span>
      </td>
      <td class="col-actions">
        <div class="actions-cell">
          <button class="btn-icon-sm edit" title="Düzenle" data-name="${escapeHtml(v.name)}" data-value="${escapeHtml(v.value)}">✏️</button>
          <button class="btn-icon-sm delete" title="Sil" data-name="${escapeHtml(v.name)}">🗑️</button>
        </div>
      </td>
    `;

    // Checkbox handler
    tr.querySelector('.var-check').addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedKeys.add(v.name);
        tr.classList.add('selected');
      } else {
        selectedKeys.delete(v.name);
        tr.classList.remove('selected');
      }
      updateBulkDeleteBtn();
    });

    // Edit handler
    tr.querySelector('.edit').addEventListener('click', () => startEditing(tr, v));

    // Delete handler
    tr.querySelector('.delete').addEventListener('click', () => handleDeleteSingle(v.name));

    varsBody.appendChild(tr);
  }
}

// ── Inline Editing ──────────────────────────
function startEditing(tr, variable) {
  // Cancel any other editing
  document.querySelectorAll('tr.editing').forEach(row => cancelEditing(row));

  tr.classList.add('editing');
  const valueCell = tr.querySelector('.col-value');
  const actionsCell = tr.querySelector('.actions-cell');
  const currentValue = variable.value;

  valueCell.innerHTML = `<input class="edit-input" type="text" value="${escapeHtml(currentValue)}" />`;
  const input = valueCell.querySelector('.edit-input');
  input.focus();
  input.select();

  actionsCell.innerHTML = `
    <button class="btn-icon-sm save" title="Kaydet">✅</button>
    <button class="btn-icon-sm cancel" title="İptal">❌</button>
  `;

  const save = async () => {
    const newValue = input.value;
    if (newValue !== currentValue) {
      const result = await window.api.setEnvVar(currentPhysicalPath, variable.name, newValue);
      if (result.success) {
        showToast('success', `'${variable.name}' güncellendi`);
        await loadVariables();
      } else {
        showToast('error', result.error || 'Güncelleme başarısız');
      }
    } else {
      await loadVariables();
    }
  };

  actionsCell.querySelector('.save').addEventListener('click', save);
  actionsCell.querySelector('.cancel').addEventListener('click', () => loadVariables());
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') loadVariables();
  });
}

function cancelEditing(tr) {
  tr.classList.remove('editing');
}

// ── Filter Variables ────────────────────────
function filterVariables() {
  const query = varSearch.value.toLowerCase();
  const filtered = allVariables.filter(v =>
    v.name.toLowerCase().includes(query) || v.value.toLowerCase().includes(query)
  );
  renderVariables(filtered);
}

// ── Checkbox Handling ───────────────────────
function handleCheckAll() {
  const checkboxes = varsBody.querySelectorAll('.var-check');
  const isChecked = checkAll.checked;
  
  checkboxes.forEach(cb => {
    cb.checked = isChecked;
    const name = cb.dataset.name;
    const row = cb.closest('tr');
    if (isChecked) {
      selectedKeys.add(name);
      row.classList.add('selected');
    } else {
      selectedKeys.delete(name);
      row.classList.remove('selected');
    }
  });
  updateBulkDeleteBtn();
}

function updateBulkDeleteBtn() {
  const count = selectedKeys.size;
  btnBulkDelete.style.display = count > 0 ? 'inline-flex' : 'none';
  selectedCount.textContent = count;
}

// ── Delete ──────────────────────────────────
async function handleDeleteSingle(name) {
  const confirmed = await window.api.confirm(`'${name}' değişkenini silmek istediğinize emin misiniz?`);
  if (!confirmed) return;

  const result = await window.api.deleteEnvVar(currentPhysicalPath, name);
  if (result.success) {
    showToast('success', `'${name}' silindi`);
    selectedKeys.delete(name);
    await loadVariables();
  } else {
    showToast('error', result.error || 'Silme başarısız');
  }
}

async function handleBulkDelete() {
  const keys = Array.from(selectedKeys);
  const confirmed = await window.api.confirm(`${keys.length} değişkeni silmek istediğinize emin misiniz?`);
  if (!confirmed) return;

  const result = await window.api.bulkDelete(currentPhysicalPath, keys);
  if (result.success) {
    showToast('success', `${keys.length} değişken silindi`);
    selectedKeys.clear();
    updateBulkDeleteBtn();
    await loadVariables();
  } else {
    showToast('error', result.error || 'Toplu silme başarısız');
  }
}

// ── Add Variable ────────────────────────────
function showAddModal() {
  addVarModal.style.display = 'flex';
  $('#newVarName').value = '';
  $('#newVarValue').value = '';
  setTimeout(() => $('#newVarName').focus(), 100);
}

function hideAddModal() {
  addVarModal.style.display = 'none';
}

async function handleAddVariable() {
  const name = $('#newVarName').value.trim();
  const value = $('#newVarValue').value.trim();

  if (!name) {
    showToast('warning', 'Değişken adı boş olamaz');
    return;
  }

  const result = await window.api.addEnvVar(currentPhysicalPath, name, value);
  if (result.success) {
    showToast('success', `'${name}' eklendi`);
    hideAddModal();
    await loadVariables();
  } else {
    showToast('error', result.error || 'Ekleme başarısız');
  }
}

// ── Export / Import ─────────────────────────
async function handleExport() {
  if (!currentPhysicalPath) return;
  const result = await window.api.exportVars(currentPhysicalPath);
  if (result.canceled) return;
  if (result.success) {
    showToast('success', `${result.count} değişken dışa aktarıldı`);
  } else {
    showToast('error', result.error || 'Export başarısız');
  }
}

async function handleImport() {
  if (!currentPhysicalPath) return;
  const result = await window.api.importVars(currentPhysicalPath);
  if (result.canceled) return;
  if (result.success) {
    showToast('success', `${result.added} eklendi, ${result.updated} güncellendi`);
    await loadVariables();
  } else {
    showToast('error', result.error || 'Import başarısız');
  }
}

// ── Toast Notifications ─────────────────────
function showToast(type, message) {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const container = $('#toastContainer');
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

// ── Utilities ───────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
