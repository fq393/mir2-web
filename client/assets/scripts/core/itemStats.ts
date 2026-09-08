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
