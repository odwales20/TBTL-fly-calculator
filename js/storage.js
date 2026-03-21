/**
 * storage.js — localStorage helpers.
 *
 * Thin wrappers around localStorage so callers never have to deal with
 * JSON serialisation errors or the full-storage edge case themselves.
 */

/**
 * Read a JSON value from localStorage.
 * Returns `def` if the key is absent, empty, or the value cannot be parsed.
 */
export function loadLocal(key, def) {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : def;
  } catch {
    return def;
  }
}

/**
 * Write a JSON value to localStorage.
 * Logs a console error (and, for non-user keys, updates the sync status
 * banner) if storage is full.  The `setSyncStatus` callback is optional;
 * pass it in when the UI is available.
 *
 * @param {string}   key
 * @param {*}        val
 * @param {Function} [setSyncStatus]  - optional (status, msg) callback
 */
export function saveLocal(key, val, setSyncStatus) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error('[storage] Failed to save', key, e);
    if (key !== 'tbtl_current_user_v1' && typeof setSyncStatus === 'function') {
      setSyncStatus('offline', 'Local storage full — rely on Firebase sync');
    }
  }
}
