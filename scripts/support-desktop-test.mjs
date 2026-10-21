// Isolated real Windows app; opens one public GitHub page, never stars/posts/pays.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';

const output = path.resolve('test-results/support'); mkdirSync(output, {recursive:true});
const fixtures=path.join(output,'fixtures');mkdirSync(fixtures,{recursive:true});
const wav=Buffer.alloc(44+64000,128);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(8000,28);wav.writeUInt16LE(1,32);wav.writeUInt16LE(8,34);wav.write('data',36);wav.writeUInt32LE(64000,40);writeFileSync(path.join(fixtures,'Controller test.wav'),wav);
const port = await new Promise(resolve => {const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const data = path.resolve('.test-data/support-'+Date.now());
const app = spawn(path.resolve('src-tauri/target/debug/lumaire.exe'), [], {windowsHide:true,stdio:'ignore',env:{...process.env,LUMAIRE_DATA_DIR:data,LUMAIRE_TEST_FIXTURES:fixtures,WEBVIEW2_USER_DATA_FOLDER:path.join(data,'webview'),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port='+port}});
const report = {checks:[], limits:['Browser handoff accepted by the OS; browser login and third-party pages are not controlled.','Android runtime and payments are not tested.']};
let browser;
try {
  for(let i=0;i<150;i++){try{if((await fetch('http://127.0.0.1:'+port+'/json/version')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);
  const page=browser.contexts()[0].pages()[0];
  await page.locator('.now-playing').waitFor();
  async function controller(){assert.equal(await page.locator('footer[aria-label="Playback controls"]').count(),1);assert(await page.locator('.transport').isVisible());const rect=await page.locator('.transport').boundingBox();assert(rect.y+rect.height<=await page.evaluate(()=>innerHeight)+1);}
  await controller();
  for(const name of ['Library','Lyric room','Discover']){await page.getByRole('button',{name:name==='Library' ? /^Library\b/ : name,exact:true}).click();await controller();}
  report.checks.push('Exactly one visible playback bar on Discover, Library and Lyric room, including empty/loading state');
  await page.getByRole('button',{name:/^Library\b/}).click();
  await page.getByRole('button',{name:'Open Local',exact:true}).click();
  await page.getByRole('button',{name:'Play Controller test',exact:true}).click();
  await page.getByRole('button',{name:'Open expanded player',exact:true}).click();
  await page.getByRole('dialog',{name:'Now playing',exact:true}).waitFor();
  await controller();
  assert.equal(await page.locator('.expanded-transport').count(),1);
  await page.getByRole('button',{name:'Close expanded player',exact:true}).click();
  await page.locator('.expanded-player').waitFor({state:'detached'});
  await controller();
  assert.equal(await page.locator('.expanded-transport').count(),0);
  report.checks.push('Local synthetic track plays; expanding uses one controller and closing restores the normal playback bar');
  await page.screenshot({path:path.join(output,'controller-restored.png')});
  await page.getByRole('button',{name:'Settings & sources',exact:true}).click();
  await page.getByRole('button',{name:'Support & contribute',exact:true}).click();
  await page.getByRole('heading',{name:'Support & contribute',exact:true}).waitFor();
  assert.equal(await page.locator('.support-section a').count(),8);
  assert.equal(await page.getByText('Leave a tip',{exact:true}).count(),0);
  for(const [name,url] of [['Instagram profile','https://www.instagram.com/_.arush.menon._/'],['LinkedIn profile','https://www.linkedin.com/in/arushn47'],['Visit website','https://arush.vercel.app/']]) assert.equal(await page.getByRole('link',{name,exact:true}).getAttribute('href'),url);
  report.checks.push('Settings navigation, eight correct project/social links, no payment or fake voting controls');
  const before=page.url();
  await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:opener|open_url',{url:'https://github.com/arushn47',with:null}));
  assert.equal(page.url(),before);
  report.checks.push('Native default-browser handoff succeeds without navigating Lumaire');
  const denied=await page.evaluate(async()=>{try{await window.__TAURI_INTERNALS__.invoke('plugin:opener|open_url',{url:'https://example.com'});return false;}catch{return true;}});
  assert(denied);report.checks.push('Native capability rejects unrelated hosts');
  await page.screenshot({path:path.join(output,'desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('link',{name:'Visit website',exact:true}).scrollIntoViewIfNeeded();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.screenshot({path:path.join(output,'narrow.png')});
  report.checks.push('390px layout keeps links reachable without horizontal overflow');
  console.log(JSON.stringify(report));
} finally {
  writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  if(browser)await browser.close();app.kill();
}
