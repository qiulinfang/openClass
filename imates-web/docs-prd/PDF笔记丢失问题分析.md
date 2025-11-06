# PDF笔记丢失问题分析

## 一、问题描述

在 `PdfViewerView.vue` 中绘制笔记后，退出再进入时笔记丢失。

## 二、IndexedDB账号隔离情况

### 2.1 账号隔离实现 ✅

**IndexedDB确实区分账号**：

```typescript
// resource-storage.ts
const userId = getCurrentUserIdOrDefault()
const dbName = `TextbookStorage_${userId}`  // ✅ 使用用户ID作为数据库名前缀
```

**实现机制**：
- 每个用户拥有独立的IndexedDB数据库：`TextbookStorage_${userId}`
- 账号切换时，`ResourceManager.getInstance()` 会检查用户ID变化，重新创建实例
- 笔记数据存储在 `textbooks` 表的 `localFiles[].annotations` 字段中

**代码位置**：
```42:43:imates-web/src/services/resource-storage.ts
const userId = getCurrentUserIdOrDefault()
const dbName = `TextbookStorage_${userId}`
```

```106:118:imates-web/src/services/resource-storage.ts
public static getInstance(): ResourceManager {
  // 检查用户是否切换，如果切换则重新创建实例
  const userId = getCurrentUserIdOrDefault()
  if (!ResourceManager.instance || ResourceManager.currentUserId !== userId) {
    // 如果已有实例，先关闭旧的数据库连接
    if (ResourceManager.instance) {
      ResourceManager.instance.indexedDB.close()
    }
    // 创建新实例
    ResourceManager.instance = new ResourceManager()
    ResourceManager.currentUserId = userId
  }
  return ResourceManager.instance
}
```

## 三、笔记保存流程分析

### 3.1 保存流程

**绘制笔记时的保存流程**：

1. **用户绘制笔记** → `PdfPage.vue` 的 `onAnnotationChanged` 回调
2. **更新Store** → `store.updateAnnotations(pageNum, serializedObjects)`
3. **触发防抖保存** → `debouncedSave()` (延迟2秒)
4. **自动保存** → `autoSaveAnnotations()` → `saveAnnotationsToLocalFile()`
5. **保存到IndexedDB** → `resourceManager.indexedDB.put('textbooks', textbook)`

**关键代码**：

```189:194:imates-web/src/components/PdfPage.vue
onAnnotationChanged: (annotations) => {
  // 保存注释到Store
  const cleanObjects = annotations.map(a => a.content)
  const serializedObjects = IndexedDBService.deepSerialize(cleanObjects) as object[]
  store.updateAnnotations(props.layout.pageNum, serializedObjects)
}
```

```274:302:imates-web/src/stores/pdfViewerStore.ts
// 更新指定页面的笔记
updateAnnotations(pageNum: number, fabricJson: object[]) {
  // 1. 更新内存中的笔记数据
  if (fabricJson && fabricJson.length > 0) {
    this.allAnnotations[pageNum] = fabricJson
  } else {
    delete this.allAnnotations[pageNum]
  }
  
  // 2. 同时更新 notes Map（保持兼容性）
  const pageId = `page-${pageNum}`
  if (fabricJson && fabricJson.length > 0) {
    const noteData: NoteData[] = fabricJson.map((obj: object, index: number) => ({
      id: `${pageId}-${index}`,
      pageId,
      type: 'fabric',
      content: obj,
      config: this.drawingConfig,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }))
    this.notes.set(pageId, noteData)
  } else {
    this.notes.delete(pageId)
  }
  
  // 3. 触发防抖自动保存
  this.debouncedSave()
}
```

```304:316:imates-web/src/stores/pdfViewerStore.ts
// 防抖保存笔记到 IndexedDB
debouncedSave() {
  // 清除之前的定时器
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer)
    saveDebounceTimer = null
  }
  
  // 设置新的定时器（2秒后保存）
  saveDebounceTimer = setTimeout(async () => {
    await this.autoSaveAnnotations()
  }, 2000)
}
```

```396:431:imates-web/src/stores/pdfViewerStore.ts
// 保存笔记数据到localFiles
async saveAnnotationsToLocalFile() {
  if (!this.currentFileId || !this.currentResourceId) {
    throw new Error('没有当前文件信息')
  }
  
  try {
    // 1. 获取教材信息
    const textbook = await resourceManager.indexedDB.get('textbooks', this.currentFileId) as UserTextbookInfo
    if (!textbook || !textbook.localFiles) {
      throw new Error('教材信息不存在')
    }
    
    // 2. 查找对应的本地文件
    const localFileIndex = textbook.localFiles.findIndex((file: LocalFileInfo) => file.id === this.currentResourceId)
    if (localFileIndex === -1) {
      throw new Error('本地文件不存在')
    }
    
    // 3. 移除Vue响应式代理
    const rawAnnotations = toRaw(this.allAnnotations)
    console.log('rawAnnotations', rawAnnotations)
    console.log('localFileIndex', localFileIndex)
    // 4. 更新注释数据
    textbook.localFiles[localFileIndex].annotations = rawAnnotations
    console.log('textbook.localFiles[localFileIndex].annotations', textbook.localFiles[localFileIndex].annotations)
    console.log('textbook', textbook)
    // 5. 保存到IndexedDB（IndexedDB会自动进行深度序列化）
    await resourceManager.indexedDB.put('textbooks', textbook)
    
    console.log('笔记数据已保存到localFiles')
  } catch (error) {
    console.error('保存笔记数据到localFiles失败:', error)
    throw error
  }
}
```

### 3.2 组件卸载时的保存

```625:628:imates-web/src/views/PdfViewerView.vue
// 页面卸载前立即保存笔记
onBeforeUnmount(async () => {
  await store.flushSave()
})
```

```340:350:imates-web/src/stores/pdfViewerStore.ts
// 立即保存笔记（用于组件卸载等场景）
async flushSave() {
  // 清除防抖定时器
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer)
    saveDebounceTimer = null
  }
  
  // 立即保存
  await this.autoSaveAnnotations()
}
```

## 四、笔记加载流程分析

### 4.1 加载流程

**进入PDF查看器时的加载流程**：

1. **从路由加载文件** → `loadFileFromRoute()`
2. **设置当前文件信息** → `store.setCurrentFileInfo(id, resourceId)`
3. **加载PDF** → `loadPdfWithService(file)`
4. **加载笔记数据** → `store.loadAnnotationsFromLocalFile()`
5. **渲染PDF页面** → `PdfPage.vue` 组件初始化
6. **加载笔记到Canvas** → `loadAnnotations()`

**关键代码**：

```405:454:imates-web/src/views/PdfViewerView.vue
// 使用服务类加载PDF
const loadPdfWithService = async (file: File) => {
  try {
    stateAdapter.setLoading(true)
    stateAdapter.setError(null)
    
    // 1. 设置当前文件信息到Store
    const resourceId = route.query.resourceId as string
    const id = route.query.id as string
    if (resourceId && id) {
      store.setCurrentFileInfo(id, resourceId)
    }
    
    // 2. 从localFiles加载笔记数据
    await store.loadAnnotationsFromLocalFile()
    
    // 3. 使用PdfCoreService加载PDF
    const result = await pdfCoreService.loadPdf(file)
    
    // 4. 计算页面布局
    const scale = stateAdapter.getState().scale
    const layouts = await pdfCoreService.calculatePageLayouts(scale)
    
    // 5. 更新状态适配器
    stateAdapter.setPdfLoaded({
      ...result,
      pageLayouts: layouts,
    })
    
    // 6. 同时更新store（保持兼容性）
    store.pdfDoc = result.pdfDoc
    store.originalPdfBytes = result.originalPdfBytes
    store.pageLayouts = layouts
    store.totalPages = result.totalPages
    store.isDocLoaded = true
    
    console.log('PDF 加载完成:', {
      totalPages: result.totalPages,
      layouts: layouts.length
    })
    
  } catch (error) {
    console.error('PDF 加载失败:', error)
    stateAdapter.setError(error instanceof Error ? error.message : 'PDF 加载失败')
    store.error = error instanceof Error ? error.message : 'PDF 加载失败'
  } finally {
    stateAdapter.setLoading(false)
    store.isLoading = false
  }
}
```

```372:394:imates-web/src/stores/pdfViewerStore.ts
// 从localFiles加载笔记数据
async loadAnnotationsFromLocalFile() {
  if (!this.currentFileId || !this.currentResourceId) {
    return
  }
  
  try {
    // 获取教材信息
    const textbook = await resourceManager.indexedDB.get('textbooks', this.currentFileId) as UserTextbookInfo
    if (!textbook || !textbook.localFiles) {
      return
    }
    
    // 查找对应的本地文件
    const localFile = textbook.localFiles.find((file: LocalFileInfo) => file.id === this.currentResourceId)
    if (localFile && localFile.annotations) {
      this.allAnnotations = localFile.annotations
      console.log('从localFiles加载笔记数据:', localFile.annotations)
    }
  } catch (error) {
    console.warn('从localFiles加载笔记失败:', error)
  }
}
```

```216:239:imates-web/src/components/PdfPage.vue
// 加载笔记
const loadAnnotations = async () => {
  if (!fabricService.value) return
  
  try {
    // 从store获取注释（store中的格式是object[]）
    const pageAnnotations = store.allAnnotations[props.layout.pageNum] || []
    
    if (pageAnnotations.length > 0) {
      // 将store中的对象数组转换为AnnotationData格式
      const annotationData = pageAnnotations.map((obj, index) => ({
        id: `annotation-${props.layout.pageNum}-${index}`,
        type: 'fabric',
        content: obj,
        pageNum: props.layout.pageNum,
      }))
      
      // 使用FabricCanvasServiceEnhanced的loadAnnotations方法
      fabricService.value.loadAnnotations(annotationData)
    }
  } catch (err) {
    console.error(`第 ${props.layout.pageNum} 页加载笔记失败:`, err)
  }
}
```

## 五、可能的问题原因分析

### 问题1：防抖延迟导致未保存 ⚠️

**问题描述**：
- 笔记保存使用2秒防抖延迟
- 如果用户在2秒内退出，笔记可能未保存

**当前保护机制**：
- `onBeforeUnmount` 中调用 `flushSave()` 立即保存
- 但可能存在时序问题

**可能的问题场景**：
1. 用户快速绘制笔记后立即退出
2. 防抖定时器未触发，但 `flushSave()` 可能执行时机不对
3. 或者 `currentFileId`/`currentResourceId` 在卸载时已清空

### 问题2：currentFileId/currentResourceId 未正确设置 ⚠️

**问题描述**：
- `saveAnnotationsToLocalFile()` 依赖 `currentFileId` 和 `currentResourceId`
- 如果这两个值未正确设置，保存会失败

**检查点**：
```397:400:imates-web/src/stores/pdfViewerStore.ts
async saveAnnotationsToLocalFile() {
  if (!this.currentFileId || !this.currentResourceId) {
    throw new Error('没有当前文件信息')
  }
```

**可能的问题**：
- Store是全局的，可能被其他页面重置
- 或者 `setCurrentFileInfo` 调用时机不对

### 问题3：笔记加载时机问题 ⚠️

**问题描述**：
- `loadAnnotationsFromLocalFile()` 在 `loadPdfWithService` 中调用
- 但 `PdfPage.vue` 组件可能在笔记加载完成前就初始化了

**可能的问题**：
- 虚拟滚动导致 `PdfPage` 组件延迟创建
- 笔记加载完成时，某些页面组件还未创建，无法加载笔记

### 问题4：数据格式不匹配 ⚠️

**问题描述**：
- 保存时使用 `toRaw(this.allAnnotations)`
- 加载时直接赋值 `this.allAnnotations = localFile.annotations`
- 可能存在格式不匹配问题

**检查**：
- 保存的格式：`Record<number, object[]>`
- 加载的格式：应该也是 `Record<number, object[]>`
- 但可能存在序列化/反序列化问题

### 问题5：IndexedDB保存失败但未提示 ⚠️

**问题描述**：
- `saveAnnotationsToLocalFile()` 中的错误被捕获但可能未正确处理
- 用户可能不知道保存失败

**代码**：
```426:430:imates-web/src/stores/pdfViewerStore.ts
console.log('笔记数据已保存到localFiles')
} catch (error) {
  console.error('保存笔记数据到localFiles失败:', error)
  throw error
}
```

## 六、调试建议

### 6.1 添加调试日志

在关键位置添加日志：

```typescript
// 保存时
console.log('[笔记保存]', {
  currentFileId: this.currentFileId,
  currentResourceId: this.currentResourceId,
  annotationsCount: Object.keys(this.allAnnotations).length,
  annotations: this.allAnnotations
})

// 加载时
console.log('[笔记加载]', {
  currentFileId: this.currentFileId,
  currentResourceId: this.currentResourceId,
  loadedAnnotations: localFile.annotations
})
```

### 6.2 检查IndexedDB数据

在浏览器开发者工具中：
1. 打开 Application → IndexedDB
2. 找到 `TextbookStorage_${userId}` 数据库
3. 查看 `textbooks` 表
4. 检查对应教材的 `localFiles[].annotations` 字段是否有数据

### 6.3 检查控制台错误

查看是否有：
- `保存笔记数据到localFiles失败` 错误
- `从localFiles加载笔记失败` 警告
- IndexedDB相关错误

## 七、修复建议

### 修复1：确保保存成功（高优先级）

**问题**：防抖延迟可能导致保存失败

**解决方案**：
1. 减少防抖延迟时间（从2秒改为1秒）
2. 在多个时机触发保存：
   - 每次笔记更新时（防抖）
   - 页面切换时
   - 组件卸载时（立即保存）
   - 页面可见性变化时（visibilitychange事件）

**代码修改**：

```typescript
// 在 PdfViewerView.vue 中添加
onMounted(() => {
  // 监听页面可见性变化
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  store.flushSave()
})

const handleVisibilityChange = async () => {
  if (document.hidden) {
    // 页面隐藏时立即保存
    await store.flushSave()
  }
}
```

### 修复2：添加保存状态反馈（中优先级）

**问题**：用户不知道笔记是否保存成功

**解决方案**：
- 添加保存状态提示
- 保存失败时提示用户

### 修复3：优化加载时机（中优先级）

**问题**：笔记加载可能早于组件创建

**解决方案**：
- 在 `PdfPage.vue` 中添加 `watch` 监听 `store.allAnnotations` 变化
- 当笔记数据加载完成后，重新加载笔记

**代码修改**：

```typescript
// 在 PdfPage.vue 中添加
watch(() => store.allAnnotations[props.layout.pageNum], async (newAnnotations) => {
  if (newAnnotations && newAnnotations.length > 0 && fabricService.value) {
    await loadAnnotations()
  }
}, { deep: true })
```

### 修复4：增强错误处理（低优先级）

**问题**：保存失败时用户无感知

**解决方案**：
- 添加保存失败提示
- 记录保存失败日志
- 提供手动保存按钮

## 八、验证步骤

1. **绘制笔记后立即退出**：
   - 绘制笔记
   - 立即退出页面
   - 重新进入，检查笔记是否还在

2. **绘制笔记后等待2秒再退出**：
   - 绘制笔记
   - 等待2秒（防抖延迟）
   - 退出页面
   - 重新进入，检查笔记是否还在

3. **检查IndexedDB数据**：
   - 在开发者工具中查看IndexedDB
   - 确认笔记数据已保存

4. **切换账号测试**：
   - 账号A绘制笔记
   - 切换到账号B
   - 再切换回账号A
   - 检查笔记是否还在

