/* app.js
   Implements:
   - Add player modal (toggle handicap)
   - Optional manual handicap; otherwise compute from rounds using WHS formula
   - Pars default 0, editable
   - Generate interactive scorecard and per-hole score inputs
   - Save rounds, compute differentials, update player's auto-calculated handicap
   - History, profiles, leaderboards with best 9/18 and alphabetical tie-break
   - Persistence via localStorage
*/

// --- Helpers ---
const $ = id => document.getElementById(id);
const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
const STORAGE_PLAYERS = 'gc_players_v1';
const STORAGE_ROUNDS = 'gc_rounds_v1';

// --- State ---
let players = JSON.parse(localStorage.getItem(STORAGE_PLAYERS) || '[]'); // [{name, hIndex (optional), auto:bool}]
let rounds = JSON.parse(localStorage.getItem(STORAGE_ROUNDS) || '[]');   // saved rounds
let working = { id:null, courseName:'', area:'', courseRating:72.0, slope:113, holes:18, par:[], si:[], tees:'white', players:[], scores:{} };

// --- UI refs ---
const navlinks = document.querySelectorAll('.navlink');
const pages = {
  scorecard: $('page-scorecard'),
  history: $('page-history'),
  profiles: $('page-profiles'),
  leaderboard: $('page-leaderboard')
};

// scorecard refs
const courseName = $('courseName'), courseArea = $('courseArea'), courseRating = $('courseRating'), courseSlope = $('courseSlope');
const holesCount = $('holesCount'), defaultTees = $('defaultTees');
const parGrid = $('parGrid');
const tablinks = document.querySelectorAll('.tablink');
const roundPlayers = $('roundPlayers'), hcpInputs = $('hcpInputs');
const generateCard = $('generateCard'), resetScores = $('resetScores');
const scorecardArea = $('scorecardArea');
const saveRound = $('saveRound'), saveRoundAsNew = $('saveRoundAsNew'), clearCourse = $('clearCourse');
const roundInfo = $('roundInfo');

// modal refs
const playerModal = $('playerModal'), playerName = $('playerName'), toggleHcp = $('toggleHcp'), playerHcpRow = $('playerHcpRow');
const playerHcp = $('playerHcp'), savePlayerBtn = $('savePlayerBtn'), cancelPlayerBtn = $('cancelPlayerBtn');
const addPlayerScoreBtn = $('addPlayerScoreBtn'), addPlayerProfileBtn = $('addPlayerProfileBtn');

// history/profile/leaderboard refs
const historyPlayer = $('historyPlayer'), historyCourse = $('historyCourse'), historyType = $('historyType');
const historyList = $('historyList'), historyCanvas = $('historyCanvas');
const profileSelect = $('profileSelect'), profileDetail = $('profileDetail');
const leaderCourse = $('leaderCourse'), leaderboardArea = $('leaderboardArea');

// --- Init ---
function init(){
  loadState();
  bindNav();
  bindTabs();
  populateSidebar();
  setWorkingDefaults();
  renderParGrid();
  populateRoundPlayerSelect();
  renderProfilesList();
  renderHistory();
  renderLeaderboardCourses();
  attachEvents();
}
function loadState(){
  players = JSON.parse(localStorage.getItem(STORAGE_PLAYERS) || '[]');
  rounds = JSON.parse(localStorage.getItem(STORAGE_ROUNDS) || '[]');
}
function saveState(){
  localStorage.setItem(STORAGE_PLAYERS, JSON.stringify(players));
  localStorage.setItem(STORAGE_ROUNDS, JSON.stringify(rounds));
}

// --- Navigation ---
function bindNav(){
  navlinks.forEach(b=>{
    b.onclick = ()=> {
      navlinks.forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      const route = b.dataset.route;
      Object.values(pages).forEach(p=>p.classList.add('hidden'));
      pages[route].classList.remove('hidden');
      if(route==='history') renderHistory();
      if(route==='profiles') renderProfilesPage();
      if(route==='leaderboard') renderLeaderboardCourses();
    };
  });
}

// --- Tabs ---
function bindTabs(){
  tablinks.forEach(t=>{
    t.onclick = ()=> {
      tablinks.forEach(x=>x.classList.remove('active'));
      document.querySelectorAll('.tabpanel').forEach(p=>p.classList.add('hidden'));
      t.classList.add('active');
      $(t.dataset.tab).classList.remove('hidden');
    };
  });
}

// --- Working defaults & par grid ---
function setWorkingDefaults(){
  working.holes = parseInt(holesCount.value,10) || 18;
  working.courseRating = parseFloat(courseRating.value) || 72.0;
  working.slope = parseInt(courseSlope.value,10) || 113;
  working.par = Array.from({length:working.holes}, ()=>0); // start at 0 per request
  working.si = Array.from({length:working.holes}, (_,i)=>i+1);
  working.scores = {};
}
function renderParGrid(){
  parGrid.innerHTML = '';
  setWorkingDefaults();
  for(let i=0;i<working.holes;i++){
    const div = document.createElement('div'); div.className='hole';
    div.innerHTML = `<div>Hole ${i+1}</div><label>Par <input type="number" min="0" value="${working.par[i]}" data-role="par" data-hole="${i}"></label>
                     <label>SI <input type="number" min="1" max="${working.holes}" value="${working.si[i]}" data-role="si" data-hole="${i}"></label>`;
    parGrid.appendChild(div);
  }
  // bind
  parGrid.querySelectorAll('input[data-role="par"]').forEach(inp=>{
    inp.oninput = e => {
      const h = +inp.dataset.hole; working.par[h] = clamp(parseInt(inp.value||'0',10),0,10);
      updateRoundInfo();
    };
  });
  parGrid.querySelectorAll('input[data-role="si"]').forEach(inp=>{
    inp.oninput = e => {
      const h = +inp.dataset.hole; working.si[h] = clamp(parseInt(inp.value||'1',10),1,working.holes);
    };
  });
}

// --- Players UI ---
function populateRoundPlayerSelect(){
  roundPlayers.innerHTML = players.map(p=>`<option value="${p.name}">${p.name}${p.hIndex!=null?` (hcp ${p.hIndex})`:''}</option>`).join('');
  historyPlayer.innerHTML = '<option value="__all__">All</option>' + players.map(p=>`<option value="${p.name}">${p.name}</option>`).join('');
  profileSelect.innerHTML = players.map(p=>`<option value="${p.name}">${p.name}</option>`).join('');
}
function populateSidebar(){
  const pl = $('playerList'); pl.innerHTML = '';
  players.forEach((p,idx)=>{
    const d = document.createElement('div'); d.className='player';
    d.innerHTML = `<div><strong>${p.name}</strong><div class="small muted">Hcp: ${p.hIndex!=null?p.hIndex.toFixed(1):'—'}</div></div>
                   <div style="display:flex;gap:6px"><button class="btn" data-edit="${idx}">Edit</button><button class="btn danger" data-del="${idx}">Del</button></div>`;
    pl.appendChild(d);
  });
  pl.querySelectorAll('button[data-edit]').forEach(b=> b.onclick = ()=> {
    openPlayerModal(players[+b.dataset.edit]);
  });
  pl.querySelectorAll('button[data-del]').forEach(b => b.onclick = ()=> {
    const idx = +b.dataset.del; if(confirm(`Delete player ${players[idx].name}?`)){ players.splice(idx,1); saveState(); populateRoundPlayerSelect(); populateSidebar(); renderProfilesPage(); }
  });
}

// --- Modal: Add/Edit player with toggle handicap ---
let editingPlayer = null;
function openPlayerModal(player=null){
  editingPlayer = player || null;
  if(editingPlayer){ $('playerModalTitle').textContent = 'Edit Player'; playerName.value = editingPlayer.name; playerHcp.value = editingPlayer.hIndex!=null?editingPlayer.hIndex:''; }
  else { $('playerModalTitle').textContent = 'Add Player'; playerName.value = ''; playerHcp.value = ''; }
  playerHcpRow.classList.add('hidden'); playerModal.classList.remove('hidden');
}
function closePlayerModal(){
  editingPlayer = null; playerModal.classList.add('hidden');
}
toggleHcp.onclick = ()=> playerHcpRow.classList.toggle('hidden');
savePlayerBtn.onclick = ()=>{
  const nm = playerName.value.trim(); if(!nm) return alert('Enter player name');
  const h = playerHcp.value !== '' ? parseFloat(playerHcp.value) : null;
  if(editingPlayer){
    editingPlayer.name = nm; editingPlayer.hIndex = h;
  } else {
    players.push({name:nm, hIndex: h});
  }
  saveState(); populateRoundPlayerSelect(); populateSidebar(); renderProfilesPage(); closePlayerModal();
};
cancelPlayerBtn.onclick = closePlayerModal;

// bind modal openers (Scorecard & Profile)
addPlayerScoreBtn.onclick = ()=> openPlayerModal();
addPlayerProfileBtn.onclick = ()=> openPlayerModal();

// --- Generate Scorecard UI ---
generateCard.onclick = ()=>{
  const selected = Array.from(roundPlayers.selectedOptions).map(o=>o.value);
  if(selected.length === 0) return alert('Select at least one player');
  working.players = selected;
  // ensure score arrays
  selected.forEach(n => {
    if(!working.scores[n]) working.scores[n] = Array.from({length: working.holes}, ()=>0);
  });
  // render handicap inputs grid
  hcpInputs.innerHTML = selected.map(n=>{
    const p = players.find(x=>x.name===n);
    const val = p && p.hIndex!=null ? p.hIndex : '';
    return `<div><label>${n}</label><input data-player="${n}" class="hcp-field" type="number" step="0.1" value="${val}" /></div>`;
  }).join('');
  // bind hcp inputs
  hcpInputs.querySelectorAll('.hcp-field').forEach(inp=>{
    inp.oninput = ()=> {
      const pName = inp.dataset.player; const v = inp.value; // user can set a temporary hcp for this round (doesn't overwrite profile)
      working.handicapTemp = working.handicapTemp || {}; working.handicapTemp[pName] = v!==''?parseFloat(v):null;
      renderScoreTable();
    };
  });
  renderScoreTable();
  updateRoundInfo();
};

// render table
function renderScoreTable(){
  if(!working.players.length){ scorecardArea.innerHTML = '<div class="muted">No players selected</div>'; return; }
  let html = '<div class="table-wrap"><table><thead><tr><th>Player</th>';
  for(let i=1;i<=working.holes;i++) html += `<th>H${i}</th>`;
  html += '<th>Total</th><th>Net</th></tr></thead><tbody>';
  working.players.forEach(p=>{
    html += `<tr><td class="left">${p}</td>`;
    for(let h=0; h<working.holes; h++){
      const v = (working.scores[p] && working.scores[p][h]) || 0;
      html += `<td><input type="number" min="0" class="scorecell" data-player="${p}" data-hole="${h}" value="${v}" style="width:64px"></td>`;
    }
    const total = working.scores[p].reduce((a,b)=>a+(+b||0),0);
    const ch = getCourseHandicapForPlayer(p, {courseRating: parseFloat(courseRating.value)||72.0, slope: parseInt(courseSlope.value)||113});
    const net = Number.isFinite(ch) ? total - ch : '—';
    html += `<td>${total}</td><td>${net}</td></tr>`;
  });
  html += '</tbody></table></div>';
  scorecardArea.innerHTML = html;

  // bind inputs
  scorecardArea.querySelectorAll('.scorecell').forEach(inp=>{
    inp.oninput = ()=> {
      const p = inp.dataset.player, h = +inp.dataset.hole;
      working.scores[p][h] = clamp(parseInt(inp.value||'0',10),0,30);
      renderScoreTable(); // re-render to update totals/net
    };
  });
}

// compute course handicap for a player using either provided temporary Hcp (round input) or stored profile HIndex or computed index
function getCourseHandicapForPlayer(playerName, course){
  // prefer temporary field on round
  const temp = working.handicapTemp && working.handicapTemp[playerName];
  if(temp != null && temp !== '') {
    const HI = parseFloat(temp);
    return Math.round(HI * (course.slope/113) + (course.courseRating - working.par.reduce((a,b)=>a+(+b||0),0)));
  }
  // profile hIndex if provided
  const prof = players.find(p => p.name === playerName);
  if(prof && prof.hIndex != null) {
    const HI = parseFloat(prof.hIndex);
    return Math.round(HI * (course.slope/113) + (course.courseRating - working.par.reduce((a,b)=>a+(+b||0),0)));
  }
  // else compute from player's saved differentials (derived from rounds)
  const diffs = computePlayerDifferentials(playerName);
  if(!diffs.length) return NaN;
  // Use average of best 8 of last up to 20 differentials
  const recent = diffs.slice(-20);
  recent.sort((a,b)=>a-b);
  const take = Math.min(8, recent.length);
  const avg = recent.slice(0,take).reduce((a,b)=>a+b,0)/take;
  return Math.round(avg); // average differential approximated => treated as course handicap here (simplified)
}

// compute differentials for a player from stored rounds: (Gross - CourseRating) * 113 / Slope
function computePlayerDifferentials(playerName){
  const diffs = [];
  rounds.forEach(r => {
    if(r.scores && r.scores[playerName]){
      const gross = r.scores[playerName].slice(0,r.holes).reduce((a,b)=>a+(+b||0),0);
      const cr = parseFloat(r.courseRating || r.courseRating === 0 ? r.courseRating : (72.0));
      const slope = parseInt(r.slope || r.slope === 0 ? r.slope : 113, 10);
      const diff = ((gross - cr) * 113) / slope;
      diffs.push(diff);
    }
  });
  return diffs;
}

// update round info text
function updateRoundInfo(){
  const pcount = working.players.length;
  const parTotal = working.par.reduce((a,b)=>a+(+b||0),0);
  roundInfo.textContent = `${pcount} players • ${working.holes} holes • Par ${parTotal}`;
}

// --- Save Round (compute differentials and update player's auto-handicap if they didn't set manual) ---
saveRound.onclick = ()=>{
  if(!working.players.length) return alert('Generate and fill scorecard before saving');
  // build round object
  const round = {
    id: working.id || Date.now(),
    ts: new Date().toISOString(),
    courseName: courseName.value.trim(),
    area: courseArea.value.trim(),
    courseRating: parseFloat(courseRating.value) || 72.0,
    slope: parseInt(courseSlope.value,10) || 113,
    holes: working.holes,
    par: working.par.slice(),
    si: working.si.slice(),
    tees: defaultTees.value || working.teees,
    players: working.players.slice(),
    scores: JSON.parse(JSON.stringify(working.scores))
  };
  // compute differentials and append to round meta
  round.differentials = {};
  round.players.forEach(p => {
    const gross = round.scores[p].slice(0,round.holes).reduce((a,b)=>a+(+b||0),0);
    const diff = ((gross - round.courseRating) * 113) / round.slope;
    round.differentials[p] = Number(diff.toFixed(2));
  });

  // store or replace
  const idx = rounds.findIndex(r => r.id === round.id);
  if(idx >= 0) rounds[idx] = round; else rounds.push(round);
  localStorage.setItem(STORAGE_ROUNDS, JSON.stringify(rounds));

  // update auto-calculated handicap for players who did not set manual hIndex
  round.players.forEach(name => {
    const prof = players.find(p => p.name === name);
    if(prof && (prof.hIndex == null || prof.hIndex === '')) {
      // recompute differential list and set hIndex as average best 8 (simplified)
      const diffs = computePlayerDifferentials(name);
      if(diffs.length){
        const last20 = diffs.slice(-20).sort((a,b)=>a-b);
        const take = Math.min(8, last20.length);
        const avg = last20.slice(0,take).reduce((a,b)=>a+b,0)/take;
        prof.hIndex = parseFloat(avg.toFixed(1));
      }
    }
  });

  saveState();
  alert('Round saved — differentials computed and player auto-handicaps updated (if no manual handicap set).');
  renderHistory();
  renderLeaderboardCourses();
  populateRoundPlayerSelect();
  populateSidebar();
};

// Save As New (always add new round)
saveRoundAsNew.onclick = ()=> {
  working.id = null;
  saveRound.onclick();
};

// Clear course fields
clearCourse.onclick = ()=> {
  if(!confirm('Clear course fields and pars?')) return;
  courseName.value = ''; courseArea.value = ''; courseRating.value = '72.0'; courseSlope.value = '113';
  holesCount.value = '18'; defaultTees.value = 'white';
  setWorkingDefaults(); renderParGrid(); scorecardArea.innerHTML = '';
};

// Reset scores for current working players
resetScores.onclick = ()=> {
  working.players.forEach(p => working.scores[p] = Array.from({length:working.holes}, ()=>0));
  renderScoreTable();
};

// --- History rendering & chart ---
function renderHistory(){
  rounds = JSON.parse(localStorage.getItem(STORAGE_ROUNDS) || '[]');
  const courses = [...new Set(rounds.map(r=>r.courseName).filter(Boolean))];
  $('historyCourse').innerHTML = '<option value="__all__">All</option>' + courses.map(c=>`<option value="${c}">${c}</option>`).join('');
  $('courseSelect').innerHTML = '<option value="__all__">All courses</option>' + courses.map(c=>`<option value="${c}">${c}</option>`).join('');
  $('leaderCourse').innerHTML = '<option value="__none__">Choose</option>' + courses.map(c=>`<option value="${c}">${c}</option>`).join('');

  // list
  historyList.innerHTML = '';
  rounds.slice().reverse().forEach(r=>{
    const totals = r.players.map(p => `${p}: ${r.scores[p].slice(0,r.holes).reduce((a,b)=>a+(+b||0),0)}`).join(' • ');
    const div = document.createElement('div'); div.className='card';
    div.innerHTML = `<div style="display:flex;justify-content:space-between">
      <div><strong>${r.courseName||'(unknown)'}</strong> — ${new Date(r.ts).toLocaleString()} — ${r.holes} holes</div>
      <div style="display:flex;gap:8px">
        <button class="btn" data-load="${r.id}">Load</button>
        <button class="btn" data-edit="${r.id}">Edit</button>
        <button class="btn danger" data-del="${r.id}">Delete</button>
      </div></div><div class="small muted" style="margin-top:8px">${totals}</div>`;
    historyList.appendChild(div);
  });
  // bind actions
  historyList.querySelectorAll('button[data-load]').forEach(b=> b.onclick = ()=> {
    const id = +b.dataset.load; const r = rounds.find(x=>x.id===id); if(r) loadRoundToWorking(r);
  });
  historyList.querySelectorAll('button[data-edit]').forEach(b=> b.onclick = ()=> {
    const id = +b.dataset.edit; const r = rounds.find(x=>x.id===id); if(r) { working.id = r.id; loadRoundToWorking(r); pages.scorecard.classList.remove('hidden'); }
  });
  historyList.querySelectorAll('button[data-del]').forEach(b=> b.onclick = ()=> {
    const id = +b.dataset.del; if(confirm('Delete round?')){ rounds = rounds.filter(x=>x.id!==id); saveState(); renderHistory(); renderLeaderboardCourses(); }
  });

  drawHistoryChart();
}

function loadRoundToWorking(r){
  working.id = r.id; working.courseName = r.courseName; courseName.value = r.courseName;
  working.area = r.area; courseArea.value = r.area;
  working.courseRating = r.courseRating; courseRating.value = r.courseRating;
  working.slope = r.slope; courseSlope.value = r.slope;
  working.holes = r.holes; holesCount.value = r.holes;
  working.par = r.par.slice(); working.si = r.si.slice();
  working.teees = r.teees || r.teees;
  working.players = r.players.slice(); working.scores = JSON.parse(JSON.stringify(r.scores));
  renderParGrid(); populateRoundPlayerSelect(); renderScoreTable();
}

// simple chart: average totals over rounds
function drawHistoryChart(){
  const cvs = historyCanvas; const ctx = cvs.getContext('2d');
  ctx.clearRect(0,0,cvs.width,cvs.height);
  if(!rounds.length) { ctx.fillStyle = '#9aa3b2'; ctx.fillText('No history', 20,20); return; }
  const pts = rounds.slice().map(r => {
    const avg = r.players.map(p => r.scores[p].slice(0,r.holes).reduce((a,b)=>a+(+b||0),0)).reduce((a,b)=>a+b,0)/r.players.length;
    return {t: new Date(r.ts).getTime(), v: avg};
  }).sort((a,b)=>a.t-b.t);
  const pad=40, W=cvs.width, H=cvs.height;
  const xmin = Math.min(...pts.map(p=>p.t)), xmax = Math.max(...pts.map(p=>p.t));
  const ymin = Math.min(...pts.map(p=>p.v)), ymax = Math.max(...pts.map(p=>p.v));
  const sx = t => pad + ((t - xmin)/(xmax - xmin || 1))*(W-2*pad);
  const sy = v => H - pad - ((v - ymin)/(ymax - ymin || 1))*(H-2*pad);
  ctx.strokeStyle='#7c9cff'; ctx.beginPath();
  pts.forEach((pt,i)=> { if(i===0) ctx.moveTo(sx(pt.t),sy(pt.v)); else ctx.lineTo(sx(pt.t),sy(pt.v)); ctx.fillRect(sx(pt.t)-2,sy(pt.v)-2,4,4); });
  ctx.stroke();
}

// --- Profiles page ---
function renderProfilesPage(){
  profileSelect.innerHTML = players.map(p=>`<option value="${p.name}">${p.name}</option>`).join('');
  renderProfileDetail();
}
profileSelect.onchange = renderProfileDetail;
function renderProfileDetail(){
  const name = profileSelect.value; profileDetail.innerHTML = '';
  if(!name) return;
  const p = players.find(x=>x.name===name);
  let html = `<h3>${p.name}</h3><div class="small muted">Handicap: ${p.hIndex!=null?p.hIndex.toFixed(1):'Not set (auto)'}</div>`;
  const playerRounds = rounds.filter(r=>r.players.includes(name));
  html += `<h4 style="margin-top:10px">Rounds (${playerRounds.length})</h4>`;
  playerRounds.forEach(r=>{
    const tot = r.scores[name].slice(0,r.holes).reduce((a,b)=>a+(+b||0),0);
    const diff = r.differentials && r.differentials[name] ? r.differentials[name] : ((tot - r.courseRating) * 113 / r.slope).toFixed(2);
    html += `<div class="card small">${r.courseName} — ${new Date(r.ts).toLocaleDateString()} — Total: ${tot} — Diff: ${diff}</div>`;
  });
  profileDetail.innerHTML = html;
}

// --- Leaderboard ---
function renderLeaderboardCourses(){
  const courses = [...new Set(rounds.map(r=>r.courseName).filter(Boolean))];
  leaderCourse.innerHTML = '<option value="__none__">Choose...</option>' + courses.map(c=>`<option value="${c}">${c}</option>`).join('');
}
$('refreshLeader').onclick = renderLeaderboard;
function renderLeaderboard(){
  const course = leaderCourse.value; if(!course || course==='__none__') { leaderboardArea.innerHTML = 'Select a course'; return; }
  const courseRounds = rounds.filter(r=>r.courseName===course);
  const stats = {}; // {player: {best9, best18, bestNet9, bestNet18, rounds}}
  courseRounds.forEach(r=>{
    r.players.forEach(p=>{
      const gross = r.scores[p].slice(0,r.holes).reduce((a,b)=>a+(+b||0),0);
      const ch = Math.round((players.find(x=>x.name===p)?.hIndex || computePlayerDifferentials(p).slice(-20).sort((a,b)=>a-b).slice(0,8).reduce((a,b)=>a+b,0)/8) || 0);
      const net = gross - ch;
      stats[p] = stats[p] || {best9:Infinity,best18:Infinity,bestNet9:Infinity,bestNet18:Infinity,rounds:0};
      if(r.holes===9){ stats[p].best9 = Math.min(stats[p].best9, gross); stats[p].bestNet9 = Math.min(stats[p].bestNet9, net); }
      if(r.holes===18){ stats[p].best18 = Math.min(stats[p].best18, gross); stats[p].bestNet18 = Math.min(stats[p].bestNet18, net); }
      stats[p].rounds++;
    });
  });
  const rows = Object.keys(stats).sort((a,b)=>{
    // choose best 18 if exists else best9
    const aScore = isFinite(stats[a].best18)?stats[a].best18: (isFinite(stats[a].best9)?stats[a].best9:Infinity);
    const bScore = isFinite(stats[b].best18)?stats[b].best18: (isFinite(stats[b].best9)?stats[b].best9:Infinity);
    if(aScore === bScore) return a.localeCompare(b);
    return aScore - bScore;
  }).map(p => `<tr><td>${p}</td><td>${isFinite(stats[p].best9)?stats[p].best9:'—'}</td><td>${isFinite(stats[p].bestNet9)?stats[p].bestNet9:'—'}</td><td>${isFinite(stats[p].best18)?stats[p].best18:'—'}</td><td>${isFinite(stats[p].bestNet18)?stats[p].bestNet18:'—'}</td><td>${stats[p].rounds}</td></tr>`).join('');
  leaderboardArea.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Player</th><th>Best 9 (G)</th><th>Best 9 (N)</th><th>Best 18 (G)</th><th>Best 18 (N)</th><th>Rounds</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// compute diffs helper used above for leaderboards
function computePlayerDifferentials(player){
  const diffs = [];
  rounds.forEach(r=>{
    if(r.scores && r.scores[player]){
      const gross = r.scores[player].slice(0,r.holes).reduce((a,b)=>a+(+b||0),0);
      const diff = ((gross - r.courseRating) * 113) / r.slope;
      diffs.push(diff);
    }
  });
  return diffs;
}

// --- attach events & initializations ---
function attachEvents(){
  // holes change -> re-render par grid
  holesCount.onchange = ()=> { setWorkingDefaults(); renderParGrid(); };

  // modal cancel
  $('cancelPlayerBtn')?.addEventListener('click', ()=> playerModal.classList.add('hidden'));
  // export / import
  $('exportBtn').onclick = ()=> {
    const data = {players, rounds}; const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'golf-data.json'; a.click();
  };
  $('importBtn').onclick = ()=> $('importFile').click();
  $('importFile').onchange = async (e) => {
    const f = e.target.files[0]; if(!f) return;
    const txt = await f.text(); try { const obj = JSON.parse(txt); if(obj.players) players = obj.players; if(obj.rounds) rounds = obj.rounds; saveState(); location.reload(); } catch(err){ alert('Invalid import file'); }
  };

  // add player button in profile page
  $('addPlayerProfileBtn')?.addEventListener('click', ()=> openPlayerModal());
  // initial UI wiring for modal (save/cancel done earlier)
}

// --- initial run ---
document.addEventListener('DOMContentLoaded', ()=> {
  init();
  // wire buttons that exist earlier than functions
  $('addPlayerScoreBtn').onclick = ()=> openPlayerModal();
  $('addPlayerProfileBtn').onclick = ()=> openPlayerModal();
});

// Save on unload
window.addEventListener('beforeunload', ()=> saveState());
