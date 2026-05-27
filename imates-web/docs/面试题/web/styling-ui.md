# Web 面试题 - UI 框架与样式

> 本面试题基于项目实际代码，深入探讨技术实现细节与业务难点。

## 1. Tailwind CSS 深度理解

### Q1: Tailwind 的 JIT (Just-In-Time) 模式是如何工作的？它解决了什么问题？
- **原理**: JIT 在构建时按需生成 CSS，而不是像传统方式预生成所有类。
- **解决的问题**:
  - 传统方式生成巨大的 CSS 文件（数 MB），JIT 模式下只有实际使用的类。
  - 支持任意值（Arbitrary values），如 `top-[117px]`，无需在配置中预设。
  - 支持变体（Variants），如 `hover:`, `focus:`, `md:` 等。

### Q2: 项目中如何自定义 Tailwind 配置？有哪些最佳实践？
- **配置方式**: 在 `tailwind.config.js` 中扩展 `theme` 对象。
- **最佳实践**:
  - 使用 CSS 变量定义设计系统颜色。
  - 使用 `@layer` 组织自定义样式。
  - 使用 `@apply` 提取重复的类组合（但要谨慎，过度使用会导致耦合）。

### Q3: Tailwind 的 `dark:` 模式是如何实现的？如何配合 Quasar 的深色模式？
- **实现**: 通过在 HTML 标签上添加 `dark` 类来切换。
- **Quasar 集成**: Quasar 的 `Dark` 插件可以自动切换 Tailwind 的深色模式。

## 2. Quasar Framework

### Q4: Quasar 的响应式断点系统是什么？项目中如何处理移动端和桌面端的差异？
- **断点**: Quasar 内置 XS, SM, MD, LG, XL 五个断点。
- **使用**: 通过 `q-btn` 的 `dense`, `flat` 等属性和 `:class` 条件类实现响应式。
- **项目实践**: 本项目使用 Quasar 的 `q-splitter` 实现 PDF 阅读器和聊天面板的分栏布局。

### Q5: Quasar 的插件系统是如何工作的？项目中使用哪些插件？
- **常用插件**: 
  - `Notify`: 消息通知
  - `Dialog`: 对话框
  - `Loading`: 加载状态
  - `Dark`: 深色模式
- **原理**: 通过 `Quasar` 全局对象的方法调用，原生端通过 Capacitor 桥接。

### Q6: 项目中如何处理组件的按需加载？Quasar 的 Tree Shaking 机制是什么？
- **按需引入**: 只导入使用的组件，如 `import { QBtn } from 'quasar'`。
- **Tree Shaking**: Vite 会自动移除未使用的代码，配合 Quasar 的模块化设计效果显著。

## 3. 滚动与动画

### Q7: `@better-scroll` 相比原生滚动有什么优势？项目中如何处理下拉刷新？
- **优势**:
  - 解决移动端 Webview 滚动不流畅的问题。
  - 提供丰富的滚动行为配置（弹性、惯性、边界回弹）。
  - 支持嵌套滚动（横向滚动列表内嵌套纵向滚动）。
- **下拉刷新**: 使用 `@better-scroll/pull-down` 插件，监听 `pullingDown` 事件。

### Q8: 项目中 Lottie 动画的使用场景是什么？如何优化加载性能？
- **场景**: 启动页动画、交互反馈动画、教学场景动画。
- **优化**:
  - 使用 `lottie-web` 的 `preload` 预加载。
  - 使用 `bodymovin` 导出精简的 JSON（移除不必要的元数据）。
  - 移动端使用 `renderer: 'svg'` 减少内存占用。

### Q9: CSS 动画和 JS 动画有什么区别？什么场景下选择哪种方案？
- **CSS 动画**: 
  - 优点：运行在合成线程，不阻塞主线程，性能好。
  - 适用：简单的属性变化（opacity, transform）。
- **JS 动画**:
  - 优点：精确控制，可实现复杂逻辑。
  - 适用：需要中间状态控制、与其他逻辑耦合的场景。
- **项目实践**: PDF 页面切换使用 CSS transform，橡皮擦光标跟随使用 JS RAF。

## 4. 样式架构

### Q10: 项目中如何组织 CSS 样式？BEM 命名规范还是 Utility-First？
- **混合模式**: 
  - 组件样式使用 Scoped CSS + BEM 变体（如 `.pdf-page__canvas`）。
  - 布局样式使用 Tailwind Utility 类。
- **优势**: 结合两者的灵活性，既能快速构建布局，又能封装可复用的组件样式。
