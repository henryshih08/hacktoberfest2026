import test from 'node:test';
import assert from 'node:assert/strict';
import {states} from '../public/us-regions.js';
import {validateBounds} from '../archive.mjs';
test('nationwide navigation includes 50 distinct states, Alaska and Hawaii',()=>{
 assert.equal(states.length,50);assert.equal(new Set(states.map(s=>s[0])).size,50);
 for(const name of ['Alaska','Hawaii','California','New York','Florida','Maine'])assert.ok(states.some(s=>s[0]===name));
 for(const [name,lat,lon] of states){assert.equal(typeof name,'string');assert.doesNotThrow(()=>validateBounds([lon-.04,lat-.04,lon+.04,lat+.04]));}
});
