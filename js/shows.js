import { bars, shows, showConfig, activeShowName, setShows, setActiveShowName, setShowConfig, setBars, setExpanded } from './state.js';
import { saveLocal } from './storage.js';
import { normaliseBar, applyAutoFlags } from './state.js';
import { firebasePut, setSyncStatus, scheduleSave } from './firebase.js';
import { requireEdit } from './users.js';
import { esc, escAttr } from './render-bars.js';
import { logHistory } from './bar-actions.js';
import { defaultBars } from './state.js';

export function toggleShowsPanel() {
  import('./state.js').then(({ showsPanelOpen, setShowsPanelOpen }) => {
    setShowsPanelOpen(!showsPanelOpen);
    document.getElementById('shows-body').style.display = showsPanelOpen ? 'block' : 'none';
    document.getElementById('shows-chevron').textContent = showsPanelOpen ? '▲' : '▼';
  });
}

export async function saveShowsToFirebase() {
  try {
    await firebasePut('shows', shows);
  } catch(e) {
    console.warn('[Firebase shows]', e);
  }
}

export async function saveShow(name, skipConfirm = false) {
  if (!name) return;
  const isOverwrite = !!shows[name];
  if (isOverwrite && !skipConfirm && name !== activeShowName && !confirm(`A show named "${name}" already exists. Overwrite it?`)) return;

  // Snapshot the current saved version as a backup before overwriting
  const prev = shows[name];
  const prevBackups = prev?.backups || [];
  let newBackups = prevBackups;
  if (prev?.savedAt) {
    const backup = { savedAt: prev.savedAt, bars: prev.bars, showConfig: prev.showConfig };
    newBackups = [backup, ...prevBackups].slice(0, 10);
  }

  shows[name] = {
    bars: JSON.parse(JSON.stringify(bars)),
    showConfig: JSON.parse(JSON.stringify(showConfig)),
    savedAt: new Date().toISOString(),
    backups: newBackups
  };
  saveLocal('tbtl_shows_v1', shows);
  saveLocal('tbtl_last_show_v1', name);
  setActiveShowName(name);
  try {
    setSyncStatus('syncing', 'Saving show...');
    await firebasePut('shows', shows);
    setSyncStatus('online', `Show "${name}" saved · ${new Date().toLocaleTimeString()}`);
  } catch(e) {
    setSyncStatus('offline', `Show saved locally (Firebase offline)`);
  }
  renderShows();
}

export function loadShow(name) {
  const show = shows[name];
  if (!show) return;
  if (activeShowName && activeShowName !== name) {
    shows[activeShowName] = {
      bars: JSON.parse(JSON.stringify(bars)),
      showConfig: JSON.parse(JSON.stringify(showConfig)),
      savedAt: new Date().toISOString()
    };
    saveLocal('tbtl_shows_v1', shows);
    firebasePut('shows', shows).catch(e => console.warn('[Firebase shows]', e));
  }
  if (!confirm(`Switch to "${name}"?${activeShowName && activeShowName !== name ? `\n\nYour current show "${activeShowName}" has been auto-saved.` : ''}`)) return;
  setBars(show.bars.map(normaliseBar));
  setShowConfig(show.showConfig ? { maxFlymen: 1, customDeads: {}, barDefaults: {}, cues: [], ...show.showConfig } : { maxFlymen: 1, customDeads: {}, barDefaults: {}, cues: [] });
  applyAutoFlags();
  saveLocal('tbtl_showconfig_v1', showConfig);
  saveLocal('tbtl_last_show_v1', name);
  setActiveShowName(name);
  setExpanded({});
  logHistory(`Loaded show "${name}"`);
  scheduleSave();
  import('./main.js').then(({ render }) => render());
  renderShows();
}

export function toggleBackupsList(idx) {
  const el = document.getElementById(`show-backups-${idx}`);
  if (!el) return;
  // Close all others first
  document.querySelectorAll('[id^="show-backups-"]').forEach(e => { if (e !== el) e.style.display = 'none'; });
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

export function loadBackup(name, backupIdx) {
  const show = shows[name];
  const backup = show?.backups?.[backupIdx];
  if (!backup) return;
  const dateStr = new Date(backup.savedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  if (!confirm(`Restore backup from ${dateStr}?\n\nLoads into the live rig. Hit Override/Save to make it permanent.`)) return;
  setBars(backup.bars.map(normaliseBar));
  setShowConfig({ maxFlymen: 1, customDeads: {}, barDefaults: {}, cues: [], ...backup.showConfig });
  applyAutoFlags();
  saveLocal('tbtl_showconfig_v1', showConfig);
  saveLocal('tbtl_last_show_v1', name);
  setActiveShowName(name);
  setExpanded({});
  logHistory(`Restored backup from ${dateStr} for "${name}"`);
  scheduleSave();
  import('./main.js').then(({ render }) => render());
  renderShows();
}

export async function deleteShow(name) {
  if (!confirm(`Delete show "${name}"? This cannot be undone.`)) return;
  delete shows[name];
  if (activeShowName === name) setActiveShowName(null);
  saveLocal('tbtl_shows_v1', shows);
  try {
    await firebasePut('shows', shows);
  } catch(e) {}
  renderShows();
}

export async function overrideShow(name) {
  if (!confirm(`Overwrite "${name}" with the current rig? This cannot be undone.`)) return;
  await saveShow(name, true);
}

export function promptSaveShow() {
  const nameInput = document.getElementById('new-show-name');
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.style.borderColor = '#ef4444';
    setTimeout(() => nameInput.style.borderColor = '#334155', 1500);
    return;
  }
  saveShow(name).then(() => { nameInput.value = ''; });
}

export function openNewShowModal() {
  if (!requireEdit()) return;
  if (activeShowName) {
    shows[activeShowName] = {
      bars: JSON.parse(JSON.stringify(bars)),
      showConfig: JSON.parse(JSON.stringify(showConfig)),
      savedAt: new Date().toISOString()
    };
    saveLocal('tbtl_shows_v1', shows);
    firebasePut('shows', shows).catch(e => console.warn('[Firebase shows]', e));
  }
  const loadedBars = bars.filter(b => !b.dnf && ((b.fixtures||[]).length > 0 || b.extensions || b.iwb !== null || b.cable));
  const barCheckboxes = loadedBars.length > 0
    ? loadedBars.map(b => `<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#e2e8f0;padding:3px 0;cursor:pointer">
        <input type="checkbox" id="keep_bar_${b.id}" checked style="accent-color:#3b82f6">
        Bar ${b.id}${b.name !== `Bar ${b.id}` ? ` · ${esc(b.name)}` : ''} <span style="color:#475569;font-size:10px">(${(b.fixtures||[]).length} fix${b.extensions?' +ext':''}${b.iwb?' +IWB':''})</span>
      </label>`).join('')
    : '<span style="color:#475569;font-size:12px;font-style:italic">No loaded bars in current rig</span>';
  const modal = document.getElementById('new-show-modal');
  document.getElementById('new-show-bar-list').innerHTML = barCheckboxes;
  document.getElementById('new-show-modal-name').value = '';
  const radios = document.querySelectorAll('input[name="bar-reset-mode"]');
  radios.forEach(r => { r.checked = (r.value === 'keep'); });
  if (modal) modal.style.display = 'block';
  setTimeout(() => { const inp = document.getElementById('new-show-modal-name'); if (inp) inp.focus(); }, 50);
}

export function closeNewShowModal() {
  const m = document.getElementById('new-show-modal');
  if (m) m.style.display = 'none';
}

export async function confirmNewShow() {
  if (!requireEdit()) return;
  const inp = document.getElementById('new-show-modal-name');
  const name = inp ? inp.value.trim() : '';
  if (!name) {
    if (inp) { inp.style.borderColor = '#ef4444'; setTimeout(() => inp.style.borderColor = '#334155', 1500); }
    return;
  }
  const modeEl = document.querySelector('input[name="bar-reset-mode"]:checked');
  const resetMode = modeEl ? modeEl.value : 'keep';
  let newBars;
  if (resetMode === 'reset') {
    newBars = defaultBars();
  } else {
    const loadedBars = bars.filter(b => !b.dnf && ((b.fixtures||[]).length > 0 || b.extensions || b.iwb !== null || b.cable));
    const keepIds = new Set(loadedBars.filter(b => {
      const cb = document.getElementById(`keep_bar_${b.id}`);
      return cb && cb.checked;
    }).map(b => b.id));
    const defaults = defaultBars();
    newBars = defaults.map(db => {
      const existing = bars.find(b => b.id === db.id);
      return keepIds.has(db.id) && existing ? { ...existing } : db;
    });
  }
  setBars(newBars);
  setShowConfig({ maxFlymen: 1, customDeads: {}, barDefaults: {}, cues: [] });
  setActiveShowName(name);
  saveLocal('tbtl_last_show_v1', name);
  saveLocal('tbtl_showconfig_v1', showConfig);
  shows[name] = {
    bars: JSON.parse(JSON.stringify(bars)),
    showConfig: JSON.parse(JSON.stringify(showConfig)),
    savedAt: new Date().toISOString()
  };
  saveLocal('tbtl_shows_v1', shows);
  logHistory(`Created new show "${name}"`);
  try {
    setSyncStatus('syncing', 'Creating show...');
    await firebasePut('shows', shows);
    setSyncStatus('online', `Show "${name}" created · ${new Date().toLocaleTimeString()}`);
  } catch(e) {
    setSyncStatus('offline', `Show saved locally (Firebase offline)`);
  }
  closeNewShowModal();
  setExpanded({});
  scheduleSave();
  import('./main.js').then(({ render }) => render());
  renderShows();
}

export function renderShows() {
  const container = document.getElementById('shows-container');
  if (!container) return;

  const showNames = Object.keys(shows).sort((a, b) => {
    const ta = shows[a].savedAt || '';
    const tb = shows[b].savedAt || '';
    return tb.localeCompare(ta);
  });

  const countEl = document.getElementById('shows-count');
  if (countEl) countEl.textContent = showNames.length > 0 ? `${showNames.length} saved` : '';

  const activeEl = document.getElementById('active-show-display');
  if (activeEl) {
    activeEl.innerHTML = activeShowName
      ? `<span class="active-show-badge">Loaded: ${esc(activeShowName)}</span>`
      : '';
  }

  const listHtml = showNames.length === 0
    ? '<div class="shows-empty">No shows saved yet — save the current rig to get started</div>'
    : showNames.map((name, idx) => {
        const show = shows[name];
        const savedAt = show.savedAt ? new Date(show.savedAt).toLocaleString('en-GB', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '';
        const loadedCount = show.bars ? show.bars.filter(b => (b.fixtures||[]).reduce((s,f) => s + f.weight*f.qty, 0) + (b.extensions ? 12 : 0) > 0).length : 0;
        const isActive = activeShowName === name;
        const backups = show.backups || [];
        const backupDropdown = backups.length > 0
          ? `<div id="show-backups-${idx}" style="display:none;background:#0a0f1a;border:1px solid #1e3a5f;border-radius:6px;padding:4px 0;margin:2px 0 4px;grid-column:1/-1">
              <div style="padding:4px 10px 3px;font-size:10px;color:#475569;font-weight:700;text-transform:uppercase;letter-spacing:0.06em">Backups — click to restore</div>
              ${backups.map((b, bi) => {
                const bDate = new Date(b.savedAt).toLocaleString('en-GB', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
                return `<div onclick="loadBackup(${escAttr(name)},${bi})"
                  style="padding:5px 10px;font-size:12px;color:#93c5fd;cursor:pointer;border-top:1px solid #1e293b"
                  onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background=''">${bDate}</div>`;
              }).join('')}
            </div>`
          : '';
        const backupBtn = backups.length > 0
          ? `<button onclick="toggleBackupsList(${idx})" title="${backups.length} backup${backups.length!==1?'s':''}"
              style="background:#1e3a5f;color:#60a5fa;border:1px solid #3b82f644;border-radius:6px;padding:4px 7px;font-size:11px;cursor:pointer;line-height:1">▾</button>`
          : '';
        return `
          <div class="show-item">
            <span class="show-item-name">${esc(name)}${isActive ? ' <span style="color:#22c55e;font-size:10px;font-weight:700">● active</span>' : ''}</span>
            <span class="show-item-meta">${loadedCount} bar${loadedCount !== 1 ? 's' : ''} loaded · ${savedAt}</span>
            <div style="display:flex;gap:4px;align-items:center">
              <button class="btn-show-load" onclick="loadShow(${escAttr(name)})">Load</button>
              ${backupBtn}
            </div>
            <button class="btn-lib-edit" onclick="openNamesEditor(${escAttr(name)})">Edit Names</button>
            <button class="btn-show-override" onclick="overrideShow(${escAttr(name)})">Override</button>
            <button class="btn-show-del" onclick="deleteShow(${escAttr(name)})">Delete</button>
          </div>
          ${backupDropdown}
        `;
      }).join('');

  const updateBtn = activeShowName ? `
    <div class="shows-save-row" style="margin-bottom:6px">
      <span style="font-size:12px;color:#94a3b8;flex:1">Loaded: <strong style="color:#22c55e">${esc(activeShowName)}</strong></span>
      <button class="btn-update-show" onclick="saveShow(${escAttr(activeShowName)}, true)">
        ↑ Save to "${esc(activeShowName)}"
      </button>
    </div>
    <div style="border-top:1px solid #33415544;margin:4px 0 6px"></div>
  ` : '';

  container.innerHTML = `
    ${updateBtn}
    <div class="shows-save-row">
      <button class="btn-add" onclick="openNewShowModal()" style="padding:7px 18px;font-size:13px">➕ New Show</button>
    </div>
    <div class="shows-list">${listHtml}</div>
  `;
}
