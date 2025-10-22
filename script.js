/* Golf Scorecard — app.js
   Features:
   - Add/edit players (modal)
   - Create rounds with per-hole pars & S.I.
   - Input scores per hole per player
   - Compute gross, course handicap, net (WHS simplified)
   - Save rounds to localStorage, edit saved rounds
   - History, player profiles, leaderboards (best 9 / 18)
   - Simple line chart of history totals
*/

// ---------- Helpers ----------
const $ = id => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const STORAGE_PLAYERS = 'golf_players_v1';
const STORAGE_ROUNDS = 'golf_rounds_v1';

// ---------- State ----------
let players = JSON.parse(localStorage.getItem(STORAGE_PLAYERS) || '[]'); // array of {name, hIndex}
let rounds = JSON.parse(localStorage.getItem(STORAGE_ROUNDS) || '[]'); // saved rounds
let working = { // current working round
  id: null, courseName:'', area:'', holes:18, courseRating:72.0, slope:113,
  par:[], si:[], tees:'white', players:[], handicaps:{}, scores:{} // scores[player][hole]
};

// ---------- UI refs ----------
const burger = $('burger');
const navlinks = document.querySelectorAll('.navlink');
const pages = {
  scorecard: $('page-scorecard'),
  history: $('page-history'),
  profiles: $('page-profiles'),
  leaderboard: $('page-leaderboard')
};

const courseName = $('courseName');
const courseArea = $('courseArea');
const courseRating = $('courseRating');
const courseSlope = $('courseSlope');
const holesSelect = $('holesSelect');
const defaultTees = $('defaultTees');

const parGrid = $('parGrid');
const tablinks = document.querySelectorAll('.tablink');
const tabpanels = document.querySelectorAll('.tabpanel');

const roundPlayers = $('roundPlayers');
const handicapInputs = $('handicapInputs');
const generateBtn = $('generateBtn');
const scorecardArea = $('scorecardArea');

const saveRoundBtn = $('saveRound');
const resetRoundBtn = $('resetRound');
const roundSummary = $('roundSummary');

const historyPlayerFilter = $('historyPlayerFilter');
const historyCourseFilter = $('historyCourseFilter');
const historyList = $('historyList');
const historyCanvas = $('historyCanvas');

const profileNewName = $('profileNewName');
const profileAddBtn = $('profileAddBtn');
const profileSelect = $('profileSelect');
const profileDetail = $('profileDetail');

const leaderboardCourse = $('leaderboardCourse');
const leaderboardArea = $('leaderboardArea');
const best9Btn = $('leader9');
const best18Btn = $('leader18');
const leaderSort = $('leaderSort');

// modal
const playerModal = $('playerModal');
const modalPlayerName = $('modalPlayerName');
const modalPlayerHcp = $('modalPlayerHcp');
const modalSavePlayer = $('modalSavePlayer');
const modalCancel = $('modalCancel');
const openAddPlayer = $('openAddPlayer');
const profileAdd = $('profileAddBtn');
const exportDataBtn = $('exportData');
const importBtn = $('importBtn');
const importFile = $('importFile');
const courseFilter = $('courseFilter');

// ---------- Init ----------
function init(){
  // default working arrays
  setWorkingDefaults();
  renderSidebarPlayers();
  bindNav();
  bindTabs();
  renderParGrid();
  populateSelects();
  renderRoundPlayers();
  renderProfiles();
  renderHistoryList();
  renderLeaderCourses();
}
function setWorkingDefaults(){
  working.holes = parseInt(holesSelect.value,10) || 18;
  working.courseRating = parseFloat(courseRating.value || 72.0);
  working.slope = parseInt(courseSlope?.value || 113,10);
  working.teees = defaultTees?.value || 'white';
  working.par = Array.from({length: working.holes}, ()=>0);
  working.si = Array.from({length: working.holes}, (_,i)=>i+1);
  working.players = [];
  working.handicaps = {};
  working.scores = {};
}

// ---------- Navigation ----------
function bindNav(){
  navlinks.forEach(btn=>{
    btn.onclick = ()=> {
      navlinks.forEach(n=>n.classList.remove('active'));
      btn.classList.add('active');
      const route = btn.dataset.route;
      Object.values(pages).forEach(p=>p.classList.add('hidden'));
      $('page-'+route).classList.remove('hidden');
      if(route === 'history') renderHistoryList();
      if(route === 'profiles') renderProfiles();
      if(route === 'leaderboard') renderLeaderCourses();
    };
  });
}

// ---------- Tabs ----------
function bindTabs(){
  tablinks.forEach(t=>{
    t.onclick = ()=> {
      tablinks.forEach(x=>x.classList.remove('active'));
      tabpanels.forEach(p=>p.classList.add('hidden'));
      t.classList.add('active');
      $(t.dataset.tab).classList.remove('hidden');
    };
  });
}

// ---------- Players in sidebar ----------
function renderSidebarPlayers(){
  const pl = document.querySelector('#playerList');
  pl.innerHTML = '';
  players.forEach((p, i)=>{
    const d = document.createElement('div'); d.className='playerChip';
    d.innerHTML = `<div><strong>${p.name}</strong><div class="meta">Hcp: ${p.hIndex?.toFixed?.(1)||0}</div></div>
                   <div style="display:flex;gap:6px">
                     <button class="btn" data-edit="${i}">Edit</button>
                     <button class="btn danger" data-del="${i}">Del</button>
                   </div>`;
    pl.appendChild(d);
  });
  // bind edit/delete
  pl.querySelectorAll('button[data-edit]').forEach(b=> b.onclick = e=>{
    const i = +b.dataset.edit; openPlayerModal(players[i]);
  });
  pl.querySelectorAll('button[data-del]').forEach(b=> b.onclick = e=>{
    const i = +b.dataset.del; if(confirm(`Delete ${players[i].name}?`)){ players.splice(i,1); savePlayers(); renderSidebarPlayers(); renderRoundPlayers(); }
  });
}

// ---------- Player modal ----------
openAddPlayer.onclick = ()=> openPlayerModal();
function openPlayerModal(item=null){
  playerModal.classList.remove('hidden');
  modalPlayerName.value = item?.name || '';
  modalPlayerHcp.value = item?.hIndex ?? 0;
  modalSavePlayer.onclick = ()=> {
    const name = modalPlayerName.value.trim(); const h = parseFloat(modalPlayerHcp.value)||0;
    if(!name) return alert('Name required');
    if(item){
      item.name = name; item.hIndex = h;
    } else {
      players.push({name, hIndex: h});
    }
    savePlayers(); closePlayerModal(); renderSidebarPlayers(); renderRoundPlayers();
  };
  modalCancel.onclick = closePlayerModal;
}
function closePlayerModal(){ playerModal.classList.add('hidden'); modalSavePlayer.onclick = null; modalCancel.onclick = null; }

// ---------- Save/load players ----------
function savePlayers(){ localStorage.setItem(STORAGE_PLAYERS, JSON.stringify(players)); }
function loadPlayers(){ players = JSON.parse(localStorage.getItem(STORAGE_PLAYERS) || '[]'); }

// ---------- Par grid render ----------
function renderParGrid(){
  parGrid.innerHTML = '';
  setWorkingDefaults();
  working.par.forEach((p,idx)=>{
    const card = document.createElement('div'); card.className='hole-card';
    card.innerHTML = `<div>Hole ${idx+1}</div>
                      <label class="small">Par
                        <input type="number" min="0" value="${p}" data-hole="${idx}" data-role="par">
                      </label>
                      <label class="small">SI
                        <input type="number" min="1" max="18" value="${working.si[idx]}" data-hole="${idx}" data-role="si">
                      </label>`;
    parGrid.appendChild(card);
  });
  parGrid.querySelectorAll('input[data-role="par"]').forEach(i=>{
    i.oninput = ()=> {
      const h = +i.dataset.hole; working.par[h] = clamp(parseInt(i.value||'0',10),0,10);
      updateRoundSummary();
    };
  });
  parGrid.querySelectorAll('input[data-role="si"]').forEach(i=>{
    i.oninput = ()=> { const h = +i.dataset.hole; working.si[h] = clamp(parseInt(i.value||'1',10),1,18); };
  });
}

// ---------- Round players selection ----------
function renderRoundPlayers(){
  roundPlayers.innerHTML = players.map(p=>`<option value="${p.name}">${p.name} (${p.hIndex?.toFixed?.(1)||0})</option>`).join('');
}
function populateSelects(){
  // course filter and history selects
  historyPlayerFilter.innerHTML = '<option value="__all__">All</option>' + players.map(p=>`<option value="${p.name}">${p.name}</option>`).join('');
  profileSelect.innerHTML = players.map(p=>`<option value="${p.name}">${p.name}</option>`).join('');
  roundPlayers.innerHTML = players.map(p=>`<option value="${p.name}">${p.name}</option>`).join('');
  courseFilter.innerHTML = '<option value="__all__">All courses</option>';
}

// ---------- Generate working scorecard area ----------
generateBtn.onclick = ()=> {
  const selected = Array.from(roundPlayers.selectedOptions).map(o=>o.value);
  if(selected.length===0) return alert('Choose at least one player for the round');
  working.players = selected;
  // ensure per-player structures
  selected.forEach(name=>{
    if(!working.scores[name]) working.scores[name] = Array.from({length: working.holes}, ()=>0);
    working.handicaps[name] = players.find(p=>p.name===name)?.hIndex ?? 0;
  });
  renderScoreTable();
  updateRoundSummary();
};

// ---------- Score table render ----------
function renderScoreTable(){
  if(!working.players.length) { scorecardArea.innerHTML = '<div class="muted">No players selected</div>'; return; }
  let html = '<div class="table-wrap"><table><thead><tr><th>Player</th>';
  for(let i=1;i<=working.holes;i++) html += `<th>H${i}</th>`;
  html += '<th>Out</th><th>In</th><th>Total</th><th>Par±</th><th>CourseHcp</th><th>Net</th></tr></thead><tbody>';
  working.players.forEach(name=>{
    html += `<tr><td class="left">${name}</td>`;
    for(let h=0; h<working.holes; h++){
      const val = (working.scores[name] && working.scores[name][h]) || 0;
      html += `<td><input class="score-input" data-player="${name}" data-hole="${h}" type="number" min="0" value="${val}" style="width:64px" /></td>`;
    }
    const totals = computeTotalsFor(name);
    html += `<td>${totals.front}</td><td>${totals.back}</td><td>${totals.total}</td><td>${totals.parDiff>=0?'+'+totals.parDiff:totals.parDiff}</td>`;
    const ch = computeCourseHandicap(name); html += `<td>${isFinite(ch)?ch:'—'}</td><td>${isFinite(totals.net)?totals.net:'—'}</td></tr>`;
  });
  html += '</tbody></table></div>';
  scorecardArea.innerHTML = html;

  // bind inputs
  scorecardArea.querySelectorAll('.score-input').forEach(inp=>{
    inp.oninput = ()=> {
      const p = inp.dataset.player, h = +inp.dataset.hole;
      working.scores[p][h] = clamp(parseInt(inp.value||'0',10), 0, 30);
      updateRoundSummary();
      // live recompute nets
      renderScoreTable();
    };
  });
}

// ---------- Totals / Handicap Calculation ----------
function computeTotalsFor(playerName){
  const arr = working.scores[playerName] || [];
  const front = arr.slice(0,9).reduce((a,b)=>a+(+b||0),0);
  const back = arr.slice(9).reduce((a,b)=>a+(+b||0),0);
  const total = arr.reduce((a,b)=>a+(+b||0),0);
  const parTotal = working.par.reduce((a,b)=>a+(+b||0),0);
  const parDiff = total - parTotal;
  const ch = computeCourseHandicap(playerName);
  const net = isFinite(ch) ? total - ch : null;
  return {front, back, total, parDiff, net};
}

// WHS Course Handicap (simplified)
function computeCourseHandicap(playerName){
  const pObj = players.find(p=>p.name===playerName);
  const HI = pObj ? (pObj.hIndex||0) : (working.handicaps[playerName]||0);
  const slope = parseInt(courseSlope?.value || working.slope || 113, 10);
  const parTotal = working.par.reduce((a,b)=>a+(+b||0),0);
  const cr = parseFloat(courseRating?.value || working.courseRating || 72.0);
  const ch = HI * (slope/113) + (cr - parTotal);
  return Math.round(ch);
}

// ---------- Round summary / quick info ----------
function updateRoundSummary(){
  const playersCount = working.players.length;
  const holes = working.holes;
  const parTotal = working.par.reduce((a,b)=>a+(+b||0),0);
  roundSummary.textContent = `${playersCount} players • ${holes} holes • Par ${parTotal}`;
}

// ---------- Save / Load rounds ----------
$('saveRound').onclick = ()=> {
  if(!working.players.length) return alert('Generate a scorecard first');
  const item = {
    id: working.id || Date.now(),
    ts: new Date().toISOString(),
    courseName: courseName.value || working.courseName,
    area: courseArea.value || working.area,
    holes: working.holes,
    courseRating: parseFloat(courseRating.value||working.courseRating),
    slope: parseInt(courseSlope.value||working.slope,10),
    par: working.par.slice(),
    si: working.si.slice(),
    tees: defaultTees.value || working.teees,
    players: working.players.slice(),
    scores: JSON.parse(JSON.stringify(working.scores))
  };
  // replace if editing
  const idx = rounds.findIndex(r=>r.id===item.id);
  if(idx>=0) rounds[idx]=item; else rounds.push(item);
  localStorage.setItem(STORAGE_ROUNDS, JSON.stringify(rounds));
  alert('Round saved to history');
  renderHistoryList(); renderLeaderCourses(); savePlayers();
};

// Reset round
resetRoundBtn.onclick = ()=> {
  if(!working.players.length) return;
  working.players.forEach(p => working.scores[p] = Array.from({length:working.holes}, ()=>0));
  renderScoreTable();
};

// ---------- History ----------
function renderHistoryList(){
  rounds = JSON.parse(localStorage.getItem(STORAGE_ROUNDS) || '[]');
  // populate course filter
  const courses = [...new Set(rounds.map(r=>r.courseName).filter(Boolean))];
  historyCourseFilter.innerHTML = '<option value="__all__">All</option>' + courses.map(c=>`<option value="${c}">${c}</option>`).join('');
  courseFilter.innerHTML = '<option value="__all__">All courses</option>' + courses.map(c=>`<option value="${c}">${c}</option>`).join('');
  // populate history list
  const playerFilter = historyPlayerFilter.value || '__all__';
  const show = $('historyShow').value || 'all';
  historyList.innerHTML = '';
  rounds.slice().reverse().forEach(r=>{
    if(playerFilter!=='__all__' && !r.players.includes(playerFilter)) return;
    if(show==='9' && r.holes!==9) return;
    if(show==='18' && r.holes!==18) return;
    const div = document.createElement('div'); div.className='card';
    const totals = r.players.map(p => {
      const tot = r.scores[p].slice(0,r.holes).reduce((a,b)=>a+(+b||0),0);
      return `${p}: ${tot}`;
    }).join(' • ');
    div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div><strong>${r.courseName || '(unknown)'}</strong> — ${new Date(r.ts).toLocaleString()} — ${r.holes} holes</div>
                     <div style="display:flex;gap:8px">
                       <button class="btn" data-load="${r.id}">Load</button>
                       <button class="btn" data-edit="${r.id}">Edit</button>
                       <button class="btn danger" data-del="${r.id}">Delete</button>
                     </div></div>
                     <div class="small muted" style="margin-top:8px">${totals}</div>`;
    historyList.appendChild(div);
  });
  // bind loads/edits/deletes
  historyList.querySelectorAll('button[data-load]').forEach(b=> b.onclick = ()=> {
    const id = +b.dataset.load; const r = rounds.find(x=>x.id===id); if(r) { loadRoundIntoWorking(r); showSection('scorecard'); }
  });
  historyList.querySelectorAll('button[data-edit]').forEach(b=> b.onclick = ()=> {
    const id = +b.dataset.edit; const r = rounds.find(x=>x.id===id); if(r) { loadRoundIntoWorking(r); working.id = r.id; showSection('scorecard'); }
  });
  historyList.querySelectorAll('button[data-del]').forEach(b=> b.onclick = ()=> {
    const id = +b.dataset.del; if(!confirm('Delete this round?')) return; rounds = rounds.filter(x=>x.id!==id); localStorage.setItem(STORAGE_ROUNDS, JSON.stringify(rounds)); renderHistoryList(); renderLeaderCourses();
  });

  // draw simple chart
  drawHistoryChart();
}

// load round for editing/playing
function loadRoundIntoWorking(r){
  working.id = r.id;
  working.courseName = r.courseName; courseName.value = r.courseName;
  working.area = r.area; courseArea.value = r.area;
  working.holes = r.holes; holesSelect.value = r.holes;
  working.courseRating = r.courseRating; courseRating.value = r.courseRating;
  working.slope = r.slope; courseSlope.value = r.slope;
  working.par = r.par.slice(); working.si = r.si.slice(); defaultTees.value = r.teees || r.teees;
  working.players = r.players.slice();
  working.scores = JSON.parse(JSON.stringify(r.scores));
  renderParGrid(); renderRoundPlayers(); renderScoreTable(); updateRoundSummary();
}

// ---------- Charting history (simple) ----------
function drawHistoryChart(){
  const ctx = historyCanvas.getContext('2d'); ctx.clearRect(0,0,historyCanvas.width, historyCanvas.height);
  const hist = rounds.slice().reverse();
  if(!hist.length) { ctx.fillStyle='#9aa3b2'; ctx.fillText('No history', 20,20); return; }
  // build series for first player or total average
  const points = hist.map(r => {
    const totals = r.players.map(p=> r.scores[p].slice(0,r.holes).reduce((a,b)=>a+(+b||0),0));
    return { t: new Date(r.ts).getTime(), v: totals.reduce((a,b)=>a+b,0)/totals.length };
  });
  points.sort((a,b)=>a.t-b.t);
  // scale
  const pad=40, W=historyCanvas.width, H=historyCanvas.height;
  const xmin = Math.min(...points.map(p=>p.t)), xmax = Math.max(...points.map(p=>p.t));
  const ymin = Math.min(...points.map(p=>p.v)), ymax = Math.max(...points.map(p=>p.v));
  const x = t => pad + ((t - xmin)/(xmax - xmin || 1))*(W - 2*pad);
  const y = v => H - pad - ((v - ymin)/(ymax - ymin || 1))*(H - 2*pad);
  ctx.strokeStyle = '#7c9cff'; ctx.beginPath();
  points.forEach((pt,i)=> { if(i===0) ctx.moveTo(x(pt.t), y(pt.v)); else ctx.lineTo(x(pt.t), y(pt.v)); ctx.fillStyle='#7c9cff'; ctx.fillRect(x(pt.t)-2,y(pt.v)-2,4,4); });
  ctx.stroke();
}

// ---------- Profiles ----------
function renderProfiles(){
  profileSelect.innerHTML = players.map(p=>`<option value="${p.name}">${p.name}</option>`).join('');
  profileDetail.innerHTML = '';
}
profileAddBtn.onclick = ()=> {
  const nm = profileNewName.value.trim(); if(!nm) return alert('Name required'); players.push({name:nm, hIndex:0}); savePlayers(); renderSidebarPlayers(); renderProfiles();
};

// ---------- Leaderboard ----------
function renderLeaderCourses(){
  const courses = [...new Set(rounds.map(r=>r.courseName).filter(Boolean))];
  leaderboardCourse.innerHTML = '<option value="__none__">Select course...</option>' + courses.map(c=>`<option value="${c}">${c}</option>`).join('');
  $('leaderboardCourse').onchange = ()=> renderLeaderboard();
}
function renderLeaderboard(){
  const course = leaderboardCourse.value; if(!course || course==='__none__') { leaderboardArea.innerHTML='Choose a course'; return; }
  const courseRounds = rounds.filter(r=>r.courseName===course);
  const stats = {}; // player => {best9,best18,bestNet9,bestNet18}
  courseRounds.forEach(r=>{
    r.players.forEach(p=>{
      const tot = r.scores[p].slice(0,r.holes).reduce((a,b)=>a+(+b||0),0);
      const net = tot - computeCourseHandicapFromRound(p, r);
      stats[p] = stats[p]||{best9:Infinity,best18:Infinity,bestNet9:Infinity,bestNet18:Infinity, rounds:0};
      stats[p].rounds++;
      if(r.holes===9){ stats[p].best9 = Math.min(stats[p].best9, tot); stats[p].bestNet9 = Math.min(stats[p].bestNet9, net); }
      if(r.holes===18){ stats[p].best18 = Math.min(stats[p].best18, tot); stats[p].bestNet18 = Math.min(stats[p].bestNet18, net); }
    });
  });
  // build table
  let html = '<div class="table-wrap"><table><thead><tr><th>Player</th><th>Best 9 (G)</th><th>Best 9 (Net)</th><th>Best 18 (G)</th><th>Best 18 (Net)</th><th>Rounds</th></tr></thead><tbody>';
  Object.keys(stats).sort((a,b)=>{
    // sort by best (18 if available else 9) then alpha
    const sa = stats[a], sb = stats[b];
    const aScore = isFinite(sa.best18)?sa.best18:sa.best9||Infinity;
    const bScore = isFinite(sb.best18)?sb.best18:sb.best9||Infinity;
    if(aScore===bScore) return a.localeCompare(b);
    return aScore - bScore;
  }).forEach(p=>{
    const s = stats[p];
    html += `<tr><td>${p}</td><td>${isFinite(s.best9)?s.best9:'—'}</td><td>${isFinite(s.bestNet9)?s.bestNet9:'—'}</td><td>${isFinite(s.best18)?s.best18:'—'}</td><td>${isFinite(s.bestNet18)?s.bestNet18:'—'}</td><td>${s.rounds}</td></tr>`;
  });
  html += '</tbody></table></div>';
  leaderboardArea.innerHTML = html;
}
function computeCourseHandicapFromRound(playerName, round){
  const p = players.find(x=>x.name===playerName); const HI = p?.hIndex||0;
  const parTotal = round.par.reduce((a,b)=>a+(+b||0),0);
  return Math.round(HI * (round.slope/113) + (round.courseRating - parTotal));
}

// ---------- Save/load players & rounds ----------
function savePlayers(){ localStorage.setItem(STORAGE_PLAYERS, JSON.stringify(players)); }
function loadPlayers(){ players = JSON.parse(localStorage.getItem(STORAGE_PLAYERS) || '[]'); }
function loadRounds(){ rounds = JSON.parse(localStorage.getItem(STORAGE_ROUNDS) || '[]'); }

// ---------- Other bindings ----------
document.addEventListener('DOMContentLoaded', ()=> {
  loadPlayers(); loadRounds(); init();
  // bindings for small controls
  holesSelect.onchange = ()=> { working.holes = +holesSelect.value; renderParGrid(); };
  courseRating.oninput = ()=> working.courseRating = parseFloat(courseRating.value||72.0);
  courseSlope.oninput = ()=> working.slope = parseInt(courseSlope.value||113,10);
  historyPlayerFilter.onchange = renderHistoryList;
  historyCourseFilter.onchange = renderHistoryList;
  $('historyShow').onchange = renderHistoryList;
  profileSelect.onchange = renderProfileDetail;
  best9Btn.onclick = ()=> { $('leaderboardMode')?.value='9'; renderLeaderboard(); };
  best18Btn.onclick = ()=> { $('leaderboardMode')?.value='18'; renderLeaderboard(); };
  exportDataBtn.onclick = ()=> {
    const data = {players, rounds}; const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='golf-data.json'; a.click();
  };
  importBtn.onclick = ()=> importFile.click();
  importFile.onchange = async (e)=> {
    const f = e.target.files[0]; if(!f) return;
    const txt = await f.text(); try { const obj = JSON.parse(txt); if(obj.players) { players = obj.players; savePlayers(); } if(obj.rounds){ rounds = obj.rounds; localStorage.setItem(STORAGE_ROUNDS, JSON.stringify(rounds)); } alert('Import complete'); location.reload(); } catch(err){ alert('Invalid JSON'); }
  };
});
