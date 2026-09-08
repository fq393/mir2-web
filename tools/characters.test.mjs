import test from 'node:test';
import assert from 'node:assert/strict';
import {characterListState} from '../client/assets/scripts/core/characters.ts';
test('empty or stale role selection never submits a previous account identity',()=>{
 assert.equal(characterListState([],99).selected,0);
 assert.equal(characterListState([{Index:3,Name:'甲'}],99).selected,3);
});
test('classic selection exposes two native slots and preserves overflow records unchanged',()=>{
 const rows=[{Index:3,Name:'甲',Class:0,Gender:0,Level:1},{index:6,name:'乙',class:1,gender:1,level:7},{Index:9,Name:'丙'}];
 const before=structuredClone(rows),s=characterListState(rows,9);
 assert.deepEqual(rows,before);assert.equal(s.characters.length,2);assert.equal(s.selected,3);assert.equal('pages' in s,false);
 assert.equal(s.characters[1].role,1);assert.equal(s.characters[1].gender,1);assert.equal(s.characters[1].level,7);assert.equal(characterListState(rows,6).selected,6);
});
