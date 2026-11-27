'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
const shell=vm.runInNewContext(sw+'\n;FILES',{self:{addEventListener(){}}});
test('every precached asset exists and is nonempty',()=>{
 for(const url of shell){const p=url.split('?')[0];if(p==='./')continue;assert.ok(fs.statSync(p).isFile(),p);assert.ok(fs.statSync(p).size>0,p)}
});
test('release versions and offline cache references agree',()=>{
 const build=html.match(/BUILD (\d+)\.(\d+)\.(\d+)/);assert.ok(build);
 const version=build[1]+build[2].padStart(2,'0')+build[3];const expected=version.padStart(4,'0');
 for(const file of ['game.js','multiplayer.js','music.js','style.css']){const url=file+'?v='+expected;assert.ok(html.includes(url),url);assert.ok(shell.includes('./'+url),url)}
});
test('manifest entry and icons exist',()=>{
 assert.ok(fs.existsSync(manifest.start_url));assert.equal(manifest.display,'standalone');for(const icon of manifest.icons)assert.ok(fs.statSync(icon.src).size>0)
});
