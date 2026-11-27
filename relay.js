'use strict';
// Private-room WebSocket relay. This is a presence/position prototype, not an authoritative game server.
const http=require('node:http');
const crypto=require('node:crypto');
const fs=require('node:fs'),path=require('node:path');
const {WebSocketServer,WebSocket}=require('ws');
const PORT=Number(process.env.PORT||8080),MAX_PLAYERS=4,MAX_MESSAGE=524288;
const rooms=new Map(),clients=new Map(),tradeReceipts=new Map();
const RECEIPT_TTL=7*24*60*60*1000;
const STORAGE_FILE=process.env.DCK_STORAGE_FILE?path.resolve(process.env.DCK_STORAGE_FILE):null;
const RESTART_TTL=24*60*60*1000;
let dirty=false,storageError=null;
function persistNow(){
 if(!STORAGE_FILE)return true;
 try{
 const data={version:1,rooms:[...rooms.values()].map(r=>({code:r.code,host:r.host,revision:r.revision,world:r.world,players:[...r.players].map(([id,p])=>[id,{name:p.name,token:p.token,state:p.state,expires:p.ws?Date.now()+RESTART_TTL:p.expires}]),trades:[...(r.trades||new Map()).values()]})),receipts:[...tradeReceipts].map(([id,r])=>[id,{expires:r.expires,results:[...r.results]}])};
 fs.mkdirSync(path.dirname(STORAGE_FILE),{recursive:true,mode:0o700});
 const tmp=STORAGE_FILE+'.tmp';const fd=fs.openSync(tmp,'w',0o600);
 try{fs.writeFileSync(fd,JSON.stringify(data));fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
 fs.renameSync(tmp,STORAGE_FILE);const dir=fs.openSync(path.dirname(STORAGE_FILE),'r');try{fs.fsyncSync(dir)}finally{fs.closeSync(dir)}
 dirty=false;storageError=null;return true
 }catch(e){storageError=String(e.message);console.error('DCK storage write failed:',storageError);return false}
}
function restoreStorage(){
 if(!STORAGE_FILE||!fs.existsSync(STORAGE_FILE))return;
 const data=JSON.parse(fs.readFileSync(STORAGE_FILE,'utf8'));if(data.version!==1||!Array.isArray(data.rooms)||!Array.isArray(data.receipts))throw Error('Unsupported relay storage format');
 const now=Date.now();
 for(const [id,r] of data.receipts)if(r.expires>now)tradeReceipts.set(id,{expires:r.expires,results:new Map(r.results)});
 for(const row of data.rooms){
 const players=new Map(row.players.filter(([,p])=>p.expires>now).map(([id,p])=>[id,{...p,ws:null}]));
 // Cancel unfinished reservations on restart; retain completed receipts unchanged.
 for(const t of row.trades||[]){const results=new Map();for(const who of [t.a,t.b])if(t.tokens?.[who])results.set(t.tokens[who],{type:'trade_end',id:t.id,ok:false});if(results.size&&!tradeReceipts.has(t.id))tradeReceipts.set(t.id,{results,expires:now+RECEIPT_TTL})}
 if(players.has(row.host))rooms.set(row.code,{code:row.code,host:row.host,revision:row.revision,world:row.world,players,trades:new Map()});
 }
 if(!persistNow())throw Error('Unable to persist restored relay state');
}
restoreStorage();
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function code(){let s='';for(let i=0;i<6;i++)s+=alphabet[crypto.randomInt(alphabet.length)];return s}
function send(ws,data){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data))}
function publicPlayers(room){const out={};for(const [id,p] of room.players)if(p.ws?.readyState===WebSocket.OPEN)out[id]=p.state;return out}
function broadcast(room,data,except){for(const [id,p] of room.players){if(id!==except)send(p.ws,data)}}
const RESUME_TTL=120000;
function suspend(ws){const c=clients.get(ws),room=rooms.get(c?.room),p=room?.players.get(c?.id);if(!p||p.ws!==ws)return;for(const t of room.trades?.values()||[])if(t.a===c.id||t.b===c.id)cancelTrade(room,t);p.ws=null;p.expires=Date.now()+RESUME_TTL;dirty=true;persistNow();broadcast(room,{type:'player_left',id:c.id});broadcast(room,{type:'room_update',players:publicPlayers(room)});if(room.host===c.id)broadcast(room,{type:'host_paused'});}
function leave(ws){const c=clients.get(ws);if(!c||!c.room)return;const room=rooms.get(c.room);if(room){for(const t of room.trades?.values()||[])if(t.a===c.id||t.b===c.id)cancelTrade(room,t);room.players.delete(c.id);if(room.host===c.id){room.host=room.players.keys().next().value;broadcast(room,{type:'host_changed',host:room.host})}broadcast(room,{type:'player_left',id:c.id});broadcast(room,{type:'room_update',players:publicPlayers(room)});if(!room.players.size)rooms.delete(room.code)}c.room=null;dirty=true;persistNow()}
const server=http.createServer((req,res)=>{if(req.url==='/health'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({ok:!storageError,persistent:!!STORAGE_FILE,service:'dck-private-relay',rooms:rooms.size,clients:clients.size}))}res.writeHead(200,{'content-type':'text/plain'});res.end('Dungeon Crawler Kyle private relay is running.\n')});
const wss=new WebSocketServer({server,maxPayload:MAX_MESSAGE});
wss.on('connection',(ws,req)=>{
 const allowedOrigin=process.env.ALLOWED_ORIGIN;if(allowedOrigin&&req.headers.origin!==allowedOrigin){ws.close(1008,'Origin not allowed');return}
 let id=crypto.randomUUID();const client={id,ws,room:null,name:'Crawler',windowStart:Date.now(),messages:0};clients.set(ws,client);ws.isAlive=true;ws.on('pong',()=>{ws.isAlive=true});send(ws,{type:'hello',id});
 ws.on('message',raw=>{
  if(raw.length>MAX_MESSAGE)return ws.close(1009,'Message too large');
  const now=Date.now();if(now-client.windowStart>1000){client.windowStart=now;client.messages=0}if(++client.messages>30)return ws.close(1008,'Rate limit');
  let m;try{m=JSON.parse(raw.toString())}catch{return send(ws,{type:'error',message:'Invalid message.'})}
  if(!m||typeof m!=='object'||Array.isArray(m))return;
  if(raw.length>8192&&m.type!=='world_snapshot')return ws.close(1009,'Message too large');
  if(m.type==='trade_recover'){const receipt=tradeReceipts.get(m.id);const token=String(m.token||'');if(receipt&&/^[a-f0-9]{32}$/.test(token)&&receipt.results.has(token)){send(ws,receipt.results.get(token));return}send(ws,{type:'trade_recovery_unknown',id:String(m.id||'').slice(0,36)});return}
  if(m.type==='resume_room'){const room=rooms.get(String(m.code||''));const token=String(m.token||'');const found=room&&/^[a-f0-9]{64}$/.test(token)&&[...room.players].find(([key,p])=>p.token===token&&!p.ws&&p.expires>Date.now());if(!found)return send(ws,{type:'resume_failed'});leave(ws);id=client.id=found[0];const p=found[1];p.ws=ws;p.expires=0;client.room=room.code;client.name=p.name;send(ws,{type:'hello',id});send(ws,{type:'room_joined',code:room.code,host:room.host,players:publicPlayers(room),resumeToken:p.token,resumed:true});if(room.world)send(ws,{type:'world_snapshot',revision:room.revision,world:room.world});broadcast(room,{type:'room_update',players:publicPlayers(room)});if(room.host===id)broadcast(room,{type:'host_resumed'});else if(!room.players.get(room.host)?.ws)send(ws,{type:'host_paused'});dirty=true;persistNow();return}
  if(m.type==='create_room'){
   leave(ws);let roomCode;do{roomCode=code()}while(rooms.has(roomCode));const room={code:roomCode,host:id,players:new Map(),world:null,revision:0};rooms.set(roomCode,room);client.room=roomCode;client.name=cleanName(m.name);room.players.set(id,{ws,token:crypto.randomBytes(32).toString('hex'),name:client.name,state:{name:client.name,floor:1,x:15,y:9,level:1,hp:100,maxHp:100}});send(ws,{type:'room_joined',code:roomCode,players:publicPlayers(room),host:room.host,resumeToken:room.players.get(id).token});dirty=true;persistNow();return;
  }
  if(m.type==='join_room'){
   leave(ws);const room=rooms.get(String(m.code||'').toUpperCase());if(!room)return send(ws,{type:'error',message:'Room not found. Check the invite code.'});if(room.players.size>=MAX_PLAYERS)return send(ws,{type:'error',message:'That party is full.'});client.room=room.code;client.name=cleanName(m.name);room.players.set(id,{ws,token:crypto.randomBytes(32).toString('hex'),name:client.name,state:{name:client.name,floor:1,x:15,y:9,level:1,hp:100,maxHp:100}});send(ws,{type:'room_joined',code:room.code,players:publicPlayers(room),host:room.host,resumeToken:room.players.get(id).token});if(room.world)send(ws,{type:'world_snapshot',revision:room.revision,world:room.world});broadcast(room,{type:'room_update',players:publicPlayers(room)},id);broadcast(room,{type:'player_state',id,player:room.players.get(id).state},id);if(!room.players.get(room.host)?.ws)send(ws,{type:'host_paused'});dirty=true;persistNow();return;
  }
  if(m.type==='leave_room'){leave(ws);return}
  if(['trade_open','trade_offer','trade_accept','trade_cancel'].includes(m.type)){const room=rooms.get(client.room);if(room)tradeMessage(room,id,m);return}
  if(raw.length>8192&&m.type!=='world_snapshot')return ws.close(1009,'Message too large');
  if(m.type==='world_snapshot'){const room=rooms.get(client.room);if(!room||room.host!==id)return;const world=m.world;if(!world||!Number.isInteger(world.floor)||world.floor<1||world.floor>999||!Array.isArray(world.enemies)||world.enemies.length>5000)return;room.world=world;room.revision++;dirty=true;broadcast(room,{type:'world_snapshot',revision:room.revision,world},id);return;}
  if(m.type==='drop_request'){
   const room=rooms.get(client.room);if(!room||room.host===id)return;
   const p=room.players.get(id),host=room.players.get(room.host);
   if(!p||!host||typeof m.id!=='string'||!/^[a-zA-Z][a-zA-Z0-9-]{0,63}$/.test(m.id)||!Number.isSafeInteger(m.qty)||m.qty<1||m.qty>9999||!/^[a-f0-9]{32}$/.test(m.nonce||''))return;
   send(host.ws,{type:'drop_request',id,nonce:m.nonce,item:m.id,qty:m.qty,player:p.state});return;
  }
  if(m.type==='drop_result'){
   const room=rooms.get(client.room);if(!room||room.host!==id||!/^[a-f0-9]{32}$/.test(m.nonce||''))return;
   const target=room.players.get(m.target);if(target)send(target.ws,{type:'drop_result',nonce:m.nonce,ok:m.ok===true});return;
  }
  if(m.type==='loot_bundle'){
   const room=rooms.get(client.room);if(!room||room.host!==id)return;
   const target=room.players.get(m.target);if(!target)return;
   const items=Object.create(null);for(const [key,value] of Object.entries(m.items||{}).slice(0,100)){if(!/^[a-zA-Z][a-zA-Z0-9-]{0,63}$/.test(key)||['constructor','prototype'].includes(key)||!Number.isSafeInteger(value)||value<1||value>9999)continue;items[key]=value}
   send(target.ws,{type:'loot_bundle',items});return;
  }
  if(m.type==='reward'){const room=rooms.get(client.room);if(!room||room.host!==id)return;const target=room.players.get(m.target);if(target)send(target.ws,{type:'reward',guardian:m.guardian?{floor:clampInt(m.guardian.floor,1,999),name:String(m.guardian.name||'Guardian').slice(0,60)}:null,gold:clampInt(m.gold,0,100),xp:clampInt(m.xp,0,500),item:['tonic','torch','shard'].includes(m.item)?m.item:null});return;}
  if(m.type==='round_result'){const room=rooms.get(client.room);if(!room||room.host!==id||!/^[a-f0-9]{32}$/.test(m.roundId||'')||!Number.isInteger(m.turn)||m.turn<1||m.turn>99999)return;const target=room.players.get(m.target);if(target)send(target.ws,{type:'round_result',roundId:m.roundId,turn:m.turn,damage:clampInt(m.damage,0,9999),mana:clampInt(m.mana,-20,4),heal:clampInt(m.heal,0,140)});return;}
  if(m.type==='combat_intent'){const room=rooms.get(client.room);if(!room)return;const p=room.players.get(id);if(!p||!['attack','spell','loot','loot_close','take_gold','take_torch','take_tonic','take_all'].includes(m.action)&&!/^take_(?:[a-z0-9]{1,8}_)?(?:all|[0-9]{1,4})$/.test(m.action)&&!/^round_[a-f0-9]{32}_[0-9]{1,5}_(strike|guard|focus|cast[0-2])(?:_[0-9]{1,5})?$/.test(m.action))return;const host=room.players.get(room.host);if(host)send(host.ws,{type:'combat_intent',id,action:m.action,player:p.state});return;}
  if(m.type==='player_state'){
   const room=rooms.get(client.room);if(!room)return;const p=room.players.get(id);if(!p)return;
   const s=m.player||{};const floor=clampInt(s.floor,1,999),x=clampInt(s.x,0,117),y=clampInt(s.y,0,79);
   const gear={};
   for(const [slot,looks] of Object.entries({weapon:['knife','hammer'],armor:['coat','mail','steel'],charm:['bell','glass','iron']})){
     if(looks.includes(s.gear?.[slot]))gear[slot]=s.gear[slot];
   }
   const hair=['Signature','Crop','Pixie','Bob','Curls','Ponytail','Braid','Shaved'].includes(s.character?.hair)?s.character.hair:'Signature';
   const gender=['Woman','Man','Nonbinary'].includes(s.character?.gender)?s.character.gender:'Nonbinary';
   const character={hair,gender,skin:clampInt(s.character?.skin??2,0,5),race:['Human','Elf','Dwarf','Cat','Dog','Mutant Crab','Wizard','Zombie'].includes(s.character?.race)?s.character.race:'Human'};
   const hall=s.hall?{index:clampInt(s.hall.index,0,5),x:clampInt(s.hall.x,1,11),y:clampInt(s.hall.y,2,8)}:null;
   p.state={hall,gear,character,name:client.name,floor,x,y,level:clampInt(s.level,1,100),hp:clampInt(s.hp,0,9999),maxHp:clampInt(s.maxHp,1,9999),mp:clampInt(s.mp,0,9999),power:clampInt(s.power,1,200),armor:clampInt(s.armor,0,100),spellBonus:clampInt(s.spellBonus,0,100),spells:Array.isArray(s.spells)?s.spells.filter(v=>typeof v==='string'&&/^[a-z]{1,24}$/.test(v)).slice(0,3):[]};
   dirty=true;broadcast(room,{type:'player_state',id,player:p.state},id);return;
  }
  send(ws,{type:'error',message:'Unsupported message.'});
 });
 ws.on('close',()=>{suspend(ws);clients.delete(ws)});ws.on('error',()=>{ws.terminate()});
});
function recordTradeResult(room,t,ok){const results=new Map();for(const who of [t.a,t.b]){const token=t.tokens?.[who];if(token)results.set(token,{type:'trade_end',id:t.id,ok,received:ok?t.offers[who===t.a?t.b:t.a]:undefined})}tradeReceipts.set(t.id,{results,expires:Date.now()+RECEIPT_TTL});dirty=true;if(!persistNow()){tradeReceipts.delete(t.id);room.trades.set(t.id,t);return false}for(const who of [t.a,t.b]){const p=room.players.get(who);if(p)send(p.ws,results.get(t.tokens?.[who])||{type:'trade_end',id:t.id,ok})}return true}
function tradeView(room,t){
 for(const id of [t.a,t.b]){const p=room.players.get(id);if(p)send(p.ws,{type:'trade_state',trade:{id:t.id,peer:id===t.a?t.b:t.a,peerName:room.players.get(id===t.a?t.b:t.a)?.name||'Crawler',mine:t.offers[id]||null,theirs:t.offers[id===t.a?t.b:t.a]||null,accepted:!!t.accept[id],peerAccepted:!!t.accept[id===t.a?t.b:t.a],version:t.version}})}
}
function cancelTrade(room,t){room.trades.delete(t.id);recordTradeResult(room,t,false)}
function tradeNear(a,b){return a&&b&&a.hp>0&&b.hp>0&&a.floor===b.floor&&!a.hall&&!b.hall&&Math.hypot(a.x-b.x,a.y-b.y)<=3}
function tradeMessage(room,id,m){
 room.trades??=new Map();const p=room.players.get(id);if(!p)return;
 if(m.type==='trade_open'){const other=room.players.get(m.target);if(!other?.ws||m.target===id||!tradeNear(p.state,other.state)||[...room.trades.values()].some(t=>[t.a,t.b].some(v=>v===id||v===m.target)))return send(p.ws,{type:'error',message:'Trade unavailable. Stand near an available crawler.'});const t={id:crypto.randomUUID(),a:id,b:m.target,offers:{},tokens:{},accept:{},version:0};room.trades.set(t.id,t);tradeView(room,t);return}
 const t=room.trades.get(m.id);if(!t||![t.a,t.b].includes(id))return;
 if(m.type==='trade_cancel'){cancelTrade(room,t);return}
 if(m.type==='trade_offer'){if(t.offers[id])return;if(!/^[a-f0-9]{32}$/.test(m.token||''))return;const rows=Array.isArray(m.offer)?m.offer:[m.offer];if(rows.length<1||rows.length>12)return;const seen=new Set();for(const o of rows){if(!o||typeof o.item!=='string'||!/^[A-Za-z][A-Za-z0-9-]{0,63}$/.test(o.item)||['constructor','prototype'].includes(o.item)||!Number.isSafeInteger(o.qty)||o.qty<1||o.qty>9999||seen.has(o.item))return;seen.add(o.item)}t.tokens[id]=m.token;t.offers[id]=rows.map(o=>({item:o.item,qty:o.qty}));t.accept={};t.version++;dirty=true;if(!persistNow()){delete t.tokens[id];delete t.offers[id];t.version--;return send(p.ws,{type:'error',message:'Trade storage unavailable. Retry or cancel.'})}tradeView(room,t);return}
 if(m.type==='trade_accept'){if(m.version!==t.version||!t.offers[t.a]||!t.offers[t.b])return;if(!tradeNear(room.players.get(t.a)?.state,room.players.get(t.b)?.state)){cancelTrade(room,t);return}t.accept[id]=true;if(!t.accept[t.a]||!t.accept[t.b]){tradeView(room,t);return}room.trades.delete(t.id);recordTradeResult(room,t,true)}
}
function cleanName(s){return String(s||'Crawler').replace(/[^\w -]/g,'').slice(0,16)||'Crawler'}
function clampInt(v,min,max){v=Number(v);return Number.isFinite(v)?Math.max(min,Math.min(max,Math.floor(v))):min}
const checkpoint=setInterval(()=>{if(dirty)persistNow()},1000);checkpoint.unref();
const heartbeat=setInterval(()=>{for(const room of rooms.values()){for(const [id,p] of room.players)if(!p.ws&&p.expires<=Date.now()){room.players.delete(id);if(room.host===id){broadcast(room,{type:'room_ended',reason:'Host recovery expired'});for(const q of room.players.values()){const c=clients.get(q.ws);if(c)c.room=null}rooms.delete(room.code);break}}if(!room.players.size)rooms.delete(room.code)}for(const [id,r] of tradeReceipts)if(r.expires<=Date.now())tradeReceipts.delete(id);dirty=true;persistNow();for(const ws of wss.clients){if(ws.isAlive===false){ws.terminate();continue}ws.isAlive=false;ws.ping()}},30000);
wss.on('close',()=>{clearInterval(heartbeat);clearInterval(checkpoint)});
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{persistNow();process.exit(storageError?1:0)});
server.listen(PORT,'0.0.0.0',()=>console.log(`DCK relay listening on ${PORT}`));
