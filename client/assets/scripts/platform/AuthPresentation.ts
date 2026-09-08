import {DOOR_DURATION,doorFrame,portraitLayout} from '../core/authPresentation';
/** Native account scene adapter. Autoplay remains subject to the browser's user gesture policy. */
export class AuthPresentation {
 private music=new Audio();private doorSound=new Audio();private track='';private unlocked=false;private muted=false;
 private generation=0;private timers=new Set<ReturnType<typeof setInterval>>();private previews=new Map<HTMLElement,ReturnType<typeof setInterval>>();
 private visibility=()=>{if(document.hidden){this.music.pause();this.doorSound.pause();}else this.resume();};
 readonly errors:string[]=[];
 constructor(){this.music.loop=true;this.music.volume=.3;this.music.preload='none';this.doorSound.preload='auto';this.doorSound.src='webui/auth/door.wav';this.doorSound.volume=.35;document.addEventListener('visibilitychange',this.visibility);}
 unlock():void{this.unlocked=true;this.resume();}
 toggle():boolean{this.muted=!this.muted;if(this.muted){this.music.pause();this.doorSound.pause();}else this.unlock();return !this.muted;}
 private resume():void{if(this.unlocked&&!this.muted&&!document.hidden&&this.track&&this.music.paused)void this.music.play().catch(e=>{if(e.name!=='NotAllowedError'&&e.name!=='AbortError')this.errors.push(String(e));});}
 setScene(scene:'login'|'select'|'world'):void{const track=scene==='world'?'':scene;if(track!==this.track){this.music.pause();this.track=track;if(track)this.music.src=`webui/auth/${track}.wav`;}this.resume();}
 clear():void{this.generation++;this.timers.forEach(clearInterval);this.timers.clear();this.previews.clear();this.doorSound.pause();}
 background(parent:HTMLElement,login:boolean):void{if(!login)return;const image=document.createElement('img');image.src='webui/auth/login.png';image.alt='传奇登录石门';image.draggable=false;image.style.cssText='position:absolute;inset:0;width:800px;height:600px;pointer-events:none;';parent.append(image);}
 portrait(parent:HTMLElement,role:number,gender:number,slot=0,selected=true):HTMLElement{
  const node=document.createElement('div');node.setAttribute('role','img');node.setAttribute('aria-label',`${gender?'女':'男'}${['战士','法师','道士'][role]}人物展示`);parent.append(node);this.updatePortrait(node,role,gender,slot,selected);return node;
 }
 updatePortrait(node:HTMLElement,role:number,gender:number,slot=0,selected=true):void{
  const previous=this.previews.get(node);if(previous){clearInterval(previous);this.timers.delete(previous);}
  const {x,y,w,h,source}=portraitLayout(role,gender,slot,!selected);node.setAttribute('aria-label',`${gender?'女':'男'}${['战士','法师','道士'][role]}人物展示`);
  node.style.cssText=`position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;pointer-events:none;background-image:url("${source}");background-repeat:no-repeat;`;
  let frame=selected?0:16;const paint=()=>node.style.backgroundPosition=`${-(frame%4)*w}px ${-Math.floor(frame/4)*h}px`;paint();
  if(selected){const timer=setInterval(()=>{if(document.hidden)return;frame=(frame+1)%16;paint();},300);this.timers.add(timer);this.previews.set(node,timer);}
 }
 async openDoor(parent:HTMLElement,complete:()=>void):Promise<void>{
  this.clear();const generation=this.generation;parent.replaceChildren();this.background(parent,true);
  const image=new Image();image.src='webui/auth/door.png';try{await image.decode();}catch(e){this.errors.push('door image: '+String(e));if(generation===this.generation)complete();return;}
  if(generation!==this.generation)return;
  const door=document.createElement('div');door.setAttribute('aria-label','登录石门开启');door.style.cssText='position:absolute;left:152px;top:96px;width:496px;height:361px;background-image:url("webui/auth/door.png");';parent.append(door);
  if(this.unlocked&&!this.muted&&!document.hidden){this.doorSound.currentTime=0;void this.doorSound.play().catch(e=>{if(e.name!=='NotAllowedError'&&e.name!=='AbortError')this.errors.push(String(e));});}
  const start=performance.now();const timer=setInterval(()=>{const elapsed=performance.now()-start,frame=doorFrame(elapsed);door.style.backgroundPosition=`${-(frame%5)*496}px ${-Math.floor(frame/5)*361}px`;door.dataset.frame=String(frame);if(elapsed>=DOOR_DURATION){clearInterval(timer);this.timers.delete(timer);if(generation===this.generation)complete();}},30);this.timers.add(timer);
 }
 snapshot():unknown{return {track:this.track,playing:!this.music.paused,time:this.music.currentTime,muted:this.muted,doorPlaying:!this.doorSound.paused,errors:this.errors};}
 destroy():void{this.clear();this.music.pause();this.music.removeAttribute('src');this.music.load();this.doorSound.removeAttribute('src');this.doorSound.load();document.removeEventListener('visibilitychange',this.visibility);}
}
