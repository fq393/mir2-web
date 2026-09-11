using Server.MirDatabase;
using Server.MirObjects;

namespace Mir2.WebHost;

// Called synchronously by the world-thread account serializer, never a background worker.
// The existing binary schema restores unfinished offers to their original owners.
public static class TradeAccountSnapshot
{
    public static void Write(BinaryWriter writer, AccountInfo account, IEnumerable<PlayerObject> players)
    {
        var projections = new List<(CharacterInfo Role, UserItem[] Original, UserItem[] Saved)>();
        ulong gold = account.Gold;
        foreach (var player in players.Where(p => ReferenceEquals(p.Account, account)))
            gold = checked(gold + player.TradeGoldAmount);
        if (gold > uint.MaxValue) throw new InvalidDataException("Trade refund exceeds account capacity; snapshot rejected.");
        foreach (var role in account.Characters)
        {
            if (!role.Trade.Any(i => i != null)) continue;
            var saved = (UserItem[])role.Inventory.Clone();
            foreach (var item in role.Trade.Where(i => i != null))
            {
                if (saved.Any(i => i != null && i.UniqueID == item.UniqueID))
                    throw new InvalidDataException("Duplicate escrow identity; snapshot rejected.");
                int slot = Array.FindIndex(saved, i => i == null);
                if (slot < 0) throw new InvalidDataException("Trade refund exceeds bag capacity; snapshot rejected.");
                saved[slot] = item;
            }
            projections.Add((role, role.Inventory, saved));
        }
        uint originalGold = account.Gold;
        try
        {
            account.Gold = (uint)gold;
            foreach (var p in projections) p.Role.Inventory = p.Saved;
            account.Save(writer);
        }
        finally
        {
            account.Gold = originalGold;
            foreach (var p in projections) p.Role.Inventory = p.Original;
        }
    }
}
