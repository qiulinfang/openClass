# 全项目 sessionId 生成机制分析

> 本文总结 `imates-web` 项目中所有会话 ID（sessionId）的生成位置与生成规则，便于后续统一和重构。

## 1. 总览

当前项目中主要存在以下几类会话场景：

- **AI 题目聊天**：`aiExerciseChatStore.ts`
- **AI 通用聊天**：`aiGeneralChatStore.ts`
- **AI 教材聊天 / 截图会话**：`aiTextbookChatStore.ts`、`PdfViewerView.vue`
- **老师通用聊天**：`teacherGeneralChatStore.ts`
- **老师题目聊天**：`teacherExerciseChatStore.ts`
- **从“我的资料”页面跳转老师聊天**：`MyProfileView.vue`

整体特征：

- 大部分场景都采用「前缀 + 业务 ID（可选）+ 时间戳」的模式
- 部分场景额外增加随机字符串或哈希，以增强唯一性或与 Android 端对齐
- 命名风格（`-` vs `_`）、是否包含随机数、是否包含业务 ID 等存在差异

---

## 2. 各场景详细规则

### 2.1 AI 题目聊天（aiExerciseChatStore.ts）

**文件**：`src/stores/aiExerciseChatStore.ts`

**核心生成位置与格式：**

1. **发送消息时兜底生成**

```ts
// sendMessage 内部
const finalSessionId = sessionId || `exercise-${questionId}-${Date.now()}`
```

2. **无当前会话时自动创建（基于题目 bmNo）**

```ts
// sendMessage 内部
if (!currentSessionId.value) {
  const questionBmNo = currentQuestion.bmNo || ''
  const newSessionId = `exercise-${questionBmNo}-${Date.now()}`
  currentSessionId.value = newSessionId
}
```

3. **旧数据迁移生成新会话 ID**

```ts
// 旧格式聊天历史迁移逻辑
const newSessionId = `exercise-${questionBmNo}-${Date.now()}`
currentSessionId.value = newSessionId
// 按新 key 写入：ai-exercise-${questionBmNo}-${newSessionId}
```

4. **显式创建新会话（createNewSession）**

```ts
const createNewSession = async (questionBmNo: string): Promise<string> => {
  // 保存当前会话 ...
  const newSessionId = `exercise-${questionBmNo}-${Date.now()}`
  currentSessionId.value = newSessionId
  messages.value = []
  chatResponseTimes.value = 0
  canViewAnswer.value = false
  return newSessionId
}
```

**统一格式：**

- `exercise-{questionBmNo}-{timestamp}`

**特点：**

- 与题目 bmNo 强关联，可以从 ID 直接看出所属题目
- 使用毫秒时间戳，理论上同一题目同一毫秒内仍有小概率冲突（但实际概率很低）

---

### 2.2 AI 通用聊天（aiGeneralChatStore.ts）

**文件**：`src/stores/aiGeneralChatStore.ts`

**生成逻辑：**

```ts
// 构建请求时兜底生成
const finalSessionId = sessionId || `general-session-${Date.now()}`
```

**格式：**

- `general-session-{timestamp}`

**特点：**

- 无业务 ID，仅靠时间戳区分
- 适合“单一长会话”或对会话拆分要求不高的场景

---

### 2.3 AI 教材聊天（aiTextbookChatStore.ts）

**文件**：`src/stores/aiTextbookChatStore.ts`

**主要生成位置：**

1. **后端会话 ID（backendSessionId）兜底创建**

```ts
// getOrCreateBackendSessionId
const newSessionId = `textbook-session-${Date.now()}`
backendSessionId.value = newSessionId
```

2. **发送消息时，当前会话为空且有图片数据**

```ts
// sendMessage 中
if (builderImageData && !currentSessionId.value) {
  const newSessionId = `textbook-session-${Date.now()}`
  currentSessionId.value = newSessionId
  isNewSession.value = true
}
```

3. **发送消息时，当前会话为空且无图片数据**

```ts
else if (!currentSessionId.value) {
  const newSessionId = `textbook-session-${Date.now()}`
  currentSessionId.value = newSessionId
  isNewSession.value = true
}
```

**格式：**

- `textbook-session-{timestamp}`

**特点：**

- 不包含 resourceId 等业务 ID，仅用时间戳
- 结合业务逻辑，每次截图或新的问答会创建新 sessionId

---

### 2.4 PDF 截图会话（PdfViewerView.vue + aiTextbookStore）

**文件**：`src/views/PdfViewerView.vue`

**生成逻辑：**

```ts
// 处理截图发送时
const now = Date.now()
const sessionId = currentResourceId
  ? `ai-textbook-${currentResourceId}-${now}`
  : `ai-textbook-${now}`
aiTextbookStore.currentSessionId = sessionId

const newSession: AiTextbookSession = {
  sessionId,
  sessionName: question,
  createTime: now,
  updateTime: now,
  msgCount: 0,
  pinned: false,
  thumbnailImage: dataUrl,
  hasImage: true,
  resourceId: currentResourceId || undefined,
  id: sessionId,
  question,
  answer: '',
}
addScreenshotSession(newSession)
```

**格式：**

- 有 resourceId：`ai-textbook-{resourceId}-{timestamp}`
- 无 resourceId：`ai-textbook-{timestamp}`

**特点：**

- 会话 ID 与教材资源 ID 强绑定，便于按 resourceId 查询
- 同一个资源可以有多个截图会话（时间戳区分）

---

### 2.5 老师通用聊天（teacherGeneralChatStore.ts）

**文件**：`src/stores/teacherGeneralChatStore.ts`

#### 2.5.1 请求构建时兜底 sessionId

```ts
// buildTeacherRequest
const finalSessionId = sessionId || `general-session-${Date.now()}`
```

> 注：这里的前缀是 `general-session-`，与 AI 通用聊天相同，需要注意区分场景。

#### 2.5.2 教师端会话 ID 生成（与 Android 对齐）

```ts
// 生成会话ID（与Android的UUID.nameUUIDFromBytes逻辑保持一致）
const generateSessionId = (aiSessionId: string): string => {
  let hash = 0
  for (let i = 0; i < aiSessionId.length; i++) {
    const char = aiSessionId.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // 转为32位整数
  }

  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  return `teacher-${hex}-${Date.now()}`
}

// 创建会话时调用
const sessionId = generateSessionId(`teacher-${subject}-${Date.now()}`)
```

**最终格式：**

- `teacher-{8位hash}-{timestamp}`

**特点：**

- 先用字符串（带 subject 与时间戳）生成一个 32 位整型 hash，再转成 8 位十六进制
- 再拼接当前时间戳，整体格式与 Android 的 `UUID.nameUUIDFromBytes` 近似
- 在多端（Android / Web）之间，便于通过相同算法生成一致的会话 ID

---

### 2.6 老师题目聊天（teacherExerciseChatStore.ts）

**文件**：`src/stores/teacherExerciseChatStore.ts`

**生成逻辑：**

```ts
// 生成会话ID（基于题目ID生成唯一ID）
const generateSessionId = (questionId: string): string => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  return `teacher-exercise-${questionId}-${timestamp}-${random}`
}

// getOrCreateSession 中调用
const sessionId = generateSessionId(questionId)
```

**格式：**

- `teacher-exercise-{questionId}-{timestamp}-{randomBase36}`

**特点：**

- 同一题目多次问老师会生成多个会话，通过时间戳 + 随机串区分
- 随机串使用 base36（a-z0-9），长度 9
- 唯一性保障较强

---

### 2.7 我的资料页面跳转老师通用聊天（MyProfileView.vue）

**文件**：`src/views/MyProfileView.vue`

**生成逻辑：**

```ts
// 在“我的资料”中，进入老师通用聊天场景
'teacher_general_${Date.now()}_${Math.random().toString(36).substr(2, 9)}'
const aiSessionId = `teacher_general_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
```

**格式：**

- `teacher_general_{timestamp}_{randomBase36}`（使用下划线分隔）

**特点：**

- 仅用于前端这边记录/传递，会在 `teacherGeneralChatStore` 中进一步加工为最终的 sessionId（通过 `generateSessionId`）
- 命名风格与其他位置（使用 `-`）不同

---

## 3. 截图会话与 IndexedDB 存储（简要）

**文件**：`src/utils/storage/screenshotSessions.ts`, `src/services/ai-textbook-session-storage.ts`

- `AiTextbookSession` 结构中包含 `id` 与 `sessionId` 两个字段：
  - 若 `sessionId` 为空，存储前会自动使用 `id` 填充
- 对会话的增删改查均通过 `sessionId` 或 `id` 作为主键
- 生成逻辑主要来自上文的 `PdfViewerView.vue`（`ai-textbook-{resourceId}-{timestamp}`）

---

## 4. 生成机制对比与问题点

### 4.1 命名与结构对比

| 场景 | 示例格式 | 是否包含业务 ID | 是否包含随机数 | 是否包含 hash |
|------|----------|------------------|----------------|----------------|
| AI 题目聊天 | `exercise-{bmNo}-{ts}` | ✅ 题目 bmNo | ❌ | ❌ |
| AI 通用聊天 | `general-session-{ts}` | ❌ | ❌ | ❌ |
| AI 教材聊天 | `textbook-session-{ts}` | ❌ | ❌ | ❌ |
| PDF 截图会话 | `ai-textbook-{resId}-{ts}` | ✅ resourceId | ❌ | ❌ |
| 老师通用聊天 | `teacher-{hash}-{ts}` | ✅ subject 间接参与 hash | ❌ | ✅ |
| 老师题目聊天 | `teacher-exercise-{qid}-{ts}-{rand}` | ✅ questionId | ✅ | ❌ |
| 我的资料入口 ID | `teacher_general_{ts}_{rand}` | ❌ | ✅ | ❌ |

### 4.2 潜在问题

1. **命名风格不统一**
   - 有的用 `-`（连字符），有的用 `_`（下划线）
   - 有的前缀中包含 `session`，有的没有

2. **唯一性保障不一致**
   - 部分场景只依赖时间戳（毫秒级），在极端高并发下存在碰撞风险
   - 部分场景额外加入随机串或 hash，唯一性较好

3. **跨端一致性依赖自定义算法**
   - `teacherGeneralChatStore` 的 `generateSessionId` 通过自定义 hash 算法模拟 `UUID.nameUUIDFromBytes`
   - 如需与 Android 完全一致，需要确保两端算法严格对齐

---

## 5. 统一与重构建议

### 5.1 抽取统一的 sessionId 生成工具

可以在 `src/utils` 下抽一个通用工具，比如：

```ts
// utils/sessionId.ts
export function generateSessionId(prefix: string, bizId?: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)

  if (bizId) {
    return `${prefix}-${bizId}-${timestamp}-${random}`
  }
  return `${prefix}-${timestamp}-${random}`
}
```

使用示例：

```ts
// AI 题目聊天
const newSessionId = generateSessionId('exercise', questionBmNo)

// AI 通用聊天
const finalSessionId = sessionId || generateSessionId('general-session')

// PDF 截图会话
const sessionId = currentResourceId
  ? generateSessionId('ai-textbook', currentResourceId)
  : generateSessionId('ai-textbook')
```

这样可以：

- 统一前缀风格（全部使用 `-`）
- 保证都有 `timestamp + random` 组成的高唯一性后缀
- 可选地附带业务 ID（题目 bmNo / questionId / resourceId）

### 5.2 与 Android 端对齐的特殊情况

对于需要与 Android 保持完全一致的场景（如老师通用聊天）：

- 可以保留 `teacherGeneralChatStore` 中的 `generateSessionId`，但建议：
  - 将算法抽到 `utils/teacherSessionId.ts`
  - 在 Android 侧给出同一算法的单测与示例，确保多端一致

### 5.3 渐进式迁移策略

- **新会话**：优先使用统一工具生成新的 sessionId
- **旧会话**：
  - 通过兼容逻辑继续识别旧格式（如已经在 aiExercise 中的迁移逻辑）
  - 逐步迁移存量数据到新 key 后，清理旧 key

---

## 6. 小结

- 项目中 sessionId 的核心模式是「前缀 + 业务 ID（可选）+ 时间戳（必选）+ 随机串 / hash（可选）」
- 不同模块各自实现，导致风格与唯一性策略不统一
- 建议抽象出通用的 sessionId 生成方法，在不影响现有业务逻辑的前提下，逐步统一各业务线的生成规则和命名格式。

---

## 7. 基于 studentUserId 的前缀规则更新（当前实现）

在最新改动中，为了做到「按用户隔离所有会话」，所有新生成的会话 ID 都会带上 `localStorage.studentUserId` 作为前缀（如果存在）。整体模式变为：

- **通用模式**：
  - 如果 `studentUserId` 存在：`{studentUserId}-{原有 sessionId}`
  - 如果不存在：保持原有格式不变

各模块更新后的实际格式如下：

- **AI 题目聊天（aiExerciseChatStore）**
  - 发送消息 / 自动建会话 / 迁移 / `createNewSession`：
  - `"{studentUserId}-exercise-{questionBmNo}-{timestamp}"`

- **AI 通用聊天（aiGeneralChatStore）**
  - 构建请求时兜底：
    - `"{studentUserId}-general-session-{timestamp}"`
  - `createSession` 新建会话：
    - `"{studentUserId}-session_{timestamp}_{random}"`

- **AI 教材聊天（aiTextbookChatStore）**
  - `getOrCreateBackendSessionId`：
    - `"{studentUserId}-textbook-session-{timestamp}"`
  - `sendMessage` 内部新建会话（有/无图片）：
    - `"{studentUserId}-textbook-session-{timestamp}"`

- **PDF 截图会话（PdfViewerView）**
  - 带 resourceId：`"{studentUserId}-ai-textbook-{resourceId}-{timestamp}"`
  - 不带 resourceId：`"{studentUserId}-ai-textbook-{timestamp}"`

- **老师通用聊天（teacherGeneralChatStore）**
  - `generateSessionId` 返回值格式改为：
    - `"{studentUserId}-teacher-{8位hash}-{timestamp}"`

- **老师题目聊天（teacherExerciseChatStore）**
  - `generateSessionId` 返回值格式改为：
    - `"{studentUserId}-teacher-exercise-{questionId}-{timestamp}-{randomBase36}"`

- **我的资料页面入口（MyProfileView → teacherGeneralChatStore）**
  - 本地生成的 `aiSessionId` 现为：
    - `"{studentUserId}_teacher_general_{timestamp}_{randomBase36}"`
  - 该值再传给 `teacherGeneralChatStore.generateSessionId` 后，最终会话 ID 仍然会再套一层 `"{studentUserId}-teacher-{...}-{timestamp}"`。

**注意：**

- 旧数据（未带 `studentUserId` 前缀的 sessionId）仍然按原逻辑读取，不会强制迁移或失效。
- 新创建的会话统一带上用户前缀，实现不同帐号之间的会话完全隔离。
