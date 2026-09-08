import test from 'node:test';
import assert from 'node:assert/strict';
import {DOOR_DURATION,doorFrame,portraitLayout} from '../client/assets/scripts/core/authPresentation.ts';
test('login door reaches the final source frame and never runs outside its ten frames',()=>{
 assert.equal(DOOR_DURATION,2300);assert.equal(doorFrame(-1),0);assert.equal(doorFrame(229),0);assert.equal(doorFrame(230),1);assert.equal(doorFrame(2070),9);assert.equal(doorFrame(999999),9);
});
test('female cropped stone figures retain the original displacement and right-hand slot offset',()=>{
 const mage=portraitLayout(1,1,0,true),live=portraitLayout(1,1);assert.equal(mage.x-live.x,30);assert.equal(mage.y-live.y,14);
 const tao=portraitLayout(2,1,1,true);assert.equal(tao.x,504);assert.equal(tao.y,105);assert.equal(tao.source,'webui/auth/portrait-2-1.png');
});
