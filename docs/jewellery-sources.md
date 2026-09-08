# 比奇首饰店：来源与验收

2026-09-07。本批只接入经过逐字段交叉核对的子集，不把任何私服库整体视为中国版 1.76 标准。

## 证据

- [候选服务端 MerChant.txt](https://github.com/mrzhqiang/mirserver-1.76/blob/39e17246a32247a2c43c4cc481e97e88c692fa53/Mir200/Envir/MerChant.txt#L39-L41)：0105 的戒指店主(18,6)、手镯店主(12,12)、项链店主(6,18)，形象4/5/6。该库含后期 FCO 脚本、Bind 字段；不是纯净官方库。
- 同一固定提交的 `Mir200/Envir/QuestDiary/游戏配置/商店NPC/` 三份商店脚本：按柜台划分商品。脚本里的 `100 3 0` 等为库存参数，**不是价格**。
- 两份 Paradox 表：上述提交 `mud2/db/StdItems.DB`，以及 [Delphi 服务端表](https://github.com/pangliang/MirServer-Delphi/blob/f829679d24acb3a097d396d737ab067db2c88ca2/MirServer/Mud2/DB/StdItems.DB)。11件已接入首饰的 Looks、重量、持久、等级、基础价格一致。
- [旧饰品资料](https://mir.17173.com/item/item4.htm)：校对基础属性与穿戴条件。旧表的 StdMode 会复用 Ac2/Mac2 表示准确/敏捷，不能直接把所有列映射成防御；按资料页和显式 HitPoint/SpeedPoint 列映射。
- 原客户端 `Data/npc.wil`、WIX：36帧逐像素/偏移一致，无重绘/调色/阴影改造。帧号依 [Actor.pas](https://github.com/pangliang/MirServer-Delphi/blob/f829679d24acb3a097d396d737ab067db2c88ca2/MirClient/Actor.pas) 的 GetNpcOffset、MA35、TNpcActor.CalcActorFrame：形象×60，方向×10，4帧，200ms。
- [FState.pas](https://github.com/pangliang/MirServer-Delphi/blob/f829679d24acb3a097d396d737ab067db2c88ca2/MirClient/FState.pas) ShowShopMenuDlg：购买时保留上方对话、下接商品表、右侧打开背包。源代码背包x=475；当前原包帧宽336，网页将x限制到464避免关闭按钮越出800边界，这是尺寸适配，不是修改物品规则。

数值写在 `server/content/jewellery.json`，逐文件 SHA-256 固定。两份候选库一致只能提高可信度，**不等于已经取得官方1.76数据库**。仍需同期官方服资料进一步确认商店经济。Crystal 只负责当前实际买入/穿戴校验，不能据此宣布全部交易算法均为中国版1.76。

## 已接入与排除

- 戒指：牛角、六角、玻璃。
- 手镯：小手镯、银手镯、铁手镯。
- 项链：金、传统、黑檀、黄色水晶、黑色水晶。
- 暂未加入钢手镯（两库价格1818/2000）、大手镯（4545/5000）；皮制手套缺本次旧资料页对照。
- 未导入后期绑定、商店刷新间隔、极品生成、FIGHT标记。未接入出售、普通修理、特殊修理，因此不放置无法工作的服务入口。
- 原有向导的木剑/布衣、职业火球演示配置仍需单独迁移。特别是布衣价格120/400、属性0-2/旧网页2-2冲突，不能直接覆盖。它们不属于这次11件首饰的数据白名单。

## 实施与验证

- 三个柜台独立使用原图、中文名字/对话，按实际服务器NPC名字显示窗口标题。
- 原首饰装备槽恢复：项链、左右手镯、左右戒指。武器与衣服使用纸娃娃自身的卸装点击区域，取消放在手镯槽上的重复库存图标。
- `tools/test-jewellery.py` 直接只读解析两个固定DB，核对11件物品和排除清单；验证36个NPC帧、所有偏移、三方向与200ms动画。
- `tools/CrystalContentTests` 调用固定Crystal真实 NPCScript.Buy / CanEquipItem：11件商品扣款、满持久、进入背包第6槽、服务端回包；金币不足、背包满、未知编号不扣款；等级不足和错误槽位拒绝。运行于临时目录和系统分配的loopback端口，不读取或修改游戏存档。
- 浏览器分别正常行走到三个柜台，核对商品分类、显示价格、中文对话与原生三窗联动；资金不足点击确认后金币/背包/人物位置不变。
- F10实测点击纸娃娃武器卸装，F9背包重新装备，服务器确认，原武器ID3/衣服ID4恢复。
- 800×600与1854×933视口验证；后者canvas1244×933，窗口与点击位置一致。音频36/36解码、无音频错误。未把此项称为全部声音的人工听感验收。

运行：

```sh
.runtime/assets-venv/bin/python tools/convert-classic-npcs.py
.runtime/assets-venv/bin/python tools/convert-ui.py
.runtime/assets-venv/bin/python tools/test-jewellery.py
.runtime/dotnet/dotnet run --project tools/CrystalContentTests -- "$PWD"
```

Paradox只读依赖pypxlib2.5。当前Apple Silicon使用本地编译的pxlib0.6.8（steinm/pxlib@e32d17611e5ee353c4e3ce04e61b0b38feb95855）；包内x86 dylib无法在ARM Python加载。构建与库均在`.runtime`/`vendor`，未修改系统Python。`tools/read-paradox-items.py`仅生成可检索JSON，正式核对测试仍读取原DB。
