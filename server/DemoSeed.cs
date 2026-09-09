using System.Drawing;
using Server;
using Server.MirDatabase;
using Server.MirEnvir;

// Local content migration only. Combat, inventory and NPC behavior stay in upstream Crystal.
static class DemoSeed
{
    const string Revision = "bichon-harvest-bonus-v7";
    public static void Apply(Envir envir, string dataDir, string root)
    {
        var backup = Path.Combine(dataDir,"demo-backups",DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff"));
        Directory.CreateDirectory(backup);
        if(!OperatingSystem.IsWindows())File.SetUnixFileMode(backup,UnixFileMode.UserRead|UnixFileMode.UserWrite|UnixFileMode.UserExecute);
        foreach(var file in Directory.GetFiles(dataDir)) File.Copy(file,Path.Combine(backup,Path.GetFileName(file)));
        using(var profile=System.Text.Json.JsonDocument.Parse(ContentProfiles.Read(root,"experience"))) {
            int level=0;foreach(var entry in profile.RootElement.GetProperty("requiredExperience").EnumerateArray()){
                long value=entry.GetInt64();if(value<=0)throw new InvalidDataException("Experience requirement must be positive");
                if(level<Settings.ExperienceList.Count)Settings.ExperienceList[level]=value;level++;
            }
        }
        envir.LoadDB();
        var map=envir.MapInfoList.Single(m=>m.FileName=="0");
        map.Title="比奇省";
        // Door coordinates only: pinned candidate MapInfo.txt lines 85-92.
        // Its unrelated FIGHT flag and economy are deliberately not imported.
        var jewellery=envir.MapInfoList.FirstOrDefault(m=>m.FileName=="0105");
        if(jewellery==null){jewellery=new MapInfo{Index=++envir.MapIndex,FileName="0105",Title="首饰店",Light=LightSetting.Normal};envir.MapInfoList.Add(jewellery);}
        void Door(MapInfo from,int x,int y,MapInfo to,int tx,int ty){
            var point=new Point(x,y);var entry=from.Movements.FirstOrDefault(m=>m.Source==point);
            if(entry==null){entry=new MovementInfo{Source=point};from.Movements.Add(entry);}
            entry.MapIndex=to.Index;entry.Destination=new Point(tx,ty);entry.NeedHole=false;entry.NeedMove=false;
        }
        Door(map,295,284,jewellery,8,24);Door(map,295,285,jewellery,9,23);
        Door(jewellery,9,25,map,295,286);Door(jewellery,9,24,map,296,285);
        Door(map,305,275,jewellery,20,12);Door(map,305,276,jewellery,21,11);
        Door(jewellery,21,12,map,306,276);Door(jewellery,21,13,map,306,277);
        JewellerySeed.Apply(envir,root,jewellery);
        // Pinned MapInfo.txt 200-203: boundary village jewellery room, both doors.
        var boundary=envir.MapInfoList.FirstOrDefault(m=>m.FileName=="0141");
        if(boundary==null){boundary=new MapInfo{Index=++envir.MapIndex,FileName="0141",Title="边界村首饰店",Light=LightSetting.Normal};envir.MapInfoList.Add(boundary);}
        Door(map,302,622,boundary,2,11);Door(map,311,631,boundary,17,26);
        Door(boundary,2,12,map,302,623);Door(boundary,17,27,map,311,632);
        JewellerySeed.Apply(envir,root,boundary);

        foreach(var zone in map.SafeZones.Where(z=>z.StartPoint))zone.Size=2;
        ItemInfo AddItem(string name,ItemType type,short shape,ushort image) {
            var item=envir.ItemInfoList.FirstOrDefault(i=>i.Name==name);
            if(item!=null){item.Image=image;return item;}
            item=new ItemInfo {Index=++envir.ItemIndex,Name=name,Type=type,Shape=shape,Image=image,Durability=10000,Price=25,Weight=1,StartItem=true};
            envir.ItemInfoList.Add(item);return item;
        }
        var weapon=AddItem("BichonSword",ItemType.Weapon,1,30);
        // Historical Chinese item tables agree on these fields. Keep the demo prices
        // and durability separate until an authenticated 1.76 item database is obtained.
        weapon.Stats=new Stats {[Stat.MinDC]=2,[Stat.MaxDC]=5};
        weapon.Weight=7;weapon.RequiredAmount=1;
        var armour=AddItem("BichonRobe",ItemType.Armour,1,60);
        ApplyStarterArmourStats(armour);
        armour.Weight=5;armour.RequiredAmount=1;
        // Small potion image identities checked against old item guide pictures.
        foreach(var spec in new[]{(Name:"BichonHealthSmall",Image:(ushort)9,HP:20,MP:0),(Name:"BichonManaSmall",Image:(ushort)11,HP:0,MP:30)}) {
            var potion=AddItem(spec.Name,ItemType.Potion,0,spec.Image);
            potion.Type=ItemType.Potion;potion.Shape=0;potion.Durability=0;
            potion.Price=88;potion.Weight=1;potion.StackSize=1;potion.StartItem=false;potion.RequiredAmount=0;
            potion.Stats=new Stats {[Stat.HP]=spec.HP,[Stat.MP]=spec.MP};
        }
        if(!envir.MagicInfoList.Any(m=>m.Spell==Spell.FireBall)) envir.MagicInfoList.Add(new MagicInfo {Name="FireBall",Spell=Spell.FireBall,BaseCost=1,Level1=1,Level2=2,Level3=3,Need1=100,Need2=100,Need3=100,PowerBase=12,PowerBonus=2,MPowerBase=12,MPowerBonus=2,Range=9});
        BookshopSeed.Apply(envir,root,map);
        WildlifeSeed.Apply(envir,root,map);
        MerchantSeed.Apply(envir,root,map);
        var guide=envir.NPCInfoList.FirstOrDefault(n=>n.FileName=="BichonGuide");
        if(guide==null) { guide=new NPCInfo {Index=++envir.NPCIndex,FileName="BichonGuide",Name="比奇向导",Image=0,Colour=Color.White,Rate=100};envir.NPCInfoList.Add(guide); }
        guide.MapIndex=map.Index;
        guide.Location=new Point(290,610);
        File.WriteAllText(Path.Combine(Settings.NPCPath,"BichonGuide.txt"),"[@MAIN]\n#SAY\n欢迎来到比奇省。城外有鹿和稻草人。\\\n<购买装备和药剂/@BUY>  <再见/@EXIT>\n\n[@BUY]\n#SAY\n请选择装备或药剂。\n\n[TRADE]\nBichonSword 1\nBichonRobe 1\nBichonHealthSmall 1\nBichonManaSmall 1\n");
        envir.SaveDB();
        // Persisted characters can contain Rested and other buffs. Match upstream
        // StartEnvir initialization order before deserializing those accounts.
        envir.BuffInfoList.Clear();
        envir.BuffInfoList.AddRange(BuffInfo.Load());
        envir.LoadAccounts();
        foreach(var character in envir.CharacterList.Where(c=>c.Name.StartsWith("WebGuest"))) Character(character);
        envir.SaveAccounts();
        File.WriteAllText(Path.Combine(dataDir,"demo-seed.json"),System.Text.Json.JsonSerializer.Serialize(new {revision=Revision,backup,at=DateTime.UtcNow}));
    }
    // Both pinned Chinese StdItems tables: cloth AC 0..2, MAC 0..1.
    public static void ApplyStarterArmourStats(ItemInfo armour) =>
        armour.Stats=new Stats {[Stat.MinAC]=0,[Stat.MaxAC]=2,[Stat.MinMAC]=0,[Stat.MaxMAC]=1};
    public static void Character(CharacterInfo character)
    {
        var envir=Envir.Main;
        var marker=Path.Combine("demo-character-"+character.Index+"-v1");
        // Idempotently move old gear out of the six potion slots, retaining item IDs.
        for(int i=0;i<6;i++){
            var item=character.Inventory[i];if(item==null)continue;
            var info=envir.ItemInfoList.FirstOrDefault(v=>v.Index==item.ItemIndex);
            if(info?.Type==ItemType.Potion)continue;
            int to=Array.FindIndex(character.Inventory,6,v=>v==null);
            if(to<0)continue;character.Inventory[to]=item;character.Inventory[i]=null;
        }
        // Revoke only the old demo grant for Warrior guests without a FireRing.
        if(character.Class==MirClass.Warrior&&!character.Equipment.Any(v=>v?.Info?.Unique.HasFlag(SpecialItemMode.Flame)==true))
            character.Magics.RemoveAll(m=>m.Spell==Spell.FireBall);
        if(File.Exists(marker))return;
        foreach(var info in envir.ItemInfoList.Where(i=>i.Name is "BichonSword" or "BichonRobe")) {
            if(character.Inventory.Concat(character.Equipment).Any(i=>i?.ItemIndex==info.Index))continue;
            var slot=Array.FindIndex(character.Inventory,6,i=>i==null);
            if(slot>=0)character.Inventory[slot]=envir.CreateFreshItem(info);
        }
        var account=envir.AccountList.First(a=>a.Characters.Contains(character));
        account.Gold+=200;
        File.WriteAllText(marker,Revision);
    }
    public static object Items(UserItem[] items)=>items.Select((i,slot)=>i==null?null:new {slot,UniqueID=i.UniqueID.ToString(),ItemIndex=i.ItemIndex,Count=i.Count,CurrentDura=i.CurrentDura,MaxDura=i.MaxDura,AddedStats=new {Values=i.AddedStats.Values.ToDictionary(v=>v.Key.ToString(),v=>v.Value)},Info=Info(i.ItemIndex)}).ToArray();
    static object? Info(int index) {var i=Envir.Main.ItemInfoList.FirstOrDefault(x=>x.Index==index);return i==null?null:new {Index=i.Index,Name=i.Name,Type=(int)i.Type,Shape=i.Shape,Image=i.Image,Price=i.Price,StackSize=i.StackSize,Durability=i.Durability,HP=i.Stats[Stat.HP],MP=i.Stats[Stat.MP],Weight=i.Weight,RequiredClass=(int)i.RequiredClass,RequiredGender=(int)i.RequiredGender,RequiredType=(int)i.RequiredType,RequiredAmount=i.RequiredAmount,Stats=new {Values=i.Stats.Values.ToDictionary(v=>v.Key.ToString(),v=>v.Value)},Combat=new {MinDC=i.Stats[Stat.MinDC],MaxDC=i.Stats[Stat.MaxDC],MinMC=i.Stats[Stat.MinMC],MaxMC=i.Stats[Stat.MaxMC],MinAC=i.Stats[Stat.MinAC],MaxAC=i.Stats[Stat.MaxAC],MinMAC=i.Stats[Stat.MinMAC],MaxMAC=i.Stats[Stat.MaxMAC]}};}
    public static object Manifest(Envir envir)=>new {revision=Revision,spell=31,npc=new{x=290,y=610,image=0},items=envir.ItemInfoList.Where(i=>i.Name.StartsWith("Bichon")).Select(i=>Info(i.Index))};
}
