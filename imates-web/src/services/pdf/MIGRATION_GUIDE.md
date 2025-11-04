# PDF阅读页面迁移到React指南

## 概述

本指南提供了一个完整的方案，用于将PDF阅读页面从Vue迁移到React，同时保持业务逻辑的复用和代码的可维护性。

## 架构设计

### 核心原则

1. **业务逻辑与框架分离**
   - 所有PDF相关的业务逻辑都在`core`目录下
   - 不依赖Vue或React的任何特性
   - 可以独立测试和复用

2. **适配器模式**
   - 通过适配器接口抽象状态管理
   - Vue使用Pinia实现，React使用Zustand/Redux实现
   - 保持相同的业务逻辑API

3. **类型安全**
   - 所有类型定义在`types`目录下
   - 框架无关，可以在Vue和React中共享
   - 使用TypeScript确保类型一致性

### 目录结构

```
src/services/pdf/
├── core/                          # 核心业务逻辑（框架无关）
│   ├── PdfCoreService.ts         # PDF加载和渲染服务
│   ├── FabricCanvasService.ts    # Fabric.js标注服务
│   └── PdfPageService.ts         # 页面管理服务
├── adapters/                      # 适配器层
│   ├── PdfStateAdapter.ts        # 状态管理适配器接口
│   ├── vue/
│   │   └── PdfStateAdapterVue.ts # Vue实现（使用Pinia）
│   └── react/
│       └── PdfStateAdapterReact.ts # React实现（使用Zustand/Redux）
├── types/                         # 类型定义（框架无关）
│   └── pdf-types.ts
├── examples/                      # 使用示例
│   └── ReactExample.md
├── README.md                      # 架构说明
└── MIGRATION_GUIDE.md            # 本文件
```

## 迁移方案

### 方案1：核心服务类 + 适配器模式（推荐）

**优点：**
- 业务逻辑完全复用
- 类型安全
- 易于测试
- 渐进式迁移

**实现步骤：**

1. **创建核心服务类**
   - ✅ `PdfCoreService` - PDF加载和渲染
   - ✅ `FabricCanvasService` - Fabric.js操作
   - ✅ `PdfPageService` - 页面管理

2. **创建适配器接口**
   - ✅ `IPdfStateAdapter` - 状态管理接口
   - ✅ `PdfStateAdapterVue` - Vue实现
   - ✅ `PdfStateAdapterReact` - React实现

3. **重构现有代码**
   - 将Vue组件中的业务逻辑抽取到服务类
   - 使用适配器管理状态
   - 保持组件只负责UI渲染

4. **创建React版本**
   - 使用相同的服务类
   - 实现React适配器
   - 创建React组件

### 方案2：直接迁移（不推荐）

**缺点：**
- 业务逻辑需要重写
- 容易出现功能不一致
- 维护成本高

## 核心服务类使用

### PdfCoreService

```typescript
import { PdfCoreService } from '@/services/pdf/core/PdfCoreService'

const service = new PdfCoreService()

// 加载PDF
const result = await service.loadPdf(file)

// 计算页面布局
const layouts = await service.calculatePageLayouts(1.0)

// 渲染页面
await service.renderPage(1, canvasElement, 1.0)
```

### FabricCanvasService

```typescript
import { FabricCanvasService } from '@/services/pdf/core/FabricCanvasService'

const service = new FabricCanvasService(config)

// 初始化
await service.initialize(canvasElement, width, height)

// 设置工具
service.setToolMode('pen')

// 加载注释
service.loadAnnotations(annotations)

// 获取注释
const annotations = service.getAnnotations()
```

### PdfPageService

```typescript
import { PdfPageService } from '@/services/pdf/core/PdfPageService'

const service = new PdfPageService(
  pdfCoreService,
  pageLayout,
  drawingConfig
)

// 初始化
await service.initialize(pdfCanvas, fabricCanvas, callbacks)

// 更新工具
service.updateToolMode('pen')

// 捕获截图
const blob = await service.captureScreenshot(x, y, width, height)
```

## 状态管理适配器

### Vue实现（使用Pinia）

```typescript
import { PdfStateAdapterVue } from '@/services/pdf/adapters/vue/PdfStateAdapterVue'

const adapter = new PdfStateAdapterVue()

// 获取状态
const state = adapter.getState()

// 更新状态
adapter.setPdfLoaded(result)

// 订阅变化
const unsubscribe = adapter.subscribe((state) => {
  console.log('状态更新', state)
})
```

### React实现（使用Zustand）

```typescript
import { PdfStateAdapterReact } from '@/services/pdf/adapters/react/PdfStateAdapterReact'

const adapter = new PdfStateAdapterReact()

// 获取状态
const state = adapter.getState()

// 更新状态
adapter.setPdfLoaded(result)

// 订阅变化
const unsubscribe = adapter.subscribe((state) => {
  console.log('状态更新', state)
})
```

## 迁移步骤

### 阶段1：准备阶段（当前）

1. ✅ 创建核心服务类
2. ✅ 创建类型定义
3. ✅ 创建适配器接口
4. ⏳ 重构现有Vue代码使用服务类
5. ⏳ 编写单元测试

### 阶段2：实现React适配器

1. 选择状态管理库（推荐Zustand）
2. 实现`PdfStateAdapterReact`
3. 创建React Hook
4. 编写单元测试

### 阶段3：迁移组件

1. 创建React版本的`PdfViewer`组件
2. 创建React版本的`PdfPage`组件
3. 创建React版本的工具栏组件
4. 测试功能一致性

### 阶段4：优化和测试

1. 性能优化
2. 集成测试
3. 用户体验测试
4. 文档更新

## 注意事项

### 1. 事件处理差异

**Vue：**
```vue
<canvas @touchstart="handleTouchStart" />
```

**React：**
```tsx
<canvas onTouchStart={handleTouchStart} />
```

### 2. 生命周期差异

**Vue：**
```typescript
onMounted(() => {
  // 初始化
})
```

**React：**
```typescript
useEffect(() => {
  // 初始化
  return () => {
    // 清理
  }
}, [])
```

### 3. 响应式系统差异

**Vue：** 使用响应式系统自动更新
**React：** 需要手动调用setState或使用状态管理库

### 4. Canvas操作

Canvas的DOM操作在两个框架中基本相同，可以直接复用。

### 5. 类型定义

所有类型定义在`types`目录下，框架无关，可以直接共享。

## 最佳实践

### 1. 服务类设计

- 保持服务类纯函数化
- 避免依赖框架特性
- 使用依赖注入
- 提供清理方法

### 2. 适配器设计

- 保持接口简单
- 提供订阅机制
- 支持状态快照
- 提供错误处理

### 3. 组件设计

- 组件只负责UI渲染
- 业务逻辑在服务类中
- 使用适配器管理状态
- 保持组件可测试

## 测试策略

### 1. 单元测试

- 测试核心服务类
- 测试适配器实现
- 测试工具函数

### 2. 集成测试

- 测试Vue组件
- 测试React组件
- 测试功能一致性

### 3. E2E测试

- 测试完整流程
- 测试用户交互
- 测试性能

## 性能考虑

### 1. 虚拟滚动

- 使用虚拟滚动优化长文档
- 只渲染可见页面
- 延迟加载非可见页面

### 2. 内存管理

- 及时清理不需要的资源
- 使用对象池复用Canvas
- 避免内存泄漏

### 3. 渲染优化

- 使用Web Worker处理PDF
- 使用requestAnimationFrame优化渲染
- 避免不必要的重绘

## 总结

通过使用核心服务类 + 适配器模式，可以：

1. **完全复用业务逻辑** - 不需要重写
2. **保持类型安全** - 共享类型定义
3. **易于测试** - 服务类可以独立测试
4. **渐进式迁移** - 可以逐步迁移
5. **维护成本低** - 业务逻辑集中管理

这种方案既保证了代码的可维护性，又为未来的迁移提供了便利。

