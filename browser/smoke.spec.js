const {test,expect,devices}=require('@playwright/test');
for(const [browserName,device] of [['webkit','iPhone 13'],['chromium','Pixel 7']]){
 test.describe(browserName+' mobile',()=>{
  test.use({...devices[device],browserName});
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
 });
}
