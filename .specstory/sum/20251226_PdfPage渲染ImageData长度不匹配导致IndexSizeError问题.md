问题序号：PdfPage渲染ImageData长度不匹配导致IndexSizeError问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`高`
- **影响范围**：`PDF阅读/渲染模块（PdfPage.vue）`
- **发现日期**：`2025-12-22`
- **解决状态**：`已解决`

## 问题现象
在打开 PDF 时，控制台报错：

```
IndexSizeError: Failed to construct 'ImageData': The input data length is not a multiple of (4 * width).
    at render (PdfPage.vue:1054:27)
    at async loadPdf (PdfPage.vue:992:5)
```

页面无法正常渲染或渲染中断。

## 复现步骤
1. 打开 PDF 阅读页面（进入 `PdfViewerView`，触发 `PdfPage.loadPdf()`）。
2. `PdfPage.render()` 内部调用 MuPDF `page.toPixmap()` 并尝试构造 `ImageData`。
3. 控制台抛出 `IndexSizeError`，PDF 页面渲染失败。

## 用户体验
- PDF 打不开或显示空白
- 页面功能不可用（批注/截图/笔记等依赖页面渲染）
- 用户会认为应用崩溃/卡死

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/PdfPage.vue`：MuPDF pixmap -> Canvas 的渲染逻辑
- **涉及模块**：
  - PDF 渲染（MuPDF -> Canvas）

## 技术原因 (❌)
1. **错误地使用 `data.buffer` 构造 `ImageData`**：`pixmap.getPixels()` 返回的数据不保证是 RGBA 4 通道，也不保证 `data.buffer` 的 `byteLength` 与当前视图 `width/height` 严格匹配（可能存在 `byteOffset`、RGB 3通道、或 padding/stride 等情况）。
2. `ImageData` 构造函数要求 `data.length === 4 * width * height`，否则直接抛 `IndexSizeError`。

错误代码示例：

```ts
const data = pixmap.getPixels()
const imgData = new ImageData(
  new Uint8ClampedArray(data.buffer),
  pixmap.getWidth(),
  pixmap.getHeight()
)
ctx.putImageData(imgData, 0, 0)
```

## 正确实现方案 (✅)
1. **不要使用 `data.buffer` 直接构造 `ImageData`**，应使用 `data` 本体（考虑 `byteOffset/byteLength`）。
2. **统一将源像素转换为 RGBA**（保证长度严格为 `width*height*4`），再 `putImageData`。
3. 对通道数做兜底：当检测不到通道数时，按 RGB（3通道）处理并补 Alpha。

正确代码示例：

```ts
const data = pixmap.getPixels()
const pw = pixmap.getWidth()
const ph = pixmap.getHeight()
const pixelCount = pw * ph

const src = data instanceof Uint8Array ? data : new Uint8Array(data as any)
const detectedChannels = pixelCount > 0 ? Math.floor(src.length / pixelCount) : 0
const channels = detectedChannels >= 3 ? detectedChannels : 3

let rgba: Uint8ClampedArray
if (channels === 4 && src.length === pixelCount * 4) {
  rgba = src instanceof Uint8ClampedArray ? src : new Uint8ClampedArray(src)
} else {
  rgba = new Uint8ClampedArray(pixelCount * 4)
  for (let p = 0; p < pixelCount; p++) {
    const si = p * channels
    const di = p * 4
    rgba[di] = src[si] ?? 0
    rgba[di + 1] = src[si + 1] ?? 0
    rgba[di + 2] = src[si + 2] ?? 0
    rgba[di + 3] = 255
  }
}

ctx.putImageData(new ImageData(rgba, pw, ph), 0, 0)
```

## 关键代码/公式
- 关键约束：

```text
ImageData 的 data.length 必须满足：length === 4 * width * height
```

- 关键代码位置：
  - `imates-web/src/components/PdfPage.vue` 的 `render()`：pixmap -> rgba -> putImageData

## 测试验证
- **测试场景**：
  - 场景1：打开任意 PDF，检查控制台无 `IndexSizeError`，页面正常显示。
  - 场景2：打开多页 PDF，逐页渲染均正常。
- **验证方法**：
  - 方法1：Chrome 控制台确认无报错；Canvas 内确实绘制出 PDF 内容。
  - 方法2：缩放、滚动后页面仍可正常显示（确认渲染结果与布局一致）。

## 预防措施
- 不要假设底层库返回的像素格式固定为 RGBA；应显式处理 RGB/RGBA 等情况。
- 在像素管线中加入断言/日志（开发期）：记录 `pw/ph/src.length/channels`，便于快速定位格式问题。
- 把 pixmap -> ImageData 转换封装为工具函数，并为不同输入格式写最小单测（可选）。

## 相关链接/参考
- 相关文档：`MuPDF.js pixmap/getPixels/toPixmap API（项目内使用）`

## 可复用经验
- 对二进制/图像数据转换：**永远以“长度约束”驱动实现**（如 RGBA 固定 4 通道）。
- `TypedArray.buffer` 不等于“有效数据区”，需要关注 `byteOffset/byteLength`。
- 出现渲染类异常优先打印：宽高、stride/通道数、数据长度，比盲改更快。
