# LearningView.vue 进入逻辑分析

## 一、触发流程

### 1. 点击"去学习"按钮
在知识图谱（KnowledgeGraphView.vue）中，点击知识节点的"去学习"按钮会触发 `handleLearn` 事件。

**注意：** `getCurrentTextbookId()` 从 `selectedTextbook.value` 中提取教材版本ID（最后一个 `-` 后面的部分），这个ID用于从 IndexedDB 中获取教材的学习包数据。

### 2. 事件处理链
```
KnowledgeGraph.vue (组件) 
  ↓ emit('learn', node)
KnowledgeGraphView.vue 
  ↓ @learn="handleLearnDialog"
handleLearnDialog() 函数
```

**关键代码位置：`imates-web/src/views/KnowledgeGraphView.vue`**
```typescript
// 获取当前教材的真实ID（教材版本ID）
const getCurrentTextbookId = () => {
  const option = textbookOptions.value.find(opt => opt.value === selectedTextbook.value)
  if (option) {
    // 从value中提取教材版本ID（最后一个-后面的部分）
    // value格式: "学科-年级-学期-教材版本ID"
    const parts = option.value.split('-')
    return parts[parts.length - 1] // 教材版本ID
  }
  return ''
}

// 处理学习对话框
const handleLearnDialog = (node: { id: string; name: string; level?: number | null }) => {
  // 设置对话框数据
  learningDialogData.value = {
    nodeId: node.id,                    // 知识节点ID（用于筛选学习方案）
    sectionName: node.name,             // 章节名称（对话框标题）
    level: node.level || 1,             // 节点层级
    textbookId: getCurrentTextbookId()  // 教材版本ID（用于加载学习包数据）
  }
  
  // 显示对话框
  learningDialogVisible.value = true
}
```

### 3. 对话框渲染
```vue
<LearningView 
  v-if="learningDialogData"
  v-model="learningDialogVisible"
  :key="`${learningDialogData.nodeId}-${learningDialogData.textbookId}`"
  :node-id="learningDialogData.nodeId"
  :section-name="learningDialogData.sectionName"
  :level="learningDialogData.level"
  :textbook-id="learningDialogData.textbookId"
  @update:model-value="handleLearningDialogClose"
/>
```

## 二、LearningView.vue 初始化流程

### 1. Props 接收
```typescript
interface Props {
  modelValue: boolean        // 对话框显示/隐藏状态
  nodeId?: string           // 知识节点ID（用于筛选学习方案）
  sectionName?: string      // 章节名称（对话框标题）
  level?: number            // 节点层级
  textbookId?: string       // 教材ID（用于加载学习包数据）
}

// 默认值
const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  nodeId: '',
  sectionName: '学习内容',
  level: 1,
  textbookId: '',
})
```

### 2. 响应式数据初始化
```typescript
const sectionName = ref(props.sectionName)      // 章节名称
const sectionId = ref(props.nodeId)              // 章节ID
const id = ref(props.textbookId)                 // 教材ID
const selectedSchemeIndex = ref(-1)               // 选中的学习方案索引
const selectedResourceIndex = ref(-1)            // 选中的资源索引
const isLoading = ref(false)                    // 加载状态
const loadingPackages = ref(false)               // 加载学习包状态

const learningPackages = ref<LearningPackage[]>([])  // 学习方案列表
const localFiles = ref<LocalFileInfo[]>([])         // 本地文件信息（用于缩略图）
```

### 3. 生命周期钩子 - onMounted

**执行顺序：**
1. **检查路由状态**（如果是直接通过路由访问）
2. **加载学习包数据** (`loadLearningPackages()`)
3. **初始化滚动组件** (BScroll)

```typescript
onMounted(async () => {
  // 如果通过路由访问（没有传入 modelValue 或 modelValue 为 false），自动显示对话框
  if (!props.modelValue && router.currentRoute.value.name === 'learning') {
    localVisible.value = true
  }

  // 加载学习包数据
  await loadLearningPackages()
  
  // 初始化 BScroll（由组合式函数处理）
  await initSchemeListBScroll()
  await initResourcesListBScroll()
})
```

### 4. loadLearningPackages() 核心逻辑

**流程步骤：**

#### 步骤 1: 参数校验
```typescript
if (!id.value) {
  return  // 如果没有教材ID，直接返回
}
```

#### 步骤 2: 设置加载状态
```typescript
loadingPackages.value = true
```

#### 步骤 3: 从 IndexedDB 获取教材信息
```typescript
const textbook = await resourceManager.getTextbookInfoById(id.value)
```

#### 步骤 4: 处理学习包数据
如果找到教材且有学习包数据：

**a. 处理难度数据（优先级：IndexedDB > localStorage > 默认值）**
```typescript
learningPackages.value = textbook.learningPackages.map((pkg) => {
  // 优先使用 IndexedDB 中的难度
  const pkgWithDifficulty = pkg as LearningPackage & { difficulty?: number }
  if (pkgWithDifficulty.difficulty !== undefined && pkgWithDifficulty.difficulty !== null) {
    // IndexedDB 中已有难度，使用它并同步到 localStorage
    const DIFFICULTY_KEY = `learning_package_difficulty_${pkg.id}`
    localStorage.setItem(DIFFICULTY_KEY, pkgWithDifficulty.difficulty.toString())
    return pkgWithDifficulty
  }

  // IndexedDB 中没有难度，从 localStorage 读取
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

**b. 加载本地文件信息（用于显示资源缩略图）**
```typescript
if (textbook.localFiles) {
  localFiles.value = textbook.localFiles
}
```

**c. 自动选择第一个方案**
```typescript
if (textbook.learningPackages.length > 0) {
  selectedSchemeIndex.value = 0
}
```

#### 步骤 5: 处理无数据情况
```typescript
else {
  learningPackages.value = []
  localFiles.value = []
}
```

#### 步骤 6: 异常处理和状态重置
```typescript
catch (error) {
  console.error('加载学习包失败:', error)
  learningPackages.value = []
  localFiles.value = []
} finally {
  loadingPackages.value = false
}
```

### 5. Props 监听机制

当 props 发生变化时，会触发相应的处理：

#### 监听 nodeId（章节ID）变化
```typescript
watch(
  () => props.nodeId,
  (newNodeId) => {
    sectionId.value = newNodeId      // 更新章节ID
    resetSelection()                  // 重置选择状态
    loadLearningPackages()            // 重新加载学习包数据
  },
)
```

**作用：** 当切换不同章节节点时，会根据新的章节ID筛选学习方案。

#### 监听 textbookId（教材ID）变化
```typescript
watch(
  () => props.textbookId,
  (newTextbookId) => {
    id.value = newTextbookId          // 更新教材ID
    resetSelection()                  // 重置选择状态
    loadLearningPackages()            // 重新加载学习包数据
  },
)
```

**作用：** 当切换教材时，会加载新教材的学习包数据。

#### 监听 sectionName（章节名称）变化
```typescript
watch(
  () => props.sectionName,
  (newSectionName) => {
    sectionName.value = newSectionName  // 更新章节名称（对话框标题）
  },
)
```

### 6. 计算属性

#### filteredLearningPackages - 筛选学习方案
```typescript
const filteredLearningPackages = computed(() => {
  if (!sectionId.value) {
    return learningPackages.value  // 如果没有章节ID，返回全部
  }

  // 根据章节ID筛选学习方案（不区分大小写）
  return learningPackages.value.filter((pkg) => {
    const hasSectionId = pkg.sectionId && pkg.sectionId.trim() !== ''
    return hasSectionId && pkg.sectionId.toLowerCase() === sectionId.value.toLowerCase()
  })
})
```

**作用：** 根据当前选中的章节ID，筛选出对应的学习方案。

#### currentScheme - 当前选中的方案
```typescript
const currentScheme = computed(() => {
  if (
    selectedSchemeIndex.value >= 0 &&
    selectedSchemeIndex.value < filteredLearningPackages.value.length
  ) {
    return filteredLearningPackages.value[selectedSchemeIndex.value]
  }
  return null
})
```

#### currentResources - 当前方案的资源列表（带缩略图）
```typescript
const currentResources = computed(() => {
  if (!currentScheme.value) return []

  const resources = currentScheme.value.resourceList || []

  // 为每个资源添加缩略图信息
  return resources.map((resource) => {
    const localFile = localFiles.value.find((file) => file.id === resource.id)
    return {
      ...resource,
      thumbnail: localFile?.thumbnail,  // 添加缩略图
    }
  })
})
```

## 三、UI 渲染流程

### 1. 加载状态
```vue
<div v-if="loadingPackages" class="loading-container">
  <q-spinner color="primary" size="40px" />
  <div class="loading-text">正在加载学习方案...</div>
</div>
```

### 2. 学习方案列表
```vue
<div v-else-if="filteredLearningPackages.length > 0" class="scheme-list">
  <!-- 渲染学习方案列表 -->
  <div v-for="(scheme, index) in filteredLearningPackages" :key="scheme.id">
    <!-- 方案项：显示方案名称和难度评级 -->
  </div>
</div>
```

### 3. 资源列表
```vue
<div v-else-if="currentResources.length > 0" class="resources-list">
  <!-- 渲染资源列表 -->
  <div v-for="(resource, index) in currentResources" :key="resource.id">
    <!-- 资源项：显示缩略图、文件名、大小和"去学习"按钮 -->
  </div>
</div>
```

### 4. 空状态
- 无学习方案：显示"该章节暂无学习方案"
- 无资源：显示"该方案暂无资源文件"
- 未选择方案：显示"请先选择学习方案"

## 四、数据流程图

```
用户点击"去学习"
    ↓
KnowledgeGraphView.vue
    ↓ handleLearnDialog()
设置 learningDialogData
    ↓
渲染 LearningView 组件
    ↓ onMounted()
loadLearningPackages()
    ↓
从 IndexedDB 获取教材信息 (resourceManager.getTextbookInfoById)
    ↓
处理学习包数据（难度合并）
    ↓
加载本地文件信息（缩略图）
    ↓
自动选择第一个方案
    ↓
渲染 UI（方案列表 + 资源列表）
```

## 五、关键数据流

### 1. 学习包数据源
- **唯一数据源：** IndexedDB（通过 `resourceManager.getTextbookInfoById`）
- **不再从 API 获取：** 根据用户修改，已移除 API 调用逻辑

### 2. 难度数据管理
- **数据源优先级：**
  1. IndexedDB 中的 `difficulty` 属性（最高优先级）
  2. localStorage 中的 `learning_package_difficulty_{packageId}`（次优先级）
  3. 默认值 1（最低优先级）

- **同步机制：**
  - IndexedDB → localStorage（读取时同步）
  - 用户修改难度 → localStorage + IndexedDB（双向保存）

### 3. 筛选机制
- **根据章节ID筛选：** 只显示 `sectionId` 匹配当前节点ID的学习方案
- **不区分大小写：** 使用 `toLowerCase()` 进行比较
- **空值处理：** 如果 `sectionId` 为空，显示所有方案

## 六、用户体验流程

1. **打开对话框** → 显示加载状态
2. **加载完成** → 显示学习方案列表（左侧）
3. **自动选中第一个方案** → 显示对应资源列表（右侧）
4. **用户可切换方案** → 点击方案项，右侧资源列表更新
5. **用户可调整难度** → 通过星级评分，实时保存到 IndexedDB 和 localStorage
6. **点击"去学习"** → 跳转到对应的资源查看器（PDF/HTML/Video）

## 七、错误处理

1. **无教材ID：** 直接返回，不加载数据
2. **教材不存在：** 显示空状态
3. **无学习包：** 显示"该章节暂无学习方案"
4. **无资源文件：** 显示"该方案暂无资源文件"
5. **加载失败：** 捕获异常，显示空状态，避免页面崩溃

## 八、性能优化点

1. **计算属性缓存：** `filteredLearningPackages`、`currentScheme`、`currentResources` 使用计算属性，自动缓存
2. **自动监听数据变化：** BScroll 使用 `autoWatch` 模式，数据变化时自动刷新
3. **按需加载：** 只在需要时加载学习包数据和文件信息
4. **响应式更新：** 通过 watch 监听 props 变化，按需重新加载数据

