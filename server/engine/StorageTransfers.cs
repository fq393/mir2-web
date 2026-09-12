using Server.MirObjects;
using Server.MirEnvir;
namespace Mir2.WebHost;

// Called only on the world thread. A request names both slot and immutable item ID.
// Capacity/NPC opening belongs to the sourced content layer, not to this transaction.
public static class StorageTransfers
{
    public static void Commit(Envir envir, PlayerObject player, uint npcId, ulong uniqueId, int from, int to, bool deposit)
        => Apply(player, npcId, uniqueId, from, to, deposit, () => envir.SaveStorageAccountsOrThrow(player));

    public static void Apply(PlayerObject player, uint npcId, ulong uniqueId, int from, int to, bool deposit, Action persist)
    {
        if (player?.Info == null || player.Account == null || player.Dead || player.CurrentMap == null)
            throw new InvalidOperationException("当前不能办理仓库业务。");
        if (player.NPCObjectID != npcId || player.NPCPage == null ||
            !string.Equals(player.NPCPage.Key, NPCScript.StorageKey, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("请重新与保管员交谈。");
        var npc = player.CurrentMap.NPCs.FirstOrDefault(n => n.ObjectID == npcId);
        if (npc == null || npc.ScriptID != player.NPCScriptID || !Functions.InRange(npc.CurrentLocation, player.CurrentLocation, Globals.DataRange))
            throw new InvalidOperationException("距离保管员太远。");
        if (player.TradePartner != null || player.Info.Trade.Any(i => i != null))
            throw new InvalidOperationException("请先结束当前交易。");
        var storage = CharacterStorage.Get(player.Info);
        if (storage.Length == 0) throw new InvalidOperationException("仓库尚未开启。");
        var source = deposit ? player.Info.Inventory : storage;
        var destination = deposit ? storage : player.Info.Inventory;
        if (from < 0 || from >= source.Length || to < 0 || to >= destination.Length)
            throw new InvalidOperationException("物品位置已变化，请重新选择。");
        var item = source[from];
        if (uniqueId == 0 || item == null || item.UniqueID != uniqueId || item.Count == 0 || item.Info == null)
            throw new InvalidOperationException("物品已变化，请重新选择。");
        if (destination[to] != null) throw new InvalidOperationException(deposit ? "仓库位置已被占用。" : "包裹位置已被占用。");
        if (deposit && (item.Info.Bind.HasFlag(BindMode.DontStore) || item.RentalInformation?.BindingFlags.HasFlag(BindMode.DontStore) == true))
            throw new InvalidOperationException("该物品不能存入仓库。");
        // Delphi ClientTakeBackStorageItem checks IsAddWeightAvailable before AddItemToBag.
        if (!deposit && player.Info.Inventory.Where(i => i != null).Sum(i => (long)i.Weight) + item.Weight > player.Stats[Stat.BagWeight])
            throw new InvalidOperationException("包裹负重不足。");
        ArgumentNullException.ThrowIfNull(persist);
        source[from] = null; destination[to] = item;
        try { player.RefreshBagWeight(); persist(); }
        catch
        {
            destination[to] = null; source[from] = item; player.RefreshBagWeight();
            throw;
        }
        // No success packet is sent before persist. The bridge publishes the saved state.
    }
}
