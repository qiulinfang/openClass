# React迁移示例

## 使用核心服务类

### 1. 创建PDF Viewer组件

```tsx
import React, { useEffect, useRef, useState } from 'react'
import { PdfCoreService } from '@/services/pdf/core/PdfCoreService'
import { PdfPageService } from '@/services/pdf/core/PdfPageService'
import { PdfStateAdapterReact } from '@/services/pdf/adapters/react/PdfStateAdapterReact'
import type { PdfState, PageLayout } from '@/services/pdf/types/pdf-types'

interface PdfViewerProps {
  file: File
}

export function PdfViewer({ file }: PdfViewerProps) {
  const [state, setState] = useState<PdfState | null>(null)
  const pdfCoreServiceRef = useRef<PdfCoreService | null>(null)
  const stateAdapterRef = useRef<PdfStateAdapterReact | null>(null)
  const pageServicesRef = useRef<Map<number, PdfPageService>>(new Map())

  useEffect(() => {
    // 初始化服务
    pdfCoreServiceRef.current = new PdfCoreService()
    stateAdapterRef.current = new PdfStateAdapterReact()

    // 订阅状态变化
    const unsubscribe = stateAdapterRef.current.subscribe((newState) => {
      setState(newState)
    })

    return () => {
      unsubscribe()
      pdfCoreServiceRef.current?.dispose()
      pageServicesRef.current.forEach((service) => service.dispose())
    }
  }, [])

  useEffect(() => {
    const loadPdf = async () => {
      if (!pdfCoreServiceRef.current || !stateAdapterRef.current) return

      try {
        stateAdapterRef.current.setLoading(true)
        stateAdapterRef.current.setError(null)

        // 加载PDF
        const result = await pdfCoreServiceRef.current.loadPdf(file)
        
        // 计算页面布局
        const layouts = await pdfCoreServiceRef.current.calculatePageLayouts()

        // 更新状态
        stateAdapterRef.current.setPdfLoaded({
          ...result,
          pageLayouts: layouts,
        })
      } catch (error) {
        stateAdapterRef.current.setError(
          error instanceof Error ? error.message : 'PDF加载失败'
        )
      } finally {
        stateAdapterRef.current.setLoading(false)
      }
    }

    loadPdf()
  }, [file])

  if (!state) {
    return <div>初始化中...</div>
  }

  if (state.isLoading) {
    return <div>加载中...</div>
  }

  if (state.error) {
    return <div>错误: {state.error}</div>
  }

  return (
    <div className="pdf-viewer">
      {state.pageLayouts.map((layout) => (
        <PdfPageComponent
          key={layout.pageNum}
          layout={layout}
          pdfCoreService={pdfCoreServiceRef.current!}
          stateAdapter={stateAdapterRef.current!}
        />
      ))}
    </div>
  )
}

interface PdfPageComponentProps {
  layout: PageLayout
  pdfCoreService: PdfCoreService
  stateAdapter: PdfStateAdapterReact
}

function PdfPageComponent({
  layout,
  pdfCoreService,
  stateAdapter,
}: PdfPageComponentProps) {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<HTMLCanvasElement>(null)
  const pageServiceRef = useRef<PdfPageService | null>(null)

  useEffect(() => {
    if (!pdfCanvasRef.current || !fabricCanvasRef.current) return

    const config = stateAdapter.getDrawingConfig()
    pageServiceRef.current = new PdfPageService(
      pdfCoreService,
      layout,
      config
    )

    pageServiceRef.current.initialize(
      pdfCanvasRef.current,
      fabricCanvasRef.current,
      {
        onAnnotationChanged: (pageNum, annotations) => {
          stateAdapter.setAnnotations(pageNum, annotations)
        },
        onScreenshotCaptured: (blob) => {
          // 处理截图
          console.log('截图已捕获', blob)
        },
      }
    )

    return () => {
      pageServiceRef.current?.dispose()
    }
  }, [layout, pdfCoreService, stateAdapter])

  useEffect(() => {
    const tool = stateAdapter.getSelectedTool()
    pageServiceRef.current?.updateToolMode(tool)
  }, [stateAdapter.getSelectedTool()])

  useEffect(() => {
    const config = stateAdapter.getDrawingConfig()
    pageServiceRef.current?.updateDrawingConfig(config)
  }, [stateAdapter.getDrawingConfig()])

  return (
    <div
      style={{
        position: 'relative',
        width: `${layout.width}px`,
        height: `${layout.height}px`,
        margin: '0 auto 20px',
      }}
    >
      <canvas ref={pdfCanvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
      <canvas ref={fabricCanvasRef} style={{ position: 'absolute', top: 0, left: 0, zIndex: 2 }} />
    </div>
  )
}
```

### 2. 使用自定义Hook

```tsx
import { useState, useEffect, useRef } from 'react'
import { PdfCoreService } from '@/services/pdf/core/PdfCoreService'
import { PdfStateAdapterReact } from '@/services/pdf/adapters/react/PdfStateAdapterReact'
import type { PdfState } from '@/services/pdf/types/pdf-types'

export function usePdfViewer(file: File | null) {
  const [state, setState] = useState<PdfState | null>(null)
  const pdfCoreServiceRef = useRef<PdfCoreService | null>(null)
  const stateAdapterRef = useRef<PdfStateAdapterReact | null>(null)

  useEffect(() => {
    pdfCoreServiceRef.current = new PdfCoreService()
    stateAdapterRef.current = new PdfStateAdapterReact()

    const unsubscribe = stateAdapterRef.current.subscribe(setState)

    return () => {
      unsubscribe()
      pdfCoreServiceRef.current?.dispose()
    }
  }, [])

  useEffect(() => {
    if (!file || !pdfCoreServiceRef.current || !stateAdapterRef.current) return

    const loadPdf = async () => {
      try {
        stateAdapterRef.current!.setLoading(true)
        stateAdapterRef.current!.setError(null)

        const result = await pdfCoreServiceRef.current!.loadPdf(file)
        const layouts = await pdfCoreServiceRef.current!.calculatePageLayouts()

        stateAdapterRef.current!.setPdfLoaded({
          ...result,
          pageLayouts: layouts,
        })
      } catch (error) {
        stateAdapterRef.current!.setError(
          error instanceof Error ? error.message : 'PDF加载失败'
        )
      } finally {
        stateAdapterRef.current!.setLoading(false)
      }
    }

    loadPdf()
  }, [file])

  const setSelectedTool = (tool: string) => {
    stateAdapterRef.current?.setSelectedTool(tool as any)
  }

  const setDrawingConfig = (config: Partial<any>) => {
    stateAdapterRef.current?.setDrawingConfig(config)
  }

  return {
    state,
    setSelectedTool,
    setDrawingConfig,
  }
}

// 使用示例
function PdfViewerComponent() {
  const [file, setFile] = useState<File | null>(null)
  const { state, setSelectedTool, setDrawingConfig } = usePdfViewer(file)

  return (
    <div>
      <input
        type="file"
        accept=".pdf"
        onChange={(e) => {
          const selectedFile = e.target.files?.[0]
          if (selectedFile) setFile(selectedFile)
        }}
      />
      {state && (
        <div>
          <div>总页数: {state.totalPages}</div>
          <div>当前页: {state.currentPage}</div>
          <button onClick={() => setSelectedTool('pen')}>钢笔</button>
          <button onClick={() => setSelectedTool('highlighter')}>荧光笔</button>
        </div>
      )}
    </div>
  )
}
```

### 3. 使用Zustand Store（推荐）

```tsx
import { create } from 'zustand'
import { PdfCoreService } from '@/services/pdf/core/PdfCoreService'
import type { PdfState, PdfLoadResult, PageLayout } from '@/services/pdf/types/pdf-types'

interface PdfStore extends PdfState {
  pdfCoreService: PdfCoreService | null
  
  // Actions
  initialize: () => void
  loadPdf: (file: File) => Promise<void>
  setSelectedTool: (tool: string) => void
  setDrawingConfig: (config: Partial<any>) => void
  setScale: (scale: number) => Promise<void>
  dispose: () => void
}

export const usePdfStore = create<PdfStore>((set, get) => ({
  // Initial state
  pdfCoreService: null,
  pdfDoc: null,
  originalPdfBytes: null,
  pageLayouts: [],
  allAnnotations: {},
  isDocLoaded: false,
  currentPage: 1,
  totalPages: 0,
  scale: 1.0,
  isLoading: false,
  error: null,
  selectedTool: 'none',
  drawingConfig: {
    highlighterColor: '#FFFF00',
    highlighterWidth: 5,
    highlighterOpacity: 50,
    penColor: '#ff0000',
    penWidth: 1.0,
    eraserMode: 'stroke',
    eraserSize: 15,
    screenshotShape: 'rectangle',
    screenshotStrokeColor: '#ff0000',
    screenshotFillColor: 'rgba(255, 0, 0, 0.1)',
    screenshotStrokeWidth: 2,
  },

  // Actions
  initialize: () => {
    const service = new PdfCoreService()
    set({ pdfCoreService: service })
  },

  loadPdf: async (file: File) => {
    const { pdfCoreService } = get()
    if (!pdfCoreService) {
      get().initialize()
      return get().loadPdf(file)
    }

    try {
      set({ isLoading: true, error: null })
      
      const result = await pdfCoreService.loadPdf(file)
      const layouts = await pdfCoreService.calculatePageLayouts(get().scale)

      set({
        pdfDoc: result.pdfDoc,
        originalPdfBytes: result.originalPdfBytes,
        pageLayouts: layouts,
        totalPages: result.totalPages,
        isDocLoaded: true,
        isLoading: false,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'PDF加载失败',
        isLoading: false,
      })
    }
  },

  setSelectedTool: (tool) => {
    set({ selectedTool: tool })
  },

  setDrawingConfig: (config) => {
    set((state) => ({
      drawingConfig: { ...state.drawingConfig, ...config },
    }))
  },

  setScale: async (scale) => {
    const { pdfCoreService } = get()
    if (!pdfCoreService || !get().isDocLoaded) {
      set({ scale })
      return
    }

    try {
      set({ scale, isLoading: true })
      const layouts = await pdfCoreService.calculatePageLayouts(scale)
      set({ pageLayouts: layouts, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '重新计算布局失败',
        isLoading: false,
      })
    }
  },

  dispose: () => {
    const { pdfCoreService } = get()
    pdfCoreService?.dispose()
    set({
      pdfCoreService: null,
      pdfDoc: null,
      originalPdfBytes: null,
      pageLayouts: [],
      allAnnotations: {},
      isDocLoaded: false,
    })
  },
}))

// 使用示例
function PdfViewerWithZustand() {
  const {
    pdfDoc,
    pageLayouts,
    isLoading,
    error,
    loadPdf,
    setSelectedTool,
    initialize,
    dispose,
  } = usePdfStore()

  useEffect(() => {
    initialize()
    return () => dispose()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadPdf(file)
  }

  return (
    <div>
      <input type="file" accept=".pdf" onChange={handleFileChange} />
      {isLoading && <div>加载中...</div>}
      {error && <div>错误: {error}</div>}
      {pageLayouts.map((layout) => (
        <div key={layout.pageNum}>第 {layout.pageNum} 页</div>
      ))}
      <button onClick={() => setSelectedTool('pen')}>钢笔</button>
    </div>
  )
}
```

## 迁移清单

### 阶段1：准备阶段
- [x] 创建核心服务类
- [x] 创建类型定义
- [x] 创建适配器接口
- [ ] 重构现有Vue代码使用服务类

### 阶段2：实现React适配器
- [ ] 选择状态管理库（Zustand/Redux）
- [ ] 实现React适配器
- [ ] 创建React Hook
- [ ] 编写单元测试

### 阶段3：迁移组件
- [ ] 创建React版本的PDF Viewer组件
- [ ] 创建React版本的PDF Page组件
- [ ] 创建React版本的工具栏组件
- [ ] 测试功能一致性

### 阶段4：优化和测试
- [ ] 性能优化
- [ ] 集成测试
- [ ] 用户体验测试
- [ ] 文档更新

