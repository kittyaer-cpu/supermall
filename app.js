import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const WIN_MONEY = 30000;
const START_MONEY = 8000;
const PASS_HQ_BONUS = 3000;
const BUILD_COST = 2000;
const UPGRADE_COST = 3500;
const AVATARS = ['🎀','💙','💚','💛'];
const COLORS = ['#ff7ebd','#64a7ff','#50c878','#f4c430'];
const PRODUCTS = { fruit:'🍎水果', coffee:'☕咖啡', fashion:'👕服飾', daily:'🧻日用品', electric:'🔌電器' };

const board = [
 {id:0,type:'hq',name:'總部',icon:'🏢'},
 {id:1,type:'land',name:'水果專區',product:'fruit',price:1200},
 {id:2,type:'land',name:'咖啡專區',product:'coffee',price:1200},
 {id:3,type:'customer',name:'顧客區',icon:'🛍️'},
 {id:4,type:'land',name:'服飾專區',product:'fashion',price:1400},
 {id:5,type:'land',name:'日用品區',product:'daily',price:1400},
 {id:6,type:'strategy',name:'營運計畫',icon:'💡'},
 {id:7,type:'land',name:'電器專區',product:'electric',price:1600},
 {id:8,type:'hq',name:'總部',icon:'🏢'},
 {id:9,type:'land',name:'咖啡街',product:'coffee',price:1600},
 {id:10,type:'land',name:'水果街',product:'fruit',price:1800},
 {id:11,type:'customer',name:'顧客區',icon:'🛍️'},
 {id:12,type:'land',name:'服飾街',product:'fashion',price:1800},
 {id:13,type:'land',name:'電器街',product:'electric',price:2000},
 {id:14,type:'strategy',name:'營運計畫',icon:'💡'},
 {id:15,type:'land',name:'日用品街',product:'daily',price:2000},
 {id:16,type:'hq',name:'總部',icon:'🏢'},
 {id:17,type:'land',name:'水果廣場',product:'fruit',price:2200},
 {id:18,type:'land',name:'咖啡廣場',product:'coffee',price:2200},
 {id:19,type:'customer',name:'顧客區',icon:'🛍️'},
 {id:20,type:'land',name:'服飾廣場',product:'fashion',price:2400},
 {id:21,type:'land',name:'日用品廣場',product:'daily',price:2400},
 {id:22,type:'strategy',name:'營運計畫',icon:'💡'},
 {id:23,type:'land',name:'電器廣場',product:'electric',price:2600},
 {id:24,type:'hq',name:'總部',icon:'🏢'},
 {id:25,type:'land',name:'咖啡百貨',product:'coffee',price:2600},
 {id:26,type:'land',name:'水果百貨',product:'fruit',price:2800},
 {id:27,type:'customer',name:'顧客區',icon:'🛍️'},
 {id:28,type:'land',name:'服飾百貨',product:'fashion',price:2800},
 {id:29,type:'land',name:'電器百貨',product:'electric',price:3000},
 {id:30,type:'strategy',name:'營運計畫',icon:'💡'},
 {id:31,type:'land',name:'日用品百貨',product:'daily',price:3000}
];

const customers = [
 {name:'家庭採買日', product:'daily', amount:1200}, {name:'上班族咖啡潮', product:'coffee', amount:1000},
 {name:'水果禮盒熱賣', product:'fruit', amount:1300}, {name:'換季穿搭', product:'fashion', amount:1500},
 {name:'家電升級客', product:'electric', amount:1800}, {name:'百貨週年慶', product:'any', amount:1000},
 {name:'VIP大採購', product:'any', amount:1600}, {name:'親子購物團', product:'daily', amount:1400},
 {name:'下午茶人潮', product:'coffee', amount:1100}, {name:'新鮮市集', product:'fruit', amount:1200}
];
const strategies = [
 {name:'總部補助', text:'獲得 2000 元', effect:'money', amount:2000},
 {name:'行銷成功', text:'獲得 1500 元', effect:'money', amount:1500},
 {name:'臨時支援', text:'獲得 1000 元', effect:'money', amount:1000},
 {name:'裝潢支出', text:'支付 1000 元', effect:'money', amount:-1000},
 {name:'百貨活動', text:'所有玩家獲得 500 元', effect:'allMoney', amount:500},
 {name:'店鋪搬遷', text:'本回合可免費建店一次', effect:'freeBuild', amount:1}
];

let roomId = null, unsub = null, state = null, acted = false;
const myId = localStorage.supermallPlayerId || (localStorage.supermallPlayerId = crypto.randomUUID());
const $ = id => document.getElementById(id);

$('playerName').value = localStorage.supermallName || '';
$('createRoomBtn').onclick = createRoom;
$('joinRoomBtn').onclick = joinRoom;
$('startBtn').onclick = startGame;
$('rollBtn').onclick = rollDice;
$('buildBtn').onclick = buildHere;
$('endBtn').onclick = endTurn;
$('soundBtn').onclick = toggleSound;
$('rulesBtn').onclick = () => showModal('<h2>遊戲規則</h2><p>擲骰移動，停在土地可建店。相鄰自己的店可升級成百貨商場。經過總部領 3000 元，現金達 30000 元獲勝。</p>');
$('closeModal').onclick = () => $('modal').close();

function playerName(){ const n = $('playerName').value.trim() || '玩家'; localStorage.supermallName = n; return n; }
function code(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }
function roomRef(){ return doc(db,'rooms',roomId); }
function log(msg){ return [`${new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}｜${msg}`,...(state?.logs||[])].slice(0,40); }
function showGame(){ $('home').classList.remove('active'); $('game').classList.add('active'); $('roomCodeText').textContent = `房號：${roomId}`; }
function showModal(html){ $('modalContent').innerHTML = html; $('modal').showModal(); }

async function createRoom(){
 roomId = code();
 const p = makePlayer(myId, playerName(), 0, false);
 state = { createdAt:serverTimestamp(), hostId:myId, started:false, winner:null, currentTurn:0, turnOrder:[myId], players:{[myId]:p}, buildings:{}, logs:[`房間 ${roomId} 已建立`] };
 await setDoc(roomRef(), state); subscribe(); showGame();
}
async function joinRoom(){
 roomId = $('roomCodeInput').value.trim().toUpperCase(); if(!roomId) return;
 const snap = await getDoc(roomRef()); if(!snap.exists()) return alert('找不到房間');
 const s = snap.data(); const count = Object.keys(s.players||{}).filter(id=>!s.players[id].isAI).length;
 if(!s.players[myId] && Object.keys(s.players||{}).length >= 4) return alert('房間已滿');
 const idx = Object.keys(s.players||{}).length;
 s.players[myId] = s.players[myId] || makePlayer(myId, playerName(), idx, false);
 if(!s.turnOrder.includes(myId)) s.turnOrder.push(myId);
 s.logs = [`${playerName()} 加入房間`, ...(s.logs||[])].slice(0,40);
 await updateDoc(roomRef(), {players:s.players, turnOrder:s.turnOrder, logs:s.logs}); subscribe(); showGame();
}
function makePlayer(id,name,idx,isAI){ return {id,name,avatar:AVATARS[idx]||'🛒',color:COLORS[idx]||'#999',money:START_MONEY,pos:0,isAI,freeBuild:0}; }
function subscribe(){ if(unsub) unsub(); unsub = onSnapshot(roomRef(), snap => { state = snap.data(); render(); if(isAITurn()) setTimeout(aiPlay, 900); }); }

async function startGame(){
 if(!state || state.hostId !== myId) return alert('只有房主可以開始');
 const players = {...state.players}; const order = [...state.turnOrder];
 while(order.length < 4){ const id='AI_'+order.length; players[id]=makePlayer(id, ['兔兔店長','熊熊店長','狐狸店長','貓貓店長'][order.length], order.length, true); order.push(id); }
 await updateDoc(roomRef(), {players, turnOrder:order, started:true, currentTurn:0, logs:log('遊戲開始，AI已補位')});
}

function currentId(){ return state?.turnOrder?.[state.currentTurn]; }
function isMyTurn(){ return currentId() === myId && state?.started && !state?.winner; }
function isAITurn(){ const p = state?.players?.[currentId()]; return p?.isAI && state.started && !state.winner; }

async function rollDice(){ if(!isMyTurn() || acted) return; acted = true; await takeTurn(myId, Math.floor(Math.random()*6)+1, false); }
async function takeTurn(pid,dice,autoEnd){
 const s = structuredClone(state); const p = s.players[pid]; const old = p.pos; p.pos = (p.pos + dice) % 32;
 if(old + dice >= 32 || board[p.pos].type === 'hq'){ p.money += PASS_HQ_BONUS; s.logs = [`${p.name} 經過/抵達總部，領 ${PASS_HQ_BONUS}`, ...(s.logs||[])]; }
 s.logs = [`${p.name} 擲出 ${dice}，移動到 ${board[p.pos].name}`, ...(s.logs||[])];
 resolveCell(s,p);
 if(p.money >= WIN_MONEY) { s.winner = pid; s.logs = [`🏆 ${p.name} 達成 ${WIN_MONEY} 元，獲勝！`, ...s.logs]; }
 await updateDoc(roomRef(), {players:s.players, buildings:s.buildings, logs:s.logs.slice(0,40), winner:s.winner||null});
 $('dice').textContent = dice; $('dice').classList.add('roll'); setTimeout(()=>$('dice').classList.remove('roll'),300);
 if(autoEnd && !s.winner) setTimeout(endTurn, 700);
}
function resolveCell(s,p){
 const cell = board[p.pos];
 if(cell.type==='customer') customerEvent(s,p);
 if(cell.type==='strategy') strategyEvent(s,p);
 if(cell.type==='land' && s.buildings[p.pos] && s.buildings[p.pos].owner !== p.id){
   const b=s.buildings[p.pos], owner=s.players[b.owner], rent=b.level==='mall'?1800:900; p.money-=rent; owner.money+=rent; s.logs=[`${p.name} 到訪 ${owner.name} 的${b.level==='mall'?'商場':'店鋪'}，支付 ${rent}`,...s.logs];
 }
}
function customerEvent(s,p){ const c=customers[Math.floor(Math.random()*customers.length)]; const owned=Object.entries(s.buildings).filter(([i,b])=>b.owner===p.id && (c.product==='any'||board[+i].product===c.product)); if(owned.length){p.money+=c.amount; s.logs=[`🛍️ ${c.name} 消費成功，${p.name} 收入 ${c.amount}`,...s.logs];} else s.logs=[`🛍️ ${c.name} 出現，但沒有符合店鋪`,...s.logs]; }
function strategyEvent(s,p){ const c=strategies[Math.floor(Math.random()*strategies.length)]; if(c.effect==='money') p.money+=c.amount; if(c.effect==='allMoney') Object.values(s.players).forEach(x=>x.money+=c.amount); if(c.effect==='freeBuild') p.freeBuild=(p.freeBuild||0)+1; s.logs=[`💡 ${p.name} 抽到「${c.name}」：${c.text}`,...s.logs]; }

async function buildHere(){ if(!isMyTurn()) return; const s=structuredClone(state), p=s.players[myId], cell=board[p.pos]; if(cell.type!=='land') return alert('這格不能建店');
 const has=s.buildings[p.pos]; if(has && has.owner!==myId) return alert('這裡是別人的店');
 if(!has){ const cost=p.freeBuild>0?0:BUILD_COST; if(p.money<cost) return alert('現金不足'); p.money-=cost; if(p.freeBuild>0)p.freeBuild--; s.buildings[p.pos]={owner:myId,level:'shop'}; s.logs=[`${p.name} 在 ${cell.name} 建立店鋪 ${cost?`花費 ${cost}`:'免費'}`,...s.logs]; }
 else { if(has.level==='mall') return alert('已經是商場'); if(p.money<UPGRADE_COST) return alert('現金不足'); p.money-=UPGRADE_COST; has.level='mall'; s.logs=[`${p.name} 將 ${cell.name} 升級為百貨商場 🏢`,...s.logs]; }
 mergeAdjacent(s,myId);
 if(p.money>=WIN_MONEY){s.winner=myId;s.logs=[`🏆 ${p.name} 達成 ${WIN_MONEY} 元，獲勝！`,...s.logs];}
 await updateDoc(roomRef(), {players:s.players, buildings:s.buildings, logs:s.logs.slice(0,40), winner:s.winner||null});
}
function mergeAdjacent(s,pid){ for(const k of Object.keys(s.buildings)){ const i=+k,b=s.buildings[i]; if(b.owner!==pid||b.level==='mall') continue; for(const n of [(i+31)%32,(i+1)%32]){ if(s.buildings[n]?.owner===pid && s.buildings[n].level==='shop'){ b.level='mall'; s.logs=[`相鄰店鋪形成商圈，${board[i].name} 升級成商場 🏢`,...s.logs]; return; } } } }
async function endTurn(){ if(!state || (currentId()!==myId && !state.players[currentId()]?.isAI)) return; acted=false; await updateDoc(roomRef(), {currentTurn:(state.currentTurn+1)%state.turnOrder.length}); }
async function aiPlay(){ if(!isAITurn()) return; const id=currentId(); await takeTurn(id, Math.floor(Math.random()*6)+1, false); const s=structuredClone(state); const p=s.players[id], cell=board[p.pos]; if(cell.type==='land' && !s.buildings[p.pos] && p.money>BUILD_COST+1000){ s.buildings[p.pos]={owner:id,level:'shop'}; p.money-=BUILD_COST; s.logs=[`${p.name} 自動建店，花費 ${BUILD_COST}`,...s.logs]; await updateDoc(roomRef(), {players:s.players, buildings:s.buildings, logs:s.logs.slice(0,40)}); } setTimeout(endTurn,900); }

function render(){ if(!state) return; renderPlayers(); renderBoard(); const cur=state.players[currentId()]; $('turnText').textContent = state.winner ? `🏆 ${state.players[state.winner].name} 獲勝！` : state.started ? `目前回合：${cur?.avatar||''} ${cur?.name||''}` : '等待房主開始遊戲'; $('startBtn').style.display = state.started ? 'none':'block'; $('rollBtn').disabled = !isMyTurn() || acted; $('buildBtn').disabled = !isMyTurn(); $('endBtn').disabled = !isMyTurn(); $('logPanel').innerHTML=(state.logs||[]).map(x=>`<div class="log">${x}</div>`).join(''); }
function renderPlayers(){ $('playersPanel').innerHTML = (state.turnOrder||[]).map(id=>{ const p=state.players[id]; return `<div class="player ${id===currentId()?'active':''}"><div class="avatar">${p.avatar}</div><b>${p.name}${p.isAI?' AI':''}</b><div class="money">$${p.money}</div><small>位置 ${p.pos}</small></div>` }).join(''); }
function renderBoard(){ const map = new Map(); const coords=[]; for(let c=0;c<9;c++) coords.push([0,c]); for(let r=1;r<9;r++) coords.push([r,8]); for(let c=7;c>=0;c--) coords.push([8,c]); for(let r=7;r>=1;r--) coords.push([r,0]); coords.forEach((xy,i)=>map.set(`${xy[0]},${xy[1]}`, i)); let html=''; for(let r=0;r<9;r++) for(let c=0;c<9;c++){ const idx=map.get(`${r},${c}`); if(idx===undefined){ html+='<div class="cell empty"></div>'; continue; } const cell=board[idx], b=state.buildings?.[idx], ps=Object.values(state.players||{}).filter(p=>p.pos===idx); html+=`<div class="cell ${cell.type}"><div class="idx">${idx}</div><div class="type">${cell.icon||PRODUCTS[cell.product]?.split('')[0]||'🛒'}</div><div class="name">${cell.name}</div>${b?`<div class="shop" title="${state.players[b.owner]?.name}">${b.level==='mall'?'🏢':'🏪'}</div>`:''}<div class="tokens">${ps.map(p=>`<span class="token" style="border-color:${p.color}">${p.avatar}</span>`).join('')}</div></div>`; } $('board').innerHTML=html; }
let audioOn=false, ctx=null, timer=null; function toggleSound(){ audioOn=!audioOn; $('soundBtn').textContent=audioOn?'🔊':'🎵'; if(audioOn) startMusic(); else stopMusic(); }
function startMusic(){ ctx=ctx||new AudioContext(); let notes=[523,659,784,659], i=0; timer=setInterval(()=>{ const o=ctx.createOscillator(), g=ctx.createGain(); o.frequency.value=notes[i++%notes.length]; g.gain.value=.025; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime+.18); },520); }
function stopMusic(){ if(timer) clearInterval(timer); timer=null; }
