# 原生界面

2026-09-07：现用统一800×600坐标、原包384对话与385购物表格、原生386确认按钮、12像素黑描边名字；F9/F10分别打开背包和人物。依据、范围和未完成项见 [系统复刻清单](176-system-audit.md)。原Windows字体未打包，使用系统宋体类回退。以下保留前期研究记录，旧截图/坐标不再作为当前实现。

# 当前原包 UI 接入

2026-09-07：现在从用户提供的 `传奇1.76客户端.rar` 导出409帧、两张2048图集，替换此前Crystal Items/Stateitem/MagIcon和1.4界面输入。原包来源、WIL/WIX哈希与所选帧在 `tools/client-176-inputs.json`；`tools/test-ui.py`逐帧校验原RGBA和偏移。背包、纸娃娃、小红9、小蓝11均来自同包。纸娃娃使用该包自己的偏移，不能沿用Crystal的绘制原点。

游戏窗口布局仍属待复刻项，原图导出通过不表示布局符合1.76。完整整改见 [系统复刻清单](176-system-audit.md)。以下为先前来源记录。

# 原生灰石界面

历史上采用用户确认的 Mirfiles [1.4Prguse.rar](https://www.mirfiles.com/resources/mir2/Data/UI/)，替换此前 Crystal 金色龙头界面。包名为 1.4，未将其标注为已鉴定的盛大 1.76 客户端。装备图标、纸娃娃与技能图标来自同站 Crystal 原库。没有生成或重绘替代素材。

| 界面 | 原库帧 |
|---|---|
| 800×251 灰石底栏 | ClassicPrguse 1 |
| 血魔球 | ClassicPrguse 4，按左右半幅及当前比例裁切 |
| 背包 8×5 | ClassicPrguse 3 |
| 装备面板、人物底图 | ClassicPrguse 370、376 |
| NPC 对话、商店 | ClassicPrguse 360、380 |
| 木剑、布衣图标及纸娃娃 | Items / Stateitem 30、60 |
| 火球、攻击图标 | MagIcon 0、4 |

524 帧打包为两张图集；原 RGBA 与偏移均逐帧核验。WIL 读取依据固定 Crystal 源码的 WeMadeLibrary：48 字节 WIX 头、8 字节帧头、内嵌调色板、倒序像素行。界面整体缩放适配网页；聊天内区按原客户端思路深色着色，动态文字使用中文。

原底栏按钮使用透明点击区域。背包点击穿戴，装备图标点击卸下；商店选商品后点击原图 USE 按钮购买。支持回城复活、音效静音。当前未实现拖放、拆分堆叠和完整属性页。

原文件和归档哈希记录在 tools/ui-inputs.json。获取、转换、核验分别执行 tools/fetch-ui.py、tools/convert-ui.py、tools/test-ui.py，使用项目 assets-venv Python。
