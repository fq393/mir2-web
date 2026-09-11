import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as grid from '../client/assets/scripts/core/grid.ts';
import * as classicLayout from '../client/assets/scripts/core/classicLayout.ts';
import * as inventory from '../client/assets/scripts/core/inventory.ts';
import * as appearance from '../client/assets/scripts/core/appearance.ts';
import * as itemStats from '../client/assets/scripts/core/itemStats.ts';

function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true},
  }).outputText;
  vm.runInNewContext(code, {exports, require: name => mocks[name], console: {info() {}}, ...globals});
  return exports;
}
const cc = {Sprite:{SizeMode:{RAW:0}},Node:{EventType:{TOUCH_END:'touch',MOUSE_UP:'mouse'}},_decorator: {ccclass: () => cls => cls}, Component: class {}, Color: class {constructor(r,g,b,a){Object.assign(this,{r,g,b,a});}},
  KeyCode: {F1:112,F8:119,F11:122,ESCAPE:27,ENTER:13,KEY_D: 68, ARROW_RIGHT: 39, KEY_A: 65, ARROW_LEFT: 37, KEY_S: 83, ARROW_DOWN: 40, KEY_W: 87, ARROW_UP: 38}};
let movementNow=1000;
const {MirWorld} = load('../client/assets/scripts/MirWorld.ts', {
  cc, './core/appearance':appearance, './core/itemStats':itemStats, './core/classicLayout':classicLayout, './core/inventory':inventory, './platform/MirAudio':{MirAudio:class{stop(){}play(){}unlock(){}}}, './core/stepSound':{stepSound:()=>1}, './core/grid': grid, './platform/connection': {}, './renderer/MirSprite': {MirSprite:class{setAdditive(){this.additive=true;}}}, './renderer/TerrainStream':{TerrainStream:class{constructor(){this.newTerrain=true;}destroy(){}}},
}, {performance:{now:()=>movementNow}});
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

test('skill books wait for both authoritative learning and item replies; belt cannot drink a book',()=>{
 const w=world(),sent=[],sounds=[],notices=[];w.serverReady=true;w.ownId=9;
 w.connection.send=p=>{sent.push(p);return true;};w.sound.play=s=>sounds.push(s);w.notice=s=>notices.push(s);w.refreshBelt=()=>{};
 const book={uniqueid:'book1',count:1,info:{type:20,name:'基本剑术'}};w.inventory[6]=book;
 w.usePotion(book);assert.equal(sent.length,0);
 w.useInventoryItem(book);w.useInventoryItem(book);assert.equal(sent.length,1);assert.equal(w.inventory[6],book);assert.equal(w.magics.length,0);
 w.packet('UseItem',{UniqueID:'book1',Success:false});assert.equal(w.inventory[6],book);assert.equal(w.pendingUses.size,0);assert.match(notices.at(-1),/技能书未使用/);
 w.lastUse=0;w.useInventoryItem(book);w.packet('NewMagic',{Hero:false,Magic:{Spell:1,Level:0,Experience:0,Need1:500}});
 assert.equal(w.inventory[6],book);assert.equal(w.magics.length,1);
 w.packet('UseItem',{UniqueID:'book1',Success:true});assert.equal(w.inventory[6],null);assert.equal(w.pendingUses.size,0);assert.equal(sounds.includes('108'),false);assert.match(notices.at(-1),/技能书/);
 w.packet('UseItem',{UniqueID:'book1',Success:true});assert.equal(w.magics.length,1);assert.equal(w.inventory[6],null);
});

test('book double-click accepts fast mouse clicks and suppresses synthetic mouse after touch',()=>{
 const w=world(),handlers={};let used=0;w.nativeDoubleClick({on:(name,fn)=>handlers[name]=fn},()=>used++);
 handlers.mouse({getButton:()=>2});assert.equal(used,0);
 handlers.mouse({getButton:()=>0});assert.equal(used,0);
 handlers.mouse({getButton:()=>0});assert.equal(used,1);
 handlers.touch({});handlers.mouse({getButton:()=>0});assert.equal(used,1);
 handlers.touch({});assert.equal(used,2);handlers.mouse({getButton:()=>0});assert.equal(used,2);
});

test('ground pickup waits for confirmed arrival and never removes loot optimistically',()=>{
 const w=world(),sent=[];w.serverReady=true;w.connection.send=p=>{sent.push(p);return true;};
 w.loot.set(7,{point:{x:2,y:2},node:{destroy(){}},label:{node:{destroy(){}}}});w.pickupTarget=7;w.step={};
 w.pickupAtDestination();assert.equal(sent.length,0);w.step=null;w.pickupAtDestination();assert.equal(sent[0].type,'pickup');assert.equal(w.loot.size,1);w.pickupAtDestination();assert.equal(sent.length,1);
 w.packet('ObjectRemove',{ObjectID:7});assert.equal(w.loot.size,0);
});
test('map changes, disconnect and unavailable targets clear pending ground pickup',()=>{
 const w=world();let removed=0;w.loot.set(7,{node:{destroy(){removed++;}},label:{node:{destroy(){removed++;}}}});w.pickupTarget=7;
 w.serverEvent({type:'disconnected'});assert.equal(removed,2);assert.equal(w.loot.size,0);assert.equal(w.pickupTarget,0);
 w.serverReady=true;w.pickupTarget=99;w.pickupAtDestination();assert.equal(w.pickupTarget,0);
});

test('instance upgrades replace matching ID only, preserving other identical base items',()=>{
 const w=world();w.refreshBelt=()=>{};const info={name:'牛角戒指'};w.itemInfo.set(20,info);
 w.inventory[6]={uniqueid:'one',itemindex:20};w.inventory[7]={uniqueid:'two',itemindex:20};
 w.packet('ItemUpgraded',{Item:{UniqueID:'one',ItemIndex:20,AddedStats:{Values:{MaxDC:3}}}});
 assert.equal(w.inventory[6].addedstats.values.maxdc,3);assert.equal(w.inventory[7].addedstats,undefined);assert.equal(info.maxdc,undefined);
});
test('harvest has no optimistic reward and obeys death, range, movement and send failure',()=>{
 const w=world(),sent=[];w.serverReady=true;w.notice=()=>{};w.entityAt=()=>8;w.peers.set(8,{point:{x:3,y:2},dead:true});
 w.connection.send=p=>{sent.push(p);return false;};w.harvestAt({x:400,y:200});assert.equal(sent.length,1);assert.equal(w.actionTime,0);
 w.connection.send=p=>{sent.push(p);return true;};w.hp=0;w.harvestAt({x:400,y:200});assert.equal(sent.length,1);
 w.hp=18;w.step={};w.harvestAt({x:400,y:200});assert.equal(sent.length,1);w.step=null;
 w.peers.get(8).point.x=5;w.harvestAt({x:400,y:200});assert.equal(sent.length,1);w.peers.get(8).point.x=3;
 w.harvestAt({x:400,y:200});assert.equal(sent.at(-1).type,'harvest');assert.equal(w.inventory.filter(Boolean).length,0);assert.equal(w.peers.get(8).harvested,undefined);
});

test('merchant sale and repair apply only authoritative replies to the matching instance',()=>{
 const w=world();w.refreshBelt=()=>{};w.notice=()=>{};w.inventory=[{uniqueid:'91',count:2,currentdura:500,maxdura:1000,addedstats:{values:{maxdc:3}}},{uniqueid:'92',count:1}];
 w.packet('SellItem',{UniqueID:'91',Count:1,Success:false});assert.equal(w.inventory[0].count,2);
 w.packet('SellItem',{UniqueID:'91',Count:1,Success:true});assert.equal(w.inventory[0].count,1);assert.equal(w.inventory[1].uniqueid,'92');
 w.packet('ItemRepaired',{UniqueID:'91',CurrentDura:984,MaxDura:984});assert.equal(w.inventory[0].currentdura,984);assert.equal(w.inventory[0].addedstats.values.maxdc,3);
 w.packet('SellItem',{UniqueID:'91',Count:1,Success:true});assert.equal(w.inventory[0],null);assert.equal(w.inventory[1].uniqueid,'92');
});
test('late merchant quotes cannot replace a new item or reopen a closed window',()=>{
 const w=world();w.tradeRequest=8;w.menuKind='merchant';w.menu.active=true;let shown=0;w.showMerchant=()=>shown++;
 w.serverEvent({type:'tradeQuote',request:7,token:'old',quote:{Gold:1}});assert.equal(w.tradeQuote,null);assert.equal(shown,0);
 w.menu.active=false;w.serverEvent({type:'tradeQuote',request:8,token:'closed',quote:{Gold:2}});assert.equal(shown,0);
 w.menu.active=true;w.serverEvent({type:'tradeQuote',request:8,token:'current',quote:{Gold:3}});assert.equal(w.tradeQuote.quote.gold,3);assert.equal(shown,1);
});

test('bag move uses server acknowledgement, supports swaps, and rejects other grids',()=>{
 const w=world();w.notice=()=>{};w.inventory=Array(46).fill(null);const a={uniqueid:'a',count:3,addedstats:{maxdc:3}},b={uniqueid:'b',count:1};w.inventory[6]=a;w.inventory[7]=b;w.bagMovePending=true;
 w.packet('MoveItem',{Grid:1,From:6,To:7,Success:false});assert.equal(w.inventory[6],a);assert.equal(w.inventory[7],b);assert.equal(w.bagMovePending,false);
 w.packet('MoveItem',{Grid:4,From:6,To:7,Success:true});assert.equal(w.inventory[6],a);
 w.packet('MoveItem',{Grid:1,From:6,To:7,Success:true});assert.equal(w.inventory[7],a);assert.equal(w.inventory[6],b);assert.equal(w.inventory[7].addedstats.maxdc,3);
 w.packet('MoveItem',{Grid:1,From:7,To:8,Success:true});assert.equal(w.inventory[8],a);assert.equal(w.inventory[7],null);
});
test('bag selection sends one move and keeps inventory until the server replies',()=>{
 const w=world();w.inventory=Array(46).fill(null);const item={uniqueid:'23',count:1};w.inventory[6]=item;w.showInventory=()=>{};const sent=[];w.connection.send=c=>{sent.push(c);return true};
 w.bagCell(6);assert.equal(sent.length,0);w.bagCell(9);w.bagCell(10);assert.equal(sent.length,1);assert.equal(sent[0].from,6);assert.equal(sent[0].to,9);assert.equal(w.inventory[6],item);
});
test('first bag click keeps the hit region alive for a fast second click',()=>{
 const w=world();w.inventory=Array(46).fill(null);w.inventory[6]={uniqueid:'weapon',info:{type:1}};w.equipment=[];let renders=0;w.showInventory=()=>renders++;const sent=[];w.connection.send=c=>{sent.push(c);return true};
 w.bagCell(6);assert.equal(renders,0);w.bagCell(6);assert.equal(sent.length,1);assert.equal(sent[0].type,'equip');assert.equal(sent[0].uniqueId,'weapon');
});

test('skill keys resolve learned binding, never fall back to hardcoded fireball',()=>{
  const w=world(),casts=[],notices=[];w.magics=[{spell:31,key:3},{spell:61,key:8}];
  w.cast=spell=>casts.push(spell);w.notice=text=>notices.push(text);
  w.castKey(1);w.castKey(3);w.castKey(8);
  assert.deepEqual(casts,[31,61]);assert.equal(notices.length,1);
});
test('skill key save waits for matching acknowledgement and preserves training',()=>{
  const w=world(),sent=[];w.serverReady=true;w.notice=()=>{};w.showSkillKeys=()=>{};
  w.magics=[{spell:31,key:1,level:2,experience:19},{spell:61,key:3}];
  w.bindingSpell=31;w.bindingKey=3;w.connection.send=c=>(sent.push(c),true);
  w.saveSkillKey();w.saveSkillKey();assert.equal(sent.length,1);assert.equal(w.magics[0].key,1);
  w.serverEvent({type:'skillBindings',request:sent[0].request-1,success:true,bindings:[{spell:31,key:8}]});
  assert.equal(w.skillPending,true);assert.equal(w.magics[0].key,1);
  w.serverEvent({type:'skillBindings',request:sent[0].request,success:true,bindings:[{Spell:31,Key:3},{Spell:61,Key:0}]});
  assert.equal(w.skillPending,false);assert.deepEqual(w.magics,[{spell:31,key:3,level:2,experience:19},{spell:61,key:0}]);
});
test('failed save and disconnect do not apply unconfirmed or stale bindings',()=>{
  const w=world();w.serverReady=true;w.notice=()=>{};w.showSkillKeys=()=>{};w.magics=[{spell:31,key:1}];
  w.bindingSpell=31;w.bindingKey=8;w.connection.send=()=>false;w.saveSkillKey();
  assert.equal(w.skillPending,false);assert.equal(w.magics[0].key,1);
  w.connection.send=()=>true;w.saveSkillKey();const request=w.skillRequest;
  w.serverEvent({type:'skillBindings',request,success:false,message:'未学习'});
  assert.equal(w.magics[0].key,1);assert.equal(w.skillPending,false);
  w.saveSkillKey();const stale=w.skillRequest;w.serverEvent({type:'disconnected'});
  w.serverEvent({type:'skillBindings',request:stale,success:true,bindings:[{spell:31,key:8}]});
  assert.equal(w.magics[0].key,1);assert.equal(w.skillPending,false);
});
test('unsupported bound skill does not dispatch fireball',()=>{
 const w=world(),sent=[];w.magics=[{spell:32,key:8}];w.notice=()=>{};w.connection.send=c=>sent.push(c);
 w.castKey(8);assert.equal(sent.length,0);
});

test('F1-F8 dispatch the binding and modal keys select without casting',()=>{
 const w=world(),keys=[];w.castKey=key=>keys.push(key);
 for(const keyCode of [112,114,119])w.onKeyDown({keyCode});assert.deepEqual(keys,[1,3,8]);
 w.menu.active=true;w.menuKind='skillKeys';w.bindingSpell=31;w.showSkillKeys=()=>{};
 w.onKeyDown({keyCode:119});assert.equal(w.bindingKey,8);assert.equal(keys.length,3);
 w.skillPending=true;w.onKeyDown({keyCode:112});assert.equal(w.bindingKey,8);
 let returned=false;w.showSkills=()=>returned=true;w.onKeyDown({keyCode:27});assert.equal(returned,true);
});
test('small map is hidden underneath native windows and restored when closed',()=>{
 const w=world(),states=[];w.serverReady=true;w.miniMap={update:(dt,map,p,peers,active)=>states.push(active)};
 w.menu.active=true;w.panelRects=[{x:540,y:0,w:260,h:360}];w.update(.1);
 w.menu.active=false;w.update(.1);w.menu.active=true;w.panelRects=[{x:0,y:0,w:400,h:300}];w.update(.1);
 assert.deepEqual(states,[false,true,true]);
});

test('book hints show sourced class and learning level in Chinese',()=>{
 const w=world();for(const [requiredclass,name] of [[1,'战士'],[2,'法师'],[4,'道士']]){
  const hint=itemStats.itemDescription({}, {name:'技能书',type:20,requiredclass,requiredtype:0,requiredamount:7}, '技能书');
  assert.ok(hint.includes('所需职业 '+name));assert.ok(hint.includes('所需等级 7'));
 }
});
test('server durability updates dismiss stale hover details and preserve the instance',()=>{
 const w=world();let destroyed=0;w.itemTooltip={isValid:true,destroy(){destroyed++;}};w.itemTooltipOwner={isValid:true};
 w.inventory=[{uniqueid:'123',currentdura:10000,maxdura:10000}];w.equipment=[];
 w.packet('DuraChanged',{UniqueID:'123',CurrentDura:7756});
 assert.equal(destroyed,1);assert.equal(w.itemTooltip,undefined);assert.equal(w.inventory[0].currentdura,7756);assert.equal(w.inventory[0].maxdura,10000);
});
test('leaving a docked description restores the native bag footer and releases references',()=>{
 const w=world(),weight={name:'背包默认说明',active:false},other={name:'slot',active:true};let destroyed=0;
 w.itemTooltipDock={isValid:true,children:[weight,other]};w.itemTooltip={isValid:true,destroy(){destroyed++;}};
 w.itemTooltipOwner={isValid:true};w.clearItemTooltip();
 assert.equal(weight.active,true);assert.equal(other.active,true);assert.equal(destroyed,1);assert.equal(w.itemTooltipDock,undefined);assert.equal(w.itemTooltipOwner,undefined);
});
test('inventory and character windows toggle independently and survive item refresh',()=>{
 const w=world();w.serverReady=true;w.targetText={string:''};w.menu={active:false,children:[]};let bag=0,character=0;w.renderBag=()=>bag++;w.renderCharacter=()=>character++;
 w.showInventory('bag');assert.equal(w.bagOpen,true);assert.equal(w.characterOpen,false);
 w.showInventory('character');assert.equal(w.bagOpen,true);assert.equal(w.characterOpen,true);assert.equal(w.panelRects.length,0);
 w.showInventory();assert.equal(w.bagOpen,true);assert.equal(w.characterOpen,true);
 w.showInventory('bag');assert.equal(w.menu.active,true);assert.equal(w.characterOpen,true);assert.equal(w.bagOpen,false);
 w.showInventory('character');assert.equal(w.menu.active,false);assert.ok(bag>0&&character>0);
});
test('carried inventory item targets equipment without optimistic removal',()=>{
 const w=world(),sent=[];w.inventory[6]={uniqueid:'weapon',info:{type:1}};w.selectedBag=6;w.connection.send=v=>{sent.push(v);return true;};w.equipmentCell(0);
 assert.equal(sent[0].type,'equip');assert.equal(sent[0].slot,0);assert.equal(w.inventory[6].uniqueid,'weapon');assert.equal(w.selectedBag,-1);
});
test('occupied bag swap continues carrying the displaced item after successful acknowledgement only',()=>{
 const w=world();w.inventory[6]={uniqueid:'a'};w.inventory[7]={uniqueid:'b'};w.bagSwapSource=6;w.packet('MoveItem',{Grid:1,From:6,To:7,Success:true});
 assert.equal(w.inventory[7].uniqueid,'a');assert.equal(w.inventory[6].uniqueid,'b');assert.equal(w.selectedBag,6);assert.equal(w.bagSwapSource,-1);
});
test('failed carry move send leaves both items and clears pending swap intent',()=>{
 const w=world();w.inventory[6]={uniqueid:'a'};w.inventory[7]={uniqueid:'b'};w.selectedBag=6;w.connection.send=()=>false;w.bagCell(7);
 assert.equal(w.inventory[6].uniqueid,'a');assert.equal(w.inventory[7].uniqueid,'b');assert.equal(w.bagMovePending,false);assert.equal(w.bagSwapSource,-1);
});

test('taking off equipment carries locally and only commits after server reply',()=>{
 const w=world(),sent=[];w.notice=()=>{};w.inventory=Array(46).fill(null);w.equipment[0]={uniqueid:'sword'};w.connection.send=v=>{sent.push(v);return true;};
 w.equipmentCell(0);assert.equal(w.selectedEquipment,0);assert.equal(sent.length,0);assert.equal(w.equipment[0].uniqueid,'sword');
 w.bagCell(8);assert.equal(sent[0].type,'unequip');assert.equal(sent[0].to,8);assert.equal(w.inventory[8],null);assert.equal(w.equipmentPending,true);
 w.equipmentCell(0);w.bagCell(9);assert.equal(sent.length,1);
 w.packet('RemoveItem',{UniqueID:'sword',To:8,Success:true});assert.equal(w.equipmentPending,false);assert.equal(w.equipment[0],null);assert.equal(w.inventory[8].uniqueid,'sword');
});
test('cancel or failed takeoff never removes authoritative equipment',()=>{
 for(const failure of ['cancel','send','reply']){
 const w=world();w.notice=()=>{};w.inventory=Array(46).fill(null);w.equipment[0]={uniqueid:'sword'};w.equipmentCell(0);
 if(failure==='cancel')w.equipmentCell(0);
 else{w.connection.send=()=>failure!=='send';w.bagCell(8);if(failure==='reply')w.packet('RemoveItem',{UniqueID:'sword',To:8,Success:false});}
 assert.equal(w.selectedEquipment,-1);assert.equal(w.equipmentPending,false);assert.equal(w.equipment[0].uniqueid,'sword');assert.equal(w.inventory[8],null);
 }
});
test('occupied destination uses free bag cell and full bag retains carried equipment',()=>{
 const w=world(),sent=[];w.notice=()=>{};w.inventory=Array(46).fill(null);w.inventory[8]={uniqueid:'potion'};w.equipment[0]={uniqueid:'sword'};w.connection.send=v=>{sent.push(v);return true;};w.equipmentCell(0);w.bagCell(8);
 assert.equal(sent[0].to,6);assert.equal(w.inventory[8].uniqueid,'potion');
 w.equipmentPending=false;w.inventory.fill({uniqueid:'occupied'});w.equipmentCell(0);w.bagCell(8);assert.equal(sent.length,1);assert.equal(w.selectedEquipment,0);assert.equal(w.equipment[0].uniqueid,'sword');
});
test('disconnect cancels carried equipment and pending action',()=>{
 const w=world();w.selectedEquipment=0;w.equipmentPending=true;w.serverEvent({type:'disconnected'});assert.equal(w.selectedEquipment,-1);assert.equal(w.equipmentPending,false);
});

test('missing equipment reply resynchronizes instead of retrying the transaction',()=>{
 const w=world();w.notice=()=>{};w.serverReady=true;w.equipmentPending=true;w.equipmentPendingAt=Date.now()-6000;w.equipment[0]={uniqueid:'sword'};w.syncCarriedItem();
 assert.equal(w.reconnected,true);assert.equal(w.serverReady,false);assert.equal(w.equipmentPending,false);assert.equal(w.equipment[0].uniqueid,'sword');
});

test('character pages cycle four original pages without closing bag or keeping worn carry',()=>{
 const w=world();let refresh=0;w.showInventory=()=>refresh++;w.bagOpen=true;w.characterOpen=true;w.selectedEquipment=0;
 w.changeCharacterPage(-1);assert.equal(w.characterPage,3);assert.equal(w.selectedEquipment,-1);assert.equal(w.bagOpen,true);
 w.changeCharacterPage(1);assert.equal(w.characterPage,3);w.characterNavAt=-Infinity;w.changeCharacterPage(1);assert.equal(w.characterPage,0);assert.equal(refresh,2);
});
test('skills entrance and binding return preserve the bag and native character window',()=>{
 const w=world();w.showInventory=()=>{};w.menu.active=true;w.menuKind='inventory';w.bagOpen=true;w.showSkills();assert.equal(w.characterPage,3);assert.equal(w.characterOpen,true);assert.equal(w.bagOpen,true);
 w.menuKind='skillKeys';w.skillReturnBag=true;w.showSkills();assert.equal(w.menuKind,'inventory');assert.equal(w.bagOpen,true);
});
test('final character stats accept only own snapshot and are cleared on disconnect',()=>{
 const w=world();w.ownId=1;w.serverEvent({type:'vitals',data:{ObjectId:2,Attributes:{MaxDC:999}}});assert.equal(w.attributes,null);
 w.serverEvent({type:'vitals',data:{ObjectId:1,Attributes:{MinDC:1,MaxDC:9}}});assert.equal(w.attributes.maxdc,9);w.serverEvent({type:'disconnected'});assert.equal(w.attributes,null);
});

test('new character session clears previous role page and final stats',()=>{
 const w=world();w.characterPage=3;w.skillPage=2;w.skillReturnBag=true;w.attributes={maxdc:999};w.serverEvent({type:'ready',objectId:1,x:2,y:2});
 assert.equal(w.characterPage,0);assert.equal(w.skillPage,0);assert.equal(w.skillReturnBag,false);assert.equal(w.attributes,null);
});

test('drag updates both the original panel and its world hit rectangle with viewport bounds',()=>{
 const w=world(),positions=[];w.menu.active=true;w.menuKind='inventory';const rect={x:0,y:0,w:336,h:270};w.inventoryWindows.set('bag',{node:{setPosition:(x,y)=>positions.push([x,y])},rect});w.windowDrag={id:'bag',dx:20,dy:5};w.mousePoint={x:220,y:85};w.moveInventoryWindow();
 assert.deepEqual(positions[0],[200,-80]);assert.equal(rect.x,200);assert.equal(rect.y,80);assert.equal(w.windowPositions.bag.x,200);
 w.mousePoint={x:999,y:999};w.moveInventoryWindow();assert.equal(rect.x,464);assert.equal(rect.y,330);
 w.menu.active=false;w.moveInventoryWindow();assert.equal(w.windowDrag,null);
});
test('window focus order survives refresh and does not move another window',()=>{
 const w=world(),order=[];w.menu.children=[{},{}];for(const id of ['bag','character'])w.inventoryWindows.set(id,{node:{isValid:true,setSiblingIndex:()=>order.push(id)},rect:{x:0,y:0,w:10,h:10}});
 w.focusInventoryWindow('bag');assert.equal(w.windowOrder.join(','),'character,bag');assert.equal(order.join(','),'character,bag');assert.equal(w.windowPositions.character.x,568);
});
test('drag release cannot become ground movement and disconnect cancels capture',()=>{
 const w=world();let moved=false;w.destination=()=>moved=true;w.windowDrag={id:'bag',dx:0,dy:0};w.onMouse({getButton:()=>0,getUILocation:()=>({x:500,y:500})});assert.equal(moved,false);
 w.serverEvent({type:'disconnected'});assert.equal(w.windowDrag,null);
});

test('slow attack acknowledgements cannot accumulate attacks or strand a loot walk',()=>{
 const w=world(),sent=[];w.serverReady=true;w.notice=()=>{};
 w.connection.send=p=>{sent.push(p);return true;};w.selected=8;w.autoAttack=true;
 w.peers.set(8,{kind:'monster',point:{x:3,y:2},visual:{x:3,y:2},from:{x:3,y:2},elapsed:0,dead:false});
 w.attack();const attack=sent.at(-1);
 for(let i=0;i<24;i++)w.update(.1);
 assert.equal(sent.filter(p=>p.type==='attack').length,1,'animation expiry must not queue another unconfirmed attack');
 w.autoAttack=false;w.path=[{x:3,y:2}];w.beginStep();assert.equal(w.step,null);
 w.serverEvent({type:'state',command:'attack',seq:attack.seq+1,x:2,y:2});w.beginStep();assert.equal(w.step,null,'stale acknowledgement must not release the action');
 w.serverEvent({type:'state',command:'attack',seq:attack.seq,x:2,y:2});w.beginStep();assert.equal(w.step.to.x,3);
 w.serverEvent({type:'state',command:'walk',seq:w.step.seq,x:3,y:2,accepted:true});w.update(.7);
 assert.equal(w.point.x,3);assert.equal(w.serverReady,true);assert.equal(w.reconnected,undefined);
});
test('cast and harvest share the action acknowledgement barrier and rejected cast unlocks it',()=>{
 for(const kind of ['cast','harvest']){
  const w=world(),sent=[];w.serverReady=true;w.notice=()=>{};w.magics=[{spell:31}];w.selected=8;
  w.peers.set(8,{kind:'monster',dead:kind==='harvest',point:{x:3,y:2}});w.entityAt=()=>8;
  w.connection.send=p=>{sent.push(p);return true;};
  const invoke=()=>kind==='cast'?w.cast():w.harvestAt({x:400,y:200});
  invoke();w.actionTime=0;invoke();assert.equal(sent.length,1);
  w.path=[{x:2,y:3}];w.beginStep();assert.equal(w.step,null);
  w.serverEvent({type:'actionRejected',command:kind,seq:sent[0].seq,message:'服务器拒绝'});
  w.actionTime=0;w.beginStep();assert.equal(w.step.to.y,3);
 }
});
test('message handler failures retain bounded metadata without hiding them as invalid JSON',()=>{
 const sockets=[],statuses=[],logs=[];
 class Socket{constructor(){sockets.push(this);}close(){}}
 const {CrystalConnection}=load('../client/assets/scripts/platform/connection.ts',{}, {WebSocket:Socket,setTimeout,clearTimeout,console:{error:(...args)=>logs.push(args)}});
 const c=new CrystalConnection(s=>statuses.push(s),()=>{throw Error('private payload must not be logged');});c.connect();
 for(let i=0;i<25;i++)sockets[0].onmessage({data:JSON.stringify({type:'packet',packet:'GainedGold',data:{secret:'never-log'}})});
 assert.equal(c.errors.length,20);assert.equal(c.errors[0].packet,'GainedGold');assert.match(statuses.at(-1),/消息处理异常/);
 assert.equal(JSON.stringify(logs).includes('never-log'),false);assert.equal(JSON.stringify(logs).includes('private payload'),false);
 sockets[0].onmessage({data:'invalid json'});assert.match(statuses.at(-1),/无法识别/);assert.equal(c.errors.length,20);c.close();
});
test('disconnect clears an unconfirmed combat action before a later session',()=>{
 const w=world();w.serverReady=true;w.sendAction('attack',{direction:2});assert.ok(w.pendingAction);
 w.serverEvent({type:'disconnected'});assert.equal(w.pendingAction,null);
 w.serverEvent({type:'ready',objectId:1,x:2,y:2,hp:18});assert.equal(w.sendAction('harvest',{direction:2}),true);
});

test('continuous movement preserves the 600ms cooldown and running at 30/60 FPS', () => {
 for(const fps of [30,60]){
  movementNow=1000;const w=world();w.serverReady=true;w.grid={width:100,height:100,blocked:new Set()};w.runRequested=true;w.keys.add(68);
  const sent=[];w.connection.send=m=>{sent.push({type:m.type,at:movementNow});return true;};let ack=0;
  for(let i=0;i<fps*6;i++){
   movementNow+=1000/fps;w.update(1/fps);
   if(w.step&&w.step.seq!==ack){ack=w.step.seq;w.serverEvent({type:'state',seq:ack,x:w.step.to.x,y:w.step.to.y,accepted:true});}
  }
  assert.equal(sent[0].type,'walk');assert.ok(sent.filter(m=>m.type==='run').length>=7,JSON.stringify(sent));
  for(let i=1;i<sent.length;i++)assert.ok(sent[i].at-sent[i-1].at>=599.99,'movement sent before cooldown');
 }
});

test('rejected equip explains known requirements and preserves the original item',()=>{
 const w=world();w.level=2;const item={uniqueid:'31',itemindex:7,info:{type:6,requiredtype:0,requiredamount:3}};w.inventory=[item];w.equipment=[];let message='';w.notice=s=>message=s;
 w.packet('EquipItem',{UniqueID:31,To:5,Success:false});assert.equal(w.inventory[0],item);assert.match(message,/所需等级 3/);
});
test('equip and takeoff use the same category sound after success, never on rejection',()=>{
 for(const [type,file] of [[1,'111'],[2,'112'],[5,'115'],[6,'114'],[7,'113']]){
  const w=world(),heard=[];w.sound.play=s=>heard.push(s);w.notice=()=>{};const item={uniqueid:'31',itemindex:type,info:{type}};w.inventory=[item];w.equipment=[null];
  w.packet('EquipItem',{UniqueID:31,To:0,Success:false});assert.deepEqual(heard,[]);
  w.packet('EquipItem',{UniqueID:31,To:0,Success:true});w.packet('RemoveItem',{UniqueID:31,To:0,Success:true});assert.deepEqual(heard,[file,file]);assert.equal(w.inventory[0],item);
 }
});
test('death cancels queued movement and combat, resets death animation and uses gender sound',()=>{
 for(const gender of [0,1]){
  const w=world(),heard=[];w.gender=gender;w.serverReady=true;w.sound={stop(){},play:file=>heard.push(file)};w.notice=message=>w.deathNotice=message;
  w.autoAttack=true;w.path=[{x:3,y:2}];w.keys.add(68);w.actionTime=.6;w.animationClock=9;w.pendingAction={seq:3};
  w.packet('Death',{});
  assert.equal(w.hp,0);assert.equal(w.autoAttack,false);assert.equal(w.path.length,0);assert.equal(w.keys.size,0);assert.equal(w.pendingAction,null);assert.equal(w.actionTime,0);assert.equal(w.animationClock,0);assert.deepEqual(heard,[gender?'145':'144']);assert.match(w.deathNotice,/Alt\+X/);
 }
});

test('death scene changes world sprites once, preserves HUD and restores after revival',()=>{
 const w=world(),actors=[{grayscale:false},{grayscale:false}],hud={grayscale:false},terrain=[];let traversals=0;
 w.world={getComponentsInChildren(){traversals++;return actors;}};w.terrain={setGrayscale(value){terrain.push(value);}};
 w.hp=0;w.syncDeathScene();w.syncDeathScene();assert.equal(traversals,1);assert.ok(actors.every(s=>s.grayscale));assert.equal(hud.grayscale,false);
 w.hp=18;w.syncDeathScene();assert.equal(traversals,2);assert.ok(actors.every(s=>!s.grayscale));assert.deepEqual(terrain,[true,true,false]);
});

test('pointer Alt still harvests when keyboard modifier state was lost, and next click clears it',()=>{
 const w=world();w.sound={unlock(){}};let harvested=0,moved=0;w.harvestAt=()=>harvested++;w.destination=()=>moved++;
 // Non-left pointer exits the inventory drag path, but modifier state must still be captured.
 w.windowPointerDown({altKey:true,button:2});w.onMouse({getButton:()=>0,getUILocation:()=>({x:400,y:300})});assert.equal(harvested,1);assert.equal(moved,0);
 w.windowPointerDown({altKey:false,button:2});w.onMouse({getButton:()=>0,getUILocation:()=>({x:400,y:300})});assert.equal(moved,1);assert.equal(w.pointerAlt,false);
});

test('closing a native panel consumes the same mouse/touch release before navigation',()=>{
 const w=world();w.sound={unlock(){},play(){}};let moves=0;w.destination=()=>moves++;const events={};
 w.nativeClick({on:(name,fn)=>events[name]=fn},()=>{w.menu.active=false;});w.menu.active=true;
 events.mouse({propagationStopped:false,getButton:()=>0});w.onMouse({getButton:()=>0,getUILocation:()=>({x:300,y:400})});w.onTouch({getUILocation:()=>({x:300,y:400})});
 assert.equal(moves,0);w.uiGesture=false;w.onMouse({getButton:()=>0,getUILocation:()=>({x:300,y:400})});assert.equal(moves,1);
});
test('round HUD button transparent edges still block world navigation',()=>{
 for(const r of classicLayout.HUD_CONTROLS)for(const [x,y] of [[r.x,r.y],[r.x+r.w-1,r.y+r.h-1]])assert.equal(classicLayout.blocksWorld(x,y,[],[]),true);
 assert.equal(classicLayout.blocksWorld(600,350,[],[]),false);
});

test('carried equipment drop waits for matching success and failure keeps item',()=>{
 const w=world();w.serverReady=true;w.inventory=Array(46).fill(null);const item={uniqueid:'99',count:1};w.inventory[6]=item;w.selectedBag=6;let sent=[];w.connection.send=c=>{sent.push(c);return true;};w.notice=()=>{};w.refreshBelt=()=>{};
 assert.equal(w.dropCarried({x:400,y:300}),true);assert.equal(w.inventory[6],item);assert.equal(sent[0].type,'dropItem');w.dropCarried({x:400,y:300});assert.equal(sent.length,1);
 w.packet('DropItem',{UniqueID:'wrong',Success:true});assert.equal(w.inventory[6],item);
 w.packet('DropItem',{UniqueID:'99',Success:false});assert.equal(w.inventory[6],item);assert.equal(w.bagMovePending,false);
 w.dropCarried({x:400,y:300});w.packet('DropItem',{UniqueID:'99',Success:true});assert.equal(w.inventory[6],null);assert.equal(w.selectedBag,-1);
});

test('lost drop reply reconnects to authoritative inventory instead of retrying removal',()=>{
 const w=world();w.notice=()=>{};w.serverReady=true;w.inventory[6]={uniqueid:'keep',count:1};w.pendingDrop='keep';w.pendingDropAt=Date.now()-6000;w.bagMovePending=true;w.syncCarriedItem();
 assert.equal(w.reconnected,true);assert.equal(w.inventory[6].uniqueid,'keep');assert.equal(w.pendingDrop,null);
});

test('fireball uses hovered monster without selecting or starting melee',()=>{
 const w=world();w.serverReady=true;w.magics=[{spell:31,key:1}];w.entityAt=()=>42;w.peers.set(42,{kind:'monster',point:{x:5,y:2},dead:false});let sent;w.sendAction=(type,payload)=>{sent={type,...payload};return true;};w.autoAttack=true;w.path=[{x:3,y:2}];w.castKey(1);
 assert.equal(sent.targetId,42);assert.equal(sent.spell,31);assert.equal(w.autoAttack,false);assert.equal(w.path.length,0);
});
test('held mouse follows cursor with left walking/right running and stops on release',()=>{
 const w=world();w.serverReady=true;w.mousePoint={x:400,y:300};const calls=[];w.destination=p=>calls.push({p,run:w.runRequested});
 for(const button of [0,2]){w.heldButton=button;w.heldTick=0;w.updateHeldPointer(.2);assert.equal(calls.at(-1).run,button===2);}
 w.windowPointerUp({});w.updateHeldPointer(1);assert.equal(calls.length,2);
 w.heldButton=2;w.mousePoint={x:680,y:380};w.heldTick=0;w.updateHeldPointer(1);assert.equal(calls.length,2);
 w.pauseInput();assert.equal(w.heldButton,null);
});
test('casting refreshes stationary cursor target and never casts through a UI panel',()=>{
 const w=world();w.serverReady=true;w.magics=[{spell:31,key:1}];w.mousePoint={x:400,y:200};w.hovered=9;
 w.peers.set(42,{kind:'monster',point:{x:5,y:2},dead:false});w.entityAt=()=>42;
 const sent=[];w.sendAction=(type,payload)=>(sent.push(payload),true);w.castKey(1);assert.equal(sent[0].targetId,42);
 w.menu.active=true;w.panelRects=[{x:350,y:100,w:100,h:200}];w.castKey(1);assert.equal(sent.length,1);
});
test('equip and remove acknowledgements use the actual item category and bracelet name',()=>{
 for(const [type,name,sound] of [[1,'青铜剑','111'],[2,'布衣','112'],[4,'布帽','116'],[5,'金项链','115'],[6,'铁手镯','117'],[7,'牛角戒指','113']]){
  const w=world();w.notice=()=>{};w.refreshBelt=()=>{};w.inventory=Array(46).fill(null);w.equipment=Array(14).fill(null);w.inventory[6]={uniqueid:'test',info:{type,name}};const sounds=[];w.sound={play:s=>sounds.push(s)};
  w.packet('EquipItem',{UniqueID:'test',To:0,Success:true});w.packet('RemoveItem',{UniqueID:'test',To:6,Success:true});assert.deepEqual(sounds,[sound,sound]);
 }
});

test('all fireball phases use additive sprites, preserving black light backgrounds',()=>{
 const w=world();w.manifest={spellFireBall:{hit:['magic:170'],projectile:Array(16).fill(['magic:10'])}};
 w.makeNode=()=>({getComponent:()=>({setAnchorPoint(){}}),addComponent:C=>new C()});
 w.spellEffect({x:1,y:1},{x:2,y:2});w.spellEffect({x:2,y:2},{x:2,y:2},true);
 assert.equal(w.particleEffects.length,2);for(const e of w.particleEffects)assert.equal(e.sprite.additive,true);
});
test('only successful magic acknowledgement retains a living target without auto melee',()=>{
 const w=world();w.notice=()=>{};w.spellEffect=()=>{};w.peers.set(42,{kind:'monster',point:{x:5,y:2},dead:false});
 w.packet('Magic',{Cast:false,TargetID:42});assert.equal(w.selected,0);
 w.packet('Magic',{Cast:true,TargetID:42,Target:{x:5,y:2}});assert.equal(w.selected,42);assert.equal(w.autoAttack,false);
 w.selected=0;w.peers.get(42).dead=true;w.packet('Magic',{Cast:true,TargetID:42});assert.equal(w.selected,0);
});
test('shop back leaves detail first and returns to merchant menu from categories',()=>{
 const w=world();w.clearItemTooltip=()=>{};let renders=0;const sent=[];w.showShop=()=>renders++;w.connection.send=p=>(sent.push(p),true);w.shopDetail=9;w.shopTop=18;w.selectedGood={};w.npcId=42;
 w.shopBack();assert.equal(w.shopDetail,null);assert.equal(w.selectedGood,null);assert.equal(w.shopTop,0);assert.equal(renders,1);assert.equal(sent.length,0);
 w.shopBack();assert.equal(sent[0].key,'[@MAIN]');assert.equal(sent[0].id,42);
});
test('one gesture cannot activate rebuilt native buttons twice or execute right-click actions',()=>{
 const w=world(),handlers={};let actions=0;
 const node=()=>({on:(name,fn)=>handlers[name]=fn});
 const bind=()=>w.nativeClick(node(),()=>{actions++;bind();},false);bind();
 handlers.touch({});handlers.mouse({getButton:()=>0});assert.equal(actions,1);
 w.lastNativeTouch=-Infinity;handlers.mouse({getButton:()=>2});assert.equal(actions,1);
 handlers.touch({});assert.equal(actions,2);
});
test('healing uses self on empty ground instead of retained hostile selection, and hovered player when present',()=>{
 const w=world();w.serverReady=true;w.ownId=7;w.magics=[{spell:61,key:2}];w.entityAt=()=>0;w.selected=42;w.mousePoint={x:400,y:200};const sent=[];w.sendAction=(type,p)=>(sent.push(p),true);
 w.castKey(2);assert.equal(sent[0].spell,61);assert.equal(sent[0].targetId,7);
 w.peers.set(8,{kind:'player',point:{x:3,y:2},dead:false});w.entityAt=()=>8;w.castKey(2);assert.equal(sent[1].targetId,8);
 w.notice=()=>{};w.peers.get(8).dead=true;w.castKey(2);assert.equal(sent.length,2);
});
test('healing acknowledgements never play fireball effects or create a damage target marker',()=>{
 const w=world();w.notice=()=>{};const calls=[];w.healingEffect=(...a)=>calls.push(a);w.spellEffect=()=>assert.fail('healing became fireball');w.ownId=7;
 w.packet('Magic',{Spell:61,Cast:false,TargetID:7});assert.equal(calls.length,0);
 w.packet('Magic',{Spell:61,Cast:true,TargetID:7,Target:{x:2,y:2}});assert.equal(calls.length,1);assert.equal(w.fireTargets.size,0);
});

test('single category click opens instances without buying, instance selection preserves exact identity',()=>{
 const w=world(),sent=[];w.clearItemTooltip=()=>{};w.showShop=()=>{};w.targetText={string:'old'};w.itemHint=i=>'bonus '+i.uniqueid;w.connection.send=p=>(sent.push(p),true);
 w.shopTop=9;w.selectedGood={};w.selectShopRow({shopGroup:true,itemindex:7});
 assert.equal(w.shopDetail,7);assert.equal(w.shopTop,0);assert.equal(w.selectedGood,null);assert.equal(sent.length,0);
 const item={uniqueid:'9007199254740993',itemindex:7,currentdura:1200,addedstats:{values:{maxdc:3}}};
 w.selectShopRow(item);assert.equal(w.selectedGood,item);assert.equal(w.selectedGood.addedstats.values.maxdc,3);assert.equal(sent.length,0);
 w.shopBack();assert.equal(w.shopDetail,null);assert.equal(w.selectedGood,null);
});

test('background movement snaps to latest authority instead of traversing stale visual positions',()=>{
 const w=world();const peer={visual:{x:2,y:2},from:{x:2,y:2},point:{x:2,y:2},elapsed:1};w.peers.set(42,peer);
 w.packet('ObjectWalk',{ObjectID:42,Location:{X:3,Y:2}});assert.equal(peer.elapsed,0);assert.equal(peer.from.x,2);
 movementNow+=120000;
 w.packet('ObjectWalk',{ObjectID:42,Location:{X:4,Y:2}});assert.equal(peer.elapsed,.6);assert.equal(peer.visual.x,4);assert.equal(peer.from.x,4);
 w.packet('ObjectWalk',{ObjectID:42,Location:{X:17,Y:8}});assert.equal(peer.visual.x,17);
});
test('normal one-cell walks and two-cell runs interpolate; discontinuities snap',()=>{
 const w=world(),p={visual:{x:1,y:1},point:{x:1,y:1},from:{x:1,y:1},elapsed:1};
 w.positionPeer(p,{x:3,y:1},true);assert.equal(p.elapsed,0);assert.equal(p.from.x,1);
 w.positionPeer(p,{x:12,y:1},true);assert.equal(p.elapsed,.6);assert.equal(p.visual.x,12);
});
test('resume clears stale presentations and held inputs without discarding unconfirmed own step',()=>{
 const w=world(),p={visual:{x:1,y:1},point:{x:9,y:7},from:{x:1,y:1},elapsed:0,actionTime:.4};w.peers.set(4,p);
 let removed=0;w.particleEffects=[{node:{destroy:()=>removed++}}];w.heldButton=0;w.keys.add(68);w.path=[{x:3,y:2}];w.autoAttack=true;w.step={seq:91};
 w.resumePeerPresentation();assert.equal(p.visual.x,9);assert.equal(p.from.y,7);assert.equal(p.actionTime,0);assert.equal(removed,1);
 assert.equal(w.heldButton,null);assert.equal(w.keys.size,0);assert.equal(w.path.length,0);assert.equal(w.autoAttack,false);assert.equal(w.step.seq,91);
});

test('paused rendering does not accumulate transient spell nodes',()=>{
 const w=world();movementNow+=60000;w.makeNode=()=>assert.fail('background effect allocated');
 w.spellEffect({x:1,y:1},{x:2,y:2});w.healingEffect({x:1,y:1},{x:1,y:1},7);
 assert.equal(w.particleEffects.length,0);
});

test('fireball separates original cast light, distance flight and impact timing',()=>{
 const w=world();w.manifest={spellFireBall:{cast:['magic:0'],hit:['magic:170'],projectile:Array(16).fill(['magic:10'])}};
 w.makeNode=()=>({getComponent:()=>({setAnchorPoint(){}}),addComponent:C=>new C()});
 w.spellEffect({x:1,y:1},{x:1,y:1},false,true);
 w.spellEffect({x:1,y:1},{x:2,y:1});w.spellEffect({x:1,y:1},{x:9,y:3});w.spellEffect({x:2,y:1},{x:2,y:1},true);
 const [cast,near,far,hit]=w.particleEffects;assert.equal(cast.keys[0],'magic:0');assert.equal(cast.life,.5);assert.equal(cast.age,0);
 assert.equal(near.age,-.5);assert.equal(near.node.active,false);assert.equal(near.life,.05);assert.equal(far.life,.4);assert.equal(near.frameInterval,.03);assert.equal(hit.life,.6);
});

for(const running of [false,true])test(`skill during ${running?'run':'walk'} preserves committed step then casts once at captured target`,()=>{
 const w=world(),sent=[];w.serverReady=true;w.ownId=7;w.magics=[{spell:31,key:1}];w.mousePoint={x:400,y:200};w.entityAt=()=>42;
 w.peers.set(42,{kind:'monster',point:{x:5,y:2},visual:{x:5,y:2},from:{x:5,y:2},elapsed:1,dead:false});
 w.connection.send=p=>(sent.push(p),true);w.keys.add(68);w.beginStep();w.step.running=running;const seq=w.step.seq;
 w.path=[{x:4,y:2}];w.heldButton=running?2:0;w.runRequested=running;w.castKey(1);
 assert.equal(w.step.seq,seq);assert.equal(w.path.length,0);assert.equal(w.keys.size,0);assert.equal(w.heldButton,null);assert.equal(w.runRequested,false);assert.equal(sent.length,1);
 w.entityAt=()=>99;w.update(.6);assert.equal(sent.length,1,'no cast before confirmation');
 w.serverEvent({type:'state',seq,x:3,y:2});movementNow+=600;w.lastVisibleFrameAt=movementNow;w.update(.01);
 assert.equal(w.step,null);assert.equal(sent.length,2);assert.equal(sent[1].type,'cast');assert.equal(sent[1].targetId,42);
 w.update(.1);assert.equal(sent.length,2);
});
test('queued cast cancels on pause and never fires at dead target or after expiry',()=>{
 for(const reason of ['pause','dead','expired']){
 const w=world();w.serverReady=true;w.magics=[{spell:31,key:1}];w.mousePoint={x:400,y:200};w.entityAt=()=>42;w.notice=()=>{};
 w.peers.set(42,{kind:'monster',point:{x:5,y:2},dead:false});w.step={seq:1};w.castKey(1);
 if(reason==='pause')w.pauseInput();if(reason==='dead')w.peers.get(42).dead=true;if(reason==='expired')movementNow+=3001;
 w.step=null;w.connection.send=()=>assert.fail('cancelled skill sent');w.beginStep();assert.equal(w.queuedCast,null);
 }
});

test('trade Escape requests cancellation without hiding other panels or moving', () => {
  const w=world();let cancelled=0;w.menu.active=true;
  w.playerTrade={active:true,cancel(){cancelled++;}};
  w.onKeyDown({keyCode:27});
  assert.equal(cancelled,1);assert.equal(w.menu.active,true);assert.equal(w.step,null);
});
test('server trade packets reach the separate player window with normalized fields',()=>{
  const w=world(),events=[];w.playerTrade={event:(...args)=>events.push(args)};
  for(const name of ['TradeRequest','TradeAccept','TradeCancel','TradeConfirm'])w.packet(name,{Name:'交易甲',Unlock:false});
  assert.equal(events.length,4);assert.equal(events[0][1].name,'交易甲');assert.equal(events[2][1].unlock,false);
});
test('a pending trade invitation blocks movement and skill hotkeys',()=>{
  const w=world();w.playerTrade={inviting:true};w.serverReady=true;
  let casts=0;w.castKey=()=>casts++;
  w.onKeyDown({keyCode:68});w.onKeyDown({keyCode:112});
  assert.equal(w.keys.size,0);assert.equal(w.step,null);assert.equal(casts,0);
});
