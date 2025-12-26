问题序号：markdown-it-texmath缺少TS声明导致编译报错问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`渲染测试页/TypeScript 编译与IDE提示`
- **发现日期**：`2025-12-26`
- **解决状态**：`已解决`

## 问题现象
引入 `markdown-it-texmath` 后，TypeScript 报错：无法找到模块 “markdown-it-texmath” 的声明文件，模块被推断为 any。

## 复现步骤
1. 在 `RenderTestView.vue` 中 `import texmath from 'markdown-it-texmath'`。
2. TS/IDE 报错缺少声明。

## 用户体验
- 开发期红线报错影响效率。
- 可能导致 CI/构建阶段类型检查失败（若启用）。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/views/RenderTestView.vue`
  - `imates-web/src/types/markdown-it-texmath.d.ts`

## 技术原因 (❌)
1. `markdown-it-texmath` 包未提供 types；项目中也未安装对应 `@types/*` 包。

## 正确实现方案 (✅)
1. 增加最小 shim 声明文件：

```typescript
// ✅ src/types/markdown-it-texmath.d.ts
declare module 'markdown-it-texmath' {
  const texmath: any
  export default texmath
}
```

## 关键代码/公式
见上。

## 测试验证
- **验证方法**：IDE 不再提示缺少声明；类型检查通过。

## 预防措施
- 新增依赖时检查是否带 types；无则补 shim 或锁定替代库。

## 相关链接/参考
- `imates-web/src/types/markdown-it-texmath.d.ts`

## 可复用经验
- 对无 types 的 JS 库，先用最小 `declare module` 恢复工程可用性，再逐步补充类型。
