console.log('[APP] app.js loaded');
/* ══════════════════════════
   CONSTANTS
══════════════════════════ */
const SYM   = {S:'♠',H:'♥',D:'♦',C:'♣'};
const COLOR  = {S:'black',H:'red',D:'red',C:'black'};
const RANKS  = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RV     = {}; RANKS.forEach((r,i)=>RV[r]=i);
// Face card emoji art per suit
const FACE_ART = {
  J:{S:'🤴',H:'🤴',D:'🤴',C:'🤴'},
  Q:{S:'👸',H:'👸',D:'👸',C:'👸'},
  K:{S:'🧔',H:'🧔',D:'🧔',C:'🧔'}
};
// Pip layouts for number cards (rows of pips)
const PIP_LAYOUT = {
  '2': [[1],[1]],
  '3': [[1],[1],[1]],
  '4': [[2],[2]],
  '5': [[2],[1],[2]],
  '6': [[2],[2],[2]],
  '7': [[2],[1],[2],[2]],
  '8': [[2],[2],[2],[2]],
  '9': [[2],[1],[2],[2],[2]],
  '10':[[2],[1],[2],[1],[2],[2]]
};

const POSITIONS = ['south','west','north','east'];
const TEAMS   = {south:'A',north:'A',east:'B',west:'B'};
const PARTNER = {south:'north',north:'south',east:'west',west:'east'};
const CW_NEXT = {south:'west',west:'north',north:'east',east:'south'};
// Arrows: which Unicode arrow points toward table centre from each visual position
const ZONE_ARROW = {south:'▲',north:'▼',west:'▶',east:'◀'};
const CIRC = 2*Math.PI*20;

const TURN_SECS=25, TRUMP_SECS=45;

/* ══════════════════════════
   STATE
══════════════════════════ */
let myPos='south',myName='',isHost=false,roomCode='';
let seatedNames={};
let G=null, ws=null, pendingSends=[];
let turnTimerInt=null, turnLeft=TURN_SECS;
let trumpTimerInt=null, trumpLeft=TRUMP_SECS;

/* ══════════════════════════
   CHANNEL — WebSocket relay
══════════════════════════ */
function openConn(code){
  if(ws) ws.close();
  const proto = location.protocol==='https:'? 'wss:' : 'ws:';
  const host = location.host || 'localhost:3000';
  const url = proto+'//'+host;
  console.log('[WS] Connecting to', url, 'room:', code);
  ws = new WebSocket(url);
  ws.addEventListener('open', ()=>{
    console.log('[WS] Connected');
    ws.send(JSON.stringify({t:'reg',room:code,name:myName}));
    // flush pending
    while(pendingSends.length){const m=pendingSends.shift();ws.send(JSON.stringify(m));}
  });
  ws.addEventListener('message', e=>{try{const msg=JSON.parse(e.data);handleMsg(msg);}catch(err){console.error('[WS] Parse error:', err);}}
  );
  ws.addEventListener('error', (e)=>{
    console.error('[WS] Error event:', e);
    const msg = e?.message || e?.code || 'unknown';
    const joinMsg = document.getElementById('join-msg');
    if(joinMsg) joinMsg.textContent = 'Connection failed';
    alert('Connection error: '+msg);
  });
  ws.addEventListener('close', (e)=>{
    console.log('[WS] Closed', e);
    const joinMsg = document.getElementById('join-msg');
    if(joinMsg && (!ws || ws.readyState !== 1)) joinMsg.textContent = 'Connection closed';
    ws=null;
  });
}
function bcast(msg){
  if(ws&&ws.readyState===1) ws.send(JSON.stringify(msg));
  else pendingSends.push(msg);
}
function handleMsg(m){
  if(m.t==='jr')onJoinReq(m);
  else if(m.t==='ru')onRoomUpd(m);
  else if(m.t==='gs')onGameStart(m);
  else if(m.t==='syn')onSync(m);
}

/* ══════════════════════════
   DECK
══════════════════════════ */
function buildDeck(){
  const d=[];
  for(const s of ['S','H','D','C'])for(const r of RANKS)d.push({r,s});
  return d;
}
function shuffle(a){
  const b=[...a];
  for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}
  return b;
}
function deal(deck){
  const p={};
  POSITIONS.forEach((pos,i)=>{
    const base=i*13;
    p[pos]={
      hand:  deck.slice(base,  base+3).map(c=>({...c})),
      showUp:deck.slice(base+3,base+8).map(c=>({...c})),
      hidden:deck.slice(base+8,base+13).map(c=>({...c,flipped:false})),
      tricks:0
    };
  });
  return p;
}

/* ══════════════════════════
   LOBBY
══════════════════════════ */
function getName(){const n=document.getElementById('inp-name').value.trim();if(!n){alert('Enter your name!');return null;}return n;}
function randCode(){return Math.random().toString(36).slice(2,7).toUpperCase();}

function createRoom(){
  try {
    console.log('[LOBBY] createRoom clicked');
    const n=getName();if(!n)return;
    myName=n;myPos='south';isHost=true;roomCode=randCode();
    seatedNames={south:myName};
    document.getElementById('code-display').textContent=roomCode;
    showPanel('panel-create');openConn(roomCode);buildSeatList('slist-host');
    document.getElementById('host-msg').textContent='3 more players needed…';
  } catch(e) {
    console.error('[LOBBY] createRoom error:', e);
    alert('Error creating room: '+e.message);
  }
}
function showJoin(){
  try {
    console.log('[LOBBY] showJoin clicked');
    const n=getName();if(!n)return;myName=n;showPanel('panel-join');
  } catch(e) {
    console.error('[LOBBY] showJoin error:', e);
    alert('Error: '+e.message);
  }
}
function soloPlay(){
  try {
    console.log('[LOBBY] soloPlay clicked');
    const n=getName();if(!n)return;
    myName=n;myPos='south';isHost=true;
    seatedNames={south:myName,north:'Bot N',west:'Bot W',east:'Bot E'};
    beginGame();
  } catch(e) {
    console.error('[LOBBY] soloPlay error:', e);
    alert('Error starting solo game: '+e.message);
  }
}
function joinRoom(){
  try {
    console.log('[LOBBY] joinRoom clicked');
    const code=document.getElementById('inp-code').value.trim().toUpperCase();
    if(code.length<4){document.getElementById('join-msg').textContent='Enter a valid code.';return;}
    roomCode=code;openConn(roomCode);bcast({t:'jr',name:myName});
    document.getElementById('join-msg').textContent='Requesting seat…';
  } catch(e) {
    console.error('[LOBBY] joinRoom error:', e);
    alert('Error joining room: '+e.message);
  }
}
function onJoinReq(m){
  if(!isHost)return;
  const free=POSITIONS.find(p=>!seatedNames[p]);if(!free)return;
  seatedNames[free]=m.name;
  const cnt=Object.keys(seatedNames).length;
  document.getElementById('host-msg').textContent=cnt===4?'All ready!':`${4-cnt} more…`;
  if(cnt>=2)document.getElementById('btn-start').classList.remove('hidden');
  buildSeatList('slist-host');bcast({t:'ru',seated:seatedNames});
}
function onRoomUpd(m){
  seatedNames=m.seated;
  const e=Object.entries(seatedNames).find(([,n])=>n===myName);
  if(e&&(!myPos||myPos==='south'))myPos=e[0];
  document.getElementById('join-msg').textContent=myPos?`You are ${myPos.toUpperCase()}`:'Waiting…';
  document.getElementById('slist-join').classList.remove('hidden');
  buildSeatList('slist-join');
}
function hostStart(){POSITIONS.forEach(p=>{if(!seatedNames[p])seatedNames[p]='Bot';});beginGame();}
function beginGame(){
  const players=deal(shuffle(buildDeck()));
  G={
    players,seated:{...seatedNames},
    trump:null,trumpTeam:null,trumpChooser:'south',trumpPassed:false,
    trick:[],leadPos:'south',currentPos:'south',
    trickNum:1,teamTricks:{A:0,B:0},phase:'trump'
  };
  bcast({t:'gs',G,seated:seatedNames});
  startTrumpPhase();
}
function onGameStart(m){
  seatedNames=m.seated;G=m.G;
  const e=Object.entries(seatedNames).find(([,n])=>n===myName);
  if(e)myPos=e[0];
  startTrumpPhase();
}
function onSync(m){
  G=m.G;
  if(G.phase==='trump'){renderTable();showTrumpBar();botTrumpCheck();}
  else if(G.phase==='play'){hideTrumpBar();renderTable();startTurnTimer();botPlayCheck();}
  else if(G.phase==='end'){stopAllTimers();hideTrumpBar();showResult();}
}
function buildSeatList(id){
  const ul=document.getElementById(id);ul.innerHTML='';
  POSITIONS.forEach(pos=>{
    const li=document.createElement('li');
    li.innerHTML=`<span>${pos.toUpperCase()}: <b>${seatedNames[pos]||'—'}</b></span><span class="ttag ttag-${TEAMS[pos]}">Team ${TEAMS[pos]}</span>`;
    ul.appendChild(li);
  });
}
function backMain(){showPanel('panel-main');}

/* ══════════════════════════
   TRUMP PHASE
══════════════════════════ */
function startTrumpPhase(){
  showScreen('screen-game');
  renderTable();
  showTrumpBar();
  botTrumpCheck();
}
function getHandSuits(pos){
  return [...new Set(G.players[pos].hand.filter(Boolean).map(c=>c.s))];
}
function showTrumpBar(){
  stopTrumpTimer();
  const bar=document.getElementById('trump-bar');
  bar.classList.remove('hidden');
  const chooser=G.trumpChooser;
  const iAm=chooser===myPos;
  const name=G.seated[chooser]||chooser;
  const available=getHandSuits(chooser);
  document.getElementById('tbar-title').textContent=iAm?'Choose Trump':'Waiting…';
  document.getElementById('tbar-sub').textContent=iAm?`${name}: pick suit from hand`:`${name} is choosing…`;
  document.querySelectorAll('.sc').forEach(b=>{
    b.disabled=!iAm||!available.includes(b.id.slice(3));
  });
  const pb=document.getElementById('pass-btn');
  (iAm&&!G.trumpPassed)?pb.classList.remove('hidden'):pb.classList.add('hidden');
  startTrumpTimer(iAm);
}
function hideTrumpBar(){
  stopTrumpTimer();
  document.getElementById('trump-bar').classList.add('hidden');
}
function startTrumpTimer(interactive){
  trumpLeft=TRUMP_SECS;updateTrumpUI();
  trumpTimerInt=setInterval(()=>{
    trumpLeft--;updateTrumpUI();
    if(trumpLeft<=0){stopTrumpTimer();if(interactive)autoPickTrump();}
  },1000);
}
function stopTrumpTimer(){if(trumpTimerInt){clearInterval(trumpTimerInt);trumpTimerInt=null;}}
function updateTrumpUI(){
  document.getElementById('trump-timer-fill').style.width=(trumpLeft/TRUMP_SECS*100)+'%';
  document.getElementById('trump-timer-fill').style.background=trumpLeft<=5?'#e74c3c':'#c9a84c';
  document.getElementById('tbar-timer-txt').textContent=trumpLeft+'s';
}
function autoPickTrump(){
  if(G.phase!=='trump')return;
  const suits=getHandSuits(G.trumpChooser);
  if(!suits.length)return;
  const saved=myPos;myPos=G.trumpChooser;pickTrump(suits[0]);myPos=saved;
}
function pickTrump(suit){
  if(G.trumpChooser!==myPos)return;
  if(!getHandSuits(G.trumpChooser).includes(suit))return;
  stopTrumpTimer();
  G.trump=suit;G.trumpTeam=TEAMS[G.trumpChooser];
  G.phase='play';G.leadPos=G.trumpChooser;G.currentPos=G.trumpChooser;
  bcast({t:'syn',G});hideTrumpBar();renderTable();startTurnTimer();botPlayCheck();
}
function passTrump(){
  stopTrumpTimer();
  G.trumpChooser=PARTNER[G.trumpChooser];G.trumpPassed=true;
  bcast({t:'syn',G});showTrumpBar();botTrumpCheck();
}
function botTrumpCheck(){
  if(G.phase!=='trump'||G.trumpChooser===myPos)return;
  const chooser=G.trumpChooser;
  setTimeout(()=>{
    if(G.phase!=='trump'||G.trumpChooser!==chooser)return;
    const suits=getHandSuits(chooser);
    if(!suits.length)return;
    const saved=myPos;myPos=chooser;pickTrump(suits[0]);myPos=saved;
  },1100+Math.random()*700);
}

/* ══════════════════════════
   TURN TIMER
══════════════════════════ */
function startTurnTimer(){
  stopTurnTimer();
  if(G.phase!=='play')return;
  document.getElementById('turn-timer-wrap').classList.remove('hidden');
  document.getElementById('ttimer-label').textContent=G.currentPos===myPos?'YOUR TURN':'';
  turnLeft=TURN_SECS;updateTimerUI();
  const cur=G.currentPos;
  turnTimerInt=setInterval(()=>{
    if(G.currentPos!==cur){stopTurnTimer();return;}
    turnLeft--;updateTimerUI();
    if(turnLeft<=0){stopTurnTimer();autoPlay(cur);}
  },1000);
}
function stopTurnTimer(){if(turnTimerInt){clearInterval(turnTimerInt);turnTimerInt=null;}}
function stopAllTimers(){stopTurnTimer();stopTrumpTimer();}
function updateTimerUI(){
  const arc=document.getElementById('timer-arc');
  const num=document.getElementById('ttimer-num');
  const pct=turnLeft/TURN_SECS;
  arc.style.strokeDasharray=`${CIRC}`;
  arc.style.strokeDashoffset=`${CIRC*(1-pct)}`;
  arc.style.stroke=turnLeft<=5?'#e74c3c':'#c9a84c';
  num.textContent=turnLeft;
  num.style.color=turnLeft<=5?'#e74c3c':'#c9a84c';
}

/* ══════════════════════════
   LEGAL MOVES
══════════════════════════ */
function getTrickBest(){
  const trick=G.trick;if(!trick.length)return null;
  const trump=G.trump,ls=trick[0].card.s;
  let best=trick[0];
  for(let i=1;i<trick.length;i++){
    const t=trick[i],b=best;
    if(t.card.s===trump&&b.card.s!==trump)best=t;
    else if(t.card.s===trump&&b.card.s===trump){if(RV[t.card.r]>RV[b.card.r])best=t;}
    else if(t.card.s===ls&&b.card.s!==trump){if(RV[t.card.r]>RV[b.card.r])best=t;}
  }
  return best;
}
function isTeammate(pos){return TEAMS[pos]===TEAMS[myPos];}

function getLegalMoves(pos){
  const pd=G.players[pos];
  const trick=G.trick;
  const trump=G.trump;

  // FIX 3: All hand cards + all showUp cards available (8 cards total at game start)
  // Revealed hidden cards are also available (provision 1)
  const avail=[];
  pd.hand.forEach((c,i)=>{if(c)avail.push({c,type:'hand',idx:i});});
  pd.showUp.forEach((c,i)=>{if(c)avail.push({c,type:'showUp',idx:i});});
  pd.hidden.forEach((c,i)=>{if(c&&c.flipped)avail.push({c,type:'hidden',idx:i});});

  if(!trick.length){
    // LEAD — any of 8 cards (hand + showUp) freely playable
    return avail.map(a=>({...a,legal:true,free:false}));
  }

  const ls=trick[0].card.s;
  const hasSuit=avail.some(a=>a.c.s===ls);

  if(hasSuit){
    const best=getTrickBest();
    const suitCards=avail.filter(a=>a.c.s===ls);
    const bestRank=best.card.s===ls?RV[best.card.r]:-1;
    const canBeat=suitCards.some(a=>RV[a.c.r]>bestRank);
    if(canBeat){
      return suitCards.filter(a=>RV[a.c.r]>bestRank).map(a=>({...a,legal:true,free:false}));
    }
    return suitCards.map(a=>({...a,legal:true,free:false}));
  }

  // No matching suit
  const best=getTrickBest();
  const teammateWinning=best&&isTeammate(best.pos);
  const hasTrump=avail.some(a=>a.c.s===trump);

  if(teammateWinning){
    // Can play anything freely — teammate is winning
    return avail.map(a=>({...a,legal:true,free:true}));
  }
  if(hasTrump){
    const trumpCards=avail.filter(a=>a.c.s===trump);
    const bestTrumpInTrick=G.trick.filter(t=>t.card.s===trump).reduce((b,t)=>
      (!b||RV[t.card.r]>RV[b.card.r])?t:b,null);
    if(bestTrumpInTrick){
      const higher=trumpCards.filter(a=>RV[a.c.r]>RV[bestTrumpInTrick.card.r]);
      if(higher.length)return higher.map(a=>({...a,legal:true,free:false}));
    }
    return trumpCards.map(a=>({...a,legal:true,free:false}));
  }
  // No trump, no suit — free
  return avail.map(a=>({...a,legal:true,free:true}));
}

/* ══════════════════════════
   CARD DRAWING — real playing-card style
══════════════════════════ */
function drawCard(card){

  const el=document.createElement('div');

  const col=COLOR[card.s]==='red'?'red':'black';

  el.className='card '+col;

  const sym=SYM[card.s];

  // top left
  const tl=document.createElement('div');
  tl.className='c-tl';
  tl.innerHTML=`<b>${card.r}</b><span>${sym}</span>`;

  // bottom right
  const br=document.createElement('div');
  br.className='c-br';
  br.innerHTML=`<b>${card.r}</b><span>${sym}</span>`;

  el.appendChild(tl);

  // CENTER SYMBOL
  const pips=document.createElement('div');
  pips.className='c-pips';

  const row=document.createElement('div');
  row.className='pip-row';

  const pip=document.createElement('span');
  pip.className='pip';

  // bigger suit for face + ace
  if(['J','Q','K','A'].includes(card.r)){
    pip.style.fontSize='28px';
  }else{
    pip.style.fontSize='22px';
  }

  pip.textContent=sym;

  row.appendChild(pip);
  pips.appendChild(row);

  el.appendChild(pips);

  el.appendChild(br);

  return el;
}

/* ══════════════════════════
   RENDERING
══════════════════════════ */
function vp(pos){
  const me=myPos||'south';
  return POSITIONS[(POSITIONS.indexOf(pos)-POSITIONS.indexOf(me)+4)%4];
}

function renderTable(){
  document.getElementById('hud-trump').textContent=G.trump?SYM[G.trump]:'—';
  document.getElementById('hud-A').textContent=G.teamTricks.A;
  document.getElementById('hud-B').textContent=G.teamTricks.B;
  document.getElementById('hud-trick').textContent=G.trickNum;
  const tt=G.trumpTeam;
  document.getElementById('hud-goal').textContent=tt?`Team ${tt}: 8`:'—';
  POSITIONS.forEach(pos=>buildZone(pos));
  renderTrick();
}

function buildZone(aPos){
  const visual=vp(aPos);
  const zone=document.getElementById('zone-'+visual);
  zone.innerHTML='';

  const isActive=G.currentPos===aPos&&G.phase==='play';
  zone.classList.toggle('active-turn',isActive);

  const pd=G.players[aPos];
  const isMe=aPos===myPos;
  const myTurn=isActive&&isMe;

  // Build legalMap only for my turn
  const legalMap={};
  if(myTurn){
    getLegalMoves(aPos).forEach(m=>{
      legalMap[m.type+'_'+m.idx]={legal:m.legal,free:m.free};
    });
  }

  // Name label with arrow
  const lbl=document.createElement('div');lbl.className='pname-label';
  const arrow=document.createElement('span');
  arrow.className='turn-arrow';
  arrow.textContent=ZONE_ARROW[visual];
  lbl.innerHTML=`<div class="pn">${G.seated[aPos]||aPos}${isMe?' ★':''}</div><div class="pt">${pd.tricks} trick${pd.tricks!==1?'s':''}</div>`;
  lbl.appendChild(arrow);

  if(visual==='south'||visual==='north'){
    buildRowZone(zone,aPos,visual,pd,isMe,myTurn,legalMap,lbl);
  } else {
    buildColZone(zone,aPos,visual,pd,isMe,myTurn,legalMap,lbl);
  }
}

function buildRowZone(zone,aPos,vis,pd,isMe,myTurn,lmap,lbl){
  const wrap=document.createElement('div');wrap.className='rows';
  const suRow=mkSURow(aPos,pd,lmap);
  const hdRow=mkHidRow(pd.hidden,aPos,lmap);
  const hRow=mkHandRow(aPos,pd,isMe,lmap);
  if(vis==='south'){
    wrap.appendChild(slbl('hand (private)'));wrap.appendChild(hRow);
    wrap.appendChild(slbl('hidden'));       wrap.appendChild(hdRow);
    wrap.appendChild(slbl('show-up'));      wrap.appendChild(suRow);
    zone.appendChild(wrap);zone.appendChild(lbl);
  } else {
    zone.appendChild(lbl);
    wrap.appendChild(slbl('show-up'));      wrap.appendChild(suRow);
    wrap.appendChild(slbl('hidden'));       wrap.appendChild(hdRow);
    wrap.appendChild(slbl('hand'));         wrap.appendChild(hRow);
    zone.appendChild(wrap);
  }
}
function buildColZone(zone,aPos,vis,pd,isMe,myTurn,lmap,lbl){
  const wrap=document.createElement('div');wrap.className='cols';
  const wsu=cwrap(mkSUCol(aPos,pd,lmap),'show-up');
  const whd=cwrap(mkHidCol(pd.hidden,aPos,lmap),'hidden');
  const wh=cwrap(mkHandCol(aPos,pd,isMe,lmap),'hand');
  if(vis==='west'){
    zone.appendChild(lbl);wrap.appendChild(wsu);wrap.appendChild(whd);wrap.appendChild(wh);
  } else {
    wrap.appendChild(wh);wrap.appendChild(whd);wrap.appendChild(wsu);
    zone.appendChild(wrap);zone.appendChild(lbl);return;
  }
  zone.appendChild(wrap);
}

function slbl(t){const d=document.createElement('div');d.className='slbl';d.textContent=t;return d;}
function cwrap(col,label){
  const w=document.createElement('div');
  w.style.cssText='display:flex;flex-direction:column;align-items:center;gap:2px';
  const l=document.createElement('div');l.className='slbl-v';l.textContent=label;
  w.appendChild(l);w.appendChild(col);return w;
}

function mkSURow(aPos,pd,lmap){
  const row=document.createElement('div');row.className='row';
  pd.showUp.forEach((c,i)=>row.appendChild(c?mkC(c,aPos,'showUp',i,lmap):mkEmpty()));
  return row;
}
function mkSUCol(aPos,pd,lmap){
  const col=document.createElement('div');col.className='col';
  pd.showUp.forEach((c,i)=>col.appendChild(c?mkC(c,aPos,'showUp',i,lmap):mkEmpty()));
  return col;
}
function mkHidRow(hidden,aPos,lmap){
  const row=document.createElement('div');row.className='row';
  hidden.forEach((c,i)=>{
    if(!c){row.appendChild(mkEmpty());return;}
    if(!c.flipped){row.appendChild(mkHidCard());}
    else row.appendChild(mkC(c,aPos,'hidden',i,lmap));
  });
  return row;
}
function mkHidCol(hidden,aPos,lmap){
  const col=document.createElement('div');col.className='col';
  hidden.forEach((c,i)=>{
    if(!c){col.appendChild(mkEmpty());return;}
    if(!c.flipped){col.appendChild(mkHidCard());}
    else col.appendChild(mkC(c,aPos,'hidden',i,lmap));
  });
  return col;
}
function mkHandRow(aPos,pd,isMe,lmap){
  const row=document.createElement('div');row.className='row';
  pd.hand.forEach((c,i)=>row.appendChild(isMe?mkC(c,aPos,'hand',i,lmap):mkBackCard()));
  return row;
}
function mkHandCol(aPos,pd,isMe,lmap){
  const col=document.createElement('div');col.className='col';
  pd.hand.forEach((c,i)=>col.appendChild(isMe?mkC(c,aPos,'hand',i,lmap):mkBackCard()));
  return col;
}

function mkC(card,aPos,type,idx,lmap){
  const el=drawCard(card);
  if(G.trump&&card.s===G.trump)el.classList.add('is-trump');
  if(type==='trick'){el.classList.add('in-trick');return el;}
  if(lmap){
    const mv=lmap[type+'_'+idx];
    if(mv&&mv.legal){
      el.classList.add(mv.free?'free-choice':'playable');
      el.onclick=()=>playCard(aPos,type,idx);
    }
  }
  return el;
}
function mkBackCard(){const e=document.createElement('div');e.className='card-back';return e;}
function mkHidCard(){const e=document.createElement('div');e.className='card-hidden';e.textContent='?';return e;}
function mkEmpty(){const e=document.createElement('div');e.className='slot-empty';return e;}

function renderTrick(){
  const map={south:'ts-south',north:'ts-north',west:'ts-west',east:'ts-east'};
  POSITIONS.forEach(pos=>{
    const slot=document.getElementById(map[vp(pos)]);
    slot.innerHTML='';
    const played=G.trick.find(t=>t.pos===pos);
    if(played){
      const el=mkC(played.card,null,'trick',0,null);
      slot.appendChild(el);
    }
  });
}

/* ══════════════════════════
   PLAY
══════════════════════════ */
function playCard(pos,type,idx){
  if(G.currentPos!==pos||G.phase!=='play')return;

  // Validate legal
  const moves=getLegalMoves(pos);
  const valid=moves.find(m=>m.type===type&&m.idx===idx&&m.legal);
  if(!valid){addLog('Not a legal play.');return;}

  stopTurnTimer();
  const pd=G.players[pos];
  let card=null;

  if(type==='hand'){
    card=pd.hand[idx];pd.hand.splice(idx,1);
  } else if(type==='showUp'){
    card=pd.showUp[idx];pd.showUp[idx]=null;
    if(pd.hidden[idx]&&!pd.hidden[idx].flipped){
      pd.hidden[idx].flipped=true;
      addLog(`${G.seated[pos]}'s hidden card revealed!`);
    }
  } else if(type==='hidden'){
    card=pd.hidden[idx];pd.hidden[idx]=null;
  }
  if(!card)return;

  G.trick.push({pos,card});
  addLog(`${G.seated[pos]} plays ${card.r}${SYM[card.s]}`);
  renderTrick();

  if(G.trick.length===4){
    // Show all 4 cards for 900ms then resolve
    setTimeout(()=>{
      resolveTrick();
      bcast({t:'syn',G});
      if(G.phase==='play'){renderTable();startTurnTimer();botPlayCheck();}
      else if(G.phase==='end'){bcast({t:'syn',G});showResult();}
    },900);
  } else {
    G.currentPos=CW_NEXT[pos];
    bcast({t:'syn',G});
    renderTable();
    startTurnTimer();
    botPlayCheck();
  }
}

function resolveTrick(){
  const trick=G.trick,trump=G.trump,ls=trick[0].card.s;
  let best=trick[0];
  for(let i=1;i<trick.length;i++){
    const t=trick[i],b=best;
    if(t.card.s===trump&&b.card.s!==trump)best=t;
    else if(t.card.s===trump&&b.card.s===trump){if(RV[t.card.r]>RV[b.card.r])best=t;}
    else if(t.card.s===ls&&b.card.s!==trump){if(RV[t.card.r]>RV[b.card.r])best=t;}
  }
  const wp=best.pos;
  G.players[wp].tricks++;G.teamTricks[TEAMS[wp]]++;
  const wname=G.seated[wp]||wp;
  addLog(`${wname} wins trick ${G.trickNum}!`,true);
  flashWin(wname);
  G.trick=[];G.trickNum++;G.leadPos=wp;G.currentPos=wp;
  const tt=G.trumpTeam,dt=tt==='A'?'B':'A';
  if(G.teamTricks[tt]>=8){G.phase='end';G.winner=tt;G.winReason='reached 8 tricks';}
  else if(G.teamTricks[dt]>=5){G.phase='end';G.winner=dt;G.winReason='defended with 5 tricks';}
}
function flashWin(name){
  const el=document.getElementById('trick-flash');
  el.textContent=name+' wins!';el.style.opacity='1';
  setTimeout(()=>{el.style.opacity='0';},750);
}

/* ══════════════════════════
   BOT
══════════════════════════ */
function botPlayCheck(){
  if(G.phase!=='play')return;
  const cur=G.currentPos;if(cur===myPos)return;
  setTimeout(()=>{
    if(G.phase==='play'&&G.currentPos===cur)autoPlay(cur);
  },1000+Math.random()*700);
}
function autoPlay(pos){
  if(G.phase!=='play'||G.currentPos!==pos)return;
  const moves=getLegalMoves(pos);if(!moves.length)return;
  const mand=moves.filter(m=>!m.free);
  const pool=mand.length?mand:moves;
  pool.sort((a,b)=>RV[a.c.r]-RV[b.c.r]);
  const pick=pool[0];
  playCard(pos,pick.type,pick.idx);
}

/* ══════════════════════════
   RESULT
════════════════════════== */
function showResult(){
  stopAllTimers();showScreen('screen-result');
  const w=G.winner;
  const names=POSITIONS.filter(p=>TEAMS[p]===w).map(p=>G.seated[p]||p).join(' & ');
  document.getElementById('r-title').textContent=`Team ${w} Wins!`;
  document.getElementById('r-detail').innerHTML=
    `<b>${names}</b><br>${G.winReason}<br><br>Team A: ${G.teamTricks.A} | Team B: ${G.teamTricks.B}`;
}

/* ══════════════════════════
   HELPERS
══════════════════════════ */
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active');}
function showPanel(id){['panel-main','panel-create','panel-join'].forEach(p=>document.getElementById(p).classList.add('hidden'));document.getElementById(id).classList.remove('hidden');}
function backMain(){showPanel('panel-main');}
function addLog(txt,win=false){
  const log=document.getElementById('game-log');
  const p=document.createElement('p');p.textContent=txt;
  if(win)p.classList.add('win');
  log.appendChild(p);log.scrollTop=log.scrollHeight;
}
document.getElementById('inp-name').addEventListener('keydown',e=>{if(e.key==='Enter')createRoom();});
document.getElementById('inp-code').addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom();});
document.getElementById('inp-code').addEventListener('input',  e=>{e.target.value=e.target.value.toUpperCase();});
