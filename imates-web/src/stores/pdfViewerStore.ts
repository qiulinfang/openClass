import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import { resourceManager } from '@/services/resource-storage'
import type { LocalFileInfo, UserTextbookInfo } from '@/types/textbook'
import { showMessage } from '../utils'

// 动态导入PDF.js worker
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

// 文件类型定义
interface FileData {
  id: string
  textbookId: string
  fileName: string
  filePath: string
  fileSize: number
  uploadTime: string
  isLocal: boolean
}

// 页面布局类型
interface PageLayout {
  pageNum: number
  top: number
  height: number
  width: number
}

// 绘制配置类型
interface DrawingConfig {
  highlighterColor: string
  highlighterWidth: number
  highlighterOpacity: number
  penColor: string
  penWidth: number
  eraserMode: string
  eraserSize: number
  screenshotShape: string // 截图形状类型：'rectangle' | 'polygon'
  screenshotStrokeColor: string // 截图选区边框颜色
  screenshotFillColor: string // 截图选区填充颜色
  screenshotStrokeWidth: number // 截图选区边框宽度
  selectMode: string // 选择模式：'rectangle' | 'freeform'
}

// 笔记数据类型
interface NoteData {
  id: string
  pageId: string
  type: string
  content: object
  config: DrawingConfig
  createdAt: string
  updatedAt: string
}

// 工具选项
interface ToolOption {
  label: string
  value: string
  icon: string
}

// 颜色选项
interface ColorOption {
  label: string
  value: string
  color: string
}

// 防抖定时器（在 store 外部定义，避免被代理）
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null

// 页面可见性监听器（在 store 外部定义，避免被代理）
let visibilityChangeHandler: (() => void) | null = null

// PDF查看器状态管理
export const usePdfViewerStore = defineStore('pdfViewer', {
  state: () => ({
    // 基础状态
    pdfFiles: [] as FileData[],
    currentPage: 1,
    totalPages: 0,
    // 注意：scale保持1.0用于布局计算，高DPI支持已在渲染层面实现（PdfCoreService.renderPage）
    // 渲染时会自动适配devicePixelRatio，无需在此处调整scale
    scale: 1.0,
    pageGap: 20, // 页面间距（px）
    isLoading: false,
    
    // PDF 文档状态
    pdfDoc: null as pdfjsLib.PDFDocumentProxy | null,
    originalPdfBytes: null as ArrayBuffer | null,
    pageLayouts: [] as PageLayout[],
    allAnnotations: {} as Record<number, object[]>,
    isDocLoaded: false,
    currentFileId: null as string | null,
    currentResourceId: null as string | null,
    
    // 工具状态
    selectedTool: 'none',
    drawingConfig: {
      highlighterColor: '#FFFF00', // 黄色（第一个选项）
      highlighterWidth: 5, // 荧光笔细（新范围 3-15）
      highlighterOpacity: 50, // 默认浓度 50%
      penColor: '#ff0000', // 红色（第一个选项）
      penWidth: 1.0, // 签字笔中等（新范围 0.3-3）
      eraserMode: 'stroke', // 橡皮擦默认为整笔擦除模式
      eraserSize: 15, // 橡皮擦中等（新范围 5-30）
      screenshotShape: 'rectangle', // 截图形状：矩形
      screenshotStrokeColor: '#ff0000', // 红色边框
      screenshotFillColor: 'rgba(255, 0, 0, 0.1)', // 半透明红色填充
      screenshotStrokeWidth: 2, // 边框宽度2px
      selectMode: 'rectangle' // 选择模式：矩形选择（默认）
    } as DrawingConfig,
    
    // 笔记状态
    notes: new Map<string, NoteData[]>(),
    error: null as string | null,
    
    // 笔记显示状态
    hideNotes: false, // 是否隐藏笔记（用于截图时获得干净的PDF页面）
    
    // 撤销/重做状态
    lastModifiedPage: null as number | null, // 最近修改的页面号
    
    // 自动保存状态
    isSaving: false,
    saveError: null as string | null,
    lastSaveTime: null as number | null,
    
    // 工具选项
    toolOptions: [
      { label: '签字笔', value: 'pen', icon: 'edit' },
      { label: '荧光笔', value: 'highlighter', icon: 'highlight' },
      { label: '橡皮', value: 'eraser', icon: 'eraser' },
      { label: '圈选截图', value: 'screenshot', icon: 'crop_free' }
    ] as ToolOption[],
    
    // 荧光笔颜色选项
    highlighterColors: [
      { label: '黄色', value: '#FFFF00', color: '#FFFF00' },
      { label: '绿色', value: '#00FF00', color: '#00FF00' },
      { label: '蓝色', value: '#0080FF', color: '#0080FF' },
      { label: '青色', value: '#00FFFF', color: '#00FFFF' },
      { label: '粉色', value: '#FF80FF', color: '#FF80FF' },
      { label: '紫色', value: '#8000FF', color: '#8000FF' }
    ] as ColorOption[],
    
    // 签字笔颜色选项
    penColors: [
      { label: '红色', value: '#ff0000', color: '#ff0000' },
      { label: '黄色', value: '#ffd400', color: '#ffd400' },
      { label: '蓝色', value: '#007bff', color: '#007bff' },
      { label: '绿色', value: '#13df00', color: '#13df00' },
      { label: '紫色', value: '#8000ff', color: '#8000ff' },
      { label: '黑色', value: '#111111', color: '#111111' }
    ] as ColorOption[],
    
    
    // 形状线条粗细选项
    shapeStrokeWidths: [
      { label: '1px', value: 1 },
      { label: '2px', value: 2 },
      { label: '3px', value: 3 },
      { label: '4px', value: 4 },
      { label: '5px', value: 5 }
    ],
    
    // 橡皮模式选项（只保留整笔擦除）
    eraserModeOptions: [
      { label: '整笔擦除', value: 'stroke' }
    ],
    
    // 截图形状选项
    screenshotShapeOptions: [
      { label: '矩形', value: 'rectangle', icon: 'crop_square' },
      { label: '自由形状', value: 'polygon', icon: 'polyline' }
    ]
  }),

  getters: {
    // 当前页面笔记
    currentPageNotes: (state) => {
      const pageId = `page-${state.currentPage}`
      return state.notes.get(pageId) || []
    },
    
    // 是否有笔记
    hasNotes: (state) => {
      return state.notes.size > 0
    },
    
    // 当前页面是否有笔记
    currentPageHasNotes: (state) => {
      const pageId = `page-${state.currentPage}`
      return (state.notes.get(pageId) || []).length > 0
    },
    
    // 笔记总数
    notesCount: (state) => {
      let count = 0
      for (const pageNotes of state.notes.values()) {
        count += pageNotes.length
      }
      return count
    },
    
    // 是否可以上一页
    canGoToPreviousPage: (state) => {
      return state.currentPage > 1
    },
    
    // 是否可以下一页
    canGoToNextPage: (state) => {
      return state.currentPage < state.totalPages
    },
    
    // 缩放百分比
    scalePercentage: (state) => {
      return Math.round(state.scale * 100)
    }
  },

  actions: {
    // 核心 PDF 加载方法
    async loadPdf(file: File) {
      try {
        this.isLoading = true
        this.error = null
        
        // 1. 重置状态
        this.pageLayouts = []
        this.allAnnotations = {}
        this.notes.clear()
        
        // 2. 读取文件为 ArrayBuffer
        const arrayBuffer = await file.arrayBuffer()
        
        // 3. 在 PDF.js 加载之前，立即创建 ArrayBuffer 的独立副本
        // 使用 slice() 方法创建真正的独立副本，避免被 PDF.js 转移后变成 detached
        // slice() 会创建一个新的 ArrayBuffer，完全独立于原始 buffer
        // 如果 slice() 失败（浏览器不支持），则使用 Uint8Array 创建副本
        try {
          this.originalPdfBytes = arrayBuffer.slice(0)
        } catch (e) {
          // 如果 slice() 失败，使用 Uint8Array 创建副本
          const uint8Array = new Uint8Array(arrayBuffer)
          const copiedUint8Array = new Uint8Array(uint8Array.length)
          copiedUint8Array.set(uint8Array)
          this.originalPdfBytes = copiedUint8Array.buffer
        }
        
        // 4. 从localFiles加载笔记数据
        await this.loadAnnotationsFromLocalFile()
        
        // 5. 加载 PDF.js 文档（使用原始 arrayBuffer，因为 PDF.js 可能会转移它）
        // 注意：PDF.js 会转移 ArrayBuffer 的所有权，导致原始 arrayBuffer 变成 detached
        // 但我们已经保存了副本到 this.originalPdfBytes，所以不受影响
        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          cMapUrl: '/cmaps/',
          cMapPacked: true
        })
        
        this.pdfDoc = await loadingTask.promise
        this.totalPages = this.pdfDoc.numPages
        
        // 5. 计算所有页面的布局信息
        const layouts: PageLayout[] = []
        let accumulatedTop = 0
        
        for (let i = 1; i <= this.pdfDoc.numPages; i++) {
          const rawPdfDoc = toRaw(this.pdfDoc) // 使用 toRaw 获取原始 PDF 文档对象
          const rawPage = await rawPdfDoc.getPage(i)
          const viewport = rawPage.getViewport({ scale: this.scale })
          
          layouts.push({
            pageNum: i,
            top: accumulatedTop,
            height: viewport.height,
            width: viewport.width
          })
          
          accumulatedTop += viewport.height + this.pageGap
        }
        
        // 6. 设置布局数据
        this.pageLayouts = layouts
        this.isDocLoaded = true
      } catch (error) {
        console.error('PDF 加载失败:', error)
        this.error = error instanceof Error ? error.message : 'PDF 加载失败'
      } finally {
        this.isLoading = false
      }
    },
    
    // 更新指定页面的笔记
    updateAnnotations(pageNum: number, fabricJson: object[]) {
      // 1. 更新内存中的笔记数据
      if (fabricJson && fabricJson.length > 0) {
        this.allAnnotations[pageNum] = fabricJson
      } else {
        delete this.allAnnotations[pageNum]
      }
      
      // 2. 同时更新 notes Map（保持兼容性）
      const pageId = `page-${pageNum}`
      if (fabricJson && fabricJson.length > 0) {
        const noteData: NoteData[] = fabricJson.map((obj: object, index: number) => ({
          id: `${pageId}-${index}`,
          pageId,
          type: 'fabric',
          content: obj,
          config: this.drawingConfig,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }))
        this.notes.set(pageId, noteData)
      } else {
        this.notes.delete(pageId)
      }
      
      // 3. 触发防抖自动保存
      this.debouncedSave()
    },
    
    // 防抖保存笔记到 IndexedDB
    debouncedSave() {
      // 清除之前的定时器
      if (saveDebounceTimer) {
        clearTimeout(saveDebounceTimer)
        saveDebounceTimer = null
      }
      
      // 设置新的定时器（1秒后保存）
      saveDebounceTimer = setTimeout(async () => {
        await this.autoSaveAnnotations()
      }, 1000)
    },
    
    // 自动保存笔记到 IndexedDB
    async autoSaveAnnotations() {
      // 如果没有文件信息，跳过保存
      if (!this.currentFileId || !this.currentResourceId) {
        return
      }

      // 如果正在保存，跳过
      if (this.isSaving) {
        return
      }

      try {
        this.isSaving = true
        this.saveError = null
        await this.saveAnnotationsToLocalFile()
        this.lastSaveTime = Date.now()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '保存失败'
        this.saveError = errorMessage
        showMessage('保存失败，请重试', 'error')
        console.error('自动保存笔记失败:', error)
      } finally {
        this.isSaving = false
      }
    },
    
    // 立即保存笔记（用于组件卸载等场景）
    async flushSave() {
      // 清除防抖定时器
      if (saveDebounceTimer) {
        clearTimeout(saveDebounceTimer)
        saveDebounceTimer = null
      }
      
      // 立即保存
      await this.autoSaveAnnotations()
    },
    
    // 初始化页面可见性监听
    initVisibilityListener() {
      // 如果已经初始化，先清理
      if (visibilityChangeHandler) {
        this.removeVisibilityListener()
      }
      
      // 创建监听器
      visibilityChangeHandler = () => {
        if (document.hidden) {
          // 页面隐藏时立即保存
          this.flushSave()
        }
      }
      
      // 添加监听
      document.addEventListener('visibilitychange', visibilityChangeHandler)
    },
    
    // 移除页面可见性监听
    removeVisibilityListener() {
      if (visibilityChangeHandler) {
        document.removeEventListener('visibilitychange', visibilityChangeHandler)
        visibilityChangeHandler = null
      }
    },
    
    // 保存项目（将笔记保存到localFiles）
    async saveProject() {
      if (!this.currentFileId || !this.currentResourceId) {
        throw new Error('没有当前文件信息')
      }
      
      try {
        await this.saveAnnotationsToLocalFile()
      } catch (error) {
        console.error('保存项目失败:', error)
        throw error
      }
    },
    
    // 导出 PDF（带笔记）
    async exportPdf() {
      await this.saveProject()
    },
    
    // 从localFiles加载笔记数据
    async loadAnnotationsFromLocalFile() {
      if (!this.currentFileId || !this.currentResourceId) {
        return
      }
      
      try {
        // 获取教材信息
        const textbook = await resourceManager.indexedDB.get('textbooks', this.currentFileId) as UserTextbookInfo
        if (!textbook || !textbook.localFiles) {
          return
        }
        
        // 查找对应的本地文件
        const localFile = textbook.localFiles.find((file: LocalFileInfo) => file.id === this.currentResourceId)
        if (localFile && localFile.annotations) {
          this.allAnnotations = localFile.annotations
        }
      } catch (error) {
        console.warn('从localFiles加载笔记失败:', error)
      }
    },
    
    // 保存笔记数据到localFiles
    async saveAnnotationsToLocalFile() {
      if (!this.currentFileId || !this.currentResourceId) {
        throw new Error('没有当前文件信息')
      }
      
      try {
        // 1. 获取教材信息
        const textbook = await resourceManager.indexedDB.get('textbooks', this.currentFileId) as UserTextbookInfo
        if (!textbook || !textbook.localFiles) {
          throw new Error('教材信息不存在')
        }
        
        // 2. 查找对应的本地文件
        const localFileIndex = textbook.localFiles.findIndex((file: LocalFileInfo) => file.id === this.currentResourceId)
        if (localFileIndex === -1) {
          throw new Error('本地文件不存在')
        }
        
        // 3. 移除Vue响应式代理
        const rawAnnotations = toRaw(this.allAnnotations)
        // 4. 更新注释数据
        textbook.localFiles[localFileIndex].annotations = rawAnnotations
        // 5. 保存到IndexedDB（IndexedDB会自动进行深度序列化）
        await resourceManager.indexedDB.put('textbooks', textbook)
      } catch (error) {
        console.error('保存笔记数据到localFiles失败:', error)
        throw error
      }
    },
    
    // 设置当前文件信息
    setCurrentFileInfo(fileId: string, resourceId: string) {
      this.currentFileId = fileId
      this.currentResourceId = resourceId
    },
    
    // 设置最近修改的页面
    setLastModifiedPage(pageNum: number) {
      this.lastModifiedPage = pageNum
    },
    
    // 设置 PDF 文件列表
    setPdfFiles(files: FileData[]) {
      this.pdfFiles = files
    },
    
    // 设置当前页面
    setCurrentPage(page: number) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page
      }
    },
    
    // 设置总页数
    setTotalPages(pages: number) {
      this.totalPages = pages
    },
    
    // 设置缩放
    setScale(newScale: number) {
      this.scale = Math.max(0.5, Math.min(3.0, newScale))
    },
    
    // 放大
    zoomIn(step: number = 0.03) {
      this.setScale(this.scale + step)
    },
    
    // 缩小
    zoomOut(step: number = 0.03) {
      this.setScale(this.scale - step)
    },
    
    // 重置缩放
    resetZoom() {
      this.setScale(1.0)
    },
    
    // 设置选中的工具
    setSelectedTool(tool: string) {
      this.selectedTool = tool
    },
    
    // 更新绘制配置
    updateDrawingConfig(config: Partial<DrawingConfig>) {
      this.drawingConfig = { ...this.drawingConfig, ...config }
    },
    
    // 添加笔记
    addNote(note: NoteData) {
      const pageId = note.pageId
      if (!this.notes.has(pageId)) {
        this.notes.set(pageId, [])
      }
      this.notes.get(pageId)!.push(note)
    },
    
    // 更新笔记
    updateNote(noteId: string, updates: Partial<NoteData>) {
      for (const [, pageNotes] of this.notes.entries()) {
        const noteIndex = pageNotes.findIndex(n => n.id === noteId)
        if (noteIndex !== -1) {
          pageNotes[noteIndex] = { ...pageNotes[noteIndex], ...updates }
          break
        }
      }
    },
    
    // 删除笔记
    deleteNote(noteId: string) {
      for (const [, pageNotes] of this.notes.entries()) {
        const noteIndex = pageNotes.findIndex(n => n.id === noteId)
        if (noteIndex !== -1) {
          pageNotes.splice(noteIndex, 1)
          break
        }
      }
    },
    
    // 清除页面笔记
    clearPageNotes(pageId: string) {
      this.notes.delete(pageId)
    },
    
    // 清除所有笔记
    clearAllNotes() {
      this.notes.clear()
      this.allAnnotations = {}
    },
    
    // 获取页面笔记
    getPageNotes(pageId: string): NoteData[] {
      return this.notes.get(pageId) || []
    },
    
    // 获取所有笔记
    getAllNotes(): NoteData[] {
      const allNotes: NoteData[] = []
      for (const pageNotes of this.notes.values()) {
        allNotes.push(...pageNotes)
      }
      return allNotes
    },
    
    // 导出笔记为 JSON
    exportNotes() {
      const allNotes = this.getAllNotes()
      const dataStr = JSON.stringify(allNotes, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `notes-${Date.now()}.json`
      link.click()
      
      URL.revokeObjectURL(url)
    },
    
    // 导入笔记
    importNotes(file: File): Promise<void> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const importedNotes = JSON.parse(e.target?.result as string)
            if (Array.isArray(importedNotes)) {
              // 清空现有笔记
              this.notes.clear()
              this.allAnnotations = {}
              
              // 导入新笔记
              importedNotes.forEach(note => {
                this.addNote(note)
              })
              
              resolve()
            } else {
              reject(new Error('Invalid notes format'))
            }
          } catch (error) {
            reject(error)
          }
        }
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsText(file)
      })
    }
  }
})
