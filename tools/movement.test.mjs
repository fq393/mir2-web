import test from 'node:test';
import assert from 'node:assert/strict';
import { findPath, directionTo, canStep } from '../client/assets/scripts/core/grid.ts';

const grid = (width, height, blocked = []) => ({width, height, blocked: new Set(blocked)});
test('finds a path around walls without entering blocked cells', () => {
  const map = grid(6, 5, ['2,0', '2,1', '2,2', '2,3']);
  const path = findPath(map, {x:1,y:1}, {x:4,y:1});
  assert.deepEqual(path.at(-1), {x:4,y:1});
  let prev = {x:1,y:1};
  for (const point of path) { assert.ok(canStep(map, prev, point)); prev = point; }
  assert.ok(path.some(p => p.y === 4));
});
test('allows original diagonal steps while rejecting blocked destinations and bounds', () => {
  const map = grid(3,3,['1,0','0,1','2,2']);
  assert.deepEqual(findPath(map,{x:0,y:0},{x:1,y:1}),[{x:1,y:1}]);
  assert.equal(canStep(map,{x:0,y:0},{x:1,y:1}),true);
  assert.deepEqual(findPath(map,{x:0,y:0},{x:2,y:2}),[]);
  assert.equal(canStep(map,{x:0,y:0},{x:-1,y:0}),false);
  assert.equal(canStep(map,{x:0,y:0},{x:2,y:1}),false);
});
test('direction order matches Crystal north clockwise to northwest', () => {
  const around = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
  around.forEach(([x,y],i)=> assert.equal(directionTo({x:0,y:0},{x,y}),i));
});
test('700x700 distant target uses a directed search instead of flooding the map', () => {
  const map = grid(700,700);
  let queries=0;
  const has=map.blocked.has.bind(map.blocked);
  map.blocked.has=key=>{queries++;return has(key);};
  const path=findPath(map,{x:0,y:0},{x:699,y:699});
  assert.equal(path.length,699);
  assert.deepEqual(path.at(-1),{x:699,y:699});
  assert.ok(queries<30000,`walkability queries: ${queries}`);
});
test('700x700 path reaches a distant goal through a wall opening without entering blocked cells', () => {
  const map=grid(700,700,Array.from({length:699},(_,y)=>`350,${y}`));
  const start={x:10,y:20},goal={x:690,y:20};
  const path=findPath(map,start,goal);
  assert.deepEqual(path.at(-1),goal);
  assert.ok(path.some(p=>p.x===350&&p.y===699));
  let previous=start;
  for(const point of path){assert.ok(canStep(map,previous,point));previous=point;}
});
