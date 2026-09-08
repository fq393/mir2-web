using Mir2.WebHost;
using Server.MirDatabase;
using Server.MirObjects;
public static class SkillBindingTests {
 public static void Run(){
  void Check(bool value,string message){if(!value)throw new Exception(message);}
  var p=new PlayerObject{Info=new CharacterInfo()};
  var fire=new UserMagic(Spell.FireBall){Key=1,Level=2,Experience=19};
  var heal=new UserMagic(Spell.Healing){Key=2};p.Info.Magics.AddRange(new[]{fire,heal});
  var result=SkillBindings.Apply(p,(int)Spell.FireBall,2);
  Check(fire.Key==2&&heal.Key==0&&result.Single(b=>b.Spell==(byte)Spell.FireBall).Key==2,"key collision was not reassigned");
  foreach(var key in new[]{-1,9,17,255}){
   try{SkillBindings.Apply(p,(int)Spell.FireBall,key);throw new Exception("invalid key accepted");}catch(InvalidOperationException){}
   Check(fire.Key==2&&heal.Key==0,"invalid key mutated bindings");
  }
  try{SkillBindings.Apply(p,255,2);throw new Exception("unknown spell accepted");}catch(InvalidOperationException){}
  Check(fire.Key==2,"unknown spell cleared valid binding");
  SkillBindings.Apply(p,(int)Spell.Healing,8);
  Check(result.Single(b=>b.Spell==(byte)Spell.Healing).Key==0,"reply aliases live character state");
  SkillBindings.Apply(p,(int)Spell.FireBall,0);
  Check(fire.Key==0&&heal.Key==8,"unbinding changed another skill");
  SkillBindings.Apply(p,(int)Spell.FireBall,3);SkillBindings.Apply(p,(int)Spell.FireBall,3);
  using var stream=new MemoryStream();using(var writer=new BinaryWriter(stream,System.Text.Encoding.UTF8,true))fire.Save(writer);
  stream.Position=0;using var reader=new BinaryReader(stream);var restored=new UserMagic(reader,65,0);
  Check(restored.Key==3&&restored.Spell==fire.Spell&&restored.Level==2&&restored.Experience==19,"native skill persistence changed training or binding");
  Console.WriteLine("PASS skill keys: collision, unbind, F8 boundary, unknown/unlearned/out-of-range rejection, immutable reply, idempotence and native binary save/load.");
 }
}
