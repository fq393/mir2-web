import test from 'node:test';
import assert from 'node:assert/strict';
import {shopRows,shopPrice} from '../client/assets/scripts/core/shop.ts';
test('shop category resolves exact instances without merging durability or bonuses',()=>{
 const goods=[{itemindex:1,uniqueid:'9007199254740993',currentdura:1000,addedstats:{values:{maxdc:3}}},{itemindex:1,uniqueid:'9007199254740994',currentdura:3000},{itemindex:2,uniqueid:'30'}];
 const before=JSON.stringify(goods),groups=shopRows(goods,null);assert.equal(groups.length,2);assert.equal(groups[0].instances.length,2);
 const detail=shopRows(goods,1);assert.equal(detail[0],goods[0]);assert.equal(detail[1],goods[1]);assert.equal(detail[0].uniqueid,'9007199254740993');assert.equal(detail[0].addedstats.values.maxdc,3);assert.equal(JSON.stringify(goods),before);
 assert.deepEqual(shopRows(goods.filter(i=>i!==goods[0]),1),[goods[1]]);assert.deepEqual(shopRows(goods,99),[]);
});

test('used equipment price includes each added point and reduced durability',()=>{assert.equal(shopPrice({maxdura:3000,currentdura:1000,count:1,addedstats:{values:{maxdc:3}}},{price:900,durability:6000}),780);assert.equal(shopPrice({maxdura:6000,currentdura:6000,count:1},{price:900,durability:6000}),900);});
