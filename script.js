// Minimal app.js focusing on Add Player modal behavior (Option A) + simple persistence + UI updates

const $ = id => document.getElementById(id);
const STORAGE_PLAYERS = 'gc_players_v1';

// UI refs
const navlinks = document.querySelectorAll('.navlink');
const pages = {
  scorecard: $('page-scorecard'),
  profiles: $('page-profiles')
};

const playerListDiv = $('playerList');
const addPlayerScoreBtn = $('addPlayerScoreBtn');
const addPlayerProfileBtn = $('addPlayerProfileBtn'); // present on profile page
const roundPlayers = $('roundPlayers');
const profileSelect = $('profileSelect');
const profileDetail = $('profileDetail');

const playerModal = $('playerModal');
const playerNameInput = $('playerName');
const toggleHcp = $('toggleHcp');
const playerHcpRow = $('playerHcpRow');
const playerHcpInput = $('playerHcp');
const savePlayerBtn = $('savePlayerBtn');
const cancelPlayerBtn = $('cancelPlayerBtn');

let players = [];

// --------- Initialization ----------
function init(){
  loadPlayers();
  bindNav();
  renderPlayerSidebar();
  populatePlayerSelects();
  attachModalHandlers();
  // ensure Add Player button on profile page opens modal too
  $('addPlayerProfileBtn')?.addEventListener('click', showAddPlayerModal);
}
document.addEventListener('DOMContentLoaded', init);

// --------- Navigation ----------
function bindNav(){
  navlinks.forEach(btn => {
    btn.addEventListener('click', ()=> {
      navlinks.forEach(n => n.classList.remove('active'));
      btn.classList.add('active');
      const route = btn.dataset.route;
      Object.values(pages).forEach(p => p.classList.add('hidden'));
      pages[route].classList.remove('hidden');
    });
  });
}

// --------- Players persistence ----------
function loadPlayers(){
  try {
    players = JSON.parse(localStorage.getItem(STORAGE_PLAYERS) || '[]');
  } catch(e){
    players = [];
  }
}
function savePlayers(){
  localStorage.setItem(STORAGE_PLAYERS, JSON.stringify(players));
}

// --------- Render player list in sidebar and selects ----------
function renderPlayerSidebar(){
  playerListDiv.innerHTML = '';
  if(players.length === 0){
    playerListDiv.innerHTML = '<div class="muted">No players yet</div>';
    return;
  }
  players.forEach((p, i) => {
    const d = document.createElement('div');
    d.className = 'player';
    d.innerHTML = `<div><strong>${escapeHtml(p.name)}</strong><div class="small muted">Hcp: ${p.hIndex!=null?p.hIndex.toFixed(1):'—'}</div></div>
                   <div style="display:flex;gap:6px">
                     <button class="btn" data-edit="${i}">Edit</button>
                     <button class="btn danger" data-del="${i}">Del</button>
                   </div>`;
    playerListDiv.appendChild(d);
  });
  // bind delete/edit
  playerListDiv.querySelectorAll('button[data-del]').forEach(b => b.addEventListener('click', (e) => {
    const idx = +b.dataset.del;
    if(confirm(`Delete player ${players[idx].name}?`)){
      players.splice(idx,1);
      savePlayers();
      renderPlayerSidebar();
      populatePlayerSelects();
    }
  }));
  playerListDiv.querySelectorAll('button[data-edit]').forEach(b => b.addEventListener('click', (e) => {
    const idx = +b.dataset.edit;
    openModalForEdit(idx);
  }));
}

function populatePlayerSelects(){
  roundPlayers.innerHTML = players.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}${p.hIndex!=null?` (hcp ${p.hIndex.toFixed(1)})`:''}</option>`).join('');
  profileSelect.innerHTML = players.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join('');
}

// --------- Modal handlers & behavior ----------
function attachModalHandlers(){
  // only show when Add Player clicked
  addPlayerScoreBtn.addEventListener('click', showAddPlayerModal);

  // toggle handicap row
  toggleHcp.addEventListener('change', ()=> {
    if(toggleHcp.checked) playerHcpRow.classList.remove('hidden'); else playerHcpRow.classList.add('hidden');
  });

  // Save: add player to array & persist, then close modal
  savePlayerBtn.addEventListener('click', ()=> {
    const name = (playerNameInput.value || '').trim();
    if(!name) { alert('Please enter a player name'); return; }
    const hasHcp = toggleHcp.checked;
    const h = hasHcp && playerHcpInput.value !== '' ? parseFloat(playerHcpInput.value) : null;
    // if editing?
    if(playerModal.dataset.editIndex){
      const idx = +playerModal.dataset.editIndex;
      players[idx].name = name;
      players[idx].hIndex = h;
      delete playerModal.dataset.editIndex;
    } else {
      players.push({ name, hIndex: h });
    }
    savePlayers();
    renderPlayerSidebar();
    populatePlayerSelects();
    closePlayerModal();
  });

  // Cancel: just close modal and discard inputs
  cancelPlayerBtn.addEventListener('click', ()=> {
    closePlayerModal();
  });
}

// show modal for new player
function showAddPlayerModal(){
  playerModal.dataset.editIndex = ''; // clear edit mode
  playerModal.classList.remove('hidden');
  playerNameInput.value = '';
  toggleHcp.checked = false;
  playerHcpRow.classList.add('hidden');
  playerHcpInput.value = '';
  playerNameInput.focus();
}

// open modal for editing an existing player
function openModalForEdit(idx){
  const p = players[idx];
  playerModal.dataset.editIndex = idx;
  playerModal.classList.remove('hidden');
  playerNameInput.value = p.name || '';
  if(p.hIndex != null){
    toggleHcp.checked = true;
    playerHcpRow.classList.remove('hidden');
    playerHcpInput.value = p.hIndex;
  } else {
    toggleHcp.checked = false;
    playerHcpRow.classList.add('hidden');
    playerHcpInput.value = '';
  }
  playerNameInput.focus();
}

// close modal (Save or Cancel both call this)
function closePlayerModal(){
  delete playerModal.dataset.editIndex;
  playerModal.classList.add('hidden');
  playerNameInput.value = '';
  toggleHcp.checked = false;
  playerHcpRow.classList.add('hidden');
  playerHcpInput.value = '';
}

// open modal directly from Profile page Add Player button
if(addPlayerProfileBtn){
  addPlayerProfileBtn.addEventListener('click', showAddPlayerModal);
}

// delete selected profile (on Profiles page)
const deleteSelectedPlayerBtn = $('deleteSelectedPlayer');
if(deleteSelectedPlayerBtn){
  deleteSelectedPlayerBtn.addEventListener('click', ()=> {
    const sel = profileSelect.value;
    if(!sel) return alert('Select a player to delete');
    const idx = players.findIndex(p => p.name === sel);
    if(idx === -1) return alert('Player not found');
    if(confirm(`Delete player ${players[idx].name}?`)){
      players.splice(idx,1);
      savePlayers(); renderPlayerSidebar(); populatePlayerSelects();
    }
  });
}

// show selected profile details
profileSelect.addEventListener('change', ()=> {
  const sel = profileSelect.value;
  const p = players.find(x => x.name === sel);
  if(!p) { profileDetail.innerHTML = '<div class="muted">No profile selected</div>'; return; }
  profileDetail.innerHTML = `<div><strong>${escapeHtml(p.name)}</strong></div><div class="small muted">Handicap: ${p.hIndex!=null?p.hIndex.toFixed(1):'Not set'}</div>`;
});

// helper: escape html
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
