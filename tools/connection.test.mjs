import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as grid from '../client/assets/scripts/core/grid.ts';
import * as classicLayout from '../client/assets/scripts/core/classicLayout.ts';
import * as inventory from '../client/assets/scripts/core/inventory.ts';

function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true},
  }).outputText;
  vm.runInNewContext(code, {exports, require: name => mocks[name], console: {info() {}}, ...globals});
  return exports;
}
const cc = {_decorator: {ccclass: () => cls => cls}, Component: class {}, Color: class {constructor(r,g,b,a){Object.assign(this,{r,g,b,a});}},
  KeyCode: {KEY_D: 68, ARROW_RIGHT: 39, KEY_A: 65, ARROW_LEFT: 37, KEY_S: 83, ARROW_DOWN: 40, KEY_W: 87, ARROW_UP: 38}};
const {MirWorld} = load('../client/assets/scripts/MirWorld.ts', {
  cc, './core/classicLayout':classicLayout, './core/inventory':inventory, './platform/MirAudio':{MirAudio:class{stop(){}play(){}unlock(){}}}, './core/stepSound':{stepSound:()=>1}, './core/grid': grid, './platform/connection': {}, './renderer/MirSprite': {}, './renderer/TerrainStream':{TerrainStream:class{constructor(){this.newTerrain=true;}destroy(){}}},
});
function world() {
  const w = new MirWorld();
  w.menu={active:false};w.ready = true; w.hp = 18; w.grid = {width: 10, height: 10, blocked: new Set()};
  w.point = {x: 2, y: 2}; w.visual = {...w.point};
  w.marker = {active: true}; w.manifest = {map: {originX: 0, originY: 0}};
  w.updateView = () => {}; w.terrain={cell:()=>null,animate(){}};
  w.connection = {send: () => true, reconnect: () => {w.reconnected = true;}};
  return w;
}
test('offline or failed sends cannot start or commit movement', () => {
  for (const online of [false, true]) {
    const w = world(); w.serverReady = online; w.connection.send = () => false;
    w.path = [{x: 3, y: 2}]; w.keys.add(68); w.beginStep();
    assert.equal(w.step, null); assert.equal(w.point.x, 2); assert.equal(w.path.length, 0); assert.equal(w.keys.size, 0);
  }
});
test('prediction waits for the matching server confirmation', () => {
  const w = world(); w.serverReady = true; w.path = [{x: 3, y: 2}]; w.beginStep();
  const seq = w.step.seq;
  for (let i = 0; i < 8; i++) w.update(.1);
  assert.equal(w.visual.x, 3); assert.equal(w.point.x, 2);
  w.serverEvent({type: 'state', seq: seq - 1, x: 8, y: 8});
  assert.equal(w.confirmed, null);
  w.serverEvent({type: 'state', seq, x: 3, y: 2}); w.update(.1);
  assert.equal(w.point.x, 3); assert.equal(w.step, null);
});
test('disconnect, ready and timeout clear stale confirmation and inputs', () => {
  for (const event of [{type: 'disconnected'}, {type: 'ready', objectId: 1, x: 2, y: 2}]) {
    const w = world(); w.serverReady = true; w.keys.add(68); w.beginStep();
    w.confirmed = {x: 9, y: 9}; w.path = [{x: 4, y: 2}]; w.serverEvent(event);
    assert.equal(w.step, null); assert.equal(w.confirmed, null); assert.equal(w.keys.size, 0); assert.equal(w.path.length, 0);
  }
  const w = world(); w.serverReady = true; w.keys.add(68); w.beginStep();
  for (let i = 0; i < 31; i++) w.update(.1);
  assert.equal(w.serverReady, false); assert.equal(w.reconnected, true); assert.equal(w.step, null); assert.equal(w.point.x, 2);
  w.serverEvent({type: 'state', seq: 1, x: 9, y: 9}); assert.equal(w.point.x, 2);
});
test('connection reports disconnect and detaches the old socket on reconnect', () => {
  const sockets = [], events = [], statuses = [];
  class Socket {static OPEN = 1; readyState = 1; constructor() {sockets.push(this);} close() {} send() {throw Error('closed');}}
  const {CrystalConnection} = load('../client/assets/scripts/platform/connection.ts', {}, {WebSocket: Socket, setTimeout, clearTimeout});
  const c = new CrystalConnection(s => statuses.push(s), e => events.push(e)); c.connect();
  assert.equal(c.send({type: 'walk'}), false);
  assert.equal(events[0].type, 'disconnected'); assert.equal(sockets.length, 2); assert.equal(sockets[0].onclose, null);
  sockets[1].onclose(); assert.match(statuses.at(-1), /等待重新连接/); c.close();
});

test('movement timeout reconnect destroys peers before the next session starts', () => {
  const w = world(), sockets = [];
  let destroyed = 0;
  class Socket {static OPEN = 1; readyState = 1; constructor() {sockets.push(this);} close() {} send() {}}
  const {CrystalConnection} = load('../client/assets/scripts/platform/connection.ts', {}, {WebSocket: Socket, setTimeout, clearTimeout});
  w.connection = new CrystalConnection(() => {}, event => w.serverEvent(event));
  w.connection.connect(); w.serverReady = true; w.keys.add(68); w.beginStep();
  w.peers.set(42, {node: {destroy: () => destroyed++}});
  w.step.elapsed = 3; w.update(.1);
  assert.equal(destroyed, 1); assert.equal(w.peers.size, 0); assert.equal(w.serverReady, false);
  assert.equal(sockets.length, 2); assert.equal(sockets[0].onclose, null);
  w.serverEvent({type: 'ready', objectId: 1, x: 2, y: 2});
  assert.equal(w.peers.size, 0); w.connection.close();
});

test('equipment changes only after successful authoritative packet', () => {
  const w=world();w.notice=()=>{};w.inventory=[{uniqueid:'23',itemindex:1},null];w.equipment=[null,null];
  w.packet('EquipItem',{UniqueID:23,To:0,Success:false});assert.equal(w.equipment[0],null);
  w.packet('EquipItem',{UniqueID:23,To:0,Success:true});assert.equal(w.inventory[0],null);assert.equal(w.equipment[0].uniqueid,'23');
  w.packet('RemoveItem',{UniqueID:23,To:1,Success:true});assert.equal(w.equipment[0],null);assert.equal(w.inventory[1].uniqueid,'23');
});
test('monster hit and death do not rewind to the previous movement origin', () => {
  const w=world();w.notice=()=>{};const p={point:{x:5,y:6},visual:{x:5,y:6},from:{x:4,y:6},elapsed:1};w.peers.set(2,p);
  w.packet('ObjectStruck',{ObjectID:2});assert.equal(JSON.stringify(p.from),JSON.stringify(p.point));assert.equal(JSON.stringify(p.visual),JSON.stringify(p.point));
  w.packet('ObjectDied',{ObjectID:2});assert.equal(p.dead,true);assert.equal(JSON.stringify(p.from),JSON.stringify(p.point));
});
test('healing, misses and melee do not emit a fireball hit', () => {
  const w=world();w.notice=()=>{};let hits=0;w.spellEffect=()=>hits++;w.peers.set(2,{point:{x:5,y:6}});
  w.packet('DamageIndicator',{ObjectID:2,Damage:0});w.packet('DamageIndicator',{ObjectID:2,Damage:2});w.packet('DamageIndicator',{ObjectID:2,Damage:-2});assert.equal(hits,0);
  w.fireTargets.set(2,Date.now()+1500);w.packet('DamageIndicator',{ObjectID:2,Damage:-2});assert.equal(hits,1);assert.equal(w.fireTargets.size,0);
});
test('dead players cannot start movement', () => {
  const w=world();w.serverReady=true;w.hp=0;w.keys.add(68);let sends=0;w.connection.send=()=>{sends++;return true;};w.beginStep();assert.equal(sends,0);assert.equal(w.step,null);
});
test('purchased equipment enters visible bag instead of reserved belt slots', () => {
  const w=world();w.notice=()=>{};w.inventory=Array(46).fill(null);w.inventory[6]={uniqueid:'old'};w.itemInfo.set(1,{name:'BichonSword'});
  w.packet('GainedItem',{Item:{UniqueID:'new',ItemIndex:1,Count:1}});
  assert.equal(w.inventory[0],null);assert.equal(w.inventory[7].uniqueid,'new');assert.equal(w.inventory[7].info.name,'BichonSword');
});

test('use request stays pending until server acknowledgement; failed use keeps item',()=>{
 const w=world();w.serverReady=true;w.inventory=[{uniqueid:'p1',itemindex:3,count:1,info:{type:13,name:'BichonHealthSmall'}}];let sent=[];w.connection.send=c=>{sent.push(c);return true;};
 w.usePotion(w.inventory[0]);w.usePotion(w.inventory[0]);assert.equal(sent.length,1);assert.equal(w.inventory[0].count,1);
 w.packet('UseItem',{UniqueID:'p1',Success:false});assert.equal(w.inventory[0].count,1);assert.equal(w.pendingUses.size,0);
 w.packet('UseItem',{UniqueID:'p1',Success:true});assert.equal(w.inventory[0],null);
});

test('server map change clears old actors, movement, effects and switches collision before new packets',()=>{
 const w=world();let destroyed=0;
 w.terrain.destroy=()=>destroyed++;w.world={active:true};w.collision={getComponent:()=>null};
 w.peers.set(2,{node:{destroy:()=>destroyed++},label:{node:{destroy:()=>destroyed++}}});
 w.particleEffects=[{node:{destroy:()=>destroyed++}}];w.fireTargets.set(2,900);
 const room={id:'0105',name:'首饰店',originX:0,originY:0,spawn:{x:8,y:24}};
 const roomGrid={width:27,height:29,blocked:new Set(['1,1'])};w.maps.set('0105',{map:room,grid:roomGrid});
 w.serverReady=true;w.path=[{x:3,y:2}];w.beginStep();w.menu.active=true;
 w.packet('MapChanged',{FileName:'0105',Location:{X:8,Y:24},Direction:4});
 assert.equal(destroyed,4);assert.equal(w.grid,roomGrid);assert.equal(w.manifest.map,room);
 assert.equal(w.mapId,'0105');assert.equal(w.point.x,8);assert.equal(w.point.y,24);
 assert.equal(w.step,null);assert.equal(w.path.length,0);assert.equal(w.peers.size,0);assert.equal(w.fireTargets.size,0);assert.equal(w.menu.active,false);
 w.serverEvent({type:'state',seq:1,x:295,y:284});assert.equal(w.point.x,8);
});
test('unknown server map blocks input instead of drawing its coordinates on the previous map',()=>{
 const w=world();w.world={active:true};w.serverReady=true;
 w.packet('MapChanged',{FileName:'unknown',Location:{X:8,Y:24}});
 assert.equal(w.world.active,false);assert.equal(w.serverReady,false);assert.match(w.statusText,/尚未接入/);
});

test('authoritative own and peer name colour changes survive packet normalization',()=>{
 const w=world();w.ownLabel={};w.peers.set(7,{label:{}});
 w.packet('ColourChanged',{NameColour:{R:255,G:0,B:0,A:255}});
 w.packet('ObjectColourChanged',{ObjectID:7,NameColour:{R:0,G:255,B:0,A:255}});
 assert.equal(w.ownLabel.color.r,255);assert.equal(w.ownLabel.color.g,0);
 assert.equal(w.peers.get(7).label.color.g,255);assert.equal(w.peers.get(7).label.color.r,0);
});

test('health packets retain server expiry and health bars are destroyed with removed entities',()=>{
 const w=world();let removed=0;
 const peer={node:{destroy(){}},healthBar:{node:{destroy(){removed++;}}}};
 w.peers.set(42,peer);
 const before=Date.now();w.packet('ObjectHealth',{ObjectID:42,Percent:65,Expire:3});
 assert.equal(peer.hp,65);assert.ok(peer.healthUntil>=before+3000&&peer.healthUntil<=Date.now()+3000);
 w.packet('ObjectHealth',{ObjectID:42,Percent:25,Expire:0});assert.ok(peer.healthUntil<=Date.now());
 w.packet('ObjectRemove',{ObjectID:42});assert.equal(removed,1);assert.equal(w.peers.has(42),false);
 w.peers.set(43,peer);w.serverEvent({type:'disconnected'});assert.equal(removed,2);assert.equal(w.peers.size,0);
});

test('experience and level packets carry remainder without frontend level guessing',()=>{
 const w=world();w.notice=()=>{};w.experience=90;w.maxExperience=100;w.level=1;
 w.packet('GainExperience',{Amount:30});assert.equal(w.experience,120);assert.equal(w.level,1);
 w.packet('LevelChanged',{Level:2,Experience:20,MaxExperience:200});assert.equal(w.level,2);assert.equal(w.experience,20);assert.equal(w.maxExperience,200);
});
test('vitals only accept the current actor and include server equipment/buff maxima',()=>{
 const w=world();w.ownId=9;
 w.serverEvent({type:'vitals',data:{ObjectId:8,MaxHP:999,MaxMP:999}});assert.equal(w.authoritativeMaxHP,0);
 w.serverEvent({type:'vitals',data:{ObjectId:9,MaxHP:120,MaxMP:45,BagWeight:9,MaxBagWeight:50}});
 assert.equal(w.authoritativeMaxHP,120);assert.equal(w.authoritativeMaxMP,45);assert.equal(w.maxBagWeight,50);assert.equal(w.hp,18);
});
test('learned skills are added, progressed and removed from actual packets',()=>{
 const w=world();w.ownId=9;
 w.packet('NewMagic',{Hero:false,Magic:{Spell:1,Level:0,Experience:0}});
 w.packet('MagicLeveled',{ObjectID:9,Spell:1,Level:1,Experience:14});assert.equal(w.magics[0].level,1);assert.equal(w.magics[0].experience,14);
 w.packet('RemoveMagic',{PlaceId:0});assert.equal(w.magics.length,0);
});
