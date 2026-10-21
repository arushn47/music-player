import {chromium} from 'playwright-core';import {spawn} from 'node:child_process';import {mkdirSync,writeFileSync} from 'node:fs';import path from 'node:path';import net from 'node:net';import assert from 'node:assert/strict';
const data=path.resolve('.test-data/overlay-opacity-native-'+Date.now());mkdirSync(data,{recursive:true});
const port=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const app=spawn(path.resolve('src-tauri/target/debug/lumaire.exe'),[],{windowsHide:true,env:{...process.env,LUMAIRE_DATA_DIR:data,WEBVIEW2_USER_DATA_FOLDER:path.join(data,'webview'),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port='+port}});let browser;
try {for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:'+port+'/json/version')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);const page=browser.contexts()[0].pages()[0];await page.locator('.now-playing').waitFor({timeout:30000});
await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('lyric_overlay_control',{action:'open'}));let overlay;
for(let i=0;i<80;i++){overlay=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('overlay=lyrics'));if(overlay)break;await new Promise(r=>setTimeout(r,100));}assert(overlay);
await overlay.locator('.floating-lyrics').waitFor();await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('lyric_overlay_publish',{snapshot:{title:'Opacity check',artist:'Lumaire',status:'playing',message:'',lines:[{text:'The previous lyric',secondary:'',active:false},{text:'Keep the words clear',secondary:'Readable glass, quiet controls',active:true},{text:'The next lyric',secondary:'',active:false}]}}));
await overlay.evaluate(()=>{localStorage.setItem('lyric-overlay-opacity','23');localStorage.setItem('lyric-overlay-opacity-mode','auto');});await overlay.reload();await overlay.locator('.floating-lyrics').waitFor();
const panel=overlay.locator('.floating-lyrics');const slider=overlay.getByRole('slider',{name:'Background opacity'});
const alpha=()=>panel.evaluate(el=>Number(getComputedStyle(el).backgroundColor.match(/[,/]\s*([\d.]+)\)?$/)?.[1]));
assert.equal(await overlay.getByRole('button',{name:'Automatic background opacity'}).count(),0);
assert.equal(await slider.inputValue(),'23');await overlay.waitForTimeout(300);
assert(Math.abs(await alpha()-.23)<.01);
await overlay.mouse.move(-20,-20);await overlay.waitForTimeout(3100);assert(Math.abs(await alpha()-.23)<.01);
await overlay.mouse.move(160,130);await overlay.waitForTimeout(300);assert(Math.abs(await alpha()-.23)<.01);
await slider.focus();await slider.press('Home');await slider.press('ArrowRight');assert.equal(await slider.inputValue(),'1');
await overlay.reload();await panel.waitFor();assert.equal(await slider.inputValue(),'1');
await overlay.getByRole('button',{name:'Enable click-through'}).click({force:true});await overlay.waitForFunction(()=>document.querySelector('main').classList.contains('is-locked'));await overlay.waitForTimeout(550);assert.equal(await alpha(),0);await overlay.evaluate(()=>window.__TAURI_INTERNALS__.invoke('lyric_overlay_control',{action:'unlock'}));
await overlay.emulateMedia({reducedMotion:'reduce'});assert.equal(await panel.evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
await overlay.waitForFunction(()=>!document.querySelector('main').classList.contains('is-locked'));await overlay.waitForTimeout(300);assert(Math.abs(await alpha()-.01)<.01);
const result={autoRemoved:true,oldAutoPreferenceIgnored:true,manualPreserved:true,noIdleOrHoverFading:true,sliderPersisted:true,lockedLyricsOnly:true,reducedMotion:true};mkdirSync('test-results/overlay-opacity',{recursive:true});writeFileSync('test-results/overlay-opacity/report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{if(browser)await browser.close();app.kill();}
