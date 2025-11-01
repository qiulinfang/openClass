# 非中心节点内容定位分析

## 概述

非中心节点（圆周节点）的内容通过绝对定位脱离文档流，其宽高和位置的计算依赖于父容器（`.node-wrapper`）的定位。

## DOM 结构

```html
<div class="node-wrapper" :style="nodeStyle">
  <!-- 节点圆形 -->
  <div class="graph-node graph-node--circular">...</div>
  
  <!-- 非中心节点的内容通过绝对定位脱离文档流 -->
  <div class="node-content node-content--circular">
    <div class="node-title">{{ formatNodeName(node) }}</div>
  </div>
</div>
```

## 位置确定机制

### 1. 父容器（`.node-wrapper`）的定位

**位置计算逻辑**（在 `nodeStyle` computed 中）：

```javascript
// 圆周节点的定位
if (props.type === 'circular') {
  const angle = getNodeAngle(props.index || 0, props.total || 1)
  const radius = props.radius || 180
  
  // 计算节点在圆周上的位置
  const x = Math.cos(angle) * radius
  const y = Math.sin(angle) * radius
  
  style.position = 'absolute'
  style.left = '50%'
  style.top = '50%'
  
  // 偏移量调整（节点圆心对齐）
  const offsetX = debugParams?.value?.circularNodeOffsetX ?? 50
  const offsetY = debugParams?.value?.circularNodeOffsetY ?? 50
  style.marginLeft = `-${offsetX}px`
  style.marginTop = `-${offsetY}px`
  
  // 使用 transform 进行位置变换
  style.transform = `translate(${x}px, ${y}px)`
}
```

**定位特点**：
- `position: absolute` - 绝对定位
- `left: 50%` + `top: 50%` - 相对于父容器（知识图谱容器）的中心点
- `marginLeft: -50px` + `marginTop: -50px` - 偏移节点宽度/高度的一半（50px），使节点圆心对齐
- `transform: translate(x, y)` - 通过三角函数计算圆周上的精确位置

**CSS 样式**：
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

### 2. 内容区域（`.node-content--circular`）的定位

**CSS 定位样式**：

```css
.node-content--circular {
  position: absolute;
  top: 100%;           /* 相对于 .node-wrapper 的底部 */
  left: 50%;           /* 相对于 .node-wrapper 的左侧50% */
  transform: translateX(-50%);  /* 水平居中 */
  margin-top: 8px;     /* 与节点间距 */
  padding: 4px 8px;    /* 内边距 */
}
```

**定位计算过程**：

1. **垂直位置**：
   - `top: 100%` - 内容的顶部边缘位于 `.node-wrapper` 的底部边缘
   - `margin-top: 8px` - 再向下偏移 8px，形成间距

2. **水平位置**：
   - `left: 50%` - 内容的左边缘位于 `.node-wrapper` 宽度的 50% 处
   - `transform: translateX(-50%)` - 向左平移自身宽度的 50%，实现水平居中

3. **定位参考**：
   - 由于 `.node-content--circular` 是 `.node-wrapper` 的子元素
   - `position: absolute` 使其相对于 `.node-wrapper`（最近的定位父元素）进行定位
   - `.node-wrapper` 已经是 `position: absolute`，形成了定位上下文

## 宽高确定机制

### 宽度（width）

```css
.node-content--circular {
  width: 150%;  /* 相对于 .node-wrapper 宽度的 150% */
}
```

**宽度计算**：
- `width: 150%` - 宽度为父容器（`.node-wrapper`）宽度的 150%
- `.node-wrapper` 是 `display: flex` 容器，其宽度由其非绝对定位的子元素决定
- `.graph-node--circular` 是 `position: relative`（不是绝对定位），会在文档流中占据空间，宽度为 100px
- 由于 `.node-content--circular` 是 `position: absolute`，不占据文档流空间，不影响父容器宽度
- 因此 `.node-wrapper` 的宽度 = `.graph-node--circular` 的宽度 = **100px**
- 内容宽度 = 100px × 150% = **150px**

**为什么是 150%？**
- 圆周节点本身的宽度是 100px
- 内容区域需要更宽的空间来显示文本（节点名称）
- 150% 提供了足够的文本显示空间（150px），同时保持视觉平衡
- 这个宽度足够显示大部分节点名称，同时不会过度占用屏幕空间

### 高度（height）

**高度由内容决定**：

内容高度 = 内部元素高度 + padding + margin

1. **内部元素高度**：
   ```css
   .node-content--circular .node-title {
     font-size: 1.2rem;        /* 16px × 1.2 = 19.2px */
     line-height: 1.2;         /* 行高 */
     margin-bottom: 2px;       /* 底部间距 */
     
     /* 多行文本：最多显示两行 */
     display: -webkit-box;
     -webkit-line-clamp: 2;
     line-clamp: 2;
     -webkit-box-orient: vertical;
   }
   ```

2. **容器 padding**：
   ```css
   .node-content--circular {
     padding: 4px 8px;  /* 上下 4px，左右 8px */
   }
   ```

3. **实际高度计算**：
   - 单行文本：`19.2px (字体) × 1.2 (行高) + 4px × 2 (padding) ≈ 31px`
   - 两行文本：`19.2px × 1.2 × 2 + 4px × 2 ≈ 54px`
   - 加上 `margin-top: 8px`（与节点间距），总高度 ≈ **62px（两行）**

**高度特点**：
- 高度**自适应内容**，没有固定高度值
- 最多显示两行文本，超出部分用省略号（`text-overflow: ellipsis`）
- 使用 `-webkit-line-clamp: 2` 实现多行文本截断

## 定位流程图

```
知识图谱容器（相对定位）
  └── .node-wrapper（绝对定位，位置由三角函数计算）
       ├── left: 50% + margin-left: -50px + transform: translate(x, y)
       └── top: 50% + margin-top: -50px + transform: translate(x, y)
           │
           ├── .graph-node--circular（节点圆形，100px × 100px）
           │
           └── .node-content--circular（内容区域，绝对定位）
                ├── top: 100%（节点底部）
                ├── left: 50%（节点中心）
                ├── transform: translateX(-50%)（水平居中）
                ├── width: 150%（150px，相对于父容器）
                └── height: auto（由内容决定）
```

## 关键代码位置

### 1. 父容器定位计算
**文件**：`imates-web/src/components/knowledge-graph/GraphNode.vue`
**位置**：`nodeStyle` computed 属性（第 316-356 行）

```javascript
const nodeStyle = computed(() => {
  if (props.type === 'circular') {
    const angle = getNodeAngle(props.index || 0, props.total || 1)
    const radius = props.radius || 180
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    
    style.position = 'absolute'
    style.left = '50%'
    style.top = '50%'
    style.marginLeft = `-${offsetX}px`
    style.marginTop = `-${offsetY}px`
    style.transform = `translate(${x}px, ${y}px)`
  }
})
```

### 2. 内容区域 CSS 样式
**文件**：`imates-web/src/components/knowledge-graph/GraphNode.vue`
**位置**：`.node-content--circular` 样式（第 654-671 行）

```css
.node-content--circular {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
  padding: 4px 8px;
  width: 150%;
  /* ... */
}
```

## 总结

### 位置确定：
1. **父容器**（`.node-wrapper`）：通过 `left: 50%` + `top: 50%` + `transform: translate(x, y)` 在圆周上定位
2. **内容区域**（`.node-content--circular`）：通过 `top: 100%` + `left: 50%` + `transform: translateX(-50%)` 定位在节点下方并水平居中

### 宽高确定：
1. **宽度**：`width: 150%`，相对于父容器（节点）宽度的 150%，即 **150px**
2. **高度**：`height: auto`，由内容决定，最多显示两行文本，实际高度约 **30-60px**

### 关键特点：
- 使用**绝对定位**脱离文档流，不影响其他元素布局
- 通过**百分比**和**transform**实现精确的响应式定位
- 宽度相对固定，高度自适应内容
- 定位参考点是父容器（`.node-wrapper`），形成了完整的定位上下文链

