import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBounds,validateDate,covers,imageUrl} from '../archive.mjs';
test('reject invalid, reversed, global or tiny bounds',()=>{for(const b of [[0,0,3,1],[1,0,0,1],[0,0,.001,1],[0,-90,1,-89],[NaN,0,1,1]])assert.throws(()=>validateBounds(b));assert.deepEqual(validateBounds('-122.55,37.68,-122.32,37.84'),[-122.55,37.68,-122.32,37.84]);});
test('dates must be real and within archive',()=>{for(const d of ['2025-02-30','1970-01-01','2999-01-01','bad'])assert.throws(()=>validateDate(d));assert.equal(validateDate('1990-09-01'),'1990-09-01');});
test('coverage requires all corners within actual footprint',()=>{const g={type:'Polygon',coordinates:[[[0,1],[1,0],[2,1],[1,2],[0,1]]]};assert.ok(covers(g,[.8,.8,1.2,1.2]));assert.equal(covers(g,[.1,.1,1.9,1.9]),false);});
test('image crops use fixed origin and identical grids across dates',()=>{const b=[-122.55,37.68,-122.32,37.84];const u=new URL(imageUrl('LC09_L2SP_044034_20250916_02_T1',b));assert.equal(u.hostname,'planetarycomputer.microsoft.com');assert.match(u.pathname,/bbox\/-122.55,37.68,-122.32,37.84\/2048x/);assert.deepEqual(u.searchParams.getAll('assets'),['red','green','blue']);assert.throws(()=>imageUrl('../../bad',b));});
test('search enforces strictly less than 20% cloud cover and excludes unknown values',async()=>{
 const {findScenes}=await import('../archive.mjs');const original=globalThis.fetch;let requested;
 globalThis.fetch=async url=>{requested=new URL(url);return {ok:true,json:async()=>({links:[],features:[0,19.99,20,undefined].map((cloud,i)=>({id:`LC08_L2SP_014032_2025090${i+1}_02_T1`,properties:{datetime:`2025-09-0${i+1}T00:00:00Z`,platform:'landsat-8','eo:cloud_cover':cloud},geometry:{type:'Polygon',coordinates:[[[-1,-1],[2,-1],[2,2],[-1,2],[-1,-1]]]},assets:{red:{},green:{},blue:{}}}))})};};
 try{const result=await findScenes([0,0,.5,.5],'2025-09-01');assert.deepEqual(result.scenes.map(s=>s.cloud),[0,19.99]);assert.equal(JSON.parse(requested.searchParams.get('query'))['eo:cloud_cover'].lt,20);}finally{globalThis.fetch=original;}
});
test('Sentinel render uses the native 10 m true-color asset at higher output resolution',()=>{
 const url=new URL(imageUrl('S2A_MSIL2A_20240901T154701_R011_T18TWL_20240901T221213',[-74.02,40.72,-73.98,40.76],'sentinel-2-l2a'));
 assert.equal(url.searchParams.get('assets'),'visual');assert.equal(url.searchParams.get('asset_bidx'),'visual|1,2,3');assert.match(url.pathname,/2048/);assert.equal(url.searchParams.has('color_formula'),false);
});
test('recent searches select clear Sentinel-2 scenes and report their true resolution',async()=>{
 const {findScenes}=await import('../archive.mjs');const original=globalThis.fetch;let requested;
 globalThis.fetch=async url=>{requested=new URL(url);return {ok:true,json:async()=>({links:[],features:[{id:'S2A_MSIL2A_20240901T154701_R011_T18TWL_20240901T221213',properties:{datetime:'2024-09-01T15:47:01Z',platform:'sentinel-2a','eo:cloud_cover':3},geometry:{type:'Polygon',coordinates:[[[-1,-1],[2,-1],[2,2],[-1,2],[-1,-1]]]},assets:{visual:{}}}]})};};
 try{const result=await findScenes([.1,.1,.6,.6],'2024-09-01');assert.equal(requested.searchParams.get('collections'),'sentinel-2-l2a');assert.equal(result.scenes.length,1);assert.equal(result.scenes[0].resolution,10);assert.equal(result.scenes[0].collection,'sentinel-2-l2a');}finally{globalThis.fetch=original;}
});
