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
  // Pinned MerChant.txt line 53: this outdoor smith is distinct from the demo guide.
  var smith=envir.NPCInfoList.FirstOrDefault(n=>n.FileName=="BoundarySmith");
  if(smith==null){smith=new NPCInfo{Index=++envir.NPCIndex,FileName="BoundarySmith"};envir.NPCInfoList.Add(smith);}
  smith.Name="边界村铁匠铺";smith.MapIndex=map.Index;smith.Location=new Point(297,612);smith.Image=0;smith.Rate=100;smith.Colour=Color.Lime;
  ApplyEquipmentShops(envir,root,map);
 }
 static void ApplyEquipmentShops(Envir envir,string root,MapInfo map){
  using var document=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,"server/content/equipment-shops.json")));
  var source=document.RootElement;
  foreach(var row in source.GetProperty("items").EnumerateArray()){
   string name=row.GetProperty("Name").GetString()!;int mode=row.GetProperty("Stdmode").GetInt32();
   var item=envir.ItemInfoList.FirstOrDefault(i=>i.Name==name);
   if(item==null){item=new ItemInfo{Index=++envir.ItemIndex,Name=name};envir.ItemInfoList.Add(item);}
   item.Type=mode is 5 or 6?ItemType.Weapon:mode==15?ItemType.Helmet:ItemType.Armour;
   item.Shape=row.GetProperty("Shape").GetInt16();item.Image=row.GetProperty("Looks").GetUInt16();
   item.Weight=row.GetProperty("Weight").GetByte();item.Durability=row.GetProperty("DuraMax").GetUInt16();
   item.Price=row.GetProperty("Price").GetUInt32();item.StackSize=1;item.StartItem=false;
   item.RequiredType=RequiredType.Level;item.RequiredAmount=row.GetProperty("NeedLevel").GetByte();item.RequiredClass=RequiredClass.None;
   item.RequiredGender=mode==10?RequiredGender.Male:mode==11?RequiredGender.Female:RequiredGender.None;
   item.Stats=new Stats();
   foreach(var field in new[]{("Ac",Stat.MinAC),("Ac2",Stat.MaxAC),("Mac",Stat.MinMAC),("Mac2",Stat.MaxMAC),("Dc",Stat.MinDC),("Dc2",Stat.MaxDC),("Mc",Stat.MinMC),("Mc2",Stat.MaxMC),("Sc",Stat.MinSC),("Sc2",Stat.MaxSC)})item.Stats[field.Item2]=row.GetProperty(field.Item1).GetInt32();
  }
  var tailor=envir.NPCInfoList.FirstOrDefault(n=>n.FileName=="BoundaryTailor");
  if(tailor==null){tailor=new NPCInfo{Index=++envir.NPCIndex,FileName="BoundaryTailor"};envir.NPCInfoList.Add(tailor);}
  tailor.Name="白家服装老板";tailor.MapIndex=map.Index;tailor.Location=new Point(305,607);tailor.Image=7;tailor.Rate=100;tailor.Colour=Color.Lime;
  // Each pinned merchant script calls the same stock file as its boundary counterpart.
  foreach(var spec in new[]{(File:"BichonCitySmith",Name:"比奇铁匠铺老板",X:302,Y:219,Image:0),(File:"GinkgoSmith",Name:"精武馆老板",X:649,Y:602,Image:0),(File:"GinkgoTailor",Name:"高家店老板",X:643,Y:601,Image:7)}){
   var npc=envir.NPCInfoList.FirstOrDefault(n=>n.FileName==spec.File);
   if(npc==null){npc=new NPCInfo{Index=++envir.NPCIndex,FileName=spec.File};envir.NPCInfoList.Add(npc);}
   npc.Name=spec.Name;npc.MapIndex=map.Index;npc.Location=new Point(spec.X,spec.Y);npc.Image=(ushort)spec.Image;npc.Rate=100;npc.Colour=Color.Lime;
  }
  foreach(var shop in new[]{(File:"BoundarySmith",Stock:"weapons",Name:"武器",Types:new[]{ItemType.Weapon}),(File:"BichonCitySmith",Stock:"weapons",Name:"武器",Types:new[]{ItemType.Weapon}),(File:"GinkgoSmith",Stock:"weapons",Name:"武器",Types:new[]{ItemType.Weapon}),(File:"BoundaryTailor",Stock:"clothes",Name:"衣服",Types:new[]{ItemType.Armour,ItemType.Helmet}),(File:"GinkgoTailor",Stock:"clothes",Name:"衣服",Types:new[]{ItemType.Armour,ItemType.Helmet})}){
   var goods=string.Join("\n",source.GetProperty(shop.Stock).EnumerateArray().Select(v=>v.GetString()+" 1"));
   var types=string.Join("\n",shop.Types.Select(v=>(int)v));
   File.WriteAllText(Path.Combine(Settings.NPCPath,shop.File+".txt"),"[@MAIN]\n#SAY\n欢迎光临，你需要点什么？\\\n<购买"+shop.Name+"/@BUY>\\\n<出售"+shop.Name+"/@SELL>\\\n<修理装备/@REPAIR>\\\n<特殊修理/@SREPAIR>\\\n<关闭/@EXIT>\n\n[@BUY]\n#SAY\n请选择物品。\n\n[@SELL]\n#SAY\n请选择要出售的物品。\n\n[@REPAIR]\n#SAY\n请选择需要修理的装备。\n\n[@SREPAIR]\n#SAY\n请选择需要特殊修理的装备。\n\n[TYPES]\n"+types+"\n\n[TRADE]\n"+goods+"\n");
  }
 }
}
