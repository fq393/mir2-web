using System.Drawing;
using System.Text.Json;
using Server.MirDatabase;
using Server.MirEnvir;
// Isolated visual prerequisites, never a baseline rule or a live-account migration.
static class AppearanceFixture {
 public static void Seed(Envir envir,string root){
  if(!File.Exists(Path.Combine(root,"APPEARANCE_QA_ONLY")))throw new InvalidOperationException("Missing isolated appearance fixture marker");
  foreach(var map in envir.MapInfoList)map.Respawns.Clear();
  envir.SaveDB();
  using var json=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,"credentials.json")));
  var area=envir.MapInfoList.Single(m=>m.FileName=="0");
  int i=0;
  foreach(var row in json.RootElement.EnumerateArray()){
   var id=row.GetProperty("account").GetString()!;int index=i++;
   if(envir.AccountList.Any(a=>a.AccountID==id))continue;
   var account=new AccountInfo{Index=++envir.NextAccountID,AccountID=id,Password=row.GetProperty("password").GetString()!,Gold=0,CreationDate=DateTime.Now};
   var role=new CharacterInfo{Index=++envir.NextCharacterID,Name=index==0?"外观甲验收":"外观乙验收",AccountInfo=account,Class=MirClass.Warrior,Gender=index==0?MirGender.Male:MirGender.Female,Hair=(byte)(index==0?0:7),Level=7,HP=40,MP=40,CurrentMapIndex=area.Index,CurrentLocation=new Point(288+index*2,615),BindMapIndex=area.Index,BindLocation=new Point(288+index*2,615),CreationIP="127.0.0.1",CreationDate=DateTime.Now};
   role.Heroes=new HeroInfo[role.MaximumHeroCount];
   role.Inventory[6]=envir.CreateFreshItem(envir.ItemInfoList.Single(v=>v.Name=="BichonSword"));
   role.Inventory[7]=envir.CreateFreshItem(envir.ItemInfoList.Single(v=>v.Name=="BichonRobe"));
   account.Characters.Add(role);envir.CharacterList.Add(role);envir.AccountList.Add(account);
  }
  envir.SaveAccounts();
 }
}
