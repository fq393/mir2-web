import test from 'node:test';
import assert from 'node:assert/strict';
import {findPath,canStep,directionTo,projectileDirection} from '../client/assets/scripts/core/grid.ts';
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

test('all sixteen projectile sectors select distinct frames and keep cardinal directions',()=>{
 for(let d=0;d<16;d++){const a=d*Math.PI/8;assert.equal(projectileDirection({x:20,y:20},{x:20+Math.sin(a)*10,y:20-Math.cos(a)*10}),d);}
 assert.equal(projectileDirection({x:2,y:2},{x:3,y:0}),1);
 assert.equal(projectileDirection({x:2,y:2},{x:2,y:2}),0);
});
