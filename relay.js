'use strict';
// Private-room WebSocket relay. This is a presence/position prototype, not an authoritative game server.
const http=require('node:http');
const crypto=require('node:crypto');
const {WebSocketServer,WebSocket}=require('ws');
const PORT=Number(process.env.PORT||8080),MAX_PLAYERS=4,MAX_MESSAGE=524288;
const rooms=new Map(),clients=new Map();
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function code(){let s='';for(let i=0;i<6;i++)s+=alphabet[crypto.randomInt(alphabet.length)];return s}
function send(ws,data){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data))}
function publicPlayers(room){const out={};for(const [id,p] of room.players)out[id]=p.state;return out}
function broadcast(room,data,except){for(const [id,p] of room.players){if(id!==except)send(p.ws,data)}}
function leave(ws){const c=clients.get(ws);if(!c||!c.room)return;const room=rooms.get(c.room);if(room){for(const t of room.trades?.values()||[])if(t.a===c.id||t.b===c.id)cancelTrade(room,t);room.players.delete(c.id);if(room.host===c.id){room.host=room.players.keys().next().value;broadcast(room,{type:'host_changed',host:room.host})}broadcast(room,{type:'player_left',id:c.id});broadcast(room,{type:'room_update',players:publicPlayers(room)});if(!room.players.size)rooms.delete(room.code)}c.room=null}
const server=http.createServer((req,res)=>{if(req.url==='/health'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({ok:true,service:'dck-private-relay',rooms:rooms.size,clients:clients.size}))}res.writeHead(200,{'content-type':'text/plain'});res.end('Dungeon Crawler Kyle private relay is running.\n')});
const wss=new WebSocketServer({server,maxPayload:MAX_MESSAGE});
wss.on('connection',(ws,req)=>{
 const allowedOrigin=process.env.ALLOWED_ORIGIN;if(allowedOrigin&&req.headers.origin!==allowedOrigin){ws.close(1008,'Origin not allowed');return}
 const id=crypto.randomUUID(),client={id,ws,room:null,name:'Crawler',windowStart:Date.now(),messages:0};clients.set(ws,client);ws.isAlive=true;ws.on('pong',()=>{ws.isAlive=true});send(ws,{type:'hello',id});
 ws.on('message',raw=>{
  if(raw.length>MAX_MESSAGE)return ws.close(1009,'Message too large');
  const now=Date.now();if(now-client.windowStart>1000){client.windowStart=now;client.messages=0}if(++client.messages>30)return ws.close(1008,'Rate limit');
  let m;try{m=JSON.parse(raw.toString())}catch{return send(ws,{type:'error',message:'Invalid message.'})}
  if(m.type==='create_room'){
   leave(ws);let roomCode;do{roomCode=code()}while(rooms.has(roomCode));const room={code:roomCode,host:id,players:new Map(),world:null,revision:0};rooms.set(roomCode,room);client.room=roomCode;client.name=cleanName(m.name);room.players.set(id,{ws,name:client.name,state:{name:client.name,floor:1,x:15,y:9,level:1,hp:100,maxHp:100}});send(ws,{type:'room_joined',code:roomCode,players:publicPlayers(room),host:room.host});return;
  }
  if(m.type==='join_room'){
   leave(ws);const room=rooms.get(String(m.code||'').toUpperCase());if(!room)return send(ws,{type:'error',message:'Room not found. Check the invite code.'});if(room.players.size>=MAX_PLAYERS)return send(ws,{type:'error',message:'That party is full.'});client.room=room.code;client.name=cleanName(m.name);room.players.set(id,{ws,name:client.name,state:{name:client.name,floor:1,x:15,y:9,level:1,hp:100,maxHp:100}});send(ws,{type:'room_joined',code:room.code,players:publicPlayers(room),host:room.host});if(room.world)send(ws,{type:'world_snapshot',revision:room.revision,world:room.world});broadcast(room,{type:'room_update',players:publicPlayers(room)},id);broadcast(room,{type:'player_state',id,player:room.players.get(id).state},id);return;
  }
  if(m.type==='leave_room'){leave(ws);return}
  if(['trade_open','trade_offer','trade_accept','trade_cancel'].includes(m.type)){const room=rooms.get(client.room);if(room)tradeMessage(room,id,m);return}
  if(raw.length>8192&&m.type!=='world_snapshot')return ws.close(1009,'Message too large');
  if(m.type==='world_snapshot'){const room=rooms.get(client.room);if(!room||room.host!==id)return;const world=m.world;if(!world||!Number.isInteger(world.floor)||world.floor<1||world.floor>999||!Array.isArray(world.enemies)||world.enemies.length>5000)return;room.world=world;room.revision++;broadcast(room,{type:'world_snapshot',revision:room.revision,world},id);return;}
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
   broadcast(room,{type:'player_state',id,player:p.state},id);return;
  }
  send(ws,{type:'error',message:'Unsupported message.'});
 });
 ws.on('close',()=>{leave(ws);clients.delete(ws)});ws.on('error',()=>{leave(ws);clients.delete(ws)});
});
function tradeView(room,t){
 for(const id of [t.a,t.b]){const p=room.players.get(id);if(p)send(p.ws,{type:'trade_state',trade:{id:t.id,peer:id===t.a?t.b:t.a,peerName:room.players.get(id===t.a?t.b:t.a)?.name||'Crawler',mine:t.offers[id]||null,theirs:t.offers[id===t.a?t.b:t.a]||null,accepted:!!t.accept[id],peerAccepted:!!t.accept[id===t.a?t.b:t.a],version:t.version}})}
}
function cancelTrade(room,t){room.trades.delete(t.id);for(const id of [t.a,t.b]){const p=room.players.get(id);if(p)send(p.ws,{type:'trade_end',id:t.id,ok:false})}}
function tradeNear(a,b){return a&&b&&a.hp>0&&b.hp>0&&a.floor===b.floor&&!a.hall&&!b.hall&&Math.hypot(a.x-b.x,a.y-b.y)<=3}
function tradeMessage(room,id,m){
 room.trades??=new Map();const p=room.players.get(id);if(!p)return;
 if(m.type==='trade_open'){const other=room.players.get(m.target);if(!other||m.target===id||!tradeNear(p.state,other.state)||[...room.trades.values()].some(t=>[t.a,t.b].some(v=>v===id||v===m.target)))return send(p.ws,{type:'error',message:'Trade unavailable. Stand near an available crawler.'});const t={id:crypto.randomUUID(),a:id,b:m.target,offers:{},accept:{},version:0};room.trades.set(t.id,t);tradeView(room,t);return}
 const t=room.trades.get(m.id);if(!t||![t.a,t.b].includes(id))return;
 if(m.type==='trade_cancel'){cancelTrade(room,t);return}
 if(m.type==='trade_offer'){if(t.offers[id])return;const o=m.offer;if(!o||typeof o.item!=='string'||!(/^[A-Za-z][A-Za-z0-9-]{0,63}$/).test(o.item)||!Number.isSafeInteger(o.qty)||o.qty<1||o.qty>9999)return;t.offers[id]={item:o.item,qty:o.qty};t.accept={};t.version++;tradeView(room,t);return}
 if(m.type==='trade_accept'){if(m.version!==t.version||!t.offers[t.a]||!t.offers[t.b])return;if(!tradeNear(room.players.get(t.a)?.state,room.players.get(t.b)?.state)){cancelTrade(room,t);return}t.accept[id]=true;if(!t.accept[t.a]||!t.accept[t.b]){tradeView(room,t);return}room.trades.delete(t.id);for(const who of [t.a,t.b]){const q=room.players.get(who);if(q)send(q.ws,{type:'trade_end',id:t.id,ok:true,received:t.offers[who===t.a?t.b:t.a]})}}
}
function cleanName(s){return String(s||'Crawler').replace(/[^\w -]/g,'').slice(0,16)||'Crawler'}
function clampInt(v,min,max){v=Number(v);return Number.isFinite(v)?Math.max(min,Math.min(max,Math.floor(v))):min}
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(ws.isAlive===false){ws.terminate();continue}ws.isAlive=false;ws.ping()}},30000);
wss.on('close',()=>clearInterval(heartbeat));
server.listen(PORT,'0.0.0.0',()=>console.log(`DCK relay listening on ${PORT}`));
