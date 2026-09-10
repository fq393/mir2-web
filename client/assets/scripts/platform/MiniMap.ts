/** Original mmap pixels. Expanded map click routing is the requested web adapter. */
export class MiniMap {
 private closeButton:HTMLButtonElement;private root:HTMLDivElement;private canvas:HTMLCanvasElement;private image=new Image();private elapsed=0;private expanded=false;
 private crop={left:0,top:0,width:120,height:120};private colors:Record<string,string>={'218':'#00ff00','249':'#ff0000','255':'#ffffff'};
 constructor(private navigate:(point:{x:number;y:number})=>void){const host=document.getElementById('GameDiv')!;this.root=document.createElement('div');this.root.style.cssText='position:absolute;z-index:18;';this.canvas=document.createElement('canvas');this.canvas.setAttribute('aria-label','比奇省地图，点击放大，M切换');this.canvas.style.cssText='width:100%;height:100%;image-rendering:pixelated;cursor:crosshair;';this.root.append(this.canvas);host.append(this.root);this.image.src='webui/bichon-map.png';this.layout();
  this.canvas.addEventListener('click',e=>{e.stopPropagation();if(!this.expanded){this.toggle();return;}const r=this.canvas.getBoundingClientRect();this.navigate({x:Math.floor((this.crop.left+(e.clientX-r.left)/r.width*this.crop.width)/1.5),y:Math.floor(this.crop.top+(e.clientY-r.top)/r.height*this.crop.height)});});
  this.closeButton=document.createElement('button');this.closeButton.type='button';this.closeButton.setAttribute('aria-label','关闭大地图');this.closeButton.title='关闭大地图';this.closeButton.style.cssText='position:absolute;right:0;top:0;width:16px;height:24px;border:0;padding:0;background:transparent url(webui/64.png) center/100% 100% no-repeat;cursor:pointer;';this.closeButton.addEventListener('click',e=>{e.stopPropagation();this.close();});this.root.append(this.closeButton);this.layout();
  void fetch('webui/minimap-colors.json').then(r=>r.json()).then(c=>this.colors=c).catch(()=>{});
 }
 blocksWorld(x:number,y:number):boolean{if(this.root.hidden)return false;const r=this.expanded?{x:100,y:48,w:600,h:400}:{x:680,y:0,w:120,h:120};return x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h;}
 toggle():void{this.expanded=!this.expanded;this.elapsed=1;this.layout();}
 close():void{if(this.expanded){this.expanded=false;this.elapsed=1;this.layout();}}
 private layout():void{if(this.closeButton)this.closeButton.hidden=!this.expanded;this.root.style.left=this.expanded?'12.5%':'85%';this.root.style.top=this.expanded?'8%':'0';this.root.style.width=this.expanded?'75%':'15%';this.root.style.height=this.expanded?'66.6667%':'20%';this.canvas.width=this.expanded?600:120;this.canvas.height=this.expanded?400:120;}
 update(dt:number,map:string,point:{x:number;y:number},peers:Iterable<{kind?:string;point:{x:number;y:number};dead?:boolean}>,active:boolean,route:ReadonlyArray<{x:number;y:number}>=[]):void{
  this.root.hidden=!active||map!=='0';if(this.root.hidden){if(this.expanded){this.expanded=false;this.layout();}return;}this.elapsed+=dt;if(this.elapsed<.1)return;this.elapsed=0;
  const g=this.canvas.getContext('2d')!,w=this.canvas.width,h=this.canvas.height;g.clearRect(0,0,w,h);if(!this.image.complete||!this.image.naturalWidth)return;
  const x=Math.floor(point.x*1.5),y=point.y;this.crop=this.expanded?{left:0,top:0,width:this.image.naturalWidth,height:this.image.naturalHeight}:{left:Math.max(0,Math.min(this.image.naturalWidth-120,x-60)),top:Math.max(0,Math.min(this.image.naturalHeight-120,y-60)),width:120,height:120};
  const c=this.crop;g.imageSmoothingEnabled=false;g.drawImage(this.image,c.left,c.top,c.width,c.height,0,0,w,h);
  if(route.length){g.strokeStyle='#fff';g.lineWidth=1;g.beginPath();g.moveTo((point.x*1.5-c.left)/c.width*w,(point.y-c.top)/c.height*h);for(const step of route)g.lineTo((step.x*1.5-c.left)/c.width*w,(step.y-c.top)/c.height*h);g.stroke();}
  const dot=(px:number,py:number,color:string,size:number)=>{g.fillStyle=color;g.fillRect(Math.round((px*1.5-c.left)/c.width*w)-1,Math.round((py-c.top)/c.height*h)-1,size,size);};
  for(const p of peers){if(p.dead)continue;dot(p.point.x,p.point.y,this.colors[p.kind==='npc'?'218':p.kind==='player'?'255':'249'],2);}
  dot(point.x,point.y,this.colors['255'],3);
 }
 destroy():void{this.root.remove();}
}
