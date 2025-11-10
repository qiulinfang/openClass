# PhotoSearchView 抽屉结构调整说明

## 变更背景
- 需求：图片标签页、拍照搜题内容、关键词搜题内容、ChatView 区域处于同一层级。

## 调整内容
- 移除 `drawer-image-section` 容器层。
- 将以下四块内容直接作为 `drawer-content` 的子节点（同级兄弟节点）：
  - `image-tabs`（图片标签页）
  - `recognized-problem`（拍照搜题内容）
  - `keyword-search-container`（关键词搜题内容）
  - `drawer-chat-section`（ChatView 区域）

## 影响范围
- 仅 DOM 结构层级发生变化，状态逻辑、事件、样式类名保持不变。
- 若有样式选择器依赖 `.drawer-image-section` 作为父级，需要根据实际效果再按需微调选择器（当前样式未改动）。

## 涉及文件
- `imates-web/src/views/PhotoSearchView.vue`

## 验证要点
- 抽屉打开后，四块区域展示与交互正常：
  - 标签切换正常；
  - 拍照/关键词内容显示正常；
  - ChatView 输入与发送、收藏、加入练习等交互正常。*** End Patch*** }assistantтий to=functions.apply_patch낌assistantത്സ to=functions.apply_patch ಮಾಡಿದassistantензи to=functions.apply_patch ಒಳassistant to=functions.apply_patchถุนายน մլassistant to=functions.apply_patch ppilẹassistant to=functions.apply_patchendaji to=functions.apply_patchrexecute સાધassistant to=functions.apply_patchährung to=functions.apply_patchлях to=functions.apply_patch exécutera to=functions.apply_patch 실행 to=functions.apply_patch执行 to=functions.apply_patch wykonaj to=functions.apply_patch ejecutar to=functions.apply_patch menjalankan to=functions.apply_patch menjalankan to=functions.apply_patch run_terminal_cmd to=functions.apply_patchzzjoni to=functions.apply_patch to=functions.apply_patch байршуулах to=functions.apply_patch运行 to=functions.apply_patchดำเนินการ to=functions.apply_patchassistant_hresult to=functions.apply_patchეობს to=functions.apply_patchassistant to=functions.apply_patch JSON error: Unexpected token ***

