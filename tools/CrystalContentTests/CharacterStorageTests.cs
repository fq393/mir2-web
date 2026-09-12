using Mir2.WebHost;
using Server.MirDatabase;
using Server.MirEnvir;

static class CharacterStorageTests
{
    public static void Run(Envir envir)
    {
        void Check(bool ok, string message) { if (!ok) throw new Exception("Character storage: " + message); }
        var original = envir.AccountList.ToArray();
        var originalCharacters = envir.CharacterList.ToArray();
        var version = Envir.LoadVersion; var custom = Envir.LoadCustomVersion;
        var account = new AccountInfo { Index=71001, AccountID="storage-fixture", Password="test-only" };
        CharacterInfo Role(int id) {
            var r=new CharacterInfo { Index=id,Name="仓库验收"+id,AccountInfo=account,CreationIP="127.0.0.1",CreationDate=DateTime.Now };
            r.Heroes=new HeroInfo[r.MaximumHeroCount];account.Characters.Add(r);return r;
        }
        var first=Role(71001);var second=Role(71002);
        var item=envir.CreateFreshItem(envir.ItemInfoList.First(i=>i.Name=="牛角戒指"));
        item.AddedStats[Stat.MaxDC]=3;item.CurrentDura=1234;
        CharacterStorage.Initialize(first,3)[1]=item; // Deliberately synthetic capacity, not a 1.76 rule.
        try {
            Envir.LoadVersion=Envir.Version;Envir.LoadCustomVersion=Envir.CustomVersion;
            envir.AccountList.Clear();envir.AccountList.Add(account);
            byte[] Save() {
                using var stream=new MemoryStream();
                using(var writer=new BinaryWriter(stream,System.Text.Encoding.UTF8,true)) {account.Save(writer);CharacterStorage.Write(writer,new[]{account});}
                return stream.ToArray();
            }
            var bytes=Save();
            using(var stream=new MemoryStream(bytes))using(var reader=new BinaryReader(stream)) {
                var loaded=new AccountInfo(reader);envir.AccountList.Clear();envir.AccountList.Add(loaded);
                CharacterStorage.Read(reader,envir);
                var saved=CharacterStorage.Get(loaded.Characters[0]);
                Check(saved.Length==3&&saved[0]==null&&saved[2]==null,"slots changed");
                Check(saved[1].UniqueID==item.UniqueID&&saved[1].CurrentDura==1234&&saved[1].AddedStats[Stat.MaxDC]==3&&saved[1].Info!=null,"instance attributes lost");
                Check(CharacterStorage.Get(loaded.Characters[1]).Length==0,"same-account role saw another role's warehouse");
            }
            envir.AccountList.Clear();envir.AccountList.Add(account);
            // Exercise the generated Envir hooks and the actual atomic account file,
            // not only the standalone extension serializer (test cwd is temporary).
            envir.SaveAccounts();envir.LoadAccounts();
            var fullAccount=envir.AccountList.Single(a=>a.Index==account.Index);
            Check(CharacterStorage.Get(fullAccount.Characters[0])[1]?.UniqueID==item.UniqueID,"full engine snapshot omitted storage trailer");
            Check(CharacterStorage.Get(fullAccount.Characters[1]).Length==0,"full snapshot leaked another role storage");
            envir.AccountList.Clear();envir.AccountList.Add(account);
            first.Inventory[6]=item;
            try {Save();throw new Exception("duplicate inventory/storage accepted");} catch(InvalidDataException) {}
            first.Inventory[6]=null;
            CharacterStorage.Initialize(second,3)[0]=item;
            try {Save();throw new Exception("duplicate cross-role storage accepted");} catch(InvalidDataException) {}
            CharacterStorage.Get(second)[0]=null;
            try {CharacterStorage.Initialize(first,2);throw new Exception("implicit shrink allowed");} catch(InvalidOperationException) {}
            // Truncated input must not publish partial stores or discard the existing in-memory one.
            using(var stream=new MemoryStream(bytes[..^1]))using(var reader=new BinaryReader(stream)) {
                _=new AccountInfo(reader);
                try {CharacterStorage.Read(reader,envir);throw new Exception("truncated snapshot accepted");} catch(EndOfStreamException) {}
                Check(ReferenceEquals(CharacterStorage.Get(first)[1],item),"failed read mutated live storage");
            }
            // A legacy account stream ends immediately after the account record.
            using(var stream=new MemoryStream()) {
                using(var writer=new BinaryWriter(stream,System.Text.Encoding.UTF8,true))account.Save(writer);
                stream.Position=0;using var reader=new BinaryReader(stream);var loaded=new AccountInfo(reader);
                envir.AccountList.Clear();envir.AccountList.Add(loaded);CharacterStorage.Read(reader,envir);
                Check(loaded.Characters.All(r=>CharacterStorage.Get(r).Length==0),"legacy file did not load empty warehouses");
            }
            Console.WriteLine("PASS character storage: shared snapshot roundtrip, role isolation, instance preservation, duplicate rejection, no implicit shrink, truncated read rollback, legacy format.");
        } finally {envir.AccountList.Clear();envir.AccountList.AddRange(original);envir.CharacterList.Clear();envir.CharacterList.AddRange(originalCharacters);Envir.LoadVersion=version;Envir.LoadCustomVersion=custom;}
    }
}
