using System.Drawing;
using System.Text.Json;
using Mir2.WebHost;
using Server;
using Server.MirDatabase;
using Server.MirEnvir;
using Server.MirObjects;

static class WarehouseSeed
{
    static int newCharacterCapacity;
    static string merchantFile = "";
    public static void Apply(Envir envir, string root)
    {
        using var doc=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,"server/content/warehouse.json")));
        int capacity=doc.RootElement.GetProperty("newCharacterCapacity").GetInt32();
        if(capacity<1||capacity>4096)throw new InvalidDataException("Invalid warehouse capacity");
        var row=doc.RootElement.GetProperty("npc");var file=row.GetProperty("file").GetString()!;
        if(file!="BoundaryWarehouse")throw new InvalidDataException("Unknown sourced warehouse merchant");
        var map=envir.MapInfoList.Single(m=>m.FileName==row.GetProperty("map").GetString());
        var npc=envir.NPCInfoList.SingleOrDefault(n=>n.FileName==file);
        if(npc==null){npc=new NPCInfo{Index=++envir.NPCIndex,FileName=file};envir.NPCInfoList.Add(npc);}
        npc.Name=row.GetProperty("name").GetString()!;npc.MapIndex=map.Index;
        npc.Location=new Point(row.GetProperty("x").GetInt32(),row.GetProperty("y").GetInt32());
        npc.Image=row.GetProperty("image").GetUInt16();npc.Colour=Color.Lime;npc.Rate=100;
        // Both views operate on the same storage permission page. View choice is presentation only.
        File.WriteAllText(Path.Combine(Settings.NPCPath,file+".txt"),"[@MAIN]\n#SAY\n需要保管物品吗？\\\n<存入物品/@STORAGE>\\\n<取回物品/@STORAGE>\\\n<关闭/@EXIT>\n\n[@STORAGE]\n#SAY\n请选择物品。\n");
        newCharacterCapacity=capacity;merchantFile=file;
    }

    public static void Open(PlayerObject player,uint npcId)
    {
        var storage=StorageTransfers.ValidateAccess(player,npcId,false);
        if(storage.Length!=0)return; // Persisted capacity is never implicitly resized.
        var npc=player.CurrentMap.NPCs.Single(n=>n.ObjectID==npcId);
        if(npc.Info.FileName!=merchantFile||newCharacterCapacity==0)
            throw new InvalidOperationException("请与保管员交谈。");
        // First successful transfer persists capacity with its item; merely opening has no item mutation.
        CharacterStorage.Initialize(player.Info,newCharacterCapacity);
    }
}
