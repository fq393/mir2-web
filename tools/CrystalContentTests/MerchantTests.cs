using System.Drawing;
using Mir2.WebHost;
using Server;
using Server.MirDatabase;
using Server.MirEnvir;
using Server.MirNetwork;
using Server.MirObjects;
static class MerchantTests {
 public static void Run(string root,Envir envir,MirConnection connection){
  void Check(bool ok,string m){if(!ok)throw new Exception(m);}
  void Reject(Action action){try{action();throw new Exception("Rejected trade unexpectedly succeeded");}catch(InvalidOperationException){}}
  var map=new Map(new MapInfo{Index=998,FileName="trade-fixture"}){Width=40,Height=40,Cells=new Cell[40,40]};
  for(int x=0;x<40;x++)for(int y=0;y<40;y++)map.Cells[x,y]=new Cell{Attribute=CellAttribute.Walk};
  var definition=envir.NPCInfoList.First(n=>n.FileName=="BichonJewellery4");
  definition.Location=new Point(5,5);var npc=new NPCObject(definition){CurrentMap=map};map.NPCs.Add(npc);
  var p=new RecordingPlayer{Info=new CharacterInfo{Level=7,Name="交易校验"},Stats=new Stats{[Stat.BagWeight]=100},Account=new AccountInfo{Gold=10000},Connection=connection,CurrentMap=map,CurrentLocation=new Point(5,6),NPCObjectID=npc.ObjectID,NPCScriptID=npc.ScriptID,NPCPage=new NPCPage(NPCScript.RepairKey)};p.Report=new Reporting(p);p.Info.Mount=new MountInfo(p);
  var ring=envir.CreateFreshItem(envir.ItemInfoList.First(i=>i.Name=="牛角戒指"));ring.CurrentDura=(ushort)(ring.MaxDura/2);ring.AddedStats[Stat.MaxDC]=3;p.Info.Inventory[6]=ring;
  var quote=MerchantTrades.Quote(p,ring.UniqueID,"repair");var expectedGold=ring.RepairPrice();Check(quote.Gold==expectedGold,"quote differs from engine cost");var oldMax=ring.MaxDura;var oldCurrent=ring.CurrentDura;
  p.Account.Gold=expectedGold-1;Reject(()=>MerchantTrades.Commit(p,quote));Check(ring.CurrentDura==oldCurrent&&ring.MaxDura==oldMax,"insufficient gold changed durability");
  p.Account.Gold=10000;ring.CurrentDura--;Reject(()=>MerchantTrades.Commit(p,quote));ring.CurrentDura++;
  MerchantTrades.Commit(p,quote);Check(p.Account.Gold==10000-expectedGold&&ring.CurrentDura==ring.MaxDura&&ring.MaxDura==oldMax-(oldMax-oldCurrent)/30,"normal repair gold or durability differs");Check(ring.AddedStats[Stat.MaxDC]==3,"repair removed bonus");
  Reject(()=>MerchantTrades.Commit(p,quote));Check(p.Packets.OfType<ServerPackets.ItemRepaired>().Count()==1,"duplicate repair applied");
  ring.CurrentDura=(ushort)(ring.MaxDura/2);p.NPCPage=new NPCPage(NPCScript.SRepairKey);var special=MerchantTrades.Quote(p,ring.UniqueID,"special");oldMax=ring.MaxDura;var before=p.Account.Gold;MerchantTrades.Commit(p,special);Check(ring.MaxDura==oldMax&&ring.CurrentDura==oldMax&&p.Account.Gold==before-special.Gold,"special repair mismatch");
  p.NPCPage=new NPCPage(NPCScript.SellKey);p.Account.Gold=uint.MaxValue;Reject(()=>MerchantTrades.Quote(p,ring.UniqueID,"sell"));Check(p.Info.Inventory[6]==ring,"full wallet destroyed item");
  p.Account.Gold=1000;var sale=MerchantTrades.Quote(p,ring.UniqueID,"sell");p.CurrentLocation=new Point(35,35);Reject(()=>MerchantTrades.Commit(p,sale));p.CurrentLocation=new Point(5,6);p.Dead=true;Reject(()=>MerchantTrades.Commit(p,sale));p.Dead=false;
  p.NPCPage=new NPCPage(NPCScript.BuyKey);Reject(()=>MerchantTrades.Commit(p,sale));p.NPCPage=new NPCPage(NPCScript.SellKey);
  MerchantTrades.Commit(p,sale);Check(p.Info.Inventory[6]==null&&p.Account.Gold==1000+sale.Gold,"sale transfer mismatch");Reject(()=>MerchantTrades.Commit(p,sale));Check(p.Packets.OfType<ServerPackets.SellItem>().Count(x=>x.Success)==1,"duplicate sale");
  MerchantSeed.Apply(envir,root,map.Info);var count=envir.NPCInfoList.Count;MerchantSeed.Apply(envir,root,map.Info);Check(envir.NPCInfoList.Count==count,"butcher seed duplicated NPCs");
  var butcherInfo=envir.NPCInfoList.First(n=>n.FileName=="BichonButcherBorder");butcherInfo.Location=new Point(5,5);var butcher=new NPCObject(butcherInfo){CurrentMap=map};map.NPCs.Add(butcher);p.NPCObjectID=butcher.ObjectID;p.NPCScriptID=butcher.ScriptID;
  p.Info.Inventory[6]=ring;Reject(()=>MerchantTrades.Quote(p,ring.UniqueID,"sell"));
  var meat=envir.CreateFreshItem(envir.ItemInfoList.Single(i=>i.Name=="肉"));meat.CurrentDura=7756;p.Info.Inventory[6]=meat;var meatQuote=MerchantTrades.Quote(p,meat.UniqueID,"sell");before=p.Account.Gold;MerchantTrades.Commit(p,meatQuote);Check(p.Info.Inventory[6]==null&&p.Account.Gold==before+meatQuote.Gold,"meat did not sell");
  Check(p.Packets.OfType<ServerPackets.GainedGold>().Sum(x=>(long)x.Gold)==sale.Gold+meatQuote.Gold,"authoritative gold replies differ");
  envir.NPCs.Remove(npc);envir.NPCs.Remove(butcher);
  Console.WriteLine("PASS real merchant quote/commit: ordinary/special repair, persistent +3 bonus, changed quote, full wallet, distance/death/page/type restrictions, meat sale and duplicate protection.");
 }
}
