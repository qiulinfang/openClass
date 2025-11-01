# node-wrapper 宽度和高度为 0 的问题分析

## 问题描述

所有的 `.node-wrapper` 的宽度和高度都是 0，导致内容定位出现问题。

## DOM 结构

```html
<div class="node-wrapper" :style="nodeStyle">
  <!-- 学习标签 -->
  <div v-if="learningStatus === 'lastLearned'" class="learning-tag">...</div>
  
  <!-- 节点圆形 -->
  <div class="graph-node graph-node--circular">...</div>
  
  <!-- 非中心节点的内容 -->
  <div v-if="type === 'circular'" class="node-content node-content--circular">...</div>
  
  <!-- 气泡框菜单 -->
  <div v-if="isMenuVisible" class="manual-bubble-menu">...</div>
</div>
```

## 问题原因分析

### 1. `.node-wrapper` 的 CSS 设置

```css
.node-wrapper {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  z-index: 2;
}
```

**关键问题**：
- `.node-wrapper` 是 `position: absolute` 的 flexbox 容器
- **没有显式的 `width` 和 `height`**
- 尺寸应该由子元素决定

### 2. 子元素的定位状态

在 `.node-wrapper` 内部：

1. **`.graph-node--circular`**（圆周节点）：
   - `position: relative` - **在文档流中**
   - `width: 100px`、`height: 100px`
   - `padding: 12px`、`margin: -12px`
   - **初始状态**：`opacity: 0`、`transform: scale(0)`

2. **`.node-content--circular`**（内容区域）：
   - `position: absolute` - **脱离文档流**，不占用空间

3. **`.learning-tag`**（学习标签）：
   - `position: absolute` - **脱离文档流**，不占用空间

4. **`.manual-bubble-menu`**（气泡框菜单）：
   - `position: absolute` - **脱离文档流**，不占用空间

### 3. 根本原因

**`.node-wrapper` 的尺寸由其在文档流中的子元素决定**，但是：

1. **唯一在文档流中的子元素是 `.graph-node--circular`**
2. **`.graph-node--circular` 有负边距**：`margin: -12px`
3. **负边距会导致元素溢出父容器**，可能影响父容器的尺寸计算

**关键问题**：虽然 `.graph-node--circular` 有 `width: 100px` 和 `height: 100px`，但是：
- 负边距 `margin: -12px` 会让元素向外扩展
- `transform: scale(0)` 虽然理论上不影响 flexbox 的尺寸计算，但实际上可能有兼容性问题
- **flexbox 容器可能会因为负边距和 `transform: scale(0)` 的组合，导致尺寸计算为 0**

### 4. 可能的原因组合

1. **负边距 + transform scale(0)**：
   - 负边距让元素超出父容器边界
   - `transform: scale(0)` 可能在某些浏览器中影响 flexbox 的尺寸计算

2. **flexbox 容器没有内容占位**：
   - 虽然 `.graph-node--circular` 在文档流中，但是：
     - 负边距可能导致元素不占用预期的空间
     - `transform: scale(0)` 可能导致 flexbox 认为元素尺寸为 0

## 解决方案

### 方案 1：给 `.node-wrapper` 设置最小尺寸

```css
.node-wrapper {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  z-index: 2;
  min-width: 100px;  /* 最小宽度 = 节点宽度 */
  min-height: 100px; /* 最小高度 = 节点高度 */
}
```

**优点**：
- 简单直接，确保容器有最小尺寸
- 不影响其他布局

**缺点**：
- 硬编码尺寸，不够灵活
- 如果节点大小变化，需要同步更新

### 方案 2：移除负边距，使用其他方式处理间距

移除 `.graph-node--circular` 的负边距，改用其他方式：

```css
.graph-node--circular {
  width: 100px;
  height: 100px;
  /* 移除 padding 和 margin */
  padding: 0;
  margin: 0;
  /* 其他样式保持不变 */
}
```

**优点**：
- 解决负边距导致的尺寸问题
- 更符合标准布局

**缺点**：
- 需要检查是否有其他依赖负边距的地方
- 可能需要调整其他样式

### 方案 3：使用 `::before` 或占位元素

在 `.node-wrapper` 中添加一个占位元素（只在圆周节点时显示）：

```html
<div class="node-wrapper" :style="nodeStyle">
  <!-- 占位元素，确保容器有尺寸 -->
  <div v-if="type === 'circular'" class="node-placeholder"></div>
  
  <!-- 其他元素 -->
  ...
</div>
```

```css
.node-placeholder {
  width: 100px;
  height: 100px;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
}
```

**优点**：
- 不影响现有布局
- 确保容器有明确尺寸

**缺点**：
- 增加了 DOM 元素
- 需要维护占位元素

### 方案 4：使用 `width` 和 `height` 而非依赖内容

在 `nodeStyle` computed 中，为圆周节点设置明确的宽度和高度：

```javascript
if (props.type === 'circular') {
  // ... 现有的定位代码 ...
  
  // 添加明确的尺寸
  style.width = '100px'
  style.height = '100px'
}
```

**优点**：
- 直接解决尺寸问题
- 不依赖子元素尺寸

**缺点**：
- 需要硬编码尺寸
- 可能与负边距产生冲突

## 推荐方案

**推荐使用方案 1**：

1. **给 `.node-wrapper` 设置最小尺寸**（方案 1）
   - 这是最简单、最直接的解决方案
   - 不影响现有布局逻辑
   - 确保容器至少有基础尺寸（100px × 100px），与节点尺寸一致

**已应用修复**：
- 在 `.node-wrapper` 中添加了 `min-width: 100px` 和 `min-height: 100px`
- 这样可以确保容器即使因为负边距或 `transform: scale(0)` 导致尺寸计算异常，仍然有基础尺寸

**如果问题仍然存在**，可以考虑方案 2（移除负边距），但需要检查是否有其他地方依赖负边距。

## 验证方法

1. 在浏览器开发者工具中检查 `.node-wrapper` 的实际尺寸
2. 检查 `.graph-node--circular` 的盒模型（包含 margin、padding）
3. 验证 `transform: scale(0)` 是否影响 flexbox 尺寸计算
4. 检查负边距是否导致元素溢出父容器

