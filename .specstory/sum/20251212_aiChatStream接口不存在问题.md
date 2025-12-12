问题序号：/ai/chat-stream 接口不存在问题

## 问题元信息
- **问题分类**：`[后端]`
- **严重程度**：`[中]`
- **影响范围**：`[AI 聊天入口 / ChatInput 全量用户]`
- **发现日期**：`2025-12-12`
- **解决状态**：`[待解决]`

## 问题现象
前端按照既有约定访问 `/ai/chat-stream` 期望获得 AI 流式回复，但当前服务端并无该路由，导致接口 404 或被网关拦截，真实可用的聊天接口仍然是 `POST /blw-edu-service-alc/permission/{chat|chatMath|chats|reviewExplainChatSX}`。

## 复现步骤
1. 在浏览器或前端控制台执行 `fetch('/ai/chat-stream', { method: 'POST' })`。
2. 未命中任何 Spring Controller，返回 404 或代理层报错。
3. 前端界面一直 loading，无法进入聊天流程。

## 用户体验
- 无法发起聊天，按钮点击后没有任何响应。
- Network 面板显示请求失败或重定向，日志缺少可读提示。
- 开发人员误以为后端 SSE 接口存在而调试受阻。

## 相关文件/模块
- **涉及文件**：
  - `service/service-alc/src/main/java/com/blw/edu/service/alc/controller/AlcPermissionController.java`：当前真正暴露聊天相关路由 @app/service/service-alc/src/main/java/com/blw/edu/service/alc/controller/AlcPermissionController.java#45-67。
  - `service/service-alc/src/main/java/com/blw/edu/service/alc/service/impl/AlcPermissionServiceImpl.java`：全部聊天业务逻辑实现 @app/service/service-alc/src/main/java/com/blw/edu/service/alc/service/impl/AlcPermissionServiceImpl.java#172-676。
- **涉及模块**：
  - `AlcPermissionController`：负责路由映射。
  - `AlcPermissionService`：负责与大模型交互与队列缓存。

## 技术原因 (❌)
1. 文档沿用旧接口命名 `/ai/chat-stream`，但实际代码从未实现该 Controller。
2. 真实接口挂载在 `/blw-edu-service-alc/permission/*`，网关未配置短路径别名。
3. 缺乏统一 API 说明，导致前端和后端口径不一致。

```ts
// ❌ 错误示例：访问不存在的 /ai/chat-stream
await axios.post('/ai/chat-stream', {
  reason: 'start',
  coversation: 'hi',
  sessionId: 'abc'
});
```

## 正确实现方案 (✅)
1. 明确对外暴露的聊天路由为 `/blw-edu-service-alc/permission/chats`（或 `chat/chatMath/reviewExplainChatSX`）。
2. 如果需要 `/ai/chat-stream` 别名，可在 Controller 新增映射或在网关配置重写。
3. 同步更新文档，并提供 SDK/封装函数，避免乱用路径。

```ts
// ✅ 正确示例：调用现有 chats 接口
await axios.post('/blw-edu-service-alc/permission/chats', {
  reason: 'start',
  sessionId: 'chat-session-001',
  coversation: '今天复习什么？',
  role: 'mate',
  isWebSearch: '0'
});
```

## 关键代码/公式
- 路由定义：
```java
@PostMapping("chats")
public R chats(@RequestBody @Validated MessageVO vo) {
    return alcPermissionService.chats(vo);
}
```
- 服务端逻辑入口：
```java
public R chats(MessageVO vo) {
    if ("start".equals(vo.getReason())) {
        executorChatBootService.submit(() -> chatsImpl(vo, userInfo));
        return R.ok().message("");
    }
    return pollQueue(userId);
}
```

## 测试验证
- **测试场景**：
  - 场景1：访问 `/ai/chat-stream`，确认 404 并记录日志。
  - 场景2：访问 `/blw-edu-service-alc/permission/chats`，验证可返回流式分片。
- **验证方法**：
  - 方法1：Postman/ curl 测试不同路径返回码。
  - 方法2：查看服务端日志中 `AlcPermissionController` 是否触发。

## 预防措施
- 在 API 文档中列出所有聊天路由及网关代理配置。
- 编写 Swagger/Knife4j 文档供前端检索。
- 若需别名路径，及时落地代码并回归测试。

## 相关链接/参考
- 代码：`service/service-alc/src/main/java/com/blw/edu/service/alc/controller/AlcPermissionController.java`

## 可复用经验
- 在重构或迁移接口时，务必同步更新接口说明与前端配置。
- 统一通过 Swagger 导出文档，避免口口相传造成误解。
- 重要接口应配置 API 监控或可观测日志，快速定位 404。
