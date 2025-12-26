问题3：替换markdown-it-mathjax3后Vite启动失败问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`高`
- **影响范围**：`imates-web 开发环境启动（vite dev）`
- **发现日期**：`2025-12-26`
- **解决状态**：`进行中`

## 问题现象
将项目从 `markdown-it-mathjax3` 替换为 `markdown-it-katex` 后，执行 `npm run dev` 报错：
- `Error: ENOENT: no such file or directory, open ... node_modules/markdown-it-mathjax3/index.js`
- 同时出现 Vite 提示：`Assets in public directory cannot be imported from JavaScript...`（与本问题无直接因果，但会干扰排查）。

## 复现步骤
1. 修改依赖：从 `markdown-it-mathjax3` 切换到 `markdown-it-katex`。
2. 未完整同步安装（或 Vite 仍使用旧预构建缓存）。
3. 执行 `npm run dev`。
4. 触发 Vite 依赖更新/预构建时尝试读取已不存在的 `markdown-it-mathjax3`，导致 ENOENT。

## 用户体验
- 本地开发无法启动，阻塞调试与功能验证。
- 报错信息包含多条无关警告，排查成本增加。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/package.json`：依赖替换
  - `imates-web/src/composables/useMessageRenderer.ts`：markdown 插件切换
  - `imates-web/node_modules/.vite/*`：Vite 预构建缓存（依赖优化产物）
- **涉及模块**：
  - Vite optimizeDeps 预构建

## 技术原因 (❌)
1. Vite 会对依赖进行预构建并缓存到 `node_modules/.vite`。
2. 当依赖从 `markdown-it-mathjax3` 替换为 `markdown-it-katex` 时，如果：
   - `node_modules` 尚未完整同步（仅局部 install），或
   - `node_modules/.vite` 缓存仍引用旧依赖
   Vite 仍会尝试读取旧包入口，导致 `ENOENT`。

错误现象（控制台）：
```text
Error: ENOENT: no such file or directory, open '.../node_modules/markdown-it-mathjax3/index.js'
```

## 正确实现方案 (✅)
1. 依赖替换后必须进行一次完整依赖同步：
   - `npm install`
2. 清理 Vite 依赖预构建缓存：
   - 删除 `imates-web/node_modules/.vite`
3. 重启 dev server：
   - `npm run dev`

## 关键代码/公式
- **关键点**：Vite 缓存目录
```text
imates-web/node_modules/.vite
```

## 测试验证
- **测试场景**：
  - 场景1：删除 `node_modules/.vite` 后启动 dev。
  - 场景2：执行 `npm install` 后启动 dev。
- **验证方法**：
  - 方法1：`npm run dev` 不再出现 `markdown-it-mathjax3` ENOENT。
  - 方法2：页面中公式 DOM 出现 `.katex` / `.katex-display`。

## 预防措施
- 依赖替换流程标准化：
  - 更新 `package.json` 后统一执行 `npm install`。
  - 遇到 Vite 依赖入口 ENOENT，优先清理 `node_modules/.vite`。
- 在 PR/提交说明中明确：Vite 缓存清理步骤。

## 相关链接/参考
- 相关文档：Vite optimizeDeps 机制（官方文档）

## 可复用经验
- “移除依赖但 dev 仍引用旧包”通常不是代码问题，而是**构建缓存**问题。
- ENOENT 指向 `node_modules/.vite` 或已删除包时，先做缓存清理再定位代码。
