# 动态字体核对

2026-09-09；本轮范围：属性数值、金币、物品说明、技能页及DOM字体配置。

## 来源及边界

- [Microsoft SimSun字体说明](https://learn.microsoft.com/zh-cn/typography/font-list/simsun)：SimSun/NSimSun为简体中文宋体类字族。此来源说明字体身份，不能证明任意候选传奇客户端全局采用该字体。
- [固定候选FState.pas](https://github.com/lzxsz/MIR2/blob/98711dad31567d9a7e272956f6c5a2487000848b/GameOfMir/MirClient/FState.pas)：2970附近属性数值clWhite；3102附近技能文字clSilver；3138装备说明Font.Size=9；4642金币金额clWhite。9pt在96dpi对应12 CSS像素，用于当前逻辑尺寸标尺。DFM窗体默认字体不等于DirectDraw动态绘字字体，未据此宣称官方1.76统一字族已确认。
- 本地固定Cocos 3.8.8的ttfUtils._updateFontFamily和text-processing将Label.fontFamily用于Canvas字体描述。本轮未增加字体网络请求或修改原图内文字。

## 确认问题与变更

之前Canvas/物品测量使用NSimSun优先，登录/聊天/组队/确认框各自使用SimSun优先。现抽取core/typography.ts，让这些位置共用同一字体栈，物品宽度测量也从同一常量生成12px描述，防止后续只改绘制不改测量。

浏览器CSS.getPlatformFontsForNode实际返回Songti SC / STSongti-SC-Regular，并非SimSun。当前Mac没有Windows字体；共享配置只能统一选择顺序，不能把Mac字形变成旧Windows位图字。当前raw-assets未找到独立TTF/OTF/FON。

| 位置 | 本轮结果 |
|---|---|
| 属性数值 | 12逻辑像素、纯白，保留原字段；AC/MAC等标签是原素材内字，不用新字体覆盖 |
| 金币金额 | 12逻辑像素、纯白，原金币图已在上批恢复；“金币”文字仍为用户要求的金色中文标签 |
| 技能名称/等级/经验 | 等级和经验从11改为12逻辑像素；三者统一候选源码clSilver即#c0c0c0；Lv/Exp/F键仍用原图 |
| 物品说明 | 12逻辑像素，名称#ffff00、说明#ffffff、拒绝要求#ff0000；长文沿用完整浮层，不用缩字掩盖溢出 |
| 登录/聊天/组队/确认框 | 共用字体栈；原有各窗口字号未凭空全部改成一样 |

## 实景验证

隔离17180/17610，以真实键鼠登录法师账号，B与F11打开包裹/技能，两次上翻打开状态页，鼠标悬停治愈术。读取Label确认属性7行及金币金额均12px白色，聊天font-family与Canvas配置一致。原始800×600与适应窗口1242.66×932截图目视检查，属性、6250金币、技能0和1/200及治愈术三行没有截字/越框。Font宽度量测与DOM字体识别探针均已删除；无账号/游戏状态注入。

TypeScript和Web构建通过。截图font-bag-skills.png、font-attributes-native.png、font-attributes-fit.png、font-description-fit.png仅留本地。

## 仍需完成（HUD-05/HUD-06）

- 官方1.76运行时字族/位图栅格的直接证据，Windows实际运行对照；不能以现代抗锯齿宋体冒充像素完全一致。
- 可分发的确定字源方案和Linux/微信平台缺字回退；不把系统字体文件直接打包进源码库。
- 长角色名、全部技能经验位数、极品长属性、最大金币金额的跨平台实景矩阵。本轮6250与1/200通过不等于所有数字长度通过。
- NPC/怪物名字字号/轮廓、商店/修理全部文字基线和按钮状态继续依清单验证；本轮不将全游戏字体标为完成。
