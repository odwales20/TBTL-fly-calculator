import { FULL, HALF, IWB_COLOURS, IWB_WEIGHT, CABLE_WEIGHT, CAT_COLOURS, esc, escAttr } from './constants.js';
import { bars, library, expanded, inputMode } from './state.js';
import { calcBricks, hungLoad, getMode, cradleBricksToHungLoad } from './bar-actions.js';

// Re-export for backwards compatibility
export { esc, escAttr };

export function libOptions() {
  const cats = {};
  library.forEach(f => {
    const cat = f.category || 'Other';
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(f);
  });
  const order = ['Lighting', 'Sound', 'Set', 'Drapes', 'Other'];
  return order.filter(c => cats[c]).map(cat =>
    `<optgroup label="${cat}">${cats[cat].map(f =>
      `<option value="${esc(f.name)}">${esc(f.name)} (${f.weight}kg)${f.exclusive ? ' ⚠ exclusive' : ''}</option>`
    ).join('')}</optgroup>`
  ).join('');
}

export function buildAddSection(barId) {
  const mode = getMode(barId);
  const weightInputs = mode === 'kg'
    ? `<input type="number" class="inp-kg" id="fweight_${barId}" placeholder="kg" step="0.1" oninput="updatePreview(${barId})">`
    : `<input type="number" class="inp-bricks" id="fbfull_${barId}" placeholder="Full" min="0" oninput="updatePreview(${barId})" style="background:#0f172a;border:1px solid #334155;border-radius:6px;color:#e2e8f0;padding:7px 8px;font-size:13px;outline:none;width:58px;">
       <span style="color:#818cf8;font-size:11px;align-self:center">F</span>
       <input type="number" class="inp-bricks" id="fbhalf_${barId}" placeholder="Half" min="0" oninput="updatePreview(${barId})" style="background:#0f172a;border:1px solid #334155;border-radius:6px;color:#e2e8f0;padding:7px 8px;font-size:13px;outline:none;width:58px;">
       <span style="color:#a78bfa;font-size:11px;align-self:center">H</span>`;

  const bricksNote = mode === 'bricks'
    ? `<div class="bricks-note">Enter cradle bricks — hung load stored automatically (÷2 for double purchase)</div>`
    : '';

  return `<div class="add-section" id="add_section_${barId}">
    <div class="add-section-title">Add fixture to bar</div>
    <div class="add-row" style="margin-bottom:8px">
      <select id="sel_${barId}" onchange="pickLib(${barId})">
        <option value="">— Pick from library —</option>
        ${libOptions()}
      </select>
      <span class="divider">or type below</span>
    </div>
    <div class="add-row">
      <input type="text" class="inp-name" id="fname_${barId}" placeholder="Fixture name">
      <select id="fcat_${barId}" style="background:#0f172a;border:1px solid #334155;border-radius:6px;color:#94a3b8;padding:7px 8px;font-size:12px;outline:none;">
        <option value="">Category…</option>
        <option value="Lighting">Lighting</option>
        <option value="Sound">Sound</option>
        <option value="Set">Set</option>
        <option value="Drapes">Drapes</option>
      </select>
      <div class="mode-toggle">
        <button class="mode-btn ${mode==='kg'?'active':''}" onclick="switchMode(${barId},'kg')">by kg</button>
        <button class="mode-btn ${mode==='bricks'?'active':''}" onclick="switchMode(${barId},'bricks')">by bricks</button>
      </div>
      ${weightInputs}
      <span class="weight-preview" id="preview_${barId}"></span>
      <input type="number" class="inp-qty" id="fqty_${barId}" placeholder="Qty" value="1" min="1">
      <button class="btn-add" onclick="addFixture(${barId})">+ Add</button>
    </div>
    <div class="add-row" style="margin-top:4px">
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#f59e0b;cursor:pointer;">
        <input type="checkbox" id="fexclusive_${barId}" style="accent-color:#f59e0b;">
        Exclusive use — this item takes the full bar (no other items can be added)
      </label>
    </div>
    ${bricksNote}
  </div>`;
}

export function renderSummary() {
  const totalHung = bars.reduce((s,b) => s + hungLoad(b), 0);
  const totalCW = totalHung * 2;
  const totalFull = bars.reduce((s,b) => s + calcBricks(hungLoad(b)*2).full, 0);
  const loadedCount = bars.filter(b => hungLoad(b) > 0).length;
  const extCount = bars.filter(b => b.extensions).length;
  const iwbCount = bars.filter(b => b.iwb !== null).length;
  const iwbInUse = IWB_COLOURS.filter(c => bars.some(b => b.iwb === c.id)).map(c => c.label);
  const totalBars = bars.length;

  document.getElementById('summary').innerHTML = [
    ['Loaded Bars', `${loadedCount}/${totalBars}`, '#22c55e'],
    ['Bars w/ Extensions', extCount, '#34d399'],
    ['Bars w/ IWB', iwbCount > 0 ? `${iwbCount} (${iwbInUse.join(', ')})` : '0', '#fb923c'],
    ['Total Hung Load', `${totalHung.toFixed(1)} kg`, '#f1f5f9'],
    ['Total Counterweight', `${totalCW.toFixed(1)} kg`, '#fbbf24'],
    ['Total 12kg Bricks', totalFull, '#818cf8'],
  ].map(([l,v,c]) => `
    <div class="card">
      <div class="card-label">${l}</div>
      <div class="card-value" style="color:${c}">${v}</div>
    </div>
  `).join('');
}

export function renderBar(bar) {
  const hung = hungLoad(bar);
  const cw = hung * 2;
  const bricks = calcBricks(cw);
  const loaded = hung > 0;
  const exp = !!expanded[bar.id];

  const isExclusive = bar.fixtures.some(f => f.exclusive);

  const cinemaRow = bar.id === 1 ? `
    <tr style="background:#1e1b2e">
      <td style="color:#c084fc;font-weight:600">Cinema Screen
        <span style="font-size:10px;color:#7c3aed;font-weight:700;margin-left:4px;background:#2e1065;padding:1px 5px;border-radius:4px">PERMANENT</span>
      </td>
      <td class="c muted">—</td>
      <td class="r muted">N/A</td>
      <td class="r muted">N/A</td>
      <td class="r muted">N/A</td>
      <td></td>
      <td></td>
    </tr>` : '';

  const fixtureRows = bar.fixtures.map(f => {
    const catCol = CAT_COLOURS[f.category] || '#475569';
    const catBadge = f.category ? `<span style="font-size:10px;color:${catCol};font-weight:700;margin-left:4px">[${f.category}]</span>` : '';
    const excBadge = f.exclusive ? `<span style="font-size:10px;color:#f59e0b;font-weight:700;margin-left:4px">⚠ EXCL</span>` : '';
    const isDrape = f.category === 'Drapes';
    const conduitCell = isDrape
      ? `<td style="text-align:center;white-space:nowrap">
           <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:11px;color:${f.conduit?'#a78bfa':'#475569'}">
             <input type="checkbox" ${f.conduit?'checked':''} onchange="toggleConduit(${bar.id},${f.id})" style="accent-color:#a78bfa;">
             Conduit
           </label>
         </td>`
      : '<td></td>';
    const cwBricks = ((f.weight * f.qty * 2) + (f.conduit ? 12 : 0)) / 12;
    return `
    <tr>
      <td>${esc(f.name)}${catBadge}${excBadge}${f.conduit?'<span style="font-size:10px;color:#a78bfa;font-weight:700;margin-left:4px">+CONDUIT</span>':''}</td>
      <td class="c">
        <input type="number" class="qty-inp" min="1" value="${f.qty}"
          onchange="updateQty(${bar.id},${f.id},this.value)"
          style="background:#0f172a;border:1px solid #334155;border-radius:5px;color:#e2e8f0;font-size:12px;">
      </td>
      <td class="r muted">${f.weight.toFixed(1)}</td>
      <td class="r yellow">${(f.weight*f.qty).toFixed(1)}</td>
      <td class="r" style="color:#818cf8">${cwBricks.toFixed(2)}</td>
      ${conduitCell}
      <td class="r">${bar.id !== 1 ? `<button class="remove-btn" onclick="removeFixture(${bar.id},${f.id})" aria-label="Remove ${esc(f.name)} from Bar ${bar.id}">✕</button>` : ''}</td>
    </tr>`;
  }).join('');

  const extRow = bar.extensions ? `
    <tr style="border-top:1px solid #0f172a">
      <td style="color:#34d399">Extensions (1 pair)</td>
      <td class="c muted">—</td>
      <td class="r muted">12.0</td>
      <td class="r" style="color:#34d399;font-weight:700">12.0</td>
      <td class="r" style="color:#818cf8">2.00</td>
      <td></td>
    </tr>
  ` : '';

  const iwbCol = bar.iwb ? IWB_COLOURS.find(c => c.id === bar.iwb) : null;
  const iwbRow = iwbCol ? `
    <tr style="border-top:1px solid #0f172a">
      <td style="color:${iwbCol.text};font-weight:700">IWB <span style="font-size:10px;background:${iwbCol.bg};border:1px solid ${iwbCol.border}66;border-radius:3px;padding:1px 5px">${iwbCol.label}</span></td>
      <td class="c muted">—</td>
      <td class="r muted">${IWB_WEIGHT.toFixed(1)}</td>
      <td class="r" style="color:${iwbCol.text};font-weight:700">${IWB_WEIGHT.toFixed(1)}</td>
      <td class="r" style="color:#818cf8">8.00</td>
      <td></td>
    </tr>
  ` : '';

  const cableRow = bar.cable ? `
    <tr>
      <td style="color:#7dd3fc">Cable Allowance</td>
      <td class="c muted">—</td>
      <td class="r muted">${CABLE_WEIGHT.toFixed(1)}</td>
      <td class="r" style="color:#7dd3fc;font-weight:700">${CABLE_WEIGHT.toFixed(1)}</td>
      <td class="r" style="color:#818cf8">1.00</td>
      <td></td>
    </tr>
  ` : '';

  const totalsRow = loaded ? `
    <tr style="border-top:2px solid #334155">
      <td colspan="3" class="muted" style="font-size:11px">Total hung load</td>
      <td class="r white">${hung.toFixed(1)}</td>
      <td class="r" style="color:#818cf8;font-weight:700">${(hung*2/12).toFixed(2)}</td>
      <td></td>
    </tr>
  ` : '';

  const brickCW = bricks.full * FULL;
  const breakdownHtml = loaded ? `
    <div class="breakdown">
      <span>Counterweight (×2): <strong style="color:#fbbf24">${cw.toFixed(1)} kg</strong></span>
      <span>12kg Bricks: <strong style="color:#818cf8">${bricks.full}</strong></span>
      <span>Total in cradle: <strong style="color:#22c55e">${brickCW} kg</strong></span>
      ${brickCW > cw ? `<span style="color:#f59e0b;font-size:11px">(+${(brickCW-cw).toFixed(1)} kg rounding up to nearest brick)</span>` : ''}
    </div>
  ` : '';

  const catCounts = {};
  bar.fixtures.forEach(f => { const c = f.category || 'Other'; catCounts[c] = (catCounts[c] || 0) + f.qty; });
  const summaryParts = [];
  if (bar.id === 1) summaryParts.push('Cinema Screen');
  if (catCounts['Lighting']) summaryParts.push(`${catCounts['Lighting']} ${catCounts['Lighting']===1?'Fixture':'Fixtures'}`);
  if (catCounts['Sound'])    summaryParts.push(`${catCounts['Sound']} Sound ${catCounts['Sound']===1?'Item':'Items'}`);
  if (catCounts['Drapes'])   summaryParts.push(`${catCounts['Drapes']} ${catCounts['Drapes']===1?'Drape':'Drapes'}`);
  if (catCounts['Set'])      summaryParts.push(`${catCounts['Set']} Set ${catCounts['Set']===1?'Piece':'Pieces'}`);
  if (catCounts['Other'])    summaryParts.push(`${catCounts['Other']} ${catCounts['Other']===1?'Item':'Items'}`);
  if (bar.extensions) summaryParts.push('Extensions');
  if (bar.iwb) summaryParts.push(`IWB (${IWB_COLOURS.find(c=>c.id===bar.iwb)?.label || ''})`);
  const noteIndicator = bar.note ? ' <span style="font-size:10px;color:#60a5fa" title="Has notes">📝</span>' : '';
  const summaryText = (summaryParts.length > 0 ? summaryParts.join(' · ') : 'Empty') + noteIndicator;

  const bodyHtml = exp ? `
    <div class="bar-body">
      <div class="tare-row">
        Bar name:
        <input type="text" value="${esc(bar.name)}"
          onblur="updateBarName(${bar.id},this.value)"
          style="background:#0f172a;border:1px solid #334155;border-radius:5px;color:#e2e8f0;padding:4px 8px;font-size:12px;width:140px;">
        <button onclick="moveBarConfig(${bar.id})" title="Move all config from this bar to another bar number"
          style="background:#0f172a;color:#60a5fa;border:1px solid #3b82f644;border-radius:5px;padding:4px 10px;font-size:11px;cursor:pointer;white-space:nowrap">Move to →</button>
        <button onclick="resetBarToDefault(${bar.id})" title="Clear all fixtures and mark bar Not In Use"
          style="background:#0f172a;color:#ef4444;border:1px solid #ef444433;border-radius:5px;padding:4px 10px;font-size:11px;cursor:pointer;white-space:nowrap">Reset</button>
      </div>
      <div class="tare-row" style="align-items:flex-start">
        <span style="font-size:12px;color:#475569;white-space:nowrap;padding-top:5px;min-width:42px">Notes:</span>
        <textarea rows="2" onblur="updateBarNote(${bar.id},this.value)" placeholder="Add a note for this bar…"
          style="background:#0f172a;border:1px solid #334155;border-radius:5px;color:#94a3b8;padding:6px 8px;font-size:12px;resize:vertical;flex:1;font-family:inherit;outline:none;width:100%">${esc(bar.note || '')}</textarea>
      </div>
      ${bar.id !== 1 ? `
      <div class="ext-section" style="flex-wrap:wrap;gap:8px">
        <div class="ext-info" style="min-width:100%">
          <strong>IWB</strong>
          <small>1 per bar · 1 per colour · 5 available · adds 8 bricks (96kg) to cradle</small>
        </div>
        ${IWB_COLOURS.map(col => {
          const onThisBar = bar.iwb === col.id;
          const ownerBar = bars.find(b => b.id !== bar.id && b.iwb === col.id);
          const label = onThisBar ? `✓ ${col.label}` : ownerBar ? `${col.label} → Bar ${ownerBar.id}` : col.label;
          const btnStyle = onThisBar
            ? `background:${col.bg};color:${col.text};border:2px solid ${col.border};border-radius:7px;padding:6px 12px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap`
            : ownerBar
              ? `background:#0f172a;color:#475569;border:1px solid #1e293b;border-radius:7px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;opacity:0.7`
              : `background:#0f172a;color:${col.text};border:1px solid ${col.border}44;border-radius:7px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap`;
          return `<button style="${btnStyle}" onclick="selectIWB(${bar.id},'${col.id}')">${label}</button>`;
        }).join('')}
        ${bar.iwb ? `<span class="ext-badge" style="background:${IWB_COLOURS.find(c=>c.id===bar.iwb).bg};color:${IWB_COLOURS.find(c=>c.id===bar.iwb).text};border:1px solid ${IWB_COLOURS.find(c=>c.id===bar.iwb).border}66">+8 bricks in cradle</span>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:4px 0">
        <div class="ext-section" style="margin:0">
          <div class="ext-info">
            <strong>Extensions</strong>
            <small>1 pair max · adds 2 bricks (24kg) to cradle</small>
          </div>
          ${bar.extensions ? `<span class="ext-badge" style="background:#14532d;color:#22c55e;border:1px solid #22c55e44">+2 bricks</span>` : ''}
          <button class="ext-btn ${bar.extensions ? 'on-green' : 'off'}" onclick="toggleExtensions(${bar.id})">
            ${bar.extensions ? '✓ In Use' : 'Not In Use'}
          </button>
        </div>
        <div class="ext-section" style="margin:0">
          <div class="ext-info">
            <strong style="color:#7dd3fc">Cable Allowance</strong>
            <small>+6kg hung (+1 brick)</small>
          </div>
          ${bar.cable ? `<span class="ext-badge" style="background:#0c2340;color:#7dd3fc;border:1px solid #7dd3fc44">+1 brick</span>` : ''}
          <button class="ext-btn ${bar.cable ? 'on-blue' : 'off'}" onclick="toggleCable(${bar.id})">
            ${bar.cable ? '✓ In Use' : 'Not In Use'}
          </button>
        </div>
      </div>
      ${(() => {
        const hasLS = (bar.fixtures||[]).some(f => f.category === 'Lighting' || f.category === 'Sound');
        const autoLabel = hasLS ? 'In dead (L/S)' : 'Out dead';
        const sel = bar.preshowDead;
        return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:4px 0">
        <div class="ext-section" style="margin:0">
          <div class="ext-info">
            <strong style="color:#a78bfa">Misc Bricks</strong>
            <small>+/− whole brick adjustment</small>
          </div>
          <input type="number" step="1"
            value="${bar.miscBricks || 0}"
            onchange="updateMiscBricks(${bar.id},this.value)"
            style="background:#0f172a;border:1px solid #334155;border-radius:6px;color:#a78bfa;padding:6px 8px;font-size:13px;font-weight:700;width:70px;text-align:center;">
        </div>
        <div class="ext-section" style="margin:0;flex-wrap:wrap;gap:4px">
          <div class="ext-info" style="min-width:100%">
            <strong style="color:#fbbf24">Preshow Position</strong>
            <small>Auto: ${autoLabel}</small>
          </div>
          <div class="mode-toggle">
            <button class="mode-btn ${!sel ? 'active' : ''}"              onclick="setBarPreshowDead(${bar.id},null)">Auto</button>
            <button class="mode-btn ${sel==='in' ? 'active' : ''}"        onclick="setBarPreshowDead(${bar.id},'in')">In</button>
            <button class="mode-btn ${sel==='out' ? 'active' : ''}"       onclick="setBarPreshowDead(${bar.id},'out')">Out</button>
            <button class="mode-btn ${sel==='show-out' ? 'active' : ''}"  onclick="setBarPreshowDead(${bar.id},'show-out')">Show Out</button>
            <button class="mode-btn ${sel==='max-out' ? 'active' : ''}"   onclick="setBarPreshowDead(${bar.id},'max-out')">Max Out</button>
          </div>
        </div>
      </div>`;
      })()}` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:4px 0">
        <div class="ext-section" style="margin:0;${bar.notInUse ? 'border:2px solid #78716c55;background:#1c1917;' : ''}">
          <div class="ext-info">
            <strong style="color:${bar.notInUse ? '#d6d3d1' : '#e2e8f0'}">Bar not in use for show</strong>
            <small>${bar.notInUse ? 'Excluded from preshow — adding equipment will clear this' : 'Mark as no dead / not being used this show'}</small>
          </div>
          ${bar.notInUse ? `<span class="ext-badge" style="background:#44403c;color:#d6d3d1;border:1px solid #78716c66">NOT IN USE</span>` : ''}
          <button class="${bar.notInUse ? 'dnf-btn-on' : 'dnf-btn-off'}" style="${bar.notInUse ? 'background:#44403c;border-color:#78716c;color:#d6d3d1;' : ''}" onclick="toggleNotInUse(${bar.id})">
            ${bar.notInUse ? 'Not in Use' : 'In Use'}
          </button>
        </div>
        <div class="ext-section" style="margin:0;${bar.dnf ? 'border:2px solid #ef444466;background:#1c0a0a;' : ''}">
          <div class="ext-info">
            <strong style="color:${bar.dnf ? '#fca5a5' : '#e2e8f0'}">⛔ Do Not Fly Tag</strong>
            <small>${bar.dnf ? 'This bar is tagged DO NOT FLY — it must not be moved' : 'Mark this bar as Do Not Fly'}</small>
          </div>
          ${bar.dnf ? `<span class="ext-badge" style="background:#7f1d1d;color:#fca5a5;border:1px solid #ef444466">⛔ TAGGED</span>` : ''}
          <button class="${bar.dnf ? 'dnf-btn-on' : 'dnf-btn-off'}" onclick="toggleDNF(${bar.id})">
            ${bar.dnf ? '⛔ DO NOT FLY' : 'Not Tagged'}
          </button>
        </div>
      </div>
      ${bar.id === 1 ? `
      <div style="background:#1e1b2e;border:1px solid #7c3aed44;border-radius:8px;padding:10px 14px;margin:8px 0;color:#c084fc;font-size:12px;font-weight:700;">
        🔒 BAR LOCKED — Bar 1 has a permanent cinema screen. No items can be added or removed.
      </div>` : isExclusive ? `
      <div style="background:#422006;border:1px solid #f59e0b44;border-radius:8px;padding:10px 14px;margin:8px 0;color:#fbbf24;font-size:12px;font-weight:700;">
        ⚠ BAR FULL — ${esc(bar.fixtures.find(f=>f.exclusive)?.name||'')} takes the full bar. No additional items can be added.
      </div>` : ''}
      ${(bar.id === 1 || bar.fixtures.length > 0 || bar.extensions || bar.iwb !== null || bar.cable) ? `
        <table>
          <thead><tr>
            <th>Item</th><th class="c">Qty</th>
            <th class="r">Unit kg</th><th class="r">Total kg</th><th class="r" style="color:#818cf8">Bricks</th><th></th>
          </tr></thead>
          <tbody>${cinemaRow}${fixtureRows}${extRow}${iwbRow}${cableRow}${totalsRow}</tbody>
        </table>
      ` : ''}
      ${breakdownHtml}
      ${(bar.id === 1 || isExclusive) ? '' : buildAddSection(bar.id)}
    </div>
  ` : '';

  return `
    ${(() => { const iwbC = bar.iwb ? IWB_COLOURS.find(c=>c.id===bar.iwb) : null; return `<div class="bar-wrap ${loaded ? 'loaded' : ''} ${(bar.id === 1 || isExclusive) ? 'exclusive' : ''} ${bar.dnf ? 'dnf' : ''} ${bar.notInUse ? 'not-in-use' : ''}" id="bar_${bar.id}" ${iwbC ? `style="border-left:4px solid ${iwbC.border};background:color-mix(in srgb, ${iwbC.bg} 30%, #1e293b)"` : ''}>`; })()}
      <div class="bar-header" role="button" tabindex="0" onclick="toggleBar(${bar.id})" onkeydown="if(event.key==='Enter'||event.key===' ')toggleBar(${bar.id})">
        ${(() => { const iwbC = bar.iwb ? IWB_COLOURS.find(c=>c.id===bar.iwb) : null; return `<span class="bar-num" ${iwbC ? `style="background:${iwbC.bg};color:${iwbC.text};border:1px solid ${iwbC.border}88"` : ''}>BAR ${bar.id}${bar.name !== `Bar ${bar.id}` ? ` · ${esc(bar.name)}` : ''}${bar.id === 1 ? ` <span style="color:#c084fc;font-size:10px;font-weight:800">🔒 LOCKED</span>` : isExclusive ? ` <span style="color:#f59e0b;font-size:10px;font-weight:800">BAR FULL</span>` : ''}${bar.dnf ? ` <span style="color:#fca5a5;font-size:10px;font-weight:800;background:#7f1d1d;padding:1px 5px;border-radius:3px">⛔ DO NOT FLY</span>` : ''}${bar.notInUse ? ` <span style="color:#d6d3d1;font-size:10px;font-weight:800;background:#44403c;padding:1px 5px;border-radius:3px">NOT IN USE</span>` : ''}${bar.liveFly ? ` <span style="color:#6ee7b7;font-size:10px;font-weight:800;background:#064e3b;padding:1px 5px;border-radius:3px">LIVE FLY</span>` : ''}</span>`; })()}
        <span class="bar-summary">${summaryText}</span>
        <div class="bar-stats">
          ${bar.extensions && !exp ? `<span style="color:#34d399;font-size:11px;font-weight:700">EXT</span>` : ''}
          ${bar.iwb && !exp ? `<span style="color:${IWB_COLOURS.find(c=>c.id===bar.iwb).text};font-size:11px;font-weight:700">IWB</span>` : ''}
          <span class="stat">Hung: <strong style="color:#f1f5f9">${hung.toFixed(1)} kg</strong></span>
          <span class="stat">CW: <strong style="color:#fbbf24">${cw.toFixed(1)} kg</strong></span>
          <span class="stat">Bricks: <strong style="color:#818cf8">${bricks.full}</strong></span>
        </div>
        <span class="chevron">${exp ? '▲' : '▼'}</span>
      </div>
      ${bodyHtml}
    </div>
  `;
}
