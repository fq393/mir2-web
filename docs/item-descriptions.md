# P02：物品说明数据与交互

2026-09-08，HUD-03 / ITEM-01 / ITEM-02。本批完成说明数据链和悬停生命周期；不代表整个P02或原版UI校准完成。

## 固定依据与差异

- [Crystal GameScene](https://github.com/Suprcode/Crystal/blob/0e315fe327192afe52c3d7357ddd1f5b7e26c5b8/Client/MirScenes/GameScene.cs)：CreateItemLabel使用不接收控制事件的半透明说明层，NameInfoLabel按物品类型显示持久/品质/纯度，NeedInfoLabel分别处理要求类型。网页采用这些已运行引擎的显示语义，未接入其后期觉醒、镶嵌等内容。
- [Crystal Enums](https://github.com/Suprcode/Crystal/blob/0e315fe327192afe52c3d7357ddd1f5b7e26c5b8/Shared/Enums.cs)：RequiredType的Level/MaxDC/MaxMC/MaxSC等与RequiredClass、RequiredGender是独立字段，不能都当等级。
- [旧客户端FState](https://github.com/pangliang/MirServer-Delphi/blob/f829679d24acb3a097d396d737ab067db2c88ca2/MirClient/FState.pas)：GetMouseItemInfo包含重量、持久、基础属性、职业和装备条件；DItemBagDirectPaint把说明画在背包下部。该源码也含后期英雄/转生，不能直接视为官服1.76完整规范。
- **未决差异**：旧源码持久用Round(Dura/1000)，当前Crystal用Floor。本批保持Crystal显示取整，不改原始持久、战斗或修理价格；原版最终取整仍待更可靠1.76资料确认。说明位置也存在背包下部与浮层两个候选，当前浮层是过渡实现，原下栏布局校准仍待做，不能标为像素级还原。

## 实现

1. 初次登录的物品定义补传RequiredType、RequiredGender，与原服务端定义一致，避免重登后要求缺失。
2. 统一中文分行：名称、单件定义重量、实际CurrentDura/MaxDura、单件附加后的属性、职业/性别/要求。矿石纯度、肉品质和符次数保留不同单位；药剂显示HP和MP恢复量，不擅自认定恢复速度。
3. 背包、原装备图命中区和已有nativeItem图标共用说明；纸娃娃不再缺少武器/衣服说明。商店实际价格仍由现有报价界面负责，移除底部摘要默认25金币的占位文案。
4. 说明沿用800×600逻辑坐标，边缘夹紧；无按钮和鼠标监听，不改变背包双击/移动行为。离开、按下、窗口隐藏/销毁、断线及相关物品回包清除旧说明，避免旧持久/旧物品残留。
5. 不显示未经服务端最终属性验证的红绿可穿戴结论；等级、职业等限制仍由Crystal检查。未知定义不补价格/要求。

## 验证

- TypeScript检查、Cocos Web构建通过。76项Node回归通过，包含单件+3、实际持久、双恢复药剂、品质/纯度/次数、12种要求、边缘夹紧和DuraChanged清除旧说明。
- CrystalContentTests通过，新增初始快照要求类型/性别序列化检查；原真实引擎购买、背包移动交换、职业/等级拒绝、满包/余额不足、修理与持久化回归仍通过。
- 独立17180/17610，AppearanceFixture测试账号，实际登录、键鼠操作；不修改主账号存档。木剑悬停显示重量7、持久10/10、攻击2–5、所需等级1，穿戴后纸娃娃说明一致。Escape后窗口和说明均关闭。
- 实际点击把布衣从背包7移动至8，说明没有拦截操作，唯一ID仍为2；木剑唯一ID1在武器位。
- 最终构建重新加载并退出重登：布衣仍在8格、ID2；武器位仍为ID1，RequiredType=0/RequiredGender=3正常传回，布衣分行说明为重量5、持久10/10、防御2–2、魔御0–1、所需等级1。
- 本地截图：docs/qa/p02-bag-tooltip.png、docs/qa/p02-equipment-tooltip.png。原始客户端素材和截图不随源码仓库发布。

## 剩余验收

- 原背包下栏排版、要求不满足着色、长名称/多附加属性布局，原版取整与全部物品参数校准。
- 更多实景药剂/技能书/首饰/肉/符毒说明、移动端触控查看方式和跨图/断线完整矩阵。
- 拖放跟随、快捷栏整理、数量输入、药包捆装/拆包各自取证与事务验收；不能直接套用普通堆叠拆分。
