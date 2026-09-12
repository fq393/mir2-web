using System.Runtime.CompilerServices;
using Server.MirDatabase;
using Server.MirEnvir;

namespace Mir2.WebHost;

// World-thread only. No web endpoint or gameplay capacity is enabled by this layer.
// Appended to the SAME account snapshot, after Crystal's existing fields.
public static class CharacterStorage
{
    private const ulong Magic = 0x315247545332524D; // MR2STGR1
    private const int Version = 1;
    private const int MaximumSerializedSlots = 4096; // File validation bound, not a game rule.
    private static readonly ConditionalWeakTable<CharacterInfo, UserItem[]> Stores = new();

    public static UserItem[] Get(CharacterInfo role) => Stores.TryGetValue(role, out var items) ? items : Array.Empty<UserItem>();

    public static UserItem[] Initialize(CharacterInfo role, int capacity)
    {
        if (capacity <= 0 || capacity > MaximumSerializedSlots) throw new ArgumentOutOfRangeException(nameof(capacity));
        if (Stores.TryGetValue(role, out var existing))
        {
            if (existing.Length != capacity) throw new InvalidOperationException("仓库容量变更需要显式迁移。");
            return existing;
        }
        var items = new UserItem[capacity];
        Stores.Add(role, items);
        return items;
    }

    public static void Write(BinaryWriter writer, IEnumerable<AccountInfo> accounts)
    {
        var roles = accounts.SelectMany(a => a.Characters).ToArray();
        var stored = roles.Where(r => Get(r).Length > 0).ToArray();
        if (stored.Length == 0) return; // Existing accounts remain byte-format compatible.
        ValidateIdentities(accounts, stored.SelectMany(Get));
        if (roles.Select(r => r.Index).Distinct().Count() != roles.Length) throw new InvalidDataException("Duplicate character identity.");
        writer.Write(Magic); writer.Write(Version); writer.Write(stored.Length);
        foreach (var role in stored)
        {
            writer.Write(role.Index); var items = Get(role); writer.Write(items.Length);
            foreach (var item in items) { writer.Write(item != null); item?.Save(writer); }
        }
    }

    public static void Read(BinaryReader reader, Envir envir)
    {
        var roles = envir.AccountList.SelectMany(a => a.Characters).ToDictionary(r => r.Index);
        var loaded = new Dictionary<int, UserItem[]>();
        if (reader.BaseStream.Position < reader.BaseStream.Length)
        {
            if (reader.ReadUInt64() != Magic || reader.ReadInt32() != Version) throw new InvalidDataException("Unknown character storage format.");
            int count = reader.ReadInt32();
            if (count < 0 || count > roles.Count) throw new InvalidDataException("Invalid storage owner count.");
            for (int i = 0; i < count; i++)
            {
                int id = reader.ReadInt32(), capacity = reader.ReadInt32();
                if (!roles.ContainsKey(id) || loaded.ContainsKey(id) || capacity <= 0 || capacity > MaximumSerializedSlots)
                    throw new InvalidDataException("Invalid storage owner or capacity.");
                var items = new UserItem[capacity];
                for (int slot = 0; slot < capacity; slot++)
                {
                    if (!reader.ReadBoolean()) continue;
                    var item = new UserItem(reader, Envir.LoadVersion, Envir.LoadCustomVersion);
                    if (!envir.BindItem(item)) throw new InvalidDataException("Unknown stored item definition.");
                    items[slot] = item;
                }
                loaded.Add(id, items);
            }
            if (reader.BaseStream.Position != reader.BaseStream.Length) throw new InvalidDataException("Unexpected storage trailing data.");
            ValidateIdentities(envir.AccountList, loaded.Values.SelectMany(items => items));
        }
        // Publish only after the entire extension has parsed and validated.
        foreach (var role in roles.Values) Stores.Remove(role);
        foreach (var entry in loaded) Stores.Add(roles[entry.Key], entry.Value);
    }

    private static void ValidateIdentities(IEnumerable<AccountInfo> accounts, IEnumerable<UserItem> stored)
    {
        var owned = accounts.SelectMany(a => a.Storage.Concat(a.Characters.SelectMany(r => r.Inventory.Concat(r.Equipment).Concat(r.QuestInventory).Concat(r.Trade))));
        var ids = new HashSet<ulong>(owned.Where(i => i != null).Select(i => i.UniqueID));
        foreach (var item in stored.Where(i => i != null))
            if (item.UniqueID == 0 || item.Count == 0 || !ids.Add(item.UniqueID)) throw new InvalidDataException("Duplicate or invalid stored item identity.");
    }
}
