问题序号：AI聊天Markdown标题未换行不渲染问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`AI 聊天 Markdown 标题渲染（### 语法容错）`
- **发现日期**：`2025-12-17`
- **解决状态**：`已解决`

## 问题现象
AI 回复文本中出现类似 `👇### 1. ...` 的内容时，`### 1. ...` 没有被渲染为 Markdown 标题，而是被当作普通文本显示。

## 复现步骤
1. 打开聊天页面。
2. 发送提示词，让 AI 输出包含 `👇### 1. ...`（即 `###` 前没有换行、不是从行首开始）。
3. 观察渲染：标题未生效。

## 用户体验
- 标题层级丢失，长文结构不清晰
- 用户需要自行辨认段落层级，阅读成本上升

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/composables/useMessageRenderer.ts`：MarkdownIt 渲染入口
- **涉及模块**：
  - Markdown 渲染

## 技术原因 (❌)
1. **Markdown 语法要求标题标记必须位于行首**：
   - 标题语法 `#{1,6} ` 必须从一行开头开始（允许前置空格）。
   - 当 `###` 前紧跟其他字符（如 emoji 或中文）时，MarkdownIt 会将其视为普通文本。

错误示例：
```text
超级直观👇### 1. 能量是单向流动的
```

## 正确实现方案 (✅)
1. **渲染前增加容错预处理**：
   - 在 Markdown 渲染前，对非代码块区域进行轻量替换：
   - 将非行首出现的 `#{1,6} ` 自动补换行：`👇### 1` -> `👇\n### 1`
2. **避免误伤代码块**：
   - 对 fenced code block（```...```）进行分段保护，不在代码块内执行替换。

正确示例（核心逻辑）：
```typescript
const preprocessMarkdownHeadings = (contentStr: string): string => {
  const parts = contentStr.split(/(```[\s\S]*?```)/g)
  return parts
    .map((part) => {
      if (part.startsWith('```')) return part
      return part.replace(/([^\n])\s*(#{1,6}\s+)/g, '$1\n$2')
    })
    .join('')
}
```

## 关键代码/公式
- `useMessageRenderer.ts`：在 `md.render()` 前插入 `preprocessMarkdownHeadings()`

## 测试验证
- **测试场景**：
  - 场景1：输入 `👇### 1. 标题`，期望渲染为标题。
  - 场景2：输入正常标题 `\n### 标题`，渲染不受影响。
  - 场景3：代码块中包含 `###`，不应被改写。
- **验证方法**：
  - 方法1：在聊天 UI 实测上述文本。
  - 方法2：在 `RenderTestView`（若存在）中输入同样内容验证。

## 预防措施
- 渲染层对 AI 输出做“宽容解析”，但要限定范围（避免误伤代码块/行内代码）。
- 对 Markdown 渲染增加回归用例：标题、列表、表格、代码块的组合输入。

## 相关链接/参考
- 相关文件：`imates-web/src/composables/useMessageRenderer.ts`

## 可复用经验
- 对 LLM 输出做 Markdown 渲染时，建议在渲染前做轻量纠错（如补换行、修正列表缩进），提高结构化输出的可读性。
