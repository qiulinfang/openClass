<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <q-page class="pdf-viewer-page">
        <!-- 顶部工具栏 -->
        <div class="pdf-toolbar q-pa-md">
          <q-card flat bordered class="q-pa-md">
            <div class="row items-center q-gutter-md">
              <div class="col-auto">
                <q-btn
                  color="primary"
                  icon="arrow_back"
                  label="返回"
                  @click="goBack"
                  unelevated
                  rounded
                />
              </div>
              <div class="col">
                <div class="text-h6 text-grey-8">{{ textbookName }}</div>
                <div v-if="pdfFiles.length > 0" class="text-caption text-grey-6">
                  共 {{ pdfFiles.length }} 个PDF文件
                </div>
              </div>
              <div class="col-auto">
                <q-btn
                  color="secondary"
                  icon="school"
                  label="去学习"
                  @click="goToKnowledgeGraph"
                  unelevated
                  rounded
                />
              </div>
            </div>
          </q-card>
        </div>

        <!-- PDF 查看器 -->
        <div class="pdf-container q-pa-md">
          <q-card flat bordered class="pdf-viewer-card">
            <!-- PDF 列表导航 -->
            <div v-if="pdfFiles.length > 1" class="pdf-list-nav q-pa-md">
              <div class="text-subtitle2 text-grey-7 q-mb-sm">PDF 文件列表</div>
              <div class="row q-gutter-sm">
                <q-btn
                  v-for="(file, index) in pdfFiles"
                  :key="file.id"
                  :color="currentPdfIndex === index ? 'primary' : 'grey-5'"
                  :outline="currentPdfIndex !== index"
                  :label="file.fileName"
                  @click="scrollToPdf(index)"
                  size="sm"
                  rounded
                  class="pdf-nav-btn"
                />
              </div>
            </div>
            
            <div class="pdf-content">
              <!-- PDF.js 查看器 -->
              <div ref="pdfContainer" class="pdf-viewer"></div>
              
              <!-- 加载状态覆盖层 -->
              <div v-if="loading" class="loading-overlay">
                <div class="loading-state text-center q-pa-xl">
                  <q-spinner-dots size="50px" color="primary" />
                  <div class="text-h6 text-grey-6 q-mt-md">正在加载PDF...</div>
                  <div v-if="renderProgress.total > 0" class="text-caption text-grey-5 q-mt-sm">
                    渲染进度: {{ renderProgress.current }} / {{ renderProgress.total }}
                  </div>
                </div>
              </div>
              
              <!-- 错误状态覆盖层 -->
              <div v-if="error" class="error-overlay">
                <div class="error-state text-center q-pa-xl">
                  <q-icon name="error" size="50px" color="negative" />
                  <div class="text-h6 text-grey-6 q-mt-md">{{ error }}</div>
                  <q-btn
                    color="primary"
                    label="重试"
                    @click="loadPdf"
                    class="q-mt-md"
                    unelevated
                    rounded
                  />
                </div>
              </div>
            </div>
          </q-card>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, shallowRef, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as pdfjsLib from 'pdfjs-dist'
import { ResourceManager } from '../services/resource-manager'

// 文件类型定义
interface FileData {
  id: string
  textbookId: string
  fileName: string
  fileData: Uint8Array
  packageId?: string
  chapterOrder?: number
  sortOrder?: number
}

// 设置 PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

const route = useRoute()
const router = useRouter()

// 响应式数据
const loading = ref(true)
const error = ref('')
const textbookId = ref('')
const textbookName = ref('')
const pdfContainer = ref<HTMLElement>()
const pdfDocuments = shallowRef<pdfjsLib.PDFDocumentProxy[]>([])
const pdfFiles = ref<FileData[]>([])
const currentPdfIndex = ref(0)
const renderProgress = ref({ current: 0, total: 0 })
const loadedPages = ref(new Set<string>()) // 跟踪已加载的页面
const intersectionObserver = ref<IntersectionObserver | null>(null)

// IndexedDB 服务
const resourceManager = ResourceManager.getInstance()

// 文件名解析工具函数
const parseChapterOrderFromFileName = (fileName: string): number => {
  // 常见的章节命名模式
  const patterns = [
    // 模式1: 第X章、第X节、第X课
    /第(\d+)[章节课]/,
    // 模式2: Chapter X、ChapterX
    /Chapter\s*(\d+)/i,
    // 模式3: 纯数字开头
    /^(\d+)/,
    // 模式4: 数字-数字格式 (如: 1-1, 2-3)
    /^(\d+)-\d+/,
    // 模式5: 数字.数字格式 (如: 1.1, 2.3)
    /^(\d+)\.\d+/,
    // 模式6: 数字_数字格式 (如: 1_1, 2_3)
    /^(\d+)_\d+/,
    // 模式7: 数字-数字-数字格式 (如: 1-1-1)
    /^(\d+)-\d+-\d+/,
    // 模式8: 数字.数字.数字格式 (如: 1.1.1)
    /^(\d+)\.\d+\.\d+/,
    // 模式9: 数字_数字_数字格式 (如: 1_1_1)
    /^(\d+)_\d+_\d+/,
    // 模式10: 中文数字 (一、二、三等)
    /[一二三四五六七八九十百千万]+/,
  ]
  
  for (let i = 0; i < patterns.length; i++) {
    const match = fileName.match(patterns[i])
    if (match) {
      if (i === 9) {
        // 中文数字转换
        return convertChineseNumberToArabic(match[0])
      } else {
        return parseInt(match[1], 10)
      }
    }
  }
  
  // 如果没有匹配到任何模式，返回一个很大的数字，排在最后
  return 9999
}

// 中文数字转阿拉伯数字
const convertChineseNumberToArabic = (chineseNum: string): number => {
  // 简单的转换逻辑，可以根据需要扩展
  if (chineseNum === '一') return 1
  if (chineseNum === '二') return 2
  if (chineseNum === '三') return 3
  if (chineseNum === '四') return 4
  if (chineseNum === '五') return 5
  if (chineseNum === '六') return 6
  if (chineseNum === '七') return 7
  if (chineseNum === '八') return 8
  if (chineseNum === '九') return 9
  if (chineseNum === '十') return 10
  
  return 9999
}

// 文件排序函数
const sortFilesByChapterOrder = (files: FileData[]): FileData[] => {
  return files.sort((a, b) => {
    // 首先按章节顺序排序
    const orderA = a.chapterOrder ?? parseChapterOrderFromFileName(a.fileName)
    const orderB = b.chapterOrder ?? parseChapterOrderFromFileName(b.fileName)
    
    if (orderA !== orderB) {
      return orderA - orderB
    }
    
    // 如果章节顺序相同，按文件名排序
    return a.fileName.localeCompare(b.fileName, 'zh-CN', { numeric: true })
  })
}

// 页面加载时获取参数
onMounted(() => {
  textbookId.value = route.query.textbookId as string
  textbookName.value = route.query.textbookName as string
  
  if (!textbookId.value) {
    error.value = '缺少教材ID参数'
    loading.value = false
    return
  }
  
  
  loadPdf()
})

// 加载PDF
const loadPdf = async () => {
  try {
    loading.value = true
    error.value = ''
    
    // 从 IndexedDB 获取PDF文件
    const files = await resourceManager.indexedDB.getAll('files') as FileData[]
    console.log('原始文件列表:', files)
    console.log('textbookId.value', textbookId.value)
    
    const validPdfFiles = files.filter((file: FileData) => 
      file.textbookId === textbookId.value && 
      file.fileName.endsWith('.pdf') && 
      file.fileData && 
      file.fileData.length > 0
    )
    
    console.log('过滤后的PDF文件:', validPdfFiles)
    console.log('111111validPdfFiles.length', validPdfFiles)
    // 按章节顺序排序文件
    const sortedPdfFiles = sortFilesByChapterOrder(validPdfFiles)
    console.log('111111sortedPdfFiles.length', sortedPdfFiles)
    console.log('按章节顺序排序后的文件:', sortedPdfFiles.map(f => ({
      fileName: f.fileName,
      chapterOrder: f.chapterOrder ?? parseChapterOrderFromFileName(f.fileName),
      packageId: f.packageId
    })))
    
    if (sortedPdfFiles.length === 0) {
      error.value = '未找到有效的PDF文件'
      loading.value = false
      return
    }
    
    // 存储排序后的PDF文件信息
    pdfFiles.value = sortedPdfFiles
    
    // 加载所有PDF文档
    pdfDocuments.value = []
    for (let i = 0; i < sortedPdfFiles.length; i++) {
      const pdfFile = sortedPdfFiles[i]
      console.log(`加载PDF ${i + 1}:`, {
        fileName: pdfFile.fileName,
        fileSize: pdfFile.fileData?.length,
        dataType: typeof pdfFile.fileData,
        isUint8Array: pdfFile.fileData instanceof Uint8Array
      })
      
      try {
        const loadingTask = pdfjsLib.getDocument({ data: pdfFile.fileData })
        const pdfDoc = await loadingTask.promise
        console.log(`PDF ${i + 1} 加载成功:`, {
          pages: pdfDoc.numPages,
          fingerprint: pdfDoc.fingerprints?.[0]
        })
        pdfDocuments.value.push(pdfDoc)
      } catch (err) {
        console.error(`PDF ${i + 1} 加载失败:`, err)
        throw err
      }
    }
    
    // 设置当前PDF信息
    currentPdfIndex.value = 0
    
    // 等待DOM挂载完成后再渲染
    await nextTick()
    await renderAllPages()
    
    loading.value = false
  } catch (err) {
    console.error('加载PDF失败:', err)
    error.value = '加载PDF失败: ' + (err instanceof Error ? err.message : '未知错误')
    loading.value = false
  }
}

// 渲染所有PDF的所有页面
const renderAllPages = async () => {
  console.log('开始渲染所有PDF页面...')
  console.log('pdfContainer.value:', pdfContainer.value)
  console.log('pdfDocuments.value.length:', pdfDocuments.value.length)
  
  // 如果容器还没有挂载，等待一下再重试
  if (!pdfContainer.value) {
    console.log('容器未挂载，等待100ms后重试...')
    await new Promise(resolve => setTimeout(resolve, 100))
    
    if (!pdfContainer.value) {
      console.log('容器仍未挂载，渲染失败')
      error.value = 'PDF容器未正确挂载'
      return
    }
  }
  
  if (pdfDocuments.value.length === 0) {
    console.log('没有PDF文档可渲染')
    return
  }
  
  try {
    // 清空容器和已加载页面记录
    pdfContainer.value.innerHTML = ''
    loadedPages.value.clear()
    console.log('容器已清空，开始懒加载模式')
    
    // 计算总页面数
    const totalPages = pdfDocuments.value.reduce((sum, doc) => sum + doc.numPages, 0)
    renderProgress.value = { current: 0, total: totalPages }
    console.log(`总共需要渲染 ${totalPages} 页（懒加载模式）`)
    
    // 为每个PDF创建容器和页面占位符
    for (let i = 0; i < pdfDocuments.value.length; i++) {
      const pdfDoc = pdfDocuments.value[i]
      const pdfFile = pdfFiles.value[i]
      
      console.log(`处理PDF ${i + 1}:`, {
        fileName: pdfFile.fileName,
        fileSize: pdfFile.fileData?.length,
        docPages: pdfDoc.numPages
      })
      
      // 创建PDF容器
      const pdfWrapper = document.createElement('div')
      pdfWrapper.className = 'pdf-wrapper'
      pdfWrapper.style.marginBottom = '30px'
      pdfWrapper.setAttribute('data-pdf-index', i.toString())
      
      // 添加PDF标题
      const header = document.createElement('div')
      header.className = 'pdf-header'
      header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding: 15px;
        background: #f0f0f0;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      `
      
      const title = document.createElement('div')
      title.className = 'pdf-title'
      title.textContent = pdfFile.fileName
      title.style.cssText = `
        font-size: 18px;
        font-weight: bold;
        flex: 1;
        text-align: center;
        color: #333;
      `
      
      const pageInfo = document.createElement('div')
      pageInfo.className = 'pdf-page-info'
      pageInfo.style.cssText = `
        font-size: 14px;
        color: #666;
        margin-left: 10px;
        background: white;
        padding: 5px 10px;
        border-radius: 4px;
      `
      pageInfo.textContent = `共 ${pdfDoc.numPages} 页`
      
      header.appendChild(title)
      header.appendChild(pageInfo)
      pdfWrapper.appendChild(header)
      
      // 创建所有页面的容器
      const pagesContainer = document.createElement('div')
      pagesContainer.className = 'pdf-pages-container'
      pagesContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 15px;
        align-items: center;
      `
      
      // 创建页面占位符，不立即渲染（懒加载模式）
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        console.log(`创建PDF ${i + 1} 第${pageNum}页占位符...`)
        
        // 创建单页容器
        const pageWrapper = document.createElement('div')
        pageWrapper.className = 'pdf-page-wrapper'
        pageWrapper.style.cssText = `
          position: relative;
          margin-bottom: 10px;
          text-align: center;
          min-height: 800px; /* 设置最小高度作为占位符 */
        `
        
        // 添加页码标签
        const pageLabel = document.createElement('div')
        pageLabel.className = 'pdf-page-label'
        pageLabel.textContent = `第 ${pageNum} 页`
        pageLabel.style.cssText = `
          font-size: 14px;
          color: #666;
          margin-bottom: 8px;
          font-weight: 500;
        `
        pageWrapper.appendChild(pageLabel)
        
        // 添加加载占位符
        const loadingPlaceholder = document.createElement('div')
        loadingPlaceholder.className = 'pdf-page-loading'
        loadingPlaceholder.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 800px;
          background: #f5f5f5;
          color: #666;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `
        loadingPlaceholder.innerHTML = `
          <div style="margin-bottom: 16px;">
            <div style="width: 40px; height: 40px; border: 3px solid #e0e0e0; border-top: 3px solid #1976d2; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          </div>
          <div style="font-size: 14px;">正在加载第 ${pageNum} 页...</div>
        `
        pageWrapper.appendChild(loadingPlaceholder)
        
        // 设置数据属性用于懒加载识别
        pageWrapper.setAttribute('data-pdf-index', i.toString())
        pageWrapper.setAttribute('data-page-num', pageNum.toString())
        pageWrapper.setAttribute('data-page-id', `${i}-${pageNum}`)
        
        // 添加到容器
        pagesContainer.appendChild(pageWrapper)
      }
      
      console.log(`PDF ${i + 1} 所有页面占位符创建完成`)
      
      pdfWrapper.appendChild(pagesContainer)
      
      // 添加到主容器
      pdfContainer.value.appendChild(pdfWrapper)
      console.log(`PDF ${i + 1} 所有页面已添加到容器`)
    }
    
    // 设置Intersection Observer监听页面可见性
    setupIntersectionObserver()
    console.log('所有PDF页面占位符创建完成，开始懒加载监听')
    
  } catch (err) {
    console.error('渲染所有页面失败:', err)
    error.value = '渲染PDF失败: ' + (err instanceof Error ? err.message : '未知错误')
  }
}

// 设置Intersection Observer监听页面可见性
const setupIntersectionObserver = () => {
  // 清理之前的observer
  if (intersectionObserver.value) {
    intersectionObserver.value.disconnect()
  }
  
  // 创建新的observer
  intersectionObserver.value = new IntersectionObserver(
    (entries) => {
      entries.forEach(async (entry) => {
        if (entry.isIntersecting) {
          const pageWrapper = entry.target as HTMLElement
          const pdfIndex = parseInt(pageWrapper.getAttribute('data-pdf-index') || '0')
          const pageNum = parseInt(pageWrapper.getAttribute('data-page-num') || '0')
          const pageId = pageWrapper.getAttribute('data-page-id') || ''
          
          // 检查是否已经加载过
          if (!loadedPages.value.has(pageId)) {
            console.log(`页面 ${pageId} 进入视口，开始懒加载...`)
            await loadPageOnDemand(pdfIndex, pageNum, pageWrapper)
            loadedPages.value.add(pageId)
          }
        }
      })
    },
    {
      root: null,
      rootMargin: '100px', // 提前100px开始加载
      threshold: 0.1
    }
  )
  
  // 监听所有页面占位符
  const pageWrappers = pdfContainer.value?.querySelectorAll('.pdf-page-wrapper')
  pageWrappers?.forEach((wrapper) => {
    intersectionObserver.value?.observe(wrapper)
  })
  
  console.log(`开始监听 ${pageWrappers?.length || 0} 个页面的可见性`)
}

// 按需加载页面
const loadPageOnDemand = async (pdfIndex: number, pageNum: number, pageWrapper: HTMLElement) => {
  try {
    console.log(`开始懒加载PDF ${pdfIndex + 1} 第${pageNum}页...`)
    
    // 移除加载占位符
    const loadingPlaceholder = pageWrapper.querySelector('.pdf-page-loading')
    if (loadingPlaceholder) {
      loadingPlaceholder.remove()
    }
    
    // 渲染实际页面
    await renderSinglePage(pdfIndex, pageNum, pageWrapper)
    
    // 添加加载完成动画
    pageWrapper.classList.add('loaded')
    
    // 更新渲染进度
    renderProgress.value.current++
    
    console.log(`PDF ${pdfIndex + 1} 第${pageNum}页懒加载完成`)
  } catch (err) {
    console.error(`懒加载PDF ${pdfIndex + 1} 第${pageNum}页失败:`, err)
    
    // 显示错误状态
    const errorDiv = document.createElement('div')
    errorDiv.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 400px;
      background: #ffebee;
      color: #c62828;
      border-radius: 8px;
      text-align: center;
    `
    errorDiv.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
      <div style="font-size: 16px; font-weight: bold;">加载失败</div>
      <div style="font-size: 14px; margin-top: 8px;">第 ${pageNum} 页无法显示</div>
    `
    pageWrapper.appendChild(errorDiv)
  }
}

// 渲染单个PDF页面
const renderSinglePage = async (pdfIndex: number, pageNum: number, container?: HTMLElement) => {
  try {
    const pdfDoc = pdfDocuments.value[pdfIndex]
    if (!pdfDoc) return
    
    console.log(`渲染PDF ${pdfIndex + 1} 第${pageNum}页...`)
    const page = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1.2 })
    
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    
    canvas.height = viewport.height
    canvas.width = viewport.width
    canvas.style.cssText = `
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: block;
      margin: 0 auto;
      max-width: 100%;
      height: auto;
      background: white;
    `
    
    const renderContext = {
      canvasContext: context!,
      viewport: viewport,
      canvas: canvas
    }
    
    await page.render(renderContext).promise
    console.log(`PDF ${pdfIndex + 1} 第${pageNum}页渲染完成`)
    
    // 更新渲染进度
    renderProgress.value.current++
    
    // 将canvas添加到提供的容器中
    if (container) {
      container.appendChild(canvas)
    }
    
  } catch (err) {
    console.error(`渲染PDF ${pdfIndex + 1} 第${pageNum}页失败:`, err)
  }
}


// 滚动到特定PDF
const scrollToPdf = (pdfIndex: number) => {
  currentPdfIndex.value = pdfIndex
  
  const pdfWrapper = pdfContainer.value?.querySelector(`[data-pdf-index="${pdfIndex}"]`)
  if (pdfWrapper) {
    pdfWrapper.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'start' 
    })
  }
}



// 返回上一页
const goBack = () => {
  router.go(-1)
}

// 跳转到知识图谱
const goToKnowledgeGraph = () => {
  router.push({
    name: 'knowledgeGraph',
    query: {
      textbookId: textbookId.value,
      textbookName: textbookName.value
    }
  })
}

// 清理Intersection Observer
const cleanupIntersectionObserver = () => {
  if (intersectionObserver.value) {
    intersectionObserver.value.disconnect()
    intersectionObserver.value = null
  }
}

// 页面卸载时清理资源
onUnmounted(() => {
  // 清理PDF文档引用，让PDF.js自动处理内存清理
  pdfDocuments.value = []
  pdfFiles.value = []
  
  // 清理Intersection Observer
  cleanupIntersectionObserver()
  
  // 清理已加载页面记录
  loadedPages.value.clear()
})
</script>

<style lang="scss" scoped>
.pdf-viewer-page {
  background: #f5f5f5;
  min-height: 100vh;
}

.pdf-toolbar {
  background: white;
  border-bottom: 1px solid #e0e0e0;
}

.pdf-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.pdf-viewer-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 200px);
}

.pdf-content {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 20px;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  max-height: calc(100vh - 300px);
  scroll-behavior: smooth;
}

/* 自定义滚动条样式 */
.pdf-content::-webkit-scrollbar {
  width: 8px;
}

.pdf-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.pdf-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.pdf-content::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.pdf-viewer {
  max-width: 100%;
  text-align: center;
  
  canvas {
    max-width: 100%;
    height: auto;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    border-radius: 4px;
  }
}

.pdf-wrapper {
  margin-bottom: 20px;
  padding: 10px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.pdf-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 10px;
  padding: 10px;
  background: #f0f0f0;
  border-radius: 4px;
  text-align: center;
  color: #333;
}

.pdf-list-nav {
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
}

.pdf-nav-btn {
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pdf-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding: 10px;
  background: #f0f0f0;
  border-radius: 4px;
}

.pdf-pages-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
  align-items: center;
}

.pdf-page-wrapper {
  position: relative;
  margin-bottom: 10px;
  text-align: center;
}

.pdf-page-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
  font-weight: 500;
}

.loading-overlay,
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

/* 懒加载动画 */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.pdf-page-loading {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 页面懒加载效果 */
.pdf-page-wrapper {
  transition: all 0.3s ease;
}

.pdf-page-wrapper.loaded {
  animation: slideInUp 0.5s ease-out;
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 响应式设计
@media (max-width: 768px) {
  .pdf-viewer-page {
    padding: 0;
  }
  
  .pdf-toolbar {
    padding: 12px;
  }
  
  .pdf-container {
    padding: 12px;
  }
  
  .pdf-content {
    padding: 10px;
  }
}
</style>
