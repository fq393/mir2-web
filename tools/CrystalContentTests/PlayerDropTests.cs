using System.Drawing;
using Server;
using Server.MirDatabase;
using Server.MirEnvir;
using Server.MirNetwork;
using Server.MirObjects;
static class PlayerDropTests {
 public static void Run(Envir envir,MirConnection connection){
  void Check(bool ok,string message){if(!ok)throw new Exception(message);}
  var map=new Map(new MapInfo{Index=993,FileName="drop-fixture"}){Width=12,Height=12,Cells=new Cell[12,12]};
  for(int x=0;x<12;x++)for(int y=0;y<12;y++)map.Cells[x,y]=new Cell{Attribute=CellAttribute.Walk};
  var p=new RecordingPlayer{Info=new CharacterInfo{Level=7},Stats=new Stats(),Account=new AccountInfo(),Connection=connection,CurrentMap=map,CurrentLocation=new Point(5,5)};
  p.Report=new Reporting(p);p.Info.Mount=new MountInfo(p);p.Node=envir.Objects.AddLast(p);map.AddObject(p);
  var item=envir.CreateFreshItem(envir.ItemInfoList.Single(i=>i.Name=="牛角戒指"));item.AddedStats[Stat.MaxDC]=3;p.Info.Inventory[6]=item;
  p.Dead=true;p.DropItem(item.UniqueID,1,false);Check(p.Info.Inventory[6]==item,"dead drop lost item");p.Dead=false;
  map.Info.NoThrowItem=true;p.DropItem(item.UniqueID,1,false);Check(p.Info.Inventory[6]==item,"forbidden-map drop lost item");map.Info.NoThrowItem=false;
  p.DropItem(ulong.MaxValue,1,false);Check(p.Info.Inventory[6]==item,"unknown drop lost item");
  p.DropItem(item.UniqueID,1,false);Check(p.Info.Inventory[6]==null,"successful drop retained item");
  var floor=envir.Objects.OfType<ItemObject>().Single(i=>i.Item==item);Check(item.AddedStats[Stat.MaxDC]==3,"drop lost bonus");
  p.DropItem(item.UniqueID,1,false);Check(envir.Objects.OfType<ItemObject>().Count(i=>i.Item==item)==1,"duplicate drop duplicated item");
  map.RemoveObject(p);p.CurrentLocation=floor.CurrentLocation;map.AddObject(p);p.PickUp();
  Check(p.Info.Inventory.Count(i=>i==item)==1&&floor.Node==null,"drop pickup lost original instance");
  envir.Objects.Clear();Console.WriteLine("PASS real drop: dead/no-throw/unknown rejection, exact +3 instance, duplicate request and pickup recovery.");
 }
}
