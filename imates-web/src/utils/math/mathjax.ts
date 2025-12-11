// MathJax 工具类 - 性能优化版本
import type { RenderTask } from '../../types'

declare global {
  interface Window {
    MathJax: {
      startup?: {
        promise?: Promise<void>;
      };
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
      typesetClear?: (elements: HTMLElement[]) => void;
    };
  }
}

export class MathJaxUtils {
  private static isReady = false;
  private static readyPromise: Promise<void> | null = null;
  private static renderQueue: RenderTask[] = [];
  private static isProcessing = false;
  private static intersectionObserver: IntersectionObserver | null = null;
  private static renderedElements = new WeakSet<HTMLElement>();
  private static readonly BATCH_SIZE = 3; // 每批处理3个元素
  private static readonly BATCH_DELAY = 16; // 16ms延迟，约60fps

  // 等待 MathJax 加载完成
  static async waitForMathJax(): Promise<void> {
    if (this.isReady) {
      return Promise.resolve();
    }

    if (this.readyPromise) {
      return this.readyPromise;
    }

    this.readyPromise = new Promise((resolve) => {
      if (typeof window !== 'undefined' && window.MathJax) {
        if (window.MathJax.startup && window.MathJax.startup.promise) {
          window.MathJax.startup.promise.then(() => {
            this.isReady = true;
            resolve();
          });
        } else {
          this.isReady = true;
          resolve();
        }
      } else {
        const checkMathJax = () => {
          if (typeof window !== 'undefined' && window.MathJax) {
            if (window.MathJax.startup && window.MathJax.startup.promise) {
              window.MathJax.startup.promise.then(() => {
                this.isReady = true;
                resolve();
              });
            } else {
              this.isReady = true;
              resolve();
            }
          } else {
            setTimeout(checkMathJax, 100);
          }
        };
        checkMathJax();
      }
    });

    return this.readyPromise;
  }

  // 初始化 Intersection Observer 用于懒加载
  private static initIntersectionObserver(): void {
    if (this.intersectionObserver) return;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            this.addToRenderQueue(element, 1); // 高优先级
            this.intersectionObserver?.unobserve(element);
          }
        });
      },
      {
        rootMargin: '50px', // 提前50px开始渲染
        threshold: 0.1
      }
    );
  }

  // 添加元素到渲染队列
  private static addToRenderQueue(element: HTMLElement, priority: number = 0): void {
    // 避免重复渲染
    if (this.renderedElements.has(element)) return;

    const task: RenderTask = {
      element,
      priority,
      timestamp: Date.now()
    };

    // 按优先级和时间戳排序
    const insertIndex = this.renderQueue.findIndex(
      (t) => t.priority < priority || (t.priority === priority && t.timestamp > task.timestamp)
      
    );

    if (insertIndex === -1) {
      this.renderQueue.push(task);
    } else {
      this.renderQueue.splice(insertIndex, 0, task);
    }

    // 启动处理队列
    this.processRenderQueue();
  }

  // 处理渲染队列
  private static async processRenderQueue(): Promise<void> {
    if (this.isProcessing || this.renderQueue.length === 0) return;

    this.isProcessing = true;

    try {
      await this.waitForMathJax();

      while (this.renderQueue.length > 0) {
        const batch = this.renderQueue.splice(0, this.BATCH_SIZE);
        
        // 批量渲染
        const elements = batch.map(task => task.element);
        await this.batchRenderMath(elements);

        // 标记为已渲染
        elements.forEach(el => this.renderedElements.add(el));

        // 如果还有任务，延迟处理下一批
        if (this.renderQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));
        }
      }
    } catch (error) {
      console.warn('MathJax 渲染队列处理错误:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // 批量渲染数学公式
  private static async batchRenderMath(elements: HTMLElement[]): Promise<void> {
    if (typeof window !== 'undefined' && window.MathJax && window.MathJax.typesetPromise) {
      try {
        await window.MathJax.typesetPromise(elements);
        // 延迟禁用右键菜单，确保MathJax渲染完成
        setTimeout(() => {
          elements.forEach(element => this.disableMathJaxContextMenu(element));
        }, 100);
      } catch (error) {
        console.warn('MathJax 批量渲染错误:', error);
      }
    }
  }

  // 渲染指定元素中的数学公式（优化版本）
  static async renderMath(element: HTMLElement, useLazyLoading: boolean = true): Promise<void> {
    if (!element || this.renderedElements.has(element)) return;

    if (useLazyLoading) {
      // 使用懒加载
      this.initIntersectionObserver();
      this.intersectionObserver?.observe(element);
    } else {
      // 立即渲染
      this.addToRenderQueue(element, 2); // 高优先级
    }
  }

  /**
   * 渲染指定元素中的数学公式并等待完成（用于截图等需要同步完成的场景）
   * 不走队列，直接对单个元素调用 MathJax.typesetPromise
   */
  static async renderMathAndWait(element: HTMLElement | null): Promise<void> {
    if (!element) return

    await this.waitForMathJax()

    if (typeof window !== 'undefined' && window.MathJax && window.MathJax.typesetPromise) {
      try {
        await window.MathJax.typesetPromise([element])
        // 与批量渲染保持一致：渲染完成后禁用右键菜单等交互
        this.disableMathJaxContextMenu(element)
        this.renderedElements.add(element)
      } catch (error) {
        console.warn('MathJax 渲染单个元素错误(renderMathAndWait):', error)
      }
    }
  }

  // 渲染整个文档中的数学公式（优化版本）
  static async renderAll(): Promise<void> {
    await this.waitForMathJax();
    
    if (typeof window !== 'undefined' && window.MathJax && window.MathJax.typesetPromise) {
      try {
        await window.MathJax.typesetPromise();
      } catch (error) {
        console.warn('MathJax 全文档渲染错误:', error);
      }
    }
  }

  // 清除指定元素中的 MathJax 渲染
  static async clearMath(element: HTMLElement): Promise<void> {
    await this.waitForMathJax();
    
    if (typeof window !== 'undefined' && window.MathJax && window.MathJax.typesetClear) {
      try {
        window.MathJax.typesetClear([element]);
        this.renderedElements.delete(element);
      } catch (error) {
        console.warn('MathJax 清除错误:', error);
      }
    }
  }

  // 清理资源
  static cleanup(): void {
    this.renderQueue = [];
    this.renderedElements = new WeakSet();
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
  }

  // 禁用MathJax右键菜单和MathLive功能列表
  static disableMathJaxContextMenu(element: HTMLElement): void {
    // 查找所有MathJax渲染的公式元素
    const mathElements = element.querySelectorAll('.mjx-chtml, .mjx-math, [data-mjx-texclass]');
    
    mathElements.forEach((mathEl) => {
      if (mathEl instanceof HTMLElement) {
        // 禁用右键菜单
        mathEl.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }, true);
        
        // 禁用长按事件（防止MathLive功能列表弹出）
        mathEl.addEventListener('touchstart', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }, true);
        
        mathEl.addEventListener('touchend', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }, true);
        
        mathEl.addEventListener('touchmove', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }, true);
        
        // 禁用鼠标按下事件
        mathEl.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }, true);
        
        mathEl.addEventListener('mouseup', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }, true);
        
        mathEl.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }, true);
        
        // 禁用选择事件
        mathEl.addEventListener('selectstart', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }, true);
        
        // 禁用拖拽事件
        mathEl.addEventListener('dragstart', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }, true);
        
        // 禁用焦点事件
        mathEl.addEventListener('focus', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }, true);
        
        // 设置CSS样式，禁用用户选择
        mathEl.style.userSelect = 'none';
        (mathEl.style as unknown as Record<string, string>).webkitUserSelect = 'none';
        (mathEl.style as unknown as Record<string, string>).mozUserSelect = 'none';
        (mathEl.style as unknown as Record<string, string>).msUserSelect = 'none';
        mathEl.style.cursor = 'default';
        mathEl.style.pointerEvents = 'none'; // 完全禁用指针事件
        
        // 设置tabindex为-1，防止获得焦点
        mathEl.setAttribute('tabindex', '-1');
        
        // 禁用所有子元素的交互
        const childElements = mathEl.querySelectorAll('*');
        childElements.forEach((child) => {
          if (child instanceof HTMLElement) {
            child.style.pointerEvents = 'none';
            child.setAttribute('tabindex', '-1');
          }
        });
      }
    });
  }

  // 获取渲染队列状态
  static getQueueStatus(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.renderQueue.length,
      isProcessing: this.isProcessing
    };
  }
}