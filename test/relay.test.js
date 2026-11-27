'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{WebSocket}=require('ws'),net=require('node:net');
async function port(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p}
async function peer(url,t){const ws=new WebSocket(url),queue=[];ws.on('message',raw=>queue.push(JSON.parse(raw)));ws.on('error',()=>{});t.after(()=>ws.terminate());await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j)});return {ws,send:m=>ws.send(JSON.stringify(m)),async next(type,predicate=()=>true){const end=Date.now()+4000;while(Date.now()<end){const i=queue.findIndex(m=>m.type===type&&predicate(m));if(i>=0)return queue.splice(i,1)[0];await new Promise(r=>setTimeout(r,10))}throw Error('Missing '+type)},async disconnect(){await new Promise(r=>{ws.once('close',r);ws.close()})}}}
test('relay integration: mutual offers, receipt privacy, cancellation and host resume',{timeout:30000},async t=>{
const p=await port(),url='ws://127.0.0.1:'+p,child=spawn(process.execPath,['relay.js'],{env:{...process.env,PORT:String(p),ALLOWED_ORIGIN:''},stdio:['ignore','pipe','pipe']});t.after(()=>child.kill());
await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('relay startup timeout')),5000);child.stdout.on('data',d=>{if(String(d).includes('listening')){clearTimeout(timer);r()}});child.once('exit',()=>{clearTimeout(timer);j(Error('relay exited'))})});
const a=await peer(url,t),b=await peer(url,t);const aid=(await a.next('hello')).id,bid=(await b.next('hello')).id;
a.send({type:'create_room',name:'Alpha'});const room=await a.next('room_joined');b.send({type:'join_room',code:room.code,name:'Beta'});await b.next('room_joined');
a.send({type:'trade_open',target:bid});const id=(await a.next('trade_state')).trade.id;await b.next('trade_state');
const tokenA='a'.repeat(32),tokenB='b'.repeat(32),offerA=[{item:'gold',qty:20},{item:'tonic',qty:2}],offerB=[{item:'torch',qty:3}];
a.send({type:'trade_offer',id,token:tokenA,offer:offerA});await a.next('trade_state',m=>m.trade.version===1);
b.send({type:'trade_offer',id,token:tokenB,offer:offerB});const v=(await a.next('trade_state',m=>m.trade.version===2)).trade.version;
a.send({type:'trade_accept',id,version:v-1});b.send({type:'trade_accept',id,version:v});const wait=await a.next('trade_state',m=>m.trade.peerAccepted);assert.equal(wait.trade.accepted,false);
a.send({type:'trade_accept',id,version:v});assert.deepEqual((await a.next('trade_end')).received,offerB);assert.deepEqual((await b.next('trade_end')).received,offerA);
b.send({type:'trade_recover',id,token:tokenA.slice(1)+'c'});await b.next('trade_recovery_unknown');a.send({type:'trade_recover',id,token:tokenA});assert.deepEqual((await a.next('trade_end')).received,offerB);
a.send({type:'trade_open',target:bid});const second=(await a.next('trade_state',m=>m.trade.id!==id)).trade.id;a.send({type:'trade_offer',id:second,token:tokenA,offer:offerA});await a.next('trade_state',m=>m.trade.id===second&&m.trade.version===1);
await b.disconnect();assert.equal((await a.next('trade_end',m=>m.id===second)).ok,false);
a.send({type:'world_snapshot',world:{floor:2,enemies:[]}});await a.disconnect();
const c=await peer(url,t);await c.next('hello');c.send({type:'resume_room',code:room.code,token:room.resumeToken});const resumed=await c.next('room_joined');assert.equal(resumed.host,aid);assert.equal(resumed.resumed,true);assert.equal((await c.next('world_snapshot')).world.floor,2);
});
