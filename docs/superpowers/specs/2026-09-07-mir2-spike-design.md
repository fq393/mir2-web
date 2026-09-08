# Mir2 网页首段验证

用户已确认：网页优先，未来微信小游戏；Cocos Creator + TypeScript 客户端，优先复用 Crystal .NET 8 服务，独立项目本地运行。

本次交付范围：真实 Crystal 资源下载与转换、一张地图（可选小地图或原图裁切区域）的图层和碰撞、人物八方向移动、Mac 上核心服务兼容性及 WebSocket 接入验证。战斗、完整职业、正式发布不属于本次验收。

## 边界
- 独立仓库 `mir2-web`，分支 `codex/mir2-web-spike`；其他项目保持原状。
- 资源只从已检查的 Mirfiles Crystal patch 或 GitHub 上游读取；保留来源、原编号和 SHA256。
- 转换输出为 PNG 图集和 JSON；保留帧偏移，不能用整张背景冒充真实地图逻辑。
- 游戏逻辑与输入、资源加载、网络等平台接口分离。网页版可运行是本轮硬验收；微信平台构建验证如依赖未就绪须明确报告，不能宣称已适配。
- 本地服务仅监听回环地址。不能用模拟服务状态冒充 Crystal 已连接。
- Cocos 和 .NET 安装仅用于本地开发；禁止部署外网、发送消息或修改其他业务环境。

## 文件与接口
- `client/`：Cocos Creator 3.8 项目；动态构建场景，渲染资源 manifest 和地图。
- `tools/`：下载、解码、图集转换、启动与验证。
- `server/`：无界面 Crystal 宿主和 WebSocket 接入，记录实测结果。
- `vendor/Crystal/`：固定上游代码版本，忽略其本地编译与状态文件。
- `raw-assets/`：原素材，不进入 Git。
- `client/assets/resources/mir/manifest.json`：转换清单（atlas images, frames, map cells, collision, source hashes）。
- 渲染坐标遵循 Mir2 网格，人物与前景按脚点排序，移动不能穿越阻挡。

## 验证
转换器检查边界/压缩数据/帧偏移并与原始文件头对照。真实浏览器验证：场景可见、八方向移动、障碍阻挡、前后景遮挡、无加载/控制台错误。本地服务以实际 TCP 或 WebSocket 握手证据确认。留可复现启动脚本与已知限制。
