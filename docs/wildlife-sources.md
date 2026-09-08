# 比奇怪物、掉落与刷新

2026-09-08。实现配置：`server/content/bichon-wildlife.json`；迁移：`server/WildlifeSeed.cs`。这是一套来源可追踪的候选基线，不是已认证官服数据库。

## 数据选择

- [mrzhqiang Monster.DB](https://github.com/mrzhqiang/mirserver-1.76/blob/39e17246a32247a2c43c4cc481e97e88c692fa53/mud2/db/Monster.DB)与[pangliang Monster.DB](https://github.com/pangliang/MirServer-Delphi/blob/f829679d24acb3a097d396d737ab067db2c88ca2/MirServer/Mud2/DB/Monster.DB)逐字段一致：鹿HP15、经验15、DC2–4、HIT4、SPEED12、WALK_SPD1400、ATTACK_SPD3000；稻草人HP15、经验12、DC1–2、HIT5、SPEED10、WALK_SPD1500、ATTACK_SPD2500。经验另与[旧怪物指南](https://mir.17173.com/monster/monster.htm)检索内容交叉核对。
- Delphi Race不等于Crystal AI。原实现把鹿设AI0、稻草人设AI1，后者会变成HarvestMonster。依据固定Crystal `GetMonster`/`Monsters/Deer.cs`映射为鹿AI2、稻草人AI0，修正类型接反；鹿受击反应/害羞变体仍由现有引擎执行，不声称所有行为参数已完成中国1.76校准。
- [MonGen.txt](https://github.com/mrzhqiang/mirserver-1.76/blob/39e17246a32247a2c43c4cc481e97e88c692fa53/Mir200/Envir/MonGen.txt)：只取地图0、名称严格等于鹿/稻草人的52行（32/20组），共1700/950只，保留每行位置、范围、数量、分钟周期及源行号。没有把鹿1、稻草人0等扩展种类合并。此密度只有候选服证据，需继续寻找同期官服分布；没有因性能优化偷偷削减数量。
- [稻草人掉落文件](https://github.com/mrzhqiang/mirserver-1.76/blob/39e17246a32247a2c43c4cc481e97e88c692fa53/Mir200/Envir/MonItems/%E7%A8%BB%E8%8D%89%E4%BA%BA.txt)：目前白名单为金币1/3、参数130；两种小药各1/12；牛角/玻璃/六角戒指、铁手镯、传统项链各1/36。文件内两条乌木剑不同概率、尚未校准的匕首/古铜戒指、攻击神水等未导入。概率只有该候选来源支持。
- 鹿.txt 的物品名损坏；本批只保留第一行可读的 `1/1`，结合旧挖肉指南和两份一致的 StdItems 定义推断为“肉”，作为明确标注的候选重建。额外肉品与鹿血条目未导入，不能称为认证官服掉率。采集链路及证据边界见 [采集与极品属性](harvest-and-bonuses.md)。

## 引擎规则与网页职责

固定源码：[MonsterInfo.DropInfo](https://github.com/Suprcode/Crystal/blob/0e315fe327192afe52c3d7357ddd1f5b7e26c5b8/Server/MirDatabase/MonsterInfo.cs)、[MonsterObject](https://github.com/Suprcode/Crystal/blob/0e315fe327192afe52c3d7357ddd1f5b7e26c5b8/Server/MirObjects/MonsterObject.cs)、[Map](https://github.com/Suprcode/Crystal/blob/0e315fe327192afe52c3d7357ddd1f5b7e26c5b8/Server/MirEnvir/Map.cs)、[PlayerObject](https://github.com/Suprcode/Crystal/blob/0e315fe327192afe52c3d7357ddd1f5b7e26c5b8/Server/MirObjects/PlayerObject.cs)。以下描述当前运行机制，不将其全部认证为官服规则。

- 每条1/N独立抽取，可同时出多件，也可以什么都不出。DropRate/人物增益会影响实际概率；没有前端“保底”。后期Crystal随机稀有怪物倍率已关闭。
- 金币130是引擎基准参数；未加成时实际金额区间为65（含）至195（不含），不是每次固定130。
- 怪物掉落会生成服务器地面对象，击杀经验归属者获得1分钟保护；引擎支持同组拾取。默认普通物品30分钟过期，玩家死亡掉落另有规则。保护和过期仍需中国1.76历史资料进一步校准。
- 客户端只发送“拾取脚下物品”，不能提交任意远端ID。到达格子必须等服务器位置确认；收到GainedItem/GainedGold和ObjectRemove才更新背包/金币与地面。被保护、满包或不存在时不伪造成功。
- Crystal `CanGainItem`主要检查空格和可合并堆叠，**不在拾取函数中直接禁止超负重**；负重显示来自服务器，移动等约束另行校准，没有擅自加一条拾取禁令。
- 刷新按区域目标数量补缺、按分钟期限运行，死亡只释放一个数量名额；不是每死一只就由网页设定新的倒计时。没有活物缺额时不超量添加；无有效出生格时由引擎退避重试。
- 普通候选刷新不持久化剩余秒数；服务重启按引擎重新填充。未来BOSS需要单独核对重启/时间保存策略。
- 地面物品使用原包DnItems，金币按112–116档位原帧；共享现有两张UI图集。这次新增10张原帧，总430张，无重新绘制。

## 已验证

- 隔离真实引擎：配置迁移幂等、52组/2650数量映射、正确AI类型；30000次1/3抽样宽容统计区间和金币范围；归属保护、满包不丢物、准确UniqueID拾取、保护过期、对象超时；死亡幂等、刷新前/恰好期限/连续处理不超量。
- 浏览器实际操作：在(295,619)击杀稻草人，经验10→22，掉出牛角戒指；点击寻路至(294,618)拾取，收到物品UniqueID13，地面对象消失。未改随机数、未注入掉落、未改角色状态。
- 服务重启后同角色位置、经验22、戒指UniqueID13保持。截图只留本地`docs/qa/scarecrow-ground-drop.png`与后续背包截图。
- 全部44项Node回归、TypeScript、Cocos、.NET通过；430张原帧像素/偏移及12份文件哈希通过。

## 未完成

鸡采集、肉品品质官服校准与收购；其余比奇物种、真实出生范围和安全区守卫；全掉落表；卖出/修理；书店供货与三职业技能；死亡惩罚；双人组队归属实景；BOSS长期刷新持久化。完整地域与系统依赖见 [世界流程规划](world-progression-plan.md)。
