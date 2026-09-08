using System.Drawing;
using System.Text.Json;
using Server.MirDatabase;
using Server.MirEnvir;
// Only compiled by prepare-skillkeys-qa.py into an isolated, separately ported host.
// Cross-class skills and level are test fixtures, never a game content profile.
static class SkillKeysFixture {
 public static void Seed(Envir envir,string root){
  if(!File.Exists(Path.Combine(root,"SKILL_KEYS_QA_ONLY")))throw new InvalidOperationException("Missing isolated QA marker");
  using var json=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,"credentials.json")));
  var id=json.RootElement.GetProperty("account").GetString()!;
  if(envir.AccountList.Any(a=>a.AccountID==id))return;
  envir.MagicInfoList.Add(new MagicInfo{Spell=Spell.Healing,Name="治愈术",Level1=1,Level2=2,Level3=3,Need1=100,Need2=100,Need3=100});
  var account=new AccountInfo{Index=++envir.NextAccountID,AccountID=id,Password=json.RootElement.GetProperty("password").GetString()!,CreationDate=DateTime.Now};
  var map=envir.MapInfoList.Single(m=>m.FileName=="0");
  var role=new CharacterInfo{Index=++envir.NextCharacterID,Name="技能隔离验收",AccountInfo=account,Class=MirClass.Wizard,Gender=MirGender.Male,Level=7,HP=40,MP=40,CurrentMapIndex=map.Index,CurrentLocation=new Point(288,615),BindMapIndex=map.Index,BindLocation=new Point(288,615),CreationIP="127.0.0.1",CreationDate=DateTime.Now};
  role.Heroes=new HeroInfo[role.MaximumHeroCount];
  role.Magics.Add(new UserMagic(Spell.FireBall){Key=1});role.Magics.Add(new UserMagic(Spell.Healing){Key=2});
  account.Characters.Add(role);envir.AccountList.Add(account);envir.CharacterList.Add(role);
  envir.SaveDB();envir.SaveAccounts();
 }
}
