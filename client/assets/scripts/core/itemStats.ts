/** Display item-instance bonuses separately from the shared base definition. */
export function itemStatLines(item:any,info:any=item?.info):string[] {
 const base=info?.stats?.values??info?.combat??{},added=item?.addedstats?.values??{};const lines:string[]=[];
 for(const [title,min,max] of [['攻击','mindc','maxdc'],['魔法','minmc','maxmc'],['道术','minsc','maxsc'],['防御','minac','maxac'],['魔御','minmac','maxmac']]){
  const lo=Number(base[min]??0)+Number(added[min]??0),hi=Number(base[max]??0)+Number(added[max]??0),bonus=Number(added[max]??0);
  if(lo||hi)lines.push(`${title} ${lo}–${hi}${bonus?`（附加 ${bonus>0?'+':''}${bonus}）`:''}`);
 }
 for(const [key,name] of [['accuracy','准确'],['agility','敏捷'],['luck','幸运'],['attackspeed','攻击速度'],['hp','生命'],['mp','魔法值']]){
  const bonus=Number(added[key]??0),total=Number(base[key]??0)+bonus;
  if(total)lines.push(`${name} ${total}${bonus?`（附加 ${bonus>0?'+':''}${bonus}）`:''}`);
 }
 return lines;
}

/** Presentation only. Crystal remains authoritative for all use/equip checks. */
export function itemDescription(item:any,info:any,name:string):string[] {
 const lines=[name];if(!info)return [...lines,'物品资料尚未同步'];
 if(Number.isFinite(info.weight))lines.push(`重量 ${info.weight}`);
 const current=item?.currentdura,max=item?.maxdura;
 if(info.type===15||info.type===14){if(Number.isFinite(current))lines.push(`${info.type===15?'品质':'纯度'} ${Math.floor(current/1000)}`);}
 else if(info.type===8){if(Number.isFinite(current)&&Number.isFinite(max))lines.push(`数量 ${current}/${max}`);}
 else if(info.type>=1&&info.type<=10&&Number.isFinite(current)&&Number.isFinite(max)&&max>0){
  // Pinned Crystal display convention; old Delphi rounding differs (see evidence doc).
  lines.push(`持久 ${Math.floor(current/1000)}/${Math.floor(max/1000)}`);
 }
 if(info.type===13){
  const hp=info.hp??info.stats?.values?.hp,mp=info.mp??info.stats?.values?.mp;
  if(hp>0)lines.push(`恢复生命 ${hp}`);if(mp>0)lines.push(`恢复魔法 ${mp}`);
 }else lines.push(...itemStatLines(item,info));
 const jobs=info.requiredclass;
 if(jobs!==undefined&&jobs!==31&&jobs!==7){const names=[[1,'战士'],[2,'法师'],[4,'道士']] as const;
  lines.push(`所需职业 ${jobs>0&&(jobs&~7)===0?names.filter(([mask])=>jobs&mask).map(([,title])=>title).join('、'):'待核对'}`);
 }
 if(info.requiredgender===1||info.requiredgender===2)lines.push(`所需性别 ${info.requiredgender===1?'男':'女'}`);
 if(info.requiredamount>0){const titles=['所需等级','所需防御上限','所需魔御上限','所需攻击上限','所需魔法上限','所需道术上限','等级上限','所需防御下限','所需魔御下限','所需攻击下限','所需魔法下限','所需道术下限'];
  lines.push(`${titles[info.requiredtype]??'要求类型待同步'} ${info.requiredamount}`);
 }
 return lines;
}
/** Clamp in the original 800x600 coordinate system, including tall descriptions. */
export function itemHintPosition(x:number,y:number,width:number,height:number):{x:number;y:number}{
 return {x:Math.max(0,Math.min(x+16,800-width)),y:Math.max(0,Math.min(y+16,600-height))};
}
