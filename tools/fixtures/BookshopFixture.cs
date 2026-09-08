using System.Drawing;
using System.Text.Json;
using Server.MirDatabase;
using Server.MirEnvir;
// Isolated browser prerequisites only. No skills/items are granted: buy and learn through UI.
static class BookshopFixture {
 public static void Seed(Envir envir,string root){
  if(!File.Exists(Path.Combine(root,"BOOKSHOP_QA_ONLY")))throw new InvalidOperationException("Missing isolated QA marker");
  // Stable UI fixture: only a passive deer near the shop, no live-world spawn changes.
  foreach(var area in envir.MapInfoList)area.Respawns.Clear();
  var testMap=envir.MapInfoList.Single(m=>m.FileName=="0");
  var deer=envir.MonsterInfoList.Single(m=>m.Name=="BichonDeer");
  testMap.Respawns.Add(new RespawnInfo{RespawnIndex=++envir.RespawnIndex,MonsterIndex=deer.Index,Location=new Point(322,254),Spread=0,Count=1,Delay=60});
  envir.SaveDB();
  using var json=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,"credentials.json")));
  var id=json.RootElement.GetProperty("account").GetString()!;
  if(envir.AccountList.Any(a=>a.AccountID==id))return;
  var account=new AccountInfo{Index=++envir.NextAccountID,AccountID=id,Password=json.RootElement.GetProperty("password").GetString()!,Gold=10000,CreationDate=DateTime.Now};
  var map=envir.MapInfoList.Single(m=>m.FileName=="0");
  foreach(var spec in new[]{("书店法师验收",MirClass.Wizard,7),("书店战士验收",MirClass.Warrior,7),("书店道士验收",MirClass.Taoist,7),("书店等级验收",MirClass.Wizard,6)}){
   var role=new CharacterInfo{Index=++envir.NextCharacterID,Name=spec.Item1,AccountInfo=account,Class=spec.Item2,Gender=MirGender.Male,Level=(ushort)spec.Item3,HP=40,MP=40,CurrentMapIndex=map.Index,CurrentLocation=new Point(324,252),BindMapIndex=map.Index,BindLocation=new Point(324,252),CreationIP="127.0.0.1",CreationDate=DateTime.Now};
   role.Heroes=new HeroInfo[role.MaximumHeroCount];account.Characters.Add(role);envir.CharacterList.Add(role);
  }
  envir.AccountList.Add(account);envir.SaveAccounts();
 }
}
