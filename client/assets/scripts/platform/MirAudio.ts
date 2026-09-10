import {AudioClip,resources} from 'cc';
/** Original WAVs, resolved through Cocos' asset URLs. No synthetic replacement sounds. */
export class MirAudio {
 private context:AudioContext|null=null;private gain:GainNode|null=null;private buffers=new Map<string,AudioBuffer>();private urls=new Map<string,string>();
 private active=new Set<AudioBufferSourceNode>();private last=new Map<string,number>();private pending=new Set<string>();private disposed=false;private muted=false;
 readonly events:{file:string;time:number}[]=[];readonly errors:string[]=[];
 readonly files=['1','2','5','6','9','10','13','14','17','18','21','22','25','26','29','30','50','51','52','53','54','55','56','57','60','61','103','106','107','108','111','112','113','114','115','116','117','118','138','139','144','145','M31-0','M31-1','M31-2','M61-0','M61-2','003-1','003-2','003-3','004-1','004-2','004-3','005-1','005-2','005-3'];
 constructor(){this.files.forEach(file=>resources.load('mir/audio/'+file,AudioClip,(error,clip)=>{if(this.disposed)return;if(error){this.errors.push(file+': '+error.message);return;}this.urls.set(file,clip.nativeUrl);if(this.context)void this.decode(file);}));}
 unlock():void {if(this.disposed||typeof globalThis.AudioContext==='undefined')return;if(!this.context){this.context=new AudioContext();this.gain=this.context.createGain();this.gain.gain.value=.35;this.gain.connect(this.context.destination);this.urls.forEach((_,file)=>void this.decode(file));}if(!this.muted)void this.context.resume();}
 private async decode(file:string):Promise<void>{if(!this.context||this.buffers.has(file)||this.pending.has(file))return;this.pending.add(file);try{const response=await fetch(this.urls.get(file)!);if(!response.ok)throw Error('HTTP '+response.status);const buffer=await this.context.decodeAudioData(await response.arrayBuffer());if(!this.disposed)this.buffers.set(file,buffer);}catch(e){this.errors.push(file+': '+String(e));}finally{this.pending.delete(file);}}
 play(file:string,delay=0):void {const context=this.context,buffer=this.buffers.get(file),now=Date.now();if(this.disposed||this.muted||!context||context.state!=='running'||!buffer||document.hidden||this.active.size>=12||now-(this.last.get(file)??0)<70)return;this.last.set(file,now);const source=context.createBufferSource();source.buffer=buffer;source.connect(this.gain!);source.onended=()=>{this.active.delete(source);source.disconnect();};this.active.add(source);source.start(context.currentTime+delay);this.events.push({file,time:now});if(this.events.length>80)this.events.shift();}
 stop():void {this.active.forEach(s=>{try{s.stop();}catch{}});this.active.clear();}
 toggle():boolean {this.muted=!this.muted;if(this.muted)this.stop();else this.unlock();return !this.muted;}
 snapshot():unknown{return {state:this.context?.state??'locked',muted:this.muted,loaded:this.buffers.size,files:this.files.length,active:this.active.size,events:this.events.slice(-16),errors:this.errors};}
 destroy():void {this.disposed=true;this.stop();void this.context?.close();this.buffers.clear();}
}
