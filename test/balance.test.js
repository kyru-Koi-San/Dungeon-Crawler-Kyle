const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname,'../game.js'),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b)}
const {floorEnemy,guardianBalance,guardianRewardTier,progressionXp,patrolBudget}=new Function(section('const floorMobs=','function spawnEnemy(')+section('function patrolBudget(','function populatePatrols(')+'return {floorEnemy,guardianBalance,guardianRewardTier,progressionXp,patrolBudget}')();
test('all 18 floors have finite positive enemy stats and distinct rosters',()=>{
 const names=new Set();
 for(let floor=1;floor<=18;floor++){
  const roster=Array.from({length:10},(_,i)=>floorEnemy(floor,i,0,0));
  for(const e of roster){assert.ok(e.hp>0&&e.atk>0&&e.xp>0&&e.armor>=0);assert.equal(e.hp,e.max)}
  for(const name of new Set(roster.map(e=>e.name))){assert.ok(!names.has(name));names.add(name)}
 }
});
test('guardians scale and guaranteed rarity increases',()=>{
 let last=0;
 for(let floor=3;floor<=18;floor+=3){const g=guardianBalance(floor);assert.ok(g.hp>last);last=g.hp;assert.equal(guardianRewardTier(floor),floor===18?'Celestial':floor>=9?'Legendary':'Gold')}
});
test('patrol budget respects nominal cap and compact layouts',()=>{
 for(let floor=2;floor<=18;floor++){assert.ok(patrolBudget(floor,350)<=patrolBudget(floor,1000));assert.ok(patrolBudget(floor,10000)<=42+2*(floor-2))}
});
test('experience thresholds increase throughout campaign',()=>{
 for(let level=1;level<40;level++)assert.ok(progressionXp(level+1)>progressionXp(level));
});
