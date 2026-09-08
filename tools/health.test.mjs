import test from 'node:test';
import assert from 'node:assert/strict';
import {healthWidth,showHealth} from '../client/assets/scripts/core/health.ts';
test('native 32px health fill clips and never invents unknown health',()=>{
 assert.equal(healthWidth(undefined),0);assert.equal(healthWidth(NaN),0);
 assert.equal(healthWidth(-1),0);assert.equal(healthWidth(0),0);
 assert.equal(healthWidth(50),16);assert.equal(healthWidth(99),31);assert.equal(healthWidth(120),32);
});
test('ObjectHealth expiry hides bars, including zero-duration packets; NPC and dead never show',()=>{
 assert.equal(showHealth('monster',false,50,3000,2999),true);
 assert.equal(showHealth('monster',false,50,3000,3000),false);
 assert.equal(showHealth('player',false,50,3000,2999),true);
 assert.equal(showHealth('npc',false,100,3000,2999),false);
 assert.equal(showHealth('monster',true,50,3000,2999),false);
 assert.equal(showHealth('monster',false,undefined,3000,2999),false);
});
