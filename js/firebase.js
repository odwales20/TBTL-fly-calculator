/**
 * firebase.js — Firebase Realtime Database helpers and initial data load.
 *
 * Provides low-level firebaseGet / firebasePut utilities and the
 * loadFromFirebase / saveToFirebase orchestration functions.
 *
 * Users are fetched here along with all other data (cross-device sync
 * requirement), but ownership of the `users` array and its persistence
 * lives in users.js.  After fetching, we call setUsers() so users.js
 * stays the single source of truth.
 */

import { saveLocal } from './storage.js';
import { setUsers } from './users.js';

const FIREBASE_URL = 'https://tbtl-fly-calc-default-rtdb.firebaseio.com';

// ── Low-level helpers ─────────────────────────────────────────────────────────

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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`PUT /${path} → HTTP ${res.status}`);
  return await res.json();
}

// ── Orchestration ─────────────────────────────────────────────────────────────

/**
 * Load all shared data from Firebase in parallel.
 *
 * Users are always fetched so that additions/changes made on another
 * device are picked up on load.  The `if (fbUsers ...)` block delegates
 * to setUsers() in users.js, which saves to localStorage and updates the
 * in-memory array — no separate firebasePut is issued (we just read here).
 *
 * @param {object} ctx  - App context passed in by the caller.
 *   ctx.bars            mutable ref — replaced on success
 *   ctx.library         mutable ref — replaced on success
 *   ctx.flypositions    mutable ref — replaced on success
 *   ctx.historyLog      mutable ref — replaced on success
 *   ctx.shows           mutable ref — replaced on success
 *   ctx.normaliseBar    function(bar) → bar
 *   ctx.mergeDefaultsIntoLibrary  function(lib) → lib
 *   ctx.applyAutoFlags  function()
 *   ctx.setSyncStatus   function(status, msg)
 *   ctx.render          function()
 *   ctx.renderShows     function()
 */
export async function loadFromFirebase(ctx) {
  const {
    setSyncStatus, normaliseBar, mergeDefaultsIntoLibrary, applyAutoFlags,
    render, renderShows,
  } = ctx;

  try {
    setSyncStatus('syncing', 'Loading from Firebase...');

    const [fbBars, fbLib, fbPos, fbHistory, fbUsers] = await Promise.all([
      firebaseGet('bars'),
      firebaseGet('library'),
      firebaseGet('positions'),
      firebaseGet('history'),
      firebaseGet('users'),       // users fetched for cross-device sync
    ]);

    if (fbBars && Array.isArray(fbBars)) {
      ctx.bars = fbBars.map(normaliseBar);
      applyAutoFlags();
      saveLocal('tbtl_bars_v3', ctx.bars);
    }
    if (fbLib && Array.isArray(fbLib)) {
      ctx.library = mergeDefaultsIntoLibrary(fbLib);
      saveLocal('tbtl_lib_v3', ctx.library);
    }
    if (fbPos && Array.isArray(fbPos) && fbPos.length > 0) {
      ctx.flypositions = fbPos;
      saveLocal('tbtl_positions_v1', ctx.flypositions);
    }
    if (fbHistory && Array.isArray(fbHistory) && fbHistory.length > 0) {
      ctx.historyLog = fbHistory;
      saveLocal('tbtl_history_v1', ctx.historyLog);
    }
    // users.js owns user persistence — delegate via setUsers()
    if (fbUsers && Array.isArray(fbUsers) && fbUsers.length > 0) {
      setUsers(fbUsers);
    }

    setSyncStatus('online', `Synced · ${new Date().toLocaleTimeString()}`);
  } catch (e) {
    console.error('[Firebase load error]', e);
    setSyncStatus('offline', `Offline: ${e.message}`);
  }

  render();

  // Shows are loaded separately so a failure here never breaks the main sync.
  try {
    const fbShows = await firebaseGet('shows');
    if (fbShows && typeof fbShows === 'object' && !Array.isArray(fbShows)) {
      ctx.shows = fbShows;
      saveLocal('tbtl_shows_v1', ctx.shows);
    }
  } catch (e) {
    console.warn('[Firebase shows load]', e);
  }

  renderShows();
}

/**
 * Persist all shared data to Firebase in parallel.
 * Users are written via firebasePut directly here (bulk save button path),
 * separate from the incremental saveUsers() used by users.js mutations.
 */
export async function saveToFirebase(ctx) {
  const { setSyncStatus } = ctx;
  try {
    setSyncStatus('syncing', 'Saving...');
    await Promise.all([
      firebasePut('bars',      ctx.bars),
      firebasePut('library',   ctx.library),
      firebasePut('positions', ctx.flypositions),
      firebasePut('history',   ctx.historyLog),
      firebasePut('users',     ctx.users),
    ]);
    saveLocal('tbtl_bars_v3',       ctx.bars);
    saveLocal('tbtl_lib_v3',        ctx.library);
    saveLocal('tbtl_positions_v1',  ctx.flypositions);
    saveLocal('tbtl_history_v1',    ctx.historyLog);
    saveLocal('tbtl_users_v1',      ctx.users);
    ctx.saveTimeout = null; // clears beforeunload warning
    setSyncStatus('online', `Saved · ${new Date().toLocaleTimeString()}`);
  } catch (e) {
    console.error('[Firebase save error]', e);
    setSyncStatus('offline', `Save failed: ${e.message}`);
  }
}
