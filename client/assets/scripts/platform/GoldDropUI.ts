import {NativeConfirm} from './NativeConfirm';
/** FState.DBackgroundBackgroundClick: drop on ground, then ask the amount. */
export class GoldDropUI {
 private root:HTMLDivElement;private stage:HTMLDivElement;private observer:ResizeObserver;private dialog?:NativeConfirm;
 get active():boolean{return !!this.dialog;}
 constructor(){
  const host=document.getElementById('GameDiv')!;this.root=document.createElement('div');this.root.hidden=true;this.root.style.cssText='position:absolute;inset:0;z-index:24;';host.append(this.root);
  this.stage=document.createElement('div');this.stage.style.cssText='position:absolute;width:800px;height:600px;transform-origin:top left;';this.root.append(this.stage);
  const resize=()=>this.stage.style.transform=`scale(${host.clientWidth/800})`;this.observer=new ResizeObserver(resize);this.observer.observe(host);resize();
 }
 open(maximum:number,submit:(value:number)=>void):void {
  if(this.active)return;this.root.hidden=false;
  const dialog=new NativeConfirm(this.stage,'你想放下多少金币数量？',accepted=>{
   this.dialog=undefined;this.root.hidden=true;if(accepted)submit(dialog.value);document.getElementById('GameCanvas')?.focus();
  },'amount',['确定丢弃金币','取消丢弃金币','取消'],maximum);this.dialog=dialog;
 }
 reset():void{this.dialog?.destroy();this.dialog=undefined;this.root.hidden=true;}
 destroy():void{this.reset();this.observer.disconnect();this.root.remove();}
}
