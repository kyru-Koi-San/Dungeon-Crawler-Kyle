(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const safeAttr=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const canvas=$('#game'),ctx=canvas.getContext('2d'),mini=$('#minimap').getContext('2d'),portrait=$('#portrait').getContext('2d');
const TILE=32;let W=72,H=48;const saveKey='dck-final-save-v1';
const names=['Pioneer Square • Bell Vault','Elliott Bay • Floodworks','SoDo • Iron Cage','Capitol Hill • Signal Room','Lake Union • Lost Archive','Queen Anne • Sky Relay'];
const quips=['Welcome, crawler. Try not to die before the opening credits.','Your posture suggests a lack of confidence. And armor.','The audience loves a comeback. They love a dismemberment more.','I have seen rats with better tactical instincts.','Excellent footwork. Shame about the rest of you.','A new floor! The same questionable life choices.','Remember: pain is temporary. The highlight reel is forever.','That corpse had a family. Probably.','Your odds are improving. They were dreadful, so this is relative.','Do keep moving. The walls are not decorative.'];
const enemyTypes=[['Hollow',18,5,12,'☠'],['Cave goblin',25,7,16,'♟'],['Crypt spider',15,4,10,'✣'],['Ash knight',42,10,28,'♜'],['Mire wretch',32,8,20,'♟'],['Bone archer',22,6,17,'➶'],['Goblin hexer',29,8,21,'✧']];
let state,tiles=[],seen=[],entities=[],particles=[],keys={},last=0,acc=0,walkUntil=0,attackStarted=0,sound=true,audio=null,toastTimer=0,attackCooldown=0,spawnedFloor=0,tab='journal',touchMove=null,netPlayers={},netSyncClock=0;
let step=null,stepCount=0;const STEP_MS=185;
let joystickAxis=null;let visualX=null,visualY=null,visualFloor=0,joyX=0,joyY=0,joyClock=0,jumpAt=0,hurtAt=0;const sprites={};
const spriteNames=['hero-front','hero-side','hero-back','hero-slash','hero-strike','sewer-rat','skeleton','goblin','spider','wraith','archer','shaman','spider-boss','bone-champion',...['down','up','side'].flatMap(d=>[0,1,2,3].map(i=>`hero-walk-${d}-${i}`)),...[0,1,2,3].map(i=>`hero-attack-${i}`),...['skeleton','goblin','spider','wraith','archer','shaman','spider-boss','bone-champion'].flatMap(n=>[0,1,2,3].map(i=>`${n}-anim-${i}`))];
for(const name of spriteNames){const img=new Image();img.src=name+'.png';img.onload=()=>render();sprites[name]=img;}
const skinTones=['#f1cdb0','#dfaf87','#bc8b63','#a06c4b','#794f38','#50352c'];
const ancestries=['Human','Elf','Dwarf'];
const genders=['Woman','Man','Nonbinary'];
let captionUntil=0;
function caption(speaker,line,story=false){
  if(!story && performance.now()<captionUntil)return;
  const strip=$('#storyCaption');
  strip.querySelector('b').textContent=speaker;
  strip.querySelector('span').textContent=line;
  if(story){
    captionUntil=performance.now()+8000;
    state.storyLine={speaker,line};
    feed('<b>'+speaker+'</b> · '+line);
  }
}
function showCreator(){
  const current=state.character||{race:'Human',skin:2,gender:'Nonbinary'};
  const choices=(list,value)=>list.map((name,i)=>'<option value="'+i+'" '+(i===value?'selected':'')+'>'+name+'</option>').join('');
  showModal('<h2>Your crawler</h2><form id="creator"><canvas id="look" width="72" height="96"></canvas><label>Race<select name="race" '+(state.floor<4?'disabled':'')+'>'+choices(state.floor<4?['Human']:ancestries,ancestries.indexOf(current.race))+'</select></label><label>Skin tone<select name="skin">'+choices(['Porcelain','Sand','Amber','Copper','Umber','Deep brown'],current.skin)+'</select></label><label>Gender<select name="gender">'+choices(genders,genders.indexOf(current.gender))+'</select></label><button class="widebtn">'+(state.chapter==='create'?'Begin on the surface':'Save character')+'</button></form>');
  const form=$('#creator');
  const selection=()=>({race:state.floor<4?'Human':ancestries[form.elements.race.value],skin:Number(form.elements.skin.value),gender:genders[form.elements.gender.value]});
  function preview(){
    const g=$('#look').getContext('2d');
    g.clearRect(0,0,72,96);g.imageSmoothingEnabled=false;
    g.drawImage(crawlerPose('down',0,selection()),0,0,72,96);
  }
  form.onchange=preview;preview();
  form.onsubmit=e=>{
    e.preventDefault();state.character=selection();
    if(state.chapter==='create'){
      state.chapter='surface';
      caption('Mara, bell keeper','Seattle lost power at dusk. Then a fourth bell rang beneath Pioneer Square. Follow the lamps to the rescue shaft.',true);
    }
    closeModal();render();persistCampaign();
  };
}
function startStory(){
  if(window.DCKNet?.inRoom)window.DCKNet.leave();
  state=fresh();state.chapter='create';bossFight=null;step=null;visualX=null;
  W=25;H=28;state.x=12;state.y=6;state.sanctuaries=[];entities=[];particles=[];
  tiles=Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>{
    if(y===22&&x===12)return 3;
    return y>=4&&y<=22&&Math.abs(x-12)<=(y<11?3:y<18?2:1)?1:2;
  }));
  seen=tiles.map(row=>row.map(()=>true));state.collapseLeft=900;state.warned=[];
  render();persistCampaign();showCreator();
}
function surfaceTile(x,y,t){
  const px=x*TILE,py=y*TILE;
  const fill=(dx,dy,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(px+dx,py+dy,w,h)};
  const seed=(x*13+y*17)%9;
  if(t===2){
    fill(0,0,32,32,y<18?'#293f39':'#303c38');
    if(y<11&&Math.abs(x-12)>=4&&Math.abs(x-12)<=7){
      fill(0,0,32,32,'#674c43');fill(0,15,32,2,'#493936');fill(3,3,10,10,'#25353d');fill(4,4,7,7,'#9e8768');fill(19,3,9,10,'#354750');fill(0,26,32,6,'#40494c');return
    }
    fill(seed+2,8+seed,2,3,'#587058');fill(22,24-seed,3,2,'#425747');
    if(seed<3){fill(13,18,5,12,'#584635');fill(5,11,21,11,'#192f30');fill(8,5,15,12,'#284e44');fill(11,3,9,8,'#416557')}
    if(y>=17&&y<=22&&Math.abs(x-12)===2){fill(0,0,32,32,'#324048');fill(2,2,28,12,'#596466');fill(0,17,14,13,'#455356');fill(17,17,15,13,'#526066')}
    return;
  }
  fill(0,0,32,32,y<17?'#736b56':'#4b5051');
  if(y>=17){for(let i=0;i<32;i+=8){fill(0,i,32,2,'#86887a');fill(0,i+6,32,2,'#333d41')}}
  else{fill(3,seed+4,10,2,'#908369');fill(17,19+seed,8,2,'#594f43')}
  if(y===16&&x===10){fill(4,12,10,2,'#62a8b3');fill(12,14,3,5,'#438197')}
  if(y===22)fill(0,12,32,20,'#141d25');
  if(x===10&&[8,12,16].includes(y)){fill(4,7,3,20,'#3a342e');fill(1,3,9,8,'#42392d');fill(3,4,5,5,'#ffc978')}
}
function chapterHUD(){
  const surface=state.chapter==='create'||state.chapter==='surface';
  $('#heroName').textContent=state.character?state.character.race+' · '+state.character.gender:'THE CRAWLER';
  if(!surface){
    if(state.chapter==='mine'){
      const goal=state.foundKeeper?'Reach the third-floor guardian and free the miners’ cage.':'Find the rope keeper on the first floor. Stand beside him and tap Loot to talk.';
      if(state.floor===1||state.foundKeeper&&state.floor<=3&&!state.minersFree)$('#goals').insertAdjacentHTML('afterbegin','<div class="goal">'+goal+'</div>');
    }
    return;
  }
  $('#roomName').textContent='PIONEER SQUARE · SEATTLE';
  $('#floorTag').textContent='SURFACE';$('#depthStat').textContent='0';
  $('#collapseClock').textContent='DUSK';
  $('#goals').textContent='Follow the lamplit path south to the mine stairs.';
  $('#objective').textContent='FOLLOW THE LAMPS SOUTH';
}

function fresh(){return {floor:1,x:15,y:9,hp:100,maxHp:100,mp:35,maxMp:35,xp:0,nextXp:100,level:1,power:8,armor:0,gold:25,kills:0,steps:0,inventory:[],achievements:[],rooms:0,dead:false,feed:[],boss:null,stairs:false,torchTurns:0,weapon:null,skillPoints:0,coinsFound:0,facing:'down'};}
function rng(seed){let x=seed>>>0;return()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296}}
function generate(){state.power-=state.teaPower||0;state.teaPower=0;step=null;W=72;H=48;state.collapseLeft=900;state.collapsed=false;state.warned=[];visualX=null;let r=rng((state.floor*982451653+0xdecafbad)>>>0);tiles=Array.from({length:H},()=>Array(W).fill(0));seen=Array.from({length:H},()=>Array(W).fill(false));entities=[];particles=[];state.x=15;state.y=9;state.boss=null;state.stairs=false;spawnedFloor=state.floor;
// carve connected rooms and corridors
let rooms=[];for(let i=0;i<32;i++){let rw=4+Math.floor(r()*6),rh=3+Math.floor(r()*5),rx=1+Math.floor(r()*((state.floor%3===0?W-12:W)-rw-2)),ry=1+Math.floor(r()*(H-rh-2));let room={x:rx,y:ry,w:rw,h:rh,cx:Math.floor(rx+rw/2),cy:Math.floor(ry+rh/2)};for(let y=ry;y<ry+rh;y++)for(let x=rx;x<rx+rw;x++)tiles[y][x]=1;if(rooms.length){let p=rooms[rooms.length-1];let x=room.cx,y=room.cy;while(x!==p.cx){tiles[y][x]=1;x+=Math.sign(p.cx-x)}while(y!==p.cy){tiles[y][x]=1;y+=Math.sign(p.cy-y)}}rooms.push(room)}
// walls around corridors
for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++)if(tiles[y][x]===0){for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(tiles[y+dy]?.[x+dx]===1){tiles[y][x]=2;break}}
state.x=rooms[0].cx;state.y=rooms[0].cy;state.rooms=rooms.length;let safe=rooms[0];state.safe={x:safe.cx,y:safe.cy};state.sanctuaries=[{...state.safe,rested:false}];for(let room of rooms.slice(2,-1)){if(state.sanctuaries.length>=6)break;if(r()<.28&&state.sanctuaries.every(q=>Math.hypot(q.x-room.cx,q.y-room.cy)>8))state.sanctuaries.push({x:room.cx,y:room.cy,rested:false})}buildSanctuaries();let npc=rooms[1];state.npc={x:npc.cx,y:npc.cy,met:false};state.rested=false;
for(let i=0;i<Math.min(24+state.floor*2,65);i++){let room=rooms[1+Math.floor(r()*(rooms.length-1))],ex=room.cx+Math.floor(r()*3)-1,ey=room.cy+Math.floor(r()*3)-1;if(!sanctuaryAt(ex,ey)&&!solid(ex,ey)&&!entities.some(e=>e.x===ex&&e.y===ey)&&Math.abs(ex-state.x)+Math.abs(ey-state.y)>5)spawnEnemy(ex,ey,r)}
let dist=Array.from({length:H},()=>Array(W).fill(-1)),queue=[[state.x,state.y]];dist[state.y][state.x]=0;for(let i=0;i<queue.length;i++){let [x,y]=queue[i];for(let [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){let a=x+dx,b=y+dy;if(tile(a,b)===1&&dist[b][a]<0){dist[b][a]=dist[y][x]+1;queue.push([a,b])}}}let end=rooms.slice(1).sort((a,b)=>dist[b.cy][b.cx]-dist[a.cy][a.cx])[0];tiles[end.cy][end.cx]=3;state.stairs=true;
if(state.floor%3===0){let candidates=[];for(let y=2;y<H-9;y++)for(let x=2;x<W-11;x++){let w=8,h=6,clear=true;for(let j=y-1;j<=y+h;j++)for(let i=x-1;i<=x+w;i++)if(tile(i,j)===1||tile(i,j)===3)clear=false;if(!clear)continue;for(let [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){let gx=dx<0?x-1:dx>0?x+w:x+4,gy=dy<0?y-1:dy>0?y+h:y+3;if(tile(gx+dx,gy+dy)===1&&dist[gy+dy][gx+dx]>12)candidates.push({x,y,w,h,gx,gy,score:dist[gy+dy][gx+dx]})}}candidates.sort((a,b)=>b.score-a.score);let a=candidates[0];if(!a){let x=W-10,y=H-10,w=8,h=6,gx=x-1,gy=y+3;let nearest=queue.filter(([i,j])=>i<gx).sort((p,q)=>Math.abs(p[0]-gx)+Math.abs(p[1]-gy)-Math.abs(q[0]-gx)-Math.abs(q[1]-gy))[0];if(nearest){let [i,j]=nearest;while(j!==gy){tiles[j][i]=1;j+=Math.sign(gy-j)}while(i<gx){tiles[j][i]=1;i++}a={x,y,w,h,gx,gy}}}if(a){for(let j=a.y-1;j<=a.y+a.h;j++)for(let i=a.x-1;i<=a.x+a.w;i++)tiles[j][i]=i>=a.x&&i<a.x+a.w&&j>=a.y&&j<a.y+a.h?1:2;tiles[a.gy][a.gx]=1;state.arena={x:a.x,y:a.y,w:a.w,h:a.h,gates:[{x:a.gx,y:a.gy}]};spawnBoss(a.x+4,a.y+3)}else{let room=rooms.filter(q=>q!==end&&dist[q.cy][q.cx]>12).sort((a,b)=>b.w*b.h-a.w*a.h)[0]||rooms[1];state.arena={x:room.x,y:room.y,w:room.w,h:room.h,gates:[]};entities=entities.filter(e=>!(e.x>=room.x&&e.x<room.x+room.w&&e.y>=room.y&&e.y<room.y+room.h));spawnBoss(room.cx,room.cy)}}else state.arena=null;
feed('You descend into <b>'+names[(state.floor-1)%names.length]+'</b>.');ai(quips[Math.floor(r()*quips.length)]);reveal();render();}
function spawnEnemy(x,y,r=Math.random){
if(state.floor<=3){
 const rat=r()<.85-state.floor*.13;
 const hp=(rat?7:13)+state.floor*2;
 entities.push({type:'enemy',name:rat?'Drain rat':'Tunnel goblin',sprite:rat?'sewer-rat':'goblin',small:true,x,y,hp,max:hp,atk:(rat?1:2)+state.floor,xp:(rat?6:10)+state.floor,cool:0,alive:true,boss:false});return
}
let t=enemyTypes[Math.min(enemyTypes.length-1,Math.floor(r()*Math.min(enemyTypes.length,2+state.floor/2)))];entities.push({type:'enemy',name:t[0],sprite:({'Hollow':'skeleton','Cave goblin':'goblin','Crypt spider':'spider','Ash knight':'bone-champion','Mire wretch':'wraith','Bone archer':'archer','Goblin hexer':'shaman'})[t[0]],x,y,hp:t[1]+state.floor*4,max:t[1]+state.floor*4,atk:t[2]+Math.floor(state.floor/2),xp:t[3]+state.floor*2,icon:t[4],cool:0,alive:true,boss:false});}
function spawnBoss(x,y){let brood=state.floor%9===6,phantom=state.floor%9===0,hp=brood?155+state.floor*22:phantom?145+state.floor*24:130+state.floor*20;let b={type:'enemy',name:brood?'The Brood Matriarch':phantom?'The Hollow Regent':'The Ossuary Warden',sprite:brood?'spider-boss':phantom?'wraith':'bone-champion',x,y,hp,max:hp,atk:14+state.floor*2,xp:100+state.floor*10,icon:'♛',cool:0,alive:true,boss:true};if(state.floor===3)Object.assign(b,{name:'Pip, Keeper of the Cage',sprite:'goblin',small:true,hp:48,max:48,atk:5});
entities.push(b);state.boss=entities.length-1;$('#bossbar').classList.remove('hidden');$('#bossName').textContent=b.name;}
function tile(x,y){return tiles[y]?.[x]??0}function solid(x,y){return (tile(x,y)!==1&&tile(x,y)!==3)||!!(bossFight&&state.arena?.gates?.some(g=>g.x===x&&g.y===y))}
function reveal(){let rad=state.torchTurns>0?7:5;for(let y=Math.max(0,state.y-rad);y<=Math.min(H-1,state.y+rad);y++)for(let x=Math.max(0,state.x-rad);x<=Math.min(W-1,state.x+rad);x++)if(Math.hypot(x-state.x,y-state.y)<=rad)seen[y][x]=true}
function feed(s){let d=new Date(),tm=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});state.feed.unshift({tm,s});state.feed=state.feed.slice(0,30);renderFeed()}
function ai(s){caption("Underfloor",s);$('#aiLine').textContent='“'+s+'”'}function notify(s){let t=$('#toast');t.textContent=s;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),1600)}
function beep(f=180,d=.07,type='square'){if(!sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();let o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+d)}catch(e){}}
function move(dx,dy,start=performance.now()){if(bossFight||state.dead||step||modalOpen())return;state.facing=dx<0?'left':dx>0?'right':dy<0?'up':'down';let nx=state.x+dx,ny=state.y+dy;if(solid(nx,ny)||entities.some(e=>e.type==='enemy'&&e.alive&&e.x===nx&&e.y===ny))return;step={x:state.x,y:state.y,nx,ny,start};stepCount++;return;}function finishStep(nx,ny){
if(entities.some(e=>e.type==='enemy'&&e.alive&&e.x===nx&&e.y===ny))return;
if(state.chapter==='surface'){
state.x=nx;state.y=ny;
if(ny>=12&&!state.heardRope){state.heardRope=true;caption('Mara','My brother tied blue cloth to the rope. If you find it, tell him the lamps are still lit.',true)}
if(tile(nx,ny)===3)nextFloor();else persistCampaign();
return}
let wasSafe=sanctuaryAt(state.x,state.y);state.x=nx;state.y=ny;if(wasSafe&&!sanctuaryAt(nx,ny))notify('LEFT SAFE ROOM');if(!wasSafe&&sanctuaryAt(nx,ny)){notify('SAFE ROOM — ATTACKS DISABLED');ridiculous('Even Cowards Need a Break')}walkUntil=performance.now()+340;state.steps++;if(state.steps===50)ridiculous('Congratulations, You Have Legs');if(state.steps===1000)ridiculous('Certified Corridor Enthusiast','Legendary');if(state.steps===250)ridiculous('The Dungeon Is Not a Treadmill','Silver');if(Math.random()<.002)ridiculous('Suspiciously Competent Wandering');if(state.torchTurns>0)state.torchTurns--;reveal();if(tile(nx,ny)===3){nextFloor();return}if(Math.random()<.05)ai(quips[Math.floor(Math.random()*quips.length)]);render();}
function nearby(){return entities.filter(e=>e.alive&&Math.hypot(e.x-state.x,e.y-state.y)<=1.65).sort((a,b)=>Math.hypot(a.x-state.x,a.y-state.y)-Math.hypot(b.x-state.x,b.y-state.y))[0]}
let bossFight=null;
function beginBoss(e){if(bossFight||state.dead||modalOpen()||sanctuaryAt(state.x,state.y)||(e.boss&&state.arena&&!inArena(state.x,state.y)))return;bossFight={e,turn:1,log:e.boss?'The arena seals.':'The '+e.name.toLowerCase()+' advances.'};step=null;visualX=state.x;visualY=state.y;joyX=joyY=0;if(e.boss)ai('BOSS BATTLE! Please make your inevitable suffering entertaining.');bossScreen();persistCampaign()}
function bossIntent(b){return b.e.sprite==='wraith'&&b.turn%3===2?'MANA DRAIN':b.e.sprite==='bone-champion'&&b.turn%4===0?'ARMOR SHATTER':b.turn%3===0?'DEVASTATING STRIKE':b.e.sprite==='spider-boss'&&b.turn%2===0?'VENOM BITE':b.e.hp<b.e.max/2?'ENRAGED ATTACK':'Standard attack'}let animatingTurn=false;
function encounterScreen(){
  const battle=bossFight;
  if(!battle||animatingTurn)return;
  const enemy=battle.e;
  const moves=[['attack',state.equipment?.weapon?'Strike':'Punch'],['guard','Guard'],['spell','Arc pulse · 10 MP'],['heal','Tonic'],['focus','Focus · +8 MP']];
  if(enemy.boss)moves.push(['trap',battle.trapUsed?'Trap spent':'Spring trap']);
  showModal('<div class="duel"><small>FLOOR '+state.floor+' · '+(enemy.boss?'GUARDIAN':'ENCOUNTER')+' · TURN '+battle.turn+'</small><h2>'+safeAttr(enemy.name)+'</h2><div class="duel-stage"><div class="fighter crawler"><img id="duelHero" alt=""><i></i></div><div class="fighter opponent '+(enemy.small?'small-mob':'')+'"><img src="'+safeAttr(enemy.sprite)+'.png" alt=""></div><span class="impact">✦</span></div><div class="duel-health"><span>You '+state.hp+'/'+state.maxHp+' HP</span><span>'+enemy.hp+'/'+enemy.max+' HP</span></div><p>'+safeAttr(battle.log)+'</p><small>'+state.mp+' MP · Incoming: '+bossIntent(battle)+'</small><div class="duel-actions">'+moves.map(([id,label])=>'<button class="widebtn" data-boss="'+id+'" '+((id==='trap'&&battle.trapUsed)||(id==='spell'&&state.mp<10)||(id==='heal'&&!state.inventory.some(i=>i.id==='tonic'&&i.qty>0))?'disabled':'')+'>'+label+'</button>').join('')+'</div></div>');
  $('#duelHero').src=crawlerPose('side',0).toDataURL();
  const stage=$('.duel-stage');stage.dataset.enemy=enemy.sprite;stage.style.setProperty('--fist',skinTones[state.character?.skin]||skinTones[2]);
  if(state.equipment?.weapon)stage.classList.add('armed');
  $$('[data-boss]').forEach(button=>button.onclick=()=>animateTurn(button.dataset.boss));
}
async function animateTurn(action){
  const battle=bossFight;
  if(!battle||animatingTurn||state.dead)return;
  const stage=$('.duel-stage');
  const strike=action==='attack'?state.power+Math.floor(Math.random()*5):0;
  const damage=strike+(action==='spell'?state.power*2+8+(state.spellBonus||0):action==='trap'?25+state.level*3:0)+(battle.assist||0);
  animatingTurn=true;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  try{
    $$('[data-boss]').forEach(button=>button.disabled=true);
    stage.dataset.move=action;
    if(damage>0)stage.querySelector('.impact').textContent='−'+damage;
    await wait(480);
    if(bossFight!==battle)return;
    if(damage<battle.e.hp){stage.classList.add('counter');await wait(460)}
    if(bossFight!==battle)return;
    animatingTurn=false;bossTurn(action,strike);
  }finally{animatingTurn=false}
}

function bossScreen(){encounterScreen()}
function bossTurn(action,strike){let b=bossFight;if(!b||state.dead)return;let e=b.e,intent=bossIntent(b),d=0,guard=false;if(action==='attack')d=strike??(state.power+Math.floor(Math.random()*5));if(action==='trap'){if(b.trapUsed){b.log='The arena trap is spent.';bossScreen();return}b.trapUsed=true;d=25+state.level*3;guard=true}if(action==='focus'){state.mp=Math.min(state.maxMp,state.mp+8)}if(action==='spell'){if(state.mp<10){b.log='Not enough mana.';bossScreen();return}state.mp-=10;d=state.power*2+8+(state.spellBonus||0)}if(action==='guard')guard=true;if(action==='heal'){let i=state.inventory.find(i=>i.id==='tonic'&&i.qty>0);if(!i){b.log='No health tonics left.';bossScreen();return}i.qty--;state.hp=Math.min(state.maxHp,state.hp+35)}d+=b.assist||0;b.assist=0;e.hp-=d;if(e.hp<=0){e.alive=false;e.deathAt=performance.now();state.kills++;if(!e.boss){
state.xp+=e.xp;state.gold+=5+Math.floor(Math.random()*12);bossFight=null;
const milestones={10:['Unlicensed Exterminator','Silver'],30:['The Neighborhood Is Quiet Now','Gold'],100:['Population Control Department','Celestial']};
if(milestones[state.kills])ridiculous(...milestones[state.kills]);
if(Math.random()<.08)awardBox('Bronze');
if(Math.random()<.4)entities.push({type:'loot',x:e.x,y:e.y,icon:'✦',name:'Dropped cache',alive:true});
closeModal();if(state.kills===1){unlock('First blood');ridiculous('Local Pest Control')}checkLevel();feed(e.name+' falls. Search its belongings with Loot.');persistCampaign();render();return
}state.xp+=e.xp+100;state.gold+=100;if(window.DCKNet?.isHost)for(let [id,p] of Object.entries(netPlayers))if(p.floor===state.floor&&Math.hypot(p.x-e.x,p.y-e.y)<=8)window.DCKNet.sendReward(id,50,e.xp||100,'tonic');if(state.achievements.includes('Management Has Been Terminated'))awardBox('Gold');else ridiculous('Management Has Been Terminated','Gold');checkLevel();$('#bossbar').classList.add('hidden');bossFight=null;showModal('<h2>GUARDIAN DEFEATED</h2><p>Gold loot box awarded. Loot the remains in the dungeon.</p><button class="widebtn" id="bossDone">CONTINUE</button>');if(state.floor===3&&state.foundKeeper){state.minersFree=true;caption('Iven','Hear that? Three bells. The cage is moving. My crew is going home.',true)}$('#bossDone').onclick=closeModal;save();render();return}let hit=Math.max(1,Math.floor((e.atk*(intent==='DEVASTATING STRIKE'?1.7:intent==='ENRAGED ATTACK'?1.25:1)-state.armor)*(guard?.25:1)));if(intent==='MANA DRAIN'&&!guard){state.mp=Math.max(0,state.mp-8);hit+=4}if(intent==='ARMOR SHATTER'&&!guard)hit+=Math.min(12,state.armor);if(intent==='VENOM BITE'&&!guard){b.poison=3}if(b.poison>0){hit+=3;b.poison--}state.hp=Math.max(0,state.hp-hit);b.log=(d?'You dealt '+d+' damage. ':guard?'You brace for impact. ':action==='focus'?'You recover mana. ':'You recover health. ')+'The guardian deals '+hit+' damage.';b.turn++;if(state.hp<=0){state.dead=true;bossFight=null;save();openDeath();return}persistCampaign();bossScreen();render()}
function attack(){if(state.chapter==='create'||state.chapter==='surface')return;if(state.dead||bossFight||sanctuaryAt(state.x,state.y))return;if(partyGuest()){if(!state.dead&&attackCooldown<=0){attackCooldown=.48;attackStarted=performance.now();window.DCKNet.sendIntent('attack');swingFx()}return}let guardian=entities.find(e=>e.boss&&e.alive&&(!state.arena||inArena(state.x,state.y))&&Math.hypot(e.x-state.x,e.y-state.y)<=2.15);if(guardian){beginBoss(guardian);return}if(state.dead||attackCooldown>0)return;attackCooldown=.48;attackStarted=performance.now();let targets=entities.filter(e=>e.alive&&Math.hypot(e.x-state.x,e.y-state.y)<=2.15);targets=targets.filter(e=>e.type==='enemy'&&!e.boss);if(!targets.length){swingFx();beep(110,.06);return}targets.sort((a,b)=>Math.hypot(a.x-state.x,a.y-state.y)-Math.hypot(b.x-state.x,b.y-state.y));let e=targets[0];if(!window.DCKNet?.inRoom){beginBoss(e);return}let dmg=state.power+Math.floor(Math.random()*5);e.hp-=dmg;particles.push({x:e.x,y:e.y,t:0,kind:'hit',text:'-'+dmg});swingFx();beep(230,.08,'sawtooth');feed('You strike '+e.name+' for <b>'+dmg+'</b> damage.');if(e.hp<=0){e.alive=false;e.deathAt=performance.now();state.kills++;if(state.kills===1)ridiculous('Local Pest Control');if(state.kills===10)ridiculous('Unlicensed Exterminator','Silver');if(state.kills===100)ridiculous('Population Control Department','Celestial');if(state.kills===100)ridiculous('Population Control Department','Celestial');if(state.kills===30)ridiculous('The Neighborhood Is Quiet Now','Gold');if(Math.random()<.08)awardBox('Bronze');if(e.boss)ridiculous('Management Has Been Terminated','Gold');state.xp+=e.xp;state.gold+=Math.floor(5+Math.random()*12);feed('<b>'+e.name+'</b> falls. Remains left behind. +'+e.xp+' XP.');particles.push({x:e.x,y:e.y,t:0,kind:'death'});checkLevel();if(state.kills>=1)unlock('First blood');if(e.boss){state.gold+=100;state.xp+=100;unlock('Warden breaker');ai('The Warden is down. The audience is… cautiously impressed.');$('#bossbar').classList.add('hidden')}if(Math.random()<.4)entities.push({type:'loot',x:e.x,y:e.y,icon:'✦',name:'Dropped cache',alive:true})}render();}
function swingFx(){particles.push({x:state.x,y:state.y,t:0,kind:'slash'})}
function dodge(){if(state.chapter==='create'||state.chapter==='surface')return;if(bossFight)return;if(state.dead||step)return;let dx=0,dy=0;if(keys.ArrowLeft||keys.a)dx=-1;else if(keys.ArrowRight||keys.d)dx=1;else if(keys.ArrowUp||keys.w)dy=-1;else if(keys.ArrowDown||keys.s)dy=1;if(!dx&&!dy){dx=state.facing==='left'?-1:state.facing==='right'?1:0;dy=state.facing==='up'?-1:state.facing==='down'?1:0;}for(let i=0;i<2;i++){if(!solid(state.x+dx,state.y+dy)&&!entities.some(e=>e.type==='enemy'&&e.alive&&e.x===state.x+dx&&e.y===state.y+dy)){state.x+=dx;state.y+=dy}}particles.push({x:state.x,y:state.y,t:0,kind:'dodge'});reveal();beep(420,.08,'triangle');render()}
function jump(){if(state.chapter==='create'||state.chapter==='surface')return;if(bossFight)return;if(state.dead||step)return;state.jumps=(state.jumps||0)+1;if(state.jumps===10)ridiculous('Gravity Is a Suggestion');jumpAt=performance.now();let dx=state.facing==='left'?-1:state.facing==='right'?1:0,dy=state.facing==='up'?-1:state.facing==='down'?1:0;let nx=state.x+dx,ny=state.y+dy;if(!solid(nx,ny)&&!entities.some(e=>e.alive&&e.x===nx&&e.y===ny)){particles.push({x:state.x,y:state.y,t:0,kind:'jump'});state.x=nx;state.y=ny;reveal();if(tile(nx,ny)===3)nextFloor();else render();notify('You leap across the flagstones.')}else{particles.push({x:state.x,y:state.y,t:0,kind:'jump'});notify('No room to jump there.')}beep(300,.08,'triangle')}
function spell(){if(state.chapter==='create'||state.chapter==='surface')return;if(state.dead||bossFight||sanctuaryAt(state.x,state.y))return;if(partyGuest()){if(!state.dead&&state.mp>=10){state.mp-=10;window.DCKNet.sendIntent('spell');particles.push({x:state.x,y:state.y,t:0,kind:'pulse'})}return}let guardian=entities.find(e=>e.boss&&e.alive&&(!state.arena||inArena(state.x,state.y))&&Math.hypot(e.x-state.x,e.y-state.y)<=4);if(guardian){beginBoss(guardian);return}if(!window.DCKNet?.inRoom){let target=entities.find(e=>e.type==='enemy'&&e.alive&&!e.boss&&Math.hypot(e.x-state.x,e.y-state.y)<=3.2);if(target){beginBoss(target);return}}
if(state.dead||state.mp<10){notify('Not enough mana.');return}state.mp-=10;state.spells=(state.spells||0)+1;if(state.spells===5)ridiculous('Unauthorized Indoor Fireworks');let hits=entities.filter(e=>e.type==='enemy'&&e.alive&&!e.boss&&Math.hypot(e.x-state.x,e.y-state.y)<=3.2);for(let e of hits){let d=16+Math.floor(state.power*.8)+(state.spellBonus||0);e.hp-=d;particles.push({x:e.x,y:e.y,t:0,kind:'magic',text:'-'+d});if(e.hp<=0){e.alive=false;e.deathAt=performance.now();state.kills++;if(state.kills===1)ridiculous('Local Pest Control');if(state.kills===10)ridiculous('Unlicensed Exterminator','Silver');if(state.kills===100)ridiculous('Population Control Department','Celestial');if(state.kills===30)ridiculous('The Neighborhood Is Quiet Now','Gold');if(Math.random()<.08)awardBox('Bronze');if(e.boss)ridiculous('Management Has Been Terminated','Gold');state.xp+=e.xp;state.gold+=8;if(e.boss){state.gold+=100;unlock('Warden breaker')}unlock('First blood');feed('<b>'+e.name+'</b> is consumed by arcane force.');checkLevel()}}particles.push({x:state.x,y:state.y,t:0,kind:'pulse'});feed('You unleash <b>Arc Pulse</b>. '+hits.length+' target(s) caught.');beep(520,.22,'sine');render()}
function takeDamage(n,e){if(state.dead)return;if(sanctuaryAt(state.x,state.y))return;hurtAt=performance.now();let d=Math.max(1,n-state.armor);state.hp=Math.max(0,state.hp-d);particles.push({x:state.x,y:state.y,t:0,kind:'hurt',text:'-'+d});feed('<b>'+e.name+'</b> hits you for '+d+' damage.');beep(90,.12,'sawtooth');if(state.hp<=0){state.dead=true;feed('<b>You have fallen.</b> The dungeon claims another crawler.');unlock('Down but not out');notify('CRAWLER DOWN — TAP REVIVE');save();setTimeout(()=>openDeath(),600)}}
function sanctuaryAt(x,y){return (state.sanctuaries||[state.safe].filter(Boolean)).find(q=>q.room?x>=q.room.x&&x<q.room.x+q.room.w&&y>=q.room.y&&y<q.room.y+q.room.h:Math.hypot(x-q.x,y-q.y)<=2)}function buildSanctuaries(){for(let q of state.sanctuaries){let candidates=[];for(let y=2;y<H-6;y++)for(let x=2;x<W-8;x++){let clear=true;for(let b=y-1;b<=y+4;b++)for(let a=x-1;a<=x+5;a++)if(tile(a,b)===1||tile(a,b)===3)clear=false;if(!clear)continue;for(let [dx,dy] of [[0,-2],[0,5],[-2,0],[6,0]]){let a=x+(dx===0?2:dx),b=y+(dy===0?1:dy);if(tile(a,b)===1)candidates.push({x,y,a,b,dx,dy})}}candidates.sort((a,b)=>Math.hypot(a.x-q.x,a.y-q.y)-Math.hypot(b.x-q.x,b.y-q.y));let c=candidates[0];if(!c)continue;let {x,y,a,b,dx,dy}=c;for(let j=y-1;j<=y+4;j++)for(let i=x-1;i<=x+5;i++)tiles[j][i]=(i>=x&&i<x+5&&j>=y&&j<y+4)?1:2;let door={x:dx<0?x-1:dx>0?x+5:x+2,y:dy<0?y-1:dy>0?y+4:y+1};tiles[door.y][door.x]=1;q.x=x+2;q.y=y+2;q.room={x,y,w:5,h:4};q.door=door;}state.sanctuaries=state.sanctuaries.filter(q=>q.room);if(state.sanctuaries.length)state.safe={x:state.sanctuaries[0].x,y:state.sanctuaries[0].y}}function enemyTick(dt){if(state.dead||bossFight||partyGuest())return;let guardian=entities.find(e=>e.boss&&e.alive&&Math.hypot(e.x-state.x,e.y-state.y)<=3);if(guardian&&!sanctuaryAt(state.x,state.y)&&(!state.arena||inArena(state.x,state.y))){beginBoss(guardian);return}if(state.npc&&!state.npc.met&&Math.random()<dt*.65){let n=state.npc,opts=[[1,0],[-1,0],[0,1],[0,-1]],a=opts[Math.floor(Math.random()*4)],x=n.x+a[0],y=n.y+a[1];if(!solid(x,y)&&tile(x,y)!==3&&!(x===state.x&&y===state.y)&&!entities.some(e=>e.alive&&e.x===x&&e.y===y)){n.x=x;n.y=y}}if(sanctuaryAt(state.x,state.y))return;for(let e of entities){if(!e.alive||e.type!=='enemy'||e.boss)continue;e.cool-=dt;if(Math.hypot(e.x-state.x,e.y-state.y)<1.4){if(!window.DCKNet?.inRoom){beginBoss(e);return}if(e.cool<=0){e.attackAt=performance.now();takeDamage(e.atk,e);e.cool=1.2+Math.random()*.45;if(state.dead)break}}else if(Math.hypot(e.x-state.x,e.y-state.y)<7&&Math.random()<dt*.72){let dx=Math.sign(state.x-e.x),dy=Math.sign(state.y-e.y);let opts=Math.random()<.5?[[dx,0],[0,dy]]:[[0,dy],[dx,0]];for(let [ax,ay] of opts)if((ax||ay)&&!(step&&e.x+ax===step.nx&&e.y+ay===step.ny)&&!solid(e.x+ax,e.y+ay)&&!sanctuaryAt(e.x+ax,e.y+ay)&&!entities.some(q=>q!==e&&q.alive&&q.x===e.x+ax&&q.y===e.y+ay)){e.x+=ax;e.y+=ay;break}}}}
function checkLevel(){while(state.xp>=state.nextXp){state.xp-=state.nextXp;state.level++;state.nextXp=Math.floor(state.nextXp*1.35);state.maxHp+=12;state.hp=state.maxHp;state.maxMp+=4;state.mp=state.maxMp;state.power+=2;state.skillPoints++;feed('<b>LEVEL UP!</b> You reached level '+state.level+'. Stats increased.');notify('LEVEL UP — LEVEL '+state.level);unlock('Getting stronger');beep(660,.2,'sine')}}
function awardBox(tier){let id='box-'+tier,it=state.inventory.find(i=>i.id===id);if(it)it.qty++;else state.inventory.push({id,name:tier+' loot box',icon:'🎁',qty:1,desc:'Open for randomized dungeon rewards.'});notify(tier.toUpperCase()+' LOOT BOX AWARDED');}function ridiculous(n,tier='Bronze'){if(state.achievements.includes(n))return;unlock(n);const bonus=tier!=='Bronze'||n==='Local Pest Control';if(bonus)awardBox(tier);achievementBanner(n,bonus?tier:null);ai('NEW ACHIEVEMENT: '+n+'.'+(bonus?' A '+tier+' box lands in your backpack.':' The audience noticed.'));if(tab==='inventory')openTab(tab)}function achievementBanner(n,tier){let el=document.getElementById('achievementBanner');if(!el){el=document.createElement('div');el.id='achievementBanner';document.body.appendChild(el)}el.textContent='NEW ACHIEVEMENT! • '+n+(tier?' • '+tier+' LOOT BOX':'');el.classList.remove('active');void el.offsetWidth;el.classList.add('active');setTimeout(()=>el.classList.remove('active'),4200)}function unlock(n){if(!state.achievements.includes(n)){state.achievements.push(n);feed('Achievement unlocked: <b>'+n+'</b>.');}}
const rewardCatalog=[
 {id:'dock-knife',name:'Dock knife',slot:'weapon',look:'knife',icon:'⚔',mods:{power:3}},
 {id:'raincoat',name:'Riveted raincoat',slot:'armor',look:'coat',icon:'⬟',mods:{armor:3}},
 {id:'rail-hammer',name:'Rail hammer',slot:'weapon',look:'hammer',icon:'⚒',mods:{power:6,armor:-2}},
 {id:'storm-glass',name:'Stormglass pendant',slot:'charm',look:'glass',icon:'◆',mods:{spellBonus:6,power:-2}},
 {id:'cold-iron',name:'Cold iron ward',slot:'charm',look:'iron',icon:'◈',mods:{armor:-2,spellBonus:-1}},
 {id:'bell-ring',name:'Brass bell charm',slot:'charm',look:'bell',icon:'♢',mods:{armor:2}},
 {id:'echo-mail',name:'Echo mail',slot:'armor',look:'mail',icon:'⬡',mods:{armor:5,spellBonus:-3}},
 {id:'ember-tea',name:'Ember tea',icon:'♨',effect:'buff'},
 {id:'undertow',name:'Boon of the Undertow',icon:'≈',effect:'boon'}
];
function rollReward(tier){
  const item=rewardCatalog[Math.floor(Math.random()*rewardCatalog.length)];
  const rank=({Bronze:1,Silver:2,Gold:3,Legendary:4,Celestial:5})[tier]||1;
  const mods=Object.fromEntries(Object.entries(item.mods||{}).map(([key,n])=>[key,n>0?n+rank-1:n]));
  const label={power:'power',armor:'armor',spellBonus:'spell damage'};
  const desc=item.effect==='buff'?'Gain '+(2+rank)+' power until you leave this floor. Replaces any active tea.':
    item.effect==='boon'?'Spend 5 mana to learn a permanent +'+rank+' spell damage.':
    Object.entries(mods).map(([key,n])=>(n>0?'+':'')+n+' '+label[key]).join(' · ');
  const reward={...item,id:item.id+'-'+rank,mods,rank,name:item.name,qty:1,desc};
  const existing=state.inventory.find(i=>i.id===reward.id);
  if(existing)existing.qty++;else state.inventory.push(reward);
  return reward;
}
function equipItem(item){
  state.equipment??={};
  const previous=state.inventory.find(i=>i.id===state.equipment[item.slot]);
  function apply(piece,sign){
    if(!piece)return;
    const mods=piece.mods||{[piece.slot==='weapon'?'power':'armor']:piece.bonus||0};
    for(const [stat,n] of Object.entries(mods))state[stat]=(state[stat]||0)+n*sign;
  }
  apply(previous,-1);
  if(previous===item)delete state.equipment[item.slot];
  else{apply(item,1);state.equipment[item.slot]=item.id}
}
function useItem(id){let it=state.inventory.find(i=>i.id===id&&i.qty>0);if(!it)return;
if(it.slot){equipItem(it);save();render();openTab('inventory');return}
if(it.effect==='buff'){state.power-=state.teaPower||0;state.teaPower=2+it.rank;state.power+=state.teaPower;it.qty--;notify('Ember tea active on this floor.')}
else if(it.effect==='boon'){if(state.mp<5){notify('Requires 5 MP.');return}state.mp-=5;state.spellBonus=(state.spellBonus||0)+it.rank;it.qty--;notify('Spell boon learned.')}
else if(id.startsWith('box-')){it.qty--;const tier=id.slice(4),reward=rollReward(tier);showModal('<div class="box-reveal"><h2>'+safeAttr(tier)+' loot box</h2><div class="reward-chest">'+reward.icon+'</div><h3>'+reward.name+'</h3><p>'+reward.desc+'</p><button class="widebtn" id="rewardDone">Back to backpack</button></div>');$('#rewardDone').onclick=backpack;feed('Unboxed '+reward.name+'.')}else if(id==='tonic'){let v=Math.min(35,state.maxHp-state.hp);if(!v){notify('Health already full.');return}state.hp+=v;it.qty--;feed('Health tonic restores '+v+' HP.')}else if(id==='shard'){let v=Math.min(20,state.maxMp-state.mp);if(!v){notify('Mana already full.');return}state.mp+=v;it.qty--;feed('Mana shard restores '+v+' MP.')}else if(id==='torch'){state.torchTurns=40;it.qty--;reveal();feed('You light a torch. The shadows retreat.')}save();render();if(!id.startsWith('box-'))openTab('inventory')}
function addItem(){let name=prompt('Name your custom item:');if(!name)return;state.inventory.push({id:'custom-'+Date.now(),name:safeAttr(name),icon:'✧',qty:1,desc:'Custom campaign item. Define its effect in a future content update.'});feed('Added custom item: <b>'+safeAttr(name)+'</b>.');render();openTab('inventory')}
function nextFloor(){if(state.chapter==='surface'){
state.chapter='mine';generate();$('#objective').textContent='FIND THE STAIRS • SURVIVE';
caption('Beneath Seattle','Street noise fades above you. A blue bell rope trails under Seattle. Beside it, someone has scratched three words: Find the keeper.',true);
persistCampaign();return}
if(partyGuest()){notify('Wait for the party host to descend.');return}if(entities.some(e=>e.boss&&e.alive)){notify('Defeat the guardian before descending.');return}ridiculous('Elevator Out of Service','Silver');state.floor++;state.hp=Math.min(state.maxHp,state.hp+18);state.mp=Math.min(state.maxMp,state.mp+8);state.gold+=10;unlock('Deeper down');feed('You descend to floor '+state.floor+'. +10 gold, recovered vitality.');generate();$('#floorTag').textContent='FLOOR '+String(state.floor).padStart(2,'0');$('#roomName').textContent=names[(state.floor-1)%names.length].toUpperCase();
const reports={
2:['Iven’s radio','Elliott Bay is leaking through the west wall. Follow the blue pipes to the cage motor.'],
3:['Rescue frequency','The SoDo lift is drawing power again. Something is holding the cage below the platform.'],
4:['Mara','Look up through the grate. That light over Capitol Hill is answering our bell.'],
5:['Mara','The Lake Union archive has the original wiring plans. Find where the signal leaves the city.'],
6:['Rescue frequency','Queen Anne relay online. Seattle can hear us. Keep the channel open.']
};
if(state.floor===4)reports[4][1]+=' Race and class selection are now open. Use Character and Skills.';
if(reports[state.floor])caption(...reports[state.floor],true);
save()}
function openDeath(){showModal(`<h2>THE DUNGEON CLAIMS YOU</h2><p>You reached floor ${state.floor}, defeated ${state.kills} enemies, and reached level ${state.level}.</p><p>Your run can continue, but the dungeon will take a toll.</p><button class="widebtn" id="reviveBtn">REVIVE AT ENTRANCE</button><button class="widebtn danger" id="resetBtn">START A NEW RUN</button>`);$('#reviveBtn').onclick=()=>{if(state.collapsed){startStory();return}state.dead=false;state.hp=Math.min(state.maxHp,Math.max(30,Math.floor(state.maxHp*.5)));state.x=state.safe?.x??state.x;state.y=state.safe?.y??state.y;feed('You claw your way back from the brink.');render();save();closeModal()};$('#resetBtn').onclick=()=>{startStory()}}
function writeCampaign(){
const encounter=bossFight?{...bossFight,e:entities.indexOf(bossFight.e)}:null;
localStorage.setItem(saveKey,JSON.stringify({state,tiles,seen,entities,encounter}));
}
function persistCampaign(){try{writeCampaign()}catch{}}
function save(){try{writeCampaign();notify('CAMPAIGN SAVED');}catch(e){notify('Save unavailable on this browser.')}}function load(){try{let o=JSON.parse(localStorage.getItem(saveKey));if(o?.state&&o.tiles){state=o.state;tiles=o.tiles;W=tiles[0].length;H=tiles.length;state.collapseLeft??=900;state.warned??=[];seen=o.seen;entities=o.entities||[];
if(state.floor<4){
 if(state.character)state.character.race='Human';
 if(state.specialization)removeClass();
 entities.forEach((e,i)=>{
 if(e.type!=='enemy'||e.small)return;
 const rat=!e.boss&&i%2===0;
 const max=e.boss?48:(rat?7:13)+state.floor*2;
 e.hp=e.alive?Math.max(1,Math.round(max*e.hp/e.max)):0;
 Object.assign(e,{small:true,max,sprite:rat?'sewer-rat':'goblin',name:e.boss?'Pip, Keeper of the Cage':rat?'Drain rat':'Tunnel goblin',atk:e.boss?5:(rat?1:2)+state.floor});
 });
}
state.dead=!!(state.dead||state.collapsed||state.hp<=0);
const guardian=entities[o.encounter?.e];
if(!state.dead&&guardian?.type==='enemy'&&guardian.alive)bossFight={...o.encounter,e:guardian};
return true}}catch(e){}return false}
function inArena(x,y){let a=state.arena;return !!a&&x>=a.x&&x<a.x+a.w&&y>=a.y&&y<a.y+a.h}const terrainCache=new Map();
function terrainArt(biome,variant,wall){let key=[biome,variant,wall].join(':');if(terrainCache.has(key))return terrainCache.get(key);let c=document.createElement('canvas');c.width=c.height=32;let g=c.getContext('2d'),r=rng(1009+biome*997+variant*53+(wall?9999:0));let pal=[['#34434a','#46545a','#202d35'],['#55413a','#735749','#342822'],['#34483c','#4c624a','#24372d'],['#344957','#516b78','#23343e'],['#42394e','#62536d','#292535'],['#52352d','#775044','#342521']][biome];let f=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(x,y,w,h)};f(0,0,32,32,pal[2]);for(let row=0;row<3;row++){let y=row*11;for(let x=-(row%2)*8;x<32;x+=16){f(x+1,y+1,14,9,pal[0]);f(x+1,y+1,14,1,pal[1]);f(x+1,y+2,1,7,pal[1]);for(let k=0;k<6;k++)f(x+2+Math.floor(r()*11),y+3+Math.floor(r()*5),1+Math.floor(r()*2),1,r()<.5?'#ffffff12':'#00000025')}}if(wall){f(0,0,32,3,pal[1]);f(0,26,32,6,pal[2]);f(0,26,32,1,'#0008')}terrainCache.set(key,c);return c}
function drawTile(x,y,t){if(state.chapter==="surface"||state.chapter==="create")return surfaceTile(x,y,t);const px=x*TILE,py=y*TILE,seed=Math.abs(Math.sin(x*12.9898+y*78.233)*43758.5453)%1;if(t===0){ctx.fillStyle='#080c11';ctx.fillRect(px,py,TILE,TILE);return}if(t===2){ctx.fillStyle='#151f28';ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle=seed>.5?'#26323b':'#202c35';ctx.fillRect(px+1,py+1,30,29);ctx.fillStyle='#10171d';ctx.fillRect(px+2,py+14,28,2);ctx.fillStyle='#52616a';ctx.fillRect(px+2,py+2,28,2);ctx.fillStyle='#090e14';ctx.fillRect(px+1,py+26,30,5);for(let i=0;i<9;i++){ctx.fillStyle=i%2?'#ffffff0d':'#00000025';ctx.fillRect(px+3+(i*7+x*3)%25,py+4+(i*11+y*5)%20,3,2)}ctx.fillRect(px+14,py+2,2,12);ctx.fillRect(px+21,py+16,2,13);ctx.fillStyle='#43515a';ctx.fillRect(px+4,py+4,8,1);ctx.fillRect(px+18,py+19,9,1);ctx.fillStyle='#0b1117';ctx.fillRect(px+3,py+28,25,2);ctx.drawImage(terrainArt((state.floor-1)%6,Math.floor(seed*12),true),px,py);if(seed>.91){let flicker=Math.sin(performance.now()/95+x*7+y)*.15+.85;let glow=ctx.createRadialGradient(px+8,py+7,1,px+8,py+7,25);glow.addColorStop(0,'rgba(255,171,73,'+(.25*flicker)+')');glow.addColorStop(1,'rgba(255,171,73,0)');ctx.fillStyle=glow;ctx.fillRect(px-17,py-18,50,50);ctx.fillStyle='#c17b42';ctx.fillRect(px+7,py+7,3,7);ctx.fillStyle='#ffb45e';ctx.fillRect(px+8,py+4,2,4);ctx.fillStyle='#e48a43';ctx.fillRect(px+5,py+6,7,2)}}else{let palettes=[['#49463c','#3b3932','#34332e'],['#514039','#40322e','#332824'],['#3e4940','#303b34','#27322c'],['#394750','#303c46','#26323b'],['#484054','#393345','#30293b'],['#584036','#47312b','#362522']];let pal=palettes[(state.floor-1)%palettes.length];let tone=pal[seed>.72?0:seed>.38?1:2];ctx.fillStyle=tone;ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle='#555044';ctx.fillRect(px+1,py+1,30,1);for(let i=0;i<13;i++){let a=(x*17+y*11+i*13)%28+2,b=(x*7+y*19+i*9)%28+2;ctx.fillStyle=i%3?'#00000016':'#ffffff13';ctx.fillRect(px+a,py+b,2+i%3,1+i%2)}ctx.fillRect(px+1,py+1,1,30);ctx.fillStyle='#292b29';ctx.fillRect(px+1,py+30,30,1);ctx.fillRect(px+30,py+1,1,30);ctx.fillStyle='#252927';ctx.fillRect(px+((x*7+y*3)%23)+4,py+((x*11+y*5)%22)+4,2,2);if(seed>.82){ctx.strokeStyle='#77705d';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px+7,py+6);ctx.lineTo(px+11,py+11);ctx.lineTo(px+9,py+16);ctx.stroke()}if(seed>.93){ctx.fillStyle='#211d19';ctx.fillRect(px+6,py+19,12,5);ctx.fillStyle='#918574';ctx.fillRect(px+8,py+17,3,8);ctx.fillRect(px+13,py+19,7,2)}if(seed<.12){ctx.fillStyle='#68724d';ctx.fillRect(px+4,py+24,5,2);ctx.fillRect(px+7,py+22,2,2)}}if(t===1){ctx.drawImage(terrainArt((state.floor-1)%6,Math.floor(seed*12),false),px,py);let biome=(state.floor-1)%6;if(biome===2&&seed<.22){ctx.fillStyle='#203f36';ctx.fillRect(px+4,py+8,22,17);ctx.fillStyle='#57816a';ctx.fillRect(px+7,py+12+Math.floor(performance.now()/450)%3,13,1)}if(biome===3&&seed<.25){ctx.fillStyle='#648b9b';ctx.fillRect(px+3,py+20,14,2);ctx.fillStyle='#a1c7cf';ctx.fillRect(px+6,py+17,5,2)}if(biome===5&&seed<.2){ctx.fillStyle='#8b3926';ctx.fillRect(px+3,py+8,3,19);ctx.fillRect(px+6,py+25,12,2);ctx.fillStyle='#e18b43';ctx.fillRect(px+4,py+11,1,12)}for(let j=0;j<2;j++){let off=(j*16+(y%2)*8)%32;ctx.fillStyle='#171b1b55';ctx.fillRect(px,py+j*16+15,32,1);ctx.fillRect(px+off,py+j*16,1,16);ctx.fillStyle='#c3b28b18';ctx.fillRect(px+1,py+j*16+1,30,1)}if(seed<.08){ctx.fillStyle='#394b36';for(let k=0;k<8;k++)ctx.fillRect(px+2+(k*7)%12,py+18+(k*3)%12,3,2)}if(tile(x,y-1)===2){ctx.fillStyle='#00000038';ctx.fillRect(px,py,32,6);ctx.fillStyle='#a69a7518';ctx.fillRect(px,py+6,32,1)}if(seed>.96){ctx.fillStyle='#30271e';ctx.fillRect(px+5,py+8,10,10);ctx.fillStyle='#826344';ctx.fillRect(px+6,py+9,8,8);ctx.fillStyle='#b28b56';ctx.fillRect(px+6,py+10,8,1);ctx.fillStyle='#4b3525';ctx.fillRect(px+9,py+9,2,8)}}if(state.arena?.gates?.some(g=>g.x===x&&g.y===y)){ctx.fillStyle='#69513b';ctx.fillRect(px+2,py+2,28,3);ctx.fillRect(px+2,py+27,28,3);let closed=bossFight?1:0;for(let i=0;i<5;i++){let h=closed?24:5;ctx.fillStyle='#a7a39a';ctx.fillRect(px+5+i*5,py+4,2,h)}}if(t===1&&inArena(x,y)){ctx.fillStyle='#9a463133';ctx.fillRect(px,py,32,32);ctx.strokeStyle='#a57b48';ctx.strokeRect(px+3,py+3,26,26);if(seed>.65){ctx.fillStyle='#a35e37';ctx.fillRect(px+14,py+8,4,16);ctx.fillRect(px+8,py+14,16,4)}}if(t===3){let g=ctx.createRadialGradient(px+16,py+16,2,px+16,py+16,25);g.addColorStop(0,'#ffe7a0');g.addColorStop(.35,'#d79c49');g.addColorStop(1,'#8b542500');ctx.fillStyle=g;ctx.fillRect(px-5,py-5,42,42);ctx.fillStyle='#8b6338';ctx.fillRect(px+6,py+6,20,21);ctx.fillStyle='#f0c66d';for(let i=0;i<4;i++)ctx.fillRect(px+8+i*4,py+8+i*3,14-i*4,2)}}
function drawRemains(e){const px=e.x*TILE,py=e.y*TILE;let age=performance.now()-(e.deathAt||-1000);if(age>=0&&age<300){ctx.save();ctx.globalAlpha=1-age/300;spriteDraw(enemySprite(e),px+16,py+25,39,43*(1-age/400));ctx.restore();return}ctx.save();ctx.globalAlpha=.78;ctx.fillStyle='#c8c9c1';ctx.beginPath();ctx.arc(px+16,py+16,4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#818b8b';ctx.fillRect(px+8,py+18,16,3);ctx.fillRect(px+10,py+22,5,2);ctx.fillRect(px+18,py+22,5,2);ctx.fillStyle='#252b2d';ctx.fillRect(px+14,py+15,2,2);ctx.fillRect(px+19,py+15,2,2);ctx.restore()}

function spriteDraw(name,x,y,w,h){const im=sprites[name];if(!im||!im.complete||!im.naturalWidth)return false;ctx.drawImage(im,x-w/2,y-h+TILE*.18,w,h);return true}
// Original pixel-art walking poses, drawn on a 24x32 pixel canvas.
const walkArt=new Map();
function gearLook(){
  const look={};
  for(const slot of ['weapon','armor','charm']){
    const id=state?.equipment?.[slot];if(!id)continue;
    const item=state.inventory.find(i=>i.id===id);
    if(item)look[slot]=item.look||({weapon:'knife',armor:'steel',charm:'bell'})[slot];
  }
  return look;
}
function crawlerPose(dir,frame,character=state?.character,look=gearLook()){let key=[dir,frame,character?.race,character?.skin,look.armor,look.weapon,look.charm].join('/');if(walkArt.has(key))return walkArt.get(key);let c=document.createElement('canvas');c.width=24;c.height=32;let g=c.getContext('2d');let rect=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(x,y,w,h)},poly=(pts,col)=>{g.fillStyle=col;g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill()};let side=dir==='side',back=dir==='up',stride=frame===1?1:frame===3?-1:0;
const skin=skinTones[character?.skin]||skinTones[2];
for(let leg=0;leg<2;leg++){
  const x=(side?9:7)+leg*(side?3:6),lift=leg?stride:-stride;
  rect(x,19+lift,4,9,'#37485a');rect(x-1,27+lift,6,3,'#53504b');rect(x-1,30+lift,6,1,'#c3bda9');
}
rect(7,11,10,10,'#667565');rect(8,12,2,8,'#879581');rect(7,20,10,2,'#495b50');
for(let arm=0;arm<2;arm++){const x=arm?16:5,y=12+(arm?stride:-stride);rect(x,y,3,4,'#687667');rect(x,y+4,3,4,skin)}
rect(9,3,7,8,skin);rect(8,3,9,3,'#40332e');rect(9,2,6,2,'#51413a');
if(back)rect(9,5,7,5,'#40332e');else{rect(8,5,2,3,'#40332e');rect(side?15:14,6,1,1,'#312c2a');if(!side)rect(10,6,1,1,'#312c2a')}
if(look.armor){const coat=look.armor==='coat';rect(6,12,12,coat?12:8,coat?'#ac843c':look.armor==='mail'?'#55779c':'#687781');rect(8,13,8,1,coat?'#edc678':'#b1c8da');rect(12,14,1,6,'#403e43')}
if(look.weapon){const x=back?5:18;rect(x,16,2,9,'#835b38');if(look.weapon==='hammer'){rect(x-3,12,8,5,'#8d9097');rect(x-3,12,7,1,'#d3d6db')}else{rect(x,9,2,9,'#d8e6e5');rect(x-2,17,6,1,'#ba9362')}}
if(look.charm){rect(11,12,3,2,'#dec789');rect(11,14,3,4,look.charm==='glass'?'#78e5f2':look.charm==='iron'?'#9696a9':'#e0aa41')}
if(character?.race==='Elf'&&!back){rect(side?13:7,8,2,2,skinTones[character.skin]);rect(side?12:6,7,1,2,skinTones[character.skin])}
if(character?.race==='Dwarf'){rect(5,14,4,3,'#b18954');rect(15,14,4,3,'#b18954');rect(10,15,4,3,'#cea668')}
walkArt.set(key,c);return c}
function drawHero(x,y){let now=performance.now(),px=x*TILE,ground=y*TILE+27,py=ground-Math.max(0,Math.sin(Math.PI*Math.min(1,Math.max(0,(now-jumpAt)/420))))*14;ctx.fillStyle='#0008';ctx.beginPath();ctx.ellipse(px+16,ground,9,3,0,0,Math.PI*2);ctx.fill();let dir=state.facing==='up'?'up':state.facing==='down'?'down':'side',p=step?Math.min(1,Math.max(0,(now-step.start)/STEP_MS)):0,frame=step?(p<.18||p>.85?0:stepCount%2?1:3):0;ctx.save();ctx.translate(px+16,py);if(state.facing==='left')ctx.scale(-1,1);ctx.imageSmoothingEnabled=false;if(now-hurtAt<160)ctx.globalAlpha=.55;ctx.drawImage(crawlerPose(dir,frame),-12,-32,24,32);ctx.globalAlpha=1;if(attackCooldown>.02&&state.equipment?.weapon){let phase=Math.min(1,(now-attackStarted)/480),angle=-2.4+phase*4.8;ctx.save();ctx.translate(7,-15);ctx.rotate(angle);ctx.fillStyle='#614b36';ctx.fillRect(-2,-2,4,7);ctx.fillStyle='#d8e0dc';ctx.fillRect(-1,-19,3,17);ctx.fillStyle='#fff2cf';ctx.fillRect(-1,-19,1,14);ctx.fillStyle='#b38a4f';ctx.fillRect(-4,-3,8,2);ctx.restore();ctx.strokeStyle='rgba(245,214,160,'+(1-phase)+')';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-12,17,angle-.8,angle+.2);ctx.stroke()}ctx.restore()}
function enemySprite(e){if(e.boss)return e.sprite||'bone-champion';return e.sprite||'skeleton'}
const enemyMotion=new WeakMap();
function drawEnemy(e){let now=performance.now(),m=enemyMotion.get(e);if(!m){m={x:e.x,y:e.y,fromX:e.x,fromY:e.y,start:now,hp:e.hp,hit:0};enemyMotion.set(e,m)}if(m.x!==e.x||m.y!==e.y){m.fromX=m.x;m.fromY=m.y;m.x=e.x;m.y=e.y;m.start=now}if(e.hp<m.hp)m.hit=now;m.hp=e.hp;let p=Math.min(1,(now-m.start)/150),px=(m.fromX+(m.x-m.fromX)*p)*TILE,py=(m.fromY+(m.y-m.fromY)*p)*TILE;ctx.fillStyle='#0009';ctx.beginPath();ctx.ellipse(px+16,py+27,e.boss?14:10,4,0,0,Math.PI*2);ctx.fill();ctx.save();if(now-m.hit<120)ctx.globalAlpha=.55;let stride=p<1?Math.sin(p*Math.PI)*2:0;let strike=Math.max(0,1-(now-(e.attackAt||-1000))/180);px+=(state.x-e.x)*5*strike;py+=(state.y-e.y)*5*strike;let base=enemySprite(e),w=e.small?(e.sprite==='sewer-rat'?20:e.boss?28:23):e.boss?54:39,h=e.small?(e.sprite==='sewer-rat'?14:e.boss?31:26):e.boss?53:43;spriteDraw(base,px+16,py+25-stride,w,h);ctx.restore();ctx.fillStyle='#3a1717';ctx.fillRect(px+5,py+1,22,3);ctx.fillStyle=e.boss?'#e2a65f':'#d45a55';ctx.fillRect(px+5,py+1,22*Math.max(0,e.hp/e.max),3)}
function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);if(visualFloor!==state.floor||visualX===null){visualX=state.x;visualY=state.y;visualFloor=state.floor}let zoom=canvas.clientWidth<700?2.85:2.15;let camX=visualX*TILE-canvas.width/(2*zoom)+TILE/2,camY=visualY*TILE-canvas.height/(2*zoom)+TILE/2;ctx.imageSmoothingEnabled=false;ctx.save();ctx.scale(zoom,zoom);ctx.translate(-camX,-camY);for(let y=Math.max(0,Math.floor(camY/TILE)-2);y<Math.min(H,Math.ceil((camY+canvas.height/zoom)/TILE)+2);y++)for(let x=Math.max(0,Math.floor(camX/TILE)-2);x<Math.min(W,Math.ceil((camX+canvas.width/zoom)/TILE)+2);x++){if(!seen[y][x]){ctx.fillStyle='#030609';ctx.fillRect(x*TILE,y*TILE,TILE,TILE)}else drawTile(x,y,tiles[y][x])}for(let e of entities){if(!seen[e.y]?.[e.x])continue;if(e.type==='loot'&&e.alive){ctx.fillStyle='#e4c16a';ctx.fillRect(e.x*TILE+12,e.y*TILE+12,9,9);ctx.fillStyle='#fff0b3';ctx.fillRect(e.x*TILE+14,e.y*TILE+10,5,3)}else if(e.type==='enemy'&&e.alive)drawEnemy(e);else if(e.type==='enemy'&&!e.alive&&!e.looted)drawRemains(e)}for(let q of state.sanctuaries||[state.safe].filter(Boolean)){if(!seen[q.y]?.[q.x])continue;ctx.save();ctx.fillStyle='#71cfa222';if(q.room){ctx.fillRect(q.room.x*TILE,q.room.y*TILE,q.room.w*TILE,q.room.h*TILE);ctx.strokeStyle='#71cfa2';ctx.lineWidth=2;ctx.strokeRect(q.room.x*TILE+2,q.room.y*TILE+2,q.room.w*TILE-4,q.room.h*TILE-4);let bx=q.room.x*TILE+5,by=q.room.y*TILE+5;ctx.fillStyle='#654a32';ctx.fillRect(bx,by,24,43);ctx.fillStyle='#d0c6a5';ctx.fillRect(bx+3,by+3,18,10);ctx.fillStyle='#426a59';ctx.fillRect(bx+3,by+14,18,25);ctx.fillStyle='#986c36';ctx.fillRect(bx+110,by+4,28,20);ctx.fillStyle='#d6b36a';ctx.fillRect(bx+121,by+12,6,6);ctx.fillStyle='#c6a66b';let dx=q.door.x*TILE,dy=q.door.y*TILE,near=Math.hypot(visualX-q.door.x,visualY-q.door.y)<2,open=near?1:0;q.doorAnim=(q.doorAnim||0)+(open-(q.doorAnim||0))*.18;let gap=Math.round(q.doorAnim*12);ctx.fillStyle='#503c29';ctx.fillRect(dx+2,dy+2,28,5);ctx.fillStyle='#c6a66b';ctx.fillRect(dx+3,dy+3,13-gap,4);ctx.fillRect(dx+16+gap,dy+3,13-gap,4);ctx.fillStyle='#71cfa222'}else{ctx.beginPath();ctx.arc((q.x+.5)*TILE,(q.y+.5)*TILE,2*TILE,0,Math.PI*2);ctx.fill()}ctx.fillStyle='#71cfa2';ctx.font='bold 17px monospace';ctx.fillText('✚',q.x*TILE+8,q.y*TILE+18);ctx.restore()}if(state.npc&&!state.npc.met&&seen[state.npc.y]?.[state.npc.x]){spriteDraw('hero-front',state.npc.x*TILE+16,state.npc.y*TILE+25,30,44);ctx.fillStyle='#7ce4df';ctx.font='10px monospace';ctx.fillText(state.floor===1?'ROPE KEEPER':'CRAWLER',state.npc.x*TILE-8,state.npc.y*TILE-24)}drawHero(visualX,visualY);for(const [id,p] of Object.entries(netPlayers)){if(p.floor!==state.floor)continue;const px=p.x*TILE+16,py=p.y*TILE+25;ctx.save();ctx.globalAlpha=.82;ctx.strokeStyle='#65c9d5';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px,py-18,15,0,Math.PI*2);ctx.stroke();ctx.drawImage(crawlerPose('down',0,p.character||{},p.gear||{}),px-12,py-30,24,32);ctx.fillStyle='#a7e6ee';ctx.font='10px monospace';ctx.textAlign='center';ctx.fillText((p.name||'ALLY').slice(0,10),px,py-51);ctx.restore();}
for(let p of particles){let x=p.x*TILE+16,y=p.y*TILE+16;if(p.kind==='slash'){ctx.strokeStyle='#f4d18a';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,23,0,Math.PI*2);ctx.stroke()}if(p.kind==='pulse'){ctx.strokeStyle='#60c9e2';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,15+p.t*100,0,Math.PI*2);ctx.stroke()}if(p.kind==='magic'||p.kind==='hit'||p.kind==='hurt'){ctx.fillStyle=p.kind==='magic'?'#77d9ee':'#f0a18b';ctx.font='bold 15px monospace';ctx.fillText(p.text||'',x,y-p.t*24)}if(p.kind==='death'||p.kind==='dodge'||p.kind==='jump'){ctx.fillStyle=p.kind==='death'?'#d6d8d4':'#9fdbe2';ctx.globalAlpha=Math.max(0,1-p.t*2);ctx.fillRect(x-7,y-7,14,14);ctx.globalAlpha=1}}
ctx.restore();let glow=ctx.createRadialGradient(canvas.width/2,canvas.height/2,40,canvas.width/2,canvas.height/2,canvas.width*(state.torchTurns>0?.68:.43));glow.addColorStop(0,'rgba(255,177,83,.08)');glow.addColorStop(.5,'rgba(0,0,0,0)');glow.addColorStop(1,'rgba(2,5,12,.78)');ctx.fillStyle=glow;ctx.fillRect(0,0,canvas.width,canvas.height);if(performance.now()-hurtAt<220){ctx.fillStyle='rgba(180,20,25,.15)';ctx.fillRect(0,0,canvas.width,canvas.height)}}
function drawMini(){let m=$('#minimap'),w=m.width,h=m.height;mini.fillStyle='#070b0f';mini.fillRect(0,0,w,h);let s=Math.min(w/W,h/H);let ox=(w-W*s)/2,oy=(h-H*s)/2;for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!seen[y][x])continue;mini.fillStyle=inArena(x,y)&&tiles[y][x]===1?'#9d6549':tiles[y][x]===2?'#26323a':tiles[y][x]===3?'#d6a65a':'#655e50';mini.fillRect(ox+x*s,oy+y*s,Math.ceil(s),Math.ceil(s))}for(let e of entities){if(!e.alive||!seen[e.y]?.[e.x])continue;mini.fillStyle=e.type==='loot'?'#d6a65a':'#e34e4b';mini.beginPath();mini.arc(ox+(e.x+.5)*s,oy+(e.y+.5)*s,2.6,0,Math.PI*2);mini.fill()}for(let e of entities.filter(e=>!e.alive&&e.type==='enemy'&&!e.looted)){if(!seen[e.y]?.[e.x])continue;mini.fillStyle='#eee';mini.fillRect(ox+(e.x+.3)*s,oy+(e.y+.3)*s,3,3)}for(let q of state.sanctuaries||[state.safe].filter(Boolean)){if(seen[q.y]?.[q.x]){mini.fillStyle='#71cfa2';mini.fillRect(ox+(q.x+.5)*s-2,oy+(q.y+.5)*s-2,4,4)}}mini.fillStyle='#f2d36e';mini.beginPath();mini.arc(ox+(state.x+.5)*s,oy+(state.y+.5)*s,3.5,0,Math.PI*2);mini.fill();for(const p of Object.values(netPlayers)){if(p.floor!==state.floor)continue;mini.fillStyle='#65c9d5';mini.beginPath();mini.arc(ox+(p.x+.5)*s,oy+(p.y+.5)*s,3,0,Math.PI*2);mini.fill()}}
function drawFieldMap(){let m=$('#fieldMini');if(m){let c=m.getContext('2d');c.clearRect(0,0,m.width,m.height);c.drawImage($('#minimap'),0,0,m.width,m.height)}}function drawPortrait(){portrait.fillStyle='#0b1117';portrait.fillRect(0,0,96,96);if(state.character){portrait.imageSmoothingEnabled=false;portrait.drawImage(crawlerPose('down',0),12,0,72,96);return}const im=sprites['hero-front'];if(im?.complete&&im.naturalWidth){let h=88,w=h*im.naturalWidth/im.naturalHeight;portrait.drawImage(im,(96-w)/2,4,w,h)}else{portrait.fillStyle='#1c2b36';portrait.fillRect(18,16,60,65)}portrait.strokeStyle='#a98852';portrait.strokeRect(1,1,94,94)}
function renderFeed(){let el=$('#feed');if(!el)return;el.innerHTML=(state.feed||[]).slice(0,9).map(x=>`<div class="feed-line"><span class="time">${x.tm}</span>${x.s}</div>`).join('')||'<div class="feed-line">The dungeon is quiet. For now.</div>'}
function render(){if(!state)return;let hud=$('#fieldHud');if(hud)hud.innerHTML=`<div class="field-stat">HP ${state.hp}/${state.maxHp}<div class="bar hp"><i style="width:${100*state.hp/state.maxHp}%"></i></div></div><div class="field-stat">MP ${state.mp}/${state.maxMp}<div class="bar mp"><i style="width:${100*state.mp/state.maxMp}%"></i></div></div><div class="field-stat">LV ${state.level} · XP ${state.xp}/${state.nextXp}</div>`;$('#hpBar').style.width=100*state.hp/state.maxHp+'%';$('#mpBar').style.width=100*state.mp/state.maxMp+'%';$('#xpBar').style.width=100*state.xp/state.nextXp+'%';$('#hpText').textContent=`${state.hp}/${state.maxHp}`;$('#mpText').textContent=`${state.mp}/${state.maxMp}`;$('#xpText').textContent=`${state.xp}/${state.nextXp}`;$('#heroLevel').textContent=`LEVEL ${state.level} • ${state.level<4?'NOVICE':state.level<8?'DELVER':'VETERAN'}`;$('#powerStat').textContent=state.power;$('#armorStat').textContent=state.armor;$('#goldStat').textContent=state.gold;$('#depthStat').textContent=state.floor;$('#floorTag').textContent='FLOOR '+String(state.floor).padStart(2,'0');$('#roomName').textContent=names[(state.floor-1)%names.length].toUpperCase();$('#coords').textContent=`X: ${String(state.x).padStart(2,'0')} / Y: ${String(state.y).padStart(2,'0')}`;$('#quickItems').innerHTML=state.inventory.slice(0,4).map(i=>`<button class="quick-slot" data-item="${i.id}" title="${i.name}">${i.icon}<small>${i.qty}</small></button>`).join('');$('#achievements').innerHTML=state.achievements.map(a=>`<span class="achievement">✦ ${a}</span>`).join('')||'<span class="muted">No accolades yet.</span>';$('#goals').innerHTML=`<div class="goal"><em>◈</em> Explore the chamber and find the gold stairs.</div><div class="goal"><em>⚔</em> Enemies defeated: ${state.kills}</div><div class="goal"><em>✧</em> Reach floor ${Math.floor(state.floor/3+1)*3} to face the next guardian.</div>`;let b=entities.find(e=>e.boss&&e.alive);if(b){$('#bossbar').classList.remove('hidden');$('#bossHp').style.width=100*b.hp/b.max+'%';$('#bossHpText').textContent=`${Math.max(0,b.hp)} / ${b.max}`}else $('#bossbar').classList.add('hidden');chapterHUD();draw();drawMini();drawFieldMap();drawPortrait();renderFeed()}
function trainBranch(n){if(state.floor<4)return;let ranks=state.branches??={};let rank=ranks[n]||0;if(state.skillPoints<1||rank>=3||!state.specialization)return;let allowed={Vanguard:['Fortitude','Bulwark'],Arcanist:['Reservoir','Channeling'],Reaver:['Precision','Ferocity']}[state.specialization]||[];if(!allowed.includes(n)||(n===allowed[1]&&!(ranks[allowed[0]]>=2)))return;state.skillPoints--;ranks[n]=rank+1;if(n==='Fortitude'){state.maxHp+=10;state.hp+=10}else if(n==='Bulwark')state.armor+=2;else if(n==='Reservoir'){state.maxMp+=8;state.mp+=8}else if(n==='Channeling')state.spellBonus=(state.spellBonus||0)+5;else state.power+=n==='Ferocity'?3:2;save();render();openTab('skills')}function branchUI(){let a={Vanguard:['Fortitude','Bulwark'],Arcanist:['Reservoir','Channeling'],Reaver:['Precision','Ferocity']}[state.specialization];if(!a)return '';return '<div class="panel-title">CLASS SKILL TREE</div>'+a.map((n,i)=>'<button class="widebtn" data-branch="'+n+'" '+((i&&!(state.branches?.[a[0]]>=2))||(state.branches?.[n]||0)>=3?'disabled':'')+'>'+n+' • '+(state.branches?.[n]||0)+'/3 • 1 SP</button>').join('')}function removeClass(){
const ranks=state.branches||{};
state.maxHp-=(state.specialization==='Vanguard'?15:0)+(ranks.Fortitude||0)*10;
state.maxMp-=(state.specialization==='Arcanist'?20:0)+(ranks.Reservoir||0)*8;
state.armor-=(state.specialization==='Vanguard'?2:0)+(ranks.Bulwark||0)*2;
state.power-=(state.specialization==='Reaver'?4:0)+(ranks.Precision||0)*2+(ranks.Ferocity||0)*3;
state.spellBonus=(state.spellBonus||0)-(ranks.Channeling||0)*5;
state.hp=Math.min(state.hp,state.maxHp);state.mp=Math.min(state.mp,state.maxMp);
state.skillPoints+=Object.values(ranks).reduce((sum,n)=>sum+n,0);state.branches={};state.specialization=null;
}
function chooseClass(n){if(state.floor<4||state.specialization===n||!['Vanguard','Arcanist','Reaver'].includes(n))return;
const missingHp=state.maxHp-state.hp,missingMp=state.maxMp-state.mp;if(state.specialization)removeClass();state.specialization=n;if(n==='Vanguard'){state.maxHp+=15;state.hp+=15;state.armor+=2}else if(n==='Arcanist'){state.maxMp+=20;state.mp+=20}else state.power+=4;state.hp=Math.max(1,state.maxHp-missingHp);state.mp=Math.max(0,state.maxMp-missingMp);save();render();openTab('skills')}function openTab(t){if(t==='inventory'){backpack();return}tab=t;$$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));let c=$('#tabContent');if(t==='journal'){c.innerHTML='<div class="panel-title">DUNGEON FEED <span class="muted">LIVE</span></div><div id="feed" class="feed"></div>';renderFeed()}else if(t==='map'){c.innerHTML='<div class="panel-title">CARTOGRAPHER’S MAP</div><p class="feed-line">The map reveals itself as you explore. Red marks living threats; white marks fallen enemies; gold marks your position and the exit.</p><div class="feed-line">Explored tiles: '+seen.flat().filter(Boolean).length+' / '+(W*H)+'</div>'}else if(t==='inventory'){c.innerHTML='<div class="panel-title">CRAWLER INVENTORY</div><div class="equipment-strip">⚔ Weapon • ⬟ Armor</div><div class="item-list inventory-grid">'+state.inventory.map(i=>`<div class="item-row"><span class="ico">${i.icon}</span><div><b>${i.name} ×${i.qty}</b><small>${i.desc}</small></div>${(['tonic','torch','shard'].includes(i.id)||i.id.startsWith('box-')||i.slot)?`<button class="smallbtn" data-use="${i.id}">${i.slot?(state.equipment?.[i.slot]===i.id?'EQUIPPED':'EQUIP'):i.id.startsWith('box-')?'OPEN':'USE'}</button>`:''}</div>`).join('')+'</div><button class="widebtn" id="addItem">＋ ADD CUSTOM ITEM</button>'}else if(t==='skills'){c.innerHTML=`<div class="panel-title">ABILITIES & TRAINING</div><div class="item-list"><div class="item-row"><span class="ico">⚔</span><div><b>Weapon mastery</b><small>Increase base strike damage. Current power: ${state.power}</small></div><button class="smallbtn" data-up="power">TRAIN • 1 SP</button></div><div class="item-row"><span class="ico">⬟</span><div><b>Iron constitution</b><small>Increase maximum health and armor.</small></div><button class="smallbtn" data-up="armor">TRAIN • 1 SP</button></div><div class="item-row"><span class="ico">✧</span><div><b>Arc Pulse</b><small>Area spell. Costs 10 MP; damages nearby enemies.</small><button class="smallbtn" data-action="spell">CAST</button></div></div></div><p>Unspent skill points: <b>${state.skillPoints}</b></p><div class="panel-title">SPECIALIZATION</div><p>${state.floor<4?'Race and class unlock on Floor 4':state.specialization||'Choose your class'}</p>${branchUI()}${state.floor<4?'': '<button class="widebtn" data-class="Vanguard">VANGUARD • +15 HP, +2 armor</button><button class="widebtn" data-class="Arcanist">ARCANIST • +20 MP</button><button class="widebtn" data-class="Reaver">REAVER • +4 power</button>'}`}else if(t==='party'){c.innerHTML='<div class="panel-title">PRIVATE CRAWLER PARTY</div><p>Connect to a hosted Dungeon Crawler relay to create an invite-only room. This alpha synchronizes party presence and positions; combat and dungeon state are not yet authoritative/shared.</p><div class="item-list"><label>SERVER WSS URL<input id="netEndpoint" class="modal-input" placeholder="wss://your-relay-host.example" value="'+safeAttr(localStorage.getItem('dck-net-url')||'')+'"></label><label>CRAWLER NAME<input id="netName" class="modal-input" maxlength="16" value="'+safeAttr(localStorage.getItem('dck-net-name')||'Crawler')+'"></label><div class="item-row"><button class="smallbtn" id="netCreate">CREATE PRIVATE ROOM</button><button class="smallbtn" id="netJoin">JOIN WITH CODE</button><button class="smallbtn" id="netLeave">LEAVE</button></div><div class="item-row"><span class="ico">♙</span><div><b id="netStatus">'+(window.DCKNet?.connected?'CONNECTED':'SOLO MODE')+'</b><small id="netRoom">'+(window.DCKNet?.roomCode?'ROOM '+window.DCKNet.roomCode:'No active room')+'</small></div><span class="achievement">ALPHA</span></div><div id="netRoster" class="feed-line">Remote crawlers: '+Object.keys(netPlayers).length+'</div></div><p>Use a secure WSS address for public hosting. Room codes are private invite codes, not user accounts or strong authentication.</p>'}}
function modalOpen(){return !$('#modal').classList.contains('hidden')}
function clearMovement(){
keys={};
joyX=joyY=0;
joystickAxis=null;
$('#joyKnob').style.transform='';
clearInterval(touchMove);
}
function showModal(html){clearMovement();step=null;$('#modalBody').innerHTML=html;$('#modal').classList.remove('hidden')}function closeModal(){
if(activeLoot){if(!activeLoot.owner)finishLoot();return}
if(remoteLoot){if(remoteLoot.owner===window.DCKNet.playerId)window.DCKNet.sendIntent('loot_close');return}
if(state.chapter==='create')return;if(bossFight&&!state.dead)return;$('#modal').classList.add('hidden')}
function bind(){let field=document.createElement('div');field.className='field-map';field.innerHTML='<canvas width="240" height="180" id="fieldMini"></canvas>';$('.canvas-wrap').appendChild(field);const joy=$('#joystick'),knob=$('#joyKnob');if(joy&&knob){let pointer=null;const update=e=>{let b=joy.getBoundingClientRect(),x=e.clientX-b.left-b.width/2,y=e.clientY-b.top-b.height/2,d=Math.hypot(x,y),m=Math.min(1,36/Math.max(1,d));knob.style.transform=`translate(${x*m}px,${y*m}px)`;if(d<=12||modalOpen()){
joyX=joyY=0;
joystickAxis=null;
return;
}
const horizontal=Math.abs(x),vertical=Math.abs(y);
if(joystickAxis==='x'&&vertical>horizontal*1.25)joystickAxis='y';
else if(joystickAxis==='y'&&horizontal>vertical*1.25)joystickAxis='x';
else if(!joystickAxis)joystickAxis=horizontal>=vertical?'x':'y';
joyX=joystickAxis==='x'?Math.sign(x):0;
joyY=joystickAxis==='y'?Math.sign(y):0};joy.addEventListener('pointerdown',e=>{if(pointer!==null)return;pointer=e.pointerId;joy.setPointerCapture(pointer);update(e);joyClock=0});joy.addEventListener('pointermove',e=>{if(e.pointerId===pointer)update(e)});const stop=e=>{if(e.pointerId!==pointer)return;pointer=null;joyX=joyY=0;joystickAxis=null;knob.style.transform=''};for(const ev of ['pointerup','pointercancel','lostpointercapture'])joy.addEventListener(ev,stop)}window.addEventListener('blur',clearMovement);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearMovement()});
document.addEventListener('keydown',e=>{
if(modalOpen()||e.target instanceof Element&&e.target.closest('input,textarea,select,button,[contenteditable]'))return;
let k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();keys[k]=true;if(k===' '||k==='j')attack();if(k==='shift')dodge();if(k==='e')spell();if(k==='f')loot();if(k==='q')jump();if(k==='w'||k==='arrowup')move(0,-1);if(k==='s'||k==='arrowdown')move(0,1);if(k==='a'||k==='arrowleft')move(-1,0);if(k==='d'||k==='arrowright')move(1,0);});document.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);$$('[data-move]').forEach(b=>{let fn=()=>{let d=b.dataset.move;move(d==='left'?-1:d==='right'?1:0,d==='up'?-1:d==='down'?1:0)};b.addEventListener('pointerdown',e=>{e.preventDefault();fn();touchMove=setInterval(fn,150)});['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,()=>clearInterval(touchMove)))});$$('[data-action]').forEach(b=>b.addEventListener('click',()=>action(b.dataset.action)));$$('[data-tab]').forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.tab)));$('#tabContent').addEventListener('click',e=>{let u=e.target.closest('[data-use]');if(u)useItem(u.dataset.use);let up=e.target.closest('[data-up]');if(up&&state.skillPoints>0){state.skillPoints--;if(up.dataset.up==='power')state.power+=2;else{state.maxHp+=15;state.armor++}feed('You train your '+up.dataset.up+'.');render();openTab('skills')}if(e.target.id==='addItem')addItem();let a=e.target.closest('[data-action]');if(a)action(a.dataset.action);if(e.target.id==='netCreate'||e.target.id==='netJoin'){if(state.chapter==='surface'||state.chapter==='create'){notify('Descend into the mine to join a party.');return}const endpoint=$('#netEndpoint')?.value.trim(),name=($('#netName')?.value.trim()||'Crawler').slice(0,16);if(!endpoint){notify('Enter your hosted WSS server URL first.');return}localStorage.setItem('dck-net-url',endpoint);localStorage.setItem('dck-net-name',name);const btn=e.target;btn.disabled=true;window.DCKNet.connect(endpoint,name).then(()=>e.target.id==='netCreate'?window.DCKNet.createRoom():window.DCKNet.joinRoom(prompt('Enter your 6-character party code:')||'')).then(()=>{notify('PARTY CONNECTED');openTab('party')}).catch(err=>notify('CO-OP: '+err.message)).finally(()=>{btn.disabled=false})}if(e.target.id==='netLeave'){window.DCKNet?.leave();netPlayers={};openTab('party')}});$('#quickItems').addEventListener('click',e=>{let b=e.target.closest('[data-item]');if(b)useItem(b.dataset.item)});$('#saveBtn').onclick=save;$('#soundBtn').onclick=()=>{sound=!sound;$('#soundBtn').textContent=sound?'♫':'♩';notify(sound?'AUDIO ON':'AUDIO OFF')};$('#newRun').onclick=()=>{if(confirm('Abandon this run and start a new crawler?')){startStory()}};$('#modalClose').onclick=closeModal;$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});window.addEventListener('beforeunload',save);}
function storageMenu(q){state.storage??=[];let available=state.inventory.filter(i=>i.qty>0&&state.equipment?.[i.slot]!==i.id);showModal('<h2>CRAWLER LOCKER</h2><p>Shared across sanctuaries and floors.</p><h3>Deposit</h3>'+available.map((i,n)=>'<button class="widebtn" data-deposit="'+n+'">'+safeAttr(i.name)+' ×'+i.qty+'</button>').join('')+'<h3>Withdraw</h3>'+state.storage.map((i,n)=>'<button class="widebtn" data-withdraw="'+n+'">'+safeAttr(i.name)+' ×'+i.qty+'</button>').join('')+'<button class="widebtn" id="storageBack">BACK</button>');let transfer=(from,to,item)=>{if(!item||item.qty<1)return;let existing=to.find(i=>i.id===item.id);if(existing)existing.qty++;else to.push({...item,qty:1});item.qty--;if(!item.qty)from.splice(from.indexOf(item),1);save();storageMenu(q)};$$('[data-deposit]').forEach(b=>b.onclick=()=>transfer(state.inventory,state.storage,available[Number(b.dataset.deposit)]));$$('[data-withdraw]').forEach(b=>b.onclick=()=>transfer(state.storage,state.inventory,state.storage[Number(b.dataset.withdraw)]));$('#storageBack').onclick=()=>sanctuaryMenu(q)}function sanctuaryMenu(q){showModal('<h2>SANCTUARY</h2><p>Protected quarters • Gold: '+state.gold+'</p><button class="widebtn" id="restSafe">'+(q.rested?'BED — USED':'REST AT BED')+'</button><button class="widebtn" id="buySafe">MERCHANT: TONIC — 15 GOLD</button><button class="widebtn" id="stashSafe">'+(q.cache?'STORAGE — EMPTY':'OPEN SUPPLY CHEST')+'</button><button class="widebtn" id="lockerSafe">PERSONAL STORAGE</button><button class="widebtn" id="leaveSafe">RETURN</button>');$('#restSafe').onclick=()=>{if(!q.rested){q.rested=true;state.hp=state.maxHp;state.mp=state.maxMp;unlock('Safe harbor');save();render()}sanctuaryMenu(q)};$('#buySafe').onclick=()=>{if(state.gold>=15){state.gold-=15;giveItem('tonic',1);save();render()}sanctuaryMenu(q)};$('#stashSafe').onclick=()=>{if(q.cache)return;const nearby=nearbyContainers(state);if(!nearby.some(c=>c.source===q)){notify('Move closer to the supply chest.');return}if(partyGuest()){closeModal();window.DCKNet.sendIntent('loot')}else startLoot(nearby,null)};$('#lockerSafe').onclick=()=>storageMenu(q);$('#leaveSafe').onclick=closeModal}function giveItem(id,n){let i=state.inventory.find(v=>v.id===id);if(i)i.qty+=n;else{let names={tonic:'Health tonic',torch:'Torch',shard:'Mana shard'};state.inventory.push({id,name:names[id]||id,icon:'✦',qty:n,desc:'Dungeon supply'})}}let bagPage=0, activeLoot=null, remoteLoot=null, lootSignature='';
const lootNames={'box-Bronze':'Bronze loot box',gold:'Gold coins',tonic:'Health tonic',torch:'Torch',shard:'Mana shard'};
const lootIcons={'box-Bronze':'🎁',gold:'◉',tonic:'🧪',torch:'🔥',shard:'🔷'};
function backpack(){
  if(state.dead||bossFight||activeLoot||remoteLoot||state.chapter==='create')return;
  const items=state.inventory.filter(item=>item.qty>0);
  const pages=Math.max(1,Math.ceil(items.length/6));
  bagPage=Math.min(bagPage,pages-1);
  const slots=items.slice(bagPage*6,bagPage*6+6).map((item,i)=>
    '<button class="bag-slot" data-slot="'+i+'"><strong>'+safeAttr(item.icon)+'</strong><span>'+safeAttr(item.name)+'</span><small>×'+item.qty+(state.equipment?.[item.slot]===item.id?' · Equipped':'')+'</small></button>');
  while(slots.length<6)slots.push('<div class="bag-slot empty" aria-hidden="true"></div>');
  showModal('<h2>Backpack</h2><div class="bag-stats"><span>HP '+state.hp+'/'+state.maxHp+'</span><span>MP '+state.mp+'/'+state.maxMp+'</span><span>Level '+state.level+'</span><span>Power '+state.power+'</span><span>Armor '+state.armor+'</span><span>Gold '+state.gold+'</span><span>XP '+state.xp+'/'+state.nextXp+'</span><span>Spell bonus '+(state.spellBonus||0)+'</span>'+(state.teaPower?'<span>Tea +'+state.teaPower+' power this floor</span>':'')+'</div><div class="bag-grid">'+slots.join('')+'</div><div class="bag-nav"><button id="bagPrev" '+(!bagPage?'disabled':'')+'>‹</button><span>Pocket '+(bagPage+1)+' / '+pages+'</span><button id="bagNext" '+(bagPage+1>=pages?'disabled':'')+'>›</button><button id="bagAdd">Add item</button></div><div id="bagDetail" aria-live="polite">Select an item to inspect it.</div>');
  $('#bagPrev').onclick=()=>{bagPage--;backpack()};
  $('#bagNext').onclick=()=>{bagPage++;backpack()};
  $('#bagAdd').onclick=addItem;
  $$('[data-slot]').forEach(button=>button.onclick=()=>{
    const item=items[bagPage*6+Number(button.dataset.slot)];
    const detail=$('#bagDetail');detail.textContent=item.desc+' ';
    if(item.effect||item.slot||['torch','tonic','shard'].includes(item.id)||item.id.startsWith('box-')){
      const use=document.createElement('button');use.textContent=item.slot?(state.equipment?.[item.slot]===item.id?'Unequip':'Equip'):item.id.startsWith('box-')?'Open':'Use';
      use.onclick=()=>useItem(item.id);detail.appendChild(use);
    }
  });
}
const LOOT_RADIUS=3;
function nearbyContainers(player){
  const nearby=[];
  function add(source,name,index,x,y){
    const distance=Math.hypot(x-player.x,y-player.y);
    if(distance<=LOOT_RADIUS)nearby.push({source,name,index,distance});
  }
  entities.forEach((e,i)=>{
    if(!e.looted&&((e.type==='enemy'&&!e.alive)||(e.type==='loot'&&e.alive)))add(e,e.name||'Dungeon cache',i,e.x,e.y);
  });
  (state.sanctuaries||[]).forEach((q,i)=>{
    if(q.room&&!q.cache)add(q,'Sanctuary supply chest',-1-i,q.room.x+3,q.room.y);
  });
  return nearby.sort((a,b)=>a.distance-b.distance);
}
function startLoot(containers,owner){
  const rows=[];
  for(const {source,name,index} of containers){
    source.contents??=index<0?[{id:'box-Bronze',qty:1}]:[{id:'gold',qty:5+Math.floor(Math.random()*10)},{id:Math.random()<.5?'tonic':'torch',qty:1}];
    for(const item of source.contents)rows.push({...item,index,name,key:String(rows.length)});
  }
  if(!rows.length)return;
  activeLoot={owner,name:'Nearby loot',rows};
  persistCampaign();drawLoot(activeLoot,!owner);sendPartyWorld();
}
function drawLoot(session,canTake){
  let lastIndex=null;
  const rows=session.rows.map(row=>{
    let heading=lastIndex===row.index?'':'<h3>'+safeAttr(row.name||session.name)+'</h3>';
    lastIndex=row.index;
    return heading+'<button class="loot-row" data-take="'+safeAttr(row.key??row.id)+'" '+(canTake?'':'disabled')+'><b>'+lootIcons[row.id]+'</b><span>'+lootNames[row.id]+'</span><span>×'+Number(row.qty)+'</span></button>';
  }).join('');
  showModal('<small>GAME PAUSED</small><h2>Nearby loot</h2><p>'+(canTake?'Choose items from bodies and chests within three tiles.':'A party member is searching nearby containers.')+'</p><div class="loot-pocket">'+rows+'</div>'+(canTake?'<div class="bag-nav"><button id="takeAll">Take all</button><button id="leaveLoot">Leave</button></div>':''));
  if(!canTake)return;
  const take=id=>partyGuest()?window.DCKNet.sendIntent('take_'+id):transferLoot(id);
  $$('[data-take]').forEach(b=>b.onclick=()=>take(b.dataset.take));
  $('#takeAll').onclick=()=>take('all');$('#leaveLoot').onclick=closeModal;
}
function finishLoot(){
  activeLoot=null;remoteLoot=null;lootSignature='';last=0;
  $('#modal').classList.add('hidden');sendPartyWorld();render();
}
function receiveLoot(bundle){
  for(const [id,qty] of Object.entries(bundle)){
    if(id==='gold')state.gold+=qty;
    else if(id==='box-Bronze'){for(let i=0;i<qty;i++)awardBox('Bronze')}
    else giveItem(id,qty);
  }
}
function transferLoot(key){
  if(!activeLoot)return;
  const {owner,rows}=activeLoot,bundle={};
  for(const row of rows.slice()){
    if(key!=='all'&&key!==row.key)continue;
    const source=row.index<0?state.sanctuaries[-1-row.index]:entities[row.index];
    const i=source.contents.findIndex(item=>item.id===row.id);
    if(i<0)continue;
    source.contents.splice(i,1);rows.splice(rows.indexOf(row),1);
    bundle[row.id]=(bundle[row.id]||0)+row.qty;
    if(!source.contents.length){
      if(row.index<0)source.cache=true;else{source.looted=true;if(source.type==='loot')source.alive=false}
      if(!owner){unlock('Scavenger');state.loots=(state.loots||0)+1;if(state.loots===3)ridiculous('Personal Space Is for the Living');if(state.loots===15)ridiculous('Estate Sale Enthusiast','Silver')}
    }
  }
  if(Object.keys(bundle).length){
    if(owner)window.DCKNet.sendLoot(owner,bundle);else receiveLoot(bundle);
    persistCampaign();
  }
  if(!rows.length){finishLoot();return}
  drawLoot(activeLoot,!owner);sendPartyWorld();
}
function syncLoot(session){
  if(!session){if(remoteLoot){remoteLoot=null;lootSignature='';last=0;$('#modal').classList.add('hidden')}return}
  const signature=JSON.stringify(session);
  if(signature===lootSignature)return;
  lootSignature=signature;remoteLoot=session;drawLoot(session,session.owner===window.DCKNet.playerId);
}

function loot(){if(state.dead||activeLoot||remoteLoot)return;if(state.chapter==='create'||state.chapter==='surface')return;if(bossFight)return;const nearby=nearbyContainers(state);
if(nearby.length){if(partyGuest())window.DCKNet.sendIntent('loot');else startLoot(nearby,null);return}
let sanctuary=sanctuaryAt(state.x,state.y);if(sanctuary){sanctuaryMenu(sanctuary);return}if(state.npc&&!state.npc.met&&Math.hypot(state.x-state.npc.x,state.y-state.npc.y)<=1.7){state.npc.met=true;if(state.floor===1){state.foundKeeper=true;caption('Iven, rope keeper','Mara sent you? The cage is jammed on the third floor. Silence its guardian and I can haul the miners up.',true)}state.gold+=15;feed('A wandering crawler shares 15 gold and warns of the guardian.');unlock('Not alone');render();return}notify('No remains or cache nearby.')}function action(a){if(a==='loot')loot();if(a==='attack')attack();if(a==='dodge')dodge();if(a==='jump')jump();if(a==='spell')spell()}
let worldClock=0;const remoteCooldown=new Map();
function partyGuest(){return !!window.DCKNet?.inRoom&&!window.DCKNet.isHost}
function sendPartyWorld(){if(!window.DCKNet?.isHost)return;window.DCKNet.sendWorld({floor:state.floor,loot:activeLoot,chests:(state.sanctuaries||[]).map(q=>!!q.cache),enemies:entities.map((e,i)=>({i,x:e.x,y:e.y,hp:e.hp,alive:e.alive,looted:!!e.looted})),collapse:Math.ceil(state.collapseLeft)})}
function applyPartyWorld(w){if(!partyGuest()||!w||!Number.isInteger(w.floor)||w.floor<1||w.floor>999)return;syncLoot(w.loot);if(w.floor!==state.floor){bossFight=null;state.dead=false;state.hp=Math.max(1,state.hp);state.floor=w.floor;generate();$('#floorTag').textContent='FLOOR '+String(state.floor).padStart(2,'0');$('#roomName').textContent=names[(state.floor-1)%names.length].toUpperCase();closeModal();notify('PARTY FLOOR '+state.floor)}if(Array.isArray(w.chests))(state.sanctuaries||[]).forEach((q,i)=>q.cache=!!w.chests[i]);for(let v of w.enemies||[]){let e=entities[v.i];if(!e||!Number.isInteger(v.x)||!Number.isInteger(v.y)||v.x<0||v.x>=W||v.y<0||v.y>=H)continue;e.x=v.x;e.y=v.y;if(Number.isFinite(v.hp))e.hp=Math.max(0,Math.min(e.max||9999,v.hp));e.alive=!!v.alive;e.looted=!!v.looted}if(Number.isFinite(w.collapse))state.collapseLeft=Math.max(0,w.collapse)}
function partyIntent(d){if(!window.DCKNet?.isHost||d.player?.floor!==state.floor)return;
if(activeLoot){if(activeLoot.owner===d.id){
if(d.action==='loot_close')finishLoot();else if(d.action.startsWith('take_'))transferLoot(d.action.slice(5))
}return}
if(d.action.startsWith('take_')||d.action==='loot_close')return;
let now=performance.now();if(now-(remoteCooldown.get(d.id)||-1000)<450)return;remoteCooldown.set(d.id,now);let p=d.player;if(d.action!=='loot'&&sanctuaryAt(p.x,p.y))return;let range=d.action==='spell'?3.2:2.15;if(bossFight){let e=bossFight.e;if(!['attack','spell'].includes(d.action)||Math.hypot(e.x-p.x,e.y-p.y)>range)return;bossFight.assist=Math.min(60,(bossFight.assist||0)+8+Math.min(20,p.level||1));bossFight.log='An ally joins the assault. Bonus damage ready: '+bossFight.assist;bossScreen();return}if(d.action==='loot'){const sources=nearbyContainers(p);if(sources.length&&!modalOpen())startLoot(sources,d.id);return}let targets=entities.filter(e=>e.type==='enemy'&&e.alive&&!e.boss&&Math.hypot(e.x-p.x,e.y-p.y)<=range).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));if(d.action==='attack')targets=targets.slice(0,1);for(let e of targets){let damage=8+Math.min(100,p.level||1)*2;e.hp-=damage;particles.push({x:e.x,y:e.y,t:0,kind:'hit',text:'-'+damage});if(e.hp<=0){e.alive=false;e.deathAt=now;window.DCKNet.sendReward(d.id,8,e.xp||0,null)}}sendPartyWorld()}
function updatePartyRoster(){const el=$('#netRoster');if(el)el.textContent='Party members connected: '+(window.DCKNet?.inRoom?Object.keys(netPlayers).length+1:0)+' / 4'}
window.addEventListener('dcknet',e=>{const d=e.detail||{};if(remoteLoot&&!partyGuest())syncLoot(null);
if(activeLoot?.owner&&d.type==='player_left'&&activeLoot.owner===d.id)finishLoot();
if(activeLoot?.owner&&!window.DCKNet?.inRoom)finishLoot();
if(d.type==='loot_bundle'){if(partyGuest()){receiveLoot(d.items);persistCampaign();render()}}else if(d.type==='reward'){if(partyGuest()){state.gold+=d.gold||0;state.xp+=d.xp||0;if(d.item)giveItem(d.item,1);checkLevel();save();render();notify('PARTY REWARD RECEIVED')}}else if(d.type==='world'){applyPartyWorld(d.world)}else if(d.type==='combat_intent'){partyIntent(d)}else if(d.type==='players'){netPlayers=d.players||{};render();updatePartyRoster()}else if(d.type==='player_state'){netPlayers[d.id]=d.player;render();updatePartyRoster()}else if(d.type==='player_left'){delete netPlayers[d.id];render();updatePartyRoster()}else if(d.type==='room'){notify('PRIVATE ROOM '+d.code);render()}else if(d.type==='status'){const el=$('#netStatus');if(el)el.textContent=d.text;const room=$('#netRoom');if(room)room.textContent=d.code?'ROOM '+d.code:'No active room';updatePartyRoster()}else if(d.type==='error'){notify('CO-OP: '+d.message)}});
function collapseTick(dt){if(bossFight&&!window.DCKNet?.inRoom)return;if(state.chapter==='surface'||state.chapter==='create'||state.dead)return;state.collapseLeft=Math.max(0,(state.collapseLeft??900)-dt);let n=Math.ceil(state.collapseLeft),el=$('#collapseClock');if(el){el.textContent='COLLAPSE '+Math.floor(n/60)+':'+String(n%60).padStart(2,'0');el.style.color=n<=60?'#ff7766':'#e6c47d'}for(let t of [300,60,10])if(n<=t&&!state.warned.includes(t)){state.warned.push(t);ai('Floor collapse in '+t+' seconds. Find the stairs, crawler.');notify('COLLAPSE WARNING: '+t+'s')}if(n===0){bossFight=null;state.collapsed=true;state.dead=true;state.hp=0;save();showModal('<h2>FLOOR COLLAPSED</h2><p>You failed to reach the stairs in time.</p><button class="widebtn" id="collapseRestart">NEW RUN</button>');$('#collapseRestart').onclick=()=>{startStory()}}}document.addEventListener('click',e=>{let b=e.target.closest('[data-class]');if(b)chooseClass(b.dataset.class);let t=e.target.closest('[data-branch]');if(t)trainBranch(t.dataset.branch)});function tick(ts){if(activeLoot||remoteLoot){last=ts;requestAnimationFrame(tick);return}let elapsed=last?Math.max(0,(ts-last)/1000||0):0,dt=Math.min(.05,elapsed);let nextStepStart=ts;last=ts;collapseTick(Math.min(elapsed,1));if(step){let p=Math.min(1,(ts-step.start)/STEP_MS);p=Math.max(0,p);visualX=step.x+(step.nx-step.x)*p;visualY=step.y+(step.ny-step.y)*p;if(p>=1){let done=step;nextStepStart=Math.max(ts-32,done.start+STEP_MS);finishStep(done.nx,done.ny);step=null;visualX=state.x;visualY=state.y}}else{visualX=state.x;visualY=state.y}if(!state.dead){if(!step){let x=joyX||((keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0)),y=joyY||((keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0));if(x||y){if(Math.abs(x)>Math.abs(y))move(Math.sign(x),0,nextStepStart);else move(0,Math.sign(y),nextStepStart);
if(step){
  const progress=(ts-step.start)/STEP_MS;
  visualX=step.x+(step.nx-step.x)*progress;
  visualY=step.y+(step.ny-step.y)*progress;
}
}}if(!partyGuest())enemyTick(dt);worldClock+=dt;if(worldClock>.5){worldClock=0;sendPartyWorld()}attackCooldown=Math.max(0,attackCooldown-dt);particles.forEach(p=>p.t+=dt);particles=particles.filter(p=>p.t<.65);if(Math.random()<dt*.025)persistCampaign();netSyncClock+=dt;if(netSyncClock>.18&&window.DCKNet?.inRoom){netSyncClock=0;window.DCKNet.sendState({gear:gearLook(),character:state.character,floor:state.floor,x:state.x,y:state.y,level:state.level,hp:state.hp,maxHp:state.maxHp,name:localStorage.getItem('dck-net-name')||'Crawler'});}}if(!state.dead&&Math.floor(ts/200)!==Math.floor((ts-dt*1000)/200))render();else draw();requestAnimationFrame(tick)}
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
if(!load()){startStory()}else{reveal();render();if(state.chapter==='create')showCreator()}bind();render();if(state.dead)openDeath();else if(bossFight)bossScreen();openTab('journal');if(state.storyLine)caption(state.storyLine.speaker,state.storyLine.line);else if(!state.chapter)ai(quips[0]);$('#packBtn').onclick=backpack;$('#editCrawler').onclick=()=>{if(!state.dead&&!bossFight)showCreator()};requestAnimationFrame(tick);
})();
