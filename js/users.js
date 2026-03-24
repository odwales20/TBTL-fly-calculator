import { DEFAULT_USERS } from './constants.js';
import { loadLocal, saveLocal } from './storage.js';
import {
  currentUser, _setCurrentUser,
  editMode, setEditMode,
  historyLog, setHistoryLog
} from './state.js';
import { esc } from './render-bars.js';
import { firebasePut } from './firebase.js';

export let users = loadLocal('tbtl_users_v1', DEFAULT_USERS);

export function setUsers(v) { users = v; saveLocal('tbtl_users_v1', users); }

export function saveUsers() {
  saveLocal('tbtl_users_v1', users);
  firebasePut('users', users).catch(e => console.warn('[Firebase users]', e));
}

export function getCurrentUser() {
  if (!currentUser) return null;
  return users.find(u => u.name === currentUser) || null;
}

export function isAdminUser() { const u = getCurrentUser(); return u && u.isAdmin; }
export function canViewHistoryAccess() { const u = getCurrentUser(); return u && u.canViewHistory; }

export function requireEdit() {
  if (!editMode) return false;
  const u = getCurrentUser();
  if (u && !u.canEdit) { alert(`${currentUser} does not have edit permissions.`); return false; }
  return true;
}

export function setCurrentUser(name) {
  _setCurrentUser(name || null);
  saveLocal('tbtl_current_user_v1', currentUser);
  renderUserBar();
}

export function toggleEditMode() {
  setEditMode(!editMode);
  renderUserBar();
  const banner = document.getElementById('view-mode-banner');
  if (banner) banner.className = 'view-mode-banner' + (editMode ? '' : ' active');
}

export function renderUserBar() {
  const bar = document.getElementById('user-bar');
  if (!bar) return;
  const u = getCurrentUser();
  const userOpts = ['<option value="">— Select user —</option>',
    ...users.map(usr => `<option value="${esc(usr.name)}" ${currentUser === usr.name ? 'selected' : ''}>${esc(usr.name)}</option>`)
  ].join('');
  const editClass = editMode ? 'edit' : 'view';
  const editLabel = editMode ? '✏ EDIT MODE' : '👁 VIEW ONLY';
  bar.innerHTML = `
    <span class="user-bar-label">Working as:</span>
    <select class="user-select" id="user-selector" onchange="setCurrentUser(this.value)">${userOpts}</select>
    ${u && u.isAdmin ? `<button onclick="openManageUsersModal()"
      style="background:#1e3a5f;color:#60a5fa;border:1px solid #3b82f644;border-radius:5px;padding:4px 10px;font-size:11px;cursor:pointer;font-weight:600">⚙ Manage Users</button>` : ''}
    <button class="edit-toggle-btn ${editClass}" id="edit-toggle-btn" onclick="toggleEditMode()">${editLabel}</button>
  `;
}

export function openManageUsersModal() {
  if (!isAdminUser()) return;
  const modal = document.getElementById('manage-users-modal');
  const inner = document.getElementById('manage-users-modal-inner');
  if (!modal || !inner) return;
  const rows = users.map((u, i) => {
    const protect = u.isAdmin;
    return `<div class="user-row">
      <span class="user-row-name">${esc(u.name)}${u.isAdmin ? ' <span style="font-size:10px;color:#f59e0b;font-weight:700">★ Admin</span>' : ''}</span>
      <label class="perm-label">
        <input type="checkbox" ${u.canEdit ? 'checked' : ''} ${protect ? 'disabled' : ''}
          onchange="setUserPerm(${i},'canEdit',this.checked)" style="accent-color:#3b82f6">
        Can Edit
      </label>
      <label class="perm-label">
        <input type="checkbox" ${u.canViewHistory ? 'checked' : ''} ${protect ? 'disabled' : ''}
          onchange="setUserPerm(${i},'canViewHistory',this.checked)" style="accent-color:#a855f7">
        History
      </label>
      ${!protect ? `<button onclick="removeUser(${i})"
        style="background:none;color:#ef4444;border:1px solid #ef444433;border-radius:5px;padding:2px 8px;font-size:11px;cursor:pointer">Remove</button>` : ''}
    </div>`;
  }).join('');
  inner.innerHTML = `
    <div class="modal-title">⚙ Manage Users <button class="modal-close" onclick="closeManageUsersModal()">✕</button></div>
    <div style="font-size:11px;color:#475569;margin-bottom:8px">Permissions apply when that user is selected. Admin can always access everything.</div>
    ${rows}
    <div class="modal-section">Add new user</div>
    <div style="display:flex;gap:6px;align-items:center">
      <input id="new-user-name" placeholder="Name…"
        style="background:#0f172a;border:1px solid #334155;border-radius:6px;color:#e2e8f0;padding:6px 10px;font-size:13px;outline:none;flex:1"
        onkeydown="if(event.key==='Enter')addUser()">
      <button onclick="addUser()" class="btn-add" style="padding:6px 12px;font-size:12px">+ Add</button>
    </div>
  `;
  modal.style.display = 'block';
}

export function closeManageUsersModal() {
  const m = document.getElementById('manage-users-modal');
  if (m) m.style.display = 'none';
}

export function setUserPerm(idx, perm, val) {
  if (!isAdminUser()) return;
  users[idx][perm] = val;
  saveUsers();
  openManageUsersModal();
}

export function addUser() {
  if (!isAdminUser()) return;
  const inp = document.getElementById('new-user-name');
  const name = (inp ? inp.value : '').trim();
  if (!name) return;
  if (users.some(u => u.name.toLowerCase() === name.toLowerCase())) { alert('A user with that name already exists.'); return; }
  users.push({ name, canEdit: true, isAdmin: false, canViewHistory: false });
  users.sort((a, b) => a.name.localeCompare(b.name));
  saveUsers();
  import('./bar-actions.js').then(m => m.logHistory(`Added user "${name}"`));
  openManageUsersModal();
  renderUserBar();
}

export function removeUser(idx) {
  if (!isAdminUser()) return;
  const u = users[idx];
  if (u.isAdmin) { alert('Cannot remove the admin user.'); return; }
  if (!confirm(`Remove user "${u.name}"?`)) return;
  if (currentUser === u.name) { _setCurrentUser(null); saveLocal('tbtl_current_user_v1', null); }
  users.splice(idx, 1);
  saveUsers();
  openManageUsersModal();
  renderUserBar();
}

export function renderHistoryPage() {
  const container = document.getElementById('history-container');
  if (!container) return;
  if (!canViewHistoryAccess()) {
    container.innerHTML = `<div style="text-align:center;padding:40px 0;color:#475569">
      <div style="font-size:40px;margin-bottom:12px">🔒</div>
      <div style="font-size:14px">History access is restricted to admin users.</div>
    </div>`;
    return;
  }
  if (historyLog.length === 0) {
    container.innerHTML = '<div style="color:#475569;font-size:13px;margin-top:20px;text-align:center">No history recorded yet.</div>';
    return;
  }
  const rows = historyLog.map(entry => {
    const dt = new Date(entry.timestamp).toLocaleString('en-GB', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    return `<div class="history-entry">
      <span class="history-user">${esc(entry.user)}</span>
      <span class="history-action">${esc(entry.action)}</span>
      <span class="history-time">${dt}</span>
    </div>`;
  }).join('');
  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <h2 style="font-size:16px;font-weight:800;color:#f1f5f9;flex:1">History</h2>
      <button onclick="clearHistory()"
        style="background:none;color:#ef4444;border:1px solid #ef444433;border-radius:5px;padding:4px 10px;font-size:11px;cursor:pointer">Clear History</button>
    </div>
    <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;overflow:hidden">${rows}</div>
    <div style="font-size:11px;color:#475569;margin-top:8px">${historyLog.length} entr${historyLog.length !== 1 ? 'ies' : 'y'}</div>
  `;
}

export function clearHistory() {
  if (!isAdminUser()) return;
  if (!confirm('Clear all history? This cannot be undone.')) return;
  setHistoryLog([]);
  saveLocal('tbtl_history_v1', []);
  firebasePut('history', []).catch(e => console.warn('[Firebase history]', e));
  renderHistoryPage();
}
