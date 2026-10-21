import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const out = 'test-results/autoplay'; mkdirSync(out, { recursive: true });
writeFileSync(`${out}/harness.html`, `<!doctype html><div id="root"></div><script type="module">
import React from 'react'; import {createRoot} from 'react-dom/client';
import {PlayerBar} from '/src/components/player/PlayerBar.tsx'; import '/src/style.css'; import {usePlayback} from '/src/hooks/usePlayback.ts'; import {defaults,item} from '/src/domain/types.ts';
import {library} from '/src/adapters/native.ts'; import {player} from '/src/player/service.ts';
const seed={id:'youtube:seed',metadataSourceId:'saavn:12345678',title:'Seed',artist:'Singer',format:'youtube',duration:60};
let listener=()=>{}; window.loads=[]; window.lookups=0; window.attempts=[]; window.notices=[];
player.state={status:'playing',time:1,duration:60,trackId:seed.id,playbackId:1};
player.subscribe=fn=>{listener=fn;fn(player.state);return()=>{};};
player.load=async id=>{window.loads.push(id);player.state={...player.state,status:'playing',trackId:id,playbackId:player.state.playbackId+1};listener(player.state);};
player.pause=()=>{window.pauses=(window.pauses||0)+1;player.state={...player.state,status:'paused'};listener(player.state);};player.volume=()=>{};player.precise=()=>{};
library.recommendCatalog=async()=>{window.lookups++;await new Promise(r=>setTimeout(r,400));return [1,2].map(i=>({id:'itunes:'+i,title:'Song '+i,artist:'Singer'}));};
function Harness(){const [session,setSession]=React.useState(()=>({...defaults(),queue:[item(seed.id)],queueTracks:{[seed.id]:seed},currentId:null}));
const ref=React.useRef(session);ref.current=session; const tracksRef=React.useRef([seed]);
const update=fn=>setSession(s=>{const next=fn(s);ref.current=next;return next;});
React.useEffect(()=>{update(s=>({...s,currentId:s.queue[0].id}));},[]);
const api=usePlayback({session,sessionRef:ref,tracksRef,tracks:[seed],view:'discover',setView:()=>{},notify:m=>window.notices.push(m),persist:()=>{},dialogOpen:false,update,
resolveQueuedTrack:async t=>{window.attempts.push(t.id);await new Promise(r=>setTimeout(r,50));if(window.failAll||t.id==='itunes:1')throw Error('Unavailable');return {...t,id:'youtube:verified',format:'youtube'};}});
window.session=session;window.busy=api.autoplayLoading;window.end=()=>{player.state={...player.state,status:'ended'};listener(player.state);};
const noop=()=>{};return React.createElement(React.Fragment,null,React.createElement(PlayerBar,{track:seed,tracks:[seed],session,playback:api.playback,autoplayLoading:api.autoplayLoading,downloads:{},busy:false,view:'discover',setView:noop,onSeek:noop,onTogglePlay:api.togglePlay,onSkip:api.skip,onFavorite:noop,onChoosePlaylist:noop,onDownloadTrack:noop,onDeleteOffline:noop,onSaveOnline:noop,onCancelDownload:noop,onSetting:noop}),React.createElement('button',{onClick:()=>api.skip(1)},'Next'),React.createElement('button',{onClick:()=>update(s=>({...s,settings:{...s.settings,autoplay:!s.settings.autoplay}}))},'Autoplay'));}
createRoot(document.getElementById('root')).render(React.createElement(Harness));</script>`);
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage();const url='http://127.0.0.1:1420/test-results/autoplay/harness.html';
 const reset=async()=>{await page.goto(url);await page.waitForFunction(()=>window.session?.currentId);};
 await reset();await page.getByText('Next',{exact:true}).click();assert.equal(await page.evaluate(()=>window.lookups),0);
 await page.getByText('Autoplay',{exact:true}).click();await page.getByText('Next',{exact:true}).click();await page.getByRole('button',{name:'Loading song',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.pauses),1);assert.equal(await page.evaluate(()=>window.busy),true);assert.equal(await page.getByRole('button',{name:'Turn off Autoplay'}).locator('.spin').count(),0);await page.getByText('Next',{exact:true}).click();
 await page.waitForFunction(()=>window.loads.length===1);assert.deepEqual(await page.evaluate(()=>window.attempts),['itunes:1','itunes:2']);assert.equal(await page.evaluate(()=>window.lookups),1);assert.equal(await page.evaluate(()=>window.session.queue.length),2);
 await reset();await page.getByText('Autoplay',{exact:true}).click();await page.evaluate(()=>window.end());await page.waitForFunction(()=>window.loads.length===1);
 await reset();await page.getByText('Autoplay',{exact:true}).click();await page.getByText('Next',{exact:true}).click();await page.getByText('Autoplay',{exact:true}).click();await page.waitForTimeout(650);assert.equal(await page.evaluate(()=>window.loads.length),0);assert.equal(await page.evaluate(()=>window.session.queue.length),1);
 await reset();await page.evaluate(()=>window.failAll=true);await page.getByText('Autoplay',{exact:true}).click();await page.getByText('Next',{exact:true}).click();await page.waitForFunction(()=>window.notices.length>0&&!window.busy);assert.equal(await page.evaluate(()=>window.loads.length),0);assert.equal(await page.getByRole('button',{name:'Play',exact:true}).isEnabled(),true);
 console.log('PASS: manual Next, natural end, unavailable fallback, duplicate Next guard, opt-out, cancellation; controlled browser hook, no live providers.');
} finally {await browser.close();}
