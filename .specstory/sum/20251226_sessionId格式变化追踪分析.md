问题序号：sessionId格式变化追踪分析

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`AI通用聊天/AI题目聊天/AI教材(PDF截图)聊天/教师聊天 的上下文连续性、会话隔离与历史加载`
- **发现日期**：`2025-12-26`
- **解决状态**：`进行中`

## 问题现象
在不同聊天场景中，前端传给后端的 `sessionId`（后端线程/上下文ID）以及前端本地存储使用的会话ID/存储Key存在多种格式，并且在历史提交中发生过变更：

- 早期实现中，部分场景在“构建请求”时直接生成 `sessionId`（例如 `general-session-${Date.now()}` / `exercise-${questionId}-${Date.now()}`），导致同一会话内 `sessionId` 可能漂移。
- PDF 截图教材场景中，存在“本地会话id/存储Key（ai-textbook-...）”与“后端线程id（可能复用 ai-general 的会话ID 或 `textbook-session-*`）”并行维护，容易造成排查困难。
- 在历史提交中出现了对 `sessionId` 生成策略与本地 `storageKey` 格式的调整（例如引入 `storageKey = ai-textbook-${resourceId}-${sessionId}`）。

## 复现步骤
1. 步骤1：在不同场景发起对话
   - AI通用聊天
   - AI题目/解题聊天
   - AI教材/PDF截图聊天
   - 教师聊天
2. 步骤2：观察网络请求 payload 中 `sessionId` 字段，以及本地 IndexedDB/localStorage 的会话键（如 `ai-textbook-*`、`ai-general-*`、`ai-exercise-*` 等）。
3. 步骤3：对比不同功能入口/不同操作（新建会话、切换会话、切换题目、清空消息、切换账号）下 `sessionId` 是否保持稳定。

## 用户体验
- 影响点1：同一对话上下文可能丢失（`sessionId` 漂移 -> 后端认为是新线程）。
- 影响点2：会话历史加载/删除可能出现“找不到对应历史/删错会话”的风险（本地 `storageKey` 格式不一致或解析不稳）。
- 影响点3：排查问题复杂度高（同一场景同时存在前端会话ID与后端线程ID）。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/stores/aiGeneralChatStore.ts`：AI通用聊天请求构建与会话ID生成
  - `imates-web/src/stores/aiExerciseChatStore.ts`：AI题目聊天的 `currentSessionId` 生成/切题重置
  - `imates-web/src/stores/aiTextbookChatStore.ts`：AI教材聊天 `currentSessionId/backendSessionId` 双ID维护与请求构建
  - `imates-web/src/views/PdfViewerView.vue`：PDF截图会话创建、`storageKey` 组装与会话详情加载
  - `imates-web/src/stores/teacherGeneralChatStore.ts`：教师聊天会话ID生成与本地会话管理
- **涉及模块**：
  - 会话管理（session list / switch / delete）
  - 本地持久化（IndexedDB/localforage/localStorage）
  - AI请求构建与后端线程上下文（thread_id/sessionId）

## 技术原因 (❌)
1. 原因1：早期生成策略把 `sessionId` 生成放在“构建请求”阶段，且缺少稳定的会话状态兜底，导致同一会话可能重复生成新的 `sessionId`。
2. 原因2：教材/PDF截图场景同时维护“前端会话ID（用于本地会话/列表/存储）”与“后端会话ID（用于上下文线程）”，且两者可能来自不同来源（如复用 ai-general 顶部会话），造成格式多样与理解成本高。
3. 原因3：本地存储 `storageKey` 格式存在演进（仅 resourceId -> resourceId+sessionId），历史兼容逻辑依赖字符串解析，容易出错。

```typescript
// ❌ 典型问题：构建请求时直接生成，缺少对外部传入/已存在 sessionId 的复用
const sessionId = `general-session-${Date.now()}`
return { sessionId }
```

## 正确实现方案 (✅)
1. 方案1：`sessionId` 的生成应由“会话状态（store）”统一管理，构建请求时**优先复用传入/已有 sessionId**，不存在才创建。
2. 方案2：教材/PDF截图场景明确区分并命名：
   - `frontendSessionId`：仅用于本地会话列表/存储/展示
   - `backendThreadId`：仅用于后端上下文线程
   并在接口层/类型层明确字段含义，避免混用。
3. 方案3：对 `storageKey` 采用显式结构化字段（例如 `{resourceId, sessionId}` 分字段存储），或用可解析的 JSON，而不是仅靠字符串正则解析；同时提供迁移脚本/兼容策略。

```typescript
// ✅ 构建请求：优先复用
const finalSessionId = sessionId || `general-session-${Date.now()}`
return { sessionId: finalSessionId }
```

## 关键代码/公式
- 代码片段1：`aiGeneral` / `aiExercise` 在历史提交中由“固定生成”改为“优先复用”的模式（通过 `finalSessionId = sessionId || ...`）。
- 代码片段2：`PdfViewerView` 中 `storageKey = ai-textbook-${resourceId}-${sessionId}` 的格式演进（支持同资源多会话）。

## 测试验证
- **测试场景**：
  - 场景1：AI通用会话中连续发送 3-5 轮，对比每次请求 `sessionId` 是否一致。
  - 场景2：AI题目场景切换题目后首次发送，确认 `currentSessionId` 被重置并生成新值；同一题目内切换会话后 `sessionId` 应稳定。
  - 场景3：PDF截图场景连续发送多次（同一截图会话内/新建截图会话），确认：
    - 后端 `sessionId`（线程）是否符合预期（复用或新建策略一致）
    - 本地 `storageKey` 能正确加载/删除对应历史。
- **验证方法**：
  - 方法1：在 DevTools Network 中比对请求 payload 的 `sessionId`。
  - 方法2：检查 IndexedDB/localforage 中会话记录键（`ai-textbook-*` 等）与 UI 会话列表的一致性。

## 预防措施
- 措施1：为各场景制定统一的 `sessionId` 规范文档（前缀、是否带 userId、生命周期、何时重置）。
- 措施2：在构建请求前加入断言/日志：当同一 UI 会话内 `sessionId` 发生变化时报警。
- 措施3：为本地会话存储提供结构化 schema 与版本号，出现格式变更时走迁移而不是“隐式兼容”。

## 相关链接/参考
- 相关文档：`.specstory/sum/20251226_PDF初次截图发送sessionId来源不清问题.md`
- 相关文档：`.specstory/sum/20251226_PDF截图多次发送sessionId变化问题.md`
- 相关文档：`.specstory/sum/20251226_aiGeneral_thread_id漂移导致上下文丢失问题.md`
- 相关文档：`.specstory/sum/20251226_permissionChats是否传递sessionId问题.md`

## 可复用经验
- 经验1：对“会话/线程ID”这种关键链路参数，优先集中在 store/service 层统一生成与复用。
- 经验2：字符串拼接型 key 一旦上线，后续演进成本高；优先使用结构化存储并引入 schema 版本。
- 经验3：当一个场景存在“前端会话ID”和“后端线程ID”两套概念时，必须从命名、类型、接口层面显式区分，避免混用。
