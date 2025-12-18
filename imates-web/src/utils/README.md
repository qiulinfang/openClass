# Utils 工具函数目录分类说明

## 📁 目录结构

```
utils/
├── 📂 thumbnail/               # 缩略图生成 (Thumbnail Generation)
│   ├── html-thumbnail.ts       # HTML文件缩略图生成
│   ├── image-thumbnail.ts      # 图片文件缩略图生成
│   ├── pdf-thumbnail.ts        # PDF文件缩略图生成
│   ├── video-thumbnail.ts      # 视频文件缩略图生成
│   └── thumbnail-queue.ts      # 缩略图生成队列管理
│
├── 📂 math/                    # 数学公式渲染 (Math Rendering)
│   ├── mathjax.ts              # MathJax数学公式渲染工具
│   └── index.ts                # MathJax工具导出
│
├── 📂 render/                  # 消息渲染 (Message Rendering)
│   └── lazy-message-renderer.ts  # 懒加载消息渲染器
│
├── 📂 user/                    # 用户相关 (User Utilities)
│   └── userId.ts               # 用户ID获取工具
│
├── 📂 storage/                 # 数据管理 (Data Management)
│   └── favorites.ts            # 收藏功能工具（localStorage）
│
├── 📂 business/                # 业务逻辑 (Business Logic)
│   └── chapter-utils.ts        # 章节相关工具（中文数字转换、排序等）
│
├── 📂 logging/                 # 日志调试 (Logging & Debugging)
│   └── photoSearchLogger.ts    # 拍照搜题流程日志工具
│
├── 📂 common/                  # 通用工具 (Common Utilities)
│   ├── throttle.ts             # 节流和防抖工具函数
│   └── polyfills.ts            # 浏览器兼容性补丁
│
├── index.ts                    # 统一导出文件
└── README.md                   # 本说明文档
```

---

## 📋 详细分类说明

### 1. 缩略图生成 (Thumbnail Generation)

**用途**：为不同类型的文件生成缩略图，用于在学习资源列表中显示文件预览。

| 文件 | 功能 | 支持格式 |
|------|------|----------|
| `thumbnail/html-thumbnail.ts` | HTML文件缩略图生成 | `.html`, `.htm` |
| `thumbnail/image-thumbnail.ts` | 图片文件缩略图生成 | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`, `.svg` |
| `thumbnail/pdf-thumbnail.ts` | PDF文件缩略图生成 | `.pdf` |
| `thumbnail/video-thumbnail.ts` | 视频文件缩略图生成 | `.mp4`, `.webm`, `.ogg`, `.avi`, `.mov`, `.wmv`, `.flv`, `.mkv`, `.m4v` |
| `thumbnail/thumbnail-queue.ts` | 缩略图生成队列管理 | 统一管理所有类型的缩略图生成任务 |

**特点**：
- 异步生成，不阻塞UI
- 队列管理，控制并发数量
- 持久化存储，避免重复生成
- 支持任务恢复

---

### 2. 数学公式渲染 (Math Rendering)

**用途**：处理数学公式的渲染，支持 LaTeX 语法。

**文件**：
- `math/mathjax.ts` - MathJax 数学公式渲染工具类
  - 等待 MathJax 加载完成
  - 批量渲染优化
  - 懒加载支持
  - 性能优化（队列处理、防抖节流）

**特点**：
- 支持 LaTeX 数学公式
- 性能优化（批量渲染、懒加载）
- 自动处理 MathJax 加载状态

---

### 3. 消息渲染 (Message Rendering)

**用途**：优化聊天消息的渲染性能。

**文件**：
- `render/lazy-message-renderer.ts` - 懒加载消息渲染器
  - 使用 Intersection Observer 实现懒加载
  - 批量处理渲染任务
  - 避免重复渲染

**特点**：
- 按需渲染，提升性能
- 自动检测元素可见性
- 批量处理优化

---

### 4. 用户相关 (User Utilities)

**用途**：处理用户身份和权限相关功能。

**文件**：
- `services/business/auth-service.ts` - 用户认证信息存储服务（统一由 `services/index.ts` 导出）
  - `getUserId()` - 获取当前用户ID
  - `getCurrentUserIdOrDefault()` - 获取用户ID或默认值
  - 支持学班管理员和研伴学生两种登录方式

**特点**：
- 统一用户ID获取逻辑
- 支持多角色登录

---

### 5. 数据管理 (Data Management)

**用途**：处理本地数据存储和管理。

**文件**：
- `storage/favorites.ts` - 收藏功能工具
  - 收藏问答记录
  - 收藏题目
  - 使用 localStorage 存储
  - 支持用户隔离（基于用户ID）

**特点**：
- 持久化存储
- 用户数据隔离
- 类型安全

---

### 6. 业务逻辑 (Business Logic)

**用途**：处理特定业务场景的工具函数。

**文件**：
- `business/chapter-utils.ts` - 章节相关工具
  - `convertChineseNumberToArabic()` - 中文数字转阿拉伯数字
  - `convertToChineseNumber()` - 阿拉伯数字转中文数字
  - `extractChapterNumberFromName()` - 从章节名提取数字
  - `parseChapterOrderFromFileName()` - 从文件名解析章节顺序
  - `sortChaptersByNumber()` - 按数字排序章节

**特点**：
- 处理中文数字转换
- 章节排序和解析
- 支持多种章节命名格式

---

### 7. 日志调试 (Logging & Debugging)

**用途**：记录和调试应用运行状态。

**文件**：
- `logging/photoSearchLogger.ts` - 拍照搜题流程日志工具
  - 记录拍照搜题的完整流程
  - 支持日志导出
  - 便于问题排查

**特点**：
- 结构化日志记录
- 自动时间戳
- 支持日志导出

---

### 8. 通用工具 (Common Utilities)

**用途**：提供通用的工具函数，可在多个场景使用。

**文件**：
- `common/throttle.ts` - 节流和防抖工具
  - `throttle()` - 节流函数
  - `debounce()` - 防抖函数
  - `ThrottleUtils` - 节流工具类（快速/标准/慢速/极慢）
  - `DebounceUtils` - 防抖工具类（快速/标准/慢速/极慢）

- `common/polyfills.ts` - 浏览器兼容性补丁
  - 提供浏览器API的兼容性实现

**特点**：
- 性能优化（防止频繁调用）
- 可配置的延迟时间
- 浏览器兼容性支持


### 9. 统一导出 (Index)

**文件**：
- `index.ts` - 统一导出文件
  - 导出所有工具函数
  - 提供统一的导入入口
  - 包含消息提示函数 `showMessage()`

**使用方式**：
```typescript
// 从统一入口导入（推荐）
import { showMessage, MathJaxUtils, throttle } from '@/utils'
import { getCurrentUserIdOrDefault } from '@/utils'
import { thumbnailQueue } from '@/utils'

// 或从具体文件导入
import { isPdfFile } from '@/utils/thumbnail/pdf-thumbnail'
import { getCurrentUserIdOrDefault } from '@/services'
import { toggleQaFavorite } from '@/utils/storage/favorites'
```

---

## 🔄 文件依赖关系

```
index.ts
  ├── math/mathjax.ts
  ├── logging/photoSearchLogger.ts
  ├── common/throttle.ts
  ├── business/chapter-utils.ts
  ├── user/userId.ts
  ├── storage/favorites.ts
  └── thumbnail/*.ts

thumbnail/thumbnail-queue.ts
  ├── html-thumbnail.ts
  ├── image-thumbnail.ts
  ├── pdf-thumbnail.ts
  └── video-thumbnail.ts

storage/favorites.ts
  └── user/userId.ts

render/lazy-message-renderer.ts
  └── math/mathjax.ts
```

---

## 📝 使用建议

1. **缩略图生成**：优先使用 `thumbnail/thumbnail-queue.ts` 统一管理，而不是直接调用各个缩略图生成函数
2. **数学公式**：使用 `MathJaxUtils` 类，它会自动处理 MathJax 的加载状态
3. **节流防抖**：使用 `ThrottleUtils` 和 `DebounceUtils` 提供的预设配置
4. **用户ID**：始终使用 `getCurrentUserIdOrDefault()` 确保有返回值
5. **统一导入**：优先从 `index.ts` 导入，保持代码一致性

---

## 🎯 未来优化方向

1. **缩略图生成**：考虑使用 Web Worker 在后台线程生成缩略图
2. **数学公式渲染**：考虑支持更多数学公式渲染引擎（如 KaTeX）
3. **日志系统**：扩展为通用的日志工具，支持多种日志级别和输出方式
4. **配置管理**：考虑使用环境变量和配置文件分离

