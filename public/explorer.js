const $=id=>document.getElementById(id);
const cloudText=scene=>Number.isFinite(scene.cloud)?`${scene.cloud.toFixed(1)}% cloud`:scene.cloudLabel;
const dateText=scene=>scene.dateLabel||scene.date;
import {states,extraRegions} from './us-regions.js';
import {enableRectangleDrawing} from './draw-selection.js';
import {prepareColorMatch} from './color-match.js';
let matchColors=true,colorCanvases=null;
let bounds=null,areaName='Selected map view',rectangle,map;
let navigationName='',drawTool=null;
let searchVersion=0,imageVersion=0,infoVersion=0,searchAbort=null,sceneSets=null,current=null,side=false;
const today=new Date().toISOString().slice(0,10);$('dateBefore').max=today;$('dateAfter').max=today;if($('dateAfter').value>today)$('dateAfter').value=today;
function invalidate(){searchVersion++;imageVersion++;searchAbort?.abort();current=null;sceneSets=null;colorCanvases=null;$('matchColors').disabled=true;$('results').hidden=true;$('emptyState').hidden=false;$('downloadComparison').disabled=true;$('searchButton').disabled=false;$('searchButton').innerHTML='Find imagery <span aria-hidden="true">↗</span>';$('searchStatus').textContent='';$('searchStatus').removeAttribute('data-state');$('sourceNotes').textContent='';$('sourceNotes').hidden=true;}
function validate(b){const[w,s,e,n]=b;if(b.length!==4||!b.every(Number.isFinite)||w< -180||e>180||s< -80||n>80||e<=w||n<=s||e-w>2||n-s>2||e-w<.01||n-s<.01)throw new Error('Choose a rectangle 0.01°–2° wide and tall, between 80°S and 80°N.');return b.map(v=>Number(v.toFixed(5)));}
function leafletBounds(b){return [[b[1],b[0]],[b[3],b[2]]];}
function selectionSize(b){const[w,s,e,n]=b;return `${((e-w)*111.32*Math.cos((s+n)/2*Math.PI/180)).toFixed(1)} × ${((n-s)*111.32).toFixed(1)} km · approximate extent`;}
function paintSelection(b,preview=false){if(!map)return;rectangle?.remove();rectangle=null;if(!b)return;rectangle=L.rectangle(leafletBounds(b),{color:preview?'#c96b3c':'#2b5b48',weight:2,fillOpacity:preview?0.14:0.06,dashArray:preview?'6 4':null,interactive:false}).addTo(map);}
function setArea(b,name='Selected map view'){
 try{b=validate(b);}catch(error){$('viewHint').textContent=error.message;return false;}
 invalidate();bounds=b;areaName=name;paintSelection(b);
 $('selectionCheck').textContent='✓';$('selectedAreaName').textContent=name;$('selectedAreaSize').textContent=selectionSize(b);$('fitSelection').hidden=false;
 $('areaHint').textContent='';
 $('mapInstruction').textContent='✓ Area selected · Ready to compare';
 void latest();return true;
}
async function latest(){
 if(!bounds)return;const version=++infoVersion;$('archiveRange').textContent='Checking recent passes…';
 try{const r=await fetch('/api/archive?'+new URLSearchParams({bbox:bounds.join(',')}));const data=await r.json();if(!r.ok)throw new Error(data.error);if(version!==infoVersion)return;$('archiveRange').textContent=data.latest?`Latest intersecting pass: ${data.latest}`:'No recent pass found for this area';}
 catch{if(version===infoVersion)$('archiveRange').textContent='Archive since 1982 · live status unavailable';}
}
function viewport(){
 const b=map.getBounds(),rawWest=b.getWest(),span=b.getEast()-rawWest;
 const west=((rawWest+180)%360+360)%360-180;
 return [west,b.getSouth(),west+span,b.getNorth()];
}
function updateViewHint(){
 if(!map||drawTool?.isDrawing())return;
 const b=viewport();let hint;
 try{validate(b);hint='Draw a box, or use the visible map.';$('viewArea').disabled=false;}
 catch{
  $('viewArea').disabled=true;
  if(b[3]-b[1]<.01||b[2]-b[0]<.01)hint='Zoom out slightly to include a larger area.';
  else if(b[2]>180)hint='Pan slightly to either side of the date line to select a view.';
  else hint='Zoom closer to choose a local area.';
 }
 $('viewHint').textContent=hint;
 $('mapInstruction').textContent=$('viewArea').disabled?'Zoom in, then draw your area':'Draw a box to choose your area';
}
if(window.L){
 map=L.map('areaMap',{scrollWheelZoom:true,worldCopyJump:true,minZoom:2,maxZoom:15,zoomSnap:0,zoomDelta:0.25,wheelPxPerZoomLevel:9}).fitBounds([[24,-125],[50,-66]],{padding:[8,8]});
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
 const stateSelect=$('stateNavigation');
 for(const [index,state] of [...states,...extraRegions].entries()){
  const option=document.createElement('option');option.value=String(index);option.textContent=state[0];stateSelect.append(option);
 }
 stateSelect.onchange=()=>{
  const state=[...states,...extraRegions][Number(stateSelect.value)];if(stateSelect.value===''||!state)return;
  drawTool?.cancel();navigationName=state[0];map.setView([state[1],state[2]],10);updateViewHint();
 };
 map.on('moveend',updateViewHint);
 map.on('dragstart',()=>{navigationName='';stateSelect.value='';});
 $('usOverview').onclick=()=>{drawTool?.cancel();navigationName='';stateSelect.value='';map.fitBounds([[24,-125],[50,-66]],{padding:[8,8]});};
 $('viewArea').onclick=()=>{
  drawTool?.cancel();const b=viewport();
  const center=map.getCenter();
  const name=navigationName?`${navigationName} · selected map view`:`Map view · ${center.lat.toFixed(3)}°, ${(((center.lng+180)%360+360)%360-180).toFixed(3)}°`;
  setArea(b,name);
 };
 $('fitSelection').onclick=()=>{drawTool?.cancel();if(bounds)map.fitBounds(leafletBounds(bounds),{padding:[0,0]});};
 drawTool=enableRectangleDrawing({map,surface:$('drawSurface'),button:$('drawButton'),instruction:$('mapInstruction'),hint:$('areaHint'),validate,preview:b=>paintSelection(b,true),restore:()=>paintSelection(bounds),size:selectionSize,commit:b=>setArea(b,navigationName?`${navigationName} · selected area`:'Custom selected area')});
 updateViewHint();
}else{
 $('areaMap').textContent='The map library could not load. Refresh to try again.';
 $('viewHint').textContent='Map unavailable.';$('viewArea').disabled=true;$('drawButton').disabled=true;$('stateNavigation').disabled=true;
}
$('archiveRange').textContent='All 50 states · Archive since 1982';
for(const id of ['dateBefore','dateAfter'])$(id).addEventListener('change',invalidate);
async function fetchScenes(date,signal){const r=await fetch('/api/scenes?'+new URLSearchParams({bbox:bounds.join(','),date}),{signal});const data=await r.json();if(!r.ok)throw new Error(data.error||'Catalogue search failed.');return data;}
$('searchForm').onsubmit=async e=>{e.preventDefault();if(drawTool?.isDrawing()){$('searchStatus').textContent='Finish drawing your area, or cancel drawing, before searching.';return;}if(!bounds){$('searchStatus').textContent='Zoom to your location, then click Draw area and drag a box first.';return;}if($('dateBefore').value>=$('dateAfter').value){$('searchStatus').textContent='The before target date must be earlier than the after target date.';return;}invalidate();const version=searchVersion;searchAbort=new AbortController();$('searchButton').disabled=true;$('searchButton').textContent='Finding your images…';$('searchStatus').dataset.state='loading';$('searchStatus').textContent='Finding passes that cover the entire selected area…';
try{const results=await Promise.all([fetchScenes($('dateBefore').value,searchAbort.signal),fetchScenes($('dateAfter').value,searchAbort.signal)]);if(version!==searchVersion)return;
const missing=results.map((r,i)=>r.scenes.length?null:(i?'after':'before')).filter(Boolean);if(missing.length)throw new Error(`No qualifying ${missing.join(' or ')} pass was found within ±45 days. Try a different target date or select a smaller area. Only scenes with less than 20% cloud cover qualify. No substitute imagery has been loaded.`);
sceneSets=results;['beforeScene','afterScene'].forEach((id,i)=>{$(id).replaceChildren(...results[i].scenes.map(scene=>{const o=document.createElement('option');o.value=scene.id;o.textContent=`${dateText(scene)} · ${scene.resolution} m · ${scene.platform.replace('landsat-','Landsat ').replace('sentinel-','Sentinel ')} · ${cloudText(scene)}${scene.offsetDays?' · '+(scene.offsetDays>0?'+':'')+scene.offsetDays+'d':''}`;return o;}));});
// Avoid choosing the same pass for both targets when there is an alternative.
if($('beforeScene').value===$('afterScene').value){const later=results[1].scenes.find(s=>s.date>results[0].scenes[0].date);if(later)$('afterScene').value=later.id;}
$('sourceNotes').textContent=[...new Set(results.map(r=>r.note||'').filter(Boolean))].join(' ');$('sourceNotes').hidden=!$('sourceNotes').textContent;$('searchStatus').dataset.state='success';$('searchStatus').textContent=`Found ${results[0].scenes.length} before and ${results[1].scenes.length} after images.${results.some(r=>r.truncated)?' Results capped; choose a smaller area for more options.':' Capture dates and sources are shown below.'}`;$('results').hidden=false;$('emptyState').hidden=true;$('comparisonTitle').textContent=areaName;void loadPair();
}catch(error){if(error.name!=='AbortError'&&version===searchVersion){$('searchStatus').dataset.state='error';$('searchStatus').textContent=error.message;}}finally{if(version===searchVersion){$('searchButton').disabled=false;$('searchButton').innerHTML='Find imagery <span aria-hidden="true">↗</span>';}}};
function preload(url){return new Promise((resolve,reject)=>{const img=new Image();const timeout=setTimeout(()=>{img.src='';reject(new Error('Image rendering timed out. Select another pass or retry the search.'));},60000);img.onload=()=>{clearTimeout(timeout);resolve(img);};img.onerror=()=>{clearTimeout(timeout);reject(new Error('The archive could not render this pass. Select another acquisition or retry the search.'));};img.src='/api/image?'+new URLSearchParams({url});});}
function renderImages(id,images){const img=$(id),parent=img.parentElement;parent.querySelectorAll('.mosaic-tile,.color-canvas').forEach(n=>n.remove());img.hidden=false;img.src=images[0].src;for(const tile of images.slice(1)){tile.className='mosaic-tile';tile.alt='Additional aerial imagery tile';parent.append(tile);}}
function displayColors(){
 const enabled=matchColors&&Boolean(colorCanvases);
 for(const id of ['beforeLayer','afterLayer'])$(id).classList.toggle('colors-matched',enabled);
 $('matchColors').setAttribute('aria-pressed',String(enabled));
 $('matchColors').textContent=enabled?'✓ Match colors':'Original colors';
 $('colorStatus').textContent=enabled?'Colors balanced between both dates · Display adjustment only.':'Original source colors · No display correction.';
}
$('matchColors').onclick=()=>{matchColors=!matchColors;displayColors();};
function matchPair(a,b){
 colorCanvases=null;$('matchColors').disabled=true;
 try{colorCanvases=prepareColorMatch(a,b);if(colorCanvases){$('beforeLayer').append(colorCanvases[0]);$('afterLayer').append(colorCanvases[1]);$('matchColors').disabled=false;}displayColors();if(!colorCanvases)$('colorStatus').textContent='Original colors shown: insufficient clear overlapping pixels for matching.';}
 catch{displayColors();$('colorStatus').textContent='Original colors shown: display matching was unavailable for this pair.';}
}
function setMode(){const box=$('comparison');box.classList.toggle('side',side);$('sideButton').classList.toggle('active',side);$('swipeButton').classList.toggle('active',!side);$('sideButton').setAttribute('aria-pressed',String(side));$('swipeButton').setAttribute('aria-pressed',String(!side));if(current){const ratio=side?current.ratio*2:current.ratio;box.style.aspectRatio=String(ratio);box.parentElement.style.maxWidth=`min(100%, ${76*ratio}vh)`;}}
function fact(scene,requested,label){
 const card=document.createElement('article');
 const h=document.createElement('h3');h.textContent=`${label} · ${dateText(scene)}`;
 const source=document.createElement('p');source.textContent=`${scene.platform.replace('landsat-','Landsat ').replace('sentinel-','Sentinel ')} · ${scene.resolution} m native resolution · ${cloudText(scene)}`;
 const target=document.createElement('p');const offset=scene.offsetDays;target.textContent=`Target: ${requested} · ${offset?`${Math.abs(offset)} days ${offset<0?'earlier':'later'}`:'Exact date match'}${scene.dates?.length>1?' (first flight)':''}`;
 if(scene.displayResolution>scene.resolution*1.15){const density=document.createElement('p');density.textContent=`Rendered at approximately ${scene.displayResolution} m per pixel for this area. A smaller selection shows more native detail.`;card.append(density);}
 const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Scene identifier';const id=document.createElement('p');id.className='scene-id';id.textContent=scene.id;details.append(summary,id);
 const a=document.createElement('a');a.href=scene.source;a.target='_blank';a.rel='noreferrer';a.textContent='View source metadata ↗';
 card.prepend(h,source,target);card.append(details,a);return card;
}
async function loadPair(){if(!sceneSets)return;const version=++imageVersion;current=null;colorCanvases=null;$('matchColors').disabled=true;$('downloadComparison').disabled=true;const before=sceneSets[0].scenes.find(s=>s.id===$('beforeScene').value),after=sceneSets[1].scenes.find(s=>s.id===$('afterScene').value);
$('comparison').setAttribute('aria-busy','true');$('imageStatus').hidden=false;$('imageStatus').textContent='Rendering two image crops from the archive…';$('selectionWarning').textContent='';$('sceneFacts').replaceChildren();
if((before.dates?.at(-1)||before.date)>=after.date){$('comparison').setAttribute('aria-busy','false');$('imageStatus').textContent='Choose two different passes, with the before acquisition earlier than the after acquisition.';return;}
try{const [a,b]=await Promise.all([Promise.all((before.imageUrls||[before.imageUrl]).map(preload)),Promise.all((after.imageUrls||[after.imageUrl]).map(preload))]);if(version!==imageVersion)return;
current={before,after,bounds:[...bounds],areaName,ratio:a[0].naturalWidth/a[0].naturalHeight,requestedBefore:sceneSets[0].requestedDate,requestedAfter:sceneSets[1].requestedDate};
renderImages('beforeRaster',a);renderImages('afterRaster',b);matchPair(a,b);$('beforeRaster').alt=`${areaName}, imagery acquired ${dateText(before)}`;$('afterRaster').alt=`${areaName}, imagery acquired ${dateText(after)}`;$('beforeTag').textContent=`BEFORE · ${dateText(before)}`;$('afterTag').textContent=`AFTER · ${dateText(after)}`;$('imageStatus').hidden=true;$('comparison').setAttribute('aria-busy','false');setMode();$('sceneFacts').replaceChildren(fact(before,current.requestedBefore,'Before'),fact(after,current.requestedAfter,'After'));
$('selectionWarning').textContent=[before.offsetDays||after.offsetDays?'Actual acquisition dates differ from your target dates. The labels show the actual dates.':'',before.collection!==after.collection?'These dates use different imagery sources or native resolutions. Color and sharpness differences alone do not establish land-cover change.':''].filter(Boolean).join(' ');
$('downloadComparison').disabled=false;
}catch(error){if(version===imageVersion){$('comparison').setAttribute('aria-busy','false');$('imageStatus').textContent=error.message;$('selectionWarning').textContent='No new comparison is available until both images load.';}}}
$('beforeScene').onchange=loadPair;$('afterScene').onchange=loadPair;
$('swipe').oninput=()=>{const value=$('swipe').value;$('beforeLayer').style.clipPath=`inset(0 ${100-value}% 0 0)`;$('swipeLine').style.left=`${value}%`;};
$('sideButton').onclick=()=>{side=true;setMode();};$('swipeButton').onclick=()=>{side=false;setMode();};
$('aboutButton').onclick=()=>$('aboutDialog').showModal();$('closeAbout').onclick=()=>$('aboutDialog').close();
$('downloadComparison').onclick=()=>{if(!current)return;const {before,after}=current;const notes=`# Groundshift: ${current.areaName}\n\nBounds (west,south,east,north): ${current.bounds.join(', ')}\n\nRequested dates: ${current.requestedBefore} / ${current.requestedAfter}\nActual acquisitions: ${dateText(before)} / ${dateText(after)}\nBefore: ${before.id} (${cloudText(before)})\nAfter: ${after.id} (${cloudText(after)})\n\nSources:\n${before.source}\n${after.source}\n\nMicrosoft Planetary Computer: ${before.collection} (${before.resolution} m) / ${after.collection} (${after.resolution} m). Same bounds and rendering grid; no automated change detection. Color matching is a display-only adjustment; originals remain available. Clouds, seasons, sensor differences, and missing pixels can affect interpretation.\n`;const url=URL.createObjectURL(new Blob([notes],{type:'text/markdown'}));const a=document.createElement('a');a.href=url;a.download='groundshift-comparison.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
