using Server.MirDatabase;
using Server.MirEnvir;
using Server.MirObjects;
namespace Mir2.WebHost;

// One instance per WebSocket. World state is inspected only on the world thread;
// Cancel/Close may also be called by the connection's packet reader.
public sealed class StorageSession
{
    readonly object gate = new();
    Pending pending;
    bool closed;
    sealed record Pending(string Token, CharacterInfo Role, Map Map, NPCPage Page,
        uint NpcId, int ScriptId, ulong UniqueId, int From, int To, bool Deposit);

    public void Cancel() { lock (gate) pending = null; }
    public void Close() { lock (gate) { closed = true; pending = null; } }

    public string Prepare(PlayerObject player, uint npcId, ulong uniqueId, int from, int to, bool deposit)
    {
        lock (gate)
        {
            pending = null; // A failed replacement must not leave an earlier confirmation usable.
            if (closed) throw new InvalidOperationException("连接已关闭，请重新登录。");
            StorageTransfers.Validate(player, npcId, uniqueId, from, to, deposit);
            var token = Guid.NewGuid().ToString("N");
            pending = new(token, player.Info, player.CurrentMap, player.NPCPage,
                npcId, player.NPCScriptID, uniqueId, from, to, deposit);
            return token;
        }
    }

    public void Commit(Envir envir, PlayerObject player, string token)
        => Apply(player, token, () => envir.SaveStorageAccountsOrThrow(player));

    public void Apply(PlayerObject player, string token, Action persist)
    {
        Pending operation;
        lock (gate)
        {
            operation = pending;
            pending = null; // Consume before validation and disk IO, including failed attempts.
            if (closed || operation == null || operation.Token != token)
                throw new InvalidOperationException("本次存取已失效，请重新选择物品。");
        }
        if (player == null || player.Info != operation.Role || player.CurrentMap != operation.Map ||
            player.NPCPage != operation.Page || player.NPCScriptID != operation.ScriptId)
            throw new InvalidOperationException("仓库对话已变化，请重新与保管员交谈。");
        StorageTransfers.Apply(player, operation.NpcId, operation.UniqueId, operation.From,
            operation.To, operation.Deposit, persist);
    }
}
