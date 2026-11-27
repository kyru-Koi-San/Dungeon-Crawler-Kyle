(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const safeAttr=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const canvas=$('#game'),ctx=canvas.getContext('2d'),mini=$('#minimap').getContext('2d'),portrait=$('#portrait').getContext('2d');
const TILE=32;let W=72,H=48;const saveKey='dck-final-save-v1';
const names=['Pioneer Square • Bell Vault','Elliott Bay • Floodworks','SoDo • Iron Cage','Capitol Hill • Signal Room','Lake Union • Lost Archive','Queen Anne • Sky Relay','Ballard • Lock Chambers','Fremont • Drawbridge Works','Wallingford • Mirror Well','Georgetown • Boiler House','Beacon Hill • Buried Station','Rainier Valley • Cinder Court','West Seattle • Salt Galleries','Magnolia • Watchtower','Interbay • Iron Tribunal','Duwamish • Black Channel','Alki • Beacon Crypt','Seattle Underground • Last Bell'];
const FINAL_FLOOR=18;
const quips=['Welcome, crawler. Try not to die before the opening credits.','Your posture suggests a lack of confidence. And armor.','The audience loves a comeback. They love a dismemberment more.','I have seen rats with better tactical instincts.','Excellent footwork. Shame about the rest of you.','A new floor! The same questionable life choices.','Remember: pain is temporary. The highlight reel is forever.','That corpse had a family. Probably.','Your odds are improving. They were dreadful, so this is relative.','Do keep moving. The walls are not decorative.'];
let state,tiles=[],seen=[],entities=[],particles=[],keys={},last=0,acc=0,walkUntil=0,attackStarted=0,sound=true,audio=null,toastTimer=0,attackCooldown=0,spawnedFloor=0,tab='journal',touchMove=null,netPlayers={},netSyncClock=0;
let step=null,stepCount=0;const WALK_MS=275,RUN_MS=160;
let runPointer=null,stickPointer=null;
let joystickAxis=null;let visualX=null,visualY=null,visualFloor=0,joyX=0,joyY=0,hurtAt=0;const sprites={};
const spriteNames=['pack-llama','flood-grub','mire-leprechaun','hero-front','hero-side','hero-back','hero-slash','hero-strike','sewer-rat','skeleton','goblin','spider','wraith','archer','shaman','spider-boss','bone-champion'];
for(const name of spriteNames){const img=new Image();img.src=name+'.png';img.onload=()=>render();sprites[name]=img;}
const skinTones=['#f1cdb0','#dfaf87','#bc8b63','#a06c4b','#794f38','#50352c'];
const ancestries=['Human','Elf','Dwarf','Cat','Dog','Mutant Crab','Wizard','Zombie'];
const racePerks={Human:{power:2,maxHp:8},Elf:{maxMp:15,spellBonus:3},Dwarf:{armor:3,maxHp:12},Cat:{power:5},Dog:{maxHp:20,power:2},'Mutant Crab':{armor:6},Wizard:{maxMp:25,spellBonus:5},Zombie:{maxHp:35}};
const perkText=r=>Object.entries(racePerks[r]||{}).map(([k,v])=>'+'+v+' '+({maxHp:'max HP',maxMp:'max MP',spellBonus:'spell damage'}[k]||k)).join(' · ');
const genders=['Woman','Man','Nonbinary'];
const clothingColors=['#667565','#414454','#37485a','#a64b49','#d3b68a','#eeeeee','#25252c','#78568c','#397f89'];
const shirtStyles=['T-shirt','Long sleeve','Tank top','None'],pantsStyles=['Trousers','Shorts','Underwear','Pixelated nude'],shoeStyles=['Boots','Sneakers','Barefoot'];
const hairStyles=['Signature','Crop','Pixie','Bob','Curls','Ponytail','Braid','Shaved'];
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
function crawlerTitle(){
  const wins=state.guardianRecord?.length||0;
  return (state.character?.name||'Crawler')+(wins?' '+ '★'.repeat(wins):'');
}
function showCreator(){if(state.chapter!=='create'&&personalMenusLocked()){lockHint();return}
  const current=state.character||{race:'Human',skin:2,gender:'Nonbinary'};
  const choices=(list,value)=>list.map((name,i)=>'<option value="'+i+'" '+(i===value?'selected':'')+'>'+name+'</option>').join('');
  const outfitChoices=(name,list,value)=>'<label>'+name+'<select name="'+name.toLowerCase().replace(' ','')+'">'+choices(list,value)+'</select></label>';
  const colorChoices=(name,value)=>outfitChoices(name,['Olive','Slate','Blue','Red','Tan','White','Black','Purple','Teal'],Math.max(0,clothingColors.indexOf(value)));
  showModal('<h2>Your crawler</h2><form id="creator"><label>Crawler name<input name="crawlerName" maxlength="24" placeholder="Crawler" autocomplete="off"></label><canvas id="look" width="192" height="84" aria-label="Front, side, and back hairstyle preview"></canvas><label>Race<select name="race" '+('disabled')+'>'+choices(ancestries,Math.max(0,ancestries.indexOf(current.race)))+'</select></label><label>Skin tone<select name="skin">'+choices(['Porcelain','Sand','Amber','Copper','Umber','Deep brown'],current.skin)+'</select></label><label>Gender<select name="gender" aria-label="Gender">'+choices(genders,genders.indexOf(current.gender))+'</select></label><label>Hairstyle<select name="hair" aria-label="Hairstyle">'+choices(hairStyles,Math.max(0,hairStyles.indexOf(current.hair)))+'</select></label>'+outfitChoices('Shirt',shirtStyles,Math.max(0,shirtStyles.indexOf(current.shirt)))+colorChoices('Shirt color',current.shirtColor)+outfitChoices('Pants',pantsStyles,Math.max(0,pantsStyles.indexOf(current.pants)))+colorChoices('Pants color',current.pantsColor||clothingColors[1])+outfitChoices('Shoes',shoeStyles,Math.max(0,shoeStyles.indexOf(current.shoes)))+colorChoices('Shoe color',current.shoeColor||clothingColors[6])+'<button class="widebtn">'+(state.chapter==='create'?'Begin on the surface':'Save character')+'</button></form><button class="widebtn" data-campaign-menu>Campaign saves</button>');
  const form=$('#creator');
  form.elements.crawlerName.value=current.name||'';
  const selection=()=>({name:form.elements.crawlerName.value.trim().slice(0,24)||'Crawler',race:state.identityLocked?state.character.race:state.floor<4?'Human':current.race,skin:Number(form.elements.skin.value),gender:genders[form.elements.gender.value],hair:hairStyles[form.elements.hair.value],shirt:shirtStyles[form.elements.shirt.value],shirtColor:clothingColors[form.elements.shirtcolor.value],pants:pantsStyles[form.elements.pants.value],pantsColor:clothingColors[form.elements.pantscolor.value],shoes:shoeStyles[form.elements.shoes.value],shoeColor:clothingColors[form.elements.shoecolor.value]});
  function preview(){
    const g=$('#look').getContext('2d');
    g.clearRect(0,0,192,84);g.imageSmoothingEnabled=false;
    const chosen=selection();
    ['down','side','up'].forEach((dir,i)=>g.drawImage(crawlerPose(dir,0,chosen),i*64+2,2,60,80));
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
const guildArt=new Image();guildArt.src='guild-hall.png';
const guildLessons=[
  ['Explore','Use the joystick or arrow keys to walk. The minimap fills in as you explore. Tap Interact beside a person, sign, or discovery.'],
  ['Fight','In solo combat, choose a move when it is your turn. Read the incoming attack. Punch or swing to attack. Guard reduces incoming damage. Run away from ordinary enemies, but watch for pursuit. Guardians seal the arena.'],
  ['Loot and equip','Choose a consumable for X in your backpack. Tap Loot near a body or chest. The game pauses while you choose what to take. Inspect gear in your backpack before equipping it: some items carry penalties.'],
  ['Return to the guild','Walk through a sanctuary door to find me on any floor. Use the bed to recover once per shelter. After a guardian victory, ask me to review the fight.']
];
const hallStyles=[
 {name:'Elliott Bay Pilothouse',object:'Tide gauge',lore:'Three high-water marks cross the brass dial. The newest is labeled “after the stairs appeared.”',color:'#4a959a',wood:'#28494b',x:2,y:6},
 {name:'Volunteer Park Glasshouse',object:'Seed cabinet',lore:'Each envelope names a Seattle street. Someone is saving a little of the surface for spring.',color:'#a4bf74',wood:'#465641',x:4,y:4},
 {name:'SoDo Switch House',object:'Signal lever',lore:'One scratched lever still points toward King Street. The signal lamp blinks twice when you touch it.',color:'#daa155',wood:'#624938',x:8,y:6},
 {name:'Gas Works Observatory',object:'Star chart',lore:'The painted stars match the sky over Lake Union. A second constellation outlines the tunnels below.',color:'#9fa5df',wood:'#3c4159',x:3,y:5},
 {name:'Rainier Apothecary',object:'Dispensing table',lore:'Each drawer has a name and a last known floor. A fresh bottle waits under yours.',color:'#c49dba',wood:'#594757',x:8,y:4},
 {name:'Ballard Print Room',object:'Map press',lore:'Routes hang beside the stove on drying lines. A penciled note reads: please correct our mistakes.',color:'#d6bc8e',wood:'#554937',x:3,y:6}
];
function furnishHallArt(id,rect,line){
 const brass='#ccab72',ink='#24343b';
 for(const side of [0,1]){
   const x=side?324:22;
   if(id===0){ // Portholes, mooring line and chart table
     for(let i=0;i<3;i++){rect(x+5+i*16,66,12,12,brass);rect(x+7+i*16,68,8,8,'#477887')}
     for(let i=0;i<3;i++)line(x+4,95+i*3,x+54,103+i*3,'#ac8860');
   }else if(id===1){ // Glass roof trusses and hanging flower baskets
     for(let i=0;i<4;i++){line(x+i*16,65,x+18+i*12,83,'#738a7e');line(x+9+i*12,65,x+9+i*12,84,'#b6c5a2',1);
       rect(x+5+i*12,84,10,5,'#a47153');rect(x+4+i*12,79,10,6,'#598657');rect(x+7+i*12,77,3,3,'#e4b3a4')}
   }else if(id===2){ // Railway control bank with illuminated signal tracks
     rect(x,66,65,37,ink);for(let i=0;i<5;i++){line(x+4,72+i*5,x+58,72+(4-i)*5,brass,1);rect(x+6+i*11,95,4,3,i%2?'#dc725e':'#91c88e')}
   }else if(id===3){ // Celestial instrument and moon phase strip
     for(let i=0;i<6;i++){rect(x+i*10,74,7,7,'#ddd3ad');rect(x+i*10,73,i,9,'#383d53')}
     for(let i=0;i<13;i++)rect(x+(i*11)%60,86+(i*7)%15,2,2,'#b3b9d9');
   }else if(id===4){ // Apothecary shelves with labeled bottles
     for(let j=0;j<3;j++){rect(x,31+j*22,65,4,'#886440');for(let i=0;i<6;i++){
       const a=x+4+i*10,b=20+j*22;rect(a+2,b-4,3,5,brass);rect(a,b,7,10,['#7ca39c','#cb925d','#987f9a'][(i+j)%3]);rect(a+1,b+4,5,3,'#ddd0aa')}}
   }else{ // Letterpress type drawers and drying sheets
     rect(x,18,63,74,'#594032');for(let j=0;j<5;j++)for(let i=0;i<6;i++){rect(x+2+i*10,21+j*13,8,11,'#967753');rect(x+4+i*10,23+j*13,4,2,ink)}
     line(x,100,x+64,96,brass);for(let i=0;i<5;i++){rect(x+i*12,99,9,12,'#dbccaa');rect(x+2+i*12,102,5,1,ink)}
   }
 }
}

function hallTheme(h=state.hall){return (3*(state.floor-1)+h.index)%hallStyles.length}
const hallScenes=new Map();
function hallBackdrop(h){
  const id=hallTheme(h),theme=hallStyles[id];
  const roomKey=state.floor+'-'+h.index;
  if(hallScenes.has(roomKey))return hallScenes.get(roomKey);
  if(!guildArt.naturalWidth)return null;
  const art=document.createElement('canvas');art.width=416;art.height=320;
  const g=art.getContext('2d'),rect=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(x,y,w,h)};
  const line=(x,y,a,b,c,width=2)=>{g.strokeStyle=c;g.lineWidth=width;g.beginPath();g.moveTo(x,y);g.lineTo(a,b);g.stroke()};
  g.drawImage(guildArt,0,0);
  rect(114,130,188,110,theme.wood);g.strokeStyle=theme.color;g.strokeRect(117,133,181,103);
  for(let j=0;j<5;j++)for(let i=0;i<9;i++){
    const x=128+i*19,y=144+j*20;
    if(id===0){line(x,y+3,x+5,y,theme.color,1);line(x+5,y,x+10,y+3,theme.color,1)}
    if(id===1){rect(x,y,3,5,'#64794d');rect(x+3,y-2,3,3,'#80945f')}
    if(id===2){rect(x,y,9,2,'#8b7353');rect(x+3,y-2,2,6,'#8b7353')}
    if(id===3){rect(x+(j%2)*4,y,2,2,'#797c9b')}
  }
  // Change the rear wall from shelves into windows, planting bays or instrument panels.
  for(const x of [27,319]){
    rect(x,12,70,48,'#161d24');rect(x+3,15,64,40,theme.wood);
    if(id===0){rect(x+4,17,62,17,'#71989d');rect(x+4,34,62,19,'#345866');for(let i=0;i<5;i++)rect(x+7+i*11,39+(i%3)*3,8,1,'#82b1b6');rect(x+32,15,4,40,'#c8ae87')}
    if(id===1){for(let i=0;i<5;i++){const xx=x+9+i*11;rect(xx,41,7,9,'#aa6e4d');line(xx+3,41,xx+2,23+i%3*3,'#8ab172');rect(xx-1,29+i%3*3,5,3,'#b6c787')}}
    if(id===2){line(x+6,42,x+61,23,'#ebbb6b');line(x+6,30,x+56,44,'#b9c6a1');for(let i=0;i<4;i++)rect(x+8+i*14,39-i*4,4,4,'#fff2bf')}
    if(id===3){for(let i=0;i<15;i++)rect(x+6+i*17%56,18+i*13%32,2,2,'#dfd5b4');line(x+12,22,x+32,37,'#898bab',1);line(x+32,37,x+51,29,'#898bab',1)}
  }
  const x=theme.x*32+16,y=theme.y*32+20;
  rect(x-12,y,24,4,'#22262a');
  if(id===0){rect(x-4,y-31,8,32,'#a98a60');for(let i=0;i<6;i++)rect(x-3,y-27+i*4,4,1,'#e4cd92');rect(x-7,y-12,14,3,'#73bac1')}
  if(id===1){rect(x-13,y-21,26,21,'#916b44');for(let i=0;i<6;i++){rect(x-10+i%3*7,y-17+Math.floor(i/3)*7,5,5,'#d6bc7c')}rect(x-6,y-28,12,7,'#699768')}
  if(id===2){rect(x-12,y-6,24,6,'#887969');line(x,y-5,x+8,y-24,'#b2a79a',4);rect(x+4,y-26,10,5,'#cd6549')}
  if(id===3){line(x,y-12,x-9,y,'#bca079');line(x,y-12,x+9,y,'#bca079');line(x-9,y-14,x+10,y-25,'#bac1d9',7);rect(x+7,y-27,6,5,'#e4cf94')}
  furnishHallArt(id,rect,line);
  for(const [a,b] of hallFurniture[id])furnitureArt(id,a*32+16,b*32+23,rect,line);
  if(id===4||id===5){rect(x-15,y-13,30,14,theme.wood);rect(x-17,y-15,34,4,theme.color);
    if(id===4){for(let j=0;j<3;j++){rect(x-10+j*8,y-22,5,7,'#aac4b0');rect(x-9+j*8,y-24,3,3,'#b29872')}}
    else{rect(x-8,y-29,17,13,'#475153');rect(x-1,y-33,3,22,'#aa976e');rect(x-9,y-34,18,3,'#b29872')}}
  const rand=rng(state.floor*331+h.index*9391);
  for(let i=0;i<9;i++){const x=117+i*20;rect(x,249,8,5,'#51473e');rect(x+1,250,2+Math.floor(rand()*5),2,rand()>.5?theme.color:'#cbb78f')}
  if(hallScenes.size>24)hallScenes.clear();
  hallScenes.set(roomKey,art);return art;
}

const hallFurniture=[
 [[2,5],[9,6]],[[3,6],[8,5]],[[4,3],[9,4]],[[2,6],[9,3]],[[4,5],[9,6]],[[3,4],[8,6]]
];
function furnitureArt(id,x,y,rect,line){
 const wood='#77604c',iron='#53616b',paper='#dccea5';
 rect(x-13,y-1,26,4,'#272932');
 if(id===0){rect(x-11,y-18,22,18,wood);for(let i=0;i<3;i++)rect(x-11,y-17+i*7,22,2,iron);line(x-8,y-18,x+6,y-15,paper)}
 if(id===1){rect(x-8,y-10,16,11,'#a4654c');for(let i=0;i<6;i++){line(x,y-9,x-12+i*5,y-20-i%3*5,'#6ca174',3);rect(x-13+i*5,y-23-i%3*5,5,5,i%2?'#e4b1a1':'#acbb75')}}
 if(id===2){rect(x-13,y-20,26,18,iron);rect(x-10,y-17,20,8,'#273237');for(let i=0;i<3;i++){rect(x-8+i*6,y-16,3,3,i%2?'#a1b97c':'#ef9b76');line(x-7+i*6,y-3,x-5+i*6,y-7,paper)}}
 if(id===3){line(x,y-15,x-10,y+1,wood,3);line(x,y-15,x+9,y+1,wood,3);line(x-9,y-12,x+9,y-25,iron,7);rect(x+7,y-27,6,6,'#b2bddb')}
 if(id===4){rect(x-12,y-15,24,15,'#859890');rect(x-11,y-13,22,5,'#ced4b5');rect(x-10,y-24,7,8,'#94b3bf');rect(x+2,y-21,6,5,'#c68973')}
 if(id===5){rect(x-13,y-17,26,17,wood);for(let i=0;i<3;i++){rect(x-11,y-15+i*4,22,2,paper);rect(x-4,y-14+i*4,9,1,iron)}line(x+7,y-18,x+11,y-25,iron,3)}
}
const guildStations=[
 {x:6,y:3,label:'Talk',kind:'master'}, {x:2,y:3,label:'Rest',kind:'bed'},
 {x:10,y:3,label:'Locker',kind:'locker'}, {x:10,y:5,label:'Supplies',kind:'chest'}
];
// Relay fixtures, field notes and the favors carried between floors.
const relayFloors=[
 ['Bell vault','Ring the brass bell to draw nearby patrols to the rope.','lure'],
 ['Floodworks pump','Two bells signal high water. Start the pump to drain the blue crossings and open the crew’s evacuation route.','pump'],
 ['Cage brake','Release the spare counterweight to hold the collapse clock for 45 extra seconds.','time'],
 ['Signal lift','Transmit a call sign to reveal the stair coordinates. The salvage crew remembers favors.','stairs'],
 ['Archive index','Read a former surveyor’s overlay to chart the passages around the archive.','map'],
 ['Sky relay','Ground the lightning mast to recharge your mana.','mana'],
 ['Lock gates','Open the spill gates to scatter the lock tenders from the wheel.','scatter'],
 ['Drawbridge winch','Lower the service bridge to extend the evacuation window by a minute.','time'],
 ['Mirror well','Aim the inspection mirror to locate the exit through its reflection.','stairs'],
 ['Kiln vent','Vent the furnace to weaken the guards gathered around it.','weaken'],
 ['Platform chime','Ring the departure chime to pull nearby platform patrols toward it.','lure'],
 ['Cinder cistern','Release the clean reserve to treat your party leader’s wounds.','heal'],
 ['Brine sluice','Wash the salt crust from a buried neighborhood map.','map'],
 ['Beacon lens','Focus the beam to drive nearby watchers back.','scatter'],
 ['Tribunal seal','Stamp an emergency stay to add 75 seconds to the clock.','time'],
 ['Silt turbine','Divert the current to drain strength from nearby sentries.','weaken'],
 ['Crypt lantern','Light the row of burial lamps to restore your mana.','mana'],
 ['Last bell','Sound the evacuation signal to mark the stairs and draw the last patrol away.','final']
];
function season(){return state.season??={highlights:[],notes:[],crew:'unknown',fans:0}}
function highlight(line,fans){
 const s=season();s.highlights.unshift({floor:state.floor,line});s.highlights.length=Math.min(8,s.highlights.length);
 s.fans+=fans;feed('<b>On air</b> · '+line);
}
function initialiseRelay(){
 if(state.chapter!=='mine'||state.relay?.floor===state.floor)return;
 const origin=state.hall?{x:state.hall.returnX,y:state.hall.returnY}:state;
 const queue=[origin],visited=new Set([origin.y*W+origin.x]),spots=[];
 for(let i=0;i<queue.length;i++){
   const p=queue[i];
   if(Math.abs(p.x-origin.x)+Math.abs(p.y-origin.y)>4&&!inArena(p.x,p.y)&&
      !state.scenery?.some(s=>s.x===p.x&&s.y===p.y)&&!entities.some(e=>e.x===p.x&&e.y===p.y))spots.push(p);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
     const x=p.x+dx,y=p.y+dy,k=y*W+x;
     if(visited.has(k)||tile(x,y)!==1||solid(x,y)||sanctuaryAt(x,y)||state.sanctuaries?.some(q=>q.door?.x===x&&q.door.y===y))continue;
     visited.add(k);queue.push({x,y});
   }
 }
 if(!spots.length)return;
 const pick=f=>spots[Math.min(spots.length-1,Math.floor(spots.length*f))];
 const post=pick(state.floor===2?.28:.35),camp=pick(.045);
 state.relay={floor:state.floor,x:post.x,y:post.y,camp,water:[],used:false};
 if(state.floor===2)state.relay.berth=spots.find(p=>p!==camp&&Math.hypot(p.x-camp.x,p.y-camp.y)<=2)||camp;
 if(state.npc){Object.assign(state.npc,camp,{home:{...camp},talkIndex:-1})}
 if(state.floor!==2)return;
 // A clear ring leaves a walkable detour around each submerged crossing.
 for(const p of spots){
   if(state.relay.water.length>=24)break;
   if(Math.hypot(p.x-post.x,p.y-post.y)<2||Math.hypot(p.x-camp.x,p.y-camp.y)<3||
      state.relay.water.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<4))continue;
   if([-1,0,1].every(dx=>[-1,0,1].every(dy=>!solid(p.x+dx,p.y+dy)&&tile(p.x+dx,p.y+dy)===1&&!sanctuaryAt(p.x+dx,p.y+dy))))state.relay.water.push(p);
 }
}
function highWater(){return state.floor===2&&state.relay?.floor===2&&!state.relay.used&&Math.floor((900-state.collapseLeft)/22)%2===1}
function submerged(x,y){return highWater()&&state.relay.water.some(p=>p.x===x&&p.y===y)}
function near(p,range=1.7){return p&&Math.hypot(state.x-p.x,state.y-p.y)<=range}
function relayName(){return relayFloors[state.floor-1]?.[0]||'Relay'}
function crewName(){return state.floor===1?'Iven, rope keeper':[2,3,4].includes(state.floor)?'Nell · Sound Salvage':'Joss · Night Shift'}
function agentTalk(){
 const n=state.npc,first=!n.met,s=season();
 if(first){n.met=true;state.gold+=15;if(state.floor===1)state.foundKeeper=true;unlock('Not alone');feed('The crawler shares 15 gold.')}
 const lines=state.floor===1?['The cage motor is on Floor 3. Look for the blue pipes.','Blue rope is mine. If you find a red length, leave it tied.','My brother used to count the bells between shifts. I still do.']:
 state.floor===2&&s.crew==='saved'?['Tess made the boat. I owe you a lift.','Listen for our call sign under Capitol Hill.','The audience wants us to wave. I should probably use the clean bandage.']:
 state.floor===2&&s.crew==='following'?['Tess is right behind you. Get her to the stairs.','We can still take the skiff if you get the pump running.','Keep her clear of the green mist.']:
 state.floor===2?['Tess can walk if we treat the fever. She can’t swim the spillway.','Hear two bells? Water’s coming over the grates.','That green mist stopped the grubs splitting. Saw it with my own eyes.']:
 [s.crew==='saved'?'Sound Salvage marked you as a friend. Take the dry path.':'Last team through here traded their lamp for a map.',relayFloors[state.floor-1][1],'We listen at the doors before we open them. You learn whose boots are whose.'];
 const i=first?0:(Math.max(0,n.talkIndex||0)+1+Math.floor(Math.random()*(lines.length-1)))%lines.length;
 n.talkIndex=i;n.wait=4;caption(crewName(),lines[i],true);
 if(state.floor>=5&&!state.relay.used&&!state.relay.race){
   const r=state.relay;
   showModal('<small>NIGHT SHIFT</small><h2>Joss offers a race</h2><p>Reach the '+relayName()+' within 75 seconds of dungeon time. First crew there takes the 25-gold salvage purse.</p>'+button('raceYes','Take the race')+button('raceNo','Walk away'));
   $('#raceYes').onclick=()=>{r.race='live';r.raceStart=state.collapseLeft;r.pinned=true;closeModal();persistCampaign();notify('Race started · cyan map pin')};$('#raceNo').onclick=closeModal;
 }
 if(state.floor===2&&['unknown','stranded'].includes(s.crew)){
   s.crew='stranded';
   showModal('<small>SOUND SALVAGE</small><h2>Tess has the mire fever</h2><p>Give her a tonic and escort her to the stairs, or start the Floodworks pump so Nell can get her out by boat.</p>'+button('crewTonic','Use a tonic and escort Tess',!quantity('tonic'))+
   (state.pet?'<p>'+({dog:'Your dog sits beside Tess and refuses to budge.',cat:'Your cat tests a dry ledge and looks back at Nell.',rabbit:'Your rabbit finds a narrow dry passage beneath the overflow pipe.'}[state.pet.species]||'Your companion waits beside Nell.')+'</p>'+button('crewPet','Send your companion with Nell'):'')+button('crewWait','Leave the decision open'));
   $('#crewTonic').onclick=()=>{if(!quantity('tonic')||s.crew!=='stranded')return;state.inventory.find(it=>it.id==='tonic'&&it.qty>0).qty--;s.crew='following';closeModal();caption('Tess','Lead on. I can keep up.',true);persistCampaign()};
   if($('#crewPet'))$('#crewPet').onclick=()=>{s.crew='escort';closeModal();caption('Nell','Your scout can guide us. Get that pump running.',true);persistCampaign()};
   $('#crewWait').onclick=closeModal;
 }
 persistCampaign();render();
}
function button(id,label,disabled=false){return '<button class="widebtn" id="'+id+'" '+(disabled?'disabled':'')+'>'+label+'</button>'}
function orphanedPet(){return state.floor===2&&state.season?.crew==='escort'}
function saveCrew(){
 const s=season();if(s.crew==='saved')return;s.crew='saved';highlight('Sound Salvage brought both crew members out alive.',80);
 s.medical=true;caption('Nell','Tess is clear. Use our call sign at the Capitol Hill lift.',true);
}
function moveScout(dt){
 const n=state.npc;if(!n||modalOpen())return;
 n.wait=(n.wait||0)-dt;if(n.wait>0)return;n.wait=1.1+Math.random()*2;
 const home=n.home||{x:n.x,y:n.y};n.home=home;
 const choices=[[1,0],[0,1],[-1,0],[0,-1]].map(([dx,dy])=>({x:n.x+dx,y:n.y+dy})).filter(p=>
   tile(p.x,p.y)===1&&!solid(p.x,p.y)&&!submerged(p.x,p.y)&&!sanctuaryAt(p.x,p.y)&&
   !state.sanctuaries?.some(q=>q.door?.x===p.x&&q.door.y===p.y)&&Math.hypot(p.x-home.x,p.y-home.y)<=4&&
   !near(p,1)&&!entities.some(e=>e.alive&&e.x===p.x&&e.y===p.y));
 if(choices.length){
   const dest=choices[Math.floor(Math.random()*choices.length)];
   n.fromX=n.x;n.fromY=n.y;n.facing=dest.x!==n.x?'side':dest.y<n.y?'back':'front';n.walkAt=performance.now();Object.assign(n,dest);
 }
 if(near(n,5)&&Math.random()<.18){
   const lines=['Keep your lamp low.','That echo came from underneath us.',relayFloors[state.floor-1][1]];
   const i=((n.bark??-1)+1+Math.floor(Math.random()*2))%lines.length;n.bark=i;caption(crewName(),lines[i]);
 }
}
function mistCloud(e){
 const grubs=entities.filter(g=>g.alive&&g.sprite==='flood-grub'&&Math.hypot(e.x-g.x,e.y-g.y)<=3&&!g.budded);
 for(const g of grubs){g.budded=true;g.hp=Math.max(1,g.hp-3);particles.push({x:g.x,y:g.y,t:0,kind:'magic',text:'MIST'})}
 if(grubs.length){const s=season();if(!s.mist){s.mist=true;highlight('Caught a grub nest in a leprechaun’s mist.',35)}notify('Mist sickens the grubs. Budding interrupted.')}
}
function useRelay(){
 const r=state.relay,s=season(),[name,tip,effect]=relayFloors[state.floor-1];
 showModal('<small>FLOOR '+state.floor+' · FIELD STATION</small><h2>'+name+'</h2><p>'+tip+'</p>'+button('relayUse',r.used?'Already activated':'Activate '+name,r.used)+button('relayNotes','Read field manual'));
 $('#relayNotes').onclick=()=>fieldManual();$('#relayUse').onclick=()=>{
 if(r.used)return;r.used=true;
 if(r.race==='live'){
   const won=r.raceStart-state.collapseLeft<=75;r.race=won?'won':'lost';
   if(won)state.gold+=25;highlight(won?'Beat Night Shift to the station. Won the 25-gold purse.':'Joss reached the station first and collected the purse.',won?20:4);
 }
 const local=entities.filter(e=>e.alive&&e.type==='enemy'&&!e.boss&&Math.hypot(e.x-r.x,e.y-r.y)<15);
 if(effect==='pump')saveCrew();
 if(effect==='time')state.collapseLeft+={3:45,8:60,15:75}[state.floor];
 if(effect==='heal'){state.wounds={};restoreHealth(35)}
 if(effect==='mana')state.mp=state.maxMp;
 if(effect==='map')for(let y=Math.max(0,r.y-13);y<Math.min(H,r.y+14);y++)for(let x=Math.max(0,r.x-13);x<Math.min(W,r.x+14);x++)seen[y][x]=true;
 if(['stairs','final'].includes(effect)){let y=tiles.findIndex(row=>row.includes(3));if(y>=0){let x=tiles[y].indexOf(3);seen[y][x]=true;r.exit={x,y}}}
 if(['lure','final'].includes(effect))for(const e of local){e.den={x:r.x,y:r.y};e.lured=18}
 if(effect==='scatter')for(const e of local){e.avoid=20;e.pursuit=0}
 if(effect==='weaken')for(const e of local)e.hp=Math.max(1,Math.ceil(e.hp*.6));
 if(state.floor===4&&s.crew==='saved'){state.collapseLeft+=90;giveItem('tonic',1);highlight('Nell held the lift. Gained 90 seconds and a tonic.',25)}
 highlight(name+' activated.',12);closeModal();notify(name+' online'+(r.exit?' · stairs '+r.exit.x+', '+r.exit.y:''));persistCampaign();render();sendPartyWorld();
 };
}
function fieldManual(){
 const s=season(),r=state.relay,entry=relayFloors[state.floor-1];if(!r||!entry)return;
 if(!s.notes.includes(state.floor))s.notes.push(state.floor);
 showModal('<small>SEATTLE RESCUE · HANDWRITTEN FIELD MANUAL</small><h2>Shift notes</h2>'+s.notes.map(f=>'<p><b>F'+f+' · '+relayFloors[f-1][0]+'</b><br>“'+relayFloors[f-1][1]+'” — '+['Mara','Nell','Iven'][f%3]+'</p>').join('')+
 '<p>Pencil mark at X '+r.x+', Y '+r.y+'.</p>'+button('pinRelay',r.pinned?'Remove map pin':'Pin fixture to map'));
 $('#pinRelay').onclick=()=>{r.pinned=!r.pinned;persistCampaign();closeModal();render()};persistCampaign();
}
function replayHighlights(){
 const clips=season().highlights.slice(0,3).reverse();if(!clips.length)return;
 const started=performance.now();
 showModal('<small>GUILD SHORTWAVE · TEN-SECOND RECAP</small><h2>Tonight underground</h2><div id="recapClip" class="ai-box"></div>'+button('recapBack','Return to terminal'));
 const frame=$('#recapClip');$('#recapBack').onclick=onAir;
 function next(){if(!frame.isConnected||$('#modal').classList.contains('hidden'))return;
   const elapsed=performance.now()-started;if(elapsed>=10000){onAir();return}
   const h=clips[Math.floor(elapsed*clips.length/10000)];frame.textContent='Floor '+h.floor+' · '+h.line;setTimeout(next,250)}
 next();
}
function onAir(){
 const s=season(),contract=s.contract;
 showModal('<small>GUILD SHORTWAVE · AUDIENCE FEED</small><h2>On air</h2><p>'+s.fans+' followers</p><h3>Last broadcast</h3>'+
 (s.highlights.length?s.highlights.slice(0,3).map(h=>'<p>F'+h.floor+' · '+safeAttr(h.line)+'</p>').join(''):'<p>The recorder is waiting for your first field report.</p>')+
 (s.highlights.length?button('playRecap','Play ten-second recap'):'')+(s.medical?button('fanGift','Claim fan-voted medical parcel'):'')+
 '<h3>Open-channel sponsor</h3><p>Broadcast your position. Patrols can detect you from farther away until you defeat a roaming miniboss. Payment is a Gold loot box.</p>'+
 button('liveDeal',contract==='live'?'Cancel broadcast':contract==='paid'?'Contract paid':'Accept broadcast contract',contract==='paid')+button('fieldBook','Read shift notes'));
 if($('#playRecap'))$('#playRecap').onclick=replayHighlights;
 $('#liveDeal').onclick=()=>{s.contract=contract==='live'?'off':'live';persistCampaign();onAir()};
 if($('#fanGift'))$('#fanGift').onclick=()=>{if(!s.medical)return;s.medical=false;giveItem('tonic',2);persistCampaign();onAir()};
 $('#fieldBook').onclick=()=>fieldManual();
}
function broadcastKill(e){
 if(state.floor===2)hatchGrub(e);
 if(!e.chief)return;
 const s=season();highlight(e.name+' defeated on camera.',24);
 if(s.contract==='live'){s.contract='paid';awardBox('Gold');highlight('Open-channel sponsor paid a Gold loot box.',40)}
}
function expeditionStep(){
 const r=state.relay;if(!r)return;
 const s=season();
 if(state.floor>=3&&state.pet&&!r.petClue&&near(r,6)){
   r.petClue=true;
   if(state.pet.species==='cat'&&entities.some(e=>e.alive&&near(e,6)))caption('Companion signal','Your cat flattens its ears. A patrol is close to the station.',true);
   else if(state.pet.species==='dog')caption('Companion signal','Your dog picks up the scent of another crawler near the station.',true);
   else caption('Companion signal','Your scout has found the field station. Look for the brass dial.',true);
 }
 if(state.floor===2&&near(r,7)&&state.pet&&!s.petWarned&&!orphanedPet()){
   s.petWarned=true;caption('Companion signal',state.pet.species==='dog'?'Your dog noses the pump handle, then looks back toward the stranded crew.':state.pet.species==='cat'?'Your cat refuses the wet grate and picks a dry line toward the pump.':'Your rabbit thumps twice. The dry ledge leads to the pump.',true);
 }
}
function drawRelay(){
 const r=state.relay;if(!r||state.chapter!=='mine')return;
 if(state.floor===2&&!r.used)for(const p of r.water||[]){
   if(!seen[p.y]?.[p.x])continue;const x=p.x*32,y=p.y*32;
   ctx.fillStyle=highWater()?'#2c7fa5b8':'#34566e88';ctx.fillRect(x,y+4,32,25);
   ctx.fillStyle='#94cdd4';for(let i=0;i<3;i++)ctx.fillRect(x+3+(i*7)%13,y+9+i*6,9,1);
 }
 if(seen[r.y]?.[r.x]){
 const x=r.x*32,y=r.y*32;ctx.fillStyle='#252d32';ctx.fillRect(x+3,y+16,26,14);ctx.fillStyle='#ae8461';ctx.fillRect(x+5,y+11,21,14);
 ctx.fillStyle=r.used?'#93ba91':'#f4cb70';ctx.fillRect(x+7,y+13,8,6);ctx.fillStyle='#435055';ctx.fillRect(x+17,y+15,7,3);
 ctx.fillStyle='#f8d984';ctx.font='bold 10px monospace';ctx.fillText(relayName(),x-6,y+7);
 }
 if(state.floor===2&&r.berth&&seen[r.berth.y]?.[r.berth.x]&&!['saved','following'].includes(state.season?.crew)){
   const p=r.berth;spriteDraw('hero-side',p.x*32+16,p.y*32+25,24,31);
   ctx.fillStyle='#ddc59a';ctx.font='9px monospace';ctx.fillText('TESS',p.x*32,p.y*32-4);
 }
 if(state.floor===2&&state.season?.crew==='following'&&r.trail&&!state.hall)spriteDraw('hero-back',r.trail.x*32+16,r.trail.y*32+24,25,36);
}

function guildStation(){const h=state.hall;if(!h)return;const t=hallStyles[hallTheme(h)];return [...guildStations,{x:t.x,y:t.y,kind:"discovery",label:t.object}].filter(s=>Math.hypot(s.x-h.x,s.y-h.y)<=1.6).sort((a,b)=>Math.hypot(a.x-h.x,a.y-h.y)-Math.hypot(b.x-h.x,b.y-h.y))[0]}
function personalMenusLocked(){return state.guildTrained!==true}
function lockHint(){
  if(state.hall||state.chapter==='surface'||state.chapter==='create'){notify(state.hall?'Walk up the rug and tap Interact beside Rowan.':'Descend into the mine to meet Guild Master Rowan.');return}
  const doors=(state.sanctuaries||[]).map(q=>q.door||q).sort((a,b)=>Math.hypot(a.x-state.x,a.y-state.y)-Math.hypot(b.x-state.x,b.y-state.y));
  const q=doors[0];notify(q?'Guild induction: nearest sanctuary at X '+q.x+', Y '+q.y+' (green on map).':'Speak to Guild Master Rowan in a sanctuary.');
}
function hallWalkable(x,y){
  if(hallFurniture[hallTheme()].some(([a,b])=>a===x&&b===y))return false;
  const t=hallStyles[hallTheme()];if(x===t.x&&y===t.y)return false;
  return (x===6&&y===8)||(x>=1&&x<=11&&y>=2&&y<=7&&!guildStations.some(s=>s.x===x&&s.y===y));
}
function enterHall(q){
  const index=state.sanctuaries.indexOf(q);
  if(index<0)return;
  if(!q.door||!q.room){
    const outside=[[1,0],[-1,0],[0,-1],[0,1]].map(([dx,dy])=>({x:q.x+dx,y:q.y+dy})).find(p=>!solid(p.x,p.y));
    if(!outside)return;
    q.door={x:q.x,y:q.y};q.legacyExit=outside;
  }
  const dx=q.legacyExit?0:q.door.x<q.room.x?-1:q.door.x>=q.room.x+q.room.w?1:0;
  const dy=q.legacyExit?0:q.door.y<q.room.y?-1:q.door.y>=q.room.y+q.room.h?1:0;
  for(const e of entities)if(e.pursuit>0){e.pursuit=0;e.avoid=6}
  state.hall={index,x:6,y:7,returnX:q.legacyExit?.x??q.door.x+dx,returnY:q.legacyExit?.y??q.door.y+dy};
  state.x=q.x;state.y=q.y;state.facing='up';step=null;clearMovement();cameraX=null;
  visualX=6;visualY=7;
  if(!q.visitedGuild){q.visitedGuild=true;ridiculous('Even Cowards Need a Break')}
  caption('Guild Master Rowan',personalMenusLocked()?'Welcome to the Seattle guild. Walk up the rug and tap Interact for your induction.':'Back under our roof. Come by the hearth if you want to review a guardian fight.',true);
  persistCampaign();render();
}
function leaveHall(){
  if(state.floor>=4&&!state.identityLocked){guildIdentity();return}
  if(personalMenusLocked()){
    state.hall.x=6;state.hall.y=7;clearMovement();visualX=6;visualY=7;notify('Finish induction with Rowan before leaving.');return;
  }
  const h=state.hall;state.x=h.returnX;state.y=h.returnY;state.hall=null;$('#objective').textContent='FIND THE STAIRS • SURVIVE';
  step=null;clearMovement();visualX=state.x;visualY=state.y;cameraX=null;
  reveal();persistCampaign();render();notify('Back in the dungeon');
}
function hallTutorial(page=state.guildLesson||0,review=false){
  if(!state.hall)return;
  page=Math.max(0,Math.min(3,page));
  const [heading,line]=guildLessons[page];
  showModal('<small>GUILD MASTER ROWAN · '+(page+1)+' / 4</small><h2>'+heading+'</h2><p>'+line+'</p><button id="guildNext" class="widebtn">'+(page<3?'Continue':review?'Done':'Finish induction & unlock menu')+'</button>');
  $('#guildNext').onclick=()=>{
    if(page<3){if(!review){state.guildLesson=page+1;persistCampaign()}hallTutorial(page+1,review);return}
    if(!review){state.guildTrained=true;giveItem("food",2);delete state.guildLesson;unlock('Guild inductee');persistCampaign();openTab('journal')}
    closeModal();caption('Guild Master Rowan',review?'My door is always open.':'You’re on the guild register. Your backpack, map, skills and party menu are ready.',true);render();persistCampaign();
  };
}
function recordGuardian(floor,name,turns,guards){
  state.guardianRecord??=[];
  if(!state.guardianRecord.some(row=>row.floor===floor))state.guardianRecord.push({floor,name,turns,guards});
}
function guildReview(){
  const records=[...(state.guardianRecord||[])];
  records.sort((a,b)=>b.floor-a.floor);
  showModal('<h2>Guardian field notes</h2>'+(records.length?'<label>Completed encounter <select id="guildFight">'+records.map((r,i)=>'<option value="'+i+'">'+safeAttr(r.name)+' · F'+r.floor+'</option>').join('')+'</select></label><p id="guildTip"></p>':'<p>Win a guardian battle and come back. We’ll go over its attacks together.</p>')+'<button id="guildBack" class="widebtn">Back</button>');
  if(records.length){
    const select=$('#guildFight');const read=()=>{
      const r=records[Number(select.value)];
      const advice=r.floor%9===6?'Guard against Venom Bite to prevent poison.':r.floor%9===0?'Guard against Mana Drain to protect your spell reserve.':r.floor>3?'Guard against Armor Shatter. Use quieter turns to land a hit.':'Watch for Devastating Strike on every third turn. Save Guard or your one-use arena trap for that turn.';
      $('#guildTip').textContent=(r.turns?'You won in '+r.turns+' turns and guarded '+r.guards+' times. ':'')+advice;
    };select.onchange=read;read();
  }
  $('#guildBack').onclick=guildMaster;
}
function guildIdentity(){
 if(state.identityLocked||state.floor<4)return;
 const races=ancestries,classes=Object.keys(skillPaths);
 showModal('<small>FLOOR 4 · GUILD OF ASCENSION</small><h2>Choose your new identity</h2><p>Rowan: Your race determines your innate gifts. Your class determines your combat techniques and skill tree. Both are permanent for this campaign.</p><label>Race<select id="ascRace">'+races.map(r=>'<option>'+r+'</option>').join('')+'</select></label><canvas id="ascPreview" width="96" height="128" aria-label="Race preview"></canvas><p id="ascPerks"></p><label>Class<select id="ascClass">'+classes.map(c=>'<option>'+c+'</option>').join('')+'</select></label><p id="ascClassInfo"></p><button class="widebtn" id="ascConfirm">Review selection</button>');
 const preview=()=>{const r=$('#ascRace').value,c=$('#ascClass').value,g=$('#ascPreview').getContext('2d');g.clearRect(0,0,96,128);g.imageSmoothingEnabled=false;g.drawImage(crawlerPose('down',0,{...state.character,race:r}),0,0,96,128);$('#ascPerks').textContent=perkText(r);$('#ascClassInfo').textContent=skillPaths[c].bonus+' · '+skillPaths[c].nodes.map(n=>n[0]).join(', ')};
 $('#ascRace').value=races.includes(state.character?.race)?state.character.race:'Human';$('#ascClass').value=classes.includes(state.specialization)?state.specialization:'Vanguard';$('#ascRace').onchange=preview;$('#ascClass').onchange=preview;preview();
 $('#ascConfirm').onclick=()=>{const r=$('#ascRace').value,c=$('#ascClass').value;showModal('<h2>Confirm permanent identity</h2><p>'+r+' · '+c+'</p><p>'+perkText(r)+' · '+skillPaths[c].bonus+'</p><button class="widebtn" id="ascLock">Confirm for this campaign</button><button class="widebtn" id="ascBack">Change selection</button>');$('#ascBack').onclick=guildIdentity;$('#ascLock').onclick=()=>{if(state.identityLocked)return;state.character={...state.character,race:r};for(const [k,v] of Object.entries(racePerks[r])){state[k]=(state[k]||0)+v;if(k==='maxHp')state.hp+=v;if(k==='maxMp')state.mp+=v}if(state.specialization!==c){if(state.specialization)removeClass();state.specialization=c;applyClassBonus(c,1)}state.identityLocked=true;state.guildTrained=true;state.hp=Math.min(state.hp,state.maxHp);state.mp=Math.min(state.mp,state.maxMp);persistCampaign();closeModal();render();caption('Guild Master Rowan','Your identity is sealed. Make it count.',true);persistCampaign()}};
}
function guildMaster(){
  if(!state.hall)return;
  if(state.floor>=4&&!state.identityLocked){guildIdentity();return}
  if(personalMenusLocked()){hallTutorial();return}
  showModal('<small>SEATTLE CRAWLERS’ GUILD</small><h2>Guild Master Rowan</h2><p>'+['Take a seat by the hearth. What shall we go over?','I put the kettle on. Tell me what you saw down there.','Boots by the stove, crawler. There’s news on the shortwave.'][Math.floor(Math.random()*3)]+'</p><button class="widebtn" id="guildNotes">Review defeated guardians</button><button class="widebtn" id="guildBasics">Revisit the tutorial</button><button class="widebtn" id="guildCounter">Guild services</button><button class="widebtn" id="guildAir">Audience terminal</button><button class="widebtn" id="guildManual">Field manual</button>'+(state.floor%6===0?'<button class="widebtn" id="cityExchange">City exchange</button>':''));
  $('#guildAir').onclick=onAir;$('#guildManual').onclick=fieldManual;
  if($('#cityExchange'))$('#cityExchange').onclick=cityMarket;
  $('#guildNotes').onclick=guildReview;$('#guildBasics').onclick=()=>hallTutorial(0,true);$('#guildCounter').onclick=()=>sanctuaryMenu(state.sanctuaries[state.hall.index]);
}
function hallInteract(){
  const station=guildStation(),q=state.sanctuaries[state.hall.index];
  if(!station){notify('Approach Rowan, the bed, the locker or the supply chest.');return}
  if(station.kind==='master'){guildMaster();return}
  if(personalMenusLocked()){lockHint();return}
  if(station.kind==='discovery'){
    const id=hallTheme(),t=hallStyles[id];let detail='';
    if(id===3){const y=tiles.findIndex(row=>row.includes(3));if(y>=0)detail='A brass pin marks the stairs at X '+tiles[y].indexOf(3)+', Y '+y+'.'}
    if(q&&!q.discoveryRead){
      q.discoveryRead=true;
      if(id===0){for(let y=Math.max(0,q.y-7);y<Math.min(H,q.y+8);y++)for(let x=Math.max(0,q.x-7);x<Math.min(W,q.x+8);x++)if(Math.hypot(x-q.x,y-q.y)<=7)seen[y][x]=true;detail='You copy the surrounding passages onto your map.'}
      if(id===1){giveItem('food',1);detail='You take a trail ration from the cabinet.'}
      if(id===4){giveItem('tonic',1);detail='A labeled tonic goes into your pack.'}
      if(id===5){state.relay.pinned=true;detail='You pin the local field station to your map.'}
      if(id===2){giveItem('torch',1);detail='You find a spare torch under the switchboard.'}
      persistCampaign();
    }
    showModal('<small>'+t.name+'</small><h2>'+t.object+'</h2><p>'+t.lore+'</p><p>'+detail+'</p>');return
  }
  if(station.kind==='locker'){storageMenu(q);return}
  sanctuaryMenu(q);
}
function drawHall(){
  const h=state.hall,x=step?(visualX??h.x):h.x,y=step?(visualY??h.y):h.y;
  const g=ctx;g.fillStyle='#13171b';g.fillRect(0,0,canvas.width,canvas.height);
  const cw=canvas.clientWidth||canvas.width,ch=canvas.clientHeight||canvas.height;
  // Fit the room to the displayed viewport, including portrait and landscape phones.
  const scale=Math.min(cw/416,ch/320),sx=scale*canvas.width/cw,sy=scale*canvas.height/ch;
  g.save();g.translate((canvas.width-416*sx)/2,(canvas.height-320*sy)/2);g.scale(sx,sy);g.imageSmoothingEnabled=false;
  const backdrop=hallBackdrop(h);if(backdrop)g.drawImage(backdrop,0,0);else{g.fillStyle='#584638';g.fillRect(0,0,416,320)}
  const look={armor:'coat',charm:'bell'};
  g.drawImage(crawlerPose('down',0,{skin:3,race:'Human'},look),193,85,30,40);
  g.fillStyle='#d3d1c4';g.fillRect(204,93,7,2);g.fillRect(205,98,6,4);
  g.font='bold 11px monospace';g.textAlign='center';g.fillStyle='#161b1e';g.fillRect(149,71,118,14);g.fillStyle='#eed19a';g.fillText('Guild Master Rowan',208,81);
  g.font='bold 12px monospace';g.textAlign='center';g.fillStyle='#19212a';g.fillRect(91,265,234,16);g.fillStyle=hallStyles[hallTheme()].color;g.fillText(hallStyles[hallTheme()].name+' · '+state.floor+'-'+(h.index+1),208,277);
  drawHero(x,y);
  for(const ally of Object.values(netPlayers))if(ally.floor===state.floor&&ally.hall?.index===h.index)g.drawImage(crawlerPose('down',0,ally.character||{},ally.gear||{}),ally.hall.x*32+4,ally.hall.y*32-4,24,32);
  g.restore();
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
  if(y===12&&x===10){fill(12,7,3,19,'#5e4430');fill(4,5,21,11,'#bf9f67');fill(7,8,14,1,'#53432e');fill(8,11,10,1,'#53432e')}
  if(y===16&&x===10){fill(4,12,10,2,'#62a8b3');fill(12,14,3,5,'#438197')}
  if(y===22)fill(0,12,32,20,'#141d25');
  if(x===10&&[8,12,16].includes(y)){fill(4,7,3,20,'#3a342e');fill(1,3,9,8,'#42392d');fill(3,4,5,5,'#ffc978')}
}
function chapterHUD(){
  const surface=state.chapter==='create'||state.chapter==='surface';
  $('#heroName').textContent=crawlerTitle();
  if(state.hall){
    $('#roomName').textContent=hallStyles[hallTheme()].name;$('#floorTag').textContent='SANCTUARY';
    $('#objective').textContent=personalMenusLocked()?'SPEAK TO ROWAN':'EXIT VIA THE SOUTH STAIRS';
    $('#coords').textContent='HALL '+(state.hall.index+1);$('#bossbar').classList.add('hidden');
    $('#goals').textContent=personalMenusLocked()?'Walk to the guild master and tap Interact.':'Rest, use your locker or review a completed guardian battle.';
    return;
  }
  if(!surface){
    if(state.chapter==='mine'){
      const goal=state.foundKeeper?'Reach the third-floor guardian and free the miners’ cage.':'Find the rope keeper on the first floor. Stand beside him and tap Interact to talk.';
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

function fresh(){return {floor:1,x:15,y:9,hp:100,maxHp:100,mp:0,maxMp:0,xp:0,nextXp:100,level:1,power:8,armor:0,gold:25,kills:0,steps:0,inventory:[],achievements:[],rooms:0,dead:false,feed:[],boss:null,stairs:false,torchTurns:0,weapon:null,skillPoints:0,coinsFound:0,facing:'down'};}
function rng(seed){let x=seed>>>0;return()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296}}
const sceneryArt=new Image();sceneryArt.src='scenery.png';
const sights=[
 ['Survey desk','A surveyor traced the rescue shaft in blue pencil. The chart reveals the surrounding passages.'],
 ['Emergency radio','A signal breaks through the static: “Seattle Rescue listening.” A voice reads you the next section of the mine map.'],
 ['Shift memorial','Names of the lost shift are stamped into brass. Beneath them, a maintenance diagram shows the tunnels around you.']
];
function furnishFloor(){
  if(state.chapter==='create'||state.chapter==='surface')return;
  const random=rng((state.floor*7919+12347)>>>0);
  const props=[],occupied=new Set(),key=(x,y)=>y*W+x;
  state.scenery=props;state.investigated=[];
  const protectedTile=(x,y)=>sanctuaryAt(x,y)||inArena(x,y)||state.arena?.gates?.some(g=>g.x===x&&g.y===y);
  const available=(x,y)=>tile(x,y)===1&&!protectedTile(x,y)&&!occupied.has(key(x,y));
  function place(x,y,art){props.push({x,y,art});occupied.add(key(x,y))}
  for(const e of entities){
    if(e.type!=='enemy'||e.boss||!e.alive||!available(e.x,e.y)||Math.hypot(state.x-e.x,state.y-e.y)<4)continue;
    if(props.length>=4)break;
    if(props.some(p=>Math.hypot(p.x-e.x,p.y-e.y)<9))continue;
    const art=e.sprite==='sewer-rat'?3:e.sprite.includes('spider')?5:4;
    place(e.x,e.y,art);e.den={x:e.x,y:e.y};
  }
  const candidates=[];
  for(let y=2;y<H-2;y++)for(let x=2;x<W-2;x++){
    if(available(x,y)&&Math.hypot(state.x-x,state.y-y)>2&&!(state.npc?.x===x&&state.npc.y===y)&&!entities.some(e=>e.x===x&&e.y===y))candidates.push({x,y});
  }
  for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]]}
  let places=0,obstacles=0;
  for(const {x,y} of candidates){
    if(places<3&&props.every(p=>Math.hypot(x-p.x,y-p.y)>5)){place(x,y,6+places++);continue}
    if(obstacles>=18){if(places===3)break;continue}
    // An intact walkable ring guarantees a detour around every solid prop.
    let ring=true;
    for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++)if(!available(xx,yy))ring=false;
    if(ring){place(x,y,obstacles++%3)}
  }
}
function nearbySight(){
  if(state.hall)return;return state.scenery?.find(p=>p.art>=3&&Math.hypot(p.x-state.x,p.y-state.y)<=1.6&&!state.investigated?.includes(p.y*W+p.x));
}
function drawGuildEntrance(q){
  if(q.room){
    // The sanctuary is an interior instance. Outside, its footprint reads as masonry.
    for(let y=q.room.y;y<q.room.y+q.room.h;y++)for(let x=q.room.x;x<q.room.x+q.room.w;x++){
      if(!seen[y]?.[x])continue;
      ctx.drawImage(terrainArt((state.floor-1)%18,(x*7+y)%12,true),x*TILE,y*TILE,TILE,TILE);
    }
  }
  const door=q.door||q;
  if(!seen[door.y]?.[door.x])return;
  const px=door.x*TILE,py=door.y*TILE;
  const near=Math.hypot(visualX-door.x,visualY-door.y)<2;
  ctx.save();ctx.translate(px,py);
  const rect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h)};
  rect(1,2,30,30,'#272a2a');rect(3,4,26,26,'#9a8d75');
  rect(5,6,22,23,'#161719');rect(7,6,18,22,'#765035');
  for(let x=8;x<25;x+=4){rect(x,7,1,20,'#4c3328');rect(x+1,8,1,18,'#906848')}
  for(const y of [10,23]){rect(6,y,17,2,'#34393b');rect(8,y,1,1,'#aaa594')}
  rect(20,16,3,5,'#3e3027');rect(21,17,2,2,'#e7bf70');
  rect(2,27,28,3,'#beb39c');rect(1,30,30,2,'#706a60');
  for(const x of [2,27]){rect(x,9,3,5,'#b48e53');rect(x,10,2,3,near?'#ffdb7c':'#dcac59')}
  rect(12,1,8,5,'#37494a');rect(15,1,2,5,'#d8ba73');rect(13,3,6,1,'#d8ba73');
  ctx.restore();
}
const supplies={
  'meth-cargo':{name:'Sealed meth cargo',icon:'▣',desc:'Trade this pack llama parcel at the city exchanges on Floors 6, 12 or 18. Ask Rowan in the guild.'},
  torch:{name:'Torch',short:'Torch',icon:'🔥',desc:'Lights your surroundings for 40 steps.'},
  food:{name:'Trail ration',short:'Food',icon:'🍞',desc:'Restores 15 health, or 7 while sick.'},
  tonic:{name:'Health potion',short:'Potion',icon:'⚗',desc:'Restores 35 health and treats wounds, poison, and sickness.'},
  biscuit:{name:'Enchanted biscuit',icon:'✧',desc:'Feed this to your pet to register it as a crawler. It will gain levels and assist your strikes.'}
};
const hotItems=['torch','food','tonic'];
function giveItem(id,qty){
 const owned=state.inventory.find(it=>it.id===id);
 if(owned)owned.qty+=qty;else state.inventory.push({id,...(supplies[id]||{name:id==='shard'?'Mana shard':id,icon:'✦'}),qty});
}
function quantity(id){return state.inventory.find(i=>i.id===id)?.qty||0}
function chooseHot(){
  if(personalMenusLocked()){lockHint();return}
  showModal('<h2>X · Hot list</h2>'+hotItems.map(id=>'<button class="widebtn" data-hot="'+id+'">'+supplies[id].name+' ×'+quantity(id)+(state.hotItem===id?' ✓':'')+'</button>').join(''));
  for(const btn of $$('[data-hot]'))btn.onclick=()=>{state.hotItem=btn.dataset.hot;closeModal();persistCampaign();render()};
}
function hotUse(){
  if(personalMenusLocked()){lockHint();return}
  if(state.dead||bossFight||modalOpen())return;
  if(!hotItems.includes(state.hotItem)||!quantity(state.hotItem)){chooseHot();return}
  useItem(state.hotItem,true);
}
const animalNames={cat:'Alley cat',dog:'Lost terrier',rabbit:'Cottontail'};
function placeAnimal(){
  state.wildAnimal=null;
  if(state.floor!==1&&Math.random()>.78)return;
  const queue=[[state.x,state.y]],visited=new Set([state.y*W+state.x]),spots=[];
  for(let n=0;n<queue.length;n++){
    const [x,y]=queue[n];
    const distance=Math.abs(x-state.x)+Math.abs(y-state.y);
    if(distance>=4&&distance<=15&&!sanctuaryAt(x,y)&&!inArena(x,y)&&!entities.some(e=>e.x===x&&e.y===y)&&!state.scenery?.some(p=>p.x===x&&p.y===y))spots.push({x,y});
    if(distance>=18)continue;
    for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){
      const a=x+dx,b=y+dy,k=b*W+a;if(visited.has(k)||solid(a,b)||tile(a,b)!==1)continue;
      visited.add(k);queue.push([a,b]);
    }
  }
  if(spots.length)state.wildAnimal={...spots[Math.floor(Math.random()*spots.length)],species:['cat','dog','rabbit'][Math.floor(Math.random()*3)]};
}
function meetAnimal(){
  const animal=state.wildAnimal;if(!animal)return;
  const name=animalNames[animal.species];
  showModal('<h2>'+name+'</h2><p>'+ (state.pet?'It noses a guild parcel toward your companion.':'It came down from the surface and waits for you to approach.')+'</p><button class="widebtn" id="befriend">'+(state.pet?'Accept pet supplies':'Befriend '+name)+'</button><button class="widebtn" id="animalLeave">Leave it be</button>');
  $('#animalLeave').onclick=closeModal;
  $('#befriend').onclick=()=>{if(!state.pet){state.pet={species:animal.species,crawler:false,level:1,wins:0};setPetTile(animal)}
    state.wildAnimal=null;awardBox('Pet');persistCampaign();closeModal();render();caption(name,'A pet loot box is tucked into your backpack.',true)};
}
function petStats(){
 const p=state.pet;if(!p?.crawler)return null;
 const level=p.level||1,gear=p.gear||{},mutation=p.mutation;
 return {maxHp:24+level*6+(gear.armor?.rank||0)*5+(mutation==='Ironhide'?20:0),power:2+level+(gear.weapon?.rank||0)*3+(mutation==='Razorclaw'?5:0),armor:(gear.armor?.rank||0)*2+(mutation==='Ironhide'?4:0)};
}
function readyPet(){const p=state.pet,stats=petStats();if(!stats||orphanedPet())return null;p.hp=Math.min(stats.maxHp,p.hp??stats.maxHp);return p.hp>0?{p,stats}:null}
function petVictory(){
  const pet=state.pet;if(!pet||orphanedPet())return;
  pet.wins=(pet.wins||0)+1;if(pet.crawler){pet.level=1+Math.floor(pet.wins/4);const stats=petStats();pet.hp=Math.min(stats.maxHp,(pet.hp??stats.maxHp)+4)}
  if(pet.wins%5===0)awardBox('Pet');
}
function setPetTile(pos){
  if(state.pet)state.pet.trail={x:pos.x,y:pos.y,floor:state.floor,hall:state.hall?.index??null};
}
let petVisual=null;
function petPosition(heroX,heroY){
  const leader=state.hall||state;
  const hall=state.hall?.index??null;
  let trail=state.pet.trail;
  if(!trail||trail.floor!==state.floor||trail.hall!==hall||Math.abs(trail.x-leader.x)+Math.abs(trail.y-leader.y)!==1){
    const behind={up:[0,1],down:[0,-1],left:[1,0],right:[-1,0]}[state.facing]||[0,1];
    for(const [dx,dy] of [behind,[0,1],[0,-1],[-1,0],[1,0]]){
      const x=leader.x+dx,y=leader.y+dy;
      if(hall!==null?!hallWalkable(x,y):solid(x,y)||sanctuaryAt(x,y)||entities.some(e=>e.alive&&e.x===x&&e.y===y))continue;
      setPetTile({x,y});trail=state.pet.trail;break;
    }
    if(!trail||trail.floor!==state.floor||trail.hall!==hall||Math.abs(trail.x-leader.x)+Math.abs(trail.y-leader.y)!==1)return null;
  }
  const dx=leader.x-trail.x,dy=leader.y-trail.y;
  const progress=step?Math.min(1,Math.abs(heroX-leader.x)+Math.abs(heroY-leader.y)):0;
  // When trading places in a narrow corridor, pass shoulder to shoulder.
  const passing=(heroX-leader.x)*dx+(heroY-leader.y)*dy<0?Math.sin(progress*Math.PI)*.4:0;
  const target={x:trail.x+dx*progress-dy*passing,y:trail.y+dy*progress+dx*passing};
  const now=performance.now(),key=state.floor+'/'+hall;
  if(!petVisual||petVisual.owner!==state.pet||petVisual.key!==key||Math.hypot(target.x-petVisual.x,target.y-petVisual.y)>1.5){petVisual={...target,key,owner:state.pet,time:now,facing:state.facing==='left'?-1:1}}
  else{const dt=Math.max(0,Math.min(80,now-petVisual.time)),blend=1-Math.exp(-dt/55);if(Math.abs(target.x-petVisual.x)>.03)petVisual.facing=target.x>petVisual.x?1:-1;petVisual.x+=(target.x-petVisual.x)*blend;petVisual.y+=(target.y-petVisual.y)*blend;petVisual.time=now}
  return {x:petVisual.x,y:petVisual.y,facing:petVisual.facing,walking:!!step||Math.hypot(target.x-petVisual.x,target.y-petVisual.y)>.04};
}
function drawAnimal(species,x,y,crawler,walking=false,g=ctx,facing=1){
  const px=Math.round(x*TILE+16),py=Math.round(y*TILE+24);
  const fur={cat:'#bcb6ba',dog:'#bc845a',rabbit:'#e4cfaa'}[species];
  const phase=walking&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches?Math.sin(performance.now()/65):0,bob=Math.round(Math.abs(phase)*(species==='rabbit'?-3:-1));
  g.save();g.translate(px,py+bob);g.scale(facing,1);
  const rect=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(x,y,w,h)};
  rect(-8,0,15,2,'#141b20');rect(-6,-8,11,7,fur);rect(1,-12,8,8,fur);
  if(species==='rabbit'){rect(1,-19,2,8,fur);rect(5,-18,2,7,fur);rect(-9,-7,4,4,'#fae7cc')}
  else if(species==='cat'){rect(1,-15,3,4,fur);rect(6,-15,3,4,fur);rect(-8,-12,3,8,fur)}
  else{rect(0,-12,3,7,'#704632');rect(7,-8,5,3,fur);rect(-9,-10,4,4,fur)}
  rect(-5+Math.round(phase*2),-2,3,3,fur);rect(3-Math.round(phase*2),-2,3,3,fur);rect(6,-10,2,2,'#1a2027');
  if(crawler){rect(0,-6,6,2,'#5bc4cb');rect(1,-4,2,3,'#ffd575');const p=state.pet;if(p?.species===species){if(p.mutation==='Ironhide'){for(let i=0;i<4;i++){rect(-7+i*3,-10+(i%2),4,5,'#657684');rect(-7+i*3,-10+(i%2),3,1,'#bbc9ce')}rect(2,-14,6,3,'#87949b')}if(p.mutation==='Razorclaw'){rect(-6,0,5,2,'#e9dfcb');rect(3,0,6,2,'#e9dfcb');rect(6,-10,2,2,'#e05d4e');rect(-9,-11,2,5,'#85554e')}}}
  g.restore();
}

function interactionTarget(){
  if(state.hall){const s=guildStation();return s&&{kind:'hall',label:s.kind==='master'?'Talk to Rowan':s.label}}
  if(state.chapter==='surface'&&Math.hypot(state.x-10,state.y-12)<=2)return {kind:'sign',label:'Read sign'};
  if(state.relay&&near(state.relay))return {kind:'relay',label:relayName()};
  const n=state.npc;
  if(n&&(near(n)||(state.floor===2&&!['saved','following'].includes(state.season?.crew)&&near(state.relay?.berth))))return {kind:'npc',label:state.floor===1?'Talk to Iven':'Talk to '+crewName().split(' · ')[0]};
  if(state.wildAnimal&&Math.hypot(state.x-state.wildAnimal.x,state.y-state.wildAnimal.y)<=1.65)return {kind:"animal",label:"Meet "+animalNames[state.wildAnimal.species]};
  const site=state.scenery?.find(p=>p.art>=3&&Math.hypot(p.x-state.x,p.y-state.y)<=1.6);
  if(site)return {kind:'site',label:site.art>=6?'Examine site':'Inspect hideout',site};
  const door=state.sanctuaries?.find(q=>Math.hypot((q.door||q).x-state.x,(q.door||q).y-state.y)<=1.1);
  if(door)return {kind:'door',label:'Enter guild',door};
  if(window.DCKNet?.inRoom&&entities.some(e=>e.type==='enemy'&&e.alive&&Math.hypot(e.x-state.x,e.y-state.y)<=2.15))return {kind:'combat',label:'Engage'};
}
function interact(){
  if(state.dead||bossFight||modalOpen()||activeLoot||remoteLoot)return;
  const target=interactionTarget();
  if(!target){notify('Move beside a person, sign, or doorway.');return}
  if(target.kind==='relay'){if(partyGuest())notify('The host operates field stations.');else useRelay();return}
  if(target.kind==='animal'){meetAnimal();return}
  if(target.kind==='combat'){attack();return}
  if(target.kind==='hall'){hallInteract();return}
  if(target.kind==='door'){enterHall(target.door);return}
  if(target.kind==='sign'){caption('Seattle rescue notice','Mine access is south, down the stone steps. Report to Guild Master Rowan before entering the tunnels.',true);return}
  if(target.kind==='site'){investigate(target.site);return}
  if(partyGuest()){caption(crewName(),relayFloors[state.floor-1][1],true);return}agentTalk();
}

function hiddenBossSite(p){
 const sites=(state.scenery||[]).filter(q=>q.art>=3&&q.art<=5&&!sanctuaryAt(q.x,q.y)&&!inArena(q.x,q.y));
 const selected=sites[(state.floor*13)%Math.max(1,sites.length)];
 return selected===p&&!p.bossRevealed;
}
const localBossTypes=[
 {name:'The False Innkeeper',sprite:'goblin',chief:'bruiser',desc:'The abandoned camp was bait. Its keeper unfolds a hidden iron club.'},
 {name:'The Carrion Weaver',sprite:'spider-boss',chief:'hexer',desc:'The nursery wall splits open, revealing a huge silk-covered predator.'},
 {name:'The Borrowed Face',sprite:'wraith',chief:'hexer',desc:'The quiet hideout dissolves into a spectral trap.'},
 {name:'The Lockjaw Collector',sprite:'bone-champion',chief:'bruiser',desc:'A pile of discarded armor rises and locks its jaw around a stolen key.'}
];
function revealLocalBoss(p){
 const t=localBossTypes[(state.floor-2)%localBossTypes.length];
 const spots=[[0,0],[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:p.x+dx,y:p.y+dy}));
 const pos=spots.find(q=>tile(q.x,q.y)===1&&!solid(q.x,q.y)&&!sanctuaryAt(q.x,q.y)&&!inArena(q.x,q.y)&&!(q.x===state.x&&q.y===state.y)&&!entities.some(e=>e.alive&&e.x===q.x&&e.y===q.y));
 if(!pos){notify('Something moves behind the wall. Approach from another side.');return}
 const hp=45+state.floor*12;
 const e={type:'enemy',...t,...pos,hp,max:hp,atk:5+state.floor*2,xp:45+state.floor*8,alive:true,cool:0,boss:false,localBoss:true,small:false};
 p.bossRevealed=true;entities.push(e);caption('Underfloor',t.desc,true);beginBoss(e);persistCampaign();render();
}
function investigate(selected){if(state.hall){hallInteract();return}
  const p=selected||nearbySight();if(!p||state.dead||bossFight||modalOpen())return;
  const dens={3:['Drain rat nest','Gnawed wire and fresh tracks lead into a nest under the drain grate.'],4:['Scavenger camp','A bedroll is still warm. Someone has been keeping watch here.'],5:['Silk nursery','Small husks tremble in the web. Something has been tending them.']};
  const [name,line]=dens[p.art]||sights[p.art-6];
  if(p.art>=3&&p.art<=5&&state.floor>=2&&!partyGuest()&&!window.DCKNet?.inRoom&&hiddenBossSite(p)){revealLocalBoss(p);return}
  state.investigated??=[];if(!state.investigated.includes(p.y*W+p.x))state.investigated.push(p.y*W+p.x);
  if(p.art>=6)for(let y=Math.max(0,p.y-7);y<Math.min(H,p.y+8);y++)for(let x=Math.max(0,p.x-7);x<Math.min(W,p.x+8);x++)if(Math.hypot(x-p.x,y-p.y)<=7)seen[y][x]=true;
  caption(name,line,true);persistCampaign();render();inspectItem({id:"discovery",art:p.art,name,desc:line});
}

// Guild construction can replace the first room's center with masonry.
// Pick a landing on the connected dungeon floor after the walls have been built.
function chooseLanding(){
  const visited=new Set(),dirs=[[0,1],[1,0],[0,-1],[-1,0]];
  const open=(x,y)=>!solid(x,y)&&!sanctuaryAt(x,y)&&!state.sanctuaries?.some(q=>q.door?.x===x&&q.door?.y===y);
  let best=[],stairsRegion;
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
    const k=y*W+x;if(visited.has(k)||!open(x,y))continue;
    const region=[[x,y]];visited.add(k);
    for(let i=0;i<region.length;i++){
      const [a,b]=region[i];if(tile(a,b)===3)stairsRegion=region;
      for(const [dx,dy] of dirs){const nx=a+dx,ny=b+dy,key=ny*W+nx;if(!visited.has(key)&&open(nx,ny)){visited.add(key);region.push([nx,ny])}}
    }
    if(region.length>best.length)best=region;
  }
  const eligible=(stairsRegion||best).filter(([x,y])=>tile(x,y)===1&&!entities.some(e=>e.alive&&e.x===x&&e.y===y));
  eligible.sort((a,b)=>Math.hypot(a[0]-state.x,a[1]-state.y)-Math.hypot(b[0]-state.x,b[1]-state.y));
  if(eligible.length)[state.x,state.y]=eligible[0];
}

function generate(){state.relay=null;state.patrolFloor=0;state.grubHatches=0;state.hall=null;state.scenery=[];state.power-=state.teaPower||0;state.teaPower=0;step=null;const depth=Math.min(FINAL_FLOOR,state.floor)-1;W=118-depth*4;H=80-depth*2;state.collapseLeft=900;state.collapsed=false;state.warned=[];visualX=null;let r=rng((state.floor*982451653+0xdecafbad)>>>0);tiles=Array.from({length:H},()=>Array(W).fill(0));seen=Array.from({length:H},()=>Array(W).fill(false));entities=[];particles=[];state.x=15;state.y=9;state.boss=null;state.stairs=false;spawnedFloor=state.floor;
// carve connected rooms and corridors
let rooms=[];for(let i=0;i<54-depth*2;i++){let rw=4+Math.floor(r()*6),rh=3+Math.floor(r()*5),rx=1+Math.floor(r()*((state.floor%3===0?W-12:W)-rw-2)),ry=1+Math.floor(r()*(H-rh-2));let room={x:rx,y:ry,w:rw,h:rh,cx:Math.floor(rx+rw/2),cy:Math.floor(ry+rh/2)};for(let y=ry;y<ry+rh;y++)for(let x=rx;x<rx+rw;x++)tiles[y][x]=1;if(rooms.length){let p=rooms[rooms.length-1];let x=room.cx,y=room.cy;while(x!==p.cx){tiles[y][x]=1;x+=Math.sign(p.cx-x)}while(y!==p.cy){tiles[y][x]=1;y+=Math.sign(p.cy-y)}}rooms.push(room)}
// walls around corridors
for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++)if(tiles[y][x]===0){for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(tiles[y+dy]?.[x+dx]===1){tiles[y][x]=2;break}}
state.x=rooms[0].cx;state.y=rooms[0].cy;state.rooms=rooms.length;let safe=rooms[0];state.safe={x:safe.cx,y:safe.cy};state.sanctuaries=[{...state.safe,rested:false}];for(let room of rooms.slice(2,-1)){if(state.sanctuaries.length>=6)break;if(r()<.28&&state.sanctuaries.every(q=>Math.hypot(q.x-room.cx,q.y-room.cy)>8))state.sanctuaries.push({x:room.cx,y:room.cy,rested:false})}buildSanctuaries();chooseLanding();let npc=rooms[1];state.npc={x:npc.cx,y:npc.cy,met:false};state.rested=false;
if(state.floor===1)for(let i=0;i<26;i++){let room=rooms[1+Math.floor(r()*(rooms.length-1))],ex=room.cx+Math.floor(r()*3)-1,ey=room.cy+Math.floor(r()*3)-1;if(!sanctuaryAt(ex,ey)&&!solid(ex,ey)&&!entities.some(e=>e.x===ex&&e.y===ey)&&Math.abs(ex-state.x)+Math.abs(ey-state.y)>5)spawnEnemy(ex,ey,r)}
let dist=Array.from({length:H},()=>Array(W).fill(-1)),queue=[[state.x,state.y]];dist[state.y][state.x]=0;for(let i=0;i<queue.length;i++){let [x,y]=queue[i];for(let [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){let a=x+dx,b=y+dy;if(tile(a,b)===1&&!sanctuaryAt(a,b)&&!state.sanctuaries.some(q=>q.door?.x===a&&q.door?.y===b)&&dist[b][a]<0){dist[b][a]=dist[y][x]+1;queue.push([a,b])}}}let end=rooms.slice(1).sort((a,b)=>dist[b.cy][b.cx]-dist[a.cy][a.cx])[0];const far=queue[queue.length-1];if(dist[end.cy][end.cx]<1||sanctuaryAt(end.cx,end.cy))end={...end,cx:far[0],cy:far[1]};tiles[end.cy][end.cx]=3;state.stairs=true;
if(state.floor%3===0){let candidates=[];for(let y=2;y<H-9;y++)for(let x=2;x<W-11;x++){let w=8,h=6,clear=true;for(let j=y-1;j<=y+h;j++)for(let i=x-1;i<=x+w;i++)if(tile(i,j)===1||tile(i,j)===3)clear=false;if(!clear)continue;for(let [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){let gx=dx<0?x-1:dx>0?x+w:x+4,gy=dy<0?y-1:dy>0?y+h:y+3;if(tile(gx+dx,gy+dy)===1&&dist[gy+dy][gx+dx]>12)candidates.push({x,y,w,h,gx,gy,score:dist[gy+dy][gx+dx]})}}candidates.sort((a,b)=>b.score-a.score);let a=candidates[0];if(!a){let x=W-10,y=H-10,w=8,h=6,gx=x-1,gy=y+3;let nearest=queue.filter(([i,j])=>i<gx).sort((p,q)=>Math.abs(p[0]-gx)+Math.abs(p[1]-gy)-Math.abs(q[0]-gx)-Math.abs(q[1]-gy))[0];if(nearest){let [i,j]=nearest;while(j!==gy){tiles[j][i]=1;j+=Math.sign(gy-j)}while(i<gx){tiles[j][i]=1;i++}a={x,y,w,h,gx,gy}}}if(a){for(let j=a.y-1;j<=a.y+a.h;j++)for(let i=a.x-1;i<=a.x+a.w;i++)tiles[j][i]=i>=a.x&&i<a.x+a.w&&j>=a.y&&j<a.y+a.h?1:2;tiles[a.gy][a.gx]=1;state.arena={x:a.x,y:a.y,w:a.w,h:a.h,gates:[{x:a.gx,y:a.gy}]};spawnBoss(a.x+4,a.y+3)}else{let room=rooms.filter(q=>q!==end&&dist[q.cy][q.cx]>12).sort((a,b)=>b.w*b.h-a.w*a.h)[0]||rooms[1];state.arena={x:room.x,y:room.y,w:room.w,h:room.h,gates:[]};entities=entities.filter(e=>!(e.x>=room.x&&e.x<room.x+room.w&&e.y>=room.y&&e.y<room.y+room.h));spawnBoss(room.cx,room.cy)}}else state.arena=null;
populatePatrols();furnishFloor();placeAnimal();initialiseRelay();feed('You descend into <b>'+names[(state.floor-1)%names.length]+'</b>.');ai(quips[Math.floor(r()*quips.length)]);reveal();render();}
const floorMobs=[
 [['Drain rat','sewer-rat'],['Tunnel goblin','goblin'],['Pack llama','pack-llama']],
 [['Flood grub','flood-grub'],['Mire leprechaun','mire-leprechaun']],
 [['Cage runner','goblin'],['Ironwhisker rat','sewer-rat']],
 [['Signal thief','archer'],['Aerial hexer','shaman']],
 [['Index wraith','wraith'],['Bookbinder spider','spider']],
 [['Relay sentinel','bone-champion'],['Copperwire archer','archer']],
 [['Lock tender','skeleton'],['Barnacle widow','spider']],
 [['Bridge troll','bone-champion'],['Counterweight thief','goblin']],
 [['Mirror echo','wraith'],['Silver-eye seer','shaman']],
 [['Kiln knight','bone-champion'],['Coal skitter','spider']],
 [['Platform phantom','wraith'],['Token collector','skeleton']],
 [['Cinder bow','archer'],['Ash magistrate','shaman']],
 [['Brine widow','spider'],['Salt collector','skeleton']],
 [['Lookout revenant','archer'],['Beacon witch','shaman']],
 [['Tribunal bailiff','bone-champion'],['Oathbreaker','wraith']],
 [['Silt stalker','spider'],['Channel caller','shaman']],
 [['Crypt lamplighter','skeleton'],['Beacon shade','wraith']],
 [['Bellbound knight','bone-champion'],['Last chorister','shaman']]
];
function floorEnemy(floor,index,x,y){
 const roster=floorMobs[Math.min(floor,18)-1];
 const entry=roster[floor===1?[0,0,1,0,2][index%5]:index%roster.length];
 const [name,sprite]=entry,heavy=['bone-champion','pack-llama','goblin'].includes(sprite);
 const hp=floor<=3?(heavy?13:7)+floor*2:16+floor*4+(heavy?14:0);
 return {type:'enemy',name,sprite,x,y,hp,max:hp,atk:(heavy?2:1)+floor+(floor>3?3:0),xp:5+floor*2+(heavy?4:0),small:floor<=3,cool:0,alive:true,boss:false,rosterVersion:1,
 ...(sprite==='pack-llama'?{contents:[{id:'meth-cargo',qty:1},{id:'gold',qty:5}]}:{})};
}
function spawnEnemy(x,y,r=Math.random){
 r(); // Preserve the seeded room placement sequence used by existing campaigns.
 entities.push(floorEnemy(state.floor,entities.length,x,y));
}
// Distribute patrols by walking distance so both the approach and the far rooms see traffic.
function populatePatrols(upgrading=false){
 if(state.chapter!=='mine'||state.dead||state.campaignWon||state.patrolFloor===state.floor)return;
 const random=rng(19391*state.floor),key=(x,y)=>y*W+x;
 const forbidden=new Set();
 for(const p of [...entities,...(state.scenery||[]),state.npc,state.wildAnimal,state.pet,
   ...(state.sanctuaries||[]).map(q=>q.door),...(state.arena?.gates||[])]){
   if(p)forbidden.add(key(p.x,p.y));
 }
 const start=state.hall?{x:state.hall.returnX,y:state.hall.returnY}:state;
 const queue=[[start.x,start.y,0]],visited=new Set([key(start.x,start.y)]),spots=[];
 for(let i=0;i<queue.length;i++){
   const [x,y,d]=queue[i];
   if(d>=6&&Math.hypot(x-state.x,y-state.y)>=5&&!forbidden.has(key(x,y))&&
      !inArena(x,y)&&tile(x,y)===1&&(!upgrading||!seen[y]?.[x]))spots.push({x,y});
   for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]){
     const a=x+dx,b=y+dy,k=key(a,b);
     if(visited.has(k)||solid(a,b)||tile(a,b)!==1||sanctuaryAt(a,b)||
       state.sanctuaries?.some(q=>q.door?.x===a&&q.door.y===b))continue;
     visited.add(k);queue.push([a,b,d+1]);
   }
 }
 const existing=entities.filter(e=>e.type==='enemy'&&!e.boss).length;
 const target=state.floor===1?existing+2:42+2*(state.floor-2);
 const count=Math.min(spots.length,Math.max(0,target-existing));
 for(let i=0;i<count;i++){
   const first=Math.floor(i*spots.length/count),end=Math.floor((i+1)*spots.length/count);
   const {x,y}=spots[first+Math.floor(random()*(end-first))];
   const enemy=floorEnemy(state.floor,existing+i,x,y);
   enemy.den={x,y};
   const chief=i===Math.floor(count*.35)?'bruiser':i===Math.floor(count*.78)?'hexer':null;
   if(chief){
     enemy.chief=chief;enemy.name+=(chief==='bruiser'?' Pit Champion':' Hexcaller');
     enemy.max=Math.ceil(enemy.max*1.8);enemy.hp=enemy.max;enemy.xp*=3;
   }
   entities.push(enemy);
 }
 state.patrolFloor=state.floor;
}
function hatchGrub(parent){
 if(state.floor!==2||parent.alive||parent.corpseHatched)return false;
 parent.corpseHatched=true;
 let remaining=Math.min(3,500-entities.filter(e=>e.alive&&e.sprite==='flood-grub').length),spawned=0;
 const occupied=new Set(entities.filter(e=>e.alive).map(e=>e.y*W+e.x));
 const queue=[[parent.x,parent.y]],visited=new Set([parent.y*W+parent.x]);
 for(let i=0;i<queue.length&&remaining>0&&i<200;i++){
   const [x,y]=queue[i];
   if(tile(x,y)===1&&!solid(x,y)&&!sanctuaryAt(x,y)&&!(x===state.x&&y===state.y)&&!occupied.has(y*W+x)){
     const larva=floorEnemy(2,0,x,y);
     Object.assign(larva,{name:'Grub hatchling',hp:5,max:5,budded:true,hatchling:true});
     entities.push(larva);occupied.add(y*W+x);remaining--;spawned++;
   }
   for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
     const a=x+dx,b=y+dy,k=b*W+a;
     if(visited.has(k)||tile(a,b)!==1||solid(a,b)||sanctuaryAt(a,b))continue;
     visited.add(k);queue.push([a,b]);
   }
 }
 if(spawned){state.grubHatches=(state.grubHatches||0)+spawned;notify(spawned+' grubs emerge from the corpse.');}
 return spawned>0;
}
function cityMarket(){
 const stock=(state.tradeInventory||[]).filter(i=>i.qty>0);
 const value=i=>i.id==='meth-cargo'?state.floor*5:Math.max(1,3+(i.rank||1)*4);
 showModal('<small>'+safeAttr(names[state.floor-1])+'</small><h2>City exchange</h2><p>Gold: '+state.gold+' · Items marked For sale</p>'+stock.map((i,n)=>'<button class="widebtn" data-sell="'+n+'">'+safeAttr(i.name)+' ×'+i.qty+' · '+value(i)+' gold each</button>').join('')+(stock.length?'':'<p>Move items to For sale in your backpack.</p>')+'<button class="widebtn" id="leaveMarket">Leave exchange</button>');
 $$('[data-sell]').forEach(b=>b.onclick=()=>{const i=stock[Number(b.dataset.sell)];if(!i||i.qty<1)return;i.qty--;state.gold+=value(i);persistCampaign();render();cityMarket()});
 $('#leaveMarket').onclick=closeModal;
}
function spawnBoss(x,y){let brood=state.floor%9===6,phantom=state.floor%9===0,hp=brood?155+state.floor*22:phantom?145+state.floor*24:130+state.floor*20;let b={type:'enemy',name:brood?'The Brood Matriarch':phantom?'The Hollow Regent':'The Ossuary Warden',sprite:brood?'spider-boss':phantom?'wraith':'bone-champion',x,y,hp,max:hp,atk:14+state.floor*2,xp:100+state.floor*10,icon:'♛',cool:0,alive:true,boss:true};if(state.floor===3)Object.assign(b,{name:'Pip, Keeper of the Cage',sprite:'goblin',small:true,hp:48,max:48,atk:5});
if(state.floor===12)Object.assign(b,{name:'The Cinder Inquisitor',sprite:'shaman'});if(state.floor===15)Object.assign(b,{name:'The Iron Magistrate',sprite:'bone-champion'});if(state.floor===FINAL_FLOOR)b.name='The Last Bellkeeper';
entities.push(b);state.boss=entities.length-1;$('#bossbar').classList.add('hidden');$('#bossName').textContent=b.name;}
function tile(x,y){return tiles[y]?.[x]??0}function solid(x,y){return !!state.scenery?.some(p=>p.art<3&&p.x===x&&p.y===y)||(tile(x,y)!==1&&tile(x,y)!==3)||!!(bossFight&&state.arena?.gates?.some(g=>g.x===x&&g.y===y))}
function reveal(){if(state.hall)return;let rad=state.torchTurns>0?7:5;for(let y=Math.max(0,state.y-rad);y<=Math.min(H-1,state.y+rad);y++)for(let x=Math.max(0,state.x-rad);x<=Math.min(W-1,state.x+rad);x++)if(Math.hypot(x-state.x,y-state.y)<=rad)seen[y][x]=true}
function feed(s){let d=new Date(),tm=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});state.feed.unshift({tm,s});state.feed=state.feed.slice(0,30);renderFeed()}
function ai(s){caption("Underfloor",s);$('#aiLine').textContent='“'+s+'”'}function notify(s){let t=$('#toast');t.textContent=s;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),1600)}
function beep(f=180,d=.07,type='square'){if(!sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();let o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+d)}catch(e){}}
function move(dx,dy,start=performance.now()){if(pauseStarted!==null||bossFight||state.dead||step||modalOpen())return;state.facing=dx<0?'left':dx>0?'right':dy<0?'up':'down';const pos=state.hall||state;let nx=pos.x+dx,ny=pos.y+dy;if(state.hall&&nx===6&&ny===8&&personalMenusLocked()){leaveHall();return}if(!state.hall&&submerged(nx,ny)){notify('High water · use the dry ledge or wait for low tide.');return}if(state.hall?!hallWalkable(nx,ny):solid(nx,ny)||entities.some(e=>e.type==='enemy'&&e.alive&&e.x===nx&&e.y===ny))return;step={x:pos.x,y:pos.y,nx,ny,start,duration:strideDuration()};stepCount++;return;}function finishStep(nx,ny){
if(state.hall){if(ny===8&&personalMenusLocked()){leaveHall();return}setPetTile(state.hall);state.hall.x=nx;state.hall.y=ny;if(ny===8){leaveHall();return}persistCampaign();render();return}

if(entities.some(e=>e.type==='enemy'&&e.alive&&e.x===nx&&e.y===ny))return;
if(state.chapter==='surface'){
setPetTile(state);state.x=nx;state.y=ny;
if(ny>=12&&!state.heardRope){state.heardRope=true;caption('Mara','My brother tied blue cloth to the rope. If you find it, tell him the lamps are still lit.',true)}
if(tile(nx,ny)===3)nextFloor();else persistCampaign();
return}
const shelter=state.sanctuaries?.find(q=>(q.door?.x===nx&&q.door.y===ny)||q.room&&q.door&&sanctuaryAt(nx,ny)===q||!q.room&&q.x===nx&&q.y===ny);if(shelter){enterHall(shelter);return}let wasSafe=sanctuaryAt(state.x,state.y);if(state.relay)state.relay.trail={x:state.x,y:state.y};setPetTile(state);state.x=nx;state.y=ny;expeditionStep();if(wasSafe&&!sanctuaryAt(nx,ny))notify('LEFT SAFE ROOM');if(!wasSafe&&sanctuaryAt(nx,ny)){notify('SAFE ROOM — ATTACKS DISABLED');ridiculous('Even Cowards Need a Break')}walkUntil=performance.now()+340;state.steps++;if(state.steps===50)ridiculous('Congratulations, You Have Legs');if(state.steps===1000)ridiculous('Certified Corridor Enthusiast','Legendary');if(state.steps===250)ridiculous('The Dungeon Is Not a Treadmill','Silver');if(Math.random()<.002)ridiculous('Suspiciously Competent Wandering');if(state.torchTurns>0)state.torchTurns--;reveal();if(tile(nx,ny)===3){nextFloor();return}if(Math.random()<.05)ai(quips[Math.floor(Math.random()*quips.length)]);render();}
function nearby(){return entities.filter(e=>e.alive&&Math.hypot(e.x-state.x,e.y-state.y)<=1.65).sort((a,b)=>Math.hypot(a.x-state.x,a.y-state.y)-Math.hypot(b.x-state.x,b.y-state.y))[0]}
let bossFight=null;
function beginBoss(e){if(bossFight||state.dead||modalOpen()||sanctuaryAt(state.x,state.y)||(e.boss&&state.arena&&!inArena(state.x,state.y)))return;bossFight={e,group:[],roundId:crypto.randomUUID().replace(/-/g,''),partyActions:{},turn:1,log:e.boss?'The arena seals.':'The '+e.name.toLowerCase()+' advances.'};step=null;visualX=state.x;visualY=state.y;joyX=joyY=0;if(e.boss||e.localBoss){ai('BOSS BATTLE! Please make your inevitable suffering entertaining.');guardianWarning()}bossScreen();persistCampaign();sendPartyWorld()}
function guardianWarning(){
 const old=document.getElementById('guardianWarning');if(old)old.remove();
 const banner=document.createElement('div');banner.id='guardianWarning';banner.setAttribute('role','alert');
 banner.textContent='⚠ GET READY TO BATTLE ⚠';
 Object.assign(banner.style,{position:'fixed',top:'15%',left:'5%',width:'90%',boxSizing:'border-box',zIndex:'99999',textAlign:'center',padding:'18px 8px',background:'#780c18',color:'#fff',border:'3px solid #ff7373',fontSize:'clamp(16px,5vw,30px)',fontWeight:'900',pointerEvents:'none',boxShadow:'0 0 24px #d33'});
 document.body.appendChild(banner);
 if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&banner.animate)banner.animate([{background:'#780c18'},{background:'#c52132'},{background:'#780c18'}],{duration:750,iterations:3});
 setTimeout(()=>banner.remove(),2300);
}
function encounterAllies(b){
 if(b.e.boss||b.e.localBoss||partyGuest()||state.floor<2)return [];
 b.group??=[];
 if(b.recruitTurn!==b.turn&&(b.turn===1||b.turn%3===0)){
 b.recruitTurn=b.turn;
 const nearby=entities.map((e,i)=>({e,i})).filter(({e,i})=>e.alive&&e.type==='enemy'&&!e.boss&&e!==b.e&&!b.group.includes(i)&&!sanctuaryAt(e.x,e.y)&&Math.hypot(e.x-state.x,e.y-state.y)<=3.5);
 const cap=Math.min(4,1+Math.floor(state.floor/4));
 for(const {i} of nearby.slice(0,Math.max(0,cap-b.group.filter(i=>entities[i]?.alive).length)))b.group.push(i);
 }
 return b.group.map(i=>entities[i]).filter(e=>e?.alive&&e!==b.e);
}
function bossIntent(b){
 if(!b.e.boss){
   if(b.e.chief==='bruiser'&&b.turn%3===0)return 'ARMOR SHATTER';
   if(b.e.chief==='hexer'&&b.turn%3===0)return 'MANA DRAIN';
   if(b.e.sprite==='mire-leprechaun'&&b.turn%2===0)return 'SICKENING MIST';
   if(b.e.sprite==='archer'&&b.turn%3===2)return 'AIMED SHOT';
   if(b.e.sprite==='shaman'&&b.turn%4===0)return 'MANA DRAIN';
   if(b.e.sprite==='spider'&&b.turn%4===0)return 'VENOM BITE';
 }
 return b.e.sprite==='wraith'&&b.turn%3===2?'MANA DRAIN':b.e.sprite==='bone-champion'&&b.turn%4===0?'ARMOR SHATTER':b.turn%3===0?'DEVASTATING STRIKE':b.e.sprite==='spider-boss'&&b.turn%2===0?'VENOM BITE':b.e.hp<b.e.max/2?'ENRAGED ATTACK':'Standard attack'}let animatingTurn=false;
const techniques={
 aegis:{name:'Aegis Break',floor:8,sub:'Aegis',cost:9,guard:true,scale:'armor',desc:'Power + twice armor + 12; guard the counterattack.'},
 juggernaut:{name:'Titan Charge',floor:8,sub:'Juggernaut',cost:9,scale:'health',desc:'Power + 30% maximum HP.'},
 stormcaller:{name:'Thunderfall',floor:8,sub:'Stormcaller',cost:12,scale:'magic',desc:'30 + triple spell damage.'},
 sage:{name:'Astral Surge',floor:8,sub:'Mana Sage',cost:10,scale:'mana',desc:'20 + 40% maximum MP.'},
 executioner:{name:'Final Verdict',floor:8,sub:'Executioner',cost:10,scale:'execution',desc:'Triple power; extra damage against weakened targets.'},
 bloodknight:{name:'Crimson Blade',floor:8,sub:'Blood Knight',cost:9,scale:'physical',heal:0.2,desc:'Twice power + 15; recover 20% of damage.'},
 deadeye:{name:'Perfect Shot',floor:8,sub:'Deadeye',cost:9,scale:'execution',desc:'Triple power; extra damage against weakened targets.'},
 pathfinder:{name:'Ambush',floor:8,sub:'Pathfinder',cost:8,scale:'physical',guard:true,desc:'Twice power + 15; guard counterattack.'},
 transmuter:{name:'Philosopher’s Fire',floor:8,sub:'Transmuter',cost:11,scale:'magic',desc:'30 + triple spell damage.'},
 medic:{name:'Restorative Burst',floor:8,sub:'Field Medic',cost:9,scale:'magic',heal:0.35,desc:'30 + triple spell damage; recover 35% of damage.'},
 commander:{name:'Citadel Bash',floor:8,sub:'Bulwark Commander',cost:9,scale:'armor',guard:true,desc:'Power + twice armor + 12; guard counterattack.'},
 avenger:{name:'Retribution',floor:8,sub:'Avenger',cost:9,scale:'physical',guard:true,desc:'Twice power + 15; guard counterattack.'},
  volley:{name:'Piercing volley',floor:4,job:'Ranger',cost:6,desc:'Deal twice your power + 3.'},
  catalyst:{name:'Catalytic burst',floor:4,job:'Alchemist',cost:7,desc:'Deal 20 damage plus twice spell bonus.'},
  bastion:{name:'Bastion strike',floor:4,job:'Sentinel',cost:6,desc:'Strike with power and armor, then guard.'},
  racial:{name:'Racial signature',floor:4,cost:7,desc:'Your race-specific attack. Unlock the second racial skill at rank 2.'},
  mend:{name:'Mend',floor:4,job:'Arcanist',cost:8,desc:'Restore health and treat injuries.'},
  brace:{name:'Shieldbreaker',floor:4,job:'Vanguard',cost:5,desc:'Strike for power + 6 and guard the counterattack.'},
  rend:{name:'Rending blow',floor:4,job:'Reaver',cost:6,desc:'Strike for twice your power.'},
  bell:{name:'Bell chime',floor:6,cost:6,desc:'Deal 16 damage plus your spell bonus.'},
  lunge:{name:'Driving lunge',floor:9,cost:8,desc:'Strike for twice your power + 4.'},
  tide:{name:'Undertow',floor:12,cost:12,desc:'Deal 32 damage plus twice your spell bonus.'}
};
function learned(id){if(id==='racial')return !!state.identityLocked&&(state.racialRanks?.[1]||0)>=2;const a=techniques[id];return !!a&&state.floor>=a.floor&&(!a.job||a.job===state.specialization)&&(!a.sub||a.sub===state.subclass)}
function prepared(){return (state.spellLoadout||[]).filter(learned).slice(0,3)}
function techniqueDamage(id){
  const a=techniques[id];
  if(a?.scale){switch(a.scale){
    case 'armor':return Math.max(1,state.power+2*state.armor+12);
    case 'health':return state.power+Math.floor(state.maxHp*.3);
    case 'magic':return Math.max(1,30+3*(state.spellBonus||0));
    case 'mana':return 20+Math.floor(state.maxMp*.4);
    case 'execution':return state.power*3+(bossFight?.e?.hp<bossFight?.e?.max*.35?Math.floor(state.power*.5):0);
    case 'physical':return state.power*2+15;
  }}
  switch(id){
    case 'racial':return racialMoves[state.character?.race]?.[2]?24+2*(state.spellBonus||0):state.power*2+10;
    case 'volley':return state.power*2+3;
    case 'catalyst':return 20+2*(state.spellBonus||0);
    case 'bastion':return state.power+state.armor+5;
    case 'brace':return state.power+6;
    case 'rend':return state.power*2;
    case 'bell':return Math.max(1,16+(state.spellBonus||0));
    case 'lunge':return state.power*2+4;
    case 'tide':return Math.max(1,32+2*(state.spellBonus||0));
    default:return 0;
  }
}
function moveName(id){return id==='racial'?(racialMoves[state.character?.race]?.[0]||'Racial signature'):techniques[id].name}
function spellLoadoutPanel(){
  const ready=prepared();
  return '<details class="skill-limb" data-path="Spells" '+(openPaths.has('Spells')?'open':'')+'><summary>Spell menu <small>'+ready.length+'/3 prepared</small></summary><div class="skill-stem">'+Object.entries(techniques).map(([id,a])=>{
    const equipped=ready.includes(id);
    return '<div class="skill-node"><div><b>'+moveName(id)+'</b><small>'+a.cost+' MP · '+a.desc+'</small></div>'+(learned(id)?'<button class="smallbtn" data-prepare="'+id+'" aria-pressed="'+equipped+'" '+(!equipped&&ready.length===3?'disabled':'')+'>'+(equipped?'Remove':'Prepare')+'</button>':'<small>Floor '+a.floor+(a.job?' · '+a.job:a.sub?' · '+a.sub:'')+'</small>')+'</div>';
  }).join('')+'</div></details>';
}

function eligibleRoundGuests(b){
 if(!window.DCKNet?.isHost)return [];
 return Object.entries(netPlayers).filter(([id,p])=>p.floor===state.floor&&p.hp>0&&!p.hall&&Math.hypot(p.x-b.e.x,p.y-b.e.y)<=3);
}
function pendingRoundGuests(b){return eligibleRoundGuests(b).filter(([id])=>!b.partyActions?.[id])}
function roundRoster(b){
 const guests=eligibleRoundGuests(b);if(!guests.length)return;
 const el=document.createElement('div');el.className='group-roster';
 for(const [id,p] of guests){const line=document.createElement('p');line.textContent=(p.name||'Crawler')+' · '+(b.partyActions?.[id]||'Selecting action');el.appendChild(line)}
 const status=document.createElement('small');status.textContent=(guests.length-pendingRoundGuests(b).length)+'/'+guests.length+' allies ready';el.appendChild(status);
 if(b.hostChoice&&pendingRoundGuests(b).length){const force=document.createElement('button');force.className='widebtn';force.textContent='Resolve now · waiting allies guard';force.onclick=()=>{for(const [id] of pendingRoundGuests(b))(b.partyActions??={})[id]='guard';const action=b.hostChoice;b.hostChoice=null;animateTurn(action)};el.appendChild(force)}
 $('.duel-stage').after(el);
}
function encounterScreen(spellMenu=false){
  const battle=bossFight;
  if(!battle||animatingTurn)return;
  const enemy=battle.e;
  battle.roundId??=crypto.randomUUID().replace(/-/g,'');battle.partyActions??={};
  const allies=encounterAllies(battle);
  const moves=[['attack',state.equipment?.weapon?'Swing':'Punch'],['guard','Guard'],['heal','Health potion']];
  if(!enemy.boss)moves.push(['retreat','Run away']);
  if(Object.keys(techniques).some(learned))moves.push(['spells','Spells']);
  if(enemy.boss)moves.push(['trap',battle.trapUsed?'Trap spent':'Spring trap']);
  if(spellMenu)moves.splice(0,moves.length,...prepared().map(id=>[id,moveName(id)+' · '+techniques[id].cost+' MP']),['back','Back']);
  showModal('<div class="duel"><small>FLOOR '+state.floor+' · '+(enemy.boss?'GUARDIAN':enemy.localBoss?'HIDDEN LOCAL BOSS':enemy.chief?'ROAMING MINIBOSS':'ENCOUNTER')+' · TURN '+battle.turn+'</small><h2>'+safeAttr(enemy.name)+'</h2><div class="duel-stage"><div class="fighter crawler"><img id="duelHero" alt=""><canvas class="strike-pose" width="72" height="48" aria-hidden="true"></canvas></div><div class="fighter opponent '+(enemy.small?'small-mob':'')+'"><img src="'+safeAttr(enemy.sprite)+'.png" alt=""></div><span class="impact">✦</span></div><div class="duel-health"><span>You '+state.hp+'/'+state.maxHp+' HP</span><span>'+enemy.hp+'/'+enemy.max+' HP</span></div><p>'+safeAttr(battle.log)+'</p><button class="smallbtn" data-campaign-menu>Campaign saves</button><small>'+state.mp+' MP · '+(conditionText()?conditionText()+' · ':'')+'Incoming: '+bossIntent(battle)+'</small><div class="duel-actions command-fan">'+(spellMenu&&!prepared().length?'<p>Prepare abilities in Backpack → Skills → Spell menu.</p>':'')+moves.map(([id,label])=>'<button class="duel-command" data-boss="'+id+'" '+((techniques[id]&&state.mp<techniques[id].cost)||(id==='mend'&&state.hp===state.maxHp&&!conditionText())||(id==='trap'&&battle.trapUsed)||(id==='heal'&&!quantity('tonic'))?'disabled':'')+'><i aria-hidden="true">'+(({attack:'⚔',guard:'⬟',heal:'✚',retreat:'↗',spells:'✧',trap:'⌖',back:'‹'})[id]||'✦')+'</i><span>'+label+'</span></button>').join('')+'</div></div>');
  $('#duelHero').src=crawlerPose('side',0).toDataURL();
  const stage=$('.duel-stage');const pet=readyPet();if(pet){const portrait=document.createElement('canvas');portrait.width=32;portrait.height=32;portrait.className='duel-companion';portrait.setAttribute('aria-label','Companion crawler');portrait.style.cssText='position:absolute;left:9%;bottom:9%;width:56px;height:56px;image-rendering:pixelated;pointer-events:none;z-index:3';drawAnimal(pet.p.species,0,0,true,false,portrait.getContext('2d'));stage.appendChild(portrait);const info=document.createElement('p');info.textContent=(pet.p.name||animalNames[pet.p.species])+' · '+pet.p.hp+'/'+pet.stats.maxHp+' HP · Attack '+pet.stats.power;stage.after(info)}if(allies.length){const roster=document.createElement('div');roster.className='group-roster';roster.style.cssText='display:flex;flex-wrap:wrap;gap:6px;padding:6px';for(const ally of allies){const label=document.createElement('button');label.type='button';label.textContent='Target '+ally.name+' · '+ally.hp+' HP';label.onclick=()=>{if(animatingTurn||bossFight!==battle||!ally.alive||battle.hostChoice||Object.keys(battle.partyActions||{}).length)return;battle.group=battle.group.filter(i=>entities[i]!==ally);battle.group.push(entities.indexOf(battle.e));battle.e=ally;persistCampaign();encounterScreen(spellMenu)};label.style.cssText='border:1px solid #a65b51;padding:5px;border-radius:5px';roster.appendChild(label)}stage.after(roster)}const theme=enemy.boss&&guardianThemes[state.floor];if(theme){stage.style.background='repeating-linear-gradient(45deg,'+theme.floor+' 0 18px,'+theme.color+'33 19px 20px)';stage.setAttribute('aria-label',theme.detail)}const opponent=stage.querySelector('.opponent img');if(opponent){const original=customEnemy(enemy)||nativeFloorEnemy(enemy);if(original){opponent.src=original.toDataURL();opponent.style.filter='none';opponent.style.imageRendering='pixelated'}else opponent.style.filter=enemyArtFilter(enemy);}stage.dataset.enemy=enemy.sprite;stage.dataset.weapon=gearLook().weapon||'fist';stage.style.setProperty('--fist',skinTones[state.character?.skin]||skinTones[2]);
  if(state.equipment?.weapon)stage.classList.add('armed');
  roundRoster(battle);
  $('[data-boss]').forEach(button=>{if(battle.hostChoice){button.disabled=true;return}button.onclick=()=>{const id=button.dataset.boss;if(id==='spells'||id==='back')encounterScreen(id==='spells');else animateTurn(id)}});
}
function battleFrames(duration,paint,valid){
  return new Promise(resolve=>{
    let elapsed=0,last=performance.now();
    function frame(now){
      if(!valid())return resolve();
      if(pauseStarted===null){elapsed+=Math.min(64,now-last);paint?.(Math.min(1,elapsed/duration))}
      last=now;
      if(elapsed>=duration)resolve();else requestAnimationFrame(frame);
    }
    frame(last);
  });
}
function guardianAttackFx(stage,battle){
 if(!battle.e.boss&&!battle.e.localBoss)return;
 const intent=bossIntent(battle);
 const theme=({3:['#d3ad69','▥','CAGE IMPACT'],6:['#92c46c','✳','VENOM SURGE'],9:['#91cbe9','◇','SPECTRAL WAVE'],12:['#f69b54','✦','CINDER BURST'],15:['#c5a7df','▣','IRON IMPACT'],18:['#e7ce82','◎','BELL RESONANCE']})[state.floor]||['#e19a73','✦',intent];
 const fx=document.createElement('div');fx.textContent=theme[1];fx.setAttribute('aria-hidden','true');
 fx.style.cssText='position:absolute;left:18%;top:25%;font-size:58px;line-height:1;color:'+theme[0]+';text-shadow:0 0 16px '+theme[0]+';pointer-events:none;z-index:5';
 stage.appendChild(fx);
 if(fx.animate&&!ambientMotion.matches)fx.animate([{transform:'translateX(45px) scale(.4)',opacity:.1},{transform:'translateX(0) scale(1.3)',opacity:1},{transform:'scale(1.8)',opacity:0}],{duration:430});
 return fx;
}
async function animateTurn(action){
  const battle=bossFight;
  if(!battle||animatingTurn||state.dead)return;
  if(techniques[action]&&(!prepared().includes(action)||state.mp<techniques[action].cost))return;
  if(action==='retreat'){
    if(battle.e.boss)return;
    const enemy=battle.e;
    const strong=enemy.atk>=state.level+2;
    enemy.pursuit=strong?10:0;enemy.pursuitDelay=1.5;enemy.avoid=strong?0:8;
    state.retreatGrace=2;bossFight=null;clearMovement();closeModal();
    caption('Encounter',strong?'You broke away. The '+enemy.name.toLowerCase()+' is chasing you!':'You slipped away from the '+enemy.name.toLowerCase()+'.',true);
    persistCampaign();render();return;
  }
  if(window.DCKNet?.isHost&&pendingRoundGuests(battle).length){battle.hostChoice=action;battle.log='Your action is locked. Waiting for nearby crawlers.';persistCampaign();bossScreen();sendPartyWorld();return}
  battle.hostChoice=null;
  const stage=$('.duel-stage');
  const strike=action==='attack'?state.power+Math.floor(Math.random()*5):techniqueDamage(action);
  const damage=strike+(action==='trap'?25+state.level*3:0)+(battle.assist||0);
  animatingTurn=true;
  const wait=ms=>battleFrames(ms,null,()=>bossFight===battle);
  try{
    $$('[data-boss]').forEach(button=>button.disabled=true);
    const melee=['attack','brace','rend','lunge'].includes(action);stage.dataset.move=melee?'attack':action;
    if(damage>0)stage.querySelector('.impact').textContent='−'+damage;
    if(melee)await playDuelStrike(stage,battle);else if(techniques[action]&&damage>0){const fx=document.createElement('div');fx.textContent='✦';fx.style.cssText='position:absolute;right:22%;top:36%;font-size:42px;color:#f6ce7a;text-shadow:0 0 18px #d79aff;pointer-events:none;z-index:4';stage.appendChild(fx);if(fx.animate&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)fx.animate([{transform:'scale(.2)',opacity:0},{transform:'scale(1.6)',opacity:1},{transform:'scale(2.2)',opacity:0}],{duration:480});await wait(480);fx.remove()}else await wait(480);
    if(bossFight!==battle)return;
    const helper=readyPet();
    if(helper&&damage<battle.e.hp){const portrait=stage.querySelector('.duel-companion');const impact=stage.querySelector('.impact');if(impact)impact.textContent='−'+helper.stats.power+' (ally)';if(portrait?.animate&&!ambientMotion.matches)portrait.animate([{transform:'translate(0,0)'},{transform:'translate('+Math.round(stage.clientWidth*.48)+'px,-18px) scale(1.15)',offset:.5},{transform:'translate(0,0)'}],{duration:360});await wait(360)}
    if(bossFight!==battle)return;
    if(damage+(helper?.stats.power||0)<battle.e.hp){stage.classList.add('counter');const fx=guardianAttackFx(stage,battle);await wait(460);fx?.remove()}
    if(bossFight!==battle)return;
    animatingTurn=false;bossTurn(action,strike);
  }finally{animatingTurn=false}
}

function bossScreen(){encounterScreen()}
function bossTurn(action,strike){let b=bossFight;if(!b||state.dead)return;let e=b.e,intent=bossIntent(b),d=0,guard=false;if(techniques[action]&&action!=='mend'){if(!prepared().includes(action)||state.mp<techniques[action].cost)return;state.mp-=techniques[action].cost;d=strike;guard=action==='brace'||action==='bastion'||!!techniques[action].guard}if(action==='guard')b.guards=(b.guards||0)+1;if(action==='attack')d=strike??(state.power+Math.floor(Math.random()*5));if(action==='trap'){if(b.trapUsed){b.log='The arena trap is spent.';bossScreen();return}b.trapUsed=true;d=25+state.level*3;guard=true}if(action==='guard')guard=true;if(action==='mend'&&!mend())return;if(action==='heal'){let i=state.inventory.find(i=>i.id==='tonic'&&i.qty>0);if(!i){b.log='No health tonics left.';bossScreen();return}i.qty--;restoreHealth(35)}if(techniques[action]?.heal)state.hp=Math.min(state.maxHp,state.hp+Math.floor(Math.min(e.hp,d)*techniques[action].heal));d+=(b.assist||0)+resolvePartyTargets(b);b.assist=0;const companion=readyPet();let petLog='';if(companion&&e.hp>d){const {p,stats}=companion;const damage=stats.power;d+=damage;petLog=(p.name||animalNames[p.species]||'Companion')+' strikes for '+damage+'. ';}e.hp-=d;if(e.hp<=0){partyRoundDamage(b,e,true);e.alive=false;broadcastKill(e);e.deathAt=performance.now();state.kills++;petVictory();if(!e.boss){
state.xp+=e.xp;state.gold+=5+Math.floor(Math.random()*12);if(e.localBoss){state.gold+=50+state.floor*15;awardBox(state.floor>=8?'Gold':'Silver');feed('Hidden local boss defeated. Premium loot awarded.')}const next=encounterAllies(b)[0];if(next){b.group=b.group.filter(i=>entities[i]!==next);b.e=next;b.partyActions={};b.turn++;b.log=e.name+' falls. '+next.name+' steps forward!';checkLevel();persistCampaign();bossScreen();render();return}bossFight=null;
const milestones={10:['Unlicensed Exterminator','Silver'],30:['The Neighborhood Is Quiet Now','Gold'],100:['Population Control Department','Celestial']};
if(milestones[state.kills])ridiculous(...milestones[state.kills]);
if(Math.random()<.08)awardBox('Bronze');
if(Math.random()<.4)entities.push({type:'loot',x:e.x,y:e.y,icon:'✦',name:'Dropped cache',alive:true});
closeModal();if(state.kills===1){unlock('First blood');ridiculous('Local Pest Control')}checkLevel();feed(e.name+' falls. Search its belongings with Loot.');persistCampaign();render();return
}recordGuardian(state.floor,e.name,b.turn,b.guards||0);state.xp+=e.xp+100;state.gold+=250+state.floor*50;if(window.DCKNet?.isHost)for(let [id,p] of Object.entries(netPlayers))if(p.floor===state.floor&&Math.hypot(p.x-e.x,p.y-e.y)<=8)window.DCKNet.sendReward(id,50,e.xp||100,'tonic',{floor:state.floor,name:e.name});if(state.achievements.includes('Management Has Been Terminated'))awardBox('Gold');else ridiculous('Management Has Been Terminated','Gold');awardBox(state.floor>=9?'Celestial':'Gold');checkLevel();$('#bossbar').classList.add('hidden');bossFight=null;showModal('<h2>GUARDIAN DEFEATED</h2><p>Two premium loot boxes and bonus gold awarded. Loot the remains in the dungeon.</p><button class="widebtn" id="bossDone">CONTINUE</button>');if(state.floor===3&&state.foundKeeper){state.minersFree=true;caption('Iven','Hear that? Three bells. The cage is moving. My crew is going home.',true)}$('#bossDone').onclick=closeModal;save();render();return}let hit=Math.max(1,Math.floor((e.atk*(intent==='AIMED SHOT'?1.5:intent==='DEVASTATING STRIKE'?1.7:intent==='ENRAGED ATTACK'?1.25:1)-state.armor)*(guard?.25:1)));partyRoundDamage(b,e);if(intent==='BUDDING'&&hatchGrub(e)){b.log='The grub splits. A hatchling wriggles onto the floor beside it.';b.turn++;persistCampaign();sendPartyWorld();bossScreen();render();return}
if(intent==='SICKENING MIST')mistCloud(e);
if(intent==='SICKENING MIST'&&!guard)(state.wounds??={}).sick=true;
if(intent==='MANA DRAIN'&&!guard){state.mp=Math.max(0,state.mp-8);hit+=4}if(intent==='ARMOR SHATTER'&&!guard)hit+=Math.min(12,state.armor);if(state.wounds?.poison||b.poison>0)hit+=2;if(state.wounds?.bleed&&!guard)hit+=1;const reinforcements=encounterAllies(b);const extra=reinforcements.reduce((sum,m)=>sum+Math.max(1,Math.floor(Math.max(1,m.atk-state.armor)*(guard?.15:.45))),0);hit+=extra;if(companion&&b.turn%3===0){const {p,stats}=companion;const injury=Math.max(1,Math.floor(e.atk*.5)-stats.armor);p.hp=Math.max(0,p.hp-injury);petLog+='Companion takes '+injury+' damage. '+(p.hp===0?'Companion is incapacitated. ':'')}state.hp=Math.max(0,state.hp-hit);registerHit(e,hit,guard,intent==='VENOM BITE');b.log=petLog+(d?'Party dealt '+d+' damage. ':guard?'You brace for impact. ':action==='focus'?'You recover mana. ':'You recover health. ')+(e.boss?'The guardian':'The enemy group')+' deals '+hit+' damage.'+(extra?' Reinforcements contribute '+extra+' damage.':'');b.turn++;if(state.hp<=0){state.dead=true;bossFight=null;save();openDeath();return}persistCampaign();bossScreen();render();sendPartyWorld()}
function attack(){if(state.chapter==='create'||state.chapter==='surface')return;if(state.dead||bossFight||sanctuaryAt(state.x,state.y))return;if(partyGuest()){if(!state.dead&&attackCooldown<=0){attackCooldown=.48;attackStarted=performance.now();if(partyEncounter?.roundId)window.DCKNet.sendIntent('round_'+partyEncounter.roundId+'_'+partyEncounter.turn+'_strike');else window.DCKNet.sendIntent('attack')}return}let guardian=entities.find(e=>e.boss&&e.alive&&(!state.arena||inArena(state.x,state.y))&&Math.hypot(e.x-state.x,e.y-state.y)<=2.15);if(guardian){beginBoss(guardian);return}if(state.dead||attackCooldown>0)return;attackCooldown=.48;attackStarted=performance.now();let targets=entities.filter(e=>e.alive&&Math.hypot(e.x-state.x,e.y-state.y)<=2.15);targets=targets.filter(e=>e.type==='enemy'&&!e.boss);if(!targets.length){beep(110,.06);return}targets.sort((a,b)=>Math.hypot(a.x-state.x,a.y-state.y)-Math.hypot(b.x-state.x,b.y-state.y));let e=targets[0];if(!partyGuest()){beginBoss(e);return}let dmg=state.power+(state.pet?.crawler&&!orphanedPet()?state.pet.level+1:0)+Math.floor(Math.random()*5);e.hp-=dmg;particles.push({x:e.x,y:e.y,t:0,kind:'hit',text:'-'+dmg});beep(230,.08,'sawtooth');feed('You strike '+e.name+' for <b>'+dmg+'</b> damage.');if(e.hp<=0){e.alive=false;broadcastKill(e);e.deathAt=performance.now();state.kills++;petVictory();if(state.kills===1)ridiculous('Local Pest Control');if(state.kills===10)ridiculous('Unlicensed Exterminator','Silver');if(state.kills===100)ridiculous('Population Control Department','Celestial');if(state.kills===100)ridiculous('Population Control Department','Celestial');if(state.kills===30)ridiculous('The Neighborhood Is Quiet Now','Gold');if(Math.random()<.08)awardBox('Bronze');if(e.boss)ridiculous('Management Has Been Terminated','Gold');state.xp+=e.xp;state.gold+=Math.floor(5+Math.random()*12);feed('<b>'+e.name+'</b> falls. Remains left behind. +'+e.xp+' XP.');particles.push({x:e.x,y:e.y,t:0,kind:'death'});checkLevel();if(state.kills>=1)unlock('First blood');if(e.boss){state.gold+=100;state.xp+=100;unlock('Warden breaker');ai('The Warden is down. The audience is… cautiously impressed.');$('#bossbar').classList.add('hidden')}if(Math.random()<.4)entities.push({type:'loot',x:e.x,y:e.y,icon:'✦',name:'Dropped cache',alive:true})}render();}

function takeDamage(n,e){if(state.dead)return;if(sanctuaryAt(state.x,state.y))return;hurtAt=performance.now();let d=Math.max(1,n-state.armor);state.hp=Math.max(0,state.hp-d);registerHit(e,d);particles.push({x:state.x,y:state.y,t:0,kind:'hurt',text:'-'+d});feed('<b>'+e.name+'</b> hits you for '+d+' damage.');beep(90,.12,'sawtooth');if(state.hp<=0){state.dead=true;feed('<b>You have fallen.</b> The dungeon claims another crawler.');unlock('Down but not out');notify('CRAWLER DOWN — TAP REVIVE');save();setTimeout(()=>openDeath(),600)}}
function sanctuaryAt(x,y){return (state.sanctuaries||[state.safe].filter(Boolean)).find(q=>q.room?x>=q.room.x&&x<q.room.x+q.room.w&&y>=q.room.y&&y<q.room.y+q.room.h:Math.hypot(x-q.x,y-q.y)<=2)}function buildSanctuaries(){for(let q of state.sanctuaries){let candidates=[];for(let y=2;y<H-6;y++)for(let x=2;x<W-8;x++){let clear=true;for(let b=y-1;b<=y+4;b++)for(let a=x-1;a<=x+5;a++)if(tile(a,b)===1||tile(a,b)===3)clear=false;if(!clear)continue;for(let [dx,dy] of [[0,-2],[0,5],[-2,0],[6,0]]){let a=x+(dx===0?2:dx),b=y+(dy===0?1:dy);if(tile(a,b)===1)candidates.push({x,y,a,b,dx,dy})}}candidates.sort((a,b)=>Math.hypot(a.x-q.x,a.y-q.y)-Math.hypot(b.x-q.x,b.y-q.y));let c=candidates[0];if(!c)continue;let {x,y,a,b,dx,dy}=c;for(let j=y-1;j<=y+4;j++)for(let i=x-1;i<=x+5;i++)tiles[j][i]=(i>=x&&i<x+5&&j>=y&&j<y+4)?1:2;let door={x:dx<0?x-1:dx>0?x+5:x+2,y:dy<0?y-1:dy>0?y+4:y+1};tiles[door.y][door.x]=1;q.x=x+2;q.y=y+2;q.room={x,y,w:5,h:4};q.door=door;}state.sanctuaries=state.sanctuaries.filter(q=>q.room);if(state.sanctuaries.length)state.safe={x:state.sanctuaries[0].x,y:state.sanctuaries[0].y}}function pursueCrawler(enemy){
  // Search a short, walkable route around props. Never cut across a guild threshold.
  const queue=[[enemy.x,enemy.y,null]],seen=new Set([enemy.y*W+enemy.x]);
  for(let i=0;i<queue.length&&i<260;i++){
    const [x,y,first]=queue[i];
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const a=x+dx,b=y+dy,key=b*W+a;
      if(seen.has(key)||solid(a,b)||sanctuaryAt(a,b)||tile(a,b)===3)continue;
      if(a===state.x&&b===state.y){if(first)[enemy.x,enemy.y]=first;return}
      if((step&&step.nx===a&&step.ny===b)||entities.some(e=>e!==enemy&&e.alive&&e.x===a&&e.y===b))continue;
      seen.add(key);queue.push([a,b,first||[a,b]]);
    }
  }
}
function enemyTick(dt){if(state.hall||state.dead||bossFight||partyGuest()||state.chapter!=='mine')return;let guardian=entities.find(e=>e.boss&&e.alive&&Math.hypot(e.x-state.x,e.y-state.y)<=3);if(guardian&&!sanctuaryAt(state.x,state.y)&&(!state.arena||inArena(state.x,state.y))){beginBoss(guardian);return}moveScout(dt);if(sanctuaryAt(state.x,state.y))return;state.retreatGrace=Math.max(0,(state.retreatGrace||0)-dt);for(let e of entities){if(!e.alive||e.type!=='enemy'||e.boss)continue;e.cool-=dt;
if(e.lured>0)e.lured-=dt;
if(e.avoid>0){e.avoid-=dt;continue}
if(e.pursuit>0){
  e.pursuit-=dt;e.pursuitDelay-=dt;
  if(e.pursuitDelay<=0&&Math.hypot(e.x-state.x,e.y-state.y)>=1.4){pursueCrawler(e);e.pursuitDelay=.48}
  if(state.retreatGrace||Math.hypot(e.x-state.x,e.y-state.y)>=1.4)continue;
}
if(state.retreatGrace&&Math.hypot(e.x-state.x,e.y-state.y)<1.4)continue;
if(Math.hypot(e.x-state.x,e.y-state.y)<1.4){if(!window.DCKNet?.inRoom){beginBoss(e);return}if(e.cool<=0){e.attackAt=performance.now();
 {if(e.sprite==='mire-leprechaun'&&Math.random()<.4){mistCloud(e);(state.wounds??={}).sick=true}takeDamage(e.atk,e)}e.cool=1.2+Math.random()*.45;if(state.dead)break}}else if(Math.random()<dt*(state.floor===1?.72:1+Math.min(state.floor,12)*.035)){
const chasing=!(e.lured>0)&&Math.hypot(e.x-state.x,e.y-state.y)<(state.floor===1?7:9+Math.floor(state.floor/5))+(state.season?.contract==='live'?5:0);
const target=chasing?state:e.den;if(!target)continue;
let dx=Math.sign(target.x-e.x),dy=Math.sign(target.y-e.y);let opts=Math.random()<.5?[[dx,0],[0,dy]]:[[0,dy],[dx,0]];for(let [ax,ay] of opts)if((ax||ay)&&!(step&&e.x+ax===step.nx&&e.y+ay===step.ny)&&!solid(e.x+ax,e.y+ay)&&!sanctuaryAt(e.x+ax,e.y+ay)&&!entities.some(q=>q!==e&&q.alive&&q.x===e.x+ax&&q.y===e.y+ay)){e.x+=ax;e.y+=ay;break}}}}
function checkLevel(){while(state.xp>=state.nextXp){state.xp-=state.nextXp;state.level++;state.nextXp=Math.floor(state.nextXp*1.35);state.maxHp+=12;restoreHealth(state.maxHp);if(state.floor>=4){state.maxMp+=4;state.mp=state.maxMp}state.power+=2;state.skillPoints++;feed('<b>LEVEL UP!</b> You reached level '+state.level+'. Stats increased.');notify('LEVEL UP — LEVEL '+state.level);unlock('Getting stronger');beep(660,.2,'sine')}}
const achievementNotes={
  'Guild inductee':'Finished Rowan’s induction and earned access to the crawler menus.',
  'Not alone':'Found another crawler and spoke to them in the dungeon.',
  'Even Cowards Need a Break':'Discovered a guild sanctuary. Even the audience needs an intermission.',
  'Safe harbor':'Rested in a sanctuary bed.',
  'First blood':'Won your first fight in the dungeon.',
  'Local Pest Control':'Defeated your first dungeon enemy. The pest-control contract is apparently yours now.',
  'Getting stronger':'Earned enough experience to gain a level.',
  'Down but not out':'Fell in combat. The guild can still bring you back.',
  'Warden breaker':'Defeated a floor guardian.',
  'Management Has Been Terminated':'Defeated a guardian and broke its hold on the floor.',
  'Four paws, one crawler':'Transformed a pet into a crawler with an enchanted biscuit.',
  'Scavenger':'Emptied a nearby loot container.',
  'Personal Space Is for the Living':'Emptied three loot containers.',
  'Estate Sale Enthusiast':'Emptied fifteen loot containers.',
  'Deeper down':'Descended from one dungeon floor to the next.',
  'Elevator Out of Service':'Reached the stairs and continued deeper on foot.',
  'Congratulations, You Have Legs':'Walked 50 steps in the dungeon.',
  'The Dungeon Is Not a Treadmill':'Walked 250 steps in the dungeon.',
  'Certified Corridor Enthusiast':'Walked 1,000 steps in the dungeon.',
  'Suspiciously Competent Wandering':'Caught the audience’s attention while exploring the tunnels.',
  'Unlicensed Exterminator':'Defeated ten dungeon enemies.',
  'The Neighborhood Is Quiet Now':'Defeated thirty dungeon enemies.',
  'Population Control Department':'Defeated one hundred dungeon enemies.',
  'Gravity Is a Suggestion':'Jumped ten times in the dungeon.',
  'Unauthorized Indoor Fireworks':'Cast five Arc Pulse attacks.'
};
const historicPrizes={'Local Pest Control':'Bronze','Elevator Out of Service':'Silver','Estate Sale Enthusiast':'Silver','Unlicensed Exterminator':'Silver','The Dungeon Is Not a Treadmill':'Silver','Certified Corridor Enthusiast':'Legendary','Management Has Been Terminated':'Gold','The Neighborhood Is Quiet Now':'Gold','Population Control Department':'Celestial'};
function achievementEntry(name){
  const tier=state.achievementPrizes?.[name]??historicPrizes[name];
  return '<details class="earned-award"><summary>✦ '+safeAttr(name)+'</summary><p>'+safeAttr(achievementNotes[name]||'Earned during an earlier expedition.')+'</p>'+(tier?'<small>Reward · '+safeAttr(tier)+' loot box ×1</small>':'')+'</details>';
}

function awardBox(tier){let id='box-'+tier,it=state.inventory.find(i=>i.id===id);if(it)it.qty++;else state.inventory.push({id,name:tier+' loot box',icon:'🎁',qty:1,desc:'Open for randomized dungeon rewards.'});notify(tier.toUpperCase()+' LOOT BOX AWARDED');return tier;}function ridiculous(n,tier='Bronze'){if(state.achievements.includes(n))return;const bonus=tier!=='Bronze'||n==='Local Pest Control';unlock(n,bonus?awardBox(tier):null);ai('NEW ACHIEVEMENT: '+n+'.'+(bonus?' A '+tier+' box lands in your backpack.':' The audience noticed.'));if(tab==='inventory')openTab(tab)}const awardQueue=[];
let awardShowing=false;
function achievementBanner(name,tier){
  awardQueue.push({name,tier});if(!awardShowing)playAchievement();
}
function playAchievement(){
  const el=$('#awardScreen');
  const next=awardQueue.shift();
  if(!next){
    awardShowing=false;el.close();resumeInspectionClock();return;
  }
  if(!awardShowing){pauseInspectionClock();awardShowing=true}
  $('#awardName').textContent=next.name;
  $('#awardDescription').textContent=achievementNotes[next.name]||'Earned during your expedition.';
  $('#awardReward').hidden=!next.tier;$('#awardReward').textContent=next.tier?'🎁 '+next.tier+' loot box ×1 · Added to backpack':'';
  if(!el.open)el.showModal();
  $('#awardSkip').focus({preventScroll:true});
  beep(523,.09,'sine');setTimeout(()=>beep(784,.15,'sine'),95);
}
let pauseStarted=null;
function pauseInspectionClock(){if(pauseStarted===null)pauseStarted=performance.now();clearMovement()}
function resumeInspectionClock(){
  if(pauseStarted===null||awardShowing||['#inspectScreen','#companionPanel','#campaignPanel'].some(id=>$(id).open))return;
  if(step)step.start+=performance.now()-pauseStarted;
  pauseStarted=null;last=0;updatePace();
}
$('#awardScreen').oncancel=e=>e.preventDefault();
$('#awardSkip').onclick=playAchievement;
function itemArt(item){
  const base=item.id.replace(/-\d+$/,'');
  const art=base.startsWith('box-')?'box':base.startsWith('gear-')?(item.slot==='armor'?'echo-mail':'dock-knife'):base;
  const known=['meth-cargo','box','tonic','shard','torch','gold','food','biscuit',...rewardCatalog.map(i=>i.id)];
  return known.includes(art)?art:'satchel';
}
function gearModifiers(piece){
  if(!piece)return {};
  return piece.mods||{[piece.slot==='weapon'?'power':'armor']:piece.bonus||0};
}
function showComparison(item){
  const panel=$('#itemCompare');panel.replaceChildren();
  if(item.art!==undefined||item.id.startsWith('box-')||item.id==='gold')return;
  const gear=!!item.slot;
  const peers=state.inventory.filter(other=>other.qty>0&&other.id!==item.id&&
    (gear?other.slot===item.slot:!other.slot&&!other.id.startsWith('box-')));
  if(!gear&&!peers.length)return;
  const worn=state.equipment?.[item.slot],choices=gear?[null,...peers]:peers;
  const label=i=>i.name+(i.rank?' · Rank '+i.rank:'');
  const select=document.createElement('select');select.setAttribute('aria-label','Compare with');
  choices.forEach((other,i)=>{
    const name=other?label(other)+(gear&&other.id===worn?' (equipped)':''):({weapon:'Unarmed',armor:'Everyday clothes',charm:'Empty charm slot'})[item.slot];
    select.add(new Option(name,String(i)));
  });
  select.selectedIndex=gear?Math.max(0,choices.findIndex(i=>i&&i.id===worn)):0;
  if(gear&&item.id===worn&&peers.length)select.selectedIndex=1;
  const caption=document.createElement('label');caption.append('Compare with ',select);panel.append(caption);
  const table=document.createElement('table');panel.append(table);
  function draw(){
    const other=choices[select.selectedIndex];table.replaceChildren();
    const head=table.createTHead().insertRow();
    for(const title of [gear?'Stat':'Item',other?label(other):select.selectedOptions[0].textContent,label(item),...(gear?['Change']:[])]){
      const cell=document.createElement('th');cell.textContent=title;head.append(cell);
    }
    const body=table.createTBody();
    const row=(values,delta=0)=>{const tr=body.insertRow();for(const value of values)tr.insertCell().textContent=value;if(delta)tr.lastChild.className=delta>0?'gain':'loss'};
    if(gear){
      const a=gearModifiers(item),b=gearModifiers(other);
      for(const [key,title] of Object.entries({power:'Power',armor:'Armor',spellBonus:'Spell bonus'})){
        if(!(key in a)&&!(key in b))continue;
        const delta=(a[key]||0)-(b[key]||0);
        row([title,b[key]||0,a[key]||0,(delta>0?'+':'')+delta],delta);
      }
    }else{
      const effect=i=>supplies[i.id]?.desc||(i.id==='shard'?'Restores 20 mana.':i.desc)||'No listed effect.';
      row(['Effect',effect(other),effect(item)]);
      row(['In pack',quantity(other.id),quantity(item.id)]);
    }
  }
  select.onchange=draw;draw();
}

function inspectItem(item,label,action){
  if(!item||awardShowing)return;
  const screen=$('#inspectScreen');document.getElementById('inventoryActions')?.remove();
  const display=$('#inspectArt');display.replaceChildren();
  if(item.art!==undefined){
    const c=document.createElement('canvas');c.width=c.height=32;
    const paint=()=>c.getContext('2d').drawImage(sceneryArt,item.art*32,0,32,32,0,0,32,32);
    if(sceneryArt.naturalWidth)paint();else sceneryArt.addEventListener('load',paint,{once:true});
    display.append(c);
  }else{
    const img=document.createElement('img');img.alt=item.name;
    img.src='item-art.svg#'+itemArt(item);display.append(img);
  }
  $('#inspectType').textContent=item.art!==undefined?'Field discovery':item.slot||'Inventory item';
  $('#inspectTitle').textContent=item.name;
  $('#inspectText').textContent=item.desc||'';showComparison(item);
  const confirm=$('#inspectAction');confirm.hidden=!action;confirm.textContent=label||'';
  const dismiss=()=>{screen.close();resumeInspectionClock()};
  $('#inspectBack').onclick=dismiss;screen.oncancel=e=>{e.preventDefault();dismiss()};
  confirm.onclick=()=>{dismiss();action?.()};
  pauseInspectionClock();if(!screen.open)screen.showModal();
}
function moveStack(from,to,item,qty){
  if(!from.includes(item)||qty<1||qty>item.qty)return false;
  const existing=to.find(i=>i.id===item.id);
  if(existing)existing.qty+=qty;else to.push({...item,qty});
  item.qty-=qty;if(item.qty===0)from.splice(from.indexOf(item),1);return true;
}
function inspectOwned(item,duplicate=false){
  if(!item)return;
  const equipped=item.slot&&state.equipment?.[item.slot]===item.id;
  const usable=item.effect||item.slot||['torch','tonic','shard','biscuit','food'].includes(item.id)||item.id.startsWith('box-');
  inspectItem(item,item.slot?(equipped?'Unequip':'Equip'):item.id.startsWith('box-')?'Open':'Use',
    usable&&!(duplicate&&equipped)?()=>useItem(item.id):null);
  if(!$('#inspectScreen').open)return;
  const available=item.qty-(equipped?1:0);
  const controls=document.createElement('div');controls.id='inventoryActions';
  if(available>0&&state.inventory.includes(item)){
    const add=(label,fn)=>{const b=document.createElement('button');b.className='widebtn';b.textContent=label;b.onclick=()=>{$('#inspectBack').click();fn()};controls.appendChild(b)};
    add('Move '+available+' to For sale',()=>{moveStack(state.inventory,state.tradeInventory??=[],item,available);persistCampaign();render();backpack()});
    if(!state.hall&&state.chapter==='mine')add('Drop '+available+' in a bag',()=>{if(partyGuest()){requestGuestDrop(item,available);return}const dropped=[];if(!moveStack(state.inventory,dropped,item,available))return;entities.push({type:'loot',name:'Dropped backpack',x:state.x,y:state.y,alive:true,droppedBag:true,contents:dropped});persistCampaign();sendPartyWorld();render();backpack()});
  }
  $('#inspectAction').after(controls);
}
function unlock(n,tier=null){if(!state.achievements.includes(n)){state.achievements.push(n);if(tier)(state.achievementPrizes??={})[n]=tier;achievementBanner(n,tier);feed('Achievement unlocked: <b>'+n+'</b>.');}}
const rewardCatalog=[
 {id:'cage-cleaver',name:'Cage cleaver',slot:'weapon',look:'knife',icon:'⚔',mods:{power:9,armor:-1}},
 {id:'relay-maul',name:'Relay maul',slot:'weapon',look:'hammer',icon:'⚒',mods:{power:11,spellBonus:-2}},
 {id:'warden-plate',name:'Warden plate',slot:'armor',look:'mail',icon:'⬟',mods:{armor:8,power:-1}},
 {id:'mirror-ward',name:'Mirror ward',slot:'charm',look:'glass',icon:'◆',mods:{armor:3,spellBonus:4}},
 {id:'cinder-seal',name:'Cinder seal',slot:'charm',look:'bell',icon:'♢',mods:{spellBonus:8,armor:-2}},
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
  const pool=rewardCatalog.filter(i=>!['cage-cleaver','relay-maul','warden-plate','mirror-ward','cinder-seal'].includes(i.id)||['Gold','Legendary','Celestial'].includes(tier));
  const item=pool[Math.floor(Math.random()*pool.length)];
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
    const mods=gearModifiers(piece);
    for(const [stat,n] of Object.entries(mods))state[stat]=(state[stat]||0)+n*sign;
  }
  apply(previous,-1);
  if(previous===item)delete state.equipment[item.slot];
  else{apply(item,1);state.equipment[item.slot]=item.id}
}
function useItem(id,quick=false){if(personalMenusLocked()){lockHint();return}let it=state.inventory.find(i=>i.id===id&&i.qty>0);if(!it)return;
if(id==='box-Pet'){
  const reward=Math.random()<.08?'biscuit':'food';it.qty--;giveItem(reward,1);
  persistCampaign();render();backpack();inspectItem({id:reward,...supplies[reward]});return
}
if(id==='biscuit'){
  if(!state.pet||state.pet.crawler){notify('An untransformed pet must be with you.');return}
  it.qty--;Object.assign(state.pet,{crawler:true,level:1,wins:0});persistCampaign();render();if(modalOpen())backpack();unlock('Four paws, one crawler');persistCampaign();return
}
if(id==='food'){const heal=Math.min(state.wounds?.sick?7:15,state.maxHp-state.hp);if(!heal){notify('Health already full.');return}state.hp+=heal;it.qty--;persistCampaign();render();if(!quick&&modalOpen())backpack();notify('Trail ration restores '+heal+' HP.');return}
if(it.slot){equipItem(it);save();render();openTab('inventory');return}
if(it.effect==='boon'&&state.floor<4){notify('Spell boons unlock on Floor 4.');return}
if(it.effect==='buff'){state.power-=state.teaPower||0;state.teaPower=2+it.rank;state.power+=state.teaPower;it.qty--;notify('Ember tea active on this floor.')}
else if(it.effect==='boon'){if(state.mp<5){notify('Requires 5 MP.');return}state.mp-=5;state.spellBonus=(state.spellBonus||0)+it.rank;it.qty--;notify('Spell boon learned.')}
else if(id.startsWith('box-')){it.qty--;const tier=id.slice(4),reward=rollReward(tier);showModal('<div class="box-reveal"><h2>'+safeAttr(tier)+' loot box</h2><div class="reward-chest">'+reward.icon+'</div><h3>'+reward.name+'</h3><p>'+reward.desc+'</p><button class="widebtn" id="inspectReward">Inspect reward</button><button class="widebtn" id="rewardDone">Back to backpack</button></div>');$('#inspectReward').onclick=()=>inspectOwned(reward);$('#rewardDone').onclick=backpack;feed('Unboxed '+reward.name+'.')}else if(id==='tonic'){let v=Math.min(35,state.maxHp-state.hp);if(!v&&!conditionText()){notify('Health already full.');return}restoreHealth(v);it.qty--;feed('Health potion restores '+v+' HP and treats injuries.')}else if(id==='shard'){let v=Math.min(20,state.maxMp-state.mp);if(!v){notify('Mana already full.');return}state.mp+=v;it.qty--;feed('Mana shard restores '+v+' MP.')}else if(id==='torch'){state.torchTurns=40;it.qty--;reveal();feed('You light a torch. The shadows retreat.')}save();render();if(!quick&&!id.startsWith('box-'))openTab('inventory')}
function nextFloor(){if(state.chapter==='surface'){
state.chapter='mine';generate();$('#objective').textContent='FIND THE STAIRS • SURVIVE';
caption('Beneath Seattle','Street noise fades above you. A blue bell rope trails under Seattle. Beside it, someone has scratched three words: Find the keeper.',true);
const guild=state.sanctuaries?.find(q=>q.door);if(guild&&personalMenusLocked())enterHall(guild);persistCampaign();return}
if(partyGuest()){notify('Wait for the party host to descend.');return}if(entities.some(e=>e.boss&&e.alive)){notify('Defeat the guardian before descending.');return}
if(state.floor>=FINAL_FLOOR){
  if(!state.campaignWon){state.campaignWon=true;feed('The last bell rings. Seattle hears the all-clear.');persistCampaign();sendPartyWorld()}
  showModal('<h2>Seattle hears the last bell</h2><p>You cleared all 18 floors. Above the rescue shaft, the street lamps come back on.</p><button class="widebtn" id="campaignDone">Return to the floor</button>');
  $('#campaignDone').onclick=closeModal;return;
}
if(state.floor===2){const s=season();if(s.crew==='following')saveCrew();else if(s.crew!=='saved'){s.crew='lost';highlight('Nell reached the cage alone. Tess missed the last boat.',8)}}
ridiculous('Elevator Out of Service','Silver');state.floor++;if(state.floor===4&&state.maxMp===0){state.maxMp=35;state.mp=35}state.hp=Math.min(state.maxHp,state.hp+18);state.mp=Math.min(state.maxMp,state.mp+8);state.gold+=10;unlock('Deeper down');feed('You descend to floor '+state.floor+'. +10 gold, recovered vitality.');generate();$('#floorTag').textContent='FLOOR '+String(state.floor).padStart(2,'0');$('#roomName').textContent=names[(state.floor-1)%names.length].toUpperCase();
const reports={
2:['Iven’s radio','Elliott Bay is leaking through the west wall. Follow the blue pipes to the cage motor.'],
3:['Rescue frequency','The SoDo lift is drawing power again. Something is holding the cage below the platform.'],
4:['Mara','Look up through the grate. That light over Capitol Hill is answering our bell.'],
5:['Mara','The Lake Union archive has the original wiring plans. Find where the signal leaves the city.'],
6:['Rescue frequency','Queen Anne relay online. Seattle can hear us. Keep the channel open.']
};
if(state.floor===2&&state.relay)reports[2][1]='Nell here. Tess is sick. Find us near '+state.relay.camp.x+', '+state.relay.camp.y+'. Two bells mean high water.';
if(state.floor===3&&['saved','lost'].includes(state.season?.crew))reports[3][1]=season().crew==='saved'?'Both salvage crew members made it. Nell left you a call sign for the lift on 4.':'Nell came up alone. The second bunk is still made.';
if(state.floor===4)reports[4][1]+=' Rowan is waiting at the guild to register your new identity.';
if(reports[state.floor])caption(...reports[state.floor],true);
if(state.floor===4&&!state.identityLocked){const q=state.sanctuaries?.[0];if(q)enterHall(q);guildIdentity()}
save()}
function openDeath(){showModal(`<h2>THE DUNGEON CLAIMS YOU</h2><p>You reached floor ${state.floor}, defeated ${state.kills} enemies, and reached level ${state.level}.</p><p>Your run can continue, but the dungeon will take a toll.</p><button class="widebtn" id="reviveBtn">REVIVE AT ENTRANCE</button><button class="widebtn danger" id="resetBtn">START A NEW RUN</button>`);$('#reviveBtn').onclick=()=>{if(state.collapsed){campaignMenu();return}state.dead=false;state.wounds={};state.hp=Math.min(state.maxHp,Math.max(30,Math.floor(state.maxHp*.5)));state.x=state.safe?.x??state.x;state.y=state.safe?.y??state.y;feed('You claw your way back from the brink.');render();save();closeModal()};$('#resetBtn').onclick=campaignMenu}
let switchingCampaign=false;
const slotKey=i=>saveKey+'-slot-'+i;
function campaignSummary(data){
  const run=data.state;
  const place=run.chapter==='create'?'Character creation':run.chapter==='surface'?'Seattle surface':'Floor '+run.floor;
  return (run.character?.name||'Crawler')+' · '+place+' · Level '+run.level;
}
function campaignMenu(){
  if(animatingTurn)return;
  const panel=$('#campaignPanel'),list=$('#saveSlots'),notice=$('#campaignNotice');
  notice.textContent='';list.replaceChildren();
  pauseInspectionClock();if(!panel.open)panel.showModal();
  const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;return b};
  function confirmAction(message,fn){
    notice.replaceChildren();const text=document.createElement('p');text.textContent=message;
    const yes=button('Confirm',()=>{notice.replaceChildren();fn()});
    notice.append(text,button('Cancel',campaignMenu),yes);yes.focus({preventScroll:true});
  }
  function replaceRun(raw){
    try{
      if(raw===null)localStorage.removeItem(saveKey);else localStorage.setItem(saveKey,raw);
      switchingCampaign=true;location.reload();
    }catch{notice.textContent='Could not switch campaigns. Check available browser storage.'}
  }
  for(let i=1;i<=3;i++){
    const key=slotKey(i),row=document.createElement('section'),title=document.createElement('strong'),summary=document.createElement('small');
    let raw=null,data=null;
    try{raw=localStorage.getItem(key);if(raw)data=JSON.parse(raw);if(!data?.state||!Array.isArray(data.tiles)||!data.tiles.length||!Array.isArray(data.seen))data=null}catch{}
    title.textContent='Slot '+i;
    summary.textContent=data?campaignSummary(data)+(data.savedAt?' · '+new Date(data.savedAt).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):''):raw?'Unreadable save':'Empty slot';
    const write=()=>{try{writeCampaign(key);campaignMenu();notice.textContent='Campaign saved to slot '+i+'.'}catch{notice.textContent='Save failed. Check available browser storage.'}};
    const saveBtn=button('Save',()=>raw?confirmAction('Replace the campaign in slot '+i+'?',write):write());
    const loadBtn=button('Load',()=>confirmAction('Load slot '+i+' and replace your current autosave?',()=>replaceRun(raw)));
    loadBtn.disabled=!data;row.append(title,summary,saveBtn,loadBtn);list.append(row);
  }
  $('#freshCampaign').onclick=()=>confirmAction('Start over at character creation? Your current autosave will be replaced. Manual slots are kept.',()=>replaceRun(null));
}
function renderPetGear(body,pet){
 const stats=petStats();pet.hp=Math.min(stats.maxHp,pet.hp??stats.maxHp);pet.gear??={};pet.pack??=[];
 const area=document.createElement('section');body.appendChild(area);
 const title=document.createElement('h3');title.textContent='Companion equipment and inventory';area.appendChild(title);
 const info=document.createElement('p');info.textContent='HP '+pet.hp+'/'+stats.maxHp+' · Attack '+stats.power+' · Armor '+stats.armor;area.appendChild(info);
 const btn=(label,fn,disabled=false)=>{const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=()=>{fn();persistCampaign();render();companionMenu()};area.appendChild(b)};
 for(const slot of ['weapon','armor']){
 const equipped=pet.gear[slot];btn(equipped?'Unequip '+equipped.name:'Empty '+slot,()=>{if(equipped){pet.pack.push(equipped);delete pet.gear[slot]}},!equipped);
 }
 for(const item of state.inventory.filter(i=>i.slot&&['weapon','armor'].includes(i.slot)&&i.qty>(state.equipment?.[i.slot]===i.id?1:0))){
 btn('Give '+item.name,()=>{pet.pack.push({...item,qty:1});item.qty--});
 }
 for(const item of pet.pack.slice()){
 btn('Equip '+item.name,()=>{const previous=pet.gear[item.slot];if(previous)pet.pack.push(previous);pet.gear[item.slot]=item;pet.pack.splice(pet.pack.indexOf(item),1)});
 btn('Return '+item.name,()=>{const existing=state.inventory.find(i=>i.id===item.id);if(existing)existing.qty++;else state.inventory.push({...item,qty:1});pet.pack.splice(pet.pack.indexOf(item),1)});
 }
 btn('Feed ration · heal 15 HP',()=>{const food=state.inventory.find(i=>i.id==='food'&&i.qty>0);if(food){food.qty--;pet.hp=Math.min(stats.maxHp,pet.hp+15)}},!quantity('food')||pet.hp>=stats.maxHp);
 if(!pet.mutation&&pet.level>=5){for(const mutation of ['Ironhide','Razorclaw'])btn('Evolve: '+mutation,()=>{pet.mutation=mutation;pet.hp=petStats().maxHp})}
 else{const note=document.createElement('p');note.textContent=pet.mutation?'Mutation: '+pet.mutation:'Mutation choice unlocks at companion level 5.';area.appendChild(note)}
}
function companionMenu(){
  if(personalMenusLocked()){lockHint();return}
  const panel=$('#companionPanel'),body=$('#companionBody'),pet=state.pet;
  pauseInspectionClock();if(!panel.open)panel.showModal();
  if(!pet){body.innerHTML='<p>No companion yet. Approach a stray animal in the dungeon and use Interact to befriend it.</p>';return}
  const species=animalNames[pet.species]||'Companion',wins=pet.wins||0;
  const description=pet.crawler?'Crawler · Level '+pet.level:'Pet · Travels with you';
  body.innerHTML='<div class="companion-profile"><canvas width="32" height="32" aria-label="Companion portrait"></canvas><div><h3>'+safeAttr(pet.name||species)+'</h3><p>'+safeAttr(species)+' · '+description+'</p></div></div>'+
    (pet.crawler?'<p>Strike assist +'+(pet.level+1)+' · '+(4-wins%4)+' victories to next level</p><progress aria-label="Progress to next level" value="'+(wins%4)+'" max="4"></progress>':'<p>An enchanted biscuit from a Pet loot box can transform this pet into a crawler.</p><button id="feedCompanion" '+(quantity('biscuit')?'':'disabled')+'>Feed enchanted biscuit ×'+quantity('biscuit')+'</button>')+
    '<p>Victories '+wins+' · '+(orphanedPet()?'Escorting Sound Salvage':pet.species==='dog'?'Loyal · favors rescues':pet.species==='cat'?'Cautious · favors dry routes':'Alert · watches for hazards')+' · Next pet box in '+(5-wins%5)+'</p><form id="petNameForm"><label>Companion name<input name="petName" maxlength="24" placeholder="'+safeAttr(species)+'"></label><button>Save name</button></form>';
  drawAnimal(pet.species,0,0,pet.crawler,false,body.querySelector('canvas').getContext('2d'));
  if(pet.crawler)renderPetGear(body,pet);
  const form=$('#petNameForm');form.elements.petName.value=pet.name||'';
  form.onsubmit=e=>{e.preventDefault();pet.name=form.elements.petName.value.trim().slice(0,24);persistCampaign();render();companionMenu()};
  if($('#feedCompanion'))$('#feedCompanion').onclick=()=>{useItem('biscuit');companionMenu()};
}

function writeCampaign(key=saveKey){
if(switchingCampaign)return;
const encounter=bossFight?{...bossFight,e:entities.indexOf(bossFight.e)}:null;
localStorage.setItem(key,JSON.stringify({state,tiles,seen,entities,encounter,savedAt:Date.now()}));
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
if(state.chapter==='mine')entities.forEach((e,i)=>{
  if(e.type!=='enemy'||e.boss||!e.alive||e.rosterVersion)return;
  const fresh= floorEnemy(state.floor,i,e.x,e.y),ratio=e.hp/e.max;
  Object.assign(e,fresh,{hp:Math.max(1,Math.round(fresh.max*ratio))});
});
state.dead=!!(state.dead||state.collapsed||state.hp<=0);
const guardian=entities[o.encounter?.e];
if(!state.dead&&guardian?.type==='enemy'&&guardian.alive)bossFight={...o.encounter,e:guardian};
return true}}catch(e){}return false}
function inArena(x,y){let a=state.arena;return !!a&&x>=a.x&&x<a.x+a.w&&y>=a.y&&y<a.y+a.h}const terrainCache=new Map();
const terrainPalettes=[
 ['#34434a','#46545a','#202d35'],['#55413a','#735749','#342822'],['#34483c','#4c624a','#24372d'],['#344957','#516b78','#23343e'],['#42394e','#62536d','#292535'],['#52352d','#775044','#342521'],
 ['#29464a','#527477','#203339'],['#45493c','#74765a','#292c27'],['#384653','#6f8394','#222c3b'],['#4e3026','#925c3c','#2f211e'],['#3b424d','#66717c','#252b35'],['#54382e','#97634a','#352522'],
 ['#364c48','#64827a','#233634'],['#3c4854','#708a9d','#262e3a'],['#473b4b','#78627f','#2b252f'],['#324940','#608878','#24362f'],['#393c4b','#717386','#272836'],['#4d4230','#9a8556','#30291f']
];
function terrainArt(biome,variant,wall){let key=[biome,variant,wall].join(':');if(terrainCache.has(key))return terrainCache.get(key);let c=document.createElement('canvas');c.width=c.height=32;let g=c.getContext('2d'),r=rng(1009+biome*997+variant*53+(wall?9999:0));let pal=terrainPalettes[biome]||terrainPalettes[0];let f=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(x,y,w,h)};f(0,0,32,32,pal[2]);for(let row=0;row<3;row++){let y=row*11;for(let x=-(row%2)*8;x<32;x+=16){f(x+1,y+1,14,9,pal[0]);f(x+1,y+1,14,1,pal[1]);f(x+1,y+2,1,7,pal[1]);for(let k=0;k<6;k++)f(x+2+Math.floor(r()*11),y+3+Math.floor(r()*5),1+Math.floor(r()*2),1,r()<.5?'#ffffff12':'#00000025')}}if(!wall&&variant%3===0){const pattern=biome%6;for(let i=0;i<4;i++){let x=4+i*6;if(pattern===0)f(x,14,4,2,pal[1]);if(pattern===1)f(x,10,1,12,'#141c25');if(pattern===2)f(x,15+(i%2)*2,3,2,'#8c8667');if(pattern===3)f(x,4+i*5,5,1,'#7897a166');if(pattern===4)f(x,19,2,5,pal[1]);if(pattern===5)f(x,16+(i%2)*3,3,1,'#bf794b66')}}if(wall){f(0,0,32,3,pal[1]);f(0,26,32,6,pal[2]);f(0,26,32,1,'#0008')}terrainCache.set(key,c);return c}
function drawTile(x,y,t){if(state.chapter==="surface"||state.chapter==="create")return surfaceTile(x,y,t);const px=x*TILE,py=y*TILE,seed=Math.abs(Math.sin(x*12.9898+y*78.233)*43758.5453)%1;if(t===0){ctx.fillStyle='#080c11';ctx.fillRect(px,py,TILE,TILE);return}if(t===2){ctx.fillStyle='#151f28';ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle=seed>.5?'#26323b':'#202c35';ctx.fillRect(px+1,py+1,30,29);ctx.fillStyle='#10171d';ctx.fillRect(px+2,py+14,28,2);ctx.fillStyle='#52616a';ctx.fillRect(px+2,py+2,28,2);ctx.fillStyle='#090e14';ctx.fillRect(px+1,py+26,30,5);for(let i=0;i<9;i++){ctx.fillStyle=i%2?'#ffffff0d':'#00000025';ctx.fillRect(px+3+(i*7+x*3)%25,py+4+(i*11+y*5)%20,3,2)}ctx.fillRect(px+14,py+2,2,12);ctx.fillRect(px+21,py+16,2,13);ctx.fillStyle='#43515a';ctx.fillRect(px+4,py+4,8,1);ctx.fillRect(px+18,py+19,9,1);ctx.fillStyle='#0b1117';ctx.fillRect(px+3,py+28,25,2);ctx.drawImage(terrainArt((state.floor-1)%18,Math.floor(seed*12),true),px,py);if(seed>.91){let flicker=Math.sin(performance.now()/95+x*7+y)*.15+.85;let glow=ctx.createRadialGradient(px+8,py+7,1,px+8,py+7,25);glow.addColorStop(0,'rgba(255,171,73,'+(.25*flicker)+')');glow.addColorStop(1,'rgba(255,171,73,0)');ctx.fillStyle=glow;ctx.fillRect(px-17,py-18,50,50);ctx.fillStyle='#c17b42';ctx.fillRect(px+7,py+7,3,7);ctx.fillStyle='#ffb45e';ctx.fillRect(px+8,py+4,2,4);ctx.fillStyle='#e48a43';ctx.fillRect(px+5,py+6,7,2)}}else{let palettes=[['#49463c','#3b3932','#34332e'],['#514039','#40322e','#332824'],['#3e4940','#303b34','#27322c'],['#394750','#303c46','#26323b'],['#484054','#393345','#30293b'],['#584036','#47312b','#362522']];let pal=palettes[(state.floor-1)%palettes.length];let tone=pal[seed>.72?0:seed>.38?1:2];ctx.fillStyle=tone;ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle='#555044';ctx.fillRect(px+1,py+1,30,1);for(let i=0;i<13;i++){let a=(x*17+y*11+i*13)%28+2,b=(x*7+y*19+i*9)%28+2;ctx.fillStyle=i%3?'#00000016':'#ffffff13';ctx.fillRect(px+a,py+b,2+i%3,1+i%2)}ctx.fillRect(px+1,py+1,1,30);ctx.fillStyle='#292b29';ctx.fillRect(px+1,py+30,30,1);ctx.fillRect(px+30,py+1,1,30);ctx.fillStyle='#252927';ctx.fillRect(px+((x*7+y*3)%23)+4,py+((x*11+y*5)%22)+4,2,2);if(seed>.82){ctx.strokeStyle='#77705d';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px+7,py+6);ctx.lineTo(px+11,py+11);ctx.lineTo(px+9,py+16);ctx.stroke()}if(seed>.93){ctx.fillStyle='#211d19';ctx.fillRect(px+6,py+19,12,5);ctx.fillStyle='#918574';ctx.fillRect(px+8,py+17,3,8);ctx.fillRect(px+13,py+19,7,2)}if(seed<.12){ctx.fillStyle='#68724d';ctx.fillRect(px+4,py+24,5,2);ctx.fillRect(px+7,py+22,2,2)}}if(t===1){ctx.drawImage(terrainArt((state.floor-1)%18,Math.floor(seed*12),false),px,py);let biome=(state.floor-1)%6;if(biome===2&&seed<.22){ctx.fillStyle='#203f36';ctx.fillRect(px+4,py+8,22,17);ctx.fillStyle='#57816a';ctx.fillRect(px+7,py+12+Math.floor(performance.now()/450)%3,13,1)}if(biome===3&&seed<.25){ctx.fillStyle='#648b9b';ctx.fillRect(px+3,py+20,14,2);ctx.fillStyle='#a1c7cf';ctx.fillRect(px+6,py+17,5,2)}if(biome===5&&seed<.2){ctx.fillStyle='#8b3926';ctx.fillRect(px+3,py+8,3,19);ctx.fillRect(px+6,py+25,12,2);ctx.fillStyle='#e18b43';ctx.fillRect(px+4,py+11,1,12)}for(let j=0;j<2;j++){let off=(j*16+(y%2)*8)%32;ctx.fillStyle='#171b1b55';ctx.fillRect(px,py+j*16+15,32,1);ctx.fillRect(px+off,py+j*16,1,16);ctx.fillStyle='#c3b28b18';ctx.fillRect(px+1,py+j*16+1,30,1)}if(seed<.08){ctx.fillStyle='#394b36';for(let k=0;k<8;k++)ctx.fillRect(px+2+(k*7)%12,py+18+(k*3)%12,3,2)}if(tile(x,y-1)===2){ctx.fillStyle='#00000038';ctx.fillRect(px,py,32,6);ctx.fillStyle='#a69a7518';ctx.fillRect(px,py+6,32,1)}if(seed>.96){ctx.fillStyle='#30271e';ctx.fillRect(px+5,py+8,10,10);ctx.fillStyle='#826344';ctx.fillRect(px+6,py+9,8,8);ctx.fillStyle='#b28b56';ctx.fillRect(px+6,py+10,8,1);ctx.fillStyle='#4b3525';ctx.fillRect(px+9,py+9,2,8)}}if(state.arena?.gates?.some(g=>g.x===x&&g.y===y)){ctx.fillStyle='#69513b';ctx.fillRect(px+2,py+2,28,3);ctx.fillRect(px+2,py+27,28,3);let closed=bossFight?1:0;for(let i=0;i<5;i++){let h=closed?24:5;ctx.fillStyle='#a7a39a';ctx.fillRect(px+5+i*5,py+4,2,h)}}if(t===2){
  ctx.fillStyle='#0a101947';ctx.fillRect(px,py,32,32);
  const edge=(dx,dy,a,b,w,h)=>{if([1,3].includes(tile(x+dx,y+dy))){ctx.fillStyle='#172027';ctx.fillRect(px+a,py+b,w,h);ctx.fillStyle='#bcab89';ctx.fillRect(px+a,py+b,w===32?32:1,h===32?32:1)}};
  edge(0,1,0,28,32,4);edge(0,-1,0,0,32,3);edge(-1,0,0,0,3,32);edge(1,0,29,0,3,32);
}
if(t===1){ctx.fillStyle='#dec79520';ctx.fillRect(px,py,32,32)}
if(t===1&&inArena(x,y)&& (bossFight?.e?.boss||state.guardianRecord?.some(r=>r.floor===state.floor)))paintArenaTile(x,y,px,py,seed);if(t===3){let g=ctx.createRadialGradient(px+16,py+16,2,px+16,py+16,25);g.addColorStop(0,'#ffe7a0');g.addColorStop(.35,'#d79c49');g.addColorStop(1,'#8b542500');ctx.fillStyle=g;ctx.fillRect(px-5,py-5,42,42);ctx.fillStyle='#8b6338';ctx.fillRect(px+6,py+6,20,21);ctx.fillStyle='#f0c66d';for(let i=0;i<4;i++)ctx.fillRect(px+8+i*4,py+8+i*3,14-i*4,2)}}
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
const woundNames={bleed:'Bleeding',fracture:'Broken arm',poison:'Poisoned',sick:'Sick'};
function conditionText(){return Object.keys(woundNames).filter(k=>state.wounds?.[k]).map(k=>woundNames[k]).join(' · ')}
function registerHit(enemy,hit,guard=false,venom=false){
  if(guard)return;
  const w=state.wounds??={};
  if(state.hp<=state.maxHp*.55&&hit>=2)w.bleed=true;
  if(state.hp<=state.maxHp*.3&&hit>=Math.max(4,state.maxHp*.06))w.fracture=true;
  if(venom)w.poison=true;
  if(enemy.sprite==='sewer-rat'&&Math.random()<.12)w.sick=true;
}
function restoreHealth(amount){
  state.hp=Math.min(state.maxHp,state.hp+amount);state.wounds={};
  if(bossFight)bossFight.poison=0;
}
function canMend(){return state.floor>=4&&state.specialization==='Arcanist'}
function mend(){
  if(!canMend()||state.mp<8)return false;
  if(state.hp===state.maxHp&&!conditionText())return false;
  state.mp-=8;restoreHealth(30+(state.spellBonus||0));return true;
}
const woundedArt=new WeakMap();
function crawlerPose(dir,frame,character=state?.character,look=gearLook()){
  const base=baseCrawlerPose(dir,frame,character,look);
  if(character!==state?.character||!character)return base;
  const w=state.wounds||{},low=state.hp<=state.maxHp*.3;
  const key=[low,w.bleed,w.fracture,w.poison,w.sick].join('/');
  if(!low&&!w.bleed&&!w.fracture&&!w.poison&&!w.sick)return base;
  const cached=woundedArt.get(base);if(cached?.key===key)return cached.img;
  const img=document.createElement('canvas');img.width=base.width;img.height=base.height;
  const g=img.getContext('2d');g.drawImage(base,0,low?1:0);
  const mark=(x,y,a,b,color)=>{g.fillStyle=color;g.fillRect(x,y,a,b)};
  if(low){mark(10,19,3,2,'#514447');mark(13,26,2,2,'#8b725c')}
  if(w.sick){mark(10,10,5,2,'#aba575');mark(15,10,1,2,'#ede2af')}
  if(w.bleed){mark(8,15,3,2,'#953e3c');mark(9,17,1,3,'#a74741');mark(13,22,2,2,'#833c3b')}
  if(w.fracture){mark(15,15,2,7,'#ad865a');mark(14,17,4,1,'#f3e5c5');mark(14,20,4,1,'#ded4ba')}
  if(w.poison){mark(4,10,2,2,'#9ac369');mark(18,4,2,2,'#c2dd80');mark(3,7,1,1,'#d3dfb0')}
  woundedArt.set(base,{key,img});return img;
}
function baseCrawlerPose(dir,frame,character,look){let key=[dir,frame,character?.race,character?.skin,character?.gender,character?.hair,character?.shirt,character?.shirtColor,character?.pants,character?.pantsColor,character?.shoes,character?.shoeColor,look.armor,look.weapon,look.charm].join('/');if(walkArt.has(key))return walkArt.get(key);let c=document.createElement('canvas');c.width=24;c.height=32;let g=c.getContext('2d');let rect=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(x,y,w,h)},poly=(pts,col)=>{g.fillStyle=col;g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill()};let side=dir==='side',back=dir==='up',stride=Math.sin(frame*Math.PI/8);
const skin=skinTones[character?.skin]||skinTones[2],woman=character?.gender==='Woman';
const hair=character?.hair&&character.hair!=='Signature'?character.hair:woman?'Ponytail':'Crop';
const dark='#40312e',light='#795441',mid='#5d4136';
const bare=character?.shirt==='None',pants=character?.pants||'Trousers',shoes=character?.shoes||'Boots';const shirt=bare?skin:(character?.shirtColor||(woman?'#685567':'#667565')),seam=bare?skin:shirt;
const sway=Math.round(stride);
for(let leg=0;leg<2;leg++){
  const swing=leg?stride:-stride,x=(side?9:7)+leg*(side?3:6)+(side?2.8*swing:0),lift=-1.8*Math.max(0,swing);
  rect(x,19+lift,4,9,skin);const length=pants==='Trousers'?9:pants==='Shorts'?5:pants==='Underwear'?3:0;if(length)rect(x,19+lift,4,length,character?.pantsColor||'#414454');rect(x-1,27+lift,6,3,shoes==='Barefoot'?skin:character?.shoeColor||'#53504b');rect(x-1,30+lift,6,1,shoes==='Barefoot'?skin:'#c3bda9');
}
if(woman){
  poly([[8,11],[15,11],[17,14],[15,17],[17,22],[7,22],[9,17],[7,14]],shirt);
  rect(9,12,2,4,seam);rect(10,11,4,2,skin);rect(8,20,8,1,'#453e49');
}else{rect(7,11,10,10,shirt);rect(8,12,2,8,seam);rect(7,20,10,2,'#495b50')}
for(let arm=0;arm<2;arm++){
  const x=(arm?(woman?15:16):(woman?6:5))+(side?(arm?-2:2)*stride:0),y=12+(arm?stride:-stride);
  rect(x,y,3,8,skin);if(!bare&&character?.shirt!=='Tank top')rect(x,y,3,character?.shirt==='Long sleeve'?7:4,shirt);
}
rect(9,3,7,7,skin);rect(woman?10:9,10,woman?5:7,1,skin);
if(!back){rect(side?15:14,6,1,1,'#312c2a');if(!side)rect(10,6,1,1,'#312c2a')}
if(hair!=='Shaved'){
  rect(8,3,9,3,dark);rect(9,2,7,2,mid);rect(10,2,4,1,light);
  if(back)rect(9,5,7,5,dark);else rect(8,5,2,3,dark);
  if(hair==='Pixie'){
    rect(10,1,6,2,mid);rect(13,4,4,2,mid);rect(14,5,2,2,dark);rect(7,5,2,4,mid);
  }else if(hair==='Bob'){
    rect(7,4,3,8,dark);rect(8,4,1,6,light);if(!side)rect(15,4,3,8,mid);
    if(back){rect(9,5,7,7,mid);rect(10,5,1,5,light)}else rect(9,4,5,2,mid);
  }else if(hair==='Curls'){
    for(const [x,y] of [[7,4],[8,2],[11,1],[14,2],[16,3],[7,7],[16,6]]){rect(x,y,3,3,dark);rect(x,y,2,1,light)}
    if(back){rect(8,7,9,3,mid);rect(10,10,5,1,dark)}
  }else if(hair==='Ponytail'){
    const x=back?12:side?6:7;
    rect(x-1,5,4,4,mid);rect(x-1,6,3,1,'#b99b64');rect(x-2,8,4,5,dark);rect(x-2+sway,12,3,4,mid);rect(x-3+sway,15,3,2,dark);
  }else if(hair==='Braid'){
    const x=back?12:side?6:8;
    for(let j=0;j<5;j++){const bx=x+(j%2)+(j>2?sway:0);rect(bx-1,7+j*2,3,3,dark);rect(bx,7+j*2,2,1,light)}
    rect(x+sway,17,3,1,'#b59c6b');rect(x+sway,18,2,2,mid);
  }
}
if(pants==='Pixelated nude'){for(let j=0;j<3;j++)for(let i=0;i<5;i++)rect(7+i*2,19+j,2,1,(i+j)%2?'#796f69':'#b1a49a')}if(bare&&woman){rect(8,13,8,4,'#9b8f85');for(let i=0;i<4;i++)rect(8+i*2,14,1,2,'#b9aaa0')}if(look.armor){const coat=look.armor==='coat';rect(6,12,12,coat?12:8,coat?'#ac843c':look.armor==='mail'?'#55779c':'#687781');rect(8,13,8,1,coat?'#edc678':'#b1c8da');rect(12,14,1,6,'#403e43')}
if(look.weapon){const x=back?5:18;rect(x,16,2,9,'#835b38');if(look.weapon==='hammer'){rect(x-3,12,8,5,'#8d9097');rect(x-3,12,7,1,'#d3d6db')}else{rect(x,9,2,9,'#d8e6e5');rect(x-2,17,6,1,'#ba9362')}}
if(look.charm){rect(11,12,3,2,'#dec789');rect(11,14,3,4,look.charm==='glass'?'#78e5f2':look.charm==='iron'?'#9696a9':'#e0aa41')}
if(character?.race==='Elf'&&!back){rect(side?13:7,8,2,2,skinTones[character.skin]);rect(side?12:6,7,1,2,skinTones[character.skin])}
if(character?.race==='Cat'||character?.race==='Dog'){rect(7,1,3,5,skin);rect(15,1,3,5,skin);rect(17,21,3,7,skin)}if(character?.race==='Mutant Crab'){rect(3,15,5,5,'#b7654c');rect(17,15,5,5,'#b7654c');rect(4,13,2,3,'#e5a17b');rect(19,13,2,3,'#e5a17b')}if(character?.race==='Wizard'){rect(5,3,14,2,'#735a99');rect(10,0,5,4,'#735a99')}if(character?.race==='Zombie'){rect(9,5,7,5,'#859c78');rect(10,6,1,1,'#e3e6ac');rect(14,6,1,1,'#e3e6ac')}if(character?.race==='Dwarf'){rect(5,14,4,3,'#b18954');rect(15,14,4,3,'#b18954');rect(10,15,4,3,'#cea668')}
walkArt.set(key,c);return c}
function smoothPhase(p,a,b){
  const t=Math.max(0,Math.min(1,(p-a)/(b-a)));
  return t*t*(3-2*t);
}
function drawStrike(g,p,dir='side',aim=0){
  const gear=gearLook(),weapon=gear.weapon,heavy=weapon==='hammer',contact=heavy?.52:.43;
  const wind=smoothPhase(p,0,contact-.16);
  const drive=smoothPhase(p,contact-.16,contact+.03);
  const settle=smoothPhase(p,contact+.07,1);
  const coil=wind*(1-drive),reach=drive*(1-settle);
  const body=crawlerPose(dir,0,state.character,{...gear,weapon:null});
  const skin=skinTones[state.character?.skin]||skinTones[2];
  const forward=Math.cos(aim),drop=Math.sin(aim);
  g.save();
  // Keep the back foot planted while the hips shift and the shoulder turns.
  g.drawImage(body,0,21,24,11,-12,-11,24,11);
  g.translate(forward*(3.5*reach-1.4*coil),-11+coil+drop*reach);
  g.rotate(forward*(.19*reach-.13*coil));
  g.drawImage(body,0,0,24,21,-12,-21,24,21);
  const shoulderX=3, shoulderY=-7;
  const angle=aim+(weapon?(-1.95*coil+.23*reach-.36*(1-wind)):(.72*coil-.05*reach));
  const extension=weapon?5+4*reach:3+10*reach;
  const handX=shoulderX+Math.cos(angle)*extension,handY=shoulderY+Math.sin(angle)*extension;
  const elbowX=shoulderX+forward*(reach*4-coil*4),elbowY=shoulderY+5+drop*reach;
  g.lineCap='round';g.lineJoin='round';
  g.beginPath();g.moveTo(shoulderX,shoulderY);g.lineTo(elbowX,elbowY);g.strokeStyle=gear.armor?'#677980':'#667565';g.lineWidth=4;g.stroke();
  g.beginPath();g.moveTo(elbowX,elbowY);g.lineTo(handX,handY);g.strokeStyle=skin;g.lineWidth=3;g.stroke();
  if(weapon){
    const bladeAngle=angle-.65+.8*drive*(1-settle);
    if(p>contact-.13&&p<contact+.16){
      const opacity=Math.sin(Math.PI*(p-contact+.13)/.29)*.65;
      g.save();g.translate(shoulderX,shoulderY);g.strokeStyle='rgba(247,218,161,'+opacity+')';g.lineWidth=heavy?2.2:1.4;
      g.beginPath();g.arc(0,0,heavy?20:18,bladeAngle-.85,bladeAngle);g.stroke();g.restore();
    }
    g.save();g.translate(handX,handY);g.rotate(bladeAngle);
    g.fillStyle='#815638';g.fillRect(-2,-1,heavy?12:5,2);
    if(heavy){g.fillStyle='#778491';g.fillRect(8,-4,5,8);g.fillStyle='#d0d1bb';g.fillRect(8,-4,5,2)}
    else{g.fillStyle='#bc9961';g.fillRect(2,-2.5,1.5,5);g.fillStyle='#dce7e1';g.beginPath();g.moveTo(3,-1.4);g.lineTo(13,-.6);g.lineTo(10,1.2);g.lineTo(3,1.2);g.fill()}
    g.restore();
  }
  g.fillStyle=skin;g.fillRect(handX-1.5,handY-1.5,3,3);g.restore();
}
function playDuelStrike(stage,battle){
  const canvas=stage.querySelector('.strike-pose'),g=canvas.getContext('2d');
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const duration=gearLook().weapon==='hammer'?640:520;
  return battleFrames(reduced?1:duration,p=>{
    g.clearRect(0,0,72,48);g.save();g.imageSmoothingEnabled=false;g.translate(36,47);
    drawStrike(g,reduced?.45:p);g.restore();
  },()=>bossFight===battle&&stage.isConnected);
}
function drawHero(x,y){
  if(state.pet&&!orphanedPet()){const pet=petPosition(x,y);if(pet)drawAnimal(state.pet.species,pet.x,pet.y,state.pet.crawler,pet.walking,ctx,pet.facing)}
  const now=performance.now(),px=x*TILE+16,ground=y*TILE+27;
  const p=step?Math.min(1,Math.max(0,(now-step.start)/step.duration)):0;
  const phase=step?((stepCount-1+p)*.5)%1:0;
  const bob=step?Math.sin(p*Math.PI)*1.15:0;

  const dir=state.facing==='up'?'up':state.facing==='down'?'down':'side';
  ctx.fillStyle='#0008';ctx.beginPath();ctx.ellipse(px,ground,9,3,0,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.translate(px,ground-bob);
  if(state.facing==='left')ctx.scale(-1,1);
  ctx.imageSmoothingEnabled=false;if(now-hurtAt<160)ctx.globalAlpha=.55;
  if(attackCooldown>0&&now-attackStarted<480){
    drawStrike(ctx,Math.max(0,(now-attackStarted)/480),dir,dir==='up'?-Math.PI/2:dir==='down'?Math.PI/2:0);
  }else ctx.drawImage(crawlerPose(dir,Math.round(phase*16)%16),-12,-32,24,32);
  ctx.restore();
}

const guardianThemes={
3:{name:'Pip, Keeper of the Cage',color:'#b5a17b',floor:'#524334',detail:'Iron cage tracks and brass locks',kind:0},
6:{name:'The Brood Matriarch',color:'#a5bd84',floor:'#303c35',detail:'Silken nests and copper relay cables',kind:1},
9:{name:'The Hollow Regent',color:'#91bde0',floor:'#29394c',detail:'Broken mirrors and spectral reflections',kind:2},
12:{name:'The Cinder Inquisitor',color:'#f39b58',floor:'#482d28',detail:'Scorched tribunal tiles and embers',kind:3},
15:{name:'The Iron Magistrate',color:'#c8b0df',floor:'#393344',detail:'Judgment seals and iron chains',kind:4},
18:{name:'The Last Bellkeeper',color:'#e7ce82',floor:'#40382b',detail:'Ancient bell inscriptions and golden resonance',kind:5}
};
const mobHues=[0,0,42,190,270,36,155,75,215,15,245,350,170,205,285,110,320,55];
// Cached original 32x40 pixel silhouettes for the six guardians and floor three wildlife.
const customEnemyArt=new Map();
function customEnemy(e,frame=0){
 const floor=state.floor;
 const kind=e.boss?'guardian-'+floor:floor===3&&!e.chief?(e.sprite==='goblin'?'cage-runner':e.sprite==='sewer-rat'?'ironwhisker':null):null;
 if(!kind||(!['guardian-3','guardian-6','guardian-9','guardian-12','guardian-15','guardian-18','cage-runner','ironwhisker'].includes(kind)))return null;
 const phase=frame%4,key=kind+'/'+phase;if(customEnemyArt.has(key))return customEnemyArt.get(key);
 const c=document.createElement('canvas');c.width=40;c.height=48;const g=c.getContext('2d');
 const R=(x,y,w,h,color)=>{g.fillStyle=color;g.fillRect(x,y,w,h)};
 const P=(points,color)=>{g.fillStyle=color;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill()};
 const dark='#171b23',step=[0,1,0,-1][phase];
 const metal=(x,y,w,h,col,light)=>{R(x-1,y-1,w+2,h+2,dark);R(x,y,w,h,col);R(x+1,y+1,w-2,2,light);R(x+w-2,y+3,1,h-4,'#242c37')};
 if(kind==='ironwhisker'){
 P([[2,32],[8,26],[25,26],[36,31],[37,39],[12,42],[4,37]],dark);
 R(8,29,23,10,'#777c82');metal(13,27,13,8,'#505a66','#b7b9ae');R(27,29,9,8,'#9d8b7b');R(30,27,4,5,'#a99b8a');R(34,32,2,2,'#efb34c');R(4,37,5,2,'#a99b8a');R(10,39+step,5,3,'#555760');R(26,39-step,5,3,'#555760');
 }else if(kind==='guardian-6'){
 for(let i=0;i<4;i++){const y=24+i*4;P([[18,y],[8,y-8+step],[2,y+5],[5,y+7],[11,y-3],[18,y+4]],dark);P([[22,y],[32,y-8-step],[38,y+5],[35,y+7],[29,y-3],[22,y+4]],dark);R(5,y+3,3,2,'#8eaa76');R(32,y+3,3,2,'#8eaa76')}
 P([[12,9],[28,9],[34,21],[29,34],[11,34],[6,21]],dark);P([[14,11],[26,11],[31,21],[27,30],[13,30],[9,21]],'#4c6650');R(16,12,8,13,'#72845e');R(15,27,10,9,'#293c37');for(let i=0;i<3;i++){R(13+i*6,29,3,3,'#e0b85e')}R(16,36,2,6,'#c1cbb1');R(23,36,2,6,'#c1cbb1');
 }else if(kind==='guardian-9'){
 P([[20,3],[32,12],[29,24],[37,43],[25,39],[20,46],[14,39],[4,43],[11,24],[8,12]],dark);
 P([[20,6],[29,13],[25,25],[31,38],[23,35],[20,42],[16,35],[10,39],[15,25],[11,13]],'#44637f');R(15,13,10,10,'#acc6ce');R(16,17,3,2,'#17273f');R(22,17,3,2,'#17273f');P([[11,11],[15,2],[19,9],[23,1],[27,9],[31,5],[29,13]],'#b8ccd5');R(5,26+step,4,9,'#a4dce8');R(32,26-step,4,9,'#a4dce8');
 }else{
 const pip=kind==='guardian-3',runner=kind==='cage-runner',bell=kind==='guardian-18',fire=kind==='guardian-12',mag=kind==='guardian-15';
 const col=pip||runner?'#796d4a':fire?'#803b33':mag?'#65546f':'#86734e',hi=pip||runner?'#c4ad75':fire?'#ee9856':mag?'#c0a4d8':'#e7ce82';
 R(12,34,7,10+step,dark);R(22,34,7,10-step,dark);metal(13,35,5,7+step,col,hi);metal(23,35,5,7-step,col,hi);
 P([[12,18],[28,18],[33,32],[27,38],[13,38],[7,32]],dark);metal(12,20,16,14,col,hi);R(17,23,6,8,'#2b2830');
 metal(9,19,6,12,col,hi);metal(26,19,6,12,col,hi);metal(13,7,14,12,pip||runner?'#738052':col,hi);
 R(15,12,3,2,fire?'#ffd16b':'#edc36d');R(22,12,3,2,fire?'#ffd16b':'#edc36d');R(18,16,4,2,dark);
 if(pip){R(12,3,16,3,hi);R(12,0,3,5,hi);R(19,0,3,5,hi);R(25,0,3,5,hi);metal(2,18,5,23,'#63533e',hi)}
 else if(runner){metal(31,15,3,22,'#65717a','#c1c4b8')}
 else if(fire){for(let i=0;i<3;i++){R(5+i*12,5+(i%2)*3,4,7,'#ad5034');R(6+i*12,3+(i%2)*3,2,5,'#ffb75a')}metal(34,13,3,27,col,hi)}
 else if(mag){metal(2,18,7,18,col,hi);R(3,22,5,2,'#bdb5bf');metal(33,11,4,28,col,hi)}
 else if(bell){P([[31,7],[35,7],[38,18],[39,21],[27,21],[29,18]],hi);R(32,21,2,3,'#b49c64');metal(32,24,3,17,col,hi)}
 }
 customEnemyArt.set(key,c);return c;
}
const floorArtColors=['#727d71','#739e88','#9b8c65','#688ba9','#8c779f','#bc9565','#517f8c','#939c78','#8ea8c6','#b56342','#788d9a','#cf7853','#86a7a3','#a6b8d0','#a18cae','#648f82','#9292a4','#d1b16a'];
function nativeFloorEnemy(e,frame=0){
 if(state.floor<4||e.boss||e.localBoss)return null;
 const key='floor/'+state.floor+'/'+e.sprite+'/'+(frame%4);if(customEnemyArt.has(key))return customEnemyArt.get(key);
 const c=document.createElement('canvas');c.width=40;c.height=48;const g=c.getContext('2d'),col=floorArtColors[state.floor-1],dark='#171b24',light='#c3c4b7',step=[0,1,0,-1][frame%4];
 const R=(x,y,w,h,v)=>{g.fillStyle=v;g.fillRect(x,y,w,h)};
 const P=(p,v)=>{g.fillStyle=v;g.beginPath();p.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill()};
 if(e.sprite==='spider'){
 for(let i=0;i<4;i++){let y=25+i*4;P([[16,y],[7,y-5+step],[1,y+6],[4,y+7],[9,y],[18,y+3]],dark);P([[24,y],[33,y-5-step],[39,y+6],[36,y+7],[31,y],[22,y+3]],dark);R(6,y,4,2,col);R(30,y,4,2,col)}
 P([[11,9],[29,9],[34,22],[27,35],[13,35],[6,22]],dark);P([[13,12],[27,12],[30,22],[25,32],[15,32],[10,22]],col);R(17,14,6,9,light);R(14,29,3,3,'#efc371');R(23,29,3,3,'#efc371');
 }else if(e.sprite==='wraith'){
 P([[20,2],[31,13],[28,24],[38,41],[28,39],[24,46],[18,40],[10,45],[2,39],[12,24],[9,13]],dark);P([[20,5],[28,14],[24,25],[32,38],[23,35],[20,42],[15,36],[8,40],[16,24],[12,14]],col);R(15,13,10,9,'#c2c8c5');R(16,16,3,2,dark);R(22,16,3,2,dark);R(5,24+step,3,7,col);R(32,24-step,3,7,col);
 }else{
 R(11,32,8,13+step,dark);R(22,32,8,13-step,dark);R(13,34,4,9+step,col);R(24,34,4,9-step,col);
 P([[12,16],[28,16],[34,31],[27,36],[13,36],[6,31]],dark);P([[13,19],[27,19],[30,30],[25,33],[15,33],[10,30]],col);R(14,20,12,2,light);R(18,24,4,8,dark);R(12,6,16,13,dark);R(14,8,12,9,e.sprite==='skeleton'?'#c8c3b0':col);R(16,11,3,2,'#e7b85d');R(22,11,3,2,'#e7b85d');
 if(e.sprite==='archer'){P([[31,12],[37,18],[38,28],[32,36],[30,34],[35,27],[34,19]],col);R(31,13,1,22,light);R(22,25,15,1,light)}
 else if(e.sprite==='shaman'){R(32,6,3,34,col);R(30,3,7,7,dark);R(32,4,3,4,'#e6c77b');P([[9,8],[20,0],[31,8]],col)}
 else if(e.sprite==='bone-champion'){R(3,19,10,15,dark);R(5,21,6,11,col);R(7,23,2,7,light);R(33,12,4,26,light)}
 else {R(32,18,3,20,light);R(30,28,7,2,col)}
 }
 // Each floor adds its own insignia, not just a color shift.
 const mark=state.floor%4;
 if(mark===0){R(19,23,2,7,'#f0c97c');R(16,25,8,2,'#f0c97c')}
 if(mark===1){R(17,23,6,2,'#d7c9ad');R(19,25,2,5,'#d7c9ad')}
 if(mark===2){R(16,24,2,5,'#e2ad65');R(22,24,2,5,'#e2ad65')}
 if(mark===3){R(17,24,6,6,'#252b34');R(19,26,2,2,'#c7d5c9')}
 customEnemyArt.set(key,c);return c;
}
function enemyArtFilter(e){
 if(e.boss)return 'hue-rotate('+([0,42,95,320,240,35][Math.floor(state.floor/3)-1]||0)+'deg) saturate(1.25)';
 return state.floor<=2?'none':'hue-rotate('+mobHues[state.floor-1]+'deg) saturate(1.35)';
}
function paintArenaTile(x,y,px,py,seed){
 const theme=guardianThemes[state.floor];if(!theme)return;
 ctx.fillStyle=theme.floor+'bb';ctx.fillRect(px,py,32,32);
 ctx.strokeStyle=theme.color;ctx.globalAlpha=.65;
 const k=theme.kind;
 if(k===0){ctx.fillStyle=theme.color;ctx.fillRect(px+5,py,2,32);ctx.fillRect(px+25,py,2,32);ctx.fillRect(px+5,py+14,22,2)}
 if(k===1){ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+32,py+32);ctx.moveTo(px+32,py);ctx.lineTo(px,py+32);ctx.stroke();ctx.strokeRect(px+8,py+8,16,16)}
 if(k===2){ctx.beginPath();ctx.moveTo(px+16,py+2);ctx.lineTo(px+30,py+16);ctx.lineTo(px+16,py+30);ctx.lineTo(px+2,py+16);ctx.closePath();ctx.stroke()}
 if(k===3){for(let i=0;i<5;i++){ctx.fillStyle=theme.color;ctx.fillRect(px+3+(i*7)%25,py+3+(i*11)%25,2,2)}}
 if(k===4){ctx.strokeRect(px+4,py+4,24,24);ctx.strokeRect(px+10,py+10,12,12)}
 if(k===5){ctx.beginPath();ctx.arc(px+16,py+16,10,0,Math.PI*2);ctx.stroke();ctx.fillStyle=theme.color;ctx.fillRect(px+15,py+8,2,16)}
 ctx.globalAlpha=1;
}
function enemySprite(e){if(e.boss)return e.sprite||'bone-champion';return e.sprite||'skeleton'}
const enemyMotion=new WeakMap();
const mobWalkRows=['sewer-rat','goblin','skeleton','archer','shaman','bone-champion','spider','spider-boss','wraith'];
const mobWalkAtlas=new Image();
mobWalkAtlas.src='mob-walk.png';
function sampleEnemyStep(m,now){
  const t=Math.min(1,Math.max(0,(now-m.start)/m.duration));
  const ease=t*t*(3-2*t);
  return {x:m.fromX+(m.x-m.fromX)*ease,y:m.fromY+(m.y-m.fromY)*ease,phase:m.phase+ease*m.cycles};
}
function drawEnemy(e){
  const now=performance.now(),base=enemySprite(e),rat=base==='sewer-rat',spider=base.includes('spider');
  let m=enemyMotion.get(e);
  if(!m){
    m={x:e.x,y:e.y,fromX:e.x,fromY:e.y,start:now,duration:1,cycles:0,phase:0,facing:1,hp:e.hp,hit:-Infinity};
    enemyMotion.set(e,m);
  }
  let pose=sampleEnemyStep(m,now);
  if(m.x!==e.x||m.y!==e.y){
    const dx=e.x-pose.x,dy=e.y-pose.y,distance=Math.hypot(dx,dy);
    if(e.x!==m.x)m.facing=e.x>m.x?1:-1;
    m.x=e.x;m.y=e.y;m.start=now;
    m.fromX=distance>3?e.x:pose.x;m.fromY=distance>3?e.y:pose.y;
    m.phase=pose.phase%1;
    m.duration=distance>3?1:Math.max(90,Math.min(380,distance*(rat?210:spider?255:290)));
    m.cycles=distance>3?0:distance*(rat?1.5:spider?1:.5);
    pose=sampleEnemyStep(m,now);
  }
  if(e.hp<m.hp)m.hit=now;
  m.hp=e.hp;
  const x=pose.x*TILE+16,y=pose.y*TILE+27;
  const strike=Math.max(0,1-(now-(e.attackAt??-1000))/180);
  const w=e.small?(rat?20:e.boss?28:23):e.boss?54:39,h=e.small?(rat?14:e.boss?31:26):e.boss?53:43;
  ctx.fillStyle='#0009';ctx.beginPath();ctx.ellipse(x,y,w*.26,rat?2:4,0,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.translate(x+(state.x-e.x)*5*strike,y+(state.y-e.y)*5*strike);
  const progress=Math.max(0,Math.min(1,(now-m.start)/m.duration));
  if(!rat)ctx.rotate(.065*Math.sign(m.x-m.fromX)*Math.sin(Math.PI*progress));
  if(rat)ctx.scale(m.facing,1);
  if(now-m.hit<120)ctx.globalAlpha=.55;
  ctx.filter=enemyArtFilter(e);
  const row=mobWalkRows.indexOf(base),frame=Math.floor(pose.phase*12+.5)%12,original=customEnemy(e,frame)||nativeFloorEnemy(e,frame);
  if(original){ctx.filter='none';ctx.drawImage(original,-w/2,-h+3,w,h)}else if(['flood-grub','mire-leprechaun','pack-llama'].includes(base)){
    const wave=Math.sin(pose.phase*2*Math.PI);ctx.scale(m.facing*(1+.055*wave),1-.05*wave);
    spriteDraw(base,0,-2-Math.abs(wave)*1.5,base==='flood-grub'?27:30,base==='flood-grub'?23:32);
  }else if(row>=0&&mobWalkAtlas.complete&&mobWalkAtlas.naturalWidth){
    ctx.drawImage(mobWalkAtlas,frame*64,row*64,64,64,-w/2,-2-h+TILE*.18,w,h);
  }else spriteDraw(base,0,-2,w,h);
  ctx.filter='none';
  if(!original&&state.floor===3&&!e.boss){ctx.fillStyle='#b9aa83';ctx.fillRect(-7,-12,14,2);ctx.fillRect(-5,-17,2,5);ctx.fillRect(5,-17,2,5)}
  if(!original&&e.boss&&state.floor===3){ctx.fillStyle='#bba16b';ctx.fillRect(-10,-19,20,3);ctx.fillRect(-2,-30,4,9);ctx.fillRect(-6,-27,12,3)}
  ctx.restore();
  ctx.fillStyle='#3a1717';ctx.fillRect(x-11,y-26,22,3);
  ctx.fillStyle=e.boss?'#e2a65f':'#d45a55';ctx.fillRect(x-11,y-26,22*Math.max(0,e.hp/e.max),3);
}

const ambientMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const ambientColors=['#c6b08a','#80c5b9','#c1a477','#8fbce1','#a69ac9','#e2a86b','#72b5c5','#c0ba85','#a4c6e8','#f19a58','#a4b8c9','#f2a067','#8dc5bd','#b8d1e8','#c1a7d7','#83bc9c','#a8a8d5','#e6c77a'];
function drawAmbient(camX,camY,zoom,now){
 if(state.chapter!=='mine')return;
 const width=canvas.width/zoom,height=canvas.height/zoom,color=ambientColors[state.floor-1]||ambientColors[0];
 const x0=Math.max(0,Math.floor(camX/TILE)),y0=Math.max(0,Math.floor(camY/TILE));
 const x1=Math.min(W,Math.ceil((camX+width)/TILE)),y1=Math.min(H,Math.ceil((camY+height)/TILE));
 const time=ambientMotion.matches?0:now*.001;
 ctx.save();
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  if(!seen[y]?.[x]||tile(x,y)!==1)continue;
  const seed=((x*73856093^y*19349663^state.floor*83492791)>>>0)%101;
  if(seed>8)continue;
  const px=x*TILE+((seed*7)%24)+4,py=y*TILE+((seed*11)%24)+4;
  const phase=(time*.45+seed*.13)%1;
  ctx.globalAlpha=.12+.3*Math.sin(phase*Math.PI);
  ctx.fillStyle=color;
  if([2,7,13,16].includes(state.floor)){ctx.fillRect(px,py+Math.floor(phase*7),2,3);ctx.fillRect(px-2,py+6,6,1)}
  else if([10,12,18].includes(state.floor)){ctx.fillRect(px+Math.floor(Math.sin(phase*6)*3),py-Math.floor(phase*12),2,2)}
  else{ctx.fillRect(px+Math.floor(Math.sin(phase*6)*4),py-Math.floor(phase*8),2,1)}
 }
 ctx.restore();
}
let cameraX=null,cameraY=null,cameraTime=0;
function draw(){if(state.hall){drawHall();return}ctx.clearRect(0,0,canvas.width,canvas.height);if(visualFloor!==state.floor||visualX===null){visualX=state.x;visualY=state.y;visualFloor=state.floor;cameraX=null}let zoom=fieldZoom;const now=performance.now(),blend=1-Math.exp(-Math.max(0,now-cameraTime)/48);
if(cameraX===null||Math.hypot(visualX-cameraX,visualY-cameraY)>2.5){cameraX=visualX;cameraY=visualY}
else{cameraX+=(visualX-cameraX)*blend;cameraY+=(visualY-cameraY)*blend}
cameraTime=now;
let camX=cameraX*TILE-canvas.width/(2*zoom)+TILE/2,camY=cameraY*TILE-canvas.height/(2*zoom)+TILE/2;ctx.imageSmoothingEnabled=false;ctx.save();ctx.scale(zoom,zoom);ctx.translate(-camX,-camY);for(let y=Math.max(0,Math.floor(camY/TILE)-2);y<Math.min(H,Math.ceil((camY+canvas.height/zoom)/TILE)+2);y++)for(let x=Math.max(0,Math.floor(camX/TILE)-2);x<Math.min(W,Math.ceil((camX+canvas.width/zoom)/TILE)+2);x++){if(!seen[y][x]){ctx.fillStyle='#030609';ctx.fillRect(x*TILE,y*TILE,TILE,TILE)}else drawTile(x,y,tiles[y][x])}
drawRelay();
drawAmbient(camX,camY,zoom,now);
if(sceneryArt.complete&&sceneryArt.naturalWidth)for(const p of state.scenery||[]){
 if(!seen[p.y]?.[p.x])continue;
 ctx.drawImage(sceneryArt,p.art*32,0,32,32,p.x*TILE,p.y*TILE,TILE,TILE);
 if(p.art>=6&&!state.investigated?.includes(p.y*W+p.x)){ctx.fillStyle='#9bd7ce';ctx.fillRect(p.x*TILE+15,p.y*TILE+3,3,3)}
}
for(let e of entities){if(!seen[e.y]?.[e.x])continue;if(e.type==='loot'&&e.alive){ctx.fillStyle=e.droppedBag?'#875b38':'#e4c16a';ctx.fillRect(e.x*TILE+11,e.y*TILE+12,11,10);ctx.fillStyle=e.droppedBag?'#d2ad75':'#fff0b3';ctx.fillRect(e.x*TILE+14,e.y*TILE+10,5,3)}else if(e.type==='enemy'&&e.alive)drawEnemy(e);else if(e.type==='enemy'&&!e.alive&&!e.looted)drawRemains(e)}for(const q of state.sanctuaries||[state.safe].filter(Boolean))drawGuildEntrance(q);if(state.npc&&seen[state.npc.y]?.[state.npc.x]){const n=state.npc,t=Math.min(1,Math.max(0,(performance.now()-(n.walkAt??-1000))/320)),px=(n.fromX??n.x)*(1-t)+n.x*t,py=(n.fromY??n.y)*(1-t)+n.y*t;
 spriteDraw('hero-'+(['side','back'].includes(n.facing)?n.facing:'front'),px*TILE+16,py*TILE+25-Math.sin(t*Math.PI)*2,30,44);ctx.fillStyle='#7ce4df';ctx.font='10px monospace';ctx.fillText(state.floor===1?'ROPE KEEPER':state.floor<=4?'SOUND SALVAGE':'NIGHT SHIFT',state.npc.x*TILE-8,state.npc.y*TILE-24)}if(state.wildAnimal&&seen[state.wildAnimal.y]?.[state.wildAnimal.x])drawAnimal(state.wildAnimal.species,state.wildAnimal.x,state.wildAnimal.y,false);drawHero(visualX,visualY);for(const [id,p] of Object.entries(netPlayers)){if(p.floor!==state.floor||p.hall)continue;const px=p.x*TILE+16,py=p.y*TILE+25;ctx.save();ctx.globalAlpha=.82;ctx.strokeStyle='#65c9d5';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px,py-18,15,0,Math.PI*2);ctx.stroke();ctx.drawImage(crawlerPose('down',0,p.character||{},p.gear||{}),px-12,py-30,24,32);ctx.fillStyle='#a7e6ee';ctx.font='10px monospace';ctx.textAlign='center';ctx.fillText((p.name||'ALLY').slice(0,10),px,py-51);ctx.restore();}
for(let p of particles){let x=p.x*TILE+16,y=p.y*TILE+16;if(p.kind==='pulse'){ctx.strokeStyle='#60c9e2';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,15+p.t*100,0,Math.PI*2);ctx.stroke()}if(p.kind==='magic'||p.kind==='hit'||p.kind==='hurt'){ctx.fillStyle=p.kind==='magic'?'#77d9ee':'#f0a18b';ctx.font='bold 15px monospace';ctx.fillText(p.text||'',x,y-p.t*24)}if(p.kind==='death'||p.kind==='dodge'){ctx.fillStyle=p.kind==='death'?'#d6d8d4':'#9fdbe2';ctx.globalAlpha=Math.max(0,1-p.t*2);ctx.fillRect(x-7,y-7,14,14);ctx.globalAlpha=1}}
ctx.restore();
if(state.chapter==='mine'){
 const sx=(visualX*TILE+16-camX)*zoom,sy=(visualY*TILE+16-camY)*zoom;
 const torch=state.torchTurns>0, flicker=ambientMotion.matches?1:1+.025*Math.sin(now/103)+.012*Math.sin(now/47);
 const radius=Math.max(65,Math.min(canvas.width,canvas.height)*(torch?.83:.58)*flicker);
 const shade=ctx.createRadialGradient(sx,sy,Math.min(32,radius*.2),sx,sy,radius);
 shade.addColorStop(0,torch?'rgba(24,13,5,0)':'rgba(5,9,16,0)');shade.addColorStop(.55,'rgba(4,8,15,.12)');shade.addColorStop(1,'rgba(2,5,12,.79)');
 ctx.fillStyle=shade;ctx.fillRect(0,0,canvas.width,canvas.height);
 if(torch){const warm=ctx.createRadialGradient(sx,sy,0,sx,sy,radius*.72);warm.addColorStop(0,'rgba(255,175,72,.12)');warm.addColorStop(1,'rgba(255,175,72,0)');ctx.fillStyle=warm;ctx.fillRect(0,0,canvas.width,canvas.height)}
}
if(performance.now()-hurtAt<220){ctx.fillStyle='rgba(180,20,25,.15)';ctx.fillRect(0,0,canvas.width,canvas.height)}}
function drawMini(){if(state.hall){
mini.fillStyle='#182222';mini.fillRect(0,0,240,180);mini.fillStyle='#725e48';mini.fillRect(24,25,188,128);
mini.fillStyle='#efc783';mini.fillRect(118,61,7,7);mini.fillStyle='#93cfc3';mini.fillRect(118,143,8,5);
mini.fillStyle='#fff1ba';mini.fillRect(34+state.hall.x*14,21+state.hall.y*15,7,7);return}
let m=$('#minimap'),w=m.width,h=m.height;mini.fillStyle='#070b0f';mini.fillRect(0,0,w,h);let s=Math.min(w/W,h/H);let ox=(w-W*s)/2,oy=(h-H*s)/2;for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!seen[y][x])continue;mini.fillStyle=inArena(x,y)&&tiles[y][x]===1&&(bossFight?.e?.boss||state.guardianRecord?.some(r=>r.floor===state.floor))?'#9d6549':tiles[y][x]===2?'#26323a':tiles[y][x]===3?'#d6a65a':'#655e50';mini.fillRect(ox+x*s,oy+y*s,Math.ceil(s),Math.ceil(s))}for(let e of entities){if(!e.alive||!seen[e.y]?.[e.x])continue;mini.fillStyle=e.type==='loot'?'#d6a65a':'#e34e4b';mini.beginPath();mini.arc(ox+(e.x+.5)*s,oy+(e.y+.5)*s,2.6,0,Math.PI*2);mini.fill()}for(let e of entities.filter(e=>!e.alive&&e.type==='enemy'&&!e.looted)){if(!seen[e.y]?.[e.x])continue;mini.fillStyle='#eee';mini.fillRect(ox+(e.x+.3)*s,oy+(e.y+.3)*s,3,3)}for(let q of state.sanctuaries||[state.safe].filter(Boolean)){if(personalMenusLocked()||seen[q.y]?.[q.x]){mini.fillStyle='#71cfa2';mini.fillRect(ox+(q.x+.5)*s-2,oy+(q.y+.5)*s-2,4,4)}}for(const p of state.scenery||[]){if(!seen[p.y]?.[p.x])continue;mini.fillStyle=p.art<3?'#36363a':p.art<6?'#c58555':'#90d4ca';mini.fillRect(ox+p.x*s,oy+p.y*s,Math.ceil(s),Math.ceil(s))}
if(state.relay?.pinned){mini.fillStyle='#83dcef';mini.fillRect(ox+state.relay.x*s-2,oy+state.relay.y*s-2,5,5)}
mini.fillStyle='#f2d36e';mini.beginPath();mini.arc(ox+(state.x+.5)*s,oy+(state.y+.5)*s,3.5,0,Math.PI*2);mini.fill();for(const p of Object.values(netPlayers)){if(p.floor!==state.floor||p.hall)continue;mini.fillStyle='#65c9d5';mini.beginPath();mini.arc(ox+(p.x+.5)*s,oy+(p.y+.5)*s,3,0,Math.PI*2);mini.fill()}}
function drawFieldMap(){let m=$('#fieldMini');if(m){let c=m.getContext('2d');c.clearRect(0,0,m.width,m.height);c.drawImage($('#minimap'),0,0,m.width,m.height)}}function drawPortrait(){portrait.fillStyle='#0b1117';portrait.fillRect(0,0,96,96);if(state.character){portrait.imageSmoothingEnabled=false;portrait.drawImage(crawlerPose('down',0),12,0,72,96);return}const im=sprites['hero-front'];if(im?.complete&&im.naturalWidth){let h=88,w=h*im.naturalWidth/im.naturalHeight;portrait.drawImage(im,(96-w)/2,4,w,h)}else{portrait.fillStyle='#1c2b36';portrait.fillRect(18,16,60,65)}portrait.strokeStyle='#a98852';portrait.strokeRect(1,1,94,94)}
function renderFeed(){let el=$('#feed');if(!el)return;el.innerHTML=(state.feed||[]).slice(0,9).map(x=>`<div class="feed-line"><span class="time">${x.tm}</span>${x.s}</div>`).join('')||'<div class="feed-line">The dungeon is quiet. For now.</div>'}
function render(){if(!state)return;const hotLabel=$('[data-action="hot"] small');if(hotLabel)hotLabel.textContent=supplies[state.hotItem]?.short||'Hot list';let hud=$('#fieldHud');if(hud)hud.innerHTML=`<div class="field-stat crawler-hud-name">${safeAttr(crawlerTitle())}</div><div class="field-stat">HP ${state.hp}/${state.maxHp} ${conditionText()}<div class="bar hp"><i style="width:${100*state.hp/state.maxHp}%"></i></div></div><div class="field-stat">MP ${state.mp}/${state.maxMp}<div class="bar mp"><i style="width:${100*state.mp/Math.max(1,state.maxMp)}%"></i></div></div><div class="field-stat">LV ${state.level} · XP ${state.xp}/${state.nextXp}</div>`;$('#hpBar').style.width=100*state.hp/state.maxHp+'%';$('#mpBar').style.width=100*state.mp/Math.max(1,state.maxMp)+'%';$('#xpBar').style.width=100*state.xp/state.nextXp+'%';$('#hpText').textContent=`${state.hp}/${state.maxHp}`;$('#mpText').textContent=`${state.mp}/${state.maxMp}`;$('#xpText').textContent=`${state.xp}/${state.nextXp}`;$('#heroLevel').textContent=`LEVEL ${state.level} • ${state.level<4?'NOVICE':state.level<8?'DELVER':'VETERAN'}`;$('#powerStat').textContent=state.power;$('#armorStat').textContent=state.armor;$('#goldStat').textContent=state.gold;$('#depthStat').textContent=state.floor;$('#floorTag').textContent='FLOOR '+String(state.floor).padStart(2,'0');$('#roomName').textContent=names[(state.floor-1)%names.length].toUpperCase();$('#coords').textContent=`X: ${String(state.x).padStart(2,'0')} / Y: ${String(state.y).padStart(2,'0')}`;$('#quickItems').innerHTML=state.inventory.slice(0,4).map(i=>`<button class="quick-slot" data-item="${i.id}" title="${i.name}">${i.icon}<small>${i.qty}</small></button>`).join('');const awardList=$('#achievements'),signature=JSON.stringify([state.achievements,state.achievementPrizes]);if(awardList.dataset.signature!==signature){awardList.dataset.signature=signature;awardList.innerHTML=state.achievements.map(achievementEntry).join('')||'<span class="muted">No accolades yet.</span>';}$('#goals').innerHTML=`<div class="goal"><em>◈</em> Explore the chamber and find the gold stairs.</div><div class="goal"><em>⚔</em> Enemies defeated: ${state.kills}</div><div class="goal"><em>✧</em> Reach floor ${Math.floor(state.floor/3+1)*3} to face the next guardian.</div>`;let b=bossFight?.e;if(partyGuest()&&partyEncounter&&entities[partyEncounter.index]?.boss){b={...partyEncounter,boss:true,alive:partyEncounter.hp>0}}if(b?.boss&&b.alive){$('#bossName').textContent=b.name;$('#bossbar').classList.remove('hidden');$('#bossHp').style.width=100*b.hp/b.max+'%';$('#bossHpText').textContent=`${Math.max(0,b.hp)} / ${b.max}`}else $('#bossbar').classList.add('hidden');const target=interactionTarget();
if(state.pendingPartyDrop){const h=$('#fieldHud');if(h){const line=document.createElement('div');line.className='field-stat';line.textContent='Drop pending · rejoin original party to retry';h.appendChild(line)}}
if(partyGuest()&&partyEncounter){const h=$('#fieldHud');if(h){const line=document.createElement('div');line.className='field-stat';line.textContent='Party encounter · '+partyEncounter.name+' · '+partyEncounter.hp+'/'+partyEncounter.max+' HP · Turn '+partyEncounter.turn+' · Assist '+partyEncounter.assist;h.appendChild(line);partyActionControls(h)}}
for(const button of $$('[data-action="interact"]')){
button.classList.toggle('available',!!target&&!state.dead);
const label=target?.label||'Interact';if(button.title!==label){button.title=label;button.setAttribute('aria-label','Interact: '+label)}
}
document.body.classList.toggle('guild-locked',personalMenusLocked());chapterHUD();draw();drawMini();drawFieldMap();drawPortrait();renderFeed()}
const classBonuses={Vanguard:{maxHp:15,armor:2},Arcanist:{maxMp:20},Reaver:{power:4},Ranger:{power:3,maxHp:8},Alchemist:{maxMp:12,spellBonus:3},Sentinel:{armor:4,maxHp:10}};
const classTraining={Fortitude:['maxHp',10],Bulwark:['armor',2],Reservoir:['maxMp',8],Channeling:['spellBonus',5],Precision:['power',2],Ferocity:['power',3],Marksman:['power',3],Trailcraft:['maxHp',10],Catalyst:['spellBonus',4],'Elixir craft':['maxHp',8],'Iron wall':['armor',2],Retaliation:['power',3]};
function applyClassBonus(name,sign){for(const [k,v] of Object.entries(classBonuses[name]||{})){state[k]=(state[k]||0)+sign*v;if(sign>0&&k==='maxHp')state.hp+=v;if(sign>0&&k==='maxMp')state.mp+=v}}
function trainBranch(n){if(personalMenusLocked()){lockHint();return}if(state.floor<4)return;let ranks=state.branches??={};let rank=ranks[n]||0;if(state.skillPoints<1||rank>=3||!state.specialization)return;let allowed=skillPaths[state.specialization]?.nodes.map(([name])=>name)||[];if(!allowed.includes(n)||(n===allowed[1]&&!(ranks[allowed[0]]>=2)))return;state.skillPoints--;ranks[n]=rank+1;const [stat,amount]=classTraining[n];state[stat]=(state[stat]||0)+amount;if(stat==='maxHp')state.hp+=amount;if(stat==='maxMp')state.mp+=amount;save();render();openTab('skills')}function removeClass(){
const ranks=state.branches||{};
applyClassBonus(state.specialization,-1);for(const [name,rank] of Object.entries(ranks)){const entry=classTraining[name];if(entry)state[entry[0]]=(state[entry[0]]||0)-entry[1]*rank}
state.hp=Math.min(state.hp,state.maxHp);state.mp=Math.min(state.mp,state.maxMp);
state.skillPoints+=Object.values(ranks).reduce((sum,n)=>sum+n,0);state.branches={};state.specialization=null;
}
function chooseClass(n){if(state.identityLocked){notify('Your class is permanent for this campaign.');return}if(personalMenusLocked()){lockHint();return}if(state.floor<4||state.specialization===n||!Object.hasOwn(skillPaths,n))return;
const missingHp=state.maxHp-state.hp,missingMp=state.maxMp-state.mp;if(state.specialization)removeClass();state.specialization=n;applyClassBonus(n,1);state.hp=Math.max(1,state.maxHp-missingHp);state.mp=Math.max(0,state.maxMp-missingMp);save();render();openTab('skills')}function openTab(t){if(personalMenusLocked()){lockHint();return}if(t==='companions'){companionMenu();return}if(t==='skills'){bagSection='skills';backpack();return}if(t==='inventory'){backpack();return}tab=t;$$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));let c=$('#tabContent');if(t==='journal'){c.innerHTML='<div class="panel-title">DUNGEON FEED <span class="muted">LIVE</span></div><div id="feed" class="feed"></div>';renderFeed()}else if(t==='map'){c.innerHTML='<div class="panel-title">CARTOGRAPHER’S MAP</div><p class="feed-line">The map reveals itself as you explore. Red marks living threats; white marks fallen enemies; gold marks your position and the exit.</p><div class="feed-line">Explored tiles: '+seen.flat().filter(Boolean).length+' / '+(W*H)+'</div>'+button('mapNotes','Open field manual');$('#mapNotes').onclick=fieldManual}else if(t==='inventory'){c.innerHTML='<div class="panel-title">CRAWLER INVENTORY</div><div class="equipment-strip">⚔ Weapon • ⬟ Armor</div><div class="item-list inventory-grid">'+state.inventory.map(i=>`<div class="item-row"><span class="ico">${i.icon}</span><div><b>${i.name} ×${i.qty}</b><small>${i.desc}</small></div>${(['tonic','torch','shard'].includes(i.id)||i.id.startsWith('box-')||i.slot)?`<button class="smallbtn" data-use="${i.id}">${i.slot?(state.equipment?.[i.slot]===i.id?'EQUIPPED':'EQUIP'):i.id.startsWith('box-')?'OPEN':'USE'}</button>`:''}</div>`).join('')+'</div>'}else if(t==='party'){c.innerHTML='<div class="panel-title">PRIVATE CRAWLER PARTY</div><p>Connect to a hosted Dungeon Crawler relay to create an invite-only room. This alpha synchronizes party presence and positions; combat and dungeon state are not yet authoritative/shared.</p><div class="item-list"><label>SERVER WSS URL<input id="netEndpoint" class="modal-input" placeholder="wss://your-relay-host.example" value="'+safeAttr(localStorage.getItem('dck-net-url')||'')+'"></label><label>CRAWLER NAME<input id="netName" class="modal-input" maxlength="16" value="'+safeAttr(localStorage.getItem('dck-net-name')||'Crawler')+'"></label><div class="item-row"><button class="smallbtn" id="netCreate">CREATE PRIVATE ROOM</button><button class="smallbtn" id="netJoin">JOIN WITH CODE</button><button class="smallbtn" id="netLeave">LEAVE</button></div><div class="item-row"><span class="ico">♙</span><div><b id="netStatus">'+(window.DCKNet?.connected?'CONNECTED':'SOLO MODE')+'</b><small id="netRoom">'+(window.DCKNet?.roomCode?'ROOM '+window.DCKNet.roomCode:'No active room')+'</small></div><span class="achievement">ALPHA</span></div><div id="netRoster" class="feed-line">Remote crawlers: '+Object.keys(netPlayers).length+'</div></div><p>Use a secure WSS address for public hosting. Room codes are private invite codes, not user accounts or strong authentication.</p>'}}
function modalOpen(){return !$('#modal').classList.contains('hidden')}
function strideDuration(){return runPointer!==null||keys.shift?RUN_MS:WALK_MS}
function updatePace(){
  const duration=strideDuration();
  if(step&&duration!==step.duration&&pauseStarted===null){
    const now=performance.now();
    step.start=now-Math.min(1,Math.max(0,(now-step.start)/step.duration))*duration;
    step.duration=duration;
  }
  $('#runButton').setAttribute('aria-pressed',String(duration===RUN_MS));
}
function resetStick(){
  stickPointer=null;joyX=joyY=0;joystickAxis=null;
  $('#joyKnob').style.transform='';
}
function clearMovement(){
  resetStick();runPointer=null;keys={};updatePace();clearInterval(touchMove);
}
function bindMovementControls(){
  const joy=$('#joystick'),run=$('#runButton'),knob=$('#joyKnob');
  const blocked=()=>pauseStarted!==null||bossFight||state.dead||modalOpen()||
    $('#audioPanel').open||document.body.classList.contains('status-open');
  function steer(point){
    const b=joy.getBoundingClientRect(),x=point.clientX-b.left-b.width/2,y=point.clientY-b.top-b.height/2;
    const d=Math.hypot(x,y),travel=Math.max(0,(Math.min(b.width,b.height)-knob.offsetWidth)/2);
    const scale=Math.min(1,travel/Math.max(1,d));
    knob.style.transform='translate('+x*scale+'px,'+y*scale+'px)';
    if(d<=6){joyX=joyY=0;joystickAxis=null;return}
    const horizontal=Math.abs(x),vertical=Math.abs(y);
    if(joystickAxis==='x'&&vertical>horizontal*1.25)joystickAxis='y';
    else if(joystickAxis==='y'&&horizontal>vertical*1.25)joystickAxis='x';
    else if(!joystickAxis)joystickAxis=horizontal>=vertical?'x':'y';
    joyX=joystickAxis==='x'?Math.sign(x):0;joyY=joystickAxis==='y'?Math.sign(y):0;
    const now=performance.now();
    if(step&&joyX===step.x-step.nx&&joyY===step.y-step.ny){
      const p=Math.min(1,Math.max(0,(now-step.start)/step.duration));
      [step.x,step.nx]=[step.nx,step.x];[step.y,step.ny]=[step.ny,step.y];
      step.start=now-(1-p)*step.duration;step.returning=!step.returning;
      state.facing=joyX<0?'left':joyX>0?'right':joyY<0?'up':'down';
    }
    if(!step)move(joyX,joyY,now);
  }
  const nativeTouch='ontouchstart' in window;
  for(const control of [joy,run]){
    const isStick=control===joy;
    const owner=()=>isStick?stickPointer:runPointer;
    function start(id,point){
      if(blocked()||owner()!==null)return false;
      if(isStick){stickPointer=id;steer(point)}else{runPointer=id;updatePace()}
      return true;
    }
    function release(id){
      if(id!==owner())return;
      if(isStick)resetStick();else{runPointer=null;updatePace()}
    }
    if(nativeTouch){
      // A touch keeps its original target even after the thumb slides off the pad.
      const options={passive:false};
      control.addEventListener('touchstart',e=>{
        e.preventDefault();
        if(owner()!==null&&!Array.from(e.touches).some(t=>'t'+t.identifier===owner()))release(owner());
        const t=e.changedTouches[0];if(t)start('t'+t.identifier,t);
      },options);
      control.addEventListener('touchmove',e=>{
        e.preventDefault();
        const t=Array.from(e.changedTouches).find(t=>'t'+t.identifier===owner());
        if(t&&isStick){if(blocked())resetStick();else steer(t)}
      },options);
      for(const name of ['touchend','touchcancel'])window.addEventListener(name,e=>{
        if(typeof owner()==='string'&&owner().startsWith('t')&&
           !Array.from(e.touches).some(t=>'t'+t.identifier===owner()))release(owner());
      },true);
    }
    control.addEventListener('pointerdown',e=>{
      if((nativeTouch&&e.pointerType==='touch')||e.button!==0)return;
      if(start('p'+e.pointerId,e)){
        e.preventDefault();
        try{control.setPointerCapture(e.pointerId)}catch{} // Window listeners also track this drag.
      }
    });
    window.addEventListener('pointermove',e=>{
      if(!isStick||owner()!=='p'+e.pointerId)return;
      if(blocked()||e.buttons===0)release(owner());else steer(e);
    },true);
    for(const name of ['pointerup','pointercancel'])window.addEventListener(name,e=>release('p'+e.pointerId),true);
    control.addEventListener('lostpointercapture',e=>release('p'+e.pointerId));
    control.addEventListener('contextmenu',e=>e.preventDefault());
  }
}
function showModal(html){clearMovement();step=null;$('#modalBody').innerHTML=html;$('#modal').classList.remove('hidden')}function closeModal(){
if(activeLoot){if(!activeLoot.owner)finishLoot();return}
if(remoteLoot){if(remoteLoot.owner===window.DCKNet.playerId)window.DCKNet.sendIntent('loot_close');return}
if(state.chapter==='create')return;if(state.floor>=4&&state.hall&&!state.identityLocked&&!state.dead){guildIdentity();return}if(bossFight&&!state.dead)return;$('#modal').classList.add('hidden')}
let fieldZoom=2;
function sizePlayfield(){
  if(window.matchMedia('(max-width:1100px)').matches){
    const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
    const density=Math.min(2,window.devicePixelRatio||1);
    const width=Math.round(w*density),height=Math.round(h*density);
    if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
    fieldZoom=density*(h<330?1.05:1.25);
  }else{
    if(canvas.width!==960)canvas.width=960;if(canvas.height!==600)canvas.height=600;fieldZoom=2;
  }
}
function bind(){
  for(const id of ['campaignPanel','companionPanel']){
    const dialog=document.getElementById(id);
    dialog.onclose=resumeInspectionClock;
    dialog.querySelector('[data-dismiss]').onclick=()=>dialog.close();
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-campaign-menu]'))campaignMenu()});

sizePlayfield();new ResizeObserver(sizePlayfield).observe($('.canvas-wrap'));
bindMovementControls();
const status=$('#mobileStatus');status.onclick=()=>{if(personalMenusLocked()){lockHint();return}clearMovement();document.body.classList.add('status-open')};
$('#statusClose').onclick=()=>document.body.classList.remove('status-open');
let field=document.createElement('div');field.className='field-map';field.innerHTML='<canvas width="240" height="180" id="fieldMini"></canvas>';$('.canvas-wrap').appendChild(field);window.addEventListener('blur',clearMovement);
window.addEventListener('pagehide',clearMovement);
$('#soundBtn').addEventListener('click',clearMovement);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearMovement()});
document.addEventListener('keydown',e=>{
if($('#audioPanel').open||pauseStarted!==null||modalOpen()||document.body.classList.contains('status-open')||e.target instanceof Element&&e.target.closest('input,textarea,select,[contenteditable]'))return;
if(e.target instanceof Element&&e.target.closest('button')&&[' ','Enter'].includes(e.key))return;
let k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();keys[k]=true;if(k==='shift')updatePace();if(k===' '||k==='j')attack();if(k==='e'&&!e.repeat)interact();if(k==='x'&&!e.repeat)hotUse();if(k==='f')loot();if(k==='w'||k==='arrowup')move(0,-1);if(k==='s'||k==='arrowdown')move(0,1);if(k==='a'||k==='arrowleft')move(-1,0);if(k==='d'||k==='arrowright')move(1,0);});document.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;if(e.key==='Shift')updatePace()});$$('[data-move]').forEach(b=>{let fn=()=>{let d=b.dataset.move;move(d==='left'?-1:d==='right'?1:0,d==='up'?-1:d==='down'?1:0)};b.addEventListener('pointerdown',e=>{e.preventDefault();fn();touchMove=setInterval(fn,150)});['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,()=>clearInterval(touchMove)))});$$('[data-action]').forEach(b=>b.addEventListener('click',()=>action(b.dataset.action)));$$('[data-tab]').forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.tab)));$('#tabContent').addEventListener('click',e=>{let u=e.target.closest('[data-use]');if(u)inspectOwned(state.inventory.find(i=>i.id===u.dataset.use));let a=e.target.closest('[data-action]');if(a)action(a.dataset.action);if(e.target.id==='netCreate'||e.target.id==='netJoin'){if(state.chapter==='surface'||state.chapter==='create'){notify('Descend into the mine to join a party.');return}const endpoint=$('#netEndpoint')?.value.trim(),name=($('#netName')?.value.trim()||'Crawler').slice(0,16);if(!endpoint){notify('Enter your hosted WSS server URL first.');return}localStorage.setItem('dck-net-url',endpoint);localStorage.setItem('dck-net-name',name);const btn=e.target;btn.disabled=true;window.DCKNet.connect(endpoint,name).then(()=>e.target.id==='netCreate'?window.DCKNet.createRoom():window.DCKNet.joinRoom(prompt('Enter your 6-character party code:')||'')).then(()=>{notify('PARTY CONNECTED');openTab('party')}).catch(err=>notify('CO-OP: '+err.message)).finally(()=>{btn.disabled=false})}if(e.target.id==='netLeave'){window.DCKNet?.leave();netPlayers={};openTab('party')}});$('#quickItems').addEventListener('click',e=>{let b=e.target.closest('[data-item]');if(b)inspectOwned(state.inventory.find(i=>i.id===b.dataset.item))});$('#saveBtn').onclick=campaignMenu;window.startDungeonAudio({
  context:()=>audio??=new(window.AudioContext||window.webkitAudioContext)(),
  scene:()=>state.hall?'hall':bossFight?'fight':'dungeon',
  setEffects:enabled=>{sound=enabled}
});$('#newRun').onclick=campaignMenu;$('#modalClose').onclick=closeModal;$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});window.addEventListener('beforeunload',save);}
function storageMenu(q){state.storage??=[];let available=state.inventory.filter(i=>i.qty>0&&state.equipment?.[i.slot]!==i.id);showModal('<h2>CRAWLER LOCKER</h2><p>Shared across sanctuaries and floors.</p><h3>Deposit</h3>'+available.map((i,n)=>'<button class="widebtn" data-deposit="'+n+'">'+safeAttr(i.name)+' ×'+i.qty+'</button>').join('')+'<h3>Withdraw</h3>'+state.storage.map((i,n)=>'<button class="widebtn" data-withdraw="'+n+'">'+safeAttr(i.name)+' ×'+i.qty+'</button>').join('')+'<button class="widebtn" id="storageBack">BACK</button>');let transfer=(from,to,item)=>{if(!item||item.qty<1)return;let existing=to.find(i=>i.id===item.id);if(existing)existing.qty++;else to.push({...item,qty:1});item.qty--;if(!item.qty)from.splice(from.indexOf(item),1);save();storageMenu(q)};$$('[data-deposit]').forEach(b=>b.onclick=()=>{const i=available[Number(b.dataset.deposit)];inspectItem(i,"Deposit",()=>transfer(state.inventory,state.storage,i))});$$('[data-withdraw]').forEach(b=>b.onclick=()=>{const i=state.storage[Number(b.dataset.withdraw)];inspectItem(i,"Withdraw",()=>transfer(state.storage,state.inventory,i))});$('#storageBack').onclick=()=>sanctuaryMenu(q)}function sanctuaryMenu(q){showModal('<h2>SANCTUARY</h2><p>Protected quarters • Gold: '+state.gold+'</p><button class="widebtn" id="restSafe">'+(q.rested?'BED — USED':'REST AT BED')+'</button><button class="widebtn" id="buySafe">MERCHANT: TONIC — 15 GOLD</button><button class="widebtn" id="stashSafe">'+(q.cache?'STORAGE — EMPTY':'OPEN SUPPLY CHEST')+'</button><button class="widebtn" id="lockerSafe">PERSONAL STORAGE</button><button class="widebtn" id="leaveSafe">RETURN</button>');$('#restSafe').onclick=()=>{if(!q.rested){q.rested=true;restoreHealth(state.maxHp);state.mp=state.maxMp;unlock('Safe harbor');save();render()}sanctuaryMenu(q)};$('#buySafe').onclick=()=>{if(state.gold>=15){state.gold-=15;giveItem('tonic',1);save();render()}sanctuaryMenu(q)};$('#stashSafe').onclick=()=>{if(q.cache)return;const nearby=nearbyContainers(state);if(!nearby.some(c=>c.source===q)){notify('Move closer to the supply chest.');return}if(partyGuest()){closeModal();window.DCKNet.sendIntent('loot')}else startLoot(nearby,null)};$('#lockerSafe').onclick=()=>storageMenu(q);$('#leaveSafe').onclick=closeModal}function giveItem(id,n){let i=state.inventory.find(v=>v.id===id);if(i)i.qty+=n;else{let names={tonic:'Health tonic',torch:'Torch',shard:'Mana shard'};state.inventory.push({id,name:supplies[id]?.name||names[id]||id,icon:supplies[id]?.icon||'✦',qty:n,desc:supplies[id]?.desc||'Dungeon supply'})}}let bagPage=0, activeLoot=null, remoteLoot=null, lootSignature='';
const lootNames={'meth-cargo':'Sealed meth cargo','box-Bronze':'Bronze loot box',gold:'Gold coins',tonic:'Health tonic',torch:'Torch',shard:'Mana shard'};
const lootIcons={'meth-cargo':'▣','box-Bronze':'🎁',gold:'◉',tonic:'🧪',torch:'🔥',shard:'🔷'};
let outfitAngle=0;
function outfitPanel(){
  const slots=[['weapon','Weapon','Unarmed'],['armor','Armor','Everyday clothes'],['charm','Charm','None']];
  const rows=slots.map(([slot,label,empty])=>{
    const item=state.inventory.find(i=>i.id===state.equipment?.[slot]);
    return '<dt>'+label+'</dt><dd>'+safeAttr(item?.name||empty)+'</dd>';
  }).join('');
  return '<section class="bag-outfit" aria-label="Equipped outfit"><button id="turnOutfit" aria-label="Rotate your crawler"><canvas id="bagCrawler" width="96" height="128"></canvas><small>↻ Rotate</small></button><dl><dt>Crawler</dt><dd>'+safeAttr(crawlerTitle())+'</dd>'+rows+'</dl></section>';
}
function drawOutfit(){
  const canvas=$('#bagCrawler'),g=canvas.getContext('2d');
  const dirs=['down','side','up','side'];
  g.clearRect(0,0,96,128);g.imageSmoothingEnabled=false;g.save();
  if(outfitAngle===3){g.translate(96,0);g.scale(-1,1)}
  g.drawImage(crawlerPose(dirs[outfitAngle],0),0,0,96,128);g.restore();
}
const skillPaths={
  Vanguard:{bonus:'+15 maximum health · +2 armor',nodes:[['Fortitude','+10 maximum health'],['Bulwark','+2 armor']]},
  Arcanist:{bonus:'+20 maximum mana · unlock Mend',nodes:[['Reservoir','+8 maximum mana'],['Channeling','+5 spell bonus']]},
  Reaver:{bonus:'+4 power',nodes:[['Precision','+2 power'],['Ferocity','+3 power']]},
  Ranger:{bonus:'+3 power · +8 HP',nodes:[['Marksman','+3 power'],['Trailcraft','+10 maximum health']]},
  Alchemist:{bonus:'+12 MP · +3 spell damage',nodes:[['Catalyst','+4 spell bonus'],['Elixir craft','+8 maximum health']]},
  Sentinel:{bonus:'+4 armor · +10 HP',nodes:[['Iron wall','+2 armor'],['Retaliation','+3 power']]}
};
const subclasses={
 Vanguard:[['Aegis','armor',5],['Juggernaut','maxHp',35]],
 Arcanist:[['Stormcaller','spellBonus',9],['Mana Sage','maxMp',35]],
 Reaver:[['Executioner','power',9],['Blood Knight','maxHp',30]],
 Ranger:[['Deadeye','power',8],['Pathfinder','maxHp',30]],
 Alchemist:[['Transmuter','spellBonus',8],['Field Medic','maxHp',30]],
 Sentinel:[['Bulwark Commander','armor',6],['Avenger','power',8]]
};
function chooseSubclass(index){
 const options=subclasses[state.specialization],entry=options?.[index];
 if(!entry||state.subclass||!state.identityLocked||state.floor<8||state.skillPoints<2)return;
 const nodes=skillPaths[state.specialization].nodes;
 if(nodes.some(([name])=>(state.branches?.[name]||0)<2))return;
 const [name,stat,bonus]=entry;state.skillPoints-=2;state.subclass=name;state[stat]=(state[stat]||0)+bonus;
 if(stat==='maxHp')state.hp+=bonus;if(stat==='maxMp')state.mp+=bonus;
 openPaths.add('Advanced subclass');persistCampaign();render();backpack();
}
const racialPaths={
 Human:[['Adaptability','power',2],['Survivor','maxHp',10]],
 Elf:[['Moon reserve','maxMp',8],['Arcane affinity','spellBonus',4]],
 Dwarf:[['Stone skin','armor',2],['Deep endurance','maxHp',12]],
 Cat:[['Sharp claws','power',3],['Nine lives','maxHp',10]],
 Dog:[['Pack strength','power',2],['Iron loyalty','maxHp',15]],
 'Mutant Crab':[['Shell plating','armor',3],['Crusher claw','power',4]],
 Wizard:[['Mana well','maxMp',12],['Runic mastery','spellBonus',5]],
 Zombie:[['Undead vigor','maxHp',15],['Grave strength','power',3]]
};
const racialMoves={Human:['Last Stand',6,0],Elf:['Moonbolt',7,1],Dwarf:['Stonebreaker',6,0],Cat:['Razor Pounce',5,0],Dog:['Pack Charge',6,0],'Mutant Crab':['Pincer Crush',7,0],Wizard:['Runic Flare',8,1],Zombie:['Grave Strike',6,0]};
function trainRace(index){
 const path=racialPaths[state.character?.race],ranks=state.racialRanks??=[0,0];
 if(!state.identityLocked||!path||![0,1].includes(index)||state.skillPoints<1||ranks[index]>=3||(index===1&&ranks[0]<2))return;
 const [name,stat,amount]=path[index];state.skillPoints--;ranks[index]++;
 state[stat]=(state[stat]||0)+amount;if(stat==='maxHp')state.hp+=amount;if(stat==='maxMp')state.mp+=amount;
 openPaths.add('Racial abilities');persistCampaign();render();backpack();
}
const openPaths=new Set(['Foundations']);
function skillsPanel(){
  const points=state.skillPoints;
  const node=(name,info,control)=>'<div class="skill-node"><div><b>'+name+'</b><small>'+info+'</small></div>'+control+'</div>';
  const limb=(name,info,nodes)=>'<details class="skill-limb" data-path="'+name+'" '+(openPaths.has(name)?'open':'')+'><summary>'+name+'<small>'+info+'</small></summary><div class="skill-stem">'+nodes+'</div></details>';
  const cost=(attr,disabled=false)=>'<button class="smallbtn" '+attr+' '+(!points||disabled?'disabled':'')+'>Train · 1 SP</button>';
  let html='<div class="skill-tree"><div class="skill-root">Skill tree <b>'+points+' SP available</b></div>';
  html+=limb('Foundations','All crawlers',node('Weapon mastery','+2 power',cost('data-up="power"'))+node('Iron constitution','+15 maximum health · +1 armor',cost('data-up="armor"')));
  for(const [name,path] of Object.entries(skillPaths)){
    const active=state.specialization===name,locked=state.floor<4;
    let nodes=node(name,path.bonus,active?'':locked||state.identityLocked?'':'<button class="smallbtn" data-class="'+name+'">Choose class</button>');
    for(const [i,[skill,effect]] of path.nodes.entries()){
      const rank=active?(state.branches?.[skill]||0):0,requires=i&&(!active||(state.branches?.[path.nodes[0][0]]||0)<2);
      nodes+=node(skill+' · '+rank+'/3',effect+' per rank'+(requires?' · Requires '+path.nodes[0][0]+' 2/3':''),rank===3?'':cost('data-branch="'+skill+'"',!active||locked||requires));
    }
    html+=limb(name,locked?'Unlocks on Floor 4':active?'Active class':'Class path',nodes);
  }
  const options=subclasses[state.specialization];
  if(state.identityLocked&&options){
    const available=state.floor>=8&&skillPaths[state.specialization].nodes.every(([n])=>(state.branches?.[n]||0)>=2);
    html+=limb('Advanced subclass','Floor 8 · Both class skills rank 2 · 2 SP',options.map(([name,stat,bonus],i)=>node(name,'+'+bonus+' '+({maxHp:'maximum HP',maxMp:'maximum MP',spellBonus:'spell damage'}[stat]||stat),state.subclass?(state.subclass===name?'Selected':'Locked'):'<button class="smallbtn" data-subclass="'+i+'" '+(!available||points<2?'disabled':'')+'>Choose · 2 SP</button>')).join(''));
  }
  const race=state.character?.race,path=racialPaths[race],ranks=state.racialRanks||[0,0];
  if(state.identityLocked&&path){html+=limb('Racial abilities',race,path.map(([name,stat,amount],i)=>node(name+' · '+ranks[i]+'/3','+'+amount+' '+({maxHp:'maximum HP',maxMp:'maximum MP',spellBonus:'spell damage'}[stat]||stat)+' per rank'+(i?' · requires first skill at rank 2':''),ranks[i]>=3?'':cost('data-racial="'+i+'"',i===1&&ranks[0]<2))).join('')+node(racialMoves[race][0],'Unlocks at racial second skill rank 2',''))}
  return html+spellLoadoutPanel()+'</div>';
}
let bagSection='general';
const POCKET_SIZE=12;
function backpack(){
  if(personalMenusLocked()){lockHint();return}
  if(state.dead||bossFight||activeLoot||remoteLoot||state.chapter==='create')return;
  const count=item=>item.qty-(bagSection!=='trade'&&state.equipment?.[item.slot]===item.id?1:0);
  const boxes=bagSection==='boxes';
  const trading=bagSection==='trade';
  const items=trading?(state.tradeInventory||[]).filter(i=>i.qty>0):state.inventory.filter(item=>count(item)>0&&item.id.startsWith('box-')===boxes);
  const pages=Math.max(1,Math.ceil(items.length/POCKET_SIZE));
  bagPage=Math.min(bagPage,pages-1);
  const entries=items.slice(bagPage*POCKET_SIZE,(bagPage+1)*POCKET_SIZE);
  const hotName=supplies[state.hotItem]?.short||'Choose item';
  const picture=item=>'<img class="pack-icon" alt="" src="item-art.svg#'+itemArt(item)+'">';
  const slots=entries.map((item,i)=>'<button class="bag-slot rank-'+Math.min(5,item.rank||1)+'" data-slot="'+i+'" title="'+safeAttr(item.name)+'">'+picture(item)+'<span>'+safeAttr(item.name)+'</span><small>×'+count(item)+'</small></button>');
  while(slots.length<POCKET_SIZE)slots.push('<div class="bag-slot empty" aria-hidden="true"></div>');
  const sections=['general','equipped','boxes','trade','skills'].map(id=>'<button data-bag-section="'+id+'" aria-pressed="'+(bagSection===id)+'">'+(id==='boxes'?'Loot boxes':id==='trade'?'For sale':id)+'</button>').join('');
  const statLine='<div class="bag-stats">'+(conditionText()?'<span>'+conditionText()+'</span>':'')+'<span>HP '+state.hp+'/'+state.maxHp+'</span><span>MP '+state.mp+'/'+state.maxMp+'</span><span>Level '+state.level+'</span><span>Power '+state.power+'</span><span>Armor '+state.armor+'</span><span>Gold '+state.gold+'</span><span>XP '+state.xp+'/'+state.nextXp+'</span><span>Spell bonus '+(state.spellBonus||0)+'</span>'+(state.pet?'<span>'+safeAttr(state.pet.name||animalNames[state.pet.species])+(state.pet.crawler?' · Crawler Lv '+state.pet.level:' · Pet')+'</span>':'')+(state.teaPower?'<span>Tea +'+state.teaPower+' power this floor</span>':'')+'</div>';
  let body;
  if(bagSection==='skills')body=skillsPanel()+(canMend()?'<button class="widebtn" id="bagMend">Mend · 8 MP</button>':'');
  else if(bagSection==='equipped'){
    body='<div class="gear-board">'+outfitPanel()+'<div class="gear-sockets">'+['weapon','armor','charm'].map(slot=>{
      const item=state.inventory.find(i=>i.id===state.equipment?.[slot]);
      const fallback={weapon:'Unarmed',armor:'Everyday clothes',charm:'Empty'};
      const symbol={weapon:'⚔',armor:'⬟',charm:'◇'};
      return '<button class="gear-socket" data-gear="'+slot+'">'+(item?picture(item):'<i>'+symbol[slot]+'</i>')+'<span><small>'+slot+'</small><b>'+safeAttr(item?.name||fallback[slot])+'</b></span></button>';
    }).join('')+'</div></div>';
  }else{
    body='<div class="bag-grid">'+slots.join('')+'</div><div class="bag-nav">'+(boxes?'':'<button id="bagHot">X · '+hotName+'</button>')+'<button id="bagPrev" aria-label="Previous pocket" '+(!bagPage?'disabled':'')+'>‹</button><span>Pocket '+(bagPage+1)+' / '+pages+'</span><button id="bagNext" aria-label="Next pocket" '+(bagPage+1>=pages?'disabled':'')+'>›</button></div><div id="bagDetail" aria-live="polite">'+(items.length?'':boxes?'No unopened loot boxes.':'No loose items in your backpack.')+'</div>';
  }
  showModal('<div class="bag-layout rpg-pack" data-section="'+bagSection+'"><h2>Backpack</h2>'+(bagSection==='equipped'?'':outfitPanel())+statLine+'<nav class="bag-sections" aria-label="Backpack sections">'+sections+'</nav><div class="bag-section-body">'+body+'</div></div>');
  drawOutfit();$('#turnOutfit').onclick=()=>{outfitAngle=(outfitAngle+1)%4;drawOutfit()};
  $$('[data-bag-section]').forEach(button=>button.onclick=()=>{bagSection=button.dataset.bagSection;bagPage=0;backpack()});
  $$('[data-gear]').forEach(button=>button.onclick=()=>{
    const slot=button.dataset.gear,current=state.inventory.find(i=>i.id===state.equipment?.[slot]);
    if(current){inspectOwned(current);return}
    const choices=state.inventory.filter(i=>i.slot===slot&&i.qty>0);
    showModal('<h2>Equip '+slot+'</h2>'+choices.map((item,i)=>'<button class="widebtn" data-choice="'+i+'">'+picture(item)+safeAttr(item.name)+'</button>').join('')+(choices.length?'':'<p>No '+slot+' items in your backpack.</p>')+'<button id="gearBack" class="widebtn">Back to equipment</button>');
    $('#gearBack').onclick=backpack;
    $$('[data-choice]').forEach(b=>b.onclick=()=>inspectOwned(choices[Number(b.dataset.choice)]));
  });
  if(bagSection==='skills'){
    $('[data-subclass]').forEach(b=>b.onclick=()=>chooseSubclass(Number(b.dataset.subclass)));
    $('[data-racial]').forEach(b=>b.onclick=()=>trainRace(Number(b.dataset.racial)));
    for(const limb of $$('[data-path]'))limb.ontoggle=()=>{if(!limb.isConnected)return;if(limb.open)openPaths.add(limb.dataset.path);else openPaths.delete(limb.dataset.path)};
    for(const b of $$('[data-prepare]'))b.onclick=()=>{
      const id=b.dataset.prepare,ready=prepared();if(!learned(id))return;
      if(ready.includes(id))state.spellLoadout=ready.filter(v=>v!==id);
      else if(ready.length<3)state.spellLoadout=[...ready,id];else return;
      openPaths.add('Spells');persistCampaign();backpack();
    };
    if($('#bagMend'))$('#bagMend').onclick=()=>{if(mend()){persistCampaign();render();backpack()}else notify('Mend requires injury and 8 mana.')};
    $$('[data-up]').forEach(button=>{button.disabled=state.skillPoints<1;button.onclick=()=>{
      if(state.skillPoints<1)return;
      state.skillPoints--;if(button.dataset.up==='power')state.power+=2;else{state.maxHp+=15;state.armor++}
      feed('You train your '+button.dataset.up+'.');persistCampaign();render();backpack();
    }});
  }
  if(bagSection!=='general'&&!boxes&&!trading)return;
  if(!boxes)$('#bagHot').onclick=chooseHot;
  $('#bagPrev').onclick=()=>{bagPage--;backpack()};
  $('#bagNext').onclick=()=>{bagPage++;backpack()};
  $$('[data-slot]').forEach(button=>button.onclick=()=>{
    const item=entries[Number(button.dataset.slot)];
    if(trading){inspectItem(item,'Return to backpack',()=>{moveStack(state.tradeInventory,state.inventory,item,item.qty);persistCampaign();render();backpack()});return}
    inspectOwned(item,true);
  });
}
const LOOT_RADIUS=3;
function nearbyContainers(player){
  const nearby=[];
  function add(source,name,index,x,y){
    const distance=Math.hypot(x-player.x,y-player.y);
    if(distance<=LOOT_RADIUS)nearby.push({source,name,index,distance});
  }
  if(!player.hall)entities.forEach((e,i)=>{
    if(!e.looted&&((e.type==='enemy'&&!e.alive)||(e.type==='loot'&&e.alive)))add(e,e.name||'Dungeon cache',i,e.x,e.y);
  });
  (state.sanctuaries||[]).forEach((q,i)=>{
    if((!player.hall||player.hall.index===i)&&q.room&&!q.cache)add(q,'Sanctuary supply chest',-1-i,q.room.x+3,q.room.y);
  });
  return nearby.sort((a,b)=>a.distance-b.distance);
}
function startLoot(containers,owner){
  const rows=[];
  for(const {source,name,index} of containers){
    source.contents??=index<0?[{id:'box-Bronze',qty:1}]:[{id:'gold',qty:5+Math.floor(Math.random()*10)},{id:Math.random()<.5?'tonic':'torch',qty:1}];
    for(const item of source.contents)rows.push({...item,itemName:item.name,index,name,key:String(rows.length)});
  }
  if(!rows.length)return;
  activeLoot={owner,name:'Nearby loot',rows,sessionId:Math.random().toString(36).slice(2,10)};
  persistCampaign();drawLoot(activeLoot,!owner);sendPartyWorld();
}
function drawLoot(session,canTake){
  let lastIndex=null;
  const rows=session.rows.map(row=>{
    let heading=lastIndex===row.index?'':'<h3>'+safeAttr(row.name||session.name)+'</h3>';
    lastIndex=row.index;
    return heading+'<button class="loot-row" data-take="'+safeAttr(row.key??row.id)+'" '+(canTake?'':'disabled')+'><b>'+safeAttr(row.icon||lootIcons[row.id]||'✦')+'</b><span>'+safeAttr(lootNames[row.id]||row.itemName||row.id)+'</span><span>×'+Number(row.qty)+'</span></button>';
  }).join('');
  showModal('<small>GAME PAUSED</small><h2>Nearby loot</h2><p>'+(canTake?'Choose items from bodies and chests within three tiles.':'A party member is searching nearby containers.')+'</p><div class="loot-pocket">'+rows+'</div>'+(canTake?'<div class="bag-nav"><button id="takeAll">Take all</button><button id="leaveLoot">Leave</button></div>':''));
  if(!canTake)return;
  const take=id=>partyGuest()?window.DCKNet.sendIntent('take_'+(session.sessionId?session.sessionId+'_':'')+id):transferLoot(id);
  $$('[data-take]').forEach(b=>b.onclick=()=>{
    const row=session.rows.find(r=>String(r.key??r.id)===b.dataset.take);
    if(!row)return;
    const desc={gold:'Currency accepted by sanctuary merchants.',tonic:'Drink to recover health.',torch:'Lights nearby dungeon tiles.',shard:'Restores mana.','box-Bronze':'Open from your backpack for a random reward.'};
    inspectItem({id:row.id,name:lootNames[row.id]||row.itemName||row.id,desc:row.desc||supplies[row.id]?.desc||desc[row.id]},'Take ×'+row.qty,()=>take(b.dataset.take));
  });
  $('#takeAll').onclick=()=>take('all');$('#leaveLoot').onclick=closeModal;
}
function finishLoot(){
  activeLoot=null;remoteLoot=null;lootSignature='';last=0;
  $('#modal').classList.add('hidden');persistCampaign();sendPartyWorld();render();
}
function canonicalDrop(id,qty){
 if(typeof id!=='string'||!Number.isSafeInteger(qty)||qty<1||qty>9999)return null;
 if(Object.hasOwn(supplies,id))return {id,...supplies[id],qty};
 if(id==='shard')return {id,name:'Mana shard',icon:'✦',qty};
 if(/^box-(Bronze|Silver|Gold|Legendary|Celestial|Pet)$/.test(id))return {id,name:id.slice(4)+' loot box',icon:'🎁',qty,desc:'Open for randomized dungeon rewards.'};
 const match=/^(.+)-([1-5])$/.exec(id),base=match&&rewardCatalog.find(i=>i.id===match[1]);if(!base)return null;
 const rank=Number(match[2]),mods=Object.fromEntries(Object.entries(base.mods||{}).map(([k,n])=>[k,n>0?n+rank-1:n]));
 return {...base,id,rank,mods,qty};
}
function requestGuestDrop(item,qty){
 if(state.pendingPartyDrop){notify('An earlier drop is awaiting confirmation.');return}
 if(!canonicalDrop(item.id,qty)){notify('This item cannot be dropped in a party yet.');return}
 const held=[];if(!moveStack(state.inventory,held,item,qty))return;
 const nonce=crypto.randomUUID().replace(/-/g,'');
 state.pendingPartyDrop={nonce,room:window.DCKNet.roomCode,held};
 try{writeCampaign()}catch{state.pendingPartyDrop=null;restoreReservedDrop(held);notify('Save unavailable; drop cancelled.');return}
 window.DCKNet.sendDrop({nonce,id:item.id,qty});
 notify('Waiting for host to place your bag.');render();backpack();
}
function restoreReservedDrop(held){for(const piece of held||[]){const old=state.inventory.find(i=>i.id===piece.id);if(old)old.qty+=piece.qty;else state.inventory.push(piece)}}
function resolveGuestDrop(d){
 const pending=state.pendingPartyDrop;if(!pending||d.nonce!==pending.nonce)return;
 if(!d.ok)restoreReservedDrop(pending.held);
 state.pendingPartyDrop=null;persistCampaign();notify(d.ok?'Your bag is on the dungeon floor.':'Drop rejected; items returned.');render();
}
function processGuestDrop(d){
 if(!window.DCKNet?.isHost)return;
 const nonce=d.nonce;if(!/^[a-f0-9]{32}$/.test(nonce||''))return;
 state.partyDropReceipts??={};
 const prior=state.partyDropReceipts[nonce];if(prior){window.DCKNet.sendDropResult(d.id,nonce,prior.ok);return}
 const p=d.player,piece=canonicalDrop(d.item,d.qty);
 const ok=!!(piece&&p&&p.floor===state.floor&&!p.hall&&p.hp>0&&!state.dead&&!bossFight&&!activeLoot&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&tile(p.x,p.y)===1&&!sanctuaryAt(p.x,p.y));
 if(ok)entities.push({type:'loot',name:'Dropped backpack',x:p.x,y:p.y,alive:true,droppedBag:true,contents:[piece],dropNonce:nonce});
 state.partyDropReceipts[nonce]={ok};
 try{writeCampaign()}catch{delete state.partyDropReceipts[nonce];if(ok)entities.pop();window.DCKNet.sendDropResult(d.id,nonce,false);return}
 window.DCKNet.sendDropResult(d.id,nonce,ok);sendPartyWorld();render();
}
function recoverRankedGear(id,qty){
 const match=/^(.+)-([1-5])$/.exec(id);if(!match)return false;
 const base=rewardCatalog.find(i=>i.id===match[1]);if(!base)return false;
 const rank=Number(match[2]),mods=Object.fromEntries(Object.entries(base.mods||{}).map(([key,n])=>[key,n>0?n+rank-1:n]));
 const labels={power:'power',armor:'armor',spellBonus:'spell damage'};
 const desc=base.effect==='buff'?'Gain '+(2+rank)+' power until you leave this floor. Replaces any active tea.':base.effect==='boon'?'Spend 5 mana to learn a permanent +'+rank+' spell damage.':Object.entries(mods).map(([key,n])=>(n>0?'+':'')+n+' '+labels[key]).join(' · ');
 const existing=state.inventory.find(i=>i.id===id);if(existing){Object.assign(existing,{...base,id,rank,mods,desc,qty:existing.qty+qty})}else state.inventory.push({...base,id,rank,mods,desc,qty});
 return true;
}
function receiveLoot(bundle){
  if(!bundle||typeof bundle!=='object'||Array.isArray(bundle))return;
  for(const [id,qty] of Object.entries(bundle)){
    if(!Number.isSafeInteger(qty)||qty<1||qty>100000)continue;
    if(recoverRankedGear(id,qty))continue;
    if(id==='gold')state.gold+=qty;
    else if(id==='box-Bronze'){for(let i=0;i<qty;i++)awardBox('Bronze')}
    else if(supplies[id]||/^box-(Bronze|Silver|Gold|Legendary|Celestial|Pet)$/.test(id)||id==='shard')giveItem(id,qty);
  }
}
function transferLoot(key){
  if(!activeLoot)return;
  const {owner,rows}=activeLoot,bundle={};
  for(const row of rows.slice()){
    if(key!=='all'&&key!==row.key)continue;
    const source=row.index<0?state.sanctuaries[-1-row.index]:entities[row.index];
    if(!source||!Array.isArray(source.contents))continue;
    const i=source.contents.findIndex(item=>item.id===row.id);
    if(i<0)continue;
    const piece=source.contents[i];source.contents.splice(i,1);rows.splice(rows.indexOf(row),1);
    if(source.droppedBag&&!owner){const existing=state.inventory.find(i=>i.id===piece.id);if(existing)existing.qty+=piece.qty;else state.inventory.push({...piece})}else bundle[row.id]=(bundle[row.id]||0)+piece.qty;
    if(!source.contents.length){
      if(row.index<0)source.cache=true;else{source.looted=true;if(source.type==='loot')source.alive=false}
      if(!owner){unlock('Scavenger');state.loots=(state.loots||0)+1;if(state.loots===3)ridiculous('Personal Space Is for the Living');if(state.loots===15)ridiculous('Estate Sale Enthusiast','Silver')}
    }
  }
  if(Object.keys(bundle).length){
    if(owner)window.DCKNet.sendLoot(owner,bundle);else receiveLoot(bundle);
    persistCampaign();
  }
  persistCampaign();if(!rows.length){finishLoot();return}
  drawLoot(activeLoot,!owner);sendPartyWorld();
}
function syncLoot(session){
  if(!session){if(remoteLoot){remoteLoot=null;lootSignature='';last=0;$('#modal').classList.add('hidden')}return}
  const signature=JSON.stringify(session);
  if(signature===lootSignature)return;
  lootSignature=signature;remoteLoot=session;drawLoot(session,session.owner===window.DCKNet.playerId);
}

function loot(){if(state.hall&&!state.dead&&!activeLoot&&!remoteLoot){hallInteract();return}if(state.dead||activeLoot||remoteLoot)return;if(state.chapter==='create'||state.chapter==='surface')return;if(bossFight)return;const nearby=nearbyContainers(state);
if(nearby.length){if(partyGuest())window.DCKNet.sendIntent('loot');else startLoot(nearby,null);return}
let sanctuary=sanctuaryAt(state.x,state.y);if(sanctuary){sanctuaryMenu(sanctuary);return}notify('No remains or cache nearby.')}function action(a){if(a==='loot')loot();if(a==='attack')attack();if(a==='interact')interact();if(a==='hot')hotUse()}
let worldClock=0;const remoteCooldown=new Map();
function partyGuest(){return !!window.DCKNet?.inRoom&&!window.DCKNet.isHost}
let partyEncounter=null,partySelectedTarget=null;
function sendPartyWorld(){if(!window.DCKNet?.isHost)return;window.DCKNet.sendWorld({floor:state.floor,npc:state.npc,relay:state.relay,crew:state.season?.crew,campaignWon:!!state.campaignWon,loot:activeLoot,encounter:bossFight?{index:entities.indexOf(bossFight.e),name:bossFight.e.name,hp:bossFight.e.hp,max:bossFight.e.max,turn:bossFight.turn,assist:bossFight.assist||0,roundId:bossFight.roundId,actions:bossFight.partyActions||{},intent:bossIntent(bossFight),busy:animatingTurn,hostReady:!!bossFight.hostChoice,targets:[bossFight.e,...(bossFight.group||[]).map(i=>entities[i]).filter(e=>e?.alive&&e!==bossFight.e)].map(e=>({index:entities.indexOf(e),name:e.name,hp:e.hp,max:e.max,x:e.x,y:e.y}))}:null,scenery:state.scenery,chests:(state.sanctuaries||[]).map(q=>!!q.cache),enemies:entities.map((e,i)=>({i,x:e.x,y:e.y,hp:e.hp,max:e.max,type:e.type,name:e.name,sprite:e.sprite,boss:!!e.boss,chief:e.chief,localBoss:!!e.localBoss,alive:e.alive,looted:!!e.looted,hatchling:!!e.hatchling,droppedBag:!!e.droppedBag})),collapse:Math.ceil(state.collapseLeft)})}
function applyPartyWorld(w){if(!partyGuest()||!w||!Number.isInteger(w.floor)||w.floor<1||w.floor>999)return;if(w.campaignWon&&w.floor>=FINAL_FLOOR&&!state.campaignWon){state.campaignWon=true;caption('Rescue frequency','All eighteen floors clear. Seattle hears the last bell.',true);persistCampaign()}if(w.floor!==state.floor){bossFight=null;state.dead=false;state.hp=Math.max(1,state.hp);state.floor=w.floor;if(state.floor>=4&&!state.maxMp)state.mp=state.maxMp=35;generate();$('#floorTag').textContent='FLOOR '+String(state.floor).padStart(2,'0');$('#roomName').textContent=names[(state.floor-1)%names.length].toUpperCase();closeModal();notify('PARTY FLOOR '+state.floor)}syncLoot(w.loot);partyEncounter=w.encounter||null;if(w.relay?.floor===state.floor){const pinned=state.relay?.pinned;state.relay={...w.relay,pinned}}if(w.npc&&Number.isInteger(w.npc.x)&&Number.isInteger(w.npc.y)){
 const old=state.npc,moved=old&&(old.x!==w.npc.x||old.y!==w.npc.y);
 state.npc={...w.npc,fromX:moved?old.x:old?.fromX,fromY:moved?old.y:old?.fromY,walkAt:moved?performance.now():old?.walkAt};
 }if(w.crew)season().crew=w.crew;if(Array.isArray(w.scenery))state.scenery=w.scenery;if(Array.isArray(w.chests))(state.sanctuaries||[]).forEach((q,i)=>q.cache=!!w.chests[i]);for(let v of w.enemies||[]){if(!Number.isInteger(v.i)||v.i<0||v.i>=100000)continue;let e=entities[v.i];if(v.type==='loot'&&(!e||e.type!=='loot')){e={type:'loot',name:v.name||'Cache',droppedBag:!!v.droppedBag};while(entities.length<v.i)entities.push({type:'loot',alive:false,looted:true,x:0,y:0});entities[v.i]=e}if(v.type==='enemy'&&!v.hatchling&&(!e||e.type!=='enemy')){e={type:'enemy',name:v.name||'Enemy',sprite:v.sprite||'skeleton',boss:!!v.boss,chief:v.chief,localBoss:!!v.localBoss,max:v.max||1};while(entities.length<v.i)entities.push({type:'loot',alive:false,looted:true,x:0,y:0});entities[v.i]=e}if(v.hatchling&&state.floor===2&&Number.isInteger(v.i)&&v.i>=0&&v.i<100000&&!e?.hatchling){e={...floorEnemy(2,0,v.x,v.y),hatchling:true,budded:true,name:'Grub hatchling',max:5};while(entities.length<v.i)entities.push({type:'loot',alive:false,looted:true,x:0,y:0});entities[v.i]=e}if(!e||!Number.isInteger(v.x)||!Number.isInteger(v.y)||v.x<0||v.x>=W||v.y<0||v.y>=H)continue;e.x=v.x;e.y=v.y;if(Number.isFinite(v.max)&&v.max>0)e.max=v.max;if(Number.isFinite(v.hp))e.hp=Math.max(0,Math.min(e.max||9999,v.hp));e.alive=!!v.alive;e.looted=!!v.looted}if(Number.isFinite(w.collapse))state.collapseLeft=Math.max(0,w.collapse);render()}
function partyIntent(d){if(!window.DCKNet?.isHost||d.player?.floor!==state.floor)return;
if(activeLoot){if(activeLoot.owner===d.id){
if(d.action==='loot_close')finishLoot();else if(d.action.startsWith('take_')){const prefix='take_'+activeLoot.sessionId+'_';if(activeLoot.sessionId?d.action.startsWith(prefix):true)transferLoot(d.action.slice(activeLoot.sessionId?prefix.length:5))}
}return}
if(d.action.startsWith('take_')||d.action==='loot_close')return;
if(d.action.startsWith('round_')){acceptPartyAction(d);return}
let now=performance.now();if(now-(remoteCooldown.get(d.id)||-1000)<450)return;remoteCooldown.set(d.id,now);let p=d.player;if(d.action!=='loot'&&sanctuaryAt(p.x,p.y))return;if(!['loot','attack'].includes(d.action))return;let range=2.15;if(bossFight){let e=bossFight.e;return}if(d.action==='loot'){const sources=nearbyContainers(p);if(sources.length&&!modalOpen())startLoot(sources,d.id);return}let targets=entities.filter(e=>e.type==='enemy'&&e.alive&&!e.boss&&Math.hypot(e.x-p.x,e.y-p.y)<=range).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));if(d.action==='attack')targets=targets.slice(0,1);for(let e of targets){let damage=8+Math.min(100,p.level||1)*2;e.hp-=damage;particles.push({x:e.x,y:e.y,t:0,kind:'hit',text:'-'+damage});if(e.hp<=0){e.alive=false;broadcastKill(e);e.deathAt=now;window.DCKNet.sendReward(d.id,8,e.xp||0,null)}}sendPartyWorld()}
let partyTrade=null,tradeDraft=[];
function tradeRows(o){return Array.isArray(o)?o:o?.item?[o]:[]}
function tradeMenu(){
 if(!window.DCKNet?.inRoom||state.dead||bossFight||activeLoot||remoteLoot)return;
 if(!partyTrade){if(state.pendingTrade){const p=state.pendingTrade;if(p.token)window.DCKNet.recoverTrade(p.id,p.token);notify('Previous trade awaiting recovery.');return}showModal('<h2>PLAYER TRADE</h2><p>Stand within three tiles of another crawler.</p>'+Object.entries(netPlayers).filter(([id,p])=>p.floor===state.floor&&!p.hall&&Math.hypot(p.x-state.x,p.y-state.y)<=3).map(([id,p])=>'<button class="widebtn" data-trade-peer="'+safeAttr(id)+'">'+safeAttr(p.name||'Crawler')+'</button>').join('')+'<button class="widebtn" id="tradeBack">BACK</button>');$$('[data-trade-peer]').forEach(b=>b.onclick=()=>window.DCKNet.trade('trade_open',{target:b.dataset.tradePeer}));$('#tradeBack').onclick=closeModal;return}
 const t=partyTrade,held=state.pendingTrade;
 const label=o=>o.item==='gold'?'Gold':(canonicalDrop(o.item,o.qty)?.name||o.item)+(canonicalDrop(o.item,o.qty)?.rank?' · Rank '+canonicalDrop(o.item,o.qty).rank:'');
 const lines=o=>tradeRows(o).map(v=>'<div>'+safeAttr(label(v))+' ×'+v.qty+'</div>').join('')||'<div>No offer</div>';
 const available=state.inventory.filter(i=>i.qty>(state.equipment?.[i.slot]===i.id?1:0)&&canonicalDrop(i.id,1));
 const editing=!held&&!t.mine;
 showModal('<h2>TRADE WITH '+safeAttr(t.peerName)+'</h2><h3>Your offer</h3>'+lines(t.mine||held?.offer||tradeDraft)+'<h3>Their offer</h3>'+lines(t.theirs)+'<p>'+(t.accepted?'You accepted. ':'')+(t.peerAccepted?'Partner accepted.':'')+'</p>'+(editing?'<label>Offer<select id="tradeItem"><option value="gold">Gold ('+state.gold+')</option>'+available.map(i=>'<option value="'+safeAttr(i.id)+'">'+safeAttr(i.name)+' ×'+(i.qty-(state.equipment?.[i.slot]===i.id?1:0))+'</option>').join('')+'</select></label><label>Quantity<input id="tradeQty" type="number" min="1" max="9999" value="1"></label><button class="widebtn" id="tradeAdd">ADD TO OFFER</button>'+tradeDraft.map((v,i)=>'<button class="smallbtn" data-trade-remove="'+i+'">Remove '+safeAttr(label(v))+'</button>').join('')+'<button class="widebtn" id="tradeOffer" '+(!tradeDraft.length?'disabled':'')+'>LOCK OFFER</button>':'')+'<button class="widebtn" id="tradeAccept" '+(!t.mine||!t.theirs||t.accepted||held?.id!==t.id?'disabled':'')+'>ACCEPT EXCHANGE</button><button class="widebtn" id="tradeCancel">CANCEL TRADE</button>');
 if(editing){
 $('#tradeAdd').onclick=()=>{const id=$('#tradeItem').value,qty=Number($('#tradeQty').value),old=tradeDraft.find(v=>v.item===id),total=qty+(old?.qty||0),item=state.inventory.find(i=>i.id===id),limit=id==='gold'?state.gold:item?item.qty-(state.equipment?.[item.slot]===id?1:0):0;if(!Number.isSafeInteger(qty)||qty<1||total>Math.min(9999,limit)||(!old&&tradeDraft.length>=12))return notify('Invalid quantity or offer limit reached.');if(old)old.qty=total;else tradeDraft.push({item:id,qty});tradeMenu()};
 $$('[data-trade-remove]').forEach(b=>b.onclick=()=>{tradeDraft.splice(Number(b.dataset.tradeRemove),1);tradeMenu()});
 $('#tradeOffer').onclick=()=>reserveTrade(t,tradeDraft);
 }
 $('#tradeAccept').onclick=()=>window.DCKNet.trade('trade_accept',{id:t.id,version:t.version});
 $('#tradeCancel').onclick=()=>window.DCKNet.trade('trade_cancel',{id:t.id});
}
function reserveTrade(t,offer){
 if(state.pendingTrade||!offer.length||offer.length>12)return;
 for(const {item:id,qty} of offer){const item=state.inventory.find(i=>i.id===id),limit=id==='gold'?state.gold:item?item.qty-(state.equipment?.[item.slot]===id?1:0):0;if(!Number.isSafeInteger(qty)||qty<1||qty>Math.min(9999,limit)||(id!=='gold'&&!canonicalDrop(id,qty)))return notify('Offer unavailable.')}
 const held=[];let gold=0;for(const {item:id,qty} of offer){if(id==='gold'){state.gold-=qty;gold+=qty}else moveStack(state.inventory,held,state.inventory.find(i=>i.id===id),qty)}
 state.pendingTrade={id:t.id,token:crypto.randomUUID().replace(/-/g,''),offer:offer.map(v=>({...v})),held,gold};
 try{writeCampaign()}catch{state.gold+=gold;restoreReservedDrop(held);state.pendingTrade=null;notify('Save failed. Offer cancelled.');return}
 window.DCKNet.trade('trade_offer',{id:t.id,offer:state.pendingTrade.offer,token:state.pendingTrade.token});tradeMenu();
}
function endTrade(d){
 const p=state.pendingTrade;if(p?.id===d.id){if(!d.ok){state.gold+=p.gold??(p.offer?.item==='gold'?p.offer.qty:0);restoreReservedDrop(p.held)}else if(d.received){const bundle=Object.create(null);for(const v of tradeRows(d.received))bundle[v.item]=(bundle[v.item]||0)+v.qty;receiveLoot(bundle)}state.pendingTrade=null;persistCampaign()}
 if(partyTrade?.id===d.id){partyTrade=null;tradeDraft=[];closeModal()}notify(d.ok?'Trade completed.':'Trade cancelled.');render();
}
function acceptPartyAction(d){
 const b=bossFight,p=d.player,m=/^round_([a-f0-9]{32})_([0-9]{1,5})_(strike|guard|focus|cast[0-2])(?:_([0-9]{1,5}))?$/.exec(d.action);
 if(!b||!m||animatingTurn||m[1]!==b.roundId||Number(m[2])!==b.turn||p.hall||p.hp<=0||Math.hypot(p.x-b.e.x,p.y-b.e.y)>3)return;
 b.partyActions??={};if(b.partyActions[d.id])return;
 const index=m[4]===undefined?entities.indexOf(b.e):Number(m[4]),target=entities[index];if(!target?.alive||!(target===b.e||(b.group||[]).includes(index)))return;
 b.partyTargets??={};b.partyDamage??={};b.partyTargets[d.id]=index;
 const slot=/^cast([0-2])$/.exec(m[3]),spell=slot&&p.spells?.[Number(slot[1])],ability=spell&&Object.hasOwn(techniques,spell)?techniques[spell]:null;
 if(slot&&(!ability||p.mp<ability.cost||state.floor<ability.floor))return;
 b.partyActions[d.id]=m[3];b.partySpellCosts??={};b.partySpellDetails??={};
 if(ability){b.partySpellCosts[d.id]=ability.cost;const power=Math.max(1,Math.min(200,p.power||1)),magic=Math.max(0,Math.min(100,p.spellBonus||0)),armor=Math.max(0,Math.min(100,p.armor||0));let damage=spell==='mend'?0:ability.scale==='magic'||['catalyst','tide','bell'].includes(spell)?20+2*magic:ability.scale==='armor'||spell==='bastion'?power+armor+6:power*2+6;damage=Math.min(400,damage);b.partyDamage[d.id]=damage;b.partySpellDetails[d.id]={spell,guard:!!ability.guard||['brace','bastion'].includes(spell),heal:spell==='mend'?25:Math.floor(damage*(ability.heal||0))};}
 if(m[3]==='strike')b.partyDamage[d.id]=8+Math.min(20,p.level||1);
 if(m[3]==='focus')b.partyDamage[d.id]=4+Math.floor(Math.min(20,p.level||1)/2);
 b.log='Ally action locked: '+Object.keys(b.partyActions).length+' ready.';
 persistCampaign();bossScreen();sendPartyWorld();
 if(b.hostChoice&&!pendingRoundGuests(b).length){const action=b.hostChoice;b.hostChoice=null;animateTurn(action)}
}
function resolvePartyTargets(b){
 if(!window.DCKNet?.isHost)return 0;
 let primary=0;
 for(const [id,damage] of Object.entries(b.partyDamage||{})){
 const index=b.partyTargets?.[id],target=entities[index];
 if(!target?.alive||!(target===b.e||(b.group||[]).includes(index)))continue;
 if(target===b.e){primary+=damage;continue}
 target.hp=Math.max(0,target.hp-damage);
 if(target.hp===0){target.alive=false;target.deathAt=performance.now();broadcastKill(target);state.kills++;state.xp+=target.xp||0;window.DCKNet.sendReward(id,8,target.xp||0,null);feed(target.name+' defeated by an ally.')}
 }
 b.partyDamage={};return primary;
}
function partyRoundDamage(b,e,won=false){
 if(!window.DCKNet?.isHost)return;
 for(const [id,choice] of Object.entries(b.partyActions||{})){
 const p=netPlayers[id];if(!p||p.hp<=0||p.floor!==state.floor||p.hall||Math.hypot(p.x-e.x,p.y-e.y)>3)continue;
 const spell=b.partySpellDetails?.[id],cost=b.partySpellCosts?.[id]||0;
 const damage=won?0:Math.max(1,Math.floor(e.atk*((choice==='guard'||spell?.guard)?0.2:0.65)));
 window.DCKNet.sendRoundResult(id,b.roundId,b.turn,damage,choice==='focus'?4:-cost,spell?.heal||0);
 }
 b.partyActions={};b.partySpellCosts={};b.partySpellDetails={};b.partyTargets={};b.partyDamage={};
}
function receivePartyRound(d){
 const key=d.roundId+'/'+d.turn;state.partyRoundReceipts??=[];
 if(state.partyRoundReceipts.includes(key)||state.dead)return;
 state.partyRoundReceipts.push(key);if(state.partyRoundReceipts.length>200)state.partyRoundReceipts.shift();
 state.hp=Math.max(0,Math.min(state.maxHp,state.hp+(d.heal||0))-d.damage);state.mp=Math.max(0,Math.min(state.maxMp,state.mp+d.mana));
 if(state.hp===0){state.dead=true;openDeath()}else notify('Party turn resolved: −'+d.damage+' HP'+(d.mana?' · +'+d.mana+' MP':''));
 persistCampaign();render();
}
function partyActionControls(h){
 const t=partyEncounter,e=entities[t?.index];if(!t?.roundId||!e||state.dead||state.hall||Math.hypot(state.x-e.x,state.y-e.y)>3)return;
 const row=document.createElement('div');row.className='field-stat';
 const choice=t.actions?.[window.DCKNet.playerId];
 const targets=(t.targets||[]).filter(v=>v.hp>0);const select=document.createElement('select');select.setAttribute('aria-label','Enemy target');for(const v of targets){const opt=document.createElement('option');opt.value=String(v.index);opt.textContent=v.name+' · '+v.hp+'/'+v.max+' HP';select.appendChild(opt)}if(targets.some(v=>v.index===partySelectedTarget))select.value=String(partySelectedTarget);select.onchange=()=>{partySelectedTarget=Number(select.value)};if(!choice&&targets.length>1)row.appendChild(select);
 if(choice)row.textContent='Action locked: '+(/^cast[0-2]$/.test(choice)?moveName(prepared()[Number(choice.slice(-1))]||'bell'):choice);
 else for(const a of ['strike','guard','focus',...prepared().map((_,i)=>'cast'+i)]){const b=document.createElement('button');b.className='smallbtn';const spell=/^cast[0-2]$/.test(a)?prepared()[Number(a.slice(-1))]:null;b.textContent=spell?moveName(spell)+' · '+techniques[spell].cost+' MP':a==='focus'?'Focus + MP':a;b.disabled=!!t.busy||!!(spell&&state.mp<techniques[spell].cost);b.onclick=()=>{window.DCKNet.sendIntent('round_'+t.roundId+'_'+t.turn+'_'+a+(targets.length?'_'+select.value:''));for(const child of row.querySelectorAll('button'))child.disabled=true};row.appendChild(b)}
 h.appendChild(row);
}
function updatePartyRoster(){const el=$('#netRoster');if(el){el.textContent='Party members connected: '+(window.DCKNet?.inRoom?Object.keys(netPlayers).length+1:0)+' / 4';if(window.DCKNet?.inRoom){const b=document.createElement('button');b.className='smallbtn';b.textContent='Player trade';b.onclick=tradeMenu;el.appendChild(b)}}}
window.addEventListener('dcknet',e=>{const d=e.detail||{};if(remoteLoot&&!partyGuest())syncLoot(null);if(!partyGuest())partyEncounter=null;
if(activeLoot?.owner&&d.type==='player_left'&&activeLoot.owner===d.id)finishLoot();
if(activeLoot?.owner&&!window.DCKNet?.inRoom)finishLoot();
if(d.type==='trade_recovery_unknown'){if(state.pendingTrade?.id===d.id)notify('Trade receipt unavailable; reserved items remain protected.')}else if(d.type==='round_result'){if(partyGuest())receivePartyRound(d)}else if(d.type==='trade_state'){if(partyTrade?.id!==d.trade.id)tradeDraft=[];partyTrade=d.trade;if(!bossFight&&!activeLoot&&!remoteLoot&&!state.dead)tradeMenu();else window.DCKNet.trade('trade_cancel',{id:d.trade.id})}else if(d.type==='trade_end'){endTrade(d)}else if(d.type==='drop_request'){processGuestDrop(d)}else if(d.type==='drop_result'){resolveGuestDrop(d)}else if(d.type==='loot_bundle'){if(partyGuest()){receiveLoot(d.items);persistCampaign();render()}}else if(d.type==='reward'){if(partyGuest()){petVictory();if(d.guardian)recordGuardian(d.guardian.floor,d.guardian.name);state.gold+=d.gold||0;state.xp+=d.xp||0;if(d.item)giveItem(d.item,1);checkLevel();save();render();notify('PARTY REWARD RECEIVED')}}else if(d.type==='world'){applyPartyWorld(d.world)}else if(d.type==='combat_intent'){partyIntent(d)}else if(d.type==='players'){netPlayers=d.players||{};render();updatePartyRoster()}else if(d.type==='player_state'){netPlayers[d.id]=d.player;render();updatePartyRoster()}else if(d.type==='player_left'){delete netPlayers[d.id];if(bossFight?.hostChoice&&!animatingTurn&&!pendingRoundGuests(bossFight).length){const action=bossFight.hostChoice;bossFight.hostChoice=null;bossScreen();animateTurn(action)}render();updatePartyRoster()}else if(d.type==='room'){notify('PRIVATE ROOM '+d.code);const p=state.pendingPartyDrop;if(p&&p.room===d.code&&partyGuest())window.DCKNet.sendDrop({nonce:p.nonce,id:p.held[0].id,qty:p.held[0].qty});render()}else if(d.type==='status'){if(window.DCKNet?.connected&&state.pendingTrade?.token)window.DCKNet.recoverTrade(state.pendingTrade.id,state.pendingTrade.token);if(!window.DCKNet?.inRoom){partyTrade=null;tradeDraft=[]}const el=$('#netStatus');if(el)el.textContent=d.text;const room=$('#netRoom');if(room)room.textContent=d.code?'ROOM '+d.code:'No active room';updatePartyRoster()}else if(d.type==='error'){notify('CO-OP: '+d.message)}});
function collapseTick(dt){if(state.campaignWon)return;if(state.hall&&!window.DCKNet?.inRoom)return;if(bossFight&&!window.DCKNet?.inRoom)return;if(state.chapter==='surface'||state.chapter==='create'||state.dead)return;state.collapseLeft=Math.max(0,(state.collapseLeft??900)-dt);if(state.floor===2&&state.relay&&!state.relay.used){const high=highWater();if(high!==!!state.relay.high){state.relay.high=high;
   if(high){beep(480,.12);setTimeout(()=>beep(480,.12),220);notify('Two bells · blue crossings submerged')}else notify('Water recedes · crossings open')}}
 if(state.relay?.race==='live'&&state.relay.raceStart-state.collapseLeft>75){state.relay.race='lost';highlight('Night Shift reached the station first and took the purse.',4)}
 let n=Math.ceil(state.collapseLeft),el=$('#collapseClock');if(el){el.textContent='COLLAPSE '+Math.floor(n/60)+':'+String(n%60).padStart(2,'0');el.style.color=n<=60?'#ff7766':'#e6c47d'}for(let t of [300,60,10])if(n<=t&&!state.warned.includes(t)){state.warned.push(t);ai('Floor collapse in '+t+' seconds. Find the stairs, crawler.');notify('COLLAPSE WARNING: '+t+'s')}if(n===0){bossFight=null;state.collapsed=true;state.dead=true;state.hp=0;save();showModal('<h2>FLOOR COLLAPSED</h2><p>You failed to reach the stairs in time.</p><button class="widebtn" id="collapseRestart">NEW RUN</button>');$('#collapseRestart').onclick=campaignMenu}}document.addEventListener('click',e=>{let b=e.target.closest('[data-class]');if(b)chooseClass(b.dataset.class);let t=e.target.closest('[data-branch]');if(t)trainBranch(t.dataset.branch)});function tick(ts){
if(pauseStarted!==null){last=ts;requestAnimationFrame(tick);return}
if(bossFight&&!window.DCKNet?.inRoom){last=ts;requestAnimationFrame(tick);return}
if(activeLoot||remoteLoot){last=ts;requestAnimationFrame(tick);return}let elapsed=last?Math.max(0,(ts-last)/1000||0):0,dt=Math.min(.05,elapsed);let nextStepStart=ts;last=ts;collapseTick(Math.min(elapsed,1));if(step){let p=Math.min(1,(ts-step.start)/step.duration);p=Math.max(0,p);visualX=step.x+(step.nx-step.x)*p;visualY=step.y+(step.ny-step.y)*p;if(p>=1){let done=step;nextStepStart=Math.max(ts-32,done.start+done.duration);if(!done.returning)finishStep(done.nx,done.ny);step=null;visualX=(state.hall||state).x;visualY=(state.hall||state).y}}else{visualX=(state.hall||state).x;visualY=(state.hall||state).y}if(!state.dead){if(!step){let x=joyX||((keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0)),y=joyY||((keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0));if(x||y){if(Math.abs(x)>Math.abs(y))move(Math.sign(x),0,nextStepStart);else move(0,Math.sign(y),nextStepStart);
if(step){
  const progress=(ts-step.start)/step.duration;
  visualX=step.x+(step.nx-step.x)*progress;
  visualY=step.y+(step.ny-step.y)*progress;
}
}}if(!partyGuest())enemyTick(dt);worldClock+=dt;if(worldClock>.5){worldClock=0;sendPartyWorld()}attackCooldown=Math.max(0,attackCooldown-dt);particles.forEach(p=>p.t+=dt);particles=particles.filter(p=>p.t<.65);if(Math.random()<dt*.025)persistCampaign();netSyncClock+=dt;if(netSyncClock>.18&&window.DCKNet?.inRoom){netSyncClock=0;window.DCKNet.sendState({hall:state.hall?{index:state.hall.index,x:state.hall.x,y:state.hall.y}:null,gear:gearLook(),character:state.character,floor:state.floor,x:state.x,y:state.y,level:state.level,hp:state.hp,maxHp:state.maxHp,mp:state.mp,power:state.power,armor:state.armor,spellBonus:state.spellBonus||0,spells:prepared(),name:localStorage.getItem('dck-net-name')||'Crawler'});}}if(!state.dead&&Math.floor(ts/200)!==Math.floor((ts-dt*1000)/200))render();else draw();requestAnimationFrame(tick)}
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
if(!load()){startStory()}else{if(!state.sanctuaries?.length&&state.safe)state.sanctuaries=[state.safe];if(state.hall&&!state.sanctuaries?.[state.hall.index]?.door)state.hall=null;
  if(!state.hall&&!state.dead){const q=sanctuaryAt(state.x,state.y);if(q?.door)enterHall(q)}
  if(!Array.isArray(state.scenery))furnishFloor();if(!state.hall&&!bossFight&&!state.dead&&state.chapter==='mine'&&(solid(state.x,state.y)||sanctuaryAt(state.x,state.y)||[[1,0],[-1,0],[0,-1],[0,1]].every(([dx,dy])=>solid(state.x+dx,state.y+dy))))chooseLanding();if(state.chapter==='mine'&&state.wildAnimal===undefined)placeAnimal();populatePatrols(true);initialiseRelay();reveal();render();if(state.chapter==='create')showCreator()}bind();render();if(state.dead)openDeath();else if(bossFight)bossScreen();if(!personalMenusLocked())openTab('journal');if(state.storyLine)caption(state.storyLine.speaker,state.storyLine.line);else if(!state.chapter)ai(quips[0]);$('#packBtn').onclick=backpack;$('#editCrawler').onclick=()=>{if(!state.dead&&!bossFight)showCreator()};requestAnimationFrame(tick);
})();

