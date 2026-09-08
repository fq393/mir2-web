import test from 'node:test';
import assert from 'node:assert/strict';
import {gainItem,consumeItem,equipmentTarget} from '../client/assets/scripts/core/inventory.ts';
const item=(id,type=13,count=1,stacksize=1)=>({uniqueid:String(id),itemindex:type,count,info:{type,stacksize}});
test('potions use four preferred belt slots then any empty slot; gear starts in bag',()=>{const a=Array(46).fill(null);gainItem(a,item(1,1));assert.equal(a[6].uniqueid,'1');for(let i=2;i<7;i++)gainItem(a,item(i));assert.deepEqual(a.slice(0,5).map(v=>v.uniqueid),['2','3','4','5','6']);});
test('stack overflow matches Crystal before using next slot',()=>{const a=Array(46).fill(null);a[0]=item(1,13,5,6);gainItem(a,item(2,13,3,6));assert.equal(a[0].count,6);assert.equal(a[1].count,2);});
test('failed or unknown use never removes anything; success consumes exactly one',()=>{const a=Array(46).fill(null);a[0]=item(1,13,2);assert.equal(consumeItem(a,'1',false),false);assert.equal(a[0].count,2);assert.equal(consumeItem(a,'missing',true),false);assert.equal(consumeItem(a,'1',true),true);assert.equal(a[0].count,1);consumeItem(a,'1',true);assert.equal(a[0],null);});

test('jewellery equips to distinct protocol slots without touching weapon/armour',()=>{const e=Array(14).fill(null);assert.equal(equipmentTarget(5,e),4);assert.equal(equipmentTarget(6,e),6);e[6]=item(1,6);assert.equal(equipmentTarget(6,e),5);assert.equal(equipmentTarget(7,e),8);e[8]=item(2,7);assert.equal(equipmentTarget(7,e),7);assert.equal(equipmentTarget(13,e),-1);});
