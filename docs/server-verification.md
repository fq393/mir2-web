# Crystal 本地服务验证

2026-09-07 在 macOS arm64 实测。Crystal 核心库可直接以 .NET 8 编译和运行；没有修改上游 C# 源码。桌面 WinForms 服务管理界面没有移植。

## 启动和复验

在仓库根目录执行：

```sh
bash tools/setup-dotnet.sh
# 先完成资源下载，确保 raw-assets/Map_0.map 存在。
bash tools/start-server.sh
# 另开终端，Node 22+（实测 Node 24.18.0）：
node server/verify.mjs
```

`start-server.sh` 在缺少源码时拉取固定 Crystal 提交，已有 checkout 与固定提交不符则明确退出。SDK tar.gz 的 SHA512 已与 Microsoft 官方 release-metadata 对照，值记录在 `server/upstream.json`。SDK 安装在 `.runtime/dotnet/`；NuGet 和 CLI 缓存也放在该目录。运行数据保存在忽略 Git 的 `server/data/`。原地图复制到该数据目录的 `Maps/0.map`。首次创建仅包含真实地图 0 和安全出生点 `(288,615)` 的 Crystal 数据库。

| 项目 | 实测值 |
| --- | --- |
| 上游 | `https://github.com/Suprcode/Crystal` |
| 固定提交 | `0e315fe327192afe52c3d7357ddd1f5b7e26c5b8` |
| 核心项目 | `Server/Server.Library.csproj`、`Shared/Shared.csproj`，均为 `net8.0` |
| 项目局部 SDK | `8.0.414`，osx-arm64 |
| Crystal TCP | `127.0.0.1:17000` |
| HTTP / WebSocket | `http://127.0.0.1:17080/health` / `ws://127.0.0.1:17080/ws` |
| 原始握手 | `04 00 00 00`，长度 4，ServerPacketIds.Connected = 0 |
| 起点 | 首次新角色 `(288,615)`；已有角色通过 Crystal 恢复上次位置 |

`lsof` 确认两个监听地址都是 IPv4 回环地址，原上游硬编码的 3000 状态端口在宿主内关闭。WebSocket 只允许 localhost/回环地址 Origin；不带 Origin 的本地工具也可验证。

## 实际消息链

WebSocket 与 Crystal 会话是一对一的真实 TCP 连接。桥接层使用上游 `ClientPackets` 序列化，再使用上游 `Packet.GetServerPacket` 和 `ReadPacket` 解码服务器响应，不创建地图移动模拟。服务端和协议适配运行在同一进程；解码通过反射调用受保护的 `ReadPacket`，避免改变 Crystal 并发使用的全局 `Packet.IsServer=true`。

每次进入：`Connected → ClientVersion(Result=1) → Login`。首次使用某个本地客人账号时，收到 Login 的账号不存在结果后执行 `NewAccount(Result=8) → Login → NewCharacterSuccess → StartGame(Result=4) → UserInformation`；后续复用其真实账号和角色。

本地桥接提供 4 个并发客人槽位；账号与角色经原 Crystal 创建和持久化。密码由 `server/data/bridge-key` 派生，密钥文件权限为 0600，客户端不接触账号密码。达到 4 个连接会明确返回错误。这解决了上游同 IP 每小时最多约 4 次注册、随后封禁 24 小时的硬编码限制，未删除或修改该限制。反复刷新复用账号，不反复注册。

### 浏览器发送

```json
{"type":"walk","direction":2,"seq":1}
{"type":"turn","direction":0,"seq":2}
{"type":"ping"}
```

`direction=0..7` 对应上、右上、右、右下、下、左下、左、左上。`seq` 可选并原样返回。推荐至少间隔 650ms：上游 `HumanObject.MoveDelay=600ms`，过早的 Walk 会由 Crystal `_retryList` 等待执行。桥接最多允许 4 条未返回位置的移动命令。

### 浏览器接收

```json
{"type":"transport","connected":true,"engine":"Crystal","packet":"Connected","packetId":0,"packetLength":4,"tcp":"127.0.0.1:17000"}
{"type":"protocol","packet":"ClientVersion","result":1}
{"type":"protocol","packet":"StartGame","result":4}
{"type":"ready","source":"crystal-tcp","packet":"UserInformation","objectId":1,"name":"WebGuest0","map":"0","x":288,"y":615,"direction":0}
{"type":"state","source":"crystal-tcp","packet":"UserLocation","objectId":1,"map":"0","x":289,"y":615,"direction":2,"accepted":true,"seq":1}
{"type":"peer","source":"crystal-tcp","packet":"ObjectWalk","id":2,"name":"WebGuest1","x":289,"y":615,"direction":2}
{"type":"peerRemoved","source":"crystal-tcp","packet":"ObjectRemove","id":2}
{"type":"error","message":"...","source":"crystal-bridge"}
```

`transport` 只代表收到真实 Crystal TCP 握手；只有 `ready` 才代表角色已进游戏。`state` 来自真实 `UserLocation`，上游无论行走成功还是拒绝都会返回当前位置。`accepted` 根据待处理命令与实际返回位置/方向判断；没有对应命令时为 null。没有后台读取 Envir 玩家坐标，也没有按方向推算确认坐标。客户端应始终以实际位置覆盖本地预测。

所有坐标均为原地图全局坐标；当前浏览器裁切原点是 `(264,596)`，尺寸 `48×38`。Crystal 加载完整地图，裁切范围由客户端呈现和输入限制。

## 通过的验证

机器可读消息证据保存在 `server/verification-result.json`，可用 `node server/verify.mjs` 重跑：

- 直接 TCP 收到 `04000000`，不是 HTTP 健康接口冒充游戏服务。
- 实际账号/角色链路及 `StartGame=4`、`UserInformation`。
- 八个方向分别发送真实 Walk，服务器位置返回与原地图阻挡一致；人物占位也会阻挡。
- 对原地图墙体发出移动，收到真实 `UserLocation`，`accepted=false` 且坐标保持不变。
- 两个并发真实账号互相收到 `ObjectPlayer`、`ObjectWalk`、`ObjectRemove`。
- 保持连接超过 Crystal 的 10 秒超时时间，再转向成功；桥接每秒发送真实 KeepAlive。
- 连续 8 次重新连接成功，复用同一客人账号和角色，没有触发注册封禁。

测试会真实移动本地角色；重新连接将恢复这些测试位置。为了两会话验证，请保留至少 2 个可用客人槽位。

## 兼容处理和范围

宿主显式设置：回环地址、17000 端口、允许开始游戏、禁用 Windows 客户端 EXE 哈希验证、禁用完整怪物/物品数据库启动检查、关闭上游额外 HTTP/状态服务、单线程处理、同 IP 连接上限 16、连接冷却 0 秒。最后两项仅为多个本地浏览器共享回环地址；4 槽位是桥接另行限制。

Crystal 的 Settings 会生成带 Windows 反斜杠的 Localization 路径。macOS 文件系统允许该目录，但 MSBuild 默认递归 glob 在第二次构建时会把 `**/*.resx` 当字面路径并失败。宿主 csproj 关闭默认项，只显式编译 `Program.cs`，避免遍历运行数据。上游日志退出文案将 TCP 断开标记为 `Connection timed out`；正常 WebSocket close 仍已实测完成关闭握手，且 peerRemoved 正常发出。

以上移动测试记录来自内容扩充前。该宿主现在包含下述基础玩法，仍非完整游戏服。正式身份认证、跨服、完整任务内容和生产发布不在本次范围。

## 比奇基础玩法：2026-09-07 实测

运行 `node server/verify-gameplay.mjs`，原始证据为 `server/gameplay-verification-result.json`，协议详见 `docs/ws-contract.md`。

- 武器 BichonSword（Shape1，DC5–9、MC4–7）、衣服 BichonRobe（Shape1，AC1–3）：EquipItem.Success=true。后续会话卸装和重新穿戴均成功。
- 向导“比奇向导”（NPC Image0，290,610）：真实NPCResponse、NPCGoods，以及购买后的GainedItem和LoseGold。装备价格25。脚本显式提供[@BUY]段，通过原NPCPage交易权限判断。
- Deer/Image4（294,615）和Scarecrow/Image5（282,621）各3只，Spread3、HP40、Delay1分钟。移动、攻击、刷新全部使用原引擎。
- 原近战伤害-6；FireBall31连续真实伤害-11/-9/-11/-11后收到同一目标ObjectDied。DamageIndicator负数为伤害、正数为回血；ObjectHealth.Percent是原百分比。
- 当前原库已有FireBall，迁移保留原参数；实测MP11→8→5→2，每次3点。源码fallback仅在原库没有该技能定义时使用。

DemoSeed启动时先备份数据目录顶层文件（原DB、账户库、迁移标记）到server/data/demo-backups/UTC时间目录，权限0700，再通过原LoadDB/SaveDB/LoadAccounts/SaveAccounts扩充。按内容名、Spell、MonsterIndex检查避免重复添加，不删除角色。每个WebGuest角色仅一次获得缺少的装备、200金币和已学FireBall；旧职业、等级、位置保留。出生区Size2供原引擎新角色/回城选择。

Warrior施放火球属于明确的本地演示直接授予技能：原HumanObject.Magic检查已学技能、MP、射程、冷却，没有职业限制。正常技能书学习规则没有修改，不能据此声称战士标准成长可学火球。桥接未计算战斗、金币或装备结果。

上游git status干净；启动脚本校验固定commit和已跟踪源码未改。当前build零警告/错误。revive指令转发原TownRevive，但本轮未故意杀死玩家验证。最大HP/MP未单独暴露，ready是当前HP/MP。旧verify.mjs只有玩家占位的断言不再覆盖有NPC/怪物的地图，使用新玩法脚本复验。

## 混合输入回包关联修复

`node server/verify-mixed-input.mjs` 已通过，证据 `server/mixed-input-verification-result.json`。无客户端动画等待，连续发送attack/walk/attack/attack/walk，实际state.command按同序返回，只有walk获得seq101/102。FireBall/walk/FireBall/walk在原SpellTime重试期间同样保持seq103/104，越界施法被拒后紧接walk仍正确收到seq105。

原因：原Attack成功与失败都会发UserLocation，FireBall也会发，但越界和已死亡分支可能静默；同时原retryList会让不同ActionTime/AttackTime/SpellTime等待的动作改变执行顺序。桥接因此只允许一个位置动作在途，收到真实回包才发下一条；不能只在并发动作旁维护FIFO。超过8秒无回包关闭会话，避免迟到回包误配下个动作。

此次重启还验证了带Rested buff的已保存角色。迁移先按原StartEnvir顺序载入BuffInfo.Load，再LoadAccounts，避免读取角色时缺少buff定义。没有删除或回滚角色文件。
