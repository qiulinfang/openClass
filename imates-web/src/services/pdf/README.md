# PDF服务架构 - 便于迁移到React

## 架构设计

本架构采用**分层设计**和**适配器模式**，将业务逻辑与框架解耦，便于从Vue迁移到React。

### 核心原则

1. **业务逻辑与框架分离**：所有PDF相关业务逻辑都在`core`目录下，不依赖Vue或React
2. **状态管理抽象**：通过适配器模式抽象状态管理，支持不同框架的实现
3. **类型定义共享**：所有类型定义在`types`目录下，框架无关
4. **服务化设计**：将功能拆分为独立的服务类，便于测试和复用

## 目录结构

```
services/pdf/
├── core/                    # 核心业务逻辑（框架无关）
│   ├── PdfCoreService.ts    # PDF加载和渲染服务
│   ├── FabricCanvasService.ts # Fabric.js标注服务
│   └── PdfPageService.ts    # 页面管理服务
├── adapters/                # 适配器层
│   ├── PdfStateAdapter.ts   # 状态管理适配器接口
│   ├── vue/                 # Vue实现
│   │   └── PdfStateAdapterVue.ts
│   └── react/               # React实现（待实现）
│       └── PdfStateAdapterReact.ts
└── types/                   # 类型定义（框架无关）
    └── pdf-types.ts
```

## 使用示例

### Vue中使用

```typescript
// 在Vue组件中使用
import { PdfCoreService } from '@/services/pdf/core/PdfCoreService'
import { PdfPageService } from '@/services/pdf/core/PdfPageService'
import { PdfStateAdapterVue } from '@/services/pdf/adapters/vue/PdfStateAdapterVue'

export default {
  setup() {
    const pdfCoreService = new PdfCoreService()
    const stateAdapter = new PdfStateAdapterVue()
    
    // 加载PDF
    const loadPdf = async (file: File) => {
      const result = await pdfCoreService.loadPdf(file)
      const layouts = await pdfCoreService.calculatePageLayouts()
      
      stateAdapter.setPdfLoaded({
        ...result,
        pageLayouts: layouts
      })
    }
    
    return { loadPdf }
  }
}
```

### React中使用（迁移后）

```typescript
// 在React组件中使用
import { PdfCoreService } from '@/services/pdf/core/PdfCoreService'
import { PdfPageService } from '@/services/pdf/core/PdfPageService'
import { PdfStateAdapterReact } from '@/services/pdf/adapters/react/PdfStateAdapterReact'

function PdfViewer() {
  const pdfCoreService = new PdfCoreService()
  const stateAdapter = new PdfStateAdapterReact()
  
  const loadPdf = async (file: File) => {
    const result = await pdfCoreService.loadPdf(file)
    const layouts = await pdfCoreService.calculatePageLayouts()
    
    stateAdapter.setPdfLoaded({
      ...result,
      pageLayouts: layouts
    })
  }
  
  return <div>...</div>
}
```

## 迁移步骤

### 1. 重构现有代码

- [x] 创建核心服务类（PdfCoreService, FabricCanvasService, PdfPageService）
- [x] 创建类型定义文件
- [x] 创建适配器接口和Vue实现
- [ ] 重构现有Store使用适配器
- [ ] 重构组件使用服务类

### 2. 实现React适配器

- [ ] 创建React版本的状态管理（使用Redux/Zustand）
- [ ] 实现PdfStateAdapterReact
- [ ] 创建React版本的Hook

### 3. 迁移组件

- [ ] 将Vue组件逻辑抽取为服务类调用
- [ ] 创建React版本的组件
- [ ] 保持相同的业务逻辑和API

## 优势

1. **业务逻辑复用**：核心服务类可以在Vue和React中直接使用
2. **类型安全**：所有类型定义共享，确保类型一致性
3. **测试友好**：服务类可以独立测试，不依赖框架
4. **渐进式迁移**：可以逐步迁移，不需要一次性重写所有代码
5. **维护成本低**：业务逻辑集中管理，修改一处即可

## 注意事项

1. **事件处理**：Vue和React的事件处理方式不同，需要分别实现
2. **生命周期**：Vue的`onMounted`对应React的`useEffect`
3. **响应式系统**：Vue的响应式系统与React的状态更新机制不同，通过适配器层统一
4. **Canvas操作**：Canvas的DOM操作在两个框架中基本相同，可以直接复用

