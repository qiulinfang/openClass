问题1：ScreenshotInputDialog多图缩略图高亮联动问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`AI聊天/截图批注弹窗（multiple 模式）缩略图列表交互`
- **发现日期**：`2025-12-26`
- **解决状态**：`已解决`

## 问题现象
多图模式下，右侧缩略图列表存在“高亮联动”现象：
- 当有 3 张图时，点击第 2 张缩略图，**第 2、3 张同时显示为激活高亮**。

## 复现步骤
1. 进入截图批注弹窗（`ScreenshotInputDialog`），模式为 `multiple`。
2. 先准备 3 张截图（其中后两张可能有相同 `dataUrl` 或相同预览内容）。
3. 点击第 2 张缩略图。
4. 观察到第 2、3 张缩略图同时处于激活高亮。

## 用户体验
- 造成“当前选中截图”认知混乱。
- 用户难以确认自己正在编辑/发送哪一张截图。
- 会降低多图批注流程的可用性。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/ScreenshotInputDialog.vue`：缩略图 active 状态判断与预览切换逻辑
  - `imates-web/src/components/ScreenshotThumb.vue`：缩略图组件展示（active / delete）
- **涉及模块**：
  - 多图截图批注流程（ChatView -> ScreenshotInputDialog）

## 技术原因 (❌)
1. 缩略图激活态判断使用了 `dataUrl` 之类的“非唯一字段”进行对比，导致当多张图内容相同（`dataUrl` 相同或高度相似）时，多个缩略图同时满足“激活条件”。
2. `previewImage` 与缩略图的等值对比，在多图场景下不稳定：
   - `previewImage` 代表当前预览内容，并不能唯一标识缩略图项。

错误示例（示意）：
```vue
<!-- ❌ active 使用 dataUrl/previewImage 做判断，遇到相同 dataUrl 会多选 -->
<ScreenshotThumb
  v-for="shot in thumbnailList"
  :key="shot.id"
  :active="shot.dataUrl === previewImage"
/>
```

## 正确实现方案 (✅)
1. 缩略图激活态应以“稳定且唯一”的主键作为判断条件：`shot.id`。
2. `currentShotId` 作为唯一选中态来源；点击缩略图时只切换 `currentShotId`。

正确示例（示意）：
```vue
<!-- ✅ active 使用唯一 id 判断 -->
<ScreenshotThumb
  v-for="shot in thumbnailList"
  :key="shot.id"
  :active="shot.id === currentShotId"
/>
```

## 关键代码/公式
- **关键代码片段**：
```vue
<ScreenshotThumb
  v-for="shot in thumbnailList"
  :key="shot.id"
  :image-url="shot.dataUrl"
  :active="shot.id === currentShotId"
  :show-delete="true"
  @click="switchPreview(shot.id)"
  @remove="handleRemoveThumbnail(shot.id)"
/>
```

## 测试验证
- **测试场景**：
  - 场景1：3 张截图 `dataUrl` 完全相同，逐个点击缩略图。
  - 场景2：3 张截图 `dataUrl` 完全不同，逐个点击缩略图。
- **验证方法**：
  - 方法1：任意时刻只允许 1 个缩略图处于高亮。
  - 方法2：点击缩略图后，预览区与画板状态切换到对应 `id`。

## 预防措施
- 缩略图/列表项选中态统一使用 `id`，避免使用 `dataUrl`、`index` 等不稳定字段。
- 对“可能重复的字段”（如 base64 内容）不得用于 UI 唯一性判断。

## 相关链接/参考
- 相关文档：`imates-web/src/components/ScreenshotInputDialog.vue`

## 可复用经验
- 选中态（active）永远绑定“稳定主键”（id），不要绑定“可重复内容字段”（dataUrl）。
- 多图场景下，`previewImage` 只应作为展示数据，不应承担“选中态主键”的职责。
