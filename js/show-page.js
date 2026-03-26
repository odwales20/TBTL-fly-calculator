import { BAND_COLORS, DEFAULT_POSITIONS, FULL } from './constants.js';
import { bars, showConfig, flypositions, addingBarToCue, setAddingBarToCue, recomputeLiveFlyTags, defaultBars } from './state.js';
import { saveLocal } from './storage.js';
import { firebasePut, scheduleSave } from './firebase.js';
import { requireEdit } from './users.js';
import { hungLoad, logHistory } from './bar-actions.js';
import { esc } from './render-bars.js';

export function barTotalCwBricks(bar) {
  return Math.round((hungLoad(bar) + (bar.barWeight || 0)) * 2 / FULL);
}

// ── Preshow generation ──────────────────────────────────────
export function regeneratePreshowSilent() {
  const loaded = bars.filter(b => !b.notInUse && !b.dnf && ((b.fixtures||[]).length > 0 || b.extensions || b.iwb !== null || b.cable));
  if (!showConfig.cues) showConfig.cues = [];
  const existingIdx = showConfig.cues.findIndex(c => c.isPreshow);
  const existingPreshow = existingIdx >= 0 ? showConfig.cues[existingIdx] : null;
  const dutyStage = flypositions[0] || 'Duty Stage';

  const preshowBars = loaded.map(bar => {
    let deadId;
    if (bar.preshowDead === 'in') { deadId = 'in'; }
    else if (bar.preshowDead === 'out') { deadId = 'out'; }
    else {
      const hasLS = (bar.fixtures||[]).some(f => f.category === 'Lighting' || f.category === 'Sound');
      deadId = hasLS ? 'in' : 'out';
    }
    const existing = existingPreshow?.bars.find(cb => cb.barId === bar.id);
    return { barId: bar.id, deadId, speed: existing?.speed || 'Medium', flyperson: dutyStage };
  });

  const preshowCue = { id: 'preshow', isPreshow: true, number: '', name: 'Preshow', isFollow: false, overrideMax: false, bars: preshowBars };
  if (existingIdx >= 0) showConfig.cues[existingIdx] = preshowCue;
  else showConfig.cues.unshift(preshowCue);
}

export function generatePreshowCue() {
  regeneratePreshowSilent();
  saveShowConfig();
  renderShowPage();
}

export function updatePreshowSpeed(barId, speed) {
  const preshow = showConfig.cues.find(c => c.isPreshow);
  if (!preshow) return;
  const a = preshow.bars.find(cb => cb.barId === barId);
  if (a) { a.speed = speed; saveShowConfig(); }
}

export function updatePreshowFlyperson(barId, fp) {
  const preshow = showConfig.cues.find(c => c.isPreshow);
  if (!preshow) return;
  const a = preshow.bars.find(cb => cb.barId === barId);
  if (a) { a.flyperson = fp; saveShowConfig(); }
}

// ── Dead helpers ────────────────────────────────────────────
export function getDeadLabel(barId, deadId) {
  if (deadId === 'out')      return 'Out';
  if (deadId === 'show-out') return 'Show Out';
  if (deadId === 'max-out')  return 'Max Out';
  if (deadId === 'in')       return 'In';
  const customs = showConfig.customDeads[barId] || [];
  const dead = customs.find(d => d.id === deadId);
  if (!dead) return '—';
  return dead.name || (BAND_COLORS.find(c => c.id === dead.bandColor) || { label: dead.bandColor }).label;
}

export function getDeadStyle(barId, deadId) {
  if (deadId === 'out')      return 'background:#7f1d1d;color:#fee2e2;border:2px solid #111';
  if (deadId === 'show-out') return 'background:#dc2626;color:#fff;border:2px solid #fff';
  if (deadId === 'max-out')  return 'background:#dc2626;color:#111;border:2px solid #111';
  if (deadId === 'in')       return 'background:#f1f5f9;color:#111;border:2px solid #ef4444';
  const customs = showConfig.customDeads[barId] || [];
  const dead = customs.find(d => d.id === deadId);
  const hex = dead ? (BAND_COLORS.find(c => c.id === dead.bandColor) || { hex: '#888' }).hex : '#888';
  return `background:#f1f5f9;color:#111;border:2px solid ${hex}`;
}

// ── Show config mutations ────────────────────────────────────
export function saveShowConfig() {
  recomputeLiveFlyTags();
  saveLocal('tbtl_showconfig_v1', showConfig);
}

export function setMaxFlymen(val) {
  if (!requireEdit()) return;
  showConfig.maxFlymen = Math.max(1, parseInt(val) || 1);
  saveShowConfig();
}

export function addCustomDead(barId, bandColor) {
  if (!requireEdit()) return;
  if (!showConfig.customDeads[barId]) showConfig.customDeads[barId] = [];
  if (showConfig.customDeads[barId].some(d => d.bandColor === bandColor)) return;
  const col = BAND_COLORS.find(c => c.id === bandColor) || { label: bandColor };
  showConfig.customDeads[barId].push({ id: `${barId}_${bandColor}_${Date.now()}`, bandColor, name: col.label });
  logHistory(`Added ${col.label} dead to Bar ${barId}`);
  saveShowConfig();
  renderShowPage();
}

export function renameCustomDead(barId, deadId, name) {
  if (!requireEdit()) return;
  const d = (showConfig.customDeads[barId] || []).find(x => x.id === deadId);
  if (d) { d.name = name.trim() || d.name; saveShowConfig(); renderShowPage(); }
}

export function removeCustomDead(barId, deadId) {
  if (!requireEdit()) return;
  if (!showConfig.customDeads[barId]) return;
  showConfig.customDeads[barId] = showConfig.customDeads[barId].filter(d => d.id !== deadId);
  showConfig.cues.forEach(cue => {
    cue.bars = cue.bars.filter(cb => !(cb.barId === barId && cb.deadId === deadId));
  });
  saveShowConfig();
  renderShowPage();
}

export function copyBarDeadConfig(fromBarId) {
  if (!requireEdit()) return;
  const input = prompt(`Copy dead config from Bar ${fromBarId} to which bar?\nEnter a bar number, or "all" to copy to every bar:`);
  if (!input) return;
  const targets = input.trim().toLowerCase() === 'all'
    ? bars.map(b => b.id).filter(id => id !== fromBarId)
    : input.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n !== fromBarId);
  if (targets.length === 0) return;
  const srcDeads   = JSON.parse(JSON.stringify(showConfig.customDeads[fromBarId] || []));
  const srcDefault = (showConfig.barDefaults || {})[fromBarId] || 'out';
  if (!showConfig.barDefaults) showConfig.barDefaults = {};
  targets.forEach(id => {
    showConfig.customDeads[id] = srcDeads.map(d => ({ ...d, id: `${id}_${d.bandColor}_${Date.now()}` }));
    showConfig.barDefaults[id] = srcDefault;
  });
  logHistory(`Copied dead config from Bar ${fromBarId} to ${targets.length === 1 ? `Bar ${targets[0]}` : `${targets.length} bars`}`);
  saveShowConfig();
  renderShowPage();
}

export function resetBarToDefault(barId) {
  if (!requireEdit()) return;
  if (!confirm(`Reset Bar ${barId} to default and mark as Not In Use?`)) return;
  const idx = bars.findIndex(b => b.id === barId);
  if (idx < 0) return;
  const def = defaultBars().find(b => b.id === barId);
  if (def) bars[idx] = { ...def, notInUse: true };
  delete (showConfig.customDeads || {})[barId];
  delete (showConfig.barDefaults || {})[barId];
  showConfig.cues = (showConfig.cues || []).map(c => ({
    ...c,
    bars: (c.bars || []).filter(cb => cb.barId !== barId)
  }));
  logHistory(`Reset Bar ${barId} to default (Not In Use)`);
  saveShowConfig();
  import('./main.js').then(({ render }) => render());
  renderShowPage();
}

export function nextCueNumber() {
  const nums = (showConfig.cues || [])
    .filter(c => !c.isPreshow && c.number && /^\d+(\.\d+)?$/.test(c.number.trim()))
    .map(c => parseFloat(c.number.trim()));
  return nums.length > 0 ? String(Math.floor(Math.max(...nums)) + 1) : '1';
}

export function addCue() {
  if (!requireEdit()) return;
  if (!showConfig.cues) showConfig.cues = [];
  const num = nextCueNumber();
  const newCue = { id: String(Date.now()), number: num, name: '', isFollow: false, overrideMax: false, bars: [] };
  const intDivIdx = showConfig.cues.findIndex(c => c.isDivider && c.dividerType === 'interval_start');
  if (intDivIdx >= 0) showConfig.cues.splice(intDivIdx, 0, newCue);
  else showConfig.cues.push(newCue);
  logHistory(`Added cue ${num}`);
  saveShowConfig();
  renderShowPage();
}

export function nextIntervalCueNumber() {
  const cues = showConfig.cues || [];
  const intIdx  = cues.findIndex(c => c.isDivider && c.dividerType === 'interval_start');
  const act2Idx = cues.findIndex(c => c.isDivider && c.dividerType === 'act2_start');
  if (intIdx < 0) return 'Int 1';
  const end = act2Idx >= 0 ? act2Idx : cues.length;
  const nums = cues.slice(intIdx + 1, end)
    .filter(c => !c.isDivider && c.number && /^Int \d+$/.test(c.number.trim()))
    .map(c => parseInt(c.number.trim().slice(4)));
  return `Int ${nums.length > 0 ? Math.max(...nums) + 1 : 1}`;
}

export function addInterval() {
  if (!requireEdit()) return;
  if ((showConfig.cues || []).some(c => c.isDivider && c.dividerType === 'interval_start')) {
    alert('An interval section already exists in this show.');
    return;
  }
  if (!showConfig.cues) showConfig.cues = [];
  const ts = Date.now();
  showConfig.cues.push(
    { id: `div_int_${ts}`,      isDivider: true, dividerType: 'interval_start' },
    { id: `div_act2_${ts + 1}`, isDivider: true, dividerType: 'act2_start' }
  );
  logHistory('Added interval section');
  saveShowConfig();
  renderShowPage();
}

export function removeInterval() {
  if (!requireEdit()) return;
  const cues = showConfig.cues || [];
  const intIdx = cues.findIndex(c => c.isDivider && c.dividerType === 'interval_start');
  if (intIdx < 0) return;
  const hasCues = cues.some((c, i) => !c.isDivider && !c.isPreshow && i > intIdx);
  if (hasCues && !confirm('Remove interval? Interval and Act 2 cues will merge back into Act 1.')) return;
  showConfig.cues = cues.filter(c => !(c.isDivider && (c.dividerType === 'interval_start' || c.dividerType === 'act2_start')));
  logHistory('Removed interval section');
  saveShowConfig();
  renderShowPage();
}

export function insertCue(afterActualIdx, isNonFly = false, section = 'act1') {
  if (!requireEdit()) return;
  if (!showConfig.cues) showConfig.cues = [];
  const num = section === 'interval' ? nextIntervalCueNumber() : nextCueNumber();
  const newCue = isNonFly
    ? { id: String(Date.now()), number: num, name: '', isNonFly: true, isFollow: false, notes: '', bars: [] }
    : { id: String(Date.now()), number: num, name: '', isNonFly: false, isFollow: false, overrideMax: false, bars: [] };
  if (afterActualIdx < 0) {
    const preshowIdx = showConfig.cues.findIndex(c => c.isPreshow);
    showConfig.cues.splice(preshowIdx < 0 ? 0 : preshowIdx + 1, 0, newCue);
  } else {
    showConfig.cues.splice(afterActualIdx + 1, 0, newCue);
  }
  saveShowConfig();
  renderShowPage();
}

export function toggleCueOverrideMax(idx) {
  const cue = showConfig.cues[idx];
  if (!cue) return;
  cue.overrideMax = !cue.overrideMax;
  saveShowConfig();
  renderShowPage();
}

export function updateBarFlyperson(cueIdx, barIdx, fp) {
  const cue = showConfig.cues[cueIdx];
  if (!cue || !cue.bars[barIdx]) return;
  cue.bars[barIdx].flyperson = fp;
  saveShowConfig();
}

// ── Bar default dead ─────────────────────────────────────────
export function setBarDefaultDead(barId, deadId) {
  if (!requireEdit()) return;
  if (!showConfig.barDefaults) showConfig.barDefaults = {};
  showConfig.barDefaults[barId] = deadId || 'out';
  saveShowConfig();
  renderShowPage();
}

// ── Conflict detection ───────────────────────────────────────
export function getBarStateBeforeCue(barId, cueIdx) {
  let lastDead = (showConfig.barDefaults || {})[barId] || null;
  for (let i = 0; i < cueIdx && i < (showConfig.cues||[]).length; i++) {
    const a = (showConfig.cues[i].bars||[]).find(cb => cb.barId === barId);
    if (a) lastDead = a.deadId;
  }
  return lastDead;
}

export function findCueNameThatSet(barId, cueIdx) {
  for (let i = cueIdx - 1; i >= 0; i--) {
    if ((showConfig.cues[i].bars||[]).some(cb => cb.barId === barId)) {
      const c = showConfig.cues[i];
      return c.isPreshow ? 'Preshow' : c.number ? `Cue ${c.number}` : c.name || 'an earlier cue';
    }
  }
  return null;
}

export function deleteCue(idx) {
  if (!requireEdit()) return;
  const cue = showConfig.cues[idx];
  if (!confirm('Remove this cue?')) return;
  if (cue) logHistory(`Deleted cue ${cue.number || cue.name || idx}`);
  showConfig.cues.splice(idx, 1);
  setAddingBarToCue(null);
  saveShowConfig();
  renderShowPage();
}

export function moveCue(idx, dir) {
  if (!requireEdit()) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= showConfig.cues.length) return;
  if (showConfig.cues[newIdx]?.isDivider || showConfig.cues[newIdx]?.isPreshow) return;
  [showConfig.cues[idx], showConfig.cues[newIdx]] = [showConfig.cues[newIdx], showConfig.cues[idx]];
  saveShowConfig();
  renderShowPage();
}

export function toggleCueFollow(idx) {
  if (!requireEdit()) return;
  const cue = showConfig.cues[idx];
  if (!cue) return;
  cue.isFollow = !cue.isFollow;
  saveShowConfig();
  renderShowPage();
}

export function toggleAddBarToCue(idx) {
  setAddingBarToCue(addingBarToCue === idx ? null : idx);
  renderShowPage();
}

export function updateCueBarDeadOptions(cueIdx) {
  const barSel = document.getElementById(`cue_bar_sel_${cueIdx}`);
  const deadSel = document.getElementById(`cue_dead_sel_${cueIdx}`);
  if (!barSel || !deadSel) return;
  const barId = parseInt(barSel.value);
  if (!barId) { deadSel.innerHTML = '<option value="">— select bar first —</option>'; return; }
  const currentDead = getBarStateBeforeCue(barId, cueIdx);
  const mark = id => currentDead === id ? ' ← already here' : '';
  const customs = showConfig.customDeads[barId] || [];
  deadSel.innerHTML = [
    '<option value="">— Dead —</option>',
    `<option value="out">Out (black on dark red)${mark('out')}</option>`,
    `<option value="show-out">Show Out (white band on red)${mark('show-out')}</option>`,
    `<option value="max-out">Max Out (black band on red)${mark('max-out')}</option>`,
    `<option value="in">In (red band on white)${mark('in')}</option>`,
    ...customs.map(d => {
      const col = BAND_COLORS.find(c => c.id === d.bandColor) || { label: d.bandColor };
      return `<option value="${d.id}">${col.label} on white${mark(d.id)}</option>`;
    })
  ].join('');
}

export function confirmAddBarToCue(cueIdx) {
  if (!requireEdit()) return;
  const barSel  = document.getElementById(`cue_bar_sel_${cueIdx}`);
  const deadSel = document.getElementById(`cue_dead_sel_${cueIdx}`);
  const speedSel = document.getElementById(`cue_speed_sel_${cueIdx}`);
  const fpSel   = document.getElementById(`cue_fp_sel_${cueIdx}`);
  const barId  = parseInt(barSel?.value);
  const deadId = deadSel?.value;
  const speed  = speedSel?.value;
  const flyperson = fpSel?.value || '';
  if (!barId || !deadId || !speed) return;
  const cue = showConfig.cues[cueIdx];
  if (!cue) return;

  // DNF block — cannot add to any cue
  const barObj = bars.find(b => b.id === barId);
  if (barObj?.dnf) {
    alert(`⛔ Bar ${barId} has a DO NOT FLY tag.\n\nThis bar cannot be added to any cue. Remove the physical tag and clear the DNF flag on the Bars page first.`);
    return;
  }

  // Bar 1 cinema screen warning
  if (barId === 1) {
    if (!confirm(`⚠ WARNING: Bar 1 is the CINEMA SCREEN.\n\nMoving it incorrectly can crush equipment below.\n\nAre you absolutely sure you want to add it to this cue?`)) return;
  }

  // Conflict: bar already at this dead
  const currentDead = getBarStateBeforeCue(barId, cueIdx);
  if (currentDead !== null && currentDead === deadId) {
    const src = findCueNameThatSet(barId, cueIdx);
    const label = getDeadLabel(barId, deadId);
    alert(`Bar ${barId} is already at "${label}" from ${src || 'a previous cue'} — no move needed.`);
    return;
  }

  // Max flypersons check (unless overridden)
  const limit = cue.overrideMax ? Infinity : showConfig.maxFlymen;
  if (cue.bars.length >= limit) {
    alert(`Max flypersons (${showConfig.maxFlymen}) reached for this cue. Enable "Override max" on the cue to add more.`);
    return;
  }

  // Auto-assign first position only when single flyperson AND not overridden
  const autoFP = (showConfig.maxFlymen === 1 && !cue.overrideMax) ? (flypositions[0] || 'Duty Stage') : (flyperson || flypositions[0] || 'Duty Stage');
  cue.bars.push({ barId, deadId, speed, flyperson: autoFP });
  logHistory(`Added Bar ${barId} to cue ${cue.number || cue.name || '—'}`);
  setAddingBarToCue(null);
  saveShowConfig();
  renderShowPage();
}

export function removeBarFromCue(cueIdx, barIdx) {
  if (!requireEdit()) return;
  const cue = showConfig.cues[cueIdx];
  if (!cue) return;
  cue.bars.splice(barIdx, 1);
  saveShowConfig();
  renderShowPage();
}

// ── Position library ─────────────────────────────────────────
export function addPosition(name) {
  if (!requireEdit()) return;
  const n = name.trim();
  if (!n || flypositions.includes(n)) return;
  flypositions.push(n);
  saveLocal('tbtl_positions_v1', flypositions);
  firebasePut('positions', flypositions).catch(e => console.warn('[Firebase positions]', e));
  renderShowPage();
}

export function removePosition(idx) {
  if (!requireEdit()) return;
  if (DEFAULT_POSITIONS.includes(flypositions[idx])) {
    if (!confirm(`Remove default position "${flypositions[idx]}"?`)) return;
  }
  flypositions.splice(idx, 1);
  saveLocal('tbtl_positions_v1', flypositions);
  firebasePut('positions', flypositions).catch(e => console.warn('[Firebase positions]', e));
  renderShowPage();
}

// ── Show page renderer ───────────────────────────────────────
export function fpOptions(selected) {
  const opts = ['<option value="">— Who —</option>'];
  flypositions.forEach(p => {
    opts.push(`<option value="${esc(p)}" ${selected === p ? 'selected' : ''}>${esc(p)}</option>`);
  });
  return opts.join('');
}

export function renderShowPage() {
  const container = document.getElementById('show-container');
  if (!container) return;

  const activeBars = bars.filter(b => b.id === 1 || (b.fixtures||[]).length > 0 || b.extensions || b.iwb !== null || (b.name && b.name !== `Bar ${b.id}`));
  const cues = showConfig.cues || [];
  const preshow = cues.find(c => c.isPreshow);
  const regularCues = cues.filter(c => !c.isPreshow);

  // Settings
  const positionPills = flypositions.map((p, i) =>
    `<span style="display:inline-flex;align-items:center;gap:4px;background:#1e3a5f;color:#60a5fa;border:1px solid #3b82f644;border-radius:5px;padding:3px 8px;font-size:12px;font-weight:600;margin:2px">
      ${esc(p)}
      <button onclick="removePosition(${i})" style="background:none;border:none;color:#475569;cursor:pointer;font-size:13px;padding:0;line-height:1">&times;</button>
    </span>`
  ).join('');

  const settingsHtml = `
    <div class="show-section">
      <div class="show-section-title">Settings</div>
      <div style="display:flex;align-items:center;gap:12px;font-size:13px;color:#94a3b8;flex-wrap:wrap;margin-bottom:12px">
        <label style="white-space:nowrap">Max flypersons per cue:</label>
        <input type="number" min="1" max="20" value="${showConfig.maxFlymen}"
          onchange="setMaxFlymen(this.value)"
          style="background:#0f172a;border:1px solid #334155;border-radius:6px;color:#f1f5f9;padding:6px 10px;font-size:14px;font-weight:700;width:70px;text-align:center">
        <span style="color:#475569;font-size:11px">Can be overridden per cue</span>
      </div>
      <div style="border-top:1px solid #334155;padding-top:10px">
        <div class="show-section-title" style="margin-bottom:6px">Flyperson Positions <span style="color:#334155;font-weight:400;text-transform:none;letter-spacing:0">— shared across all shows</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:2px;margin-bottom:8px">${positionPills}</div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <input type="text" id="new-position-inp" placeholder="Add position…"
            style="background:#0f172a;border:1px solid #334155;border-radius:6px;color:#e2e8f0;padding:6px 10px;font-size:12px;outline:none;flex:1;min-width:140px"
            onkeydown="if(event.key==='Enter'){addPosition(this.value);this.value=''}">
          <button onclick="addPosition(document.getElementById('new-position-inp').value);document.getElementById('new-position-inp').value=''"
            class="btn-add" style="padding:5px 12px;font-size:12px">+ Add</button>
        </div>
      </div>
    </div>
  `;

  // Bar Deads — all bars except not-in-use
  const deadsBars = bars.filter(b => !b.notInUse);
  const barDefaults = showConfig.barDefaults || {};

  function defaultDeadSelect(barId) {
    const cur = barDefaults[barId] || 'out';
    const customs = showConfig.customDeads[barId] || [];
    const opts = [
      { id: 'out',      label: 'Out' },
      { id: 'show-out', label: 'Show Out' },
      { id: 'max-out',  label: 'Max Out' },
      { id: 'in',       label: 'In' },
      ...customs.map(d => ({ id: d.id, label: d.name || (BAND_COLORS.find(c => c.id === d.bandColor) || {}).label || d.bandColor }))
    ].map(o => `<option value="${o.id}" ${cur === o.id ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
    return `<select onchange="setBarDefaultDead(${barId},this.value)"
      title="Default starting dead for this bar"
      style="background:#0f172a;border:1px solid #334155;border-radius:5px;color:#94a3b8;padding:2px 6px;font-size:11px;outline:none;cursor:pointer">
      ${opts}
    </select>`;
  }

  const deadsBody = deadsBars.length === 0
    ? '<div style="color:#475569;font-size:12px;font-style:italic">No bars available</div>'
    : deadsBars.map(bar => {
        const customs = showConfig.customDeads[bar.id] || [];
        const customBadges = customs.map(d => {
          const col = BAND_COLORS.find(c => c.id === d.bandColor) || { hex: '#888', label: '?' };
          return `<span style="display:inline-flex;align-items:center;gap:4px;background:#f1f5f9;color:#111;border:2px solid ${col.hex};border-radius:4px;padding:2px 6px;font-size:11px;font-weight:700;margin-right:4px">
            <span style="width:10px;height:10px;border-radius:50%;background:${col.hex};flex-shrink:0;display:inline-block" title="${esc(col.label)}" aria-label="${esc(col.label)}"></span>
            <input value="${esc(d.name||col.label)}" onblur="renameCustomDead(${bar.id},'${d.id}',this.value)"
              style="background:transparent;border:none;border-bottom:1px dashed #94a3b8;color:#111;font-size:11px;font-weight:700;width:80px;outline:none;padding:0">
            <button onclick="removeCustomDead(${bar.id},'${d.id}')" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:14px;padding:0;line-height:1">&times;</button>
          </span>`;
        }).join('');
        const usedColors = customs.map(d => d.bandColor);
        const colorButtons = BAND_COLORS.filter(c => !usedColors.includes(c.id)).map(c =>
          `<button onclick="addCustomDead(${bar.id},'${c.id}')" title="Add ${c.label} dead"
            style="width:16px;height:16px;border-radius:50%;background:${c.hex};border:2px solid ${c.hex}88;cursor:pointer;flex-shrink:0;padding:0"></button>`
        ).join('');
        return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid #0f172a;flex-wrap:wrap">
          <span style="font-size:12px;color:#94a3b8;font-weight:600;min-width:110px;flex-shrink:0">BAR ${bar.id}${bar.name !== `Bar ${bar.id}` ? ` · ${esc(bar.name)}` : ''}</span>
          <span style="color:#475569;font-size:10px;flex-shrink:0">Default:</span>${defaultDeadSelect(bar.id)}
          <span style="background:#7f1d1d;color:#fee2e2;border:2px solid #111;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">Out</span>
          <span style="background:#dc2626;color:#fff;border:2px solid #fff;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">Show Out</span>
          <span style="background:#dc2626;color:#111;border:2px solid #111;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">Max Out</span>
          <span style="background:#f1f5f9;color:#111;border:2px solid #ef4444;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">In</span>
          ${customBadges}
          ${colorButtons ? `<span style="color:#475569;font-size:10px">+</span>${colorButtons}` : ''}
          <button onclick="copyBarDeadConfig(${bar.id})" title="Copy this bar's dead config to another bar"
            style="background:#0f172a;color:#475569;border:1px solid #334155;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer;margin-left:auto;flex-shrink:0">Copy →</button>
          <button onclick="resetBarToDefault(${bar.id})" title="Reset bar to default and mark Not In Use"
            style="background:#0f172a;color:#7f1d1d;border:1px solid #7f1d1d44;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer;flex-shrink:0">Reset</button>
        </div>`;
      }).join('');

  // Preshow card (compact)
  const preshowCard = preshow && preshow.bars.length > 0
    ? (() => {
        const barCells = (preshow.bars || []).map(cb => {
          const bar = bars.find(b => b.id === cb.barId);
          const label = getDeadLabel(cb.barId, cb.deadId);
          const ds = getDeadStyle(cb.barId, cb.deadId);
          const overrideNote = bar?.preshowDead ? '✎' : '';
          const isHeavy = bar && barTotalCwBricks(bar) >= 30;
          return `<div style="display:flex;align-items:center;gap:3px;background:#0f172a;border-radius:5px;padding:3px 6px;flex-shrink:0">
            <span style="color:#64748b;font-size:10px;flex-shrink:0">B${cb.barId}${overrideNote}</span>
            <span style="${ds};border-radius:3px;padding:1px 5px;font-size:10px;font-weight:700">${esc(label)}</span>
            ${isHeavy ? `<span style="color:#fca5a5;font-size:9px;font-weight:800">⚠H</span>` : ''}
            <select onchange="updatePreshowSpeed(${cb.barId},this.value)"
              style="background:#0f172a;border:none;border-bottom:1px solid #334155;color:#fbbf24;font-size:10px;padding:0 2px;outline:none;max-width:52px">
              ${['V.Slow','Slow','Medium','Fast','Max'].map(s => `<option ${s===cb.speed?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>`;
        }).join('');
        const dutyStage = flypositions[0] || 'Duty Stage';
        return `<div style="background:#1e293b;border:2px solid #f59e0b55;border-radius:8px;margin-bottom:8px;overflow:hidden">
          <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#1c1507;flex-wrap:wrap">
            <span style="background:#92400e;color:#fde68a;border-radius:4px;padding:1px 10px;font-size:11px;font-weight:800;flex-shrink:0">PRESHOW</span>
            <span style="color:#fbbf24;font-size:11px;flex-shrink:0">${dutyStage}</span>
            <span style="color:#475569;font-size:10px;flex:1">✎ = position set on Bars page · speeds editable</span>
            <button onclick="generatePreshowCue()" style="background:#92400e;color:#fde68a;border:1px solid #f59e0b44;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer;font-weight:700">↺ Regen</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;padding:6px 10px">
            ${barCells}
          </div>
        </div>`;
      })()
    : `<div style="background:#1c1507;border:2px dashed #f59e0b44;border-radius:8px;padding:8px 14px;margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="background:#92400e;color:#fde68a;border-radius:4px;padding:1px 10px;font-size:11px;font-weight:800">PRESHOW</span>
        <span style="color:#f59e0b;font-size:12px">No loaded bars — add fixtures to generate preshow</span>
      </div>`;

  // ── Section splitting ────────────────────────────────────────
  const intervalDividerIdx = cues.findIndex(c => c.isDivider && c.dividerType === 'interval_start');
  const act2DividerIdx     = cues.findIndex(c => c.isDivider && c.dividerType === 'act2_start');
  const hasInterval = intervalDividerIdx >= 0;

  const act1Cues     = cues.filter((c, i) => !c.isPreshow && !c.isDivider && (intervalDividerIdx < 0 || i < intervalDividerIdx));
  const intervalCues = hasInterval ? cues.filter((c, i) => !c.isDivider && i > intervalDividerIdx && (act2DividerIdx < 0 || i < act2DividerIdx)) : [];
  const act2Cues     = act2DividerIdx >= 0 ? cues.filter((c, i) => !c.isDivider && i > act2DividerIdx) : [];
  const allRegCues   = [...act1Cues, ...intervalCues, ...act2Cues];

  const activeBarOptions = activeBars
    .filter(b => !b.dnf && !b.notInUse)
    .map(b => `<option value="${b.id}">Bar ${b.id}${b.name !== `Bar ${b.id}` ? ` · ${esc(b.name)}` : ''}</option>`)
    .join('');

  const oneFP = showConfig.maxFlymen === 1;

  function renderInsertRow(afterActualIdx, section) {
    const s = section || 'act1';
    return `<div style="display:flex;justify-content:center;gap:4px;padding:2px 0;opacity:0.3;transition:opacity 0.15s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.3">
      <button onclick="insertCue(${afterActualIdx},false,'${s}')" style="background:#0f172a;color:#475569;border:1px dashed #334155;border-radius:5px;padding:2px 8px;font-size:10px;cursor:pointer">+ Fly Cue</button>
      <button onclick="insertCue(${afterActualIdx},true,'${s}')" style="background:#0f172a;color:#475569;border:1px dashed #7c3aed44;border-radius:5px;padding:2px 8px;font-size:10px;cursor:pointer">+ Non-Fly</button>
    </div>`;
  }

  function renderCueCard(cue, sectionCues, si) {
    const idx     = cues.indexOf(cue);
    const allIdx  = allRegCues.indexOf(cue);
    const numVal  = cue.number || '';
    const nameVal = cue.name   || '';
    const moveBtns = `<div style="display:flex;gap:4px;margin-left:auto;flex-shrink:0">
      ${si > 0                         ? `<button onclick="moveCue(${idx},-1)" style="background:#0f172a;color:#64748b;border:1px solid #334155;border-radius:5px;padding:3px 8px;font-size:11px;cursor:pointer">↑</button>` : ''}
      ${si < sectionCues.length - 1    ? `<button onclick="moveCue(${idx},1)"  style="background:#0f172a;color:#64748b;border:1px solid #334155;border-radius:5px;padding:3px 8px;font-size:11px;cursor:pointer">↓</button>` : ''}
      <button onclick="deleteCue(${idx})" style="background:none;color:#ef4444;border:1px solid #ef444433;border-radius:5px;padding:3px 8px;font-size:11px;cursor:pointer">✕</button>
    </div>`;

    let card;

    if (cue.isNonFly) {
      card = `<div style="background:#0d0114;border:1px solid #7c3aed44;border-radius:8px;overflow:hidden">
        <div style="display:flex;align-items:center;gap:8px;padding:7px 12px;flex-wrap:wrap">
          <span style="background:#4c1d95;color:#ddd6fe;border-radius:4px;padding:1px 8px;font-size:11px;font-weight:800;flex-shrink:0">NON-FLY</span>
          <input type="text" value="${esc(numVal)}" placeholder="Q#"
            oninput="showConfig.cues[${idx}].number=this.value||''" onblur="saveShowConfig()"
            style="background:#0f172a;border:1px solid #4c1d95;border-radius:5px;color:#ddd6fe;padding:3px 8px;font-size:13px;font-weight:800;width:56px;text-align:center;outline:none">
          <input type="text" value="${esc(nameVal)}" placeholder="Cue name…"
            oninput="showConfig.cues[${idx}].name=this.value||''" onblur="saveShowConfig()"
            style="background:transparent;border:none;border-bottom:1px solid #4c1d95;color:#c4b5fd;padding:2px 4px;font-size:13px;font-weight:700;flex:1;min-width:80px;outline:none">
          <input type="text" value="${esc(cue.notes||'')}" placeholder="Notes / instructions…"
            oninput="showConfig.cues[${idx}].notes=this.value||''" onblur="saveShowConfig()"
            style="background:transparent;border:none;border-bottom:1px dashed #334155;color:#94a3b8;padding:2px 4px;font-size:11px;flex:2;min-width:100px;outline:none">
          ${moveBtns}
        </div>
      </div>`;
    } else {
      const barLines = (cue.bars || []).map((cb, bi) => {
        const bar = bars.find(b => b.id === cb.barId);
        const barName = bar && bar.name !== `Bar ${bar.id}` ? esc(bar.name) : '';
        const label = getDeadLabel(cb.barId, cb.deadId);
        const ds = getDeadStyle(cb.barId, cb.deadId);
        const bricks = bar ? barTotalCwBricks(bar) : 0;
        const isHeavy = bricks >= 30;
        const bar1Warn = cb.barId === 1 ? `<span style="background:#7f1d1d;color:#fca5a5;border-radius:4px;padding:1px 5px;font-size:10px;font-weight:800">⚠ SCREEN</span>` : '';
        const heavyBadge = isHeavy ? `<span style="background:#78350f;color:#fcd34d;border-radius:4px;padding:1px 5px;font-size:10px;font-weight:800">⚠ HEAVY ${bricks}b</span>` : '';
        const showFP = !oneFP || cue.overrideMax;
        const fpSelect = showFP
          ? `<select onchange="updateBarFlyperson(${idx},${bi},this.value)" style="background:#1e3a5f;color:#60a5fa;border:1px solid #3b82f644;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:700;outline:none">${fpOptions(cb.flyperson)}</select>`
          : '';
        return `<div style="display:flex;align-items:center;gap:8px;padding:5px 14px;border-top:1px solid #0f172a;flex-wrap:wrap">
          <span style="color:#cbd5e1;font-size:12px;font-weight:700;min-width:46px;flex-shrink:0">Bar ${cb.barId}</span>
          <span style="color:#e2e8f0;font-size:12px;font-weight:600;min-width:50px;flex:1">${barName}</span>
          <span style="${ds};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">${esc(label)}</span>
          <span style="background:#0f172a;color:#fbbf24;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">${esc(cb.speed)}</span>
          ${bar1Warn}${heavyBadge}${fpSelect}
          <button onclick="removeBarFromCue(${idx},${bi})" style="background:none;color:#ef4444;border:none;cursor:pointer;font-size:14px;padding:1px 4px;margin-left:auto">✕</button>
        </div>`;
      }).join('');

      const atMax = !cue.overrideMax && (cue.bars || []).length >= showConfig.maxFlymen;
      const addBarForm = addingBarToCue === idx
        ? `<div style="padding:8px 14px;background:#0a0f1a;border-top:1px solid #1e293b;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            <select id="cue_bar_sel_${idx}" onchange="updateCueBarDeadOptions(${idx})"
              style="background:#0f172a;border:1px solid #334155;border-radius:6px;color:#e2e8f0;padding:5px 8px;font-size:12px;outline:none">
              <option value="">— Bar —</option>${activeBarOptions}
            </select>
            <select id="cue_dead_sel_${idx}"
              style="background:#0f172a;border:1px solid #334155;border-radius:6px;color:#e2e8f0;padding:5px 8px;font-size:12px;outline:none">
              <option value="">— select bar first —</option>
            </select>
            <select id="cue_speed_sel_${idx}"
              style="background:#0f172a;border:1px solid #334155;border-radius:6px;color:#e2e8f0;padding:5px 8px;font-size:12px;outline:none">
              <option value="">— Speed —</option>
              <option>V.Slow</option><option>Slow</option><option>Medium</option><option>Fast</option><option>Max</option>
            </select>
            ${(!oneFP || cue.overrideMax) ? `<select id="cue_fp_sel_${idx}"
              style="background:#0f172a;border:1px solid #334155;border-radius:6px;color:#60a5fa;padding:5px 8px;font-size:12px;outline:none">
              ${fpOptions('')}
            </select>` : ''}
            <button onclick="confirmAddBarToCue(${idx})" class="btn-add" style="padding:5px 12px;font-size:12px">+ Add</button>
            <button onclick="toggleAddBarToCue(${idx})" style="background:#1e293b;color:#64748b;border:1px solid #334155;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer">Cancel</button>
          </div>`
        : `<div style="padding:5px 14px;border-top:1px solid #0f172a">
            <button onclick="toggleAddBarToCue(${idx})" ${atMax ? `disabled title="Max ${showConfig.maxFlymen} — enable Override"` : ''}
              style="background:#0f172a;color:${atMax ? '#334155' : '#475569'};border:1px dashed #334155;border-radius:6px;padding:3px 12px;font-size:11px;cursor:${atMax ? 'not-allowed' : 'pointer'};width:100%">
              + Add bar to cue${atMax ? ` (max ${showConfig.maxFlymen} — Override to add more)` : ''}
            </button>
          </div>`;

      const headerInputs = cue.isFollow
        ? `<span style="background:#7c3aed;color:#ddd6fe;border-radius:5px;padding:2px 12px;font-size:12px;font-weight:800">▶ FOLLOW</span>
           <input type="text" value="${esc(nameVal)}" placeholder="note…"
             oninput="showConfig.cues[${idx}].name=this.value||''" onblur="saveShowConfig()"
             style="background:transparent;border:none;border-bottom:1px solid #334155;color:#94a3b8;padding:2px 4px;font-size:12px;flex:1;min-width:80px;outline:none">`
        : `<input type="text" value="${esc(numVal)}" placeholder="Q#"
             oninput="showConfig.cues[${idx}].number=this.value||''" onblur="saveShowConfig()"
             style="background:#0f172a;border:1px solid #1e40af;border-radius:5px;color:#bfdbfe;padding:3px 8px;font-size:13px;font-weight:800;width:56px;text-align:center;outline:none">
           <input type="text" value="${esc(nameVal)}" placeholder="Cue name…"
             oninput="showConfig.cues[${idx}].name=this.value||''" onblur="saveShowConfig()"
             style="background:transparent;border:none;border-bottom:1px solid #334155;color:#f1f5f9;padding:2px 4px;font-size:14px;font-weight:700;flex:1;min-width:80px;outline:none">`;

      card = `<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;overflow:hidden">
        <div style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:#0f172a;flex-wrap:wrap">
          ${headerInputs}
          <button onclick="toggleCueFollow(${idx})"
            style="background:${cue.isFollow ? '#7c3aed' : '#0f172a'};color:${cue.isFollow ? '#ddd6fe' : '#475569'};border:1px solid ${cue.isFollow ? '#7c3aed' : '#334155'};border-radius:5px;padding:3px 10px;font-size:11px;cursor:pointer;font-weight:700;white-space:nowrap">
            ▶ Follow</button>
          <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:${cue.overrideMax ? '#f59e0b' : '#475569'};cursor:pointer;white-space:nowrap">
            <input type="checkbox" ${cue.overrideMax ? 'checked' : ''} onchange="toggleCueOverrideMax(${idx})" style="accent-color:#f59e0b">
            Override max
          </label>
          ${moveBtns}
        </div>
        ${barLines}
        ${addBarForm}
      </div>`;
    }
    return card;
  }

  function renderSection(sectionCues, section, startAfterIdx) {
    if (sectionCues.length === 0) return renderInsertRow(startAfterIdx, section);
    return sectionCues.map((cue, si) => {
      const idx = cues.indexOf(cue);
      const firstRow = si === 0 ? renderInsertRow(startAfterIdx, section) : '';
      return `${firstRow}${renderCueCard(cue, sectionCues, si)}${renderInsertRow(idx, section)}`;
    }).join('\n');
  }

  // Act 1 starts after preshow (or at beginning)
  const preshowIdx   = cues.findIndex(c => c.isPreshow);
  const act1StartIdx = preshowIdx >= 0 ? preshowIdx : -1;

  const act1Html = renderSection(act1Cues, 'act1', act1StartIdx);
  const intervalHtml = hasInterval ? renderSection(intervalCues, 'interval', intervalDividerIdx) : '';
  const act2Html     = hasInterval ? renderSection(act2Cues, 'act2', act2DividerIdx) : '';

  const intervalHeader = hasInterval
    ? `<div style="display:flex;align-items:center;gap:8px;margin:14px 0 6px;border-top:2px solid #f59e0b33;padding-top:10px;flex-wrap:wrap">
        <span style="color:#f59e0b;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em">⏸ Interval</span>
        <button onclick="removeInterval()" style="background:none;color:#475569;border:1px solid #33415544;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer">Remove</button>
      </div>`
    : '';

  const act2Header = hasInterval
    ? `<div style="margin:14px 0 6px;border-top:2px solid #22c55e33;padding-top:10px">
        <span style="color:#22c55e;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em">▶ Act 2</span>
      </div>`
    : '';

  const addIntervalBtn = !hasInterval
    ? `<button onclick="addInterval()" style="background:#1c1507;color:#f59e0b;border:1px solid #f59e0b44;border-radius:6px;padding:5px 14px;font-size:12px;cursor:pointer;font-weight:700">⏸ + Interval</button>`
    : '';

  container.innerHTML = `
    ${settingsHtml}
    <div class="show-section">
      <div class="show-section-title">Bar Deads</div>
      <div style="font-size:11px;color:#475569;margin-bottom:6px">Out (red/black) and In (white/red) are always available. Click a colour dot to add an extra dead for a bar.</div>
      ${deadsBody}
    </div>
    <div class="show-section">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
        <span class="show-section-title" style="margin:0">Cue Sheet</span>
        <button onclick="addCue()" class="btn-add" style="padding:5px 12px;font-size:12px">+ New Cue</button>
        ${addIntervalBtn}
        ${cues.length > 0 ? `<button onclick="printCueSheet()" class="btn-print" style="padding:5px 12px;font-size:12px">🖨 Print Cue Sheet</button>` : ''}
      </div>
      ${preshowCard}
      <div style="margin:8px 0 4px;border-top:2px solid #3b82f633;padding-top:8px">
        <span style="color:#60a5fa;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em">Act 1</span>
      </div>
      ${act1Html}
      ${intervalHeader}
      ${intervalHtml}
      ${act2Header}
      ${act2Html}
    </div>
  `;
}
