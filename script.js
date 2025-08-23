const el=id=>document.getElementById(id);
const HISTORY_KEY='golf-history-v2';
let players=[];
let state={course:'',area:'',holes:18,scores:{},par:[]};

const $course=el('course'),$area=el('area'),$holes=el('holes');
const $playerSelect=el('playerSelect'),$newPlayerName=el('newPlayerName'),$addPlayer=el('addPlayer');
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

$addPlayer.onclick=()=>{
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
  state.par=Array.from({length:state
