import test from 'node:test';import assert from 'node:assert/strict';import {itemStatLines} from '../client/assets/scripts/core/itemStats.ts';
test('bonus DC adds to this instance only and keeps base stats separate',()=>{const info={stats:{values:{mindc:1,maxdc:2}}};const rare={info,addedstats:{values:{maxdc:3}}};assert.deepEqual(itemStatLines(rare),['攻击 1–5（附加 +3）']);assert.deepEqual(itemStatLines({info}),['攻击 1–2']);assert.equal(info.stats.values.maxdc,2);});
test('cross-class bonus and negative stats display without inventing a base value',()=>{assert.deepEqual(itemStatLines({info:{},addedstats:{values:{maxmc:3,luck:-1}}}),['魔法 0–3（附加 +3）','幸运 -1（附加 -1）']);});

import {weaponAttackSound,equipmentSound} from '../client/assets/scripts/core/itemStats.ts';
test('equipment categories select distinct original local sounds',()=>{
 assert.deepEqual([1,2,4,5,6,7,10,8].map(equipmentSound),['111','112','116','115','114','113','117','118']);
});

test('native weapon attack families and cloth bracelet sound remain distinct',()=>{
 assert.deepEqual([1,2,3,4,6,8,24,-1].map(weaponAttackSound),['51','52','54','53','50','56','55','57']);
 assert.equal(equipmentSound(6,'铁手镯'),'117');assert.equal(equipmentSound(6,'未命名护腕'),'114');
});
