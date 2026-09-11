using Server.MirObjects;
namespace Mir2.WebHost;
public static class GoldDrops {
 // Called only on the world thread. Preserve Crystal's placement and LoseGold packet.
 public static void Drop(PlayerObject player,uint amount){
  if(player?.Info==null||player.Account==null||player.CurrentMap==null)throw new InvalidOperationException("角色已离线。");
  if(player.Dead)throw new InvalidOperationException("死亡时不能丢弃金币。");
  if(player.CurrentMap.Info.NoThrowItem)throw new InvalidOperationException("这里不能丢弃物品。");
  if(amount==0||amount>player.Account.Gold)throw new InvalidOperationException("金币数量无效或余额不足。");
  var before=player.Account.Gold;player.DropGold(amount);
  if(player.Account.Gold==before)throw new InvalidOperationException("附近没有可以放下金币的位置。");
 }
}
