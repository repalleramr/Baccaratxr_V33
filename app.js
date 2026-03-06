
const MAX_STEPS = 35;
const state = {
  currentTab: 'play',
  theme: localStorage.getItem('bt_theme') || 'casino',
  settings: {
    startingBankroll: Number(localStorage.getItem('bt_startingBankroll') || 30000),
    targetAmount: Number(localStorage.getItem('bt_targetAmount') || 5000),
    targetPercent: Number(localStorage.getItem('bt_targetPercent') || 16.67),
    keepSameTarget: localStorage.getItem('bt_keepSameTarget') === 'true',
    minBet: Number(localStorage.getItem('bt_minBet') || 100),
    maxBet: Number(localStorage.getItem('bt_maxBet') || 3000),
    multiple: Number(localStorage.getItem('bt_multiple') || 100),
    profitTarget: Number(localStorage.getItem('bt_profitTarget') || 500)
  },
  bankroll: Number(localStorage.getItem('bt_bankroll') || 30000),
  rounds: JSON.parse(localStorage.getItem('bt_rounds') || '[]'),
  ladder: JSON.parse(localStorage.getItem('bt_ladder') || '[]')
};

function money(n){ return '₹' + Number(n || 0).toFixed(0); }
function clamp(v,min,max){ return Math.min(max, Math.max(min, v)); }
function saveState(){
  localStorage.setItem('bt_theme', state.theme);
  localStorage.setItem('bt_startingBankroll', state.settings.startingBankroll);
  localStorage.setItem('bt_targetAmount', state.settings.targetAmount);
  localStorage.setItem('bt_targetPercent', state.settings.targetPercent);
  localStorage.setItem('bt_keepSameTarget', state.settings.keepSameTarget);
  localStorage.setItem('bt_minBet', state.settings.minBet);
  localStorage.setItem('bt_maxBet', state.settings.maxBet);
  localStorage.setItem('bt_multiple', state.settings.multiple);
  localStorage.setItem('bt_profitTarget', state.settings.profitTarget);
  localStorage.setItem('bt_bankroll', state.bankroll);
  localStorage.setItem('bt_rounds', JSON.stringify(state.rounds));
  localStorage.setItem('bt_ladder', JSON.stringify(state.ladder));
}
function applyTheme(){
  document.body.classList.remove('theme-neo','theme-classic');
  if(state.theme === 'neo') document.body.classList.add('theme-neo');
  if(state.theme === 'classic') document.body.classList.add('theme-classic');
  document.querySelectorAll('.theme-btn').forEach(btn=>{
    btn.classList.toggle('is-selected', btn.dataset.theme === state.theme);
  });
}
function roundToMultiple(v, multiple){
  return Math.ceil(v / multiple) * multiple;
}
function autoGenerateLadder(){
  const {minBet, maxBet, multiple, profitTarget} = state.settings;
  const steps = [];
  let priorLosses = 0;
  for(let i=1;i<=MAX_STEPS;i++){
    let need = (profitTarget + priorLosses) / 8;
    let bet = roundToMultiple(Math.max(minBet, need), multiple);
    bet = Math.min(maxBet, bet);
    steps.push(bet);
    priorLosses += bet;
  }
  state.ladder = steps;
  saveState();
}
function buildLadderUI(){
  const wrap = document.getElementById('ladderList');
  wrap.innerHTML = '';
  if(!state.ladder.length) autoGenerateLadder();
  let priorLoss = 0;
  state.ladder.forEach((bet, idx)=>{
    const row = document.createElement('div');
    row.className = 'ladder-row';
    const netIfHit = 8 * bet - priorLoss;
    row.innerHTML = `
      <div class="ladder-step">${idx+1}</div>
      <input type="number" inputmode="numeric" enterkeyhint="${idx === state.ladder.length-1 ? 'done' : 'next'}" value="${bet}" data-step="${idx}" />
      <div class="ladder-net">≥ ${money(netIfHit)}</div>
    `;
    wrap.appendChild(row);
    priorLoss += Number(bet || 0);
  });
  wrap.querySelectorAll('input').forEach((input, idx, arr)=>{
    input.addEventListener('input', e=>{
      const i = Number(e.target.dataset.step);
      state.ladder[i] = Number(e.target.value || 0);
      saveState();
      buildLadderUI();
    });
    input.addEventListener('keydown', e=>{
      if(e.key === 'Enter'){
        e.preventDefault();
        const next = arr[idx+1];
        if(next) next.focus();
        else input.blur();
      }
    });
  });
}
function setupKeypads(){
  const digits = ['0','1','2','3','4','5','6','7','8','9'];
  ['playerKeypad','bankerKeypad'].forEach(id=>{
    const wrap = document.getElementById(id);
    wrap.innerHTML = '';
    digits.forEach(d=>{
      const btn = document.createElement('button');
      btn.className = 'key-btn';
      btn.textContent = d;
      btn.addEventListener('click', ()=>{
        addRound(id === 'playerKeypad' ? Number(d) : null, id === 'bankerKeypad' ? Number(d) : null);
      });
      wrap.appendChild(btn);
    });
  });
}
function addRound(player, banker){
  // one-side entry helper: if player entered alone, banker defaults null; same for banker
  const now = new Date();
  const round = {
    id: state.rounds.length + 1,
    date: now.toISOString().slice(0,10),
    time: now.toTimeString().slice(0,8),
    player,
    banker,
    pNet: 0,
    bNet: 0,
    totalNet: 0,
    bankroll: state.bankroll
  };
  state.rounds.push(round);
  saveState();
  renderAll();
}
function setTab(name){
  state.currentTab = name;
  document.querySelectorAll('.tab-screen').forEach(el=>el.classList.toggle('is-active', el.dataset.tab === name));
  document.querySelectorAll('.tab-btn').forEach(el=>el.classList.toggle('is-active', el.dataset.tabTarget === name));
}
function renderBoard(){
  const makeTile = (n)=>{
    const div = document.createElement('div');
    div.className = 'tile inactive';
    div.innerHTML = `
      <div class="num">${n}</div>
      <div class="state">INACTIVE</div>
      <div class="bet">STEP 0 • BET ₹0</div>
      <div class="progress"><div style="width:0%"></div></div>
    `;
    return div;
  };
  ['playerBoard','bankerBoard'].forEach(id=>{
    const wrap = document.getElementById(id);
    wrap.innerHTML = '';
    for(let n=1;n<=9;n++) wrap.appendChild(makeTile(n));
  });
}
function renderHistory(){
  const body = document.getElementById('historyBody');
  if(!state.rounds.length){
    body.innerHTML = '<tr class="empty-row"><td colspan="9">No rounds recorded yet</td></tr>';
    return;
  }
  body.innerHTML = '';
  [...state.rounds].reverse().forEach((r, idx)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${state.rounds.length - idx}</td>
      <td>${r.date}</td>
      <td>${r.time}</td>
      <td>${r.player ?? '—'}</td>
      <td>${r.banker ?? '—'}</td>
      <td>${money(r.pNet)}</td>
      <td>${money(r.bNet)}</td>
      <td>${money(r.totalNet)}</td>
      <td>${money(r.bankroll)}</td>
    `;
    body.appendChild(tr);
  });
}
function renderAnalytics(){
  document.getElementById('aRounds').textContent = state.rounds.length;
  document.getElementById('aBankroll').textContent = money(state.bankroll);
  document.getElementById('aPWins').textContent = 0;
  document.getElementById('aBWins').textContent = 0;

  const currentNet = state.bankroll - state.settings.startingBankroll;
  document.getElementById('targetCurrent').textContent = money(currentNet);
  document.getElementById('targetGoal').textContent = money(state.settings.targetAmount);
  const p = clamp((currentNet / Math.max(1,state.settings.targetAmount)) * 100, 0, 100);
  document.getElementById('targetFill').style.width = p + '%';
  document.getElementById('targetFill').style.background = p >= 100 ? '#30cc78' : '#f5cb57';
  document.getElementById('targetPercentText').textContent = p.toFixed(1) + '%';

  const exposureSeries = state.rounds.length ? state.rounds.map((_,i)=> (i+1)*100).join(' → ') : 'No exposure data yet';
  document.getElementById('exposureTimeline').textContent = exposureSeries;

  const vol = state.rounds.length ? clamp(state.rounds.length * 6, 6, 100) : 10;
  document.getElementById('volatilityFill').style.width = vol + '%';
  document.getElementById('volatilityFill').style.background = vol < 34 ? '#30cc78' : vol < 67 ? '#f5cb57' : '#ef5c66';
  document.getElementById('volatilityText').textContent = vol < 34 ? 'LOW' : vol < 67 ? 'MED' : 'HIGH';

  if(state.rounds.length < 4){
    document.getElementById('predictorRange').textContent = 'Step 1–3';
    document.getElementById('predA').textContent = '60%';
    document.getElementById('predB').textContent = '25%';
    document.getElementById('predC').textContent = '10%';
    document.getElementById('predD').textContent = '5%';
  } else {
    document.getElementById('predictorRange').textContent = 'Step 4–7';
    document.getElementById('predA').textContent = '25%';
    document.getElementById('predB').textContent = '50%';
    document.getElementById('predC').textContent = '18%';
    document.getElementById('predD').textContent = '7%';
  }

  if(currentNet >= state.settings.targetAmount){
    document.getElementById('nextShoeSuggestion').textContent = 'Target reached. Recommended next shoe bankroll: ' + money(state.settings.startingBankroll);
  } else if(currentNet < 0 && state.rounds.length){
    document.getElementById('nextShoeSuggestion').textContent = 'Mid-shoe loss state. Recommended restart bankroll: ' + money(state.settings.startingBankroll);
  } else {
    document.getElementById('nextShoeSuggestion').textContent = 'Available after target reached or shoe stopped with loss.';
  }
}
function renderPlay(){
  document.getElementById('startBankrollText').textContent = state.settings.startingBankroll.toFixed(0);
  document.getElementById('liveBankrollText').textContent = state.bankroll.toFixed(0);
  document.getElementById('roundCount').textContent = state.rounds.length;

  document.getElementById('playerActiveCount').textContent = 0;
  document.getElementById('bankerActiveCount').textContent = 0;
  document.getElementById('playerNet').textContent = money(0);
  document.getElementById('bankerNet').textContent = money(0);
  document.getElementById('playerNextTotal').textContent = money(0);
  document.getElementById('bankerNextTotal').textContent = money(0);

  const recent = state.rounds.slice(-5).map(r => `P${r.player ?? '—'}-B${r.banker ?? '—'}`);
  document.getElementById('last5Results').textContent = recent.length ? recent.join(' ') : '—';

  const exposure = 0;
  document.getElementById('playerExposure').textContent = money(0);
  document.getElementById('bankerExposure').textContent = money(0);
  document.getElementById('totalExposure').textContent = money(exposure);
  document.getElementById('nextPlayerBets').textContent = '—';
  document.getElementById('nextBankerBets').textContent = '—';

  const riskPercent = clamp((state.rounds.length * 2), 4, 100);
  const fill = document.getElementById('riskFill');
  fill.style.width = riskPercent + '%';
  fill.style.background = riskPercent < 34 ? '#30cc78' : riskPercent < 67 ? '#f5cb57' : '#ef5c66';
  document.getElementById('riskText').textContent = riskPercent < 34 ? 'LOW' : riskPercent < 67 ? 'MED' : 'HIGH';
}
function renderSettings(){
  document.getElementById('startingBankrollInput').value = state.settings.startingBankroll;
  document.getElementById('targetAmountInput').value = state.settings.targetAmount;
  document.getElementById('targetPercentInput').value = state.settings.targetPercent;
  document.getElementById('keepTargetToggle').checked = state.settings.keepSameTarget;
  document.getElementById('minBetInput').value = state.settings.minBet;
  document.getElementById('maxBetInput').value = state.settings.maxBet;
  document.getElementById('multipleInput').value = state.settings.multiple;
  document.getElementById('profitTargetInput').value = state.settings.profitTarget;
}
function syncTargetFromAmount(){
  const amount = Number(document.getElementById('targetAmountInput').value || 0);
  const start = Number(document.getElementById('startingBankrollInput').value || 1);
  document.getElementById('targetPercentInput').value = ((amount / start) * 100).toFixed(2);
}
function syncTargetFromPercent(){
  const percent = Number(document.getElementById('targetPercentInput').value || 0);
  const start = Number(document.getElementById('startingBankrollInput').value || 0);
  document.getElementById('targetAmountInput').value = Math.round(start * percent / 100);
}
function bindSettings(){
  document.getElementById('targetAmountInput').addEventListener('input', syncTargetFromAmount);
  document.getElementById('targetPercentInput').addEventListener('input', syncTargetFromPercent);
  document.getElementById('startingBankrollInput').addEventListener('input', ()=>{
    syncTargetFromAmount();
  });
  document.getElementById('saveSettingsBtn').addEventListener('click', ()=>{
    state.settings.startingBankroll = Number(document.getElementById('startingBankrollInput').value || 30000);
    state.settings.targetAmount = Number(document.getElementById('targetAmountInput').value || 5000);
    state.settings.targetPercent = Number(document.getElementById('targetPercentInput').value || 16.67);
    state.settings.keepSameTarget = document.getElementById('keepTargetToggle').checked;
    state.settings.minBet = Number(document.getElementById('minBetInput').value || 100);
    state.settings.maxBet = Number(document.getElementById('maxBetInput').value || 3000);
    state.settings.multiple = Number(document.getElementById('multipleInput').value || 100);
    state.settings.profitTarget = Number(document.getElementById('profitTargetInput').value || 500);
    if(!state.rounds.length) state.bankroll = state.settings.startingBankroll;
    autoGenerateLadder();
    saveState();
    renderAll();
    alert('Settings saved');
  });
  document.getElementById('resetAllBtn').addEventListener('click', ()=>{
    if(confirm('Reset all data?')){
      state.rounds = [];
      state.bankroll = state.settings.startingBankroll;
      autoGenerateLadder();
      saveState();
      renderAll();
    }
  });
  document.querySelectorAll('.theme-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      state.theme = btn.dataset.theme;
      saveState();
      applyTheme();
    });
  });
}
function bindTabs(){
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> setTab(btn.dataset.tabTarget));
  });
}
function bindActions(){
  document.getElementById('undoBtn').addEventListener('click', ()=>{
    state.rounds.pop();
    saveState();
    renderAll();
  });
  document.getElementById('clearBtn').addEventListener('click', ()=>{
    state.rounds = [];
    saveState();
    renderAll();
  });
  document.getElementById('newShoeBtn').addEventListener('click', ()=>{
    state.rounds = [];
    if(!state.settings.keepSameTarget){
      state.settings.targetAmount = Math.round(state.bankroll * state.settings.targetPercent / 100);
    }
    saveState();
    renderAll();
  });
  document.getElementById('autoBuildBtn').addEventListener('click', ()=>{
    autoGenerateLadder();
    renderAll();
  });
  ['exportCsvBtn','exportPdfBtn','exportXlsBtn'].forEach(id=>{
    document.getElementById(id).addEventListener('click', ()=> alert('Export available when data is present.'));
  });
}
function renderAll(){
  applyTheme();
  renderPlay();
  renderBoard();
  renderHistory();
  renderAnalytics();
  buildLadderUI();
  renderSettings();
}
document.addEventListener('DOMContentLoaded', ()=>{
  bindTabs();
  bindSettings();
  bindActions();
  setupKeypads();
  if(!state.ladder.length) autoGenerateLadder();
  renderAll();
});
