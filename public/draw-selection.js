// Pointer capture keeps mouse, pen, and touch drawing consistent, including releases outside the map.
export function enableRectangleDrawing({map,surface,button,instruction,hint,validate,preview,commit,restore,size}){
 let drawing=false,start=null,pointer=null;
 const point=e=>{const r=surface.getBoundingClientRect();return {x:Math.max(0,Math.min(r.width,e.clientX-r.left)),y:Math.max(0,Math.min(r.height,e.clientY-r.top))};};
 const bbox=(a,b)=>{
  const first=map.containerPointToLatLng([a.x,a.y]),last=map.containerPointToLatLng([b.x,b.y]);
  const rawWest=Math.min(first.lng,last.lng),span=Math.abs(last.lng-first.lng),west=((rawWest+180)%360+360)%360-180;
  return [west,Math.min(first.lat,last.lat),west+span,Math.max(first.lat,last.lat)];
 };
 const handlers=['dragging','touchZoom','doubleClickZoom','boxZoom','scrollWheelZoom'];
 let enabledHandlers=[];
 function finish(){
  drawing=false;start=null;const previous=pointer;pointer=null;
  if(previous!==null&&surface.hasPointerCapture(previous))surface.releasePointerCapture(previous);
  surface.hidden=true;button.textContent='▧ Draw area';button.setAttribute('aria-pressed','false');instruction.classList.remove('is-drawing');
  for(const handler of enabledHandlers)map[handler].enable();enabledHandlers=[];
 }
 function cancel(){if(!drawing)return;finish();restore();instruction.textContent='Drag the map to explore · Draw area to select';hint.textContent='Drawing cancelled. Your previous selection is preserved.';}
 button.onclick=()=>{
  if(drawing){cancel();return;}
  drawing=true;enabledHandlers=handlers.filter(h=>map[h]?.enabled());for(const h of enabledHandlers)map[h].disable();
  surface.hidden=false;button.textContent='Cancel drawing';button.setAttribute('aria-pressed','true');instruction.classList.add('is-drawing');
  instruction.textContent='Click and drag a box · Esc to cancel';hint.textContent='Hold and drag across your area, then release to select it. On touchscreens, drag with one finger.';
 };
 surface.addEventListener('pointerdown',e=>{
  if(!drawing||pointer!==null||e.button!==0)return;e.preventDefault();start=point(e);pointer=e.pointerId;surface.setPointerCapture(pointer);instruction.textContent='Keep dragging · Release to select';
 });
 surface.addEventListener('pointermove',e=>{if(e.pointerId!==pointer||!start)return;const b=bbox(start,point(e));preview(b);instruction.textContent=`${size(b)} · Release to select`;});
 surface.addEventListener('pointerup',e=>{
  if(e.pointerId!==pointer||!start)return;const last=point(e),first=start,b=bbox(first,last);start=null;pointer=null;surface.releasePointerCapture(e.pointerId);
  try{if(Math.abs(last.x-first.x)<12||Math.abs(last.y-first.y)<12)throw new Error('Click and hold, then drag a box to select your area.');validate(b);}
  catch(error){restore();hint.textContent=error.message;instruction.textContent='Try another box · Esc to cancel';return;}
  finish();commit(b);
 });
 surface.addEventListener('pointercancel',cancel);surface.addEventListener('lostpointercapture',()=>{if(pointer!==null)cancel();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&drawing){e.preventDefault();cancel();button.focus();}});
 window.addEventListener('blur',cancel);
 return {cancel,isDrawing:()=>drawing};
}
