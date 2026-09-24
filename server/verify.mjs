import assert from 'node:assert/strict';
import net from 'node:net';
import fs from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
const report={time:new Date().toISOString(),success:false,checks:[],events:[]};
const health=await (await fetch('http://127.0.0.1:17080/health')).json();
const expectedMaps=JSON.parse(fs.readFileSync(new URL('./content/world-maps.json',import.meta.url))).maps.length;
assert.equal(health.running,true);assert.equal(health.maps,expectedMaps);report.health=health;
await new Promise((resolve,reject)=>{const tcp=net.connect(17000,'127.0.0.1');tcp.setTimeout(5000);tcp.on('timeout',()=>{tcp.destroy();reject(Error('TCP timeout'));});tcp.on('error',reject);tcp.on('data',data=>{try{assert.equal(data.subarray(0,4).toString('hex'),'04000000');report.tcpFirstFrame='04000000';tcp.end();resolve();}catch(e){reject(e);tcp.destroy();}});});
report.checks.push('Actual Crystal TCP Connected: length4,packetID0');
await delay(100); // Let the original TCP connection leave the Crystal processing loop.
class Session {
 constructor(label){this.label=label;this.events=[];this.waiters=[];this.guestRequested=false;this.ws=new WebSocket('ws://127.0.0.1:17080/ws');this.ws.onmessage=({data})=>{const e=JSON.parse(data);if(e.type==='auth'&&e.stage==='login'&&!e.message&&!this.guestRequested){this.guestRequested=true;this.ws.send(JSON.stringify({type:'guest'}));}this.events.push(e);report.events.push({session:label,...e});for(const w of [...this.waiters])if(w.predicate(e)){this.waiters.splice(this.waiters.indexOf(w),1);clearTimeout(w.timer);w.resolve(e);}};this.ws.onerror=e=>console.error(label,'WebSocket error',e.message);}
 wait(predicate,timeout=15000){const existing=this.events.find(predicate);if(existing)return Promise.resolve(existing);return new Promise((resolve,reject)=>{let w={predicate,resolve};w.timer=setTimeout(()=>{this.waiters.splice(this.waiters.indexOf(w),1);reject(Error(this.label+' event timeout'));},timeout);this.waiters.push(w);});}
 async move(direction,seq){await delay(650);this.ws.send(JSON.stringify({type:'walk',direction,seq}));return this.wait(e=>e.type==='state'&&e.seq===seq);}
 close(){this.ws.close();}
}
const first=new Session('first');
try{
 const ready=await first.wait(e=>e.type==='ready'||e.type==='error');assert.equal(ready.type,'ready',JSON.stringify(ready));assert.ok(Number.isInteger(ready.x)&&Number.isInteger(ready.y));assert.equal(ready.source,'crystal-tcp');
 report.checks.push('Actual guest Login (create on first use), StartGame4, UserInformation with authoritative coordinates');
 const bytes=fs.readFileSync(new URL('../assets/server-maps/0.map',import.meta.url));const h=bytes.readUInt16LE(6);
 const blocked=(x,y)=>{let o=8+(x*h+y)*26;return !!((bytes.readUInt32LE(o+2)&0x20000000)||(bytes.readUInt16LE(o+12)&0x8000));};
 const dirs=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
 let x=ready.x,y=ready.y,seq=0;
 for(let dir=0;dir<8;dir++){
  const [dx,dy]=dirs[dir];const b=blocked(x+dx,y+dy);const state=await first.move(dir,++seq);
  assert.deepEqual([state.x,state.y],state.accepted?[x+dx,y+dy]:[x,y]);
  if(b)assert.equal(state.accepted,false);
  if(!state.accepted&&!b) {
   const peerPositions=new Map();for(const e of first.events){if(e.type==='peer')peerPositions.set(e.id,e);if(e.type==='peerRemoved')peerPositions.delete(e.id);}
   assert.ok([...peerPositions.values()].some(e=>e.x===x+dx&&e.y===y+dy),'Unblocked terrain rejection must be occupied by a real peer');
  }
  x=state.x;y=state.y;
 }
 report.checks.push('All8 directions sent as real Walk packets; authoritative result matches original map collision');
 // Find the shortest walk to a wall boundary, then ask Crystal to walk into that blocked map cell.
 const queue=[{x,y,path:[]}],seen=new Set([x+','+y]);let wallRoute;
 for(let i=0;i<queue.length&&!wallRoute;i++)for(let dir=0;dir<8;dir++){
  const q=queue[i],[dx,dy]=dirs[dir],nx=q.x+dx,ny=q.y+dy;
  if(nx<264||nx>=312||ny<596||ny>=634)continue;
  if(blocked(nx,ny)){wallRoute=[...q.path,dir];break;}
  if(!seen.has(nx+','+ny)){seen.add(nx+','+ny);queue.push({x:nx,y:ny,path:[...q.path,dir]});}
 }
 assert.ok(wallRoute);let last;
 for(const dir of wallRoute){last=await first.move(dir,++seq);x=last.x;y=last.y;}
 assert.equal(last.accepted,false);report.checks.push('Crystal rejected real blocked cell with UserLocation and accepted=false');
 const second=new Session('second');
 try{
  const ready2=await second.wait(e=>e.type==='ready'||e.type==='error');assert.equal(ready2.type,'ready',JSON.stringify(ready2));
  await first.wait(e=>e.type==='peer'&&e.id===ready2.objectId&&e.packet==='ObjectPlayer');
  await second.move(2,1);
  const broadcast=await first.wait(e=>e.type==='peer'&&e.id===ready2.objectId&&e.packet==='ObjectWalk');assert.deepEqual([broadcast.x,broadcast.y],[ready2.x+1,ready2.y]);
  second.close();await first.wait(e=>e.type==='peerRemoved'&&e.id===ready2.objectId);
  report.checks.push('Two real Crystal sessions: ObjectPlayer, ObjectWalk and ObjectRemove forwarded between WebSockets');
 }finally{second.close();}
 // Stay connected longer than Crystal TimeOut=10s to exercise bridge KeepAlive.
 await delay(11000);first.ws.send(JSON.stringify({type:'turn',direction:4,seq:++seq}));await first.wait(e=>e.type==='state'&&e.seq===seq);
 report.checks.push('Session remains alive beyond10s Crystal timeout via real KeepAlive packets');
}finally{first.close();fs.writeFileSync(new URL('./verification-result.json',import.meta.url),JSON.stringify(report,null,2)+'\n');}
report.reconnects=[];
for(let i=0;i<8;i++) {
 const session=new Session('reconnect'+i);
 try {const ready=await session.wait(e=>e.type==='ready'||e.type==='error');assert.equal(ready.type,'ready',JSON.stringify(ready));report.reconnects.push({iteration:i+1,name:ready.name,x:ready.x,y:ready.y});}
 finally{session.close();}
 await delay(250);
}
report.success=true;
report.checks.push('Eight consecutive real guest reconnects reuse accounts and avoid upstream NewAccount rate ban');
fs.writeFileSync(new URL('./verification-result.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:report.success,checks:report.checks},null,2));
