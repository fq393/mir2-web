# B03 仓库网页协议与验证

2026-09-13：本文记录网页协议阶段；后续0140原窗口主流程的浏览器验收见[仓库地图与界面](warehouse-native-ui.md)。所有真实协议测试使用独立17180服务、合成NPC入口及2格测试仓库，没有修改主服账号。

## 协议

请求共用整数`request`，响应原样返回；物品`uniqueId`用十进制字符串避免JavaScript精度丢失。

| 请求type | 参数 | 成功响应 |
|---|---|---|
| storageState | npcId | storageState：完整state；同时取消旧待确认操作 |
| storagePrepare | npcId, uniqueId, from, to, deposit | storagePrepared：一次性token |
| storageCommit | token | storageResult：保存完成后的完整state |
| storageCancel | 无 | storageResult：cancelled=true |

`state`含包裹与角色仓库全部槽位（空格为null）、容量、保管员ID与负重；数组在世界线程物化。失败返回`success=false`及中文原因。后续WarehouseSeed已接入有效保管员对话时的新角色仓库初始化；仍无扩容或收费功能，不使用账号共享仓库。上游`UserStorage`账号仓库包不再转发，避免与角色仓库混用。

一个连接仅保留一个待确认操作。新准备会替换旧操作；无效准备、错误令牌、取消、换NPC、换地图、死亡和退出会清除待确认。提交在实际校验和保存前消费令牌，即使失败也必须重新选择。角色对象、地图对象、对话页和NPC脚本必须仍与准备时一致，随后重新执行槽位、唯一ID、权限及负重校验。

取消不会回滚已经开始执行的提交。若提交已经保存但网络确认丢失，重新登录并向保管员请求完整状态，不重发旧令牌；新连接不能使用旧连接的确认。连接关闭后未执行的世界线程请求被取消；正在执行的事务仍完成保存或异常返还。

## 已验证

- [x] 完整CrystalContentTests回归，包含仓库核心与新增会话测试、原玩家交易跨进程恢复。
- [x] 会话测试：取消/替换/错误与跨会话令牌、物品回到原格后的旧令牌重放、失败保存后重试、角色/页/目标槽变化、关闭连接。
- [x] 真实WebSocket→Crystal TCP→世界线程→账号文件：NPC对话、准备/取消、存入/取回、重复拒绝、完整状态响应。
- [x] 同账号甲乙两个角色切换与重登，物品不会进入另一角色仓库。
- [x] 待确认时断线旧令牌拒绝；保存后断线重连得到已存入物品。
- [x] 单独关闭并重新启动QA后端进程，取回已存物品；唯一ID、附加攻击MaxDC+3、持久1234不变。
- [x] 主后端构建零错误、零警告。

协议测试不是浏览器点击测试，也没有证明0140建筑、保管员外观或原窗口符合1.76。

## 重跑

先在项目根目录运行`python3 tools/prepare-storage-protocol-qa.py`。它只生成`.runtime/storage-protocol-qa`，不复制主服账号。确保17100/17180未被其他QA占用，然后运行：

```sh
MIR2_ROOT="$PWD/.runtime/storage-protocol-qa" \
DOTNET_ROOT="$PWD/.runtime/dotnet" \
DOTNET_CLI_HOME="$PWD/.runtime/dotnet/home" \
NUGET_PACKAGES="$PWD/.runtime/dotnet/packages" \
.runtime/dotnet/dotnet run --project .runtime/storage-protocol-qa/server/StorageQA.csproj --no-launch-profile
```

另一个终端运行：

```sh
node tools/test-storage-protocol.mjs .runtime/storage-protocol-qa
node tools/test-storage-protocol.mjs .runtime/storage-protocol-qa leave-stored
```

关闭并重新启动上述QA服务，运行：

```sh
node tools/test-storage-protocol.mjs .runtime/storage-protocol-qa resume-stored
```

## 协议阶段后续顺序（进度已更新）

1. [已完成] 0140地图、NPC9、两门点及容量候选配置。
2. [主流程完成] 原框体存入、取回列表及物品说明；鼠标携物、操作圈与存入页包裹格重排已接入并实测。
3. [部分完成] 浏览器存入→离店→重登→取回、鼠标携物→操作圈、格位重排、右键取消和关闭已通过；满包/满仓和双会话原生网页联测待补。协议双角色隔离已有真实WebSocket测试。
4. 按区域计划推进其余NPC/怪物，再继续装备音效、完整技能和玩家交易未完成清单。
