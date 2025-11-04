# PDF截图发送AI接口分析

## 一、流程概述

PDF中截图发送给AI的完整流程如下：

1. **截图获取**：在PDF阅读器（MuPDFActivity）中通过ScratchToolsView获取截图
2. **图片转换**：将Bitmap转换为Base64格式的data URL
3. **请求构建**：创建AiChatMessageRequest对象，设置目标URL和参数
4. **接口调用**：通过ApiGateWayService发送POST请求到服务器

## 二、关键代码位置

### 2.1 截图获取
**文件**: `app/src/main/java/com/cosinetech/imates/ui/mupdfviewer/activity/MuPDFActivity.java`

```151:152:app/src/main/java/com/cosinetech/imates/ui/mupdfviewer/activity/MuPDFActivity.java
                Bitmap bmp = WindowUtils.getScreenshot2Bitmap(MuPDFActivity.this, muPDFReaderView);
                return  bmp;
```

### 2.2 图片转换和请求构建
**文件**: `app/src/main/java/com/cosinetech/imates/ui/views/ScratchToolsView.java`

```295:305:app/src/main/java/com/cosinetech/imates/ui/views/ScratchToolsView.java
            AiChatMessageRequest chatRequest = new AiChatMessageRequest(
                    UUID.nameUUIDFromBytes(mAiPrompt.getBytes()).toString(),
                    "1",
                    editText.getText().toString(),
                    ImageUtils.bitmapToHtmlJpgBase64(bmp),
                    mAiPrompt,
                    "",
                    "start",
                    "",
                    false);
            chatRequest.setDstUrl(ApiUrl.URL_CHAT_PREVIEW_PICTURE);
```

### 2.3 图片格式转换
**文件**: `app/src/main/java/com/cosinetech/imates/utils/ImageUtils.java`

```90:104:app/src/main/java/com/cosinetech/imates/utils/ImageUtils.java
    public static String bitmapToHtmlJpgBase64(Bitmap bm) {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        bm.compress(Bitmap.CompressFormat.JPEG, 40, baos);
        byte[] b = baos.toByteArray();


        String img = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            img = Base64.getEncoder().encodeToString(b);
        }

        StringBuilder builder = new StringBuilder();
        builder.append("data:image/jpg;base64,").append(img);
        return builder.toString();
    }
```

**说明**：
- 图片压缩质量：40%
- 输出格式：JPEG
- 最终格式：`data:image/jpg;base64,{base64编码的图片数据}`

### 2.4 发送图片方法
**文件**: `app/src/main/java/com/cosinetech/imates/ui/views/ChatAiView.java`

```1415:1424:app/src/main/java/com/cosinetech/imates/ui/views/ChatAiView.java
    public void sendPicture(String path) {
        if(mCurrentSession.type.getValue() > ChatMessageSession.SessionType.USER_TALK_TEACHER_BEGIN.getValue()
          && mCurrentSession.type.getValue() < ChatMessageSession.SessionType.USER_TALK_TEACHER_END.getValue()) {
            sendPictureToTeacher(path);
        } else {
            mAiChatRequest.setDstUrl(ApiUrl.URL_CHAT_PREVIEW_PICTURE);
            mAiChatRequest.setQuestion(ImageUtils.bitmapToHtmlJpgBase64(BitmapFactory.decodeFile(path)));
            sendMessageToAi(mAiChatRequest, true);
        }
    }
```

## 三、接口信息

### 3.1 接口URL

**文件**: `app/src/main/java/com/cosinetech/imates/coreapiservice/ApiUrl.java`

```80:81:app/src/main/java/com/cosinetech/imates/coreapiservice/ApiUrl.java
        // 截图问答AI对话
        URL_CHAT_PREVIEW_PICTURE = baseUrl + "/permission/previewPictureQA";
```

**完整URL**（根据环境不同）：
- 正式环境：`http://www.imates.com.cn:8222/blw-edu-service-alc/permission/previewPictureQA`
- 测试环境：`https://api.showcode.xyz/blw-edu-service-alc/permission/previewPictureQA`

### 3.2 请求方法
**POST**

### 3.3 请求头
```
Content-Type: application/json; charset=utf-8
Token: {用户token}
```

### 3.4 请求体（JSON格式）

**文件**: `app/src/main/java/com/cosinetech/imates/coreapiservice/ApiGateWayService.java`

```94:104:app/src/main/java/com/cosinetech/imates/coreapiservice/ApiGateWayService.java
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

**请求参数说明**：

| 参数名 | 类型 | 说明 | 来源 |
|--------|------|------|------|
| sessionId | String | 会话ID | 从AiChatMessageRequest获取 |
| newValue | String | 新值（通常为"1"） | 从AiChatMessageRequest获取 |
| coversation | String | 对话内容（用户输入的问题文本） | 从AiChatMessageRequest获取 |
| question | String | 问题内容（截图时此处为Base64图片数据） | 从AiChatMessageRequest获取，格式：`data:image/jpg;base64,{base64数据}` |
| answer | String | 答案内容 | 从AiChatMessageRequest获取 |
| name | String | 名称 | 从AiChatMessageRequest获取 |
| reason | String | 原因（通常为"start"或"continue"） | 从AiChatMessageRequest获取 |
| bmNo | String | 编号 | 从AiChatMessageRequest获取 |
| isWebSearch | String | 是否网络搜索（"0"或"1"） | 从AiChatMessageRequest获取 |
| role | String | 聊天角色 | 从AiChatMessageRequest.getChatRole()获取 |

### 3.5 AiChatMessageRequest对象结构

**文件**: `app/src/main/java/com/cosinetech/imates/coreapiservice/AiChatMessageRequest.java`

**构造函数参数**：
```java
public AiChatMessageRequest(
    String sessionId,      // 会话ID
    String newValue,       // 新值
    String conversation,   // 对话内容
    String question,       // 问题（截图时为Base64图片）
    String answer,         // 答案
    String name,           // 名称
    String reason,         // 原因
    String bmNo,          // 编号
    boolean isWebSearch    // 是否网络搜索
)
```

**PDF截图场景下的参数值**：
- sessionId: `UUID.nameUUIDFromBytes(mAiPrompt.getBytes()).toString()`
- newValue: `"1"`
- coversation: 用户输入的文本问题
- question: `ImageUtils.bitmapToHtmlJpgBase64(bmp)` - Base64格式的图片
- answer: `mAiPrompt`（AI提示词）
- name: `""`
- reason: `"start"`
- bmNo: `""`
- isWebSearch: `false`（转换为字符串为"0"）
- dstUrl: `ApiUrl.URL_CHAT_PREVIEW_PICTURE`（通过setDstUrl设置）
- chatRole: 通过`setChatRole`设置

## 四、实际调用流程

### 4.1 sendMessageToAi方法

**文件**: `app/src/main/java/com/cosinetech/imates/ui/views/ChatAiView.java`

```1271:1337:app/src/main/java/com/cosinetech/imates/ui/views/ChatAiView.java
    public void sendMessageToAi(AiChatMessageRequest mo, boolean saveDb) {
        mEditMsg.postDelayed(() -> {
            mAiChatRequest = mo;
            mAiChatRequest.setReason("start");
            mAiChatRequest.setIsWebSearch(mCheckSearchWeb.isChecked() ? "1" : "0");
            mAiChatRequest.setChatRole(mSelectedRole.getParamName());
            ChatMessage message = new ChatMessage(mAiChatRequest.getCoversation(),
                    true,
                    ChatMessage.MessageType.TEXT,
                    mCurrentSession.sessionId,
                    System.currentTimeMillis(),
                    ChatRole.CHAT_ROLE_MYSELF);
            if(saveDb) {
                mAdapterAiChatMessageList.getItems().add(new ChatDisplayItem(message, !message.isSelf, getContext()));
                mChatDb.addChatMessageDetail(message);
            }

            if(!mo.getQuestion().isEmpty()) {
                //可能是图片
                String question = mo.getQuestion().trim();
                ChatMessage msg;
                if(question.startsWith("data:image")) {
                    //截图问答的图片
                    msg = new ChatMessage("",
                            true,
                            ChatMessage.MessageType.IMAGE,
                            mCurrentSession.sessionId,
                            System.currentTimeMillis(),
                            ChatRole.CHAT_ROLE_MYSELF);
                    String localPath = AppUtils.getUserFilePath().getAbsolutePath() + "/" + msg.messageId + ".png";
                    msg.content = localPath;
                    ImageUtils.saveImageFile(question, localPath);

                } else {
                    msg = new ChatMessage(question,
                            true,
                            ChatMessage.MessageType.TEXT,
                            mCurrentSession.sessionId,
                            System.currentTimeMillis(),
                            ChatRole.CHAT_ROLE_MYSELF);
                }
                mAdapterAiChatMessageList.getItems().add(new ChatDisplayItem(msg, false, getContext()));
                mChatDb.addChatMessageDetail(msg);
            }

            //mAdapterAiChatMessageList.notifyDataSetChanged();
            mEditMsg.setText("");

            mLastReceivingMsg = new ChatMessage(
                    "",
                    false,
                    ChatMessage.MessageType.TEXT,
                    mCurrentSession.sessionId,
                    System.currentTimeMillis(),
                    mSelectedRole);
            // 注意： 从 mChatAiParam决定是否启用打字机效果显示
            mAdapterAiChatMessageList.getItems().add(new ChatDisplayItem(mLastReceivingMsg, mChatAiParam.streamDisplay, getContext()));
            //mAdapterAiChatMessageList.notifyItemInserted(mAdapterAiChatMessageList.getItems().size() - 1);

            mMsgDetailListView.smoothScrollToPosition(mAdapterAiChatMessageList.getItems().size() - 1);

            mBtnSendText.setEnabled(false);
            pollChat();

            autoDetectChatSessionName(mAiChatRequest.getCoversation().trim());
        }, 1000);
    }
```

### 4.2 pollChat方法（实际发送请求）

**文件**: `app/src/main/java/com/cosinetech/imates/ui/views/ChatAiView.java`

```1177:1188:app/src/main/java/com/cosinetech/imates/ui/views/ChatAiView.java
    private void pollChat() {
        String url = mChatAiParam.chatBotUrl;
        //优先使用Request里自带的url, 没有就用默认的
        if (mAiChatRequest.getDstUrl() != null && !mAiChatRequest.getDstUrl().isEmpty()) {
            url = mAiChatRequest.getDstUrl();
        }

        ApiGateWayService.sendChatMessage(mAiChatRequest,
                mLastReceivingMsg.messageId,
                url,
                mUserInfoViewModel.token.getValue(),
                (success, response, sessionId, msgId) -> handler.post(() -> {
```

**说明**：
- 优先使用`mAiChatRequest.getDstUrl()`，如果为空则使用`mChatAiParam.chatBotUrl`
- 对于截图场景，`dstUrl`被设置为`ApiUrl.URL_CHAT_PREVIEW_PICTURE`

### 4.3 ApiGateWayService.sendChatMessage（HTTP请求）

**文件**: `app/src/main/java/com/cosinetech/imates/coreapiservice/ApiGateWayService.java`

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

## 五、请求示例

### 5.1 完整的JSON请求体示例

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "newValue": "1",
  "coversation": "这道题怎么做？",
  "question": "data:image/jpg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...",
  "answer": "",
  "name": "",
  "reason": "start",
  "bmNo": "",
  "isWebSearch": "0",
  "role": "assistant"
}
```

### 5.2 HTTP请求示例

```
POST /blw-edu-service-alc/permission/previewPictureQA HTTP/1.1
Host: www.imates.com.cn:8222
Content-Type: application/json; charset=utf-8
Token: {用户token}

{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "newValue": "1",
  "coversation": "这道题怎么做？",
  "question": "data:image/jpg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...",
  "answer": "",
  "name": "",
  "reason": "start",
  "bmNo": "",
  "isWebSearch": "0",
  "role": "assistant"
}
```

## 六、关键点总结

1. **图片格式**：JPEG格式，压缩质量40%，转换为`data:image/jpg;base64,{base64数据}`格式
2. **接口地址**：`/permission/previewPictureQA`
3. **请求方式**：POST
4. **认证方式**：通过Header中的`Token`字段传递用户token
5. **图片数据位置**：`question`字段中，格式为Base64编码的data URL
6. **对话文本位置**：`coversation`字段中
7. **会话标识**：`sessionId`字段，用于标识本次对话会话
8. **流式响应**：接口支持流式返回，通过`reason`字段控制（"start"开始，"continue"继续）

## 七、与其他场景的区别

### 7.1 发送给AI（当前场景）
- URL: `URL_CHAT_PREVIEW_PICTURE` = `/permission/previewPictureQA`
- question字段: Base64格式的图片（data URL）
- 通过ApiGateWayService发送HTTP请求

### 7.2 发送给老师
- 通过RabbitMQ发送
- 使用StudentMessage对象
- 图片格式：纯Base64字符串（不包含data URL前缀）

