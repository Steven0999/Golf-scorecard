// ===== DOM Helpers & State =====
const el = id => document.getElementById(id);
const HISTORY_KEY = 'golf-history-v4'; // version with round picker & modal

// Burger / routing
const $burger = el('burger');
const $drawer = el('drawer');
const $drawerLinks = document.querySelectorAll('.drawer-link');

function openDrawer(open) {
  $drawer.classList.toggle('open', open);
  $drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
  $burger.setAttribute('aria-expanded', open ? 'true' : 'false');
}
$burger.addEventListener('click', () => openDrawer(!$drawer.classList.contains('open')));
$drawerLinks.forEach(btn => btn.addEventListener('click', () => {
  routeTo(btn.dataset.route);
  openDrawer(false);
}));

function routeTo(route) {
  document.querySelectorAll('.page').forEach(sec => {
    sec.hidden = sec.dataset.page !== route;
  });
  if (route === 'history') renderHistory();
  if (route === 'profiles') renderPlayerProfile();
  if (route === 'leaderboard') { rebuildCourseOptions(); renderCourseLeaderboard(); }
}
window.addEventListener('hashchange', () => {
  const route = location.hash.replace('#', '') || 'scorecard';
  routeTo(route);
});

// App data
let players = [];            // catalog of players
let roundPlayers = [];       // selected for current round
let state = { course:'', area:'', holes:18, scores:{}, par:[] };

// ===== Scorecard elements =====
const $course = el('course'), $area = el('area'), $holes = el('holes');
const $playerSelect = el('playerSelect');
const $playerList = el('playerList');
const $roundCount = el('roundCount');
const $roundPlayerSelect = el('roundPlayerSelect');

const $generate = el('generate'), $saveHistory = el('saveHistory');
const $workspace = el('workspace'), $summary = el('summary');

// ===== History elements =====
const $filterHistoryPlayer = el('filterHistoryPlayer'), $historyList = el('historyList'), $scoresChart = el('scoresChart');

// ===== Player Profiles =====
const $playerProfileSelect = el('playerProfileSelect'), $playerProfile = el('playerProfile');

// ===== Course Leaderboard =====
const $courseLeaderboardSelect = el('courseLeaderboardSelect'), $courseParInfo = el('courseParInfo'),
      $courseLeaderboardTable = el('courseLeaderboardTable'),
      $btnBest9 = el('btnBest9'), $btnBest18 = el('btnBest18');
let leaderboardMode = '9';

// ===== Storage =====
function saveHistoryItem(item) {
  const arr = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  arr.push(item);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
}
function loadHistory() {
  return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
}

// ===== Players (catalog) =====
function renderPlayerSelectsFromCatalog() {
  $playerSelect.innerHTML = players.map(p => `<option value="${p}">${p}</option>`).join('');
  $filterHistoryPlayer.innerHTML = '<option value="__all__">All</option>' + players.map(p => `<option value="${p}">${p}</option>`).join('');
  $playerProfileSelect.innerHTML = '<option value="__none__">Select...</option>' + players.map(p => `<option value="${p}">${p}</option>`).join('');
  $roundPlayerSelect.innerHTML = players.map(p => `<option value="${p}">${p}</option>`).join('');
  syncRoundSelectWithRoundPlayers();
  renderPlayerList();
}
function syncRoundSelectWithRoundPlayers() {
  [...$roundPlayerSelect.options].forEach(opt => { opt.selected = roundPlayers.includes(opt.value); });
}

// Manage Players list (edit / delete)
function renderPlayerList() {
  if (!players.length) { $playerList.innerHTML = '<div class="muted">No players yet.</div>'; return; }
  $playerList.innerHTML = players.map((p, idx) => `
    <div class="player-row" data-player="${p}">
      <div class="name">${p}</div>
      <div class="actions">
        <button class="btn" data-edit="${idx}">Edit</button>
        <button class="btn" data-delete="${idx}">Delete</button>
      </div>
    </div>
  `).join('');

  // edit
  $playerList.querySelectorAll('button[data-edit]').forEach(btn => {
    btn.onclick = () => {
      const i = parseInt(btn.dataset.edit, 10);
      const oldName = players[i];
      const row = btn.closest('.player-row');
      row.innerHTML = `
        <input type="text" value="${oldName}" />
        <div class="actions">
          <button class="btn" data-save="${i}">Save</button>
          <button class="btn" data-cancel="${i}">Cancel</button>
        </div>
      `;
      const input = row.querySelector('input[type="text"]');
      input.focus();
      row.querySelector('button[data-save]').onclick = () => {
        const newName = (input.value || '').trim();
        if (!newName || newName === oldName) { renderPlayerList(); return; }
        if (players.includes(newName)) { alert('A player with that name already exists.'); return; }
        players[i] = newName;
        const rpIdx = roundPlayers.indexOf(oldName);
        if (rpIdx !== -1) roundPlayers[rpIdx] = newName;
        if (state.scores[oldName]) { state.scores[newName] = state.scores[oldName]; delete state.scores[oldName]; }
        renderPlayerSelectsFromCatalog();
        renderWorkspace();
        renderSummary();
      };
      row.querySelector('button[data-cancel]').onclick = () => renderPlayerList();
    };
  });

  // delete
  $playerList.querySelectorAll('button[data-delete]').forEach(btn => {
    btn.onclick = () => {
      const i = parseInt(btn.dataset.delete, 10);
      const name = players[i];
      if (!confirm(`Delete player "${name}" from catalog?`)) return;
      players.splice(i, 1);
      roundPlayers = roundPlayers.filter(n => n !== name);
      delete state.scores[name];
      renderPlayerSelectsFromCatalog();
      renderWorkspace();
      renderSummary();
    };
  });
}

// Round selection logic
$roundPlayerSelect.addEventListener('change', () => {
  const countLimit = parseInt($roundCount.value || '1', 10);
  const chosen = [...$roundPlayerSelect.selectedOptions].map(o => o.value);
  if (chosen.length > countLimit) {
    alert(`You selected ${chosen.length}. Limit is ${countLimit}. Deselect some names or increase the count.`);
    syncRoundSelectWithRoundPlayers();
  } else {
    roundPlayers = chosen;
  }
});
$roundCount.addEventListener('input', () => {
  const limit = Math.max(1, Math.min(8, parseInt($roundCount.value || '1',10)));
  $roundCount.value = limit;
  const chosen = [...$roundPlayerSelect.selectedOptions].map(o => o.value);
  if (chosen.length > limit) {
    roundPlayers = chosen.slice(0, limit);
    syncRoundSelectWithRoundPlayers();
  }
});

// Generate scorecard for selected players
$generate.onclick = () => {
  state.course = $course.value.trim();
  state.area   = $area.value.trim();
  state.holes  = parseInt($holes.value, 10);

  const limit = parseInt($roundCount.value || '1', 10);
  if (roundPlayers.length === 0) { alert('Select at least one player for this round.'); return; }
  if (roundPlayers.length > limit) { alert(`You selected ${roundPlayers.length} players but limit is ${limit}.`); return; }

  if (!Array.isArray(state.par) || state.par.length !== state.holes) {
    state.par = Array.from({ length: state.holes }, () => 0);
  } else {
    state.par = state.par.slice(0, state.holes).concat(Array(Math.max(0, state.holes - state.par.length)).fill(0));
  }

  const prevScores = { ...state.scores };
  state.scores = {};
  roundPlayers.forEach(p => {
    const existing = prevScores[p] || [];
    state.scores[p] = Array.from({ length: state.holes }, (_, h) => existing[h] ?? 0);
  });

  renderWorkspace();
  renderSummary();
};

function renderWorkspace() {
  const playersInRound = Object.keys(state.scores);
  if (!playersInRound.length) { $workspace.innerHTML = '<div class="muted">Pick players and click Generate.</div>'; return; }

  let thead = '<tr><th class="left">Row</th>';
  for (let i = 1; i <= state.holes; i++) thead += `<th>H${i}</th>`;
  thead += '<th>Total</th></tr>';

  const parInputs = state.par.map((v, idx) =>
    `<td><input type="number" min="0" max="6" value="${v}" data-role="par" data-h="${idx}" style="width:56px"/></td>`
  ).join('');
  const parTotal = state.par.reduce((a, b) => a + (+b || 0), 0);
  const parRow = `<tr><td class="left">Par</td>${parInputs}<td>${parTotal}</td></tr>`;

  const bodyRows = playersInRound.map(p => {
    const tds = state.scores[p].map((v, idx) =>
      `<td><input type="number" min="0" value="${v}" data-role="stroke" data-p="${p}" data-h="${idx}" style="width:56px"/></td>`
    ).join('');
    const total = state.scores[p].reduce((a, b) => a + (+b || 0), 0);
    return `<tr><td class="left">${p}</td>${tds}<td>${total}</td></tr>`;
  }).join('');

  $workspace.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>${thead}</thead>
        <tbody>${parRow}${bodyRows}</tbody>
      </table>
    </div>
  `;

  $workspace.querySelectorAll('input[data-role="par"]').forEach(inp => {
    inp.oninput = () => {
      const h = parseInt(inp.dataset.h, 10);
      state.par[h] = Math.max(0, Math.min(20, parseInt(inp.value || '0', 10)));
      renderWorkspace();
      renderSummary();
    };
  });
  $workspace.querySelectorAll('input[data-role="stroke"]').forEach(inp => {
    inp.oninput = () => {
      const p = inp.dataset.p;
      const h = parseInt(inp.dataset.h, 10);
      state.scores[p][h] = Math.max(0, Math.min(30, parseInt(inp.value || '0', 10)));
      renderWorkspace();
      renderSummary();
    };
  });
}

function renderSummary() {
  const playersInRound = Object.keys(state.scores);
  if (!playersInRound.length) { $summary.innerHTML = ''; return; }
  const parTotal = state.par.reduce((a, b) => a + (+b || 0), 0);
  let html = '<h3>Summary</h3><div class="table-wrap"><table><thead><tr><th class="left">Player</th><th>Total</th><th>Par</th><th>±Par</th></tr></thead><tbody>';
  playersInRound.forEach(p => {
    const total = state.scores[p].reduce((a, b) => a + (+b || 0), 0);
    const toPar = total - parTotal;
    const tag = `${toPar >= 0 ? '+' : ''}${toPar}`;
    html += `<tr><td class="left">${p}</td><td>${total}</td><td>${parTotal}</td><td>${tag}</td></tr>`;
  });
  html += '</tbody></table></div>';
  $summary.innerHTML = html;
}

// Save round (stores EVERY HOLE: scores + par)
$saveHistory.onclick = () => {
  const playersInRound = Object.keys(state.scores);
  if (!playersInRound.length) { alert('Generate a scorecard first.'); return; }
  const item = {
    id: Date.now(),
    ts: new Date().toISOString(),
    course: state.course,
    area: state.area,
    holes: state.holes,
    scores: state.scores,   // { playerName: [h1..] }
    par: state.par          // [p1..]
  };
  saveHistoryItem(item);
  renderHistory();
  renderPlayerProfile();
  rebuildCourseOptions();
  alert('Round saved to history.');
};

// ===== HISTORY PAGE =====
function renderHistory() {
  const hist = loadHistory();
  const filter = $filterHistoryPlayer.value;
  const list = hist.filter(m => filter === '__all__' || Object.keys(m.scores).includes(filter));

  $historyList.innerHTML = list.map(m => {
    const date = new Date(m.ts).toLocaleString();
    const totals = Object.entries(m.scores)
      .map(([p, sc]) => `${p}: ${sc.reduce((a, b) => a + (+b || 0), 0)}`).join(', ');
    const hid = `h_${m.id}`;
    return `
      <div class="history-item">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div><strong>${m.course || 'Course'}</strong> • ${date} • ${m.holes} holes</div>
          <button class="btn" data-expand="${hid}">View Details</button>
        </div>
        <div class="muted" style="margin-top:6px">${totals}</div>
        <div id="${hid}" class="table-wrap" style="display:none;margin-top:8px;"></div>
      </div>
    `;
  }).join('');

  // expand with per-hole table (including Par row)
  $historyList.querySelectorAll('button[data-expand]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.expand;
      const host = document.getElementById(id);
      const m = list.find(x => `h_${x.id}` === id);
      if (!m) return;
      if (host.dataset.loaded === '1') { host.style.display = host.style.display === 'none' ? 'block' : 'none'; return; }
      let thead = '<tr><th class="left">Row</th>';
      for (let i = 1; i <= m.holes; i++) thead += `<th>H${i}</th>`;
      thead += '<th>Total</th></tr>';

      const parTotal = m.par.slice(0, m.holes).reduce((a, b) => a + (+b || 0), 0);
      const parCells = m.par.slice(0, m.holes).map(v => `<td>${v}</td>`).join('');
      let tbody = `<tr><td class="left">Par</td>${parCells}<td>${parTotal}</td></tr>`;

      Object.entries(m.scores).forEach(([p, arr]) => {
        const cells = arr.slice(0, m.holes).map(v => `<td>${v}</td>`).join('');
        const total = arr.slice(0, m.holes).reduce((a, b) => a + (+b || 0), 0);
        tbody += `<tr><td class="left">${p}</td>${cells}<td>${total}</td></tr>`;
      });

      host.innerHTML = `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
      host.dataset.loaded = '1';
      host.style.display = 'block';
    };
  });

  drawChart(list, filter);
}

function drawChart(list, filter) {
  const ctx = $scoresChart.getContext('2d');
  ctx.clearRect(0, 0, $scoresChart.width, $scoresChart.height);
  if (!list.length) { ctx.fillStyle = '#9aa3b2'; ctx.fillText('No history yet', 20, 28); return; }

  const data = [];
  list.forEach(m => {
    Object.entries(m.scores).forEach(([p, sc]) => {
      if (filter === '__all__' || filter === p) {
        data.push({ player: p, t: new Date(m.ts).getTime(), y: sc.reduce((a, b) => a + (+b || 0), 0) });
      }
    });
  });
  data.sort((a, b) => a.t - b.t);

  const playersSet = [...new Set(data.map(d => d.player))];
  const pad = 40, W = $scoresChart.width, H = $scoresChart.height;
  const xmin = Math.min(...data.map(d => d.t)), xmax = Math.max(...data.map(d => d.t));
  const ymin = Math.min(...data.map(d => d.y)), ymax = Math.max(...data.map(d => d.y));
  const xscale = x => pad + ((x - xmin) / (xmax - xmin || 1)) * (W - 2 * pad);
  const yscale = y => H - pad - ((y - ymin) / (ymax - ymin || 1)) * (H - 2 * pad);

  // axes + grid
  ctx.strokeStyle = '#7b8bb2'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, H - pad); ctx.lineTo(W - pad, H - pad); ctx.stroke();
  ctx.fillStyle = '#7b8bb2'; ctx.font = '12px system-ui, sans-serif';
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const y = ymin + (i * (ymax - ymin) / steps);
    const yy = yscale(y);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.moveTo(pad, yy); ctx.lineTo(W - pad, yy); ctx.stroke();
    ctx.fillText(Math.round(y), 6, yy + 4);
  }

  // series
  const colors = ['#7c9cff', '#4cc38a', '#ff6b6b', '#ffa500', '#b07cff', '#4dd0e1'];
  playersSet.forEach((pl, i) => {
    const pts = data.filter(d => d.player === pl);
    ctx.beginPath(); ctx.strokeStyle = colors[i % colors.length]; ctx.lineWidth = 2;
    pts.forEach((pt, j) => {
      const xx = xscale(pt.t), yy = yscale(pt.y);
      if (j === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    });
    ctx.stroke();
    ctx.fillStyle = colors[i % colors.length];
    pts.forEach(pt => { const xx = xscale(pt.t), yy = yscale(pt.y); ctx.fillRect(xx - 2, yy - 2, 4, 4); });
    ctx.fillText(pl, W - 120, 24 + 16 * i);
  });
}

// ===== PLAYER PROFILES PAGE =====
function renderPlayerProfile() {
  const hist = loadHistory();
  const selected = $playerProfileSelect.value;
  if (selected === '__none__') { $playerProfile.innerHTML = '<div class="muted">Select a player to view history.</div>'; return; }
  const games = hist.filter(m => Object.keys(m.scores).includes(selected));
  if (!games.length) { $playerProfile.innerHTML = '<div class="muted">No games for this player.</div>'; return; }

  // Group by course
  const byCourse = {};
  games.forEach(g => {
    const course = g.course || '(Unknown Course)';
    if (!byCourse[course]) byCourse[course] = [];
    byCourse[course].push(g);
  });

  // Best 9 / 18 overall
  let best9 = null, best18 = null;
  games.forEach(g => {
    const total = g.scores[selected].reduce((a, b) => a + (+b || 0), 0);
    if (g.holes === 9)  best9  = (best9  === null || total < best9 ) ? total : best9;
    if (g.holes === 18) best18 = (best18 === null || total < best18) ? total : best18;
  });

  let html = `<h4>${selected}</h4>`;
  html += `<div class="table-wrap" style="margin-bottom:10px"><table><thead><tr><th>Best 9</th><th>Best 18</th></tr></thead><tbody>`;
  html += `<tr><td>${best9 ?? '—'}</td><td>${best18 ?? '—'}</td></tr></tbody></table></div>`;

  // Per-course sections
  Object.entries(byCourse).sort(([a],[b]) => a.localeCompare(b)).forEach(([course, rounds]) => {
    rounds.sort((a,b)=> a.ts.localeCompare(b.ts));
    html += `<h4 style="margin-top:12px;">${course}</h4>`;
    html += `<div class="table-wrap"><table><thead><tr><th class="left">Date</th><th>Holes</th><th>Total</th><th>Details</th></tr></thead><tbody>`;
    rounds.forEach(r => {
      const total = r.scores[selected].reduce((x, y) => x + (+y || 0), 0);
      const rowId = `p_${selected.replace(/\s+/g,'_')}_${r.id}`;
      html += `<tr>
        <td class="left">${new Date(r.ts).toLocaleDateString()}</td>
        <td>${r.holes}</td>
        <td>${total}</td>
        <td><button class="btn" data-pholes="${rowId}">View holes</button></td>
      </tr>
      <tr id="${rowId}" style="display:none;"><td colspan="4" class="left">
        <strong>Par:</strong> ${r.par.slice(0,r.holes).join(', ')}<br/>
        <strong>Scores:</strong> ${r.scores[selected].slice(0,r.holes).join(', ')}
      </td></tr>`;
    });
    html += `</tbody></table></div>`;
  });

  $playerProfile.innerHTML = html;

  $playerProfile.querySelectorAll('button[data-pholes]').forEach(btn=>{
    btn.onclick = () => {
      const id = btn.dataset.pholes;
      const row = document.getElementById(id);
      row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
    };
  });
}

// ===== COURSE LEADERBOARD PAGE =====
function rebuildCourseOptions() {
  const hist = loadHistory();
  const courses = [...new Set(hist.map(h => h.course).filter(Boolean))].sort();
  $courseLeaderboardSelect.innerHTML = '<option value="__none__">Select a course...</option>' +
    courses.map(c => `<option value="${c}">${c}</option>`).join('');
}
function renderCourseLeaderboard() {
  const course = $courseLeaderboardSelect.value;
  if (course === '__none__') { $courseParInfo.innerHTML = ''; $courseLeaderboardTable.innerHTML = ''; return; }
  const hist = loadHistory().filter(h => h.course === course);
  if (!hist.length) { $courseParInfo.innerHTML = 'No data'; $courseLeaderboardTable.innerHTML = ''; return; }

  const latest = hist[hist.length - 1];
  const parFront9 = latest.par.slice(0, 9).reduce((a, b) => a + (+b || 0), 0);
  const par18 = latest.par.slice(0, Math.min(18, latest.par.length)).reduce((a, b) => a + (+b || 0), 0);
  const has18 = hist.some(h => h.holes === 18);
  $courseParInfo.innerHTML = `Front 9 Par: ${parFront9} ${has18 ? `| 18-Hole Par: ${par18}` : ''}`;

  const playerStats = {};
  hist.forEach(h => {
    Object.entries(h.scores).forEach(([p, sc]) => {
      const total = sc.reduce((a, b) => a + (+b || 0), 0);
      if (!playerStats[p]) playerStats[p] = { rounds: 0, best9: null, best18: null };
      playerStats[p].rounds++;
      if (h.holes === 9)  playerStats[p].best9  = (playerStats[p].best9  === null || total < playerStats[p].best9 ) ? total : playerStats[p].best9;
      if (h.holes === 18) playerStats[p].best18 = (playerStats[p].best18 === null || total < playerStats[p].best18) ? total : playerStats[p].best18;
    });
  });

  const rows = Object.entries(playerStats).map(([p, stat]) => {
    if (leaderboardMode === '9') {
      const s = stat.best9;
      const vs = (s !== null) ? ` (${s - parFront9 >= 0 ? '+' : ''}${s - parFront9})` : '';
      return { player: p, scoreNum: s === null ? Infinity : s, scoreText: s !== null ? `${s}${vs}` : '', rounds: stat.rounds };
    } else {
      const s = stat.best18;
      const vs = (s !== null && has18) ? ` (${s - par18 >= 0 ? '+' : ''}${s - par18})` : '';
      return { player: p, scoreNum: s === null ? Infinity : s, scoreText: s !== null ? `${s}${vs}` : '', rounds: stat.rounds };
    }
  });

  rows.sort((a, b) => (a.scoreNum === b.scoreNum ? a.player.localeCompare(b.player) : a.scoreNum - b.scoreNum));

  let html = `<table><thead><tr><th>Player</th><th>Best ${leaderboardMode === '9' ? '9' : '18'}-Hole</th><th>Rounds</th></tr></thead><tbody>`;
  html += `<tr><td>Par</td><td>${leaderboardMode === '9' ? parFront9 : (has18 ? par18 : '')}</td><td>—</td></tr>`;
  rows.forEach(r => { html += `<tr><td>${r.player}</td><td>${r.scoreText}</td><td>${r.rounds}</td></tr>`; });
  html += `</tbody></table>`;
  $courseLeaderboardTable.innerHTML = html;
}

// Toggle buttons
$btnBest9.onclick  = () => { leaderboardMode = '9';  renderCourseLeaderboard(); };
$btnBest18.onclick = () => { leaderboardMode = '18'; renderCourseLeaderboard(); };

// ===== Add Player Modal (popup) =====
const $openAddPlayerModal = document.getElementById('openAddPlayerModal');
const $addPlayerModal = document.getElementById('addPlayerModal');
const $modalPlayerForm = document.getElementById('modalPlayerForm');
const $modalPlayerName = document.getElementById('modalPlayerName');
const $modalAddAlsoToRound = document.getElementById('modalAddAlsoToRound');
const $cancelAddPlayer = document.getElementById('cancelAddPlayer');

function showAddPlayerModal() {
  $modalPlayerName.value = '';
  $modalAddAlsoToRound.checked = false;
  $addPlayerModal.classList.add('show');
  $addPlayerModal.setAttribute('aria-hidden', 'false');
  setTimeout(() => $modalPlayerName.focus(), 0);
}
function hideAddPlayerModal() {
  $addPlayerModal.classList.remove('show');
  $addPlayerModal.setAttribute('aria-hidden', 'true');
}
$openAddPlayerModal?.addEventListener('click', showAddPlayerModal);
$addPlayerModal?.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) hideAddPlayerModal();
});
$cancelAddPlayer?.addEventListener('click', hideAddPlayerModal);
$modalPlayerForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = ($modalPlayerName.value || '').trim();
  if (!name) return;
  if (players.includes(name)) { alert('This name already exists.'); return; }

  players.push(name);
  if ($modalAddAlsoToRound.checked && !roundPlayers.includes(name)) {
    const limit = parseInt(($roundCount.value || '8'), 10);
    if (roundPlayers.length < limit) roundPlayers.push(name);
    else alert(`Round is limited to ${limit} players. Name added to catalog only.`);
  }

  renderPlayerSelectsFromCatalog();
  hideAddPlayerModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $addPlayerModal?.classList.contains('show')) hideAddPlayerModal();
});

// ===== INIT =====
$filterHistoryPlayer.onchange = renderHistory;
$playerProfileSelect.onchange = renderPlayerProfile;
$courseLeaderboardSelect.onchange = renderCourseLeaderboard;

window.onload = () => {
  renderPlayerSelectsFromCatalog();
  const route = location.hash.replace('#', '') || 'scorecard';
  routeTo(route);
  renderHistory();
  rebuildCourseOptions();
};
