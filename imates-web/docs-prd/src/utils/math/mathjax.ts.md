# mathjax.ts PRD 文档

## 📋 概述

**文件路径**：`src/utils/math/mathjax.ts`  
**文件类型**：`TypeScript 工具类`  
**主要职责**：MathJax 数学公式渲染工具类，提供高性能的数学公式渲染功能，支持懒加载、批量渲染、渲染队列管理等功能

## 🎯 功能需求

### 1. 核心功能

#### 1.1 MathJax 初始化
- **等待加载**：
  - 等待 MathJax 库加载完成
  - 支持 Promise 模式，确保渲染时 MathJax 已就绪
  - 单例模式，避免重复初始化
- **就绪状态管理**：
  - 跟踪 MathJax 是否已加载完成
  - 缓存 Promise，避免重复等待

#### 1.2 数学公式渲染
- **单个元素渲染**：
  - 渲染指定元素中的数学公式
  - 支持懒加载模式（使用 Intersection Observer）
  - 支持立即渲染模式
- **批量渲染**：
  - 批量渲染多个元素中的数学公式
  - 使用队列管理，避免性能问题
  - 支持优先级排序
- **全文档渲染**：
  - 渲染整个文档中的所有数学公式
  - 用于页面加载完成后的一次性渲染

#### 1.3 懒加载机制
- **Intersection Observer**：
  - 使用 Intersection Observer 实现懒加载
  - 元素进入视口时自动触发渲染
  - 可配置 `rootMargin` 和 `threshold`
  - 默认提前 50px 开始渲染
- **渲染队列**：
  - 管理待渲染的元素队列
  - 支持优先级排序
  - 批量处理，避免性能问题
  - 每批处理 3 个元素，延迟 16ms（约 60fps）

#### 1.4 渲染清理
- **清除渲染**：
  - 清除指定元素中的 MathJax 渲染
  - 重置元素状态，允许重新渲染
- **资源清理**：
  - 清理渲染队列
  - 断开 Intersection Observer
  - 清理已渲染元素记录

#### 1.5 交互禁用
- **禁用右键菜单**：
  - 禁用 MathJax 渲染元素的右键菜单
  - 防止 MathLive 功能列表弹出
- **禁用触摸事件**：
  - 禁用触摸事件（touchstart、touchend、touchmove）
  - 防止长按弹出菜单
- **禁用鼠标事件**：
  - 禁用鼠标事件（mousedown、mouseup、click）
  - 禁用拖拽和选择事件
- **禁用焦点**：
  - 设置 `tabindex="-1"` 防止获得焦点
  - 设置 `pointer-events: none` 完全禁用指针事件

#### 1.6 性能优化
- **渲染缓存**：
  - 使用 `WeakSet` 记录已渲染的元素
  - 避免重复渲染
- **批量处理**：
  - 批量渲染多个元素，提高性能
  - 每批处理 3 个元素
- **异步处理**：
  - 使用异步队列处理渲染任务
  - 避免阻塞主线程

### 2. 功能边界

#### 2.1 负责的功能
- ✅ MathJax 库的初始化和等待
- ✅ 数学公式的渲染和清理
- ✅ 懒加载机制的实现
- ✅ 渲染队列的管理
- ✅ 交互事件的禁用

#### 2.2 不负责的功能
- ❌ MathJax 库的加载（由 HTML 或构建工具负责）
- ❌ 数学公式内容的解析（由 Markdown 渲染器负责）
- ❌ 数学公式样式的定制（由 CSS 负责）
- ❌ 数学公式的编辑（由 MathLive 或其他编辑器负责）

## 🔧 技术实现

### 1. 依赖关系

#### 1.1 导入依赖

```typescript
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
```

#### 1.2 被依赖
- `ChatMessage.vue`：使用 `MathJaxUtils.renderMath()` 渲染消息中的数学公式
- `useMessageRenderer.ts`：可能使用 MathJax 进行公式渲染
- `lazy-message-renderer.ts`：使用 MathJax 进行懒加载渲染

### 2. 关键代码逻辑

#### 2.1 MathJax 等待逻辑

```typescript
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
      // 轮询检查 MathJax 是否加载
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
```

#### 2.2 Intersection Observer 初始化

```typescript
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
```

#### 2.3 渲染队列管理

```typescript
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
      const batch = this.renderQueue.splice(0, this.BATCH_SIZE); // 每批处理3个元素
      
      // 批量渲染
      const elements = batch.map(task => task.element);
      await this.batchRenderMath(elements);

      // 标记为已渲染
      elements.forEach(el => this.renderedElements.add(el));

      // 如果还有任务，延迟处理下一批
      if (this.renderQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY)); // 16ms延迟
      }
    }
  } catch (error) {
    console.warn('MathJax 渲染队列处理错误:', error);
  } finally {
    this.isProcessing = false;
  }
}
```

#### 2.4 渲染方法

```typescript
// 渲染指定元素中的数学公式
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

// 渲染整个文档中的数学公式
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
```

#### 2.5 清理方法

```typescript
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
```

#### 2.6 交互禁用

```typescript
// 禁用MathJax右键菜单和MathLive功能列表
static disableMathJaxContextMenu(element: HTMLElement): void {
  const mathElements = element.querySelectorAll('.mjx-chtml, .mjx-math, [data-mjx-texclass]');
  
  mathElements.forEach((mathEl) => {
    if (mathEl instanceof HTMLElement) {
      // 禁用右键菜单
      mathEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, true);
      
      // 禁用触摸事件
      mathEl.addEventListener('touchstart', (e) => e.preventDefault(), true);
      mathEl.addEventListener('touchend', (e) => e.preventDefault(), true);
      mathEl.addEventListener('touchmove', (e) => e.preventDefault(), true);
      
      // 禁用鼠标事件
      mathEl.addEventListener('mousedown', (e) => e.preventDefault(), true);
      mathEl.addEventListener('click', (e) => e.preventDefault(), true);
      
      // 设置样式
      mathEl.style.userSelect = 'none';
      mathEl.style.pointerEvents = 'none';
      mathEl.style.cursor = 'default';
      mathEl.setAttribute('tabindex', '-1');
    }
  });
}
```

### 3. 使用示例

#### 3.1 基础使用

```typescript
import { MathJaxUtils } from '@/utils/math/mathjax'

// 渲染单个元素
const element = document.getElementById('math-content')
if (element) {
  await MathJaxUtils.renderMath(element, true) // 使用懒加载
}

// 立即渲染（不使用懒加载）
await MathJaxUtils.renderMath(element, false)

// 渲染整个文档
await MathJaxUtils.renderAll()
```

#### 3.2 在 Vue 组件中使用

```typescript
// ChatMessage.vue
import { MathJaxUtils } from '@/utils/math/mathjax'
import { nextTick } from 'vue'

const setMessageRef = (el: Element | ComponentPublicInstance | null) => {
  if (el && el instanceof HTMLElement) {
    nextTick(() => {
      MathJaxUtils.renderMath(el, true) // 使用懒加载
    })
  }
}
```

#### 3.3 清理使用

```typescript
// 清除渲染
await MathJaxUtils.clearMath(element)

// 清理资源（组件卸载时）
onUnmounted(() => {
  MathJaxUtils.cleanup()
})
```

## 🔄 迁移到 React Native

### 1. 等价实现

#### 1.1 当前实现
- **实现方式**：MathJax JavaScript 库 + Web API
- **特点**：Web 端专用，支持 LaTeX 渲染

#### 1.2 React Native 实现
- **实现方式**：WebView + MathJax 或 react-native-katex
- **特点**：需要 WebView 支持，或使用轻量级替代方案

### 2. 需要的第三方库

```json
{
  "react-native": "^0.72.0",
  "react-native-webview": "^13.0.0",        // WebView 方案
  "react-native-katex": "^0.1.0",           // Katex 方案（轻量级）
  "react-native-math-view": "^0.1.0"        // MathView 组件（可选）
}
```

### 3. React Native 实现示例

#### 方案 A：WebView 方案（推荐）

```typescript
// MathJaxUtils.ts (React Native WebView 版本)
import { WebView } from 'react-native-webview'

export class MathJaxUtils {
  private static renderQueue: Array<{ id: string; content: string }> = []
  private static isProcessing = false
  private static readonly BATCH_SIZE = 3
  private static readonly BATCH_DELAY = 16

  // 渲染单个公式
  static async renderMath(content: string, elementId: string): Promise<void> {
    this.renderQueue.push({ id: elementId, content })
    this.processRenderQueue()
  }

  // 处理渲染队列
  private static async processRenderQueue(): Promise<void> {
    if (this.isProcessing || this.renderQueue.length === 0) return

    this.isProcessing = true

    try {
      while (this.renderQueue.length > 0) {
        const batch = this.renderQueue.splice(0, this.BATCH_SIZE)
        
        // 批量渲染（通过 WebView）
        for (const task of batch) {
          await this.renderInWebView(task.content, task.id)
        }

        if (this.renderQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY))
        }
      }
    } finally {
      this.isProcessing = false
    }
  }

  // 在 WebView 中渲染
  private static async renderInWebView(content: string, elementId: string): Promise<void> {
    // 使用 WebView 加载 MathJax 并渲染
    // 返回渲染后的 HTML
  }

  // 生成 WebView HTML
  static generateMathJaxHTML(content: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
          <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
          <style>
            body { margin: 0; padding: 10px; }
            .math-content { font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="math-content">${content}</div>
          <script>
            window.MathJax = {
              tex: {
                inlineMath: [['$', '$']],
                displayMath: [['$$', '$$']]
              }
            };
            window.MathJax.startup.promise.then(() => {
              window.MathJax.typesetPromise().then(() => {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'rendered',
                  content: document.body.innerHTML
                }));
              });
            });
          </script>
        </body>
      </html>
    `
  }
}

// MathView 组件
import React from 'react'
import { WebView } from 'react-native-webview'
import { MathJaxUtils } from '@/utils/math/mathjax'

interface MathViewProps {
  content: string
  style?: object
}

export const MathView: React.FC<MathViewProps> = ({ content, style }) => {
  const html = MathJaxUtils.generateMathJaxHTML(content)

  return (
    <WebView
      source={{ html }}
      style={[{ height: 200 }, style]}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    />
  )
}
```

#### 方案 B：Katex 方案（轻量级）

```typescript
// MathJaxUtils.ts (React Native Katex 版本)
import Katex from 'react-native-katex'

export class MathJaxUtils {
  // 渲染单个公式
  static async renderMath(content: string): Promise<string> {
    // Katex 直接渲染，返回 HTML
    return content
  }

  // 生成 Katex HTML
  static generateKatexHTML(content: string): string {
    // 使用 Katex 渲染内容
    return content
  }
}

// MathView 组件
import React from 'react'
import Katex from 'react-native-katex'

interface MathViewProps {
  content: string
  style?: object
}

export const MathView: React.FC<MathViewProps> = ({ content, style }) => {
  return (
    <Katex expression={content} style={style} />
  )
}
```

### 4. 注意事项

#### 4.1 性能考虑
- **WebView 方案**：性能较好，但体积较大
- **Katex 方案**：体积小，但功能受限

#### 4.2 样式定制
- **WebView 方案**：可以通过 CSS 自定义样式
- **Katex 方案**：样式定制较受限

#### 4.3 交互禁用
- **WebView 方案**：可以通过 JavaScript 禁用交互
- **Katex 方案**：默认不可交互，无需禁用

## ⚠️ 迁移风险

### 高风险项

1. **MathJax 库依赖**：
   - **风险**：React Native 无法直接使用 MathJax JavaScript 库
   - **解决方案**：使用 WebView 或替代方案（Katex）
   - **影响**：性能和体积可能受影响

2. **懒加载机制**：
   - **风险**：React Native 的 Intersection Observer 需要使用第三方库
   - **解决方案**：使用 `react-native-intersection-observer` 或自定义实现
   - **影响**：需要调整懒加载逻辑

3. **批量渲染**：
   - **风险**：WebView 的批量渲染机制可能不同
   - **解决方案**：调整批量渲染逻辑，适配 WebView
   - **影响**：性能可能受影响

### 中风险项

1. **公式渲染质量**：
   - Katex 和 MathJax 的渲染效果可能略有差异
   - 需要测试公式显示是否正确

2. **交互禁用**：
   - WebView 的交互禁用可能需要不同的实现方式
   - 需要测试交互是否正确禁用

## 🧪 测试要点

### 功能测试

1. **渲染测试**：
   - ✅ 单个公式正确渲染
   - ✅ 批量公式正确渲染
   - ✅ 懒加载正常工作
   - ✅ 渲染队列正确处理

2. **清理测试**：
   - ✅ 清除渲染功能正常
   - ✅ 资源清理无内存泄漏

3. **交互禁用测试**：
   - ✅ 右键菜单正确禁用
   - ✅ 触摸事件正确禁用
   - ✅ 鼠标事件正确禁用

### 性能测试

1. **大量公式渲染**：
   - 测试大量公式时的渲染性能
   - 测试批量渲染的效果

2. **懒加载性能**：
   - 测试懒加载是否提升性能
   - 测试 Intersection Observer 的性能

## 📚 参考资源

### 相关文档
- [MathJax 官方文档](https://www.mathjax.org/)
- [react-native-webview 文档](https://github.com/react-native-webview/react-native-webview)
- [react-native-katex 文档](https://github.com/qiuxiang/react-native-katex)

### 相关文件
- `src/components/chat/ChatMessage.vue` - 使用 MathJax 的组件
- `src/composables/useMessageRenderer.ts` - 消息渲染工具
- `src/utils/render/lazy-message-renderer.ts` - 懒加载渲染器

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**最后更新**：2025-01-XX  
**维护者**：开发团队
