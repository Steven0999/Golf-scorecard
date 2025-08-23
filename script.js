const el=id=>document.getElementById(id);
const HISTORY_KEY='golf-history-v2';
let players=[];
let state={course:'',area:'',holes:18,scores:{},par:[]};

const $course=el('course'),$area=el('area'),$holes=el('holes');
const $playerSelect=el('playerSelect'),$newPlayerName=el('newPlayerName'),$playerForm=el('playerForm');
const $generate=el('generate'),$saveHistory=el('saveHistory');
const $workspace=el('workspace'),$summary=el('summary');
const $filterHistoryPlayer=el('filterHistoryPlayer'),$historyList=el('historyList'),$scoresChart=el('scoresChart');
const $playerProfileSelect=el('playerProfileSelect'),$playerProfile=el('playerProfile');
const $courseLeaderboardSelect=el('courseLeaderboardSelect'),$courseParInfo=el('courseParInfo'),$courseLeaderboardTable=el('courseLeaderboardTable');
const $btnBest9=el('btnBest9'),$btnBest18=el('btnBest18');

let leaderboardMode='9';

// Save / Load history
function saveHistoryItem(item){
  const arr=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
  arr.push(item);
  localStorage.setItem(HISTORY_KEY,JSON.stringify(arr));
}
function loadHistory(){ return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]'); }

// Player select dropdowns
function renderPlayerSelect(){
  $playerSelect.innerHTML=players.map(p=>`<option value="${p}">${p}</option>`).join('');
  $filterHistoryPlayer.innerHTML='<option value="__all__">All</option>'+players.map(p=>`<option value="${p}">${p}</option>`).join('');
  $playerProfileSelect.innerHTML='<option value="__none__">Select...</option>'+players.map(p=>`<option value="${p}">${p}</option>`).join('');
}

// Add new player via form
$playerForm.onsubmit=(e)=>{
  e.preventDefault();
  const name=$newPlayerName.value.trim();
  if(name && !players.includes(name)){
    players.push(name);
    renderPlayerSelect();
    $newPlayerName.value='';
  }
};

$generate.onclick=()=>{
  state.course=$course.value.trim();
  state.area=$area.value.trim();
  state.holes=parseInt($holes.value,10);
  state.par=Array.from({length:state.holes},()=>4); // default par
  state.scores={};
  players.forEach(p=>{ state.scores[p]=Array.from({length:state.holes},()=>0); });
  renderWorkspace(); renderSummary();
};

function renderWorkspace(){
  if(!players.length){$workspace.innerHTML='<div>Add players to start.</div>';return;}
  let table='<table><thead><tr><th>Player</th>';
  for(let i=1;i<=state.holes;i++){ table+=`<th>H${i}</th>`; }
  table+='<th>Total</th></tr></thead><tbody>';
  players.forEach(p=>{
    const row=state.scores[p].map((s,idx)=>`<td><input type="number" min="0" value="${s}" data-p="${p}" data-h="${idx}" style="width:50px"/></td>`).join('');
    const total=state.scores[p].reduce((a,b)=>a+b,0);
    table+=`<tr><td>${p}</td>${row}<td>${total}</td></tr>`;
  });
  table+='</tbody></table>';
  $workspace.innerHTML=table;
  $workspace.querySelectorAll('input').forEach(inp=>{
    inp.oninput=()=>{ const p=inp.dataset.p; const h=parseInt(inp.dataset.h,10); state.scores[p][h]=parseInt(inp.value||'0',10); renderSummary(); };
  });
}

function renderSummary(){
  if(!players.length){$summary.innerHTML='';return;}
  let html='<h3>Summary</h3><ul>';
  players.forEach(p=>{ const total=state.scores[p].reduce((a,b)=>a+b,0); html+=`<li>${p}: ${total}</li>`; });
  html+='</ul>';
  $summary.innerHTML=html;
}

$saveHistory.onclick=()=>{
  const item={id:Date.now(),ts:new Date().toISOString(),course:state.course,area:state.area,holes:state.holes,scores:state.scores,par:state.par};
  saveHistoryItem(item);
  renderHistory();
  renderPlayerProfile();
  rebuildCourseOptions();
};

// History
function renderHistory(){
  const hist=loadHistory();
  const filter=$filterHistoryPlayer.value;
  const list=hist.filter(m=> filter==='__all__'|| Object.keys(m.scores).includes(filter));
  $historyList.innerHTML=list.map(m=>{
    const date=new Date(m.ts).toLocaleString();
    return `<div class="history-item">${date} – ${m.course||'Course'} – ${Object.entries(m.scores).map(([p,sc])=>`${p}:${sc.reduce((a,b)=>a+b,0)}`).join(', ')}</div>`;
  }).join('');
  drawChart(list, filter);
}

function drawChart(list, filter){
  const ctx=$scoresChart.getContext('2d');
  ctx.clearRect(0,0,$scoresChart.width,$scoresChart.height);
  if(!list.length){ctx.fillText('No history yet',20,20);return;}
  const data=[];
  list.forEach(m=>{ Object.entries(m.scores).forEach(([p,sc])=>{ if(filter==='__all__'||filter===p){ data.push({player:p,t:new Date(m.ts).getTime(),y:sc.reduce((a,b)=>a+b,0)}); } }); });
  data.sort((a,b)=>a.t-b.t);
  const playersSet=[...new Set(data.map(d=>d.player))];
  const pad=40,W=$scoresChart.width,H=$scoresChart.height;
  const xmin=Math.min(...data.map(d=>d.t)),xmax=Math.max(...data.map(d=>d.t));
  const ymin=Math.min(...data.map(d=>d.y)),ymax=Math.max(...data.map(d=>d.y));
  const xscale=x=> pad+((x-xmin)/(xmax-xmin||1))*(W-2*pad);
  const yscale=y=> H-pad-((y-ymin)/(ymax-ymin||1))*(H-2*pad);
  playersSet.forEach((pl,i)=>{
    const pts=data.filter(d=>d.player===pl);
    ctx.beginPath(); ctx.strokeStyle=['#7c9cff','#4cc38a','#ff6b6b','#ffa500'][i%4];
    pts.forEach((pt,j)=>{const xx=xscale(pt.t),yy=yscale(pt.y); if(j===0)ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy); ctx.fillStyle=ctx.strokeStyle; ctx.fillRect(xx-2,yy-2,4,4);});
    ctx.stroke(); ctx.fillText(pl, W-100, 20+15*i);
  });
}

// Player Profile
function renderPlayerProfile(){
  const hist=loadHistory();
  const selected=$playerProfileSelect.value;
  if(selected==='__none__'){ $playerProfile.innerHTML='<div class="muted">Select a player to view history.</div>'; return; }
  const games=hist.filter(m=> Object.keys(m.scores).includes(selected));
  if(!games.length){ $playerProfile.innerHTML='<div class="muted">No games for this player.</div>'; return; }
  let html=`<h4>${selected}</h4><ul>`;
  games.forEach(g=>{ const total=g.scores[selected].reduce((a,b)=>a+b,0); html+=`<li>${new Date(g.ts).toLocaleDateString()} – ${g.course} (${g.holes} holes): ${total}</li>`; });
  html+='</ul>';
  $playerProfile.innerHTML=html;
}

// Course Leaderboard
function rebuildCourseOptions(){
  const hist = loadHistory();
  const courses = [...new Set(hist.map(h=>h.course).filter(Boolean))].sort();
  $courseLeaderboardSelect.innerHTML = '<option value="__none__">Select a course...</option>' +
    courses.map(c=>`<option value="${c}">${c}</option>`).join('');
}

function renderCourseLeaderboard(){
  const course = $courseLeaderboardSelect.value;
  if(course==='__none__'){ $courseParInfo.innerHTML=''; $courseLeaderboardTable.innerHTML=''; return; }
  const hist = loadHistory().filter(h=>h.course===course);
  if(!hist.length){ $courseParInfo.innerHTML='No data'; $courseLeaderboardTable.innerHTML=''; return; }

  // most recent par
  const latest = hist[hist.length-1];
  const parFront9 = latest.par.slice(0,9).reduce((a,b)=>a+b,0);
  const par18 = latest.holes>=18 ? latest.par.slice(0,18).reduce((a,b)=>a+b,0) : null;
  $courseParInfo.innerHTML = `Front 9 Par: ${parFront9} ${par18? '| 18-Hole Par: '+par18:''}`;

  const playerStats = {};
  hist.forEach(h=>{
    Object.entries(h.scores).forEach(([p,sc])=>{
      const total = sc.reduce((a,b)=>a+b,0);
      if(!playerStats[p]) playerStats[p] = {rounds:0, best9:null, best18:null};
      playerStats[p].rounds++;
      if(h.holes===9){
        if(playerStats[p].best9===null || total<playerStats[p].best9) playerStats[p].best9=total;
      }
      if(h.holes===18){
        if(playerStats[p].best18===null || total<playerStats[p].best18) playerStats[p].best18=total;
      }
    });
  });

  const rows = Object.entries(playerStats).map(([p,stat])=>{
    if(leaderboardMode==='9'){
      const score=stat.best9;
      const vsPar= score!==null? ` (${score-parFront9>=0?'+':''}${score-parFront9})` : '';
      return {player:p, score: score!==null? score+vsPar:'', rounds:stat.rounds};
    }else{
      const score=stat.best18;
      const vsPar= score!==null && par18? ` (${score-par18>=0?'+':''}${score-par18})` : '';
      return {player:p, score: score!==null? score+vsPar:'', rounds:stat.rounds};
    }
  });

  rows.sort((a,b)=>{
    if(a.score==='' && b.score!=='') return 1;
    if(b.score==='' && a.score!=='') return -1;
    if(a.score==='' && b.score==='') return a.player.localeCompare(b.player);
    const as=parseInt(a.score);
    const bs=parseInt(b.score);
    if(as!==bs) return as-bs;
    return a.player.localeCompare(b.player);
  });

  let html = '<table><thead><tr><th>Player</th><th>Best '+(leaderboardMode==='9'?'9':'18')+'-Hole</th><th>Rounds</th></tr></thead><tbody>';
  html += `<tr><td>Par</td><td>${leaderboardMode==='9'? parFront9: (par18||'')}</td><td>—</td></tr>`;
  rows.forEach(r=>{
    html += `<tr><td>${r.player}</td><td>${r.score}</td><td>${r.rounds}</td></tr>`;
  });
  html += '</tbody></table>';
  $courseLeaderboardTable.innerHTML = html;
}

$courseLeaderboardSelect.onchange = renderCourseLeaderboard;
$btnBest9.onclick = ()=>{ leaderboardMode='9'; renderCourseLeaderboard(); };
$btnBest18.onclick = ()=>{ leaderboardMode='18'; renderCourseLeaderboard(); };

// Init
$filterHistoryPlayer.onchange = renderHistory;
$playerProfileSelect.onchange = renderPlayerProfile;

$courseLeaderboardSelect.onchange = renderCourseLeaderboard;
$btnBest9.onclick  = () => { leaderboardMode = '9';  renderCourseLeaderboard(); };
$btnBest18.onclick = () => { leaderboardMode = '18'; renderCourseLeaderboard(); };

window.onload = () => {
  renderPlayerSelect();    // populate player dropdowns
  renderHistory();         // show history + chart (if any)
  rebuildCourseOptions();  // populate course leaderboard dropdown
};
