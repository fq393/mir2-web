using System.Drawing;
using System.Text.Json;
using Server.MirDatabase;
using Server.MirEnvir;
// Isolated browser prerequisites only. No skills/items are granted: buy and learn through UI.
static class PriorityFixture {
 public static void Seed(Envir envir,string root){
  if(!File.Exists(Path.Combine(root,"PRIORITY_QA_ONLY")))throw new InvalidOperationException("Missing isolated QA marker");
  // Stable UI fixture: only a passive deer near the shop, no live-world spawn changes.
  foreach(var area in envir.MapInfoList)area.Respawns.Clear();
  var testMap=envir.MapInfoList.Single(m=>m.FileName=="0");
  var deer=envir.MonsterInfoList.Single(m=>m.Name=="BichonDeer");deer.MoveSpeed=60000; // Isolated harvesting fixture only.
  testMap.Respawns.Add(new RespawnInfo{RespawnIndex=++envir.RespawnIndex,MonsterIndex=deer.Index,Location=new Point(301,625),Spread=0,Count=1,Delay=60});
  testMap.Respawns.Add(new RespawnInfo{RespawnIndex=++envir.RespawnIndex,MonsterIndex=envir.MonsterInfoList.Single(m=>m.Name=="BichonScarecrow").Index,Location=new Point(305,626),Spread=0,Count=1,Delay=60});
  envir.SaveDB();
  using var json=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,"credentials.json")));
  var id=json.RootElement.GetProperty("account").GetString()!;
  if(envir.AccountList.Any(a=>a.AccountID==id))return;
  var account=new AccountInfo{Index=++envir.NextAccountID,AccountID=id,Password=json.RootElement.GetProperty("password").GetString()!,Gold=10000,CreationDate=DateTime.Now};
  var map=envir.MapInfoList.Single(m=>m.FileName=="0");
  foreach(var spec in new[]{("细节战士验收",MirClass.Warrior,7),("细节法师验收",MirClass.Wizard,7)}){
   var role=new CharacterInfo{Index=++envir.NextCharacterID,Name=spec.Item1,AccountInfo=account,Class=spec.Item2,Gender=MirGender.Male,Level=(ushort)spec.Item3,HP=40,MP=40,CurrentMapIndex=map.Index,CurrentLocation=new Point(288,615),BindMapIndex=map.Index,BindLocation=new Point(288,615),CreationIP="127.0.0.1",CreationDate=DateTime.Now};
   role.Equipment[0]=envir.CreateFreshItem(envir.ItemInfoList.Single(i=>i.Name=="BichonSword"));role.Equipment[1]=envir.CreateFreshItem(envir.ItemInfoList.Single(i=>i.Name=="BichonRobe"));
   role.Heroes=new HeroInfo[role.MaximumHeroCount];account.Characters.Add(role);envir.CharacterList.Add(role);
  }
  envir.AccountList.Add(account);envir.SaveAccounts();
 }
}
