import { Node, UITransform, Sprite, SpriteFrame, Texture2D, ImageAsset, resources, JsonAsset, Rect, Size, Vec2, Layers } from 'cc';
import { Manifest, Frame, Cell, Chunk } from '../core/assets';
import { MirSprite } from './MirSprite';
export const resource=<T>(path:string,type:any):Promise<T>=>new Promise((resolve,reject)=>resources.load(path.replace(/\.(json|png)$/i,''),type,(e,a)=>e?reject(e):resolve(a as T)));
export class SpriteStore {
 readonly frames=new Map<string,{sprite:SpriteFrame;meta:Frame}>();
 private loading=new Map<number,Promise<void>>();
 private textures=new Map<number,Texture2D>();private images=new Map<number,ImageAsset>();private pinned=new Set<number>();private disposed=false;
 private atlasFrames=new Map<number,Map<string,Frame>>();
 constructor(readonly manifest:Manifest){this.registerFrames(manifest.frames);}
 registerFrames(frames:Record<string,Frame>):void{for(const [key,meta] of Object.entries(frames)){let entries=this.atlasFrames.get(meta.atlas);if(!entries){entries=new Map();this.atlasFrames.set(meta.atlas,entries);}entries.set(key,meta);}}
 async atlas(index:number):Promise<void>{
  if(this.loading.has(index))return this.loading.get(index)!;
  const task=(async()=>{
   const image=await resource<ImageAsset>('mir/'+this.manifest.atlases[index].file,ImageAsset);
   if(this.disposed){resources.release(('mir/'+this.manifest.atlases[index].file).replace(/\.png$/i,''),ImageAsset);return;}
   // Original cutouts need NEAREST plus WebGL antialias=false (prepare-web).
   // Either alone still leaves seams at fractional display scales.
   const texture=new Texture2D();texture.image=image;this.textures.set(index,texture);this.images.set(index,image);texture.setFilters(Texture2D.Filter.NEAREST,Texture2D.Filter.NEAREST);
   for(const [key,meta] of this.atlasFrames.get(index)??[]){
    const sprite=new SpriteFrame();sprite.texture=texture;sprite.rect=new Rect(meta.x,meta.y,meta.w,meta.h);sprite.originalSize=new Size(meta.w,meta.h);sprite.offset=new Vec2();sprite.packable=false;
    this.frames.set(key,{sprite,meta});
   }
  })();this.loading.set(index,task);try{await task;}catch(e){this.loading.delete(index);throw e;}
 }
 async keys(keys:string[]):Promise<void>{const indexes=Array.from(new Set(keys.map(k=>this.manifest.frames[k]?.atlas).filter(v=>v!==undefined)));indexes.forEach(i=>this.pinned.add(i));await Promise.all(indexes.map(i=>this.atlas(i)));}
 retain(indexes:number[]):void{const keep=new Set([...indexes,...Array.from(this.pinned)]);this.textures.forEach((texture,index)=>{if(keep.has(index))return;this.frames.forEach((f,key)=>{if(f.meta.atlas===index){f.sprite.destroy();this.frames.delete(key);}});texture.destroy();const image=this.images.get(index);if(image)resources.release(('mir/'+this.manifest.atlases[index].file).replace(/\.png$/i,''),ImageAsset);this.images.delete(index);this.textures.delete(index);this.loading.delete(index);});}

 destroy():void{this.disposed=true;this.loading.clear();this.frames.forEach(f=>f.sprite.destroy());this.frames.clear();this.textures.forEach(t=>t.destroy());this.images.forEach((_,index)=>resources.release(('mir/'+this.manifest.atlases[index].file).replace(/\.png$/i,''),ImageAsset));this.textures.clear();this.images.clear();}
}
export type TerrainTile={node:Node;sort:number;floor:boolean;sprite:Sprite;animationKeys?:string[];baseY:number;baseH:number};
/** Original Crystal order: all floor first, then each row in x/middle/front order, then actors. */
export const terrainOrder=(x:number,y:number,front:boolean):number=>y*100000+x*2+(front?1:0);
export const actorOrder=(y:number,id=0):number=>Math.round(y)*100000+90000+(id%1000);
export class TerrainStream {
 readonly tiles=new Map<string,TerrainTile>();
 private grayscale=false;
 setGrayscale(value:boolean):void{if(this.grayscale===value)return;this.grayscale=value;this.tiles.forEach(tile=>tile.sprite.grayscale=value);}
 private chunks=new Map<string,Cell[]>();private pending=new Map<string,Promise<void>>();
 private generation=0;private last='';private disposed=false;private desired:Chunk[]=[];private committedAtlases:number[]=[];
 constructor(private manifest:Manifest,private store:SpriteStore,private ground:Node,private objects:Node,private error:(text:string)=>void){}
 async update(x:number,y:number,zoom:number):Promise<void>{
  const center=`${Math.floor(x)},${Math.floor(y)},${zoom}`;if(center===this.last)return;this.last=center;
  const generation=++this.generation;
  // Include anchors below/around the viewport so tall roofs are present before they become visible.
  const left=x-400/zoom/48-16,right=x+400/zoom/48+16,top=y-247/zoom/32-16,bottom=y+247/zoom/32+28;
  const needed=(this.manifest.map.chunks??[]).filter(c=>c.x<right&&c.x+c.width>left&&c.y<bottom&&c.y+c.height>top);
  this.desired=needed;
  try{
   await Promise.all(needed.map(c=>this.loadChunk(c)));
   if(this.disposed||generation!==this.generation)return;
   const cells=this.manifest.map.cells??needed.flatMap(c=>this.chunks.get(c.file)??[]);
   const required=new Set<string>();
   for(const c of cells)for(const kind of ['back','middle','front'] as const){
    const ref=c[kind];if(!ref||ref.render===false)continue;
    const key=ref.key??`${ref.library}:${ref.index}`,f=this.store.frames.get(key);if(!f)continue;
    const px=c.x*48+(ref.drawX??0),py=c.y*32+(ref.drawY??0);
    if(px>x*48+400/zoom+96||px+f.meta.w<x*48-400/zoom-96||py>y*32+247/zoom+64||py+f.meta.h<y*32-247/zoom-64)continue;
    const id=`${c.x}:${c.y}:${kind}`;required.add(id);if(this.tiles.has(id))continue;
    const floor=ref.floor??kind==='back',node=new Node(id);node.layer=Layers.Enum.UI_2D;(floor?this.ground:this.objects).addChild(node);
    node.addComponent(UITransform).setAnchorPoint(0,1);node.setPosition(px,-py);
    const sprite=node.addComponent(MirSprite);sprite.grayscale=this.grayscale;sprite.spriteFrame=f.sprite;sprite.sizeMode=Sprite.SizeMode.RAW;if(ref.blend)sprite.setAdditive();
    this.tiles.set(id,{node,sprite,animationKeys:ref.animationKeys,baseY:-py,baseH:f.meta.h,sort:floor?c.y*100000+c.x*3+(['back','middle','front'].indexOf(kind)):terrainOrder(c.x,c.y,kind==='front'),floor});
   }
   this.tiles.forEach((tile,key)=>{if(!required.has(key)){tile.node.destroy();this.tiles.delete(key);}});
   // Keep nearby map data only. Texture cache is shared across chunks and actors.
   Array.from(this.tiles.values()).filter(t=>t.floor).sort((a,b)=>a.sort-b.sort).forEach((t,i)=>{if(t.node.getSiblingIndex()!==i)t.node.setSiblingIndex(i);});
   this.committedAtlases=needed.flatMap(c=>c.atlases);this.store.retain(this.committedAtlases);
   const files=new Set(needed.map(c=>c.file));this.chunks.forEach((_,key)=>{if(!files.has(key)){this.chunks.delete(key);resources.release(('mir/'+key).replace(/\.json$/i,''),JsonAsset);}});
  }catch(e){this.last='';this.error('地图区块加载失败：'+String(e));}
 }
 animate(clock:number):void{this.tiles.forEach(t=>{if(!t.animationKeys?.length)return;const f=this.store.frames.get(t.animationKeys[Math.floor(clock*10)%t.animationKeys.length]);if(f){t.sprite.spriteFrame=f.sprite;t.node.setPosition(t.node.position.x,t.baseY+f.meta.h-t.baseH);}});}
 private async loadChunk(c:Chunk):Promise<void>{
  if(this.chunks.has(c.file)){await Promise.all(c.atlases.map(i=>this.store.atlas(i)));return;}if(this.pending.has(c.file))return this.pending.get(c.file)!;
  const task=(async()=>{const a=await resource<JsonAsset>('mir/'+c.file,JsonAsset);const data=a.json as any;if(this.disposed)return;await Promise.all(c.atlases.map(i=>this.store.atlas(i)));if(this.disposed)return;if(this.desired.some(n=>n.file===c.file))this.chunks.set(c.file,data.cells??data);else{resources.release(('mir/'+c.file).replace(/\.json$/i,''),JsonAsset);this.store.retain([...this.committedAtlases,...this.desired.flatMap(n=>n.atlases)]);}})();
  this.pending.set(c.file,task);try{await task;}finally{this.pending.delete(c.file);}
 }
 cell(x:number,y:number):any{x-=x%2;y-=y%2;for(const cells of this.chunks.values()){const cell=cells.find(c=>c.x===x&&c.y===y);if(cell)return cell;}return null;}
 destroy():void{this.disposed=true;this.tiles.forEach(t=>t.node.destroy());this.tiles.clear();}
}
