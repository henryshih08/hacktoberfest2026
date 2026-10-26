import {findAerial} from './aerial.mjs';
// Public STAC metadata + geographically clipped Landsat imagery. No imagery archive is downloaded.
export const CATALOG='https://planetarycomputer.microsoft.com/api/stac/v1';
export const COLLECTION='landsat-c2-l2';
export const SENTINEL_COLLECTION='sentinel-2-l2a';
export const SENTINEL_START='2015-06-27';
export const ARCHIVE_START='1982-08-22';
export function validateBounds(value){
 const b=Array.isArray(value)?value:String(value||'').split(',').map(Number);
 if(b.length!==4||!b.every(Number.isFinite))throw new Error('Supply four numeric coordinates: west, south, east, north.');
 const[w,s,e,n]=b;
 if(w< -180||e>180||s< -80||n>80||e<=w||n<=s||e-w>2||n-s>2||e-w<.01||n-s<.01)throw new Error('Select an area between 0.01° and 2° wide and tall, between 80°S and 80°N.');
 return b.map(x=>Number(x.toFixed(5)));
}
export function validateDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new Error('Enter a valid date.');
 if(value<ARCHIVE_START||value>new Date().toISOString().slice(0,10))throw new Error('Choose a date from August 22, 1982 through today.');
 return value;
}
function inside(point,ring){let result=false;const[x,y]=point;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const[a,b]=ring[i],[c,d]=ring[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)result=!result;}return result;}
export function covers(geometry,b){
 const[w,s,e,n]=b;const points=[[w,s],[e,s],[e,n],[w,n],[(w+e)/2,(s+n)/2]];
 const polygons=geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:[];
 return polygons.some(p=>points.every(point=>inside(point,p[0])&&!p.slice(1).some(h=>inside(point,h))));
}
export function imageUrl(id,bounds,collection=COLLECTION){
 if(![COLLECTION,SENTINEL_COLLECTION].includes(collection))throw new Error('Unsupported imagery collection.');
 if(collection===SENTINEL_COLLECTION&&!/^S2[ABC]_MSIL2A_\d{8}T\d{6}_R\d{3}_T[A-Z0-9]{5}_\d{8}T\d{6}$/.test(id))throw new Error('Invalid Sentinel-2 scene identifier.');
 if(collection===COLLECTION&&!/^L[A-Z]\d{2}_L2S[PR]_\d{6}_\d{8}_02_T[12]$/.test(id))throw new Error('Invalid Landsat scene identifier.');
 const b=validateBounds(bounds),[w,s,e,n]=b;
 // Render both dates into the identical geographic grid. Preserve local ground aspect ratio.
 const ratio=(e-w)*Math.cos((s+n)/2*Math.PI/180)/(n-s);
 const width=ratio>=1?2048:Math.max(128,Math.round(2048*ratio));
 const height=ratio>=1?Math.max(128,Math.round(2048/ratio)):2048;
 const url=new URL(`https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/${b.join(',')}/${width}x${height}.png`);
 url.searchParams.set('collection',collection);url.searchParams.set('item',id);
 if(collection===SENTINEL_COLLECTION){
  url.searchParams.set('assets','visual');url.searchParams.set('asset_bidx','visual|1,2,3');url.searchParams.set('nodata','0');
 }else{
  for(const band of ['red','green','blue'])url.searchParams.append('assets',band);
  url.searchParams.set('color_formula','gamma RGB 2.7, saturation 1.5, sigmoidal RGB 15 0.55');
 }
 url.searchParams.set('dst_crs','EPSG:4326');
 return url.href;
}
const cache=new Map();
async function getJSON(url){const key=String(url),hit=cache.get(key);if(hit&&hit.expires>Date.now())return hit.data;const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`Satellite catalogue unavailable (${response.status}). Please try again.`);const data=await response.json();if(cache.size>=80)cache.delete(cache.keys().next().value);cache.set(key,{data,expires:Date.now()+600000});return data;}
export async function findScenes(bounds,date){
 validateDate(date);
 const b=validateBounds(bounds);
 const aerial=await findAerial(b,date,{getJSON,covers});
 if(aerial)return aerial;
 if(date>=SENTINEL_START){
  const recent=await searchCollection(bounds,date,SENTINEL_COLLECTION);
  if(recent.scenes.length)return {...recent,note:'No high-detail aerial coverage was found for this area and requested year. Showing 10 m satellite imagery.'};
  const older=await searchCollection(bounds,date,COLLECTION);
  return {...older,fallback:true,note:'No qualifying 10 m Sentinel-2 pass covers this area in the date window. Showing 30 m Landsat passes instead.'};
 }
 return {...await searchCollection(bounds,date,COLLECTION),note:'High-detail aerial imagery is unavailable for this area/year. Showing 30 m Landsat imagery; small features will remain pixelated.'};
}
async function searchCollection(bounds,date,collection){
 const b=validateBounds(bounds);validateDate(date);
 const day=86400000,target=Date.parse(date);
 const start=new Date(Math.max(Date.parse(collection===SENTINEL_COLLECTION?SENTINEL_START:ARCHIVE_START),target-45*day)).toISOString();
 const end=new Date(Math.min(Date.now(),target+46*day-1)).toISOString();
 const url=new URL(`${CATALOG}/search`);url.search=new URLSearchParams({collections:collection,bbox:b.join(','),datetime:`${start}/${end}`,limit:'100',sortby:'-datetime',query:JSON.stringify({'eo:cloud_cover':{lt:20}})});
 let next=url.href,features=[],pages=0;
 while(next&&pages<4){const data=await getJSON(next);features.push(...data.features);const link=data.links?.find(l=>l.rel==='next'&&(!l.method||l.method==='GET'));next=link?.href||null;if(next&&!next.startsWith(`${CATALOG}/`))throw new Error('Unexpected catalogue pagination URL.');pages++;}
 const sentinel=collection===SENTINEL_COLLECTION;
 const scenes=features.filter(f=>Number.isFinite(f.properties?.['eo:cloud_cover'])&&f.properties['eo:cloud_cover']>=0&&f.properties['eo:cloud_cover']<20&&covers(f.geometry,b)&&(sentinel?f.assets?.visual:f.assets?.red&&f.assets?.green&&f.assets?.blue)).map(f=>({id:f.id,collection,resolution:sentinel?10:30,date:f.properties.datetime.slice(0,10),datetime:f.properties.datetime,platform:f.properties.platform,cloud:Number(f.properties['eo:cloud_cover']),imageUrl:imageUrl(f.id,b,collection),source:`${CATALOG}/collections/${collection}/items/${f.id}`,offsetDays:Math.round((Date.parse(f.properties.datetime.slice(0,10))-target)/day)}));
 scenes.sort((a,b)=>Math.abs(a.offsetDays)-Math.abs(b.offsetDays)||a.cloud-b.cloud);
 return {requestedDate:date,bounds:b,windowDays:45,scenes:scenes.slice(0,40),truncated:Boolean(next)||scenes.length>40,collection,resolution:sentinel?10:30,source:sentinel?'Copernicus Sentinel-2 L2A / Microsoft Planetary Computer':'USGS Landsat Collection 2 Level-2 / Microsoft Planetary Computer'};
}
export async function archiveInfo(bounds){
 const b=validateBounds(bounds);const url=new URL(`${CATALOG}/search`);url.search=new URLSearchParams({collections:SENTINEL_COLLECTION,bbox:b.join(','),limit:'1',sortby:'-datetime'});
 const data=await getJSON(url);return {start:ARCHIVE_START,latest:data.features?.[0]?.properties?.datetime?.slice(0,10)||null,source:'Copernicus Sentinel-2 + USGS Landsat',resolution:'10 m recent / 30 m historical',platforms:['Landsat 4','Landsat 5','Landsat 7','Landsat 8','Landsat 9']};
}
