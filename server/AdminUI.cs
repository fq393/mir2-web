using System.Security.Cryptography;
using System.Text.Json;
static class AdminUI {
 public static void Map(WebApplication app,string root){
  var nonce=Convert.ToHexString(RandomNumberGenerator.GetBytes(32));var gate=new object();
  var started=ContentProfiles.Names.ToDictionary(n=>n,n=>ContentProfiles.Hash(ContentProfiles.Read(root,n)));
  app.MapGet("/admin",()=>Results.Content(File.ReadAllText(Path.Combine(root,"server/admin.html")).Replace("__CSRF__",nonce),"text/html; charset=utf-8"));
  app.MapGet("/admin/config/{name}",(string name)=>{
   if(!ContentProfiles.Names.Contains(name))return Results.NotFound();var text=ContentProfiles.Read(root,name);
   return Results.Json(new{name,etag=ContentProfiles.Hash(text),pending=started[name]!=ContentProfiles.Hash(text),custom=File.Exists(ContentProfiles.PathFor(root,name)),content=JsonSerializer.Deserialize<JsonElement>(text)});
  });
  app.MapPost("/admin/config/{name}",async(HttpRequest request,string name)=>{
   if(request.Headers["X-Mir-CSRF"]!=nonce||request.Headers.Origin!=$"{request.Scheme}://{request.Host}"||!new[]{"127.0.0.1","localhost","[::1]"}.Contains(request.Host.Host))return Results.StatusCode(403);
   if(!ContentProfiles.Names.Contains(name))return Results.NotFound();
   if(request.ContentLength is null or >131072)return Results.BadRequest(new{message="配置超过大小限制。"});
   try{using var body=await JsonDocument.ParseAsync(request.Body);bool restore=body.RootElement.TryGetProperty("restore",out var reset)&&reset.ValueKind==JsonValueKind.True;var json=restore?File.ReadAllText(ContentProfiles.PathFor(root,name,true)):ContentProfiles.Validate(root,name,body.RootElement.GetProperty("content").GetRawText());
    lock(gate){var current=ContentProfiles.Read(root,name);if(body.RootElement.GetProperty("etag").GetString()!=ContentProfiles.Hash(current))return Results.Conflict(new{message="配置已被其他窗口修改，请重新载入。"});
     var path=ContentProfiles.PathFor(root,name);Directory.CreateDirectory(Path.GetDirectoryName(path)!);var backup=path+"."+DateTime.UtcNow.ToString("yyyyMMddHHmmssfff")+".bak";File.WriteAllText(backup,current);var temp=path+".tmp";File.WriteAllText(temp,json);File.Move(temp,path,true);if(restore)File.Delete(path);
     return Results.Json(new{message="自定义配置已保存；重启本地服务器后生效，原基线未改动。",etag=ContentProfiles.Hash(json)});
    }
   }catch(Exception e)when(e is JsonException or InvalidDataException or InvalidOperationException or KeyNotFoundException){return Results.BadRequest(new{message=e.Message});}
  });
 }
}
