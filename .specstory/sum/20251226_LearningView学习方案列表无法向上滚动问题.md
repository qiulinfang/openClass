问题序号：LearningView学习方案列表无法向上滚动问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`LearningView 弹窗左侧学习方案列表（RubberBandList 滚动体验）`
- **发现日期**：`2025-12-17`
- **解决状态**：`已解决`

## 问题现象
学习方案列表内容超过容器高度时，列表无法正常向上滚动，只能出现“向下拖动/回弹”的交互，导致用户无法浏览列表上方内容。

## 复现步骤
1. 打开 `LearningView`（学习内容对话框）。
2. 让左侧学习方案列表数据较多，超过容器高度。
3. 在列表区域尝试向上滑动/滚轮滚动。
4. 观察：无法向上滚动，只有向下拖动的效果。

## 用户体验
- 无法浏览完整列表，用户找不到目标学习方案
- 交互表现反直觉，误以为页面卡死或不可用

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/views/LearningView.vue`：列表容器样式
  - `imates-web/src/components/RubberBandList.vue`：滚动容器实现（根节点需 `overflow-y: auto`）
- **涉及模块**：
  - RubberBandList（橡皮筋滚动/下拉回弹）
  - LearningView 学习方案列表

## 技术原因 (❌)
1. **外层样式覆盖了 RubberBandList 的滚动**：
   - `RubberBandList` 根节点本应为 `overflow-y: auto; height: 100%`。
   - 但 `LearningView.vue` 给 `<RubberBandList class="scroll-wrapper scheme-list">` 写了 `.scroll-wrapper.scheme-list { overflow: hidden; }`，该规则直接作用于 RubberBandList 根节点，覆盖了组件内部的滚动设置。
2. **双滚动容器导致事件竞争**：
   - `.scheme-section` 同时存在 `overflow-y: auto`，父级可滚动会抢占滚动事件与手势，导致 RubberBandList 内部滚动/边界判断异常。

错误示例（关键点）：
```scss
/* ❌ 覆盖 RubberBandList 的 overflow-y: auto */
.scroll-wrapper.scheme-list {
  overflow: hidden;
}

/* ❌ 父级也可滚动，形成双滚动容器 */
.scheme-section {
  overflow-y: auto;
}
```

## 正确实现方案 (✅)
1. **确保 RubberBandList 根节点保有滚动能力**：
   - 将 `.scroll-wrapper.scheme-list` 的 `overflow` 调整为 `overflow-y: auto`（或不写 overflow 以使用组件默认）。
2. **避免父级容器滚动**：
   - 将 `.scheme-section` 设为 `overflow: hidden`，让滚动只发生在 RubberBandList 内部。

正确示例（关键点）：
```scss
.scheme-section {
  overflow: hidden;
}

.scroll-wrapper.scheme-list {
  overflow-y: auto;
}
```

## 关键代码/公式
- `RubberBandList.vue`：
```css
.rubber-band-scroll-view {
  height: 100%;
  overflow-y: auto;
}
```
- `LearningView.vue`：修复 `overflow` 覆盖与双滚动容器

## 测试验证
- **测试场景**：
  - 场景1：方案列表超过高度，能正常向上/向下滚动。
  - 场景2：列表未超高，滚动保持正常，回弹行为不异常。
  - 场景3：右侧资源列表同样使用 RubberBandList，滚动不受影响。
- **验证方法**：
  - 方法1：手动滑动/滚轮测试。
  - 方法2：移动端触摸滑动测试（检查 `touch-action` 与 `preventDefault` 是否生效）。

## 预防措施
- 约定：使用 RubberBandList 时，不要在外层 class 上覆盖 `overflow-y`。
- 给 RubberBandList 增加文档：明确“滚动容器必须是组件根节点”。

## 相关链接/参考
- 相关文件：`imates-web/src/components/RubberBandList.vue`

## 可复用经验
- 自定义滚动组件的根节点样式（overflow/height）非常敏感，页面层样式一旦覆盖就会导致滚动失效。
- 避免父子双滚动容器（尤其在 touch 场景），否则手势/边界判断容易冲突。
