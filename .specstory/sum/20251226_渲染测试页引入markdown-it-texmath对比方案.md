问题序号：渲染测试页引入markdown-it-texmath对比方案

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`AI聊天公式渲染方案选型/回归验证效率`
- **发现日期**：`2025-12-26`
- **解决状态**：`已解决`

## 问题现象
线上/联调中发现 AI 输出混合中文、Unicode符号且大量使用 `\( ... \)` / `\[ ... \]` 定界符时，现有渲染方案在不同输入下表现不一致；缺少一个“同 Raw 并排对比”页面，难以快速确认是预处理问题还是渲染引擎问题。

## 复现步骤
1. 打开渲染测试页（无预处理）。
2. 输入包含 `\( ... \)`、`\[ ... \]`、`$...$`、`$$...$$` 的混合文本。
3. 观察不同渲染实现对同一 Raw 的差异。

## 用户体验
- 研发难以快速定位“是输入/换行问题还是渲染库问题”。
- 调整预处理规则后缺少快速回归手段。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/views/RenderTestView.vue`：新增第三列 texmath 渲染输出
  - `imates-web/src/router/index.ts`：放行 `/render-test` 测试路由（历史改动）
  - `imates-web/src/types/markdown-it-texmath.d.ts`：补充 TS 声明
- **涉及模块**：
  - Markdown 渲染（markdown-it）
  - 公式渲染（MathJax / KaTeX）

## 技术原因 (❌)
1. 仅有单一渲染路径时，无法快速确认 `\( \)` 定界符是否被引擎正确识别。
2. `markdown-it-texmath` 默认无 TS 声明导致 IDE/TS 报错。

## 正确实现方案 (✅)
1. 在 `RenderTestView.vue` 中增加 `markdown-it-texmath`（engine=katex, delimiters='mac'）作为第三套渲染对比。
2. 引入 KaTeX CSS，保证样式一致。
3. 增加 `declare module 'markdown-it-texmath'` 最小声明文件，消除 TS 报错。

```typescript
// ✅ RenderTestView.vue (核心片段)
import texmath from 'markdown-it-texmath'
import katex from 'katex'

const mdTexmath = new MarkdownIt({ html: true, linkify: true, typographer: false }).use(texmath, {
  engine: katex,
  delimiters: 'mac',
})
```

## 关键代码/公式
```typescript
// ✅ src/types/markdown-it-texmath.d.ts
declare module 'markdown-it-texmath' {
  const texmath: any
  export default texmath
}
```

## 测试验证
- **测试场景**：
  - 场景1：输入包含 `\(a>b\)` 的中文长句，三列对比 `\( \)` 支持情况。
  - 场景2：输入 `\[ ... \]`、`$$...$$` 的块级公式，观察段落/换行差异。
- **验证方法**：
  - 打开 `/#/render-test`，同一 Raw 下三列输出对比。

## 预防措施
- 将“渲染对比页”作为修改预处理规则后的固定回归入口。
- 新增依赖时同步检查 TS 声明（无则补 shim）。

## 相关链接/参考
- 相关文档：`imates-web/src/views/RenderTestView.vue`

## 可复用经验
- 复杂渲染问题优先做“同输入多引擎对比页”，减少猜测成本。
