using Mir2.WebHost;
using Server.MirDatabase;
using Server.MirEnvir;
using Server.MirObjects;

static class TradeSnapshotTests
{
    public static void Run(Envir envir)
    {
        void Check(bool ok,string message) { if (!ok) throw new Exception("Trade snapshot: "+message); }
        var account = new AccountInfo { AccountID="isolated-snapshot", Password="test-only", Gold=990 };
        var role = new CharacterInfo { Name="存档验收", CreationIP="127.0.0.1", CreationDate=DateTime.Now, LastLoginDate=DateTime.Now, AccountInfo=account };
        role.Heroes=new HeroInfo[role.MaximumHeroCount]; account.Characters.Add(role);
        var item=envir.CreateFreshItem(envir.ItemInfoList.First(i=>i.Name=="牛角戒指"));
        item.AddedStats[Stat.MaxDC]=3; role.Trade[0]=item;
        var original=role.Inventory;
        var player=new PlayerObject {Account=account,Info=role,TradeGoldAmount=10};
        var players=new[]{player};
        var oldVersion=Envir.LoadVersion;var oldCustom=Envir.LoadCustomVersion;
        Envir.LoadVersion=Envir.Version;Envir.LoadCustomVersion=Envir.CustomVersion;
        try
        {
            AccountInfo Roundtrip(bool projected)
            {
                using var stream=new MemoryStream();
                using(var writer=new BinaryWriter(stream,System.Text.Encoding.UTF8,true))
                    if(projected)TradeAccountSnapshot.Write(writer,account,players);else account.Save(writer);
                stream.Position=0;using var reader=new BinaryReader(stream);
                return new AccountInfo(reader);
            }
            var old=Roundtrip(false);
            Check(old.Gold==990&&!old.Characters[0].Inventory.Any(i=>i?.UniqueID==item.UniqueID),"baseline no longer reproduces omitted escrow");
            var loaded=Roundtrip(true);
            Check(loaded.Gold==1000,"saved account lost escrow gold");
            var restored=loaded.Characters[0].Inventory.Single(i=>i?.UniqueID==item.UniqueID);
            Check(restored.AddedStats[Stat.MaxDC]==3&&restored.CurrentDura==item.CurrentDura,"item identity/bonus/durability changed");
            Check(ReferenceEquals(role.Inventory,original)&&!original.Contains(item)&&role.Trade[0]==item&&account.Gold==990&&player.TradeGoldAmount==10,"save mutated live trade");
            Check(Roundtrip(true).Gold==1000,"repeat save counted escrow twice");
            try {using var writer=new BinaryWriter(new BrokenStream());TradeAccountSnapshot.Write(writer,account,players);throw new Exception("expected I/O failure");}
            catch(IOException) {}
            Check(ReferenceEquals(role.Inventory,original)&&account.Gold==990&&role.Trade[0]==item,"failed write mutated live trade");
            for(var i=0;i<role.Inventory.Length;i++)role.Inventory[i]=envir.CreateFreshItem(item.Info);
            try {Roundtrip(true);throw new Exception("full illegal escrow was silently lost");}catch(InvalidDataException){}
            // Exercise the actual periodic-save hook: a rejected snapshot keeps the old file.
            var accounts=envir.AccountList.ToArray();var live=envir.Players.ToArray();
            var previous=File.Exists(Envir.AccountPath)?File.ReadAllBytes(Envir.AccountPath):null;
            try
            {
                envir.AccountList.Clear();envir.AccountList.Add(account);envir.Players.Clear();envir.Players.Add(player);
                byte[] baseline={10,20,30};File.WriteAllBytes(Envir.AccountPath,baseline);
                envir.BeginSaveAccounts();
                Check(!envir.Saving&&File.ReadAllBytes(Envir.AccountPath).SequenceEqual(baseline),"failed periodic save removed last file or stuck Saving");
                Array.Clear(role.Inventory);envir.BeginSaveAccounts();
                Check(SpinWait.SpinUntil(()=>!envir.Saving,5000),"subsequent periodic save never completed");
                Check(!File.ReadAllBytes(Envir.AccountPath).SequenceEqual(baseline),"subsequent periodic save did not replace snapshot");
                Check(ReferenceEquals(role.Inventory,original)&&account.Gold==990&&role.Trade[0]==item,"real save hook mutated live escrow");
            }
            finally
            {
                envir.AccountList.Clear();envir.AccountList.AddRange(accounts);envir.Players.Clear();envir.Players.AddRange(live);
                if(previous!=null)File.WriteAllBytes(Envir.AccountPath,previous);else File.Delete(Envir.AccountPath);
            }
            Array.Clear(role.Inventory);role.Trade[0]=null;role.Inventory[6]=item;account.Gold=1000;player.TradeGoldAmount=0;
            loaded=Roundtrip(true);
            Check(loaded.Gold==1000&&loaded.Characters[0].Inventory.Count(i=>i?.UniqueID==item.UniqueID)==1,"settled snapshot duplicated refund");
        }
        finally {Envir.LoadVersion=oldVersion;Envir.LoadCustomVersion=oldCustom;}
        Console.WriteLine("PASS native trade snapshot reload: escrow item/+3/durability/gold, repeated save, settled state, illegal capacity rejection and write-failure rollback.");
    }
    sealed class BrokenStream:MemoryStream {public override void Write(byte[] buffer,int offset,int count)=>throw new IOException("fixture");public override void Write(ReadOnlySpan<byte> buffer)=>throw new IOException("fixture");public override void WriteByte(byte value)=>throw new IOException("fixture");}
}
