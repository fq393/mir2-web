// Real WebSocket/TCP/world-thread/disk integration; synthetic NPC and two-slot capacity.
import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(process.argv[2]??'');
assert(existsSync(join(root,'STORAGE_PROTOCOL_QA_ONLY')),'isolated storage QA marker required');
const credentials=JSON.parse(readFileSync(join(root,'credentials.json')));
const clients=[];
class Client {
  ws=new WebSocket('ws://127.0.0.1:17180/ws'); queue=[]; wake=null; serial=0;
  constructor(){clients.push(this);this.ws.onmessage=e=>{this.queue.push(JSON.parse(e.data));this.wake?.();};}
  async wait(predicate){
    const until=Date.now()+12000;
    while(true){const i=this.queue.findIndex(predicate);if(i>=0)return this.queue.splice(i,1)[0];
      assert(Date.now()<until,'timed out waiting for protocol reply');
      await new Promise(ok=>{const timer=setTimeout(()=>{this.wake=null;ok();},100);this.wake=()=>{clearTimeout(timer);this.wake=null;ok();};});
    }
  }
  send(value){this.ws.send(JSON.stringify(value));}
  async request(type,fields={}){const request=++this.serial;this.send({type,request,...fields});return this.wait(p=>p.request===request&&p.type.startsWith('storage'));}
  async login(){await this.wait(p=>p.type==='auth'&&p.stage==='login');this.send({type:'login',...credentials});this.roles=(await this.wait(p=>p.type==='auth'&&p.stage==='characters')).characters;}
  async enter(name){
    this.queue=this.queue.filter(p=>p.packet!=='ObjectNPC');
    this.send({type:'startCharacter',index:this.roles.find(r=>r.Name===name).Index});
    const ready=await this.wait(p=>p.type==='ready');
    const npc=await this.wait(p=>p.packet==='ObjectNPC'&&p.data.Image===4);this.npcId=npc.data.ObjectID;
    await this.open();return ready;
  }
  async open(){this.send({type:'npc',id:this.npcId,key:'[@MAIN]'});await this.wait(p=>p.packet==='NPCResponse');this.send({type:'npc',id:this.npcId,key:'[@STORAGE]'});await this.wait(p=>p.packet==='NPCStorage');}
  async state(){const p=await this.request('storageState',{npcId:this.npcId});assert.equal(p.success,true,p.message);return p.state;}
  async prepare(uid,deposit,from=deposit?6:0,to=deposit?0:6){const p=await this.request('storagePrepare',{npcId:this.npcId,uniqueId:uid,from,to,deposit});assert.equal(p.success,true,p.message);return p.token;}
  async commit(token,success=true){const p=await this.request('storageCommit',{token});assert.equal(p.success,success,p.message);return p.state;}
  async logout(){this.send({type:'restart'});await this.wait(p=>p.type==='auth'&&p.stage==='characters');}
  async close(){if(this.ws.readyState>=2)return;await new Promise(ok=>{this.ws.addEventListener('close',ok,{once:true});this.ws.close();});}
}
const ids=[];
function checkItem(item,uid){assert.equal(item.UniqueID,uid);assert.equal(item.CurrentDura,1234);assert.equal(item.AddedStats.Values.MaxDC,3);}
try{
  const phase=process.argv[3];
  if(phase){
    assert(['leave-stored','resume-stored'].includes(phase));
    const c=new Client();await c.login();await c.enter('仓库协议甲');let state=await c.state();
    const evidence=join(root,'restart-item.json');
    if(phase==='leave-stored'){
      const uid=state.inventory[6].UniqueID;const token=await c.prepare(uid,true);state=await c.commit(token);checkItem(state.storage[0],uid);assert.equal(state.inventory[6],null);
      writeFileSync(evidence,JSON.stringify({uid}));console.log('PASS restart stage: item durably stored before host shutdown.');
    }else{
      const {uid}=JSON.parse(readFileSync(evidence));checkItem(state.storage[0],uid);assert.equal(state.inventory[6],null);
      state=await c.commit(await c.prepare(uid,false));checkItem(state.inventory[6],uid);assert.equal(state.storage[0],null);
      console.log('PASS restart resume: persisted warehouse item reloaded and withdrawn with exact ID, +3 and durability.');
    }
  }else{
  let c=new Client();await c.login();await c.enter('仓库协议甲');let state=await c.state();
  assert(!c.queue.some(p=>p.packet==='UserStorage'),'account-shared storage must not reach the web client');
  assert.equal(state.capacity,2);assert.equal(state.storage.filter(Boolean).length,0);const uid=state.inventory[6].UniqueID;ids.push(uid);checkItem(state.inventory[6],uid);
  let token=await c.prepare(uid,true);
  const malformed=await c.request('storagePrepare',{npcId:c.npcId,uniqueId:uid,from:'bad',to:0,deposit:true});assert.equal(malformed.success,false);await c.commit(token,false);
  token=await c.prepare(uid,true);assert.equal((await c.request('storageCancel')).cancelled,true);await c.commit(token,false);
  token=await c.prepare(uid,true);state=await c.commit(token);assert.equal(state.inventory[6],null);checkItem(state.storage[0],uid);await c.commit(token,false);
  await c.logout();await c.enter('仓库协议乙');state=await c.state();assert.equal(state.storage.filter(Boolean).length,0);assert.notEqual(state.inventory[6].UniqueID,uid);ids.push(state.inventory[6].UniqueID);
  await c.logout();await c.enter('仓库协议甲');state=await c.state();checkItem(state.storage[0],uid);assert.equal(state.inventory[6],null);
  const withdraw=await c.prepare(uid,false);state=await c.commit(withdraw);checkItem(state.inventory[6],uid);assert.equal(state.storage[0],null);await c.commit(token,false);
  token=await c.prepare(uid,true);await c.close();
  c=new Client();await c.login();await c.enter('仓库协议甲');await c.commit(token,false);state=await c.state();checkItem(state.inventory[6],uid);assert.equal(state.storage[0],null);
  token=await c.prepare(uid,true);state=await c.commit(token);await c.close();
  c=new Client();await c.login();await c.enter('仓库协议甲');state=await c.state();checkItem(state.storage[0],uid);assert.equal(state.inventory[6],null);
  token=await c.prepare(uid,false);state=await c.commit(token);checkItem(state.inventory[6],uid);assert.equal(state.storage[0],null);
  await c.logout();await c.enter('仓库协议乙');state=await c.state();checkItem(state.inventory[6],ids[1]);assert.equal(state.storage.filter(Boolean).length,0);
  console.log('PASS real warehouse protocol: NPC dialog, prepare/cancel, durable deposit/withdraw, duplicate and returned-item replay rejection, same-account role isolation, pending disconnect rejection, committed reconnect accounting, +3/durability and full-state replies.');
  }
}finally{await Promise.all(clients.map(c=>c.close()));}
