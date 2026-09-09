import {CLASSIC_FONT_FAMILY} from '../core/typography';
import {NativeConfirm} from './NativeConfirm';
import {AuthPresentation} from './AuthPresentation';
import {characterListState,CLASSIC_CHARACTER_SLOTS} from '../core/characters';
/** Original Prguse windows plus native browser text fields. Credentials stay in form memory. */
export class AccountUI {
 private root:HTMLDivElement;private canvas:HTMLDivElement;private message:HTMLDivElement;private observer:ResizeObserver;
 private exit:HTMLButtonElement;private waitingForConnection=true;
 private confirm:NativeConfirm|null=null;private pending=false;private disabledBefore=new Map<HTMLButtonElement,boolean>();
 private musicButton!:HTMLButtonElement;private guestButton!:HTMLButtonElement;private presentation=new AuthPresentation();private stage='login';
 private characters:any[]=[];private characterLimit=CLASSIC_CHARACTER_SLOTS;private selected=0;private role=0;private gender=0;
 get active():boolean{return !this.root.hidden;}
 constructor(private send:(value:any)=>boolean,private logout:()=>void){
  const host=document.getElementById('GameDiv')!;this.exit=document.createElement('button');this.exit.textContent='退出登录';this.exit.style.cssText=`position:fixed;left:8px;top:8px;z-index:16;color:#e9dba7;background:#171714;border:1px solid #585442`;this.exit.onclick=logout;this.exit.hidden=true;document.body.append(this.exit);this.root=document.createElement('div');this.root.style.cssText=`position:absolute;inset:0;z-index:20;background:#090a08;overflow:hidden;color:#e9dba7;font:13px ${CLASSIC_FONT_FAMILY};`;host.append(this.root);
  this.canvas=document.createElement('div');this.canvas.style.cssText='position:absolute;width:800px;height:600px;transform-origin:top left;';this.root.append(this.canvas);
  this.root.addEventListener('pointerdown',()=>this.presentation.unlock());this.root.addEventListener('keydown',()=>this.presentation.unlock());
  const music=this.musicButton=document.createElement('button');music.type='button';music.textContent='音乐：开启';music.setAttribute('aria-label','切换背景音乐');music.style.cssText='position:fixed;right:96px;top:8px;z-index:16;color:#e9dba7;background:#171714;border:1px solid #585442;';music.onclick=()=>music.textContent=this.presentation.toggle()?'音乐：开启':'音乐：静音';document.body.append(music);
  this.guestButton=document.createElement('button');this.guestButton.textContent='本地体验';this.guestButton.setAttribute('aria-label','本地体验角色');this.guestButton.style.cssText='position:fixed;left:8px;top:8px;z-index:16;color:#e9dba7;background:#171714;border:1px solid #585442';this.guestButton.onclick=()=>this.submit({type:'guest'});document.body.append(this.guestButton);
  this.message=document.createElement('div');this.message.setAttribute('role','status');this.message.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);';this.root.append(this.message);
  this.observer=new ResizeObserver(()=>this.canvas.style.transform=`scale(${host.clientWidth/800})`);this.observer.observe(host);this.show('login','正在连接服务器…');this.lockConnectionForm();
 }
 private lockConnectionForm():void{this.guestButton.disabled=true;this.canvas.querySelectorAll('button,input').forEach(el=>(el as HTMLInputElement).disabled=true);}
 private image(parent:HTMLElement,id:number,x:number,y:number):HTMLImageElement{const i=document.createElement('img');i.src=`webui/${id}.png`;i.draggable=false;i.style.cssText=`position:absolute;left:${x}px;top:${y}px;`;parent.append(i);return i;}
 private button(parent:HTMLElement,label:string,x:number,y:number,w:number,h:number,run:()=>void):HTMLButtonElement{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);b.title=label;b.style.cssText=`position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border:0;background:transparent;color:transparent;cursor:pointer;`;b.textContent=label;b.onclick=run;parent.append(b);return b;}
 private input(parent:HTMLElement,label:string,x:number,y:number,w:number,type='text'):HTMLInputElement{const i=document.createElement('input');i.type=type;i.setAttribute('aria-label',label);i.autocomplete=type==='password'?'current-password':'off';i.maxLength=type==='password'?15:80;i.style.cssText=`position:absolute;left:${x}px;top:${y}px;width:${w}px;height:17px;padding:0 2px;background:#080403;border:0;color:white;outline:0;font:12px ${CLASSIC_FONT_FAMILY};`;parent.append(i);return i;}
 private window(id:number,w:number,h:number):HTMLDivElement{this.canvas.replaceChildren();this.presentation.background(this.canvas,['login','register','password'].includes(this.stage));const p=document.createElement('div');p.style.cssText=`position:absolute;left:${(800-w)/2}px;top:${(600-h)/2}px;width:${w}px;height:${h}px;`;this.canvas.append(p);this.image(p,id,0,0);return p;}
 event(e:any):void{if(e.type==='error'){if(!this.waitingForConnection)this.unlockSubmission();this.report(e.message??'操作未成功');return;}if(e.type==='ready'){this.confirm?.destroy();this.confirm=null;this.unlockSubmission();this.presentation.clear();this.presentation.setScene('world');this.musicButton.hidden=true;this.guestButton.hidden=true;this.stage='world';this.exit.hidden=false;this.root.hidden=true;this.canvas.replaceChildren();document.getElementById("GameCanvas")?.focus();return;}if(e.type==='disconnected'){this.characters=[];this.selected=0;this.waitingForConnection=true;this.show('login','正在重新连接服务器…');this.lockConnectionForm();return;}if(e.type==='auth'){this.waitingForConnection=false;this.characters=e.characters??this.characters;if(Number.isInteger(e.characterLimit)&&e.characterLimit>0)this.characterLimit=Math.min(CLASSIC_CHARACTER_SLOTS,e.characterLimit);if(e.selectedIndex)this.selected=e.selectedIndex;this.selected=characterListState(this.characters,this.selected).selected;if(e.stage==='characters'&&this.stage==='opening')return;
  if(e.stage==='characters'&&this.stage==='login'){this.stage='opening';this.guestButton.hidden=true;this.message.textContent='';void this.presentation.openDoor(this.canvas,()=>this.show('characters',e.message??''));return;}
  this.show(e.stage,e.message??'');}}
 private unlockSubmission():void{this.pending=false;for(const [button,disabled] of this.disabledBefore)if(button.isConnected)button.disabled=disabled;this.disabledBefore.clear();}
 private submit(value:any):void{if(this.pending||this.waitingForConnection||this.confirm)return;if(this.send(value)){this.pending=true;this.message.textContent='正在等待服务器确认…';for(const button of [...Array.from(this.canvas.querySelectorAll('button')),this.guestButton]){this.disabledBefore.set(button,button.disabled);button.disabled=true;}}else this.report('连接尚未就绪，请稍后再试。');}
 private report(text:string):void{this.message.textContent=text;this.confirm?.destroy();if(this.stage==='world'){this.root.style.background='transparent';this.root.hidden=false;}this.confirm=new NativeConfirm(this.canvas,text,()=>{this.confirm=null;if(this.stage==='world'){this.root.hidden=true;this.root.style.background='#090a08';}},'alert');}
 private deleteSelected():void{
  if(this.pending||this.confirm)return;
  const character=characterListState(this.characters,this.selected).characters.find(c=>c.index===this.selected);if(!character)return;
  this.confirm=new NativeConfirm(this.canvas,`"${character.name}" 是否确认删除此游戏角色？`,accepted=>{this.confirm=null;if(accepted)this.submit({type:'deleteCharacter',index:character.index});});
 }
 show(stage:string,message=''):void{
  this.confirm?.destroy();this.confirm=null;this.unlockSubmission();this.presentation.clear();this.stage=stage;this.presentation.setScene(['characters','create'].includes(stage)?'select':'login');
  this.root.style.background='#090a08';this.root.hidden=false;this.exit.hidden=true;this.musicButton.hidden=false;this.guestButton.hidden=stage!=='login';this.guestButton.disabled=this.waitingForConnection;this.message.textContent=message;
  if(stage==='login'){
   const p=this.window(60,296,254),account=this.input(p,'账号',98,85,137),password=this.input(p,'密码',98,117,137,'password');account.maxLength=15;
   const login=()=>{this.submit({type:'login',account:account.value.trim(),password:password.value});password.value='';};this.button(p,'登录',171,165,76,33,login);password.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)login();};
   this.button(p,'注册账号',24,207,87,32,()=>this.show('register'));this.button(p,'修改密码',111,207,100,32,()=>this.show('password'));
  }else if(stage==='password'){
   const p=this.window(50,420,299),account=this.input(p,'修改密码账号',240,118,133),old=this.input(p,'当前密码',240,150,133,'password'),next=this.input(p,'新密码',240,179,133,'password'),repeat=this.input(p,'重复新密码',240,210,133,'password');account.maxLength=15;
   this.button(p,'确认修改密码',181,251,76,33,()=>{if(next.value!==repeat.value){this.report('两次新密码不一致。');return;}this.submit({type:'changePassword',account:account.value.trim(),password:old.value,newPassword:next.value});old.value='';next.value='';repeat.value='';});this.button(p,'取消修改密码',275,251,96,33,()=>this.show('login'));
  }else if(stage==='register'){
   const p=this.window(63,640,473),account=this.input(p,'注册账号',160,114,117),pw=this.input(p,'注册密码',160,135,117,'password'),confirm=this.input(p,'确认密码',160,157,117,'password'),user=this.input(p,'称呼',160,185,117),birth=this.input(p,'生日',160,225,117,'date'),q=this.input(p,'密保问题',160,255,165),a=this.input(p,'密保答案',160,275,165),email=this.input(p,'电子邮箱',160,386,167,'email');
   const note=document.createElement('div');note.textContent='本地账号注册\n账号：3—15字符\n密码：5—15字符\n\n身份号码、电话和第二组密保无需填写。\n\n请保存好账号与密码。';note.style.cssText='position:absolute;left:390px;top:120px;width:190px;white-space:pre-wrap;line-height:24px;';p.append(note);
   this.button(p,'提交注册',160,417,76,33,()=>{if(pw.value!==confirm.value){this.report('两次密码不一致。');return;}if(!birth.value||!email.value||!q.value||!a.value||!user.value){this.report('请填写称呼、生日、密保和邮箱。');return;}this.submit({type:'register',account:account.value.trim(),password:pw.value,userName:user.value,birthDate:birth.value,question:q.value,answer:a.value,email:email.value});pw.value='';confirm.value='';});this.button(p,'返回登录',448,419,96,33,()=>this.show('login'));
  }else if(stage==='characters'){
   const p=this.window(65,800,600),state=characterListState(this.characters,this.selected);this.selected=state.selected;
   state.characters.forEach((c,i)=>{
    this.presentation.portrait(p,c.role,c.gender,i,this.selected===c.index);
    const b=this.button(p,`选择角色 ${c.name}`,i?681:133,455,76,30,()=>{this.selected=c.index;this.show('characters');});b.setAttribute('aria-pressed',String(this.selected===c.index));if(this.selected===c.index)b.style.outline='1px solid #c3a157';
    for(const [value,y] of [[c.name,494],[String(c.level??1),i?527:523],[['战士','法师','道士'][c.role]??'未支持',i?557:553]] as const){const text=document.createElement('div');text.textContent=value;text.style.cssText=`position:absolute;left:${117+i*554}px;top:${y}px;width:110px;height:16px;color:#fff;font:12px ${CLASSIC_FONT_FAMILY};line-height:12px;text-shadow:1px 0 #000,-1px 0 #000,0 1px #000,0 -1px #000;`;p.append(text);}
   });
   this.button(p,'退出当前账号',383,548,60,30,()=>this.logout());
   this.image(p,68,385,456);const enter=this.button(p,'进入游戏',385,456,44,21,()=>{if(!this.selected)return;this.submit({type:'startCharacter',index:this.selected});});enter.disabled=!this.selected;
   this.image(p,69,348,486);const create=this.button(p,'创建角色',348,486,120,21,()=>this.show('create'));create.disabled=this.characters.length>=this.characterLimit;
   this.image(p,70,347,506);const remove=this.button(p,'删除人物',347,506,120,21,()=>this.deleteSelected());remove.disabled=!this.selected;
  }else if(stage==='create'){
   const scene=this.window(65,800,600),preview=this.presentation.portrait(scene,this.role,this.gender);
   const p=document.createElement('div');p.style.cssText='position:absolute;left:415px;top:15px;width:300px;height:417px;';scene.append(p);this.image(p,73,0,0);
   const name=this.input(p,'角色姓名',71,107,133);name.maxLength=15;
   for(let i=0;i<3;i++){const b=this.button(p,['战士','法师','道士'][i],48+i*45,157,44,36,()=>{this.role=i;this.presentation.updatePortrait(preview,this.role,this.gender);p.querySelectorAll('[data-role]').forEach(el=>(el as HTMLElement).style.outline='');b.style.outline='1px solid #c3a157';});b.dataset.role=String(i);if(i===this.role)b.style.outline='1px solid #c3a157';}
   for(let i=0;i<2;i++){const b=this.button(p,i?'女性':'男性',93+i*45,231,44,35,()=>{this.gender=i;this.presentation.updatePortrait(preview,this.role,this.gender);p.querySelectorAll('[data-gender]').forEach(el=>(el as HTMLElement).style.outline='');b.style.outline='1px solid #c3a157';});b.dataset.gender=String(i);if(i===this.gender)b.style.outline='1px solid #c3a157';}
   this.button(p,'确认创建',104,361,76,33,()=>this.submit({type:'createCharacter',name:name.value.trim(),class:this.role,gender:this.gender}));this.button(p,'返回角色列表',248,31,16,23,()=>this.show('characters'));
  }
  if(message&&!this.waitingForConnection)this.report(message);
 }
 destroy():void{this.confirm?.destroy();this.confirm=null;this.unlockSubmission();this.presentation.destroy();this.observer.disconnect();this.root.remove();this.exit.remove();this.musicButton.remove();this.guestButton.remove();}
}
