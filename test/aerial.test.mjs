import test from 'node:test';
import assert from 'node:assert/strict';
import {findAerial} from '../aerial.mjs';
const b=[-122.10,37.37,-122.06,37.41];
const fixture={getJSON:async url=>{url=String(url);if(url.endsWith('Base_Remote_Sensing?f=json'))return {services:[{name:'Base_Remote_Sensing/NAIP_2009'}]};if(url.includes('/query?'))return {features:[{attributes:{OBJECTID:1,Name:'m_3712240_se_10_1_20090608.tif'},geometry:{rings:[]}},{attributes:{OBJECTID:2,Name:'m_3712240_sw_10_1_20090619.tif'},geometry:{rings:[]}},{attributes:{OBJECTID:99,Name:'overview.tif'},geometry:{rings:[]}}]};return {pixelSizeX:1};},covers:()=>true};
test('2009 California imagery preserves real aerial flight dates and locks original tiles',async()=>{
 const r=await findAerial(b,'2009-09-01',fixture);const s=r.scenes[0];assert.equal(s.collection,'ca-naip');assert.equal(s.resolution,1);assert.equal(s.dateLabel,'2009-06-08 – 2009-06-19');assert.equal(s.cloud,null);assert.equal(s.cloudBasis,'product specification');assert.deepEqual(JSON.parse(new URL(s.imageUrl).searchParams.get('mosaicRule')).lockRasterIds,[1,2]);assert.equal(new URL(s.imageUrl).searchParams.get('adjustAspectRatio'),'false');
});
test('aerial imagery from a different year is never silently substituted',async()=>{assert.equal(await findAerial(b,'2008-09-01',fixture),null)});
test('aerial tiles with incomplete selection coverage are rejected',async()=>{assert.equal(await findAerial(b,'2009-09-01',{...fixture,covers:()=>false}),null)});

import {aerialDimensions,USDA_NAIP,USGS_NAIP} from '../aerial.mjs';
const mt=[-112.04,46.58,-112.03,46.59];
const flight=Date.parse('2025-09-05T00:00:00Z');
const usdaTile=(changes={})=>({attributes:{OBJECTID:7,Name:'m_4611232_ne_12_030_20250905',QQDATE:flight,year_ts:2025,...changes},geometry:{rings:[]}});
const usgsTile=(resolution=.6)=>({attributes:{OBJECTID:8,Name:'m_4611232_ne_12_060_20250905',acquisition_date:flight,Year:2025,resolution_value:resolution,resolution_units:'METER'},geometry:{rings:[]}});
function nationalFixture({usda=[usdaTile()],usgs=[],failUSDA=false}={}){return {covers:()=>true,getJSON:async input=>{const url=new URL(input);if(url.href.startsWith(USDA_NAIP)){if(failUSDA)throw new Error('Provider unavailable');assert.equal(url.searchParams.get('where'),'Category=1 AND year_ts=2025');return {features:usda};}if(url.href.startsWith(USGS_NAIP))return {features:usgs};return {features:[],services:[]};}};}
test('dated USDA tiles provide true 30 cm imagery and lock original rasters',async()=>{
 const result=await findAerial(mt,'2025-09-01',nationalFixture());const scene=result.scenes[0];assert.equal(scene.collection,'usda-naip');assert.equal(scene.resolution,.3);assert.equal(scene.date,'2025-09-05');assert.equal(scene.offsetDays,4);const url=new URL(scene.imageUrl);assert.equal(url.searchParams.get('format'),'jpg');assert.equal(url.searchParams.get('compressionQuality'),'95');assert.deepEqual(JSON.parse(url.searchParams.get('mosaicRule')).lockRasterIds,[7]);assert.ok(scene.renderHeight>2048&&scene.renderHeight<=4000);
});
test('rejects mismatched flight years, missing dates, and overview names',async()=>{
 const result=await findAerial(mt,'2025-09-01',nationalFixture({usda:[usdaTile({QQDATE:Date.parse('2024-09-05'),Name:'m_4611232_ne_12_030_20240905'}),usdaTile({QQDATE:null}),usdaTile({Name:'Ov_i02_L01.tif'})]}));assert.equal(result,null);
});
test('selects the finer source even when it is not first in source order',async()=>{
 const result=await findAerial(mt,'2025-09-01',nationalFixture({usda:[usdaTile({Name:'m_4611232_ne_12_060_20250905'})],usgs:[usgsTile(.3)]}));assert.equal(result.scenes[0].collection,'usgs-naip');assert.equal(result.resolution,.3);
});
test('one unavailable source does not hide another source with valid imagery',async()=>{
 const result=await findAerial(mt,'2025-09-01',nationalFixture({failUSDA:true,usgs:[usgsTile()]}));assert.equal(result.scenes[0].collection,'usgs-naip');
});
test('aerial rendering follows native pixel detail without exceeding service limits',()=>{
 const size=aerialDimensions(mt,1);assert.ok(size[0]<2048&&size[1]<2048);assert.deepEqual(aerialDimensions([-112,45,-111,46],.3).map(n=>n<=4000),[true,true]);
});
