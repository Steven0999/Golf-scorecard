const el=id=>document.getElementById(id);
let players=[],scorecards=[],currentScorecard=null;

// Menu elements
const menuBtn=el('menuBtn'),menu=el('menu');
const navScorecard=el('navScorecard'),navHistory=el('navHistory');
const navProfile=el('navProfile'),navLeaderboard=el('navLeaderboard');

// Sections
const scorecardSection=el('scorecardSection'),historySection=el('historySection');
const profileSection=el('profileSection'),leaderboardSection=el('leaderboardSection');

// Scorecard inputs
const courseNameInput=el('courseName'),courseAreaInput=el('courseArea');
const holesSelect=el('holesSelect'),teesSelect=el('teesSelect');
const playersContainer=el('playersContainer'),generateBtn=el('generateBtn');
const saveScorecardBtn=el('saveScorecardBtn'),scorecardTable=el('scorecardTable');

// Player modal
const addPlayerBtn=el('addPlayerBtn'),playerModal=el('playerModal');
const playerModalName=el('playerModalName'),savePlayerBtn=el('savePlayerBtn');
const cancelPlayerBtn=el('cancelPlayerBtn');

// History & profile
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

// Player modal logic
addPlayerBtn.onclick=()=>playerModal.classList.remove('hidden');
cancelPlayerBtn.onclick=()=>playerModal.classList.add('hidden');
savePlayerBtn.onclick=()=>{
  const name=playerModalName.value.trim();
  if(name && !players.includes(name)) players.push(name);
  playerModalName.value=''; playerModal.classList.add('hidden'); renderPlayers();
};

// Render players
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

// Render scorecard table
function renderScorecard(){
  if(!currentScorecard) return;
  let html='<table><thead><tr><th>Player</th>';
  for(let i=1;i<=currentScorecard.holes;i++) html+=`<th>H${i}</th>`;
  html+='<th>Total</th></tr></thead><tbody>';
  players.forEach(p=>{
    const row=currentScorecard.scores[p].map((s,h)=>`<td><input type="number" min="0" value="${s}" data-player="${p}" data-hole="${h}" style="width:50px"></td>`).join('');
    const total=currentScorecard.scores[p].reduce((a,b)=>a+b,0);
    html+=`<tr><td>${p}</td>${row}<td>${total}</td></tr>`;
  });
  html+='</tbody></table>';
  scorecardTable.innerHTML=html;
  scorecardTable.querySelectorAll('input').forEach(inp=>{
    inp.oninput=()=>{
      const p=inp.dataset.player,h=parseInt(inp.dataset.hole,10);
      currentScorecard.scores[p][h]=parseInt(inp.value||'0',10);
      renderScorecard();
    };
  });
}

// Save scorecard
saveScorecardBtn.onclick=()=>{
  if(currentScorecard) {scorecards.push(currentScorecard); saveHistory(); alert('Scorecard saved');}
};

function saveHistory(){
  localStorage.setItem('golfScorecards',JSON.stringify(scorecards));
}

// Load history
function renderHistory(){
  const hist=JSON.parse(localStorage.getItem('golfScorecards')||'[]');
  historyList.innerHTML='';
  hist.forEach(h=>{
    const div=document.createElement('div');
    div.textContent=`${h.course} (${h.area}) - Players: ${Object.keys(h.scores).join(', ')} - Holes: ${h.holes}`;
    historyList.appendChild(div);
  });
}

// Profile & leaderboard functions
function renderProfile(){
  const player=profilePlayerSelect.value;
  playerHistory.innerHTML='';
  const hist=JSON.parse(localStorage.getItem('golfScorecards')||'[]');
  hist.forEach(h=>{
    if(h.scores[player]){
      const div=document.createElement('div');
      div.textContent=`${h.course} - ${new Date().toLocaleDateString()} - Scores: ${h.scores[player].join(', ')} - Total: ${h.scores[player].reduce((a,b)=>a+b,0)}`;
      playerHistory.appendChild(div);
    }
  });
}

function renderLeaderboard(){
  leaderboardCourseSelect.innerHTML='';
  const hist=JSON.parse(localStorage.getItem('golfScorecards')||'[]');
  const courses=[...new Set(hist.map(h=>h.course))];
  leaderboardCourseSelect.innerHTML=courses.map(c=>`<option value="${c}">${c}</option>`).join('');
}

// Initial render
window.onload=()=>{renderPlayers(); renderHistory(); renderProfile(); renderLeaderboard();};
