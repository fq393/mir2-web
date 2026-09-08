/** Native Prguse 360 / 363–368; FState.DMessageDlg, IntroScn.SelChrEraseChrClick.
 * Source: pangliang/MirServer-Delphi@f829679d24acb3a097d396d737ab067db2c88ca2.
 * Inert input isolation: https://html.spec.whatwg.org/multipage/interaction.html#inert-subtrees
 * The supplied client uses the same Chinese cancel legend for No and Cancel.
 */
export class NativeConfirm {
 private overlay:HTMLDivElement;
 private previousFocus:HTMLElement|null;
 private siblings:{node:HTMLElement;inert:boolean}[]=[];
 private finished=false;private trapFocus:(event:FocusEvent)=>void=()=>{};
 constructor(parent:HTMLElement,text:string,private choose:(accepted:boolean)=>void,mode:'confirm'|'alert'='confirm'){
  this.previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  for(const child of Array.from(parent.children)){if(child instanceof HTMLElement){this.siblings.push({node:child,inert:child.inert});child.inert=true;}}
  this.overlay=document.createElement('div');this.overlay.style.cssText='position:absolute;inset:0;z-index:25;';parent.append(this.overlay);
  const panel=document.createElement('div');panel.setAttribute('role','alertdialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',text);panel.tabIndex=-1;
  panel.style.cssText='position:absolute;left:174px;top:210px;width:452px;height:179px;background:url(webui/360.png);';this.overlay.append(panel);
  const label=document.createElement('div');label.textContent=text;label.style.cssText='position:absolute;left:39px;top:38px;width:374px;color:white;font:12px SimSun,"Songti SC",serif;line-height:18px;overflow-wrap:anywhere;';panel.append(label);
  const buttons:HTMLButtonElement[]=[];
  const choices:readonly (readonly [string,number,number,boolean])[]=mode==='alert'?[['确定',361,324,true]]:[['确认删除',363,104,true],['不删除',367,214,false],['取消删除',365,324,false]];
  for(const [name,image,x,accepted] of choices){
   const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',name);button.style.cssText=`position:absolute;left:${x}px;top:126px;width:80px;height:34px;border:0;padding:0;background:url(webui/${image}.png);cursor:pointer;`;
   button.onpointerdown=()=>button.style.backgroundImage=`url(webui/${image+1}.png)`;
   const reset=()=>button.style.backgroundImage=`url(webui/${image}.png)`;button.onpointerup=reset;button.onpointerleave=reset;button.onpointercancel=reset;
   button.onclick=()=>this.finish(accepted);panel.append(button);buttons.push(button);
  }
  panel.onkeydown=event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.finish(false);}
   // Original three-option dialog does not confirm on Enter. Require a click/Space.
   if(event.key==='Enter'){event.preventDefault();event.stopPropagation();if(mode==='alert')this.finish(true);}
   if(event.key==='Tab'){event.preventDefault();const i=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[i<0?(event.shiftKey?buttons.length-1:0):(i+(event.shiftKey?-1:1)+buttons.length)%buttons.length].focus();}
  };
  this.trapFocus=event=>{if(!this.finished&&!this.overlay.contains(event.target as Node))panel.focus();};
  document.addEventListener('focusin',this.trapFocus);panel.focus();
 }
 private finish(accepted:boolean):void{if(this.finished)return;this.destroy();this.choose(accepted);}
 destroy():void{if(this.finished)return;this.finished=true;document.removeEventListener('focusin',this.trapFocus);this.overlay.remove();for(const {node,inert} of this.siblings)node.inert=inert;this.siblings=[];if(this.previousFocus?.isConnected)this.previousFocus.focus();}
}
