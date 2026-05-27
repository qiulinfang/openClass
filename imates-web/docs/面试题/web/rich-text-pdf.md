# Web 面试题 - 富文本、文档与数学公式

> 本面试题基于项目实际代码，深入探讨技术实现细节与业务难点。

## 1. 富文本编辑器 (Tiptap)

### Q1: Tiptap 相比 Quill 有什么优势？为什么项目选择 Tiptap？
- **Headless 架构**: Tiptap 不提供 UI，只提供逻辑，完全由开发者控制样式。
- **基于 ProseMirror**: 业界最强大的富文本编辑器框架，架构优秀，扩展性强。
- **Vue 集成**: 原生支持 Vue 3，响应式数据绑定更自然。
- **项目选择**: 需要深度定制 UI（如数学公式、特殊符号），Tiptap 更灵活。

### Q2: Tiptap 的节点（Node）和扩展（Extension）是什么关系？如何自定义一个数学公式节点？
- **Node**: 表示文档中的具体内容（如 paragraph, heading, mathBlock）。
- **Extension**: 扩展节点行为的配置（如键盘快捷键、粘贴规则）。
- **自定义节点**: 
  ```typescript
  Node.create({
    name: 'mathBlock',
    group: 'block',
    content: 'text*',
    parseHTML: () => [{ tag: 'div.math-block' }],
    renderHTML: () => ['div', { class: 'math-block' }, 0],
  })
  ```

### Q3: 编辑器如何处理图片上传？项目中的实现逻辑是什么？
- **流程**:
  1. 监听 `drop` 或 `paste` 事件。
  2. 获取文件并验证类型。
  3. 上传到服务器获取 URL。
  4. 插入图片节点。
- **项目实践**: 使用 `input[type=file]` 选择图片，转换为 Base64 或上传获取 URL。

## 2. PDF 处理

### Q4: PDF.js 和 MuPDF 有什么区别？项目中为什么两者都用？
- **PDF.js**: 
  - Mozilla 开发，纯 JavaScript 实现。
  - 渲染质量高，兼容性好。
  - 性能相对较低。
- **MuPDF**: 
  - C++ 实现，WebAssembly 封装。
  - 性能极高，体积小。
  - API 更底层，控制力强。
- **项目策略**: 
  - PDF.js 用于通用 PDF 渲染。
  - MuPDF 用于需要高性能的场景（如大文档、频繁翻页）。

### Q5: PDF 渲染的性能瓶颈是什么？如何实现分页加载和预渲染？
- **瓶颈**: 
  - PDF 解析和渲染是 CPU 密集型操作。
  - 大型 PDF 内存占用高。
- **优化策略**:
  - **分页加载**: 只渲染当前页和相邻页。
  - **预渲染**: 提前渲染下一页到离屏 Canvas。
  - **缓存**: 渲染结果缓存，避免重复渲染。

### Q6: PDF 标注数据如何持久化？项目中使用什么存储方案？
- **存储**: 使用 IndexedDB 存储标注数据（笔迹、颜色、坐标等）。
- **数据结构**: 
  ```typescript
  interface Stroke {
    id: string
    type: 'pen' | 'highlighter' | 'rectangle'
    pageIndex: number
    points: Point[]
    color: string
    width: number
    opacity: number
  }
  ```
- **同步**: 标注变更时自动保存，退出后重新打开时恢复。

## 3. 数学公式

### Q7: 项目中如何处理多种 LaTeX 格式的输入？请结合 `useMessageRenderer` 说明。
- **输入格式**:
  - `\(...\)` 行内公式
  - `\[...\]` 块级公式
  - `$$...$$` 块级公式
  - MathLive 输出格式（`\begin{math}...\end{math}`）
  - MathML 格式
- **预处理**: 
  - 将不同格式统一转换为 `$$...$$`。
  - 处理分段函数等复杂结构，自动升级为块级显示。
  - HTML 实体反转义（`&lt;` -> `<`）。

### Q8: KaTeX 和 MathJax 有什么区别？为什么 KaTeX 性能更好？
- **KaTeX**: 
  - 使用预编译的字体和符号表。
  - 同步渲染，不等待字体加载完成。
  - 渲染速度是 MathJax 的 10 倍以上。
- **MathJax**: 
  - 动态加载字体和配置。
  - 功能更全（支持更多宏）。
  - 适合需要复杂数学功能的场景。

### Q9: MathLive 的虚拟键盘是如何工作的？项目中如何集成？
- **原理**: 
  - 提供可交互的公式输入界面。
  - 将用户输入转换为 LaTeX 或 MathML。
  - 支持语音输入、手写识别（部分平台）。
- **集成**: 
  ```typescript
  import { createMathField } from 'mathlive'
  const mf = createMathField(element, { virtualKeyboardMode: 'manual' })
  ```

### Q10: 公式渲染的缓存机制是如何设计的？请说明项目中的实现。
- **实现**: 使用 Map 存储渲染结果的 HTML 字符串。
- **缓存策略**: 
  - 设置最大缓存数量（100 条）。
  - 超过时删除最旧的缓存。
  - 相同内容直接返回缓存结果。

## 4. Markdown 解析

### Q11: `markdown-it` 的插件机制是什么？项目中如何使用？
- **机制**: 
  - 使用 `markdownIt.use(plugin)` 加载插件。
  - 插件可以监听渲染生命周期，修改 AST 或输出。
- **项目插件**: 
  - `markdown-it-mathjax3`: 数学公式支持。
  - 自定义插件处理代码块高亮。

### Q12: 项目中如何处理 Markdown 中的代码块语法高亮？
- **方案**: 使用 Prism.js 或 highlight.js。
- **集成**: 通过 `markdown-it` 的 `highlight` 选项配置。
- **优化**: 按需加载语言支持，减少包体积。
