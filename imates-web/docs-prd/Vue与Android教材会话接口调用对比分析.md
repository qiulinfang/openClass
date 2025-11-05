# Vue与Android教材会话接口调用对比分析

## 一、概述

本文档对比分析Vue端和Android原生端在教材会话功能中的接口调用实现差异，包括接口选择逻辑、消息发送流程、轮询机制等关键环节。

## 二、接口选择逻辑对比

### 2.1 Vue端实现

**位置：** `imates-web/src/stores/utils/aiMessageBuilder.ts`

**实现方式：** 在构建消息请求时根据科目参数动态选择接口

```106:153:imates-web/src/stores/utils/aiMessageBuilder.ts
export function buildAiTextbookMessage(
  content: string,
  userInfo: UserInfo | null,
  enableWebSearch: boolean,
  chatRole: string = 'mate',
  imageData?: ChatImageData,
  subject: 'MATH' | 'BIOLOGY' = 'MATH'  // 新增科目参数，默认数学
): AiChatMessageRequest {
  // 第1步：判断是否为图片消息
  const isImageMessage = imageData && imageData.base64DataUrl
  
  if (isImageMessage) {
    // 教材截图问答
    const sessionId = `textbook-session-${Date.now()}`
    
    return {
      sessionId,
      newValue: '1',
      coversation: content,
      question: imageData!.base64DataUrl || '',
      answer: '教材内容截图',
      name: userInfo?.userName || 'User',
      reason: 'start',
      bmNo: sessionId,
      isWebSearch: enableWebSearch ? '1' : '0',
      chatRole: chatRole,
      dstUrl: '/permission/previewPictureQA'  // 截图问答专用接口
    }
  }
  
  // 第2步：文本消息请求 - 根据科目确定 dstUrl
  const sessionId = `textbook-session-${Date.now()}`
  const dstUrl = subject === 'BIOLOGY' ? '/permission/chat' : '/permission/chatMath'
  
  return {
    sessionId,
    newValue: '1',
    coversation: content,
    question: '教材内容',
    answer: '',
    name: userInfo?.userName || 'User',
    reason: 'start',
    bmNo: sessionId,
    isWebSearch: enableWebSearch ? '1' : '0',
    chatRole: chatRole,
    dstUrl: dstUrl  // ⭐ 明确指定接口路径（文本消息场景）
  }
}
```

**接口选择规则：**
- 图片消息：`/permission/previewPictureQA`
- 生物文本消息：`/permission/chat`
- 数学文本消息：`/permission/chatMath`

**特点：**
- ✅ 在消息构建阶段确定接口路径
- ✅ 接口路径存储在 `dstUrl` 字段中
- ✅ 逻辑清晰，易于维护

### 2.2 Android端实现

**位置：** `app/src/main/java/com/cosinetech/imates/coreapiservice/ApiUrl.java`

**实现方式：** 通过静态常量定义接口URL，在发送消息时设置

```65:107:app/src/main/java/com/cosinetech/imates/coreapiservice/ApiUrl.java
    private static void updateAllUrl() {
        // 用户登录
        URL_LOGIN = baseUrl + "/admin/login";
        //获取用户信息
        URL_USER_INFO = baseUrl + "/admin/info";
        // 生物拍题
        URL_QUESTION_IMAGE_RECOGNISE_BIOLOGY = baseUrl + "/permission/img";
        // 数学拍题
        URL_QUESTION_IMAGE_RECOGNISE_MATH = baseUrl + "/permission/imgMath";
        // 生物文本搜题
        URL_QUESTION_TEXT_SEARCH_BIOLOGY = baseUrl + "/permission/textSearch";
        // 数学文本搜题
        URL_QUESTION_TEXT_SEARCH_MATH = baseUrl + "/permission/textSearchMath";
        // 通用AI对话
        URL_CHAT_GENERAL = baseUrl + "/permission/chats";
        // 截图问答AI对话
        URL_CHAT_PREVIEW_PICTURE = baseUrl + "/permission/previewPictureQA";

        //生物引导解题
        URL_CHAT_BIOLOGY = baseUrl + "/permission/chat";

        //数学引导解题
        URL_CHAT_MATH = baseUrl + "/permission/chatMath";

        //上传生物 数学练习
        URL_ADD_EXERCISE_TO_LIST = baseUrl + "/permission/exercises";

        // 查询生物习题列表
        URL_GET_EXERCISE_BIOLOGY = baseUrl + "/permission/selectExercises/biology";

        //查询数学习题列表
        URL_GET_EXERCISE_MATH = baseUrl + "/permission/selectExercises/math";

        // 删除习题
        URL_DELETE_EXERCISE_BASE = baseUrl + "/permission/deleteExercises";

        // 查询相似题(举一反三)
        URL_QUERY_SIMILAR_EXERCISE = baseUrl + "/permission/topicAndAck";

        // 根据知识点查题
        URL_QUERY_SIMILAR_EXERCISE_BY_KNOWLEDGE = baseUrl + "/biologyTopicKnowledge/knowledgeTopicAndAck";
    }
```

**接口选择规则：**
- 图片消息：`ApiUrl.URL_CHAT_PREVIEW_PICTURE`
- 生物文本消息：`ApiUrl.URL_CHAT_BIOLOGY`
- 数学文本消息：`ApiUrl.URL_CHAT_MATH`

**特点：**
- ✅ 集中管理，所有接口URL定义在ApiUrl类中
- ⚠️ 需要在发送消息时手动设置 `mAiChatRequest.setDstUrl()`
- ⚠️ 接口选择逻辑分散在业务代码中

## 三、消息发送流程对比

### 3.1 Vue端流程

**调用链：**
```
aiTextbookChatStore.sendMessage()
  ↓
apiService.sendChatMessage()
  ↓
apiService.pollChatMessage() (轮询)
  ↓
apiService.sendChatRequest() (HTTP请求)
```

**关键代码：**

```85:179:imates-web/src/stores/aiTextbookChatStore.ts
  const sendMessage = async (
    content: string,
    selectedModel?: string,
    imageData?: ChatImageData,
    hidePrefix: boolean = false,
    skipUserMessage?: boolean
  ): Promise<void> {
    // 第1步：创建并添加用户消息（可选）
    if (!skipUserMessage) {
      const userMessage = createUserMessage(content, imageData, hidePrefix)
      addMessage(userMessage)
    }
    
    // 第2步：创建临时AI回复消息
    const { message: tempReply, id: tempReplyId } = createTempAiReplyMessage()
    addMessage(tempReply)
    
    // 第3步：设置加载状态
    isChatLoading.value = true
    isChatRendering.value = true
    
    try {
      // 第4步：获取用户信息和科目
      const userStore = useUserStore()
      
      // 第5步：构建AI消息请求（传入科目以确定dstUrl）
      // 将 chatStoreUtils.ChatImageData 转换为 aiMessageBuilder.ChatImageData
      const builderImageData = imageData && imageData.base64DataUrl 
        ? { base64DataUrl: imageData.base64DataUrl } 
        : undefined
      const aiMessage = buildAiTextbookMessage(
        content,
        userStore.userInfo,
        enableWebSearch.value,
        selectedModel || 'mate',
        builderImageData,
        userStore.subject  // ⭐ 传入科目参数
      )
      
      // 第6步：累积内容（用于流式更新）
      let accumulatedContent = ''
      
      console.log('[AI Textbook Chat] 开始发送消息:', {
        content,
        sessionId: aiMessage.sessionId,
        reason: aiMessage.reason,
        url: aiMessage.dstUrl,
        hasImage: !!imageData
      })
      
      // 第7步：调用API发送消息（带流式更新回调）
      const response = await apiService.sendChatMessage(
        aiMessage,
        // onComplete: 完成回调
        (finalResponse) => {
          // 最终完成：更新消息为最终状态
          if (isResponseSuccess(finalResponse)) {
            const updatedMessage = updateMessageSuccess(
              tempReply,
              finalResponse.reply || accumulatedContent || '',
              finalResponse.messageId
            )
            updateMessage(tempReplyId, updatedMessage)
            
            // 增加响应次数
            chatResponseTimes.value++
            
            // 保存聊天历史
            saveChatHistory()
          } else {
            // 失败：标记为错误
            const errorMessage = updateMessageError(
              tempReply,
              '抱歉，我暂时无法回答这个问题。请稍后重试。',
              content,
              imageData
            )
            updateMessage(tempReplyId, errorMessage)
          }
        },
        // onStream: 流式更新回调
        (chunk: string, isComplete: boolean) => {
          if (isComplete) {
            // 流式完成，标记消息不再流式更新
            updateMessage(tempReplyId, { isStreaming: false })
          } else {
            // 累积内容并实时更新消息
            accumulatedContent += chunk
            updateMessage(tempReplyId, {
              content: accumulatedContent,
              isStreaming: true
            })
          }
        }
      )
```

**特点：**
- ✅ 使用 async/await 异步处理
- ✅ 支持流式更新回调（onStream）
- ✅ 支持完成回调（onComplete）
- ✅ 错误处理完善

### 3.2 Android端流程

**调用链：**
```
ChatAiView.sendMessageToAi()
  ↓
ApiGateWayService.sendChatMessage()
  ↓
ExecutorService.submit() (异步执行)
  ↓
OkHttpClient.newCall().execute() (HTTP请求)
```

**关键代码：**

```89:137:app/src/main/java/com/cosinetech/imates/coreapiservice/ApiGateWayService.java
    public static void sendChatMessage(final AiChatMessageRequest aiChatMessageRequest, String msgId, String URL, String token, final ChatMessageCallback callback) {
        Runnable task = () -> {
            try {
                OkHttpClient client = createClient();

                JSONObject json = new JSONObject();
                json.put("sessionId", aiChatMessageRequest.getSessionId());
                json.put("newValue", aiChatMessageRequest.getNewValue());
                json.put("coversation", aiChatMessageRequest.getCoversation());
                json.put("question", aiChatMessageRequest.getQuestion());
                json.put("answer", aiChatMessageRequest.getAnswer());
                json.put("name", aiChatMessageRequest.getName());
                json.put("reason", aiChatMessageRequest.getReason());
                json.put("bmNo", aiChatMessageRequest.getBmNo());
                json.put("isWebSearch", aiChatMessageRequest.getIsWebSearch());
                json.put("role", aiChatMessageRequest.getChatRole());

                RequestBody body = RequestBody.create(
                        MediaType.parse("application/json; charset=utf-8"),
                        json.toString()
                );

                Request request = new Request.Builder()
                        .url(URL)
                        .addHeader("Token", token)
                        .post(body)
                        .build();

                Response response = client.newCall(request).execute();
                if (!response.isSuccessful())  {
                    fileterFailedResponse(response);
                    throw new IOException("Unexpected code " + response);
                }

                // 读取响应并调用回调
                if(response.body() != null && !response.body().toString().isEmpty()) {
                    final AiResponse res = parseChatMessageResult(response.body().string());
                    callback.onChatResponse(true, res.content, res.sessionId, msgId);
                } else {
                    callback.onChatResponse(false, "接收消息失败", aiChatMessageRequest.getSessionId(), msgId);
                }
            } catch (Exception e) {
                e.printStackTrace();
                callback.onChatResponse(false, e.getMessage(), aiChatMessageRequest.getSessionId(), msgId);
            }
        };

        executor.submit(task);
    }
```

**特点：**
- ✅ 使用线程池异步执行
- ✅ 使用回调机制处理响应
- ⚠️ 需要手动管理线程
- ⚠️ 轮询逻辑需要在调用层实现

## 四、轮询机制对比

### 4.1 Vue端轮询实现

**位置：** `imates-web/src/services/api-service.ts`

**实现方式：** 基于 async/await 的递归轮询

```620:814:imates-web/src/services/api-service.ts
  private async pollChatMessage(
    message: AiChatMessageRequest,
    url: string,
    onComplete?: (response: any) => void,
    onStream?: (chunk: string, isComplete: boolean) => void,
    accumulatedContent: string = '',
    messageId: string = 'ai_' + Date.now(),
  ): Promise<any> {
    try {
      // 1. 构建请求体
      const requestBody = this.buildChatRequestBody(message)
      
      console.log('[API Service] 轮询请求:', {
        messageId,
        url,
        reason: message.reason,
        sessionId: message.sessionId,
        requestBody: {
          ...requestBody,
          coversation: requestBody.coversation?.length || 0,
          question: requestBody.question?.substring(0, 50) + '...'
        },
        accumulatedContentLength: accumulatedContent.length
      })
      
      // 2. 发送HTTP请求
      const response = await this.sendChatRequest(url, requestBody)
      
      console.log('[API Service] 轮询响应:', {
        messageId,
        success: response.success,
        hasData: !!response.data,
        message: response.data?.message?.substring(0, 50) || '空',
        sessionId: response.data?.sessionId || '无',
        httpCode: response.code
      })
      
      // 3. 处理响应
      return await this.handleChatResponse(
        response,
        message,
        url,
        onComplete,
        onStream,
        accumulatedContent,
        messageId
      )
    } catch (error) {
      console.error('[API Service] 轮询异常:', {
        messageId,
        url,
        reason: message.reason,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      // 4. 处理异常
      return this.handleChatError(error, messageId, accumulatedContent, onComplete, onStream)
    }
  }
```

**轮询逻辑：**
- 根据响应内容判断是否继续轮询
- `response.data.message === 'end'` 时结束轮询
- 有新内容时累积并继续轮询
- 空内容时继续轮询（等待服务器生成）

**特点：**
- ✅ 代码结构清晰，易于理解
- ✅ 支持流式更新（实时显示内容）
- ✅ 错误处理完善
- ✅ 支持超时控制

### 4.2 Android端轮询实现

**实现方式：** 在调用层实现轮询逻辑（通过Handler或递归调用）

**特点：**
- ⚠️ 轮询逻辑分散在业务代码中
- ⚠️ 需要手动管理轮询状态
- ⚠️ 实现方式可能因不同场景而异

## 五、请求体构建对比

### 5.1 Vue端请求体构建

**位置：** `imates-web/src/services/api-service.ts`

```684:697:imates-web/src/services/api-service.ts
  private buildChatRequestBody(message: AiChatMessageRequest) {
    return {
      sessionId: message.sessionId,
      newValue: message.newValue,
      coversation: message.coversation,
      question: message.question,
      answer: message.answer,
      name: message.name,
      reason: message.reason, // "start" 或 "continue"
      bmNo: message.bmNo,
      isWebSearch: message.isWebSearch,
      role: message.chatRole,
    }
  }
```

**特点：**
- ✅ 直接返回对象，简洁明了
- ✅ 字段名与Android端完全一致

### 5.2 Android端请求体构建

**位置：** `app/src/main/java/com/cosinetech/imates/coreapiservice/ApiGateWayService.java`

```94:109:app/src/main/java/com/cosinetech/imates/coreapiservice/ApiGateWayService.java
                JSONObject json = new JSONObject();
                json.put("sessionId", aiChatMessageRequest.getSessionId());
                json.put("newValue", aiChatMessageRequest.getNewValue());
                json.put("coversation", aiChatMessageRequest.getCoversation());
                json.put("question", aiChatMessageRequest.getQuestion());
                json.put("answer", aiChatMessageRequest.getAnswer());
                json.put("name", aiChatMessageRequest.getName());
                json.put("reason", aiChatMessageRequest.getReason());
                json.put("bmNo", aiChatMessageRequest.getBmNo());
                json.put("isWebSearch", aiChatMessageRequest.getIsWebSearch());
                json.put("role", aiChatMessageRequest.getChatRole());

                RequestBody body = RequestBody.create(
                        MediaType.parse("application/json; charset=utf-8"),
                        json.toString()
                );
```

**特点：**
- ✅ 使用JSONObject构建，类型安全
- ✅ 字段名与Vue端完全一致

## 六、接口URL配置对比

### 6.1 Vue端配置

**位置：** `imates-web/src/services/api-endpoints.ts`

```39:45:imates-web/src/services/api-endpoints.ts
  // AI 聊天相关 - 与Android原生一致
  CHAT: {
    GENERAL: '/permission/chats',
    PREVIEW_PICTURE: '/permission/previewPictureQA',
    BIOLOGY: '/permission/chat',
    MATH: '/permission/chatMath',
  },
```

**特点：**
- ✅ 使用相对路径，通过Vite代理转发
- ✅ 配置集中管理
- ✅ 与Android端URL路径一致

### 6.2 Android端配置

**位置：** `app/src/main/java/com/cosinetech/imates/coreapiservice/ApiUrl.java`

**特点：**
- ✅ 使用完整URL（包含baseUrl）
- ✅ 根据环境切换（RELEASE/INTERNAL_TEST）
- ✅ 配置集中管理

## 七、关键差异总结

### 7.1 接口选择时机

| 对比项 | Vue端 | Android端 |
|--------|-------|-----------|
| 选择时机 | 消息构建时 | 发送消息时 |
| 实现方式 | 函数参数传入科目 | 手动设置URL常量 |
| 代码位置 | aiMessageBuilder.ts | ChatAiView.java |
| 维护性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

### 7.2 异步处理方式

| 对比项 | Vue端 | Android端 |
|--------|-------|-----------|
| 实现方式 | async/await | 线程池 + 回调 |
| 代码可读性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 错误处理 | Promise.catch | try-catch + 回调 |
| 流式更新 | 支持（onStream回调） | 需在调用层实现 |

### 7.3 轮询机制

| 对比项 | Vue端 | Android端 |
|--------|-------|-----------|
| 实现位置 | api-service.ts | 调用层（分散） |
| 代码复用 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 可维护性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

### 7.4 请求体构建

| 对比项 | Vue端 | Android端 |
|--------|-------|-----------|
| 实现方式 | 对象字面量 | JSONObject |
| 字段一致性 | ✅ 完全一致 | ✅ 完全一致 |

## 八、建议与优化

### 8.1 对Vue端的建议

1. ✅ **当前实现良好**：接口选择逻辑清晰，轮询机制完善
2. ✅ **流式更新支持**：已实现实时显示内容，用户体验好
3. ✅ **错误处理完善**：有完整的错误处理和重试机制

### 8.2 对Android端的建议

1. ⚠️ **统一轮询逻辑**：建议将轮询逻辑提取到ApiGateWayService中，提高代码复用性
2. ⚠️ **接口选择封装**：建议封装接口选择逻辑，减少业务代码中的重复判断
3. ⚠️ **流式更新支持**：建议在ApiGateWayService层面支持流式更新，提供更好的用户体验

### 8.3 统一性建议

1. ✅ **请求体格式**：两端格式完全一致，无需修改
2. ✅ **接口URL**：两端URL路径一致，保持现状即可
3. ⚠️ **轮询机制**：建议Android端参考Vue端的实现，统一轮询逻辑

## 九、结论

Vue端和Android端在教材会话接口调用方面：

1. **接口选择逻辑**：Vue端实现更加优雅，在消息构建时确定接口；Android端需要在发送时手动设置
2. **消息发送流程**：两端流程基本一致，但Vue端使用async/await更加清晰
3. **轮询机制**：Vue端实现更加完善，支持流式更新；Android端轮询逻辑分散
4. **请求体格式**：两端完全一致，保证了兼容性

**总体评价：**
- Vue端实现更加现代化和易维护
- Android端实现较为传统，但功能完整
- 建议Android端参考Vue端的实现，统一轮询逻辑和接口选择机制

