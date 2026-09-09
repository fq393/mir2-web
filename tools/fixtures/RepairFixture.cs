using System.Drawing;
using System.Text.Json;
using Server.MirDatabase;
using Server.MirEnvir;
// New isolated accounts only: damaged +3 rings are test prerequisites, never live migration or game rules.
static class RepairFixture {
 public static void Seed(Envir envir,string root){
  if(!File.Exists(Path.Combine(root,"REPAIR_QA_ONLY")))throw new InvalidOperationException("Missing isolated repair marker");
  foreach(var m in envir.MapInfoList)m.Respawns.Clear();envir.SaveDB();
  using var json=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,"credentials.json")));
  var id=json.RootElement.GetProperty("account").GetString()!;
  if(envir.AccountList.Any(a=>a.AccountID==id))return;
  var area=envir.MapInfoList.Single(m=>m.FileName=="0105");
  var account=new AccountInfo{Index=++envir.NextAccountID,AccountID=id,Password=json.RootElement.GetProperty("password").GetString()!,Gold=10000,CreationDate=DateTime.Now};
  var role=new CharacterInfo{Index=++envir.NextCharacterID,Name="修理流程验收",AccountInfo=account,Class=MirClass.Warrior,Gender=MirGender.Male,Level=7,HP=40,MP=40,CurrentMapIndex=area.Index,CurrentLocation=new Point(18,9),BindMapIndex=area.Index,BindLocation=new Point(18,9),CreationIP="127.0.0.1",CreationDate=DateTime.Now};
  role.Heroes=new HeroInfo[role.MaximumHeroCount];
  for(int slot=6;slot<=7;slot++){var ring=envir.CreateFreshItem(envir.ItemInfoList.Single(v=>v.Name=="牛角戒指"));ring.CurrentDura=(ushort)(ring.MaxDura/2);ring.AddedStats[Stat.MaxDC]=3;role.Inventory[slot]=ring;}
  account.Characters.Add(role);envir.CharacterList.Add(role);envir.AccountList.Add(account);envir.SaveAccounts();
 }
}
