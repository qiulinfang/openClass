# imates-web 接口文档

> 说明：本文件基于当前 `imates-web` 项目的代码整理，尽量与 Android 原生使用的接口保持一致。所有 URL 为 **相对路径**，在 Web 开发环境中通过 Vite 代理或自定义 `http-client` 路由转发到后端网关。

---

## 一、用户与认证相关

### 1. 学班登录（Xueban 登录）

- **名称**：学班账号登录
- **URL**：`POST /admin/login`
- **调用位置**：
  - `src/services/api-service.ts` → `loginXueban(userId, password)`
  - `src/services/http-client.ts`：对 `/admin/login` 特殊处理（不加 Token 头）
- **请求头**：
  - 无认证头
- **请求体**（示意，具体字段与后端保持一致）：
  - `username` / `account`: 用户帐号
  - `password`: 密码
- **响应结构**（`XuebanLoginResponse`）：
  - `success: boolean`
  - `data: { token: string, ... }`
- **用途**：
  - 获取学班侧 `XUEBAN_TOKEN`，供 `/permission/**`、`/admin/info`、`/biologyTopicKnowledge/**` 等接口使用。

---

### 2. 获取学班管理员信息

- **名称**：获取管理员信息
- **URL**：`GET /admin/info`
- **调用位置**：`api-service.ts` 对应获取用户信息方法
- **请求头**：
  - `Token: <XUEBAN_TOKEN>`（`http-client` 自动添加）
  - `sa-token` / `authorization` 也会附带相同 token
- **请求体**：无
- **响应结构**：
  - `success: boolean`
  - `data: UserInfo`
- **用途**：
  - 登录后拉取当前用户信息，用于前端展示和权限控制。

---

### 3. 研伴登录（Yanban 登录）

- **名称**：研伴学生登录
- **URL**：`POST /blw-edu-yb/auth/login-student`
- **调用位置**：
  - `api-service.ts` → `loginYanban(userId, password)`
  - `http-client.ts`：对 `/blw-edu-yb/**` 使用 `YANBAN_TOKEN`
- **请求体**：
  - 与 Android 端一致，通常包含：`userId` / `studentNo`、`password` 等
- **响应结构**：
  - `success: boolean`
  - `data: LoginData`（包含研伴 token 等）
- **用途**：
  - 为研伴/教材相关接口（`/blw-edu-yb/**`）提供 `YANBAN_TOKEN`。

---

## 二、习题管理相关（我的练习 / 收藏 / 相似题）

### 4. 获取习题列表（我的练习）

- **名称**：获取指定学科的题目列表
- **URL**：
  - 生物：`GET /permission/selectExercises/biology`
  - 数学：`GET /permission/selectExercises/math`
- **调用位置**：
  - `api-service.ts` → `getExerciseList(subject)`
  - `src/stores/questionStore.ts` → `fetchQuestions`、`fetchAllSubjectsQuestions`
  - `src/stores/findExerciseStore.ts` → `fetchQuestionList`
- **请求头**：
  - `Token: <XUEBAN_TOKEN>`
- **请求体**：无
- **响应结构**（简化）：
  - `success: boolean`
  - `data: { questionsList: any[] }`
- **用途**：
  - “我的练习”题目列表
  - 知识点找题前，获取用户当前已收藏题目列表。

---

### 5. 删除习题

- **名称**：删除单个习题
- **URL**：`DELETE /permission/deleteExercises/{exerciseId}/{subject}`
  - 其中 `subject` 为 `math` 或 `biology`
- **调用位置**：
  - `api-service.ts` → `deleteExercise(exerciseId, subject)`
- **请求头**：
  - `Token: <XUEBAN_TOKEN>`
- **请求体**：无
- **响应结构**：
  - `success: boolean`
- **用途**：
  - 从“我的练习”中移除题目。

---

### 6. 添加题目到练习列表（AddQuestion）

- **名称**：添加题目到练习列表
- **URL**：`POST /permission/exercises`
- **调用位置**：
  - `api-service.ts` → `addQuestionToList(questionData, subject)`
  - `PhotoSearchView.vue` → `handleAddToPracticeInChat`（拍照/关键词搜题加入练习）
  - `src/stores/findExerciseStore.ts` → 批量添加选中题目到列表
- **请求头**：
  - `Token: <XUEBAN_TOKEN>`
- **请求体**（与 Android `AddQuestionRequest` 对齐）：
  - `bmNo: string`  
    单题：题目编号；批量：多个 bmNo 用逗号分隔
  - `type: string`  
    `"biology"` 或 `"math"`
  - `exercisesId: string`  
    当前题目列表 ID（已有题目的 bmNo/ID 用逗号拼接）
  - `title: string`  
    题干文本，可包含图片 markdown
  - `answer: string`  
    正确答案
  - `explanation: string`  
    解析文本
  - `analysisData: string`  
    结构化解析或富文本数据，可为空字符串
- **响应结构**：
  - `success: boolean`
- **用途**：
  - 拍照/关键词识别的题目加入“我的练习”
  - 知识点找题页面中批量选中题目加入“我的练习”。

---

### 7. 按题目内容查找相似题

- **名称**：根据题目内容查找相似题
- **URL**：`POST /permission/topicAndAck`
- **调用位置**：
  - `api-service.ts` → `findSimilarQuestions(questionData, subject)`
  - `src/stores/questionStore.ts` → `findSimilarQuestions`
- **请求头**：
  - `Token: <XUEBAN_TOKEN>`
- **请求体**（与 Android 一致，字段从题目对象映射）：
  - `bmNo: string`
  - `title: string`
  - `answer: string`
  - `explanation: string`
  - `analysisData: string`
  - `exercisesId: string`（可选）
  - `type: string`（`math` 或 `biology`）
- **响应结构**：
  - `success: boolean`
  - `data: { questions: any[] }`
- **用途**：
  - 在“我的练习”中对当前题目查找相似题。

---

### 8. 按知识点查找相似题（FindExercise）

- **名称**：根据知识点列表查找相似题
- **URL**：`POST /biologyTopicKnowledge/knowledgeTopicAndAck`
- **调用位置**：
  - `api-service.ts` → `findSimilarQuestionsByKnowledge(request)`
  - `src/stores/findExerciseStore.ts` → `findSimilarQuestions`
- **请求头**：
  - `Token: <XUEBAN_TOKEN>`
- **请求体**（`FindSimilarQuestionByKnowledgeRequest`）：
  - `knowledgeNo: string`  
  知识点 ID 列表，逗号分隔
  - `exercisesId: string`  
    用户已收藏的题目 bmNo 列表，逗号分隔
  - `type: string`  
    `math` 或 `biology`
  - `size: number`  
    每页条数（>= 1）
  - `current: number`  
    当前页码（>= 1）
- **响应结构**：
  - `success: boolean`
  - `data: {
      questions: any[],
      totalCount?: string,
      pageNo?: string,
      pageSize?: string
    }`
- **用途**：
  - 知识图谱“去练习”入口中，根据知识点推荐可练习的题目列表。

---

## 三、知识图谱相关接口

### 9. 根据章节节点 ID 查询知识点 ID 列表

- **名称**：查询章节对应的知识点 ID 列表
- **URL**：`POST /knowledge`
- **调用位置**：
  - `api-service.ts` → `queryKnowledgeIdsByNodeId(request)`
  - `KnowledgeGraphView.vue` → 从章节节点跳转到 FindExercise 时调用
- **请求头**：
  - `Token: <XUEBAN_TOKEN>`
- **请求体**：
  - `subject: string`  
    学科标识，例如 `"math"` 或 `"biology"`
  - `param: Array<{ textbook_id: string; section_id: string }>`
- **响应结构**（后端原始 JSON，前端有额外校验）：
  - `success: boolean`
  - `subject?: string`
  - `knowledge?: string`  
    知识点 ID 字符串一串，以逗号分隔
  - `count?: number`
  - `message?: string`
- **用途**：
  - 从章节节点查询可用于找题的知识点 ID 列表。

---

## 四、拍照搜题 / 文本搜题 & AI 聊天

### 10. 图片识别搜题（拍照搜题）

- **名称**：图片识别获取题目
- **URL**：
  - 生物：`POST /permission/img`
  - 数学：`POST /permission/imgMath`
- **调用位置**：
  - `api-service.ts` → `recognizeImage(imageFile, subject)`
  - `PhotoSearchView.vue` → 拍照搜题流程
- **请求头**：
  - 由 `http-client` 设置 multipart 边界，不显式设置 `Content-Type`
- **请求体**：
  - `FormData`：`imgFile` 字段，内容为图片文件
- **响应结构**（简化）：
  - `success: boolean`
  - `code: number`
  - `message: string`
  - `data: {
      item: {
        questionsConfirm: Array<{
          bmNo: string
          title: string
          answer: string
          explanation: string
          analysisData: string
          id: string
        }>
      }
    }`
- **用途**：
  - 拍照识别题目，用于展示、加入练习、发起 AI 问答等。

---

### 11. 文本搜题（关键词搜题）

- **名称**：输入关键词搜题
- **URL**：
  - 生物：`GET /permission/textSearch/{keyText}`
  - 数学：`GET /permission/textSearchMath/{keyText}`
- **调用位置**：
  - `api-service.ts` → `searchQuestionByText(keyText, subject)`
  - `PhotoSearchView.vue` → 关键词搜题 tab
- **请求路径参数**：
  - `keyText`：URL 编码后的搜索关键字
- **响应结构**：
  - 与图片搜题类似，从 `questionsConfirm[0]` 中取题目数据
- **用途**：
  - 用户通过手动输入关键词搜索题目。

---

### 12. AI 聊天接口（通用/学科/图片预览）

- **名称**：AI 聊天
- **URL**（由 `AiChatMessageRequest.dstUrl` 决定）：
  - 通用会话：`POST /permission/chats`
  - 生物聊天：`POST /permission/chat`
  - 数学聊天：`POST /permission/chatMath`
  - 图片预览问答：`POST /permission/previewPictureQA`
- **调用位置**：
  - `api-service.ts` → `sendChatMessage(message, onComplete, onStream)`
  - 内部 `pollChatMessage` 不断轮询上述 URL
- **请求体**（`buildChatRequestBody`）：
  - `sessionId: string`
  - `newValue: string`
  - `coversation: string`
  - `question: string`
  - `answer: string`
  - `name: string`
  - `reason: 'start' | 'continue'`
  - `bmNo: string`
  - `isWebSearch: boolean`
  - `role: string`（`chatRole`）
  - `explanation: string`
- **响应结构**（单次轮询）：
  - `success: boolean`
  - `message: string`  
    - 若为普通内容：当前 chunk
    - 若为 `'end'`：本轮对话结束
  - `sessionId: string`
- **用途**：
  - 拍照问答、普通 AI 解题、教学问答等。

---

## 五、教材与学习资源（研伴相关）

以下接口通过 `http-client` 路由到 `https://www.imates.com.cn:9099`，使用 `YANBAN_TOKEN` 认证。

### 13. 获取教材版本列表

- **名称**：获取教材版本列表
- **URL**：`POST /blw-edu-yb/api/app/teacher-textbook`
- **调用位置**：
  - `api-service.ts` → 获取教材版本的方法
- **请求头**：
  - `sa-token: <YANBAN_TOKEN>`
- **请求体**：
  - 与 Android `teacher-textbook` 接口一致（通常包含用户、学科等筛选参数）
- **响应结构**：
  - `success: boolean`
  - `data: TextbookVersion[]`
- **用途**：
  - 知识图谱、我的资源中选择教材版本。

---

### 14. 获取教材结构

- **名称**：获取教材章节结构树
- **URL**：`POST /blw-edu-yb/api/app/teacher-textbook-section-tree`
- **调用位置**：
  - `api-service.ts` → 获取章节结构的方法
- **请求头**：
  - `sa-token: <YANBAN_TOKEN>`
- **请求体**：
  - 一般包含 `textbookId`、学科等
- **响应结构**：
  - `success: boolean`
  - `data: ChapterNode[]`
- **用途**：
  - 知识图谱渲染章节/节点树。

---

### 15. 获取学习资源包

- **名称**：获取章节对应的学习资源包
- **URL**：`POST /blw-edu-yb/api/app/teacher-textbook-learning-package`
- **调用位置**：
  - `api-service.ts` → 获取学习资源包的方法
- **请求头**：
  - `sa-token: <YANBAN_TOKEN>`
- **请求体**：
  - 包含教材 ID、章节 ID 等
- **响应结构**：
  - `success: boolean`
  - `data: LearningPackage[]`
- **用途**：
  - 知识图谱节点下的资源展示（微课、练习等）。

---

### 16. 获取用户在线/本地教材（TEXTBOOK_MANAGEMENT）

- **名称**：获取用户所有在线/本地教材
- **URL**：`POST /blw-edu-yb/api/app/teacher-textbook`
- **调用位置**：
  - `api-service.ts`：
    - `fetchUserAllOnlineTextbooks()`
    - `loadUserAllLocalTextbooks()`
- **请求头**：
  - `sa-token: <YANBAN_TOKEN>`
- **请求体**：
  - 通过不同参数区分“在线教材”、“本地教材”等模式
- **响应结构**：
  - `success: boolean`
  - `data: UserTextbookInfo[]`
- **用途**：
  - “我的资源”页展示用户教材列表，检查更新等。

---

## 六、老师对话 / 工单（如已接入）

### 17. 发送消息给老师

- **名称**：发送文本消息给老师
- **URL**：`POST /api/chat/teacher`
- **调用位置**：
  - `api-service.ts` → `sendMessageToTeacher`
- **请求体**：
  - `BridgeChatMessageData`（包含 sessionId、内容、学科等）
- **响应结构**：
  - `success: boolean`
  - `data: { messageId?: string, status?: string }`
- **用途**：
  - 教师答疑场景。

---

### 18. Zammad 工单相关（如启用）

- **基础 URL**：`/api/v1`（代理到 `http://app.imates.com.cn:8080`）
- **用途**：
  - 工单系统（当前项目可能只在部分场景中使用）。

---

> 本文档仅覆盖当前前端代码中**实际调用到**的接口。如后续在 `api-service.ts` 新增接口方法，请同步更新此文档，以保持 Web 与 Android 的接口使用对齐。
