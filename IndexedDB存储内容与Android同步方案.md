# IndexedDB存储内容与Android同步方案

## 一、当前IndexedDB存储内容汇总

### 1. 聊天历史记录存储

**数据库名**: `ExerciseSolveApp_{userId}`  
**数据库版本**: 1.0  
**存储表**: `chat_history`

#### 存储的数据类型：
1. **AI通用对话消息**
   - 存储键: `{userId}_chat_history_ai-general-${sessionId}`
   - 数据结构: `ChatHistoryData`
   ```typescript
   {
     questionId: string,
     messages: ChatBubble[],
     chatResponseTimes: number,
     lastUpdated: number
   }
   ```

2. **AI题目对话消息**
   - 存储键: `{userId}_chat_history_ai-exercise-${questionId}`

3. **AI教材对话消息**
   - 存储键: `{userId}_chat_history_ai-textbook-${resourceId}`

4. **教师通用对话消息**（统一存储）
   - 存储键: `{userId}_chat_history_teacher-general`
   - 存储格式: `Record<string, { messages: ChatBubble[], chatResponseTimes: number, lastUpdated: number }>`
   - key: `sessionId`，value: 该会话的消息数据

5. **教师题目对话消息**
   - 存储键: `{userId}_teacher_chat_history_teacher-exercise-${questionId}`

#### 消息数据结构：
```typescript
interface ChatBubble {
  id: string,
  content: string,
  sender: 'user' | 'assistant',
  type: 'text' | 'image' | 'voice',
  timestamp: number,
  messageId?: string,
  imageData?: {
    filePath: string,
    width: number,
    height: number,
    fileSize: number,
    base64DataUrl: string  // base64图片数据
  },
  voiceData?: {
    filePath: string,
    duration: number,
    fileSize: number
  },
  isError?: boolean,
  canRetry?: boolean,
  retryCount?: number,
  originalMessage?: string,
  chatRecordData?: object
}
```

**存储位置**: `imates-web/src/services/chat-storage.ts`  
**降级方案**: IndexedDB不可用时自动降级到localStorage  
**清理策略**: 30天未更新的记录自动清理

---

### 2. 教材资源存储

**数据库名**: `TextbookStorage_{userId}`  
**数据库版本**: 8  
**存储表**: 
- `textbooks` - 教材元数据
- `textbook_files` - 文件二进制数据（分离存储）

#### 2.1 教材元数据（textbooks表）

**主键**: `id` (教材唯一标识)  
**索引**:
- `isDownloaded` - 是否已下载索引
- `downloadStatus` - 下载状态索引
- `lastDownloadTime` - 最后下载时间索引
- `subjectLabel` - 学科标签索引
- `gradeLabel` - 年级标签索引
- `textbookId` - 教材ID索引

**数据结构**: `UserTextbookInfo`
```typescript
{
  id: string,                     // 用户教材信息唯一标识
  textbookId: string,              // 教材ID
  textbookName: string,            // 教材名称
  textbookSubjectLabel: string,    // 学科标签
  textbookGradeLabel: string,      // 年级标签
  textbookSemesterLabel: string,  // 学期标签
  textbookPublisher: string,       // 出版社
  textbookEditionYear: string,     // 版本年份
  textbookIsbn: string,           // ISBN号
  textbookCover: string,          // 封面图片URL
  textbookUpdateTime: string,      // 教材更新时间
  totalFiles: number,              // 总文件数
  downloadedFiles: number,        // 已下载文件数
  isDownloaded: boolean,          // 是否已下载
  downloadStatus: number,          // 下载状态: 0=未下载/下载失败, 1=下载中, 2=下载完成, 3=已暂停
  downloadPath: string,            // 下载路径
  lastDownloadTime: string,        // 最后下载时间
  hasUpdatesAvailable: boolean,    // 是否有可用更新
  structure: ChapterNode[],        // 教材结构（章节树）
  learningPackages: LearningPackage[], // 学习资源包列表
  localFiles: LocalFileInfo[]      // 本地文件信息列表（元数据，不含fileData）
}
```

#### 2.2 文件二进制数据（textbook_files表）

**主键**: `fileId` (文件唯一标识)  
**索引**:
- `textbookId` - 教材ID索引（用于查询某教材的所有文件）

**数据结构**:
```typescript
{
  fileId: string,                  // 文件唯一标识
  textbookId: string,              // 教材ID
  fileData: Uint8Array             // 文件二进制数据
}
```

#### 2.3 本地文件元数据（存储在textbooks表的localFiles字段）

**数据结构**: `LocalFileInfo[]`
```typescript
{
  id: string,                      // 文件唯一标识
  fileName: string,                // 文件名
  fileSize: number,                // 文件大小（字节）
  checksum: string,                // 文件校验和（MD5）
  isDownloaded: boolean,           // 是否已下载
  localPath?: string,              // 本地文件路径（可选）
  thumbnail?: string,              // PDF缩略图（base64格式，可选）
  annotations?: Record<number, object[]> // PDF注释数据（可选，key为页码）
}
```

**存储位置**: `imates-web/src/services/resource-storage.ts`  
**设计说明**: 
- 采用分离存储架构，文件二进制数据存储在`textbook_files`表
- 文件元数据存储在`textbooks`表的`localFiles`字段中
- 按需读取文件数据，避免一次性加载所有文件导致内存溢出
- **PDF笔记数据存储在`localFiles[].annotations`字段中**

**清理策略**: 30天未下载的教材数据自动清理

---

### 3. 题目列表存储

**数据库名**: `ExerciseQuestionsDB_{userId}`  
**数据库版本**: 1  
**存储表**: `question_lists`

**主键**: `subject` (科目类型，每个科目一条记录)  
**索引**:
- `timestamp` - 时间戳索引
- `subject` - 科目索引（唯一）

**数据结构**: `QuestionListData`
```typescript
{
  subject: string,                 // 科目类型（'math' | 'biology'）
  questions: ExerciseItem[],       // 题目列表
  timestamp: number                // 时间戳
}
```

**存储位置**: `imates-web/src/services/question-storage.ts`  
**生命周期**: 获取题目列表时保存，切换账号时清除  
**使用场景**: 用于缓存题目列表，减少API请求

---

## 二、账号隔离机制

所有IndexedDB数据库都使用用户ID作为数据库名前缀，实现账号隔离：
- 聊天历史: `ExerciseSolveApp_{userId}`
- 教材资源: `TextbookStorage_{userId}`
- 题目列表: `ExerciseQuestionsDB_{userId}`

**获取用户ID**: `getCurrentUserIdOrDefault()` 函数
- 优先从 localStorage 读取 `userId`
- 如果不存在，返回默认值 `'default'`

---

## 三、当前Android端处理情况

### 3.1 已实现的功能

1. **从IndexedDB读取PDF数据**
   - 方法: `WebAppInterface.openPdfWithMuPDF()`
   - 功能: 从WebView的IndexedDB获取PDF文件数据，用于MuPDF原生查看器
   - 位置: `app/src/main/java/com/cosinetech/imates/ui/webview/common/WebAppInterface.java:2967-3095`

2. **用户信息同步**
   - 方法: `WebAppInterface.syncUserInfo()`
   - 功能: 同步Web端用户信息到Android原生ViewModel
   - 位置: `app/src/main/java/com/cosinetech/imates/ui/webview/common/WebAppInterface.java:235-263`

### 3.2 未实现的功能

**目前Android端没有将IndexedDB数据同步到本地存储的机制**，这意味着：
- ❌ 聊天历史记录未同步到Android本地数据库
- ❌ 教材资源数据未同步到Android本地存储
- ❌ 题目列表未同步到Android本地存储
- ❌ PDF笔记数据未同步到Android本地存储

---

## 四、Android同步方案建议

### 4.1 Android访问IndexedDB的机制

**重要说明**：Android原生代码**不能直接访问IndexedDB**，因为IndexedDB是Web API，只能在JavaScript环境中使用。

**当前实现方式**：
- Android通过JavaScript Bridge调用JavaScript代码访问IndexedDB
- 示例：`openPdfWithMuPDF()` 方法通过执行JavaScript代码从IndexedDB获取PDF数据
- 限制：**需要WebView存在且JavaScript环境可用**

**代码示例**（`WebAppInterface.java:3027-3032`）：
```java
// Android端执行JavaScript代码访问IndexedDB
var request = indexedDB.open(dbName, 8);
request.onsuccess = function(event) {
  var db = event.target.result;
  var transaction = db.transaction(['textbook_files'], 'readonly');
  var store = transaction.objectStore('textbook_files');
  var getRequest = store.get(fileId);
  // ... 获取数据后通过回调返回给Android
}
```

**问题**：
- ❌ WebView关闭后，Android无法访问IndexedDB
- ❌ 应用重启后，需要重新加载WebView才能访问IndexedDB
- ❌ 原生功能（如MuPDF查看器）需要文件数据时，如果WebView未加载则无法获取

**解决方案**：
1. **方案1**：同步文件数据到Android本地文件系统（推荐用于需要极致性能的场景）
   - 优点：Android端可以独立访问文件，不依赖WebView；性能快2倍；内存占用低54%
   - 缺点：需要额外的存储空间和同步逻辑；需要实现文件路径映射
2. **方案2**：保持当前机制，只在WebView可用时访问IndexedDB（推荐用于开发成本优先的场景）
   - 优点：不需要同步，节省存储空间；开发成本低；数据一致性好（单一数据源）
   - 缺点：依赖WebView；性能略慢（~640ms vs ~305ms）；内存占用较高（~33MB vs ~15MB）

**性能对比详情**：参见 `IndexedDB与原生文件系统性能对比分析.md`

**关键结论**：
- ✅ **如果应用设计保证WebView在文件访问时可用，可以不同步文件数据**
- ✅ **性能差异（~640ms vs ~305ms）对用户体验影响有限**
- ⚠️ **但建议优化Base64转换和内存管理**
- ⚠️ **如果追求极致性能或需要更高可靠性，建议实现原生文件系统方案**

---

### 4.2 需要同步的数据类型

#### 优先级1：关键数据（必须同步）
1. **PDF笔记数据** (`textbooks.localFiles[].annotations`)
   - 重要性: ⭐⭐⭐⭐⭐
   - 原因: 用户绘制的笔记是重要学习数据，需要持久化保存
   - 数据量: 较小（JSON格式的注释数据）

2. **教材下载状态** (`textbooks`表的元数据)
   - 重要性: ⭐⭐⭐⭐
   - 原因: 需要知道哪些教材已下载，下载进度等
   - 数据量: 中等（教材元数据，不含文件二进制数据）

#### 优先级2：重要数据（建议同步）
3. **聊天历史记录**
   - 重要性: ⭐⭐⭐
   - 原因: 用户聊天记录，但已有降级方案（localStorage）
   - 数据量: 较大（包含base64图片数据）
   - 注意: 可以只同步关键会话，或实现增量同步

#### 优先级3：可选数据（按需同步）
4. **题目列表**
   - 重要性: ⭐⭐
   - 原因: 主要用于缓存，可以重新获取
   - 数据量: 中等

5. **文件二进制数据**
   - 重要性: ⭐⭐⭐（取决于使用场景）
   - 原因: 
     - **Web端和Android端是两套独立的存储系统**：
       - Web端：文件存储在IndexedDB中（`textbook_files`表）
       - Android端：文件存储在本地文件系统中（`LearnResources/`目录）
     - **Android可以通过JavaScript Bridge访问IndexedDB**：
       - `openPdfWithMuPDF()` 方法通过JavaScript从IndexedDB获取文件数据
       - 但这种方式**需要WebView存在且JavaScript环境可用**
   - **是否需要同步**：
     - ✅ **需要同步的场景**：
       - Android端需要离线访问文件（WebView关闭后）
       - 需要在原生PDF查看器中打开文件（不依赖WebView）
       - 需要文件在Android端持久化存储
     - ❌ **不需要同步的场景**：
       - 只在WebView中查看文件（可以通过JavaScript Bridge实时获取）
       - 文件已经在Android端通过原生下载功能存储
   - 数据量: 非常大（PDF、视频等文件，可能几十MB到几百MB）
   - 建议: **按需同步**，或者实现双向同步机制

---

### 4.3 同步方案设计

#### 方案1：实时同步（推荐用于关键数据）

**适用场景**: PDF笔记、教材下载状态

**实现方式**:
1. Web端保存数据到IndexedDB时，同时调用Android Bridge同步
2. Android端接收数据，保存到本地数据库（Room/SQLite）

**优点**:
- 数据实时同步，不会丢失
- 用户体验好

**缺点**:
- 需要频繁调用Bridge，可能影响性能

**实现示例**:
```typescript
// Web端：保存笔记时同步
async saveAnnotationsToLocalFile() {
  // 1. 保存到IndexedDB
  await resourceManager.indexedDB.put('textbooks', textbook)
  
  // 2. 同步到Android
  if (window.AndroidBridge && window.AndroidBridge.syncTextbookAnnotations) {
    const annotations = textbook.localFiles.find(f => f.id === fileId)?.annotations
    window.AndroidBridge.syncTextbookAnnotations(
      textbookId,
      fileId,
      JSON.stringify(annotations)
    )
  }
}
```

```java
// Android端：接收同步数据
@JavascriptInterface
public void syncTextbookAnnotations(String textbookId, String fileId, String annotationsJson) {
    // 保存到本地数据库
    // 可以使用Room数据库或SharedPreferences
}
```

#### 方案2：批量同步（推荐用于大量数据）

**适用场景**: 聊天历史记录

**实现方式**:
1. Web端定期（如每5分钟）或特定时机（如应用退出时）批量同步
2. Android端接收批量数据，保存到本地数据库

**优点**:
- 减少Bridge调用次数
- 性能影响小

**缺点**:
- 数据可能延迟同步
- 应用异常退出时可能丢失未同步数据

**实现示例**:
```typescript
// Web端：批量同步聊天记录
async syncAllChatHistoryToAndroid() {
  const keys = await asyncStorage.getAllChatHistoryKeys()
  const allData = []
  
  for (const key of keys) {
    const data = await asyncStorage.loadChatHistory(key)
    if (data) {
      allData.push({
        key,
        data
      })
    }
  }
  
  if (window.AndroidBridge && window.AndroidBridge.syncChatHistoryBatch) {
    window.AndroidBridge.syncChatHistoryBatch(JSON.stringify(allData))
  }
}
```

#### 方案3：按需同步（推荐用于可选数据）

**适用场景**: 题目列表、文件二进制数据（如果只在WebView中访问）

**实现方式**:
1. Android端需要时主动请求Web端数据
2. Web端从IndexedDB读取并返回

**优点**:
- 按需同步，不占用额外资源
- 灵活性高
- 节省存储空间

**缺点**:
- 需要Android端主动请求
- 依赖WebView可用

#### 方案4：文件数据同步（推荐用于需要离线访问的文件）

**适用场景**: 文件二进制数据（需要在原生功能中使用）

**实现方式**:
1. Web端下载文件到IndexedDB时，同时同步到Android本地文件系统
2. Android端保存到 `context.getExternalFilesDir(null)/LearnResources/` 目录
3. 保持文件路径映射关系

**优点**:
- Android端可以独立访问文件，不依赖WebView
- 支持离线访问
- 原生功能可以直接使用文件

**缺点**:
- 需要额外的存储空间（文件存储两份）
- 需要同步逻辑和冲突处理

**实现示例**:
```typescript
// Web端：下载文件后同步到Android
async downloadAndSyncFile(resourceId: string, fileData: Uint8Array) {
  // 1. 保存到IndexedDB
  await resourceManager.storeFileData(fileInfo, fileData)
  
  // 2. 同步到Android本地文件系统
  if (window.AndroidBridge && window.AndroidBridge.syncFileToLocal) {
    const base64 = arrayBufferToBase64(fileData)
    window.AndroidBridge.syncFileToLocal(
      resourceId,
      fileName,
      base64,
      fileSize
    )
  }
}
```

```java
// Android端：接收文件数据并保存到本地
@JavascriptInterface
public void syncFileToLocal(String resourceId, String fileName, String base64Data, long fileSize) {
    executorService.execute(() -> {
        try {
            // 解码Base64数据
            byte[] fileBytes = android.util.Base64.decode(base64Data, Base64.DEFAULT);
            
            // 保存到本地文件系统
            File file = new File(getFileStoragePath(), fileName);
            FileOutputStream fos = new FileOutputStream(file);
            fos.write(fileBytes);
            fos.close();
            
            // 更新文件路径映射
            updateFileMapping(resourceId, file.getAbsolutePath());
        } catch (Exception e) {
            Log.e(TAG, "同步文件失败", e);
        }
    });
}
```

---

### 4.4 Android端存储方案

#### 推荐使用Room数据库

**原因**:
- 类型安全
- 支持复杂查询
- 性能好
- 官方推荐

**数据库设计建议**:

1. **教材笔记表** (`TextbookAnnotation`)
```kotlin
@Entity(tableName = "textbook_annotations")
data class TextbookAnnotation(
    @PrimaryKey val id: String,  // textbookId_fileId
    val textbookId: String,
    val fileId: String,
    val annotationsJson: String,  // JSON格式的注释数据
    val lastUpdated: Long
)
```

2. **教材元数据表** (`TextbookMetadata`)
```kotlin
@Entity(tableName = "textbook_metadata")
data class TextbookMetadata(
    @PrimaryKey val id: String,
    val textbookId: String,
    val textbookName: String,
    val isDownloaded: Boolean,
    val downloadStatus: Int,
    val downloadedFiles: Int,
    val totalFiles: Int,
    val lastDownloadTime: String,
    val metadataJson: String,  // 完整的元数据JSON（备用）
    val lastSynced: Long
)
```

3. **聊天历史表** (`ChatHistory`)
```kotlin
@Entity(tableName = "chat_history")
data class ChatHistory(
    @PrimaryKey val questionId: String,
    val messagesJson: String,  // JSON格式的消息列表
    val chatResponseTimes: Int,
    val lastUpdated: Long,
    val lastSynced: Long
)
```

#### 备选方案：SharedPreferences（仅用于简单数据）

**适用场景**: 简单的配置数据、小量数据

**不推荐用于**: 大量数据、复杂数据结构

---

### 4.5 同步时机

#### 关键数据（实时同步）
- PDF笔记保存时立即同步
- 教材下载状态变更时立即同步

#### 重要数据（批量同步）
- 应用退出时同步
- 每5-10分钟定期同步
- 网络状态良好时同步

#### 可选数据（按需同步）
- Android端需要时主动请求

---

### 4.6 数据冲突处理

**策略**: Web端为主，Android端为辅

1. **时间戳比较**: 比较`lastUpdated`时间戳，保留最新的数据
2. **版本号**: 为每条数据添加版本号，版本号大的优先
3. **合并策略**: 对于笔记数据，可以合并两个版本（需要实现合并算法）

---

## 五、实施建议

### 5.1 分阶段实施

**第一阶段**（最重要）:
1. ✅ 同步PDF笔记数据
2. ✅ 同步教材下载状态

**第二阶段**:
3. 同步聊天历史记录（批量同步）

**第三阶段**:
4. 按需同步题目列表（可选）

### 5.2 注意事项

1. **性能考虑**:
   - 避免同步大文件二进制数据（文件应该已经在Android本地存储）
   - 使用批量同步减少Bridge调用
   - 异步处理，不阻塞主线程

2. **错误处理**:
   - Bridge调用失败时的降级方案
   - 数据格式验证
   - 同步失败重试机制

3. **数据一致性**:
   - 确保Web端和Android端数据一致
   - 处理并发修改的情况
   - 定期校验数据完整性

4. **存储空间**:
   - 监控存储使用情况
   - 实现数据清理策略
   - 避免重复存储

---

## 六、总结

### 当前IndexedDB存储内容：
1. ✅ **聊天历史记录** - `ExerciseSolveApp_{userId}`
2. ✅ **教材资源** - `TextbookStorage_{userId}`（包括元数据和文件二进制数据）
3. ✅ **题目列表** - `ExerciseQuestionsDB_{userId}`

### 需要同步到Android的数据：
1. ⭐⭐⭐⭐⭐ **PDF笔记数据** - 必须同步
2. ⭐⭐⭐⭐ **教材下载状态** - 必须同步
3. ⭐⭐⭐ **聊天历史记录** - 建议同步
4. ⭐⭐ **题目列表** - 可选同步
5. ⚠️ **文件二进制数据** - 按需同步（取决于使用场景，见4.1节说明）

### 下一步行动：
1. 设计Android端数据库结构（Room数据库）
2. 实现Web端到Android端的同步Bridge接口
3. 实现PDF笔记数据的实时同步
4. 实现教材下载状态的实时同步
5. 实现聊天历史记录的批量同步（可选）

