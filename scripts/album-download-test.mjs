// React UI regression with controlled downloads; no recording is fetched.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';

const output = path.resolve('test-results/album-download');
mkdirSync(output, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}
const base = process.env.LUMAIRE_TEST_URL || 'http://127.0.0.1:1420';
writeFileSync(path.join(output, 'harness.html'), `<!doctype html><html><body><div id="root"></div><script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
import { AlbumView } from '/src/components/views/AlbumView.tsx';
import { library } from '/src/adapters/native.ts';
import { useAlbumDownloads } from '/src/hooks/useAlbumDownloads.ts';
import '/src/style.css';
const tracks = ['First song', 'Unavailable song', 'Network failure', 'Last song'].map((title, i) => ({id: 'test:'+i, title, artist:'Original test artist', artists:[], album:'Progress test', duration:60}));
library.lookupAlbum = async () => ({info:{id:'test:album', title:'Progress test', artist:'Original test artist', artists:[]}, tracks, partial:false});
window.calls = [];
window.retry = false;
async function download(track, stage, signal) {
    window.calls.push(track.id);
    stage('Finding audio source');
    if (track.id === 'test:0' && (!window.retry || window.hold)) {
      await new Promise(resolve => window.resolveSource = resolve);
      if (signal.aborted) return false;
      stage('Saving offline', 50);
      await new Promise(resolve => {window.finishDownload = resolve; signal.addEventListener('abort', resolve, {once:true});});
      if (signal.aborted) return false;
    }
    if (!window.retry && track.id === 'test:2') throw Error('Controlled network failure');
    return window.retry || track.id !== 'test:1';
}
function Harness() {
  const jobs = useAlbumDownloads(download);
  const [visible, setVisible] = React.useState(true);
  return React.createElement(React.Fragment, null,
    React.createElement('button', {onClick:()=>setVisible(!visible)}, 'Switch page'),
    visible ? React.createElement(AlbumView, {
      albumId:'test:album', onBack(){}, onPlayCollection(){window.playClicks=(window.playClicks||0)+1;}, onSaveDiscovery(){}, onFavoriteAlbum(){}, onCatalogAction(){},
      busy:false, downloads:{'test:0':'downloading'}, savedTracks:[], favorites:[], favoriteAlbums:[], onlineAvailable:true,
      onDownloadAlbum:tracks=>jobs.start('test:album',tracks), downloadProgress:jobs.progress['test:album'],
      onPauseDownload:()=>jobs.pause('test:album'), onCancelDownload:()=>jobs.cancel('test:album')
    }) : React.createElement('p', null, 'Another page'));
}
createRoot(document.getElementById('root')).render(React.createElement(Harness));
</script></body></html>`);
const server = process.env.LUMAIRE_TEST_URL ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '1420'], { windowsHide:true, stdio:'ignore' });
const debugPort = await freePort();
const data = path.resolve('.test-data/album-download-'+Date.now());
const app = process.env.LUMAIRE_NATIVE_TEST ? spawn(path.resolve('src-tauri/target/debug/lumaire.exe'), [], {windowsHide:true, stdio:'ignore', env:{...process.env,LUMAIRE_DATA_DIR:data,WEBVIEW2_USER_DATA_FOLDER:path.join(data,'webview'),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port='+debugPort}}) : null;
const report = { checks:[], limitation:'Controlled download callbacks verify UI behavior, not native audio transfer or live catalog audio availability.' };
let browser;
try {
  for (const url of [base, ...(app ? ['http://127.0.0.1:'+debugPort+'/json/version'] : [])]) {
    let ready = false;
    for (let i=0;i<150;i++) { try { if ((await fetch(url)).ok) {ready=true;break;} } catch {} await delay(200); }
    assert(ready, `Startup failed: ${url}`);
  }
  browser = app ? await chromium.connectOverCDP('http://127.0.0.1:'+debugPort) : await chromium.launch({channel:'msedge', headless:true, args:['--no-proxy-server']});
  const page = app ? browser.contexts()[0].pages()[0] : await browser.newPage({viewport:{width:1440,height:920}});
  page.on('pageerror', error => console.error(error.message));
  page.on('requestfailed', r=>console.error('Request failed',r.url(),r.failure()));
  if(app) {
    await page.locator('.now-playing').waitFor();
    const progress=await page.evaluate(async()=>{
      const {library}=await import('/src/adapters/native.ts');const events=[];
      try {await library.download('missing-progress-fixture',event=>events.push(event));}catch{}
      return events;
    });
    assert.equal(progress[0]?.stage,'resolving');
    report.checks.push('Native download command delivers typed progress through the real Tauri channel');
  }
  await page.goto(base+'/test-results/album-download/harness.html', {waitUntil:'domcontentloaded'});
  await page.getByRole('button', {name:'Download album', exact:true}).click().catch(async e=>{console.log(page.url(),await page.locator('body').innerText());throw e;});
  const status = page.getByRole('status');
  await status.filter({hasText:'Track 1 of 4 · Finding audio source: First song'}).waitFor();
  assert(await page.getByRole('button', {name:'Downloading 0/4', exact:true}).isDisabled());
  await page.evaluate(() => document.querySelector('.album-actions button:nth-child(3)').click());
  assert.equal(await page.evaluate(() => window.calls.length), 1);
  report.checks.push('Immediate source-search feedback, song name and duplicate-click prevention');
  await page.evaluate(() => window.resolveSource());
  await status.filter({hasText:'Saving offline: First song'}).waitFor();
  assert.equal(await page.getByRole('progressbar',{name:'Album download progress'}).getAttribute('value'), '0.5');
  await page.screenshot({path:path.join(output,'saving.png')});
  assert(await page.getByRole('button',{name:'Play First song',exact:true}).isEnabled());
  await page.getByRole('button',{name:'Play album',exact:true}).click();assert.equal(await page.evaluate(()=>window.playClicks),1);
  report.checks.push('Transfer progress advances the album bar between completed songs; album and downloading-track playback stay enabled');
  await page.getByRole('button', {name:'Switch page',exact:true}).click();
  await page.getByText('Another page', {exact:true}).waitFor();
  await page.getByRole('button', {name:'Switch page',exact:true}).click();
  await status.filter({hasText:'Saving offline: First song'}).waitFor();
  assert.equal(await page.evaluate(() => window.calls.length), 1);
  await page.getByRole('button', {name:'Pause after current track',exact:true}).click();
  await page.evaluate(() => window.finishDownload());
  await status.filter({hasText:'Paused · 1 of 4 tracks processed'}).waitFor();
  assert.equal(await page.evaluate(() => window.calls.length), 1);
  await page.getByRole('button', {name:'Switch page',exact:true}).click();
  await page.getByRole('button', {name:'Switch page',exact:true}).click();
  await status.filter({hasText:'Paused · 1 of 4 tracks processed'}).waitFor();
  await page.getByRole('button', {name:'Resume album download',exact:true}).click();
  report.checks.push('Page unmount/remount preserves active work and paused progress; resume continues the same job');
  await status.filter({hasText:'2 of 4 tracks available offline · 2 failed'}).waitFor();
  assert.equal(await page.getByRole('progressbar').getAttribute('value'), '4');
  assert.equal(await page.evaluate(() => window.calls.length), 4);
  await page.getByText('2 failed · Retry download to try again', {exact:true}).click();
  assert(await page.locator('.album-download-progress li').filter({hasText:'Network failure'}).isVisible());
  report.checks.push('False return and thrown failure both allow subsequent tracks; accurate partial result and failed-song list');
  await page.evaluate(() => {window.retry=true;});
  await page.getByRole('button', {name:'Retry download',exact:true}).click();
  await status.filter({hasText:'4 of 4 tracks available offline · Download complete'}).waitFor();
  assert.equal(await page.locator('.album-download-progress details').count(), 0);
  report.checks.push('Retry clears previous failures and reports completion only after all callbacks succeed');
  await page.evaluate(() => {window.hold=true;});
  await page.getByRole('button', {name:'Download album',exact:true}).click();
  await status.filter({hasText:'Finding audio source: First song'}).waitFor();
  await page.evaluate(() => window.resolveSource());
  await status.filter({hasText:'Saving offline: First song'}).waitFor();
  await page.getByRole('button', {name:'Cancel album download',exact:true}).click();
  await status.filter({hasText:'0 of 4 tracks available offline · Cancelled'}).waitFor();
  assert.equal(await page.evaluate(() => window.calls.length), 9);
  report.checks.push('Cancel aborts the active callback and never starts the remaining tracks');
  await page.getByRole('button', {name:'Retry download',exact:true}).click();
  await status.filter({hasText:'Finding audio source: First song'}).waitFor();
  await page.getByRole('button', {name:'Cancel album download',exact:true}).click();
  await status.filter({hasText:'Cancelling download…'}).waitFor();
  await page.evaluate(() => window.resolveSource());
  await status.filter({hasText:'0 of 4 tracks available offline · Cancelled'}).waitFor();
  assert.equal(await page.evaluate(() => window.calls.length), 10);
  report.checks.push('Cancelling during source search waits honestly for that search and never begins a transfer');
  await page.getByRole('button', {name:'Retry download',exact:true}).click();
  await status.filter({hasText:'Finding audio source: First song'}).waitFor();
  await page.evaluate(() => window.resolveSource());
  await status.filter({hasText:'Saving offline: First song'}).waitFor();
  await page.getByRole('button', {name:'Pause after current track',exact:true}).click();
  await page.evaluate(() => window.finishDownload());
  await status.filter({hasText:'Paused · 1 of 4 tracks processed'}).waitFor();
  await page.getByRole('button', {name:'Cancel album download',exact:true}).click();
  await status.filter({hasText:'1 of 4 tracks available offline · Cancelled'}).waitFor();
  assert.equal(await page.evaluate(() => window.calls.length), 11);
  report.checks.push('Cancelling a paused job releases its wait and retains completed tracks');
  report.environment = app ? 'Windows native WebView2, current source served by Vite' : 'Headless Edge';
  console.log(JSON.stringify(report));
} finally {
  writeFileSync(path.join(output,'report.json'), JSON.stringify(report,null,2));
  if (browser) await browser.close();
  app?.kill(); server?.kill();
}
