# Vue拍照搜题业务流程 - 简要说明

## 业务流程概览

```
启动拍照 → 调用Bridge拍照 → 获取base64图片 → Canvas裁剪 → 识别题目 → 显示结果 → 添加到列表 → 刷新列表 → 返回习题页面
```

---

## 详细步骤

### 1️⃣ **启动拍照搜题**
- **入口**：`ExerciseSolveView.vue` 点击拍照按钮
- **方式**：使用Vue Router导航到 `PhotoSearchView` 页面
- **参数**：通过query参数传递科目类型（math/biology）
- **特点**：在WebView中作为单页应用的一个路由页面

### 2️⃣ **拍照/选择图片**
- **技术**：通过 `androidBridge.captureImageFromCamera()` 调用原生相机
- **操作**：用户点击拍照按钮或相册按钮
- **返回**：base64编码的图片数据（DataURL格式）
- **转换**：将base64转换为File对象供后续使用
- **特点**：❌ **无实时预览**，只有拍照后的结果

### 3️⃣ **图片裁剪**
- **技术**：使用HTML5 Canvas实现裁剪
- **操作**：用户通过鼠标/触摸调整裁剪区域
- **实现**：手动绘制裁剪矩形，从Canvas提取裁剪后的图片
- **结果**：获取裁剪后的File对象
- **特点**：完全在前端实现，不依赖原生组件

### 4️⃣ **图片识别**
- **科目判断**：
  - ⚠️ **科目不是从图片识别出来的**，而是用户在进入拍照页面之前就已经选择了
  - Vue端：从路由query参数获取（`route.query.subject`），默认是'math'
  - 安卓端：从Intent的extra获取（`KEY_PARAM_SUBJECT`）
  - 科目用于选择不同的API端点：
    - 数学：`/permission/imgMath`
    - 生物：`/permission/img`
- **API调用**：根据科目选择对应的识别接口
- **数据格式**：
  - ⚠️ **接口不接收Bitmap对象**
  - 接收的是**multipart/form-data格式**的HTTP请求
  - 字段名：`imgFile`
  - 内容：图片的二进制数据（JPEG格式）
  - Vue端：File对象 → FormData → multipart/form-data
  - 安卓端：Bitmap → 压缩为JPEG字节流 → multipart/form-data
- **网络请求**：使用统一的httpClient发送multipart/form-data
- **结果**：
  - ✅ 成功：显示识别到的题目内容（title/question字段）
  - ❌ 失败：提示"未识别到题目"，可跳转文本搜索降级

### 5️⃣ **添加到列表**
- **操作**：用户确认添加题目
- **API调用**：调用 `apiService.addQuestionToList()` 接口
- **数据准备**：包含题目ID和当前列表所有题目ID（exercisesId）
- **状态管理**：使用 `questionStore` 管理题目列表

### 6️⃣ **刷新列表并返回**
- **操作**：添加成功后刷新题目列表
- **刷新方式**：调用 `questionStore.fetchQuestions()` 重新获取列表
- **跳转**：使用Vue Router跳转回 `exerciseSolve` 页面
- **结果**：在WebView中显示更新后的题目列表

---

## 关键技术点

| 环节 | 技术实现 |
|------|---------|
| **路由导航** | Vue Router（单页应用） |
| **科目判断** | 从路由query参数获取（`route.query.subject`），**不是从图片识别** |
| **相机功能** | androidBridge调用原生接口（无预览） |
| **图片格式** | base64 → File对象转换 |
| **图片裁剪** | HTML5 Canvas + 手动绘制裁剪区域 |
| **接口格式** | multipart/form-data，字段名`imgFile`，**不接收Bitmap对象** |
| **网络请求** | httpClient + FormData |
| **状态管理** | Pinia Store（questionStore） |
| **UI交互** | Vue组件 + Web端UI |

---

## 数据流向

```
用户操作
  ↓
Vue Router导航
  ↓
androidBridge拍照 → base64 DataURL
  ↓
base64ToFile转换 → File对象
  ↓
Canvas裁剪 → File对象（裁剪后）
  ↓
API识别 → Question对象
  ↓
显示结果 → 用户确认
  ↓
API添加到列表
  ↓
questionStore刷新列表
  ↓
Router跳转 → 显示题目列表
```

---

## 与安卓原生实现的主要区别

| 对比项 | Vue实现 | 安卓原生 |
|--------|---------|---------|
| **启动方式** | WebView路由 | 独立Activity |
| **相机预览** | ❌ 无预览 | ✅ 实时预览 |
| **图片格式** | base64 → File | File → Bitmap |
| **裁剪组件** | Canvas裁剪 | 原生CropImageView |
| **性能开销** | 需要格式转换 | 原生性能最优 |
| **UI风格** | 统一Web UI | 原生Android UI |
| **代码复用** | 与Web端共享代码 | 独立原生代码 |

---

## 核心优势与劣势

### ✅ 优势
- **统一UI风格**：与整个Web应用保持一致的设计风格
- **代码复用**：与Web端共享业务逻辑和API调用代码
- **维护成本低**：只需维护一套Vue代码
- **降级方案**：识别失败时支持文本搜索

### ❌ 劣势
- **无实时预览**：拍照前无法预览，体验较差
- **性能开销**：base64转换和Canvas操作有性能损耗
- **依赖WebView**：需要WebView环境支持

---

## 适用场景

**Vue实现适合**：
- ✅ 需要统一Web端和移动端UI风格
- ✅ 希望降低维护成本（一套代码）
- ✅ 对性能要求不是特别严格
- ✅ 需要灵活的降级方案

**不适合**：
- ❌ 需要最佳拍照体验（实时预览）
- ❌ 对性能要求极高
- ❌ 需要完全原生体验

---

## 重要说明

### 📌 科目判断机制
**科目不是从图片识别出来的**，而是用户在进入拍照页面之前就已经选择了：
- 用户在习题解答页面选择科目（数学/生物）
- 点击拍照按钮时，通过路由query参数传递科目：`/photo-search?subject=math` 或 `?subject=biology`
- 拍照识别时，根据这个科目参数选择对应的API端点：
  - 数学：`/permission/imgMath`
  - 生物：`/permission/img`

### 📌 接口数据格式
**接口不直接接收Bitmap对象**，而是接收HTTP multipart/form-data格式：
- 字段名：`imgFile`
- 内容：图片的二进制数据（JPEG格式）
- Vue端流程：File对象 → FormData → multipart/form-data HTTP请求
- 安卓端流程：Bitmap → 压缩为JPEG字节流 → multipart/form-data HTTP请求

---

## 总结

Vue实现的核心特点：
- 🔄 **Web端统一**：与Web端共享代码和UI
- 📱 **Bridge通信**：通过androidBridge调用原生功能
- 🎨 **Canvas裁剪**：前端实现图片裁剪功能
- 🔁 **状态管理**：使用Pinia管理题目列表状态
- 🔙 **路由跳转**：使用Vue Router进行页面导航
- 📚 **科目选择**：通过路由参数传递，不是从图片识别

**核心流程**：Router导航（携带科目） → Bridge拍照 → base64转换 → Canvas裁剪 → API识别（根据科目选择接口） → Store刷新 → Router返回
