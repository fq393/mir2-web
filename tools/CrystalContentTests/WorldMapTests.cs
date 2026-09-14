using System.Drawing;
using System.Text.Json;
using Mir2.WebHost;
using Server.MirEnvir;
static class WorldMapTests {
 public static void Run(string root,Envir envir){
  void Check(bool value,string message){if(!value)throw new Exception(message);}
  var before=envir.MapInfoList.ToArray();var index=envir.MapIndex;
  try {
   envir.MapInfoList.Clear();WorldMaps.Seed(envir,root);var count=envir.MapInfoList.Count;
   var ids=envir.MapInfoList.ToDictionary(m=>m.FileName,m=>m.Index);
   Check(new[]{"0102","0108","0109"}.All(ids.ContainsKey),"Bichon butcher/pharmacy maps missing from registry");
   WorldMaps.Seed(envir,root);Check(envir.MapInfoList.Count==count&&envir.MapInfoList.All(m=>ids[m.FileName]==m.Index),"map reseed changed identities");
   var checkedDoors=0;
   foreach(var definition in WorldMaps.Load(root).Where(m=>m.Pin!=null)){
    using var pin=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,definition.Pin)));
    foreach(var p in pin.RootElement.GetProperty("portals").EnumerateArray()){
     var map=envir.MapInfoList.Single(m=>m.FileName==p[0].GetString());
     var door=map.Movements.Single(m=>m.Source==new Point(p[1].GetInt32(),p[2].GetInt32()));
     Check(door.MapIndex==ids[p[3].GetString()!]&&door.Destination==new Point(p[4].GetInt32(),p[5].GetInt32()),"portal differs from source pin");checkedDoors++;
    }
   }
   MerchantSeed.Apply(envir,root,envir.MapInfoList.Single(m=>m.FileName=="0"));
   foreach(var spec in new[]{
    (File:"BichonMeatShop",Map:"0102",Name:"比奇屠夫",X:9,Y:7,Image:11),
    (File:"BichonCityPharmacy",Map:"0108",Name:"比奇赖家店老板",X:7,Y:7,Image:1),
    (File:"BichonCityPotionHouse",Map:"0109",Name:"比奇杳水店老板",X:4,Y:8,Image:9)}) {
    var merchant=envir.NPCInfoList.Single(n=>n.FileName==spec.File);
    Check(merchant.MapIndex==ids[spec.Map]&&merchant.Name==spec.Name&&merchant.Location==new Point(spec.X,spec.Y)&&merchant.Image==spec.Image,"Bichon interior merchant differs from pinned candidate row: "+spec.File);
   }
   var butcherScript=File.ReadAllText(Path.Combine(Server.Settings.NPCPath,"BichonMeatShop.txt"));
   Check(butcherScript.Contains("[@SELL]")&&butcherScript.Contains("[TYPES]\n"+(int)ItemType.Meat+"\n"),"interior butcher does not offer meat sale");
   foreach(var file in new[]{"BichonCityPharmacy","BichonCityPotionHouse"}) {
    var script=File.ReadAllText(Path.Combine(Server.Settings.NPCPath,file+".txt"));
    Check(script.Contains("BichonHealthSmall 1")&&script.Contains("BichonManaSmall 1")&&!script.Contains("BichonHealthLarge"),"pharmacy stock escaped the verified small-potion subset: "+file);
   }
   var seededMerchantCount=envir.NPCInfoList.Count;
   MerchantSeed.Apply(envir,root,envir.MapInfoList.Single(m=>m.FileName=="0"));
   Check(envir.NPCInfoList.Count==seededMerchantCount,"Bichon interior shop reseed duplicated NPCs");
   var npc=envir.NPCInfoList.Single(n=>n.FileName=="BichonCityTailor");
   Check(npc.MapIndex==ids["0106"]&&npc.Location==new Point(19,6)&&npc.Image==7,"city tailor placed outside original room");
   Check(File.ReadAllText(Path.Combine(Server.Settings.NPCPath,"BichonCityTailor.txt")).Contains("[@SREPAIR]"),"tailor repair missing");
   WarehouseSeed.Apply(envir,root);WarehouseSeed.Apply(envir,root);
   var keeper=envir.NPCInfoList.Single(n=>n.FileName=="BoundaryWarehouse");
   Check(keeper.MapIndex==ids["0140"]&&keeper.Location==new Point(8,9)&&keeper.Image==9&&keeper.Name=="边界村保管员","warehouse identity differs from source");
   var warehouseScript=File.ReadAllText(Path.Combine(Server.Settings.NPCPath,"BoundaryWarehouse.txt"));
   Check(warehouseScript.Contains("<存入物品/@STORAGE>")&&warehouseScript.Contains("<取回物品/@STORAGE>"),"warehouse services missing");
   Console.WriteLine($"PASS registry: stable map IDs, {checkedDoors} pinned doors, Bichon butcher/pharmacies, and city tailor/warehouse identities.");
  }finally{envir.MapInfoList.Clear();envir.MapInfoList.AddRange(before);envir.MapIndex=index;}
 }
}
