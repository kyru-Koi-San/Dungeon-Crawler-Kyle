'use strict';
// Run against a hosted relay: node scripts/relay-smoke.js wss://your-host
const {WebSocket}=require('ws');
const assert=require('node:assert/strict');
const origin='https://kyru-koi-san.github.io';
const sockets=[];
async function main(){
 const endpoint=new URL(process.argv[2]||'');
 assert.equal(endpoint.protocol,'wss:','Hosted relay must use TLS');
 const health=new URL('/health',endpoint);health.protocol='https:';
 const response=await fetch(health,{signal:AbortSignal.timeout(10000)});
 assert.ok(response.ok,'Health endpoint unavailable');
 const info=await response.json();
 assert.equal(info.ok,true);assert.equal(info.persistent,true,'Persistent relay storage required');
 async function peer(){
  const ws=new WebSocket(endpoint,{origin,handshakeTimeout:10000});sockets.push(ws);
  const queue=[];let failure;
  ws.on('message',raw=>{try{queue.push(JSON.parse(raw))}catch(e){failure=e}});
  ws.on('error',e=>{failure=e});
  const next=async(type)=>{const end=Date.now()+10000;while(Date.now()<end){if(failure)throw failure;const i=queue.findIndex(m=>m.type===type);if(i>=0)return queue.splice(i,1)[0];await new Promise(r=>setTimeout(r,25))}throw Error('Timeout awaiting '+type)};
  await next('hello');return {send:m=>ws.send(JSON.stringify(m)),next};
 }
 const host=await peer(),guest=await peer();
 host.send({type:'create_room',name:'SmokeHost'});
 const room=await host.next('room_joined');assert.match(room.code,/^[A-Z0-9]{6}$/);
 guest.send({type:'join_room',code:room.code,name:'SmokeGuest'});
 assert.equal((await guest.next('room_joined')).code,room.code);
 host.send({type:'world_snapshot',world:{floor:2,enemies:[]}});
 assert.equal((await guest.next('world_snapshot')).world.floor,2);
 // Explicitly leave the disposable test room instead of leaving resumable sessions.
 guest.send({type:'leave_room'});host.send({type:'leave_room'});
 await new Promise(r=>setTimeout(r,250));
 console.log('PASS: HTTPS health, persistence enabled, WSS, private room, shared world');
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>{for(const ws of sockets)ws.terminate()});
