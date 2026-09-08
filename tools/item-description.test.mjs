import test from 'node:test';import assert from 'node:assert/strict';
import {itemDescription,itemHintPosition} from '../client/assets/scripts/core/itemStats.ts';
test('instance durability and bonuses, gender and attack requirement survive separately',()=>{
 const info={type:2,weight:12,requiredclass:1,requiredgender:2,requiredtype:3,requiredamount:17,stats:{values:{mindc:1,maxdc:2}}};
 assert.deepEqual(itemDescription({currentdura:7756,maxdura:9000,addedstats:{values:{maxdc:3}}},info,'布衣（女）'),['布衣（女）','重量 12','持久 7/9','攻击 1–5（附加 +3）','所需职业 战士','所需性别 女','所需攻击上限 17']);
 assert.equal(info.stats.values.maxdc,2);
});
test('potion displays both effects without claiming a timing rule or invented price',()=>{
 assert.deepEqual(itemDescription({}, {type:13,weight:1,hp:20,mp:30},'药剂'),['药剂','重量 1','恢复生命 20','恢复魔法 30']);
});
test('meat, ore and amulet use their own units; missing definition is explicit',()=>{
 assert.deepEqual(itemDescription({currentdura:12500},{type:15},'肉'),['肉','品质 12']);
 assert.deepEqual(itemDescription({currentdura:9500},{type:14},'矿'),['矿','纯度 9']);
 assert.deepEqual(itemDescription({currentdura:70,maxdura:100},{type:8},'护身符'),['护身符','数量 70/100']);
 assert.deepEqual(itemDescription({},null,'未知物品'),['未知物品','物品资料尚未同步']);
});
test('all requirement enum values remain distinct; absent type never becomes level',()=>{
 for(let type=0;type<=11;type++)assert.ok(!itemDescription({}, {requiredamount:20,requiredtype:type},'装备').at(-1).includes('待同步'));
 assert.equal(itemDescription({}, {requiredamount:20},'装备').at(-1),'要求类型待同步 20');
});
test('tooltip clamps to all four canvas boundaries',()=>{
 assert.deepEqual(itemHintPosition(795,595,260,190),{x:540,y:410});
 assert.deepEqual(itemHintPosition(-30,-30,260,190),{x:0,y:0});
});

import {itemRequirements,compactBagDescription} from '../client/assets/scripts/core/itemStats.ts';
test('known class/gender/level failures are distinct and level boundary is inclusive',()=>{
 const info={requiredclass:4,requiredgender:2,requiredtype:0,requiredamount:7};
 assert.deepEqual(itemRequirements(info,{job:1,gender:0,level:6}).map(r=>r.met),[false,false,false]);
 assert.deepEqual(itemRequirements(info,{job:2,gender:1,level:7}).map(r=>r.met),[true,true,true]);
 assert.equal(itemRequirements({requiredtype:6,requiredamount:7},{level:8})[0].met,false);
 assert.equal(itemRequirements({requiredclass:3},{job:1})[0].met,true);
});
test('missing actor data and combat requirements remain unknown, never a fake pass',()=>{
 assert.ok(itemRequirements({requiredclass:4,requiredgender:2,requiredamount:7,requiredtype:0}).every(r=>r.met===undefined));
 for(const requiredtype of [1,2,3,4,5,7,8,9,10,11,99])assert.equal(itemRequirements({requiredtype,requiredamount:20},{level:50})[0].met,undefined);
});
test('compact native bag rows preserve name, durability, stats and requirements',()=>{
 assert.deepEqual(compactBagDescription({currentdura:10000,maxdura:10000},{weight:7,type:1,stats:{values:{mindc:2,maxdc:5}},requiredtype:0,requiredamount:1},'木剑',t=>t.length*12),['木剑 重量7 持久10/10','攻击力2-5','需要等级1']);
});
test('long original names or bonuses keep the complete view without shrinking or truncation',()=>{
 assert.equal(compactBagDescription({}, {weight:5},'很长的原物品名称'.repeat(8),t=>t.length*12),null);
 assert.equal(compactBagDescription({},null,'未知物品',t=>t.length*12),null);
});
test('native skill book description separates class manual and required level',()=>{
 assert.deepEqual(compactBagDescription({}, {type:20,weight:1,requiredclass:2,requiredtype:0,requiredamount:7},'火球术',t=>t.length*12),['火球术 重量1','法师秘籍','需要等级7']);
});

test('combat requirements use final authoritative maxima and preserve unknown',()=>{
 const info={requiredtype:3,requiredamount:9};
 assert.equal(itemRequirements(info,{attributes:{maxdc:8}})[0].met,false);
 assert.equal(itemRequirements(info,{attributes:{maxdc:9}})[0].met,true);
 assert.equal(itemRequirements(info,{})[0].met,undefined);
});
