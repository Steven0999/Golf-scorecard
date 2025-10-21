// DOM Helpers
const el = id => document.getElementById(id);

// Menu
const menuBtn = el('menuBtn');
const menu = el('menu');
menuBtn.onclick = () => menu.classList.toggle('show');

// Sections
const scorecardSection = el('scorecardSection');
const historySection = el('historySection');
const profileSection = el('profileSection');

el('navScorecard').onclick = ()=>showSection('scorecard');
el('navHistory').onclick = ()=>showSection('history');
el('navProfile').onclick = ()=>showSection('profile');

function showSection(section){
  scorecardSection.classList.add('hidden');
  historySection.classList.add('hidden');
  profileSection.classList.add('hidden');
  if(section==='scorecard') scorecardSection.classList.remove('hidden');
  if(section==='history') historySection.classList.remove('hidden');
  if(section==='profile') profileSection.classList.remove('hidden');
}

// STORAGE KEYS
const STORAGE_PLAYERS = 'golf_players';
const STORAGE_SCORECARDS = 'golf_scorecards';

// App State
let players = JSON.parse(localStorage.getItem(STORAGE_PLAYERS)||'[]');
let scorecards = JSON.parse(localStorage.getItem(STORAGE_SCORECARDS)||'[]');
let currentScorecard = null;

// Elements
const courseNameInput = el('courseName');
const courseAreaInput = el('courseArea');
const holesSelect = el('holesSelect');
const teesSelect = el('teesSelect');
const playersContainer = el('playersContainer');
const scorecardTable = el('scorecardTable');
const generateBtn = el('generateBtn');
const saveScorecardBtn = el('saveScorecardBtn');

const filterPlayerHistory = el('filterPlayerHistory');
const historyList = el('historyList');
const profilePlayerSelect = el('profilePlayerSelect');
const playerHistoryDiv = el('playerHistory');

// PLAYER MODAL
const playerModal = el('playerModal');
const playerModalName = el('playerModalName');
const savePlayerBtn = el('savePlayerBtn');
const cancelPlayerBtn = el('cancelPlayerBtn');

// Initialize
renderPlayerSelectors();
renderHistory();
renderProfilePlayers();

// -------------------- PLAYER MODAL LOGIC --------------------
let editingPlayerIndex = null;
function openPlayerModal(editIndex=null){
  editingPlayerIndex = editIndex;
  playerModalName.value = editIndex!==null ? players[editIndex] : '';
  playerModal.classList.remove('hidden');
}
function closePlayerModal(){ playerModal.classList.add('hidden'); editingPlayerIndex=null; }

savePlayerBtn.onclick = ()=>{
  const name = playerModalName.value.trim();
  if(!name) return alert("Enter a player name");
  if(editingPlayerIndex!==null){ players[editingPlayerIndex]=name; }
  else{ if(!players.includes(name)) players.push(name); }
  localStorage.setItem(STORAGE_PLAYERS, JSON.stringify(players));
  closePlayerModal();
  renderPlayerSelectors();
  renderProfilePlayers();
};
cancelPlayerBtn.onclick = closePlayerModal;

// -------------------- PLAYER MANAGEMENT --------------------
function renderPlayerSelectors(){
  const options = players.map((p,i)=>`<option value="${p}">${p}</option>`).join('');
  filterPlayerHistory.innerHTML = `<option value="__all__">All</option>${options}`;
  profilePlayerSelect.innerHTML = options;
}

// -------------------- SCORECARD GENERATION --------------------
generateBtn.onclick = ()=>{
  const selectedHoles = parseInt(holesSelect.value);
  currentScorecard = {
    id:Date.now(),
    course:courseNameInput.value,
    area:courseAreaInput.value,
    holes:selectedHoles,
    tees:teesSelect.value,
    players: players.slice(),
    par: Array(selectedHoles).fill(4),
    si: Array(selectedHoles).fill(1),
    difficulty:0,
    slope:0,
    scores: players.reduce((acc,p)=>{ acc[p]=Array(selectedHoles).fill(0); return acc; }, {})
  };
  renderScorecardTable();
};

// -------------------- SCORECARD TABLE --------------------
function renderScorecardTable(){
  if(!currentScorecard) return;
  let html = `<table><thead><tr><th>Player</th>`;
  for(let i=1;i<=currentScorecard.holes;i++) html += `<th>H${i}</th>`;
  html+=`<th>Total</th></tr></thead><tbody>`;
  currentScorecard.players.forEach(p=>{
    const row = currentScorecard.scores[p].map((s,h)=>
      `<td><input type="number" min="0" value="${s}" data-player="${p}" data-hole="${h}"/></td>`
    ).join('');
    const total = currentScorecard.scores[p].reduce((a,b)=>a+b,0);
    html+=`<tr><td>${p}</td>${row}<td>${total}</td></tr>`;
  });
  html+=`</tbody></table>`;
  scorecardTable.innerHTML = html;

  // Bind input events
  scorecardTable.querySelectorAll('input').forEach(inp=>{
    inp.oninput = ()=>{
      const p = inp.dataset.player;
      const h = parseInt(inp.dataset.hole);
      currentScorecard.scores[p][h] = parseInt(inp.value||0);
    };
  });
}

// -------------------- SAVE SCORECARD --------------------
saveScorecardBtn.onclick = ()=>{
  // Replace existing scorecard if same id
  const index = scorecards.findIndex(s=>s.id===currentScorecard.id);
  if(index!==-1) scorecards[index] = currentScorecard;
  else scorecards.push(currentScorecard);
  localStorage.setItem(STORAGE_SCORECARDS, JSON.stringify(scorecards));
  alert('Scorecard saved!');
  renderHistory();
};

// -------------------- HISTORY --------------------
filterPlayerHistory.onchange = renderHistory;
function renderHistory(){
  const filter = filterPlayerHistory.value;
  const list = scorecards.filter(s=> filter==='__all__' || s.players.includes(filter));
  historyList.innerHTML = list.map(s=>{
    const date = new Date(s.id).toLocaleString();
    const totals = s.players.map(p=>{
      const t = s.scores[p].reduce((a,b)=>a+b,0);
      return `${p}:${t}`;
    }).join(', ');
    return `<div>${date} - ${s.course} - ${totals}</div>`;
  }).join('');
}

// -------------------- PLAYER PROFILE --------------------
profilePlayerSelect.onchange = renderPlayerHistory;
function renderProfilePlayers(){
  const options = players.map(p=>`<option value="${p}">${p}</option>`).join('');
  profilePlayerSelect.innerHTML = options;
  renderPlayerHistory();
}
function renderPlayerHistory(){
  const player = profilePlayerSelect.value;
  if(!player) return;
  const list = scorecards.filter(s=>s.players.includes(player));
  if(!list.length) return playerHistoryDiv.innerHTML='No rounds yet';
  playerHistoryDiv.innerHTML = list.map(s=>{
    const date = new Date(s.id).toLocaleString();
    const scoresStr = s.scores[player].map((v,i)=>`H${i+1}:${v}`).join(', ');
    const total = s.scores[player].reduce((a,b)=>a+b,0);
    return `<div><strong>${date}</strong> | ${s.course} | ${scoresStr} | Total: ${total}</div>`;
  }).join('');
  }
