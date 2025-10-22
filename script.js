// ======= ELEMENT SELECTORS =======
const el = id => document.getElementById(id);
const addPlayerScoreBtn = el('addPlayerScoreBtn');
const addPlayerProfileBtn = el('addPlayerProfileBtn');
const playerModal = el('playerModal');
const savePlayerBtn = el('savePlayer');
const cancelPlayerBtn = el('cancelPlayer');
const newPlayerNameInput = el('newPlayerName');
const addHandicapToggle = el('addHandicapToggle');
const playerHandicapInput = el('playerHandicap');
const numPlayersSelect = el('numPlayers');
const workspace = el('workspace');
const generateScorecardBtn = el('generateScorecard');
const saveScorecardBtn = el('saveScorecard');

// ======= APP STATE =======
let players = JSON.parse(localStorage.getItem('players')||'[]');
let scorecards = JSON.parse(localStorage.getItem('scorecards')||'[]');
let currentScorecard = { course:'', area:'', holes:18, selectedPlayers:[], scores:{} };

// ======= FUNCTIONS =======

// Populate number of players select (1-8)
function populateNumPlayers() {
  numPlayersSelect.innerHTML = '';
  for(let i=1;i<=8;i++){ numPlayersSelect.innerHTML += `<option value="${i}">${i}</option>`; }
}

// Show Add Player Modal
function showAddPlayerModal(){
  playerModal.classList.remove('hidden');
  newPlayerNameInput.value='';
  playerHandicapInput.value='';
  playerHandicapInput.classList.add('hidden');
  addHandicapToggle.checked = false;
}

// Hide Add Player Modal
function hideAddPlayerModal(){ playerModal.classList.add('hidden'); }

// Toggle Handicap Input
addHandicapToggle.addEventListener('change',()=>{
  if(addHandicapToggle.checked){ playerHandicapInput.classList.remove('hidden'); }
  else { playerHandicapInput.classList.add('hidden'); playerHandicapInput.value=''; }
});

// Save Player
savePlayerBtn.addEventListener('click',()=>{
  const name = newPlayerNameInput.value.trim();
  if(!name){ alert('Enter a player name'); return; }
  let handicap = parseFloat(playerHandicapInput.value) || 0;
  if(!players.find(p=>p.name===name)){ players.push({name,handicap}); }
  localStorage.setItem('players', JSON.stringify(players));
  hideAddPlayerModal();
  renderPlayerSelects();
});

// Cancel Player
cancelPlayerBtn.addEventListener('click', hideAddPlayerModal);

// Open Modal buttons
addPlayerScoreBtn.addEventListener('click', showAddPlayerModal);
addPlayerProfileBtn.addEventListener('click', showAddPlayerModal);

// Render player selects
function renderPlayerSelects(){
  numPlayersSelect.innerHTML='';
  players.forEach((p,i)=>{ numPlayersSelect.innerHTML+=`<option value="${i}">${p.name}</option>`; });
}

// Generate Scorecard
generateScorecardBtn.addEventListener('click',()=>{
  const courseName = el('courseName').value.trim();
  const courseArea = el('courseArea').value.trim();
  const numPlayers = parseInt(numPlayersSelect.value);
  const holes = parseInt(el('numHoles').value);

  const selectedPlayers = players.slice(0,numPlayers).map(p=>p.name);
  currentScorecard = { course:courseName, area:courseArea, holes, selectedPlayers, scores:{} };
  selectedPlayers.forEach(p=> currentScorecard.scores[p] = Array(holes).fill(0));
  renderScorecardTable();
});

// Render scorecard table
function renderScorecardTable(){
  if(!currentScorecard.selectedPlayers.length){ workspace.innerHTML='<p>Add players first</p>'; return; }
  let html = '<table><thead><tr><th>Player</th>';
  for(let i=1;i<=currentScorecard.holes;i++){ html+=`<th>H${i}</th>`; }
  html+='<th>Total</th></tr></thead><tbody>';
  currentScorecard.selectedPlayers.forEach(p=>{
    const row = currentScorecard.scores[p].map((s,i)=>`<td><input type="number" min="0" value="${s}" data-player="${p}" data-hole="${i}" /></td>`).join('');
    const total = currentScorecard.scores[p].reduce((a,b)=>a+b,0);
    html+=`<tr><td>${p}</td>${row}<td>${total}</td></tr>`;
  });
  html+='</tbody></table>';
  workspace.innerHTML=html;

  // Attach input handlers
  workspace.querySelectorAll('input').forEach(inp=>{
    inp.oninput=()=>{
      const p = inp.dataset.player;
      const h = parseInt(inp.dataset.h);
      currentScorecard.scores[p][h] = parseInt(inp.value)||0;
      renderScorecardTable();
    };
  });
}

// Save Scorecard
saveScorecardBtn.addEventListener('click',()=>{
  scorecards.push(currentScorecard);
  localStorage.setItem('scorecards', JSON.stringify(scorecards));
  alert('Scorecard saved!');
});

// Init
function init(){
  populateNumPlayers();
  renderPlayerSelects();
}
window.onload = init;
