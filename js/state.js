import { BAR_IDS, DEFAULT_FIXTURES, DEFAULT_POSITIONS, DEFAULT_USERS, IWB_COLOURS } from './constants.js';

export function loadLocal(key, def) {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; }
}
export function saveLocal(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch(e) {
    console.error('[storage] Failed to save', key, e);
    if (key !== 'tbtl_current_user_v1') {
      // Import setSyncStatus lazily to avoid circular init issues
      import('./firebase.js').then(m => m.setSyncStatus('offline', 'Local storage full — rely on Firebase sync'));
    }
  }
}

export function defaultBars() {
  return BAR_IDS.map(id => ({
    id, name: `Bar ${id}`, barWeight: 18, fixtures: [], extensions: false, iwb: null, cable: false, miscBricks: 0, dnf: false, note: '', preshowDead: null, notInUse: id === 1, liveFly: false
  }));
}

export function mergeDefaultsIntoLibrary(lib) {
  const names = new Set(lib.map(f => f.name.toLowerCase()));
  const toAdd = DEFAULT_FIXTURES.filter(f => !names.has(f.name.toLowerCase()));
  return toAdd.length > 0 ? [...lib, ...toAdd] : lib;
}

export function normaliseBar(b) {
  return {
    ...b,
    extensions:  b.extensions  || false,
    iwb:         (typeof b.iwb === 'string' && IWB_COLOURS.some(c => c.id === b.iwb)) ? b.iwb : null,
    cable:       b.cable       || false,
    fixtures:    b.fixtures    || [],
    miscBricks:  b.miscBricks  || 0,
    dnf:         b.dnf         || false,
    note:        b.note        || '',
    preshowDead: b.preshowDead || null,
    notInUse:    b.notInUse    || false,
    liveFly:     b.liveFly     || false,
  };
}

// State variables (exported as mutable references via object)
export let bars = loadLocal('tbtl_bars_v3', defaultBars()).map(normaliseBar);
export let library = mergeDefaultsIntoLibrary(loadLocal('tbtl_lib_v3', DEFAULT_FIXTURES));
export let shows = loadLocal('tbtl_shows_v1', {});
export let flypositions = loadLocal('tbtl_positions_v1', DEFAULT_POSITIONS);
export let showConfig = loadLocal('tbtl_showconfig_v1', { maxFlymen: 1, customDeads: {}, cues: [] });
export let activeShowName = loadLocal('tbtl_last_show_v1', null);
export let currentUser = loadLocal('tbtl_current_user_v1', null);
export let editMode = true;
export let historyLog = loadLocal('tbtl_history_v1', []);
export let showsPanelOpen = false;
export let expanded = {};
export let inputMode = {};
export let saveTimeout = null;
export let historyTimeout = null;
export let addingBarToCue = null;

// Setters for mutable state
export function setBars(v) { bars = v; }
export function setLibrary(v) { library = v; }
export function setShows(v) { shows = v; }
export function setFlypositions(v) { flypositions = v; }
export function setShowConfig(v) { showConfig = v; }
export function setActiveShowName(v) { activeShowName = v; }
export function setCurrentUser(name) {
  currentUser = name || null;
  saveLocal('tbtl_current_user_v1', currentUser);
  // renderUserBar called from users.js
  import('./users.js').then(m => m.renderUserBar());
}
export function setEditMode(v) { editMode = v; }
export function setHistoryLog(v) { historyLog = v; }
export function setShowsPanelOpen(v) { showsPanelOpen = v; }
export function setExpanded(v) { expanded = v; }
export function setSaveTimeout(v) { saveTimeout = v; }
export function setHistoryTimeout(v) { historyTimeout = v; }
export function setAddingBarToCue(v) { addingBarToCue = v; }

// ── Auto-flag helpers ─────────────────────────────────────────
export function recomputeLiveFlyTags() {
  const nonPreshowCues = (showConfig.cues || []).filter(c => !c.isPreshow);
  bars.forEach(bar => {
    bar.liveFly = nonPreshowCues.some(cue => (cue.bars || []).some(cb => cb.barId === bar.id));
  });
}

export function applyAutoFlags() {
  bars.forEach(bar => {
    const defaultName = `Bar ${bar.id}`;
    const nameIsEmpty = !bar.name || !bar.name.trim();
    const nameIsDefault = bar.name === defaultName;
    const hasEquipment = (bar.fixtures || []).length > 0 || bar.extensions || bar.iwb !== null || bar.cable || (bar.miscBricks || 0) !== 0;
    if (nameIsEmpty || (nameIsDefault && !hasEquipment)) bar.notInUse = true;
  });
  recomputeLiveFlyTags();
}

applyAutoFlags();
