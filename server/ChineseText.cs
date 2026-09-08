// Presentation only: preserve upstream checks and interpolation arguments.
static class ChineseText
{
    public static void Apply()
    {
        var texts = new Dictionary<string,string> {
            ["GameName"]="热血传奇",["Welcome"]="欢迎来到{0}。",["OnlinePlayers"]="当前在线人数：{0}",
            ["LowLevel"]="等级不足。",["LowGold"]="金币不足。",["LevelUp"]="恭喜你升级了！生命和魔法已经恢复。",
            ["CannotPickupNotOwner"]="物品暂时属于其他玩家。",["YouCannotCarryAnymore"]="背包空间或负重不足。",["NothingWasFound"]="没有找到可采集的物品。",
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
