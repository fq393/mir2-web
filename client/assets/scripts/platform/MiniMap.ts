/** Native mmap:100. Old PlayScn.DrawMiniMap: 120px crop, x*48/32, 300ms blink. */
export class MiniMap {
 private root:HTMLDivElement;private canvas:HTMLCanvasElement;private image=new Image();private elapsed=0;
 private colors:Record<string,string>={'218':'#00ff00','249':'#ff0000','255':'#ffffff'};
 constructor(){const host=document.getElementById('GameDiv')!;this.root=document.createElement('div');this.root.style.cssText='position:absolute;left:85%;top:0;width:15%;height:20%;z-index:8;pointer-events:none;';this.canvas=document.createElement('canvas');this.canvas.width=120;this.canvas.height=120;this.canvas.setAttribute('aria-label','比奇省小地图');this.canvas.style.cssText='width:100%;height:100%;image-rendering:pixelated;';this.root.append(this.canvas);host.append(this.root);this.image.src='webui/bichon-map.png';void fetch('webui/minimap-colors.json').then(r=>r.json()).then(c=>this.colors=c).catch(()=>{});}
 update(dt:number,map:string,point:{x:number;y:number},peers:Iterable<{kind?:string;point:{x:number;y:number};dead?:boolean}>,active:boolean):void{
  this.root.hidden=!active||map!=='0';if(this.root.hidden)return;this.elapsed+=dt;if(this.elapsed<.1)return;this.elapsed=0;
  const g=this.canvas.getContext('2d')!;g.clearRect(0,0,120,120);if(!this.image.complete||!this.image.naturalWidth)return;
  const x=Math.floor(point.x*1.5),y=point.y,left=Math.max(0,x-60),top=Math.max(0,y-60);g.imageSmoothingEnabled=false;g.drawImage(this.image,left,top,120,120,0,0,120,120);
  if(Math.floor(performance.now()/300)%2===0)return;
  g.fillStyle=this.colors['255'];g.fillRect(x-left,y-top,1,1);
  for(const p of peers){if(p.dead||Math.abs(p.point.x-point.x)>10||Math.abs(p.point.y-point.y)>10)continue;g.fillStyle=this.colors[p.kind==='npc'?'218':p.kind==='player'?'255':'249'];g.fillRect(Math.floor(p.point.x*1.5)-left,p.point.y-top,2,2);}
 }
 destroy():void{this.root.remove();}
}
