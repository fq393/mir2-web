/** Legacy FState DMenuBuyClick: grouped name -> exact stock instance -> buy. */
export function shopGroups(goods:any[]):any[]{
 const groups=new Map<number,any>();
 for(const item of goods){const key=item.itemindex;let row=groups.get(key);if(!row){row={...item,shopGroup:true,uniqueid:`group:${key}`,instances:[]};groups.set(key,row);}row.instances.push(item);}
 return Array.from(groups.values());
}
export function shopRows(goods:any[],detail:number|null):any[]{return detail===null?shopGroups(goods):goods.filter(item=>item.itemindex===detail);}
/** UserItem.Price: float32 arithmetic and per-instance added-stat magnitude. */
export function shopPrice(item:any,info:any,rate=1):number{
 if(!info)return 0;const f=Math.fround;let price=info.price;
 if(info.durability>0){price=Math.trunc(f((item.maxdura??0)*f(f(info.price/2)/info.durability)));const ratio=item.maxdura>0?f(item.currentdura/item.maxdura):0;price=Math.floor(f(f(f(price/2)+f(f(price/2)*ratio))+f(info.price/2)));}
 const bonus=Object.values(item.addedstats?.values??{}).reduce<number>((sum,v)=>sum+Math.abs(Number(v)),0);
 price=Math.trunc(f(price*f(f(bonus*f(.1))+1)))*(item.count??1);
 return Math.trunc(f(price*rate));
}
