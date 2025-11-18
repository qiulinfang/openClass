# Chrome 99 CSS 兼容性分析报告

## 概述

Chrome 99 发布于 2022 年 3 月。本报告分析了 imates-web 项目中使用的 CSS 语法，识别出在 Chrome 99 中不支持的特性。

## 不兼容的 CSS 特性

### 1. `:has()` 伪类选择器 ❌

**支持版本**: Chrome 105+ (2022年8月)

**问题位置**:
- `imates-web/src/components/MathFormulaEditor.vue` (CSS 和 JavaScript 中多处使用)

**CSS 中的使用**:
```866:897:imates-web/src/components/MathFormulaEditor.vue
.ql-editor p:has(.ql-math-embed) {
  display: inline;
  margin: 0;
  padding: 0;
}

.ql-editor p:has(br:only-child) {
  display: none !important;
}

.ql-editor p:has(br) {
  display: none !important;
}

.ql-editor:has(p:empty) {
  display: none;
}
```

**JavaScript 中的使用**:
```332:332:imates-web/src/components/MathFormulaEditor.vue
const emptyParagraphs = quillEditor.querySelectorAll('p:empty, p:has(br:only-child)')
```

```530:530:imates-web/src/components/MathFormulaEditor.vue
const emptyParagraphs = quillEditor.querySelectorAll('p:empty, p:has(br:only-child)')
```

**影响**: 
- MathFormulaEditor 组件中的 CSS 选择器在 Chrome 99 中无法正常工作
- JavaScript 中的 `querySelectorAll('p:has(...)')` 在 Chrome 99 中会抛出异常或返回空结果
- 可能导致公式显示异常、空段落显示等问题
- JavaScript 错误可能导致编辑器功能异常

**解决方案**:
1. 使用 JavaScript 动态添加类名替代 `:has()` 选择器
2. 使用 `@supports selector(:has(*))` 提供降级方案
3. 使用其他选择器组合替代（如 `.ql-editor p.ql-math-embed`）

---

## 兼容的 CSS 特性（Chrome 99 支持）

### 1. `backdrop-filter` ✅

**支持版本**: Chrome 76+ (2019年7月)

**使用位置**:
- `imates-web/src/styles/gemini-notify.css`
- `imates-web/src/components/PdfPage.vue`
- `imates-web/src/views/PhotoSearchView.vue`
- `imates-web/src/views/KnowledgeGraphView.vue`
- 等多个文件

**状态**: Chrome 99 完全支持

---

### 2. `aspect-ratio` ✅

**支持版本**: Chrome 88+ (2021年1月)

**使用位置**:
- `imates-web/src/views/MyFavoritesView.vue`
- `imates-web/src/views/KnowledgeGraphView.vue`
- `imates-web/src/components/SessionItem.vue`
- `imates-web/src/components/DraftDialog.vue`

**状态**: Chrome 99 完全支持

---

### 3. `:focus-within` ✅

**支持版本**: Chrome 60+ (2017年4月)

**使用位置**:
- `imates-web/src/components/chat/ChatInput.vue`
- `imates-web/src/views/KnowledgeGraphView.vue`
- `imates-web/src/components/MathFormulaEditor.vue`

**状态**: Chrome 99 完全支持

---

### 4. CSS 自定义属性（CSS Variables）✅

**支持版本**: Chrome 49+ (2016年3月)

**使用位置**: 所有样式文件

**状态**: Chrome 99 完全支持

---

### 5. `@media (prefers-color-scheme: dark)` ✅

**支持版本**: Chrome 76+ (2019年7月)

**使用位置**:
- `imates-web/src/styles/mathlive-custom.css`

**状态**: Chrome 99 完全支持

---

### 6. `gap` 属性（Flexbox/Grid）✅

**支持版本**: Chrome 84+ (2020年7月)

**使用位置**: 多个组件样式

**状态**: Chrome 99 完全支持

---

## 详细问题分析

### `:has()` 选择器问题详解

#### 问题代码位置

**文件**: `imates-web/src/components/MathFormulaEditor.vue`

**CSS 行号**: 866, 881, 886, 895

**JavaScript 行号**: 332, 530

**问题代码**:
```css
/* 第 866 行 */
.ql-editor p:has(.ql-math-embed) {
  display: inline;
  margin: 0;
  padding: 0;
}

/* 第 881 行 */
.ql-editor p:has(br:only-child) {
  display: none !important;
}

/* 第 886 行 */
.ql-editor p:has(br) {
  display: none !important;
}

/* 第 895 行 */
.ql-editor:has(p:empty) {
  display: none;
}
```

#### 影响范围

1. **公式显示问题**: `.ql-editor p:has(.ql-math-embed)` 无法匹配，可能导致公式段落显示异常
2. **空段落隐藏失效**: `.ql-editor p:has(br:only-child)` 和 `.ql-editor p:has(br)` 无法工作，空段落可能显示
3. **编辑器空状态检测失效**: `.ql-editor:has(p:empty)` 无法工作，空编辑器可能显示不必要的内容

#### 修复建议

**方案 1: 使用 JavaScript 动态添加类名（推荐）**

```javascript
// 兼容 Chrome 99 的辅助函数
const findParagraphsWithBr = (container) => {
  const paragraphs = container.querySelectorAll('p')
  const result = []
  paragraphs.forEach(p => {
    const children = Array.from(p.childNodes)
    // 检查是否只包含 br
    if (children.length === 1 && children[0].tagName === 'BR') {
      result.push(p)
    }
    // 或者检查是否包含 br
    if (p.querySelector('br')) {
      result.push(p)
    }
  })
  return result
}

// 替换原来的 querySelectorAll('p:has(br:only-child)')
const emptyParagraphs = findParagraphsWithBr(quillEditor)
emptyParagraphs.forEach(p => p.remove())

// 在组件中添加逻辑
const updateParagraphClasses = () => {
  const editor = quillEditor.value
  if (!editor) return
  
  const paragraphs = editor.querySelectorAll('p')
  paragraphs.forEach(p => {
    // 检查是否包含公式
    if (p.querySelector('.ql-math-embed')) {
      p.classList.add('has-math-embed')
    }
    // 检查是否只包含 br
    const children = Array.from(p.childNodes)
    if (children.length === 1 && children[0].tagName === 'BR') {
      p.classList.add('has-only-br')
    }
    // 检查是否包含 br
    if (p.querySelector('br')) {
      p.classList.add('has-br')
    }
  })
  
  // 检查编辑器是否为空
  const isEmpty = editor.querySelectorAll('p:empty').length > 0
  if (isEmpty) {
    editor.classList.add('has-empty-paragraphs')
  }
}
```

然后修改 CSS:
```css
.ql-editor p.has-math-embed {
  display: inline;
  margin: 0;
  padding: 0;
}

.ql-editor p.has-only-br {
  display: none !important;
}

.ql-editor p.has-br {
  display: none !important;
}

.ql-editor.has-empty-paragraphs {
  display: none;
}
```

**方案 2: 使用特性查询提供降级方案**

```css
/* 支持 :has() 的浏览器 */
@supports selector(:has(*)) {
  .ql-editor p:has(.ql-math-embed) {
    display: inline;
    margin: 0;
    padding: 0;
  }
  
  .ql-editor p:has(br:only-child) {
    display: none !important;
  }
  
  .ql-editor p:has(br) {
    display: none !important;
  }
  
  .ql-editor:has(p:empty) {
    display: none;
  }
}

/* 不支持 :has() 的浏览器降级方案 */
@supports not selector(:has(*)) {
  /* 使用其他选择器或 JavaScript 处理 */
  .ql-editor p.ql-math-embed {
    display: inline;
    margin: 0;
    padding: 0;
  }
}
```

**方案 3: 使用其他选择器组合**

```css
/* 替代 .ql-editor p:has(.ql-math-embed) */
.ql-editor p .ql-math-embed {
  /* 直接作用于公式元素 */
}

/* 替代 .ql-editor p:has(br:only-child) */
.ql-editor p:only-child br:only-child {
  /* 但这种方式不够精确 */
}
```

---

## 兼容性检查清单

### 需要修复的问题

- [ ] **高优先级**: `MathFormulaEditor.vue` 中的 `:has()` 选择器需要修复
  - **CSS 问题**: 4 处使用 `:has()` 选择器（行号: 866, 881, 886, 895）
  - **JavaScript 问题**: 2 处使用 `querySelectorAll('p:has(...)')`（行号: 332, 530）
  - **影响**: 
    - 公式编辑器显示异常
    - JavaScript 可能抛出异常导致功能失效
    - 空段落无法正常隐藏
  - **建议**: 
    1. 使用 JavaScript 辅助函数替代 `querySelectorAll('p:has(...)')`
    2. 使用 JavaScript 动态添加类名替代 CSS `:has()` 选择器
    3. 或使用 `@supports selector(:has(*))` 提供降级方案

### 无需修复（Chrome 99 支持）

- [x] `backdrop-filter` - 完全支持
- [x] `aspect-ratio` - 完全支持
- [x] `:focus-within` - 完全支持
- [x] CSS 自定义属性 - 完全支持
- [x] `@media (prefers-color-scheme: dark)` - 完全支持
- [x] `gap` 属性 - 完全支持
- [x] `cubic-bezier()` - 完全支持
- [x] `transform` - 完全支持
- [x] `linear-gradient` - 完全支持
- [x] `border-radius` - 完全支持
- [x] `box-shadow` - 完全支持
- [x] `transition` - 完全支持
- [x] `animation` - 完全支持
- [x] `@keyframes` - 完全支持
- [x] `:deep()` (Vue 深度选择器) - 编译后支持

---

## 测试建议

1. **在 Chrome 99 中测试**:
   - MathFormulaEditor 组件的公式显示
   - 空段落是否正常隐藏
   - 编辑器空状态是否正确显示

2. **使用特性查询检测**:
   ```css
   @supports selector(:has(*)) {
     /* 支持 :has() */
   }
   ```

3. **提供降级方案**:
   - 为不支持 `:has()` 的浏览器提供替代方案
   - 使用 JavaScript 动态处理样式

---

## 总结

**主要问题**: 
- `:has()` 选择器在 Chrome 99 中不支持（Chrome 105+ 才支持）
- 影响范围包括 CSS 样式和 JavaScript 选择器

**影响范围**: 
- **CSS**: `MathFormulaEditor.vue` 组件中的 4 处 `:has()` 选择器
- **JavaScript**: `MathFormulaEditor.vue` 组件中的 2 处 `querySelectorAll('p:has(...)')` 调用

**修复优先级**: 
- **高优先级** - 影响核心功能（公式编辑器）
- JavaScript 中的 `:has()` 可能导致运行时错误，需要优先修复

**其他特性**: 
- 项目中使用的其他 CSS 特性在 Chrome 99 中均完全支持
- 包括 `backdrop-filter`、`aspect-ratio`、`:focus-within`、CSS 变量等

---

## 参考资料

- [Can I use - :has() selector](https://caniuse.com/css-has)
- [MDN - :has() pseudo-class](https://developer.mozilla.org/en-US/docs/Web/CSS/:has)
- [Chrome 99 Release Notes](https://chromereleases.googleblog.com/2022/03/stable-channel-update-for-desktop.html)
- [Chrome 105 Release Notes](https://chromereleases.googleblog.com/2022/08/stable-channel-update-for-desktop_30.html)

