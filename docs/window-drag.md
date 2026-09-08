# 包裹与人物窗口移动

## 依据

固定lzxsz/MIR2的FState.dfm中DItemBag、DStateWin均为TDWindow，Floating=True；固定pangliang/MirServer-Delphi的MirClient/DWinCtl.pas中TDWindow.MouseDown调用ChangeChildOrder置前，MouseMove按鼠标增量修改Left/Top。当前网页实现移植浮动位置与点击置前，不新增画出来的拖动按钮。

两份候选的输入边界并不完全相同。网页本批仅以包裹上沿12像素和人物名字上方40像素为拖动区域；其他原背景区域尚未全部映射。窗口限制在800×600画布内，避免移出后无法找回，这是网页适配边界，不是1.76玩法规则。Escape的历史来源含后期改动，先保留已有取消携带/关闭行为，不把“只关闭最上层”当作已确认原规则。

## 实现与联动

- 独立保存两个窗口的位置和层级，点击置前；翻页、穿脱/移动回包与关闭再开保留本次会话的位置。
- 节点位置与地面屏蔽矩形一起更新；窗口完整背景阻止输入落到重叠的下层物品。
- 拖动期间取消路径、清除说明；松手不转换为地面寻路或物品点击。携带物品或等待物品回包时不启动窗口拖动。
- 页面失焦、切换业务窗口、断线取消拖动；新角色进入恢复默认位置，避免继承上一角色会话。
- 鼠标坐标使用画布实际尺寸换算到800×600，物品下栏随父窗口移动；不把屏幕像素直接用作逻辑坐标。

## 验证

99项Node回归、TypeScript和Cocos Web构建通过。新增坐标/边界、焦点顺序、拖动释放与断线取消回归。全背景拖动、更多触屏设备、多业务窗口层级仍待验证。

实景AppearanceFixture（隔离17180/17610）：包裹由(0,0)拖至(200,80)，人物由(568,0)拖至(268,100)，点击重叠位置时下层布衣ID2未被取走；包裹置前后同格正常携带ID2。切人物属性页后位置和层级保持，角色始终在288:615。画布改为1244×933后，再拖包裹至(260,30)；关闭再打开仍在原位，人物窗保持打开，原三行物品说明随包裹移动。截图window-drag-bag/overlap/scaled.png只保存在本地。

输入事件参考[MDN Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events#compatibility_with_mouse_events)：拖动pointerdown阻止兼容鼠标事件，并处理pointercancel；额外拦截拖动松手的兼容鼠标事件，避免被引擎当作点击。

原控件依据：[固定DWinCtl.pas](https://github.com/pangliang/MirServer-Delphi/blob/f829679d24acb3a097d396d737ab067db2c88ca2/MirClient/DWinCtl.pas)，TDWindow.MouseDown/MouseMove与TDControl.ChangeChildOrder。

缩放后的重叠窗口继续完成穿戴：从移动后的包裹拿起布衣ID2，置前人物窗并放入衣服位，服务端确认后装备为木剑ID1/布衣ID2，包裹无残留副本，窗口仍在(260,30)/(268,100)，角色位置不变。
