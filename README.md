# 玛法 · Mir2 网页复刻

Cocos Creator **3.8.8**、TypeScript **5.9.3**、Crystal **.NET 8**。先做中文网页端与比奇省，后续评估微信小游戏。

**原则：复刻已有中国版1.76，不创造玩法或数值。** 原包素材、固定源码和同期资料分别取证；候选私服数据库不等于官方数据库。当前是持续开发中的本地版本，尚不是完整1.76。

## 已接入

- 原注册/登录/改密/创建窗口与真实账户；战法道、男女性别、角色列表及退出重登；空状态、自动选中、双位分页和重名中文反馈。
- 原聊天区文字输入、中文私聊/队聊、Ctrl+H攻击模式、G组队窗口及服务器成员同步。
- 比奇原小地图、默认800×600与适应窗口切换；本地数值后台预览/保存/恢复基线。

- 比奇700×700地图、区块加载、碰撞、服务端移动与多人同步。
- 原生800×600灰石UI、血魔球、头顶血条、背包、装备纸娃娃、NPC对话、三列商店。
- 背包格子移动/交换、双击穿戴和三类服务端负重；见[背包验收](docs/inventory-interactions.md)。
- 首饰店0105实际进出、三个柜台NPC、11件交叉核对商品购买。
- 三位原肉商收购、首饰出售/普修/特修原窗口与服务器校验；采集肉出售及重登已实测，精确价格冲突和浏览器正向修理仍待核对，见[商店交易](docs/merchant-transactions.md)。
- 服务端最终血蓝上限与负重快照；经验获取、升级余量同步，原经验/负重条。
- 实际已学技能及熟练度列表、分页、增删同步；主动特效仍只接入部分技能。
- 原包36个音效；图集分桶索引、场景资源释放与HTTP缓存校验。

73项任务与当前状态：[任务总表](docs/TASKS.md)。

当前边界与验收：[系统路线](docs/systems-roadmap.md)、[显示问题核查](docs/health-and-remaining-audit.md)、[性能设计](docs/performance.md)。全技能/技能书、怪物规则与掉落、完整商店与价格校准、任务社交、其他室内、大地图和BGM仍需继续完成与版本核对。

## 本地运行

已有构建和资源时：

```sh
npm ci
npm start
```

账户/聊天/组队与数值配置说明：[本轮系统说明](docs/accounts-social-admin.md)。现提供五类中文表单、筛选分页及保存前差异预览，见[管理台说明](docs/admin-console.md)。管理地址：[本地数值后台](http://127.0.0.1:17080/admin)，保存后重启服务生效。

访问 [本地游戏](http://127.0.0.1:17600/)。Web 17600、WebSocket 17080、Crystal TCP 17000均只监听回环地址。保留启动终端；`启动传奇.command`是同一入口。

操作：Enter聊天、Escape退出输入；Ctrl+H攻击模式；G组队；点击地面寻路；WASD/方向键移动；选中怪物后空格近战；靠近尸体后 Alt+左键采集；1–6药品栏；背包内单击选择后点击目标格移动/交换，双击使用/穿戴；B/F9背包、F10人物、F11技能、Escape关闭。F1–F8按已保存键位施放；F11点击已学技能设置快捷键或None，提交保存。当前主动施放仍只接入火球，其他技能明确提示未接入。这些输入仍含测试操作，并非全部原版快捷键。

## 新环境准备

当前支持的构建环境：macOS、Node **24+**、Python **3.10+**、Git、curl；Cocos CLI会生成客户端临时类型配置。

```sh
npm ci
bash tools/setup-cocos.sh
bash tools/setup-dotnet.sh
bash tools/setup-assets.sh
# 原地图/Crystal素材获取；详见素材说明，首次可能需要ego-browser
.runtime/assets-venv/bin/python tools/fetch-assets.py
.runtime/assets-venv/bin/python tools/convert-assets.py
# 自行准备原客户端并解包至 raw-assets/client-176/，核对输入清单中的路径和哈希
.runtime/assets-venv/bin/python tools/convert-ui.py
.runtime/assets-venv/bin/python tools/convert-classic-npcs.py
.runtime/assets-venv/bin/python tools/convert-interiors.py
.runtime/assets-venv/bin/python tools/fetch-audio.py
npm run build
npm start
```

[素材来源](docs/asset-sources.md)、[原生UI](docs/native-ui.md)、[文字排版](docs/native-text-layout.md)、[音频映射](docs/audio-sources.md)、[首饰对照](docs/jewellery-sources.md)。本仓库**不包含原客户端、原资源、转换图集/音频、运行环境、账号存档及游戏截图**；缺少资源时不能只clone后直接打开游戏。

完整[模块目录与版本边界](docs/module-catalogue.md)记录系统范围和待核对项。

## 架构与规则

客户端只负责输入、表现与服务端回包展示；经验升级、交易、装备和战斗由Crystal结算。桥接不接受浏览器直接设置等级/金币/生命值。

Crystal固定提交`0e315fe327192afe52c3d7357ddd1f5b7e26c5b8`。启动脚本获取上游，拒绝不同提交或修改过的受版本控制源码。`tools/prepare-engine.py`生成仅插入一次属性快照调用的Envir副本，`server/engine/CrystalEngine.csproj`编译；原检出不修改。快照在单线程游戏循环中读取最终Stats，再供WebSocket线程读取不可变记录。见[系统路线](docs/systems-roadmap.md)。

经验需求在`server/content/experience.json`，目前1–50级为有来源的候选对照表，18级存在冲突并记录采用理由；不能宣称全部官方数值已认证。技能熟练度候选表冲突较大，尚未整体迁入。演示怪物/基础物品配置也仍须替换。

## 验证

```sh
npm test
# 完成Cocos导入/构建后
./node_modules/.bin/tsc -p client/tsconfig.json --noEmit --skipLibCheck
.runtime/dotnet/dotnet build server/Mir2.Headless.csproj
.runtime/dotnet/dotnet run --project tools/CrystalContentTests -- "$PWD"
.runtime/assets-venv/bin/python tools/test-ui.py
.runtime/assets-venv/bin/python tools/test-harvest-assets.py
.runtime/assets-venv/bin/python tools/test-interiors.py
.runtime/assets-venv/bin/python tools/test-audio.py
.runtime/assets-venv/bin/python tools/test-jewellery.py
```

源码测试无需商业资源；.NET测试需要先由启动脚本准备固定上游。原包像素校验须有本地资源，Paradox交叉校验另需可用的pxlib。每轮还需浏览器实景验证，不以构建通过代替玩法验收。

## GitHub源码导出

开发机早期Git历史包含本地生成资源，首次上传使用`tools/export-source.py`生成独立、无这些二进制历史的源码工作副本，位于`.runtime/github-source`。导出不改变原工作树或删除素材；后续更新在该副本提交并推送。不要从早期资源历史执行镜像推送。

上游代码与素材权利分别保留给相应权利人；本仓库不重新授权游戏资源，见[第三方说明](docs/third-party.md)。

### 最新跟进：技能书与怪物显血

背包技能书支持双击请求学习，职业/等级/重复学习由服务器校验，成功回包后才扣书；学习、训练及技能上限已有隔离引擎测试。浏览器近战已实际确认怪物受击后显示原生血条。技能书供货和完整购买学习流程尚未接完，技能数值仍需1.76资料校准，详见 [系统路线与验收](docs/systems-roadmap.md)。

### 比奇生态与后续地域

已接鹿/稻草人候选基础属性、52组区域刷新、稻草人掉落白名单、原生地面物品和服务器确认拾取；真实击杀/拾取/重启保存已验收。规则来源及未完成部分见 [怪物掉落与刷新](docs/wildlife-sources.md)。比奇完整新手循环、周边洞穴、沃玛/毒蛇山谷、盟重、封魔、白日门/赤月、苍月及特殊区域的阶段依赖见 [世界流程规划](docs/world-progression-plan.md)。

采集与极品：已接 Alt 左键采尸、鹿肉入包与满包重试、单件附加属性登录/展示、三种基础戒指的候选极品生成。材料→制毒→施毒的完整依赖和概率证据见 [采集与极品属性](docs/harvest-and-bonuses.md)；尚未宣称毒材料链路与所有装备随机属性完成。

### 技能快捷键跟进

原生F1–F8/None选键、冲突解除、服务端确认与角色存档已接入。药品包重量和符的持久单位存在候选数据冲突，暂未照搬，见[技能键位与消耗品取证](docs/skill-keys-and-consumables.md)。

### 比奇书店与初级学书

比奇书店老板位于比奇省325:250，提供三本初级技能书。购买、职业/等级限制、学习、键位及重登保存已实测；技能参数和完整三职业施放仍待校准与接入。见[书店来源、转换和验收](docs/bookshop-learning.md)。
