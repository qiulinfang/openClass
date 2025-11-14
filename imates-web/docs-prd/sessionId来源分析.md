# sessionId 来源分析

## 📋 问题概述

分析两个不同的 sessionId 的来源和使用场景：
1. `permission/previewPictureQA` 传递的 `sessionId: "screenshot_1763087678909"` 来自哪里？
2. `permission/chats` 传递的 `sessionId: "textbook-session-1763087695198"` 来自哪里？

---

## 🔍 sessionId 生成位置分析

### 1. `screenshot_1763087678909` 的来源

#### 1.1 生成位置

**文件**：`imates-web/src/views/PdfViewerView.vue`  
**函数**：`handleScreenshotConfirm`  
**行号**：934

```934:934:imates-web/src/views/PdfViewerView.vue
    const sessionId = `screenshot_${Date.now()}`
```

#### 1.2 生成时机

当用户在 PDF 查看器中截图并发送问题时：

1. **用户操作**：用户在 PDF 页面截图，点击发送
2. **触发函数**：`handleScreenshotConfirm(question: string, dataUrl: string)`
3. **生成 sessionId**：创建格式为 `screenshot_${Date.now()}` 的 sessionId
4. **设置到 Store**：将 sessionId 设置到 `aiTextbookStore.currentSessionId`
5. **发送消息**：调用 `aiTextbookStore.sendMessage()` 发送截图消息

#### 1.3 完整流程

```903:943:imates-web/src/views/PdfViewerView.vue
const handleScreenshotConfirm = async (question: string, dataUrl: string) => {
  try {
    // 步骤1：打开对话面板并切换到AI问答Tab
    chatPanelVisible.value = true
    activeTab.value = 'ai-chat'

    // 步骤2：创建临时图片以获取宽高
    const img = new Image()
    img.src = dataUrl

    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
    })

    // 步骤3：发送消息给AI（使用用户输入的问题作为coversation）
    // 流程：文件名使用.jpg后缀（与安卓原生保持一致）
    const fileName = `screenshot-${Date.now()}.jpg`

    // 构建完整的图片数据，包含宽高信息，确保消息列表能正确显示图片
    const imageData = {
      filePath: fileName,
      base64DataUrl: dataUrl,
      width: img.width,
      height: img.height,
      fileSize: Math.round(dataUrl.length * 0.75), // base64编码后大小约为原始大小的1.33倍，这里估算原始大小
    }

    // 步骤3.5：获取并设置 resourceId（必须在发送消息前设置，以便消息能立即保存）
    const currentResourceId = route.query.resourceId as string || aiTextbookStore.resourceId || ''
    
    // 步骤3.6：创建新会话ID（在发送消息前创建，确保会话ID一致）
    const sessionId = `screenshot_${Date.now()}`
    
    if (currentResourceId) {
      // 每次截图都强制创建新会话：先清空消息，再设置 resourceId（会重置会话状态）
      aiTextbookStore.clearMessages()
      aiTextbookStore.setResourceId(currentResourceId)
      // 设置 sessionId，确保 sendMessage 使用这个 sessionId
      aiTextbookStore.currentSessionId = sessionId
      aiTextbookStore.isNewSession = true
    }
```

#### 1.4 使用场景

- **接口**：`/permission/previewPictureQA`（截图问答专用接口）
- **触发条件**：用户发送包含图片的消息
- **sessionId 格式**：`screenshot_${timestamp}`

---

### 2. `textbook-session-1763087695198` 的来源

#### 2.1 生成位置

**文件**：`imates-web/src/stores/aiTextbookChatStore.ts`  
**函数**：`sendMessage`  
**行号**：216, 220, 375

```214:222:imates-web/src/stores/aiTextbookChatStore.ts
      // 如果有图片数据且没有设置 sessionId，强制创建新会话（每次截图都创建新会话）
      // 注意：如果 currentSessionId 已经存在（比如从外部设置），则不覆盖它
      if (builderImageData && !currentSessionId.value) {
        console.log('有图片数据且没有设置 sessionId')
        currentSessionId.value = `textbook-session-${Date.now()}`
        isNewSession.value = true
      } else if (!currentSessionId.value) {
        console.log('没有设置 sessionId')
        currentSessionId.value = `textbook-session-${Date.now()}`
        isNewSession.value = true
      }
```

#### 2.2 生成时机

当用户发送文本消息时，如果 `currentSessionId` 为空，会自动创建：

1. **用户操作**：用户在聊天界面输入文本并发送
2. **触发函数**：`aiTextbookChatStore.sendMessage()`
3. **检查 sessionId**：检查 `currentSessionId.value` 是否为空
4. **生成 sessionId**：如果为空，创建格式为 `textbook-session-${Date.now()}` 的 sessionId
5. **发送消息**：使用该 sessionId 发送消息

#### 2.3 完整流程

```181:235:imates-web/src/stores/aiTextbookChatStore.ts
  const sendMessage = async (
    content: string,
    selectedModel?: string,
    imageData?: ChatImageData,
    hidePrefix: boolean = false,
    skipUserMessage?: boolean
  ): Promise<void> => {
    // 第1步：创建并添加用户消息（可选）
    if (!skipUserMessage) {
      const userMessage = createUserMessage(content, imageData, hidePrefix)
      addMessage(userMessage)
      // 用户消息创建后立即保存（确保即使AI回复未完成，用户消息也能被保存）
      await saveChatHistory()
    }
    
    // 第2步：创建临时AI回复消息
    const { message: tempReply, id: tempReplyId } = createTempAiReplyMessage(selectedModel || 'mate')
    addMessage(tempReply)
    
    // 第3步：设置渲染状态（发送消息时不需要设置 isChatLoading，因为 isChatLoading 只用于加载聊天历史）
    
    try {
      // 第4步：获取用户信息和科目
      const userInfo = getUserInfo()
      
      // 第5步：构建AI消息请求（传入科目以确定dstUrl）
      // 将 chatStoreUtils.ChatImageData 转换为构建请求所需的精简图片数据
      const builderImageData = imageData?.base64DataUrl
        ? { base64DataUrl: imageData.base64DataUrl }
        : undefined

      // 如果有图片数据且没有设置 sessionId，强制创建新会话（每次截图都创建新会话）
      // 注意：如果 currentSessionId 已经存在（比如从外部设置），则不覆盖它
      if (builderImageData && !currentSessionId.value) {
        console.log('有图片数据且没有设置 sessionId')
        currentSessionId.value = `textbook-session-${Date.now()}`
        isNewSession.value = true
      } else if (!currentSessionId.value) {
        console.log('没有设置 sessionId')
        currentSessionId.value = `textbook-session-${Date.now()}`
        isNewSession.value = true
      }
      console.log('已经有 sessionId', currentSessionId.value)
      const shouldUseScreenshotApi = !!builderImageData

      const aiMessage = buildAiTextbookMessage({
        sessionId: currentSessionId.value,
        content,
        userInfo: userInfo,
        enableWebSearch: enableWebSearch.value,
        chatRole: selectedModel || 'mate',
        imageData: builderImageData,
        useScreenshotApi: shouldUseScreenshotApi,
        isNewSession: isNewSession.value,
      })
```

#### 2.4 使用场景

- **接口**：`/permission/chats`（通用聊天接口）
- **触发条件**：用户发送纯文本消息，或重新加载会话后继续对话
- **sessionId 格式**：`textbook-session-${timestamp}`

---

## 🔄 重新加载会话时的 sessionId 处理

### 3.1 重新加载会话流程

当用户点击会话列表中的某个会话时：

**文件**：`imates-web/src/views/PdfViewerView.vue`  
**函数**：`loadSessionDetail`

```333:375:imates-web/src/views/PdfViewerView.vue
const loadSessionDetail = async (record: AiTextbookSession) => {
  try {
    // 步骤1：确定 resourceId（优先使用 record.resourceId，如果没有则从 storageKey 中提取）
    let targetResourceId = record.resourceId
    if (!targetResourceId && record.storageKey) {
      // 从 storageKey 中提取 resourceId（格式：ai-textbook-${resourceId} 或 ai-textbook-${resourceId}-${sessionId}）
      const match = record.storageKey.match(/^ai-textbook-(.+?)(?:-|$)/)
      if (match && match[1]) {
        targetResourceId = match[1]
      }
    }
    
    // 步骤2：设置 resourceId（如果存在）
    if (targetResourceId) {
      aiTextbookStore.setResourceId(targetResourceId)
    }
    
    // 步骤3：先尝试直接从存储中检查是否有消息历史（避免不必要的清空）
    let loadedMessages: ChatBubble[] = []
    let hasStorageHistory = false
    
    if (targetResourceId) {
      try {
        // 优先使用 record.storageKey（如果存在且是完整格式），否则构建包含 sessionId 的存储键
        let storageKey: string
        if (record.storageKey && record.storageKey.startsWith('ai-textbook-')) {
          // 如果 storageKey 是完整格式（可能包含 sessionId），直接使用
          storageKey = record.storageKey
        } else if (getSessionId(record)) {
          // 使用 sessionId 构建包含 sessionId 的存储键
          storageKey = `ai-textbook-${targetResourceId}-${getSessionId(record)}`
        } else {
          // 降级方案：使用旧的格式（向后兼容）
          storageKey = `ai-textbook-${targetResourceId}`
        }
        
        const history = await asyncStorage.loadChatHistory(storageKey)
        
        if (history && history.messages && history.messages.length > 0) {
          hasStorageHistory = true
          // 有存储历史，使用 loadChatHistory 加载（传入 storageKey 和 sessionId）
          await aiTextbookStore.loadChatHistory(storageKey, getSessionId(record))
          loadedMessages = aiTextbookStore.messages
          // 如果会话包含图片消息，标记使用截图接口
          if (record.hasImage) {
            aiTextbookStore.useScreenshotApi = true
          }
```

### 3.2 sessionId 的设置

在 `loadChatHistory` 函数中，会设置 `currentSessionId`：

```548:555:imates-web/src/stores/aiTextbookChatStore.ts
      // 如果加载成功且有 sessionId，更新 currentSessionId
      if (sessionId) {
        currentSessionId.value = sessionId
        isNewSession.value = false
      } else {
        currentSessionId.value = null
        isNewSession.value = true
      }
```

### 3.3 关键点

1. **从会话记录中提取 sessionId**：使用 `getSessionId(record)` 获取会话记录中的 sessionId
2. **设置到 Store**：将 sessionId 设置到 `aiTextbookStore.currentSessionId`
3. **后续消息使用该 sessionId**：用户继续发送消息时，会使用已设置的 sessionId

---

## 📊 sessionId 使用场景对比

| 场景 | sessionId 格式 | 生成位置 | 使用的接口 | 说明 |
|------|---------------|---------|-----------|------|
| **截图问答（首次）** | `screenshot_${timestamp}` | `PdfViewerView.vue` | `/permission/previewPictureQA` | 用户截图并发送问题时创建 |
| **文本对话（首次）** | `textbook-session-${timestamp}` | `aiTextbookChatStore.ts` | `/permission/chats` | 用户发送文本消息时自动创建 |
| **重新加载会话** | 使用会话记录中的 sessionId | `loadSessionDetail` | 根据 `hasImage` 决定 | 从 `AiTextbookSession` 中提取并设置 |
| **继续对话** | 使用已设置的 sessionId | - | 根据 `useScreenshotApi` 决定 | 如果 `useScreenshotApi=true`，使用 `/permission/previewPictureQA`，否则使用 `/permission/chats` |

---

## 🔍 接口选择逻辑

### 4.1 接口选择规则

**文件**：`imates-web/src/stores/aiTextbookChatStore.ts`  
**函数**：`buildAiTextbookMessage`

```60:96:imates-web/src/stores/aiTextbookChatStore.ts
  if (imageData?.base64DataUrl) {
    const questionDataUrl = imageData.base64DataUrl.startsWith('data:image/jpeg;')
      ? imageData.base64DataUrl.replace('data:image/jpeg;', 'data:image/jpg;')
      : imageData.base64DataUrl

    return {
      sessionId,
      newValue: isNewSession ? '1' : '0',
      coversation: content,
      question: questionDataUrl,
      answer: '',
      name: userId,
      reason: 'start',
      bmNo: sessionId,
      isWebSearch: enableWebSearch ? '1' : '0',
      chatRole,
      subject: '',
      dstUrl: '/permission/previewPictureQA',
    }
  }

  const dstUrl = useScreenshotApi ? '/permission/previewPictureQA' : '/permission/chats'

  return {
    sessionId,
    newValue: isNewSession ? '1' : '0',
    coversation: content,
    question: '',
    answer: '',
    name: userId,
    reason: 'start',
    bmNo: sessionId,
    isWebSearch: enableWebSearch ? '1' : '0',
    chatRole,
    subject: '',
    dstUrl,
  }
```

### 4.2 接口选择规则总结

1. **有图片数据**：强制使用 `/permission/previewPictureQA`
2. **无图片数据但 `useScreenshotApi=true`**：使用 `/permission/previewPictureQA`
3. **无图片数据且 `useScreenshotApi=false`**：使用 `/permission/chats`

---

## 🎯 总结

### 5.1 sessionId 来源总结

1. **`screenshot_1763087678909`**
   - **来源**：`PdfViewerView.vue` 的 `handleScreenshotConfirm` 函数
   - **格式**：`screenshot_${Date.now()}`
   - **场景**：用户截图并发送问题时创建
   - **接口**：`/permission/previewPictureQA`

2. **`textbook-session-1763087695198`**
   - **来源**：`aiTextbookChatStore.ts` 的 `sendMessage` 函数
   - **格式**：`textbook-session-${Date.now()}`
   - **场景**：用户发送文本消息时自动创建（如果 `currentSessionId` 为空）
   - **接口**：`/permission/chats`

### 5.2 重新加载会话时的行为

当用户重新加载会话时：

1. **从会话记录中提取 sessionId**：使用 `getSessionId(record)` 获取
2. **设置到 Store**：`aiTextbookStore.currentSessionId = sessionId`
3. **后续消息使用该 sessionId**：用户继续发送消息时，会使用已设置的 sessionId
4. **接口选择**：根据 `useScreenshotApi` 标志决定使用哪个接口

### 5.3 关键代码位置

- **截图 sessionId 生成**：`imates-web/src/views/PdfViewerView.vue:934`
- **文本 sessionId 生成**：`imates-web/src/stores/aiTextbookChatStore.ts:216, 220`
- **会话加载**：`imates-web/src/views/PdfViewerView.vue:333`
- **接口选择**：`imates-web/src/stores/aiTextbookChatStore.ts:60-96`

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**维护者**：开发团队


