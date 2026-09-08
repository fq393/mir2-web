using System.Net;
using System.Net.Sockets;
using Server;
using Server.MirDatabase;
using Server.MirEnvir;
using Server.MirNetwork;
using Server.MirObjects;

var root=Path.GetFullPath(args[0]);
var sandbox=Path.Combine(Path.GetTempPath(),"mir2-content-test-"+Guid.NewGuid());
Directory.CreateDirectory(sandbox);Directory.SetCurrentDirectory(sandbox);
try {
    ProfileTests.Run(root);
    Settings.Load();ChineseText.Apply();Packet.IsServer=true;
    var envir=Envir.Main;
    JewellerySeed.Apply(envir,root,new MapInfo{Index=1,FileName="0105"});
    // A real connection on an ephemeral loopback port is enough for upstream's
    // item-definition queue. No live accounts, maps, fixed ports or save files.
    var listener=new TcpListener(IPAddress.Loopback,0);listener.Start();
    using var client=new TcpClient();client.Connect((IPEndPoint)listener.LocalEndpoint);
    using var accepted=listener.AcceptTcpClient();listener.Stop();
    var connection=new MirConnection(1,accepted);
    int checkedGoods=0;
    foreach(var npc in envir.NPCInfoList) {
        var script=NPCScript.GetOrAdd(0,npc.FileName,NPCScriptType.Normal);
        foreach(var goods in script.Goods) {
            var player=new RecordingPlayer {Stats=new Stats(),Info=new CharacterInfo(),Account=new AccountInfo(),Connection=connection,NPCPage=new NPCPage(NPCScript.BuyKey)};
            var price=goods.Price();Check(price==goods.Info.Price,"unexpected new item price");
            player.Account.Gold=price-1;script.Buy(player,goods.UniqueID,1);
            Check(player.Account.Gold==price-1&&player.Info.Inventory.All(i=>i==null),"insufficient gold mutated account");
            player.Account.Gold=price;script.Buy(player,ulong.MaxValue,1);
            Check(player.Account.Gold==price&&player.Info.Inventory.All(i=>i==null),"unknown stock mutated account");
            script.Buy(player,goods.UniqueID,1);
            Check(player.Account.Gold==0,"purchase did not deduct exact price");
            Check(player.Info.Inventory[6]?.Info==goods.Info&&player.Info.Inventory.Take(6).All(i=>i==null),"jewellery did not enter first bag slot");
            Check(player.Info.Inventory[6].CurrentDura==goods.Info.Durability,"fresh item durability differs");
            Check(player.Packets.OfType<ServerPackets.LoseGold>().Single().Gold==price&&player.Packets.OfType<ServerPackets.GainedItem>().Count()==1,"authoritative purchase replies differ");
            var bought=player.Info.Inventory[6];
            int slot=goods.Info.Type==ItemType.Ring?8:goods.Info.Type==ItemType.Bracelet?6:4;
            player.Stats[Stat.WearWeight]=50; // Test fixture capacity, never a game rule.
            player.Info.Level=(ushort)(goods.Info.RequiredAmount-1);
            Check(!player.CanEquipItem(bought,slot),"under-level jewellery allowed");
            player.Info.Level=goods.Info.RequiredAmount;
            Check(player.CanEquipItem(bought,slot)&&!player.CanEquipItem(bought,0),"valid jewellery slot/level mismatch");
            player.Account.Gold=price;
            for(int i=0;i<player.Info.Inventory.Length;i++)player.Info.Inventory[i]=envir.CreateFreshItem(goods.Info);
            script.Buy(player,goods.UniqueID,1);Check(player.Account.Gold==price,"full bag charged gold");
            checkedGoods++;
        }
    }
    // Learning uses the real engine, with synthetic content only in this temporary DB.
    // The fixture threshold is a test boundary, not a shipped 1.76 training profile.
    envir.MagicInfoList.Add(new MagicInfo {Spell=Spell.Fencing,Name="基本剑术",Level1=7,Level2=11,Level3=16,Need1=1,Need2=2,Need3=3});
    var bookInfo=new ItemInfo {Index=++envir.ItemIndex,Name="基本剑术",Type=ItemType.Book,Shape=(short)Spell.Fencing,RequiredClass=RequiredClass.Warrior,RequiredType=RequiredType.Level,RequiredAmount=7,StackSize=1};
    envir.ItemInfoList.Add(bookInfo);
    var learner=new RecordingPlayer {Stats=new Stats(),Info=new CharacterInfo {Level=6,Class=MirClass.Warrior},Account=new AccountInfo(),Connection=connection};
    learner.Info.Mount=new MountInfo(learner);learner.Report=new Reporting(learner);
    var book=envir.CreateFreshItem(bookInfo);learner.Info.Inventory[6]=book;
    learner.UseItem(book.UniqueID);Check(learner.Info.Inventory[6]==book&&learner.Info.Magics.Count==0,"under-level book consumed or learned");
    learner.Info.Level=7;learner.Info.Class=MirClass.Wizard;
    learner.UseItem(book.UniqueID);Check(learner.Info.Inventory[6]==book&&learner.Info.Magics.Count==0,"wrong-class book consumed or learned");
    learner.Info.Class=MirClass.Warrior;learner.UseItem(book.UniqueID);
    Check(learner.Info.Inventory[6]==null&&learner.Info.Magics.Single().Spell==Spell.Fencing,"valid learning did not consume exactly one book and add skill");
    Check(learner.Packets.OfType<ServerPackets.NewMagic>().Count()==1&&learner.Packets.OfType<ServerPackets.UseItem>().Count(p=>p.Success)==1,"learning authoritative replies missing or duplicated");
    var duplicate=envir.CreateFreshItem(bookInfo);learner.Info.Inventory[6]=duplicate;learner.UseItem(duplicate.UniqueID);
    Check(learner.Info.Inventory[6]==duplicate&&learner.Info.Magics.Count==1,"duplicate book consumed or skill duplicated");
    learner.UseItem(ulong.MaxValue);Check(learner.Info.Inventory[6]==duplicate,"unknown book ID mutated inventory");
    Console.WriteLine("PASS real Crystal skill-book transaction: level/class gates, learning, consumption, NewMagic acknowledgement, duplicate and unknown item protection.");
    var trained=learner.Info.Magics.Single();learner.Stats[Stat.SkillGainMultiplier]=1;
    learner.LevelMagic(trained);Check(trained.Level==1,"initial skill did not train to level 1");
    var held=trained.Experience;learner.LevelMagic(trained);Check(trained.Level==1&&trained.Experience==held,"skill trained below next character-level gate");
    learner.Info.Level=11;trained.Experience=(ushort)(trained.Info.Need2-1);learner.Stats[Stat.SkillGainMultiplier]=1;learner.LevelMagic(trained);
    Check(trained.Level==2,"skill level 2 threshold failed");
    learner.Info.Level=16;trained.Experience=(ushort)(trained.Info.Need3-1);learner.Stats[Stat.SkillGainMultiplier]=1;learner.LevelMagic(trained);
    Check(trained.Level==3&&trained.Experience==0,"skill cap did not clear experience");
    learner.LevelMagic(trained);Check(trained.Level==3&&trained.Experience==0,"max skill exceeded level 3");
    Check(learner.Packets.OfType<ServerPackets.MagicLeveled>().Count()==3,"skill growth replies mismatch");
    Console.WriteLine("PASS real Crystal LevelMagic: level gates, three training thresholds, cap and authoritative replies (fixture training values only).");

    var legacy=new CharacterInfo {Index=987,Class=MirClass.Warrior};
    var sampleInfo=envir.ItemInfoList.First();legacy.Inventory[0]=envir.CreateFreshItem(sampleInfo);var unique=legacy.Inventory[0].UniqueID;
    File.WriteAllText("demo-character-987-v1","existing");DemoSeed.Character(legacy);
    Check(legacy.Inventory[0]==null&&legacy.Inventory[6]?.UniqueID==unique,"legacy belt migration lost or duplicated item");
    DemoSeed.Character(legacy);Check(legacy.Inventory.Count(v=>v?.UniqueID==unique)==1,"migration not idempotent");
    Console.WriteLine("PASS legacy belt migration preserves item IDs and is idempotent.");
    using(var profile=System.Text.Json.JsonDocument.Parse(File.ReadAllText(Path.Combine(root,"server/content/experience.json")))){
        Settings.ExperienceList.Clear();Settings.ExperienceList.AddRange(profile.RootElement.GetProperty("requiredExperience").EnumerateArray().Select(v=>v.GetInt64()));
    }
    for(int i=0;i<envir.RankClass.Length;i++)envir.RankClass[i]=new();
    var leveller=new LevelPlayer {Stats=new Stats(),Info=new CharacterInfo {Level=1},Account=new AccountInfo()};
    leveller.InitializeLevel();leveller.WinExp(99);Check(leveller.Level==1&&leveller.Experience==99,"early level up");
    leveller.WinExp(1);Check(leveller.Level==2&&leveller.Experience==0&&leveller.MaxExperience==200,"exact level boundary");
    leveller.WinExp(2400);Check(leveller.Level==7&&leveller.Experience==0,"multi-level experience carry");
    Console.WriteLine("PASS real Crystal WinExp: below threshold, exact level up, multi-level carry.");
    WildlifeTests.Run(root,envir,connection);
    var observed=new RecordingPlayer {Stats=new Stats {[Stat.HP]=120,[Stat.MP]=45,[Stat.BagWeight]=50},Info=new CharacterInfo(),Account=new AccountInfo(),CurrentBagWeight=9};
    envir.Players.Add(observed);Mir2.WebHost.WorldSnapshots.Publish(envir);
    var snapshot=Mir2.WebHost.WorldSnapshots.Read(observed.ObjectID);
    Check(snapshot.MaxHP==120&&snapshot.MaxMP==45&&snapshot.BagWeight==9&&snapshot.MaxBagWeight==50,"authoritative snapshot lost final stats");
    observed.Stats[Stat.HP]=200;Check(snapshot.MaxHP==120,"published snapshot mutated with live engine stats");
    envir.Players.Clear();typeof(Envir).GetProperty("Time").SetValue(envir,200L);Mir2.WebHost.WorldSnapshots.Publish(envir);
    Check(Mir2.WebHost.WorldSnapshots.Read(observed.ObjectID)==null,"disconnected snapshot retained");
    Console.WriteLine("PASS immutable game-thread vitals, final HP/MP/weight, disconnect cleanup.");
    Check(checkedGoods==11,"missing stock");
    Console.WriteLine("PASS 11 real Crystal purchases: exact gold/durability/bag slot/replies; level/slot gates; insufficient gold, full bag and unknown stock do not mutate inventory or gold.");
} finally {Directory.SetCurrentDirectory(root);Directory.Delete(sandbox,true);}
static void Check(bool ok,string message){if(!ok)throw new Exception(message);}
class RecordingPlayer:PlayerObject {
    public readonly List<Packet> Packets=new();
    public override void Enqueue(Packet packet)=>Packets.Add(packet);
}

class LevelPlayer:RecordingPlayer {public void InitializeLevel()=>RefreshLevelStats();public override void LevelUp(){} }
