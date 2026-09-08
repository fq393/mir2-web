# 技能键位与消耗品取证

2026-09-08。本批推进 SKILL-05，并记录 ITEM-08 的版本冲突。沿用现有1.76规则，不将候选服务器数值当成官方定论。

## 已实现范围

F11 打开已学技能列表，点击技能进入原生快捷键窗口。可选择 F1–F8 或原素材的 None（取消绑定），点击原“提交”按钮保存；窗口内可直接按 F1–F8 选择、Enter 提交、Esc 放弃未提交的选择。按键与背后的移动/攻击隔离。技能窗口遮住小地图区域时，小地图隐藏，关闭窗口后恢复。

- 原客户端 `Prguse` 229 窗口、230–247 的普通/选中键位按钮、62 提交按钮；位置跟随旧客户端 FState。图标按旧 `Magic.DB Effect×2` 转换：基本剑术0、攻杀10、刺杀26、半月46、野蛮50、烈火48、火球2、治愈4。两份候选库的这八项Effect一致，已与原图对照；不能沿用Crystal的Icon编号。全部复用已固定的430帧图集，没有新增素材下载。
- 服务端在游戏线程检查角色、已学技能、0–8键位范围，绑定占用键时解除旧技能的该键位，并返回不可变的完整绑定列表。
- 客户端等待对应请求确认才更新；重复提交、失败、掉线和过期回包不擅自修改技能列表。确认时窗口已经关闭，不强行重新打开。
- 保存落在 Crystal 原 `UserMagic.Key` 字段，角色存档沿用原生序列化；不改变等级、熟练度、MP消耗或伤害。
- F1–F8 按角色的实际键位找到技能。当前仅火球的主动施放已接入；其他已学技能可保存键位，但明确提示施放尚未接入，不误发火球。技能书供货、正式职业数值及各职业施放链仍未完成。

## 固定来源

| 来源 | 支持的范围 |
|---|---|
| [旧 Delphi FState.pas](https://github.com/pangliang/MirServer-Delphi/blob/f829679d24acb3a097d396d737ab067db2c88ca2/MirClient/FState.pas#L1515) | 原229窗口、F1–F8/None/提交帧号与布局；同文件 DStMag1Click、SetMagicKeyDlg、DKsF1Click 处理选键与冲突 |
| [Crystal MirConnection.MagicKey](https://github.com/Suprcode/Crystal/blob/0e315fe327192afe52c3d7357ddd1f5b7e26c5b8/Server/MirNetwork/MirConnection.cs#L1543) | 同键解除旧技能并设置新技能；网页范围收窄至0–8，不进入后期英雄键位空间 |
| [Crystal UserMagic](https://github.com/Suprcode/Crystal/blob/0e315fe327192afe52c3d7357ddd1f5b7e26c5b8/Server/MirDatabase/MagicInfo.cs#L88) | Key 与技能、等级、熟练度的原生存档读写 |
| [旧 Delphi ClientUseItems](https://github.com/pangliang/MirServer-Delphi/blob/f829679d24acb3a097d396d737ab067db2c88ca2/EM2Engine/ObjBase.pas#L15511) | StdMode31、AniCount0 解包检查空位后消耗一包，GetUnBindItems 创建六件物品；不是普通堆叠拆分 |

这些固定项目是实现和历史行为的候选证据，并非中国官方1.76服务器资料认证。客户端窗口交互、服务端协议编码与游戏数值分别处理：旧客户端数字字符键码不会直接当成 Crystal 的数值键码。

## 消耗品冲突：暂不写入规则

已读取两份候选 `StdItems` 数据：`mrzhqiang/mirserver-1.76@39e17246a32247a2c43c4cc481e97e88c692fa53` 与上述 Delphi 固定版本，提取原文保留在本地 raw-assets/reference-*。

| 商品/字段 | mirserver-1.76候选 | Delphi候选 | 处理 |
|---|---|---|---|
| 小红/小蓝药包 Shape / Looks | 102/399、103/395 | 同左 | 可支持商品身份；仍须对照用户客户端图像 |
| 上述药包 Weight / Price | 8 / 680 | 7 / 680 | 重量冲突，不直接导入 |
| 护身符(大) Weight / DuraMax / Price | 1 / 200 / 3630 | 3 / 20000 / 1000 | 持久单位和价格、重量存在差异，不能把原字段当次数照搬 |

后续完成条件：形状到单件物品名的解包配置、六件生成时的容量/重量与失败回滚、零空间/剩余五格边界、配套药店捆包、符毒持久单位及每次技能的消耗条件。暂不增加任意堆叠入口，也不改现有药价。

## 验证与隔离

- `node --test tools/*.test.mjs`：63项通过；新增覆盖实际键位派发、弹窗内键盘不施法、等待确认、重复/过期请求、失败/断线、训练字段保留和小地图遮挡。
- `.runtime/dotnet/dotnet run --project tools/CrystalContentTests -- "$PWD"`：真实引擎书本学习、熟练度、交易、掉落等回归及新键位测试通过；包括占用键替换、None、F8、非法键/未学技能不修改、回包不可变、重复设定与原生二进制存档读回。
- TypeScript 检查、Cocos 网页构建通过；`tools/test-ui.py` 确认430帧原像素、偏移及12文件哈希。

浏览器验收使用 `tools/prepare-skillkeys-qa.py` 创建独立存档及随机测试账号。该脚本只在 `.runtime/skillkeys-qa` 生成内容，拒绝覆盖；不复制现有账号。测试角色预置跨职业技能，仅用于界面/协议验收，不能据此认定职业规则或学书流程已完成。隔离端口为17610/17180/17100，日常端口17600/17080/17000不受影响。具体启动命令由脚本输出，凭据仅写本地文件。

浏览器已通过真实登录、火球改F3、治愈术接管F3（火球变未绑定）、退出重登保留、未设置键提示、未实现施法提示。隔离服务正常关闭并重启后，F3绑定仍保留。最终版本又验证None取消、F8/Enter保存、Esc取消未提交选择、小地图隐藏/恢复、聊天Enter焦点恢复；真实选择稻草人后按F8，服务端回报施放火球，MP从65降至62（测试配置，不用于认证1.76消耗公式）。原生图标及无重叠窗口截图保留于本地 docs/qa/skillkeys-native-dialog.png 与 skillkeys-list-saved.png。

日常17600网页也用已有独立测试账号登录验证了未学技能的空状态和小地图遮挡；本地17080服务已重新启动，0错误构建，保持两张地图和原存档。
