using Mir2.WebHost;
using Server.MirDatabase;
using Server.MirEnvir;
static class GoldDropTests {
 public static void Run(){
  var p=new RecordingPlayer{Info=new CharacterInfo(),Account=new AccountInfo{Gold=100},CurrentMap=new Map(new MapInfo())};
  void Reject(uint amount){try{GoldDrops.Drop(p,amount);throw new Exception("gold drop was not rejected");}catch(InvalidOperationException){}if(p.Account.Gold!=100||p.Packets.Count!=0)throw new Exception("invalid gold drop mutated wallet");}
  Reject(0);Reject(101);Reject(uint.MaxValue);p.Dead=true;Reject(10);p.Dead=false;p.CurrentMap.Info.NoThrowItem=true;Reject(10);
  Console.WriteLine("PASS gold drop rejects zero, over-balance, dead and no-throw without wallet mutation.");
 }
}
