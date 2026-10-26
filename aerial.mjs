// Only original, dated aerial tiles from the requested year may be rendered.
const CA_ROOT='https://gis.wildlife.ca.gov/images/rest/services/Base_Remote_Sensing';
const PC='https://planetarycomputer.microsoft.com/api/stac/v1';
export const USDA_NAIP='https://apps.geo.fpac.usda.gov/geo-imagery/rest/services/naip/conus_naip/ImageServer';
export const USGS_NAIP='https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer';
export const NAIP_CLOUD_SOURCE='https://www.usgs.gov/centers/eros/science/usgs-eros-archive-aerial-photography-national-agriculture-imagery-program-naip';
const points=b=>{const[w,s,e,n]=b;return [[w,s],[e,s],[e,n],[w,n],[(w+e)/2,(s+n)/2]];};
function unionCovers(features,b,covers){return points(b).every(([x,y])=>features.some(f=>covers(f.geometry,[x-.000001,y-.000001,x+.000001,y+.000001])));}
export function aerialDimensions(b,resolution,maxSide=4000){
 const widthMeters=(b[2]-b[0])*111320*Math.cos((b[1]+b[3])/2*Math.PI/180),heightMeters=(b[3]-b[1])*111320;
 const scale=Math.min(1,maxSide/Math.max(widthMeters/resolution,heightMeters/resolution));
 return [Math.min(maxSide,Math.max(128,Math.ceil(widthMeters/resolution*scale))),Math.min(maxSide,Math.max(128,Math.ceil(heightMeters/resolution*scale)))];
}
function record(features,b,date,collection,resolution,urls,source,dimensions){
 const dates=[...new Set(features.map(f=>f.date))].sort(),first=dates[0],last=dates.at(-1),[width,height]=dimensions;
 const displayResolution=Number(Math.max((b[2]-b[0])*111320*Math.cos((b[1]+b[3])/2*Math.PI/180)/width,(b[3]-b[1])*111320/height).toFixed(2));
 return {id:`${collection}-${date.slice(0,4)}-${features.map(f=>f.id).join('-')}`,collection,resolution,displayResolution,renderWidth:width,renderHeight:height,aerial:true,dates,date:first,dateLabel:first===last?first:`${first} – ${last}`,platform:'NAIP aerial imagery',cloud:null,cloudLabel:'NAIP standard ≤10%; not measured here',cloudBasis:'product specification',cloudSource:NAIP_CLOUD_SOURCE,imageUrl:urls[0],imageUrls:urls,source,offsetDays:Math.round((Date.parse(first)-Date.parse(date))/86400000)};
}
function result(scene,b,date,years=[]){return {requestedDate:date,bounds:b,windowDays:null,annual:true,scenes:[scene],collection:scene.collection,resolution:scene.resolution,availableYears:years,note:'Aerial imagery from the requested year, selected by native resolution and render detail. Exact flight dates are shown. NAIP follows a ≤10% cloud product standard; crop cloud cover is not measured.',source:'USDA NAIP aerial imagery'};}
function exportUrl(service,tiles,b,dimensions,{naturalColor=false,lock=true}={}){
 const image=new URL(service+'/exportImage');
 image.search=new URLSearchParams({f:'image',bbox:b.join(','),bboxSR:'4326',imageSR:'4326',size:dimensions.join(','),format:'jpg',compressionQuality:'95',bandIds:'0,1,2',adjustAspectRatio:'false',interpolation:'RSP_BilinearInterpolation',...(naturalColor?{renderingRule:JSON.stringify({rasterFunction:'NaturalColor'})}:{}),...(lock?{mosaicRule:JSON.stringify({mosaicMethod:'esriMosaicLockRaster',lockRasterIds:tiles.map(t=>t.id),mosaicOperation:'MT_FIRST'})}:{})});
 return image.href;
}
async function nationalService(b,date,{getJSON,covers},usda){
 const year=Number(date.slice(0,4)),service=usda?USDA_NAIP:USGS_NAIP;
 const url=new URL(service+'/query');
 url.search=new URLSearchParams({f:'json',where:`Category=1 AND ${usda?'year_ts':'Year'}=${year}`,geometry:b.join(','),geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outSR:'4326',outFields:usda?'OBJECTID,Name,QQDATE,year_ts':'OBJECTID,Name,Year,acquisition_date,resolution_value,resolution_units',returnGeometry:'true',resultRecordCount:'50'});
 const data=await getJSON(url);if(data.error||data.exceededTransferLimit)return null;
 const tiles=(data.features||[]).flatMap(f=>{
  const a=f.attributes||{},match=a.Name?.match(/^m_.*_(\d{3}|1|2)_(\d{8})(?:_|\.|$)/i);
  if(!match||!Number.isInteger(a.OBJECTID)||!f.geometry?.rings)return [];
  const capture=a[usda?'QQDATE':'acquisition_date'];
  if(!Number.isFinite(capture))return [];
  const flight=new Date(capture).toISOString().slice(0,10);
  if(Number(flight.slice(0,4))!==year||a[usda?'year_ts':'Year']!==year||flight.replaceAll('-','')!==match[2])return [];
  const resolution=usda?(match[1].length===3?Number(match[1])/100:Number(match[1])):(a.resolution_units==='METER'?a.resolution_value:null);
  if(!Number.isFinite(resolution)||resolution<=0||resolution>2)return [];
  return [{id:a.OBJECTID,date:flight,resolution,geometry:{type:'Polygon',coordinates:f.geometry.rings}}];
 });
 if(!tiles.length||tiles.length>50||!unionCovers(tiles,b,covers))return null;
 const resolution=Math.max(...tiles.map(t=>t.resolution)),dimensions=aerialDimensions(b,resolution);
 const scene=record(tiles,b,date,usda?'usda-naip':'usgs-naip',resolution,[exportUrl(service,tiles,b,dimensions,{naturalColor:!usda})],service,dimensions);
 return result(scene,b,date);
}
async function california(b,date,{getJSON,covers}){
 const year=Number(date.slice(0,4)),directory=await getJSON(`${CA_ROOT}?f=json`);
 const years=(directory.services||[]).map(s=>s.name.match(/\/NAIP_(\d{4})$/)?.[1]).filter(Boolean).map(Number).sort((a,b)=>a-b);
 if(!years.includes(year))return null;
 const service=`${CA_ROOT}/NAIP_${year}/ImageServer`,url=new URL(service+'/query');
 url.search=new URLSearchParams({f:'json',where:'Category=1',geometry:b.join(','),geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'OBJECTID,Name',returnGeometry:'true',outSR:'4326'});
 const [data,meta]=await Promise.all([getJSON(url),getJSON(service+'?f=json')]);if(data.error||meta.error)return null;
 const tiles=(data.features||[]).flatMap(f=>{const match=f.attributes.Name?.match(/^m_.*_(\d{4})(\d{2})(\d{2})\.(?:tif|jp2)$/i);if(!match||Number(match[1])!==year)return [];return [{id:f.attributes.OBJECTID,date:`${match[1]}-${match[2]}-${match[3]}`,geometry:{type:'Polygon',coordinates:f.geometry.rings}}];});
 if(!tiles.length||tiles.length>200||data.exceededTransferLimit||!unionCovers(tiles,b,covers))return null;
 const resolution=Number(meta.pixelSizeX)||1,dimensions=aerialDimensions(b,resolution);
 return result(record(tiles,b,date,'ca-naip',resolution,[exportUrl(service,tiles,b,dimensions,{lock:tiles.length<=20})],service,dimensions),b,date,years);
}
async function planetary(b,date,{getJSON,covers}){
 const year=Number(date.slice(0,4)),url=new URL(PC+'/search');
 url.search=new URLSearchParams({collections:'naip',bbox:b.join(','),datetime:`${year}-01-01T00:00:00Z/${year}-12-31T23:59:59Z`,limit:'100'});
 const data=await getJSON(url),tiles=(data.features||[]).filter(f=>f.assets?.image&&Number.isFinite(f.properties?.gsd)&&f.properties.gsd>0&&f.properties.datetime?.slice(0,4)===String(year));
 if(!tiles.length||tiles.length>16||data.links?.some(l=>l.rel==='next')||!unionCovers(tiles,b,covers))return null;
 const resolution=Math.max(...tiles.map(f=>f.properties.gsd)),dimensions=aerialDimensions(b,resolution,3072),[width,height]=dimensions;
 const urls=tiles.map(f=>{const u=new URL(`https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/${b.join(',')}/${width}x${height}.png`);u.search=new URLSearchParams({collection:'naip',item:f.id,assets:'image',asset_bidx:'image|1,2,3',dst_crs:'EPSG:4326'});return u.href;});
 const features=tiles.map(f=>({...f,date:f.properties.datetime.slice(0,10)}));
 return result(record(features,b,date,'naip',resolution,urls,`${PC}/collections/naip/items/${tiles[0].id}`,dimensions),b,date);
}
export async function findAerial(b,date,dependencies){
 const year=Number(date.slice(0,4));if(year<2003)return null;
 const jobs=[];
 if(year>=2018&&b[0]>=-125&&b[2]<=-66&&b[1]>=24&&b[3]<=50){jobs.push(nationalService(b,date,dependencies,true),nationalService(b,date,dependencies,false));}
 if(b[0]>=-125&&b[2]<=-114&&b[1]>=32&&b[3]<=42.1)jobs.push(california(b,date,dependencies));
 if(year>=2010)jobs.push(planetary(b,date,dependencies));
 const results=await Promise.allSettled(jobs),candidates=results.flatMap(r=>r.status==='fulfilled'&&r.value?[r.value]:[]);
 candidates.sort((a,b)=>a.resolution-b.resolution||a.scenes[0].displayResolution-b.scenes[0].displayResolution);
 return candidates[0]||null;
}
