using Server;
using Server.MirDatabase;
using Server.MirEnvir;
using Server.MirNetwork;
using Server.MirObjects;
static class BookshopTests {
 public static void Run(string root,Envir envir,MirConnection connection){
  void Check(bool ok,string why){if(!ok)throw new Exception(why);}
  foreach(var spell in new[]{Spell.FireBall,Spell.Healing,Spell.Fencing})
   if(!envir.MagicInfoList.Any(m=>m.Spell==spell))envir.MagicInfoList.Add(new MagicInfo{Spell=spell,Name=spell.ToString(),Level1=7,Need1=100}); // Test-only training values.
  var map=new MapInfo{Index=101,FileName="0"};BookshopSeed.Apply(envir,root,map);
  int items=envir.ItemInfoList.Count,npcs=envir.NPCInfoList.Count;BookshopSeed.Apply(envir,root,map);
  Check(items==envir.ItemInfoList.Count&&npcs==envir.NPCInfoList.Count,"book seed duplicated content");
  var npc=envir.NPCInfoList.Single(n=>n.FileName=="BichonBookshop");
  Check(npc.Location==new System.Drawing.Point(325,250)&&npc.Image==2,"bookshop differs from candidate merchant row");
  var script=NPCScript.GetOrAdd(0,npc.FileName,NPCScriptType.Normal);
  Check(script.Goods.Count==3,"initial bookshop stock is not exactly three books");
  foreach(var goods in script.Goods){
   var info=goods.Info;
   Check(info.Type==ItemType.Book&&info.Price==500&&info.Weight==1&&info.Image==0&&info.StackSize==1&&info.RequiredAmount==7&&!info.StartItem&&info.Durability==0,"book profile conversion differs");
   var role=info.RequiredClass==RequiredClass.Warrior?MirClass.Warrior:info.RequiredClass==RequiredClass.Wizard?MirClass.Wizard:MirClass.Taoist;
   var p=new RecordingPlayer{Info=new CharacterInfo{Class=role,Level=6},Stats=new Stats{[Stat.BagWeight]=1000},Account=new AccountInfo{Gold=499},Connection=connection,NPCPage=new NPCPage(NPCScript.BuyKey)};
   p.Info.Mount=new MountInfo(p);p.Report=new Reporting(p);
   script.Buy(p,goods.UniqueID,1);Check(p.Account.Gold==499&&p.Info.Inventory.All(i=>i==null),"poor buyer charged");
   p.Account.Gold=500;script.Buy(p,goods.UniqueID,1);var book=p.Info.Inventory[6];
   Check(book?.Info==info&&p.Account.Gold==0&&p.Info.Inventory.Count(i=>i!=null)==1,"book purchase did not charge and deliver once");
   p.UseItem(book.UniqueID);Check(p.Info.Inventory[6]==book&&p.Info.Magics.Count==0,"under-level learner lost book");
   p.Info.Level=7;p.Info.Class=role==MirClass.Wizard?MirClass.Warrior:MirClass.Wizard;
   p.UseItem(book.UniqueID);Check(p.Info.Inventory[6]==book&&p.Info.Magics.Count==0,"wrong class lost book");
   Check(p.Packets.OfType<ServerPackets.Chat>().Any(r=>r.Message.Contains("不能使用此物品")),"wrong-class response is not Chinese");
   p.Info.Class=role;p.UseItem(book.UniqueID);
   Check(p.Info.Inventory[6]==null&&p.Info.Magics.Single().Spell==(Spell)info.Shape&&p.Info.Magics.Single().Key==0,"learning did not consume one book and grant mapped skill");
   var duplicate=envir.CreateFreshItem(info);p.Info.Inventory[6]=duplicate;p.UseItem(duplicate.UniqueID);
   Check(p.Info.Inventory[6]==duplicate&&p.Info.Magics.Count==1,"duplicate book consumed or skill duplicated");
   Check(p.Packets.OfType<ServerPackets.UseItem>().Count(r=>r.Success)==1&&p.Packets.OfType<ServerPackets.NewMagic>().Count()==1,"learning success acknowledgements duplicated");
   p.Account.Gold=500;for(int i=0;i<p.Info.Inventory.Length;i++)p.Info.Inventory[i]=envir.CreateFreshItem(info);
   script.Buy(p,goods.UniqueID,1);Check(p.Account.Gold==500,"full bag charged");
  }
  Console.WriteLine("PASS three sourced book purchases/learning: seed idempotence, native image, spell mapping, class/level gates, poor/full-bag rejection, one-item consumption, duplicate protection and authoritative replies.");
 }
}
