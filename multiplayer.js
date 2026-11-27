/* Dungeon Crawler Kyle — lightweight private-room relay client.
 * Presence/position alpha only. The relay is not authoritative for combat or loot.
 */
(()=>{'use strict';
 const emit=(type,detail={})=>window.dispatchEvent(new CustomEvent('dcknet',{detail:{type,...detail}}));
 const remoteOnly=()=>Object.fromEntries(Object.entries(players).filter(([id])=>id!==clientId));
 let hostId=null,revision=0;let socket=null,roomCode=null,clientId=null,playerName='Crawler',pendingRoom=null,players={};
 let resumeToken=null,resumeCode=null,relayUrl=null,retryTimer=null,retryUntil=0,retrying=false,hostPaused=false;
 const resumeKey='dck-party-resume-v1';
 function storeResume(){try{if(resumeCode&&resumeToken&&relayUrl)localStorage.setItem(resumeKey,JSON.stringify({code:resumeCode,token:resumeToken,url:relayUrl,name:playerName}));else localStorage.removeItem(resumeKey)}catch{}}
 function savedResume(){try{const p=JSON.parse(localStorage.getItem(resumeKey)||'null');return p&&/^[A-Z0-9]{6}$/.test(p.code)&&/^[a-f0-9]{64}$/.test(p.token)&&/^wss?:\/\//i.test(p.url)?p:null}catch{return null}}
 function stopRetry(){clearTimeout(retryTimer);retryTimer=null;retrying=false;retryUntil=0}
 function retry(){if(!resumeCode||!resumeToken)return;retrying=true;if(!retryUntil)retryUntil=Date.now()+110000;if(Date.now()>=retryUntil){stopRetry();resumeCode=resumeToken=null;storeResume();emit('status',{text:'PARTY RECOVERY EXPIRED — SOLO MODE'});return}clearTimeout(retryTimer);retryTimer=setTimeout(async()=>{try{await api.connect(relayUrl,playerName,true);if(api.connected&&retrying)socket.send(JSON.stringify({type:'resume_room',code:resumeCode,token:resumeToken}))}catch{retry()}},2000)}
 const api={
  get recovering(){return retrying||hostPaused},
  get connected(){return !!socket&&socket.readyState===WebSocket.OPEN},
  get inRoom(){return this.connected&&!!roomCode},
  get playerId(){return clientId},get roomCode(){return roomCode},get isHost(){return this.inRoom&&hostId===clientId},
  connect(url,name,recovery=false){
   if(!/^wss?:\/\//i.test(url))return Promise.reject(new Error('Use a ws:// or wss:// server URL.'));
   if(!recovery){stopRetry();resumeCode=resumeToken=null;hostPaused=false}relayUrl=url;if(socket)socket.close();roomCode=null;players={};playerName=(name||'Crawler').replace(/[^\w -]/g,'').slice(0,16)||'Crawler';
   return new Promise((resolve,reject)=>{
    let settled=false;try{socket=new WebSocket(url)}catch(e){reject(e);return}const activeSocket=socket;
    const timeout=setTimeout(()=>{if(!settled){settled=true;socket?.close();reject(new Error('Connection timed out.'))}},9000);
    activeSocket.addEventListener('open',()=>{if(socket!==activeSocket)return;settled=true;clearTimeout(timeout);if(!recovery)emit('status',{text:'CONNECTED — SOLO / PARTY READY'});resolve()},{once:true});
    activeSocket.addEventListener('error',()=>{if(socket!==activeSocket)return;if(!settled){settled=true;clearTimeout(timeout);reject(new Error('Could not reach the relay. Check the URL and hosting status.'))}else emit('error',{message:'Connection error.'})});
    activeSocket.addEventListener('close',()=>{if(socket!==activeSocket)return;roomCode=null;players={};if(resumeCode&&resumeToken){retry();emit('status',{text:'RECONNECTING TO PARTY'})}else emit('status',{text:'DISCONNECTED — SOLO MODE'});emit('players',{players:{}});if(pendingRoom){pendingRoom.reject(new Error('Connection closed.'));pendingRoom=null}});
    activeSocket.addEventListener('message',ev=>{if(socket!==activeSocket)return;let m;try{m=JSON.parse(ev.data)}catch{return}
     if(m.type==='hello'){clientId=m.id;return}
     if(m.type==='resume_failed'){stopRetry();resumeCode=resumeToken=null;storeResume();hostPaused=false;emit('status',{text:'PARTY RECOVERY UNAVAILABLE — SOLO MODE'});return}
     if(m.type==='host_paused'){hostPaused=true;emit('status',{text:'HOST RECONNECTING — PARTY PAUSED',code:roomCode});return}
     if(m.type==='host_resumed'){hostPaused=false;emit('status',{text:'HOST RECONNECTED',code:roomCode});return}
     if(m.type==='room_ended'){stopRetry();roomCode=resumeCode=resumeToken=null;storeResume();hostPaused=false;players={};emit('players',{players:{}});emit('status',{text:'PARTY ENDED — SOLO MODE'});return}
     if(m.type==='room_joined'){stopRetry();resumeCode=m.code;resumeToken=m.resumeToken||null;storeResume();roomCode=m.code;hostId=m.host;revision=0;players=m.players||{};emit('room',{code:roomCode,resumed:!!m.resumed});emit('players',{players:remoteOnly()});emit('status',{text:'IN PRIVATE PARTY',code:roomCode});if(pendingRoom){pendingRoom.resolve(roomCode);pendingRoom=null}return}
     if(m.type==='host_changed'){hostId=m.host;emit('host',{isHost:api.isHost});return}
     if(m.type==='world_snapshot'){if(m.revision>revision){revision=m.revision;emit('world',{world:m.world})}return}
     if(m.type==='round_result'){emit('round_result',{roundId:m.roundId,turn:m.turn,damage:m.damage,mana:m.mana,heal:m.heal});return}
     if(m.type==='trade_state'){emit('trade_state',{trade:m.trade});return}
     if(m.type==='trade_recovery_unknown'){emit('trade_recovery_unknown',{id:m.id});return}
     if(m.type==='trade_end'){emit('trade_end',{id:m.id,ok:m.ok===true,received:m.received});return}
     if(m.type==='drop_request'){if(api.isHost)emit('drop_request',{id:m.id,nonce:m.nonce,item:m.item,qty:m.qty,player:m.player});return}
     if(m.type==='drop_result'){emit('drop_result',{nonce:m.nonce,ok:m.ok===true});return}
     if(m.type==='loot_bundle'){emit('loot_bundle',{items:m.items});return}
     if(m.type==='reward'){emit('reward',{gold:m.gold,xp:m.xp,item:m.item,guardian:m.guardian});return}
     if(m.type==='combat_intent'){if(api.isHost)emit('combat_intent',{id:m.id,action:m.action,player:m.player});return}
     if(m.type==='room_update'){players=m.players||{};emit('players',{players:remoteOnly()});return}
     if(m.type==='player_state'){players[m.id]=m.player;if(m.id!==clientId)emit('player_state',{id:m.id,player:m.player});return}
     if(m.type==='player_left'){delete players[m.id];emit('player_left',{id:m.id});return}
     if(m.type==='error'){if(pendingRoom){pendingRoom.reject(new Error(m.message));pendingRoom=null}emit('error',{message:m.message});}
    });
   });
  },
  get savedParty(){const p=savedResume();return p?{code:p.code,url:p.url}:null},
  async resumeSavedParty(){const p=savedResume();if(!p)throw Error('No saved party.');await this.connect(p.url,p.name,true);resumeCode=p.code;resumeToken=p.token;retrying=true;retryUntil=Date.now()+110000;socket.send(JSON.stringify({type:'resume_room',code:p.code,token:p.token}));},
  createRoom(){return this._roomAction({type:'create_room',name:playerName})},
  joinRoom(code){code=(code||'').trim().toUpperCase();if(!/^[A-Z0-9]{6}$/.test(code))return Promise.reject(new Error('Enter a valid 6-character room code.'));return this._roomAction({type:'join_room',code,name:playerName})},
  _roomAction(message){if(!this.connected)return Promise.reject(new Error('Connect to the relay first.'));if(pendingRoom)return Promise.reject(new Error('A room request is already pending.'));return new Promise((resolve,reject)=>{pendingRoom={resolve,reject};socket.send(JSON.stringify(message));setTimeout(()=>{if(pendingRoom){pendingRoom.reject(new Error('Room request timed out.'));pendingRoom=null}},7000)})},
  sendRoundResult(target,roundId,turn,damage,mana,heal=0){if(this.isHost)socket.send(JSON.stringify({type:'round_result',target,roundId,turn,damage,mana,heal}))},
  recoverTrade(id,token){if(this.connected)socket.send(JSON.stringify({type:'trade_recover',id,token}))},
  trade(type,data){if(this.inRoom&&['trade_open','trade_offer','trade_accept','trade_cancel'].includes(type))socket.send(JSON.stringify({type,...data}))},
  sendDrop(drop){if(this.inRoom&&!this.isHost)socket.send(JSON.stringify({type:'drop_request',...drop}))},
  sendDropResult(target,nonce,ok){if(this.isHost)socket.send(JSON.stringify({type:'drop_result',target,nonce,ok}))},
  sendLoot(target,items){if(this.isHost)socket.send(JSON.stringify({type:'loot_bundle',target,items}))},
  sendReward(target,gold,xp,item,guardian){if(this.isHost)socket.send(JSON.stringify({type:'reward',target,gold,xp,item,guardian}))},
  sendWorld(world){if(this.isHost)socket.send(JSON.stringify({type:'world_snapshot',world}))},
  sendIntent(action){if(this.inRoom)socket.send(JSON.stringify({type:'combat_intent',action}))},
  sendState(player){if(this.inRoom)socket.send(JSON.stringify({type:'player_state',player}))},
  leave(){stopRetry();resumeCode=resumeToken=null;storeResume();hostPaused=false;if(this.connected&&roomCode)socket.send(JSON.stringify({type:'leave_room'}));roomCode=null;players={};emit('players',{players:{}});emit('status',{text:'CONNECTED — SOLO MODE'})}
 };
 window.DCKNet=api;
})();
