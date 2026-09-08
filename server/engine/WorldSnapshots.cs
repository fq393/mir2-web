using System.Collections.Concurrent;
using Server.MirEnvir;
namespace Mir2.WebHost;
public sealed record WorldVitals(uint ObjectId,int HP,int MP,int MaxHP,int MaxMP,int Level,long Experience,long MaxExperience,int BagWeight,int MaxBagWeight,int HandWeight,int MaxHandWeight,int WearWeight,int MaxWearWeight,WorldAttributes Attributes);
public sealed record WorldAttributes(int MinAC,int MaxAC,int MinMAC,int MaxMAC,int MinDC,int MaxDC,int MinMC,int MaxMC,int MinSC,int MaxSC,int Accuracy,int Agility);
/// <summary>Only the single Crystal game thread touches mutable PlayerObject/Stats.</summary>
public static class WorldSnapshots {
 static readonly ConcurrentDictionary<uint,WorldVitals> latest=new();
 static long next;
 public static WorldVitals Read(uint id)=>latest.TryGetValue(id,out var value)?value:null;
 public static void Publish(Envir envir){
  WorldRequests.Drain(envir);
  if(envir.Time<next)return;next=envir.Time+100;
  var online=new HashSet<uint>();
  foreach(var p in envir.Players){
   if(p.Stats==null)continue;online.Add(p.ObjectID);
   latest[p.ObjectID]=new(p.ObjectID,p.HP,p.MP,p.Stats[Stat.HP],p.Stats[Stat.MP],p.Level,p.Experience,p.MaxExperience,p.CurrentBagWeight,p.Stats[Stat.BagWeight],p.CurrentHandWeight,p.Stats[Stat.HandWeight],p.CurrentWearWeight,p.Stats[Stat.WearWeight],new(p.Stats[Stat.MinAC],p.Stats[Stat.MaxAC],p.Stats[Stat.MinMAC],p.Stats[Stat.MaxMAC],p.Stats[Stat.MinDC],p.Stats[Stat.MaxDC],p.Stats[Stat.MinMC],p.Stats[Stat.MaxMC],p.Stats[Stat.MinSC],p.Stats[Stat.MaxSC],p.Stats[Stat.Accuracy],p.Stats[Stat.Agility]));
  }
  foreach(var id in latest.Keys)if(!online.Contains(id))latest.TryRemove(id,out _);
 }
}
