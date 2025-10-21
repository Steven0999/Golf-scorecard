// ===== Helpers & State =====
const el = id => document.getElementById(id);
const HISTORY_KEY = 'golf-history-v5'; // new version
const PLAYERS_KEY = 'golf-players-v1';

let players = loadPlayers(); // { name, handicapIndex }
let roundPlayers = [];       // selected for current round (names)
let editingRoundId = null;   // if editing existing round

let state = {
  course: '', area: '', holes: 18,
  courseRating: 72.0, slope: 113,
  par: [], si: [], // arrays per hole
  scores: {}      // { playerName: [scores...] }
};

// page elements
const $burger = el('burger'), $drawer = el('drawer'), $drawerLinks = document.querySelectorAll('.drawer-link');
const $course = el('course'), $area = el('area'), $holes = el('holes'), $courseRating = el('courseRating'), $courseSlope = el('courseSlope');
const $roundCount = el('roundCount'), $playerSelect = el('playerSelect'), $roundPlayerSelect = el('roundPlayerSelect');
const $generate = el('generate'), $saveHistory = el('saveHistory'), $clearRound = el('clearRound');
const $workspace = el('workspace'), $summary = el('summary');

const $filterHistoryPlayer = el('filterHistoryPlayer'), $filterHistoryCourse = el('filterHistoryCourse'), $historyList = el('historyList');
const $scoresChart = el('scoresChart');

const $playerProfileSelect = el('playerProfileSelect'), $playerProfile = el('playerProfile');
const $courseLeaderboardSelect = el('courseLeaderboardSelect'), $courseParInfo = el('courseParInfo'), $courseLeaderboardTable = el('courseLeaderboardTable');
const $btnBest9 = el('btnBest9'), $btnBest18 = el('btnBest18'), $leaderboardSort = el('leaderboardSort');

// modal
const $addPlayerModal = el('addPlayerModal'), $openAddPlayerModal = el('openAddPlayerModal'), $openAddPlayerModal2 = el('openAddPlayerModal2');
const $modalPlayerForm = el('modalPlayerForm'), $modalPlayerName = el('modalPlayerName'), $modalPlayerHandicap = el('modalPlayerHandicap'), $modalAddAlsoToRound = el('modalAddAlsoToRound'), $cancelAddPlayer = el('cancelAddPlayer');

// drawer handlers
function openDrawer(open) {
  $drawer.classList.toggle('open', open);
  $drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
  $burger.setAttribute('aria-expanded', open ? 'true' : 'false');
}
$burger.addEventListener('click', () => openDrawer(!$drawer.classList.contains('open')));
$drawerLinks.forEach(btn => btn.addEventListener('click', () => { routeTo(btn.dataset.route); openDrawer(false); }));

function routeTo(route) {
  document.querySelectorAll('.page').forEach(sec => sec.hidden = sec.dataset.page !== route);
  if (route === 'history') renderHistory();
  if (route === 'profiles') renderPlayerProfile();
  if (route === 'leaderboard') { rebuildCourseOptions(); renderCourseLeaderboard(); }
}
window.addEventListener('hashchange', () => { const route = location.hash.replace('#', '') || 'scorecard'; routeTo(route); });

// Storage helpers
function savePlayers() { localStorage.setItem(PLAYERS_KEY, JSON.stringify(players)); }
function loadPlayers() { try { return JSON.parse(localStorage.getItem(PLAYERS_KEY) || '[]'); } catch { return []; } }
function saveHistoryItem(item) {
  const arr = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  // if editing: replace, else push
  if (item.id != null) {
    const idx = arr.findIndex(x => x.id === item.id);
    if (idx >= 0) { arr[idx] = item; localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); return; }
  }
  arr.push(item);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
}
function loadHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; } }
function clearHistory() { localStorage.removeItem(HISTORY_KEY); }

// --- Render player selects / catalog ---
function renderPlayerSelectsFromCatalog() {
  $playerSelect.innerHTML = players.map(p => `<option value="${p.name}">${p.name} (${p.handicapIndex?.toFixed?.(1)||0})</option>`).join('');
  $roundPlayerSelect.innerHTML = players.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
  $filterHistoryPlayer.innerHTML = '<option value="__all__">All</option>' + players.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
  $playerProfileSelect.innerHTML = '<option value="__none__">Select...</option>' + players.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
  syncRoundSelectWithRoundPlayers();
  renderPlayerList();
}

function syncRoundSelectWithRoundPlayers() {
  [...$roundPlayerSelect.options].forEach(opt => { opt.selected = roundPlayers.includes(opt.value); });
}

// player list (edit/delete)
const $playerList = document.createElement('div');
$playerList.className = 'player-list';
(function attachPlayerList() {
  const container = document.querySelector('[data-page="scorecard"] .card') || document.body;
  container.appendChild($playerList);
})();

function renderPlayerList() {
  if (!players.length) { $playerList.innerHTML = '<div class="muted">No players yet.</div>'; return; }
  $playerList.innerHTML = players.map((p, idx) => `
    <div class="player-row" data-player="${p.name}">
      <div class="name">${p.name} <span class="muted">(${(p.handicapIndex||0).toFixed(1)})</span></div>
      <div class="actions">
        <button class="btn" data-edit="${idx}">Edit</button>
        <button class="btn" data-delete="${idx}">Delete</button>
      </div>
    </div>
  `).join('');

  $playerList.querySelectorAll('button[data-edit]').forEach(btn => {
    btn.onclick = () => {
      const i = +btn.dataset.edit; const old = players[i];
      const row = btn.closest('.player-row');
      row.innerHTML = `
        <input type="text" value="${old.name}" />
        <input type="number" step="0.1" min="0" max="54" value="${old.handicapIndex||0}" style="width:120px" />
        <div class="actions">
          <button class="btn" data-save="${i}">Save</button>
          <button class="btn" data-cancel="${i}">Cancel</button>
        </div>
      `;
      const nameInput = row.querySelector('input[type="text"]');
      const hcInput = row.querySelector('input[type="number"]');
      row.querySelector('button[data-save]').onclick = () => {
        const newName = (nameInput.value||'').trim(); const newHc = parseFloat(hcInput.value||0);
        if (!newName) { alert('Name required'); return; }
        if (players.some((pl, idx2) => idx2!==i && pl.name === newName)) { alert('Name exists'); return; }
        // update
        const oldName = players[i].name;
        players[i] = { name: newName, handicapIndex: isNaN(newHc)?0:newHc };
        // update roundPlayers and any stored scores keys
        roundPlayers = roundPlayers.map(n => n===oldName? newName : n);
        const hist = loadHistory();
        hist.forEach(h => {
          if (h.scores && h.scores[oldName]) { h.scores[newName]=h.scores[oldName]; delete h.scores[oldName]; }
        });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
        savePlayers();
        renderPlayerSelectsFromCatalog();
        renderWorkspace();
        renderSummary();
      };
      row.querySelector('button[data-cancel]').onclick = () => renderPlayerList();
    };
  });

  $playerList.querySelectorAll('button[data-delete]').forEach(btn => {
    btn.onclick = () => {
      const i = +btn.dataset.delete;
      const name = players[i].name;
      if (!confirm(`Delete player "${name}"? This removes them from catalog but keeps history.`)) return;
      players.splice(i,1); roundPlayers = roundPlayers.filter(n=>n!==name);
      savePlayers(); renderPlayerSelectsFromCatalog(); renderWorkspace(); renderSummary();
    };
  });
}

// save/load players
function savePlayersToStorage(){ localStorage.setItem(PLAYERS_KEY, JSON.stringify(players)); }
function savePlayers(){ savePlayersToStorage(); }

// --- Add Player Modal ---
function showAddPlayerModal(defaultName='') {
  $modalPlayerName.value = defaultName;
  $modalPlayerHandicap.value = '0';
  $modalAddAlsoToRound.checked = false;
  $addPlayerModal.classList.add('show'); $addPlayerModal.setAttribute('aria-hidden','false');
  setTimeout(()=> $modalPlayerName.focus(), 0);
}
function hideAddPlayerModal(){ $addPlayerModal.classList.remove('show'); $addPlayerModal.setAttribute('aria-hidden','true'); }

$openAddPlayerModal?.addEventListener('click', ()=> showAddPlayerModal());
$openAddPlayerModal2?.addEventListener('click', ()=> showAddPlayerModal());

$addPlayerModal?.addEventListener('click', (e)=> { if (e.target.classList.contains('modal-backdrop')) hideAddPlayerModal(); });
$cancelAddPlayer?.addEventListener('click', hideAddPlayerModal);
$modalPlayerForm?.addEventListener('submit', (e)=> {
  e.preventDefault();
  const name = ($modalPlayerName.value||'').trim();
  const hc = parseFloat($modalPlayerHandicap.value||0);
  if (!name) return alert('Name required');
  if (players.some(p=>p.name===name)) return alert('Player exists');
  const player = { name, handicapIndex: isNaN(hc)?0:hc };
  players.push(player);
  savePlayers();
  if ($modalAddAlsoToRound.checked) {
    const limit = Math.max(1, Math.min(8, parseInt($roundCount.value||'2',10)));
    if (roundPlayers.length < limit) { roundPlayers.push(name); syncRoundSelectWithRoundPlayers(); }
    else alert(`Round limit ${limit}. Player saved to catalog only.`);
  }
  renderPlayerSelectsFromCatalog();
  hideAddPlayerModal();
});

// --- Round selection logic ---
$roundPlayerSelect.addEventListener('change', ()=>{
  const limit = Math.max(1, Math.min(8, parseInt($roundCount.value||'1',10)));
  const chosen = [...$roundPlayerSelect.selectedOptions].map(o=>o.value);
  if (chosen.length > limit) { alert(`Select <= ${limit}`); syncRoundSelectWithRoundPlayers(); return; }
  roundPlayers = chosen;
});
$roundCount.addEventListener('input', ()=>{
  const limit = Math.max(1, Math.min(8, parseInt($roundCount.value||'1',10)));
  $roundCount.value = limit;
  if (roundPlayers.length > limit) { roundPlayers = roundPlayers.slice(0,limit); syncRoundSelectWithRoundPlayers(); }
});

// --- Generate scorecard ---
$generate.addEventListener('click', ()=>{
  state.course = $course.value.trim();
  state.area = $area.value.trim();
  state.holes = parseInt($holes.value,10);
  state.courseRating = parseFloat($courseRating.value) || 72;
  state.slope = parseInt($courseSlope.value,10) || 113;

  // if par/si arrays mismatch holes, initialize with 0 (as requested)
  state.par = Array.from({length: state.holes}, (_,i) => (state.par?.[i] ?? 0));
  state.si  = Array.from({length: state.holes}, (_,i) => (state.si?.[i] ?? (i+1)));

  // ensure scores for selected players, with default 0s
  const prev = {...state.scores};
  state.scores = {};
  roundPlayers.forEach(p => {
    const arr = prev[p] || [];
    state.scores[p] = Array.from({length: state.holes}, (_,h) => arr[h] ?? 0);
  });

  editingRoundId = null; // new round
  renderWorkspace();
  renderSummary();
});

// Clear round
$clearRound.addEventListener('click', ()=>{
  state.scores = {};
  state.par = Array.from({length: state.holes}, ()=>0);
  state.si = Array.from({length: state.holes}, (_,i)=>i+1);
  roundPlayers = [];
  syncRoundSelectWithRoundPlayers();
  renderWorkspace();
  renderSummary();
});

// --- workspace render (par and SI editable, strokes inputs) ---
function renderWorkspace(){
  const playersInRound = Object.keys(state.scores);
  if (!playersInRound.length) { $workspace.innerHTML = '<div class="muted">Pick players and click Generate.</div>'; return; }

  // header holes
  let thead = '<tr><th class="left">Player</th>';
  for (let i=1;i<=state.holes;i++) thead += `<th>H${i}<div style="font-size:11px">SI</div></th>`;
  thead += '<th>Total</th><th>Gross ParDiff</th><th>Course Hcp</th><th>Net</th></tr>';

  // par and SI inputs row
  const parInputs = state.par.map((v,idx)=>`<td><input class="hole-input" type="number" min="0" max="6" value="${v}" data-role="par" data-h="${idx}" style="width:60px"/></td>`).join('');
  const siInputs  = state.si.map((v,idx)=>`<input class="si-input" type="number" min="1" max="18" value="${v}" data-role="si" data-h="${idx}" style="width:56px;margin-top:6px"/>`);
  let parRow = `<tr><td class="left muted">Par</td>${parInputs}<td colspan="4">${state.par.reduce((a,b)=>a+(+b||0),0)}</td></tr>`;

  // SI row displayed under par inputs (in same cell we embed)
  // We'll render SI inputs under each hole by adding them in the same header cell via CSS/HTML in thead above. For simplicity, we add a separate row for SI.
  const siRow = `<tr><td class="left muted">SI</td>${state.si.map((v,idx)=>`<td>${siInputs[idx]}</td>`).join('')}<td colspan="4"></td></tr>`;

  // body rows for each player
  const bodyRows = playersInRound.map(p=>{
    const cells = state.scores[p].map((v,idx)=>`<td><input class="stroke-input" type="number" min="0" max="30" value="${v}" data-p="${p}" data-h="${idx}" style="width:60px"/></td>`).join('');
    const total = state.scores[p].reduce((a,b)=>a+(+b||0),0);
    const parTotal = state.par.reduce((a,b)=>a+(+b||0),0);
    const diff = total - parTotal;
    const courseHcp = computeCourseHandicap(p);
    const net = total - courseHcp;
    return `<tr>
      <td class="left">${p}</td>
      ${cells}
      <td>${total}</td>
      <td>${diff>=0? '+'+diff: diff}</td>
      <td>${isFinite(courseHcp)?courseHcp:'—'}</td>
      <td>${isFinite(net)?net:'—'}</td>
    </tr>`;
  }).join('');

  $workspace.innerHTML = `<div class="table-wrap"><table><thead>${thead}</thead><tbody>${parRow}${siRow}${bodyRows}</tbody></table></div>`;

  // bind par inputs
  $workspace.querySelectorAll('input[data-role="par"]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const h = +inp.dataset.h; state.par[h] = Math.max(0,Math.min(20, parseInt(inp.value||'0',10)));
      renderWorkspace(); renderSummary();
    });
  });
  // bind SI inputs
  $workspace.querySelectorAll('input[data-role="si"]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const h = +inp.dataset.h; state.si[h] = Math.max(1,Math.min(18, parseInt(inp.value||'1',10)));
    });
  });
  // bind stroke inputs
  $workspace.querySelectorAll('input.stroke-input').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const p = inp.dataset.p, h = +inp.dataset.h;
      state.scores[p][h] = Math.max(0,Math.min(30, parseInt(inp.value||'0',10)));
      renderWorkspace(); renderSummary();
    });
  });
}

// --- compute totals, course handicap, net ---
function computeTotalsForPlayer(p){
  const strokes = state.scores[p] || [];
  const total = strokes.reduce((a,b)=>a+(+b||0),0);
  const parTotal = state.par.reduce((a,b)=>a+(+b||0),0);
  return { total, parTotal, toPar: total - parTotal };
}
function computeCourseHandicap(playerName){
  const player = players.find(pp=>pp.name===playerName);
  if (!player) return NaN;
  const hIndex = parseFloat(player.handicapIndex || 0);
  const slope = parseInt(state.slope || 113,10);
  const parTotal = state.par.reduce((a,b)=>a+(+b||0),0);
  const courseRating = parseFloat(state.courseRating || 72);
  // WHS Course Handicap formula: HI * (Slope/113) + (CourseRating - Par)
  const ch = hIndex * (slope/113) + (courseRating - parTotal);
  // Round to nearest integer
  return Math.round(ch);
}

// --- summary ---
function renderSummary(){
  const playersInRound = Object.keys(state.scores);
  if (!playersInRound.length) { $summary.innerHTML = ''; return; }
  const parTotal = state.par.reduce((a,b)=>a+(+b||0),0);
  let html = '<h3>Summary</h3><div class="table-wrap"><table><thead><tr><th class="left">Player</th><th>Total (Gross)</th><th>Par</th><th>±Par</th><th>Course Hcp</th><th>Net</th></tr></thead><tbody>';
  playersInRound.forEach(p=>{
    const { total, toPar } = computeTotalsForPlayer(p);
    const ch = computeCourseHandicap(p);
    const net = total - ch;
    html += `<tr><td class="left">${p}</td><td>${total}</td><td>${parTotal}</td><td>${toPar>=0? '+'+toPar: toPar}</td><td>${isFinite(ch)?ch:'—'}</td><td>${isFinite(net)?net:'—'}</td></tr>`;
  });
  html += '</tbody></table></div>';
  $summary.innerHTML = html;
}

// --- Save round (history) including par, si, courseRating, slope, scores ---
$saveHistory.addEventListener('click', ()=>{
  const playersInRound = Object.keys(state.scores);
  if (!playersInRound.length) return alert('Generate a scorecard first.');
  const item = {
    id: editingRoundId || Date.now(),
    ts: new Date().toISOString(),
    course: state.course || '(Unknown)',
    area: state.area || '',
    holes: state.holes,
    courseRating: state.courseRating,
    slope: state.slope,
    par: state.par.slice(0,state.holes),
    si: state.si.slice(0,state.holes),
    scores: state.scores // { name: [..] }
  };
  saveHistoryItem(item);
  editingRoundId = null;
  renderHistory();
  rebuildCourseOptions();
  alert('Round saved to history.');
});

// --- HISTORY rendering & edit ---
function renderHistory(filterByCourse='__all__', filterByPlayer='__all__', showHoles = 'all'){
  const hist = loadHistory().slice().sort((a,b)=> new Date(b.ts)-new Date(a.ts));
  const list = hist.filter(h=>{
    if (filterByCourse !== '__all__' && h.course !== filterByCourse) return false;
    if (filterByPlayer !== '__all__' && !Object.keys(h.scores).includes(filterByPlayer)) return false;
    if (showHoles === '9' && h.holes !== 9) return false;
    if (showHoles === '18' && h.holes !== 18) return false;
    return true;
  });

  $historyList.innerHTML = list.map(m=>{
    const date = new Date(m.ts).toLocaleString();
    const totals = Object.entries(m.scores).map(([p, sc])=> `${p}: ${sc.slice(0,m.holes).reduce((a,b)=>a+(+b||0),0)}`).join(', ');
    const id = `h_${m.id}`;
    return `<div class="history-item">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div><strong>${m.course}</strong> • ${date} • ${m.holes} holes • Rating ${m.courseRating} • Slope ${m.slope}</div>
        <div style="display:flex;gap:8px">
          <button class="btn" data-edit="${m.id}">Edit</button>
          <button class="btn" data-expand="${id}">Details</button>
          <button class="btn danger" data-delete="${m.id}">Delete</button>
        </div>
      </div>
      <div class="muted" style="margin-top:6px">${totals}</div>
      <div id="${id}" class="table-wrap" style="display:none;margin-top:8px"></div>
    </div>`;
  }).join('');

  // bind expand / edit / delete
  $historyList.querySelectorAll('button[data-expand]').forEach(btn=>{
    btn.onclick = ()=> {
      const id = btn.dataset.expand; const host = document.getElementById(id);
      const m = list.find(x=>`h_${x.id}`===id);
      if (!m) return;
      if (host.dataset.loaded === '1') { host.style.display = host.style.display==='none'?'block':'none'; return; }
      // build per-hole table with par & si
      let thead = '<tr><th class="left">Player</th>';
      for (let i=1;i<=m.holes;i++) thead += `<th>H${i}</th>`; thead += '<th>Total</th><th>Net</th>';
      thead += '</tr>';
      const parCells = m.par.slice(0,m.holes).map(v=>`<td>${v}</td>`).join('');
      const siCells  = m.si.slice(0,m.holes).map(v=>`<td>${v}</td>`).join('');
      const parTotal = m.par.slice(0,m.holes).reduce((a,b)=>a+(+b||0),0);
      let tbody = `<tr><td class="left muted">Par</td>${parCells}<td>${parTotal}</td><td></td></tr>`;
      tbody += `<tr><td class="left muted">SI</td>${siCells}<td colspan="2"></td></tr>`;
      Object.entries(m.scores).forEach(([p, arr])=>{
        const total = arr.slice(0,m.holes).reduce((a,b)=>a+(+b||0),0);
        // compute course handicap for player based on stored course rating & parTotal
        const player = players.find(pp=>pp.name===p);
        const hIndex = player? (player.handicapIndex||0):0;
        const ch = Math.round(hIndex*(m.slope/113) + (m.courseRating - parTotal));
        const net = total - ch;
        tbody += `<tr><td class="left">${p}</td>${arr.slice(0,m.holes).map(v=>`<td>${v}</td>`).join('')}<td>${total}</td><td>${net}</td></tr>`;
      });
      host.innerHTML = `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
      host.dataset.loaded = '1'; host.style.display = 'block';
    };
  });

  // edit button -> load round into editor
  $historyList.querySelectorAll('button[data-edit]').forEach(btn=>{
    btn.onclick = () => {
      const id = +btn.dataset.edit;
      const histAll = loadHistory(); const item = histAll.find(x=>x.id===id);
      if (!item) return alert('Round not found');
      // load into state for editing
      state.course = item.course; $course.value = state.course;
      state.area = item.area; $area.value = state.area;
      state.holes = item.holes; $holes.value = state.holes;
      state.courseRating = item.courseRating; $courseRating.value = state.courseRating;
      state.slope = item.slope; $courseSlope.value = state.slope;
      state.par = item.par.slice(0,state.holes);
      state.si = item.si.slice(0,state.holes);
      state.scores = {}; Object.entries(item.scores).forEach(([p,arr]) => state.scores[p] = arr.slice(0,state.holes));
      // set roundPlayers & selection
      roundPlayers = Object.keys(state.scores);
      syncRoundSelectWithRoundPlayers();
      editingRoundId = item.id;
      // switch to scorecard page and render
      location.hash = '#scorecard'; routeTo('scorecard');
      renderWorkspace(); renderSummary();
      window.scrollTo({top:0,behavior:'smooth'});
    };
  });

  // delete button
  $historyList.querySelectorAll('button[data-delete]').forEach(btn=>{
    btn.onclick = () => {
      const id = +btn.dataset.delete;
      if (!confirm('Delete this saved round?')) return;
      let arr = loadHistory(); arr = arr.filter(x=>x.id!==id); localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
      renderHistory($filterHistoryCourse.value,$filterHistoryPlayer.value);
      rebuildCourseOptions();
    };
  });
}

// filters & history controls
el('showAllHistory')?.addEventListener('click', ()=> renderHistory('__all__','__all__','all'));
el('show9')?.addEventListener('click', ()=> renderHistory('__all__','__all__','9'));
el('show18')?.addEventListener('click', ()=> renderHistory('__all__','__all__','18'));
el('clearHistory')?.addEventListener('click', ()=>{
  if (!confirm('Clear all saved history?')) return;
  clearHistory(); renderHistory(); rebuildCourseOptions();
});

$filterHistoryPlayer.onchange = ()=> renderHistory($filterHistoryCourse.value||'__all__',$filterHistoryPlayer.value||'__all__');
$filterHistoryCourse.onchange = ()=> renderHistory($filterHistoryCourse.value||'__all__',$filterHistoryPlayer.value||'__all__');

// draw scores over time
function drawChart(list, filterPlayer='__all__'){
  const ctx = $scoresChart.getContext('2d');
  ctx.clearRect(0,0,$scoresChart.width,$scoresChart.height);
  const data = [];
  list.forEach(m=> {
    Object.entries(m.scores).forEach(([p, sc]) => {
      if (filterPlayer==='__all__' || filterPlayer===p) {
        const total = sc.slice(0,m.holes).reduce((a,b)=>a+(+b||0),0);
        data.push({player:p,t:new Date(m.ts).getTime(),y:total});
      }
    });
  });
  if (!data.length) { ctx.fillStyle='#9aa3b2'; ctx.fillText('No history to chart', 20, 28); return; }
  data.sort((a,b)=>a.t-b.t);
  const playersSet = [...new Set(data.map(d=>d.player))];
  const pad=40,W=$scoresChart.width,H=$scoresChart.height;
  const xmin=Math.min(...data.map(d=>d.t)), xmax=Math.max(...data.map(d=>d.t));
  const ymin=Math.min(...data.map(d=>d.y)), ymax=Math.max(...data.map(d=>d.y));
  const x = t => pad + ((t-xmin)/(xmax-xmin||1))*(W-2*pad);
  const y = v => H - pad - ((v-ymin)/(ymax-ymin||1))*(H-2*pad);
  // axes
  ctx.strokeStyle='#7b8bb2'; ctx.beginPath(); ctx.moveTo(pad,pad); ctx.lineTo(pad,H-pad); ctx.lineTo(W-pad,H-pad); ctx.stroke();
  const colors=['#7c9cff','#4cc38a','#ff6b6b','#ffa500','#b07cff'];
  playersSet.forEach((pl,i)=>{
    const pts=data.filter(d=>d.player===pl);
    ctx.beginPath(); ctx.strokeStyle=colors[i%colors.length]; pts.forEach((pt,j)=>{ if(j===0) ctx.moveTo(x(pt.t),y(pt.y)); else ctx.lineTo(x(pt.t),y(pt.y)); }); ctx.stroke();
    pts.forEach(pt=> ctx.fillRect(x(pt.t)-2,y(pt.y)-2,4,4));
    ctx.fillStyle=colors[i%colors.length]; ctx.fillText(pl, W-120, 20+14*i);
  });
}

// --- PLAYER PROFILES ---
function renderPlayerProfile(){
  const hist = loadHistory();
  const selected = $playerProfileSelect.value;
  if (selected==='__none__') { $playerProfile.innerHTML='<div class="muted">Select player</div>'; return; }
  const games = hist.filter(h=> Object.keys(h.scores).includes(selected));
  if (!games.length) { $playerProfile.innerHTML = '<div class="muted">No games</div>'; return; }
  let best9=null,best18=null;
  games.forEach(g=>{
    const total = g.scores[selected].slice(0,g.holes).reduce((a,b)=>a+(+b||0),0);
    if (g.holes===9) best9 = best9===null? total: Math.min(best9,total);
    if (g.holes===18) best18 = best18===null? total: Math.min(best18,total);
  });
  let html=`<h4>${selected}</h4><div class="table-wrap"><table><thead><tr><th>Best 9</th><th>Best 18</th></tr></thead><tbody><tr><td>${best9??'—'}</td><td>${best18??'—'}</td></tr></tbody></table></div>`;

  // per-course history
  const byCourse = {};
  games.forEach(g=>{ (byCourse[g.course] = byCourse[g.course]||[]).push(g); });
  Object.entries(byCourse).forEach(([course, rounds])=>{
    html += `<h4 style="margin-top:10px">${course}</h4><div class="table-wrap"><table><thead><tr><th>Date</th><th>Holes</th><th>Gross</th><th>CourseRating</th><th>Slope</th><th>CourseHcp</th><th>Net</th><th>Details</th></tr></thead><tbody>`;
    rounds.sort((a,b)=> new Date(b.ts)-new Date(a.ts));
    rounds.forEach(r=>{
      const gross = r.scores[selected].slice(0,r.holes).reduce((a,b)=>a+(+b||0),0);
      const parTotal = r.par.slice(0,r.holes).reduce((a,b)=>a+(+b||0),0);
      const hIdx = (players.find(p=>p.name===selected)||{}).handicapIndex||0;
      const courseHcp = Math.round(hIdx*(r.slope/113) + (r.courseRating - parTotal));
      const net = gross - courseHcp;
      const detailsId = `pd_${selected.replace(/\s+/g,'_')}_${r.id}`;
      html += `<tr><td>${new Date(r.ts).toLocaleDateString()}</td><td>${r.holes}</td><td>${gross}</td><td>${r.courseRating}</td><td>${r.slope}</td><td>${courseHcp}</td><td>${net}</td><td><button class="btn" data-show="${detailsId}">View</button></td></tr>
        <tr id="${detailsId}" style="display:none"><td colspan="8" class="left">Par: ${r.par.slice(0,r.holes).join(', ')}<br/>SI: ${r.si.slice(0,r.holes).join(', ')}<br/>Scores: ${r.scores[selected].slice(0,r.holes).join(', ')}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  });
  $playerProfile.innerHTML = html;
  $playerProfile.querySelectorAll('button[data-show]').forEach(b=>{ b.onclick = ()=>{ const id=b.dataset.show; const el=document.getElementById(id); el.style.display = el.style.display==='none'?'table-row':'none'; }});
}

// --- LEADERBOARD ---
let leaderboardMode = '9';
$btnBest9.onclick = ()=> { leaderboardMode='9'; renderCourseLeaderboard(); };
$btnBest18.onclick = ()=> { leaderboardMode='18'; renderCourseLeaderboard(); }
$leaderboardSort.onchange = ()=> renderCourseLeaderboard();

function rebuildCourseOptions() {
  const hist = loadHistory();
  const courses = [...new Set(hist.map(h=>h.course).filter(Boolean))].sort();
  $courseLeaderboardSelect.innerHTML = '<option value="__none__">Select a course...</option>' + courses.map(c=>`<option value="${c}">${c}</option>`).join('');
  $filterHistoryCourse.innerHTML = '<option value="__all__">All</option>' + courses.map(c=>`<option value="${c}">${c}</option>`).join('');
}
function renderCourseLeaderboard(){
  const course = $courseLeaderboardSelect.value;
  if (!course || course==='__none__') { $courseParInfo.innerText=''; $courseLeaderboardTable.innerHTML=''; return; }
  const hist = loadHistory().filter(h=>h.course===course);
  if (!hist.length) { $courseParInfo.innerText='No rounds for this course'; $courseLeaderboardTable.innerHTML=''; return; }
  // get latest par & rating for par info
  const latest = hist[hist.length-1];
  const parFront9 = latest.par.slice(0,9).reduce((a,b)=>a+(+b||0),0);
  const par18 = latest.par.slice(0,Math.min(18,latest.par.length)).reduce((a,b)=>a+(+b||0),0);
  const has18 = hist.some(h=>h.holes===18);
  $courseParInfo.innerText = `Front 9 Par: ${parFront9} ${has18? '| 18 Par: '+par18 : ''}`;

  // compute bests per player
    const playerStats = {};
    hist.forEach(h=>{
      Object.entries(h.scores).forEach(([p, sc])=>{
        const gross = sc.slice(0,h.holes).reduce((a,b)=>a+(+b||0),0);
        const parTotal = h.par.slice(0,h.holes).reduce((a,b)=>a+(+b||0),0);
        // compute player's course handicap using their stored handicap index
        const pl = players.find(pp=>pp.name===p); const hi = pl? (pl.handicapIndex||0) : 0;
        const ch = Math.round(hi*(h.slope/113) + (h.courseRating - parTotal));
        const net = gross - ch;
        if (!playerStats[p]) playerStats[p] = { rounds:0, best9:Infinity, best18:Infinity, best9Net:Infinity, best18Net:Infinity };
        playerStats[p].rounds++;
        if (h.holes === 9) {
          playerStats[p].best9 = Math.min(playerStats[p].best9, gross);
          playerStats[p].best9Net = Math.min(playerStats[p].best9Net, net);
        }
        if (h.holes === 18) {
          playerStats[p].best18 = Math.min(playerStats[p].best18, gross);
          playerStats[p].best18Net = Math.min(playerStats[p].best18Net, net);
        }
      });
    });

    // build rows
    const rows = Object.entries(playerStats).map(([p, s])=>{
      if (leaderboardMode === '9') {
        const scoreGross = isFinite(s.best9)? s.best9 : null;
        const scoreNet = isFinite(s.best9Net)? s.best9Net : null;
        return { player:p, gross:scoreGross, net:scoreNet, rounds:s.rounds };
      } else {
        const scoreGross = isFinite(s.best18)? s.best18 : null;
        const scoreNet = isFinite(s.best18Net)? s.best18Net : null;
        return { player:p, gross:scoreGross, net:scoreNet, rounds:s.rounds };
      }
    });

    const sortBy = $leaderboardSort.value || 'gross';
    rows.sort((a,b)=>{
      const aa = (sortBy==='gross')? (a.gross==null?Infinity:a.gross) : (a.net==null?Infinity:a.net);
      const bb = (sortBy==='gross')? (b.gross==null?Infinity:b.gross) : (b.net==null?Infinity:b.net);
      if (aa===bb) return a.player.localeCompare(b.player);
      return aa - bb;
    });

    // render table
    let html = `<div class="table-wrap"><table><thead><tr><th>Player</th><th>Best ${leaderboardMode==='9'?'9':'18'} Gross</th><th>Best ${leaderboardMode==='9'?'9':'18'} Net</th><th>Rounds</th></tr></thead><tbody>`;
    rows.forEach(r=>{
      html += `<tr><td class="left">${r.player}</td><td>${r.gross==null? '—' : r.gross}</td><td>${r.net==null? '—' : r.net}</td><td>${r.rounds}</td></tr>`;
    });
    html += `</tbody></table></div>`;
    $courseLeaderboardTable.innerHTML = html;
}

// --- INIT / BOOT ---
function init(){
  // set defaults
  $courseRating.value = state.courseRating; $courseSlope.value = state.slope;
  $holes.value = state.holes;
  // initial arrays
  state.par = Array.from({length: state.holes}, ()=>0);
  state.si = Array.from({length: state.holes}, (_,i)=>i+1);
  // render selects
  renderPlayerSelectsFromCatalog();
  renderWorkspace();
  renderSummary();
  rebuildCourseOptions();
  renderHistory();
  // route
  const route = location.hash.replace('#','') || 'scorecard'; routeTo(route);
}
init();

// wire other UI
$course.addEventListener('input', ()=> state.course = $course.value);
$area.addEventListener('input', ()=> state.area = $area.value);
$courseRating.addEventListener('input', ()=> state.courseRating = parseFloat($courseRating.value||72));
$courseSlope.addEventListener('input', ()=> state.slope = parseInt($courseSlope.value||113,10));
$holes.addEventListener('change', ()=> { state.holes = parseInt($holes.value,10); state.par = Array.from({length: state.holes}, (v,i)=> state.par[i]??0); state.si = Array.from({length: state.holes}, (v,i)=> state.si[i]??(i+1)); renderWorkspace(); renderSummary(); });

// update history filters when options change
window.addEventListener('load', ()=> {
  rebuildCourseOptions();
  $filterHistoryCourse.onchange = ()=> renderHistory($filterHistoryCourse.value,$filterHistoryPlayer.value);
  $filterHistoryPlayer.onchange = ()=> renderHistory($filterHistoryCourse.value,$filterHistoryPlayer.value);
  // export players
  el('exportPlayers')?.addEventListener('click', ()=> {
    const blob = new Blob([JSON.stringify(players,null,2)],{type:'application/json'}); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'players.json'; a.click(); URL.revokeObjectURL(url);
  });
});

// helper: when history is re-rendered, update chart
function renderHistoryWrapper(){ const hist=loadHistory(); renderHistory(); drawChart(hist, $filterHistoryPlayer.value||'__all__'); }
