/** Mirror pinned Crystal HumanObject.AddItem: packet order determines the same slots. */
export function gainItem(inventory:any[],received:any):boolean {
 const item={...received};const info=item.info;
 if(!info)return false;
 if(info.stacksize>1){for(const existing of inventory){if(!existing||existing.itemindex!==item.itemindex||existing.count>=info.stacksize)continue;const count=Math.min(item.count,info.stacksize-existing.count);existing.count+=count;item.count-=count;if(item.count===0)return true;}}
 const potion=info.type===13||info.type===17||(info.type===21&&info.effect===1);
 const start=potion?0:info.type===8?4:6,end=potion?4:info.type===8?6:inventory.length;
 for(let i=start;i<end;i++){if(!inventory[i]){inventory[i]=item;return true;}}
 const slot=inventory.findIndex(v=>!v);if(slot<0)return false;inventory[slot]=item;return true;
}
export function consumeItem(inventory:any[],id:string,success:boolean):boolean {
 if(!success)return false;const slot=inventory.findIndex(i=>i&&String(i.uniqueid)===String(id));if(slot<0)return false;
 if(inventory[slot].count>1)inventory[slot].count--;else inventory[slot]=null;return true;
}
/** Pinned Crystal MirItemCell.UseItem: right slot first, then left/replacement. */
export function equipmentTarget(type:number,equipment:any[]):number {
 if(type===1)return 0;if(type===2)return 1;if(type===4)return 2;if(type===5)return 4;
 if(type===6)return !equipment[6]||(equipment[6].info?.type===8)?6:5;
 if(type===7)return !equipment[8]?8:7;
 return -1;
}

/** ClMain storage list uses Delphi Round(Dura / 1000), including ties to even. */
export function storageDurability(value:number):number {
    const whole=Math.floor(value/1000),remainder=value%1000;
    return whole+(remainder>500||remainder===500&&whole%2===1?1:0);
}
