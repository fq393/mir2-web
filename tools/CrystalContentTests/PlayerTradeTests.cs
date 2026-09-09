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
        if (failures.Count > 0) throw new Exception("Player trade regressions: " + string.Join("; ", failures));
        Console.WriteLine("PASS real player trade: stale invitations, orphan deposit, capacity/wallet re-confirmation, escrow identity/+3 and duplicate cancellation.");
    }
}
