using System.Drawing;
using System.Text.Json;
using Mir2.WebHost;
using Server;
using Server.MirDatabase;
using Server.MirEnvir;

// Synthetic two-slot storage, not original map/NPC/capacity acceptance.
static class StorageProtocolFixture
{
    public static void Seed(Envir envir, string root)
    {
        if (!File.Exists(Path.Combine(root,"STORAGE_PROTOCOL_QA_ONLY"))) throw new InvalidOperationException("Isolated QA marker missing");
        foreach (var map in envir.MapInfoList) map.Respawns.Clear();
        var npc=envir.NPCInfoList.Single(n=>n.FileName=="BichonJewellery4");
        File.WriteAllText(Path.Combine(Settings.NPCPath,npc.FileName+".txt"),"[@MAIN]\n#SAY\n仓库协议测试\n<保管/@STORAGE>\n\n[@STORAGE]\n#SAY\n请选择物品。\n");
        envir.SaveDB();
        using var json=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,"credentials.json")));
        var id=json.RootElement.GetProperty("account").GetString()!;
        if(envir.AccountList.Any(a=>a.AccountID==id)) return;
        var account=new AccountInfo{Index=++envir.NextAccountID,AccountID=id,Password=json.RootElement.GetProperty("password").GetString()!,CreationDate=DateTime.Now};
        foreach(var name in new[]{"仓库协议甲","仓库协议乙"})
        {
            var role=new CharacterInfo{Index=++envir.NextCharacterID,Name=name,AccountInfo=account,Class=MirClass.Warrior,Gender=MirGender.Male,Level=1,HP=18,MP=14,
                CurrentMapIndex=npc.MapIndex,CurrentLocation=new Point(npc.Location.X+1,npc.Location.Y),BindMapIndex=npc.MapIndex,BindLocation=new Point(npc.Location.X+1,npc.Location.Y),CreationIP="127.0.0.1",CreationDate=DateTime.Now};
            role.Heroes=new HeroInfo[role.MaximumHeroCount];
            var item=envir.CreateFreshItem(envir.ItemInfoList.Single(i=>i.Name=="牛角戒指"));
            item.AddedStats[Stat.MaxDC]=3;item.CurrentDura=1234;role.Inventory[6]=item;
            CharacterStorage.Initialize(role,2);account.Characters.Add(role);envir.CharacterList.Add(role);
        }
        envir.AccountList.Add(account);envir.SaveAccounts();
    }
}
