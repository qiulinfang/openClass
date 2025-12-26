问题序号：DraggableDialog出现滚动条问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`通用弹窗组件 DraggableDialog 的内容展示`
- **发现日期**：`2025-12-26`
- **解决状态**：`已解决`

## 问题现象
`DraggableDialog.vue` 的内容区域出现明显滚动条，影响 UI 观感。用户要求“不能出现滚动条”。

## 复现步骤
1. 打开任意使用 `DraggableDialog` 的页面。
2. 当弹窗内容区域高度不足以容纳全部内容时。
3. 观察：内容区显示浏览器默认滚动条。

## 用户体验
- 弹窗视觉不统一，滚动条显得“脏/突兀”。
- 在 Android WebView 中滚动条更影响观感。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/DraggableDialog.vue`：`.dialog-content-section` 样式。
- **涉及模块**：
  - 通用弹窗组件：拖拽、缩放、内容容器。

## 技术原因 (❌)
1. 内容区域使用 `overflow: auto;`，当溢出时浏览器会渲染滚动条。
2. 原本存在“自定义滚动条”样式，仍然会显示滚动条。

错误示例：
```scss
// ❌ DraggableDialog.vue
.dialog-content-section {
  overflow: auto;
}

.dialog-content-section::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
```

## 正确实现方案 (✅)
保留滚动能力（仍可滚动），但隐藏滚动条渲染：
1. Firefox：`scrollbar-width: none;`
2. IE/旧 Edge：`-ms-overflow-style: none;`
3. WebKit：`::-webkit-scrollbar { width: 0; height: 0; }`

正确示例：
```scss
// ✅ DraggableDialog.vue
.dialog-content-section {
  overflow: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.dialog-content-section::-webkit-scrollbar {
  width: 0;
  height: 0;
}
```

## 关键代码/公式
```scss
-ms-overflow-style: none;
scrollbar-width: none;
::-webkit-scrollbar { width: 0; height: 0; }
```

## 测试验证
- **测试场景**：
  - 场景1：弹窗内容超出高度，预期可滚动但无滚动条。
  - 场景2：弹窗内容不超出，预期无滚动条。
- **验证方法**：
  - 方法1：Chrome/Edge/Firefox/Android WebView 观察是否显示滚动条。
  - 方法2：鼠标滚轮/触摸滑动仍可正常滚动内容。

## 预防措施
- 通用组件的滚动策略需要统一（是否展示滚动条、滚动容器边界）。
- 新增组件时明确 UI 规范：是否允许显示系统滚动条。

## 相关链接/参考
- 相关文件：`imates-web/src/components/DraggableDialog.vue`

## 可复用经验
- “不出现滚动条”通常意味着“隐藏滚动条”而不是禁用滚动；需要兼顾可用性与视觉。
