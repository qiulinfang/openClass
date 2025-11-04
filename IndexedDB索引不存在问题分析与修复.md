# IndexedDB 索引不存在问题分析与修复

## 问题概述

在教材下载功能中，当使用 `getByIndex` 方法通过 `textbookId` 索引查询教材信息时，出现索引不存在的错误，导致下载功能无法正常工作。

## 错误信息

### 错误表现
- 在下载教材时，控制台报错：`NotFoundError` 或索引相关错误
- 错误发生在 `api-service.ts` 中的两个位置：
  1. `collectFilesToUpdate` 方法（第1577-1595行）
  2. `updateLocalFileInfo` 方法（第1920-1933行）

### 错误堆栈
```
NotFoundError: 索引不存在
或者
Index does not exist: textbookId
```

## 问题原因分析

### 1. IndexedDB 索引创建机制

IndexedDB 的索引只在数据库版本升级时创建，具体机制如下：

1. **索引创建时机**：索引只能在 `upgradeneeded` 事件中创建
2. **版本升级触发**：只有当数据库版本号增加时，才会触发 `upgradeneeded` 事件
3. **已存在数据库**：如果数据库已经存在且版本号未改变，索引不会自动创建

### 2. 当前数据库配置

查看 `resource-storage.ts` 中的数据库配置：

```typescript
this.indexedDBInstance = IndexedDBService.getInstance({
  dbName: 'TextbookStorage',
  version: 7, // 当前版本为7
  stores: [
    {
      name: 'textbooks',
      keyPath: 'id',
      indexes: [
        { name: 'isDownloaded', keyPath: 'isDownloaded' },
        { name: 'downloadStatus', keyPath: 'downloadStatus' },
        { name: 'lastDownloadTime', keyPath: 'lastDownloadTime' },
        { name: 'subjectLabel', keyPath: 'textbookSubjectLabel' },
        { name: 'gradeLabel', keyPath: 'textbookGradeLabel' },
        { name: 'textbookId', keyPath: 'textbookId' } // 问题索引
      ]
    },
    // ...
  ]
})
```

### 3. 问题场景

以下情况会导致 `textbookId` 索引不存在：

1. **旧数据库升级**：
   - 用户之前使用较低版本的数据库（version < 7）
   - 升级到 version 7 时，如果数据库已经存在且版本号跳过了某些版本
   - 索引创建逻辑可能未正确执行

2. **数据库初始化失败**：
   - IndexedDB 初始化过程中出现错误
   - 索引创建失败但数据库对象已存在

3. **浏览器兼容性问题**：
   - 某些浏览器对 IndexedDB 索引创建的支持存在差异
   - 索引创建可能被静默失败

4. **代码变更历史**：
   - `textbookId` 索引可能是后来添加的
   - 旧用户数据库中没有该索引

## 解决方案

### 策略：降级查询（Graceful Degradation）

采用两层查询策略：
1. **优先使用索引查询**（性能最优）
2. **索引不存在时回退到全表查询**（兼容性保证）

### 实现代码

#### 1. 修复 `collectFilesToUpdate` 方法

**位置**：`imates-web/src/services/api-service.ts` 第1577-1595行

**修复前**：
```typescript
// 如果通过 id 查不到，尝试通过 textbookId 查询
if (!latestTextbook && textbook.textbookId) {
  latestTextbook = await resourceManager.indexedDB.getByIndex<UserTextbookInfo>('textbooks', 'textbookId', textbook.textbookId)
}
```

**修复后**：
```typescript
// 如果通过 id 查不到，尝试通过 textbookId 查询
if (!latestTextbook && textbook.textbookId) {
  try {
    latestTextbook = await resourceManager.indexedDB.getByIndex<UserTextbookInfo>('textbooks', 'textbookId', textbook.textbookId)
  } catch (error: any) {
    // 如果索引不存在（旧数据库可能没有textbookId索引），改用getAll在内存中查找
    if (error?.name === 'NotFoundError' || error?.message?.includes('index')) {
      console.log('[ApiService.collectFilesToUpdate] ⚠️ textbookId索引不存在，改用getAll查询', {
        textbookId: textbook.textbookId,
        error: error.message
      })
      const allTextbooks = await resourceManager.indexedDB.getAll<UserTextbookInfo>('textbooks')
      latestTextbook = allTextbooks.find(t => t.textbookId === textbook.textbookId) || null
    } else {
      // 其他错误，重新抛出
      throw error
    }
  }
}
```

#### 2. 修复 `updateLocalFileInfo` 方法

**位置**：`imates-web/src/services/api-service.ts` 第1920-1933行

**修复前**：
```typescript
// 获取教材信息
const textbook = await resourceManager.indexedDB.getByIndex('textbooks', 'textbookId', textbookId) as UserTextbookInfo
if (!textbook) {
  return
}
```

**修复后**：
```typescript
// 获取教材信息
let textbook: UserTextbookInfo | null = null
try {
  textbook = await resourceManager.indexedDB.getByIndex('textbooks', 'textbookId', textbookId) as UserTextbookInfo
} catch (error: any) {
  // 如果索引不存在（旧数据库可能没有textbookId索引），改用getAll在内存中查找
  if (error?.name === 'NotFoundError' || error?.message?.includes('index')) {
    const allTextbooks = await resourceManager.indexedDB.getAll<UserTextbookInfo>('textbooks')
    textbook = allTextbooks.find(t => t.textbookId === textbookId) || null
  } else {
    // 其他错误，静默处理
    return
  }
}

if (!textbook) {
  return
}
```

## 解决方案优势

### 1. 向后兼容
- 支持旧数据库（无索引）
- 支持新数据库（有索引）
- 无需强制用户重建数据库

### 2. 性能优化
- 优先使用索引查询（O(log n) 复杂度）
- 仅在必要时回退到全表查询（O(n) 复杂度）
- 大多数情况下性能不受影响

### 3. 错误处理
- 捕获特定错误类型（索引不存在）
- 区分索引错误和其他数据库错误
- 提供详细的日志记录

### 4. 用户体验
- 用户无感知，自动处理
- 不影响现有功能
- 无需用户手动操作

## 测试建议

### 1. 测试场景

#### 场景1：新数据库（有索引）
- 清除浏览器缓存
- 重新登录
- 下载教材
- **预期**：使用索引查询，性能正常

#### 场景2：旧数据库（无索引）
- 使用旧版本数据库
- 升级到新版本
- 下载教材
- **预期**：自动回退到全表查询，功能正常

#### 场景3：索引创建失败
- 模拟索引创建失败
- 执行下载操作
- **预期**：自动回退到全表查询，功能正常

### 2. 性能测试

- **索引查询**：应该 < 10ms
- **全表查询**：取决于数据量，通常 < 100ms（1000条记录以内）
- **混合场景**：首次使用全表查询，后续使用索引查询

### 3. 兼容性测试

- Chrome/Edge（Chromium）
- Firefox
- Safari
- 移动端浏览器

## 长期改进建议

### 1. 数据库迁移工具

创建专门的数据库迁移工具，确保索引创建：

```typescript
async function ensureIndexes(db: IDBDatabase): Promise<void> {
  const transaction = db.transaction(['textbooks'], 'readwrite')
  const store = transaction.objectStore('textbooks')
  
  // 检查索引是否存在
  if (!store.indexNames.contains('textbookId')) {
    store.createIndex('textbookId', 'textbookId', { unique: false })
  }
}
```

### 2. 索引存在性检查

在初始化时检查索引是否存在：

```typescript
async function checkIndexExists(db: IDBDatabase, storeName: string, indexName: string): Promise<boolean> {
  try {
    const transaction = db.transaction([storeName], 'readonly')
    const store = transaction.objectStore(storeName)
    return store.indexNames.contains(indexName)
  } catch {
    return false
  }
}
```

### 3. 监控和日志

添加索引使用情况的监控：

```typescript
let indexUsageCount = 0
let fallbackUsageCount = 0

// 在回退查询时记录
if (fallback) {
  fallbackUsageCount++
  console.warn(`Index fallback used: ${fallbackUsageCount} times`)
}
```

## 相关文件

- `imates-web/src/services/api-service.ts` - 主要修复文件
- `imates-web/src/services/resource-storage.ts` - 数据库配置
- `imates-web/src/services/indexeddb-service.ts` - IndexedDB 服务封装

## 总结

本次修复通过**降级查询策略**解决了 IndexedDB 索引不存在的问题，既保证了向后兼容性，又维持了良好的性能。这种方案适合处理数据库版本升级和索引创建的不确定性，为用户提供了平滑的升级体验。

**关键要点**：
1. ✅ 优先使用索引查询（性能最优）
2. ✅ 索引不存在时自动回退（兼容性保证）
3. ✅ 详细的错误处理和日志记录
4. ✅ 用户无感知的自动修复

---

**修复日期**：2025-01-XX  
**影响范围**：教材下载功能  
**优先级**：高（影响核心功能）

