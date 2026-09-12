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
   var npc=envir.NPCInfoList.Single(n=>n.FileName=="BichonCityTailor");
   Check(npc.MapIndex==ids["0106"]&&npc.Location==new Point(19,6)&&npc.Image==7,"city tailor placed outside original room");
   Check(File.ReadAllText(Path.Combine(Server.Settings.NPCPath,"BichonCityTailor.txt")).Contains("[@SREPAIR]"),"tailor repair missing");
   Console.WriteLine($"PASS registry: stable map IDs, {checkedDoors} pinned doors and city tailor identity.");
  }finally{envir.MapInfoList.Clear();envir.MapInfoList.AddRange(before);envir.MapIndex=index;}
 }
}
