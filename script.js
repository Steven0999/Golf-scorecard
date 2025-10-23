// === DOM ELEMENTS ===
const burgerBtn = document.getElementById('burgerBtn');
const burgerMenu = document.getElementById('burgerMenu');
const pageSections = document.querySelectorAll('.page-section');

const scorecardSection = document.getElementById('scorecardSection');
const playersSection = document.getElementById('playersSection');
const historySection = document.getElementById('historySection');

const addPlayerBtn = document.getElementById('addPlayerBtn');
const playerModal = document.getElementById('playerModal');
const savePlayerModalBtn = document.getElementById('savePlayerModalBtn');
const cancelPlayerModalBtn = document.getElementById('cancelPlayerModalBtn');
const newPlayerNameInput = document.getElementById('newPlayerName');
const newPlayerHandicapInput = document.getElementById('newPlayerHandicap');

const playersListDiv = document.getElementById('playersList');
const selectedPlayersListDiv = document.getElementById('selectedPlayersList');

const openPlayerSelectBtn = document.getElementById('openPlayerSelect');
const totalHolesSelect = document.getElementById('totalHoles');
const holesTableBody = document.getElementById('holesTableBody');
const scoreInputsDiv = document.getElementById('scoreInputs');
const saveScorecardBtn = document.getElementById('saveScorecardBtn');

const courseNameInput = document.getElementById('courseName');
const courseAreaInput = document.getElementById('courseArea');
const teeColorSelect = document.getElementById('teeColor');
const courseRatingInput = document.getElementById('courseRating');
const slopeRatingInput = document.getElementById('slopeRating');

const historyListDiv = document.getElementById('historyList');
const leaderboardDiv = document.getElementById('leaderboard');
const leaderboardToggle9Btn = document.getElementById('leaderboardToggle9');
const leaderboardToggle18Btn = document.getElementById('leaderboardToggle18');

// === APP STATE ===
let players = []; // {name, handicap}
let selectedPlayers = [];
let currentScorecard = {
  courseName: '',
  area: '',
  tee: 'White',
  rating: 0,
  slope: 113,
  holes: 18,
  holeData: [], // [{par, si}]
  scores: {},   // {playerName: [scores]}
};

// === LOCAL STORAGE KEYS ===
const PLAYER_KEY = 'golfPlayers';
const SCORECARD_KEY = 'golfScorecards';

// === UTILS ===
function savePlayers() { localStorage.setItem(PLAYER_KEY, JSON.stringify(players)); }
function loadPlayers() { players = JSON.parse(localStorage.getItem(PLAYER_KEY)||'[]'); renderPlayers(); }
function saveScorecards(scorecard){ 
  let arr = JSON.parse(localStorage.getItem(SCORECARD_KEY)||'[]'); 
  arr.push(scorecard); 
  localStorage.setItem(SCORECARD_KEY, JSON.stringify(arr)); 
}
function loadScorecards(){ return JSON.parse(localStorage.getItem(SCORECARD_KEY)||'[]'); }

function calculateHandicap(scores, holeData, rating, slope){
  if(scores.length===0) return 0;
  let totalDiff = 0;
  scores.forEach((scoreArr)=>{
    const gross = scoreArr.reduce((a,b)=>a+b,0);
    const parTotal = holeData.reduce((a,b)=>a+b.par,0);
    const diff = (gross - parTotal - rating)*113/slope;
    totalDiff += diff;
  });
  return +(totalDiff/scores.length).toFixed(1);
}

function calculateNetScore(playerName){
  const grossArr = currentScorecard.scores[playerName]||[];
  const handicap = players.find(p=>p.name===playerName)?.handicap||0;
  return grossArr.reduce((a,b)=>a+b,0) - handicap;
}

// === BURGER MENU NAVIGATION ===
burgerBtn.onclick = ()=>{
  burgerMenu.classList.toggle('hidden');
};

burgerMenu.querySelectorAll('a').forEach(a=>{
  a.onclick = (e)=>{
    e.preventDefault();
    const target = a.dataset.section;
    pageSections.forEach(s=>s.classList.add('hidden'));
    document.getElementById(target).classList.remove('hidden');
    burgerMenu.classList.add('hidden');
  };
});

// === PLAYER MODAL ===
addPlayerBtn.onclick = ()=> { playerModal.classList.remove('hidden'); };
cancelPlayerModalBtn.onclick = ()=> { playerModal.classList.add('hidden'); };
savePlayerModalBtn.onclick = ()=>{
  const name = newPlayerNameInput.value.trim();
  if(!name) return alert('Enter player name');
  const handicap = parseFloat(newPlayerHandicapInput.value)||0;
  if(!players.some(p=>p.name===name)) players.push({name, handicap});
  savePlayers();
  renderPlayers();
  playerModal.classList.add('hidden');
  newPlayerNameInput.value=''; newPlayerHandicapInput.value='';
};

// === RENDER PLAYERS ===
function renderPlayers(){
  playersListDiv.innerHTML = '';
  selectedPlayersListDiv.innerHTML = '';
  players.forEach(p=>{
    const div = document.createElement('div');
    div.className='player-card';
    div.innerHTML=`${p.name} (Hcp: ${p.handicap || 0}) 
      <button onclick="removePlayer('${p.name}')">Delete</button>`;
    playersListDiv.appendChild(div);

    const chk = document.createElement('input');
    chk.type='checkbox'; chk.value=p.name;
    chk.onchange = ()=>{ 
      if(chk.checked) selectedPlayers.push(p.name);
      else selectedPlayers = selectedPlayers.filter(x=>x!==p.name);
      renderSelectedPlayers();
    };
    const label = document.createElement('label'); label.appendChild(chk);
    label.appendChild(document.createTextNode(p.name));
    selectedPlayersListDiv.appendChild(label);
  });
}

function renderSelectedPlayers(){
  selectedPlayersListDiv.innerHTML='';
  selectedPlayers.forEach(name=>{
    const span = document.createElement('span'); span.textContent=name + ' ';
    selectedPlayersListDiv.appendChild(span);
  });
}

function removePlayer(name){
  players = players.filter(p=>p.name!==name);
  savePlayers();
  selectedPlayers = selectedPlayers.filter(p=>p!==name);
  renderPlayers();
}

// === SCORECARD HOLES ===
function renderHolesTable(){
  const total = parseInt(totalHolesSelect.value);
  currentScorecard.holes = total;
  currentScorecard.holeData = Array.from({length:total}, (_,i)=>({par:4,si:i+1}));
  holesTableBody.innerHTML='';
  for(let i=0;i<total;i++){
    const tr = document.createElement('tr');
    tr.innerHTML=`<td>${i+1}</td>
      <td><input type="number" min="3" max="6" value="4" data-hole="${i}" class="parInput"></td>
      <td><input type="number" min="1" max="18" value="${i+1}" data-hole="${i}" class="siInput"></td>`;
    holesTableBody.appendChild(tr);
  }
}

totalHolesSelect.onchange = renderHolesTable;

// === SCORE INPUTS ===
openPlayerSelectBtn.onclick = renderScoreInputs;

function renderScoreInputs(){
  scoreInputsDiv.innerHTML='';
  selectedPlayers.forEach(p=>{
    const div = document.createElement('div');
    div.className='card';
    div.innerHTML=`<h4>${p}</h4>`;
    const arr = [];
    for(let i=0;i<currentScorecard.holes;i++){
      const input = document.createElement('input');
      input.type='number'; input.min=0; input.value=0;
      input.dataset.player=p; input.dataset.hole=i;
      input.oninput=()=>{ 
        if(!currentScorecard.scores[p]) currentScorecard.scores[p]=Array(currentScorecard.holes).fill(0);
        currentScorecard.scores[p][i]=parseInt(input.value)||0;
      };
      div.appendChild(document.createTextNode('H'+(i+1)+':'));
      div.appendChild(input);
      arr.push(input);
    }
    scoreInputsDiv.appendChild(div);
  });
}

// === SAVE SCORECARD ===
saveScorecardBtn.onclick = ()=>{
  currentScorecard.courseName = courseNameInput.value;
  currentScorecard.area = courseAreaInput.value;
  currentScorecard.tee = teeColorSelect.value;
  currentScorecard.rating = parseFloat(courseRatingInput.value)||0;
  currentScorecard.slope = parseInt(slopeRatingInput.value)||113;

  const parInputs = document.querySelectorAll('.parInput');
  const siInputs = document.querySelectorAll('.siInput');
  parInputs.forEach(inp=>{
    const idx = parseInt(inp.dataset.hole);
    currentScorecard.holeData[idx].par = parseInt(inp.value)||4;
  });
  siInputs.forEach(inp=>{
    const idx = parseInt(inp.dataset.hole);
    currentScorecard.holeData[idx].si = parseInt(inp.value)||idx+1;
  });

  saveScorecards(currentScorecard);
  alert('Scorecard Saved!');
  renderHistory();
};

// === HISTORY & LEADERBOARD ===
function renderHistory(){
  const arr = loadScorecards();
  historyListDiv.innerHTML='';
  arr.forEach(sc=>{
    const div = document.createElement('div');
    div.className='history-item';
    let text = `${sc.courseName || 'Course'} (${sc.area || ''}) – ${sc.tee} – ${sc.holes} Holes – `;
    text += Object.entries(sc.scores).map(([p,scores])=>`${p}: ${scores.reduce((a,b)=>a+b,0)}`).join(', ');
    div.textContent=text;
    historyListDiv.appendChild(div);
  });
}

leaderboardToggle9Btn.onclick = ()=> renderLeaderboard(9);
leaderboardToggle18Btn.onclick = ()=> renderLeaderboard(18);

function renderLeaderboard(totalHoles){
  leaderboardDiv.style.display='block';
  leaderboardDiv.innerHTML='';
  const arr = loadScorecards().filter(sc=>sc.holes>=totalHoles);
  const bestScores = {};
  arr.forEach(sc=>{
    Object.entries(sc.scores).forEach(([p,scores])=>{
      const total = scores.slice(0,totalHoles).reduce((a,b)=>a+b,0);
      if(!bestScores[p] || total<bestScores[p]) bestScores[p]=total;
    });
  });
  const sorted = Object.entries(bestScores).sort((a,b)=>a[1]-b[1] || a[0].localeCompare(b[0]));
  sorted.forEach(([p,s])=>{
    const div = document.createElement('div');
    div.textContent=`${p}: ${s}`;
    leaderboardDiv.appendChild(div);
  });
}

// === INIT ===
loadPlayers();
renderHolesTable();
renderHistory();
