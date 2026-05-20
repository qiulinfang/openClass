# IndexedDB 存储架构文档

本模块详细描述了应用中各业务模块在 IndexedDB 中的存储机制。系统采用 `localforage` 或自定义的 `IndexedDBService` 进行异步数据管理，旨在提供大容量、高性能且账号隔离的本地持久化方案。

## 1. 核心设计原则

- **账号隔离**: 数据库名称均以 `userId` 作为前缀（例如 `ExerciseSolveApp_${userId}`），确保多用户环境下数据不串号。
- **元数据与二进制分离**: 针对大文件（如 PDF 教材、大图），将元数据（名称、状态、索引）与二进制流（Blob/Uint8Array）分表存储，提升查询性能。
- **序列化加固**: 在存入数据库前，通过深度序列化（如 `serializeChatData`）解除 Vue 的响应式 Proxy，并完整保留多媒体字段的 Base64 数据。
- **自动清理**: 设置过期时间（默认 30 天或 7 天），定期清理旧数据防止磁盘空间溢出。

---

## 2. 模块存储详情

### 2.1 聊天模块 (ChatStorage)
- **数据库名**: `ExerciseSolveApp_${userId}`
- **核心表**:
    - **`chat_history`**: 存储具体的聊天内容。
        - **Key**: `${userId}_chat_history_${questionId}`
        - **Value**: `ChatHistoryData` 对象（含 `messages[]`, `lastUpdated`）。
    - **`ai_general_sessions`**: AI 通用聊天会话列表。
    - **`ai_exercise_sessions`**: AI 题目练习场景会话列表。
    - **`teacher_exercise_sessions`**: 老师端题目答疑会话列表。
- **特殊处理**: 完整存储 HTML 消息的 `rawHtmlMap`（含后端增强 HTML 及生成的截图），实现离线查看。

### 2.2 资源管理模块 (ResourceManager)
- **数据库名**: `TextbookStorage_${userId}` (或含环境后缀)
- **核心表**:
    - **`textbooks`**: 教材元数据表。
        - 包含教材名称、科目、学段、下载进度、本地文件列表索引。
    - **`textbook_files`**: 核心二进制数据表。
        - **Key**: `fileId`
        - **Value**: `fileData` (Uint8Array)。按需加载，避免内存压力。
    - **`ai_textbook_sessions`**: 教材场景下的 AI 对话会话。
    - **`knowledge_graph_chapter_structure`**: 知识图谱章节结构的本地缓存。

### 2.3 草稿本模块 (DraftStorage)
- **数据库名**: `ExerciseDraftsDB_${userId}`
- **核心表**:
    - **`question_drafts`**: 存储用户在画板/题目上的作答过程。
        - 包含：`objects` (笔迹对象), `history` (回退栈), `historyIndex`。
- **策略**: 自动从 `localStorage` 迁移至 IndexedDB。

### 2.4 错题本模块 (MistakeStorage)
- **数据库名**: `MistakeStorageDB_${userId}`
- **核心表**:
    - **`mistakes`**: 存储学生收藏的错题。
        - 包含：`questionData` (完整的题目详情), `originalAnswer` (作答快照)。

### 2.5 作业模块 (HomeworkStorage)
- **数据库名**: `HomeworkStorageDB_${userId}`
- **核心表**:
    - **`submissions`**: 存储作业的离线进度与提交状态。
        - 包含：已作答的题目缓存、作业全量详情。

---

## 3. 数据库初始化流程

1. **获取用户上下文**: 调用 `getUserId()` 确定当前账号。
2. **实例创建**: 通过 `IndexedDBService.getInstance()` 获取或创建指定版本和配置的数据库连接。
3. **版本管理**: 手动维护版本号（Version），在 `onupgradeneeded` 中执行表的新建或索引更新。
4. **降级逻辑**: 捕获初始化异常，若 IndexedDB 彻底失效（如隐私模式限制），自动回退至 `localStorage`。

---

## 4. 存储模型定义

详见源码中 `@/types/chat.ts` 与各存储服务的接口定义：
- `ChatHistoryData`
- `MistakeItem`
- `HomeworkSubmissionData`
- `DraftStorageData`
