// Controlled public-playlist metadata; no service login, cookies or audio downloads.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const out = path.resolve('test-results/playlist-import'); mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'harness.html'), `<!doctype html><html><body><div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlaylistImport} from '/src/components/views/PlaylistImport.tsx';
import {collections} from '/src/adapters/collections.ts';
import {mergePlaylistImport} from '/src/domain/playlist-import.ts';
import {item} from '/src/domain/types.ts';import '/src/style.css';import '/src/components/views/collections.css';
const song=id=>({id:'itunes:'+id,metadataSourceId:'itunes:'+id,title:'Song '+id,artist:'Artist',album:'Album',duration:60,format:'catalog',fileName:'',missing:false});
window.trackCount=2;
collections.readPlaylistLink=async()=>({name:'Malayalam',warning:'',rows:Array.from({length:window.trackCount},(_,i)=>({...song(i+1),track:song(i+1)}))});
function Harness(){
 const [playlists,setPlaylists]=React.useState([]),[version,setVersion]=React.useState(0);
 window.playlists=playlists;
 window.seedDuplicates=()=>{setPlaylists([{id:'a',name:'Malayalam',items:[item('itunes:1')]},{id:'b',name:'Malayalam',items:[item('itunes:1'),item('itunes:2')]}]);setVersion(v=>v+1);};
 return React.createElement(React.Fragment,null,
  React.createElement('button',{onClick:()=>setVersion(v=>v+1)},'Import another'),
  React.createElement(PlaylistImport,{key:version,playlists,onImport:async(name,tracks,options)=>{
   const result=mergePlaylistImport(playlists,name,tracks,tracks,options);setPlaylists(result.playlists);window.result={added:result.added,merged:result.merged};
  }}));
}createRoot(document.getElementById('root')).render(React.createElement(Harness));
</script></body></html>`);
const report = { checks: [], limitation: 'Controlled metadata and browser state; domain tests cover identity and merging. No live playlist-provider availability check.' };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await page.goto('http://127.0.0.1:1420/test-results/playlist-import/harness.html');
  const preview = async link => {
    await page.locator('#hub-link-input').fill(link);
    await page.getByRole('button', { name: 'Continue to Match' }).click();
    await page.getByRole('button', { name: /^Import \d+ tracks$/ }).waitFor();
  };
  const submit = () => page.getByRole('button', { name: /^Import \d+ tracks$/ }).click();
  const next = () => page.getByRole('button', { name: 'Import another', exact: true }).click();
  await preview('https://www.youtube.com/playlist?list=PLabcdefghij'); await submit();
  await page.waitForFunction(() => window.playlists.length === 1);
  await next(); await preview('https://music.youtube.com/playlist?list=PLabcdefghij&si=tracking');
  await page.getByText('Already imported.', { exact: false }).waitFor(); await submit();
  assert.equal(await page.evaluate(() => window.playlists.length), 1); assert.equal(await page.evaluate(() => window.result.added), 0);
  await page.evaluate(() => window.trackCount = 3); await next(); await preview('https://www.youtube.com/playlist?list=PLabcdefghij'); await submit();
  await page.waitForFunction(() => window.playlists[0].items.length === 3);
  report.checks.push('Reimporting the same link, including YouTube Music variants, updates one playlist and adds only new songs');
  await next(); await preview('https://open.spotify.com/playlist/1234567890123456789012');
  assert(await page.getByRole('button', { name: /^Import \d+ tracks$/ }).isDisabled());
  await page.getByLabel('Import separately', { exact: true }).check(); await submit();
  await page.waitForFunction(() => window.playlists.length === 2);
  report.checks.push('Same-name, different-source import requires an explicit choice and can stay separate');
  await page.evaluate(() => window.seedDuplicates()); await preview('https://www.youtube.com/playlist?list=PLabcdefghij');
  await page.getByLabel(/Merge songs from all 2/).check(); await submit();
  await page.waitForFunction(() => window.playlists.length === 1 && window.playlists[0].items.length === 3);
  report.checks.push('Explicit merge combines existing duplicate playlists without repeated songs');
  await page.screenshot({ path: path.join(out, 'review.png') }); console.log(JSON.stringify(report));
} finally { writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
