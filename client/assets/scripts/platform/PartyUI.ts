import {CLASSIC_FONT_FAMILY} from '../core/typography';
/** Native Prguse:120 group window; roster changes only on server packets. */
export class PartyUI {
 private root:HTMLDivElement;private panel:HTMLDivElement;private input:HTMLInputElement;private roster:HTMLDivElement;private check:HTMLInputElement;private observer:ResizeObserver;
 private names:string[]=[];private inviter='';private allow=false;
 constructor(private send:(v:any)=>boolean,private ownName:()=>string){
  const host=document.getElementById('GameDiv')!;this.root=document.createElement('div');this.root.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:15;';this.root.hidden=true;host.append(this.root);
  this.panel=document.createElement('div');this.panel.style.cssText=`position:absolute;left:262px;top:179px;width:276px;height:242px;background:url(webui/120.png);pointer-events:auto;color:#ddd;font:12px ${CLASSIC_FONT_FAMILY};`;this.root.append(this.panel);
  const field=(label:string,x:number,y:number,w:number)=>{const e=document.createElement('input');e.setAttribute('aria-label',label);e.style.cssText=`position:absolute;left:${x}px;top:${y}px;width:${w}px;height:18px;background:#100c0a;color:white;border:0;font:12px ${CLASSIC_FONT_FAMILY}`;this.panel.append(e);return e;};
  this.input=field('队友角色名',28,53,185);this.input.maxLength=15;this.input.placeholder='输入角色名';
  this.check=field('允许组队',20,18,20);this.check.type='checkbox';this.check.onchange=()=>{this.check.checked=this.allow;this.send({type:'groupSwitch',allow:!this.allow});};
  this.roster=document.createElement('div');this.roster.style.cssText='position:absolute;left:28px;top:80px;width:226px;height:113px;white-space:pre-wrap;overflow:auto;';this.panel.append(this.roster);
  const button=(label:string,x:number,y:number,w:number,h:number,fn:()=>void)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);b.title=label;b.style.cssText=`position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border:0;background:transparent;color:transparent;cursor:pointer;`;b.textContent=label;b.onclick=fn;this.panel.append(b);};
  button('关闭队伍',260,0,16,23,()=>{this.root.hidden=true;document.getElementById("GameCanvas")?.focus();});
  button('邀请并创建队伍',22,203,72,19,()=>this.invite());button('添加队员',97,203,72,19,()=>this.invite());button('移除队员或退出',172,203,72,19,()=>this.send({type:'groupRemove',name:this.input.value.trim()||this.ownName()}));
  this.observer=new ResizeObserver(()=>{const scale=host.clientWidth/800;this.panel.style.left=`${262*scale}px`;this.panel.style.top=`${179*scale}px`;this.panel.style.transform=`scale(${scale})`;this.panel.style.transformOrigin='top left';});this.observer.observe(host);
 }
 private invite():void{const name=this.input.value.trim();if(name)this.send({type:'groupAdd',name});}
 toggle():void{this.root.hidden=!this.root.hidden;}
 event(name:string,d:any):void{
  if(name==='SwitchGroup'){this.allow=d.allowgroup;this.check.checked=this.allow;}
  if(name==='AddMember'&&!this.names.includes(d.name))this.names.push(d.name);
  if(name==='DeleteMember')this.names=this.names.filter(n=>n!==d.name);
  if(name==='DeleteGroup')this.names=[];
  if(name==='GroupInvite')this.inviter=d.name;
  if(name==='AddMember'||name==='DeleteGroup')this.inviter='';
  this.roster.replaceChildren();this.roster.textContent=this.names.map((n,i)=>(i===0?'队长：':'队员：')+n).join('\n');
  if(this.inviter){
   this.root.hidden=false;this.roster.textContent=`${this.inviter} 邀请你加入队伍。\n`;
   for(const accept of [true,false]){const b=document.createElement('button');b.textContent=accept?'接受':'拒绝';b.onclick=()=>{this.send({type:'groupReply',accept});this.inviter='';this.roster.textContent='已回复，等待服务器确认。';};this.roster.append(b);}
  }
 }
 reset():void{this.names=[];this.inviter='';this.allow=false;this.check.checked=false;this.roster.replaceChildren();this.root.hidden=true;}
 destroy():void{this.observer.disconnect();this.root.remove();}
}
