// Real integrated Android bridge/device verification. Never loads .env.
import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
const adb = 'C:/Users/ARUSH/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const pkg = 'app.lumaire.player';
const file = process.argv.includes('--challenge-only') ? 'test-results/android-live-challenge.json' : process.argv.includes('--ui-only') ? 'test-results/android-streaming-ui.json' : 'test-results/android-integrated-streaming.json';
const report = { startedAt: new Date().toISOString(), checks: [], failures: [], gaps: [] };
let browser, page, port;
function device(args, required = true) {
  const r = spawnSync(adb, args, { encoding: 'utf8', timeout: 60000, windowsHide: true });
  if (required && r.status !== 0) throw Error((r.stderr || r.stdout).slice(-1000));
  return r.stdout.trim();
}
const delay = ms => new Promise(r => setTimeout(r, ms));
async function invoke(command, args = {}) { return page.evaluate(({command,args}) => window.__TAURI_INTERNALS__.invoke(command,args), {command,args}); }
async function state() { return invoke('android_playback', {action:'state'}); }
async function until(predicate, seconds = 30) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) { const s = await state(); if (predicate(s)) return s; await delay(400); }
  throw Error(`Native state timeout: ${JSON.stringify(await state())}`);
}
function assert(condition, message) { if (!condition) throw Error(message); }
async function check(name, fn) {
  try { const evidence = await fn(); report.checks.push({ name, evidence }); console.log('PASS '+name); }
  catch (error) {
    const evidence = page ? {headings:await page.locator('h1').allTextContents(),url:page.url()} : {};
    if(page) await page.screenshot({path:'test-results/android-streaming-failure.png'}).catch(()=>{});
    report.failures.push({ name, error:String(error), evidence }); console.log('FAIL '+name+': '+String(error).slice(0,500));
  }
  writeFileSync(file, JSON.stringify(report,null,2));
}
try {
  device(['shell','am','start','-n',`${pkg}/.MainActivity`]);
  for (let attempt=0; attempt<30; attempt++) {
    try {
      const pid = device(['shell','pidof',pkg]).split(' ')[0];
      port = device(['forward','tcp:0',`localabstract:webview_devtools_remote_${pid}`]);
      const meta = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      browser = await chromium.connectOverCDP(meta.webSocketDebuggerUrl);
      page = browser.contexts()[0].pages()[0];
      report.rendererErrors = [];
      page.on('pageerror', error => report.rendererErrors.push(String(error).slice(0,1200)));
      page.on('console', message => { if(message.type()==='error') report.rendererErrors.push(message.text().slice(0,1200)); });
      await page.waitForFunction(() => !!window.__TAURI_INTERNALS__,null,{timeout:3000});
      await delay(2000); // Let React finish restoring the persisted view/session.
      break;
    } catch(error) {
      if(browser) await browser.close().catch(()=>{});
      if(port) device(['forward','--remove',`tcp:${port}`],false);
      page=null; browser=null; port=null;
      if(attempt===29) throw error;
      await delay(500);
    }
  }
  report.device = {api:device(['shell','getprop','ro.build.version.sdk']),pageSize:device(['shell','getconf','PAGE_SIZE'])};
  const apk = 'src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk';
  report.apk = {bytes:statSync(apk).size, sha256:createHash('sha256').update(readFileSync(apk)).digest('hex')};
  if (process.argv.includes('--challenge-only')) {
    let solved = false;
    report.attempts = [];
    for (const client of ['web_safari','web_embedded','web','tv']) {
      try {
        const result = await invoke('android_source',{operation:'challenge',videoId:'aqz-KE-bpKQ',client});
        if (result.liveChallengeSolved && result.diagnostic.challengesSolved > 0) {
          report.checks.push({name:'Actual live JS challenge solved through bundled QuickJS/EJS',evidence:{client,...result.diagnostic}});
          console.log('PASS actual live JS challenge via '+client); solved = true; break;
        }
      } catch (error) {
        report.attempts.push({client,error:String(error), diagnostic:await invoke('android_source',{operation:'diagnostics'})});
      }
    }
    report.passed = solved;
    if (!solved) report.gaps.push('No live JS challenge was successfully solved in these executed attempts.');
  } else if (process.argv.includes('--ui-only')) {
    const before = await invoke('load_library');
    if (!existsSync('test-results/android-before-song-tap-tests.json'))
      writeFileSync('test-results/android-before-song-tap-tests.json',JSON.stringify(before));
    await check('Discover UI searches and plays the permitted source without implicit library saves',async()=>{
      await page.getByRole('combobox',{name:'Navigate your library'}).selectOption('discover');
      await delay(800);
      report.navigation = {headings:await page.locator('h1,h2').allTextContents(), inputs:await page.locator('input').evaluateAll(nodes=>nodes.map(n=>({label:n.getAttribute('aria-label'),placeholder:n.getAttribute('placeholder')})))};
      writeFileSync(file,JSON.stringify(report,null,2));
      const input=page.getByRole('textbox',{name:'Search YouTube'});
      await input.waitFor(); await input.fill('aqz-KE-bpKQ'); await input.press('Enter');
      let externalPopup=false;
      page.on('popup',()=>{externalPopup=true;});
      const originalPageUrl=page.url();
      // Tap the large title/artwork target, not the small play icon. This used
      // to open the YouTube video instead of invoking native audio playback.
      const play=page.locator('.track-row').getByRole('button',{name:/^Listen to Big Buck Bunny 60fps 4K/}).first();
      await play.waitFor({timeout:60000}); await play.click();
      const playing=await until(s=>s.status==='playing'&&s.id==='youtube:aqz-KE-bpKQ'&&s.time>1,60);
      await delay(1500);
      assert(!externalPopup && page.url()===originalPageUrl,'Tapping the song opened an external page');
      assert(JSON.stringify((await invoke('load_library')).tracks.map(t=>t.id))===JSON.stringify(before.tracks.map(t=>t.id)),'UI play saved a heard track');
      return playing;
    });
    await check('Explicit queue action adds the selected online track without a library insert',async()=>{
      const current=await invoke('load_library'); const count=current.session.queue.length;
      const row=page.locator('.track-row').filter({has:page.getByRole('button',{name:/^Play Big Buck Bunny 60fps 4K/})}).first();
      await row.locator('summary').click(); await row.getByRole('button',{name:'Add to queue',exact:true}).click();
      let snapshot;
      for(let i=0;i<30;i++){await delay(300);snapshot=await invoke('load_library');if(snapshot.session.queue.length===count+1) break;}
      assert(snapshot.session.queue.length===count+1,'Explicit queue action did not persist');
      assert(JSON.stringify(snapshot.tracks.map(t=>t.id))===JSON.stringify(before.tracks.map(t=>t.id)),'Queue added a library track');
      await page.screenshot({path:'test-results/android-integrated-discover.png'});
      return {before:count,after:snapshot.session.queue.length};
    });
    report.passed=report.failures.length===0;
  } else {
    const before = await invoke('load_library');
    if (!existsSync('test-results/android-before-integration-tests.json')) writeFileSync('test-results/android-before-integration-tests.json',JSON.stringify(before));
    await check('Bundled runtime is available in the integrated app', async()=> {
      const result = await invoke('android_source',{operation:'probe'}); assert(result.available,'Runtime unavailable'); return result;
    });
    await check('Real Android discovery returns the permitted fixture without saving it',async()=>{
      const result = await invoke('android_source',{operation:'search',query:'aqz-KE-bpKQ',maxResults:3});
      assert(result.results.some(t=>t.id==='aqz-KE-bpKQ'),'Fixture not found in actual search');
      assert(JSON.stringify((await invoke('load_library')).tracks.map(t=>t.id))===JSON.stringify(before.tracks.map(t=>t.id)),'Search added a track to the library');
      return result.results.map(t=>({id:t.id,title:t.title}));
    });
    await check('Actual online audio loads through the integrated Media3 service',async()=>{
      await invoke('android_playback',{action:'volume',value:0.15});
      await invoke('android_playback',{action:'load',id:'youtube:aqz-KE-bpKQ',autoplay:true});
      const first = await until(s=>s.status==='playing'&&s.time>1,45); await delay(2100);
      const next = await state(); assert(next.time>first.time+1,'Native time did not advance');
      const diagnostic=await invoke('android_source',{operation:'diagnostics'});
      assert(diagnostic.streamProbeStatus===206,'Bounded stream validation did not pass');
      return {first,next,diagnostic};
    });
    await check('Online pause/resume and seek use real native audio',async()=>{
      await invoke('android_playback',{action:'pause'}); const paused=await state(); await delay(1400);
      assert(Math.abs((await state()).time-paused.time)<0.2,'Paused clock advanced');
      assert(paused.seekable,'Source was not seekable');
      await invoke('android_playback',{action:'seek',value:30}); await invoke('android_playback',{action:'play'});
      const sought=await until(s=>s.status==='playing'&&s.time>=30&&s.time<36); return {paused,sought};
    });
    await check('Integrated online audio continues screen-off in its foreground service',async()=>{
      const before=await state(); device(['shell','input','keyevent','3']); device(['shell','input','keyevent','223']);
      try { await delay(6500); const after=await state(); assert(after.status==='playing'&&after.time>before.time+5,'Background audio stopped');
        const services=device(['shell','dumpsys','activity','services',pkg]); assert(services.includes('isForeground=true'),'No foreground service');return {before,after};
      } finally { device(['shell','input','keyevent','224']); device(['shell','am','start','-n',`${pkg}/.MainActivity`]); }
    });
    await check('Cancelling an active integrated resolution preserves currently playing audio',async()=>{
      const pending=invoke('android_playback',{action:'load',id:'youtube:aqz-KE-bpKQ',autoplay:true}).then(()=>({resolved:true}),error=>({error:String(error)}));
      await delay(500); const started=Date.now(); await invoke('android_playback',{action:'cancel'});
      const result=await pending; assert(result.error,'Cancelled request unexpectedly loaded');
      await delay(500); assert(!device(['shell','pidof',`${pkg}:resolver`],false),'Resolver survived cancellation');
      assert((await state()).status==='playing','Cancellation stopped existing audio'); return {result,cancellationMs:Date.now()-started};
    });
    await check('Unavailable source errors preserve audio and never save heard tracks',async()=>{
      let error; try { await invoke('android_playback',{action:'load',id:'youtube:___________',autoplay:true}); } catch(e){error=String(e);}
      assert(error?.includes('unavailable'),'Source error was not meaningful: '+error);
      assert((await state()).status==='playing','Unavailable source stopped prior playback');
      assert(JSON.stringify((await invoke('load_library')).tracks.map(t=>t.id))===JSON.stringify(before.tracks.map(t=>t.id)),'Playing inserted a library track');
      return {error};
    });
    report.storage=await invoke('android_source',{operation:'diagnostics'});
    report.passed=report.failures.length===0;
  }
} catch(error) { report.failures.push({name:'Harness',error:String(error)}); report.passed=false; console.error(String(error)); }
finally {
  if (page) try { await invoke('android_playback',{action:'pause'}); } catch{}
  if (browser) await browser.close().catch(()=>{});
  if (port) device(['forward','--remove',`tcp:${port}`],false);
  report.finishedAt=new Date().toISOString(); writeFileSync(file,JSON.stringify(report,null,2));
}
process.exitCode=report.passed?0:1;
