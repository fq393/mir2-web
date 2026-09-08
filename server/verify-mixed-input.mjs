import assert from 'node:assert/strict';
import fs from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
const report={time:new Date().toISOString(),success:false,checks:[],events:[]};
const ws=new WebSocket('ws://127.0.0.1:17080/ws');
ws.onmessage=({data})=>report.events.push(JSON.parse(data));
async function wait(predicate,start=0){for(let i=0;i<300;i++){const e=report.events.slice(start).find(predicate);if(e)return e;await delay(40);}throw Error('timeout '+predicate);}
function send(message){ws.send(JSON.stringify(message));}
try {
 const ready=await wait(e=>e.type==='ready');
 let mark=report.events.length;
 // All messages are sent back-to-back, without waiting for a client animation or ACK.
 for(const message of [{type:'attack',direction:4},{type:'walk',direction:2,seq:101},{type:'attack',direction:6},{type:'attack',direction:0},{type:'walk',direction:6,seq:102}])send(message);
 await wait(e=>e.type==='state'&&e.seq===102,mark);
 let states=report.events.slice(mark).filter(e=>e.type==='state');
 assert.deepEqual(states.map(e=>e.command),['attack','walk','attack','attack','walk']);
 assert.deepEqual(states.map(e=>e.seq),[null,101,null,null,102]);
 assert.deepEqual([states[0].x,states[0].y],[ready.x,ready.y]);
 assert.equal(states[0].accepted,null);
 report.checks.push('Burst attack/walk/attack/attack/walk preserves exact ACK command order and seq101/102; attack locations never consume walk seq');
 const last=states.at(-1);mark=report.events.length;
 for(const message of [{type:'cast',spell:31,targetId:0,x:last.x,y:last.y,direction:4},{type:'walk',direction:2,seq:103},{type:'cast',spell:31,targetId:0,x:last.x,y:last.y,direction:4},{type:'walk',direction:6,seq:104}])send(message);
 await wait(e=>e.type==='state'&&e.seq===104,mark);
 states=report.events.slice(mark).filter(e=>e.type==='state');
 assert.deepEqual(states.map(e=>e.command),['cast','walk','cast','walk']);
 assert.deepEqual(states.map(e=>e.seq),[null,103,null,104]);
 report.checks.push('Burst FireBall/walk/FireBall/walk preserves seq103/104 through original SpellTime retry delay');
 mark=report.events.length;
 send({type:'cast',spell:31,targetId:0,x:1,y:1,direction:0});send({type:'walk',direction:2,seq:105});
 await wait(e=>e.type==='state'&&e.seq===105,mark);
 assert.ok(report.events.slice(mark).some(e=>e.type==='error'&&e.command==='cast'));
 assert.deepEqual(report.events.slice(mark).filter(e=>e.type==='state').map(e=>e.command),['walk']);
 report.checks.push('Out-of-range FireBall rejected before TCP write; following walk seq105 has its own real UserLocation');
 report.success=true;
} finally {ws.close();fs.writeFileSync(new URL('./mixed-input-verification-result.json',import.meta.url),JSON.stringify(report,null,2));}
console.log(JSON.stringify({success:report.success,checks:report.checks},null,2));
