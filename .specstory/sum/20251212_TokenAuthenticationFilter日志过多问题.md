问题序号：1 TokenAuthenticationFilter日志过多问题

## 问题元信息
- **问题分类**：`后端`
- **严重程度**：`中`
- **影响范围**：`AI 对话服务、权限校验接口日志`
- **发现日期**：`2025-12-09`
- **解决状态**：`待解决`

## 问题现象
AI 首页对话请求期间，`TokenAuthenticationFilter` 几乎每 200~300ms 打印一次：

```text
INFO TokenAuthenticationFilter - =================/blw-edu-service-alc/permission/chats
```

同时 AI 侧日志把流式响应的每个 token 都逐条输出，形成大量「content":"你」「content":"发」等日志，难以阅读，也放大了 I/O 成本。

## 复现步骤
1. 打开首页 AI 对话入口，保持页面停留。
2. 观察后端日志，可见 `/permission/chats` 被高频命中。
3. 触发 AI 回复，查看 `AIApi` 日志，会发现流式响应被逐字打印。

## 用户体验
- 日志刷屏导致排查真正异常困难。
- 日志量过大占用磁盘，影响日志系统检索。
- 无法快速定位一整段 AI 回复内容。

## 相关文件/模块
- **涉及模块**：
  - `blw-edu-service-alc`：`TokenAuthenticationFilter`、`/permission/chats` 鉴权接口。
  - `AIApi`：AI 服务流式请求封装。

## 技术原因 (❌)
1. 前端为刷新会话状态对 `/permission/chats` 采用高频轮询或并发请求。
2. `TokenAuthenticationFilter` 将接口命中日志设为 INFO 级别且无采样，导致每次请求必打。
3. `AIApi` 对 SSE/流式响应的每个 data 帧都以 INFO 打印，未做缓冲与聚合。

错误示例（逐帧打印）：

```java
log.info("[AI-对话]请求响应:data: {}", chunk);
```

## 正确实现方案 (✅)
1. **降低轮询频率或改为 SSE/WebSocket**：前端对会话状态采用事件推送或延长轮询间隔。
2. **调整日志级别/开关**：将过滤器的命中日志改为 DEBUG，或加可配置白名单。
3. **聚合流式输出**：`AIApi` 在接收完整响应后再输出一条整合日志，并在 DEBUG 记录 token 级别。

示例：

```java
// ✅ 仅在 DEBUG 打逐帧日志
if (log.isDebugEnabled()) {
    log.debug("[AI-对话]流式响应片段: {}", chunk);
}
buffer.append(chunk.getContent());

// 结束后 INFO 打整段
log.info("[AI-对话]完整响应: {}", buffer);
```

## 关键代码/公式
- 过滤器日志：`TokenAuthenticationFilter#doFilterInternal`
- AI 日志：`AIApi#streamingRequest`（伪代码如上）

## 测试验证
- **测试场景**：
  - 场景1：前端默认刷新频率，确认日志量显著下降。
  - 场景2：触发 AI 回复，确认 INFO 只打印整句，DEBUG 才有逐帧。
- **验证方法**：
  - 方法1：统计一分钟内 `/permission/chats` 日志条数。
  - 方法2：检查 AI 回复是否完整且无缺词。

## 预防措施
- 将关键过滤器日志改成可配置级别，默认 DEBUG。
- 对流式日志加入采样或聚合策略。
- 定期审计日志量，设置报警。

## 相关链接/参考
- 无

## 可复用经验
- 流式接口日志需区分 INFO 和 DEBUG 粒度。
- 鉴权过滤器日志应支持采样，否则高频接口会刷屏。
