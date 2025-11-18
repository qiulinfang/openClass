# MuPDF.js 使用文档

## 目录

1. [简介](#简介)
2. [安装与配置](#安装与配置)
3. [类型定义](#类型定义)
4. [文件操作](#文件操作)
5. [文档操作](#文档操作)
6. [页面操作](#页面操作)
7. [注释操作](#注释操作)
8. [核心类和方法](#核心类和方法)
9. [资源管理](#资源管理)
10. [项目中的实际应用](#项目中的实际应用)

---

## 简介

MuPDF.js 是由 Artifex Software 开发的高性能 PDF 渲染和处理库，利用 WebAssembly 技术，可在浏览器和 Node.js 环境中使用。

### 主要特性

- **高性能渲染**：基于 WebAssembly，渲染速度快
- **跨平台支持**：支持浏览器和 Node.js 环境
- **完整的 PDF 功能**：支持渲染、编辑、注释、搜索等
- **文本提取**：支持结构化文本提取
- **注释管理**：支持多种注释类型（高亮、下划线、删除线、手绘等）
- **表单填写**：支持交互式表单操作

---

## 安装与配置

### 安装

```bash
npm install mupdf
```

### 配置

MuPDF.js 仅作为 ESM 模块提供，需要在 `package.json` 中设置：

```json
{
  "type": "module"
}
```

或者使用 `.mjs` 文件扩展名。

### 导入

```typescript
import * as mupdf from 'mupdf'
```

---

## 类型定义

MuPDF.js 定义了多种类型，用于表示不同的数据结构和参数。

### 基础类型

#### Matrix（变换矩阵）

用于表示 2D 变换矩阵，格式为 `[a, b, c, d, e, f]`：

```typescript
type Matrix = [number, number, number, number, number, number]
```

- `a, b, c, d`：缩放和旋转参数
- `e, f`：平移参数

**示例：**
```typescript
// 单位矩阵（无变换）
const identity: mupdf.Matrix = mupdf.Matrix.identity  // [1, 0, 0, 1, 0, 0]

// 缩放矩阵（2倍缩放）
const scaleMatrix: mupdf.Matrix = mupdf.Matrix.scale(2.0, 2.0)

// 平移矩阵（向右平移100，向下平移50）
const translateMatrix: mupdf.Matrix = mupdf.Matrix.translate(100, 50)

// 旋转矩阵（旋转45度）
const rotateMatrix: mupdf.Matrix = mupdf.Matrix.rotate(45)

// 组合变换
const combined = mupdf.Matrix.concat(scaleMatrix, translateMatrix)

// 自定义矩阵
const custom: mupdf.Matrix = [2, 0, 0, 2, 100, 50]  // 2倍缩放 + 平移
```

#### Rect（矩形）

表示矩形区域，格式为 `[ulx, uly, lrx, lry]`：

```typescript
type Rect = [number, number, number, number]
```

- `ulx, uly`：左上角坐标
- `lrx, lry`：右下角坐标

**示例：**
```typescript
const rect: mupdf.Rect = [0, 0, 612, 792]  // A4 页面大小

// 检查矩形是否为空
const isEmpty = mupdf.Rect.isEmpty(rect)

// 检查矩形是否有效
const isValid = mupdf.Rect.isValid(rect)

// 检查矩形是否无限大
const isInfinite = mupdf.Rect.isInfinite(rect)

// 变换矩形
const transformed = mupdf.Rect.transform(rect, matrix)
```

#### Quad（四边形）

表示四边形区域，格式为 `[ulx, uly, urx, ury, llx, lly, lrx, lry]`：

```typescript
type Quad = [number, number, number, number, number, number, number, number]
```

- `ulx, uly`：左上角坐标
- `urx, ury`：右上角坐标
- `llx, lly`：左下角坐标
- `lrx, lry`：右下角坐标

**示例：**
```typescript
const quad: mupdf.Quad = [100, 100, 200, 100, 100, 120, 200, 120]
```

#### Point（点）

表示二维坐标点，格式为 `[x, y]`：

```typescript
type Point = [number, number]
```

**示例：**
```typescript
const point: mupdf.Point = [100, 200]
```

#### Color（颜色）

表示颜色值，支持灰度、RGB、CMYK 格式：

```typescript
type Color = [number] | [number, number, number] | [number, number, number, number]
```

- `[gray]`：灰度值（0-1）
- `[r, g, b]`：RGB 值（0-1）
- `[c, m, y, k]`：CMYK 值（0-1）

**示例：**
```typescript
const gray: mupdf.Color = [0.5]           // 50% 灰度
const rgb: mupdf.Color = [1, 0, 0]         // 红色
const cmyk: mupdf.Color = [0, 1, 1, 0]    // 青色
```

#### Rotate（旋转角度）

表示页面旋转角度，只能是 0、90、180、270：

```typescript
type Rotate = 0 | 90 | 180 | 270
```

### 枚举类型

#### ColorSpaceType（颜色空间类型）

```typescript
type ColorSpaceType = "None" | "Gray" | "RGB" | "BGR" | "CMYK" | "Lab" | "Indexed" | "Separation"
```

#### PageBox（页面框类型）

```typescript
type PageBox = "MediaBox" | "CropBox" | "BleedBox" | "TrimBox" | "ArtBox"
```

#### PDFAnnotationType（注释类型）

```typescript
type PDFAnnotationType = 
  | "Text" | "Link" | "FreeText" | "Line" | "Square" | "Circle" 
  | "Polygon" | "PolyLine" | "Highlight" | "Underline" | "Squiggly" 
  | "StrikeOut" | "Redact" | "Stamp" | "Caret" | "Ink" | "Popup" 
  | "FileAttachment" | "Sound" | "Movie" | "RichMedia" | "Widget" 
  | "Screen" | "PrinterMark" | "TrapNet" | "Watermark" | "3D" | "Projection"
```

#### LinkDestType（链接目标类型）

```typescript
type LinkDestType = "Fit" | "FitB" | "FitH" | "FitBH" | "FitV" | "FitBV" | "FitR" | "XYZ"
```

#### BlendMode（混合模式）

```typescript
type BlendMode = 
  | "Normal" | "Multiply" | "Screen" | "Overlay" | "Darken" | "Lighten" 
  | "ColorDodge" | "ColorBurn" | "HardLight" | "SoftLight" | "Difference" 
  | "Exclusion" | "Hue" | "Saturation" | "Color" | "Luminosity"
```

#### LineCap（线帽样式）

```typescript
type LineCap = "Butt" | "Round" | "Square" | "Triangle"
```

#### LineJoin（线连接样式）

```typescript
type LineJoin = "Miter" | "Round" | "Bevel" | "MiterXPS"
```

#### SelectMode（选择模式）

```typescript
type SelectMode = "chars" | "words" | "lines"
```

---

## 文件操作

### 打开文档

MuPDF.js 提供了多种方式来打开 PDF 文档。

#### 方法 1: 使用 openDocument（推荐）

```typescript
// Node.js 环境
import * as fs from 'fs'
import * as mupdf from 'mupdf'

const buffer = fs.readFileSync("test.pdf")
const document = mupdf.Document.openDocument(buffer, "application/pdf")
```

#### 方法 2: 使用 PDFDocument.openDocument（仅 PDF）

```typescript
// Node.js 环境
import * as fs from 'fs'
import * as mupdf from 'mupdf'

const buffer = fs.readFileSync("test.pdf")
const pdfDoc = mupdf.PDFDocument.openDocument(buffer, "application/pdf")
```

#### 浏览器环境

```typescript
// 方式 1: 从文件输入框加载
const fileInput = document.querySelector('input[type="file"]')
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0]
  const arrayBuffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)
  const document = mupdf.Document.openDocument(uint8Array, 'application/pdf')
})

// 方式 2: 从 Blob 加载
const blob = new Blob([...], { type: 'application/pdf' })
const arrayBuffer = await blob.arrayBuffer()
const uint8Array = new Uint8Array(arrayBuffer)
const document = mupdf.Document.openDocument(uint8Array, 'application/pdf')
```

### 加载远程文件

```typescript
async function loadRemoteFile(url: string): Promise<mupdf.Document | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`无法获取文档: ${response.statusText}`)
      return null
    }
    const data = await response.arrayBuffer()
    const uint8Array = new Uint8Array(data)
    const document = mupdf.Document.openDocument(uint8Array, url)
    return document
  } catch (error) {
    console.error('加载远程文件失败:', error)
    return null
  }
}

// 使用示例
const doc = await loadRemoteFile("https://example.com/document.pdf")
if (doc) {
  console.log(`文档页数: ${doc.countPages()}`)
}
```

### 保存文件

保存 PDF 文档到缓冲区或文件系统：

```typescript
// 获取 PDFDocument 对象
const pdfDoc = document.asPDF()
if (!pdfDoc) {
  throw new Error('文档不是 PDF 格式')
}

// 保存为增量更新（推荐，保留文档历史）
const buffer = pdfDoc.saveToBuffer("incremental")
const uint8Array = buffer.asUint8Array()

// 创建新的 ArrayBuffer（避免 SharedArrayBuffer 类型问题）
const newBuffer = new ArrayBuffer(uint8Array.length)
new Uint8Array(newBuffer).set(uint8Array)

// Node.js 环境：保存到文件
import * as fs from 'fs'
fs.writeFileSync("output.pdf", uint8Array)

// 浏览器环境：下载文件
const blob = new Blob([newBuffer], { type: 'application/pdf' })
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = 'output.pdf'
a.click()
URL.revokeObjectURL(url)  // 清理 URL
```

**保存选项说明：**

- `"incremental"`：增量更新，保留文档历史，文件大小可能较大
- `"clean"`：清理保存，移除未使用的对象，减小文件大小
- `"garbage"`：垃圾回收，移除未使用的对象和交叉引用

**注意事项：**

1. 保存操作会修改文档，建议先备份
2. 增量保存会保留文档历史，文件可能较大
3. 清理保存会减小文件大小，但会丢失历史记录
4. 保存后需要调用 `buffer.destroy()` 释放资源（如果不再使用）

---

## 文档操作

### 密码与安全

检查文档是否需要密码：

```typescript
const needsPassword = document.needsPassword()
if (needsPassword) {
  const password = prompt('请输入密码：')
  const auth = document.authenticatePassword(password)
  if (!auth) {
    console.error('密码错误')
  }
}
```

### 文档元数据

#### 获取元数据

```typescript
// 常用元数据键
const format = document.getMetaData("format")           // 文档格式
const modificationDate = document.getMetaData("info:ModDate")  // 修改日期
const author = document.getMetaData("info:Author")      // 作者
const title = document.getMetaData("info:Title")        // 标题
const creator = document.getMetaData("info:Creator")    // 创建者
const producer = document.getMetaData("info:Producer")  // 生产者
const encryption = document.getMetaData("encryption")    // 加密信息
```

#### 设置元数据

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  pdfDoc.setMetaData("info:Author", "张三")
  pdfDoc.setMetaData("info:Title", "我的文档")
}
```

### 获取页面数量

```typescript
const numPages = document.countPages()
console.log(`文档共有 ${numPages} 页`)
```

### 加载页面

```typescript
// 加载第 1 页（索引从 0 开始）
const page = document.loadPage(0)

// 加载最后一页
const lastPage = document.loadPage(document.countPages() - 1)
```

### 提取文档文本

#### 基本文本提取

```typescript
// 提取单页文本
const page = document.loadPage(0)
const text = page.toStructuredText("preserve-whitespace")
const plainText = text.asText()  // 纯文本
```

#### 结构化文本提取（JSON）

```typescript
let i = 0
while (i < document.countPages()) {
  const page = document.loadPage(i)
  const json = page.toStructuredText("preserve-whitespace").asJSON()
  console.log(`第 ${i + 1} 页的 JSON:`, json)
  i++
}
```

**结构化文本 JSON 格式：**

```json
{
  "blocks": [
    {
      "type": "text",
      "bbox": {
        "x": 30,
        "y": 32,
        "w": 216,
        "h": 13
      },
      "lines": [
        {
          "wmode": 0,
          "bbox": {
            "x": 30,
            "y": 32,
            "w": 216,
            "h": 13
          },
          "font": {
            "name": "FKGYDX+Arial",
            "family": "sans-serif",
            "weight": "normal",
            "style": "normal",
            "size": 12
          },
          "x": 30,
          "y": 43,
          "text": "文本内容"
        }
      ]
    }
  ]
}
```

### 提取文档注释

```typescript
let i = 0
while (i < document.countPages()) {
  const page = document.loadPage(i)
  const annotations = page.getAnnotations()
  console.log(`第 ${i + 1} 页有 ${annotations.length} 个注释`)
  
  annotations.forEach((annot, index) => {
    console.log(`注释 ${index + 1}:`, {
      type: annot.getType(),
      rect: annot.getRect(),
      content: annot.getContents()
    })
  })
  i++
}
```

### 搜索文档

```typescript
const page = document.loadPage(0)
const results = page.search("搜索关键词")

// results 是一个数组，每个元素包含一个 QuadPoint 数组
// QuadPoint 格式: [ulx, uly, urx, ury, llx, lly, lrx, lry]
results.forEach((quadPoints, index) => {
  console.log(`结果 ${index + 1}:`, quadPoints)
})
```

**搜索结果格式：**

```typescript
[
  [
    [
      97.44780731201172,  // ulx (左上角 x)
      32.626708984375,    // uly (左上角 y)
      114.12963104248047, // urx (右上角 x)
      32.626708984375,    // ury (右上角 y)
      97.44780731201172,  // llx (左下角 x)
      46.032958984375,    // lly (左下角 y)
      114.12963104248047, // lrx (右下角 x)
      46.032958984375     // lry (右下角 y)
    ]
  ]
]
```

### 获取文档链接

```typescript
const page = document.loadPage(0)
const links = page.getLinks()

links.forEach((link, index) => {
  console.log(`链接 ${index + 1}:`, {
    uri: link.uri(),
    bounds: link.bounds()
  })
})
```

### 扁平化文档（Baking）

将文档的注释和/或表单控件"烘焙"到页面内容中，使其成为页面的一部分：

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  // 扁平化所有注释和控件
  pdfDoc.bake()
  
  // 保存后，注释和控件将无法再编辑
  const buffer = pdfDoc.saveToBuffer("incremental")
  // ...
}
```

**使用场景：**
- 需要将注释永久保存到文档中
- 防止注释被删除或修改
- 减小文件大小（移除注释对象）

### 嵌入文件管理

#### 添加嵌入文件

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  const fileData = new Uint8Array([...])  // 文件内容
  const embeddedFile = pdfDoc.addEmbeddedFile(
    "attachment.txt",      // 文件名
    "text/plain",          // MIME 类型
    fileData               // 文件数据
  )
}
```

#### 获取嵌入文件列表

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  const embeddedFiles = pdfDoc.getEmbeddedFiles()
  embeddedFiles.forEach((file, index) => {
    console.log(`文件 ${index + 1}:`, {
      name: file.name(),
      mimeType: file.mimeType(),
      size: file.size()
    })
  })
}
```

#### 删除嵌入文件

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  pdfDoc.deleteEmbeddedFile("test.txt")
}
```

#### 提取嵌入文件

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  const embeddedFiles = pdfDoc.getEmbeddedFiles()
  if (embeddedFiles.length > 0) {
    const file = embeddedFiles[0]
    const fileData = file.data()  // 获取文件数据
    // 保存或处理文件数据...
  }
}
```

### 文档链接管理

#### 格式化链接 URI

创建指向文档内部页面的链接：

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  // 创建指向第 2 页的链接 URI
  const linkURI = pdfDoc.formatLinkURI({
    type: "Fit",    // 适合页面
    page: 1         // 页码（0-based）
  })
  
  // 其他类型：
  // - "FitH": 水平适合
  // - "FitV": 垂直适合
  // - "XYZ": 指定位置和缩放
  const xyzURI = pdfDoc.formatLinkURI({
    type: "XYZ",
    page: 0,
    x: 100,
    y: 200,
    zoom: 1.5
  })
}
```

### PDFDocument 高级操作

#### 文档版本和语言

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  // 获取 PDF 版本
  const version = pdfDoc.getVersion()  // 例如：1.4, 1.5, 1.7 等

  // 获取文档语言
  const language = pdfDoc.getLanguage()  // 例如："zh-CN", "en-US"

  // 设置文档语言
  pdfDoc.setLanguage("zh-CN")
}
```

#### 页面标签管理

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  // 设置页面标签
  // style: "D" (十进制), "R" (大写罗马), "r" (小写罗马), "A" (大写字母), "a" (小写字母)
  pdfDoc.setPageLabels(0, "D", "第", 1)  // 从第 1 页开始，显示为 "第1页", "第2页"...

  // 删除页面标签
  pdfDoc.deletePageLabels(0)
}
```

#### 页面重排

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  // 重新排列页面顺序
  // 例如：将页面顺序改为 [2, 0, 1]（原第3页 -> 第1页，原第1页 -> 第2页，原第2页 -> 第3页）
  pdfDoc.rearrangePages([2, 0, 1])
}
```

#### JavaScript 支持

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  // 检查是否支持 JavaScript
  const isSupported = pdfDoc.isJSSupported()

  // 启用 JavaScript
  pdfDoc.enableJS()

  // 禁用 JavaScript
  pdfDoc.disableJS()

  // 设置 JavaScript 事件监听器
  pdfDoc.setJSEventListener((event) => {
    console.log('JS Event:', event)
  })
}
```

#### 文档历史管理

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  // 检查是否有未保存的更改
  const hasUnsavedChanges = pdfDoc.hasUnsavedChanges()

  // 获取版本数量
  const versionCount = pdfDoc.countVersions()

  // 获取未保存版本数量
  const unsavedCount = pdfDoc.countUnsavedVersions()

  // 验证更改历史
  const isValid = pdfDoc.validateChangeHistory()

  // 检查是否可以增量保存
  const canIncremental = pdfDoc.canBeSavedIncrementally()
}
```

#### 操作历史（撤销/重做）

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  // 开始操作
  pdfDoc.beginOperation("添加注释")

  // 开始隐式操作
  pdfDoc.beginImplicitOperation()

  // 结束操作
  pdfDoc.endOperation()

  // 放弃操作
  pdfDoc.abandonOperation()

  // 检查是否可以撤销
  const canUndo = pdfDoc.canUndo()

  // 检查是否可以重做
  const canRedo = pdfDoc.canRedo()

  // 撤销
  if (canUndo) {
    pdfDoc.undo()
  }

  // 重做
  if (canRedo) {
    pdfDoc.redo()
  }

  // 获取操作历史
  const journal = pdfDoc.getJournal()
  console.log('Position:', journal.position)
  console.log('Steps:', journal.steps)
}
```

#### 图层管理

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  // 获取图层数量
  const layerCount = pdfDoc.countLayers()

  // 检查图层是否可见
  const isVisible = pdfDoc.isLayerVisible(0)

  // 设置图层可见性
  pdfDoc.setLayerVisible(0, true)

  // 获取图层名称
  const layerName = pdfDoc.getLayerName(0)
}
```

#### 表单重置

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  // 重置表单字段
  // fields: PDFObject 数组，指定要重置的字段
  // exclude: true = 重置除指定字段外的所有字段，false = 只重置指定字段
  const fields = [fieldObj1, fieldObj2]
  pdfDoc.resetForm(fields, false)
}
```

#### 字体子集化

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  // 子集化字体（只保留文档中使用的字形）
  pdfDoc.subsetFonts()
}
```

#### 文档修复状态

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  // 检查文档是否被修复过
  const wasRepaired = pdfDoc.wasRepaired()
}
```

#### PDF 对象操作

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  // 获取对象数量
  const objectCount = pdfDoc.countObjects()

  // 获取 Trailer 对象
  const trailer = pdfDoc.getTrailer()

  // 创建新对象
  const newObj = pdfDoc.createObject()

  // 创建各种类型的对象
  const nullObj = pdfDoc.newNull()
  const boolObj = pdfDoc.newBoolean(true)
  const intObj = pdfDoc.newInteger(42)
  const realObj = pdfDoc.newReal(3.14)
  const nameObj = pdfDoc.newName("MyName")
  const strObj = pdfDoc.newString("Hello")
  const byteStrObj = pdfDoc.newByteString(new Uint8Array([1, 2, 3]))
  const indirectObj = pdfDoc.newIndirect(123)
  const arrayObj = pdfDoc.newArray()
  const dictObj = pdfDoc.newDictionary()

  // 添加对象
  const addedObj = pdfDoc.addObject(someObj)

  // 添加流对象
  const streamObj = pdfDoc.addStream(buffer, dictObj)
  const rawStreamObj = pdfDoc.addRawStream(buffer, dictObj)

  // 删除对象
  pdfDoc.deleteObject(123)  // 按编号删除
  pdfDoc.deleteObject(obj)  // 按对象删除

  // 查找页面对象
  const pageObj = pdfDoc.findPage(0)
}
```

#### 字体和图像管理

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  // 添加简单字体
  const font = new mupdf.Font("Arial")
  const fontObj = pdfDoc.addSimpleFont(font, "Latin")

  // 添加 CJK 字体
  const cjkFontObj = pdfDoc.addCJKFont(font, "zh-CN", 0, false)

  // 添加字体（自动检测类型）
  const autoFontObj = pdfDoc.addFont(font)

  // 添加图像
  const image = new mupdf.Image("image.png")
  const imageObj = pdfDoc.addImage(image)

  // 加载图像对象
  const loadedImage = pdfDoc.loadImage(imageObj)
}
```

#### 页面操作（PDFDocument 专用）

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  // 添加新页面
  const mediabox: mupdf.Rect = [0, 0, 612, 792]
  const rotate: mupdf.Rotate = 0
  const resources = pdfDoc.newDictionary()
  const contents = new Uint8Array([...])
  const pageObj = pdfDoc.addPage(mediabox, rotate, resources, contents)

  // 插入页面
  pdfDoc.insertPage(0, pageObj)

  // 删除页面
  pdfDoc.deletePage(0)

  // 复制页面（使用 GraftMap）
  const graftMap = pdfDoc.newGraftMap()
  const graftedObj = graftMap.graftObject(sourceObj)
  graftMap.graftPage(targetPageNum, sourceDoc, sourcePageNum)
}
```

#### 名称树操作

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  // 加载名称树
  const nameTree = pdfDoc.loadNameTree("Dests")  // 或其他名称："JavaScript", "EmbeddedFiles" 等

  // 插入嵌入文件
  const filespec = pdfDoc.newDictionary()
  pdfDoc.insertEmbeddedFile("filename.pdf", filespec)

  // 删除嵌入文件
  pdfDoc.deleteEmbeddedFile("filename.pdf")

  // 重写嵌入文件（内部方法）
  pdfDoc._rewriteEmbeddedFiles(embeddedFiles)
}
```

---

## 页面操作

### 加载页面

```typescript
// 加载第 1 页（索引从 0 开始）
const page = document.loadPage(0)
```

### 获取页面边界

```typescript
const rect = page.getBounds()
// 返回格式: [ulx, uly, lrx, lry]
// ulx: 左上角 x 坐标
// uly: 左上角 y 坐标
// lrx: 右下角 x 坐标
// lry: 右下角 y 坐标

const pageWidth = rect[2] - rect[0]   // 宽度
const pageHeight = rect[3] - rect[1]  // 高度
```

### 将页面转换为图像

```typescript
// 创建变换矩阵（用于缩放）
const matrix = mupdf.Matrix.identity  // 1:1 缩放
// 或自定义缩放
const scale = 2.0
const matrix: mupdf.Matrix = [scale, 0, 0, scale, 0, 0]

// 渲染为 Pixmap
const pixmap = page.toPixmap(
  matrix,                    // 变换矩阵
  mupdf.ColorSpace.DeviceRGB, // 颜色空间
  false,                      // 背景是否透明
  true                        // 是否渲染注释
)

// 转换为 PNG
const pngImage = pixmap.asPNG()

// 转换为 Base64
const base64Image = Buffer.from(pngImage, 'binary').toString('base64')

// 清理资源
pixmap.destroy()
```

### 提取页面文本

#### 基本文本

```typescript
const text = page.toStructuredText("preserve-whitespace")
const plainText = text.asText()
```

#### 高级文本（JSON）

```typescript
const json = page.toStructuredText("preserve-whitespace").asJSON()
// 返回结构化文本 JSON（格式见上文）
```

### 提取页面注释

```typescript
const annotations = page.getAnnotations()
annotations.forEach((annot) => {
  console.log({
    type: annot.getType(),
    rect: annot.getRect(),
    content: annot.getContents(),
    author: annot.getAuthor(),
    modificationDate: annot.getModificationDate()
  })
})
```

### 复制页面

从另一个文档复制页面：

```typescript
const sourceDoc = mupdf.PDFDocument.openDocument(sourceData, "application/pdf")
const targetDoc = mupdf.PDFDocument.openDocument(targetData, "application/pdf")

const sourcePage = sourceDoc.loadPage(0)
const targetPage = targetDoc.newPage([0, 0, 612, 792])  // 创建新页面

// 复制页面内容
targetPage.run(sourcePage, mupdf.Matrix.identity, mupdf.ColorSpace.DeviceRGB)

// 保存目标文档
const buffer = targetDoc.saveToBuffer("incremental")
```

### 删除页面

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  pdfDoc.deletePage(0)  // 删除第 1 页（索引从 0 开始）
}
```

### PDFPage 高级操作

#### 页面框操作

PDF 页面有多个边界框类型：

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  const page = pdfDoc.loadPage(0) as mupdf.PDFPage

  // 获取页面对象
  const pageObj = page.getObject()

  // 获取变换矩阵
  const transform = page.getTransform()

  // 获取指定类型的页面框
  const mediabox = page.getBounds("MediaBox")   // 媒体框（页面物理尺寸）
  const cropbox = page.getBounds("CropBox")    // 裁剪框（显示区域）
  const bleedbox = page.getBounds("BleedBox")  // 出血框（打印区域）
  const trimbox = page.getBounds("TrimBox")    // 裁切框（最终尺寸）
  const artbox = page.getBounds("ArtBox")      // 作品框（内容区域）

  // 设置页面框
  const rect: mupdf.Rect = [0, 0, 612, 792]  // A4 尺寸
  page.setPageBox("CropBox", rect)
  page.setPageBox("MediaBox", rect)
  page.setPageBox("BleedBox", rect)
  page.setPageBox("TrimBox", rect)
  page.setPageBox("ArtBox", rect)
}
```

#### 页面渲染选项

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  const page = pdfDoc.loadPage(0) as mupdf.PDFPage

  // 渲染为 Pixmap（带选项）
  const matrix: mupdf.Matrix = [1, 0, 0, 1, 0, 0]
  const pixmap = page.toPixmap(
    matrix,
    mupdf.ColorSpace.DeviceRGB,
    false,        // alpha 通道
    true,         // showExtras（显示注释和控件）
    "screen",     // usage（"screen" | "print"）
    "CropBox"     // box（页面框类型）
  )
}
```

#### 页面内容操作

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  const page = pdfDoc.loadPage(0) as mupdf.PDFPage

  // 运行页面内容到设备（不包含注释和控件）
  const device = new mupdf.DrawDevice(matrix, pixmap)
  page.runPageContents(device, matrix)

  // 运行页面注释到设备
  page.runPageAnnots(device, matrix)

  // 运行页面控件到设备
  page.runPageWidgets(device, matrix)

  // 运行整个页面（包含注释和控件）
  page.run(device, matrix)
}
```

#### 页面注释和控件

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  const page = pdfDoc.loadPage(0) as mupdf.PDFPage

  // 获取注释列表
  const annotations = page.getAnnotations()

  // 获取控件列表
  const widgets = page.getWidgets()

  // 创建注释
  const annot = page.createAnnotation("Highlight")

  // 删除注释
  page.deleteAnnotation(annot)

  // 更新页面（应用注释更改）
  const updated = page.update()
}
```

#### 页面涂黑（Redaction）

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  const page = pdfDoc.loadPage(0) as mupdf.PDFPage

  // 应用涂黑
  // black_boxes: 是否用黑框填充
  // image_method: 0=None, 1=Remove, 2=Pixels, 3=UnlessInvisible
  // line_art_method: 0=None, 1=RemoveIfCovered, 2=RemoveIfTouched
  // text_method: 0=Remove, 1=None
  page.applyRedactions(
    true,   // black_boxes
    2,      // image_method
    1,      // line_art_method
    0       // text_method
  )

  // 更新页面
  page.update()
}
```

### 裁剪页面

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  const page = pdfDoc.loadPage(0) as mupdf.PDFPage
  // 设置页面边界框（裁剪区域）
  // 格式: [llx, lly, urx, ury]
  // llx: 左下角 x 坐标
  // lly: 左下角 y 坐标
  // urx: 右上角 x 坐标
  // ury: 右上角 y 坐标
  const rect: mupdf.Rect = [100, 100, 500, 700]
  page.setPageBox("CropBox", rect)
  
  // 保存文档以应用更改
  const buffer = pdfDoc.saveToBuffer("incremental")
}
```

### 旋转页面

```typescript
const pdfDoc = document.asPDF()
if (pdfDoc) {
  const page = pdfDoc.loadPage(0) as mupdf.PDFPage
  // 注意：PDFPage 没有直接的 setRotation 方法
  // 旋转通过页面对象的 Rotate 属性实现
  // 需要使用 PDFObject 操作或重新创建页面
}
```

### 页面链接操作

#### 获取页面链接

```typescript
const page = document.loadPage(0)
const links = page.getLinks()

links.forEach((link, index) => {
  console.log(`链接 ${index + 1}:`, {
    uri: link.uri(),                    // 链接 URI
    bounds: link.bounds(),              // 链接边界
    isExternal: link.isExternal()       // 是否外部链接
  })
})
```

#### 创建链接

```typescript
const pdfPage = page.asPDFPage()
if (pdfPage) {
  // 创建外部链接
  const externalLink = pdfPage.createLink(
    [10, 10, 100, 40],                    // 链接区域 [x0, y0, x1, y1]
    "https://mupdfjs.readthedocs.io"      // 外部 URL
  )
  
  // 创建内部链接（跳转到文档内的页面）
  const pdfDoc = document.asPDF()
  if (pdfDoc) {
    const internalLinkURI = pdfDoc.formatLinkURI({
      type: "Fit",
      page: 1  // 跳转到第 2 页（0-based）
    })
    const internalLink = pdfPage.createLink(
      [10, 50, 100, 80],
      internalLinkURI
    )
  }
}
```

#### 删除链接

```typescript
const pdfPage = page.asPDFPage()
if (pdfPage) {
  const links = page.getLinks()
  if (links.length > 0) {
    pdfPage.deleteLink(links[0])
  }
}
```

---

## 注释操作

### 注释类型概述

MuPDF.js 支持以下注释类型：

#### 文本标记类注释
- **Highlight**：高亮注释
- **Underline**：下划线注释
- **Squiggly**：波浪线注释
- **StrikeOut**：删除线注释

#### 文本注释
- **Text**：文本注释（便签）
- **FreeText**：自由文本注释（直接显示在页面上）

#### 绘图类注释
- **Ink**：手绘注释（自由绘制）
- **Square**：矩形注释
- **Circle**：圆形注释
- **Line**：线条注释
- **Polygon**：多边形注释
- **PolyLine**：多折线注释

#### 其他注释
- **Link**：链接注释
- **Stamp**：图章注释
- **Caret**：插入符号注释
- **FileAttachment**：文件附件注释
- **Redact**：涂黑注释（用于隐藏敏感信息）

### 注释基础操作

#### 获取页面注释

```typescript
const page = document.loadPage(0)
const annotations = page.getAnnotations()

annotations.forEach((annot, index) => {
  console.log(`注释 ${index + 1}:`, {
    type: annot.getType(),
    rect: annot.getRect(),
    content: annot.getContents(),
    author: annot.getAuthor(),
    modificationDate: annot.getModificationDate(),
    color: annot.getColor(),
    opacity: annot.getOpacity()
  })
})
```

#### 删除注释

```typescript
const pdfPage = page.asPDFPage()
if (pdfPage) {
  const annotations = page.getAnnotations()
  if (annotations.length > 0) {
    pdfPage.deleteAnnotation(annotations[0])
  }
}
```

#### 更新注释

修改注释属性后，必须调用 `update()` 方法使更改生效：

```typescript
const annot = page.getAnnotations()[0]
annot.setColor([1, 0, 0])  // 修改颜色
annot.setOpacity(0.8)      // 修改透明度
annot.update()              // 必须调用 update()
```

### 文本标记类注释

文本标记类注释（高亮、下划线、删除线、波浪线）使用 QuadPoints 来定义文本区域。

#### QuadPoints 格式说明

QuadPoints 是一个 Quad 数组，每个 Quad 定义了一个文本区域：
- 格式：`[ulx, uly, urx, ury, llx, lly, lrx, lry]`
- `ulx, uly`：左上角坐标
- `urx, ury`：右上角坐标
- `llx, lly`：左下角坐标
- `lrx, lry`：右下角坐标

#### 高亮注释

```typescript
const pdfDoc = document.asPDF()
if (!pdfDoc) return

const page = pdfDoc.loadPage(0) as mupdf.PDFPage

// 创建 QuadPoints（定义高亮区域）
// 单个文本行
const quadPoints: mupdf.Quad[] = [
  [100, 100, 200, 100, 100, 120, 200, 120]
]

// 多行文本（每行一个 Quad）
const multiLineQuads: mupdf.Quad[] = [
  [100, 100, 200, 100, 100, 120, 200, 120],  // 第 1 行
  [100, 130, 200, 130, 100, 150, 200, 150]   // 第 2 行
]

// 创建高亮注释
const annot = page.createAnnotation("Highlight")
annot.setQuadPoints(quadPoints)
annot.setColor([1, 1, 0])      // 黄色 (RGB, 0-1 范围)
annot.setOpacity(0.5)          // 50% 透明度
annot.setContents("这是高亮注释的内容")  // 可选：注释内容
annot.setAuthor("张三")        // 可选：作者
annot.update()
```

#### 下划线注释

```typescript
const annot = page.createAnnotation("Underline")
annot.setQuadPoints(quadPoints)
annot.setColor([0, 0, 1])      // 蓝色
annot.setOpacity(1.0)
annot.update()
```

#### 删除线注释

```typescript
const annot = page.createAnnotation("StrikeOut")
annot.setQuadPoints(quadPoints)
annot.setColor([1, 0, 0])      // 红色
annot.setOpacity(1.0)
annot.update()
```

#### 波浪线注释

```typescript
const annot = page.createAnnotation("Squiggly")
annot.setQuadPoints(quadPoints)
annot.setColor([0, 1, 0])      // 绿色
annot.setOpacity(1.0)
annot.update()
```

### 文本注释

#### Text 注释（便签）

Text 注释显示为一个图标，点击后显示注释内容：

```typescript
const pdfPage = page.asPDFPage()
if (!pdfPage) return

const annot = pdfPage.createAnnotation("Text")
annot.setRect([100, 100, 150, 150])        // 注释图标位置 [x0, y0, x1, y1]
annot.setContents("这是注释内容")          // 注释内容
annot.setAuthor("张三")                    // 作者
annot.setColor([1, 1, 0])                  // 图标颜色（黄色）
annot.setOpacity(1.0)                      // 透明度
annot.setOpen(false)                        // 是否默认打开
annot.update()
```

**Text 注释图标类型：**
- `setIcon("Comment")`：评论图标（默认）
- `setIcon("Key")`：钥匙图标
- `setIcon("Note")`：便签图标
- `setIcon("Help")`：帮助图标
- `setIcon("NewParagraph")`：新段落图标
- `setIcon("Paragraph")`：段落图标
- `setIcon("Insert")`：插入图标

#### FreeText 注释（自由文本）

FreeText 注释直接在页面上显示文本内容：

```typescript
const pdfPage = page.asPDFPage()
if (!pdfPage) return

const annot = pdfPage.createAnnotation("FreeText")
annot.setRect([100, 100, 300, 200])        // 文本区域
annot.setContents("这是自由文本注释")      // 显示的文本
annot.setColor([0, 0, 0])                  // 文本颜色（黑色）
annot.setFontSize(12)                      // 字体大小
annot.setBorderWidth(1)                    // 边框宽度
annot.setBorderColor([0, 0, 1])            // 边框颜色（蓝色）
annot.update()
```

**FreeText 注释对齐方式：**
- `setJustification("Left")`：左对齐（默认）
- `setJustification("Center")`：居中
- `setJustification("Right")`：右对齐

### 链接注释

链接注释用于在 PDF 中创建可点击的链接区域：

```typescript
const pdfPage = page.asPDFPage()
if (!pdfPage) return

const annot = pdfPage.createAnnotation("Link")
annot.setRect([100, 100, 200, 120])        // 链接区域 [x0, y0, x1, y1]

// 外部链接
annot.setURI("https://example.com")

// 或内部链接（跳转到文档内的页面）
const pdfDoc = document.asPDF()
if (pdfDoc) {
  const internalURI = pdfDoc.formatLinkURI({
    type: "Fit",
    page: 1  // 跳转到第 2 页（0-based）
  })
  annot.setURI(internalURI)
}

annot.setBorderWidth(0)                    // 边框宽度（0 表示无边框）
annot.setHighlight("Invert")               // 高亮模式：None, Invert, Outline, Push
annot.update()
```

**高亮模式说明：**
- `"None"`：无高亮
- `"Invert"`：反转颜色
- `"Outline"`：显示轮廓
- `"Push"`：按下效果

### 绘图和形状注释

#### Ink 注释（手绘）

Ink 注释用于手绘自由形状：

```typescript
const pdfPage = page.asPDFPage()
if (!pdfPage) return

// 创建手绘路径
// inkList 是一个点数组的数组，每个子数组代表一条连续的路径
const inkList: mupdf.Point[][] = [
  [
    [100, 100],  // 路径 1 的点
    [150, 120],
    [200, 110],
    [250, 130]
  ],
  [
    [100, 200],  // 路径 2 的点
    [150, 220],
    [200, 210]
  ]
]

const annot = pdfPage.createAnnotation("Ink")
annot.setInkList(inkList)
annot.setColor([0, 0, 0])          // 黑色
annot.setOpacity(1.0)
annot.setBorderWidth(2.0)          // 线宽
annot.update()
```

#### Square 注释（矩形）

```typescript
const annot = pdfPage.createAnnotation("Square")
annot.setRect([100, 100, 300, 200])        // 矩形区域
annot.setColor([1, 0, 0])                  // 红色
annot.setBorderWidth(2)                    // 边框宽度
annot.setFillColor([1, 1, 0])              // 填充颜色（黄色）
annot.setOpacity(0.8)                      // 透明度
annot.update()
```

#### Circle 注释（圆形）

```typescript
const annot = pdfPage.createAnnotation("Circle")
annot.setRect([100, 100, 300, 300])        // 圆形边界框（正方形）
annot.setColor([0, 0, 1])                  // 蓝色
annot.setBorderWidth(2)
annot.setFillColor([0, 1, 1])              // 青色填充
annot.setOpacity(0.7)
annot.update()
```

#### Line 注释（线条）

```typescript
const annot = pdfPage.createAnnotation("Line")
annot.setRect([100, 100, 300, 200])        // 线条边界框
annot.setLine([100, 100, 300, 200])        // 起点和终点 [x1, y1, x2, y2]
annot.setColor([0, 1, 0])                  // 绿色
annot.setBorderWidth(2)
annot.setStartStyle("Square")              // 起点样式：None, Square, Circle, Diamond
annot.setEndStyle("Circle")                // 终点样式
annot.update()
```

#### Polygon 注释（多边形）

```typescript
const annot = pdfPage.createAnnotation("Polygon")
annot.setVertices([
  [100, 100],  // 顶点 1
  [200, 100],  // 顶点 2
  [200, 200],  // 顶点 3
  [100, 200]   // 顶点 4
])
annot.setColor([1, 0, 1])                  // 洋红色
annot.setBorderWidth(2)
annot.setFillColor([1, 1, 0])              // 黄色填充
annot.setOpacity(0.8)
annot.update()
```

#### PolyLine 注释（多折线）

```typescript
const annot = pdfPage.createAnnotation("PolyLine")
annot.setVertices([
  [100, 100],
  [150, 150],
  [200, 120],
  [250, 180]
])
annot.setColor([0, 0, 1])                   // 蓝色
annot.setBorderWidth(2)
annot.setStartStyle("Circle")              // 起点样式
annot.setEndStyle("Square")                // 终点样式
annot.update()
```

### 图章注释

图章注释用于添加预定义的图章标记：

```typescript
const pdfPage = page.asPDFPage()
if (!pdfPage) return

const annot = pdfPage.createAnnotation("Stamp")
annot.setRect([100, 100, 300, 200])        // 图章位置和大小
annot.setIcon("Approved")                  // 图章类型
annot.setColor([0, 1, 0])                  // 绿色
annot.setOpacity(1.0)
annot.update()
```

**支持的图章类型：**
- `"Approved"`：已批准
- `"AsIs"`：按原样
- `"Confidential"`：机密
- `"Departmental"`：部门
- `"Draft"`：草稿
- `"Experimental"`：实验性
- `"Expired"`：已过期
- `"Final"`：最终版
- `"ForComment"`：供评论
- `"ForPublicRelease"`：公开发布
- `"NotApproved"`：未批准
- `"NotForPublicRelease"`：不公开发布
- `"Sold"`：已售出
- `"TopSecret"`：绝密
- `"Void"`：作废

### 插入符号注释（Caret）

Caret 注释用于标记插入位置：

```typescript
const annot = pdfPage.createAnnotation("Caret")
annot.setRect([100, 100, 110, 120])        // 插入符号位置
annot.setColor([1, 0, 0])                  // 红色
annot.update()
```

### 涂黑注释（Redact）

Redact 注释用于隐藏敏感信息：

```typescript
const annot = pdfPage.createAnnotation("Redact")
annot.setRect([100, 100, 300, 200])        // 涂黑区域
annot.setFillColor([0, 0, 0])              // 黑色填充
annot.setBorderWidth(0)                    // 无边框
annot.setContents("敏感信息已涂黑")        // 替换文本（可选）
annot.update()

// 应用涂黑（将区域真正涂黑）
// 注意：应用后无法恢复
// pdfPage.applyRedactions()
```

### 文件附件注释

文件附件注释用于在 PDF 中嵌入文件：

```typescript
const pdfPage = page.asPDFPage()
if (!pdfPage) return

const pdfDoc = document.asPDF()
if (!pdfDoc) return

// 第 1 步：创建嵌入文件
const fileData = new Uint8Array([...])  // 文件内容
const embeddedFile = pdfDoc.addEmbeddedFile(
  "attachment.txt",      // 文件名
  "text/plain",          // MIME 类型
  fileData               // 文件数据
)

// 第 2 步：创建文件附件注释
const annot = pdfPage.createAnnotation("FileAttachment")
annot.setRect([100, 100, 150, 150])      // 附件图标位置
annot.setFile(embeddedFile)              // 关联嵌入文件
annot.setIcon("Paperclip")               // 图标类型：Graph, Paperclip, PushPin, Tag
annot.setContents("这是附件说明")        // 注释说明
annot.update()
```

**图标类型：**
- `"Graph"`：图表图标
- `"Paperclip"`：回形针图标（默认）
- `"PushPin"`：图钉图标
- `"Tag"`：标签图标

**提取附件：**
```typescript
const annotations = page.getAnnotations()
const fileAnnot = annotations.find(a => a.getType() === "FileAttachment")
if (fileAnnot) {
  const embeddedFile = fileAnnot.getFile()
  const fileData = embeddedFile.data()      // 获取文件数据
  const fileName = embeddedFile.name()      // 获取文件名
  const mimeType = embeddedFile.mimeType()  // 获取 MIME 类型
  
  // 保存文件
  const blob = new Blob([fileData], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
```


---

## 核心类和方法

### Buffer 类

Buffer 类用于处理二进制数据缓冲区。

#### 创建 Buffer

```typescript
// 创建空 Buffer
const buffer1 = new mupdf.Buffer()

// 从字符串创建 Buffer（UTF-8 编码）
const buffer2 = new mupdf.Buffer("Hello, World!")

// 从 ArrayBuffer 或 Uint8Array 创建 Buffer
const data = new Uint8Array([1, 2, 3, 4, 5])
const buffer3 = new mupdf.Buffer(data)
```

#### Buffer 方法

```typescript
// 获取长度
const length = buffer.getLength()

// 读取指定位置的字节
const byte = buffer.readByte(0)

// 写入字符串
buffer.write("Hello")

// 写入单个字节
buffer.writeByte(65)  // ASCII 'A'

// 写入一行（自动添加换行符）
buffer.writeLine("Line 1")

// 写入其他 Buffer
buffer.writeBuffer(otherBuffer)

// 转换为 Uint8Array
const uint8Array = buffer.asUint8Array()

// 转换为字符串
const str = buffer.asString()

// 切片（创建新的 Buffer）
const slice = buffer.slice(0, 100)

// 保存到文件（Node.js）
buffer.save("output.bin")

// 销毁 Buffer（释放内存）
buffer.destroy()
```

### ColorSpace 类

ColorSpace 类用于定义颜色空间。

#### 预定义颜色空间

```typescript
// 设备颜色空间
const gray = mupdf.ColorSpace.DeviceGray
const rgb = mupdf.ColorSpace.DeviceRGB
const bgr = mupdf.ColorSpace.DeviceBGR
const cmyk = mupdf.ColorSpace.DeviceCMYK
const lab = mupdf.ColorSpace.Lab
```

#### 创建自定义颜色空间

```typescript
// 从 ICC 配置文件创建
const profile = new Uint8Array([...])  // ICC 配置文件数据
const customCS = new mupdf.ColorSpace(profile, "CustomRGB")
```

#### ColorSpace 方法

```typescript
// 获取颜色空间名称
const name = colorSpace.getName()

// 获取颜色空间类型
const type = colorSpace.getType()  // "Gray" | "RGB" | "CMYK" 等

// 获取组件数量
const components = colorSpace.getNumberOfComponents()

// 检查颜色空间类型
const isGray = colorSpace.isGray()
const isRGB = colorSpace.isRGB()
const isCMYK = colorSpace.isCMYK()
const isIndexed = colorSpace.isIndexed()
const isLab = colorSpace.isLab()
const isDeviceN = colorSpace.isDeviceN()
const isSubtractive = colorSpace.isSubtractive()

// 转换为字符串
const str = colorSpace.toString()
```

### Font 类

Font 类用于处理字体。

#### 创建 Font

```typescript
// 按名称创建字体
const font1 = new mupdf.Font("Arial")

// 从文件加载字体
const font2 = new mupdf.Font("Arial", "/path/to/font.ttf")

// 从数据加载字体
const fontData = new Uint8Array([...])
const font3 = new mupdf.Font("Arial", fontData)
```

#### Font 方法

```typescript
// 获取字体名称
const name = font.getName()

// 编码字符（返回字形 ID）
const gid = font.encodeCharacter(65)  // ASCII 'A'
const gid2 = font.encodeCharacter("中")  // Unicode 字符

// 获取字形宽度
const advance = font.advanceGlyph(gid, 0)  // 0 = 水平模式，1 = 垂直模式

// 检查字体属性
const isMono = font.isMono()      // 等宽字体
const isSerif = font.isSerif()    // 衬线字体
const isBold = font.isBold()      // 粗体
const isItalic = font.isItalic()  // 斜体
```

#### CJK 字体支持

```typescript
// CJK 字体排序
const ADOBE_CNS = 0  // 繁体中文
const ADOBE_GB = 1   // 简体中文
const ADOBE_JAPAN = 2  // 日文
const ADOBE_KOREA = 3  // 韩文

// CJK 语言映射
const lang = mupdf.Font.CJK_ORDERING_BY_LANG["zh-CN"]  // 返回 1
```

### Image 类

Image 类用于处理图像。

#### 创建 Image

```typescript
// 从文件加载图像
const image1 = new mupdf.Image("image.png")

// 从数据加载图像
const imageData = new Uint8Array([...])
const image2 = new mupdf.Image(imageData)

// 从 Pixmap 创建 Image
const pixmap = page.toPixmap(...)
const image3 = new mupdf.Image(pixmap)
```

#### Image 方法

```typescript
// 获取图像尺寸
const width = image.getWidth()
const height = image.getHeight()

// 获取组件数量
const components = image.getNumberOfComponents()

// 获取每组件位数
const bitsPerComponent = image.getBitsPerComponent()

// 获取分辨率
const xRes = image.getXResolution()
const yRes = image.getYResolution()

// 获取颜色空间
const colorSpace = image.getColorSpace()

// 检查是否为图像遮罩
const isMask = image.getImageMask()

// 获取遮罩图像
const mask = image.getMask()

// 转换为 Pixmap
const pixmap = image.toPixmap()
```

### Path 类

Path 类用于创建和操作路径。

#### 创建 Path

```typescript
// 创建空路径
const path = new mupdf.Path()

// 或从现有路径创建
const path2 = new mupdf.Path(existingPath)
```

#### Path 方法

```typescript
// 移动到点
path.moveTo(100, 100)

// 直线到点
path.lineTo(200, 200)

// 三次贝塞尔曲线
path.curveTo(150, 150, 180, 180, 200, 200)

// 二次贝塞尔曲线（控制点 + 终点）
path.curveToV(150, 150, 200, 200)

// 二次贝塞尔曲线（起点 + 控制点）
path.curveToY(100, 100, 150, 150)

// 闭合路径
path.closePath()

// 添加矩形
path.rect(0, 0, 100, 100)

// 变换路径
path.transform(matrix)

// 获取路径边界
const bounds = path.getBounds(strokeState, matrix)

// 遍历路径
path.walk({
  moveTo(x, y) { console.log(`Move to ${x}, ${y}`) },
  lineTo(x, y) { console.log(`Line to ${x}, ${y}`) },
  curveTo(x1, y1, x2, y2, x3, y3) { console.log(`Curve to ${x3}, ${y3}`) },
  closePath() { console.log('Close path') }
})
```

### Text 类

Text 类用于处理文本和字形。

#### 创建 Text

```typescript
const text = new mupdf.Text()
```

#### Text 方法

```typescript
// 显示字形
text.showGlyph(font, matrix, glyphId, unicode, wmode)

// 显示字符串
const newMatrix = text.showString(font, matrix, "Hello", wmode)

// 获取文本边界
const bounds = text.getBounds(strokeState, matrix)

// 遍历文本
text.walk({
  beginSpan(font, trm, wmode, bidi, markupDirection, language) {
    console.log('Begin span')
  },
  showGlyph(font, trm, glyph, unicode, wmode, bidi) {
    console.log(`Glyph: ${glyph}, Unicode: ${unicode}`)
  },
  endSpan() {
    console.log('End span')
  }
})
```

### DisplayList 类

DisplayList 类用于存储页面渲染指令列表。

#### 创建 DisplayList

```typescript
// 从页面创建
const displayList = page.toDisplayList()

// 从矩形区域创建
const mediabox: mupdf.Rect = [0, 0, 612, 792]
const displayList2 = new mupdf.DisplayList(mediabox)
```

#### DisplayList 方法

```typescript
// 获取边界
const bounds = displayList.getBounds()

// 渲染为 Pixmap
const pixmap = displayList.toPixmap(matrix, colorSpace, alpha)

// 转换为结构化文本
const structuredText = displayList.toStructuredText(options)

// 运行到设备
displayList.run(device, matrix)

// 搜索文本
const results = displayList.search("keyword", maxHits)
```

### Pixmap 类

Pixmap 类用于存储像素图像数据。

#### 创建 Pixmap

```typescript
// 从页面创建
const pixmap = page.toPixmap(matrix, colorSpace, alpha)

// 从颜色空间和边界框创建
const bbox: mupdf.Rect = [0, 0, 100, 100]
const pixmap2 = new mupdf.Pixmap(colorSpace, bbox, true)  // true = 有 alpha 通道
```

#### Pixmap 方法

```typescript
// 获取尺寸和位置
const width = pixmap.getWidth()
const height = pixmap.getHeight()
const x = pixmap.getX()
const y = pixmap.getY()

// 获取步长（每行字节数）
const stride = pixmap.getStride()

// 获取组件数量
const components = pixmap.getNumberOfComponents()

// 获取 alpha 通道
const alpha = pixmap.getAlpha()

// 获取分辨率
const xRes = pixmap.getXResolution()
const yRes = pixmap.getYResolution()

// 设置分辨率
pixmap.setResolution(72, 72)

// 获取颜色空间
const colorSpace = pixmap.getColorSpace()

// 获取像素数据
const pixels = pixmap.getPixels()  // 返回 Uint8ClampedArray

// 清除像素（填充颜色）
pixmap.clear(255)  // 填充白色

// 转换为图像格式
const png = pixmap.asPNG()
const jpeg = pixmap.asJPEG(90, false)  // 质量 0-100，是否反转 CMYK
const psd = pixmap.asPSD()
const pam = pixmap.asPAM()

// 图像处理
pixmap.invert()                    // 反转颜色
pixmap.invertLuminance()           // 反转亮度
pixmap.gamma(2.2)                  // 应用 gamma 校正
pixmap.tint([0, 0, 0], [1, 1, 1])  // 着色（黑色 -> 白色）
pixmap.convertToColorSpace(newColorSpace, keepAlpha)  // 转换颜色空间

// 扭曲变换
const points: mupdf.Point[] = [
  [0, 0], [100, 0], [100, 100], [0, 100]
]
const warped = pixmap.warp(points, 200, 200)

// 获取边界
const bounds = pixmap.getBounds()
```

### StrokeState 类

StrokeState 类用于定义描边状态。

#### 创建 StrokeState

```typescript
// 从数据创建
const strokeData: mupdf.StrokeStateData = {
  lineCap: "Round",
  lineJoin: "Round",
  lineWidth: 2.0,
  miterLimit: 10.0,
  dashPhase: 0,
  dashes: [5, 5]  // 虚线模式
}
const strokeState = new mupdf.StrokeState(strokeData)
```

#### StrokeState 方法

```typescript
// 获取属性
const lineCap = strokeState.getLineCap()
const lineJoin = strokeState.getLineJoin()
const lineWidth = strokeState.getLineWidth()
const miterLimit = strokeState.getMiterLimit()
const dashPhase = strokeState.getDashPhase()
const dashes = strokeState.getDashes()
```

### Device 类

Device 类用于自定义渲染设备。

#### 创建自定义 Device

```typescript
const device = new mupdf.Device({
  fillPath(path, evenOdd, ctm, colorspace, color, alpha) {
    // 填充路径
  },
  strokePath(path, stroke, ctm, colorspace, color, alpha) {
    // 描边路径
  },
  fillText(text, ctm, colorspace, color, alpha) {
    // 填充文本
  },
  fillImage(image, ctm, alpha) {
    // 填充图像
  },
  // ... 其他回调方法
})
```

#### 预定义 Device

```typescript
// DrawDevice：绘制到 Pixmap
const drawDevice = new mupdf.DrawDevice(matrix, pixmap)

// DisplayListDevice：添加到 DisplayList
const displayListDevice = new mupdf.DisplayListDevice(displayList)
```

### PDFObject 类

PDFObject 类用于操作 PDF 对象。

#### 获取 PDFObject

```typescript
// 从页面获取
const pdfPage = page.asPDFPage()
const pageObj = pdfPage.getObject()

// 从注释获取
const annotObj = annot.getObject()
```

#### PDFObject 方法

```typescript
// 类型检查
const isNull = obj.isNull()
const isIndirect = obj.isIndirect()
const isBoolean = obj.isBoolean()
const isInteger = obj.isInteger()
const isReal = obj.isReal()
const isNumber = obj.isNumber()
const isName = obj.isName()
const isString = obj.isString()
const isArray = obj.isArray()
const isDictionary = obj.isDictionary()
const isStream = obj.isStream()

// 类型转换
const bool = obj.asBoolean()
const num = obj.asNumber()
const name = obj.asName()
const str = obj.asString()
const byteStr = obj.asByteString()
const indirect = obj.asIndirect()

// 读取流
const streamBuffer = obj.readStream()
const rawStreamBuffer = obj.readRawStream()

// 写入
obj.writeObject(value)
obj.writeStream(buffer)
obj.writeRawStream(buffer)

// 解析引用
const resolved = obj.resolve()

// 数组操作
const length = obj.length
obj.push(value)
const value = obj.get(index)
obj.put(key, value)
obj.delete(key)

// 字典操作
const value = obj.get("key")
obj.put("key", value)
obj.delete("key")
const inherited = obj.getInheritable("key")

// 遍历
obj.forEach((val, key, self) => {
  console.log(key, val)
})

// 转换为 JavaScript 对象
const jsObj = obj.asJS()

// 转换为字符串
const str = obj.toString(tight, ascii)
```

### PDFAnnotation 类（补充方法）

除了前面介绍的方法，PDFAnnotation 还提供了更多方法：

#### 高级属性设置

```typescript
// 语言设置
annot.setLanguage("zh-CN")
const language = annot.getLanguage()

// 标志位操作
const flags = annot.getFlags()
annot.setFlags(flags)

// 默认外观（用于 FreeText）
annot.setDefaultAppearance("Arial", 12, [0, 0, 0])
const appearance = annot.getDefaultAppearance()

// 富文本内容
annot.setRichContents("Plain text", "<html>...</html>")
const richContents = annot.getRichContents()
const richDefaults = annot.getRichDefaults()

// 图章图像
annot.setStampImage(image)

// 外观设置
annot.setAppearanceFromDisplayList(appearance, state, transform, displayList)
annot.setAppearance(appearance, state, transform, bbox, resources, contents)
```

#### 高级几何操作

```typescript
// 线条相关（Line 注释）
const line = annot.getLine()  // 返回 [x1, y1, x2, y2]
annot.setLine([100, 100], [200, 200])

// 线条端点样式
const styles = annot.getLineEndingStyles()
annot.setLineEndingStyles("Square", "Circle")

// 线条标题
const hasCaption = annot.getLineCaption()
annot.setLineCaption(true)
const captionOffset = annot.getLineCaptionOffset()
annot.setLineCaptionOffset([10, 10])

// 引线设置
const leader = annot.getLineLeader()
annot.setLineLeader(5.0)
const extension = annot.getLineLeaderExtension()
annot.setLineLeaderExtension(10.0)
const offset = annot.getLineLeaderOffset()
annot.setLineLeaderOffset(2.0)

// 标注线（Callout）
const calloutStyle = annot.getCalloutStyle()
annot.setCalloutStyle("OpenArrow")
const calloutLine = annot.getCalloutLine()
annot.setCalloutLine([[100, 100], [150, 150]])
const calloutPoint = annot.getCalloutPoint()
annot.setCalloutPoint([200, 200])
```

#### 边框和效果

```typescript
// 边框宽度
const width = annot.getBorderWidth()
annot.setBorderWidth(2.0)

// 边框样式
const style = annot.getBorderStyle()  // "Solid" | "Dashed" | "Beveled" | "Inset" | "Underline"
annot.setBorderStyle("Dashed")

// 边框效果
const effect = annot.getBorderEffect()  // "None" | "Cloudy"
annot.setBorderEffect("Cloudy")
const intensity = annot.getBorderEffectIntensity()
annot.setBorderEffectIntensity(2.0)

// 虚线模式
const dashCount = annot.getBorderDashCount()
const dashItem = annot.getBorderDashItem(0)
annot.clearBorderDash()
annot.addBorderDashItem(5.0)
const dashPattern = annot.getBorderDashPattern()
annot.setBorderDashPattern([5, 5, 10, 5])
```

#### 意图（Intent）

```typescript
const intent = annot.getIntent()
annot.setIntent("FreeTextCallout")
```

### PDFWidget 类

PDFWidget 类继承自 PDFAnnotation，用于处理表单控件。

#### 字段类型

```typescript
// 获取字段类型
const fieldType = widget.getFieldType()

// 检查控件类型
const isButton = widget.isButton()
const isPushButton = widget.isPushButton()
const isCheckbox = widget.isCheckbox()
const isRadioButton = widget.isRadioButton()
const isText = widget.isText()
const isChoice = widget.isChoice()
const isListBox = widget.isListBox()
const isComboBox = widget.isComboBox()
```

#### 文本字段操作

```typescript
// 设置文本值
const result = widget.setTextValue("Hello, World!")

// 获取最大长度
const maxLen = widget.getMaxLen()

// 检查属性
const isMultiline = widget.isMultiline()
const isPassword = widget.isPassword()
const isComb = widget.isComb()
const isReadOnly = widget.isReadOnly()
```

#### 选择字段操作

```typescript
// 设置选择值
const result = widget.setChoiceValue("Option 1")

// 获取选项列表
const options = widget.getOptions()  // 导出值
const displayOptions = widget.getOptions(true)  // 显示值
```

#### 按钮操作

```typescript
// 切换复选框/单选按钮
const result = widget.toggle()
```

#### 字段信息

```typescript
// 获取标签
const label = widget.getLabel()

// 获取名称
const name = widget.getName()

// 获取值
const value = widget.getValue()

// 获取字段标志
const flags = widget.getFieldFlags()
```

### DocumentWriter 类

DocumentWriter 类用于创建新文档。

#### 创建文档写入器

```typescript
const buffer = new mupdf.Buffer()
const writer = new mupdf.DocumentWriter(buffer, "pdf", "compress-images")
```

#### DocumentWriter 方法

```typescript
// 开始新页面
const device = writer.beginPage(mediabox)

// 结束当前页面
writer.endPage()

// 关闭写入器
writer.close()

// 完成后销毁
writer.destroy()
```

### OutlineIterator 类

OutlineIterator 类用于遍历文档大纲。

#### 创建大纲迭代器

```typescript
const iterator = document.outlineIterator()
```

#### OutlineIterator 方法

```typescript
// 获取当前项
const item = iterator.item()

// 导航
const result = iterator.next()  // 下一个
const result = iterator.prev()  // 上一个
const result = iterator.up()    // 上一级
const result = iterator.down()  // 下一级

// 编辑
const result = iterator.delete()  // 删除当前项
const result = iterator.insert(item)  // 插入项
iterator.update(item)  // 更新当前项

// 结果常量
if (result === mupdf.OutlineIterator.RESULT_DID_NOT_MOVE) { /* 未移动 */ }
if (result === mupdf.OutlineIterator.RESULT_AT_ITEM) { /* 在项上 */ }
if (result === mupdf.OutlineIterator.RESULT_AT_EMPTY) { /* 在空位置 */ }
```

### StructuredText 类

StructuredText 类用于处理结构化文本（从页面提取的文本）。

#### 创建 StructuredText

```typescript
// 从页面创建
const structuredText = page.toStructuredText("preserve-whitespace")

// 从 DisplayList 创建
const displayList = page.toDisplayList()
const structuredText2 = displayList.toStructuredText()
```

#### StructuredText 方法

```typescript
// 转换为纯文本
const plainText = structuredText.asText()

// 转换为 JSON
const json = structuredText.asJSON(scale)  // scale 可选，用于缩放坐标

// 转换为 HTML
const html = structuredText.asHTML(id)  // id 用于生成唯一的 HTML ID

// 遍历结构化文本
structuredText.walk({
  onImageBlock(bbox, transform, image) {
    console.log('Image block:', bbox)
  },
  beginTextBlock(bbox) {
    console.log('Begin text block:', bbox)
  },
  beginLine(bbox, wmode, direction) {
    console.log('Begin line:', bbox)
  },
  onChar(c, origin, font, size, quad, color) {
    console.log('Character:', c, 'at', origin)
  },
  endLine() {
    console.log('End line')
  },
  endTextBlock() {
    console.log('End text block')
  }
})

// 文本选择
const startPoint: mupdf.Point = [100, 100]
const endPoint: mupdf.Point = [200, 200]
const selectedQuad = structuredText.snap(startPoint, endPoint, "words")

// 复制文本
const copiedText = structuredText.copy(startPoint, endPoint)

// 高亮文本
const highlightQuads = structuredText.highlight(startPoint, endPoint, maxHits)

// 搜索文本
const searchResults = structuredText.search("keyword", maxHits)
```

#### 选择模式

```typescript
// 字符级别选择
const charQuad = structuredText.snap(startPoint, endPoint, "chars")

// 单词级别选择
const wordQuad = structuredText.snap(startPoint, endPoint, "words")

// 行级别选择
const lineQuad = structuredText.snap(startPoint, endPoint, "lines")
```

### Link 类

Link 类用于处理页面链接。

#### 获取 Link

```typescript
// 从页面获取链接
const links = page.getLinks()
const link = links[0]
```

#### Link 方法

```typescript
// 获取链接边界
const bounds = link.getBounds()  // 返回 Rect

// 设置链接边界
link.setBounds([100, 100, 200, 120])

// 获取链接 URI
const uri = link.getURI()

// 设置链接 URI
link.setURI("https://example.com")

// 检查是否为外部链接
const isExternal = link.isExternal()
```

### Stream 类

Stream 类用于自定义流式数据源。

#### 创建 Stream

```typescript
const streamHandle: mupdf.StreamHandle = {
  fileSize() { return data.length },
  read(memory, offset, length, position) {
    // 读取数据到 memory
    return bytesRead
  },
  close() {
    // 清理资源
  }
}
const stream = new mupdf.Stream(streamHandle)
```

### 全局函数

#### ICC 颜色管理

```typescript
// 启用 ICC 颜色管理
mupdf.enableICC()

// 禁用 ICC 颜色管理
mupdf.disableICC()
```

#### CSS 设置

```typescript
// 设置用户 CSS（用于 HTML/CSS 渲染）
mupdf.setUserCSS("body { font-family: Arial; }")
```

#### 字体加载函数

```typescript
// 安装自定义字体加载函数
mupdf.installLoadFontFunction((name, script, bold, italic) => {
  // 返回 Font 对象或 null
  return font
})
```

#### 内存调试

```typescript
// 列出所有内存块
mupdf.memento.listBlocks()

// 检查所有内存
mupdf.memento.checkAllMemory()
```

---

## 资源管理

### 销毁对象的重要性

MuPDF.js 使用 WebAssembly 管理内存，所有 MuPDF 对象都需要手动销毁以释放内存。不销毁对象会导致内存泄漏。

### 需要销毁的对象类型

以下对象在使用完毕后必须调用 `destroy()` 方法：

```typescript
// 1. 文档对象
const document = mupdf.Document.openDocument(data, "application/pdf")
// ... 使用文档 ...
document.destroy()

// 2. 页面对象
const page = document.loadPage(0)
// ... 使用页面 ...
page.destroy()

// 3. Pixmap 对象（渲染结果）
const pixmap = page.toPixmap(matrix, colorSpace, false, true)
// ... 使用 pixmap ...
pixmap.destroy()

// 4. StructuredText 对象（文本提取结果）
const text = page.toStructuredText("preserve-whitespace")
// ... 使用文本 ...
text.destroy()

// 5. Buffer 对象（保存结果）
const buffer = pdfDoc.saveToBuffer("incremental")
const uint8Array = buffer.asUint8Array()
// ... 使用 buffer ...
buffer.destroy()

// 6. EmbeddedFile 对象
const embeddedFile = pdfDoc.addEmbeddedFile(...)
// ... 使用 embeddedFile ...
embeddedFile.destroy()
```

### 对象生命周期规则

1. **文档销毁时**：文档销毁时，其所有页面也会自动销毁
2. **页面销毁时**：页面销毁时，其所有注释也会自动销毁
3. **避免重复销毁**：不要销毁已经销毁的对象，会导致错误
4. **避免使用已销毁对象**：销毁后的对象不能再使用

### 最佳实践

#### 1. 及时销毁

```typescript
const pixmap = page.toPixmap(...)
const pngImage = pixmap.asPNG()
// 立即销毁，不要等到函数结束
pixmap.destroy()
// 继续使用 pngImage（这是普通 JavaScript 对象，不需要销毁）
```

#### 2. 使用 try-finally 确保销毁

```typescript
let document: mupdf.Document | null = null
let page: mupdf.Page | null = null
let text: mupdf.StructuredText | null = null

try {
  document = mupdf.Document.openDocument(data, "application/pdf")
  page = document.loadPage(0)
  text = page.toStructuredText("preserve-whitespace")
  const plainText = text.asText()
  
  // 使用文本...
  console.log(plainText)
} catch (error) {
  console.error('处理失败:', error)
} finally {
  // 确保资源被释放（按相反顺序销毁）
  if (text) text.destroy()
  if (page) page.destroy()
  if (document) document.destroy()
}
```

#### 3. 封装销毁逻辑

```typescript
class PDFProcessor {
  private doc: mupdf.Document | null = null
  
  async loadDocument(data: Uint8Array): Promise<void> {
    this.cleanup()  // 清理之前的文档
    this.doc = mupdf.Document.openDocument(data, "application/pdf")
  }
  
  getPage(pageNum: number): mupdf.Page {
    if (!this.doc) throw new Error('文档未加载')
    return this.doc.loadPage(pageNum)
  }
  
  cleanup(): void {
    if (this.doc) {
      this.doc.destroy()
      this.doc = null
    }
  }
  
  // 析构函数（如果支持）
  destroy(): void {
    this.cleanup()
  }
}

// 使用
const processor = new PDFProcessor()
try {
  await processor.loadDocument(data)
  const page = processor.getPage(0)
  // ... 使用页面 ...
  page.destroy()  // 页面需要单独销毁
} finally {
  processor.destroy()  // 清理文档
}
```

#### 4. 避免内存泄漏的常见错误

```typescript
// ❌ 错误：忘记销毁
const pixmap = page.toPixmap(...)
const pngImage = pixmap.asPNG()
// 忘记调用 pixmap.destroy()

// ✅ 正确：立即销毁
const pixmap = page.toPixmap(...)
const pngImage = pixmap.asPNG()
pixmap.destroy()

// ❌ 错误：重复销毁
pixmap.destroy()
pixmap.destroy()  // 错误！

// ❌ 错误：销毁后使用
const pixmap = page.toPixmap(...)
pixmap.destroy()
const pngImage = pixmap.asPNG()  // 错误！对象已销毁

// ✅ 正确：先使用，后销毁
const pixmap = page.toPixmap(...)
const pngImage = pixmap.asPNG()  // 先使用
pixmap.destroy()                  // 后销毁
```

### 内存管理检查清单

- [ ] 每个 `Document` 对象都调用了 `destroy()`
- [ ] 每个 `Page` 对象都调用了 `destroy()`
- [ ] 每个 `Pixmap` 对象都调用了 `destroy()`
- [ ] 每个 `StructuredText` 对象都调用了 `destroy()`
- [ ] 每个 `Buffer` 对象都调用了 `destroy()`
- [ ] 使用 `try-finally` 确保异常情况下也能销毁
- [ ] 避免在销毁后继续使用对象
- [ ] 避免重复销毁同一个对象

---

## 项目中的实际应用

### 文档代理类

项目中创建了 `MuPDFDocumentProxy` 类来封装文档操作：

```typescript
export class MuPDFDocumentProxy {
  private doc: mupdf.Document
  private _numPages: number

  constructor(doc: mupdf.Document) {
    this.doc = doc
    this._numPages = doc.countPages()
  }

  get numPages(): number {
    return this._numPages
  }

  async getPage(pageNum: number): Promise<MuPDFPageProxy> {
    // 1-based index 转换为 0-based
    const page = this.doc.loadPage(pageNum - 1)
    return new MuPDFPageProxy(page)
  }

  destroy(): void {
    this.doc.destroy()
  }
}
```

### 页面代理类

`MuPDFPageProxy` 类封装了页面操作：

```typescript
export class MuPDFPageProxy {
  private page: mupdf.Page

  getViewport(params: { scale: number }) {
    const bounds = this.page.getBounds()
    const width = bounds[2] - bounds[0]
    const height = bounds[3] - bounds[1]
    
    return {
      width: width * params.scale,
      height: height * params.scale,
      scale: params.scale
    }
  }

  render(renderContext: {
    canvasContext: CanvasRenderingContext2D
    viewport: { width: number; height: number; scale: number }
  }) {
    const bounds = this.page.getBounds()
    const pageWidth = bounds[2] - bounds[0]
    const pageHeight = bounds[3] - bounds[1]
    
    const scaleX = viewport.width / pageWidth
    const scaleY = viewport.height / pageHeight
    
    const matrix: mupdf.Matrix = [scaleX, 0, 0, scaleY, 0, 0]
    const pixmap = this.page.toPixmap(
      matrix,
      mupdf.ColorSpace.DeviceRGB,
      false
    )
    
    // 转换为 ImageData 并绘制到 Canvas
    // ...
    
    pixmap.destroy()
  }
}
```

### 注释管理

项目中的注释操作封装在 `PdfCoreService` 中：

```typescript
// 创建高亮注释
async createHighlightAnnotation(
  pageNum: number,
  quadPoints: mupdf.Quad[],
  color: mupdf.Color,
  opacity: number
): Promise<MuPDFAnnotationData> {
  const page = await this.pdfDoc!.getPage(pageNum)
  const pdfPage = page.getPDFPage()
  if (!pdfPage) {
    throw new Error('页面不是 PDF 格式')
  }

  const annot = pdfPage.createAnnotation("Highlight")
  annot.setQuadPoints(quadPoints)
  annot.setColor(color)
  annot.setOpacity(opacity)
  annot.update()

  return {
    id: annot.getObject().asIndirect().toString(), // 使用对象引用作为 ID
    type: 'Highlight',
    pageNum,
    rect: annot.getRect(),
    color: annot.getColor(),
    opacity: annot.getOpacity(),
    borderWidth: annot.getBorderWidth(),
    quadPoints
  }
}
```

### 高DPI支持

项目中实现了高DPI设备的自动适配：

```typescript
async renderPage(pageNum: number, canvas: HTMLCanvasElement, scale: number = 1.0) {
  const page = await this.pdfDoc!.getPage(pageNum)
  const dpr = window.devicePixelRatio || 1
  const viewport = page.getViewport({ scale })

  const context = canvas.getContext('2d')!
  
  // 设置实际分辨率（高DPI）
  canvas.width = viewport.width * dpr
  canvas.height = viewport.height * dpr
  
  // 设置显示尺寸（CSS像素）
  canvas.style.width = `${viewport.width}px`
  canvas.style.height = `${viewport.height}px`
  
  // 缩放上下文
  context.scale(dpr, dpr)
  
  // 渲染
  await page.render({ canvasContext: context, viewport }).promise
}
```

---

## 常见问题

### 1. ArrayBuffer 被转移问题

MuPDF 可能会转移 ArrayBuffer 的所有权，导致后续访问失败。解决方案：

```typescript
// 创建 ArrayBuffer 的独立副本
const originalPdfBytes = arrayBuffer.slice(0)
// 或
const uint8Array = new Uint8Array(arrayBuffer)
const copiedUint8Array = new Uint8Array(uint8Array.length)
copiedUint8Array.set(uint8Array)
const originalPdfBytes = copiedUint8Array.buffer
```

### 2. SharedArrayBuffer 类型问题

保存 PDF 时可能返回 SharedArrayBuffer，需要转换为普通 ArrayBuffer：

```typescript
const buffer = pdfDoc.saveToBuffer("incremental")
const uint8Array = buffer.asUint8Array()
const newBuffer = new ArrayBuffer(uint8Array.length)
new Uint8Array(newBuffer).set(uint8Array)
```

### 3. 内存泄漏

确保及时销毁不再使用的对象：

```typescript
const pixmap = page.toPixmap(...)
// 使用 pixmap...
pixmap.destroy()  // 必须销毁
```

### 4. 页面索引

MuPDF 使用 0-based 索引，但项目中通常使用 1-based：

```typescript
// MuPDF: 0-based
const page = document.loadPage(0)  // 第 1 页

// 项目封装: 1-based
const page = await doc.getPage(1)  // 第 1 页
```

---

## 参考资源

### 官方文档

- [MuPDF.js 官方文档](https://mupdfjs.readthedocs.io/)
- [文件操作指南](https://mupdfjs.readthedocs.io/en/latest/how-to-guide/files.html)
- [文档操作指南](https://mupdfjs.readthedocs.io/en/latest/how-to-guide/document.html)
- [页面操作指南](https://mupdfjs.readthedocs.io/en/latest/how-to-guide/page.html)
- [注释入门指南](https://mupdfjs.readthedocs.io/en/latest/how-to-guide/annotations/getting-started/index.html)
- [文本注释指南](https://mupdfjs.readthedocs.io/en/latest/how-to-guide/annotations/text/index.html)
- [链接注释指南](https://mupdfjs.readthedocs.io/en/latest/how-to-guide/annotations/links/index.html)
- [绘图和形状注释指南](https://mupdfjs.readthedocs.io/en/latest/how-to-guide/annotations/drawing-and-shapes/index.html)
- [图章注释指南](https://mupdfjs.readthedocs.io/en/latest/how-to-guide/annotations/stamps/index.html)
- [文件附件注释指南](https://mupdfjs.readthedocs.io/en/latest/how-to-guide/annotations/embedding-files/index.html)
- [资源销毁指南](https://mupdfjs.readthedocs.io/en/latest/how-to-guide/destroy.html)

### 其他资源

- [MuPDF.js NPM 包](https://www.npmjs.com/package/mupdf)
- [项目中的 PdfCoreService 实现](../../src/services/pdf/core/PdfCoreService.ts)

---

**文档版本**: 3.0  
**最后更新**: 2025-01-XX  
**维护者**: 项目团队

---

## 更新日志

### 版本 3.0 (2025-01-XX)
- ✅ 新增类型定义章节，包含所有基础类型和枚举类型：
  - Matrix（变换矩阵）
  - Rect（矩形）
  - Quad（四边形）
  - Point（点）
  - Color（颜色）
  - Rotate（旋转角度）
  - ColorSpaceType、PageBox、PDFAnnotationType、LinkDestType、BlendMode、LineCap、LineJoin、SelectMode 等枚举类型
- ✅ 新增核心类和方法章节，详细补充了以下类的完整 API：
  - Buffer 类：二进制数据处理（创建、读写、转换、切片等）
  - ColorSpace 类：颜色空间管理（预定义颜色空间、自定义颜色空间、类型检查等）
  - Font 类：字体处理（创建、编码、字形操作、CJK 支持等）
  - Image 类：图像处理（加载、尺寸、分辨率、颜色空间、遮罩等）
  - Path 类：路径操作（创建、移动、绘制、变换、遍历等）
  - Text 类：文本和字形处理（显示字形、字符串、边界、遍历等）
  - DisplayList 类：渲染指令列表（创建、渲染、文本提取、搜索等）
  - Pixmap 类：像素图像数据（创建、尺寸、像素操作、格式转换、图像处理等）
  - StrokeState 类：描边状态（线宽、线帽、线连接、虚线模式等）
  - Device 类：自定义渲染设备（DrawDevice、DisplayListDevice、自定义设备等）
  - PDFObject 类：PDF 对象操作（类型检查、转换、读写、数组/字典操作等）
  - PDFAnnotation 类：补充高级方法（语言、标志位、外观、几何操作、边框效果等）
  - PDFWidget 类：表单控件处理（字段类型、文本字段、选择字段、按钮操作等）
  - DocumentWriter 类：文档创建（页面创建、写入、关闭等）
  - OutlineIterator 类：大纲遍历（导航、编辑、插入、删除等）
  - StructuredText 类：结构化文本处理（转换、遍历、选择、搜索、高亮等）
  - Link 类：链接处理（边界、URI、外部链接检查等）
  - Stream 类：流式数据源（自定义流接口）
- ✅ 新增 PDFDocument 高级操作章节：
  - 文档版本和语言管理
  - 页面标签管理
  - 页面重排
  - JavaScript 支持
  - 文档历史管理（版本、未保存更改、验证等）
  - 操作历史（撤销/重做、操作记录等）
  - 图层管理
  - 表单重置
  - 字体子集化
  - 文档修复状态
  - PDF 对象操作（创建、添加、删除、查找等）
  - 字体和图像管理
  - 页面操作（添加、插入、删除、复制等）
  - 名称树操作
- ✅ 新增 PDFPage 高级操作章节：
  - 页面框操作（MediaBox、CropBox、BleedBox、TrimBox、ArtBox）
  - 页面渲染选项（usage、box 参数等）
  - 页面内容操作（runPageContents、runPageAnnots、runPageWidgets 等）
  - 页面注释和控件管理
  - 页面涂黑（Redaction）操作
- ✅ 新增全局函数说明：
  - ICC 颜色管理（enableICC、disableICC）
  - CSS 设置（setUserCSS）
  - 字体加载函数（installLoadFontFunction）
  - 内存调试（memento.listBlocks、memento.checkAllMemory）
- ✅ 完善了所有类型定义的说明和示例代码
- ✅ 所有方法都提供了详细的代码示例和使用说明

