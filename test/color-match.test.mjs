import test from 'node:test';
import assert from 'node:assert/strict';
import {colorTransfer,applyTransfer} from '../public/color-match.js';
function ramp(offset=0){const out=new Uint8ClampedArray(2048*4);for(let n=0;n<2048;n++){const v=30+n%140;out.set([v+offset,v+offset+4,v+offset+8,255],n*4);}return out;}
test('a brightness offset is reduced symmetrically without changing originals',()=>{const a=ramp(),b=ramp(30),original=new Uint8ClampedArray(a),t=colorTransfer(a,b);assert.ok(t);const x=applyTransfer(a,t.plans[0]),y=applyTransfer(b,t.plans[1]);let difference=0;for(let i=0;i<x.length;i+=4)difference+=Math.abs(x[i]-y[i]);assert.ok(difference/(x.length/4)<2);assert.deepEqual(a,original);assert.ok(x[0]>a[0]);assert.ok(y[0]<b[0]);});
test('matching identical imagery leaves colors unchanged',()=>{const a=ramp(),t=colorTransfer(a,a);assert.deepEqual(applyTransfer(a,t.plans[0]),a);});
test('nodata alpha and pixel geometry are preserved',()=>{const a=ramp(),b=ramp(20);a.set([10,20,30,0],0);const t=colorTransfer(a,b),out=applyTransfer(a,t.plans[0]);assert.equal(out.length,a.length);assert.deepEqual([...out.slice(0,4)],[10,20,30,0]);for(let i=3;i<a.length;i+=4)assert.equal(out[i],a[i]);});
test('empty or cloudy overlap does not invent an adjustment',()=>{assert.equal(colorTransfer(new Uint8ClampedArray(4000),new Uint8ClampedArray(4000)),null);const white=new Uint8ClampedArray(4000).fill(255);assert.equal(colorTransfer(white,white),null);});
test('unaligned arrays are rejected',()=>{assert.throws(()=>colorTransfer(new Uint8ClampedArray(4),new Uint8ClampedArray(8)));});
test('warm and cool channel casts move toward a common balance',()=>{const a=ramp(),b=ramp();for(let i=0;i<b.length;i+=4){b[i]+=24;b[i+1]-=12;b[i+2]+=8;}const t=colorTransfer(a,b),x=applyTransfer(a,t.plans[0]),y=applyTransfer(b,t.plans[1]);for(let c=0;c<3;c++){let error=0;for(let i=c;i<x.length;i+=4)error+=Math.abs(x[i]-y[i]);assert.ok(error/(x.length/4)<2);}});
