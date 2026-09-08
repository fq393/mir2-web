using System.Drawing;
using Mir2.WebHost;
using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Security.Cryptography;
using Server;
using Server.MirDatabase;
using Server.MirEnvir;
using C = ClientPackets;
using S = ServerPackets;

const int crystalPort = 17000;
var repoRoot = Path.GetFullPath(Environment.GetEnvironmentVariable("MIR2_ROOT") ?? "..");
var dataDir = Path.Combine(repoRoot, "server", "data");
Directory.CreateDirectory(dataDir);
Directory.SetCurrentDirectory(dataDir);
var keyPath=Path.Combine(dataDir,"bridge-key");
if(!File.Exists(keyPath)) {
    File.WriteAllText(keyPath,Convert.ToHexString(RandomNumberGenerator.GetBytes(32)));
    if(!OperatingSystem.IsWindows()) File.SetUnixFileMode(keyPath,UnixFileMode.UserRead|UnixFileMode.UserWrite);
}
var bridgeKey=File.ReadAllText(keyPath).Trim();
Packet.IsServer = true;
Settings.Load();
ChineseText.Apply();
Settings.IPAddress = "127.0.0.1";
Settings.Port = crystalPort;
Settings.CheckVersion = false; // No Windows Mir2.exe exists in this browser-only development spike.
Settings.EnforceDBChecks = false; // Isolated demo does not contain the complete commercial content database.
Settings.StartHTTPService = false;
Settings.Multithreaded = false;
Settings.MonsterRarityEnabled = false; // No later rarity/elite multipliers in this baseline.
Settings.AllowStartGame = true;
Settings.IPBlockSeconds = 0; // Several browser sessions share the loopback address.
Settings.MaxIP = 16;
var mapPath = Path.Combine(repoRoot, "raw-assets", "Map_0.map");
if (!File.Exists(mapPath)) throw new FileNotFoundException("Run the resource fetch first: real map0 required", mapPath);
File.Copy(mapPath, Path.Combine(Settings.MapPath, "0.map"), true);
var envir = Envir.Main;
// The optional Crystal status service has a hard-coded port 3000; disable it for this isolated host.
typeof(Envir).GetField("StatusPortEnabled", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(envir, false);
if (!File.Exists(Envir.DatabasePath))
{
    var map = new MapInfo { Index = 1, FileName = "0", Title = "Bichon browser spike", Light = LightSetting.Normal };
    map.SafeZones.Add(new SafeZoneInfo { Info = map, StartPoint = true, Location = new Point(288, 615), Size = 0 });
    envir.MapInfoList.Add(map);
    envir.MapIndex = 1;
    envir.SaveDB();
}
var roomPath=Path.Combine(repoRoot,"raw-assets/client-176/传奇私服1.76客户/Map/0105.map");
using(var roomPin=JsonDocument.Parse(File.ReadAllText(Path.Combine(repoRoot,"tools/interior-inputs.json")))) {
    var expected=roomPin.RootElement.GetProperty("mapSources").EnumerateArray().Single(s=>s.GetProperty("path").GetString()!.EndsWith("Map/0105.map")).GetProperty("sha256").GetString();
    if(!Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(roomPath))).Equals(expected,StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("Original room map hash mismatch");
}
File.Copy(roomPath,Path.Combine(Settings.MapPath,"0105.map"),true);
DemoSeed.Apply(envir, dataDir, repoRoot);
var logTask = Task.Run(async () => {
    while (true) { while (MessageQueue.Instance.MessageLog.TryDequeue(out var message)) Console.WriteLine("Crystal " + message.Trim()); await Task.Delay(100); }
});
envir.Start();
var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://127.0.0.1:17080");
var app = builder.Build();
app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(20) });
app.MapGet("/health", () => Results.Json(new { engine = "Suprcode/Crystal", upstreamCommit = "0e315fe327192afe52c3d7357ddd1f5b7e26c5b8", running = envir.Running, tcp = "127.0.0.1:17000", maps = envir.MapList.Count, players = envir.PlayerCount, monsters = envir.MonsterCount, websocket = "/ws", gameplay = "Crystal authoritative Bichon demo: equipment, shop, monsters, FireBall", demo = DemoSeed.Manifest(envir) }));
app.Map("/ws", async context => {
    if (!context.WebSockets.IsWebSocketRequest) { context.Response.StatusCode = 400; return; }
    // Only local browser development pages may connect to this loopback service.
    if (context.Request.Headers.TryGetValue("Origin", out var origins) &&
        (!Uri.TryCreate(origins.ToString(), UriKind.Absolute, out var origin) || !(origin.Host == "localhost" || IPAddress.TryParse(origin.Host, out var ip) && IPAddress.IsLoopback(ip))))
    { context.Response.StatusCode = 403; return; }
    using var ws = await context.WebSockets.AcceptWebSocketAsync();
    using var session = new BridgeSession(ws, crystalPort, bridgeKey);
    await session.Run(context.RequestAborted);
});
app.Lifetime.ApplicationStopping.Register(() => envir.Stop());
await app.RunAsync();

sealed class BridgeSession(WebSocket ws, int port, string bridgeKey) : IDisposable
{
    readonly TcpClient tcp = new();
    readonly SemaphoreSlim sendLock = new(1,1);
    readonly SemaphoreSlim tcpLock = new(1,1);
    static readonly int[] slots = new int[4];
    int slot = -1;
    string accountId = "", password = "", characterName = "";
    uint objectId;
    WorldVitals? lastVitals;
    Point lastLocation;
    string currentMap="0";
    readonly Dictionary<uint,string> peers = new();
    static readonly JsonSerializerOptions packetJson = new() { IncludeFields = true, IgnoreReadOnlyProperties = true, ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles, Converters = {new ColourConverter()} };
    readonly ConcurrentQueue<(string Type, int Direction, int? Seq)> pending = new();
    TaskCompletionSource? locationReply;
    int currentHP;
    readonly List<int> learnedSpells = new();
    static readonly MethodInfo readPacket = typeof(Packet).GetMethod("ReadPacket", BindingFlags.Instance | BindingFlags.NonPublic)!;
    public void Dispose() {
        tcp.Dispose();
        if(slot>=0) {Interlocked.Exchange(ref slots[slot],0);slot=-1;}
    }
    async Task Send(object value, CancellationToken ct) {
        var data = JsonSerializer.SerializeToUtf8Bytes(value);
        await sendLock.WaitAsync(ct);
        try { if(ws.State == WebSocketState.Open) await ws.SendAsync(data, WebSocketMessageType.Text, true, ct); }
        finally { sendLock.Release(); }
    }
    async Task Write(Packet packet, CancellationToken ct) {
        await tcpLock.WaitAsync(ct);
        try { await tcp.GetStream().WriteAsync(packet.GetPacketBytes().ToArray(), ct); }
        finally { tcpLock.Release(); }
    }
    // Crystal UserLocation has no request ID. One position-producing command may be
    // in flight; its retry queue can otherwise reorder attack/cast relative to walk.
    async Task LocationAction(Packet packet, string type, int direction, int? seq, CancellationToken ct) {
        var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        locationReply = completion;
        pending.Enqueue((type,direction,seq));
        await Write(packet,ct);
        // Never reuse an ambiguous stream after a silent upstream rejection or timeout.
        // Closing this session is safer than attributing a late reply to the next input.
        await completion.Task.WaitAsync(TimeSpan.FromSeconds(8),ct);
    }
    public async Task Run(CancellationToken requestCt) {
        using var lifetime = CancellationTokenSource.CreateLinkedTokenSource(requestCt);
        var ct = lifetime.Token;
        try {
            for(int i=0;i<slots.Length;i++) if(Interlocked.CompareExchange(ref slots[i],1,0)==0) {slot=i;break;}
            if(slot<0) throw new InvalidOperationException("All4 local Crystal guest slots are in use; close another tab first.");
            accountId="webslot"+slot.ToString("00");
            characterName="WebGuest"+slot;
            password=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(bridgeKey+accountId)))[..14];
            await tcp.ConnectAsync(IPAddress.Loopback, port, ct);
            var server = ReceiveCrystal(ct);
            var client = ReceiveBrowser(ct);
            var states = KeepAlive(ct);
            var completed = await Task.WhenAny(server, client, states);
            await completed;
            lifetime.Cancel();
            await Task.WhenAll(server, client, states);
        } catch (OperationCanceledException) { }
        catch (Exception e) {
            Console.WriteLine("Bridge: " + e);
            if(ws.State == WebSocketState.Open) await Send(new { type = "error", message = e.Message, source = "crystal-bridge" }, CancellationToken.None);
        } finally {
            lifetime.Cancel();
            if(ws.State == WebSocketState.Open) await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Crystal session ended", CancellationToken.None);
        }
    }
    async Task ReceiveCrystal(CancellationToken ct) {
        var stream = tcp.GetStream();
        while (!ct.IsCancellationRequested) {
            var header = new byte[4]; await stream.ReadExactlyAsync(header, ct);
            int length = BitConverter.ToUInt16(header); short id = BitConverter.ToInt16(header,2);
            if(length < 4) throw new InvalidDataException("Invalid Crystal packet length");
            var payload = new byte[length-4]; await stream.ReadExactlyAsync(payload,ct);
            var p = Packet.GetServerPacket(id);
            if(p == null) throw new InvalidDataException("Unknown Crystal server packet " + id);
            // Decode directly to avoid mutating Packet.IsServer, used concurrently by Crystal's listener.
            using var ms = new MemoryStream(p.Compressed ? Functions.DecompressBytes(payload) : payload);
            readPacket.Invoke(p, new object[] {new BinaryReader(ms)});
            if (p is not S.UserInformation && p is not S.LoginSuccess && p is not S.NewAccount && p is not S.Login && p is not S.KeepAlive)
                await Send(new {type="packet",source="crystal-tcp",packet=p.GetType().Name,data=JsonSerializer.SerializeToElement(p,p.GetType(),packetJson)},ct);
            switch(p) {
                case S.Connected:
                    await Send(new {type="transport", connected=true, engine="Crystal", packet="Connected", packetId=id, packetLength=length, tcp="127.0.0.1:17000"},ct);
                    await Write(new C.ClientVersion {VersionHash=Array.Empty<byte>()},ct); break;
                case S.ClientVersion v:
                    if(v.Result != 1) throw new InvalidOperationException("Crystal version rejected: " + v.Result);
                    await Send(new {type="protocol", packet="ClientVersion", result=v.Result},ct);
                    await Write(new C.Login {AccountID=accountId,Password=password},ct); break;
                case S.NewAccount a:
                    if(a.Result != 8) throw new InvalidOperationException("Crystal account creation result: "+a.Result);
                    await Write(new C.Login {AccountID=accountId,Password=password},ct); break;
                case S.Login login when login.Result == 3:
                    await Write(new C.NewAccount {AccountID=accountId,Password=password,UserName="WebGuest",BirthDate=new DateTime(2000,1,1),SecretQuestion="Development",SecretAnswer="Local",EMailAddress="guest@example.invalid"},ct); break;
                case S.Login login: throw new InvalidOperationException("Crystal login rejected: "+login.Result);
                case S.LoginSuccess loggedIn:
                    if(loggedIn.Characters.Count>0) { DemoSeed.Character(Envir.Main.CharacterList.First(c=>c.Index==loggedIn.Characters[0].Index)); await Write(new C.StartGame {CharacterIndex=loggedIn.Characters[0].Index},ct); }
                    else await Write(new C.NewCharacter {Name=characterName,Gender=MirGender.Male,Class=MirClass.Warrior},ct); break;
                case S.NewCharacter character: throw new InvalidOperationException("Crystal character rejected: "+character.Result);
                case S.NewCharacterSuccess created:
                    DemoSeed.Character(Envir.Main.CharacterList.First(c=>c.Index==created.CharInfo.Index));
                    await Write(new C.StartGame {CharacterIndex=created.CharInfo.Index},ct); break;
                case S.StartGame started:
                    await Send(new {type="protocol",packet="StartGame",result=started.Result},ct);
                    if(started.Result != 4) throw new InvalidOperationException("Crystal startgame result: "+started.Result); break;
                case S.UserInformation user when p.GetType() == typeof(S.UserInformation):
                    objectId=user.ObjectID;
                    lastLocation=user.Location;
                    currentHP=user.HP;
                    learnedSpells.Clear();foreach(var magic in user.Magics) learnedSpells.Add((int)magic.Spell);
                    await Send(new {type="ready",source="crystal-tcp",packet="UserInformation",objectId,name=user.Name,map=currentMap,x=user.Location.X,y=user.Location.Y,direction=(int)user.Direction,hp=user.HP,mp=user.MP,experience=user.Experience,maxExperience=user.MaxExperience,level=user.Level,@class=(int)user.Class,gender=(int)user.Gender,gold=user.Gold,inventory=DemoSeed.Items(user.Inventory),equipment=DemoSeed.Items(user.Equipment),magics=JsonSerializer.SerializeToElement(user.Magics,packetJson)},ct); break;
                case S.UserLocation location:
                    var hasCommand = pending.TryDequeue(out var request);
                    bool? accepted = hasCommand && request.Type is "walk" or "turn" ? (request.Type=="walk" ? location.Location!=lastLocation : (int)location.Direction==request.Direction) : null;
                    lastLocation=location.Location;
                    await Send(new {type="state",source="crystal-tcp",packet="UserLocation",objectId,map=currentMap,x=location.Location.X,y=location.Location.Y,direction=(int)location.Direction,accepted,seq=hasCommand?request.Seq:null,command=hasCommand?request.Type:null},ct);
                    if(hasCommand) { var completion=locationReply; locationReply=null;completion?.TrySetResult(); }
                    break;
                case S.MapInformation map: currentMap=map.FileName; break;
                case S.MapChanged map:
                    currentMap=map.FileName;lastLocation=map.Location;peers.Clear();
                    while(pending.TryDequeue(out _)){} locationReply?.TrySetResult();locationReply=null;
                    break;
                case S.NewMagic learned when !learned.Hero:
                    if(!learnedSpells.Contains((int)learned.Magic.Spell))learnedSpells.Add((int)learned.Magic.Spell);break;
                case S.RemoveMagic removedMagic:
                    if(removedMagic.PlaceId>=0&&removedMagic.PlaceId<learnedSpells.Count)learnedSpells.RemoveAt(removedMagic.PlaceId);break;
                case S.HealthChanged health: currentHP=health.HP; break;
                case S.ObjectDied dead when dead.ObjectID==objectId: currentHP=0; break;
                case S.ObjectPlayer peer:
                    peers[peer.ObjectID]=peer.Name;
                    await Send(new {type="peer",source="crystal-tcp",packet="ObjectPlayer",id=peer.ObjectID,name=peer.Name,x=peer.Location.X,y=peer.Location.Y,direction=(int)peer.Direction},ct); break;
                case S.ObjectWalk walk when peers.TryGetValue(walk.ObjectID,out var peerName):
                    await Send(new {type="peer",source="crystal-tcp",packet="ObjectWalk",id=walk.ObjectID,name=peerName,x=walk.Location.X,y=walk.Location.Y,direction=(int)walk.Direction},ct); break;
                case S.ObjectTurn turn when peers.TryGetValue(turn.ObjectID,out var turningName):
                    await Send(new {type="peer",source="crystal-tcp",packet="ObjectTurn",id=turn.ObjectID,name=turningName,x=turn.Location.X,y=turn.Location.Y,direction=(int)turn.Direction},ct); break;
                case S.ObjectRemove removed when peers.Remove(removed.ObjectID):
                    await Send(new {type="peerRemoved",source="crystal-tcp",packet="ObjectRemove",id=removed.ObjectID},ct); break;
                case S.Disconnect disconnected: throw new InvalidOperationException("Crystal disconnected: "+disconnected.Reason);
            }
        }
    }
    async Task ReceiveBrowser(CancellationToken ct) {
        var buffer = new byte[4096];
        while(!ct.IsCancellationRequested) {
            var result = await ws.ReceiveAsync(buffer,ct);
            if(result.MessageType==WebSocketMessageType.Close) {await ws.CloseOutputAsync(WebSocketCloseStatus.NormalClosure,"Goodbye",ct);return;}
            if(!result.EndOfMessage || result.MessageType!=WebSocketMessageType.Text) throw new InvalidDataException("Expected one JSON text message <=4096 bytes");
            using var doc=JsonDocument.Parse(buffer.AsMemory(0,result.Count));
            var command=doc.RootElement.GetProperty("type").GetString();
            if(command=="ping") {await Write(new C.KeepAlive {Time=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},ct);continue;}
            if(objectId!=0) {
                var r=doc.RootElement;
                int Num(string k,int fallback=0)=>r.TryGetProperty(k,out var v)?v.GetInt32():fallback;
                ulong Id(string k)=>r.GetProperty(k).ValueKind==JsonValueKind.String?ulong.Parse(r.GetProperty(k).GetString()!):r.GetProperty(k).GetUInt64();
                if(command is "attack" or "cast" or "harvest" && (Num("direction")<0 || Num("direction")>7)) throw new InvalidDataException("direction must be 0..7");
                Packet? action=command switch {
                    "revive"=>new C.TownRevive(),
                    "pickup"=>new C.PickUp(),
                    "harvest"=>new C.Harvest {Direction=(MirDirection)Num("direction")},
                    "attack"=>new C.Attack {Direction=(MirDirection)Num("direction"),Spell=Spell.None},
                    "cast"=>new C.Magic {ObjectID=objectId,Spell=(Spell)Num("spell",31),Direction=(MirDirection)Num("direction"),TargetID=(uint)Id("targetId"),Location=new Point(Num("x"),Num("y"))},
                    "use"=>new C.UseItem {Grid=MirGridType.Inventory,UniqueID=Id("uniqueId")},
                    "equip"=>new C.EquipItem {Grid=MirGridType.Inventory,UniqueID=Id("uniqueId"),To=Num("slot")},
                    "unequip"=>new C.RemoveItem {Grid=MirGridType.Inventory,UniqueID=Id("uniqueId"),To=Num("to")},
                    "npc"=>new C.CallNPC {ObjectID=(uint)Id("id"),Key=r.TryGetProperty("key",out var k)?k.GetString()!:"[@MAIN]"},
                    "buy"=>new C.BuyItem {ItemIndex=Id("itemIndex"),Count=(ushort)Math.Clamp(Num("count",1),1,100),Type=PanelType.Buy},
                    _=>null
                };
                if(action is C.Attack || action is C.Magic || action is C.Harvest) {
                    if(action is C.Magic magic) {
                        var info=Envir.Main.MagicInfoList.FirstOrDefault(m=>m.Spell==Spell.FireBall);
                        if(magic.Spell!=Spell.FireBall || !learnedSpells.Contains((int)magic.Spell) || currentHP<=0 || info==null ||
                           (magic.Location.X!=0 && magic.Location.Y!=0 && info.Range!=0 && !Functions.InRange(lastLocation,magic.Location,info.Range))) {
                            await Send(new {type="error",command,message="无法施法：请检查已学习技能、生命状态与目标距离。"},ct);continue;
                        }
                    }
                    await LocationAction(action,command!,Num("direction"),null,ct);continue;
                }
                if(action!=null) { await Write(action,ct);continue; }
            }
            if(command!="walk" && command!="turn") {await Send(new {type="error",message="Supported commands: walk, turn, attack, cast, use, equip, unequip, npc, buy, revive, pickup, harvest, ping"},ct);continue;}
            if(objectId==0) {await Send(new {type="error",message="Crystal game not ready"},ct);continue;}
            int direction=doc.RootElement.GetProperty("direction").GetInt32();
            if(direction<0 || direction>7) throw new InvalidDataException("direction must be 0..7 clockwise from up");
            if(pending.Count>=4) {await Send(new {type="error",message="Too many pending movement commands; wait for state"},ct);continue;}
            int? seq=doc.RootElement.TryGetProperty("seq",out var sequence)?sequence.GetInt32():null;
            await LocationAction(command=="walk" ? new C.Walk {Direction=(MirDirection)direction} : new C.Turn {Direction=(MirDirection)direction},command!,direction,seq,ct);
        }
    }
    async Task KeepAlive(CancellationToken ct) {
        while(!ct.IsCancellationRequested) {
            await Task.Delay(1000,ct);
            await Write(new C.KeepAlive {Time=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},ct);
            var vitals=WorldSnapshots.Read(objectId);
            if(vitals!=null&&vitals!=lastVitals){lastVitals=vitals;await Send(new {type="vitals",source="crystal-game-thread",data=vitals},ct);}
        }
    }
}

// Color has readonly properties; the packet serializer otherwise sends {}.
sealed class ColourConverter : System.Text.Json.Serialization.JsonConverter<Color> {
    public override Color Read(ref Utf8JsonReader reader,Type type,JsonSerializerOptions options)=>throw new NotSupportedException();
    public override void Write(Utf8JsonWriter writer,Color color,JsonSerializerOptions options){writer.WriteStartObject();writer.WriteNumber("r",color.R);writer.WriteNumber("g",color.G);writer.WriteNumber("b",color.B);writer.WriteNumber("a",color.A);writer.WriteEndObject();}
}
