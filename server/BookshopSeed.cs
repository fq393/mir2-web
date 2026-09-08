using System.Drawing;
using System.Text.Json;
using Server;
using Server.MirDatabase;
using Server.MirEnvir;
// Legacy StdMode4 DuraMax is the learning level, not equipment durability.
// Legacy Shape and Crystal Spell are different namespaces; map by skill name.
static class BookshopSeed {
 public static void Apply(Envir envir,string root,MapInfo map){
  using var document=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,"server/content/bookshop.json")));
  var source=document.RootElement;
  foreach(var row in source.GetProperty("items").EnumerateArray()){
   var name=row.GetProperty("name").GetString()!;var spell=Enum.Parse<Spell>(row.GetProperty("spell").GetString()!);
   if(!envir.MagicInfoList.Any(m=>m.Spell==spell))throw new InvalidDataException("技能定义缺失："+name);
   var item=envir.ItemInfoList.FirstOrDefault(i=>i.Name==name);
   if(item==null){item=new ItemInfo{Index=++envir.ItemIndex,Name=name};envir.ItemInfoList.Add(item);}
   item.Type=ItemType.Book;item.Shape=(short)spell;item.Image=row.GetProperty("image").GetUInt16();
   item.RequiredClass=Enum.Parse<RequiredClass>(row.GetProperty("requiredClass").GetString()!);
   item.RequiredType=RequiredType.Level;item.RequiredAmount=row.GetProperty("level").GetByte();
   item.Weight=row.GetProperty("weight").GetByte();item.Price=row.GetProperty("price").GetUInt32();
   item.Durability=0;item.StackSize=1;item.StartItem=false;item.Stats=new Stats();
  }
  var merchant=source.GetProperty("merchant");var file=merchant.GetProperty("file").GetString()!;
  var npc=envir.NPCInfoList.FirstOrDefault(n=>n.FileName==file);
  if(npc==null){npc=new NPCInfo{Index=++envir.NPCIndex,FileName=file};envir.NPCInfoList.Add(npc);}
  npc.Name=merchant.GetProperty("name").GetString()!;npc.Image=merchant.GetProperty("image").GetUInt16();npc.MapIndex=map.Index;
  npc.Location=new Point(merchant.GetProperty("x").GetInt32(),merchant.GetProperty("y").GetInt32());npc.Rate=100;npc.Colour=Color.Lime;
  var goods=string.Join("\n",source.GetProperty("items").EnumerateArray().Select(r=>r.GetProperty("name").GetString()+" 1"));
  File.WriteAllText(Path.Combine(Settings.NPCPath,file+".txt"),"[@MAIN]\n#SAY\n欢迎，你想买些修炼的书吗？\\\n<购买书籍/@BUY>\\\n<出售书籍/@SELL>\\\n<关闭/@EXIT>\n\n[@BUY]\n#SAY\n请选择修炼的书籍。\n\n[@SELL]\n#SAY\n请选择背包中的技能书。\n\n[TYPES]\n"+(int)ItemType.Book+"\n\n[TRADE]\n"+goods+"\n");
 }
}
