import {CLASSIC_FONT_FAMILY} from '../core/typography';
import {chatStyle,validChat} from '../core/social';
/** DOM overlay is the web platform adapter: real IME, textContent, no HTML messages.
 * Keyboard composition: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing
 * The logical bounds sit inside the existing native 800x600 message panel.
 */
export class ChatInput {
 private root:HTMLDivElement;private history:HTMLDivElement;private input:HTMLInputElement;
 private observer:ResizeObserver;
 private composing=false;private key:(e:KeyboardEvent)=>void;
 get editing():boolean{return document.activeElement===this.input;}
 constructor(private send:(text:string)=>boolean,private pause:()=>void,private enabled:()=>boolean=()=>true){
  const host=document.getElementById('GameDiv')!;
  this.root=document.createElement('div');this.root.style.cssText=`position:absolute;inset:0;pointer-events:none;z-index:10;font-family:${CLASSIC_FONT_FAMILY};`;host.append(this.root);this.root.hidden=true;
  this.history=document.createElement('div');this.history.setAttribute('aria-label','聊天记录');this.history.style.cssText='position:absolute;left:26.5%;top:82%;width:47.1%;height:10.4%;overflow:auto;pointer-events:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:16px;';this.root.append(this.history);
  this.input=document.createElement('input');this.input.setAttribute('aria-label','聊天输入');this.input.placeholder='回车聊天：普通文字 /名字 私聊 · !喊话 · !!队聊 · !~行会';this.input.maxLength=80;this.input.style.cssText=`position:absolute;left:26.5%;top:94.2%;width:47.1%;height:3.1%;background:#100c0a;color:white;border:0;outline:0;padding:0;font:12px ${CLASSIC_FONT_FAMILY};pointer-events:auto;`;this.root.append(this.input);
  const resize=()=>{const scale=host.clientWidth/800;this.history.style.fontSize=`${12*scale}px`;this.history.style.lineHeight=`${16*scale}px`;this.input.style.fontSize=`${12*scale}px`;};
  this.observer=new ResizeObserver(resize);this.observer.observe(host);resize();
  this.input.addEventListener('focus',()=>this.pause());
  this.input.addEventListener('compositionstart',()=>this.composing=true);this.input.addEventListener('compositionend',()=>this.composing=false);
  this.key=e=>{
   if(!this.enabled())return;
   if(this.editing){e.stopImmediatePropagation();if(this.composing||e.isComposing||e.keyCode===229)return;
    if(e.key==='Enter'){e.preventDefault();const text=this.input.value.trim();if(!text){this.closeEditor();return;}if(validChat(text)&&this.send(text)){this.input.value='';this.closeEditor();}}
    if(e.key==='Escape'){e.preventDefault();this.closeEditor();}return;
   }
   if(e.key==='Enter'&&!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLTextAreaElement)){e.preventDefault();e.stopImmediatePropagation();this.input.focus();}
  };window.addEventListener('keydown',this.key,true);
 }
 add(text:string,type=3):void{const row=document.createElement('div'),style=chatStyle(type);row.textContent=`[${style.label}] ${text}`;row.style.color=style.fg;row.style.backgroundColor=style.bg;this.history.append(row);while(this.history.children.length>200)this.history.firstElementChild!.remove();this.history.scrollTop=this.history.scrollHeight;}
 setActive(active:boolean):void{this.root.hidden=!active;if(!active){this.input.value="";this.history.replaceChildren();this.input.blur();this.composing=false;}}
 closeEditor():void{this.input.blur();document.getElementById("GameCanvas")?.focus();}
 destroy():void{this.observer.disconnect();window.removeEventListener('keydown',this.key,true);this.root.remove();}
}
