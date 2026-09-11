import {CLASSIC_FONT_FAMILY} from '../core/typography';
import {NativeConfirm} from './NativeConfirm';

/** Invitation-only preview. Original supplied Prguse 389/390 pixels, not Crystal's dimensions.
 * Ownership remains on the server. Never hide a live session before its cancel acknowledgement.
 */
export class PlayerTradeUI {
 private root:HTMLDivElement;private stage:HTMLDivElement;private observer:ResizeObserver;
 private dialog?:NativeConfirm;private partner='';private cancelling=false;
 private panels:HTMLDivElement[]=[];
 private localName:HTMLDivElement;private remoteName:HTMLDivElement;
 get inviting():boolean{return !!this.dialog;}
 get active():boolean{return !!this.partner;}
 constructor(private send:(v:any)=>boolean,private ownName:()=>string,private pause:()=>void){
  const host=document.getElementById('GameDiv')!;
  this.root=document.createElement('div');this.root.hidden=true;
  this.root.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:16;';host.append(this.root);
  this.stage=document.createElement('div');this.stage.style.cssText='position:absolute;width:800px;height:600px;transform-origin:top left;';this.root.append(this.stage);
  const panel=(image:number,x:number,width:number,label:string)=>{
   const el=document.createElement('div');el.setAttribute('role','region');el.setAttribute('aria-label',label);
   el.style.cssText=`position:absolute;left:${x}px;top:220px;width:${width}px;height:175px;background:url(webui/${image}.png);pointer-events:auto;`;
   // DOM UI input cannot leak into Cocos world movement or document shortcuts.
   for(const event of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick','contextmenu'])el.addEventListener(event,e=>{e.stopPropagation();if(event==='contextmenu')e.preventDefault();});
   this.stage.append(el);this.panels.push(el);el.hidden=true;
   const name=document.createElement('div');name.style.cssText=`position:absolute;left:57px;top:3px;width:108px;height:17px;text-align:center;color:white;font:12px ${CLASSIC_FONT_FAMILY};white-space:nowrap;overflow:hidden;`;el.append(name);
   const gold=document.createElement('div');gold.textContent='0';gold.style.cssText=`position:absolute;left:62px;top:129px;width:80px;color:white;text-align:center;font:12px ${CLASSIC_FONT_FAMILY};`;el.append(gold);
   return {el,name};
  };
  const local=panel(389,162,236,'自己的交易窗口'),remote=panel(390,414,220,'对方的交易窗口');this.localName=local.name;this.remoteName=remote.name;
  const close=document.createElement('button');close.type='button';close.setAttribute('aria-label','取消交易');close.title='取消交易';
  close.style.cssText='position:absolute;left:219px;top:42px;width:16px;height:23px;padding:0;border:0;background:transparent;cursor:pointer;';close.onclick=()=>this.cancel();local.el.append(close);
  const resize=()=>this.stage.style.transform=`scale(${host.clientWidth/800})`;this.observer=new ResizeObserver(resize);this.observer.observe(host);resize();
 }
 request():void{if(this.active||this.inviting)return;this.pause();this.send({type:'playerTradeRequest'});}
 cancel():void{if(!this.partner||this.cancelling)return;this.cancelling=this.send({type:'playerTradeCancel'});}
 event(name:string,data:any):void{
  if(name==='TradeRequest'){
   if(this.active)return;
   this.dialog?.destroy();this.pause();this.root.hidden=false;this.root.style.pointerEvents="auto";
   this.dialog=new NativeConfirm(this.stage,`${data.name} 请求与你交易，是否接受？`,accept=>{
    this.dialog=undefined;this.root.hidden=true;this.root.style.pointerEvents="none";this.send({type:'playerTradeReply',accept});document.getElementById('GameCanvas')?.focus();
   },'choice',['接受交易','拒绝交易','取消邀请']);
  }
  if(name==='TradeAccept'){
   this.dialog?.destroy();this.dialog=undefined;this.pause();this.root.style.pointerEvents="none";this.partner=data.name;this.cancelling=false;for(const panel of this.panels)panel.hidden=false;
   this.localName.textContent=this.ownName();this.remoteName.textContent=this.partner;this.root.hidden=false;
  }
  if(name==='TradeCancel'){if(data.unlock){this.cancelling=false;return;}this.reset();}
  if(name==='TradeConfirm')this.reset();
 }
 reset():void{this.dialog?.destroy();this.dialog=undefined;this.partner='';this.cancelling=false;this.root.style.pointerEvents='none';this.root.hidden=true;for(const panel of this.panels)panel.hidden=true;this.localName.textContent='';this.remoteName.textContent='';}
 destroy():void{this.reset();this.observer.disconnect();this.root.remove();}
}
