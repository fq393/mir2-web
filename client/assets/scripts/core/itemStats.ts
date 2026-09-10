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
 lines.push(...itemRequirements(info).map(row=>row.text));
 return lines;
}
/** Clamp in the original 800x600 coordinate system, including tall descriptions. */
export function itemHintPosition(x:number,y:number,width:number,height:number):{x:number;y:number}{
 return {x:Math.max(0,Math.min(x+16,800-width)),y:Math.max(0,Math.min(y+16,600-height))};
}

export type ItemViewer={level?:number;job?:number;gender?:number;attributes?:Record<string,number>|null};
export type ItemRequirement={text:string;met?:boolean};
/** Unknown is distinct from pass: do not infer final combat stats from equipment. */
export function itemRequirements(info:any,viewer:ItemViewer={}):ItemRequirement[]{
 if(!info)return [];const rows:ItemRequirement[]=[];const jobs=info.requiredclass;
 if(jobs!==undefined&&jobs!==31&&jobs!==7){const names=[[1,'战士'],[2,'法师'],[4,'道士']] as const;
  const known=Number.isInteger(jobs)&&jobs>0&&(jobs&~7)===0;
  rows.push({text:`所需职业 ${known?names.filter(([mask])=>jobs&mask).map(([,title])=>title).join('、'):'待核对'}`,met:known&&[0,1,2].includes(viewer.job!)?!!(jobs&(1<<viewer.job!)):undefined});
 }
 if(info.requiredgender===1||info.requiredgender===2)rows.push({text:`所需性别 ${info.requiredgender===1?'男':'女'}`,met:[0,1].includes(viewer.gender!)?!!(info.requiredgender&(1<<viewer.gender!)):undefined});
 if(info.requiredamount>0){const titles=['所需等级','所需防御上限','所需魔御上限','所需攻击上限','所需魔法上限','所需道术上限','等级上限','所需防御下限','所需魔御下限','所需攻击下限','所需魔法下限','所需道术下限'];
  const key:Record<number,string>={1:'maxac',2:'maxmac',3:'maxdc',4:'maxmc',5:'maxsc',7:'minac',8:'minmac',9:'mindc',10:'minmc',11:'minsc'};const actual=info.requiredtype===0||info.requiredtype===6?viewer.level:viewer.attributes?.[key[info.requiredtype]];
  const met=Number.isFinite(actual)?(info.requiredtype===6?actual!<=info.requiredamount:actual!>=info.requiredamount):undefined;
  rows.push({text:`${titles[info.requiredtype]??'要求类型待同步'} ${info.requiredamount}`,met});
 }
 return rows;
}
/** Original bag has three description rows. Keep the full floating view if they do not fit. */
export function compactBagDescription(item:any,info:any,name:string,measure:(text:string)=>number,width=258):string[]|null {
 if(!info)return null;
 const requirements=itemRequirements(info).map(r=>r.text),details=itemDescription(item,info,name).slice(1);
 const basics=details.filter(t=>/^(重量|持久|品质|纯度|数量) /.test(t));
 const stats=details.filter(t=>!basics.includes(t)&&!requirements.includes(t));
 const trim=(t:string)=>t.replace(/（附加 ([^）]*)）/g,'($1)').replace(/^(重量|持久|品质|纯度|数量) /,'$1').replace(/所需等级 /g,'需要等级').replace(/所需攻击上限 /g,'需要攻击力').replace(/所需魔法上限 /g,'所需魔法值').replace(/所需道术上限 /g,'所需道术').replace(/^攻击 /,'攻击力').replace(/–/g,'-');
 const rows=[[name,...basics.map(trim)].join(' '),stats.map(trim).join(' '),requirements.map(trim).join(' ')];
 if(info.type===20&&[1,2,4].includes(info.requiredclass)){rows[1]=({1:'武士秘籍',2:'法师秘籍',4:'道士秘籍'} as Record<number,string>)[info.requiredclass];rows[2]=requirements.filter(t=>!t.startsWith('所需职业 ')).map(trim).join(' ');}
 return rows.every(row=>measure(row)<=width)?rows:null;
}

/** Pinned Crystal MirItemCell.PlayItemSound / SoundList, local original WAVs. */
export function equipmentSound(type:number,name=""):string {
 if(type===6&&/手镯|手套/.test(name))return '117';
 return ({1:'111',2:'112',4:'116',5:'115',6:'114',7:'113',10:'117',13:'108'} as Record<number,string>)[type]??'118';
}

/** Fixed Delphi Actor sound switch; web weapon Shape is the undoubled identity. */
export function weaponAttackSound(shape:number):string {
 if([6,20].includes(shape))return '50';if(shape===1)return '51';
 if([2,13,9,5,14,22].includes(shape))return '52';
 if([4,17,10,15,16,23].includes(shape))return '53';
 if([3,7,11].includes(shape))return '54';if(shape===24)return '55';
 if([8,12,18,21].includes(shape))return '56';return '57';
}
