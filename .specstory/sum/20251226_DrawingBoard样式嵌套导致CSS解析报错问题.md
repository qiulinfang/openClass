问题序号：04 DrawingBoard样式嵌套导致CSS解析报错问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`imates-web/src/components/DrawingBoard.vue 样式块；IDE/CSS 解析报错，可能影响样式构建`
- **发现日期**：`2025-12-26`
- **解决状态**：`进行中`

## 问题现象
- 在 `DrawingBoard.vue` 的 `<style scoped>` 中出现嵌套写法（如 `&:hover`、子选择器嵌套）。
- 当 style 未声明 `lang="scss"` 时，CSS 解析器会报错，例如：
  - `} expected`
  - `{ expected`
  - `at-rule or selector expected`

## 复现步骤
1. 打开 `DrawingBoard.vue`。
2. 确保 `<style scoped>` 未带 `lang="scss"`。
3. 在样式中存在 `&:hover` 等嵌套写法。
4. IDE/构建工具出现 CSS 解析错误或样式异常。

## 用户体验
- 样式可能失效，UI 异常。
- IDE 报错干扰开发效率。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/DrawingBoard.vue`
- **涉及模块**：
  - Vue SFC 样式预处理（SCSS）

## 技术原因 (❌)
1. 在纯 CSS 中不支持 `&` 语法和嵌套规则，该语法属于 SCSS/Less 等预处理能力。
2. `<style scoped>` 未声明 `lang="scss"` 时，构建与语言服务按 CSS 解析，必然报错。

错误示例：
```css
/* ❌ CSS 中不支持 & */
.pages-drawer-trigger {
  &:hover {
    transform: scale(1.1);
  }
}
```

## 正确实现方案 (✅)
1. 若要使用嵌套语法：将样式声明为 SCSS。
```vue
<style scoped lang="scss">
</style>
```
2. 或者将嵌套语法改写为标准 CSS：
```css
/* ✅ 标准 CSS */
.pages-drawer-trigger:hover {
  transform: scale(1.1);
}
```

## 关键代码/公式
- 关键点：`<style scoped lang="scss">` 或将 SCSS 语法改写为 CSS。

## 测试验证
- **测试场景**：
  - 场景1：构建/打包不应出现 CSS 解析错误。
  - 场景2：hover/active 等交互样式能正常生效。
- **验证方法**：
  - 方法1：IDE 不再提示 CSS 语法错误。
  - 方法2：运行后检查对应按钮 hover 效果。

## 预防措施
- 约定：凡使用 `&` 嵌套必须显式声明 `lang="scss"`。
- 代码评审检查：SFC style 语法与 lang 是否匹配。

## 相关链接/参考
- 相关文档：`imates-web/src/components/DrawingBoard.vue`

## 可复用经验
- 语法能力必须与预处理器配置保持一致，否则会出现“本地可写但构建/IDE 报错”的问题。
