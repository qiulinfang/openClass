问题4：LaTeX预处理定界符错误导致KaTeX不渲染问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`高`
- **影响范围**：`聊天消息 Markdown/公式渲染（ChatMessage/StreamingMessage）`
- **发现日期**：`2025-12-26`
- **解决状态**：`已解决`

## 问题现象
替换为 KaTeX 后，部分消息中公式表现为：
- `$$...$$` 定界符看似被处理了，但内容 `\setminus`、`\text{}` 等被**原样显示**
- 即公式未转为 KaTeX HTML（页面中没有 `.katex` / `.katex-display` 结构）

## 复现步骤
1. 聊天消息中包含 `\(...\)` 或 `\[...\]` 形式的 LaTeX。
2. 渲染后出现“只去掉定界符/或只做了部分处理，但 LaTeX 命令仍以文本显示”。

## 用户体验
- 数学公式不可读，影响题目讲解/解答的可用性。
- 用户需要手动理解 LaTeX 源码，学习成本高。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/composables/useMessageRenderer.ts`：LaTeX 预处理与 markdown-it 渲染
- **涉及模块**：
  - Markdown 渲染管线（useMessageRenderer -> ChatMessage/StreamingMessage v-html）

## 技术原因 (❌)
1. 预处理将 `\(...\)`、`\[...\]` 转换为 `$...$`、`$$...$$` 时，使用了不正确的替换字符串：
   - 生成了不合法的美元符号数量（例如 `$$$1$`、`$$$$$1$$$$`）
2. `markdown-it-katex` 对定界符非常敏感，定界符不合法会导致解析失败，最终回退为普通文本。

错误代码示例：
```ts
// ❌ 生成不合法的 $ 数量
processedContent = processedContent.replace(inlineRegex, '$$$1$')
processedContent = processedContent.replace(displayRegex, '$$$$$1$$$$')
```

## 正确实现方案 (✅)
1. 用函数式替换，明确输出规范的 `$...$` 与 `$$...$$`：

正确代码示例：
```ts
// ✅ 严格输出 $...$ 与 $$...$$
processedContent = processedContent.replace(inlineRegex, (_match, content) => {
  return `$${content}$`
})

processedContent = processedContent.replace(displayRegex, (_match, content) => {
  return `$$${content}$$`
})
```

## 关键代码/公式
- **关键代码片段**：
```ts
const inlineRegex = /\\\(\s*(.*?)\s*\\\)/gs
const displayRegex = /\\\[(.*?)\\\]/gs
```

## 测试验证
- **测试场景**：
  - 场景1：输入 `\(a^2+b^2=c^2\)` 应渲染为行内公式。
  - 场景2：输入 `\[\frac{1}{2}\pi r^2\]` 应渲染为块级公式。
  - 场景3：输入 `$A \setminus B$` / `$$A \setminus B = \{x\mid...\}$$`。
- **验证方法**：
  - 方法1：渲染后的 DOM 出现 `.katex` / `.katex-display`。
  - 方法2：页面不再显示 `\setminus`、`\text{}` 源码字面量。

## 预防措施
- 替换正则时避免使用“魔法数量”的 `$` 字符串，统一用函数式 replace。
- 为 Markdown/公式渲染添加单元测试用例（涵盖 `\(\)`、`\[\]`、`$ $`、`$$ $$`）。

## 相关链接/参考
- 参考资源：KaTeX 支持的 LaTeX 命令列表（KaTeX 官方文档）

## 可复用经验
- 公式渲染失败优先检查：
  - 定界符是否规范
  - 渲染前是否发生二次转义/破坏
