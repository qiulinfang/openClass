# 垂直拖拽/滑动旋转椭圆轨迹上的知识图谱 - 实现细节详解

## 一、整体架构

### 1.1 事件绑定

在模板中，事件绑定在 `viewport-clipper` 容器上：

```vue
<div class="viewport-clipper"
  @touchstart="handleTouchStart"
  @touchmove="handleTouchMove"
  @touchend="handleTouchEnd"
  @mousedown="handleMouseDown"
  @mousemove="handleMouseMove"
  @mouseup="handleMouseUp"
  @mouseleave="handleMouseUp"
  @click="handleBackgroundClick"
>
```

**关键点：**
- 同时支持触摸事件（移动端）和鼠标事件（桌面端）
- 事件绑定在视口裁剪容器上，确保整个区域可交互
- `mouseleave` 也触发 `handleMouseUp`，防止鼠标移出时状态异常

### 1.2 状态变量定义

```typescript
// 拖拽状态
const isDragging = ref(false)           // 是否正在拖拽
const isActualDragging = ref(false)     // 是否实际拖拽（超过阈值）
const startY = ref(0)                  // 开始触摸的Y坐标
const lastY = ref(0)                    // 上次触摸的Y坐标
const screenHeight = ref(window.innerHeight) // 屏幕高度
// 归一化参考高度：参考移动端短视频切换，使用视口高度的80%作为参考
// 这样滑动大部分屏幕高度就能切换到下一个知识图谱，交互更自然
const normalizedReferenceHeight = computed(() => screenHeight.value * 0.8)

// 速度检测
const swipeVelocity = ref(0)           // 滑动速度（像素/毫秒）
const lastSwipeTime = ref(0)           // 上次滑动时间戳
const lastRotationTime = ref(0)        // 上次旋转时间戳

// 防抖
const debounceTimer = ref<NodeJS.Timeout | null>(null)

// 调试参数（可配置）
const debugParams = ref({
  dragThreshold: 3,                    // 拖拽阈值（像素）
  baseSensitivity: 1.2,                // 基础旋转灵敏度
  fastSensitivity: 1.8,                // 快速旋转灵敏度
  swipeThreshold: 0.5,                // 快速滑动阈值（像素/毫秒）
  rotationCoefficient: 2/3,            // 旋转计算系数
  targetAngle: 150,                    // 目标角度（度）
  debounceDelay: 100                   // 防抖延迟（毫秒）
})
```

---

## 二、触摸事件处理流程

### 2.1 TouchStart - 触摸开始

```typescript
const handleTouchStart = (event: TouchEvent) => {
  if (!circularLayoutRef.value) return
  
  // ✅ 关键设计：不在 touchstart 时设置 isDragging
  // 这样可以避免误触（如点击时手指轻微移动）
  isActualDragging.value = false
  
  // 记录初始位置
  startY.value = event.touches[0].clientY
  lastY.value = event.touches[0].clientY
  lastSwipeTime.value = Date.now()
  swipeVelocity.value = 0
  
  // 只在拖拽容器上阻止默认滚动行为
  if (event.target === circularLayoutRef.value) {
    event.preventDefault()
  }
}
```

**设计要点：**
1. **延迟判定拖拽**：不在 `touchstart` 时立即判定为拖拽，避免点击时误触发
2. **初始化状态**：重置所有拖拽相关状态，确保干净的开始
3. **选择性阻止默认行为**：只在特定元素上阻止，避免影响其他交互

### 2.2 TouchMove - 触摸移动（核心逻辑）

```typescript
const handleTouchMove = (event: TouchEvent) => {
  if (!circularLayoutRef.value) return
  
  const currentY = event.touches[0].clientY
  const deltaY = currentY - lastY.value
  const currentTime = Date.now()
  
  // ========== 第一步：拖拽阈值检测 ==========
  const totalDeltaY = Math.abs(currentY - startY.value)
  
  // 只有当移动距离超过阈值时，才判定为实际拖拽
  if (totalDeltaY > DRAG_THRESHOLD.value && !isActualDragging.value) {
    isActualDragging.value = true
    isDragging.value = true  // ✅ 此时才真正开始拖拽
  }
  
  // 如果还没超过阈值，只更新位置，不执行旋转
  if (!isActualDragging.value) {
    lastY.value = currentY
    lastSwipeTime.value = currentTime
    return  // 早期返回，不执行后续逻辑
  }
  
  // ========== 第二步：速度检测 ==========
  const timeDelta = currentTime - lastSwipeTime.value
  if (timeDelta > 0) {
    // 计算滑动速度：像素/毫秒
    swipeVelocity.value = Math.abs(deltaY) / timeDelta
  }
  
  // ========== 第三步：计算旋转角度 ==========
  // 根据滑动速度选择灵敏度
  const sensitivityMultiplier = swipeVelocity.value > swipeThreshold.value 
    ? debugParams.value.fastSensitivity    // 快速滑动：1.8倍
    : debugParams.value.baseSensitivity    // 正常滑动：1.2倍
  
  // 获取子章节总数，计算相邻知识图谱之间的角度差
  const subChapters = getSubChapters(selectedChapterDetails.value)
  const total = subChapters.length
  const angleBetweenGraphs = total > 0 ? 360 / total : 360 // 相邻知识图谱之间的角度差
  
  // 核心旋转角度计算公式
  // 使用归一化参考高度计算旋转角度，参考移动端短视频切换方式
  const normalizedReferenceHeight = computed(() => screenHeight.value * 0.8) // 视口高度的80%作为参考
  const rotationDelta = (
    deltaY / normalizedReferenceHeight.value * // 归一化：滑动距离相对于参考高度（视口高度的80%）
    debugParams.value.rotationCoefficient *    // 旋转系数：2/3
    angleBetweenGraphs *                       // 相邻知识图谱之间的角度差（而非360度）
    sensitivityMultiplier                      // 灵敏度倍数
  )
  
  // ========== 第四步：状态更新 ==========
  // 如果有知识图谱处于展开状态，先收缩它
  if (getCurrentChapterExpandedGraph() !== null) {
    setCurrentChapterExpandedGraph(null)
  }
  
  // 更新当前章节的旋转角度
  // 注意：向上滑动为正，向下滑动为负
  // rotationDelta 为正时，需要减去（逆时针旋转）
  const currentRotation = getChapterRotation(getCurrentChapter())
  setChapterRotation(getCurrentChapter(), currentRotation - rotationDelta)
  
  // ========== 第五步：更新记录 ==========
  lastY.value = currentY
  lastRotationTime.value = currentTime
  lastSwipeTime.value = currentTime
  
  // 阻止默认滚动行为
  if (event.target === circularLayoutRef.value) {
    event.preventDefault()
  }
}
```

**核心算法解析：**

#### 旋转角度计算公式

```
angleBetweenGraphs = 360 / total                    // 相邻知识图谱之间的角度差
normalizedReferenceHeight = screenHeight × 0.8      // 归一化参考高度（视口高度的80%）
rotationDelta = (deltaY / normalizedReferenceHeight) × rotationCoefficient × angleBetweenGraphs × sensitivityMultiplier
```

**参数说明：**
- `deltaY`：本次移动的垂直距离（像素）
- `screenHeight`：屏幕高度（像素）
- `normalizedReferenceHeight`：归一化参考高度（屏幕高度的 80%），参考移动端短视频切换方式
- `rotationCoefficient`：旋转系数（默认 2/3），控制旋转幅度
- `total`：知识图谱总数（子章节数量）
- `angleBetweenGraphs`：相邻知识图谱之间的角度差（360 / total）
- `sensitivityMultiplier`：灵敏度倍数（1.2 或 1.8）

**归一化参考高度的设计理念：**
参考移动端短视频应用（如抖音、快手）的切换方式：
- 📱 短视频应用中，滑动屏幕高度的 80-100% 即可切换一个视频
- 🎯 在知识图谱场景中，滑动屏幕高度的 80% 即可切换到下一个知识图谱
- ✨ 这样用户不需要滑动整个屏幕就能完成切换，交互更自然流畅
- 🎨 在不同设备上保持一致的交互体验

**示例计算：**
假设有 4 个知识图谱：
- 相邻角度差：`360 / 4 = 90°`
- 屏幕高度：800px
- 归一化参考高度：`800 × 0.8 = 640px`
- 移动距离：100px（向上）
- 正常滑动：`(100/640) × (2/3) × 90 × 1.2 ≈ 11.25°`
- 快速滑动：`(100/640) × (2/3) × 90 × 1.8 ≈ 16.875°`

**设计优势：**
- ✅ 旋转速度与知识图谱数量相关，知识图谱越多，旋转越精细
- ✅ 统一的交互体验，无论有多少个知识图谱
- ✅ 避免了固定 360 度导致的快速旋转问题
- ✅ 参考短视频切换方式，滑动体验更自然流畅
- ✅ 使用 80% 视口高度作为参考，在不同设备上保持一致性

### 2.3 TouchEnd - 触摸结束

```typescript
const handleTouchEnd = () => {
  // 保存实际拖拽状态（因为后面会重置）
  const wasActuallyDragging = isActualDragging.value
  
  // 重置状态
  isDragging.value = false
  isActualDragging.value = false
  
  // ✅ 关键：只有实际拖拽过才执行自动定位
  if (wasActuallyDragging) {
    // 防抖处理，避免与点击事件冲突
    if (debounceTimer.value) {
      clearTimeout(debounceTimer.value)
    }
    
    debounceTimer.value = setTimeout(() => {
      // 滑动结束后，自动定位到目标角度最近的知识图谱
      autoPositionToNearestGraph()
    }, debugParams.value.debounceDelay) // 默认 100ms
  }
}
```

**设计要点：**
1. **状态保存**：在重置前保存是否实际拖拽过，用于判断是否需要自动定位
2. **防抖处理**：延迟执行自动定位，避免与点击事件冲突
3. **条件执行**：只有实际拖拽过才执行自动定位，简单点击不会触发

---

## 三、鼠标事件处理

鼠标事件处理逻辑与触摸事件**完全一致**，只是获取坐标的方式不同：

```typescript
// 触摸：event.touches[0].clientY
// 鼠标：event.clientY
```

**代码对应关系：**
- `handleTouchStart` ↔ `handleMouseDown`
- `handleTouchMove` ↔ `handleMouseMove`
- `handleTouchEnd` ↔ `handleMouseUp` / `handleMouseLeave`

---

## 四、椭圆轨迹角度计算

### 4.1 角度计算函数

```typescript
const calculateCircularTrackAngle = (index: number, total: number) => {
  // 第1步：从调试参数中获取起始角度（目标角度），并转换为弧度
  const startAngle = (debugParams.value.targetAngle * Math.PI) / 180  // 150° → 5π/6
  
  // 第2步：计算每个节点之间的角度间隔
  const angleStep = (2 * Math.PI) / total  // 均匀分布
  
  // 第3步：基础角度：从起始角度开始，按索引逆时针排列
  let baseAngle = startAngle + (angleStep * index)
  
  // 第4步：当前角度：基础角度 + 当前章节的旋转角度
  let currentAngle = baseAngle + (getChapterRotation(getCurrentChapter()) * Math.PI / 180)
  
  // 第5步：将角度标准化到 [0, 2π] 范围
  while (baseAngle >= 2 * Math.PI) baseAngle -= 2 * Math.PI
  while (baseAngle < 0) baseAngle += 2 * Math.PI
  while (currentAngle >= 2 * Math.PI) currentAngle -= 2 * Math.PI
  while (currentAngle < 0) currentAngle += 2 * Math.PI
  
  return { baseAngle, currentAngle }
}
```

**角度计算逻辑：**
1. **起始角度**：从目标角度（150°）开始，这是自动定位的目标位置
2. **均匀分布**：所有节点均匀分布在圆周上
3. **旋转叠加**：当前角度 = 基础角度 + 拖拽旋转的角度
4. **角度标准化**：确保角度在 [0, 2π] 范围内

**示例：**
- 假设有 4 个节点，目标角度 150°
- 节点 0：150° + 0 × 90° = 150°
- 节点 1：150° + 1 × 90° = 240°
- 节点 2：150° + 2 × 90° = 330°
- 节点 3：150° + 3 × 90° = 420° → 60°（标准化）

### 4.2 位置计算函数

```typescript
const calculateCircularTrackPosition = (angle: number, radiusX?: number, radiusY?: number) => {
  // 椭圆参数
  const xRadius = radiusX ?? debugParams.value.radiusX  // 默认 500px
  const yRadius = radiusY ?? debugParams.value.radiusY  // 默认 320px
  
  // 椭圆方程：x = a·cos(θ), y = b·sin(θ)
  const x = Math.cos(angle) * xRadius
  const y = Math.sin(angle) * yRadius
  
  return { x, y }
}
```

**椭圆方程说明：**
- 标准椭圆方程：`(x/a)² + (y/b)² = 1`
- 参数方程：`x = a·cos(θ)`, `y = b·sin(θ)`
- `a` = `radiusX`（水平半径）
- `b` = `radiusY`（垂直半径）

---

## 五、自动定位算法

### 5.1 自动定位流程

```typescript
const autoPositionToNearestGraph = () => {
  if (!selectedChapterDetails.value) return
  
  const subChapters = getSubChapters(selectedChapterDetails.value)
  if (subChapters.length === 0) return
  
  // 第1步：从调试参数中获取目标角度（默认 150°）
  const targetAngle = debugParams.value.targetAngle
  
  // 第2步：计算每个知识图谱当前的角度
  let nearestIndex = 0
  let minDistance = Infinity
  
  // 第3步：遍历所有子章节，找到距离目标角度最近的节点
  for (let i = 0; i < subChapters.length; i++) {
    // 计算当前节点的角度
    const { currentAngle } = calculateCircularTrackAngle(i, subChapters.length)
    let angleInDegrees = (currentAngle * 180 / Math.PI) % 360
    if (angleInDegrees < 0) angleInDegrees += 360
    
    // 第4步：计算到目标角度的距离（考虑360度循环）
    const distance = Math.min(
      Math.abs(angleInDegrees - targetAngle),           // 直接距离
      Math.abs(angleInDegrees - targetAngle + 360),      // 跨越0度的距离
      Math.abs(angleInDegrees - targetAngle - 360)       // 跨越0度的距离（反向）
    )
    
    if (distance < minDistance) {
      minDistance = distance
      nearestIndex = i
    }
  }
  
  // 第5步：立即设置展开状态，让展开动画开始
  setCurrentChapterExpandedGraph(subChapters[nearestIndex].id)
  
  // 第6步：执行展开旋转动画，将目标节点旋转到 150° 位置
  startExpandingRotation(subChapters[nearestIndex].id)
}
```

**算法要点：**
1. **距离计算**：考虑圆周的循环特性（359° 和 1° 的距离是 2°，不是 358°）
2. **最近节点选择**：遍历所有节点，找到距离目标角度最近的节点
3. **自动展开**：定位后自动展开最近的知识图谱

### 5.2 展开旋转动画

```typescript
const startExpandingRotation = (graphId: string) => {
  // ... 前面的验证逻辑 ...
  
  // 计算目标图谱的当前角度
  const { currentAngle } = calculateCircularTrackAngle(targetIndex, total)
  
  // 获取目标角度（150°）
  const targetAngleRadians = (debugParams.value.targetAngle * Math.PI) / 180
  
  // 计算角度差的绝对值
  const alpha = Math.abs(currentAngle - targetAngleRadians)
  
  // 判断目标知识图谱当前所在的半圆区域
  const currentAngleDegrees = (currentAngle * 180) / Math.PI
  let targetRotationDegrees = 0
  
  if (currentAngleDegrees > 180 && currentAngleDegrees <= 360) {
    // 上半圆：逆时针旋转（角度减少）
    targetRotationDegrees = -(alpha * 180) / Math.PI
    rotationDirection.value = 'counterclockwise'
  } else {
    // 下半圆：顺时针旋转（角度增加）
    targetRotationDegrees = (alpha * 180) / Math.PI
    rotationDirection.value = 'clockwise'
  }
  
  // 执行动画
  // ...
}
```

**旋转方向判断：**
- **上半圆（180°-360°）**：逆时针旋转，角度减少
- **下半圆（0°-180°）**：顺时针旋转，角度增加

**原因：**选择旋转距离更短的方向，让动画更自然。

---

## 六、位置计算与渲染

### 6.1 知识图谱位置计算

```typescript
const getGraphPosition = (index: number, total: number) => {
  // 计算当前节点的角度（考虑旋转）
  const { currentAngle } = calculateCircularTrackAngle(index, total)
  
  // 计算椭圆轨迹上的位置
  const { x, y } = calculateCircularTrackPosition(currentAngle)
  
  return {
    transform: `translate(${x}px, ${y}px)`,
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: `-${debugParams.value.graphMargin}px`,
    marginTop: `-${debugParams.value.graphMargin}px`,
    // ... 其他样式
  }
}
```

**定位方式：**
1. **绝对定位**：使用 `position: absolute`
2. **居中基准**：`left: 50%`, `top: 50%` 作为中心点
3. **偏移调整**：通过 `marginLeft` 和 `marginTop` 调整节点中心对齐
4. **变换定位**：使用 `transform: translate()` 精确控制位置

---

## 七、关键设计模式

### 7.1 拖拽阈值机制

**问题：**点击时手指可能轻微移动，导致误触发拖拽

**解决：**
```typescript
// 只有在移动距离超过阈值时才判定为拖拽
if (totalDeltaY > DRAG_THRESHOLD.value && !isActualDragging.value) {
  isActualDragging.value = true
  isDragging.value = true
}
```

**优势：**
- 避免点击时的误触发
- 提高交互的准确性
- 可配置的阈值（默认 3px）

### 7.2 速度自适应灵敏度

**问题：**快速滑动和慢速滑动需要不同的灵敏度

**解决：**
```typescript
// 根据滑动速度选择灵敏度
const sensitivityMultiplier = swipeVelocity.value > swipeThreshold.value 
  ? debugParams.value.fastSensitivity    // 快速：1.8倍
  : debugParams.value.baseSensitivity    // 正常：1.2倍
```

**优势：**
- 快速滑动时更灵敏，响应更快
- 慢速滑动时更精确，避免过度旋转
- 提供更好的用户体验

### 7.3 防抖机制

**问题：**拖拽结束后的自动定位可能与点击事件冲突

**解决：**
```typescript
debounceTimer.value = setTimeout(() => {
  autoPositionToNearestGraph()
}, debugParams.value.debounceDelay) // 100ms 延迟
```

**优势：**
- 避免与点击事件冲突
- 给用户明确的反馈时间
- 可配置的延迟时间

### 7.4 状态管理

**状态层次：**
1. `isDragging`：是否正在拖拽（用于UI反馈）
2. `isActualDragging`：是否实际拖拽（用于逻辑判断）
3. `isExpandingRotation`：是否正在执行展开旋转动画
4. `isCollapsing`：是否正在执行收缩动画

**冲突处理：**
```typescript
// 如果正在执行展开旋转动画、收缩动画或拖拽操作，禁用点击切换功能
if (isExpandingRotation.value || isCollapsing.value || isDragging.value) {
  return
}
```

---

## 八、性能优化

### 8.1 早期返回

```typescript
if (!isActualDragging.value) {
  lastY.value = currentY
  lastSwipeTime.value = currentTime
  return  // 早期返回，不执行后续计算
}
```

### 8.2 计算优化

- 使用 `computed` 缓存计算结果
- 避免在每次 `touchmove` 时重复计算不必要的数据
- 使用 `requestAnimationFrame` 优化动画

### 8.3 事件优化

- 只在必要时阻止默认行为
- 使用事件委托减少事件监听器数量
- 及时清理定时器，避免内存泄漏

---

## 九、调试参数配置

所有关键参数都可在调试面板中调整：

```typescript
const debugParams = {
  // 拖拽控制
  dragThreshold: 3,              // 拖拽阈值（像素）
  baseSensitivity: 1.2,          // 基础旋转灵敏度
  fastSensitivity: 1.8,          // 快速旋转灵敏度
  swipeThreshold: 0.5,           // 快速滑动阈值（像素/毫秒）
  rotationCoefficient: 2/3,      // 旋转计算系数
  
  // 定位参数
  targetAngle: 150,              // 目标角度（度）
  debounceDelay: 100,            // 防抖延迟（毫秒）
  
  // 椭圆参数
  radiusX: 500,                 // 椭圆X轴半径
  radiusY: 320,                 // 椭圆Y轴半径
  
  // 动画参数
  expandingRotationDuration: 500, // 展开旋转动画持续时间（毫秒）
}
```

---

## 十、总结

### 核心流程

```
用户拖拽
  ↓
检测拖拽阈值（3px）
  ↓
计算滑动速度
  ↓
选择灵敏度倍数（1.2 或 1.8）
  ↓
计算旋转角度
  ↓
更新所有知识图谱位置
  ↓
拖拽结束
  ↓
防抖延迟（100ms）
  ↓
自动定位到最近的知识图谱
  ↓
执行展开旋转动画
```

### 关键技术点

1. **阈值检测**：避免误触
2. **速度自适应**：提供更好的交互体验
3. **椭圆轨迹计算**：精确的数学计算
4. **自动定位**：智能的目标选择
5. **状态管理**：避免交互冲突
6. **性能优化**：流畅的用户体验

### 设计亮点

- ✅ 同时支持触摸和鼠标事件
- ✅ 智能的拖拽判定机制
- ✅ 自适应的灵敏度调整
- ✅ 平滑的自动定位动画
- ✅ 完善的冲突处理机制
- ✅ 丰富的调试参数配置

