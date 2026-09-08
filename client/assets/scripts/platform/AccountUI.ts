/** Original Prguse windows plus native browser text fields. Credentials stay in form memory. */
export class AccountUI {
 private root:HTMLDivElement;private canvas:HTMLDivElement;private message:HTMLDivElement;private observer:ResizeObserver;
 private exit:HTMLButtonElement;
 private characters:any[]=[];private selected=0;private role=0;private gender=0;
 get active():boolean{return !this.root.hidden;}
 constructor(private send:(value:any)=>boolean,logout:()=>void){
  const host=document.getElementById('GameDiv')!;this.exit=document.createElement('button');this.exit.textContent='退出登录';this.exit.style.cssText='position:absolute;left:8px;top:8px;z-index:16;color:#e9dba7;background:#171714;border:1px solid #585442';this.exit.onclick=logout;this.exit.hidden=true;host.append(this.exit);this.root=document.createElement('div');this.root.style.cssText='position:absolute;inset:0;z-index:20;background:#090a08;overflow:hidden;color:#e9dba7;font:13px SimSun,"Songti SC",serif;';host.append(this.root);
  this.canvas=document.createElement('div');this.canvas.style.cssText='position:absolute;width:800px;height:600px;transform-origin:top left;';this.root.append(this.canvas);
  this.message=document.createElement('div');this.message.setAttribute('role','status');this.message.style.cssText='position:absolute;left:10%;bottom:3%;width:80%;text-align:center;color:white;';this.root.append(this.message);
  this.observer=new ResizeObserver(()=>this.canvas.style.transform=`scale(${host.clientWidth/800})`);this.observer.observe(host);this.show('login','正在连接服务器…');
 }
 private image(parent:HTMLElement,id:number,x:number,y:number):HTMLImageElement{const i=document.createElement('img');i.src=`webui/${id}.png`;i.draggable=false;i.style.cssText=`position:absolute;left:${x}px;top:${y}px;`;parent.append(i);return i;}
 private button(parent:HTMLElement,label:string,x:number,y:number,w:number,h:number,run:()=>void):HTMLButtonElement{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);b.title=label;b.style.cssText=`position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border:0;background:transparent;color:transparent;cursor:pointer;`;b.textContent=label;b.onclick=run;parent.append(b);return b;}
 private input(parent:HTMLElement,label:string,x:number,y:number,w:number,type='text'):HTMLInputElement{const i=document.createElement('input');i.type=type;i.setAttribute('aria-label',label);i.autocomplete=type==='password'?'current-password':'off';i.maxLength=type==='password'?15:80;i.style.cssText=`position:absolute;left:${x}px;top:${y}px;width:${w}px;height:17px;padding:0 2px;background:#080403;border:0;color:white;outline:0;font:12px SimSun,"Songti SC",serif;`;parent.append(i);return i;}
 private window(id:number,w:number,h:number):HTMLDivElement{this.canvas.replaceChildren();const p=document.createElement('div');p.style.cssText=`position:absolute;left:${(800-w)/2}px;top:${(600-h)/2}px;width:${w}px;height:${h}px;`;this.canvas.append(p);this.image(p,id,0,0);return p;}
 event(e:any):void{if(e.type==='error'){this.message.textContent=e.message??'操作未成功';this.canvas.querySelectorAll('button').forEach(b=>b.disabled=false);return;}if(e.type==='ready'){this.exit.hidden=false;this.root.hidden=true;this.canvas.replaceChildren();document.getElementById("GameCanvas")?.focus();return;}if(e.type==='disconnected'){this.characters=[];this.selected=0;this.show('login','连接断开，请重新登录。');return;}if(e.type==='auth'){this.characters=e.characters??this.characters;this.show(e.stage,e.message??'');}}
 private submit(value:any):void{if(this.send(value)){this.message.textContent='正在等待服务器确认…';this.canvas.querySelectorAll('button').forEach(b=>b.disabled=true);}else this.message.textContent='连接尚未就绪，请稍后再试。';}
 show(stage:string,message=''):void{
  this.root.hidden=false;this.exit.hidden=true;this.message.textContent=message;
  if(stage==='login'){
   const p=this.window(60,296,254),account=this.input(p,'账号',98,85,137),password=this.input(p,'密码',98,117,137,'password');account.maxLength=15;
   const login=()=>{this.submit({type:'login',account:account.value.trim(),password:password.value});password.value='';};this.button(p,'登录',171,165,76,33,login);password.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)login();};
   this.button(p,'注册账号',24,207,87,32,()=>this.show('register'));this.button(p,'修改密码',111,207,100,32,()=>this.show('password'));const guest=this.button(p,'本地体验角色',65,270,170,25,()=>this.submit({type:'guest'}));guest.style.color='#e9dba7';
  }else if(stage==='password'){
   const p=this.window(50,420,299),account=this.input(p,'修改密码账号',240,118,133),old=this.input(p,'当前密码',240,150,133,'password'),next=this.input(p,'新密码',240,179,133,'password'),repeat=this.input(p,'重复新密码',240,210,133,'password');account.maxLength=15;
   this.button(p,'确认修改密码',181,251,76,33,()=>{if(next.value!==repeat.value){this.message.textContent='两次新密码不一致。';return;}this.submit({type:'changePassword',account:account.value.trim(),password:old.value,newPassword:next.value});old.value='';next.value='';repeat.value='';});this.button(p,'取消修改密码',275,251,96,33,()=>this.show('login'));
  }else if(stage==='register'){
   const p=this.window(63,640,473),account=this.input(p,'注册账号',160,114,117),pw=this.input(p,'注册密码',160,135,117,'password'),confirm=this.input(p,'确认密码',160,157,117,'password'),user=this.input(p,'称呼',160,185,117),birth=this.input(p,'生日',160,225,117,'date'),q=this.input(p,'密保问题',160,255,165),a=this.input(p,'密保答案',160,275,165),email=this.input(p,'电子邮箱',160,386,167,'email');
   const note=document.createElement('div');note.textContent='本地账号注册\n账号：3—15字符\n密码：5—15字符\n\n身份号码、电话和第二组密保无需填写。\n\n请保存好账号与密码。';note.style.cssText='position:absolute;left:390px;top:120px;width:190px;white-space:pre-wrap;line-height:24px;';p.append(note);
   this.button(p,'提交注册',160,417,76,33,()=>{if(pw.value!==confirm.value){this.message.textContent='两次密码不一致。';return;}if(!birth.value||!email.value||!q.value||!a.value||!user.value){this.message.textContent='请填写称呼、生日、密保和邮箱。';return;}this.submit({type:'register',account:account.value.trim(),password:pw.value,userName:user.value,birthDate:birth.value,question:q.value,answer:a.value,email:email.value});pw.value='';confirm.value='';});this.button(p,'返回登录',448,419,96,33,()=>this.show('login'));
  }else if(stage==='characters'){
   const p=this.window(65,800,600);this.characters.forEach((c,i)=>{const b=this.button(p,`选择角色 ${c.Name??c.name}`,i%2?485:80,90+Math.floor(i/2)*140,235,110,()=>{this.selected=c.Index??c.index;this.show('characters');});b.style.color='#e9dba7';b.style.whiteSpace='pre-line';b.textContent=`${c.Name??c.name}\n${['战士','法师','道士'][c.Class??c.class]} ${(c.Level??c.level)===0?"初入玛法":(c.Level??c.level)+"级"}\n${(c.Gender??c.gender)?'女':'男'}`;if(this.selected===(c.Index??c.index))b.style.outline='1px solid #c3a157';});
   this.image(p,68,385,456);this.button(p,'进入游戏',385,456,44,21,()=>{if(!this.selected){this.message.textContent='请先选择角色。';return;}this.submit({type:'startCharacter',index:this.selected});});this.image(p,69,348,486);this.button(p,'创建角色',348,486,120,21,()=>this.show('create'));
  }else if(stage==='create'){
   const p=this.window(73,300,417),name=this.input(p,'角色姓名',71,107,133);name.maxLength=15;
   for(let i=0;i<3;i++){const b=this.button(p,['战士','法师','道士'][i],48+i*45,157,44,36,()=>{this.role=i;p.querySelectorAll('[data-role]').forEach(el=>(el as HTMLElement).style.outline='');b.style.outline='1px solid #c3a157';});b.dataset.role=String(i);if(i===this.role)b.style.outline='1px solid #c3a157';}
   for(let i=0;i<2;i++){const b=this.button(p,i?'女性':'男性',93+i*45,231,44,35,()=>{this.gender=i;p.querySelectorAll('[data-gender]').forEach(el=>(el as HTMLElement).style.outline='');b.style.outline='1px solid #c3a157';});b.dataset.gender=String(i);if(i===this.gender)b.style.outline='1px solid #c3a157';}
   this.button(p,'确认创建',104,361,76,33,()=>this.submit({type:'createCharacter',name:name.value.trim(),class:this.role,gender:this.gender}));this.button(p,'返回角色列表',248,31,16,23,()=>this.show('characters'));
  }
 }
 destroy():void{this.observer.disconnect();this.root.remove();this.exit.remove();}
}
