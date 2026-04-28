# 画布控制接口文档

## 接口列表



| GET | `/canvas/sse/{thread_id}`  建立 SSE 连接，接收画布控制指令
| POST | `/canvas/callback`  前端执行完指令后回调返回结果
| POST | `/canvas_bot`  画布助手对话接口，支持流式返回AI回复



## 1. 画布 SSE 连接端点

建立长连接，实时接收画布控制指令。每当用户打开一个画布，前端向agent发起接口请求，agent后续会保持长连接器，持续发送数据给前端。

**URL**: `GET /canvas/sse/{thread_id}`

**SSE 响应格式**:

正常指令消息：
```
data: {
    "cmd_id": "550e8400-e29b-41d4-a716-446655440000",
    "command": {
      "action": "demo_moves",
      "params": {
        "moves": [
          {"dir": "上", "steps": 2},
          {"dir": "右", "steps": 4}
        ],
        "highlight": "右上角"
      }
    }
}


```

Keepalive 注释（每30秒）：
```
: keepalive

```


**Keepalive 机制**:
- 每 30 秒无消息时，发送 `: keepalive` 注释保持连接活跃
- 防止 Nginx 等中间代理超时断开连接

---

## 2. 画布回调端点

前端执行完画布指令后调用此接口返回结果,每个结果必须对应之前agent发送的cmd_id, agent给前端发送完指令后会持续等待前端的回调，超时10秒会认为前端执行失败。

**URL**: `POST /canvas/callback`

**请求体**:
```json
{
    "cmd_id": "uuid",
    "status": "success",
    "message": "",
    "data": {}
}
```

**字段说明**:

cmd_id ：从 SSE 收到的 cmd_id 
status ：`success` 或 `error` 
message ："" 空字符串预留
data ：{} 空字典预留

**响应示例**:
```json
{
    "status": "ok"
}
```

---

## 3. 画布助手对话端点

用户和画布AI助手对话的接口，流式返回AI回复，支持工具调用（生成移动指令、发送到画布演示）。

**URL**: `POST /canvas_bot`

**请求体**:
```json
{
    "inputs": {
        "message": "用户消息",
        "name": "用户名",
        "image_url": ["图片URL"],
        "canvas_id": "画布课程ID，如果有多种画布课程则根据此ID区分，目前只有1个课程随便填写"
    },
    "config": {
        "configurable": {
            "thread_id": "1",
            "user_id": "kelvin"
        }
    }
}
```

**字段说明**:
- `inputs.message`：用户输入的对话内容
- `inputs.name`：用户名称
- `inputs.image_url`：（可选）用户上传的图片URL
- `inputs.canvas_id`：画布ID
- `config.configurable.thread_id`：会话ID，同一个会话的上下文会被保留
- `config.configurable.user_id`：用户ID


**响应格式（SSE流）**:
```
data: {
    "content": "好的，我现在给你演示这个移动路径~",
    "agent_status": "talking",
    "history_messages": []   # 最近20条历史聊天记录
}
```




