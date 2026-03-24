import { CAT_COLOURS } from './constants.js';
import { library, bars, setLibrary } from './state.js';
import { saveLocal } from './storage.js';
import { scheduleSave } from './firebase.js';
import { esc, escAttr } from './render-bars.js';
import { hungLoad } from './bar-actions.js';

export let editingLibItem = null;
export function setEditingLibItem(v) { editingLibItem = v; }

export function catPill(cat) {
  if (!cat) return '<span style="color:#475569">—</span>';
  const c = CAT_COLOURS[cat] || '#64748b';
  return `<span class="lib-cat-pill" style="background:${c}22;color:${c}">${esc(cat)}</span>`;
}

export function startLibEdit(name) {
  editingLibItem = name;
  renderLibraryPage();
}
export function cancelLibEdit() {
  editingLibItem = null;
  renderLibraryPage();
}
export function saveLibEdit(oldName) {
  const newName = document.getElementById('ledit_name').value.trim();
  const newWeight = parseFloat(document.getElementById('ledit_weight').value);
  const newCat = document.getElementById('ledit_cat').value;
  const newExcl = document.getElementById('ledit_excl').checked;
  const newDefaultDead = document.getElementById('ledit_defaultdead')?.value || null;
  if (!newName || isNaN(newWeight) || newWeight <= 0) {
    const wi = document.getElementById('ledit_weight');
    if (wi) { wi.style.borderColor = '#ef4444'; setTimeout(() => wi.style.borderColor = '#3b82f6', 1500); }
    return;
  }
  const idx = library.findIndex(f => f.name === oldName);
  if (idx === -1) return;
  library[idx] = {name: newName, weight: newWeight, category: newCat, exclusive: newExcl, defaultDead: newDefaultDead || null};
  bars.forEach(bar => bar.fixtures.forEach(f => {
    if (f.name === oldName) { f.name = newName; f.weight = newWeight; f.category = newCat; f.exclusive = newExcl; }
  }));
  editingLibItem = null;
  scheduleSave();
  import('./main.js').then(({ render }) => render());
  renderLibraryPage();
}
export function deleteLibItem(name) {
  if (!confirm(`Remove "${name}" from the library? It won't affect bars already using it.`)) return;
  setLibrary(library.filter(f => f.name !== name));
  scheduleSave();
  renderLibraryPage();
}
export function addLibItem() {
  const name = document.getElementById('lnew_name').value.trim();
  const weight = parseFloat(document.getElementById('lnew_weight').value);
  const cat = document.getElementById('lnew_cat').value;
  const excl = document.getElementById('lnew_excl').checked;
  const defDead = document.getElementById('lnew_defaultdead')?.value || null;
  if (!name || isNaN(weight) || weight <= 0) {
    const el = document.getElementById('lnew_name');
    if (el) { el.style.borderColor='#ef4444'; setTimeout(()=>el.style.borderColor='#334155',1500); }
    return;
  }
  if (library.some(f => f.name.toLowerCase() === name.toLowerCase())) {
    alert(`"${name}" already exists in the library.`);
    return;
  }
  library.push({name, weight, category: cat, exclusive: excl, defaultDead: defDead || null});
  scheduleSave();
  document.getElementById('lnew_name').value = '';
  document.getElementById('lnew_weight').value = '';
  document.getElementById('lnew_bricks').value = '';
  document.getElementById('lnew_cat').value = '';
  document.getElementById('lnew_excl').checked = false;
  const dd = document.getElementById('lnew_defaultdead'); if (dd) dd.value = '';
  renderLibraryPage();
}

export function renderLibraryPage() {
  const catOrder = ['Lighting', 'Sound', 'Set', 'Drapes', 'Other'];
  const sortedLib = [...library].sort((a, b) => {
    const ci = x => { const i = catOrder.indexOf(x.category||'Other'); return i===-1?catOrder.length:i; };
    const cd = ci(a) - ci(b);
    if (cd !== 0) return cd;
    return a.name.localeCompare(b.name);
  });

  const catInputs = ['Lighting','Sound','Set','Drapes'].map(c => `<option value="${c}">${c}</option>`).join('');

  const rows = sortedLib.map(f => {
    if (editingLibItem === f.name) {
      const catOpts = ['','Lighting','Sound','Set','Drapes'].map(c =>
        `<option value="${c}" ${(f.category||'')=== c?'selected':''}>${c||'— none —'}</option>`
      ).join('');
      return `<tr style="background:#1e293b">
        <td><input class="lib-edit-inp" id="ledit_name" value="${esc(f.name)}" style="width:100%;min-width:120px"></td>
        <td><select class="lib-edit-inp" id="ledit_cat" style="width:100px">${catOpts}</select></td>
        <td class="r">
          <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end;flex-wrap:wrap">
            <input class="lib-edit-inp" id="ledit_weight" type="number" step="0.1" value="${f.weight}" style="width:60px"
              oninput="const b=document.getElementById('ledit_bricks');if(b)b.value=(parseFloat(this.value)/6).toFixed(2)"> kg
            <span style="color:#475569">/</span>
            <input class="lib-edit-inp" id="ledit_bricks" type="number" step="0.5" value="${(f.weight/6).toFixed(2)}" style="width:55px"
              oninput="const w=document.getElementById('ledit_weight');if(w)w.value=(parseFloat(this.value)*6).toFixed(1)"> br
          </div>
        </td>
        <td style="text-align:center"><input type="checkbox" id="ledit_excl" ${f.exclusive?'checked':''} style="accent-color:#f59e0b;width:16px;height:16px"></td>
        <td style="text-align:center">
          <select id="ledit_defaultdead" class="lib-edit-inp" style="width:80px;font-size:11px">
            <option value="" ${!f.defaultDead?'selected':''}>Auto</option>
            <option value="in" ${f.defaultDead==='in'?'selected':''}>→ In</option>
            <option value="out" ${f.defaultDead==='out'?'selected':''}>→ Out</option>
          </select>
        </td>
        <td style="white-space:nowrap;display:flex;gap:4px;padding:7px 8px">
          <button class="btn-lib-save" onclick="saveLibEdit(${escAttr(f.name)})">Save</button>
          <button class="btn-lib-cancel" onclick="cancelLibEdit()">Cancel</button>
        </td>
      </tr>`;
    }
    const deadBadge = f.defaultDead === 'in'
      ? `<span style="font-size:10px;background:#1e3a5f;color:#7dd3fc;border:1px solid #3b82f644;border-radius:3px;padding:1px 6px;font-weight:700">→ In</span>`
      : f.defaultDead === 'out'
        ? `<span style="font-size:10px;background:#1e293b;color:#94a3b8;border:1px solid #47556944;border-radius:3px;padding:1px 6px;font-weight:700">→ Out</span>`
        : `<span style="color:#334155;font-size:11px">—</span>`;
    return `<tr>
      <td style="font-weight:600">${esc(f.name)}${f.exclusive?` <span style="font-size:10px;color:#f59e0b">⚠ exclusive</span>`:''}</td>
      <td>${catPill(f.category)}</td>
      <td class="r" style="color:#fbbf24;font-weight:700">${f.weight} kg</td>
      <td style="text-align:center;color:${f.exclusive?'#f59e0b':'#334155'}">${f.exclusive?'✓':'—'}</td>
      <td style="text-align:center">${deadBadge}</td>
      <td style="white-space:nowrap;display:flex;gap:4px;padding:7px 8px">
        <button class="btn-lib-edit" onclick="startLibEdit(${escAttr(f.name)})">Edit</button>
        <button class="btn-lib-del" onclick="deleteLibItem(${escAttr(f.name)})">Delete</button>
      </td>
    </tr>`;
  }).join('');

  document.getElementById('library-container').innerHTML = `
    <div class="lib-add-box">
      <div class="lib-add-title">Add new item to library</div>
      <div class="add-row">
        <input class="inp-name lib-edit-inp" id="lnew_name" placeholder="Name" style="flex:1;min-width:130px">
        <select class="lib-edit-inp" id="lnew_cat" style="width:110px">
          <option value="">Category…</option>
          ${catInputs}
        </select>
        <input class="lib-edit-inp" id="lnew_weight" type="number" step="0.1" placeholder="kg" style="width:65px"
          oninput="const b=document.getElementById('lnew_bricks');if(b)b.value=(parseFloat(this.value)/6).toFixed(2)">
        <input class="lib-edit-inp" id="lnew_bricks" type="number" step="0.5" placeholder="bricks" style="width:65px"
          oninput="const w=document.getElementById('lnew_weight');if(w)w.value=(parseFloat(this.value)*6).toFixed(1)">
        <label style="display:flex;align-items:center;gap:5px;font-size:12px;color:#f59e0b;cursor:pointer;white-space:nowrap">
          <input type="checkbox" id="lnew_excl" style="accent-color:#f59e0b"> Exclusive
        </label>
        <select id="lnew_defaultdead" class="lib-edit-inp" style="width:90px;font-size:11px" title="Default preshow dead position">
          <option value="">Dead: Auto</option>
          <option value="in">Dead: → In</option>
          <option value="out">Dead: → Out</option>
        </select>
        <button class="btn-add" onclick="addLibItem()">+ Add</button>
      </div>
    </div>
    <table class="lib-table">
      <thead><tr>
        <th>Name</th><th>Category</th><th class="r">Weight</th><th style="text-align:center">Excl.</th><th style="text-align:center">Default Dead</th><th>Actions</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="font-size:11px;color:#475569;margin-top:8px">${library.length} items in library</div>
  `;
}

export function renderInventoryPage() {
  const map = {};
  bars.forEach(bar => {
    (bar.fixtures || []).forEach(f => {
      if (!map[f.name]) {
        map[f.name] = { weight: f.weight, category: f.category || 'Other', totalQty: 0, totalHungKg: 0, barIds: [] };
      }
      map[f.name].totalQty += f.qty;
      map[f.name].totalHungKg += f.weight * f.qty;
      map[f.name].barIds.push({ id: bar.id, qty: f.qty });
    });
  });

  const catOrder = ['Lighting', 'Sound', 'Set', 'Drapes', 'Other'];
  const entries = Object.entries(map).sort((a, b) => {
    const ci = x => { const i = catOrder.indexOf(x); return i === -1 ? catOrder.length : i; };
    const cd = ci(a[1].category) - ci(b[1].category);
    return cd !== 0 ? cd : b[1].totalQty - a[1].totalQty;
  });

  if (entries.length === 0) {
    document.getElementById('inventory-container').innerHTML = `
      <div style="color:#475569;font-size:13px;margin-top:20px;text-align:center">
        No fixtures added to any bar yet.
      </div>`;
    return;
  }

  const grandQty = entries.reduce((s, [, v]) => s + v.totalQty, 0);
  const grandKg  = entries.reduce((s, [, v]) => s + v.totalHungKg, 0);

  const rows = entries.map(([name, v]) => {
    const c = CAT_COLOURS[v.category] || '#64748b';
    const barList = v.barIds.map(b => `Bar ${b.id}${b.qty > 1 ? ` ×${b.qty}` : ''}`).join(', ');
    return `<tr>
      <td style="font-weight:600">${esc(name)}</td>
      <td><span class="lib-cat-pill" style="background:${c}22;color:${c}">${esc(v.category)}</span></td>
      <td class="r" style="color:#94a3b8">${v.weight} kg</td>
      <td class="r" style="color:#f1f5f9;font-weight:700;font-size:14px">${v.totalQty}</td>
      <td class="r" style="color:#fbbf24;font-weight:700">${v.totalHungKg.toFixed(1)} kg</td>
      <td style="color:#475569;font-size:11px">${barList}</td>
    </tr>`;
  }).join('');

  document.getElementById('inventory-container').innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <div class="card"><div class="card-label">Fixture Types</div><div class="card-value" style="color:#60a5fa">${entries.length}</div></div>
      <div class="card"><div class="card-label">Total Units</div><div class="card-value" style="color:#f1f5f9">${grandQty}</div></div>
      <div class="card"><div class="card-label">Total Weight</div><div class="card-value" style="color:#fbbf24">${grandKg.toFixed(1)} kg</div></div>
    </div>
    <table class="lib-table">
      <thead><tr>
        <th>Fixture</th><th>Category</th><th class="r">Unit kg</th>
        <th class="r">Total Units</th><th class="r">Total Weight</th><th>Bars</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="font-size:11px;color:#475569;margin-top:8px">${entries.length} fixture type${entries.length !== 1 ? 's' : ''} across all bars</div>
  `;
}
