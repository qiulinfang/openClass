# 圆周节点分布机制分析

## 一、概述

本文档详细分析了圆周节点是如何分布在背景圆的圆周上的，包括角度计算、位置计算、半径计算等关键逻辑。

## 二、核心算法

### 2.1 角度计算函数 `getNodeAngle`

**位置**：`imates-web/src/components/knowledge-graph/GraphNode.vue` (第129行)

```typescript
const getNodeAngle = (index: number, total: number): number => {
  // 固定角度分布表（角度制，需转换为弧度）
  const fixedAngles: Record<number, number[]> = {
    1: [180],           // 1个节点：正下方
    2: [0, 180],        // 2个节点：正右方、正下方
    3: [270, 30, 150],  // 3个节点：正上方、右上30°、右下150°
    4: [270, 0, 90, 180],  // 4个节点：正上方、正右方、正下方、正左方
    5: [270, 342, 54, 126, 198]  // 5个节点：固定位置分布
  }
  
  // 如果节点数量在1-5之间，使用固定角度分布
  if (total >= 1 && total <= 5 && fixedAngles[total]) {
    const angleDegrees = fixedAngles[total][index] || 0
    // 将角度转换为弧度（角度 * π / 180）
    return (angleDegrees * Math.PI) / 180
  }
  
  // 超过5个节点，使用等间距分布
  return (2 * Math.PI * index) / total
}
```

**关键特性**：

1. **固定角度分布（1-5个节点）**：
   - 对于1-5个节点，使用预设的固定角度位置
   - 这些角度经过精心设计，确保视觉效果最佳
   - 所有角度都是度数制，需要转换为弧度制

2. **等间距分布（6个及以上节点）**：
   - 超过5个节点时，使用等间距分布算法
   - 公式：`angle = (2π × index) / total`
   - 确保节点均匀分布在圆周上

**角度系统说明**：
- 坐标系：标准数学坐标系（0°为正右方，逆时针为正方向）
- 转换：所有角度都需要从度数转换为弧度（`角度 × π / 180`）

### 2.2 位置计算

**位置**：`imates-web/src/components/knowledge-graph/GraphNode.vue` (第322-341行)

```typescript
if (props.type === 'circular') {
  // 1. 计算角度
  const angle = getNodeAngle(props.index || 0, props.total || 1)
  
  // 2. 获取半径（与背景圆保持一致）
  const radius = props.radius || 180
  
  // 3. 计算节点圆心在圆周上的坐标位置
  const x = Math.cos(angle) * radius
  const y = Math.sin(angle) * radius
  
  // 4. 设置定位样式
  style.position = 'absolute'
  style.left = '50%'
  style.top = '50%'
  
  // 5. 应用偏移量（让节点中心对齐到计算位置）
  const offsetX = debugParams?.value?.circularNodeOffsetX ?? 50
  const offsetY = debugParams?.value?.circularNodeOffsetY ?? 50
  style.marginLeft = `-${offsetX}px`
  style.marginTop = `-${offsetY}px`
  
  // 6. 应用平移变换（将节点移动到圆周上的位置）
  style.transform = `translate(${x}px, ${y}px)`
}
```

**位置计算步骤**：

1. **角度计算**：调用 `getNodeAngle` 获取节点的角度（弧度）

2. **半径获取**：从 `props.radius` 获取半径值，与背景圆半径保持一致

3. **坐标计算**：使用三角函数计算节点圆心位置
   - `x = cos(angle) × radius`
   - `y = sin(angle) × radius`

4. **容器定位**：设置容器为绝对定位，居中在父容器（`left: 50%`, `top: 50%`）

5. **偏移调整**：应用负边距，调整节点中心点对齐
   - 默认偏移量：50px（节点宽度/高度的一半）
   - 可通过调试参数 `circularNodeOffsetX` 和 `circularNodeOffsetY` 调整

6. **位置变换**：使用 `translate` 将节点移动到圆周上的最终位置

## 三、半径计算

### 3.1 背景圆半径

**位置**：`imates-web/src/components/knowledge-graph/KnowledgeGraph.vue` (第172-204行)

```typescript
const backgroundRadius = computed(() => {
  if (!containerRef.value) return 180 // 默认值
  
  const container = containerRef.value
  const containerWidth = container.offsetWidth
  const containerHeight = container.offsetHeight
  
  // 背景圆是正方形的内切圆，半径是较小边的一半
  const baseRadius = Math.min(containerWidth, containerHeight) / 2
  
  // 使用可调参数的最小背景半径
  const minRadius = debugParams?.value?.minBackgroundRadius ?? 120
  const radius = Math.max(baseRadius, minRadius)
  
  // 获取圆周节点数量
  const circularNodes = getCircularNodes(props.chapterDetails)
  const nodeCount = circularNodes.length
  
  // 根据节点数量调整半径大小
  if (nodeCount <= 2) {
    // 1-2个节点：背景圆形区域半径小
    const scale = debugParams?.value?.radiusScaleSmall ?? 0.8
    return radius * scale
  } else if (nodeCount <= 4) {
    // 3-4个节点：背景圆形区域半径中
    const scale = debugParams?.value?.radiusScaleMedium ?? 1.0
    return radius * scale
  } else {
    // 超过4个节点：背景圆形区域半径大
    const scale = debugParams?.value?.radiusScaleLarge ?? 1.1
    return radius * scale
  }
})
```

**半径计算逻辑**：

1. **基础半径**：取容器宽度和高度中的较小值，除以2（内切圆）
2. **最小半径限制**：确保半径不小于 `minBackgroundRadius`（默认120px）
3. **动态缩放**：根据节点数量应用不同的缩放因子
   - 1-2个节点：`radius × 0.8`（缩小）
   - 3-4个节点：`radius × 1.0`（原始大小）
   - 5个及以上：`radius × 1.1`（放大）

### 3.2 圆周节点实际半径

**位置**：`imates-web/src/components/knowledge-graph/KnowledgeGraph.vue` (第207-210行)

```typescript
const circularNodeRadius = computed(() => {
  const factor = debugParams?.value?.circularNodeRadiusFactor ?? 1.0
  return backgroundRadius.value * factor
})
```

**说明**：
- 圆周节点的实际半径 = 背景圆半径 × 半径因子
- 默认半径因子为 1.0（节点圆心在背景圆圆周上）
- 可通过 `circularNodeRadiusFactor` 参数调整节点位置
  - `factor < 1.0`：节点向中心收缩
  - `factor > 1.0`：节点向外扩展

## 四、固定角度分布详解

### 4.1 1个节点

```
角度：180°（正下方）

布局：
        ● (中心节点)
        
        ○ (圆周节点，180°)
```

### 4.2 2个节点

```
角度：0°, 180°（正右方、正下方）

布局：
        ● (中心节点)
        
   ○ (0°)            ○ (180°)
```

### 4.3 3个节点

```
角度：270°, 30°, 150°（正上方、右上30°、右下150°）

布局：
        ○ (270°)
        
        ● (中心节点)
        
   ○ (150°)          ○ (30°)
```

### 4.4 4个节点

```
角度：270°, 0°, 90°, 180°（正上方、正右方、正下方、正左方）

布局：
        ○ (270°)
        
   ○ (180°)  ● (中心节点)  ○ (0°)
        
        ○ (90°)
```

### 4.5 5个节点

```
角度：270°, 342°, 54°, 126°, 198°

布局：
        ○ (270°)
        
   ○ (198°)          ○ (342°)
        ● (中心节点)
   ○ (126°)          ○ (54°)
```

## 五、等间距分布（6个及以上节点）

当节点数量超过5个时，使用等间距分布算法：

```
角度间隔 = 2π / total
节点i的角度 = (2π × i) / total
```

**示例**：6个节点
- 节点0：0° (0 × 60°)
- 节点1：60° (1 × 60°)
- 节点2：120° (2 × 60°)
- 节点3：180° (3 × 60°)
- 节点4：240° (4 × 60°)
- 节点5：300° (5 × 60°)

## 六、坐标系统

### 6.1 坐标系定义

- **原点**：容器中心点
- **X轴正方向**：向右（0°）
- **Y轴正方向**：向下（90°）
- **角度正方向**：逆时针（数学标准）

### 6.2 角度到坐标转换

```
x = cos(angle) × radius
y = sin(angle) × radius
```

**关键角度对照表**：
| 角度（度） | 角度（弧度） | X坐标 | Y坐标 | 位置 |
|-----------|------------|-------|-------|------|
| 0°        | 0          | +radius | 0      | 正右方 |
| 90°       | π/2        | 0      | +radius | 正下方 |
| 180°      | π          | -radius | 0      | 正左方 |
| 270°      | 3π/2       | 0      | -radius | 正上方 |

## 七、布局定位机制

### 7.1 CSS定位策略

```css
position: absolute;
left: 50%;
top: 50%;
margin-left: -50px;  /* 节点宽度的一半 */
margin-top: -50px;   /* 节点高度的一半 */
transform: translate(x, y);  /* 移动到圆周位置 */
```

**定位步骤解析**：

1. **绝对定位**：使节点脱离文档流
2. **居中定位**：`left: 50%`, `top: 50%` 将节点左上角移到容器中心
3. **中心对齐**：负边距将节点中心点移到容器中心
4. **圆周定位**：`translate(x, y)` 将节点移动到圆周上的最终位置

### 7.2 偏移量参数

- `circularNodeOffsetX`：X方向偏移量（默认50px）
- `circularNodeOffsetY`：Y方向偏移量（默认50px）

**用途**：
- 调整节点中心点对齐
- 适应不同大小的节点
- 微调节点位置

## 八、动画延迟机制

**位置**：`imates-web/src/components/knowledge-graph/GraphNode.vue` (第310-320行)

```typescript
// 为圆周节点添加动画延迟
if (props.type === 'circular' && props.index !== undefined) {
  if (props.animationState === 'expanding') {
    const delayInterval = debugParams?.value?.nodeExpandDelayInterval ?? 0.1
    style.animationDelay = `${props.index * delayInterval}s`
  } else if (props.animationState === 'collapsing') {
    const delayInterval = debugParams?.value?.nodeCollapseDelayInterval ?? 0.05
    style.animationDelay = `${props.index * delayInterval}s`
  }
}
```

**说明**：
- 展开动画：每个节点延迟 `index × 0.1秒`，形成波浪效果
- 收缩动画：每个节点延迟 `index × 0.05秒`，收缩更快

## 九、节点筛选逻辑

**位置**：`imates-web/src/components/knowledge-graph/KnowledgeGraph.vue` (第232-253行)

```typescript
const getCircularNodes = (chapterDetails: ChapterDetails) => {
  if (!chapterDetails.children) return []
  
  // level=1的节点：只有展开时才显示level=2的子节点
  if (chapterDetails.level === 1) {
    if (isExpanded.value) {
      return chapterDetails.children.filter(child => child.level === 2)
    } else {
      return []
    }
  }
  
  // level=0的主章节：始终显示level=1的子节点
  if (chapterDetails.level === 0) {
    return chapterDetails.children.filter(child => child.level === 1)
  }
  
  return chapterDetails.children
}
```

**筛选规则**：
- **主章节（level=0）**：始终显示level=1的子节点
- **子章节（level=1）**：只有在展开状态下才显示level=2的子节点

## 十、总结

圆周节点的分布机制包含以下核心要素：

1. **角度计算**：固定角度分布（1-5个节点）或等间距分布（6个及以上）
2. **位置计算**：使用三角函数（cos/sin）计算圆周坐标
3. **半径计算**：根据节点数量和容器大小动态调整
4. **定位机制**：绝对定位 + 居中 + 负边距 + transform平移
5. **动画效果**：基于索引的延迟动画，形成波浪效果

这个设计确保了：
- 1-5个节点时的最优视觉布局
- 6个及以上节点时的均匀分布
- 响应式适配不同容器大小
- 流畅的动画过渡效果

