// Summarize only measured successful trials; never substitute missing Android results.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const quantile=(values,q)=>{const a=[...values].sort((x,y)=>x-y);return !a.length?null:q===.5?(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2:a[Math.ceil(a.length*q)-1];};
const searchElapsed=events=>{
 let pending=0,start=0,ms=0;
 for(const event of events){if(event.stage==='search'){if(pending++===0)start=event.at;}else if(['discovered','search-failed'].includes(event.stage)&&pending>0&&--pending===0)ms+=event.at-start;}
 return pending===0?ms:null;
};
if(process.argv.includes('--self-test')){
 assert.equal(quantile([10,20,50,100],.5),35);assert.equal(quantile(Array.from({length:20},(_,i)=>i+1),.95),19);assert.equal(quantile([],.5),null);
 assert.equal(searchElapsed([{stage:'search',at:0},{stage:'search',at:10},{stage:'discovered',at:40},{stage:'discovered',at:50},{stage:'search',at:90},{stage:'search-failed',at:100}]),60);
 assert.equal(searchElapsed([{stage:'search',at:0}]),null);
 console.log('PASS median/p95 and search-stage self-checks');process.exit(0);
}
for(const file of process.argv.slice(2)){
 const r=JSON.parse(readFileSync(file,'utf8'));
 const summary={platform:r.platform,label:r.label};
 for(const kind of ['cold','repeat','queue']){
 const trials=r.trials.filter(t=>t.kind===kind),valid=trials.filter(t=>t.ok);
 const stages=valid.map(t=>{
 const events=t.events.filter(e=>e.stage),last=name=>events.filter(e=>e.stage===name).at(-1)?.at;
 const end=t.playingAt??last('playing')??t.endedAt,click=t.clickedAt??end-t.ms;
 const search=events.find(e=>e.stage==='search')?.at,resolved=last('source-resolved'),stream=last('stream-ready'),loaded=last('audio-loaded');
 const searchMs=searchElapsed(events);
 const delta=(a,b)=>a!==undefined&&b!==undefined?Math.max(0,b-a):null;
 return {clickToAudio:t.ms,search:search===undefined?null:searchMs,verifyAndExtract:search!==undefined&&resolved!==undefined&&searchMs!==null?Math.max(0,resolved-search-searchMs):null,prepare:delta(stream,loaded),buffer:delta(loaded,end),nativeResolvePrepareBuffer:r.platform==='android'?delta(resolved??(kind==='repeat'?click:undefined),end):null};
 });
 summary[kind]={cycles:trials.length,attempted:trials.filter(t=>!t.skipped).length,blocked:trials.filter(t=>t.skipped).length,failed:trials.filter(t=>!t.ok&&!t.skipped).length,successful:valid.length,stages:Object.fromEntries(Object.keys(stages[0]??{}).map(stage=>{const values=stages.map(t=>t[stage]).filter(x=>x!==null);return[stage,{n:values.length,medianMs:quantile(values,.5),p95Ms:quantile(values,.95)}];}))};
 }
 console.log(JSON.stringify(summary,null,2));
}
