// Real isolated Tauri/WebView2 playback + SQLite. Synthetic audio, no user database.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';

const root = process.cwd();
const data = path.resolve('.test-data', `listening-${Date.now()}`);
const fixtures = path.resolve('.test-data/fixtures');
const executable = path.resolve('src-tauri/target/debug/lumaire-tracker.exe');
const results = path.resolve('test-results');
mkdirSync(results, { recursive: true });
const report = { checks: [], data, coverage: 'Real WebView2 audio clock, Tauri commands and SQLite; synthetic local audio. No human audibility or live YouTube assertion.' };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let app, browser, page;
async function check(name, fn) { await fn(); report.checks.push(name); console.log(`PASS ${name}`); }
const invoke = (cmd, args = {}) => page.evaluate(([cmd,args]) => window.__TAURI_INTERNALS__.invoke(cmd,args), [cmd,args]);
async function launch(seed) {
  const port = await new Promise(resolve => {
    const server = net.createServer(); server.listen(0,'127.0.0.1',() => { const port = server.address().port; server.close(() => resolve(port)); });
  });
  app = spawn(executable, [], { cwd: root, windowsHide: true, env: { ...process.env,
    LUMAIRE_DATA_DIR: data, WEBVIEW2_USER_DATA_FOLDER: path.join(data,`webview-${port}`),
    ...(seed ? {LUMAIRE_TEST_FIXTURES: fixtures} : {}),
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
  }});
  app.stderr.on('data', chunk => { report.nativeLog = ((report.nativeLog || '') + chunk.toString()).slice(-5000); });
  let ready = false;
  for (let i=0;i<100;i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) { ready=true; break; } } catch {}
    await delay(250);
  }
  assert(ready, 'WebView2 endpoint did not start');
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  for (let i=0;i<80;i++) {
    page = browser.contexts().flatMap(c=>c.pages()).find(p=>/1420|tauri.localhost/.test(p.url()));
    if (page) break;
    await delay(250);
  }
  assert(page);
  page.on('pageerror',error=> { report.rendererErrors ??= []; report.rendererErrors.push(error.message); });
  page.on('console',message=> { if(message.type()==='error') {report.consoleErrors ??=[]; report.consoleErrors.push(message.text().slice(0,1000));} });
  await page.getByRole('button',{name:'Open library',exact:true}).click();
  await page.getByRole('heading',{name:'Your library.',exact:true}).waitFor();
}
async function close() { await browser?.close(); browser=null; app?.kill(); app=null; await delay(1200); }
async function status(value) { await page.waitForFunction(value=>document.querySelector('[data-testid="playback-state"]')?.textContent===value,value); }
async function waitRecords(count, timeout=20000) {
  const until=Date.now()+timeout;
  while(Date.now()<until) {
    const snapshot=await invoke('get_listening_history');
    if(snapshot.records.length===count) return snapshot;
    await delay(250);
  }
  throw new Error(`Expected ${count} qualified records; ${await page.locator('body').innerText()}`);
}
async function seek(time) {
  await page.getByRole('slider',{name:'Seek playback',exact:true}).evaluate((el,value)=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));
    el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}));
  },time);
}
try {
  await launch(true);
  const original = await invoke('load_library');
  const first = original.tracks.find(t=>t.fileName.includes('Morning light'));
  assert(first);
  await page.getByRole('button',{name:'Open Local',exact:true}).click();
  await check('real local audio qualifies only after genuine playback', async()=>{
    await page.getByRole('button',{name:`Play ${first.title}`,exact:true}).click();
    await status('playing');
    await delay(1800);
    assert.equal((await invoke('get_listening_history')).records.length,0);
    await waitRecords(1);
    await page.getByRole('button',{name:'Pause',exact:true}).click(); await status('paused');
    const r=(await invoke('get_listening_history')).records[0];
    assert.equal(r.trackId,first.id); assert(r.listenedMs>=10000 && r.listenedMs<18000);
    assert.equal(Object.values(r.days).reduce((a,b)=>a+b,0),r.listenedMs);
  });
  let before;
  await check('pause and forward/back seeks do not add listening time', async()=>{
    before=(await invoke('get_listening_history')).records[0];
    await seek(30); await delay(1800); await seek(2); await delay(600);
    const after=(await invoke('get_listening_history')).records[0];
    assert.equal(after.listenedMs,before.listenedMs);
    assert.equal(after.id,before.id);
  });
  await check('resume continues same listening record and preserves library membership',async()=>{
    await page.getByRole('button',{name:'Play',exact:true}).click(); await status('playing');
    await delay(2200); await page.getByRole('button',{name:'Pause',exact:true}).click(); await status('paused');
    const after=(await invoke('get_listening_history')).records[0];
    assert.equal(after.id,before.id); assert(after.listenedMs>before.listenedMs+1500);
    assert.deepEqual((await invoke('load_library')).tracks.map(t=>t.id).sort(),original.tracks.map(t=>t.id).sort());
    before=after;
  });
  await check('recap and history render real native records, actions and responsive layout',async()=>{
    await page.getByRole('button',{name:'History',exact:true}).click();
    await page.getByRole('heading',{name:'Your listening recap.'}).waitFor();
    assert.equal(await page.getByRole('combobox',{name:'Listening date range'}).inputValue(),'year');
    for (const range of ['7','30','90','all','year']) await page.getByRole('combobox',{name:'Listening date range'}).selectOption(range);
    await page.getByRole('region',{name:'Top tracks'}).getByRole('button',{name:first.title,exact:true}).waitFor();
    await page.screenshot({path:path.join(results,'listening-recap-desktop.png')});
    await page.getByRole('tab',{name:'Recent plays',exact:true}).click();
    await page.getByRole('button',{name:`Add ${first.title} to queue`}).click();
    await page.getByRole('combobox',{name:'Recent plays rows per page'}).selectOption('25');
    await page.screenshot({path:path.join(results,'listening-history-desktop.png')});
    await page.getByRole('button',{name:'Hide queue',exact:true}).first().click();
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('tab',{name:'Your recap',exact:true}).click();
    await page.screenshot({path:path.join(results,'listening-recap-mobile-width.png')});
    assert(await page.locator('.listening-view').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    await page.setViewportSize({width:1440,height:920});
  });
  await close(); await launch(false);
  await check('SQLite survives process restart without crediting downtime',async()=>{
    const restored=(await invoke('get_listening_history')).records;
    assert.equal(restored.length,1); assert.equal(restored[0].id,before.id);
    assert.equal(restored[0].listenedMs,before.listenedMs);
    await delay(1300); assert.equal((await invoke('get_listening_history')).records[0].listenedMs,before.listenedMs);
  });
  await check('disable stops recording; clear removes durable records and rejects stale writes',async()=>{
    await page.getByRole('button',{name:'Settings & sources',exact:true}).click();
    await page.getByRole('checkbox',{name:/Record listening history/}).uncheck();
    await page.getByRole('button',{name:'Play',exact:true}).click(); await status('playing'); await delay(2200);
    await page.getByRole('button',{name:'Pause',exact:true}).click(); await status('paused');
    const old=(await invoke('get_listening_history'));
    assert.equal(old.records[0].listenedMs,before.listenedMs);
    await page.getByRole('button',{name:'Clear history',exact:true}).click();
    await waitRecords(0);
    assert.equal(await invoke('checkpoint_listening',{generation:old.generation,record:old.records[0]}),false);
    await delay(1100); assert.equal((await invoke('get_listening_history')).records.length,0);
  });
  report.passed=true;
} catch(error) {
  if(page) { report.lastUrl=page.url(); report.lastBody=await page.locator('body').innerText().catch(()=>null); }
  report.passed=false; report.error=error.stack; console.error(error); process.exitCode=1;
} finally {
  await close(); writeFileSync(path.join(results,'listening-desktop-report.json'),JSON.stringify(report,null,2));
}
