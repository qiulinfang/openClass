# PdfCoreService 注释功能使用示例

本文档展示如何使用 `PdfCoreService` 中实现的各类注释功能。

## 目录

1. [Text 注释（便签）](#text-注释便签)
2. [Link 注释](#link-注释)
3. [Stamp 注释（图章）](#stamp-注释图章)
4. [FileAttachment 注释（文件附件）](#fileattachment-注释文件附件)
5. [修改注释](#修改注释)
6. [获取注释信息](#获取注释信息)
7. [删除注释](#删除注释)

---

## Text 注释（便签）

创建文本注释（便签），用于在 PDF 上添加文本说明。

```typescript
import { PdfCoreService } from '@/services/pdf/core/PdfCoreService'
import * as mupdf from 'mupdf'

const pdfCoreService = new PdfCoreService()
const page = pdfDoc.loadPage(0) // 加载第 1 页（0-based）

// 创建 Text 注释
const textAnnot = pdfCoreService.createTextAnnotation(
  page,
  [100, 100, 200, 150], // rect: [x0, y0, x1, y1] - 注释位置和大小
  '这是注释内容',        // contents: 注释文本
  '张三',               // author: 作者（可选）
  [1, 1, 0]            // color: 颜色 [r, g, b]，默认黄色
)

// 注释会自动更新到页面
```

**参数说明：**
- `page`: PDF 页面对象
- `rect`: 注释位置和大小 `[x0, y0, x1, y1]`
- `contents`: 注释文本内容
- `author`: 作者名称（可选）
- `color`: 颜色 `[r, g, b]`，范围 0-1（可选，默认黄色 `[1, 1, 0]`）

---

## Link 注释

创建链接注释，用于在 PDF 上添加可点击的链接。

```typescript
import { PdfCoreService } from '@/services/pdf/core/PdfCoreService'
import * as mupdf from 'mupdf'

const pdfCoreService = new PdfCoreService()
const page = pdfDoc.loadPage(0)

// 创建 Link 注释
const link = pdfCoreService.createLinkAnnotation(
  page,
  [100, 100, 200, 120], // rect: 链接区域
  'https://example.com'  // uri: 链接地址
)

// Link 对象可以直接使用
console.log('链接地址:', link.getURI())
console.log('是否外部链接:', link.isExternal())
```

**注意：** Link 注释返回的是 `mupdf.Link` 对象，而不是 `mupdf.PDFAnnotation` 对象。

**修改链接：**
```typescript
// 修改链接地址
link.setURI('https://new-url.com')

// 修改链接区域
link.setBounds([150, 150, 250, 170])
```

---

## Stamp 注释（图章）

创建图章注释，用于在 PDF 上添加图章标记。

```typescript
import { PdfCoreService } from '@/services/pdf/core/PdfCoreService'
import * as mupdf from 'mupdf'

const pdfCoreService = new PdfCoreService()
const page = pdfDoc.loadPage(0)

// 创建 Stamp 注释
const stampAnnot = pdfCoreService.createStampAnnotation(
  page,
  [100, 100, 300, 200], // rect: 图章位置和大小
  'Approved',           // icon: 图章类型
  [0, 1, 0]            // color: 颜色（可选，默认绿色）
)

// 可用的图章类型：
// - 'Approved' - 已批准
// - 'Rejected' - 已拒绝
// - 'Draft' - 草稿
// - 'Confidential' - 机密
// - 'Final' - 最终版
// - 'NotApproved' - 未批准
// - 'ForPublicRelease' - 公开发布
// - 'NotForPublicRelease' - 不公开发布
// - 'Departmental' - 部门
// - 'Experimental' - 实验性
// - 'Expired' - 已过期
// - 'Sold' - 已售出
// - 'TopSecret' - 绝密
```

**参数说明：**
- `page`: PDF 页面对象
- `rect`: 图章位置和大小 `[x0, y0, x1, y1]`
- `icon`: 图章类型字符串
- `color`: 颜色 `[r, g, b]`（可选，默认绿色 `[0, 1, 0]`）

---

## FileAttachment 注释（文件附件）

创建文件附件注释，用于在 PDF 上附加文件。

```typescript
import { PdfCoreService } from '@/services/pdf/core/PdfCoreService'
import * as mupdf from 'mupdf'

const pdfCoreService = new PdfCoreService()
const page = pdfDoc.loadPage(0)
const pdfDoc = page._doc // 获取 PDF 文档对象

// 准备文件数据
const fileData = new Uint8Array([/* 文件内容 */])
const filename = 'attachment.txt'
const mimeType = 'text/plain'

// 创建 FileAttachment 注释
const fileAnnot = pdfCoreService.createFileAttachmentAnnotation(
  page,
  pdfDoc,
  [100, 100, 150, 150], // rect: 附件图标位置
  filename,
  mimeType,
  fileData
)
```

**参数说明：**
- `page`: PDF 页面对象
- `pdfDoc`: PDF 文档对象（用于添加嵌入文件）
- `rect`: 附件图标位置 `[x0, y0, x1, y1]`
- `filename`: 文件名
- `mimeType`: MIME 类型（如 `'text/plain'`, `'application/pdf'` 等）
- `fileData`: 文件内容的 `Uint8Array`

**读取附件：**
```typescript
// 获取文件规格
const fileSpec = fileAnnot.getFileSpec()

// 从文档中获取文件参数
const params = pdfDoc.getFilespecParams(fileSpec)
console.log('文件名:', params.filename)
console.log('MIME 类型:', params.mimetype)
console.log('创建日期:', params.creationDate)
console.log('修改日期:', params.modificationDate)

// 获取文件内容
const contents = pdfDoc.getEmbeddedFileContents(fileSpec)
if (contents) {
  const fileBytes = contents.asUint8Array()
  // 使用文件数据...
}
```

---

## 修改注释

使用 `updateAnnotation` 方法修改现有注释的属性。

```typescript
import { PdfCoreService } from '@/services/pdf/core/PdfCoreService'

const pdfCoreService = new PdfCoreService()
const page = pdfDoc.loadPage(0)
const annotations = page.getAnnotations()
const annot = annotations[0] // 获取第一个注释

// 修改注释属性
pdfCoreService.updateAnnotation(annot, {
  color: [1, 0, 0],      // 改为红色
  opacity: 0.8,          // 设置透明度
  borderWidth: 2.0,      // 设置边框宽度
  contents: '新的注释内容', // 修改内容（Text 注释）
  author: '李四',        // 修改作者（Text 注释）
  icon: 'Rejected',      // 修改图章类型（Stamp 注释）
  rect: [150, 150, 250, 200] // 修改位置
})
```

**可修改的属性：**
- `color`: 颜色 `[r, g, b]`
- `opacity`: 透明度（0-1）
- `borderWidth`: 边框宽度
- `contents`: 注释内容（Text 注释）
- `author`: 作者（Text 注释）
- `icon`: 图章类型（Stamp 注释）
- `rect`: 位置和大小 `[x0, y0, x1, y1]`

**注意：** Link 注释的 URI 需要通过 `Link` 对象的 `setURI()` 方法修改，而不是通过 `updateAnnotation()`。

---

## 获取注释信息

获取页面上的所有注释及其详细信息。

```typescript
import { PdfCoreService } from '@/services/pdf/core/PdfCoreService'

const pdfCoreService = new PdfCoreService()
const page = pdfDoc.loadPage(0)

// 获取页面上的所有注释
const annotations = pdfCoreService.getPageAnnotations(page, 1) // 第 1 页

annotations.forEach((annot) => {
  console.log('注释 ID:', annot.id)
  console.log('类型:', annot.type)
  console.log('页码:', annot.pageNum)
  console.log('位置:', annot.rect)
  console.log('颜色:', annot.color)
  console.log('透明度:', annot.opacity)
  console.log('边框宽度:', annot.borderWidth)

  // 特定类型的属性
  if (annot.type === 'Text') {
    console.log('内容:', annot.contents)
    console.log('作者:', annot.author)
    console.log('修改日期:', annot.modificationDate)
  }

  if (annot.type === 'Ink') {
    console.log('手绘路径:', annot.inkList)
  }

  if (annot.type === 'Highlight' || annot.type === 'Underline') {
    console.log('四边形点:', annot.quadPoints)
  }

  if (annot.type === 'Stamp') {
    console.log('图章类型:', annot.icon)
  }

  if (annot.type === 'FileAttachment') {
    console.log('文件附件:', annot.fileAttachment)
  }
})
```

**注释数据接口：**
```typescript
interface MuPDFAnnotationData {
  id: string
  type: MuPDFAnnotationType
  pageNum: number
  rect: mupdf.Rect
  color: mupdf.Color
  opacity: number
  borderWidth: number
  // 特定类型的数据
  inkList?: mupdf.Point[][]      // Ink 类型
  quadPoints?: mupdf.Quad[]       // Highlight、Underline 等类型
  contents?: string               // Text 注释
  author?: string                 // Text 注释
  modificationDate?: string       // Text 注释
  icon?: string                   // Stamp 注释
  fileAttachment?: {               // FileAttachment 注释
    filename: string
    mimeType: string
    data: Uint8Array
  }
}
```

---

## 删除注释

删除页面上的注释。

```typescript
import { PdfCoreService } from '@/services/pdf/core/PdfCoreService'

const pdfCoreService = new PdfCoreService()
const page = pdfDoc.loadPage(0)
const annotations = page.getAnnotations()
const annot = annotations[0] // 获取要删除的注释

// 删除注释
pdfCoreService.deleteAnnotationFromPage(page, annot)

// 或者通过注释服务删除（如果已初始化）
pdfCoreService.deleteAnnotation(annotId) // 通过 ID 删除
```

**删除 Link 注释：**
```typescript
// Link 注释需要通过页面方法删除
const links = page.getLinks()
const link = links[0] // 获取要删除的链接
page.deleteLink(link)
```

---

## 完整示例

以下是一个完整的示例，展示如何创建、修改和删除各种类型的注释：

```typescript
import { PdfCoreService } from '@/services/pdf/core/PdfCoreService'
import * as mupdf from 'mupdf'

// 初始化服务
const pdfCoreService = new PdfCoreService()

// 加载文档和页面
const pdfDoc = mupdf.PDFDocument.openDocument(pdfData, 'application/pdf')
const page = pdfDoc.loadPage(0) // 第 1 页

// 1. 创建 Text 注释
const textAnnot = pdfCoreService.createTextAnnotation(
  page,
  [100, 100, 200, 150],
  '这是一个文本注释',
  '张三'
)

// 2. 创建 Link 注释
const link = pdfCoreService.createLinkAnnotation(
  page,
  [100, 200, 200, 220],
  'https://example.com'
)

// 3. 创建 Stamp 注释
const stampAnnot = pdfCoreService.createStampAnnotation(
  page,
  [100, 300, 300, 400],
  'Approved',
  [0, 1, 0]
)

// 4. 创建 FileAttachment 注释
const fileData = new TextEncoder().encode('Hello, World!')
const fileAnnot = pdfCoreService.createFileAttachmentAnnotation(
  page,
  pdfDoc,
  [100, 500, 150, 550],
  'hello.txt',
  'text/plain',
  fileData
)

// 5. 修改 Text 注释
pdfCoreService.updateAnnotation(textAnnot, {
  color: [1, 0, 0], // 改为红色
  contents: '修改后的内容'
})

// 6. 获取所有注释
const allAnnotations = pdfCoreService.getPageAnnotations(page, 1)
console.log('页面上的注释数量:', allAnnotations.length)

// 7. 删除注释
pdfCoreService.deleteAnnotationFromPage(page, textAnnot)

// 8. 保存文档
const pdfBytes = pdfDoc.saveToBuffer('incremental')
// 使用 pdfBytes...
```

---

## 注意事项

1. **坐标系统**：PDF 使用左下角为原点的坐标系统，Y 轴向上。Canvas 使用左上角为原点，Y 轴向下。使用 `canvasToPageCoords` 和 `pageToCanvasCoords` 进行转换。

2. **资源管理**：创建注释后会自动更新到页面，无需手动调用 `update()`（已在创建方法中调用）。

3. **Link 注释**：Link 注释使用 `page.createLink()` 创建，返回 `Link` 对象而不是 `PDFAnnotation` 对象。

4. **文件附件**：FileAttachment 注释需要 PDF 文档对象来添加嵌入文件，确保传入正确的 `pdfDoc` 参数。

5. **注释 ID**：注释 ID 使用对象引用生成，确保唯一性。如果需要自定义 ID，可以在创建后修改。

6. **保存文档**：修改注释后，需要调用 `pdfDoc.saveToBuffer()` 或 `pdfDoc.save()` 保存更改。

---

## 相关文档

- [MuPDF.js使用文档.md](./MuPDF.js使用文档.md) - MuPDF.js API 参考
- [PdfCoreService语法规范检查报告.md](./PdfCoreService语法规范检查报告.md) - 代码规范检查报告



