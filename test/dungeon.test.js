'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function engine(){
 const source=fs.readFileSync('game.js','utf8'),i=source.indexOf("if('serviceWorker' in navigator");assert.ok(i>0,'startup boundary');
 const el={getContext:()=>({}),classList:{add(){},remove(){},toggle(){}},style:{},dataset:{}};
 let stored=null;
 const context={window:{matchMedia:()=>({matches:false}),addEventListener(){}},document:{querySelector:()=>el,querySelectorAll:()=>[],addEventListener(){}},Image:class{},localStorage:{getItem:()=>stored,setItem:(k,v)=>stored=v},performance:{now:()=>0}};
 const api=vm.runInNewContext(source.slice(0,i)+`return {floorEnemy,fresh,generate,hatchGrub,moveStack,canonicalDrop,writeCampaign,load,snapshot:()=>({state,tiles,seen,entities,W,H}),setup:floor=>{state={...fresh(),floor,chapter:'mine'};bossFight=null;},quiet:()=>{render=()=>{};ai=()=>{};feed=()=>{};notify=()=>{};}};})()`,context);
 api.quiet();return api;
}
test('all eighteen floors shrink, generate one exit and correct guardians',()=>{
 const a=engine();let area=Infinity;const names=new Set();
 for(let f=1;f<=18;f++){a.setup(f);a.generate();const q=a.snapshot();assert.ok(q.W*q.H<area);area=q.W*q.H;assert.equal(q.tiles.flat().filter(v=>v===3).length,1);assert.equal(q.entities.filter(e=>e.boss).length,f%3===0?1:0);for(let j=0;j<2;j++){const mob=a.floorEnemy(f,j,f,j);if(j===0){assert.ok(!names.has(mob.name));names.add(mob.name)}assert.ok(mob.hp>0);}}
});
test('corpse hatch is single-use and caps living grubs at 500',()=>{
 const a=engine();a.setup(2);a.generate();const q=a.snapshot(),e=q.entities.find(e=>e.sprite==='flood-grub');e.alive=false;e.hp=0;let n=q.entities.length;assert.equal(a.hatchGrub(e),true);assert.equal(q.entities.length-n,3);assert.equal(a.hatchGrub(e),false);
 while(q.entities.filter(e=>e.alive&&e.sprite==='flood-grub').length<500)q.entities.push(a.floorEnemy(2,0,0,0));
 const corpse={...e,corpseHatched:false};assert.equal(a.hatchGrub(corpse),false);assert.equal(q.entities.filter(e=>e.alive&&e.sprite==='flood-grub').length,500);
});
test('inventory stack transfer and campaign save round trip',()=>{
 const a=engine();a.setup(4);a.generate();const q=a.snapshot(),item=a.canonicalDrop('cage-cleaver-3',3),sale=[];assert.equal(item.rank,3);q.state.inventory.push(item);assert.equal(a.moveStack(q.state.inventory,sale,item,2),true);assert.equal(item.qty,1);assert.equal(sale[0].qty,2);assert.equal(a.moveStack(q.state.inventory,sale,item,2),false);q.state.tradeInventory=sale;a.writeCampaign();a.setup(1);assert.equal(a.load(),true);const restored=a.snapshot();assert.equal(restored.state.floor,4);assert.equal(restored.state.inventory[0].qty,1);assert.equal(restored.state.tradeInventory[0].rank,3);assert.equal(restored.state.tradeInventory[0].qty,2);
});
