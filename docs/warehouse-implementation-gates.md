# B03 边界仓库接入前核对

## 已定位来源

- 候选 MerChant.txt 第57行：边界村保管员，地图0140，8:9，NPC 9。
- 门点：0的307:627进入0140的2:10；0140的2:11返回0的306:628。来自已固定 MapInfo.txt，未据建筑图猜测。
- Delphi FState.pas 5378–5400：BoStorageMenu 使用物品列表与悬停说明；5444行由选中物品的MakeIndex请求取回。不能直接做成现代双网格仓库并认定原版。
- 同文件5574–5589及5660：存入复用物品操作框的dmStorage，显示“保管物品”；点击确认调用SendStorageItem。
- Crystal PlayerObject.StoreItem / TakeBackItem：校验NPC页、距离、仓库权限、槽位、禁止存入标记，调用原有物品移动逻辑。

## 必须先解决的兼容点

- Crystal存储在Account.Storage，是账号级存储。必须核对目标1.76版本是否同账号角色共用仓库，不能直接把引擎实现当作原版规则。
- 原列表以物品身份取回，Crystal以槽位存取；桥接应校验请求身份和槽位仍一致，避免列表刷新或并发请求取错物品。
- 网页当前未接仓库协议、完整仓库数据与UI。NPC出现不代表存取功能完成。

## 执行与验收

1. 核对上述归属/容量规则和原窗口资源索引。
2. 原0140地图、NPC9图集、中文身份与两门点接入。
3. 服务端存取桥接：正常、非法槽位、已移动物品、满包/满仓、禁存物品、离店/死亡/断线保护。
4. 原存入框、取回列表和属性说明；不采用未核对的现代布局。
5. 实际存入→离店→重登→取回；比对唯一ID、额外属性、持久、数量，验证无丢失或复制。

来源均为固定候选代码或客户端资源；仓库归属与容量尚未认证，不先写死数值。

## 2026-09-12 补充：角色归属的候选源码证据

固定提交仍为 pangliang/MirServer-Delphi 的 f829679d24acb3a097d396d737ab067db2c88ca2；这是一份含后期扩展的候选源码，不能宣称完整等同2003官方1.76。

- Common/Grobal2.pas：THumData 从1411行开始，以sChrName标识角色，1467行含StorageItems；普通仓库属于角色数据。
- EM2Engine/ObjBase.pas：TPlayObject持有m_StorageItemList；普通ClientStorageItem校验物品MakeIndex、名称、商人存储权限及同地图距离，再移入角色仓库。
- 该文件另有BigStorage扩展，不纳入复古范围。
- 容量存在冲突：Grobal2的MAXSTORAGEITEM=50，但TStorageItems为array[0..45]。需要沿普通仓库实际限制和存档读写继续确认，不能任选一个数字。

与Crystal.Account.Storage的差异已经有具体证据。接入时必须明确选择角色仓库的持久化方式，并测试同账号另一角色不能误见或取走物品；不能仅修改前端显示制造角色隔离。

来源：https://github.com/pangliang/MirServer-Delphi/blob/f829679d24acb3a097d396d737ab067db2c88ca2/Common/Grobal2.pas 与同提交EM2Engine/ObjBase.pas。

进一步追踪：普通ClientStorageItem在ObjBase.pas的22825行实际检查m_StorageItemList.Count < MAXBAGITEM；同提交Grobal2.pas的MAXBAGITEM=46，匹配StorageItems[0..45]。因此该候选普通仓库实际为46格，而MAXSTORAGEITEM=50不是此路径的有效容量。该值仅认证此候选实现，仍需与目标1.76客户端/资料对应，不将后期版本容量直接宣称为官方1.76。

## 当前落地进度

- [x] 角色仓库存档基础与同文件快照扩展、旧档读取及角色隔离测试，见character-storage-persistence.md。
- [ ] 0140/NPC、存取业务、失败回滚和原界面仍未接入；上述基础不代表完整仓库可用。

- [x] 后端存取事务及真实保存/加载、失败返还测试，见storage-transfers.md。
- [ ] 网页会话重放保护、NPC、地图、原窗口与浏览器存取仍待实现。
