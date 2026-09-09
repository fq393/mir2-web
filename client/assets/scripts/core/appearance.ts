// Fixed Crystal UserObject.RefreshEquipmentStats and PlayerObject.SetLibraries.
// Shape is an identity, not a boolean; unavailable libraries must stay unavailable.
export function playerLayers(gender:number,hair:number,armour:number,weapon:number){
 const suffix=gender===1?'f':'';
 const key=(kind:string,id:number)=>Number.isInteger(id)&&id>=0?`${kind}${id}${suffix}`:null;
 return {body:key('armour',armour),hair:key('hair',hair),weapon:key('weapon',weapon)};
}
export function equippedShape(item:any,info:any,empty:number):number{
 if(!item)return empty;
 if(!info)return -1;
 if(info.durability>0&&item.currentdura===0)return empty;
 return Number.isInteger(info.shape)&&info.shape>=0?info.shape:-1;
}
export function actorFrame(actors:Record<string,any>|undefined,key:string|null,action:string,direction:number,clock:number):string|null{
 if(!key||!actors?.[key])return null;
 const def=actors[key],anim=def[action]??def.stand;
 if(!anim?.length||!Number.isInteger(direction)||direction<0)return null;
 const frames=anim[direction%anim.length];if(!frames?.length)return null;
 const duration=def.actionFrameMs?.[action]??(action==='stand'?500:100);
 const index=Math.floor(Math.max(0,clock)*1000/duration);
 return frames[['stand','walk','run'].includes(action)?index%frames.length:Math.min(frames.length-1,index)]??null;
}
