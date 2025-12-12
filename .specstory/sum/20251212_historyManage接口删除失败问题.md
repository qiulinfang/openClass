问题序号：history_manage 接口删除失败问题

## 问题元信息
- **问题分类**：`[后端]`
- **严重程度**：`[中]`
- **影响范围**：`[会话记忆清理功能 / 运营人员]`
- **发现日期**：`2025-12-12`
- **解决状态**：`[进行中]`

## 问题现象
调用 `POST /history_manage` 接口执行 `delete_messages` 指令时，服务端返回 404，提示：`删除消息失败: Message with ID 'string' not found in thread 'string'`，导致无法清理指定线程的历史消息。

## 复现步骤
1. 使用默认示例参数（`thread_id":"string"`, `message_id":"string"`）调用 `POST /history_manage`。
2. 服务端根据提供的 `thread_id`/`message_id` 查找对应记录。
3. 因占位符 ID 在系统中不存在，接口返回业务 404，并附带上述错误信息。

## 用户体验
- 运营或测试人员无法删除历史对话记录。
- 接口调试阶段反复收到 404，增加排查成本。
- 任务流程被阻断，影响记忆管理相关功能上线或验收。

## 相关文件/模块
- **涉及文件**：
  - `API: /history_manage`：对话记忆管理接口
- **涉及模块**：
  - 记忆管理服务：负责线程与消息的删除逻辑
  - 调试/运营工具：触发该接口的前端或 Postman/Swagger 工具

## 技术原因 (❌)
1. 请求体沿用了 Swagger 自动生成的占位符 `string` 作为线程和消息 ID。
2. 服务端严格校验 `thread_id` 与 `message_id`，在存储中查不到即返回 404。
3. 客户端未在发送请求前校验 ID 是否真实有效。

```bash
# 错误示例
curl -X POST "https://<host>/history_manage" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "delete_messages",
    "thread_id": "string",
    "message_id": "string",
    "agent_name": "chatbot"
  }'
```

## 正确实现方案 (✅)
1. 在调用前先从会话系统获取真实的 `thread_id` 与 `message_id`。
2. 根据操作类型补齐必填字段：`delete_messages` 需 `message_id`，`delete_thread` 仅需 `thread_id`。
3. 校验 `agent_name` 仅在 `chatbot` / `solvingbot` 范围内，并与线程所属智能体匹配。

```bash
# 正确示例
db_thread_id="thread_123456"
db_message_id="msg_7890"

curl -X POST "https://<host>/history_manage" \
  -H "Content-Type: application/json" \
  -d "{
    \"command\": \"delete_messages\",
    \"thread_id\": \"${db_thread_id}\",
    \"message_id\": \"${db_message_id}\",
    \"agent_name\": \"chatbot\"
  }"
```

## 关键代码/公式
- 代码片段1：正确请求体结构
```json
{
  "command": "delete_messages",
  "thread_id": "thread_123456",
  "message_id": "msg_7890",
  "agent_name": "chatbot"
}
```
- 代码片段2：删除整个线程的请求体
```json
{
  "command": "delete_thread",
  "thread_id": "thread_123456",
  "agent_name": "solvingbot"
}
```

## 测试验证
- **测试场景**：
  - 场景1：使用真实 `thread_id` + `message_id` 执行 `delete_messages`，期望返回 200 且后续查询无对应消息。
  - 场景2：使用 `delete_thread` 删除整个线程，期望接口 200 且线程记录被物理/逻辑删除。
- **验证方法**：
  - 方法1：调用查询接口确认消息或线程不存在。
  - 方法2：查看服务端日志，确认删除操作执行成功且无异常告警。

## 预防措施
- 措施1：在调试工具中预先填充真实 ID，并提示禁止使用占位符。
- 措施2：客户端加入参数校验，缺失或疑似占位符时直接拦截。
- 措施3：给 Swagger 示例增加注释，强调需要替换为真实业务数据。

## 相关链接/参考
- 相关文档：`docs/server-directories-overview.md`（说明服务接口部署信息）

## 可复用经验
- 经验1：Swagger/接口文档中的占位符必须替换为真实值再调用。
- 经验2：接口调试前应先梳理实体 ID 的获取路径，避免凭空构造。
- 经验3：业务 404 与路由 404 区分开，有助于快速确定问题在业务层。
