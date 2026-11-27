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
