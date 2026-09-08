# 外观身份与资源缺失处理

2026-09-08，P01 / AUTH-05 / BASE-05。本轮修复同步与绘制选择，不把未映射原发型标为支持。

## 固定依据

[Crystal PlayerObject](https://github.com/Suprcode/Crystal/blob/0e315fe327192afe52c3d7357ddd1f5b7e26c5b8/Client/MirObjects/PlayerObject.cs) 从ObjectPlayer读取Gender/Hair及Armour/Weapon；SetLibraries按各自编号选择库，PlayerUpdate更新穿脱后的Shape。UserObject.RefreshEquipmentStats使用真实物品Shape；耐久型装备当前持久为0时跳过外观装备层。网页沿用此处已运行的客户端表现，不额外创造持久损耗或战斗公式。

[旧Actor.pas](https://github.com/pangliang/MirServer-Delphi/blob/f829679d24acb3a097d396d737ab067db2c88ca2/MirClient/Actor.pas) 使用HUMANFRAME=600，Hair.wil内按发型和男女分段。当前本地Hair.WIX有3600条；Crystal CHair/00.Lib使用另一种分库/动作偏移。抽查Hair帧0/600/1200/1800/2400/3000与CHair00帧0，尺寸或RGBA均不同。不得把旧Hair1直接对应CrystalHair1，也不添加后期发型染色规则。

## 本轮改动

- 登录UserInformation的Hair原值穿过桥接；自己的发型与其他玩家ObjectPlayer的发型、性别分别保存。
- 身体和武器使用实际Shape，不再把所有非空装备画成布衣/木剑。Weapon=-1是空手，0是有效编号，不能用真假值判断。
- PlayerUpdate只改变对应玩家的衣服/武器，保留发型、性别、方向、名字和位置。对方穿脱无需重登才刷新。
- 当前持久DuraChanged同步到自己的单件装备；耐久为0时表现为空手/无衣服，修复后回到真实Shape。相关数值与损耗规则仍属COMBAT-04。
- 找不到actor库或帧时隐藏该层并清空旧spriteFrame；不会再用完整人物当作头发、NPC或怪物。缺失库去重记录到只读__MIRQA.state().missingActors，最多256条，不每帧刷日志、不在游戏画面添加提示栏。
- 空手采集不再强行显示木剑；采集动作本身保持原有动画，工具专属资源另按INPUT-01/ECO-05取证。

## 验收范围

新增4项纯逻辑回归：真实Shape/男女/发型编号、未知资源隔离、持久与空手语义、各方向循环及死亡末帧。加上现有66项共70项通过。

AppearanceFixture只在APPEARANCE_QA_ONLY独立目录生成两个测试账号和已知木剑/布衣，固定相邻位置；一个Hair0，一个刻意使用当前没有资源的Hair7，以验证缺失处理，不是正式创建角色规则。用户存档、素材和主世界刷新配置不改写。

浏览器实测记录在下方追加。尚未实现的全发型映射/颜色、全装备图、死亡复活和跨图矩阵保持待做；未知Shape现在不会冒充已支持。

## 双账号浏览器结果

独立17180/17610，真实账号登录/选角与键鼠操作，无页面内部动作调用。

1. 男性Hair0显示既有hair0；女性Hair7原值传到自己与对方，缺失层隐藏，诊断为hair7f。双方空手Weapon=-1不再残留木剑。
2. 男性背包双击木剑和布衣，自己的两件装备Shape均为1、持久10000；女性旁观者收到Armour1/Weapon1，场景对应外观改变。
3. 男性原装备窗分别卸下武器和衣服；自己两格为空，旁观者回包为Armour0/Weapon-1，渲染完成后weapon节点与旧spriteFrame均清空，Hair0不变。
4. 女性背包双击布衣，自己和男性旁观者均收到Gender1/Armour1，使用女性衣服动作；Hair7仍作为未映射发型隐藏，不被衣服更新重置为Hair0。
5. 双方退出重登，男性仍为空手/无衣服、Hair0，女性仍穿衣服、Hair7，保存状态与重新出现的外观编号一致。

后台标签的模型回包会先更新，Cocos前台恢复后再更新绘制；第一次切回0.5秒采样曾观察到Weapon已为-1但上一帧仍显示，2秒再次采样节点与spriteFrame均已清空。将恢复时序/首帧检查继续归入PLATFORM-02，不把短时间模型正确误当作已绘制。

本地截图：docs/qa/appearance-observer-equipped.png、appearance-observer-unequipped.png、appearance-female-equipped.png。70项Node回归、TypeScript、Cocos Web与.NET构建通过。零持久和未知怪物/NPC目前由自动测试覆盖，完整实景矩阵仍待做。

下一步：P02物品说明与操作；P01剩余原发型映射、纸娃娃与缺资源内容启用预检持续取证，不能因为已经修复同步就标记AUTH-05整项完成。
