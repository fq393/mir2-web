using System.Drawing;
using System.Text.Json;
using System.Security.Cryptography;
using Server;
using Server.MirDatabase;
using Server.MirEnvir;
namespace Mir2.WebHost;
public record WorldMapDefinition(string Id,string Name,string Source,string Pin);
public static class WorldMaps {
 public static List<WorldMapDefinition> Load(string root){
  using var doc=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,"server/content/world-maps.json")));
  var maps=doc.RootElement.GetProperty("maps").EnumerateArray().Select(m=>new WorldMapDefinition(m.GetProperty("id").GetString()!,m.GetProperty("name").GetString()!,m.GetProperty("source").GetString()!,m.TryGetProperty("pin",out var pin)?pin.GetString()!:null)).ToList();
  if(maps.Count==0||maps.Count(m=>m.Id=="0")!=1||maps.Select(m=>m.Id).Distinct().Count()!=maps.Count||maps.Any(m=>!System.Text.RegularExpressions.Regex.IsMatch(m.Id,"^[A-Za-z0-9]+$")))throw new InvalidDataException("Invalid world map registry");
  return maps;
 }
 public static void Install(string root){
  foreach(var map in Load(root)){
   var source=Path.Combine(root,map.Source);
   if(map.Pin!=null){using var pin=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,map.Pin)));
    var expected=pin.RootElement.GetProperty("mapSources").EnumerateArray().Single(s=>s.GetProperty("path").GetString()==map.Source).GetProperty("sha256").GetString();
    if(!Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(source))).Equals(expected,StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("Original map hash mismatch: "+map.Id);
   }
   File.Copy(source,Path.Combine(Settings.MapPath,map.Id+".map"),true);
  }
 }
 public static void Seed(Envir envir,string root){
  var definitions=Load(root);var maps=new Dictionary<string,MapInfo>();
  foreach(var row in definitions){
   var map=envir.MapInfoList.SingleOrDefault(m=>m.FileName==row.Id);
   if(map==null){map=new MapInfo{Index=++envir.MapIndex,FileName=row.Id,Light=LightSetting.Normal};envir.MapInfoList.Add(map);}
   map.Title=row.Name;maps.Add(row.Id,map);
  }
  var seen=new Dictionary<(string,int,int),(string,int,int)>();
  foreach(var row in definitions.Where(m=>m.Pin!=null)){
   using var pin=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,row.Pin)));
   foreach(var door in pin.RootElement.GetProperty("portals").EnumerateArray()){
    string from=door[0].GetString()!,to=door[3].GetString()!;var key=(from,door[1].GetInt32(),door[2].GetInt32());var value=(to,door[4].GetInt32(),door[5].GetInt32());
    if(!maps.ContainsKey(from)||!maps.ContainsKey(to)||seen.TryGetValue(key,out var previous)&&previous!=value)throw new InvalidDataException("Unregistered or conflicting portal");
    seen[key]=value;var at=new Point(key.Item2,key.Item3);var entry=maps[from].Movements.SingleOrDefault(m=>m.Source==at);
    if(entry==null){entry=new MovementInfo{Source=at};maps[from].Movements.Add(entry);}
    entry.MapIndex=maps[to].Index;entry.Destination=new Point(value.Item2,value.Item3);entry.NeedHole=false;entry.NeedMove=false;
   }
  }
 }
}
