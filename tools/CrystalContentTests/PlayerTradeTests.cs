using System.Drawing;
using Server;
using Server.MirDatabase;
using Server.MirEnvir;
using Server.MirNetwork;
using Server.MirObjects;

static class PlayerTradeTests
{
    public static void Run(Envir envir, MirConnection connection)
    {
        var failures = new List<string>();
        void Check(bool value, string name) { if (!value) failures.Add(name); }
        var map = new Map(new MapInfo { Index = 996, FileName = "player-trade-fixture" });
        RecordingPlayer Player(string name, int x, MirDirection direction) {
            var p = new RecordingPlayer {
                Info = new CharacterInfo { Name = name, Level = 7 },
                Account = new AccountInfo { Gold = 1000 }, Stats = new Stats { [Stat.BagWeight] = 1000 },
                Connection = connection, CurrentMap = map, CurrentLocation = new Point(x, 5), Direction = direction,
                AllowTrade = true
            };
            p.Report = new Reporting(p); p.Info.Mount = new MountInfo(p); return p;
        }
        var a = Player("交易甲", 5, MirDirection.Right);
        var b = Player("交易乙", 6, MirDirection.Left);
        var definition = envir.ItemInfoList.First(i => i.Name == "牛角戒指");
        var item = envir.CreateFreshItem(definition); item.AddedStats[Stat.MaxDC] = 3;
        a.Info.Inventory[6] = item;
        a.DepositTradeItem(6, 0);
        Check(a.Info.Inventory[6] == item && a.Info.Trade[0] == null, "orphan deposit removed inventory item");
        // Reset only isolated fixture data so all regressions report in one run.
        a.Info.Inventory[6] = item; a.Info.Trade[0] = null;
        foreach (var invalid in new[] { "distance", "map", "dead", "direction", "disabled" }) {
            b.TradeInvitation = a;
            if (invalid == "distance") b.CurrentLocation = new Point(30, 5);
            if (invalid == "map") b.CurrentMap = new Map(new MapInfo { Index = 995 });
            if (invalid == "dead") a.Dead = true;
            if (invalid == "direction") b.Direction = MirDirection.Right;
            if (invalid == "disabled") b.AllowTrade = false;
            b.TradeReply(true);
            Check(a.TradePartner == null && b.TradePartner == null && b.TradeInvitation == null, "stale invitation accepted: " + invalid);
            a.TradePartner = b.TradePartner = null; a.Dead = false; b.AllowTrade = true;
            b.CurrentMap = map; b.CurrentLocation = new Point(6, 5); b.Direction = MirDirection.Left;
        }
        b.TradeInvitation = a; b.TradeReply(false);
        Check(a.TradePartner == null && b.TradePartner == null && b.TradeInvitation == null, "refusal opened session");
        b.TradeInvitation = a; b.TradeReply(true);
        Check(a.TradePartner == b && b.TradePartner == a, "valid invitation rejected");
        b.CurrentLocation = new Point(30, 5);
        a.TradeGold(10);
        Check(a.Account.Gold == 1000 && a.TradeGoldAmount == 0, "stale session accepted gold deposit");
        b.CurrentLocation = new Point(6, 5);
        // Incoming earnings while gold is escrowed must not wrap a repeated deposit.
        a.TradeGoldAmount = uint.MaxValue - 5;
        a.TradeGold(10);
        Check(a.TradeGoldAmount == uint.MaxValue - 5 && a.Account.Gold == 1000,
            "repeated gold deposit overflowed escrow or debited wallet");
        a.TradeGoldAmount = 0; a.Account.Gold = 1000;
        a.DepositTradeItem(6, 0);
        Check(a.Info.Inventory[6] == null && a.Info.Trade[0] == item, "valid deposit failed");
        for (var i = 0; i < b.Info.Inventory.Length; i++) b.Info.Inventory[i] = envir.CreateFreshItem(definition);
        a.TradeConfirm(true); b.TradeConfirm(true);
        Check(!a.TradeLocked && !b.TradeLocked, "capacity rejection left confirmations locked");
        Check(a.Info.Trade[0] == item && item.AddedStats[Stat.MaxDC] == 3, "capacity rejection lost escrow/bonus");
        Array.Clear(b.Info.Inventory);
        a.TradeConfirm(true);
        Check(a.Info.Trade[0] == item && !b.Info.Inventory.Contains(item), "single confirmation committed after capacity rejection");
        // A separate valid pair verifies gold-overflow rejection.
        a.TradePartner = b; b.TradePartner = a; a.TradeLocked = b.TradeLocked = false;
        a.Info.Trade[0] = null; a.Info.Inventory[6] = item;
        a.TradeGold(10); b.Account.Gold = uint.MaxValue;
        a.TradeConfirm(true); b.TradeConfirm(true);
        Check(!a.TradeLocked && !b.TradeLocked && a.TradeGoldAmount == 10 && a.Account.Gold == 990,
            "wallet rejection did not preserve escrow and clear confirmations");
        b.Account.Gold = 1000; a.TradeLocked = b.TradeLocked = false;
        a.DepositTradeItem(6, 0); a.TradeCancel(); a.TradeCancel();
        Check(a.Info.Inventory.Count(i => i == item) == 1 && !a.Info.Trade.Contains(item) && a.Account.Gold == 1000 && a.TradeGoldAmount == 0,
            "cancel/duplicate cancel changed item identity, bonus or gold");
        Check(a.TradePartner == null && b.TradePartner == null, "cancel did not end both sessions");
        // Real successful exchange; repeat confirmation must not transfer twice.
        b.TradeInvitation = a; b.TradeReply(true);
        var slot = Array.IndexOf(a.Info.Inventory, item);
        a.DepositTradeItem(slot, 0); a.TradeGold(10);
        a.TradeConfirm(true); b.TradeConfirm(true);
        a.TradeConfirm(true); b.TradeConfirm(true);
        Check(!a.Info.Inventory.Contains(item) && !a.Info.Trade.Contains(item) && b.Info.Inventory.Count(i => i == item) == 1 && item.AddedStats[Stat.MaxDC] == 3,
            "successful exchange changed identity/bonus or duplicated item");
        Check(a.Account.Gold == 990 && b.Account.Gold == 1010 && a.TradeGoldAmount == 0 && a.TradePartner == null && b.TradePartner == null,
            "successful exchange or duplicate confirmation changed gold/session");
        // A full bag lends its freed slot to escrow, not to later purchases or pickups.
        var c = Player("返还甲", 5, MirDirection.Right);
        var d = Player("返还乙", 6, MirDirection.Left);
        for (var i = 0; i < c.Info.Inventory.Length; i++) c.Info.Inventory[i] = envir.CreateFreshItem(definition);
        var returned = c.Info.Inventory[6]; returned.AddedStats[Stat.MaxDC] = 3;
        d.TradeInvitation = c; d.TradeReply(true); c.DepositTradeItem(6, 0);
        Check(!c.CanGainItem(envir.CreateFreshItem(definition)), "pickup can consume the reserved return slot");
        Check(!c.CanGainItems(new[]{envir.CreateFreshItem(definition)}), "purchase can consume the reserved return slot");
        var worn = envir.CreateFreshItem(definition); c.Info.Equipment[(int)EquipmentSlot.RingL] = worn;
        c.RemoveItem(MirGridType.Inventory, worn.UniqueID, 6);
        Check(c.Info.Inventory[6]==null && c.Info.Equipment[(int)EquipmentSlot.RingL]==worn, "unequip consumed return reservation");
        c.RetrieveTradeItem(0,6);
        Check(c.Info.Inventory[6]==returned && c.Info.Trade[0]==null, "reservation prevented explicit withdrawal");
        c.DepositTradeItem(6,0);
        c.TradeCancel(); c.TradeCancel();
        Check(c.Info.Inventory.Count(i=>i==returned)==1 && returned.AddedStats[Stat.MaxDC]==3 && !c.Info.Trade.Any(i=>i!=null), "full-bag cancellation did not return the exact item");
        d.TradeInvitation = c; d.TradeReply(true); c.Account.Gold = uint.MaxValue; c.TradeGold(10);
        Check(!c.CanGainGold(1), "incoming gold can consume escrow refund capacity");
        c.GainGold(10); Check(c.Account.Gold==uint.MaxValue-10 && c.TradeGoldAmount==10, "earnings overwrote reserved gold"); c.TradeCancel(); c.TradeCancel();
        Check(c.Account.Gold==uint.MaxValue && c.TradeGoldAmount==0, "escrow refund truncated or duplicated at wallet cap");
        // Both outgoing slots become available together at final settlement.
        for (var i=0;i<d.Info.Inventory.Length;i++) d.Info.Inventory[i]=envir.CreateFreshItem(definition);
        var other=d.Info.Inventory[6]; d.TradeInvitation=c; d.TradeReply(true);
        c.DepositTradeItem(6,0); d.DepositTradeItem(6,0);
        c.TradeConfirm(true); d.TradeConfirm(true);
        Check(c.Info.Inventory.Count(i=>i==other)==1 && d.Info.Inventory.Count(i=>i==returned)==1, "reservations blocked full-bag exchange");
        Check(!c.WebTradeCapacityReleased && !d.WebTradeCapacityReleased, "settlement bypass leaked outside confirmation");
        if (failures.Count > 0) throw new Exception("Player trade regressions: " + string.Join("; ", failures));
        Console.WriteLine("PASS real player trade: stale invitations, orphan deposit, capacity/wallet re-confirmation, escrow identity/+3 and duplicate cancellation.");
    }
}
