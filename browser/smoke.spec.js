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
 for(let i=0;i<6;i++){
  const h=(await saved()).hall;if(h.y<=4)break;
  await page.keyboard.press('ArrowUp');
  await expect.poll(async()=> (await saved()).hall.y).toBe(h.y-1);
 }
 await page.keyboard.press('e');
 for(let i=0;i<4;i++)await page.locator('#guildNext').click();
 await expect.poll(async()=> (await saved()).guildTrained).toBe(true);
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
