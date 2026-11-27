const {test,expect}=require('@playwright/test');
  test('startup, creator, movement and save menu',async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:8000/');
   await expect(page.locator('#creator')).toBeVisible();
   await page.locator('[name=crawlerName]').fill('Test Crawler');
   await page.locator('[name=hair]').selectOption({index:2});
   await page.getByRole('button',{name:'Begin on the surface'}).click();
   await expect(page.locator('#modal')).toBeHidden();
   await expect(page.locator('#game')).toBeVisible();
   const before=await page.locator('#coords').innerText();
   await page.locator('body').click({position:{x:5,y:5}});
   await page.keyboard.press('ArrowDown');
   await expect(page.locator('#coords')).not.toHaveText(before,{timeout:5000});
   await page.locator('#saveBtn').click();
   await expect(page.locator('#campaignPanel')).toBeVisible();
   await page.locator('#campaignPanel [data-dismiss]').click();
   await expect(page.locator('#campaignPanel')).toBeHidden();
   await page.reload();
   await expect(page.locator('#creator')).toHaveCount(0);
   expect(errors).toEqual([]);
  });

test('native touch joystick moves and resets after release',async({page})=>{
 await page.goto('http://127.0.0.1:8000/');
 await page.getByRole('button',{name:'Begin on the surface'}).click();
 await expect(page.locator('#modal')).toBeHidden();
 const joy=page.locator('#joystick'),knob=page.locator('#joyKnob');
 await expect(joy).toBeVisible();
 const before=await page.locator('#coords').innerText();
 await joy.evaluate(el=>{
  const b=el.getBoundingClientRect();
  const touch={identifier:7,target:el,clientX:b.left+b.width/2,clientY:b.top+b.height*.85};
  const event=new Event('touchstart',{bubbles:true,cancelable:true});
  Object.defineProperties(event,{touches:{value:[touch]},changedTouches:{value:[touch]}});
  el.dispatchEvent(event);
 });
 await expect(page.locator('#coords')).not.toHaveText(before,{timeout:5000});
 await joy.evaluate(el=>{
  const event=new Event('touchend',{bubbles:true,cancelable:true});
  Object.defineProperties(event,{touches:{value:[]},changedTouches:{value:[{identifier:7,target:el}]}});
  el.dispatchEvent(event);
 });
 await expect.poll(()=>knob.evaluate(el=>el.style.transform)).toBe('');
});

test('surface to guild induction and backpack',async({page})=>{
 test.setTimeout(60000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8000/');
 await page.getByRole('button',{name:'Begin on the surface'}).click();
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dck-final-save-v1')).state);
 await page.keyboard.down('ArrowDown');
 try{await expect.poll(async()=> (await saved()).chapter,{timeout:20000}).toBe('mine')}finally{await page.keyboard.up('ArrowDown')}
 await expect.poll(async()=>!!(await saved()).hall).toBe(true);
 if(await page.locator('#awardScreen').isVisible())await page.locator('#awardSkip').click();
 for(let i=0;i<6;i++){
  const h=(await saved()).hall;if(h.y<=4)break;
  await page.keyboard.press('ArrowUp');
  await expect.poll(async()=> (await saved()).hall.y).toBe(h.y-1);
 }
 await page.keyboard.press('e');
 for(let i=0;i<4;i++)await page.locator('#guildNext').click();
 await expect.poll(async()=> (await saved()).guildTrained).toBe(true);
 if(await page.locator('#awardScreen').isVisible())await page.locator('#awardSkip').click();
 await page.locator('#packBtn').click();
 await expect(page.locator('[data-bag-section="general"]')).toBeVisible();
 await page.locator('[data-bag-section="boxes"]').click();
 await expect(page.locator('[data-bag-section="boxes"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('[data-bag-section="trade"]').click();
 await expect(page.locator('[data-bag-section="trade"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#modalClose').click();
 await page.reload();
 await expect.poll(async()=> (await saved()).guildTrained).toBe(true);
 expect(errors).toEqual([]);
});

test('offline reload retains the created crawler',async({page,context})=>{
 await page.goto('http://127.0.0.1:8000/');
 await page.locator('[name=crawlerName]').fill('Offline Crawler');
 await page.getByRole('button',{name:'Begin on the surface'}).click();
 await page.evaluate(async()=>{await navigator.serviceWorker.ready});
 await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller),{timeout:15000}).toBe(true);
 await context.setOffline(true);
 try{
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#game')).toBeVisible();
  await expect(page.locator('#creator')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dck-final-save-v1')).state.character.name)).toBe('Offline Crawler');
 }finally{await context.setOffline(false)}
});

test('guardian battle controls, victory and corpse loot',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8000/');
 await page.getByRole('button',{name:'Begin on the surface'}).click();
 await page.evaluate(()=>{
  const key='dck-final-save-v1',o=JSON.parse(localStorage.getItem(key));
  Object.assign(o.state,{floor:3,chapter:'mine',guildTrained:true,hall:null,x:5,y:5,hp:100,maxHp:100,power:22,armor:12,collapseLeft:900,arena:{x:6,y:3,w:6,h:6,gates:[]},sanctuaries:[],safe:null,scenery:[],rivals:[],patrolFloor:3,rivalFloor:3,hazardFloor:3,discoveryFloor:3,secretFloor:3,achievements:['Management Has Been Terminated','Getting stronger','Scavenger'],inventory:[]});
  o.tiles=Array.from({length:16},(_,y)=>Array.from({length:16},(_,x)=>x>0&&y>0&&x<15&&y<15?1:2));
  o.seen=o.tiles.map(row=>row.map(()=>true));
  o.entities=[{type:'enemy',name:'Pip, Keeper of the Cage',sprite:'goblin',small:true,boss:true,alive:true,x:7,y:5,hp:45,max:45,atk:12,armor:2,xp:100,balanceVersion:1,contents:[{id:'gold',qty:9}]}];
  o.encounter=null;localStorage.setItem(key,JSON.stringify(o));
 });
 await page.reload();
 await expect(page.locator('#bossbar')).toHaveClass(/hidden/);
 await page.keyboard.press('ArrowRight');
 await expect(page.locator('#guardianWarning')).toBeVisible();
 await expect(page.locator('.duel')).toBeVisible();
 await expect(page.locator('#bossbar')).not.toHaveClass(/hidden/);
 await page.locator('[data-boss="attack"]').click();
 await expect(page.locator('.duel small').first()).toContainText('TURN 2');
 await expect(page.locator('.resolved-hit.enemy-hit')).toBeVisible();
 const battleSave=()=>page.evaluate(()=>{const o=JSON.parse(localStorage.getItem('dck-final-save-v1'));return {turn:o.encounter?.turn,enemyHp:o.entities[0].hp,hp:o.state.hp,gold:o.state.gold}});
 const beforeReload=await battleSave();
 expect(beforeReload.turn).toBe(2);
 expect(beforeReload.enemyHp).toBeLessThan(45);
 await page.reload();
 await expect(page.locator('.duel small').first()).toContainText('TURN 2');
 await expect(page.locator('#bossbar')).not.toHaveClass(/hidden/);
 expect(await battleSave()).toEqual(beforeReload);
 await expect(page.locator('[data-boss="attack"]')).toBeEnabled();

 for(let i=0;i<3;i++){
  if(await page.locator('#bossDone').isVisible())break;
  await page.locator('[data-boss="attack"]').click();
  await expect.poll(async()=>await page.locator('#bossDone').isVisible()||await page.locator('[data-boss="attack"]').isEnabled()).toBe(true);
 }
 await expect(page.locator('#bossDone')).toBeVisible();
 await page.locator('#bossDone').click();
 await expect(page.locator('#bossbar')).toHaveClass(/hidden/);
 await page.locator('[data-action="loot"]').click();
 await expect(page.locator('#takeAll')).toBeVisible();
 await page.locator('#takeAll').click();
 const result=await page.evaluate(()=>JSON.parse(localStorage.getItem('dck-final-save-v1')));
 expect(result.entities[0].alive).toBe(false);
 expect(result.entities[0].looted).toBe(true);
 expect(result.state.inventory.filter(i=>i.id==='box-Gold').reduce((n,i)=>n+i.qty,0)).toBeGreaterThanOrEqual(2);
 expect(errors).toEqual([]);
});
