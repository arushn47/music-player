// Real UI selection -> media playback. Every profile is isolated from the user's library.
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, cpSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
const arg = (name, fallback) => process.argv.includes(name) ? process.argv[process.argv.indexOf(name)+1] : fallback;
const platform = arg('--platform','windows'), label = arg('--label','baseline'), samples = Number(arg('--samples','20'));
assert(['windows','android'].includes(platform) && /^[\w-]+$/.test(label));
assert(Number.isInteger(samples) && samples > 0 && samples <= 100);
const percentile = (values,q) => { const sorted=[...values].sort((a,b)=>a-b); return !sorted.length?null:q===.5?(sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.floor(sorted.length/2)])/2:sorted[Math.ceil(sorted.length*q)-1]; };
if(process.argv.includes('--self-test')) {
 assert.equal(percentile([100,20,10,50],.5),35); assert.equal(percentile(Array.from({length:20},(_,i)=>i+1),.95),19);
 assert.equal(percentile([], .95),null); console.log('PASS percentile self-check'); process.exit(0);
}
const output=path.resolve('test-results',`latency-${platform}-${label}.json`);
mkdirSync(path.dirname(output),{recursive:true});
const data=path.resolve('.test-data/latency',`${platform}-${label}-${Date.now()}`);
const adb='C:/Users/ARUSH/AppData/Local/Android/Sdk/platform-tools/adb.exe', pkg='app.lumaire.player.latency';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function device(args) {
 const r=spawnSync(adb,args,{encoding:'utf8',timeout:60000,windowsHide:true});
 assert.equal(r.status,0,(r.stderr||r.stdout).slice(-600));return r.stdout.trim();
}
function seedStoppedAndroid(session){
 device(['shell','am','force-stop',pkg]);
 const local=path.join(data,'seed.sqlite3');
 for(const suffix of ['', '-wal']){
 const result=spawnSync(adb,['exec-out','run-as',pkg,'cat',`library.sqlite3${suffix}`],{maxBuffer:64*1024*1024});
 if(result.status!==0){assert(suffix==='-wal','Cannot read isolated database');continue;}
 writeFileSync(local+suffix,result.stdout);
 }
 const db=new DatabaseSync(local);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tracks').get().n,0,'Refusing to replace a profile with saved tracks');
 db.exec('PRAGMA journal_mode=DELETE');
 db.prepare('INSERT INTO app_state(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(JSON.stringify(session));
 assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');db.close();
 const bytes=readFileSync(local);
 device(['push',local,'/data/local/tmp/lumaire-latency-seed.sqlite3']);
 device(['shell','run-as',pkg,'cp','/data/local/tmp/lumaire-latency-seed.sqlite3','library.sqlite3']);
 assert.equal(device(['shell','run-as',pkg,'sha256sum','library.sqlite3']).split(/\s/)[0],createHash('sha256').update(bytes).digest('hex'));
 device(['shell','run-as',pkg,'rm','-f','library.sqlite3-wal','library.sqlite3-shm']);
}
let report={platform,label,samples,startedAt:new Date().toISOString(),trials:[],
 definitions:{cold:'Process restart, unresolved catalogue selection. OS/DNS/CDN caches are not cleared.',repeat:'Select a second queue entry for the same catalogue song without restarting; this loads again, rather than resuming.',queue:'Select the next different catalogue entry immediately; no near-end warmup or artificial seek.',audio:'Windows playing event / Android native playing plus media time > 50 ms. No acoustic speaker measurement.',p95:'Nearest-rank empirical p95 of successes; failures reported separately.'}};
if(process.argv.includes('--resume')){
 const previous=JSON.parse(readFileSync(output,'utf8'));assert.equal(previous.label,label);assert.equal(previous.platform,platform);assert.equal(previous.samples,samples);report=previous;
 report.resumeNotes=[...(report.resumeNotes||[]),{at:new Date().toISOString(),previousError:report.error}];delete report.error;delete report.finishedAt;
 const last=Math.max(...report.trials.map(t=>t.index));for(const kind of ['cold','repeat','queue'])if(!report.trials.some(t=>t.index===last&&t.kind===kind))report.trials.push({kind,index:last,ok:false,skipped:true,error:'Chained case not selected after preceding playback failure/auto-advance'});
}
let browser,page,app,port,stayAwake;
const invoke=(command,args={})=>page.evaluate(({command,args})=>window.__TAURI_INTERNALS__.invoke(command,args),{command,args});
function save(){
 report.summary=Object.fromEntries(['cold','repeat','queue'].map(kind=>{
 const rows=report.trials.filter(t=>t.kind===kind),values=rows.filter(t=>t.ok).map(t=>t.ms);
 return [kind,{attempted:rows.filter(t=>!t.skipped).length,blocked:rows.filter(t=>t.skipped).length,succeeded:values.length,medianMs:percentile(values,.5),p95Ms:percentile(values,.95)}];}));
 writeFileSync(output,JSON.stringify(report,null,2));
}
async function close(){
 await browser?.close().catch(()=>{});browser=null;page=null;
 if(app){const owned=app;if(owned.exitCode===null)await new Promise(r=>{owned.once('exit',r);owned.kill();setTimeout(r,2000);});app=null;}
 if(platform==='android'&&port){spawnSync(adb,['forward','--remove',`tcp:${port}`],{windowsHide:true});port=null;}
}
async function launch(){
 if(platform==='windows'){
 port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const executable=path.resolve(arg('--executable','src-tauri/target/debug/lumaire.exe'));
 report.executableSha256=createHash('sha256').update(readFileSync(executable)).digest('hex');
 app=spawn(executable,[],{windowsHide:true,env:{...process.env,LUMAIRE_DATA_DIR:data,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port}`}});
 }else{device(['shell','am','force-stop',pkg]);device(['shell','am','start','-n',`${pkg}/app.lumaire.player.MainActivity`]);}
 for(let i=0;i<120;i++){
 try{
 if(platform==='android'){const pid=device(['shell','pidof',pkg]).split(' ')[0];port=device(['forward','tcp:0',`localabstract:webview_devtools_remote_${pid}`]);}
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);page=browser.contexts()[0].pages()[0];
 await page.waitForFunction(()=>!!window.__TAURI_INTERNALS__,null,{timeout:3000});await delay(800);report.url=page.url();return;
 }catch(e){if(i===119)throw e;await delay(200);}
 }
}
async function instrument(){
 await page.evaluate(()=>{
 const state=window.__latency={events:[],start:null,playing:null};
 document.addEventListener('click',()=>{state.start=performance.now();},{capture:true,once:true});
 if(!window.__originalDebug)window.__originalDebug=console.debug.bind(console);
 console.debug=(...args)=>{if(args[0]==='[Lumaire playback]'){try{const e=JSON.parse(args[1]);state.events.push({stage:e.stage,at:performance.now(),trackId:e.trackId,candidateId:e.candidateId,reason:e.reason});if(e.stage==='playing')state.playing??=performance.now();}catch{}}window.__originalDebug(...args);};
 if(!window.__originalPlay)window.__originalPlay=HTMLMediaElement.prototype.play;
 HTMLMediaElement.prototype.play=function(...args){window.__benchmarkAudio=this;return window.__originalPlay.apply(this,args);};
 });
}
async function trial(kind,index,entry){
 await instrument();
 const selector=platform==='windows'?`[data-queue-entry="${entry}"] .track-title-button`:`[data-queue-entry="${entry}"] .mobile-np-queue-item-main`;
 if(!await page.locator(selector).count()){report.trials.push({kind,index,ok:false,skipped:true,error:'Selection no longer upcoming after a previous failure/auto-advance'});save();return;}
 const start=Date.now();let native;
 try{
 await page.locator(selector).click();
 while(Date.now()-start<120000){
 if(platform==='android'){native=await invoke('android_playback',{action:'state'});if(native.status==='error')throw Error(native.error);if(native.status==='playing'&&native.time>.05)break;}
 else{if(await page.evaluate(()=>window.__latency.playing!==null))break;if(await page.locator('[data-testid="playback-state"]').textContent()==='error')throw Error('Desktop playback error');}
 await delay(40);
 }
 assert(Date.now()-start<120000,'No playback within 120s');
 const result=await page.evaluate(()=>({...window.__latency,end:performance.now()}));const ms=(result.playing??result.end)-result.start;assert(Number.isFinite(ms)&&ms>=0);
 assert(!result.events.some(event=>event.stage==='queue-skip'),'A skipped selection must not count as successful playback');
 const resolved=result.events.filter(event=>event.stage==='source-resolved').at(-1);
 if(resolved)assert.equal(resolved.trackId,report.corpus[(index+(kind==='queue'?1:0))%report.corpus.length].id,'The selected recording changed');
 if(platform==='android'&&resolved)assert.equal(native.id,`youtube:${resolved.candidateId}`,'Native audio does not match the verified source');
 report.trials.push({kind,index,ok:true,ms,clickedAt:result.start,endedAt:result.end,playingAt:result.playing,events:result.events,nativeId:native?.id});console.log(`${platform} ${label} ${kind} ${index}: ${Math.round(ms)} ms`);
 if(platform==='android')report.trials.at(-1).resolver=await invoke('android_source',{operation:'diagnostics'});
 if(platform==='android')await invoke('android_playback',{action:'pause'});else await page.evaluate(()=>window.__benchmarkAudio?.pause());
 }catch(e){const end=await page.evaluate(()=>({...window.__latency,end:performance.now()}));report.trials.push({kind,index,ok:false,error:String(e),elapsedMs:end.end-end.start,events:end.events});console.log(`${platform} ${label} ${kind} ${index}: FAILED ${String(e).slice(0,120)}`);}
 save();
}
try{
 mkdirSync(data,{recursive:true});
 if(platform==='windows'){const components=path.join(process.env.LOCALAPPDATA,'app.lumaire.player/components');if(existsSync(components))cpSync(components,path.join(data,'components'),{recursive:true});}
 else {
 stayAwake=device(['shell','settings','get','global','stay_on_while_plugged_in']);
 report.originalStayAwake=stayAwake;save();
 device(['shell','svc','power','stayon','true']);
 device(['shell','input','keyevent','224']);
 device(['shell','wm','dismiss-keyguard']);
 report.device={model:device(['shell','getprop','ro.product.model']),api:device(['shell','getprop','ro.build.version.sdk'])};
 const expectedApk=path.resolve('.test-data/latency',`${label}-android.apk`);
 assert(existsSync(expectedApk),'Missing labelled benchmark APK');
 const installedPath=device(['shell','pm','path',pkg]).split('\n').find(line=>line.trim().endsWith('/base.apk'))?.trim().replace(/^package:/,'');
 assert(installedPath,'Install the isolated benchmark APK first');
 report.apkSha256=device(['shell','sha256sum',installedPath]).split(/\s/)[0];
 assert.equal(report.apkSha256,createHash('sha256').update(readFileSync(expectedApk)).digest('hex'),'Installed APK does not match the benchmark label');
 }
 await launch();const snapshot=await invoke('load_library');assert.equal(snapshot.tracks.length,0,'Refusing to use a profile containing user tracks');
 await page.evaluate(()=>localStorage.setItem('lumaire-discovery',JSON.stringify({languages:['english'],onboarded:true})));
 const fixtureFile=path.resolve('test-results/latency-catalog.json');let corpus;
 if(existsSync(fixtureFile))corpus=JSON.parse(readFileSync(fixtureFile,'utf8'));
 else{corpus=[];for(const query of ['Never Gonna Give You Up Rick Astley','Despacito Luis Fonsi','Naa Ready Anirudh']){const rows=await invoke('search_catalog',{query,limit:10});const chosen=rows.find(t=>t.id.startsWith('itunes:'))||rows[0];assert(chosen,query);corpus.push(chosen);}writeFileSync(fixtureFile,JSON.stringify(corpus,null,2));}
 report.corpus=corpus.map(({id,title,artist,duration})=>({id,title,artist,duration}));save();
 const session={queue:[],queueTracks:{},shuffleOrder:[],currentId:null,position:0,favoriteArtists:[],favoriteAlbums:[],favorites:[],playlists:[],history:[],lyrics:{},settings:{themeMode:'dark',accentColor:'#c4dca3',volume:.1,repeat:'off',shuffle:false,romanisation:false,translation:false,originalScript:true,originalFirst:true,autoOpenLyrics:false,autoplay:false,estimatedScroll:false,geminiModel:'',lyricSize:32,historyEnabled:false,autoGemini:false}};
 const firstIndex=process.argv.includes('--resume')?Math.max(...report.trials.map(t=>t.index))+1:0;
 for(let index=firstIndex;index<samples;index++){
 const songs=[corpus[index%corpus.length],corpus[index%corpus.length],corpus[(index+1)%corpus.length]];
 session.queue=[{id:'sentinel',trackId:songs[0].id},...songs.map((song,i)=>({id:`bench-${i}`,trackId:song.id}))];session.currentId='sentinel';session.queueTracks=Object.fromEntries(songs.map(song=>[song.id,{...song,metadataSourceId:song.id,format:'catalog',fileName:'',missing:false}]));
 if(platform==='android'){await close();seedStoppedAndroid(session);}else{await delay(500);await invoke('save_session',{session});await close();}
 await launch();
 const restored=await invoke('load_library');
 assert.equal(restored.session.currentId,'sentinel','Fixture was overwritten by a pending session save');
 assert.equal(restored.session.queue[1].trackId,songs[0].id,'Wrong catalogue fixture restored');
 if(await page.locator('.engine-setup-dialog').count())throw Error('Benchmark profile needs pinned streaming engine');
 await page.getByRole('button',{name:'Show queue',exact:true}).filter({visible:true}).first().click();
 if(platform==='android')assert.equal(await page.evaluate(()=>document.visibilityState),'visible','Unlock the phone for foreground playback measurement');
 if(platform==='android')await invoke('android_playback',{action:'volume',value:.1});
 for(const [i,kind]of ['cold','repeat','queue'].entries())await trial(kind,index,`bench-${i}`);
 }
 if(platform==='android'&&label==='combined-fix'){
 const songs=[corpus[0],corpus[1]];
 session.queue=[{id:'sentinel',trackId:songs[0].id},...songs.map((song,i)=>({id:`rapid-${i}`,trackId:song.id}))];
 session.currentId='sentinel';session.queueTracks=Object.fromEntries(songs.map(song=>[song.id,{...song,metadataSourceId:song.id,format:'catalog',fileName:'',missing:false}]));
 await close();seedStoppedAndroid(session);await launch();await page.getByRole('button',{name:'Show queue',exact:true}).click();await invoke('android_playback',{action:'volume',value:.1});await instrument();
 await page.locator('[data-queue-entry="rapid-0"] .mobile-np-queue-item-main').click();await delay(350);
 let active=false;for(let n=0;n<40;n++){const result=spawnSync(adb,['shell','pidof',`${pkg}:resolver`],{encoding:'utf8',windowsHide:true});if(result.stdout.trim()){active=true;break;}await delay(50);}
 assert(active,'Rapid-selection test must interrupt a real active worker');
 const switchedAt=await page.evaluate(()=>performance.now());await page.locator('[data-queue-entry="rapid-1"] .mobile-np-queue-item-main').click();
 let final;const deadline=Date.now()+120000;
 while(Date.now()<deadline){const native=await invoke('android_playback',{action:'state'});const events=await page.evaluate(()=>window.__latency.events);const selected=events.filter(e=>e.stage==='source-resolved'&&e.trackId===songs[1].id).at(-1);
 if(selected&&native.id===`youtube:${selected.candidateId}`&&native.status==='playing'&&native.time>.05){final={nativeId:native.id,events,switchedAt};break;}await delay(50);}
 assert(final,'Newer catalogue selection did not start');assert(!final.events.some(e=>e.stage==='search'&&e.trackId===songs[0].id&&e.at>switchedAt+50),'Cancelled selection launched fallback work');
 await delay(1000);assert.equal((await invoke('android_playback',{action:'state'})).id,final.nativeId,'Stale result replaced the newer selection');
 report.rapidSelection={ok:true,...final};save();console.log('PASS rapid catalogue selection: latest recording wins, no stale fallback work');
 }
}catch(e){report.error=String(e);console.error(e);process.exitCode=1;}
finally{if(platform==='android'){try{await invoke('android_playback',{action:'stop'});}catch{}}await close();if(stayAwake!==undefined){if(stayAwake==='null')device(['shell','settings','delete','global','stay_on_while_plugged_in']);else device(['shell','settings','put','global','stay_on_while_plugged_in',stayAwake]);}report.finishedAt=new Date().toISOString();save();}
