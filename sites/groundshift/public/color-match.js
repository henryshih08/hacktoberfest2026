// Symmetric display-only color transfer. Original pixels remain available unchanged.
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
function usable(p,i){const r=p[i],g=p[i+1],b=p[i+2];return p[i+3]>=240&&Math.max(r,g,b)>10&&!(Math.min(r,g,b)>235&&Math.max(r,g,b)-Math.min(r,g,b)<22);}
function quantile(hist,count,q){let total=0;for(let i=0;i<256;i++){total+=hist[i];if(total>=count*q)return i;}return 255;}
export function colorTransfer(before,after){
 if(before.length!==after.length||before.length%4)throw new Error('Aligned RGBA images are required.');
 const hist=[0,1].map(()=>[0,1,2].map(()=>new Uint32Array(256)));
 const step=Math.max(1,Math.ceil(before.length/4/80000))*4;let count=0;
 for(let i=0;i<before.length;i+=step){if(!usable(before,i)||!usable(after,i))continue;count++;for(let c=0;c<3;c++){hist[0][c][before[i+c]]++;hist[1][c][after[i+c]]++;}}
 if(count<256)return null;
 const plans=[[],[]];
 for(let c=0;c<3;c++){
  const stats=hist.map(h=>({low:quantile(h[c],count,.1),median:quantile(h[c],count,.5),high:quantile(h[c],count,.9)}));
  const center=(stats[0].median+stats[1].median)/2;
  const range=((stats[0].high-stats[0].low)+(stats[1].high-stats[1].low))/2;
  for(let side=0;side<2;side++){
   const s=stats[side],spread=s.high-s.low;
   const gain=spread<12?1:clamp(range/spread,.65,1.6);
   const shift=clamp(center-s.median,-40,40);
   const lut=new Uint8ClampedArray(256);
   for(let x=0;x<256;x++)lut[x]=(x-s.median)*gain+s.median+shift;
   plans[side].push(lut);
  }
 }
 return {plans,samples:count};
}
export function applyTransfer(pixels,plan){
 const output=new Uint8ClampedArray(pixels);
 for(let i=0;i<output.length;i+=4){if(pixels[i+3]===0)continue;output[i]=plan[0][pixels[i]];output[i+1]=plan[1][pixels[i+1]];output[i+2]=plan[2][pixels[i+2]];}
 return output;
}
export function prepareColorMatch(beforeImages,afterImages){
 const width=beforeImages[0].naturalWidth,height=beforeImages[0].naturalHeight;
 const canvases=[beforeImages,afterImages].map(images=>{const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d',{willReadFrequently:true});for(const img of images)ctx.drawImage(img,0,0,width,height);return c;});
 const frames=canvases.map(c=>c.getContext('2d').getImageData(0,0,width,height));
 const transfer=colorTransfer(frames[0].data,frames[1].data);if(!transfer)return null;
 canvases.forEach((canvas,i)=>{const frame=frames[i];frame.data.set(applyTransfer(frame.data,transfer.plans[i]));canvas.getContext('2d').putImageData(frame,0,0);canvas.className='color-canvas';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${i?'After':'Before'} imagery with matched display colors`);});
 return canvases;
}
