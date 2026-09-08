using System.Drawing;
using System.Reflection;
using Server;
using Server.MirDatabase;
using Server.MirEnvir;
using Server.MirNetwork;
using Server.MirObjects;

static class WildlifeTests {
 public static void Run(string root,Envir envir,MirConnection connection){
  void Check(bool ok,string message){if(!ok)throw new Exception(message);}
  void Time(long value)=>typeof(Envir).GetProperty("Time")!.SetValue(envir,value);
  Settings.Multithreaded=false;Settings.MonsterRarityEnabled=false;Settings.DropRate=1;
  foreach(var name in new[]{"BichonHealthSmall","BichonManaSmall"})envir.ItemInfoList.Add(new ItemInfo{Index=++envir.ItemIndex,Name=name,Type=ItemType.Potion,StackSize=1});
  var content=new MapInfo{Index=800,FileName="test"};WildlifeSeed.Apply(envir,root,content);
  Check(content.Respawns.Count==52&&content.Respawns.Sum(r=>r.Count)==2650,"candidate spawn rows changed");
  var indices=content.Respawns.Select(r=>r.RespawnIndex).ToArray();WildlifeSeed.Apply(envir,root,content);
  Check(indices.SequenceEqual(content.Respawns.Select(r=>r.RespawnIndex)),"spawn migration not idempotent");
  var deer=envir.MonsterInfoList.Single(m=>m.Name=="BichonDeer");var straw=envir.MonsterInfoList.Single(m=>m.Name=="BichonScarecrow");
  Check(MonsterObject.GetMonster(deer) is Server.MirObjects.Monsters.Deer&&MonsterObject.GetMonster(straw).GetType()==typeof(MonsterObject),"wildlife AI mapping is reversed");
  Check(deer.Experience==15&&straw.Experience==12&&deer.Stats[Stat.HP]==15&&straw.Stats[Stat.HP]==15,"source numeric mapping differs");
  // Independent 1/N trials, not a weighted choice of exactly one drop.
  var gold=DropInfo.FromLine("1/3 Gold 130");var hits=0;for(int i=0;i<30000;i++){var reward=gold.AttemptDrop();if(reward==null)continue;hits++;Check(reward.Gold>=65&&reward.Gold<195,"gold range differs from engine");}
  Check(hits>9000&&hits<11000,"drop probability far outside 1/3");
  var map=new Map(new MapInfo{Index=801,FileName="fixture"}){Width=12,Height=12,Cells=new Cell[12,12]};
  for(int x=0;x<12;x++)for(int y=0;y<12;y++)map.Cells[x,y]=new Cell{Attribute=CellAttribute.Walk};
  var owner=new RecordingPlayer{Info=new CharacterInfo{Level=1},Stats=new Stats(),Account=new AccountInfo(),Connection=connection,CurrentMap=map,CurrentLocation=new Point(5,5)};
  owner.Report=new Reporting(owner);owner.Info.Mount=new MountInfo(owner);owner.Node=envir.Objects.AddLast(owner);map.AddObject(owner);
  var other=new RecordingPlayer{Info=new CharacterInfo{Level=1},Stats=new Stats(),Account=new AccountInfo(),Connection=connection,CurrentMap=map,CurrentLocation=owner.CurrentLocation};other.Report=new Reporting(other);other.Node=envir.Objects.AddLast(other);map.AddObject(other);
  var item=envir.CreateFreshItem(envir.ItemInfoList.First());
  var floor=new ItemObject(owner,item){Owner=owner,OwnerTime=1000,ExpireTime=10000};Check(floor.Drop(1),"floor drop failed");
  map.RemoveObject(other);other.CurrentLocation=floor.CurrentLocation;map.AddObject(other);map.RemoveObject(owner);owner.CurrentLocation=floor.CurrentLocation;map.AddObject(owner);
  other.PickUp();Check(floor.Node!=null&&other.Info.Inventory.All(v=>v==null),"nonowner stole protected drop");
  for(int i=0;i<owner.Info.Inventory.Length;i++)owner.Info.Inventory[i]=envir.CreateFreshItem(item.Info);
  owner.PickUp();Check(floor.Node!=null,"full inventory destroyed ground item");
  owner.Info.Inventory[6]=null;owner.PickUp();Check(floor.Node==null&&owner.Info.Inventory[6]?.UniqueID==item.UniqueID,"pickup did not transfer exact item");
  var coins=new ItemObject(owner,100u){Owner=owner,OwnerTime=1000,ExpireTime=10000};Check(coins.Drop(1),"gold drop failed");Time(1001);coins.Process();map.RemoveObject(other);other.CurrentLocation=coins.CurrentLocation;map.AddObject(other);other.PickUp();Check(other.Account.Gold==100&&coins.Node==null,"released gold not pickable");
  var expired=new ItemObject(owner,100u){ExpireTime=1100};Check(expired.Drop(1),"expiry fixture drop failed");Time(1101);expired.Process();Check(expired.Node==null,"expired floor item retained");
  var spawn=new MapRespawn(new RespawnInfo{MonsterIndex=straw.Index,Count=2,Delay=1}){Map=map,WalkableCells=new(){new Point(8,8)}};map.Respawns.Add(spawn);
  var process=typeof(Map).GetMethod("ProcessRespawns",BindingFlags.Instance|BindingFlags.NonPublic)!;
  process.Invoke(map,null);Check(spawn.Count==2,"initial population differs");var due=spawn.RespawnTime;
  var monster=envir.Objects.OfType<MonsterObject>().First(m=>m.Respawn==spawn);monster.Die();Check(spawn.Count==1,"death did not release spawn slot");monster.Die();Check(spawn.Count==1,"duplicate death released slot twice");
  Time(due-1);process.Invoke(map,null);Check(spawn.Count==1,"respawn before deadline");Time(due);process.Invoke(map,null);Check(spawn.Count==2,"missing respawn at deadline");process.Invoke(map,null);Check(spawn.Count==2,"respawn exceeded population");
  envir.Objects.Clear();Time(0);
  Console.WriteLine("PASS wildlife source mapping/idempotence, 1/N probability/gold range, ownership/full-bag/pickup/expiry, death and timed respawn population (isolated map).");
 }
}
