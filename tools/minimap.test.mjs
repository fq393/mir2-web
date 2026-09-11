import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const exports={};
new Function('exports',ts.transpileModule(fs.readFileSync(new URL('../client/assets/scripts/platform/MiniMap.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(exports);
const {MiniMap}=exports;
test('expanded map clicks round-trip native pixel coordinates and its bounds shield the world',()=>{
 const nodes=[],routes=[];
 class Element{style={};hidden=false;events={};append(){}setAttribute(){}remove(){}addEventListener(n,f){this.events[n]=f;}getBoundingClientRect(){return {left:100,top:48,width:600,height:400};}getContext(){return {clearRect(){},drawImage(){},fillRect(){}};}}
 const saved={document:globalThis.document,Image:globalThis.Image,fetch:globalThis.fetch,window:globalThis.window};
 const keys={};globalThis.window={addEventListener:(n,f)=>keys[n]=f,removeEventListener:n=>delete keys[n]};
 globalThis.document={getElementById:()=>new Element(),createElement:()=>{const e=new Element();nodes.push(e);return e;}};
 globalThis.Image=class{complete=true;naturalWidth=1052;naturalHeight=700;};globalThis.fetch=async()=>({json:async()=>({'255':'#fff'})});
 try{
  const m=new MiniMap(p=>routes.push(p));m.toggle();m.update(1,'0',{x:288,y:615},[],true);
  assert.equal(m.blocksWorld(100,48),true);assert.equal(m.blocksWorld(699,447),true);assert.equal(m.blocksWorld(700,448),false);
  const canvas=nodes[1];canvas.events.click({stopPropagation(){},clientX:100+(302.5*1.5/1052)*600,clientY:48+(623.5/700)*400});
  assert.deepEqual(routes,[{x:302,y:623}]);assert.equal(m.blocksWorld(400,300),true);assert.equal(nodes[2].hidden,false);nodes[2].events.click({stopPropagation(){}});assert.equal(m.blocksWorld(400,300),false);assert.equal(nodes[2].hidden,true);assert.equal(m.blocksWorld(700,50),true);
  m.toggle();assert.equal(nodes[3].hidden,false);nodes[2].events.pointerdown({button:0,stopPropagation(){}});assert.match(nodes[2].style.backgroundImage,/64.png/);nodes[2].events.pointerleave();assert.match(nodes[2].style.backgroundImage,/close-normal/);
  let stopped=false;keys.keydown({key:'Escape',preventDefault(){},stopImmediatePropagation(){stopped=true;}});assert.equal(stopped,true);assert.equal(m.blocksWorld(400,300),false);
  m.update(1,'0141',{x:2,y:11},[],true);assert.equal(m.blocksWorld(700,50),false);m.destroy();assert.equal(keys.keydown,undefined);
 }finally{Object.assign(globalThis,saved);}
});
