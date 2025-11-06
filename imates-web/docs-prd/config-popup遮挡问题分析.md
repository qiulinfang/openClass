# config-popup 遮挡问题分析

## 问题描述

`config-popup` 包裹在 `popup-icon-wrapper` 中会被遮挡，但包裹在 `tool-buttons` 中就不会被遮挡。

## DOM 结构分析

### 当前结构（会被遮挡）

```html
.unified-toolbar-browser (position: relative, z-index: 10)
  .toolbar-content
    .center-section
      .tool-section
        .tool-buttons
          .popup-icon-wrapper (position: relative, z-index: 3000)
            .config-popup (position: absolute, z-index: 3000)
```

### 正常结构（不会被遮挡）

```html
.unified-toolbar-browser (position: relative, z-index: 10)
  .toolbar-content
    .center-section
      .tool-section
        .tool-buttons (没有 position 属性)
          .config-popup (position: absolute, z-index: 3000)
```

## 根本原因分析

### 1. 堆叠上下文（Stacking Context）问题

**关键问题**：`popup-icon-wrapper` 设置了 `position: relative` 和 `z-index: 3000`，这创建了一个新的堆叠上下文。

#### CSS 堆叠上下文规则

当一个元素设置了 `position: relative` 或 `position: absolute` 或 `position: fixed` 并且 `z-index` 不为 `auto` 时，它会创建一个新的堆叠上下文。

#### 堆叠上下文的限制

- 子元素的 `z-index` 只在父元素创建的堆叠上下文内有效
- 子元素的 `z-index` 不能跨越父元素的堆叠上下文边界
- 如果父元素所在的堆叠上下文层级较低，子元素再高的 `z-index` 也无法超越父元素所在的堆叠上下文

### 2. 层级关系分析

#### 情况A：config-popup 在 popup-icon-wrapper 内（会被遮挡）

```
堆叠上下文层级：
┌─────────────────────────────────────┐
│ .unified-toolbar-browser            │
│ z-index: 10 (堆叠上下文A)           │
│ ┌─────────────────────────────────┐ │
│ │ .popup-icon-wrapper             │ │
│ │ position: relative               │ │
│ │ z-index: 3000 (堆叠上下文B)      │ │
│ │ ┌─────────────────────────────┐ │ │
│ │ │ .config-popup               │ │ │
│ │ │ z-index: 3000               │ │ │
│ │ │ (只能在堆叠上下文B内有效)   │ │ │
│ │ └─────────────────────────────┘ │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**问题**：
- `config-popup` 的 `z-index: 3000` 只在 `popup-icon-wrapper` 创建的堆叠上下文B内有效
- 堆叠上下文B本身在堆叠上下文A（z-index: 10）内
- 如果其他元素（如 PDF 页面）的 z-index 高于 10，整个工具栏（包括堆叠上下文B）都会被遮挡
- 即使 `config-popup` 的 z-index 很高，也无法突破父元素的堆叠上下文限制

#### 情况B：config-popup 在 tool-buttons 内（不会被遮挡）

```
堆叠上下文层级：
┌─────────────────────────────────────┐
│ .unified-toolbar-browser            │
│ z-index: 10 (堆叠上下文A)           │
│ ┌─────────────────────────────────┐ │
│ │ .tool-buttons                  │ │
│ │ (没有 position，不创建堆叠上下文)│ │
│ │ ┌─────────────────────────────┐ │ │
│ │ │ .config-popup                │ │ │
│ │ │ position: absolute            │ │ │
│ │ │ z-index: 3000                 │ │ │
│ │ │ (直接参与堆叠上下文A)          │ │ │
│ │ └─────────────────────────────┘ │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**优势**：
- `tool-buttons` 没有 `position` 属性，不创建新的堆叠上下文
- `config-popup` 的定位会向上查找，找到 `.unified-toolbar-browser`（position: relative）
- `config-popup` 的 `z-index: 3000` 直接参与堆叠上下文A，而不是被限制在子堆叠上下文内
- 虽然父元素 `z-index: 10`，但 `config-popup` 的 `z-index: 3000` 仍然有效，因为它是在同一个堆叠上下文A内比较的

### 3. 为什么 tool-buttons 内不会被遮挡？

虽然 `tool-buttons` 没有 `position` 属性，但 `config-popup` 使用 `position: absolute` 定位时：

1. **定位查找**：`config-popup` 会向上查找最近的定位父元素，找到 `.unified-toolbar-browser`（position: relative）
2. **堆叠上下文**：由于中间没有其他元素创建堆叠上下文，`config-popup` 直接参与 `.unified-toolbar-browser` 创建的堆叠上下文
3. **z-index 比较**：在同一个堆叠上下文内，`config-popup` 的 `z-index: 3000` 会与其他元素（包括可能遮挡它的元素）在同一层级进行比较

### 4. 为什么 popup-icon-wrapper 内会被遮挡？

当 `config-popup` 在 `popup-icon-wrapper` 内时：

1. **堆叠上下文隔离**：`popup-icon-wrapper` 创建了新的堆叠上下文（因为设置了 `position: relative` 和 `z-index: 3000`）
2. **层级限制**：`config-popup` 的 `z-index: 3000` 只在 `popup-icon-wrapper` 的堆叠上下文内有效
3. **父级限制**：如果 `popup-icon-wrapper` 所在的堆叠上下文（`.unified-toolbar-browser`，z-index: 10）被其他元素遮挡，整个堆叠上下文内的所有元素都会被遮挡，无论子元素的 z-index 多高

## CSS 代码对比

### popup-icon-wrapper 样式（有问题）

```css
.popup-icon-wrapper {
  position: relative;        /* 创建新的堆叠上下文 */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;             /* 创建新的堆叠上下文 */
  overflow: visible;
}
```

### tool-buttons 样式（正常）

```css
.tool-buttons {
  display: flex;             /* 没有 position，不创建堆叠上下文 */
  gap: 2px;
}
```

### config-popup 样式

```css
.config-popup {
  position: absolute;
  top: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 3000;             /* 在父堆叠上下文内有效 */
}
```

## 解决方案

### 方案1：移除 popup-icon-wrapper 的 position 和 z-index（推荐）

如果需要保持 `config-popup` 在 `popup-icon-wrapper` 内，但避免被遮挡，可以移除 `popup-icon-wrapper` 的 `position: relative` 和 `z-index`：

```css
.popup-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  /* 移除 position: relative 和 z-index */
}
```

**注意**：移除 `position: relative` 后，`config-popup` 的定位会向上查找，找到 `.unified-toolbar-browser`，这样 `config-popup` 就能直接参与父级的堆叠上下文。

### 方案2：将 config-popup 移到 tool-buttons 内（当前方案）

如果 `config-popup` 不需要在 `popup-icon-wrapper` 内，可以直接放在 `tool-buttons` 内，这样就不会被遮挡。

### 方案3：提高 unified-toolbar-browser 的 z-index

如果工具栏本身需要更高的层级，可以提高 `.unified-toolbar-browser` 的 `z-index`：

```css
.unified-toolbar-browser {
  position: relative;
  z-index: 3000;  /* 从 10 提高到 3000 */
}
```

但这种方法可能会影响其他元素的层级关系，需要谨慎使用。

## 总结

**核心问题**：`popup-icon-wrapper` 的 `position: relative` 和 `z-index: 3000` 创建了新的堆叠上下文，导致内部的 `config-popup` 的 `z-index` 被限制在子堆叠上下文内，无法突破父元素的层级限制。

**解决思路**：
1. 移除 `popup-icon-wrapper` 的 `position` 和 `z-index`，让 `config-popup` 直接参与父级堆叠上下文
2. 或者将 `config-popup` 移到不创建堆叠上下文的容器内（如 `tool-buttons`）
3. 或者提高整个工具栏的 `z-index`（可能影响其他元素）

## 参考资料

- [CSS Stacking Context - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context)
- [Understanding CSS z-index - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index)

