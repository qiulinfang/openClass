// 懒加载消息渲染器 - 按需处理 Markdown 解析和 MathJax 渲染
import { ref, onMounted, onUnmounted } from 'vue'
import { MathJaxUtils } from '@/utils/math/mathjax'

export interface LazyRenderOptions {
  rootMargin?: string
  threshold?: number
  batchSize?: number
  batchDelay?: number
}

export class LazyMessageRenderer {
  private static instance: LazyMessageRenderer
  private intersectionObserver: IntersectionObserver | null = null
  private renderedElements = new WeakSet<HTMLElement>()
  private renderQueue: HTMLElement[] = []
  private isProcessing = false

  private constructor() {}

  static getInstance(): LazyMessageRenderer {
    if (!LazyMessageRenderer.instance) {
      LazyMessageRenderer.instance = new LazyMessageRenderer()
    }
    return LazyMessageRenderer.instance
  }

  /**
   * 初始化 Intersection Observer
   */
  init(options: LazyRenderOptions = {}) {
    if (this.intersectionObserver) return

    const {
      rootMargin = '50px',
      threshold = 0.1
    } = options

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement
            this.addToRenderQueue(element)
            this.intersectionObserver?.unobserve(element)
          }
        })
      },
      {
        rootMargin,
        threshold
      }
    )
  }

  /**
   * 添加元素到渲染队列
   */
  private addToRenderQueue(element: HTMLElement) {
    if (this.renderedElements.has(element)) return

    this.renderQueue.push(element)
    this.processRenderQueue()
  }

  /**
   * 处理渲染队列
   */
  private async processRenderQueue() {
    if (this.isProcessing || this.renderQueue.length === 0) return

    this.isProcessing = true

    try {
      // 批量处理元素
      const batch = this.renderQueue.splice(0, 5) // 每批处理5个元素
      
      for (const element of batch) {
        await this.renderElement(element)
        this.renderedElements.add(element)
      }

      // 如果还有元素，延迟处理下一批
      if (this.renderQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 16))
        this.processRenderQueue()
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * 渲染单个元素
   */
  private async renderElement(element: HTMLElement) {
    try {
      // 检查元素是否包含数学公式
      const hasMath = element.querySelector('.math, [data-math], .katex, .MathJax')
      
      if (hasMath) {
        // 使用 MathJax 渲染数学公式
        await MathJaxUtils.renderMath(element, false) // 不使用懒加载，因为已经在懒加载流程中
      }

      // 标记为已渲染
      element.setAttribute('data-lazy-rendered', 'true')
    } catch (error) {
      console.warn('懒加载渲染失败:', error)
    }
  }

  /**
   * 观察元素进行懒加载渲染
   */
  observe(element: HTMLElement) {
    if (!this.intersectionObserver) {
      this.init()
    }
    
    if (element && !this.renderedElements.has(element)) {
      this.intersectionObserver?.observe(element)
    }
  }

  /**
   * 停止观察元素
   */
  unobserve(element: HTMLElement) {
    this.intersectionObserver?.unobserve(element)
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect()
      this.intersectionObserver = null
    }
    this.renderQueue = []
    this.renderedElements = new WeakSet()
  }

  /**
   * 获取渲染状态
   */
  getRenderStatus() {
    return {
      queueLength: this.renderQueue.length,
      isProcessing: this.isProcessing,
      observedElements: this.renderedElements
    }
  }
}

// 导出单例实例
export const lazyMessageRenderer = LazyMessageRenderer.getInstance()

// Vue 组合式 API 钩子
export function useLazyMessageRender(_options?: LazyRenderOptions) {
  const elementRef = ref<HTMLElement | null>(null)
  const isRendered = ref(false)

  onMounted(() => {
    if (elementRef.value) {
      lazyMessageRenderer.observe(elementRef.value)
    }
  })

  onUnmounted(() => {
    if (elementRef.value) {
      lazyMessageRenderer.unobserve(elementRef.value)
    }
  })

  return {
    elementRef,
    isRendered
  }
}
