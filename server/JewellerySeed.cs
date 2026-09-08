using System.Drawing;
using System.Text.Json;
using Server;
using Server.MirDatabase;
using Server.MirEnvir;

// Whitelist only: never import an entire private-server database or its Bind flags.
static class JewellerySeed
{
    public static void Apply(Envir envir, string root, MapInfo map)
    {
        using var source=JsonDocument.Parse(ContentProfiles.Read(root,"jewellery"));
        foreach(var row in source.RootElement.GetProperty("items").EnumerateArray()) {
            var name=row.GetProperty("name").GetString()!;
            var item=envir.ItemInfoList.FirstOrDefault(i=>i.Name==name);
            if(item==null){item=new ItemInfo{Index=++envir.ItemIndex,Name=name};envir.ItemInfoList.Add(item);}
            item.Type=Enum.Parse<ItemType>(row.GetProperty("type").GetString()!);
            item.Image=row.GetProperty("image").GetUInt16();item.Shape=0;
            item.Weight=row.GetProperty("weight").GetByte();item.Durability=row.GetProperty("durability").GetUInt16();
            item.RequiredType=RequiredType.Level;item.RequiredAmount=row.GetProperty("level").GetByte();
            item.Price=row.GetProperty("price").GetUInt32();item.StackSize=1;item.StartItem=false;
            item.Stats=new Stats();
            foreach(var stat in row.GetProperty("stats").EnumerateObject())item.Stats[Enum.Parse<Stat>(stat.Name)]=stat.Value.GetInt32();
        }
        foreach(var row in source.RootElement.GetProperty("merchants").EnumerateArray()) {
            var file=row.GetProperty("file").GetString()!;
            var npc=envir.NPCInfoList.FirstOrDefault(n=>n.FileName==file);
            if(npc==null){npc=new NPCInfo{Index=++envir.NPCIndex,FileName=file};envir.NPCInfoList.Add(npc);}
            npc.Name=row.GetProperty("name").GetString()!;npc.Image=row.GetProperty("image").GetUInt16();
            npc.MapIndex=map.Index;npc.Location=new Point(row.GetProperty("x").GetInt32(),row.GetProperty("y").GetInt32());
            npc.Colour=Color.Lime;npc.Rate=100;
            var goods=string.Join("\n",row.GetProperty("goods").EnumerateArray().Select(n=>n.GetString()+" 1"));
            File.WriteAllText(Path.Combine(Settings.NPCPath,file+".txt"),"[@MAIN]\n#SAY\n欢迎，我可以帮你什么吗？\\\n<购买/@BUY>\\\n<关闭/@EXIT>\n\n[@BUY]\n#SAY\n请选择物品。\n\n[TRADE]\n"+goods+"\n");
        }
    }
}
