export interface Frame {atlas:number;x:number;y:number;w:number;h:number;offsetX:number;offsetY:number;shadowX?:number;shadowY?:number}
export interface Ref {library:string|number;index:number;key?:string;drawX?:number;drawY?:number;floor?:boolean;render?:boolean;blend?:boolean;animationKeys?:string[]}
export interface Cell {x:number;y:number;blocked:boolean;back?:Ref;middle?:Ref;front?:Ref}
export interface Chunk {x:number;y:number;width:number;height:number;file:string;atlases:number[]}
export interface ActorFrames {stand:string[][];walk?:string[][];attack?:string[][];cast?:string[][];hit?:string[][];die?:string[][];[key:string]:any}
export interface Manifest {
 schemaVersion?:number;tileWidth:number;tileHeight:number;
 map:{id?:string;name?:string;width:number;height:number;originX:number;originY:number;spawn:{x:number;y:number};cells?:Cell[];chunks?:Chunk[];chunkSize?:number;collisionFile?:string};
 atlases:{file:string;width:number;height:number}[];frames:Record<string,Frame>;
 spellFireBall?:{cast:string[];projectile:string[][];hit:string[];atlases:number[]};
 player:ActorFrames;actors?:Record<string,ActorFrames>;
}
