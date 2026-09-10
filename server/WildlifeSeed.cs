using System.Drawing;
using System.Text.Json;
using Server;
using Server.MirDatabase;
using Server.MirEnvir;

// Candidate content, pinned sources in the profile. Engine owns RNG and timers.
static class WildlifeSeed
{
    // StdMode 22 candidate defaults: M2Share.pas 2953-2961 and ItmUnit.RandomUpgrade22.
    // Crystal performs MaxStat-1 Bernoulli trials, followed by +1.
    static readonly RandomItemStat Ring22 = new() {
        MaxDcChance=30,MaxDcStatChance=20,MaxDcMaxStat=7,
        MaxMcChance=30,MaxMcStatChance=20,MaxMcMaxStat=7,
        MaxScChance=30,MaxScStatChance=20,MaxScMaxStat=7
    };
    public static void Apply(Envir envir,string root,MapInfo map)
    {
        using var file=JsonDocument.Parse(ContentProfiles.Read(root,"bichon-wildlife"));
        var profile=file.RootElement;var monsters=new Dictionary<string,MonsterInfo>();
        var bonusIndex=Settings.RandomItemStatsList.IndexOf(Ring22);
        if(bonusIndex<0){bonusIndex=Settings.RandomItemStatsList.Count;if(bonusIndex>=255)throw new InvalidDataException("No random-stat profile slot");Settings.RandomItemStatsList.Add(Ring22);}
        foreach(var ring in envir.ItemInfoList.Where(i=>i.Name is "牛角戒指" or "玻璃戒指" or "六角戒指")){
            ring.RandomStatsId=(byte)bonusIndex;ring.RandomStats=Ring22;
        }

        // Reconstructed meat identity; probability token preserved from pinned deer file.
        var meat=envir.ItemInfoList.FirstOrDefault(i=>i.Name=="肉");
        if(meat==null){meat=new ItemInfo{Index=++envir.ItemIndex,Name="肉"};envir.ItemInfoList.Add(meat);}
        meat.Type=ItemType.Meat;meat.Image=1;meat.Weight=3;meat.Durability=10000;meat.Price=200;meat.StackSize=1;meat.RequiredAmount=0;meat.StartItem=false;
        var chickenMeat=envir.ItemInfoList.FirstOrDefault(i=>i.Name=="鸡肉");
        if(chickenMeat==null){chickenMeat=new ItemInfo{Index=++envir.ItemIndex,Name="鸡肉"};envir.ItemInfoList.Add(chickenMeat);}
        chickenMeat.Type=ItemType.Meat;chickenMeat.Image=13;chickenMeat.Weight=1;chickenMeat.Durability=4000;chickenMeat.Price=80;chickenMeat.StackSize=1;chickenMeat.RequiredAmount=0;chickenMeat.StartItem=false;
        foreach(var row in profile.GetProperty("monsters").EnumerateArray()){
            string key=row.GetProperty("key").GetString()!;
            var m=envir.MonsterInfoList.FirstOrDefault(m=>m.Name==key);
            if(m==null){m=new MonsterInfo{Index=++envir.MonsterIndex,Name=key};envir.MonsterInfoList.Add(m);}
            m.Image=Enum.Parse<Monster>(row.GetProperty("image").GetString()!);m.AI=row.GetProperty("ai").GetByte();
            m.Level=row.GetProperty("level").GetUInt16();m.Experience=row.GetProperty("experience").GetUInt32();m.Undead=row.GetProperty("undead").GetBoolean();
            m.MoveSpeed=row.GetProperty("moveMs").GetUInt16();m.AttackSpeed=row.GetProperty("attackMs").GetUInt16();
            m.Stats=new Stats{[Stat.HP]=row.GetProperty("hp").GetInt32(),[Stat.MinDC]=row.GetProperty("minDC").GetInt32(),[Stat.MaxDC]=row.GetProperty("maxDC").GetInt32(),[Stat.Accuracy]=row.GetProperty("accuracy").GetInt32(),[Stat.Agility]=row.GetProperty("agility").GetInt32()};
            monsters.Add(row.GetProperty("name").GetString()!,m);
            var lines=profile.GetProperty("drops").TryGetProperty(key,out var drops)?drops.EnumerateArray().Select(v=>v.GetString()!).ToArray():Array.Empty<string>();
            foreach(var line in lines)if(DropInfo.FromLine(line)==null)throw new InvalidDataException("Unresolved wildlife drop: "+line);
            Directory.CreateDirectory(Settings.DropPath);File.WriteAllLines(Path.Combine(Settings.DropPath,key+".txt"),lines);m.DropPath=key;
        }
        // Reconcile only managed species. Retain other map spawns and stable indices.
        var managed=monsters.Values.Select(m=>m.Index).ToHashSet();var old=map.Respawns.Where(r=>managed.Contains(r.MonsterIndex)).ToList();
        map.Respawns.RemoveAll(r=>managed.Contains(r.MonsterIndex));
        foreach(var row in profile.GetProperty("respawns").EnumerateArray()){
            var m=monsters[row.GetProperty("name").GetString()!];var at=new Point(row.GetProperty("x").GetInt32(),row.GetProperty("y").GetInt32());
            var count=row.GetProperty("count").GetUInt16();var spread=row.GetProperty("spread").GetUInt16();var delay=row.GetProperty("minutes").GetUInt16();
            if(count==0||delay==0)throw new InvalidDataException("Invalid wildlife respawn");
            var prior=old.FirstOrDefault(r=>r.MonsterIndex==m.Index&&r.Location==at&&r.Count==count&&r.Spread==spread&&r.Delay==delay);
            if(prior!=null)old.Remove(prior);
            map.Respawns.Add(prior??new RespawnInfo{RespawnIndex=++envir.RespawnIndex,MonsterIndex=m.Index,Location=at,Count=count,Spread=spread,Delay=delay});
        }
    }
}
