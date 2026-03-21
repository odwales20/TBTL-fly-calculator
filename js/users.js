/**
 * users.js — User data, permissions, and persistence.
 *
 * Owns the `users` array and all read/write operations on it.
 * Persists to both localStorage (for offline use) and Firebase (for
 * cross-device sync).  Firebase errors are non-fatal — they are
 * swallowed with a console warning so the app keeps working offline.
 */

import { DEFAULT_USERS } from './constants.js';
import { loadLocal, saveLocal } from './storage.js';
import { firebasePut } from './firebase.js';

export let users = loadLocal('tbtl_users_v1', DEFAULT_USERS);

/**
 * Persist the current `users` array to localStorage and Firebase.
 * Firebase writes are best-effort: failures are logged but not re-thrown.
 */
export function saveUsers() {
  saveLocal('tbtl_users_v1', users);
  firebasePut('users', users).catch(e => console.warn('[Firebase users]', e));
}

/**
 * Set a permission flag on a user by index.
 * Requires admin privileges (caller must check before invoking).
 */
export function setUserPerm(idx, perm, val) {
  users[idx][perm] = val;
  saveUsers();
}

/**
 * Add a new user (sorted alphabetically) and persist.
 * Returns false without mutating if name is blank or already taken.
 */
export function addUser(name) {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (users.some(u => u.name.toLowerCase() === trimmed.toLowerCase())) return false;
  users.push({ name: trimmed, canEdit: true, isAdmin: false, canViewHistory: false });
  users.sort((a, b) => a.name.localeCompare(b.name));
  saveUsers();
  return true;
}

/**
 * Remove a user by index and persist.
 * Returns the removed user, or null if removal was refused (admin users
 * cannot be removed).
 */
export function removeUser(idx) {
  const u = users[idx];
  if (!u || u.isAdmin) return null;
  users.splice(idx, 1);
  saveUsers();
  return u;
}

/**
 * Replace the entire users array (e.g. after loading from Firebase)
 * and persist to localStorage only — no redundant Firebase write needed
 * because we're receiving data FROM Firebase here.
 */
export function setUsers(newUsers) {
  users = newUsers;
  saveLocal('tbtl_users_v1', users);
}
