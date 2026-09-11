using Server;
using Server.MirObjects;
using S = ServerPackets;

namespace Mir2.WebHost;

// World-thread transaction boundary. Notifications are released only after persist returns.
public static class PlayerTradeCommit
{
    public static bool Apply(PlayerObject first, PlayerObject second, Action persist)
    {
        var pair = new[] { first, second };
        var bags = pair.Select(p => (UserItem[])p.Info.Inventory.Clone()).ToArray();
        var offers = pair.Select(p => (UserItem[])p.Info.Trade.Clone()).ToArray();
        var gold = pair.Select(p => p.Account.Gold).ToArray();
        var escrow = pair.Select(p => p.TradeGoldAmount).ToArray();
        var counts = bags.Concat(offers).SelectMany(a => a).Where(i => i != null).Distinct().ToDictionary(i => i, i => i.Count);
        if (pair.Any(p => p.WebTradeNotifications != null)) throw new InvalidOperationException("Nested trade commit.");
        foreach (var p in pair) p.WebTradeNotifications = new List<Packet>();
        try
        {
            for (int i = 0; i < 2; i++)
            {
                var owner = pair[i]; var receiver = pair[1 - i];
                for (int slot = 0; slot < owner.Info.Trade.Length; slot++)
                {
                    var item = owner.Info.Trade[slot]; if (item == null) continue;
                    receiver.GainItem(item); owner.Info.Trade[slot] = null;
                }
                receiver.GainGold(owner.TradeGoldAmount); owner.TradeGoldAmount = 0;
            }
            persist();
        }
        catch (Exception error)
        {
            foreach (var entry in counts) entry.Key.Count = entry.Value;
            for (int i = 0; i < 2; i++)
            {
                var p = pair[i];
                Array.Copy(bags[i], p.Info.Inventory, bags[i].Length);
                Array.Copy(offers[i], p.Info.Trade, offers[i].Length);
                p.Account.Gold = gold[i]; p.TradeGoldAmount = escrow[i];
                p.WebTradeNotifications = null; p.TradeLocked = false; p.RefreshBagWeight();
            }
            MessageQueue.Instance.Enqueue(error);
            foreach (var p in pair)
            {
                p.Enqueue(new S.TradeCancel { Unlock = true });
                p.ReceiveChat("交易保存失败，物品和金币未交换，请重新确认。", ChatType.System);
            }
            return false;
        }
        // Durable point passed. A notification failure must never undo saved ownership.
        var notifications = pair.Select(p => p.WebTradeNotifications!).ToArray();
        foreach (var p in pair) { p.WebTradeNotifications = null; p.TradeLocked = false; p.TradePartner = null; }
        for (int i = 0; i < 2; i++)
        {
            try
            {
                for(int slot=0;slot<offers[i].Length;slot++)
                    if(offers[i][slot] is {} item) pair[i].Report.ItemMoved(item, MirGridType.Trade, MirGridType.Inventory, slot, -99, "玩家交易已保存");
                if(escrow[i]>0) pair[i].Report.GoldChanged(escrow[i], true, "玩家交易已保存");
            }
            catch(Exception error) { MessageQueue.Instance.Enqueue(error); }
            try
            {
                foreach (var packet in notifications[i]) pair[i].Enqueue(packet);
                pair[i].ReceiveChat("交易成功。", ChatType.System);
                pair[i].Enqueue(new S.TradeConfirm());
            }
            catch (Exception error) { MessageQueue.Instance.Enqueue(error); }
        }
        return true;
    }
}
