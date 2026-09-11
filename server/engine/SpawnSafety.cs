using System.Drawing;
using Server.MirDatabase;
using Server.MirEnvir;
namespace Mir2.WebHost;
// Only the explicitly imported wildlife profile participates. Guards/pets are untouched.
public static class SpawnSafety {
 static HashSet<string> species=new(StringComparer.Ordinal);
 public static void SetSpecies(IEnumerable<MonsterInfo> imported)=>species=imported.Select(m=>m.Name).ToHashSet(StringComparer.Ordinal);
 public static bool Allows(Map map,MonsterInfo monster,Point cell)=>!species.Contains(monster.Name)||map.GetSafeZone(cell)==null;
}
