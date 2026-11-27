const {defineConfig,devices}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./browser',
 timeout:45000,
 use:{trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[
  {name:'iPhone WebKit',use:{...devices['iPhone 13'],browserName:'webkit'}},
  {name:'Android Chromium',use:{...devices['Pixel 7'],browserName:'chromium'}}
 ]
});
