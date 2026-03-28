import { bars, showConfig, shows, activeShowName, editMode, saveTimeout } from './state.js';
import * as State from './state.js';
import { saveLocal } from './storage.js';
import { firebasePut, loadFromFirebase, setSyncStatus, scheduleSave } from './firebase.js';
import { renderUserBar, renderHistoryPage } from './users.js';
import { renderSummary, renderBar, esc } from './render-bars.js';
import { renderLibraryPage, renderInventoryPage } from './render-library.js';
import { renderShows } from './shows.js';
import { renderShowPage, regeneratePreshowSilent, getDeadLabel, barTotalCwBricks } from './show-page.js';
import { hungLoad, calcBricks, logHistory, resetAll, toggleBar, toggleNotInUse, toggleExtensions, selectIWB, toggleCable, toggleDNF, toggleConduit, updateBarName, updatePreview, switchMode, addFixture, removeFixture, updateQty, setBarPreshowDead, updateBarNote, updateTare, updateMiscBricks, pickLib, moveBarConfig, resetBarToDefault } from './bar-actions.js';
import { toggleShowsPanel, loadShow, saveShow, deleteShow, overrideShow, openNewShowModal, closeNewShowModal, confirmNewShow, promptSaveShow, loadBackup, toggleBackupsList } from './shows.js';
import { setCurrentUser, toggleEditMode, openManageUsersModal, closeManageUsersModal, setUserPerm, addUser, removeUser, clearHistory } from './users.js';
import { startLibEdit, cancelLibEdit, saveLibEdit, deleteLibItem, addLibItem } from './render-library.js';
import { generatePreshowCue, updatePreshowSpeed, updatePreshowFlyperson, updatePreshowDead, saveShowConfig, setMaxFlymen, addCustomDead, renameCustomDead, removeCustomDead, addCue, insertCue, toggleCueFollow, toggleCueOverrideMax, updateBarFlyperson, updateCueBarSpeed, updateCueBarTime, toggleAddBarToCue, updateCueBarDeadOptions, confirmAddBarToCue, removeBarFromCue, moveCue, deleteCue, addPosition, removePosition, addInterval, removeInterval, setBarDefaultDead, copyBarDeadConfig, toggleClearance, updateClearancePerson, toggleShowStats, toggleHouseOpenCheck, updateHouseOpenNote, renderShowPage } from './show-page.js';
import { BAND_COLORS, IWB_COLOURS } from './constants.js';


let currentPage = 'bars';
// editingLibItem lives in render-library.js
let _unused = null;

export function switchPage(page) {
  currentPage = page;
  document.getElementById('page-bars').style.display = page === 'bars' ? 'block' : 'none';
  document.getElementById('page-library').style.display = page === 'library' ? 'block' : 'none';
  document.getElementById('page-inventory').style.display = page === 'inventory' ? 'block' : 'none';
  document.getElementById('page-show').style.display = page === 'show' ? 'block' : 'none';
  document.getElementById('page-history').style.display = page === 'history' ? 'block' : 'none';
  ['bars','library','inventory','show','history'].forEach(p => {
    const t = document.getElementById(`tab-${p}`);
    const active = p === page;
    t.className = 'page-tab' + (active ? ' active' : '');
    t.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if (page === 'library') renderLibraryPage();
  else if (page === 'inventory') renderInventoryPage();
  else if (page === 'show') renderShowPage();
  else if (page === 'history') renderHistoryPage();
  else render();
}

export function render() {
  renderSummary();
  const q = document.getElementById('search').value.toLowerCase();
  const filtered = bars.filter(b =>
    String(b.id).includes(q) || b.name.toLowerCase().includes(q)
  );
  document.getElementById('bars-container').innerHTML = filtered.map(renderBar).join('');
  applyShowTabVisibility();
}

export function applyShowTabVisibility() {
  const tab = document.getElementById('tab-show');
  if (!tab) return;
  if (showConfig.hideShowTab) {
    tab.style.opacity = '0.25';
    tab.title = 'Show tab hidden for this show — click to re-enable';
    tab.onclick = () => { showConfig.hideShowTab = false; saveShowConfig(); applyShowTabVisibility(); };
  } else {
    tab.style.opacity = '';
    tab.title = '';
    tab.onclick = () => switchPage('show');
  }
}

export function toggleHideShowTab() {
  showConfig.hideShowTab = !showConfig.hideShowTab;
  if (showConfig.hideShowTab && currentPage === 'show') switchPage('bars');
  saveShowConfig();
  applyShowTabVisibility();
}
export function showPrintDialog() {
  const cues = showConfig.cues || [];
  if (cues.length === 0) { alert('No cues to print.'); return; }

  // Collect all unique people assigned across all cues
  const people = new Set();
  for (const cue of cues) {
    if (cue.isDivider || cue.isPreshow) continue;
    if (cue.flyperson) people.add(cue.flyperson);
    for (const cb of (cue.bars || [])) {
      if (cb.flyperson) people.add(cb.flyperson);
    }
  }
  const peopleArr = [...people].sort();

  const existing = document.getElementById('print-dialog-overlay');
  if (existing) existing.remove();

  const btnStyle = 'padding:10px 20px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;border:2px solid transparent;min-width:130px;text-align:center';
  const personBtns = peopleArr.map(p =>
    `<button data-person="${esc(p)}" style="${btnStyle};background:#1e3a5f;color:#60a5fa;border-color:#3b82f644">${esc(p)}</button>`
  ).join('');

  const overlay = document.createElement('div');
  overlay.id = 'print-dialog-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:#00000088;z-index:9999;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div style="background:#1e293b;border:2px solid #334155;border-radius:14px;padding:28px 32px;max-width:500px;width:90%;box-shadow:0 20px 60px #000a">
      <h2 style="color:#f1f5f9;font-size:18px;font-weight:800;margin-bottom:6px">🖨 Print Cue Sheet</h2>
      <p style="color:#94a3b8;font-size:13px;margin-bottom:20px">Select a person to highlight their cues, or print for everyone.</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px">
        <button data-person="" style="${btnStyle};background:#0f172a;color:#94a3b8;border-color:#334155">Everyone</button>
        ${personBtns}
      </div>
      <button data-cancel style="background:none;border:none;color:#475569;font-size:13px;cursor:pointer;padding:0">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => {
    if (e.target === overlay || e.target.hasAttribute('data-cancel')) { overlay.remove(); return; }
    const btn = e.target.closest('[data-person]');
    if (btn) { printCueSheet(btn.dataset.person || null); overlay.remove(); }
  });
}

export function printCueSheet(highlightPerson = null) {
  const showName = activeShowName || 'Untitled Show';
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const cues = showConfig.cues || [];

  if (cues.length === 0) { alert('No cues to print.'); return; }

  const hasDividers = cues.some(c => c.isDivider);
  const allRows = [];

  const sectionHeadStyle = {
    'ACT 1':    'background:#1e293b;color:#fff;border-left:4px solid #3b82f6;',
    'INTERVAL': 'background:#fff8e1;color:#b45309;border-left:4px solid #f59e0b;',
    'ACT 2':    'background:#f0fdf4;color:#15803d;border-left:4px solid #22c55e;',
  };
  const sectionLabel = { 'ACT 1': '&#9654; Act 1', 'INTERVAL': '&#9646;&#9646; Interval', 'ACT 2': '&#9654; Act 2' };

  if (hasDividers) {
    allRows.push(`<tr><td colspan="6" style="${sectionHeadStyle['ACT 1']}padding:7px 10px;font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:0.08em">${sectionLabel['ACT 1']}</td></tr>`);
  }

  const colHeaders = `<tr>
    <th style="width:45%">Cue</th>
    <th style="width:10%">Bar</th>
    <th style="width:12%">Name</th>
    <th style="width:13%">Dead</th>
    <th style="width:9%">Speed</th>
    <th style="width:11%">Flyperson</th>
  </tr>`;

  const printDeadBadge = (barId, deadId) => {
    const label = getDeadLabel(barId, deadId);
    let bg, fg, border;
    if      (deadId === 'out')      { bg = '#ef4444'; fg = '#000'; border = '#b91c1c'; }
    else if (deadId === 'show-out') { bg = '#ef4444'; fg = '#fff'; border = '#fff'; }
    else if (deadId === 'grid-out' || deadId === 'max-out') { bg = '#ef4444'; fg = '#000'; border = '#000'; }
    else if (deadId === 'in')       { bg = '#fff';    fg = '#ef4444'; border = '#ef4444'; }
    else {
      const customs = showConfig.customDeads[barId] || [];
      const dead = customs.find(d => d.id === deadId);
      const hex = dead ? (BAND_COLORS.find(c => c.id === dead.bandColor) || { hex: '#888' }).hex : '#888';
      bg = '#f8f8f8'; fg = hex; border = hex;
    }
    return `<span style="background:${bg};color:${fg};border:2px solid ${border};border-radius:4px;padding:2px 8px;font-size:13px;font-weight:800">&rsaquo; ${esc(label)}</span>`;
  };
  const printDeadBadgeSmall = (barId, deadId) => {
    const label = getDeadLabel(barId, deadId);
    let bg, fg, border;
    if      (deadId === 'out')      { bg = '#ef4444'; fg = '#000'; border = '#b91c1c'; }
    else if (deadId === 'show-out') { bg = '#ef4444'; fg = '#fff'; border = '#fff'; }
    else if (deadId === 'grid-out' || deadId === 'max-out') { bg = '#ef4444'; fg = '#000'; border = '#000'; }
    else if (deadId === 'in')       { bg = '#fff';    fg = '#ef4444'; border = '#ef4444'; }
    else {
      const customs = showConfig.customDeads[barId] || [];
      const dead = customs.find(d => d.id === deadId);
      const hex = dead ? (BAND_COLORS.find(c => c.id === dead.bandColor) || { hex: '#888' }).hex : '#888';
      bg = '#f8f8f8'; fg = hex; border = hex;
    }
    return `<span style="background:${bg};color:${fg};border:1px solid ${border};border-radius:3px;padding:1px 5px;font-size:10px;font-weight:800">&rsaquo; ${esc(label)}</span>`;
  };

  for (const cue of cues) {
    if (cue.isDivider) {
      const secName = cue.dividerType === 'interval_start' ? 'INTERVAL' : 'ACT 2';
      allRows.push(`<tr><td colspan="6" style="${sectionHeadStyle[secName]}padding:7px 10px;font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:0.08em">${sectionLabel[secName]}</td></tr>`);
      continue;
    }

    const typeLabel = cue.isNonFly ? '(Non-Fly)' : '(Fly)';

    // Highlight logic
    const cueIsForPerson = highlightPerson && (
      cue.flyperson === highlightPerson ||
      (cue.bars || []).some(cb => cb.flyperson === highlightPerson)
    );
    const hlBg      = cueIsForPerson ? '#fff8e1' : '';
    const hlAccent  = cueIsForPerson ? '#f59e0b' : null;
    const hlDimmed  = highlightPerson && !cueIsForPerson;

    // ── PRESHOW: compact single row, muted ─────────────────────────────────
    if (cue.isPreshow) {
      const preshowBars = (cue.bars || []).map(cb => {
        const bar = bars.find(b => b.id === cb.barId);
        const barLabel = `Bar ${cb.barId}${bar && bar.name !== `Bar ${bar.id}` ? ` (${bar.name})` : ''}`;
        let bg, fg, border;
        const d = cb.deadId;
        if      (d === 'out')      { bg = '#ef4444'; fg = '#000'; border = '#b91c1c'; }
        else if (d === 'show-out') { bg = '#ef4444'; fg = '#fff'; border = '#fff'; }
        else if (d === 'grid-out' || d === 'max-out') { bg = '#ef4444'; fg = '#000'; border = '#000'; }
        else if (d === 'in')       { bg = '#fff';    fg = '#ef4444'; border = '#ef4444'; }
        else {
          const customs = showConfig.customDeads[cb.barId] || [];
          const dead = customs.find(x => x.id === d);
          const hex = dead ? (BAND_COLORS.find(c => c.id === dead.bandColor) || { hex: '#888' }).hex : '#888';
          bg = '#f8f8f8'; fg = hex; border = hex;
        }
        return `<span style="white-space:nowrap;background:${bg};color:${fg};border:2px solid ${border};border-radius:4px;padding:1px 6px;font-size:10px;font-weight:800">${esc(barLabel)}</span>`;
      }).join('<span style="color:#ccc"> · </span>');
      allRows.push(`<tr class="preshow-row">
        <td colspan="6" style="padding:4px 10px 4px 14px;font-size:11px;border-left:3px solid #d97706;background:#fffdf5;border-bottom:1px solid #f0e8d0;line-height:1.6">
          <strong style="color:#b45309;font-style:normal;margin-right:6px">PRESHOW</strong>${preshowBars}
        </td>
      </tr>`);

      // ── Preshow checklist rows ──────────────────────────────
      const pcl = showConfig.preshowChecklist || {};
      const clr = pcl.clearance || {};
      const ss  = pcl.showStats  || {};
      const ho  = ss.houseOpen   || {};
      if (clr.enabled) {
        const clPerson = clr.person || '';
        const isForMe = highlightPerson && clPerson === highlightPerson;
        const clDim   = highlightPerson && !isForMe ? 'opacity:0.45' : '';
        allRows.push(`<tr style="background:${isForMe ? '#fff8e1' : '#f0f9ff'};${clDim}">
          <td colspan="6" style="padding:5px 10px 5px 14px;font-size:13px;border-left:3px solid #0ea5e9;border-bottom:1px solid #e0f2fe">
            <strong style="color:#0369a1">✅ Receive Clearance</strong>${clPerson ? ` <span style="color:#555">→ from</span> <strong style="color:#1e40af">${esc(clPerson)}</strong>` : ''}
          </td>
        </tr>`);
      }
      if (ss.enabled) {
        allRows.push(`<tr style="background:#f0fdf4">
          <td colspan="6" style="padding:5px 10px 5px 14px;font-size:12px;border-left:3px solid #22c55e;border-bottom:1px solid #dcfce7">
            <strong style="color:#15803d">📊 Show Stats</strong>
            <span style="color:#555;margin-left:6px">Get Numbers from Front of House and pass to DSM</span>
            <span style="color:#888;font-size:11px;margin-left:4px">(Total house · access needs · circle/boxes open)</span>
          </td>
        </tr>`);
        if (ho.enabled) {
          allRows.push(`<tr style="background:#f0fdf4">
            <td colspan="6" style="padding:4px 10px 4px 28px;font-size:12px;border-left:3px solid #22c55e;border-bottom:1px solid #dcfce7;color:#555">
              ↳ <strong style="color:#15803d">House Open check:</strong>${ho.note ? ` ${esc(ho.note)}` : ''}
            </td>
          </tr>`);
        }
      }
      continue;
    }

    const goesWithTag = cue.goesWith
      ? ` &nbsp;<span style="background:#d1fae5;color:#065f46;border:1px solid #6ee7b7;border-radius:4px;padding:1px 7px;font-size:12px;font-weight:700">goes with ${esc(cue.goesWith)}</span>`
      : '';
    const cueCell = cue.isFollow
      ? `<span style="font-weight:700;color:#5b21b6">&#9654; FOLLOW${cue.name ? ' &mdash; ' + esc(cue.name) : ''} <span style="font-size:0.85em;font-weight:600">(${typeLabel.slice(1,-1)})</span></span>${goesWithTag}`
      : cue.number
        ? `<strong>Cue ${esc(cue.number)}</strong>${cue.name ? ` &mdash; ${esc(cue.name)}` : ''} <span style="font-size:0.85em;font-weight:600;color:#555">${typeLabel}</span>${goesWithTag}`
        : `<em>${esc(cue.name || 'uncalled')}</em> <span style="font-size:0.85em;font-weight:600;color:#555">${typeLabel}</span>${goesWithTag}`;
    const rowBg = hlBg || (cue.isFollow ? '#f3f0ff' : cue.isNonFly ? '#f5f0ff' : '');
    const accentColor = hlAccent || (cue.isNonFly ? '#7c3aed' : cue.isFollow ? '#5b21b6' : '#1e40af');
    const dimStyle = hlDimmed ? 'opacity:0.45' : '';

    const notesRow = cue.isNonFly && cue.notes
      ? `<tr style="background:${rowBg || '#f5f0ff'};${dimStyle}"><td style="border-left:4px solid transparent" colspan="6"><em style="color:#5b21b6;font-size:13px;padding:3px 10px 6px 10px;display:block">📝 ${esc(cue.notes)}</em></td></tr>`
      : '';

    if (cue.isNonFly) {
      const personTag = cue.flyperson ? ` &nbsp;<span style="background:#dbeafe;color:#1e40af;border-radius:4px;padding:1px 7px;font-size:12px;font-weight:700">${esc(cue.flyperson)}</span>` : '';
      allRows.push(`<tr class="cue-first-row" style="background:${rowBg || '#f5f0ff'};${dimStyle}">
        <td style="border-left:4px solid ${accentColor};padding:9px 10px;font-size:15px" colspan="6">${cueCell}${personTag}</td>
      </tr>${notesRow}`);
      continue;
    }
    if (!cue.bars || cue.bars.length === 0) {
      allRows.push(`<tr class="cue-first-row" style="background:${rowBg};${dimStyle}">
        <td style="border-left:4px solid ${accentColor};padding:9px 10px;font-size:15px" colspan="6">${cueCell}&nbsp;&mdash;&nbsp;<em style="color:#888">no bars</em></td>
      </tr>${notesRow}`);
      continue;
    }
    allRows.push(cue.bars.map((cb, bi) => {
      const bar = bars.find(b => b.id === cb.barId);
      const barName = bar && bar.name !== `Bar ${bar.id}` ? bar.name : '';
      const bricks = bar ? barTotalCwBricks(bar) : 0;
      const isHeavy = bricks >= 30;
      const barHl = highlightPerson && cb.flyperson === highlightPerson ? '#fff8e1' : (bi === 0 ? rowBg : '');
      const barDim = highlightPerson && cb.flyperson !== highlightPerson && !cueIsForPerson ? 'opacity:0.45' : (hlDimmed ? dimStyle : '');
      return `<tr class="${bi === 0 ? 'cue-first-row' : 'cue-cont-row'}" style="background:${barHl};border-top:${bi === 0 ? '3px solid #94a3b8' : 'none'};${barDim}">
        <td style="border-left:4px solid ${bi === 0 ? accentColor : 'transparent'};padding:9px 10px;font-size:15px;font-weight:700">${bi === 0 ? cueCell : ''}</td>
        <td style="padding:9px 10px;font-size:15px;font-weight:700;white-space:nowrap">Bar ${cb.barId}${cb.barId === 1 ? ' &#9888;' : ''}</td>
        <td style="padding:9px 10px;font-size:14px;color:#444">${esc(barName)}</td>
        <td style="padding:9px 10px">${printDeadBadge(cb.barId, cb.deadId)}</td>
        <td style="padding:9px 10px;font-size:14px">${cb.time ? `<strong style="color:#1e40af">&#9201; ${esc(cb.time)}</strong>` : esc(cb.speed)}</td>
        <td style="padding:9px 10px;font-size:14px">${cb.flyperson ? esc(cb.flyperson) : ''}${isHeavy ? ` <strong style="color:#b91c1c">&#9888; HEAVY (${bricks}b)</strong>` : ''}</td>
      </tr>`;
    }).join(''));
  }
  const mainTable = `<table>
  <thead>${colHeaders}</thead>
  <tbody>${allRows.join('')}</tbody>
</table>`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Fly Cue Sheet — ${esc(showName)}</title>
<style>
  @page { size: A4 portrait; margin: 15mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; font-size: 15px; }
  h1 { font-size: 22px; font-weight: 900; letter-spacing: 0.5px; margin-bottom: 2px; }
  .meta { font-size: 13px; color: #555; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1e293b; color: #fff; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; padding: 6px 10px; text-align: left; }
  td { border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
  tr.cue-first-row td { border-top: 3px solid #94a3b8; }
  tr.preshow-row td { border-top: 1px solid #f0e8d0; }
</style>
</head>
<body>
<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
  <div style="flex:1">
    <h1>TBTL Fly Cue Sheet</h1>
    ${highlightPerson ? `<div style="background:#1e293b;color:#fbbf24;border-radius:6px;padding:8px 16px;margin:6px 0 4px;font-size:22px;font-weight:900;letter-spacing:0.5px;display:inline-block">FOR: ${esc(highlightPerson.toUpperCase())}</div><br>` : ''}
    <div class="meta">${esc(showName)} &nbsp;&bull;&nbsp; Max flypersons: ${showConfig.maxFlymen} &nbsp;&bull;&nbsp; Printed ${dateStr}</div>
  </div>
  <div style="flex-shrink:0;text-align:center">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(showConfig.printQrUrl || 'https://odwales20.github.io/TBTL-fly-calculator/')}" width="80" height="80" style="display:block;border:2px solid #e5e7eb;border-radius:4px">
    <div style="font-size:9px;color:#888;margin-top:3px">TBTL Fly Calc</div>
  </div>
</div>
${mainTable}
<script>window.onload = function(){ window.print(); }; window.onafterprint = function(){ window.close(); };<\/script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

export function printSchedule() {
  const showName = activeShowName || 'Untitled Show';
  const dateStr = new Date().toLocaleDateString('en-GB', {day:'2-digit', month:'long', year:'numeric'});
  const dnfBars = bars.filter(b => b.dnf);

  const dnfAlert = dnfBars.length > 0
    ? `<div class="print-dnf-alert">⛔ DO NOT FLY BARS: ${dnfBars.map(b => `Bar ${b.id}${b.name !== `Bar ${b.id}` ? ` (${b.name})` : ''}`).join(', ')}</div>`
    : '';

  const rows = bars.map(bar => {
    const hung = hungLoad(bar);
    const cw = hung * 2;
    const bricks = calcBricks(cw);
    const isBar1 = bar.id === 1;

    const catCounts = {};
    bar.fixtures.forEach(f => { const c = f.category || 'Other'; catCounts[c] = (catCounts[c] || 0) + f.qty; });
    const parts = [];
    if (isBar1) parts.push('Cinema Screen (permanent)');
    if (catCounts['Lighting']) parts.push(`${catCounts['Lighting']} ${catCounts['Lighting']===1?'Fixture':'Fixtures'}`);
    if (catCounts['Sound'])    parts.push(`${catCounts['Sound']} Sound ${catCounts['Sound']===1?'Item':'Items'}`);
    if (catCounts['Drapes'])   parts.push(`${catCounts['Drapes']} ${catCounts['Drapes']===1?'Drape':'Drapes'}`);
    if (catCounts['Set'])      parts.push(`${catCounts['Set']} Set ${catCounts['Set']===1?'Piece':'Pieces'}`);
    if (catCounts['Other'])    parts.push(`${catCounts['Other']} ${catCounts['Other']===1?'Item':'Items'}`);
    if (bar.extensions) parts.push('Extensions');
    if (bar.iwb) parts.push(`IWB (${IWB_COLOURS.find(c=>c.id===bar.iwb)?.label || bar.iwb})`);
    if (bar.cable) parts.push('Cable');
    const contents = parts.join(', ') || '—';

    const statusParts = [];
    if (isBar1) statusParts.push('🔒 LOCKED');
    if (bar.dnf) statusParts.push('⛔ DO NOT FLY');
    const status = statusParts.join(' · ') || '—';

    const rowClass = bar.dnf ? 'dnf-row' : isBar1 ? 'locked-row' : hung === 0 ? 'empty-row' : '';
    const noteRow = bar.note ? `<tr class="${rowClass}"><td></td><td colspan="6" style="color:#555;font-style:italic;padding-left:6px">📝 ${esc(bar.note)}</td></tr>` : '';
    return `<tr class="${rowClass}">
      <td style="font-weight:700;white-space:nowrap">BAR ${bar.id}</td>
      <td>${bar.name !== `Bar ${bar.id}` ? bar.name : '—'}</td>
      <td>${contents}</td>
      <td style="text-align:right">${hung > 0 ? hung.toFixed(1) : '—'}</td>
      <td style="text-align:right">${hung > 0 ? cw.toFixed(1) : '—'}</td>
      <td class="print-bricks" style="text-align:right">${hung > 0 ? bricks.full : '—'}</td>
      <td class="${bar.dnf ? 'dnf-cell' : ''}">${status}</td>
    </tr>${noteRow}`;
  }).join('');

  document.getElementById('print-section').innerHTML = `
    <div class="print-header">
      <h2>TBTL Fly Weight Schedule</h2>
      <p>${showName} &nbsp;·&nbsp; Printed ${dateStr}</p>
    </div>
    ${dnfAlert}
    <table class="print-table">
      <thead><tr>
        <th>Bar</th><th>Name</th><th>Contents</th>
        <th style="text-align:right">Hung (kg)</th>
        <th style="text-align:right">CW (kg)</th>
        <th style="text-align:right">Bricks</th>
        <th>Status</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  window.print();
}

let _namesEditorShow = null;

export function openNamesEditor(showName) {
  const show = shows[showName];
  if (!show || !show.bars) return;
  _namesEditorShow = showName;

  const rows = show.bars.map(b => {
    const defaultName = `Bar ${b.id}`;
    const currentName = (b.name && b.name !== defaultName) ? b.name : '';
    return `<tr>
      <td>Bar ${b.id}</td>
      <td><input class="names-inp" id="nme_${b.id}" type="text" value="${esc(currentName)}" placeholder="e.g. LX 1 (Magenta)"></td>
    </tr>`;
  }).join('');

  document.getElementById('names-modal-root').innerHTML = `
    <div class="names-modal-overlay" onclick="closeNamesEditor(event)">
      <div class="names-modal" onclick="event.stopPropagation()">
        <div class="names-modal-title">Edit Bar Names — ${esc(showName)}</div>
        <div class="names-modal-subtitle">Add a description for each bar. Leave blank to keep the default.</div>
        <table class="names-table">
          <thead><tr><th>Bar</th><th>Name / Description</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="names-modal-btns">
          <button class="btn-names-cancel" onclick="closeNamesEditor()">Cancel</button>
          <button class="btn-names-save" onclick="saveNamesEdit()">Save Names</button>
        </div>
      </div>
    </div>
  `;
}

export function closeNamesEditor(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('names-modal-root').innerHTML = '';
  _namesEditorShow = null;
}

export async function saveNamesEdit() {
  const showName = _namesEditorShow;
  const show = shows[showName];
  if (!show) return;

  show.bars.forEach(b => {
    const inp = document.getElementById(`nme_${b.id}`);
    if (!inp) return;
    const val = inp.value.trim();
    b.name = val || `Bar ${b.id}`;
  });

  shows[showName] = show;
  saveLocal('tbtl_shows_v1', shows);

  // If this is the active show, update live bars too
  if (activeShowName === showName) {
    show.bars.forEach(sb => {
      const lb = bars.find(b => b.id === sb.id);
      if (lb) lb.name = sb.name;
    });
    render();
  }

  try {
    setSyncStatus('syncing', 'Saving names...');
    await firebasePut('shows', shows);
    setSyncStatus('online', `Names saved to "${showName}" · ${new Date().toLocaleTimeString()}`);
  } catch(e) {
    setSyncStatus('offline', 'Names saved locally (Firebase offline)');
  }

  document.getElementById('names-modal-root').innerHTML = '';
  _namesEditorShow = null;
}

// ── Expose all functions called from inline HTML handlers ────
window.render = render;
window.switchPage = switchPage;
window.toggleHideShowTab = toggleHideShowTab;
window.setCurrentUser = setCurrentUser;
window.toggleEditMode = toggleEditMode;
window.openManageUsersModal = openManageUsersModal;
window.closeManageUsersModal = closeManageUsersModal;
window.setUserPerm = setUserPerm;
window.addUser = addUser;
window.removeUser = removeUser;
window.clearHistory = clearHistory;
window.forceSave = () => import('./firebase.js').then(m => m.forceSave());
window.toggleShowsPanel = toggleShowsPanel;
window.loadShow = loadShow;
window.loadBackup = loadBackup;
window.toggleBackupsList = toggleBackupsList;
window.saveShow = saveShow;
window.deleteShow = deleteShow;
window.overrideShow = overrideShow;
window.openNewShowModal = openNewShowModal;
window.closeNewShowModal = closeNewShowModal;
window.confirmNewShow = confirmNewShow;
window.promptSaveShow = promptSaveShow;
window.resetAll = resetAll;
window.toggleBar = toggleBar;
window.toggleNotInUse = toggleNotInUse;
window.toggleExtensions = toggleExtensions;
window.selectIWB = selectIWB;
window.toggleCable = toggleCable;
window.toggleDNF = toggleDNF;
window.toggleConduit = toggleConduit;
window.updateBarName = updateBarName;
window.updatePreview = updatePreview;
window.switchMode = switchMode;
window.addFixture = addFixture;
window.removeFixture = removeFixture;
window.updateQty = updateQty;
window.setBarPreshowDead = setBarPreshowDead;
window.updateBarNote = updateBarNote;
window.updateTare = updateTare;
window.updateMiscBricks = updateMiscBricks;
window.pickLib = pickLib;
window.moveBarConfig = moveBarConfig;
window.resetBarToDefault = resetBarToDefault;
window.startLibEdit = startLibEdit;
window.cancelLibEdit = cancelLibEdit;
window.saveLibEdit = saveLibEdit;
window.deleteLibItem = deleteLibItem;
window.addLibItem = addLibItem;
window.renderShowPage = renderShowPage;
window.generatePreshowCue = generatePreshowCue;
window.updatePreshowSpeed = updatePreshowSpeed;
window.updatePreshowFlyperson = updatePreshowFlyperson;
window.updatePreshowDead = updatePreshowDead;
window.saveShowConfig = saveShowConfig;
window.setMaxFlymen = setMaxFlymen;
window.addCustomDead = addCustomDead;
window.renameCustomDead = renameCustomDead;
window.removeCustomDead = removeCustomDead;
window.addCue = addCue;
window.insertCue = insertCue;
window.toggleCueFollow = toggleCueFollow;
window.toggleCueOverrideMax = toggleCueOverrideMax;
window.updateBarFlyperson = updateBarFlyperson;
window.updateCueBarSpeed = updateCueBarSpeed;
window.updateCueBarTime = updateCueBarTime;
window.toggleAddBarToCue = toggleAddBarToCue;
window.updateCueBarDeadOptions = updateCueBarDeadOptions;
window.confirmAddBarToCue = confirmAddBarToCue;
window.removeBarFromCue = removeBarFromCue;
window.moveCue = moveCue;
window.deleteCue = deleteCue;
window.addPosition = addPosition;
window.removePosition = removePosition;
window.addInterval = addInterval;
window.removeInterval = removeInterval;
window.setBarDefaultDead = setBarDefaultDead;
window.copyBarDeadConfig = copyBarDeadConfig;
window.openNamesEditor = openNamesEditor;
window.closeNamesEditor = closeNamesEditor;
window.saveNamesEdit = saveNamesEdit;
window.printCueSheet = printCueSheet;
window.showPrintDialog = showPrintDialog;
window.printSchedule = printSchedule;
window.toggleClearance = toggleClearance;
window.updateClearancePerson = updateClearancePerson;
window.toggleShowStats = toggleShowStats;
window.toggleHouseOpenCheck = toggleHouseOpenCheck;
window.updateHouseOpenNote = updateHouseOpenNote;

// showConfig must be a live getter so inline oninput handlers always get the current object
Object.defineProperty(window, 'showConfig', { get() { return State.showConfig; }, configurable: true });

// ── Init ─────────────────────────────────────────────────────
regeneratePreshowSilent();
saveLocal('tbtl_showconfig_v1', showConfig);
renderUserBar();
const _viewBanner = document.getElementById('view-mode-banner');
if (_viewBanner) _viewBanner.className = 'view-mode-banner' + (editMode ? '' : ' active');
render();
renderShows();
loadFromFirebase();

window.addEventListener('beforeunload', function(e) {
  if (saveTimeout !== null) {
    e.preventDefault();
    e.returnValue = '';
  }
});
