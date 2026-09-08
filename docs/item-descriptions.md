# P02：物品说明数据与交互

2026-09-08，HUD-03 / ITEM-01 / ITEM-02。已完成说明数据链、悬停生命周期及可容纳物品的原背包下栏呈现；不代表整个P02或全部原版参数校准完成。

## 固定依据与差异

- [Crystal GameScene](https://github.com/Suprcode/Crystal/blob/0e315fe327192afe52c3d7357ddd1f5b7e26c5b8/Client/MirScenes/GameScene.cs)：CreateItemLabel使用不接收控制事件的半透明说明层，NameInfoLabel按物品类型显示持久/品质/纯度，NeedInfoLabel分别处理要求类型。网页采用这些已运行引擎的显示语义，未接入其后期觉醒、镶嵌等内容。
- [Crystal Enums](https://github.com/Suprcode/Crystal/blob/0e315fe327192afe52c3d7357ddd1f5b7e26c5b8/Shared/Enums.cs)：RequiredType的Level/MaxDC/MaxMC/MaxSC等与RequiredClass、RequiredGender是独立字段，不能都当等级。
- [旧客户端FState](https://github.com/pangliang/MirServer-Delphi/blob/f829679d24acb3a097d396d737ab067db2c88ca2/MirClient/FState.pas)：GetMouseItemInfo包含重量、持久、基础属性、职业和装备条件；DItemBagDirectPaint把说明画在背包下部。该源码也含后期英雄/转生，不能直接视为官服1.76完整规范。
- **未决差异**：旧源码持久用Round(Dura/1000)，当前Crystal用Floor。本批保持Crystal显示取整，不改原始持久、战斗或修理价格；原版最终取整仍待更可靠1.76资料确认。旧源码的金币/说明保留两套尺寸坐标，不能机械套用。本轮进一步按用户336×270原背包帧实现三行下栏；超长说明和纸娃娃保留完整浮层，仍不能标为全物品像素级还原。

## 实现

1. 初次登录的物品定义补传RequiredType、RequiredGender，与原服务端定义一致，避免重登后要求缺失。
2. 统一中文分行：名称、单件定义重量、实际CurrentDura/MaxDura、单件附加后的属性、职业/性别/要求。矿石纯度、肉品质和符次数保留不同单位；药剂显示HP和MP恢复量，不擅自认定恢复速度。
3. 背包、原装备图命中区和已有nativeItem图标共用说明；纸娃娃不再缺少武器/衣服说明。商店实际价格仍由现有报价界面负责，移除底部摘要默认25金币的占位文案。
4. 说明沿用800×600逻辑坐标，边缘夹紧；无按钮和鼠标监听，不改变背包双击/移动行为。离开、按下、窗口隐藏/销毁、断线及相关物品回包清除旧说明，避免旧持久/旧物品残留。
5. 已确认的等级、职业、性别不满足时显示红字，其余正常文字用白色。攻击/魔法等要求尚无服务端最终Stats快照，保持未知，不用装备数值猜测，也不显示绿色“可以装备”；实际使用仍由Crystal检查。未知定义不补价格/要求。

## 验证

- TypeScript检查、Cocos Web构建通过。76项Node回归通过，包含单件+3、实际持久、双恢复药剂、品质/纯度/次数、12种要求、边缘夹紧和DuraChanged清除旧说明。
- CrystalContentTests通过，新增初始快照要求类型/性别序列化检查；原真实引擎购买、背包移动交换、职业/等级拒绝、满包/余额不足、修理与持久化回归仍通过。
- 独立17180/17610，AppearanceFixture测试账号，实际登录、键鼠操作；不修改主账号存档。木剑悬停显示重量7、持久10/10、攻击2–5、所需等级1，穿戴后纸娃娃说明一致。Escape后窗口和说明均关闭。
- 实际点击把布衣从背包7移动至8，说明没有拦截操作，唯一ID仍为2；木剑唯一ID1在武器位。
- 最终构建重新加载并退出重登：布衣仍在8格、ID2；武器位仍为ID1，RequiredType=0/RequiredGender=3正常传回，布衣分行说明为重量5、持久10/10、防御2–2、魔御0–1、所需等级1。
- 本地截图：docs/qa/p02-bag-tooltip.png、docs/qa/p02-equipment-tooltip.png。原始客户端素材和截图不随源码仓库发布。

## 剩余验收

- 超长名称/多附加属性的原版呈现、全部物品参数/取整校准；攻击/魔法/防御等要求着色须先接通最终Stats快照。
- 更多实景药剂/技能书/首饰/肉/符毒说明、移动端触控查看方式和跨图/断线完整矩阵。
- 拖放跟随、快捷栏整理、数量输入、药包捆装/拆包各自取证与事务验收；不能直接套用普通堆叠拆分。

## 三行下栏与要求着色补充验收

依据上方固定FState.DItemBagDirectPaint的“名字黄色、资料白色、不可用要求红色”及三行布局；按当前336×270原帧内区落在(64,213)，行高14、宽258。没有修改原图或增加按钮。默认负重/操作文字在查看物品时暂时隐藏，离开或关闭后恢复。

用同一系统字体实际测量完整三行；容不下时保留完整分行浮层，不把字体缩小、丢掉附加属性或让文字越过原窗边框。背包原说明与纸娃娃浮层分开处理，商店/修理附带背包复用下栏规则。最终字体差异/超长实例仍需更多实景覆盖。

[固定HumanObject.CanUseItem](https://github.com/Suprcode/Crystal/blob/0e315fe327192afe52c3d7357ddd1f5b7e26c5b8/Server/MirObjects/HumanObject.cs#L1019) 通过职业/性别位掩码、RequiredType判断实际可用性。显示端只使用已同步的Level/Class/Gender；缺少数据和攻击等要求用未知状态，不能把“未知”当成通过。升级回包使旧说明失效。

- 81项Node回归、TypeScript、Cocos构建通过；新增等级6/7边界、职业组合掩码、性别、最大等级上限、未知属性不可误判、原三行数据保全、长名保留完整视图、下栏恢复。
- 独立BookshopFixture真实7级法师：火球书要求白色，治愈书要求行红色；双击治愈书后服务器中文拒绝，物品ID3保留，已学技能仍只有火球31。
- 800×600和1244×933实际窗口缩放均落在同一原下栏，说明不挡背包格；离开后下栏负重/操作文字恢复，Escape正常关闭。
- 性别限制和6/7级边界本轮通过自动测试；没有把这两项误写成浏览器已实测。既有服务端职业/等级拒绝仍见bookshop-learning的真实事务验收。
- 本地截图：docs/qa/p02-native-bag-requirements.png、docs/qa/p02-native-bag-fit.png（最终构建名称已按旧代码clYellow校为黄色）。

最终构建重新登录复核：名称#ffff00、资料#ffffff、拒绝要求#ff0000，书本ID3保留；两种比例截图已刷新，Escape后说明与窗口均关闭。
