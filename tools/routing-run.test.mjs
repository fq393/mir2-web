import test from 'node:test';
import assert from 'node:assert/strict';
import {findPath,canStep,directionTo} from '../client/assets/scripts/core/grid.ts';
test('equal-cost routes keep straight segments for two-cell running in all eight directions',()=>{
 const g={width:30,height:30,blocked:new Set()},start={x:15,y:15};
 for(const [dx,dy] of [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]]){
  const p=findPath(g,start,{x:start.x+dx*6,y:start.y+dy*6});
  assert.deepEqual(p,Array.from({length:6},(_,i)=>({x:start.x+dx*(i+1),y:start.y+dy*(i+1)})));
 }
});
test('straight preference never bypasses blocked corners or changes shortest path length',()=>{
 const g={width:8,height:8,blocked:new Set(['3,3','3,4','3,5'])},start={x:1,y:4},goal={x:6,y:4};
 const p=findPath(g,start,goal);let from=start;
 for(const to of p){assert.ok(canStep(g,from,to));from=to;}
 assert.deepEqual(from,goal);assert.equal(p.length,6); // (2,3),(2,2),(3,2),(4,2),(5,3),(6,4)
});
