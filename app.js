import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const $ = id => document.getElementById(id);
let roomId = '', myId = localStorage.mallPlayerId || crypto.randomUUID();
localStorage.mallPlayerId = myId;
let state = null;

const boardPath = [
  [8,8],[7,8],[6,8],[5,8],[4,8],[3,8],[2,8],[1,8],
  [0,8],[0,7],[0,6],[0,5],[0,4],[0,3],[0,2],[0,1],
  [0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],
  [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,6],[8,7]
];
const products=['水果','咖啡','服飾','日用品','電器'];
const tiles = Array.from({length:32},(_,i)=>({
  id:i, type:i%8===0?'hq':(i%7===0?'plan':(i%5===0?'customer':'land')),
  name:i===0?'總部/起點':i%8===0?'總部':i%7===0?'營運計畫':i%5===0?'顧客':`土地${i}`,
  product:products[i%5], price: [3500,4000,4500,5000,5500,3000,3600,4200][i%8]
}));
const planCards=[
 '新店開幕優惠：下次建店後可立即從任意顧客卡消費。','帶風向抵制對手：停留他人店鋪或商場時可付2000元且不翻顧客卡。','股東換我當：停留他人店鋪時可付3500元把店鋪換成自己的。','製造公關危機：停留他人總部，拿2000元再玩一回合。','業務員績效獎金：每次抽業務員卡時獲得800元。','深入社區認識消費者：不擲骰，付2000元走2步。','推出聯名商品：自己店鋪或商場翻開顧客卡，額外收1500元。','邀請網紅開箱：抽2張顧客卡。','培養品牌鐵粉：抽2張顧客卡。','獲得商業情報：奪取他人一張營運計畫卡。'
];
const customerCards=['水果客人消費','咖啡客人消費','服飾客人消費','日用品客人消費','電器客人消費'];

function newRoom(name){return {createdAt:serverTimestamp(),status:'waiting',turn:0,winner:null,logs:['房間建立成功'],players:[newPlayer(name)]};}
function newPlayer(name){return {id:myId,name:name||'玩家',money:3000,pos:0,shops:[],malls:[],plans:[],online:true};}
function code(){return Math.random().toString(36).slice(2,8).toUpperCase();}
async function save(patch){await updateDoc(doc(db,'mallRooms',roomId),patch);}
function me(){return state?.players.find(p=>p.id===myId)}
function myIndex(){return state?.players.findIndex(p=>p.id===myId)}
function current(){return state?.players[state.turn%state.players.length]}
function log(msg){return [msg,...(state.logs||[])].slice(0,40)}

$('createRoom').onclick=async()=>{roomId=code(); await setDoc(doc(db,'mallRooms',roomId),newRoom($('playerName').value)); enter();};
$('joinRoom').onclick=async()=>{roomId=$('roomCodeInput').value.trim().toUpperCase(); const ref=doc(db,'mallRooms',roomId); const snap=await getDoc(ref); if(!snap.exists())return alert('找不到房間'); const s=snap.data(); if(s.players.length>=4 && !s.players.some(p=>p.id===myId))return alert('房間已滿'); if(!s.players.some(p=>p.id===myId)){s.players.push(newPlayer($('playerName').value)); await updateDoc(ref,{players:s.players,logs:[`${$('playerName').value||'玩家'} 加入房間`,...(s.logs||[])]});} enter();};
function enter(){ $('lobby').classList.add('hidden'); $('game').classList.remove('hidden'); $('roomCode').textContent=roomId; onSnapshot(doc(db,'mallRooms',roomId),snap=>{state=snap.data(); render();});}
$('startGame').onclick=()=>save({status:'playing',logs:log('遊戲開始！')});
$('rollDice').onclick=async()=>{if(!state||current().id!==myId)return; const n=Math.ceil(Math.random()*6); const players=structuredClone(state.players); const p=players[myIndex()]; p.pos=(p.pos+n)%32; if(p.pos<n) p.money+=3000; const t=tiles[p.pos]; let msg=`${p.name} 擲出 ${n}，停在 ${t.name}`;
 if(t.type==='hq'){p.money+=3000; msg+='，領取3000元';}
 if(t.type==='plan'){const c=planCards[Math.floor(Math.random()*planCards.length)]; p.plans.push(c); msg+=`，獲得營運計畫：${c}`;}
 if(t.type==='customer'){msg+=`，翻開顧客卡：${customerCards[Math.floor(Math.random()*customerCards.length)]}`;}
 await save({players,turn:(state.turn+1)%players.length,logs:log(msg),winner:p.money>=30000?p.name:null});};
async function buyShop(){const idx=myIndex(), players=structuredClone(state.players), p=players[idx], t=tiles[p.pos]; if(p.money<t.price)return alert('現金不足'); p.money-=t.price; p.shops.push(p.pos); await save({players,logs:log(`${p.name} 在 ${t.name} 建立店鋪，支付 ${t.price} 元`),winner:p.money>=30000?p.name:null});}
function render(){if(!state)return; $('turnName').textContent=state.winner?`🏆 ${state.winner} 獲勝`:current()?.name||'--'; $('startGame').style.display=state.status==='waiting'?'block':'none'; $('rollDice').disabled=state.status!=='playing'||current()?.id!==myId||state.winner; renderBoard(); renderPlayers(); renderActions(); $('log').innerHTML=(state.logs||[]).map(x=>`<div>・${x}</div>`).join('');}
function renderBoard(){const b=$('board'); b.innerHTML=''; for(let y=0;y<9;y++)for(let x=0;x<9;x++){const cell=document.createElement('div'); const i=boardPath.findIndex(([cx,cy])=>cx===x&&cy===y); if(i<0){cell.className='empty';}else{const t=tiles[i]; cell.className=`tile ${t.type}`; cell.innerHTML=`<b>${t.name}</b>${t.type==='land'?`<span>${t.product}</span><span class="price">${t.price}</span>`:''}`; (state.players||[]).forEach((p,pi)=>{if(p.pos===i)cell.innerHTML+=`<span class="token p${pi}"></span>`});} b.appendChild(cell);}}
function renderPlayers(){ $('players').innerHTML=(state.players||[]).map((p,i)=>`<div class="player ${i===state.turn?'active':''}"><b>${p.name}</b><br>現金：${p.money} 元<br>店鋪：${p.shops.length}｜商場：${p.malls.length}｜卡：${p.plans.length}</div>`).join('');}
function renderActions(){const p=me(), t=p&&tiles[p.pos]; let html=''; if(state.status==='playing'&&current()?.id===myId&&t?.type==='land'&&!p.shops.includes(p.pos)) html=`<button class="actionBtn" id="buyShop">建設店鋪 ${t.price}元</button>`; $('actions').innerHTML=html; const btn=$('buyShop'); if(btn)btn.onclick=buyShop;}
