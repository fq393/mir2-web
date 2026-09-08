// Integration probe: isolated QA server only; creates its own disposable accounts.
// Never accepts live port 17080 or existing account credentials.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomBytes} from 'node:crypto';
const root=resolve(process.argv[2]??'');
assert(existsSync(join(root,'BOOKSHOP_QA_ONLY')),'An isolated fixture root with BOOKSHOP_QA_ONLY is required');
class Client {
 ws=new WebSocket('ws://127.0.0.1:17180/ws');queue=[];waiter=null;
 constructor(){this.ws.onmessage=e=>{const p=JSON.parse(e.data);if(!['auth','error'].includes(p.type))return;this.queue.push(p);this.waiter?.();};}
 async reply(){
  if(this.queue.length)return this.queue.shift();
  await new Promise((ok,no)=>{const timer=setTimeout(()=>{this.waiter=null;no(new Error('Timed out waiting for account reply'));},10000);this.waiter=()=>{clearTimeout(timer);this.waiter=null;ok();};});
  return this.queue.shift();
 }
 async request(value){this.ws.send(JSON.stringify(value));return this.reply();}
 async close(){await new Promise(ok=>{this.ws.addEventListener('close',ok,{once:true});this.ws.close();});}
}
const clients=[];
async function connect(){const c=new Client();clients.push(c);assert.equal((await c.reply()).stage,'login');return c;}
async function account(c){const suffix=randomBytes(4).toString('hex'),account='life'+suffix,password=randomBytes(6).toString('hex');
 assert.equal((await c.request({type:'register',account,password,userName:'隔离验收',birthDate:'2000-01-01',question:'测试问题',answer:'测试答案',email:'qa@example.invalid'})).result,8);
 const result=await c.request({type:'login',account,password});assert.equal(result.stage,'characters');assert.equal(result.characters.length,0);return {account,password,suffix};
}
try{
 let c=await connect();assert.equal((await c.request({type:'deleteCharacter',index:1})).type,'error');
 const credentials=await account(c);
 const create=async(name)=>c.request({type:'createCharacter',name,class:0,gender:0});
 let result=await create('删验甲'+credentials.suffix);assert.equal(result.characters.length,1);const first=result.characters[0];
 result=await create('删验乙'+credentials.suffix);assert.equal(result.characters.length,2);const second=result.characters[1];
 assert.equal((await create('删验丙'+credentials.suffix)).type,'error');
 const foreign=await connect();await account(foreign);assert.equal((await foreign.request({type:'deleteCharacter',index:first.Index})).type,'error');
 result=await c.request({type:'deleteCharacter',index:second.Index});assert.equal(result.deletedIndex,second.Index);assert.deepEqual(result.characters.map(x=>x.Index),[first.Index]);
 assert.equal((await c.request({type:'deleteCharacter',index:second.Index})).type,'error');
 await c.close();c=await connect();result=await c.request({type:'login',account:credentials.account,password:credentials.password});assert.deepEqual(result.characters.map(x=>x.Index),[first.Index]);
 result=await create('删验丙'+credentials.suffix);assert.equal(result.characters.length,2);const replacement=result.characters.find(x=>x.Index!==first.Index);assert.notEqual(replacement.Index,second.Index);
 await c.request({type:'deleteCharacter',index:replacement.Index});result=await c.request({type:'deleteCharacter',index:first.Index});assert.equal(result.characters.length,0);
 assert.equal((await c.request({type:'startCharacter',index:first.Index})).type,'error');
 console.log('PASS lifecycle: authentication, foreign identity, two-slot cap, delete acknowledgement, duplicate rejection, relog, capacity reuse, empty list and deleted-role start rejection.');
}finally{await Promise.all(clients.filter(c=>c.ws.readyState<2).map(c=>c.close()));}
