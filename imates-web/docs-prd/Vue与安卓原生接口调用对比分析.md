# Vue与安卓原生接口调用对比分析

## 一、接口信息对比

### 1.1 接口地址

| 项目 | 接口路径 | 完整URL（正式环境） |
|------|----------|---------------------|
| **安卓原生** | `/permission/previewPictureQA` | `http://www.imates.com.cn:8222/blw-edu-service-alc/permission/previewPictureQA` |
| **Vue项目** | `/permission/previewPictureQA` | `http://www.imates.com.cn:8222/blw-edu-service-alc/permission/previewPictureQA` |

**结论**：✅ **接口地址完全相同**

### 1.2 请求方法

| 项目 | HTTP方法 |
|------|----------|
| **安卓原生** | POST |
| **Vue项目** | POST |

**结论**：✅ **请求方法相同**

### 1.3 Content-Type

| 项目 | Content-Type |
|------|--------------|
| **安卓原生** | `application/json; charset=utf-8` |
| **Vue项目** | `application/json` |

**结论**：⚠️ **基本一致，但Vue项目未明确指定charset**（浏览器会自动处理，不影响功能）

## 二、请求头对比

### 2.1 认证头（关键差异）

#### 安卓原生实现
**文件**: `app/src/main/java/com/cosinetech/imates/coreapiservice/ApiGateWayService.java`

```java
Request request = new Request.Builder()
    .url(URL)
    .addHeader("Token", token)  // ⭐ 只使用Token header
    .post(body)
    .build();
```

**认证头**：
- `Token: {token值}`

#### Vue项目实现
**文件**: `imates-web/src/services/http-client.ts`

```typescript
private getDynamicAuthConfig(url: string): Record<string, string> {
  const authConfig: Record<string, string> = {}
  
  // 根据请求路径选择不同的token
  if (url.startsWith('/permission') || url.startsWith('/admin/info')) {
    selectedToken = localStorage.getItem('XUEBAN_TOKEN')
  }
  
  // 如果找到了token，将其赋值给所有认证字段
  if (selectedToken) {
    authConfig['sa-token'] = selectedToken      // ⭐ 同时设置多个header
    authConfig['authorization'] = selectedToken
    authConfig['token'] = selectedToken          // ⭐ 包含Token（与安卓一致）
  }
  
  return authConfig
}
```

**认证头**：
- `sa-token: {token值}`
- `authorization: {token值}`
- `token: {token值}` （小写，与安卓原生的`Token`不同）

**结论**：⚠️ **存在差异**
- 安卓原生：只使用 `Token` header（首字母大写）
- Vue项目：同时使用 `sa-token`、`authorization` 和 `token`（小写）三个header
- **可能的问题**：如果后端只识别 `Token` header，Vue项目的请求可能认证失败

### 2.2 完整请求头对比

| 请求头 | 安卓原生 | Vue项目 | 说明 |
|--------|----------|---------|------|
| `Content-Type` | `application/json; charset=utf-8` | `application/json` | Vue未指定charset，但浏览器会自动处理 |
| `Token` | ✅ 使用 | ❌ 未使用（使用`token`小写） | **关键差异** |
| `token` | ❌ 未使用 | ✅ 使用（小写） | Vue项目使用小写 |
| `sa-token` | ❌ 未使用 | ✅ 使用 | Vue项目特有 |
| `authorization` | ❌ 未使用 | ✅ 使用 | Vue项目特有 |
| `Accept-Encoding` | ❌ 未设置 | ✅ `gzip, deflate` | Vue项目支持压缩 |
| `Cache-Control` | ❌ 未设置 | ✅ `no-cache` | Vue项目设置 |

## 三、请求体对比

### 3.1 请求体结构

两者使用的请求体结构**完全相同**：

```json
{
  "sessionId": "会话ID",
  "newValue": "1",
  "coversation": "用户输入的文本问题",
  "question": "data:image/jpg;base64,{base64图片数据}",
  "answer": "答案或提示词",
  "name": "用户名",
  "reason": "start",
  "bmNo": "编号",
  "isWebSearch": "0" 或 "1",
  "role": "聊天角色"
}
```

### 3.2 请求体构建代码对比

#### 安卓原生
**文件**: `app/src/main/java/com/cosinetech/imates/coreapiservice/ApiGateWayService.java`

```java
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
```

#### Vue项目
**文件**: `imates-web/src/services/api-service.ts`

```typescript
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

**结论**：✅ **请求体结构完全相同**

## 四、图片处理对比

### 4.1 图片格式转换

#### 安卓原生
**文件**: `app/src/main/java/com/cosinetech/imates/utils/ImageUtils.java`

```java
public static String bitmapToHtmlJpgBase64(Bitmap bm) {
    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    bm.compress(Bitmap.CompressFormat.JPEG, 40, baos);  // ⭐ 压缩质量40%
    byte[] b = baos.toByteArray();
    
    String img = Base64.getEncoder().encodeToString(b);
    StringBuilder builder = new StringBuilder();
    builder.append("data:image/jpg;base64,").append(img);  // ⭐ data URL格式
    return builder.toString();
}
```

**图片处理参数**：
- 格式：JPEG
- 压缩质量：40%
- 输出格式：`data:image/jpg;base64,{base64数据}`

#### Vue项目
**文件**: `imates-web/src/stores/utils/aiMessageBuilder.ts`

```typescript
export function buildAiTextbookMessage(
  content: string,
  userInfo: UserInfo | null,
  enableWebSearch: boolean,
  chatRole: string = 'mate',
  imageData?: ChatImageData,  // ⭐ 直接接收base64DataUrl
  subject: 'MATH' | 'BIOLOGY' = 'MATH'
): AiChatMessageRequest {
  if (isImageMessage) {
    return {
      // ...
      question: imageData!.base64DataUrl || '',  // ⭐ 直接使用传入的base64DataUrl
      // ...
    }
  }
}
```

**图片处理**：
- Vue项目不负责图片压缩和转换
- 图片数据由调用方（如`pickImage()`）提供，已经是base64DataUrl格式
- 格式：`data:image/jpg;base64,{base64数据}` 或 `data:image/png;base64,{base64数据}`

**结论**：✅ **图片格式相同（都是data URL）**，但Vue项目未指定压缩质量，可能图片大小不同

## 五、消息构建逻辑对比

### 5.1 PDF截图场景参数设置

#### 安卓原生
**文件**: `app/src/main/java/com/cosinetech/imates/ui/views/ScratchToolsView.java`

```java
AiChatMessageRequest chatRequest = new AiChatMessageRequest(
    UUID.nameUUIDFromBytes(mAiPrompt.getBytes()).toString(),  // sessionId
    "1",                                                       // newValue
    editText.getText().toString(),                            // coversation
    ImageUtils.bitmapToHtmlJpgBase64(bmp),                    // question (图片)
    mAiPrompt,                                                // answer
    "",                                                       // name
    "start",                                                  // reason
    "",                                                       // bmNo
    false                                                     // isWebSearch
);
chatRequest.setDstUrl(ApiUrl.URL_CHAT_PREVIEW_PICTURE);      // dstUrl
```

#### Vue项目
**文件**: `imates-web/src/stores/utils/aiMessageBuilder.ts`

```typescript
export function buildAiTextbookMessage(
  content: string,
  userInfo: UserInfo | null,
  enableWebSearch: boolean,
  chatRole: string = 'mate',
  imageData?: ChatImageData,
  subject: 'MATH' | 'BIOLOGY' = 'MATH'
): AiChatMessageRequest {
  if (isImageMessage) {
    const sessionId = `textbook-session-${Date.now()}`
    
    return {
      sessionId,
      newValue: '1',
      coversation: content,
      question: imageData!.base64DataUrl || '',
      answer: '教材内容截图',  // ⭐ 固定值，与安卓不同
      name: userInfo?.userName || 'User',
      reason: 'start',
      bmNo: sessionId,  // ⭐ 使用sessionId作为bmNo
      isWebSearch: enableWebSearch ? '1' : '0',
      chatRole: chatRole,
      dstUrl: '/permission/previewPictureQA'
    }
  }
}
```

**参数差异对比**：

| 参数 | 安卓原生 | Vue项目 | 说明 |
|------|----------|---------|------|
| `sessionId` | UUID生成（基于mAiPrompt） | `textbook-session-${Date.now()}` | 生成方式不同 |
| `newValue` | `"1"` | `"1"` | ✅ 相同 |
| `coversation` | 用户输入文本 | 用户输入文本 | ✅ 相同 |
| `question` | Base64图片（data URL） | Base64图片（data URL） | ✅ 相同 |
| `answer` | `mAiPrompt`（AI提示词） | `"教材内容截图"`（固定值） | ⚠️ 不同 |
| `name` | 空字符串 | `userInfo?.userName || 'User'` | ⚠️ 不同 |
| `reason` | `"start"` | `"start"` | ✅ 相同 |
| `bmNo` | 空字符串 | `sessionId` | ⚠️ 不同 |
| `isWebSearch` | `"0"`（固定false） | `enableWebSearch ? '1' : '0'` | ⚠️ 不同（Vue支持动态设置） |
| `role` | 通过`setChatRole`设置 | `chatRole`参数 | ✅ 相同 |
| `dstUrl` | `URL_CHAT_PREVIEW_PICTURE` | `'/permission/previewPictureQA'` | ✅ 相同 |

**结论**：⚠️ **大部分参数相同，但存在以下差异**：
1. `answer`字段：安卓使用AI提示词，Vue使用固定值
2. `name`字段：安卓使用空字符串，Vue使用用户名
3. `bmNo`字段：安卓使用空字符串，Vue使用sessionId
4. `isWebSearch`：Vue支持动态设置，安卓固定为false

## 六、HTTP客户端实现对比

### 6.1 请求发送方式

#### 安卓原生
**技术栈**：OkHttp

```java
OkHttpClient client = createClient();
Request request = new Request.Builder()
    .url(URL)
    .addHeader("Token", token)
    .post(body)
    .build();
Response response = client.newCall(request).execute();
```

#### Vue项目
**技术栈**：Fetch API

```typescript
const response = await fetch(fullUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...this.getDynamicAuthConfig(url),  // 包含token等认证信息
    ...headers,
  },
  body: JSON.stringify(body),
})
```

**结论**：✅ **功能相同，但实现技术不同**（OkHttp vs Fetch API）

### 6.2 错误处理

#### 安卓原生
```java
try {
    Response response = client.newCall(request).execute();
    if (!response.isSuccessful()) {
        fileterFailedResponse(response);
        throw new IOException("Unexpected code " + response);
    }
    // 处理响应
} catch (Exception e) {
    callback.onChatResponse(false, e.getMessage(), ...);
}
```

#### Vue项目
```typescript
try {
    const response = await fetch(fullUrl, requestOptions)
    
    // 检测401未授权错误
    if (response.status === 401 && !skipAuth401Retry) {
        // 自动重新登录并重试
        const loginSuccess = await this.tryAutoRelogin(url)
        if (loginSuccess) {
            return await this.request<T>(url, { ...config, skipAuth401Retry: true })
        }
        showMessage('登录已过期，请重新登录', 'warning')
        throw new Error(`认证失败(401): 请重新登录`)
    }
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
} catch (error) {
    // 重试机制
}
```

**结论**：⚠️ **Vue项目有更完善的错误处理和自动重试机制**

## 七、总结与建议

### 7.1 相同点 ✅

1. **接口地址**：完全相同
2. **请求方法**：都是POST
3. **请求体结构**：字段完全相同
4. **图片格式**：都使用data URL格式（`data:image/jpg;base64,...`）
5. **核心功能**：都能正常发送截图问答请求

### 7.2 差异点 ⚠️

#### 关键差异（可能影响功能）

1. **认证头差异** ⚠️⚠️⚠️
   - **安卓原生**：使用 `Token` header（首字母大写）
   - **Vue项目**：使用 `token`、`sa-token`、`authorization` 三个header（小写）
   - **影响**：如果后端只识别 `Token` header，Vue项目的请求可能认证失败
   - **建议**：验证后端是否支持小写`token`或`sa-token`，如果不支持，需要修改Vue项目

#### 次要差异（不影响核心功能）

2. **Content-Type**：Vue项目未指定charset，但浏览器会自动处理
3. **请求参数**：
   - `answer`字段：安卓使用AI提示词，Vue使用固定值
   - `name`字段：安卓为空，Vue使用用户名
   - `bmNo`字段：安卓为空，Vue使用sessionId
   - `isWebSearch`：Vue支持动态设置，安卓固定为false
4. **图片压缩**：安卓固定40%质量，Vue项目未指定（由调用方决定）
5. **错误处理**：Vue项目有更完善的自动重试和401处理机制

### 7.3 建议修改

#### 优先级1：修复认证头问题

**方案A**：修改Vue项目，确保使用`Token` header（与安卓保持一致）

**文件**: `imates-web/src/services/http-client.ts`

```typescript
private getDynamicAuthConfig(url: string): Record<string, string> {
  const authConfig: Record<string, string> = {}
  
  if (url.startsWith('/permission') || url.startsWith('/admin/info')) {
    selectedToken = localStorage.getItem('XUEBAN_TOKEN')
  }
  
  if (selectedToken) {
    // ⭐ 修改：使用Token（首字母大写），与安卓原生保持一致
    authConfig['Token'] = selectedToken
    // 可选：保留其他header作为备用（如果后端支持）
    // authConfig['sa-token'] = selectedToken
    // authConfig['authorization'] = selectedToken
  }
  
  return authConfig
}
```

**方案B**：验证后端是否支持小写`token`或`sa-token`
- 如果后端支持，则无需修改
- 如果不支持，必须修改为方案A

#### 优先级2：统一请求参数（可选）

如果需要与安卓原生完全一致，可以修改：

**文件**: `imates-web/src/stores/utils/aiMessageBuilder.ts`

```typescript
// 修改answer字段，使用AI提示词而不是固定值
answer: '',  // 或从配置中获取AI提示词

// 修改name字段，使用空字符串
name: '',  // 与安卓保持一致

// 修改bmNo字段，使用空字符串
bmNo: '',  // 与安卓保持一致
```

### 7.4 测试建议

1. **认证测试**：验证Vue项目发送的请求是否能正常通过后端认证
2. **功能测试**：对比安卓原生和Vue项目的截图问答功能，确认响应结果是否一致
3. **参数测试**：验证后端对`answer`、`name`、`bmNo`等字段的处理是否对结果有影响

## 八、代码位置索引

### 安卓原生
- 接口定义：`app/src/main/java/com/cosinetech/imates/coreapiservice/ApiUrl.java`
- 请求发送：`app/src/main/java/com/cosinetech/imates/coreapiservice/ApiGateWayService.java`
- 图片处理：`app/src/main/java/com/cosinetech/imates/utils/ImageUtils.java`
- 消息构建：`app/src/main/java/com/cosinetech/imates/ui/views/ScratchToolsView.java`

### Vue项目
- 接口定义：`imates-web/src/services/api-endpoints.ts`
- HTTP客户端：`imates-web/src/services/http-client.ts`
- API服务：`imates-web/src/services/api-service.ts`
- 消息构建：`imates-web/src/stores/utils/aiMessageBuilder.ts`
- 聊天Store：`imates-web/src/stores/aiTextbookChatStore.ts`

