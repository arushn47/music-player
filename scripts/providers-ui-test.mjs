import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const out='test-results/providers-ui';mkdirSync(out,{recursive:true});
writeFileSync(out+'/harness.html',`<!doctype html><html><body><div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {MusicMetadataDetails} from '/src/components/common/MusicMetadataDetails.tsx';import {AppleCountryChart} from '/src/components/views/AppleCountryChart.tsx';import {library} from '/src/adapters/native.ts';import {applyTheme} from '/src/theme.ts';import '/src/style.css';
localStorage.removeItem('lumaire-chart-country');applyTheme({themeMode:'dark',accentColor:'#a78bfa'});
window.metadataCalls=0;window.chartCalls=0;window.lookups=0;window.played=null;
const art='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#7056a3"/></svg>');
library.musicMetadata=async()=>{window.metadataCalls++;return new Promise(resolve=>window.resolveMetadata=resolve);};
library.appleChart=async(country)=>{window.chartCalls++;if(country==='au')throw Error('Offline');return {country,source:country==='gb'?'iTunes Store · Top Songs':'Apple Music · Most Played',updatedAt:'2026-10-24T12:00:00Z',stale:false,warning:country==='gb'?'Apple Music could not load; iTunes Store chart shown.':null,entries:Array.from({length:10},(_,index)=>({id:'itunes:'+String(index+1),title:'Song '+String(index+1),artist:'Artist',artworkUrl:art}))};};
library.lookupCatalog=async(id)=>{window.lookups++;return {id,title:'Song',artist:'Artist',artists:[],duration:180,album:'Album'};};
function Harness(){const [count,setCount]=React.useState(0);return React.createElement('main',{style:{padding:16,minWidth:0,maxWidth:'100%'}},React.createElement('h1',null,'Working catalog'),React.createElement('button',{id:'responsive',onClick:()=>setCount(count+1)},'Responsive '+count),React.createElement(MusicMetadataDetails,{kind:'album',title:'Vikram',artist:'Anirudh Ravichander'}),React.createElement(AppleCountryChart,{disabled:false,onPlay:track=>window.played=track.id}));}
createRoot(document.getElementById('root')).render(React.createElement(Harness));window.light=()=>applyTheme({themeMode:'light',accentColor:'#a78bfa'});
</script></body></html>`);
let browser;
const watchdog=setTimeout(()=>{console.error('Provider UI browser test timed out');process.exit(1);},45000);
try {
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:940}});page.setDefaultTimeout(8000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:1420/'+out+'/harness.html');
  await page.getByRole('heading',{name:'Apple Top 10'}).waitFor();
  await page.getByRole('button',{name:'Responsive 0'}).click();await page.getByRole('button',{name:'Responsive 1'}).waitFor();
  await page.waitForFunction(()=>typeof window.resolveMetadata==='function');
  assert.equal(await page.evaluate(()=>window.lookups),0);
  await page.evaluate(()=>window.resolveMetadata({provider:'MusicBrainz',sourceUrl:'https://musicbrainz.org/release-group/12345678-1234-1234-1234-123456789012',name:'Vikram',credits:['Anirudh Ravichander'],releaseDate:'2022-05-15',country:null,entityType:'Album',disambiguation:null}));
  await page.getByRole('link',{name:'MusicBrainz ↗'}).waitFor();await page.getByText('2022-05-15',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:/Play number/}).count(),10);
  await page.getByRole('button',{name:'Play number 1: Song 1',exact:true}).click();
  await page.waitForFunction(()=>window.played==='itunes:1');assert.equal(await page.evaluate(()=>window.lookups),1);
  await page.getByLabel('Chart country',{exact:true}).selectOption('us');await page.getByText('Apple Music · Most Played · United States',{exact:true}).waitFor();
  await page.getByLabel('Chart country',{exact:true}).selectOption('gb');await page.getByText('iTunes Store · Top Songs · United Kingdom',{exact:true}).waitFor();
  await page.screenshot({path:out+'/desktop.png',fullPage:true});
  await page.getByLabel('Chart country',{exact:true}).selectOption('au');await page.getByText("Apple charts couldn't load. JioSaavn charts are still available.",{exact:true}).waitFor();
  await page.getByRole('button',{name:'Responsive 1'}).click();await page.getByRole('button',{name:'Responsive 2'}).waitFor();
  await page.getByLabel('Chart country',{exact:true}).selectOption('in');await page.getByText('Apple Music · Most Played · India',{exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.light());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile page must not overflow horizontally');
  await page.screenshot({path:out+'/mobile-light.png',fullPage:true});assert.deepEqual(errors,[]);
  console.log('Provider UI passed: nonblocking metadata, ten ranks, lazy play lookup, country change, explicit fallback, error recovery, mobile/light layout.');
} finally {clearTimeout(watchdog);await browser?.close();}
