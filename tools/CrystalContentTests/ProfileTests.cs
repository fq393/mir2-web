using System.Text.Json.Nodes;
static class ProfileTests {
 public static void Run(string root){
  void Check(bool ok,string m){if(!ok)throw new Exception(m);}
  void Reject(string name,Action<JsonNode> edit){var v=JsonNode.Parse(File.ReadAllText(ContentProfiles.PathFor(root,name,true)))!;edit(v);try{ContentProfiles.Validate(root,name,v.ToJsonString());throw new Exception("Accepted invalid profile "+name);}catch(InvalidDataException){}}
  foreach(var name in ContentProfiles.Names){var original=File.ReadAllText(ContentProfiles.PathFor(root,name,true));Check(JsonNode.DeepEquals(JsonNode.Parse(original),JsonNode.Parse(ContentProfiles.Validate(root,name,original))),"baseline changed");}
  var xp=JsonNode.Parse(File.ReadAllText(ContentProfiles.PathFor(root,"experience",true)))!;xp["requiredExperience"]![0]=123;Check(JsonNode.Parse(ContentProfiles.Validate(root,"experience",xp.ToJsonString()))!["requiredExperience"]![0]!.GetValue<int>()==123,"valid xp rejected");
  Reject("ground-items",v=>v["timers"]!["ordinaryMinutes"]=0);
  Reject("ground-items",v=>v["timers"]!["playerDeathMinutes"]=-1);
  Reject("ground-items",v=>v["timers"]!["ordinaryMinutes"]=1.5);
  Reject("ground-items",v=>v["timers"]!["playerDeathMinutes"]=10081);
  Reject("ground-items",v=>v["source"]="invented official rule");
  Reject("experience",v=>v["requiredExperience"]![0]=0);Reject("experience",v=>v["requiredExperience"]![0]=1.5);Reject("experience",v=>v["invented"]=1);
  Reject("jewellery",v=>v["items"]![0]!["level"]=256);Reject("jewellery",v=>v["items"]![0]!["image"]=0);
  Reject("bichon-wildlife",v=>v["respawns"]![0]!["x"]=700);Reject("bichon-wildlife",v=>v["monsters"]![0]!["minDC"]=65000);
  Reject("bichon-wildlife",v=>v["drops"]!["BichonScarecrow"]![0]="1/0 Gold 130");Reject("bichon-wildlife",v=>v["drops"]!["BichonScarecrow"]![0]="1/3 Gold 999");
  var drops=JsonNode.Parse(File.ReadAllText(ContentProfiles.PathFor(root,"bichon-wildlife",true)))!;drops["drops"]!["BichonScarecrow"]![0]="1/17 Gold 130";ContentProfiles.Validate(root,"bichon-wildlife",drops.ToJsonString());
  var isolated=Path.Combine(Path.GetTempPath(),"mir-profile-"+Guid.NewGuid());Directory.CreateDirectory(Path.Combine(isolated,"server/content"));try{File.Copy(ContentProfiles.PathFor(root,"experience",true),ContentProfiles.PathFor(isolated,"experience",true));Check(ContentProfiles.Read(isolated,"experience")==File.ReadAllText(ContentProfiles.PathFor(root,"experience",true)),"baseline fallback failed");Directory.CreateDirectory(Path.Combine(isolated,"server/data/overrides"));File.WriteAllText(ContentProfiles.PathFor(isolated,"experience"),xp.ToJsonString());Check(ContentProfiles.Read(isolated,"experience")==xp.ToJsonString(),"override not read");}finally{Directory.Delete(isolated,true);}
  try{ContentProfiles.PathFor(root,"../accounts");throw new Exception("path traversal allowed");}catch(InvalidDataException){}
  Console.WriteLine("PASS profile baseline integrity, numeric bounds, source immutability, override isolation, unknown/path rejection.");
 }
}
