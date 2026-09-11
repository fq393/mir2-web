import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGoldAmount} from '../client/assets/scripts/core/gold.ts';
test('gold input accepts positive wallet-bounded integers only',()=>{
 for(const value of ['','0','-1','1.5','1e3',' 10','1001','4294967296','Infinity'])assert.equal(parseGoldAmount(value,1000),null,value);
 assert.equal(parseGoldAmount('1000',1000),1000);assert.equal(parseGoldAmount('0001',1000),1);assert.equal(parseGoldAmount('4294967295',4294967295),4294967295);
});
