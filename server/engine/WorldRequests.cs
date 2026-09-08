using System.Collections.Concurrent;
using Server.MirEnvir;
namespace Mir2.WebHost;
/// <summary>Bounded bridge requests; all PlayerObject reads/writes run on the game thread.</summary>
public static class WorldRequests {
 static readonly ConcurrentQueue<Action<Envir>> queue=new();
 public static async Task<T> Run<T>(Func<Envir,T> work,CancellationToken ct){
  if(queue.Count>=128)throw new InvalidOperationException("服务器忙，请稍后重试。");
  var result=new TaskCompletionSource<T>(TaskCreationOptions.RunContinuationsAsynchronously);
  using var registration=ct.Register(()=>result.TrySetCanceled(ct));
  queue.Enqueue(envir=>{if(result.Task.IsCompleted)return;try{result.TrySetResult(work(envir));}catch(Exception e){result.TrySetException(e);}});
  return await result.Task;
 }
 public static void Drain(Envir envir){for(int i=0;i<16&&queue.TryDequeue(out var work);i++)work(envir);}
}
