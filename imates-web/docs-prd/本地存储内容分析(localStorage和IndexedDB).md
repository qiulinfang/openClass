# Web项目本地存储内容分析（localStorage + IndexedDB）

## 概述

本文档详细分析了web项目中所有使用localStorage和IndexedDB存储的数据，按照功能模块进行分类整理。

## 存储技术说明

- **localStorage**: 同步存储，容量限制约5-10MB，适合存储小型配置数据和缓存
- **IndexedDB**: 异步存储，容量限制通常为50MB-1GB（取决于浏览器），适合存储大型数据和二进制文件

## localStorage存储内容

### 1. 用户认证与登录信息

#### 1.1 教师端登录信息
- **存储键**: `XUEBAN_TOKEN`
  - **类型**: String
  - **用途**: 教师端登录token
  - **存储位置**: `api-service.ts:1208`
  - **生命周期**: 登录时保存，登出时清除

- **存储键**: `userId`
  - **类型**: String
  - **用途**: 用户账号（教师端）
  - **存储位置**: `api-service.ts:1209`, `LoginView.vue:85`
  - **生命周期**: 登录时保存，用于自动填充登录表单

- **存储键**: `userPassword`
  - **类型**: String
  - **用途**: 用户密码（明文，用于自动填充）
  - **存储位置**: `api-service.ts:1210`, `LoginView.vue:87`
  - **生命周期**: 登录时保存，用于自动填充登录表单

- **存储键**: `userInfo`
  - **类型**: JSON对象
  - **用途**: 用户信息对象
  - **存储位置**: `api-service.ts:1249`
  - **生命周期**: 获取用户信息后保存

- **存储键**: `lastLoginTime`
  - **类型**: String (时间戳)
  - **用途**: 最后登录时间，用于会话管理
  - **存储位置**: `api-service.ts:1213`, `api-service.ts:1316`, `api-service.ts:2529`, `KnowledgeGraphView.vue:2221`
  - **生命周期**: 每次登录时更新

#### 1.2 学生端登录信息
- **存储键**: `YANBAN_TOKEN`
  - **类型**: String
  - **用途**: 学生端登录token
  - **存储位置**: `api-service.ts:1312`, `resource-storage.ts:125`, `resource-storage.ts:134`
  - **生命周期**: 学生登录时保存，登出时清除

- **存储键**: `studentUserId`
  - **类型**: String
  - **用途**: 学生用户ID
  - **存储位置**: `api-service.ts:1313`, `resource-storage.ts:126`, `resource-storage.ts:135`
  - **生命周期**: 学生登录时保存，登出时清除

#### 1.3 用户信息缓存（带用户ID前缀）
- **存储键**: `{userId}_USER_INFO_CACHE`
  - **类型**: JSON对象
  - **用途**: 用户信息缓存，实现账号隔离
  - **存储位置**: `userStore.ts:46`, `userStore.ts:57`, `userStore.ts:76`
  - **生命周期**: 初始化时加载，用户信息更新时保存
  - **清理**: 账号切换时清理旧账号数据

---

### 2. 教师聊天会话管理

#### 2.1 教师通用会话存储

**存储方式**：所有会话统一存储在一条 localStorage 记录中

**会话信息存储键名**（localStorage）：
- **存储键**: `{userId}_teacher-general-sessions`
- **类型**: JSON对象 (Record<string, TeacherSession>)
- **数据结构**:
  ```typescript
  {
    [sessionId: string]: TeacherSession
  }
  
  interface TeacherSession {
    sessionId: string      // 会话ID，格式：teacher-{hash}-{timestamp}
    sessionName: string    // 会话名称，如"数学答疑"、"生物答疑"
    subject: string        // 科目：'biology' | 'math'
    createTime: number     // 创建时间戳（毫秒）
  }
  ```
- **存储位置**: `teacherGeneralChatStore.ts`
- **生命周期**: 创建/更新会话时保存，删除会话时更新
- **清理**: 账号切换时清理旧账号数据
- **数据迁移**: 支持从旧格式（每个会话单独存储）自动迁移到新格式

**存储操作**：
- **保存会话信息**: `localStorage.setItem(storageKey, JSON.stringify(sessions))`
  - 存储键：`${userId}_teacher-general-sessions`
  - 存储格式：`Record<string, TeacherSession>`
- **加载会话列表**: `localStorage.getItem(storageKey)` 然后 `JSON.parse()`
  - 从统一存储中读取所有会话
- **保存单个会话**: 从统一存储中读取，更新该会话，然后保存整个对象
- **删除会话**: 从统一存储中读取，删除该会话，然后保存整个对象

**消息存储键名**（IndexedDB，统一存储）：
- **存储键**: `{userId}_chat_history_teacher-general`
- **存储格式**: `Record<string, { messages: ChatBubble[], chatResponseTimes: number, lastUpdated: number }>`
- **key**: `sessionId`，value：该会话的消息数据
- **存储位置**: `teacherGeneralChatStore.ts`
- **生命周期**: 保存聊天记录时存储，删除会话时清除

**旧格式兼容**：
- **旧格式存储键**: `{userId}_teacher-general-${sessionId}_session` (旧格式，已迁移)
- **旧格式存储键**: `teacher_chat_{sessionId}_session` (旧格式，兼容处理)
- **类型**: JSON对象
- **用途**: 旧格式的会话信息（每个会话单独存储）
- **存储位置**: `teacherGeneralChatStore.ts:migrateOldSessions()`
- **生命周期**: 兼容旧数据，会自动迁移到新格式（统一存储）
- **迁移逻辑**: 启动时自动检测并迁移旧格式数据到新格式，迁移后删除旧数据

#### 2.2 教师题目会话存储

**存储方式**：所有会话统一存储在一条 localStorage 记录中

**会话信息存储键名**（localStorage）：
- **存储键**: `{userId}_teacher-exercise-sessions`
- **类型**: JSON对象 (Record<string, TeacherExerciseSession>)
- **数据结构**:
  ```typescript
  {
    [sessionId: string]: TeacherExerciseSession
  }
  
  interface TeacherExerciseSession {
    sessionId: string
    questionId: string
    sessionName: string
    subject: 'biology' | 'math'
    createTime: number
    updateTime?: number
  }
  ```
- **存储位置**: `teacherExerciseChatStore.ts`
- **生命周期**: 创建/更新会话时保存，删除会话时更新
- **数据迁移**: 支持从旧格式（每个会话单独存储）自动迁移到新格式

**消息存储键名**（IndexedDB）：
- **存储方式**: 分别存储，每个题目一个独立的键
- **存储键**: `{userId}_teacher_chat_history_teacher-exercise-${questionId}`
- **存储位置**: `teacherExerciseChatStore.ts` → `chat-storage.ts`
- **生命周期**: 保存聊天记录时存储，删除会话时清除

#### 2.3 当前科目设置（带用户ID前缀）
- **存储键**: `{userId}_currentTeacherSubject`
  - **类型**: String ('MATH' | 'BIOLOGY')
  - **用途**: 当前教师聊天使用的科目
  - **存储位置**: `ChatView.vue:406`, `ChatView.vue:780`, `ChatView.vue:884`, `ChatView.vue:979`, `UnifiedChatDialog.vue:316`, `UnifiedChatDialog.vue:372`, `UnifiedChatDialog.vue:407`, `TeacherChatDialog.vue:219`, `TeacherChatDialog.vue:320`, `TeacherChatDialog.vue:372`, `teacherChatStore.ts:838`
  - **生命周期**: 切换科目时更新

#### 2.4 聊天历史记录（IndexedDB降级到localStorage）
- **存储键**: `{userId}_chat_history_{questionId}`
  - **类型**: JSON对象 (ChatHistoryData)
  - **用途**: 普通聊天历史记录（IndexedDB不可用时的降级方案）
  - **存储位置**: `chat-storage.ts:133`
  - **生命周期**: 保存聊天记录时，IndexedDB失败时降级使用

- **存储键**: `{userId}_teacher_chat_history_{questionId}`
  - **类型**: JSON对象 (ChatHistoryData)
  - **用途**: 教师聊天历史记录（IndexedDB不可用时的降级方案）
  - **存储位置**: `chat-storage.ts:168`
  - **生命周期**: 保存教师聊天记录时，IndexedDB失败时降级使用

---

### 3. AI通用聊天会话

#### 3.1 AI通用会话存储

**存储方式**：所有会话统一存储在一条 localStorage 记录中

**会话信息存储键名**（localStorage）：
- **存储键**: `{userId}_ai-general-sessions`
- **类型**: JSON数组 (AiGeneralSession[])
- **数据结构**:
  ```typescript
  [
    {
      sessionId: string
      sessionName: string
      createTime: number
      updateTime: number
      msgCount: number
    },
    ...
  ]
  ```
- **存储位置**: `aiGeneralChatStore.ts`
- **生命周期**: 创建/更新会话时保存，删除会话时更新
- **清理**: 账号切换时清理旧账号数据

**消息存储键名**（IndexedDB）：
- **存储键**: `{userId}_chat_history_ai-general-${sessionId}`
- **存储位置**: `aiGeneralChatStore.ts`
- **生命周期**: 保存聊天记录时存储，删除会话时清除

#### 3.2 AI题目会话存储

**特点**：不需要会话列表，直接按题目ID存储消息

**消息存储键名**（IndexedDB）：
- **存储键**: `{userId}_chat_history_ai-exercise-${questionId}`
- **存储位置**: `aiExerciseChatStore.ts`
- **生命周期**: 保存聊天记录时存储，删除题目时清除

#### 3.3 AI教材会话存储

**特点**：不需要会话列表，直接按资源ID存储消息

**消息存储键名**（IndexedDB）：
- **存储键**: `{userId}_chat_history_ai-textbook-${resourceId}`
- **存储位置**: `aiTextbookChatStore.ts`
- **生命周期**: 保存聊天记录时存储，删除资源时清除

---

### 4. 学习相关数据

#### 4.1 学习包难度设置
- **存储键**: `learning_package_difficulty_{packageId}`
  - **类型**: String (数字1-5)
  - **用途**: 学习包的难度等级
  - **存储位置**: `LearningView.vue:307`, `LearningView.vue:331`, `LearningView.vue:516`
  - **生命周期**: 用户选择难度时保存

#### 4.2 已学习节点列表（带用户ID前缀）
- **存储键**: `{userId}_LEARNED_NODES`
  - **类型**: JSON数组 (节点ID列表)
  - **用途**: 标记已学习的知识图谱节点
  - **存储位置**: `LearningView.vue:472`, `LearningView.vue:487`
  - **生命周期**: 学习资源时标记节点，持久化保存

#### 4.3 最后学习的节点ID（带用户ID前缀）
- **存储键**: `{userId}_last_learned_node_id`
  - **类型**: String
  - **用途**: 最后学习的知识图谱节点ID
  - **存储位置**: `KnowledgeGraph.vue:148`, `KnowledgeGraph.vue:162`
  - **生命周期**: 学习节点时更新

#### 4.4 学习包数据缓存（带用户ID前缀）
- **存储键**: `learning_packages_{userId}_{id}`
  - **类型**: JSON对象 (包含data和timestamp)
  - **用途**: 学习包数据缓存，24小时过期
  - **存储位置**: `api-service.ts:1435`, `api-service.ts:1453`
  - **生命周期**: API获取后缓存，24小时后过期

---

### 5. 知识图谱相关数据

#### 5.1 章节结构缓存
- **存储键**: `knowledge_graph_chapter_structure_{textbookId}`
  - **类型**: JSON对象 (包含value和timestamp)
  - **用途**: 教材章节结构缓存，24小时过期
  - **存储位置**: `KnowledgeGraphView.vue:1815`, `KnowledgeGraphView.vue:1838`, `KnowledgeGraphView.vue:1853`
  - **生命周期**: 获取章节结构后缓存，24小时后过期

#### 5.2 缓存时间戳
- **存储键**: `knowledge_graph_cache_timestamp`
  - **类型**: Number (时间戳)
  - **用途**: 知识图谱缓存的时间戳
  - **存储位置**: `KnowledgeGraphView.vue:1801`
  - **生命周期**: 缓存数据时更新

#### 5.3 教材章节结构持久化（石景山知识图谱）
- **存储键**: `textbook_structure_{textbookId}`
  - **类型**: JSON对象 (包含structure和timestamp)
  - **用途**: 教材章节结构的持久化存储
  - **存储位置**: `shijingshan-knowledge-utils.ts:544`, `shijingshan-knowledge-utils.ts:615`, `shijingshan-knowledge-utils.ts:634`, `shijingshan-knowledge-utils.ts:648`
  - **生命周期**: 获取章节结构后保存

#### 5.4 映射初始化标记（按学科）
- **存储键**: `mapping_initialized_{subject}`
  - **类型**: String ('true')
  - **用途**: 标记知识点映射是否已初始化（按学科区分）
  - **存储位置**: `shijingshan-knowledge-utils.ts:583`, `shijingshan-knowledge-utils.ts:597`
  - **生命周期**: 初始化映射后标记

#### 5.5 合并后的扁平化数据（按学科）
- **存储键**: `merged_flatten_data_{subject}`
  - **类型**: JSON对象 (MergedFlattenData)
  - **用途**: 合并后的知识点扁平化数据（按学科存储）
  - **存储位置**: `shijingshan-knowledge-utils.ts:634`, `shijingshan-knowledge-utils.ts:648`
  - **生命周期**: 合并数据后保存

---

### 6. 调试和性能监控

#### 6.1 性能数据（带用户ID前缀）
- **存储键**: `{userId}_perfData`
  - **类型**: JSON数组
  - **用途**: 性能监控数据，记录操作耗时
  - **存储位置**: `KnowledgeGraphView.vue:2126`, `KnowledgeGraphView.vue:2134`
  - **生命周期**: 记录性能数据，只保留最近50条

#### 6.2 调试面板参数（知识图谱调试）
- **存储键**: `knowledge_graph_debug_params`
  - **类型**: JSON对象
  - **用途**: 知识图谱调试面板的参数配置
  - **存储位置**: `KnowledgeGraphDebugPanel.vue:3363`, `KnowledgeGraphDebugPanel.vue:3373`, `KnowledgeGraphDebugPanel.vue:3409`
  - **生命周期**: 调试参数修改时保存

---

### 7. 其他临时数据

#### 7.1 Token（通用，可能已废弃）
- **存储键**: `token`
  - **类型**: String
  - **用途**: 通用token（可能已废弃，建议使用XUEBAN_TOKEN或YANBAN_TOKEN）
  - **存储位置**: `FindExerciseView.vue:270`, `KnowledgeGraph.vue:532`
  - **生命周期**: 不确定，建议检查是否仍在使用

---

## IndexedDB存储内容

### 1. 聊天历史记录存储

#### 1.1 存储服务

**位置**：`imates-web/src/services/chat-storage.ts`

**核心类**：`AsyncStorageService`（单例模式）

**存储策略**：
- **优先**：IndexedDB（使用 `localforage` 库）
- **降级**：localStorage（当 IndexedDB 不可用时）

**IndexedDB 配置**：
- **数据库名**: `ExerciseSolveApp_{userId}`（使用用户ID作为前缀，实现账号隔离）
- **存储表名**: `chat_history`
- **配置代码**:
  ```typescript
  function getUserLocalForage() {
    const userId = getCurrentUserIdOrDefault()
    return localforage.createInstance({
      driver: localforage.INDEXEDDB,
      name: `ExerciseSolveApp_${userId}`,
      version: 1.0,
      storeName: 'chat_history',
      description: `练习解题应用聊天记录存储 (用户: ${userId})`
    })
  }
  ```

#### 1.2 消息存储键名格式

**实际存储键名格式**：
```
${userId}_chat_history_${questionId}
```

**questionId 格式**（不同场景）：
- AI通用对话：`ai-general-${sessionId}`
- AI题目对话：`ai-exercise-${questionId}`
- AI教材对话：`ai-textbook-${resourceId}`
- 教师通用对话：`teacher-general`（统一存储，所有会话共享）
- 教师题目对话：`teacher-exercise-${questionId}`

**示例**：
```
user123_chat_history_ai-general-session-abc123
user123_chat_history_ai-exercise-question-456
user123_chat_history_ai-textbook-resource-789
user123_chat_history_teacher-general
user123_teacher_chat_history_teacher-exercise-question-456
```

#### 1.3 消息数据结构

**存储结构**：`ChatHistoryData`
```typescript
interface ChatHistoryData {
  questionId: string           // 存储键（用于标识）
  messages: ChatBubble[]        // 消息列表
  chatResponseTimes: number     // AI回复次数
  lastUpdated: number            // 最后更新时间戳
}
```

**消息结构**：`ChatBubble`
```typescript
interface ChatBubble {
  id: string                     // 消息ID
  content: string                // 消息内容
  sender: string                 // 发送者（'user' | 'assistant'）
  type: string                   // 消息类型（'text' | 'image' | 'voice'）
  timestamp: number              // 时间戳
  messageId?: string             // 消息ID（可选）
  messageType?: string           // 消息类型（可选）
  isStreaming?: boolean          // 是否正在流式传输
  imageData?: {                  // 图片数据
    filePath: string,
    width: number,
    height: number,
    fileSize: number,
    base64DataUrl: string         // base64图片数据（用于UI显示）
  }
  voiceData?: {                  // 语音数据
    filePath: string,
    duration: number,
    fileSize: number
  }
  isError?: boolean              // 是否为错误消息
  canRetry?: boolean             // 是否可以重试
  retryCount?: number            // 重试次数
  originalMessage?: string       // 原始消息
  chatRecordData?: object        // 聊天记录数据
}
```

#### 1.4 消息存储流程

**保存流程**：
```
1. 调用 asyncStorage.saveChatHistory(questionId, data)
   │
   ├─> 初始化 IndexedDB（如果未初始化）
   │
   ├─> 序列化数据（确保所有属性可存储）
   │
   ├─> 尝试保存到 IndexedDB
   │   └─> 成功：完成
   │   └─> 失败：降级到 localStorage
   │
   └─> 构建存储键：${userId}_chat_history_${questionId}
```

**加载流程**：
```
1. 调用 asyncStorage.loadChatHistory(questionId)
   │
   ├─> 初始化 IndexedDB（如果未初始化）
   │
   ├─> 尝试从 IndexedDB 加载
   │   └─> 成功：返回数据
   │   └─> 失败：降级到 localStorage
   │
   └─> 构建存储键：${userId}_chat_history_${questionId}
```

#### 1.5 消息过滤规则

**保存时过滤**（不保存以下消息）：
- ❌ 错误消息（`isError: true`）
- ❌ 流式消息（`isStreaming: true`）
- ❌ 系统消息（`isSystemMessage: true`）
- ❌ 撤回消息（`isRecalled: true`）
- ❌ 无消息ID的消息（既无 `messageId` 也无 `id`）

这些消息不会保存到持久化存储中。

#### 1.6 不同场景的聊天历史

**普通聊天历史**：
- **存储键**: `{userId}_chat_history_{questionId}`
- **存储位置**: `chat-storage.ts:111-139`
- **生命周期**: 保存聊天记录时存储，删除题目时清除
- **降级方案**: IndexedDB不可用时降级到localStorage
- **清理策略**: 30天未更新的记录自动清理

**教师通用会话消息**（统一存储）：
- **存储键**: `{userId}_chat_history_teacher-general`
- **存储格式**: `Record<string, { messages: ChatBubble[], chatResponseTimes: number, lastUpdated: number }>`
- **key**: `sessionId`，value：该会话的消息数据
- **存储位置**: `teacherGeneralChatStore.ts`
- **生命周期**: 保存聊天记录时存储，删除会话时清除

**教师题目会话消息**：
- **存储方式**: 分别存储，每个题目一个独立的键
- **存储键**: `{userId}_teacher_chat_history_teacher-exercise-${questionId}`
- **存储位置**: `teacherExerciseChatStore.ts` → `chat-storage.ts`
- **生命周期**: 保存聊天记录时存储，删除会话时清除

**AI通用会话消息**：
- **存储键**: `{userId}_chat_history_ai-general-${sessionId}`
- **存储位置**: `aiGeneralChatStore.ts`
- **生命周期**: 保存聊天记录时存储，删除会话时清除

**AI题目会话消息**：
- **存储键**: `{userId}_chat_history_ai-exercise-${questionId}`
- **存储位置**: `aiExerciseChatStore.ts`
- **生命周期**: 保存聊天记录时存储，删除题目时清除

**AI教材会话消息**：
- **存储键**: `{userId}_chat_history_ai-textbook-${resourceId}`
- **存储位置**: `aiTextbookChatStore.ts`
- **生命周期**: 保存聊天记录时存储，删除资源时清除

#### 1.7 聊天历史管理功能
- **获取所有聊天记录键**: `getAllChatHistoryKeys()` - 返回当前用户的所有聊天记录键
- **清理过期记录**: `cleanupExpiredChatHistory(maxAge)` - 清理超过指定时间的记录（默认30天）
- **获取存储信息**: `getStorageInfo()` - 返回存储使用情况（总键数、聊天记录数、估算大小）
- **清空所有记录**: `clearAllChatHistory()` - 清空当前用户的所有聊天记录
- **导出聊天记录**: `exportChatHistory(questionId)` - 导出指定题目的聊天记录（用于调试）

---

### 2. 教材资源存储

#### 2.1 教材元数据存储
- **数据库名**: `TextbookStorage_{userId}`
- **数据库版本**: 8
- **存储表**: `textbooks`
- **主键**: `id` (教材唯一标识)
- **索引**:
  - `isDownloaded` - 是否已下载索引
  - `downloadStatus` - 下载状态索引
  - `lastDownloadTime` - 最后下载时间索引
  - `subjectLabel` - 学科标签索引
  - `gradeLabel` - 年级标签索引
  - `textbookId` - 教材ID索引
- **数据结构**: `UserTextbookInfo`
  ```typescript
  {
    id: string,                     // 用户教材信息唯一标识
    textbookId: string,              // 教材ID
    textbookName: string,            // 教材名称
    textbookSubjectLabel: string,    // 学科标签
    textbookGradeLabel: string,       // 年级标签
    textbookSemesterLabel: string,   // 学期标签
    textbookPublisher: string,        // 出版社
    textbookEditionYear: string,      // 版本年份
    textbookIsbn: string,            // ISBN号
    textbookCover: string,           // 封面图片URL
    textbookUpdateTime: string,       // 教材更新时间
    totalFiles: number,              // 总文件数
    downloadedFiles: number,        // 已下载文件数
    isDownloaded: boolean,           // 是否已下载
    downloadStatus: number,          // 下载状态: 0=未下载/下载失败, 1=下载中, 2=下载完成, 3=已暂停
    downloadPath: string,            // 下载路径
    lastDownloadTime: string,        // 最后下载时间
    hasUpdatesAvailable: boolean,    // 是否有可用更新
    structure: ChapterNode[],        // 教材结构（章节树）
    learningPackages: LearningPackage[], // 学习资源包列表
    localFiles: LocalFileInfo[]      // 本地文件信息列表（元数据，不含fileData）
  }
  ```
- **存储位置**: `resource-storage.ts:44-68`, `resource-storage.ts:190-217`
- **生命周期**: 下载教材时创建，删除教材时清除
- **更新策略**: 使用防抖批量更新（1秒延迟），关键操作时强制刷新

#### 2.2 教材文件二进制数据存储（分离存储）
- **数据库名**: `TextbookStorage_{userId}`
- **数据库版本**: 8
- **存储表**: `textbook_files`
- **主键**: `fileId` (文件唯一标识)
- **索引**:
  - `textbookId` - 教材ID索引（用于查询某教材的所有文件）
- **数据结构**:
  ```typescript
  {
    fileId: string,                  // 文件唯一标识
    textbookId: string,               // 教材ID
    fileData: Uint8Array              // 文件二进制数据
  }
  ```
- **存储位置**: `resource-storage.ts:60-66`, `resource-storage.ts:266-369`
- **生命周期**: 下载文件时存储，删除教材时清除
- **设计说明**: 
  - 采用分离存储架构，文件二进制数据存储在`textbook_files`表
  - 文件元数据存储在`textbooks`表的`localFiles`字段中
  - 按需读取文件数据，避免一次性加载所有文件导致内存溢出
  - 支持PDF缩略图异步生成（可选功能）

#### 2.3 本地文件元数据
- **存储位置**: `textbooks`表的`localFiles`字段
- **数据结构**: `LocalFileInfo[]`
  ```typescript
  {
    id: string,                      // 文件唯一标识
    fileName: string,                 // 文件名
    fileSize: number,                 // 文件大小（字节）
    checksum: string,                 // 文件校验和（MD5）
    isDownloaded: boolean,            // 是否已下载
    localPath?: string,               // 本地文件路径（可选）
    thumbnail?: string,               // PDF缩略图（base64格式，可选）
    annotations?: Record<number, object[]> // PDF注释数据（可选，key为页码）
  }
  ```
- **注意**: `fileData`字段已弃用，文件二进制数据已分离存储到`textbook_files`表

#### 2.4 教材资源管理功能
- **存储文件数据**: `storeFileData()` - 存储文件二进制数据和元数据
- **获取文件数据**: `getFileData()` - 从`textbook_files`表按需读取文件数据
- **检查文件存在**: `hasFileData()` - 检查文件数据是否存在
- **更新缩略图**: `updateThumbnail()` - 更新PDF文件的缩略图
- **清理过期数据**: `cleanupExpiredData()` - 清理30天未下载的教材数据
- **清理教材数据**: `cleanupTextbookRelatedData()` - 清理教材相关的所有数据（包括文件数据）

---

### 3. 题目列表存储

#### 3.1 题目列表数据
- **数据库名**: `ExerciseQuestionsDB_{userId}`
- **数据库版本**: 1
- **存储表**: `question_lists`
- **主键**: `subject` (科目类型，每个科目一条记录)
- **索引**:
  - `timestamp` - 时间戳索引
  - `subject` - 科目索引（唯一）
- **数据结构**: `QuestionListData`
  ```typescript
  {
    subject: string,                 // 科目类型（'math' | 'biology'）
    questions: ExerciseItem[],       // 题目列表
    timestamp: number                 // 时间戳
  }
  ```
- **题目数据结构**: `ExerciseItem`
  ```typescript
  {
    id: string,                       // 题目ID
    // ... 其他题目属性
  }
  ```
- **存储位置**: `question-storage.ts:20-37`, `question-storage.ts:83-102`
- **生命周期**: 获取题目列表时保存，切换账号时清除
- **使用场景**: 用于缓存题目列表，减少API请求

#### 3.2 题目列表管理功能
- **保存题目列表**: `saveQuestionsToIndexedDB()` - 保存指定科目的题目列表
- **加载题目列表**: `loadQuestionsFromIndexedDB()` - 从IndexedDB加载指定科目的题目列表
- **检查是否存在**: `hasQuestionsInIndexedDB()` - 检查指定科目的题目列表是否存在
- **删除题目列表**: `deleteQuestionsFromIndexedDB()` - 删除指定科目的题目列表
- **清空所有题目**: `clearAllQuestionsFromIndexedDB()` - 清空所有题目列表

---

## IndexedDB存储特点

### 账号隔离
所有IndexedDB数据库都使用用户ID作为数据库名前缀，实现账号隔离：
- 聊天历史: `ExerciseSolveApp_{userId}`
- 教材资源: `TextbookStorage_{userId}`
- 题目列表: `ExerciseQuestionsDB_{userId}`

### 降级方案
- **聊天历史**: IndexedDB不可用时自动降级到localStorage
- **教材资源**: 无降级方案，IndexedDB失败时操作失败
- **题目列表**: 无降级方案，IndexedDB失败时操作失败

### 数据清理策略
- **聊天历史**: 30天未更新的记录自动清理
- **教材资源**: 30天未下载的教材数据自动清理
- **题目列表**: 切换账号时自动清理

### 性能优化
- **防抖批量更新**: 教材信息更新使用1秒防抖，批量更新到IndexedDB
- **分离存储**: 教材文件二进制数据分离存储，按需读取
- **异步操作**: 所有IndexedDB操作都是异步的，不阻塞主线程
- **索引优化**: 使用索引加速查询，支持按教材ID、下载状态等快速查询

---

## 存储键命名规范

### 带用户ID前缀的键
为了支持多账号切换，以下类型的键都使用用户ID作为前缀：
- 用户信息缓存: `{userId}_USER_INFO_CACHE`
- 会话信息: `{userId}_teacher-general-${sessionId}_session`（教师通用会话）
- 会话信息: `{userId}_teacher-exercise-sessions`（教师题目会话，统一存储）
- 会话信息: `{userId}_ai-general-sessions`（AI通用会话，统一存储）
- 聊天历史: `{userId}_chat_history_{questionId}`（格式见下方详细说明）
- 已学习节点: `{userId}_LEARNED_NODES`
- 最后学习节点: `{userId}_last_learned_node_id`
- 性能数据: `{userId}_perfData`
- 学习包缓存: `learning_packages_{userId}_{id}`

### 聊天历史存储键名汇总

| 场景 | 存储键名格式 | 示例 |
|-----|------------|------|
| AI通用对话 | `${userId}_chat_history_ai-general-${sessionId}` | `user123_chat_history_ai-general-session-abc` |
| AI题目对话 | `${userId}_chat_history_ai-exercise-${questionId}` | `user123_chat_history_ai-exercise-question-456` |
| AI教材对话 | `${userId}_chat_history_ai-textbook-${resourceId}` | `user123_chat_history_ai-textbook-resource-789` |
| 教师通用对话 | `${userId}_chat_history_teacher-general` | `user123_chat_history_teacher-general`（统一存储） |
| 教师题目对话 | `${userId}_teacher_chat_history_teacher-exercise-${questionId}` | `user123_teacher_chat_history_teacher-exercise-question-456`（分别存储） |

### 会话信息存储键名汇总

| 场景 | 存储键名格式 | 示例 | 存储格式 |
|-----|------------|------|---------|
| 教师通用会话 | `${userId}_teacher-general-sessions` | `user123_teacher-general-sessions` | `Record<string, TeacherSession>`（统一存储） |
| 教师题目会话 | `${userId}_teacher-exercise-sessions` | `user123_teacher-exercise-sessions` | `Record<string, TeacherExerciseSession>`（统一存储） |
| AI通用会话 | `${userId}_ai-general-sessions` | `user123_ai-general-sessions` | `AiGeneralSession[]`（统一存储） |
| AI题目会话 | 无会话列表 | - | - |
| AI教材会话 | 无会话列表 | - | - |

### 不带用户ID前缀的键（全局共享）
- 登录token: `XUEBAN_TOKEN`, `YANBAN_TOKEN`
- 用户账号密码: `userId`, `userPassword`, `studentUserId`
- 学习包难度: `learning_package_difficulty_{packageId}`
- 知识图谱缓存: `knowledge_graph_*`

---

## 数据清理策略

### 账号隔离机制

**所有存储键名都包含用户ID前缀**，确保不同账号的数据隔离：
- ✅ 消息存储：`${userId}_chat_history_${questionId}`
- ✅ 会话存储：`${userId}_${sessionType}-${sessionId}_session`
- ✅ IndexedDB 数据库名：`ExerciseSolveApp_${userId}`

**获取用户ID**：
- **函数**：`getCurrentUserIdOrDefault()`
- **位置**：`imates-web/src/utils/user/userId.ts`
- **逻辑**：
  1. 优先从 localStorage 读取 `userId`
  2. 如果不存在，返回默认值 `'default'`

### 账号切换清理
当检测到用户ID变化时，会自动清理以下数据：
- `teacher_chat_*` 开头的所有键
- `chat_history_*` 开头的所有键
- `ai-general-sessions` 开头的所有键
- `favorites` 开头的所有键（如果存在）

**清理位置**: `userStore.ts:cleanupOnAccountSwitch`

### 聊天历史自动清理

**过期时间**：30天（默认）

**清理逻辑**：
```typescript
async cleanupExpiredChatHistory(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
  const keys = await this.getAllChatHistoryKeys()
  const now = Date.now()
  
  for (const key of keys) {
    const data = await userLocalForage.getItem<ChatHistoryData>(key)
    if (data && (now - data.lastUpdated) > maxAge) {
      await userLocalForage.removeItem(key)
    }
  }
}
```

**清理位置**: `chat-storage.ts:cleanupExpiredChatHistory`

### 缓存过期清理
- **知识图谱缓存**: 24小时过期，自动清理
- **学习包缓存**: 24小时过期，自动清理
- **章节结构缓存**: 24小时过期，自动清理

**清理位置**: 
- `KnowledgeGraphView.vue:cleanupExpiredCache`
- `api-service.ts:getLearningPackages` (检查缓存过期)

### 存储空间不足处理
当localStorage存储空间不足时：
- 尝试清理旧数据（保留最近10条消息）
- 如果清理失败，使用内存缓存作为降级方案

**处理位置**: `teacherChatStore.ts:saveChatHistory`

---

## 存储优化策略

### 防抖保存

**适用场景**：教师通用会话、教师题目会话

**防抖时间**：1秒

**目的**：避免频繁保存，提高性能

**代码示例**：
```typescript
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null

const saveChatHistory = async (immediate: boolean = false): Promise<void> => {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer)
    saveDebounceTimer = null
  }
  
  if (immediate) {
    await saveAction()
  } else {
    saveDebounceTimer = setTimeout(saveAction, 1000)
  }
}
```

**注意**：AI通用会话使用立即保存（无防抖）

### 数据序列化

**目的**：确保所有属性都可以被存储（包括 base64 图片数据、语音数据等）

**序列化内容**：
- 消息基本属性（id, content, sender, type, timestamp）
- 图片数据（包括 base64DataUrl）
- 语音数据
- 错误和重试信息

### 降级策略

**IndexedDB 不可用时的降级流程**：
1. 尝试保存到 IndexedDB
2. 如果失败，捕获错误
3. 降级到 localStorage
4. 记录警告日志

**降级位置**: `chat-storage.ts:saveChatHistory`, `chat-storage.ts:loadChatHistory`

## 存储流程详解

### 教师通用会话保存流程

```
1. 用户发送消息
   │
   ├─> 创建/更新会话信息
   │   └─> 保存到 localStorage：${userId}_teacher-general-${sessionId}_session
   │
   ├─> 保存消息到 IndexedDB（统一存储）
   │   ├─> 从统一存储中读取所有会话的消息
   │   ├─> 更新当前会话的消息
   │   └─> 存储键：${userId}_chat_history_teacher-general（所有会话共享）
   │
   └─> 防抖保存（1秒延迟）
```

### 教师题目会话保存流程

```
1. 用户发送消息
   │
   ├─> 创建/更新会话信息
   │   └─> 更新到统一存储：${userId}_teacher-exercise-sessions
   │       └─> 结构：Record<string, TeacherExerciseSession>
   │
   ├─> 保存消息到 IndexedDB
   │   └─> 存储键：${userId}_teacher_chat_history_teacher-exercise-${questionId}（分别存储）
   │
   └─> 防抖保存（1秒延迟）
```

### AI通用会话保存流程

```
1. 用户发送消息
   │
   ├─> 更新会话信息（msgCount, updateTime）
   │   └─> 更新到统一存储：${userId}_ai-general-sessions
   │       └─> 结构：AiGeneralSession[]
   │
   ├─> 保存消息到 IndexedDB
   │   └─> 存储键：${userId}_chat_history_ai-general-${sessionId}
   │
   └─> 立即保存（无防抖）
```

## 存储大小估算

### localStorage大型数据
- **聊天历史记录**: 可能包含大量消息、图片base64数据、语音数据，单个会话可能达到几MB
- **知识图谱数据**: 章节结构、节点数据可能较大
- **教材文件元数据**: 通过IndexedDB存储，localStorage仅存储降级数据

### localStorage小型数据
- **用户信息**: 通常<1KB
- **会话信息**: 通常<1KB
- **配置数据**: 通常<1KB

### IndexedDB大型数据
- **聊天历史**: 单个会话可能包含大量消息、图片base64数据，可能达到几MB到几十MB
- **教材文件**: PDF、视频等文件可能达到几十MB到几百MB
- **题目列表**: 题目数据可能达到几MB

---

## 注意事项

### localStorage注意事项

1. **安全性**: 
   - `userPassword` 以明文存储，仅用于自动填充，存在安全风险
   - Token存储在localStorage中，存在XSS攻击风险

2. **数据隔离**: 
   - 大部分数据已实现用户ID前缀隔离
   - 但部分全局数据（如token）未隔离，切换账号时需手动清理

3. **降级方案**: 
   - 聊天历史优先使用IndexedDB，localStorage作为降级方案
   - 教材文件数据主要存储在IndexedDB，localStorage仅存储元数据

4. **兼容性**: 
   - 存在旧格式的会话键（不带用户ID前缀），代码中有兼容处理逻辑

5. **性能**: 
   - localStorage同步操作可能阻塞主线程
   - 大量数据建议使用IndexedDB

### 聊天历史存储注意事项

1. **存储键名一致性**:
   - ⚠️ **重要**：确保所有地方使用相同的键名格式
   - ✅ 正确：`${userId}_teacher-general-${sessionId}_session`
   - ❌ 错误：`teacher-general-${sessionId}_session`（缺少 userId 前缀）

2. **存储大小限制**:
   - **localStorage**：通常限制为 5-10MB
   - **IndexedDB**：通常限制为 50MB 或更大
   - 建议监控存储使用情况，必要时清理过期数据

3. **数据迁移**:
   - **教师题目会话**支持从旧格式（每个会话单独存储）自动迁移到新格式（统一存储）
   - 迁移逻辑在 `teacherExerciseChatStore.ts` 的 `migrateOldSessions()` 方法中实现

4. **消息过滤**:
   - 保存消息时会自动过滤以下类型的消息：
     - 错误消息
     - 流式消息
     - 系统消息
     - 撤回消息
     - 无消息ID的消息
   - 这些消息不会保存到持久化存储中

5. **统一存储结构**:
   - **教师通用会话**使用统一存储，所有会话的消息存储在一个键下
   - 存储格式：`Record<string, { messages: ChatBubble[], chatResponseTimes: number, lastUpdated: number }>`
   - key：`sessionId`，value：该会话的消息数据

### IndexedDB注意事项

1. **容量限制**: 
   - IndexedDB容量通常为50MB-1GB（取决于浏览器）
   - 超过限制时可能无法存储新数据，需要清理旧数据

2. **异步操作**: 
   - 所有IndexedDB操作都是异步的，需要使用async/await或Promise
   - 操作失败时需要处理错误，避免应用崩溃

3. **数据迁移**: 
   - 数据库版本升级时需要在`onupgradeneeded`事件中处理数据迁移
   - 当前教材资源数据库版本为8，题目列表数据库版本为1

4. **分离存储**: 
   - 教材文件采用分离存储架构，文件二进制数据存储在`textbook_files`表
   - 文件元数据存储在`textbooks`表的`localFiles`字段中
   - 删除教材时需要同时清理两个表的数据

5. **账号切换**: 
   - 切换账号时会创建新的数据库实例
   - 旧账号的数据保留在旧数据库中，不会自动删除
   - 建议在账号切换时清理旧账号的数据（可选）

---

## 建议优化

### localStorage优化建议

1. **统一存储服务**: 建议创建一个统一的存储服务，统一管理所有localStorage操作
2. **加密敏感数据**: 对密码等敏感数据进行加密存储
3. **清理策略**: 实现更完善的过期数据清理机制
4. **存储监控**: 添加存储使用量监控，及时清理过期数据

### IndexedDB优化建议

1. **数据压缩**: 对于大型数据（如聊天历史中的base64图片），可以考虑压缩存储
2. **分页加载**: 对于大量数据，实现分页加载，避免一次性加载所有数据
3. **定期清理**: 实现定期清理机制，自动清理过期数据
4. **存储监控**: 添加IndexedDB存储使用量监控，及时清理不必要的数据
5. **错误处理**: 完善错误处理机制，IndexedDB操作失败时提供友好的错误提示
6. **数据备份**: 考虑实现数据备份功能，防止数据丢失

---

## 相关文件清单

### Stores
- `imates-web/src/stores/userStore.ts` - 用户信息管理
- `imates-web/src/stores/teacherGeneralChatStore.ts` - 教师通用聊天会话管理
- `imates-web/src/stores/teacherExerciseChatStore.ts` - 教师题目聊天会话管理
- `imates-web/src/stores/aiGeneralChatStore.ts` - AI通用聊天管理
- `imates-web/src/stores/aiExerciseChatStore.ts` - AI题目聊天管理
- `imates-web/src/stores/aiTextbookChatStore.ts` - AI教材聊天管理

### Services
- `imates-web/src/services/api-service.ts` - API服务，包含登录和缓存逻辑
- `imates-web/src/services/chat-storage.ts` - 聊天存储服务（IndexedDB，降级到localStorage）
  - `AsyncStorageService` - 异步存储服务（单例模式）
  - `saveChatHistory()` - 保存聊天历史
  - `loadChatHistory()` - 加载聊天历史
  - `removeChatHistory()` - 删除聊天历史
  - `cleanupExpiredChatHistory()` - 清理过期聊天历史
  - `getAllChatHistoryKeys()` - 获取所有聊天记录键
  - `getStorageInfo()` - 获取存储信息
  - `clearAllChatHistory()` - 清空所有聊天记录
  - `exportChatHistory()` - 导出聊天记录
- `imates-web/src/services/resource-storage.ts` - 资源管理服务（IndexedDB）
- `imates-web/src/services/question-storage.ts` - 题目列表存储服务（IndexedDB）
- `imates-web/src/services/indexeddb-service.ts` - IndexedDB通用服务类

### Views
- `imates-web/src/views/LoginView.vue` - 登录页面
- `imates-web/src/views/LearningView.vue` - 学习页面
- `imates-web/src/views/KnowledgeGraphView.vue` - 知识图谱页面
- `imates-web/src/views/FindExerciseView.vue` - 找题页面

### Components
- `imates-web/src/components/ChatView.vue` - 聊天视图
- `imates-web/src/components/UnifiedChatDialog.vue` - 统一聊天对话框
- `imates-web/src/components/TeacherChatDialog.vue` - 教师聊天对话框
- `imates-web/src/components/knowledge-graph/KnowledgeGraph.vue` - 知识图谱组件

### Utils
- `imates-web/src/utils/business/shijingshan-knowledge-utils.ts` - 石景山知识图谱工具
- `imates-web/src/utils/user/userId.ts` - 用户ID工具
  - `getCurrentUserIdOrDefault()` - 获取当前用户ID或默认值

