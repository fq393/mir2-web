using System.Drawing;
using System.Text.Json;
using Server;
using Server.MirDatabase;
using Server.MirEnvir;
using Server.MirNetwork;
using Server.MirObjects;
static class EquipmentShopTests {
 public static void Run(string root,Envir envir,MirConnection connection){
  void Check(bool ok,string why){if(!ok)throw new Exception(why);}
  var map=new MapInfo{Index=105,FileName="0"};MerchantSeed.Apply(envir,root,map);
  var count=envir.ItemInfoList.Count;var npcs=envir.NPCInfoList.Count;MerchantSeed.Apply(envir,root,map);
  Check(count==envir.ItemInfoList.Count&&npcs==envir.NPCInfoList.Count,"equipment shops duplicated");
  var tailor=envir.NPCInfoList.Single(n=>n.FileName=="BoundaryTailor");Check(tailor.Image==7&&tailor.Location==new Point(305,607)&&tailor.MapIndex==105,"tailor identity mismatch");
  foreach(var expected in new[]{("BichonCitySmith","比奇铁匠铺老板",302,219,0),("GinkgoSmith","精武馆老板",649,602,0),("GinkgoTailor","高家店老板",643,601,7)}){
   var merchant=envir.NPCInfoList.Single(n=>n.FileName==expected.Item1);
   Check(merchant.Name==expected.Item2&&merchant.Location==new Point(expected.Item3,expected.Item4)&&merchant.Image==expected.Item5&&merchant.MapIndex==105,"regional merchant identity mismatch");
  }
  using var source=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,"raw-assets/reference-delphi/StdItems.json")));
  foreach(var spec in new[]{("BoundarySmith",9),("BoundaryTailor",6),("BichonCitySmith",9),("GinkgoSmith",9),("GinkgoTailor",6)}){
   var script=NPCScript.GetOrAdd(0,spec.Item1,NPCScriptType.Normal);Check(script.Goods.Count==spec.Item2,"stock count differs from source");
   foreach(var goods in script.Goods){
    var item=goods.Info;var row=source.RootElement.EnumerateArray().Single(v=>v.GetProperty("Name").GetString()==item.Name);
    Check(item.Image==row.GetProperty("Looks").GetUInt16()&&item.Shape==row.GetProperty("Shape").GetInt16()&&item.Price==row.GetProperty("Price").GetUInt32()&&item.Durability==row.GetProperty("DuraMax").GetUInt16()&&item.RequiredAmount==row.GetProperty("NeedLevel").GetByte(),"equipment identity/stats source mismatch");
    Check(item.RequiredGender==(row.GetProperty("Stdmode").GetInt32()==10?RequiredGender.Male:row.GetProperty("Stdmode").GetInt32()==11?RequiredGender.Female:RequiredGender.None),"gender mismatch");
    var p=new RecordingPlayer{Info=new CharacterInfo{Level=1,Class=MirClass.Warrior},Stats=new Stats{[Stat.BagWeight]=1000},Account=new AccountInfo{Gold=100000},Connection=connection,NPCPage=new NPCPage(NPCScript.BuyKey)};
    p.Info.Mount=new MountInfo(p);p.Report=new Reporting(p);script.Buy(p,goods.UniqueID,1);
    Check(p.Info.Inventory.Count(v=>v!=null)==1&&p.Info.Inventory[6].Info==item&&p.Info.Inventory[6].CurrentDura==item.Durability&&p.Account.Gold==100000-item.Price,"equipment purchase did not deliver/charge exactly once");
    uint gold=p.Account.Gold;for(int i=0;i<p.Info.Inventory.Length;i++)p.Info.Inventory[i]=envir.CreateFreshItem(item);script.Buy(p,goods.UniqueID,1);Check(p.Account.Gold==gold,"full bag charged");
   }
  }
  Console.WriteLine("PASS 39 sourced equipment purchases: original stock, shape/image/durability/gender/level, exact charge, full-bag protection and idempotent NPCs.");
 }
}
