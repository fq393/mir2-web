using System.Drawing;
using Mir2.WebHost;
using Server;
using Server.MirDatabase;
using Server.MirEnvir;
using Server.MirNetwork;
using Server.MirObjects;
static class StorageTransferTests
{
    public static void Run(Envir envir, MirConnection connection)
    {
        void Check(bool ok,string message) {if(!ok)throw new Exception("Storage transfer: "+message);}
        void Reject(Action action) {try {action();throw new Exception("Invalid storage operation succeeded");}catch(InvalidOperationException){}}
        var map=new Map(new MapInfo{Index=997,FileName="storage-fixture"}){Width=40,Height=40,Cells=new Cell[40,40]};
        for(int x=0;x<40;x++)for(int y=0;y<40;y++)map.Cells[x,y]=new Cell{Attribute=CellAttribute.Walk};
        var definition=envir.NPCInfoList.First(n=>n.FileName=="BichonJewellery4");
        var oldLocation=definition.Location;definition.Location=new Point(5,5);
        var npc=new NPCObject(definition){CurrentMap=map};map.NPCs.Add(npc);
        var account=new AccountInfo{Index=72001,AccountID="store-transfers",Password="test-only"};
        var role=new CharacterInfo{Index=72001,Name="仓库存取验收",AccountInfo=account,CreationIP="127.0.0.1",CreationDate=DateTime.Now};
        role.Heroes=new HeroInfo[role.MaximumHeroCount];account.Characters.Add(role);
        var p=new RecordingPlayer{Info=role,Account=account,Stats=new Stats{[Stat.BagWeight]=100},Connection=connection,CurrentMap=map,CurrentLocation=new Point(5,6),NPCObjectID=npc.ObjectID,NPCScriptID=npc.ScriptID,NPCPage=new NPCPage(NPCScript.StorageKey)};
        var originalAccounts=envir.AccountList.ToArray();var originalCharacters=envir.CharacterList.ToArray();
        var storage=CharacterStorage.Initialize(role,2);
        var item=envir.CreateFreshItem(envir.ItemInfoList.First(i=>i.Name=="牛角戒指"));item.AddedStats[Stat.MaxDC]=3;item.CurrentDura=1234;role.Inventory[6]=item;p.RefreshBagWeight();
        int saves=0;void Move(bool deposit,int from,int to,Action persist=null)=>StorageTransfers.Apply(p,npc.ObjectID,item.UniqueID,from,to,deposit,persist??(()=>saves++));
        try {
            p.Dead=true;Reject(()=>Move(true,6,0));p.Dead=false;
            p.CurrentLocation=new Point(35,35);Reject(()=>Move(true,6,0));p.CurrentLocation=new Point(5,6);
            p.NPCPage=new NPCPage(NPCScript.BuyKey);Reject(()=>Move(true,6,0));p.NPCPage=new NPCPage(NPCScript.StorageKey);
            Reject(()=>StorageTransfers.Apply(p,npc.ObjectID+1,item.UniqueID,6,0,true,()=>saves++));
            storage[0]=envir.CreateFreshItem(item.Info);Reject(()=>Move(true,6,0));storage[0]=null;
            Reject(()=>Move(true,-1,0));Reject(()=>Move(true,6,2));
            Reject(()=>StorageTransfers.Apply(p,npc.ObjectID,item.UniqueID+1,6,0,true,()=>saves++));
            var bind=item.Info.Bind;item.Info.Bind|=BindMode.DontStore;try{Reject(()=>Move(true,6,0));}finally{item.Info.Bind=bind;}
            var weight=p.CurrentBagWeight;
            try{Move(true,6,0,()=>throw new IOException("Synthetic disk failure"));throw new Exception("save failure swallowed");}catch(IOException){}
            Check(role.Inventory[6]==item&&storage[0]==null&&p.CurrentBagWeight==weight,"failed deposit lost item/weight");
            Move(true,6,0);Check(saves==1&&role.Inventory[6]==null&&storage[0]==item,"deposit failed");
            Reject(()=>Move(true,6,1));Check(saves==1,"duplicate deposit persisted");
            p.Stats[Stat.BagWeight]=0;Reject(()=>Move(false,0,6));p.Stats[Stat.BagWeight]=100;
            role.Inventory[6]=envir.CreateFreshItem(item.Info);Reject(()=>Move(false,0,6));role.Inventory[6]=null;
            try{Move(false,0,6,()=>throw new IOException("Synthetic disk failure"));throw new Exception("save failure swallowed");}catch(IOException){}
            Check(storage[0]==item&&role.Inventory[6]==null,"failed withdrawal lost item");
            Move(false,0,6);Check(saves==2&&storage[0]==null&&role.Inventory[6]==item&&item.AddedStats[Stat.MaxDC]==3&&item.CurrentDura==1234,"withdrawal changed instance");
            Reject(()=>Move(false,0,7));Check(saves==2,"duplicate withdrawal persisted");
            // Single-use confirmations are connection-owned, even when the same item returns to its old slot.
            var session=new StorageSession();
            string Prepare()=>session.Prepare(p,npc.ObjectID,item.UniqueID,6,0,true);
            var cancelled=Prepare();session.Cancel();Reject(()=>session.Apply(p,cancelled,()=>saves++));
            var replaced=Prepare();var latest=Prepare();Reject(()=>session.Apply(p,replaced,()=>saves++));
            Reject(()=>session.Apply(p,latest,()=>saves++)); // Wrong token also consumes the current request.
            var otherSession=new StorageSession();var foreign=Prepare();Reject(()=>otherSession.Apply(p,foreign,()=>saves++));
            session.Apply(p,foreign,()=>saves++);Move(false,0,6);
            Reject(()=>session.Apply(p,foreign,()=>saves++));Check(storage[0]==null&&role.Inventory[6]==item,"old token replay after item returned");
            var failure=Prepare();try{session.Apply(p,failure,()=>throw new IOException("Synthetic session disk failure"));throw new Exception("session swallowed failure");}catch(IOException){}
            Reject(()=>session.Apply(p,failure,()=>saves++));Check(storage[0]==null&&role.Inventory[6]==item,"session failure rollback/retry");
            var changedPage=Prepare();var originalPage=p.NPCPage;p.NPCPage=new NPCPage(NPCScript.StorageKey);
            Reject(()=>session.Apply(p,changedPage,()=>saves++));p.NPCPage=originalPage;
            var changedRole=Prepare();p.Info=new CharacterInfo();Reject(()=>session.Apply(p,changedRole,()=>saves++));p.Info=role;
            var staleDestination=Prepare();storage[0]=envir.CreateFreshItem(item.Info);Reject(()=>session.Apply(p,staleDestination,()=>saves++));storage[0]=null;
            var invalidReplacement=Prepare();Reject(()=>session.Prepare(p,npc.ObjectID,item.UniqueID+1,6,0,true));Reject(()=>session.Apply(p,invalidReplacement,()=>saves++));
            var disconnected=Prepare();session.Close();Reject(()=>session.Apply(p,disconnected,()=>saves++));Reject(()=>Prepare());
            // A reconnect starts with authoritative arrays, not the previous connection's pending request.
            var reconnect=new StorageSession();Reject(()=>reconnect.Apply(p,disconnected,()=>saves++));
            var reconnectToken=reconnect.Prepare(p,npc.ObjectID,item.UniqueID,6,0,true);reconnect.Apply(p,reconnectToken,()=>saves++);Move(false,0,6);
            Check(role.Inventory[6]==item&&storage.All(i=>i==null),"session scenarios changed final accounting");
            Console.WriteLine("PASS warehouse sessions: cancellation, replacement, foreign/replayed tokens, replay after item returns, failed-save consumption, role/page/destination changes, close and reconnect.");
            // Registration and actual durable file path, not an injected success callback.
            envir.AccountList.Clear();envir.AccountList.Add(account);envir.Players.Add(p);
            StorageTransfers.Commit(envir,p,npc.ObjectID,item.UniqueID,6,1,true);
            Check(storage[1]==item&&role.Inventory[6]==null,"durable deposit failed");
            envir.LoadAccounts();p.Account=envir.AccountList.Single(a=>a.Index==account.Index);p.Info=p.Account.Characters.Single();
            storage=CharacterStorage.Get(p.Info);
            Check(storage[1]?.UniqueID==item.UniqueID&&storage[1].AddedStats[Stat.MaxDC]==3&&p.Info.Inventory[6]==null,"deposit reload differs");
            StorageTransfers.Commit(envir,p,npc.ObjectID,item.UniqueID,1,6,false);
            envir.LoadAccounts();var reloaded=envir.AccountList.Single(a=>a.Index==account.Index).Characters.Single();
            Check(CharacterStorage.Get(reloaded)[1]==null&&reloaded.Inventory[6]?.UniqueID==item.UniqueID&&reloaded.Inventory[6].CurrentDura==1234,"withdrawal reload differs");
            Check(!p.Packets.Any(),"transaction emitted packets before bridge publication");
            Console.WriteLine("PASS warehouse transfers: durable deposit/withdraw, +3/durability identity, disk rollback both ways, duplicate/stale IDs, bounds, NPC/distance/death, binding, capacity and weight guards.");
        } finally {envir.AccountList.Clear();envir.AccountList.AddRange(originalAccounts);envir.CharacterList.Clear();envir.CharacterList.AddRange(originalCharacters);envir.Players.Remove(p);envir.NPCs.Remove(npc);definition.Location=oldLocation;}
    }
}
