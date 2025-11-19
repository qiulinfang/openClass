问题序号：LearningView弹出卡顿与学习包遍历问题

## 问题元信息
- **问题分类**：`性能`
- **严重程度**：`中`
- **影响范围**：`学习方案弹窗（LearningView.vue）弹出体验`
- **发现日期**：`2025-11-19`
- **解决状态**：`已解决`

## 问题现象
- 使用 `DraggableDialog` 打开的 `LearningView` 弹窗，比其他使用相同组件的弹窗明显更卡。
- 弹出瞬间 UI 卡顿、内容迟迟才填充完成，尤其在学习包数量较多的教材下尤为明显。

## 复现步骤
1. 打开知识图谱或教材页面，点击进入 `LearningView` 学习方案弹窗。
2. 选择包含大量学习包的教材，观察弹出速度和滚动流畅度。
3. 对比其他使用 `DraggableDialog` 的弹窗（如简单信息弹窗），可以明显感知 `LearningView` 更卡。

## 用户体验
- 影响点1：学习方案弹窗打开延时明显，用户以为点击无响应或系统卡死。
- 影响点2：弹出后短时间内滚动、切换方案不流畅，影响选择学习方案的效率。
- 影响点3：在学习场景下打断用户操作节奏，整体体验不如其他模块的弹窗顺滑。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/views/LearningView.vue`：学习方案弹窗视图，包含学习包加载、筛选、BScroll 初始化等逻辑。
- **涉及模块**：
  - IndexedDB 资源管理器 `resourceManager`（获取 textbook 和 learningPackages）。
  - 学习包难度读取（IndexedDB + localStorage）。
  - BetterScroll 初始化逻辑。

## 技术原因 (❌)
1. 原因1：在 `loadLearningPackages` 中对 `textbook.learningPackages` **全部做了一次 map 遍历**，对每个学习包执行难度补充逻辑（IndexedDB + localStorage 访问），即使很多包并非当前章节所需。
2. 原因2：遍历过程中多次访问 `localStorage`（同步 API），在主线程上对大量学习包执行 I/O，放大了弹出时的卡顿。
3. 原因3：学习包数据更新会触发 `filteredLearningPackages` 计算和大列表 `v-for` 重新渲染，与 BScroll 初始化、缩略图检查等操作叠加，放大了弹窗弹出成本。

❌ 错误代码示例（简化前版本）：

```ts
// 旧实现：对所有学习包做 map + 难度补充
learningPackages.value = textbook.learningPackages.map((pkg) => {
  const pkgWithDifficulty = pkg as LearningPackage & { difficulty?: number }

  // IndexedDB 中已有 difficulty，则同步到 localStorage
  if (pkgWithDifficulty.difficulty !== undefined && pkgWithDifficulty.difficulty !== null) {
    const DIFFICULTY_KEY = `learning_package_difficulty_${pkg.id}`
    localStorage.setItem(DIFFICULTY_KEY, pkgWithDifficulty.difficulty.toString())
    return pkgWithDifficulty
  }

  // 否则从 localStorage 读取
  const savedDifficulty = getSavedDifficulty(pkg.id)
  if (savedDifficulty !== null) {
    return {
      ...pkg,
      difficulty: savedDifficulty,
    } as LearningPackage & { difficulty: number }
  }

  return pkg
})
```

## 正确实现方案 (✅)
1. 方案1：先将 `textbook.learningPackages` 全量赋值给 `learningPackages.value`，但**只对当前章节的学习包进行难度补充**，避免无意义遍历所有学习包。
2. 方案2：保持 `filteredLearningPackages` 作为按章节筛选的 computed，仅在需要的章节范围内进行本地难度读取与同步。
3. 方案3：继续使用 `console.time` 对“教材信息加载”、“学习包数据加载”、“缩略图检查”等关键步骤打点，观察优化前后 LearningView 弹出时间的变化。

✅ 修正后代码示例（节选）：

```ts
// 加载学习包数据
const loadLearningPackages = async () => {
  if (!id.value) return

  loadingPackages.value = true

  try {
    console.time('教材信息加载')
    const textbook = await resourceManager.getTextbookInfoById(id.value)
    console.timeEnd('教材信息加载')

    if (textbook && textbook.learningPackages) {
      console.time('学习包数据加载')
      currentTextbookId.value = textbook.textbookId

      // 先直接赋值，不在这里对全部包做 map
      learningPackages.value = textbook.learningPackages

      // 只处理当前章节的包
      if (sectionId.value) {
        const lowerSectionId = sectionId.value.toLowerCase()
        for (const pkg of learningPackages.value) {
          const hasSectionId = pkg.sectionId && pkg.sectionId.trim() !== ''
          if (!hasSectionId || pkg.sectionId!.toLowerCase() !== lowerSectionId) continue

          const pkgWithDifficulty = pkg as LearningPackage & { difficulty?: number }

          // IndexedDB 中已有难度，顺便同步 localStorage
          if (pkgWithDifficulty.difficulty !== undefined && pkgWithDifficulty.difficulty !== null) {
            const DIFFICULTY_KEY = `learning_package_difficulty_${pkg.id}`
            localStorage.setItem(DIFFICULTY_KEY, pkgWithDifficulty.difficulty.toString())
            continue
          }

          // 从 localStorage 读取难度
          const savedDifficulty = getSavedDifficulty(pkg.id)
          if (savedDifficulty !== null) {
            pkgWithDifficulty.difficulty = savedDifficulty
          }
        }
      }
      console.timeEnd('学习包数据加载')

      // 本地文件信息与缩略图逻辑保持不变
      if (textbook.localFiles) {
        localFiles.value = textbook.localFiles
      }

      if (textbook.learningPackages.length > 0) {
        selectedSchemeIndex.value = 0
      }

      console.time('缩略图检查')
      await checkAndGenerateThumbnails()
      console.timeEnd('缩略图检查')
    } else {
      learningPackages.value = []
    }
  } finally {
    loadingPackages.value = false
  }
}
```

## 关键代码/公式
- 代码片段1：按章节筛选学习包（`filteredLearningPackages`）

```ts
const filteredLearningPackages = computed(() => {
  if (!sectionId.value) {
    return learningPackages.value
  }

  return learningPackages.value.filter((pkg) => {
    const hasSectionId = pkg.sectionId && pkg.sectionId.trim() !== ''
    return hasSectionId && pkg.sectionId.toLowerCase() === sectionId.value.toLowerCase()
  })
})
```

- 代码片段2：仅对当前章节学习包补充难度信息（见上节修正代码）。

## 测试验证
- **测试场景**：
  - 场景1：在包含大量学习包的教材下打开 `LearningView` 弹窗，对比优化前后弹出耗时与流畅度。
  - 场景2：切换不同章节（sectionId），验证筛选结果是否正确、难度是否正确展示。
- **验证方法**：
  - 方法1：通过 `console.time('学习包数据加载')` 和 `console.time('缩略图检查')` 分析耗时是否明显下降。
  - 方法2：主观体验对比：弹出是否变得更快、更流畅，滚动是否顺滑。

## 预防措施
- 措施1：加载大列表时优先考虑按需处理（如按章节、分页、首屏优先），避免对全量数据做昂贵操作。
- 措施2：避免在列表初始化时对每一个元素做同步 I/O（如 localStorage），应使用缓存或延迟策略。
- 措施3：在弹窗或模态框中加入简单性能监控（`console.time`），帮助快速定位卡顿来源。

## 相关链接/参考
- 相关文档：`imates-web/src/views/LearningView.vue`
- 参考资源：IndexedDB + localStorage 数据同步最佳实践、大列表性能优化文章等。

## 可复用经验
- 经验1：对于只在特定范围（如当前章节）使用的数据，不必对全量数据做昂贵处理，应精确限制处理范围。
- 经验2：localStorage 属于同步 API，在大规模访问时会明显阻塞 UI，应谨慎使用。
- 经验3：复杂弹窗应拆解为“数据加载 + UI 初始化 + 增量渲染”几个阶段，逐一分析和优化性能瓶颈。
