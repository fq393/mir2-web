# 中国 1.76 版本核对 · 2026-09-07

## 当前更新：原包已接入

用户提供的桌面归档为274028185字节，SHA256 `41372080474b00796c1d931946f162993f8b5d5b3078c2d2aab3800e065500b9`；解包1177文件，含528地图、545音频。UI/Items/Stateitem/MagIcon现从该包导出409帧，12个WIL/WIX文件哈希及全部输出像素、偏移已验证。Items570、DnItems565、stateitem560末尾索引越界，未使用且记录；按需读帧不吞掉所选帧异常。

小红/小蓝已接入商店、六格物品栏与UseItem，服用由Crystal服务端处理；前端仅成功回包后扣除。实际购买金币200→24；F1施法MP14→11，按2服药MP回14且仅蓝药消失；卸衣受伤HP14后按1回18，收到恢复5的服务器回包。36/36音频解码无错误，108喝药事件出现。当前药剂参数依老资料暂作对照，不能宣称所有1.76规则已核定。

项目硬原则与系统缺项见 [系统复刻清单](176-system-audit.md)。以下记录保留本轮变更前问题背景。

## 本次实际发现

当前是 Crystal 引擎上的本地演示，不能标为完成 1.76 复刻。灰石界面来自 1.4Prguse.rar；Items、Stateitem、CArmour/CWeapon 等来自 Crystal 补丁，逐像素导出只证明忠于该输入，不证明输入属于 2003 年盛大 1.76。

木剑原演示数值为攻击 5–9、魔法 4–7、重量 1；布衣为防御 1–3、重量 1。本次修正可交叉核对的字段：木剑攻击 2–5、无基础魔法、重量 7、等级 1；布衣防御 2–2、魔防 0–1、重量 5、等级 1。已有物品索引、角色与装备保留，不删除存档。价格 25 与持久 10000 仍是演示值，不能当作 1.76 数据。

药剂实际尚未实现：没有药剂商品和 UseItem 桥接；底栏六格错误地用了火球/近战按钮，数字 1 还被占为火球。当前不能声称有符合 1.76 的药剂系统。正确实施应把物品快捷栏、技能快捷键、物品消耗和服务器回血分开核验。

## LOMCN 可用的资料

- [Collection of all legend of mir 2 clients!](https://www.lomcn.net/forum/threads/collection-of-all-legend-of-mir-2-clients.111907/)：2024 年收藏帖，分别列出 1.76 261.3MB、2003 年 311.64MB、2005 年 1.80 等客户端。优先沿明确年份的完整包追溯 Items.WIL/WIX、DnItems、StateItem、Hum、Weapon，不能只取名字含 1.76 的现代私服包。
- [1.76 候选原包](https://pan.baidu.com/s/1i5R41Hr)：本次页面仍显示 261.3M 文件；点击下载唤起 baiduyunguanjia 协议，浏览器 ERR_UNKNOWN_URL_SCHEME，现已由用户下载并解包、固定哈希；尚未完成官方版本鉴定。
- [2003 年候选包](https://pan.baidu.com/s/1oSZQGmHiA_bY46APPyWxCw)：帖内提取码 ckyo，尚未下载核验。
- [About JEV's database and future development of Crystal M2](https://www.lomcn.net/forum/threads/about-jevs-database-and-future-development-of-crystal-m2.107547/)：回复说明 JEV 数据更接近韩版；这解释了不能将通用 Crystal 数据库直接当作中国 1.76 标准。
- [Crystal 教程](https://www.lomcn.net/forum/forums/crystalm2-tutorials.634/)、[Mir 2 Releases](https://www.lomcn.net/forum/forums/mir-2-releases.282/)、[Mir 1.4 Archive](https://www.lomcn.net/forum/forums/mir-1-4-archive.249/) 可用于引擎、图库格式和历史版本追溯；1.4 不等于中国 1.76。
- [GitHub 苹果引擎 1.76 参考服务端](https://github.com/mrzhqiang/mirserver-1.76/tree/39e17246a32247a2c43c4cc481e97e88c692fa53)：发现 mud2/db/StdItems.DB，但仓库版本声明本身不足以证明官方数值；没有导入整库或运行其二进制。

## 物品交叉对照

- [早期武器资料表](https://mir.17173.com/item/item2.htm)：木剑等级 1、攻击 2–5、重量 7、持久 4。
- [早期盔甲资料表](https://mir.17173.com/item/item3.htm)：布衣等级 1、防御 2–2、魔防 0–1、重量 5、持久 5。
- [新手装备指南](https://mir.17173.com/content/2015-06-03/20150603142517760.shtml)：木剑攻击和重量一致，但持久写 5，与上表冲突，所以本次未冒称已校准木剑持久。
- [早期药剂资料及原图](https://mir.17173.com/item/item.htm)：小金创药恢复 20 HP、小魔法药恢复 30 MP，页面售价均为 88；需与完整原包及服务器数据库再次核对后应用。小红/小蓝原图已经打开目视对照，不能把 Crystal 当前任意红/蓝瓶按颜色随意命名。
- [官方通讯社装备说明](https://mir2.sdo.com/web7/articleDetail.html?id=17261)：普通木剑不带基础魔法，增加魔法属于极品。当前演示 4–7 魔法明显不适合作为标准木剑。

## 尚待完成的具体工作

取得候选原包后固定哈希与来源，按同一物品同时核对背包图、地面图、纸娃娃和角色动作。校准价格、持久、性别、等级和职业限制。然后实现药剂购买、六格物品栏、服用数量回包及持续回血/瞬回区别，技能回归 F 键。当前战士直接学习火球仍为演示设置，未改称标准职业规则。

## 本次验证

.NET 构建成功，0 警告、0 错误。本地服务 revision=bichon-equipment-audit-v2；实际浏览器重新登录后，背包/装备回包显示木剑 2–5、MC 0–0、重量 7，布衣 AC 2–2、MAC 0–1、重量 5。没有执行全套新版本玩法验收；本次仅校对并验证上述基础字段。

最后回归：网页重建成功；修正纸娃娃在新WIL下的绘制原点，浏览器打开装备窗确认衣服与武器回到人物上，没有漂出窗口。25项自动测试通过；归档选帧读取测试通过；409帧原像素与偏移、36个WAV校验通过。本地服务保持运行。比例、中文系统消息、商店布局和室内切换仍未完成，不属于本轮已验收项目。
