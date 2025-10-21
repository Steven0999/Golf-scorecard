const el=id=>document.getElementById(id);
let players=[];
let scorecards=[];
let currentScorecard=null;

const menuBtn=el('menuBtn'),menu=el('menu');
const navScorecard=el('navScorecard'),navHistory=el('navHistory');
const navProfile=el('navProfile'),navLeaderboard=el('navLeaderboard');

const scorecardSection=el('scorecardSection'),historySection=el('historySection');
const profileSection=el('profileSection'),leaderboardSection=el('leaderboardSection');

const courseNameInput=el('courseName'),courseAreaInput=el('courseArea');
const holesSelect=el('holesSelect'),teesSelect=el('teesSelect');
const playersContainer=el('playersContainer'),generateBtn=el('generateBtn');
const saveScorecardBtn=el('saveScorecardBtn'),scorecardTable=el('scorecardTable');

const addPlayerBtn=el('addPlayerBtn'),playerModal=el('playerModal');
const playerModalName=el('playerModalName'),savePlayerBtn=el('savePlayerBtn');
const cancelPlayerBtn=el('cancelPlayerBtn');

const filterPlayerHistory=el('filterPlayerHistory'),historyList=el('historyList'),historyChart=el('historyChart');
const profilePlayerSelect=el('profilePlayerSelect'),playerHistory=el('playerHistory');
const leaderboardCourseSelect=el('leaderboardCourseSelect'),leaderboardList=el('leaderboardList');
const best9Btn=el('best9Btn'),best18Btn=el('best18Btn');

// Menu toggle
menuBtn.onclick=()=>menu.style.display=(menu.style.display==='flex'?'none':'flex');
navScorecard.onclick=()=>showSection('scorecard');
navHistory.onclick=()=>showSection('history');
navProfile.onclick=()=>showSection('profile');
navLeaderboard.onclick=()=>showSection('leaderboard');

function showSection(sec){
  scorecardSection.classList.add('hidden');
  historySection.classList.add('hidden');
  profileSection.classList.add('hidden');
  leaderboardSection.classList.add('hidden');
  if(sec==='scorecard') scorecardSection.classList.remove('hidden');
  if(sec==='history') {historySection.classList.remove('hidden'); renderHistory();}
  if(sec==='profile') {profileSection.classList.remove('hidden'); renderProfile();}
  if(sec==='leaderboard') {leaderboardSection.classList.remove('hidden'); renderLeaderboard();}
}

// Player modal
addPlayerBtn.onclick=()=>playerModal.classList.remove('hidden');
cancelPlayerBtn.onclick=()=>playerModal.classList.add('hidden');
savePlayerBtn.onclick=()=>{
  const name=playerModalName.value.trim();
  if(name && !players.includes(name)) players.push(name);
  playerModalName.value=''; playerModal.classList.add('hidden'); renderPlayers();
};

function renderPlayers(){
  playersContainer.innerHTML='';
  players.forEach(p=>{
    const div=document.createElement('div');
    div.className='playerChip'; div.textContent=p;
    const delBtn=document.createElement('button'); delBtn.textContent='x';
    delBtn.onclick=()=>{players=players.filter(pl=>pl!==p); renderPlayers();};
    div.appendChild(delBtn);
    playersContainer.appendChild(div);
  });
  filterPlayerHistory.innerHTML='<option value="__all__">All</option>'+players.map(p=>`<option value="${p}">${p}</option>`).join('');
  profilePlayerSelect.innerHTML=players.map(p=>`<option value="${p}">${p}</option>`).join('');
}

// Generate scorecard
generateBtn.onclick=()=>{
  if(players.length===0) return alert('Add players first');
  currentScorecard={course:courseNameInput.value,area:courseAreaInput.value,holes:parseInt(holesSelect.value),tees:teesSelect.value,scores:{}};
  players.forEach(p=>currentScorecard.scores[p]=Array.from({length:currentScorecard.holes},()=>0));
  renderScorecard();
};

function renderScorecard(){
  if(!currentScorecard) return;
  let html='<table><thead><tr><th>Player</th>';
  for(let i=1;i<=currentScorecard.holes;i++) html+=`<th>H${i}</th>`;
  html+='<th>Total</th></tr></thead><tbody>';
  players.forEach(p=>{
    const row=currentScorecard.scores[p].map((s,h)=>`<td><input type="number" min="0" value="${s}"
