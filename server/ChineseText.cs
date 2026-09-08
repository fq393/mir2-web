// Presentation only: preserve upstream checks and interpolation arguments.
static class ChineseText
{
    public static void Apply()
    {
        var texts = new Dictionary<string,string> {
            ["NotGroupLeader"]="你不是队长。",
            ["YouGroupMaxMembers"]="队伍人数已满。",
            ["YouCannotInviteOnSoloMaps"]="当前地图不能邀请组队。",
            ["CouldNotBeFound"]="找不到角色：{0}。",
            ["CannotGroupSelf"]="不能邀请自己。",
            ["NotAllowGroup"]="{0}没有允许组队。",
            ["AlreadyInAnotherGroup"]="{0}已经在其他队伍中。",
            ["AlreadyReceivingInviteFromOtherPlayer"]="{0}正在处理其他组队邀请。",
            ["SoloMapTargetCannotAccept"]="{0}所在地图不能组队。",
            ["SoloMapCannotAccept"]="当前地图不能接受组队邀请。",
            ["NotInGroup"]="你还没有加入队伍。",
            ["NotInYourGroup"]="{0}不在你的队伍中。",
            ["NotInvitedToGroup"]="当前没有有效的组队邀请。",
            ["DeclinedGroupInvite"]="{0}拒绝了组队邀请。",
            ["CannotJoinGroup"]="无法加入{0}的队伍。",
            ["NoLongerGroupLeader"]="{0}已经不是队长。",
            ["GroupMaxMembers"]="{0}的队伍人数已满。",
            ["NotInAllowGroup"]="{0}已关闭允许组队。",
            ["PlayerNoLongerOnline"]="{0}已经离线。",
            ["CouldNotFind"]="找不到角色：{0}。",
            ["PlayerNotAcceptingMessages"]="对方没有接收私聊。",
            ["CannotMessageBlacklistedPlayer"]="无法向黑名单中的角色发送私聊。",
            ["TargetIsNotOnline"]="{0}没有在线。",
            ["CannotShoutForSeconds"]="请等待{0}秒后再喊话。",
            ["RequiredLevel8ForShout"]="达到8级后可以喊话。",
            ["ChatBanDuration5Minutes"]="发言过于频繁，暂停聊天5分钟。",
            ["ChatBanRemainingTimeByDay"]="还需等待{0}天{1}小时{2}分{3}秒才能发言。",
            ["ChatBanRemainingTimeByHour"]="还需等待{0}小时{1}分{2}秒才能发言。",
            ["ChatBanRemainingTimeByMinutes"]="还需等待{0}分{1}秒才能发言。",
            ["ChatBanRemainingTimeBySecond"]="还需等待{0}秒才能发言。",

            ["GameName"]="热血传奇",["Welcome"]="欢迎来到{0}。",["OnlinePlayers"]="当前在线人数：{0}",
            ["LowLevel"]="等级不足。",["LowGold"]="金币不足。",["LevelUp"]="恭喜你升级了！生命和魔法已经恢复。",
            ["CannotPickupNotOwner"]="物品暂时属于其他玩家。",["YouCannotCarryAnymore"]="背包空间或负重不足。",["NothingWasFound"]="没有找到可采集的物品。",["NoNearbyOwnedCarcasses"]="附近没有属于你或队伍的可采集尸体。",
            ["LowDC"]="攻击力不足。",["LowMC"]="魔法力不足。",["LowSC"]="道术不足。",
            ["NotFemale"]="需要女性角色。",["NotMale"]="需要男性角色。",["NoBagSpace"]="背包空间不足。",
            ["TooHeavyToTransfer"]="物品太重，无法转移。",["WeaponLuck"]="你的武器获得了幸运。",["WeaponCurse"]="你的武器受到了诅咒。",["WeaponNoEffect"]="没有产生效果。",
            ["YouCannotUsePotionsHere"]="这里不能使用药剂。",["NoTownTeleport"]="这里不能使用回城卷。",["CanNotRandom"]="这里不能使用随机传送卷。",["CanNotDungeon"]="这里不能使用地牢逃脱卷。",
            ["CannotResurrection"]="存活时不能使用复活卷。",["CanNotDrop"]="这里不能丢弃物品。",["BeenPoisoned"]="你中毒了。",
            ["FaceToTrade"]="请面对交易对象。",["HasConnected"]="{0}进入了游戏。",["ServerClosed"]="{0}已离线：服务器关闭。",["DoubleLogin"]="{0}已离线：账号重复登录。",
        };
        foreach(var (key,value) in texts) {
            if(!GameLanguage.ServerTextMap.Text.ContainsKey(key))throw new InvalidOperationException("Unknown upstream language key: "+key);
            GameLanguage.ServerTextMap.Text[key]=value;
        }
    }
}
