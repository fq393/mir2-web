using System.Collections.Concurrent;
using Server.MirEnvir;
namespace Mir2.WebHost;
public sealed record WorldVitals(uint ObjectId,int HP,int MP,int MaxHP,int MaxMP,int Level,long Experience,long MaxExperience,int BagWeight,int MaxBagWeight,int HandWeight,int MaxHandWeight,int WearWeight,int MaxWearWeight);
/// <summary>Only the single Crystal game thread touches mutable PlayerObject/Stats.</summary>
public static class WorldSnapshots {
 static readonly ConcurrentDictionary<uint,WorldVitals> latest=new();
 static long next;
 public static WorldVitals Read(uint id)=>latest.TryGetValue(id,out var value)?value:null;
 public static void Publish(Envir envir){
  if(envir.Time<next)return;next=envir.Time+100;
  var online=new HashSet<uint>();
  foreach(var p in envir.Players){
   if(p.Stats==null)continue;online.Add(p.ObjectID);
   latest[p.ObjectID]=new(p.ObjectID,p.HP,p.MP,p.Stats[Stat.HP],p.Stats[Stat.MP],p.Level,p.Experience,p.MaxExperience,p.CurrentBagWeight,p.Stats[Stat.BagWeight],p.CurrentHandWeight,p.Stats[Stat.HandWeight],p.CurrentWearWeight,p.Stats[Stat.WearWeight]);
  }
  foreach(var id in latest.Keys)if(!online.Contains(id))latest.TryRemove(id,out _);
 }
}
