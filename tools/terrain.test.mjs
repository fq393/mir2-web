import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
class Node {
 constructor(name){this.name=name;this.children=[];this.position={x:0,y:0};}
 addChild(n){n.parent=this;this.children.push(n);} addComponent(Type){return new Type();}
 setPosition(x,y){this.position={x,y};} getSiblingIndex(){return this.parent.children.indexOf(this);}
 setSiblingIndex(i){const a=this.parent.children;a.splice(a.indexOf(this),1);a.splice(i,0,this);}
 destroy(){this.destroyed=true;if(this.parent)this.parent.children.splice(this.getSiblingIndex(),1);}
}
function runtime(){
 const pending=new Map(),released=[],textures=[];
 class Texture{static Filter={LINEAR:2,NEAREST:1};constructor(){textures.push(this);}setFilters(){}destroy(){this.destroyed=true;}}
 class Frame{destroy(){this.destroyed=true;}}
 class Sprite{static SizeMode={RAW:1};setAdditive(){}}
 const cc={Node,UITransform:class{setAnchorPoint(){}},Sprite,SpriteFrame:Frame,Texture2D:Texture,ImageAsset:class{},JsonAsset:class{},Rect:class{},Size:class{},Vec2:class{},Layers:{Enum:{UI_2D:1}},
 resources:{load:(path,type,cb)=>pending.set(path,cb),release:path=>released.push(path)}};
 const exports={};const source=ts.transpileModule(fs.readFileSync(new URL('../client/assets/scripts/renderer/TerrainStream.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(source,{exports,require:n=>n==='cc'?cc:{MirSprite:Sprite}});
 return {...exports,pending,released,textures};
}
test('obsolete chunk completion retains currently displayed atlas until replacement commits',async()=>{
 const r=runtime(),retains=[];const frames=new Map([['0:0',{sprite:{},meta:{w:48,h:32}}]]);
 const store={frames,atlas:async()=>{},retain:a=>retains.push(Array.from(a))};
 const chunks=[0,1,2].map(i=>({x:96+i*200,y:96,width:32,height:32,file:`chunk${i}.json`,atlases:[i]}));
 const stream=new r.TerrainStream({map:{chunks}},store,new Node('ground'),new Node('objects'),e=>{throw Error(e);});
 const a=stream.update(100,100,1.25);r.pending.get('mir/chunk0')(null,{json:{cells:[{x:100,y:100,back:{library:0,index:0,floor:true}}]}});await a;
 const b=stream.update(300,100,1.25),c=stream.update(500,100,1.25);
 r.pending.get('mir/chunk1')(null,{json:{cells:[]}});await b;
 assert.ok(retains.at(-1).includes(0));assert.ok(retains.at(-1).includes(2));assert.equal(stream.tiles.size,1);
 r.pending.get('mir/chunk2')(null,{json:{cells:[]}});await c;assert.deepEqual(retains.at(-1),[2]);assert.equal(stream.tiles.size,0);
});
test('destroyed store cannot create frames from a late texture response',async()=>{
 const r=runtime(),store=new r.SpriteStore({atlases:[{file:'atlas.png'}],frames:{a:{atlas:0,x:0,y:0,w:2,h:2}}});
 const loading=store.atlas(0);store.destroy();r.pending.get('mir/atlas')(null,{});await loading;
 assert.equal(store.frames.size,0);assert.equal(r.textures.length,0);assert.ok(r.released.includes('mir/atlas'));
});
test('floor cells sort by row, column, then back/middle/front regardless of source chunk order',async()=>{
 const r=runtime(),ground=new Node('ground'),store={frames:new Map([['0:0',{sprite:{},meta:{w:96,h:64}}]]),atlas:async()=>{},retain:()=>{}};
 const ref={library:0,index:0,floor:true};const cells=[{x:101,y:100,back:ref},{x:100,y:100,front:ref,middle:ref,back:ref}];
 const s=new r.TerrainStream({map:{cells}},store,ground,new Node('objects'),e=>{throw Error(e);});await s.update(100,100,1.25);
 assert.deepEqual(ground.children.map(n=>n.name),['100:100:back','100:100:middle','100:100:front','101:100:back']);
});

test('leaving a map cancels late chunk work without evicting the new map atlas',async()=>{
 const r=runtime();let loads=0,retains=0;
 const store={frames:new Map(),atlas:async()=>loads++,retain:()=>retains++};
 const stream=new r.TerrainStream({map:{chunks:[{x:0,y:0,width:32,height:32,file:'old.json',atlases:[0]}]}},store,new Node('ground'),new Node('objects'),e=>{throw Error(e);});
 const pending=stream.update(10,10,1);stream.destroy();r.pending.get('mir/old')(null,{json:{cells:[]}});await pending;
 assert.equal(loads,0);assert.equal(retains,0);assert.equal(stream.tiles.size,0);
});

test('atlas frame lookup uses registered buckets, including later interior assets',async()=>{
 const r=runtime();let scans=0;const frames={};
 for(let i=0;i<2000;i++)frames['f'+i]={get atlas(){scans++;return i%20;},x:0,y:0,w:2,h:2};
 const store=new r.SpriteStore({frames,atlases:Array.from({length:21},(_,i)=>({file:`a${i}.png`}))});
 const indexed=scans;
 for(let i=0;i<20;i++){const task=store.atlas(i);r.pending.get('mir/a'+i)(null,{});await task;}
 assert.equal(scans,indexed);assert.equal(store.frames.size,2000);
 store.registerFrames({room:{atlas:20,x:0,y:0,w:2,h:2}});
 const task=store.atlas(20);r.pending.get('mir/a20')(null,{});await task;assert.ok(store.frames.has('room'));
 store.destroy();
});
