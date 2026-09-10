using Server;
using Server.MirDatabase;
using Server.MirEnvir;
using Server.MirNetwork;
using Server.MirObjects;
static class UsedGoodsTests {
 public static void Run(Envir envir,MirConnection connection){
  void Check(bool ok,string why){if(!ok)throw new Exception(why);}
  var npc=new NPCObject(envir.NPCInfoList.Single(n=>n.FileName=="BoundarySmith"));
  var script=NPCScript.Get(npc.ScriptID);
  RecordingPlayer Buyer(uint gold){var p=new RecordingPlayer{Info=new CharacterInfo{Level=20,Name="旧货验收"},Stats=new Stats{[Stat.BagWeight]=1000},Account=new AccountInfo{Gold=gold},Connection=connection,NPCObjectID=npc.ObjectID,NPCPage=new NPCPage(NPCScript.BuyKey)};p.Info.Mount=new MountInfo(p);p.Report=new Reporting(p);return p;}
  var info=envir.ItemInfoList.Single(i=>i.Name=="青铜剑");
  var old=envir.CreateFreshItem(info);old.AddedStats[Stat.MaxDC]=3;old.CurrentDura=1000;old.MaxDura=3000;npc.UsedGoods.Add(old);
  var p=Buyer(100000);uint price=(uint)(old.Price()*script.PriceRate(p));script.Buy(p,old.UniqueID,1);
  Check(p.Info.Inventory.Single(i=>i!=null)==old&&old.AddedStats[Stat.MaxDC]==3&&old.CurrentDura==1000&&old.MaxDura==3000,"old equipment lost identity/bonus/durability");
  Check(p.Account.Gold==100000-price&&!npc.UsedGoods.Contains(old)&&npc.NeedSave,"old goods not charged/removed/marked for save");
  var second=Buyer(100000);script.Buy(second,old.UniqueID,1);Check(second.Account.Gold==100000&&second.Info.Inventory.All(i=>i==null),"stale buyer duplicated sold equipment");
  var stackInfo=new ItemInfo{Index=++envir.ItemIndex,Name="test-old-stack",Type=ItemType.Potion,StackSize=20,Price=100,Weight=1};envir.ItemInfoList.Add(stackInfo);
  var stack=envir.CreateFreshItem(stackInfo);stack.Count=5;npc.UsedGoods.Add(stack);
  var poor=Buyer(0);script.Buy(poor,stack.UniqueID,2);Check(stack.Count==5&&npc.UsedGoods.Contains(stack),"insufficient gold changed shared stock");
  var full=Buyer(100000);for(int i=0;i<full.Info.Inventory.Length;i++)full.Info.Inventory[i]=envir.CreateFreshItem(info);script.Buy(full,stack.UniqueID,2);Check(stack.Count==5&&full.Account.Gold==100000,"full bag changed stock/gold");
  var partial=Buyer(100000);script.Buy(partial,stack.UniqueID,2);var delivered=partial.Info.Inventory.Single(i=>i!=null);Check(delivered.Count==2&&delivered.UniqueID!=stack.UniqueID&&stack.Count==3&&npc.UsedGoods.Contains(stack)&&partial.Account.Gold==99800,"partial purchase lost remainder or duplicated ID");
  script.Buy(second,stack.UniqueID,3);Check(second.Info.Inventory.Single(i=>i!=null)==stack&&!npc.UsedGoods.Contains(stack)&&second.Account.Gold==99700,"remaining stack did not transfer exactly");
  var buyback=envir.CreateFreshItem(stackInfo);buyback.Count=4;npc.BuyBack[poor.Name]=new(){buyback};script.Buy(poor,buyback.UniqueID,1);Check(buyback.Count==4,"failed buyback changed stock");
  poor.Account.Gold=1000;script.Buy(poor,buyback.UniqueID,1);Check(buyback.Count==3&&poor.Info.Inventory.Single(i=>i!=null).Count==1,"buyback split lost remainder");
  // Exercise the engine's goods file, then a fresh NPC/script load, not just UserItem serialization.
  var retained=envir.CreateFreshItem(info);retained.AddedStats[Stat.MaxDC]=3;retained.CurrentDura=1000;retained.MaxDura=3000;npc.UsedGoods.Add(retained);npc.NeedSave=true;
  var map=new Map(new MapInfo{Index=9991,FileName="used-goods-test"});map.NPCs.Add(npc);envir.MapList.Add(map);
  typeof(Envir).GetMethod("SaveGoods",System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic)!.Invoke(envir,new object[]{false});
  var saved=Path.Combine(Settings.GoodsPath,npc.Info.Index+".msd");Check(SpinWait.SpinUntil(()=>File.Exists(saved),3000),"goods save did not complete");
  var reopened=new NPCObject(npc.Info);NPCScript.Get(reopened.ScriptID).LoadGoods();
  Check(reopened.UsedGoods.Count==1&&reopened.UsedGoods[0].UniqueID==retained.UniqueID&&reopened.UsedGoods[0].AddedStats[Stat.MaxDC]==3&&reopened.UsedGoods[0].CurrentDura==1000&&reopened.UsedGoods[0].MaxDura==3000,"reload lost unsold bonus/durability or resurrected sold goods");
  envir.MapList.Remove(map);envir.NPCs.Remove(reopened);envir.NPCs.Remove(npc);
  Console.WriteLine("PASS used goods: exact instance/bonus/durability, stale second buyer, insufficient gold/full bag immutability, split/remainder IDs buyback and actual goods save/load.");
 }
}
