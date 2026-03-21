import { FIREBASE_URL } from './constants.js';
import { saveLocal } from './storage.js';
import {
  bars, library, flypositions, historyLog, shows,
  setBars, setLibrary, setFlypositions, setHistoryLog, setShows,
  normaliseBar, mergeDefaultsIntoLibrary, applyAutoFlags,
  saveTimeout, setSaveTimeout, showConfig, activeShowName
} from './state.js';

export function setSyncStatus(status, msg) {
  const dot = document.getElementById('sync-dot');
  const text = document.getElementById('sync-text');
  if (!dot || !text) return;
  dot.className = `sync-dot ${status}`;
  text.textContent = msg;
}

export async function firebaseGet(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${FIREBASE_URL}/${path}.json`, { signal: controller.signal });
    if (!res.ok) throw new Error(`GET /${path} → HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function firebasePut(path, data) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json`, {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`PUT /${path} → HTTP ${res.status}`);
  return await res.json();
}

export async function loadFromFirebase() {
  try {
    setSyncStatus('syncing', 'Loading from Firebase...');
    const [fbBars, fbLib, fbPos, fbHistory, fbUsers] = await Promise.all([
      firebaseGet('bars'),
      firebaseGet('library'),
      firebaseGet('positions'),
      firebaseGet('history'),
      firebaseGet('users'),
    ]);
    if (fbBars && Array.isArray(fbBars)) {
      setBars(fbBars.map(normaliseBar));
      applyAutoFlags();
      saveLocal('tbtl_bars_v3', bars);
    }
    if (fbLib && Array.isArray(fbLib)) {
      setLibrary(mergeDefaultsIntoLibrary(fbLib));
      saveLocal('tbtl_lib_v3', library);
    }
    if (fbPos && Array.isArray(fbPos) && fbPos.length > 0) {
      setFlypositions(fbPos);
      saveLocal('tbtl_positions_v1', flypositions);
    }
    if (fbHistory && Array.isArray(fbHistory) && fbHistory.length > 0) {
      setHistoryLog(fbHistory);
      saveLocal('tbtl_history_v1', historyLog);
    }
    if (fbUsers && Array.isArray(fbUsers) && fbUsers.length > 0) {
      const { setUsers } = await import('./users.js');
      setUsers(fbUsers);
    }
    setSyncStatus('online', `Synced · ${new Date().toLocaleTimeString()}`);
  } catch(e) {
    console.error('[Firebase load error]', e);
    setSyncStatus('offline', `Offline: ${e.message}`);
  }
  const { render } = await import('./main.js');
  render();
  try {
    const fbShows = await firebaseGet('shows');
    if (fbShows && typeof fbShows === 'object' && !Array.isArray(fbShows)) {
      setShows(fbShows);
      saveLocal('tbtl_shows_v1', shows);
    }
  } catch(e) { console.warn('[Firebase shows load]', e); }
  const { renderShows } = await import('./shows.js');
  renderShows();
}

export async function saveToFirebase() {
  try {
    setSyncStatus('syncing', 'Saving...');
    const { users } = await import('./users.js');
    await Promise.all([
      firebasePut('bars', bars),
      firebasePut('library', library),
      firebasePut('positions', flypositions),
      firebasePut('history', historyLog),
      firebasePut('users', users),
    ]);
    saveLocal('tbtl_bars_v3', bars);
    saveLocal('tbtl_lib_v3', library);
    saveLocal('tbtl_positions_v1', flypositions);
    saveLocal('tbtl_history_v1', historyLog);
    saveLocal('tbtl_users_v1', users);
    setSaveTimeout(null);
    setSyncStatus('online', `Saved · ${new Date().toLocaleTimeString()}`);
  } catch(e) {
    console.error('[Firebase save error]', e);
    setSyncStatus('offline', `Save failed: ${e.message}`);
  }
}

export function scheduleSave() {
  // regeneratePreshowSilent is called lazily to avoid circular init
  import('./show-page.js').then(({ regeneratePreshowSilent }) => {
    regeneratePreshowSilent();
    saveLocal('tbtl_bars_v3', bars);
    saveLocal('tbtl_lib_v3', library);
    saveLocal('tbtl_showconfig_v1', showConfig);
    if (activeShowName) {
      shows[activeShowName] = {
        bars: JSON.parse(JSON.stringify(bars)),
        showConfig: JSON.parse(JSON.stringify(showConfig)),
        savedAt: new Date().toISOString()
      };
      saveLocal('tbtl_shows_v1', shows);
    }
    clearTimeout(saveTimeout);
    setSaveTimeout(setTimeout(saveToFirebase, 1500));
  });
}

export function forceSave() {
  clearTimeout(saveTimeout);
  if (activeShowName) {
    import('./shows.js').then(({ saveShow }) => saveShow(activeShowName, true));
  } else {
    saveToFirebase();
  }
}
