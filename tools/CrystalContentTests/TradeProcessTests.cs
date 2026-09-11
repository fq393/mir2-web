using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Drawing;
using Server;
using Server.MirDatabase;
using Server.MirEnvir;
using Server.MirNetwork;
using Server.MirObjects;
using Mir2.WebHost;

static class TradeProcessTests
{
    public static void Child(string folder,string phase)
    {
        Directory.SetCurrentDirectory(folder);Settings.Load();Packet.IsServer=true;
        var envir=Envir.Main;
        var definition=new ItemInfo {Index=1,Name="跨进程戒指",Type=ItemType.Ring,StackSize=1,Durability=400};
        envir.ItemInfoList.Add(definition);
        Envir.LoadVersion=Envir.Version;Envir.LoadCustomVersion=Envir.CustomVersion;
        string file=Path.Combine(folder,"accounts.bin");
        if(phase=="read")
        {
            bool durable=File.Exists(Envir.AccountPath);
            using var reader=new BinaryReader(File.OpenRead(durable?Envir.AccountPath:file));
            string expected;
            if(durable){
                expected="committed";Envir.LoadVersion=reader.ReadInt32();Envir.LoadCustomVersion=reader.ReadInt32();
                reader.ReadInt32();reader.ReadInt32();reader.ReadUInt64();reader.ReadInt32();
                if(reader.ReadInt32()!=0)throw new Exception("unexpected fixture guild");reader.ReadInt32();
                if(reader.ReadInt32()!=0||reader.ReadInt32()!=2)throw new Exception("unexpected fixture account header");
            }else expected=reader.ReadString();
            var a=new AccountInfo(reader);var b=new AccountInfo(reader);
            var items=a.Characters.SelectMany(c=>c.Inventory).Concat(b.Characters.SelectMany(c=>c.Inventory)).Where(i=>i!=null).ToArray();
            if(items.Length!=2||items.Select(i=>i.UniqueID).Distinct().Count()!=2||a.Gold+b.Gold!=2000)throw new Exception("cross-process asset conservation failed");
            bool exchanged=expected=="committed";
            if(a.Gold!=(exchanged?980u:1000u)||b.Gold!=(exchanged?1020u:1000u))throw new Exception("cross-process wallet owner mismatch");
            var ai=a.Characters[0].Inventory.Single(i=>i!=null);var bi=b.Characters[0].Inventory.Single(i=>i!=null);
            if(ai.AddedStats[Stat.MaxDC]!=(exchanged?5:3)||bi.AddedStats[Stat.MaxDC]!=(exchanged?3:5)||ai.CurrentDura!=321||bi.CurrentDura!=321)throw new Exception("cross-process item owner or attributes mismatch");
            Console.WriteLine("PASS fresh-process "+expected+": both owners, unique items, bonuses, durability and gold.");return;
        }
        var listener=new TcpListener(IPAddress.Loopback,0);listener.Start();
        using var socket=new TcpClient();socket.Connect((IPEndPoint)listener.LocalEndpoint);
        using var accepted=listener.AcceptTcpClient();listener.Stop();
        var connection=new MirConnection(1,accepted);
        var map=new Map(new MapInfo{Index=995,FileName="snapshot-process"});
        RecordingPlayer Make(string name,int x,MirDirection dir,int bonus)
        {
            var account=new AccountInfo{AccountID=name,Password="isolated-test",Gold=1000};
            var role=new CharacterInfo{Name=name,CreationIP="127.0.0.1",CreationDate=DateTime.Now,LastLoginDate=DateTime.Now,Level=7,AccountInfo=account};
            role.Heroes=new HeroInfo[role.MaximumHeroCount];account.Characters.Add(role);
            var p=new RecordingPlayer{Connection=connection,Info=role,Account=account,Stats=new Stats{[Stat.BagWeight]=1000},CurrentMap=map,CurrentLocation=new Point(x,5),Direction=dir,AllowTrade=true};
            p.Report=new Reporting(p);role.Mount=new MountInfo(p);
            var item=envir.CreateFreshItem(definition);item.AddedStats[Stat.MaxDC]=bonus;item.CurrentDura=321;role.Inventory[6]=item;return p;
        }
        var first=Make("甲",5,MirDirection.Right,3);var second=Make("乙",6,MirDirection.Left,5);
        envir.AccountList.AddRange(new[]{first.Account,second.Account});envir.Players.AddRange(new[]{first,second});
        second.TradeInvitation=first;second.TradeReply(true);
        first.DepositTradeItem(6,0);second.DepositTradeItem(6,0);first.TradeGold(30);second.TradeGold(10);
        if(phase=="cancelled"){first.TradeCancel();first.TradeCancel();}
        if(phase=="committed"){
            bool early=false;
            first.BeforeEnqueue=second.BeforeEnqueue=packet=>{
                if(packet is ServerPackets.GainedItem or ServerPackets.GainedGold or ServerPackets.TradeConfirm)
                    if(!File.Exists(Envir.AccountPath)) early=true;
            };
            first.TradeConfirm(true);second.TradeConfirm(true);first.TradeConfirm(true);
            if(early)throw new Exception("receipt notification preceded the durable file");
        }
        if(phase=="committed"){
            if(!File.Exists(Envir.AccountPath)||!first.Packets.Any(p=>p is ServerPackets.TradeConfirm)||!second.Packets.Any(p=>p is ServerPackets.TradeConfirm))throw new Exception("no durable confirmed trade");
            File.WriteAllText(Path.Combine(folder,"ready"),phase);Thread.Sleep(Timeout.Infinite);
        }
        using(var stream=new FileStream(file,FileMode.Create))
        {
            using(var writer=new BinaryWriter(stream,System.Text.Encoding.UTF8,true))
            {writer.Write(phase);TradeAccountSnapshot.Write(writer,first.Account,new[]{first,second});TradeAccountSnapshot.Write(writer,second.Account,new[]{first,second});}
            stream.Flush(true);
        }
        File.WriteAllText(Path.Combine(folder,"ready"),phase);
        Thread.Sleep(Timeout.Infinite); // Parent kills this process; no graceful trade cancellation.
    }
    static Process Start(string folder,string phase)
    {
        var info=new ProcessStartInfo(Environment.ProcessPath!){RedirectStandardOutput=true,RedirectStandardError=true,UseShellExecute=false};
        if(Path.GetFileNameWithoutExtension(Environment.ProcessPath)=="dotnet")info.ArgumentList.Add(typeof(TradeProcessTests).Assembly.Location);
        info.ArgumentList.Add("--trade-recovery-child");info.ArgumentList.Add(folder);info.ArgumentList.Add(phase);
        return Process.Start(info)!;
    }
    public static void Run()
    {
        foreach(var phase in new[]{"pending","cancelled","committed"})
        {
            string folder=Path.Combine(Path.GetTempPath(),"mir-trade-process-"+Guid.NewGuid());Directory.CreateDirectory(folder);
            try
            {
                using(var writer=Start(folder,phase))
                {
                    var output=writer.StandardOutput.ReadToEndAsync();var error=writer.StandardError.ReadToEndAsync();
                    if(!SpinWait.SpinUntil(()=>File.Exists(Path.Combine(folder,"ready"))||writer.HasExited,15000))
                    {writer.Kill(true);writer.WaitForExit();throw new Exception("trade writer timed out");}
                    if(writer.HasExited)throw new Exception("trade writer failed: "+error.GetAwaiter().GetResult());
                    writer.Kill(true);writer.WaitForExit();
                }
                using var reader=Start(folder,"read");var readOut=reader.StandardOutput.ReadToEndAsync();var readError=reader.StandardError.ReadToEndAsync();
                if(!reader.WaitForExit(15000)){reader.Kill(true);reader.WaitForExit();throw new Exception("trade reader timed out");}
                if(reader.ExitCode!=0)throw new Exception(readError.GetAwaiter().GetResult());
                Console.Write(readOut.GetAwaiter().GetResult());
            }
            finally{Directory.Delete(folder,true);}
        }
    }
}
