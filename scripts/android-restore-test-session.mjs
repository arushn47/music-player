// Restore only the app session captured before this integration's device tests.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
const adb = 'C:/Users/ARUSH/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const pkg = 'app.lumaire.player';
const original = JSON.parse(readFileSync(process.argv[2] || 'test-results/android-before-integration-tests.json', 'utf8'));
function device(args) {
  const result = spawnSync(adb, args, {encoding:'utf8', windowsHide:true, timeout:30000});
  if (result.status !== 0) throw Error((result.stderr || result.stdout).slice(-500));
  return result.stdout.trim();
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser, port;
async function connect() {
  for (let i=0;i<20;i++) {
    try {
      const pid = device(['shell','pidof',pkg]).split(' ')[0];
      port = device(['forward','tcp:0',`localabstract:webview_devtools_remote_${pid}`]);
      const metadata = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      browser = await chromium.connectOverCDP(metadata.webSocketDebuggerUrl);
      const page = browser.contexts()[0].pages()[0];
      await page.waitForFunction(() => !!window.__TAURI_INTERNALS__);
      await delay(1500);
      return page;
    } catch(error) {
      if(browser) await browser.close().catch(()=>{});
      if(port) device(['forward','--remove',`tcp:${port}`]);
      browser=null;port=null;
      if(i===19) throw error;
      await delay(500);
    }
  }
}
async function disconnect() {
  if(browser) await browser.close().catch(()=>{});
  if(port) device(['forward','--remove',`tcp:${port}`]);
  browser=null;port=null;
}
try {
  device(['shell','am','start','-n',`${pkg}/.MainActivity`]);
  let page = await connect();
  const before = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('load_library'));
  const remappedFixtures = {};
  for (const track of original.tracks) {
    if (before.tracks.some(row=>row.id===track.id)) continue;
    // The historical snapshot predates this synthetic fixture's re-import.
    // Only map that exact owned fixture; never infer aliases for user music.
    const matches = before.tracks.filter(row=>row.fileName===track.fileName && row.title===track.title
      && row.format===track.format && Math.abs(row.duration-track.duration)<1);
    if(track.fileName!=='Lumaire - Android prototype.wav' || matches.length!==1)
      throw Error('A pre-test library track is missing; refusing an inferred restoration.');
    remappedFixtures[track.id]=matches[0].id;
  }
  function remap(value) {
    if(typeof value==='string') return remappedFixtures[value] || value;
    if(Array.isArray(value)) return value.map(remap);
    if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([key,item])=>[remappedFixtures[key] || key,remap(item)]));
    return value;
  }
  original.session=remap(original.session);
  original.tracks=original.tracks.map(track=>({...track,id:remappedFixtures[track.id] || track.id}));
  await page.evaluate(async session => {
    await window.__TAURI_INTERNALS__.invoke('android_playback',{action:'stop'});
    await window.__TAURI_INTERNALS__.invoke('save_session',{session});
  }, original.session);
  device(['shell','am','force-stop',pkg]);
  await disconnect();
  device(['shell','am','start','-n',`${pkg}/.MainActivity`]);
  page = await connect();
  const actual = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('load_library'));
  const same = value => JSON.stringify(value);
  const fields = ['queue','queueTracks','currentId','favorites','history','lyrics','playlists','settings'];
  const checked = fields.map(field=>({field, matches:same(actual.session[field])===same(original.session[field])}));
  // Object key order is not semantically significant.
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value==='object'
    ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])) : value;
  checked.forEach(row=>{ row.matches=same(canonical(actual.session[row.field]))===same(canonical(original.session[row.field])); });
  const report = {checked, remappedFixtures, libraryTrackIdsPreserved: original.tracks.every(track=>actual.tracks.some(row=>row.id===track.id)), addedTrackIds:actual.tracks.filter(track=>!original.tracks.some(row=>row.id===track.id)).map(track=>track.id)};
  report.referenceDiagnostics = {
    expectedHistoryTrackIds:original.session.history.map(row=>row.trackId),
    actualHistoryTrackIds:actual.session.history.map(row=>row.trackId),
    expectedLyricTrackIds:Object.keys(original.session.lyrics),
    actualLyricTrackIds:Object.keys(actual.session.lyrics),
  };
  report.passed=checked.every(row=>row.matches)&&report.libraryTrackIdsPreserved&&report.addedTrackIds.length===0;
  writeFileSync('test-results/android-session-restoration.json',JSON.stringify(report,null,2));
  if(!report.passed) throw Error('Restored session differs; inspect the restoration report.');
  console.log('PASS pre-test queue, lyrics, playlists, preferences and library membership restored');
} finally { await disconnect(); }
