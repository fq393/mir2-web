using System.Drawing;
using System.Text.Json;
using Server;
using Server.MirDatabase;
using Server.MirEnvir;
static class MerchantSeed {
 public static void Apply(Envir envir,string root,MapInfo map){
  using var source=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,"server/content/merchants.json")));
  foreach(var row in source.RootElement.GetProperty("butchers").EnumerateArray()){
   var file=row.GetProperty("file").GetString()!;var npc=envir.NPCInfoList.FirstOrDefault(n=>n.FileName==file);
   if(npc==null){npc=new NPCInfo{Index=++envir.NPCIndex,FileName=file};envir.NPCInfoList.Add(npc);}
   npc.Name=row.GetProperty("name").GetString()!;npc.Image=row.GetProperty("image").GetUInt16();npc.MapIndex=map.Index;npc.Location=new Point(row.GetProperty("x").GetInt32(),row.GetProperty("y").GetInt32());npc.Rate=100;npc.Colour=Color.Lime;
   File.WriteAllText(Path.Combine(Settings.NPCPath,file+".txt"),"[@MAIN]\n#SAY\n我这里收购新鲜的肉。\\\n<卖肉/@SELL>\\\n<离开/@EXIT>\n\n[@SELL]\n#SAY\n请选择背包中的肉。\n\n[TYPES]\n"+(int)ItemType.Meat+"\n");
  }
 }
}
