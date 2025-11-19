问题序号：ScreenshotInputDialog 裁剪模式与组件精简重构问题

## 问题元信息
- **问题分类**：前端
- **严重程度**：中
- **影响范围**：PDF 截图问答弹窗中截图预览与二次裁剪功能
- **发现日期**：2025-11-19
- **解决状态**：已解决

## 问题现象
- 在早期实现中，`ScreenshotInputDialog` 作为截图问答弹窗：
  - 内部使用 `canvas` 绘制截图，并提供二次“框选裁剪”功能（拖动、缩放裁剪框）。
  - 弹窗区域高度有限，`canvas` 固定高度、部分样式（如 `overflow: hidden`）导致截图下方内容被遮挡。
  - 当 PDF 侧的主截图逻辑已经精确截取了选区区域时，弹窗内再次裁剪/展示的坐标系与 UI 容器尺寸不一致，引发“截图高度看起来被裁短”的错觉。
- 随着业务收敛，实际使用上：
  - 主要需求是“显示整张截图 + 输入问题”，不再需要弹窗内复杂的二次裁剪。
  - 现有裁剪交互代码复杂（状态多、计算多），对主链路价值有限，增加维护成本和问题排查难度。

## 复现步骤
1. 在 PDF 页面启用截图模式，框选较高区域生成截图。
2. 弹出 `ScreenshotInputDialog`：
   - 观察裁剪 `canvas` 区域高度和截图内容展示情况，下方部分内容被遮挡。
   - 尝试在对话框中进行二次框选、拖拽，注意裁剪框与真实截图内容的边界是否完全一致。
3. 比对：
   - 查看日志中从 PDF 侧传入的截图像素高度（`sHeight`）与弹窗中 `img`/canvas 的 `naturalHeight` 是否一致。
   - 观察弹窗容器与 canvas 的 CSS（固定高度、overflow 等），确认是显示层“裁掉了”部分图像，而非主截图逻辑截少内容。

## 用户体验
- 用户在 PDF 上框选的截图区域与弹窗中的预览不一致，以为系统“截短了”内容。
- 弹窗内二次框选交互复杂，学习成本和操作成本高；对多数“截图问答”场景不必要。
- 问题排查时需要在 PDF 截图逻辑与弹窗内裁剪逻辑之间来回定位，增加理解负担和调试时间。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/ScreenshotInputDialog.vue`：
    - 原始版本：使用 `canvas` 实现裁剪预览、拖拽/缩放裁剪框、蒙版、角标等复杂交互。
    - 重构后：精简为“整图预览 + 文本输入”，去除裁剪互动逻辑。
- **涉及模块**：
  - 截图问答 UI 模块：负责展示用户截图、输入问题并发送给 AI。
  - PDF 截图模块（间接相关）：作为截图来源，向该对话框提供截图数据。

## 技术原因 (❌)
1. **组件职责过重，裁剪与展示混在一起**：
   - `ScreenshotInputDialog` 既承担“展示整张截图”的职责，又承担了“二次裁剪工具”的职责：
     - 拥有大量状态：`cropCanvas`、`cropRect`、`isCropping`、`isDragging`、`isResizing`、`resizeHandle`、`imageDrawInfo` 等。
     - 实现了复杂交互：拖拽绘制、拖动移动裁剪框、四向/八向缩放、蒙版与角标绘制等。
   - 对截图问答主流程而言，真正必需的是：**预览 + 文本输入 + 将截图数据回传**，二次裁剪仅是增强功能，但承担了大量复杂代码和潜在 bug 面。

2. **展示容器尺寸与裁剪像素逻辑不匹配**：
   - 弹窗中裁剪 `canvas` 使用固定或有限高度：
     - `.screenshot-preview` 具有固定 `height`，曾使用 `min-height`+`max-height` 并可能配合 `overflow: hidden`。
     - `canvas` 逻辑尺寸按容器 `getBoundingClientRect()` 计算，并按 DPR 放大，但视觉显示被容器限制。
   - 当主截图逻辑传入 1500×2000+ 的大图时：
     - 逻辑裁剪区域在像素层面是完整的；
     - 但是在弹窗中，`canvas`/图片因高度限制被“裁掉”，导致用户误以为“少截了”。

3. **二次裁剪与 PDF 管道的坐标映射成本过高**：
   - PDF 侧已在自己的坐标体系里完成一轮复杂的坐标映射和裁剪（Screen → Page → Canvas 像素）。
   - 弹窗端再进行一次基于 `canvas` 的裁剪，需要额外维护：
     - 图片绘制区域（居中、contain 缩放）的 `drawX/drawY/drawWidth/drawHeight`。
     - 裁剪框坐标与原始图片坐标之间的比例换算。
   - 对后续维护者来说，这条多次映射链路增加了理解成本和出错机会，而实际业务并不强依赖二次裁剪。

## 正确实现方案 (✅)
1. **简化组件职责：仅保留“整图预览 + 提问输入”**：
   - 模板改为使用普通 `<img>` 展示截图，而非 `canvas` + 自定义裁剪逻辑：

   ```vue
   <!-- ✅ 精简后的 ScreenshotInputDialog 预览区域示例 -->
   <div class="screenshot-input-content">
     <div class="screenshot-preview">
       <div v-if="screenshotDataUrl" class="image-container">
         <img :src="screenshotDataUrl" alt="截图预览" class="preview-image" />
       </div>
     </div>
     <!-- 下方是已有的问题输入和按钮区域 -->
   </div>
   ```

2. **删除所有二次裁剪相关状态和逻辑**：
   - 移除以下状态变量及其相关计算：
     - `cropCanvas`、`cropRect`、`isCropping`、`isDragging`、`isResizing`、`resizeHandle`、`cropStartPos`、`dragOffset`、`resizeStartPos`、`RESIZE_HANDLE_SIZE`。
     - `imageDrawInfo` 与所有关于 `drawX/drawY/drawWidth/drawHeight` 的计算。
   - 删除相关方法：
     - 初始化裁剪画布 `initCropCanvas`。
     - 各类裁剪/拖拽/缩放逻辑：`startCrop`、`updateCrop`、`endCrop`、`handleMouseMove`、`handleMouseLeave` 等。
     - 获取裁剪后图片的 `getCroppedImage` 及相关映射计算。
   - 保留对话框生命周期和文本输入处理逻辑不变，只在需要时重置问题文本：

   ```typescript
   // ✅ 打开对话框时仅重置文本
   const questionText = ref('')

   watch(() => props.modelValue, async (newValue) => {
     if (newValue) {
       questionText.value = ''
     }
   })
   ```

3. **确认输出始终使用原始截图数据**：
   - 将 `handleConfirm` 从“可能返回裁剪后的 DataURL”改为始终使用原始 `props.screenshotDataUrl`：

   ```typescript
   const handleConfirm = async () => {
     if (!questionText.value.trim()) {
       showMessage('请输入要问的问题', 'warning')
       return
     }

     if (!props.screenshotDataUrl) {
       showMessage('截图数据丢失，请重新截图', 'error')
       return
     }

     // ✅ 直接使用源截图数据
     emit('confirm', questionText.value.trim(), props.screenshotDataUrl)
     localVisible.value = false
   }
   ```

4. **精简与纠正样式，确保预览完整可见**：
   - 使用弹性布局+固定预览高度+`object-fit: contain` 来保证整张截图以最大可能尺寸显示且不被裁掉：

   ```scss
   .screenshot-input-dialog {
     .screenshot-input-content {
       display: flex;
       flex-direction: column;
       height: 100%;
       padding: 20px;
       gap: 16px;
     }

     .screenshot-preview {
       flex: 1;
       height: 270px;
       display: flex;
       align-items: center;
       justify-content: center;
       background: #f5f5f5;
       border-radius: 8px;
       border: 1px solid #e0e0e0;
       position: relative;

       .image-container {
         width: 100%;
         height: 100%;
         display: flex;
         align-items: center;
         justify-content: center;
       }

       .preview-image {
         max-width: 100%;
         max-height: 100%;
         object-fit: contain;
         display: block;
       }
     }
   }
   ```

   - 删除所有 `.crop-*` 相关的未使用样式（`crop-container`、`crop-canvas`、`crop-mask`、`crop-overlay`、`crop-corner` 等）。

## 关键代码/公式
- **原始裁剪逻辑中的坐标映射公式（❌ 现已移除）**：

  ```typescript
  // 将裁剪框从 canvas 逻辑坐标映射回原始图片坐标
  const scaleX = originalWidth / drawWidth
  const scaleY = originalHeight / drawHeight

  const cropXInImage = cropStartX - drawX
  const cropYInImage = cropStartY - drawY
  const cropWidthInImage = cropEndX - cropStartX
  const cropHeightInImage = cropEndY - cropStartY

  const sourceX = Math.max(0, cropXInImage * scaleX)
  const sourceY = Math.max(0, cropYInImage * scaleY)
  const sourceWidth = Math.min(originalWidth - sourceX, cropWidthInImage * scaleX)
  const sourceHeight = Math.min(originalHeight - sourceY, cropHeightInImage * scaleY)
  ```

- **精简后关键逻辑（✅）**：

  ```typescript
  // 对话框打开时重置问题文本
  watch(() => props.modelValue, (newValue) => {
    if (newValue) {
      questionText.value = ''
    }
  })

  // 确认时直接使用原始截图
  const handleConfirm = async () => {
    if (!questionText.value.trim()) {
      showMessage('请输入要问的问题', 'warning')
      return
    }

    if (!props.screenshotDataUrl) {
      showMessage('截图数据丢失，请重新截图', 'error')
      return
    }

    emit('confirm', questionText.value.trim(), props.screenshotDataUrl)
    localVisible.value = false
  }
  ```

## 测试验证
- **测试场景**：
  - 场景1：不同尺寸截图在弹窗中的显示
    - 步骤：在 PDF 页面截取不同长宽比例、不同大小的截图，打开对话框。
    - 预期：
      - 每张截图均完整可见，不被上下或左右裁切。
      - 截图仅做等比缩放以适应预览区域，长边贴近容器边界，短边留白。
  - 场景2：验证不再进行二次裁剪
    - 步骤：使用已有 API 发送截图给 AI，确认后端/日志接收到的图片尺寸与 PDF 端生成的截图尺寸一致。
    - 预期：不再出现“对话框裁剪后图片分辨率变小”的情况。

- **验证方法**：
  - 使用浏览器开发者工具查看 `<img>` 的 `naturalWidth`/`naturalHeight` 与主截图逻辑输出的尺寸是否一致。
  - 通过网络面板或日志确认发送给后端/AI 的图片尺寸未被对话框阶段更改。

## 预防措施
- 对于核心业务功能（例如：截图 + 提问），**优先保证主链路简单稳定**，将复杂的可选功能（如二次裁剪）拆分成独立组件或按需加载的增强模块。
- 在 UI 中展示截图、预览等内容时，优先使用浏览器原生的 `<img>` 及 `object-fit`，仅在确有必要时才使用 `canvas` + 自定义渲染逻辑。
- 为组件设定单一职责：
  - 本组件只承担“预览 + 文本输入 + 提交”的职责。
  - 若未来再次需要裁剪功能，可新建专门的裁剪组件，在 PDF 截图生成前或单独页面中使用。

## 相关链接/参考
- 相关文件：
  - `imates-web/src/components/ScreenshotInputDialog.vue`
  - `imates-web/src/components/PdfPage.vue`（作为截图数据来源）
- 参考资源：
  - MDN: `<img>` 与 `object-fit` 文档
  - MDN: Canvas 2D API（仅作为历史实现参考）

## 可复用经验
- 当一个组件既承担“主流程 UI”又承担“复杂增强交互”时，一旦某条链路出问题，排查成本很高；优先将复杂交互拆分或延后，实现“主流程先稳定，增强功能可插拔”。
- 在拥有明确上游数据源（如 PDF 截图）的场景里，尽量避免中间 UI 再次对图像做放大/缩小/裁剪等破坏性操作，以减少信息损失和坐标体系错配。
- 当用户抱怨“截图少了一截/看起来不一样”时，排查顺序建议为：
  1. 检查最终发送给后台/AI 的图片像素尺寸与预期是否一致；
  2. 检查 UI 展示容器是否对图片做了二次裁剪或缩放；
  3. 最后再检查截图库或算法自身是否有问题。
