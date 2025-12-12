# 20251212_知识图谱章节结构缓存未使用IndexedDB问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`知识图谱章节结构加载性能`
- **发现日期**：`2025-12-12`
- **解决状态**：`已解决`

## 问题现象
知识图谱章节结构数据（来自`/app/teacher-textbook-section-tree`接口）原本使用localStorage缓存，存在以下问题：
1. 数据大小受限（localStorage通常有5MB限制）
2. 无法结构化存储和索引
3. 清理过期缓存效率低

## 技术原因 (❌)
1. 原实现使用localStorage缓存章节结构，键名为`knowledge_graph_chapter_structure_${textbookId}`
2. localStorage不适合存储较大或结构化的数据
3. 缺乏索引，无法高效查询

## 正确实现方案 (✅)
1. 在TextbookStorage的IndexedDB中新增`knowledge_graph_chapter_structure`表
2. 表结构：
   - `id` (主键): `${userId}_${textbookId}`
   - `userId`: 当前用户ID
   - `textbookId`: 教材ID
   - `data`: 章节结构数据
   - `timestamp`: 缓存时间戳
3. 在`KnowledgeGraphView.vue`中实现优先从IndexedDB读取缓存的逻辑

## 关键代码/公式
### 新增IndexedDB表（resource-storage.ts）
```@d:\Project\xueban-qianduan\imates-web\src\services\storage\resource-storage.ts:87-96
        {
          // 知识图谱章节结构缓存表（/app/teacher-textbook-section-tree）
          name: 'knowledge_graph_chapter_structure',
          keyPath: 'id',
          indexes: [
            { name: 'userId', keyPath: 'userId' },
            { name: 'textbookId', keyPath: 'textbookId' },
            { name: 'timestamp', keyPath: 'timestamp' }
          ]
        }
```

### 缓存读写函数（KnowledgeGraphView.vue）
```@d:\Project\xueban-qianduan\imates-web\src\views\KnowledgeGraphView.vue:960-1029
// ========== 知识图谱章节结构 IndexedDB 缓存（knowledge_graph_chapter_structure 表） ==========

interface KnowledgeGraphChapterStructureRecord {
  id: string // 主键：`${userId}_${textbookId}`
  userId: string
  textbookId: string
  data: ChapterNode[]
  timestamp: number
}

const buildKGRecordId = (userId: string, textbookId: string): string => {
  return `${userId}_${textbookId}`
}

const ensureKGStoreInitialized = async () => {
  const db = resourceManager.indexedDB
  if (!db.isInitialized) {
    await db.init()
  }
}

// 从 IndexedDB 读取章节结构缓存
const loadChapterStructureFromDB = async (textbookId: string): Promise<ChapterNode[] | null> => {
  try {
    await ensureKGStoreInitialized()
    const db = resourceManager.indexedDB
    const userId = authStorageService.getCurrentUserIdOrDefault()
    const record = await db.get<KnowledgeGraphChapterStructureRecord>(
      'knowledge_graph_chapter_structure',
      buildKGRecordId(userId, textbookId)
    )

    if (!record) {
      return null
    }

    if (isCacheExpired(record.timestamp)) {
      return null
    }

    return record.data || null
  } catch (error) {
    console.warn('[KnowledgeGraph] 读取章节结构 IndexedDB 缓存失败', error)
    return null
  }
}

// 将章节结构写入 IndexedDB 缓存
const saveChapterStructureToDB = async (
  textbookId: string,
  data: ChapterNode[]
): Promise<boolean> => {
  try {
    await ensureKGStoreInitialized()
    const db = resourceManager.indexedDB
    const userId = authStorageService.getCurrentUserIdOrDefault()
    const record: KnowledgeGraphChapterStructureRecord = {
      id: buildKGRecordId(userId, textbookId),
      userId,
      textbookId,
      data,
      timestamp: Date.now()
    }
    await db.put<KnowledgeGraphChapterStructureRecord>('knowledge_graph_chapter_structure', record)
    return true
  } catch (error) {
    console.warn('[KnowledgeGraph] 保存章节结构到 IndexedDB 失败', error)
    return false
  }
}
```

### 加载章节结构优先使用缓存
```@d:\Project\xueban-qianduan\imates-web\src\views\KnowledgeGraphView.vue:1175-1211
// 加载章节结构（优先从 IndexedDB 的 knowledge_graph_chapter_structure 表读取缓存）
const loadChapterStructure = async (textbookId: string) => {
  try {
    // 先尝试从 IndexedDB 缓存加载章节结构
    const cachedChapterData = await loadChapterStructureFromDB(textbookId)
    
    if (cachedChapterData && cachedChapterData.length > 0) {
      // 直接使用后台返回的顺序，不进行排序
      chapterStructure.value = cachedChapterData
      
      // 提取章节名称列表（所有level=0的章节），并转换为中文数字
      chapters.value = cachedChapterData.map((chapter: { name: string }) => convertToChineseNumber(chapter.name))
      
      // 初始化所有章节的状态
      initializeChapterStates(textbookId, cachedChapterData, getSubChapters)
      return
    }

    // 缓存中没有数据，从API获取
    const chapterData = await apiService.getTextbookStructure(textbookId)
    
    if (chapterData && chapterData.length > 0) {
      // 直接使用后台返回的顺序，不进行排序
      chapterStructure.value = chapterData
      
      // 缓存章节结构数据到 IndexedDB
      await saveChapterStructureToDB(textbookId, chapterData)
      
      // 提取章节名称列表（所有level=0的章节），并转换为中文数字
      chapters.value = chapterData.map(chapter => convertToChineseNumber(chapter.name))
      
      // 初始化所有章节的状态
      initializeChapterStates(textbookId, chapterData, getSubChapters)
    } else {
      chapterStructure.value = []
      chapters.value = []
    }
  } catch (error) {
    console.error('[流程] ❌ 加载章节结构出错:', error)
    chapterStructure.value = []
    chapters.value = []
  }
}
```

## 测试验证
- **场景1**：首次加载教材章节
  - 预期：调用接口，数据存入IndexedDB
- **场景2**：再次加载相同教材
  - 预期：从IndexedDB读取，不调用接口
- **场景3**：缓存过期（24小时后）
  - 预期：调用接口并更新缓存

## 预防措施
1. 所有结构化数据缓存优先使用IndexedDB
2. 缓存表设计需包含时间戳和用户隔离
3. 缓存读取实现自动过期检查
