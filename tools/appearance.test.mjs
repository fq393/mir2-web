import test from 'node:test';
import assert from 'node:assert/strict';
import {playerLayers,equippedShape,actorFrame} from '../client/assets/scripts/core/appearance.ts';
test('appearance preserves exact shape, hair and sex rather than collapsing to the first outfit',()=>{
 assert.deepEqual(playerLayers(1,7,23,-1),{body:'armour23f',hair:'hair7f',weapon:null});
 assert.deepEqual(playerLayers(0,0,0,0),{body:'armour0',hair:'hair0',weapon:'weapon0'});
});
test('missing libraries cannot substitute human animation for hair, monsters or NPCs',()=>{
 const actors={armour0:{stand:[['human']]},hair0:{stand:[['hair']]}};
 for(const key of ['monster999','npc999','hair7','armour23','weapon23',null])assert.equal(actorFrame(actors,key,'stand',0,0),null);
 assert.equal(actorFrame(actors,'hair0','stand',0,0),'hair');
});
test('equipment preserves real shape and follows durability visibility without mutating the item',()=>{
 const item={currentdura:1,uniqueid:'90'},info={shape:23,durability:1000};
 assert.equal(equippedShape(item,info,0),23);assert.equal(item.currentdura,1);
 assert.equal(equippedShape({...item,currentdura:0},info,0),0);
 assert.equal(equippedShape({...item,currentdura:0},info,-1),-1);
 assert.equal(equippedShape(null,undefined,-1),-1);assert.equal(equippedShape(item,undefined,0),-1);
 assert.equal(equippedShape({currentdura:0},{shape:2,durability:0},0),2);
});
test('actor frames retain direction, looping and terminal death pose',()=>{
 const actors={hair0:{stand:[['s0','s1'],['e0','e1']],die:[['d0','d1']],actionFrameMs:{stand:100,die:100}}};
 assert.equal(actorFrame(actors,'hair0','stand',1,.3),'e1');
 assert.equal(actorFrame(actors,'hair0','die',0,10),'d1');
 assert.equal(actorFrame(actors,'hair0','stand',-1,0),null);
});
