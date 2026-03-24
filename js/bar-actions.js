import { FULL, HALF, EXTENSIONS_WEIGHT, IWB_WEIGHT, CABLE_WEIGHT, IWB_COLOURS } from './constants.js';
import {
  bars, library, inputMode, expanded,
  setBars, setExpanded
} from './state.js';
import { saveLocal } from './storage.js';
import { scheduleSave } from './firebase.js';
import { requireEdit } from './users.js';

export function calcBricks(cw) {
  if (cw <= 0) return {full: 0};
  return {full: Math.round(cw / FULL)};
}

export function hungLoad(bar) {
  const fixtureLoad = (bar.fixtures || []).reduce((s,f) => s + f.weight * f.qty, 0);
  const conduitLoad = (bar.fixtures || []).filter(f => f.conduit).length * (FULL / 2);
  const miscLoad = (bar.miscBricks || 0) * FULL / 2;
  return fixtureLoad
    + conduitLoad
    + (bar.extensions ? EXTENSIONS_WEIGHT : 0)
    + (bar.iwb !== null ? IWB_WEIGHT : 0)
    + (bar.cable ? CABLE_WEIGHT : 0)
    + miscLoad;
}

export function cradleBricksToHungLoad(fullBricks, halfBricks) {
  return ((fullBricks * FULL) + (halfBricks * HALF)) / 2;
}

export function logHistory(action) {
  import('./users.js').then(({ getCurrentUser }) => {
    import('./state.js').then(({ currentUser, historyLog, setHistoryLog, historyTimeout, setHistoryTimeout }) => {
      if (!currentUser) return;
      historyLog.unshift({ user: currentUser, action, timestamp: new Date().toISOString() });
      if (historyLog.length > 200) setHistoryLog(historyLog.slice(0, 200));
      saveLocal('tbtl_history_v1', historyLog);
      clearTimeout(historyTimeout);
      import('./firebase.js').then(({ firebasePut }) => {
        setHistoryTimeout(setTimeout(() => firebasePut('history', historyLog).catch(e => console.warn('[Firebase history]', e)), 2000));
      });
    });
  });
}

function clearNotInUse(bar) {
  if (bar && bar.notInUse) { bar.notInUse = false; }
}

export function toggleNotInUse(barId) {
  if (!requireEdit()) return;
  const bar = bars.find(b => b.id === barId);
  if (!bar) return;
  bar.notInUse = !bar.notInUse;
  logHistory(`${bar.notInUse ? 'Marked' : 'Unmarked'} Bar ${barId} as not in use`);
  scheduleSave();
  import('./main.js').then(({ render }) => render());
}

export function toggleExtensions(barId) {
  if (!requireEdit()) return;
  const bar = bars.find(b => b.id === barId);
  if (!bar.extensions) clearNotInUse(bar);
  bar.extensions = !bar.extensions;
  logHistory(`${bar.extensions ? 'Added' : 'Removed'} extensions on Bar ${barId}`);
  scheduleSave();
  import('./main.js').then(({ render }) => render());
}

export function selectIWB(barId, colourId) {
  if (!requireEdit()) return;
  const bar = bars.find(b => b.id === barId);
  if (bar.iwb === colourId) {
    bar.iwb = null;
    logHistory(`Removed IWB from Bar ${barId}`);
    scheduleSave();
    import('./main.js').then(({ render }) => render());
    return;
  }
  const owner = bars.find(b => b.id !== barId && b.iwb === colourId);
  const col = IWB_COLOURS.find(c => c.id === colourId);
  if (owner) {
    if (!confirm(`Move ${col.label} IWB from Bar ${owner.id} to Bar ${barId}?`)) return;
    owner.iwb = null;
  }
  clearNotInUse(bar);
  bar.iwb = colourId;
  logHistory(`Assigned ${IWB_COLOURS.find(c=>c.id===colourId)?.label||colourId} IWB to Bar ${barId}`);
  scheduleSave();
  import('./main.js').then(({ render }) => render());
}

export function toggleCable(barId) {
  if (!requireEdit()) return;
  const bar = bars.find(b => b.id === barId);
  if (!bar.cable) clearNotInUse(bar);
  bar.cable = !bar.cable;
  logHistory(`${bar.cable ? 'Added' : 'Removed'} cable allowance on Bar ${barId}`);
  scheduleSave();
  import('./main.js').then(({ render }) => render());
}

export function toggleDNF(barId) {
  if (!requireEdit()) return;
  const bar = bars.find(b => b.id === barId);
  if (!confirm(bar.dnf ? `Remove DO NOT FLY tag from Bar ${barId}?` : `⛔ Mark Bar ${barId} as DO NOT FLY?\n\nThis is a safety tag — make sure it matches the physical tag on the bar.`)) return;
  bar.dnf = !bar.dnf;
  logHistory(`${bar.dnf ? 'Added' : 'Removed'} DO NOT FLY tag on Bar ${barId}`);
  scheduleSave();
  import('./main.js').then(({ render }) => render());
}

export function toggleConduit(barId, fixtureId) {
  if (!requireEdit()) return;
  const bar = bars.find(b => b.id === barId);
  const f = bar.fixtures.find(f => f.id === fixtureId);
  if (f) { f.conduit = !f.conduit; scheduleSave(); import('./main.js').then(({ render }) => render()); }
}

export function updateBarName(barId, val) {
  if (!requireEdit()) return;
  const bar = bars.find(b => b.id === barId);
  const name = val.trim();
  if (name) {
    bar.name = name;
  } else {
    bar.notInUse = true;
  }
  scheduleSave();
  import('./main.js').then(({ render }) => render());
}

export function getMode(barId) { return inputMode[barId] || 'kg'; }

export function updatePreview(barId) {
  const mode = getMode(barId);
  const preview = document.getElementById(`preview_${barId}`);
  if (!preview) return;
  if (mode === 'kg') {
    const kg = parseFloat(document.getElementById(`fweight_${barId}`)?.value);
    preview.innerHTML = (!isNaN(kg) && kg > 0) ? `= <strong>${kg.toFixed(1)} kg hung</strong>` : '';
  } else {
    const full = parseInt(document.getElementById(`fbfull_${barId}`)?.value) || 0;
    const half = parseInt(document.getElementById(`fbhalf_${barId}`)?.value) || 0;
    if (full > 0 || half > 0) {
      const hungKg = cradleBricksToHungLoad(full, half);
      const cradleKg = full * FULL + half * HALF;
      preview.innerHTML = `= <strong>${hungKg.toFixed(1)} kg hung</strong> <span style="color:#475569">(${cradleKg}kg cradle)</span>`;
    } else {
      preview.innerHTML = '';
    }
  }
}

export function addFixture(barId) {
  if (!requireEdit()) return;
  if (barId === 1) return;
  const bar = bars.find(b => b.id === barId);
  const name = document.getElementById(`fname_${barId}`).value.trim();
  const qty = parseInt(document.getElementById(`fqty_${barId}`).value) || 1;
  const mode = getMode(barId);
  let weight;
  if (mode === 'kg') {
    weight = parseFloat(document.getElementById(`fweight_${barId}`).value);
  } else {
    const full = parseInt(document.getElementById(`fbfull_${barId}`).value) || 0;
    const half = parseInt(document.getElementById(`fbhalf_${barId}`).value) || 0;
    weight = cradleBricksToHungLoad(full, half);
  }
  const category = document.getElementById(`fcat_${barId}`)?.value || '';
  const exclusive = document.getElementById(`fexclusive_${barId}`)?.checked || false;
  if (!name || isNaN(weight) || weight <= 0) {
    const ni = document.getElementById(`fname_${barId}`);
    if (ni) { ni.style.borderColor = '#ef4444'; setTimeout(() => ni.style.borderColor = '#334155', 1500); }
    return;
  }
  if (bar.fixtures.some(f => f.exclusive)) {
    alert(`"${bar.fixtures.find(f => f.exclusive).name}" occupies this entire bar. Remove it first if you need to replace it.`);
    return;
  }
  clearNotInUse(bar);
  bar.fixtures.push({id: Date.now(), name, weight, qty, category, exclusive, conduit: false});
  if (bar.preshowDead === null) {
    const libEntry = library.find(f => f.name.toLowerCase() === name.toLowerCase());
    if (libEntry && libEntry.defaultDead) bar.preshowDead = libEntry.defaultDead;
  }
  if (!library.some(f => f.name.toLowerCase() === name.toLowerCase())) {
    library.push({name, weight, category, exclusive});
  }
  logHistory(`Added ${qty > 1 ? `${qty}× ` : ''}${name} to Bar ${barId}`);
  scheduleSave();
  import('./main.js').then(({ render }) => render());
}

export function removeFixture(barId, fixId) {
  if (!requireEdit()) return;
  const bar = bars.find(b => b.id === barId);
  const fix = bar.fixtures.find(f => f.id === fixId);
  if (bar.fixtures.length === 1 && !confirm(`Remove ${fix.name}? This will leave Bar ${barId} empty.`)) return;
  if (fix) logHistory(`Removed ${fix.name} from Bar ${barId}`);
  bar.fixtures = bar.fixtures.filter(f => f.id !== fixId);
  scheduleSave();
  import('./main.js').then(({ render }) => render());
}

export function updateQty(barId, fixId, qty) {
  if (!requireEdit()) return;
  const bar = bars.find(b => b.id === barId);
  const fix = bar.fixtures.find(f => f.id === fixId);
  if (fix) fix.qty = Math.max(1, parseInt(qty) || 1);
  scheduleSave();
  import('./render-bars.js').then(({ renderSummary }) => renderSummary());
}

export function setBarPreshowDead(barId, val) {
  if (!requireEdit()) return;
  const bar = bars.find(b => b.id === barId);
  if (bar) { bar.preshowDead = val; scheduleSave(); import('./main.js').then(({ render }) => render()); }
}

export function updateBarNote(barId, val) {
  if (!requireEdit()) return;
  const bar = bars.find(b => b.id === barId);
  if (bar) { bar.note = val; scheduleSave(); }
}

export function updateTare(barId, val) {
  if (!requireEdit()) return;
  const bar = bars.find(b => b.id === barId);
  const w = parseFloat(val);
  if (!isNaN(w) && w >= 0) { bar.barWeight = w; scheduleSave(); }
}

export function updateMiscBricks(barId, val) {
  if (!requireEdit()) return;
  const bar = bars.find(b => b.id === barId);
  const v = parseInt(val, 10);
  bar.miscBricks = isNaN(v) ? 0 : v;
  scheduleSave();
  import('./main.js').then(({ render }) => render());
}

export function pickLib(barId) {
  const sel = document.getElementById(`sel_${barId}`);
  const v = sel.value;
  if (!v) return;
  const f = library.find(x => x.name === v);
  if (f) {
    inputMode[barId] = 'kg';
    import('./main.js').then(({ render }) => {
      render();
      setTimeout(() => {
        const w = document.getElementById(`fweight_${barId}`);
        if (w) { w.value = f.weight; updatePreview(barId); }
        const s = document.getElementById(`sel_${barId}`);
        if (s) s.value = v;
        const n = document.getElementById(`fname_${barId}`);
        if (n) n.value = f.name;
        const c = document.getElementById(`fcat_${barId}`);
        if (c && f.category) c.value = f.category;
        const e = document.getElementById(`fexclusive_${barId}`);
        if (e) e.checked = f.exclusive || false;
      }, 0);
    });
  }
}

export function toggleBar(id) {
  expanded[id] = !expanded[id];
  const bar = bars.find(b => b.id === id);
  const el = document.getElementById(`bar_${id}`);
  if (bar && el) {
    import('./render-bars.js').then(({ renderBar }) => {
      const tmp = document.createElement('div');
      tmp.innerHTML = renderBar(bar);
      el.replaceWith(tmp.firstElementChild);
    });
  } else {
    import('./main.js').then(({ render }) => render());
  }
}

export function resetAll() {
  if (!requireEdit()) return;
  if (!confirm('Reset ALL bars to empty? This cannot be undone.')) return;
  import('./state.js').then(({ defaultBars, setBars, setActiveShowName, setExpanded }) => {
    setBars(defaultBars());
    setActiveShowName(null);
  });
  logHistory('Reset all bars to default');
  scheduleSave();
  setExpanded({});
  import('./main.js').then(({ render }) => render());
  import('./shows.js').then(({ renderShows }) => renderShows());
}

export function switchMode(barId, mode) {
  inputMode[barId] = mode;
  const section = document.getElementById(`add_section_${barId}`);
  if (section) {
    import('./render-bars.js').then(({ buildAddSection }) => {
      section.outerHTML = buildAddSection(barId);
    });
  }
}
