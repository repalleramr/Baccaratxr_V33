
const KEY='v33pro_state', UKEY='v33pro_undo';
let deferredPrompt = null;

function defaultState(){ return {
  settings:{startBankroll:15000,targetPercent:35,targetAmount:5250,keepTarget:true,autoStop:false,minBet:100,maxBet:3000,betMultiple:100,profitTarget:500,theme:'dark',payoutMultiplier:8},
  bankroll:15000, player:{active:[],pl:0,history:[]}, banker:{active:[],pl:0,history:[]},
  ladder:[], targetShown:false, pending:{player:null,banker:null}, rounds:[],
  replayIndex:-1, session:{shoesPlayed:0,totalProfitToday:0,largestDrawdown:0,largestWin:0}
};}
let state = load(KEY, defaultState());
let undo = load(UKEY, []);
function load(k, f){ try{ const x = localStorage.getItem(k); return x ? JSON.parse(x) : f; }catch{return f;} }
function save(){ localStorage.setItem(KEY, JSON.stringify(state)); localStorage.setItem(UKEY, JSON.stringify(undo.slice(-50))); }
function snap(){ undo.push(JSON.parse(JSON.stringify(state))); undo = undo.slice(-50); save(); }
function roundUp(v,m){ return m<=0?Math.ceil(v):Math.ceil(v/m)*m; }
function shoeProfit(){ return state.bankroll - state.settings.startBankroll; }
function targetPct(){ const t=state.settings.targetAmount||1; return Math.max(0,Math.min(100,Math.round((shoeProfit()/t)*100))); }
function riskStatus(current, exposure){ const r=current>0?exposure/current:1; if(r<0.05)return 'SAFE'; if(r<0.12)return 'CAUTION'; return 'DANGER'; }
function keypadsLocked(){ return state.settings.autoStop && state.targetShown; }
function applyTheme(){ document.body.classList.toggle('theme-green', state.settings.theme === 'green'); }
function genLadder(){
  let prev=0; state.ladder=[];
  for(let s=1;s<=25;s++){
    let need=(prev+state.settings.profitTarget)/state.settings.payoutMultiplier;
    let bet=Math.max(state.settings.minBet, roundUp(need,state.settings.betMultiple));
    bet=Math.min(bet,state.settings.maxBet);
    state.ladder.push({step:s,bet,netIfHit:bet*state.settings.payoutMultiplier-prev});
    prev+=bet;
  }
}
function betFor(stage){ if(!state.ladder.length) genLadder(); return state.ladder[Math.min(stage,state.ladder.length)-1].bet; }
function totalSideExposure(sideObj){ return sideObj.active.reduce((a,x)=>a+betFor(x.stage),0); }
function totalExposure(){ return totalSideExposure(state.player)+totalSideExposure(state.banker); }
function projectedExposure(rounds){
  const one = side => side.active.reduce((a,x)=>{ let t=0; for(let i=0;i<rounds;i++) t += betFor(Math.min(x.stage+i,state.ladder.length)); return a+t; },0);
  return one(state.player)+one(state.banker);
}
function nextShoeSuggestion(){ return state.settings.startBankroll + projectedExposure(3); }
function recordSessionShoe(){
  if(!state.rounds.length) return;
  const p=shoeProfit();
  state.session.shoesPlayed++;
  state.session.totalProfitToday += p;
  if(p > state.session.largestWin) state.session.largestWin = p;
  if(p < state.session.largestDrawdown) state.session.largestDrawdown = p;
}
function applySide(side, result){
  const s = state[side];
  let delta = -totalSideExposure(s);
  const idx = s.active.findIndex(x=>x.number===result);
  if(result===0){ s.active = s.active.map(x=>({...x,stage:x.stage+1})); }
  else if(idx>=0){
    const hit=s.active[idx];
    delta += betFor(hit.stage)*state.settings.payoutMultiplier;
    s.active = s.active.filter(x=>x.number!==result).map(x=>({...x,stage:x.stage+1}));
  }else{
    s.active = s.active.map(x=>({...x,stage:x.stage+1}));
    s.active.push({number:result,stage:1});
  }
  s.pl += delta;
  state.bankroll += delta;
  s.history.push({date:new Date().toISOString().slice(0,10), time:new Date().toLocaleTimeString('en-GB'), result, delta});
}
function commitRound(){
  if(keypadsLocked()) return;
  if(state.pending.player===null || state.pending.banker===null) return;
  snap();
  const p=state.pending.player, b=state.pending.banker;
  applySide('player', p); applySide('banker', b);
  state.rounds.push({player:p, banker:b});
  state.pending={player:null, banker:null};
  if(!state.targetShown && shoeProfit() >= state.settings.targetAmount) state.targetShown = true;
  render();
}
function setPending(side, val){
  if(keypadsLocked()) return;
  state.pending[side]=val;
  const btn=document.querySelector(`[data-pad="${side}"][data-val="${val}"]`);
  if(btn){ btn.classList.add('pressed'); setTimeout(()=>btn.classList.remove('pressed'),180); }
  if(state.pending.player!==null && state.pending.banker!==null) commitRound(); else save();
}
function boardCards(sideName){
  const s=state[sideName], active=new Map(s.active.map(x=>[x.number,x])), won=new Set();
  s.history.forEach(h=>{ if(h.result!==0 && !active.has(h.result)) won.add(h.result); });
  let out='';
  for(let n=1;n<=9;n++){
    if(active.has(n)){ const x=active.get(n), p=Math.min(100, Math.round((x.stage/25)*100)); out += `<div class="num-card active"><div class="n">${n}</div><div class="status">S${x.stage}/25 • Bet ${betFor(x.stage)}</div><div class="bar"><div style="width:${p}%"></div></div></div>`; }
    else if(won.has(n)){ out += `<div class="num-card excluded"><div class="n">${n}</div><div class="status">EXCLUDED ✅</div><div class="bar"><div style="width:100%"></div></div></div>`; }
    else{ out += `<div class="num-card inactive"><div class="n">${n}</div><div class="status">INACTIVE</div><div class="bar"><div style="width:0%"></div></div></div>`; }
  }
  return out;
}
function renderRoadMap(){ document.getElementById('roadMap').innerHTML = state.rounds.map(r=>`<div class="road-cell p">P${r.player}</div><div class="road-cell b">B${r.banker}</div>`).join(''); }
function activeNumbersText(){ const p=state.player.active.map(x=>x.number).join(' '), b=state.banker.active.map(x=>x.number).join(' '); return `P:${p||'-'} | B:${b||'-'}`; }
function renderHistory(){
  let rows='', max=Math.max(state.player.history.length,state.banker.history.length);
  for(let i=0;i<max;i++){
    const p=state.player.history[i], b=state.banker.history[i];
    const total=(p?.delta||0)+(b?.delta||0);
    let bankroll=state.settings.startBankroll;
    for(let j=0;j<=i;j++) bankroll += (state.player.history[j]?.delta||0) + (state.banker.history[j]?.delta||0);
    rows += `<tr><td>${i+1}</td><td>P${state.rounds[i]?.player??''}</td><td>B${state.rounds[i]?.banker??''}</td><td>${activeNumbersText()}</td><td>${total}</td><td>${bankroll}</td></tr>`;
  }
  document.getElementById('historyTable').innerHTML = `<table><thead><tr><th>Round</th><th>Player</th><th>Banker</th><th>Active Numbers</th><th>Profit</th><th>Bankroll</th></tr></thead><tbody>${rows||"<tr><td colspan='6'>No history</td></tr>"}</tbody></table>`;
}
function renderStatsTable(){
  let rows='';
  for(let n=1;n<=9;n++){
    const ps=state.player.history.filter(h=>h.result===n).length, bs=state.banker.history.filter(h=>h.result===n).length;
    const pa=state.player.active.find(x=>x.number===n), ba=state.banker.active.find(x=>x.number===n);
    const pw=state.player.history.filter(h=>h.result===n&&h.delta>0).length, bw=state.banker.history.filter(h=>h.result===n&&h.delta>0).length;
    rows += `<tr><td>${n}</td><td>${ps}</td><td>${pa?Math.max(0,pa.stage-1):'-'}</td><td>${pw}</td><td>${bs}</td><td>${ba?Math.max(0,ba.stage-1):'-'}</td><td>${bw}</td></tr>`;
  }
  document.getElementById('analyticsTable').innerHTML = `<table><thead><tr><th>Num</th><th>P Seen</th><th>P Wait</th><th>P Win</th><th>B Seen</th><th>B Wait</th><th>B Win</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function renderHeatmaps(){
  const make=(side,id,a,b)=>{ let h=''; for(let n=1;n<=9;n++){ const c=state[side].history.filter(x=>x.result===n).length; h += `<div class="heat-card ${c?a:b}"><div class="n">${n}</div><div class="small">${c}</div></div>`; } document.getElementById(id).innerHTML=h; };
  make('player','playerHeat','p1','p0'); make('banker','bankerHeat','b1','b0');
}
function renderPredictor(){
  const rows=[];
  for(const side of ['player','banker']){
    for(let n=1;n<=9;n++){
      const active=state[side].active.find(x=>x.number===n), seen=state[side].history.filter(h=>h.result===n).length;
      const wait=active?Math.max(0,active.stage-1):'-', score=(active?active.stage*12:0)+(seen===0?8:0), label=score>=60?'HOT':score>=20?'WATCH':'COLD';
      rows.push({side:side==='player'?'P':'B',num:n,seen,wait,score,label});
    }
  }
  rows.sort((x,y)=>y.score-x.score);
  document.getElementById('predictorTable').innerHTML = `<table><thead><tr><th>Side</th><th>Num</th><th>Seen</th><th>Wait</th><th>Score</th><th>Status</th></tr></thead><tbody>${rows.slice(0,10).map(r=>`<tr><td>${r.side}</td><td>${r.num}</td><td>${r.seen}</td><td>${r.wait}</td><td>${r.score}</td><td>${r.label}</td></tr>`).join('')}</tbody></table>`;
}
function renderLadder(){
  const box=document.getElementById('ladderList');
  box.innerHTML = state.ladder.map(r=>`<div class="ladder-row"><div>Step ${r.step}</div><input type="number" value="${r.bet}" data-step="${r.step}"><div>≥ ${Math.round(r.netIfHit)}</div></div>`).join('');
  box.querySelectorAll('input').forEach(inp=>{
    inp.addEventListener('focus', e=>e.target.select());
    inp.addEventListener('keydown', e=>{
      if(e.key === 'Enter' || e.key === 'Next'){
        e.preventDefault();
        const next = box.querySelector(`input[data-step="${Number(e.target.dataset.step)+1}"]`);
        if(next){ next.focus(); next.select(); }
      }
    });
    inp.addEventListener('input', e=>{
      const s=Number(e.target.dataset.step), v=Number(e.target.value||0);
      if(v>0){
        state.ladder[s-1].bet=v;
        let prev=0; state.ladder.forEach(r=>{ r.netIfHit=r.bet*state.settings.payoutMultiplier-prev; prev+=r.bet; }); save();
      }
    });
  });
}
function sideBetText(sideObj){ return sideObj.active.length ? sideObj.active.sort((a,b)=>a.number-b.number).map(x=>`${betFor(x.stage)} on ${x.number}(S${x.stage})`).join(', ') : '—'; }
function switchTab(tab){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  document.querySelector(`.navbtn[data-tab="${tab}"]`).classList.add('active');
  window.scrollTo(0,0);
}
function buildPad(elId, side){
  const box=document.getElementById(elId); box.innerHTML='';
  for(let n=0;n<=9;n++){
    const b=document.createElement('button'); b.type='button'; b.textContent=n; b.dataset.pad=side; b.dataset.val=String(n);
    const h=e=>{ e.preventDefault(); setPending(side,n); };
    b.addEventListener('click',h); b.addEventListener('touchstart',h,{passive:false});
    box.appendChild(b);
  }
}
function setupInstall(){
  const btn = document.getElementById('installBtn');
  window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferredPrompt = e; btn.classList.remove('hidden'); });
  btn.addEventListener('click', async ()=>{ if(!deferredPrompt) return; deferredPrompt.prompt(); try{ await deferredPrompt.userChoice; }catch(_){} deferredPrompt = null; btn.classList.add('hidden'); });
  window.addEventListener('appinstalled', ()=>{ deferredPrompt = null; btn.classList.add('hidden'); });
}
function exportCSV(){
  const rows=[['Round','Player','Banker','Active Numbers','Profit','Bankroll']];
  let max=Math.max(state.player.history.length,state.banker.history.length), bankroll=state.settings.startBankroll;
  for(let i=0;i<max;i++){ const p=state.player.history[i], b=state.banker.history[i]; const total=(p?.delta||0)+(b?.delta||0); bankroll += total; rows.push([i+1, `P${state.rounds[i]?.player??''}`, `B${state.rounds[i]?.banker??''}`, activeNumbersText(), total, bankroll]); }
  const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='baccarat_results.csv'; a.click();
}
function exportExcel(){
  let html = `<html><body><table border="1"><tr><th>Round</th><th>Player</th><th>Banker</th><th>Active Numbers</th><th>Profit</th><th>Bankroll</th></tr>`;
  let max=Math.max(state.player.history.length,state.banker.history.length), bankroll=state.settings.startBankroll;
  for(let i=0;i<max;i++){ const p=state.player.history[i], b=state.banker.history[i]; const total=(p?.delta||0)+(b?.delta||0); bankroll += total; html += `<tr><td>${i+1}</td><td>P${state.rounds[i]?.player??''}</td><td>B${state.rounds[i]?.banker??''}</td><td>${activeNumbersText()}</td><td>${total}</td><td>${bankroll}</td></tr>`; }
  html += `</table></body></html>`;
  const blob=new Blob([html],{type:'application/vnd.ms-excel'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='baccarat_results.xls'; a.click();
}
function makeSimplePdf(text){
  const esc = s => s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/\r/g,'');
  const lines = text.split('\n');
  let stream = 'BT\n/F1 12 Tf\n50 780 Td\n14 TL\n' + lines.map((ln,i)=>`${i===0?'':'T* '}(${esc(ln)}) Tj`).join('\n') + '\nET';
  const objs = [];
  objs.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj');
  objs.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj');
  objs.push('3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj');
  objs.push(`4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream endobj`);
  objs.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj');
  let pdf='%PDF-1.4\n', offs=[];
  for(const o of objs){ offs.append if False else None }
  offs=[]
  for(const o of objs): offs.append(len(pdf)); pdf += o+'\n'
  xref=len(pdf)
  pdf += f"xref\n0 {len(objs)+1}\n0000000000 65535 f \n"
  for off in offs: pdf += f"{str(off).rjust(10,'0')} 00000 n \n"
  pdf += f"trailer<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF"
  return pdf
}
function exportPDF(){
  let lines=[ 'BACCARAT SESSION REPORT', `Starting Bankroll: ${state.settings.startBankroll}`, `Target Amount: ${state.settings.targetAmount}`, `Final Bankroll: ${state.bankroll}`, `Net Profit: ${shoeProfit()}`, '', 'ROUND HISTORY' ];
  let max=Math.max(state.player.history.length,state.banker.history.length), bankroll=state.settings.startBankroll;
  for(let i=0;i<max;i++){ const p=state.player.history[i], b=state.banker.history[i]; const total=(p?.delta||0)+(b?.delta||0); bankroll += total; lines.push(`${i+1}. P${state.rounds[i]?.player??''} B${state.rounds[i]?.banker??''} Profit ${total} Bankroll ${bankroll}`); }
  const blob = new Blob([makeSimplePdf(lines.join('\n'))], {type:'application/pdf'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='baccarat_session_report.pdf'; a.click();
}
function render(){
  applyTheme();
  document.getElementById('bankroll').textContent=state.bankroll;
  document.getElementById('pStep').textContent=state.player.active.length?Math.min(...state.player.active.map(x=>x.stage)):1;
  document.getElementById('pActive').textContent=state.player.active.length;
  document.getElementById('pBet').textContent=totalSideExposure(state.player);
  document.getElementById('bStep').textContent=state.banker.active.length?Math.min(...state.banker.active.map(x=>x.stage)):1;
  document.getElementById('bActive').textContent=state.banker.active.length;
  document.getElementById('bBet').textContent=totalSideExposure(state.banker);
  document.getElementById('targetMsg').textContent=state.targetShown?'TARGET REACHED FOR THIS SHOE':'';
  document.getElementById('lastRound').textContent=state.rounds.length?`P${state.rounds[state.rounds.length-1].player} B${state.rounds[state.rounds.length-1].banker}`:'—';
  document.getElementById('last3').textContent=state.rounds.slice(-3).map(r=>`P${r.player} B${r.banker}`).join(' | ')||'—';
  document.getElementById('shoeProfit').textContent=shoeProfit();
  document.getElementById('targetProgress').textContent=`${targetPct()}%`;
  document.getElementById('nextExposure').textContent=totalExposure();
  const pr=riskStatus(state.bankroll,totalExposure()), prEl=document.getElementById('playRisk'); prEl.textContent=pr; prEl.className=pr==='SAFE'?'safe':(pr==='CAUTION'?'caution':'risk');
  document.getElementById('nextPlayer').textContent=sideBetText(state.player);
  document.getElementById('nextBanker').textContent=sideBetText(state.banker);
  document.getElementById('nextTotal').textContent=totalExposure();
  document.getElementById('playerActiveWarn').textContent=state.player.active.length + (state.player.active.length>7?' ⚠':'');
  document.getElementById('bankerActiveWarn').textContent=state.banker.active.length + (state.banker.active.length>7?' ⚠':'');
  document.getElementById('playerBoard').innerHTML=boardCards('player');
  document.getElementById('bankerBoard').innerHTML=boardCards('banker');
  renderRoadMap();
  document.getElementById('handsCount').textContent=state.rounds.length;
  document.getElementById('playerHits').textContent=state.player.history.filter(h=>h.delta>0).length;
  document.getElementById('bankerHits').textContent=state.banker.history.filter(h=>h.delta>0).length;
  document.getElementById('aShoeProfit').textContent=shoeProfit();
  document.getElementById('aTargetProgress').textContent=`${targetPct()}%`;
  document.getElementById('aExposure').textContent=totalExposure();
  document.getElementById('safeNow').textContent=state.bankroll-totalExposure();
  document.getElementById('safe3').textContent=projectedExposure(3);
  document.getElementById('nextShoe').textContent=nextShoeSuggestion();
  const rr=riskStatus(state.bankroll,totalExposure()), rrEl=document.getElementById('riskStatus'); rrEl.textContent=rr; rrEl.className=rr==='SAFE'?'safe':(rr==='CAUTION'?'caution':'risk');
  document.getElementById('aPlayerActive').textContent=state.player.active.map(x=>x.number).join(' ')||'—';
  document.getElementById('aBankerActive').textContent=state.banker.active.map(x=>x.number).join(' ')||'—';
  document.getElementById('shoesPlayed').textContent=state.session.shoesPlayed;
  document.getElementById('profitToday').textContent=state.session.totalProfitToday;
  document.getElementById('avgProfit').textContent=state.session.shoesPlayed?Math.round(state.session.totalProfitToday/state.session.shoesPlayed):0;
  document.getElementById('largestDrawdown').textContent=state.session.largestDrawdown;
  document.getElementById('largestWin').textContent=state.session.largestWin;
  document.getElementById('startBankroll').value=state.settings.startBankroll;
  document.getElementById('targetPercent').value=state.settings.targetPercent;
  document.getElementById('targetAmount').value=state.settings.targetAmount;
  document.getElementById('keepTarget').checked=state.settings.keepTarget;
  document.getElementById('autoStop').checked=state.settings.autoStop;
  document.getElementById('minBet').value=state.settings.minBet;
  document.getElementById('maxBet').value=state.settings.maxBet;
  document.getElementById('betMultiple').value=state.settings.betMultiple;
  document.getElementById('profitTarget').value=state.settings.profitTarget;
  document.getElementById('themeSel').value=state.settings.theme;
  document.querySelectorAll('#playerPad button,#bankerPad button').forEach(b=>{ b.disabled=keypadsLocked(); b.classList.toggle('disabled', keypadsLocked()); });
  renderHistory(); renderStatsTable(); renderHeatmaps(); renderPredictor(); renderLadder(); save();
}
document.addEventListener('DOMContentLoaded', ()=>{
  buildPad('playerPad','player'); buildPad('bankerPad','banker'); if(!state.ladder.length) genLadder();
  document.querySelectorAll('.navbtn').forEach(btn=>{ const h=e=>{e.preventDefault(); switchTab(btn.dataset.tab);}; btn.addEventListener('click',h); btn.addEventListener('touchstart',h,{passive:false}); });
  document.getElementById('undoBtn').onclick=()=>{ if(!undo.length) return; state=undo.pop(); render(); };
  document.getElementById('clearBtn').onclick=()=>{ if(state.rounds.length && !confirm(`Reset current shoe?\nCurrent profit: ${shoeProfit()}`)) return; snap(); recordSessionShoe(); const session=JSON.parse(JSON.stringify(state.session)); const settings=JSON.parse(JSON.stringify(state.settings)); state=defaultState(); state.session=session; state.settings=settings; state.bankroll=settings.startBankroll; genLadder(); render(); };
  document.getElementById('newShoeBtn').onclick=()=>{ if(state.rounds.length && !confirm(`Start new shoe?\nCurrent profit: ${shoeProfit()}`)) return; snap(); recordSessionShoe(); const session=JSON.parse(JSON.stringify(state.session)); const settings=JSON.parse(JSON.stringify(state.settings)); state=defaultState(); state.session=session; state.settings=settings; state.bankroll=settings.startBankroll; genLadder(); render(); };
  document.getElementById('exportCsv').onclick=exportCSV;
  document.getElementById('exportExcel').onclick=exportExcel;
  document.getElementById('exportPdf').onclick=exportPDF;
  document.getElementById('replayBtn').onclick=()=>alert('Replay view ready for future extension.');
  document.getElementById('stepBackBtn').onclick=()=>alert('Step back reserved.');
  document.getElementById('stepFwdBtn').onclick=()=>alert('Step forward reserved.');
  document.getElementById('targetAmount').addEventListener('input',()=>{ state.settings.startBankroll=Number(document.getElementById('startBankroll').value||30000); state.settings.targetAmount=Number(document.getElementById('targetAmount').value||0); state.settings.targetPercent=+((state.settings.targetAmount/state.settings.startBankroll)*100).toFixed(2); document.getElementById('targetPercent').value=state.settings.targetPercent; save(); });
  document.getElementById('targetPercent').addEventListener('input',()=>{ state.settings.startBankroll=Number(document.getElementById('startBankroll').value||30000); state.settings.targetPercent=Number(document.getElementById('targetPercent').value||0); state.settings.targetAmount=Math.round(state.settings.startBankroll*state.settings.targetPercent/100); document.getElementById('targetAmount').value=state.settings.targetAmount; save(); });
  document.getElementById('applySettings').onclick=()=>{ state.settings.startBankroll=Number(document.getElementById('startBankroll').value||30000); state.settings.targetPercent=Number(document.getElementById('targetPercent').value||35); state.settings.targetAmount=Number(document.getElementById('targetAmount').value||10500); state.settings.keepTarget=document.getElementById('keepTarget').checked; state.settings.autoStop=document.getElementById('autoStop').checked; state.settings.minBet=Number(document.getElementById('minBet').value||100); state.settings.maxBet=Number(document.getElementById('maxBet').value||3000); state.settings.betMultiple=Number(document.getElementById('betMultiple').value||100); state.settings.profitTarget=Number(document.getElementById('profitTarget').value||500); state.settings.theme=document.getElementById('themeSel').value; genLadder(); render(); };
  document.getElementById('regenLadder').onclick=()=>{ state.settings.minBet=Number(document.getElementById('minBet').value||100); state.settings.maxBet=Number(document.getElementById('maxBet').value||3000); state.settings.betMultiple=Number(document.getElementById('betMultiple').value||100); state.settings.profitTarget=Number(document.getElementById('profitTarget').value||500); genLadder(); render(); };
  setupInstall();
  if('serviceWorker' in navigator){ window.addEventListener('load', async ()=>{ try{ await navigator.serviceWorker.register('./sw.js?v=33', {scope:'./'}); if(navigator.serviceWorker.ready) await navigator.serviceWorker.ready; }catch(e){} }); }
  applyTheme(); render(); switchTab('play');
});
