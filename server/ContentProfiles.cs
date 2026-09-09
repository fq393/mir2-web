using System.Text.Json;
using System.Text.Json.Nodes;
using System.Security.Cryptography;

// Source profiles stay immutable. Admin writes validated local overrides for the next restart.
static class ContentProfiles {
 public static readonly string[] Names={"experience","jewellery","bichon-wildlife","ground-items"};
 public static string PathFor(string root,string name,bool baseline=false){
  if(!Names.Contains(name))throw new InvalidDataException("未知配置。");
  return Path.Combine(root,baseline?"server/content":"server/data/overrides",name+".json");
 }
 public static string Read(string root,string name){var path=PathFor(root,name);return File.ReadAllText(File.Exists(path)?path:PathFor(root,name,true));}
 // Apply before the world starts. Existing ground entities retain their own expiry deadline.
 public static void ApplyGroundItemTimers(string root){
  using var profile=JsonDocument.Parse(Validate(root,"ground-items",Read(root,"ground-items")));
  var timers=profile.RootElement.GetProperty("timers");
  Server.Settings.ItemTimeOut=timers.GetProperty("ordinaryMinutes").GetInt32();
  Server.Settings.PlayerDiedItemTimeOut=timers.GetProperty("playerDeathMinutes").GetInt32();
 }
 public static string Hash(string text)=>Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(text)));
 public static string Validate(string root,string name,string input){
  var baseline=JsonNode.Parse(File.ReadAllText(PathFor(root,name,true)))!;var candidate=JsonNode.Parse(input)??throw new InvalidDataException("配置不能为空。");
  void Walk(JsonNode? original,JsonNode? value,string path){
   if(original is JsonObject obj){if(value is not JsonObject other||obj.Count!=other.Count||obj.Any(p=>!other.ContainsKey(p.Key)))throw new InvalidDataException("不能新增或删除字段："+path);foreach(var pair in obj)Walk(pair.Value,other[pair.Key],path+"/"+pair.Key);return;}
   if(original is JsonArray arr){if(value is not JsonArray other||arr.Count!=other.Count)throw new InvalidDataException("不能变更内容行数："+path);for(int i=0;i<arr.Count;i++)Walk(arr[i],other[i],path+"/"+i);return;}
   if(JsonNode.DeepEquals(original,value))return;
   string leaf=path.Split('/').Last();
   if(name=="ground-items"&&path.StartsWith("/timers/")){
    if(value is not JsonValue timer||!timer.TryGetValue<int>(out var minutes)||minutes<1||minutes>10080)throw new InvalidDataException("掉落消失时间须为1至10080分钟的整数："+path);
    return;
   }
   bool numeric=name=="experience"&&path.StartsWith("/requiredExperience/")||name=="bichon-wildlife"&&(path.StartsWith("/monsters/")&&new[]{"hp","experience","minDC","maxDC","accuracy","agility","moveMs","attackMs"}.Contains(leaf)||path.StartsWith("/respawns/")&&new[]{"x","y","spread","count","minutes"}.Contains(leaf))||name=="jewellery"&&path.StartsWith("/items/")&&(new[]{"price","durability","weight","level"}.Contains(leaf)||path.Contains("/stats/"));
   if(numeric){if(value is not JsonValue v||!v.TryGetValue<long>(out var n)||n<0||n>(name=="experience"?1_000_000_000_000L:65535))throw new InvalidDataException("数值须为允许范围内的整数："+path);if((name=="experience"||new[]{"hp","count","minutes","moveMs","attackMs"}.Contains(leaf))&&n==0)throw new InvalidDataException("该数值必须大于零："+path);if(name=="bichon-wildlife"&&new[]{"x","y","spread"}.Contains(leaf)&&n>699)throw new InvalidDataException("比奇坐标/范围超界。");if(new[]{"weight","level","accuracy","agility"}.Contains(leaf)&&n>255)throw new InvalidDataException("字段超过字节范围。");return;}
   if(name=="bichon-wildlife"&&path.StartsWith("/drops/")){
    var old=(string?)original??"";var next=(string?)value??"";var parts=next.Split(' ',2);var oldParts=old.Split(' ',2);
    if(parts.Length!=2||oldParts.Length!=2||parts[1]!=oldParts[1]||!System.Text.RegularExpressions.Regex.IsMatch(parts[0],@"^1/[1-9][0-9]{0,7}$"))throw new InvalidDataException("只允许修改该条掉落的1/N分母，物品/金币参数保持原定义。");return;
   }
   throw new InvalidDataException("该字段是原始定义或来源记录，不可在数值面板修改："+path);
  }
  Walk(baseline,candidate,"");
  if(name=="bichon-wildlife")foreach(var m in candidate["monsters"]!.AsArray())if((long)m!["minDC"]!>(long)m["maxDC"]!)throw new InvalidDataException("最低攻击不能高于最高攻击。");
  return candidate.ToJsonString(new JsonSerializerOptions{WriteIndented=true});
 }
}
