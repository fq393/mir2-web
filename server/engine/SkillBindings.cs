using Server.MirObjects;
namespace Mir2.WebHost;
public sealed record SkillBinding(byte Spell,byte Key);
/// <summary>Game-thread adapter for Crystal 0e315fe MirConnection.MagicKey.
/// The classic client exposes None and F1-F8; it has no hero-key namespace.
/// </summary>
public static class SkillBindings {
 public static SkillBinding[] Apply(PlayerObject player,int spell,int key){
  if(player?.Info==null)throw new InvalidOperationException("角色已离线，请重新登录。");
  if(key<0||key>8)throw new InvalidOperationException("请选择 F1 至 F8，或不设置。");
  var selected=player.Info.Magics.FirstOrDefault(m=>(int)m.Spell==spell);
  // Validate first: an unknown spell must never clear another skill's key.
  if(selected==null)throw new InvalidOperationException("尚未学习该技能。");
  foreach(var magic in player.Info.Magics){
   if(magic==selected)magic.Key=(byte)key;
   else if(magic.Key==key)magic.Key=0;
  }
  return player.Info.Magics.Select(m=>new SkillBinding((byte)m.Spell,m.Key)).ToArray();
 }
}
