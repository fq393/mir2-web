using Server.MirObjects;
namespace Mir2.WebHost;
public sealed record MerchantQuote(uint Player,uint NPC,int Script,string Mode,string UniqueID,ushort Count,ushort CurrentDura,ushort MaxDura,uint Gold,string Stats);
/// <summary>Quote/commit adapter around pinned PlayerObject.SellItem/RepairItem.
/// Not a replacement economy: Price and RepairPrice are the engine's own functions.
/// </summary>
public static class MerchantTrades {
 public static MerchantQuote Quote(PlayerObject p,ulong id,string mode){
  if(p==null||p.Dead||p.CurrentMap==null)throw new InvalidOperationException("当前不能办理商店业务。");
  var key=mode switch{"sell"=>NPCScript.SellKey,"repair"=>NPCScript.RepairKey,"special"=>NPCScript.SRepairKey,_=>throw new InvalidOperationException("未知业务。")};
  if(!string.Equals(p.NPCPage?.Key,key,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("请重新与商人交谈。");
  var npc=p.CurrentMap.NPCs.FirstOrDefault(n=>n.ObjectID==p.NPCObjectID);
  if(npc==null||!Functions.InRange(npc.CurrentLocation,p.CurrentLocation,Globals.DataRange))throw new InvalidOperationException("距离商人太远。");
  var item=p.Info.Inventory.FirstOrDefault(i=>i?.UniqueID==id);
  if(item?.Info==null||item.Count==0)throw new InvalidOperationException("物品已不在背包中。");
  var script=NPCScript.Get(p.NPCScriptID);
  if(script==null||!script.Types.Contains(item.Info.Type))throw new InvalidOperationException("这位商人不办理该类物品。");
  uint price;
  if(mode=="sell"){
   if(item.Info.Bind.HasFlag(BindMode.DontSell)||item.RentalInformation?.BindingFlags.HasFlag(BindMode.DontSell)==true)throw new InvalidOperationException("该物品不能出售。");
   price=item.Price()/2;
   // Upstream's whole-stack branch does not guard a full gold wallet before removing the item.
   if((ulong)p.Account.Gold+price>uint.MaxValue)throw new InvalidOperationException("金币已达上限，物品没有出售。");
  }else{
   if(item.Info.Durability==0||item.CurrentDura>=item.MaxDura)throw new InvalidOperationException("该物品不需要修理。");
   if(item.Info.Bind.HasFlag(BindMode.DontRepair)||mode=="special"&&item.Info.Bind.HasFlag(BindMode.NoSRepair))throw new InvalidOperationException("该物品不能进行这种修理。");
   price=(uint)(item.RepairPrice()*(mode=="special"?3:1)*script.PriceRate(p));
   if(price>p.Account.Gold)throw new InvalidOperationException("金币不足。");
  }
  return new(p.ObjectID,npc.ObjectID,p.NPCScriptID,mode,id.ToString(),item.Count,item.CurrentDura,item.MaxDura,price,string.Join(";",item.AddedStats.Values.OrderBy(v=>v.Key).Select(v=>$"{v.Key}:{v.Value}")));
 }
 public static void Commit(PlayerObject p,MerchantQuote quoted){
  var current=Quote(p,ulong.Parse(quoted.UniqueID),quoted.Mode);
  if(current!=quoted)throw new InvalidOperationException("物品或商店状态已变化，请重新报价。");
  if(quoted.Mode=="sell")p.SellItem(ulong.Parse(quoted.UniqueID),quoted.Count);
  else p.RepairItem(ulong.Parse(quoted.UniqueID),quoted.Mode=="special");
 }
}
