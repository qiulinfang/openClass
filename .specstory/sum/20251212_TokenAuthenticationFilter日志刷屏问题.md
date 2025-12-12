问题序号：TokenAuthenticationFilter 日志刷屏问题

## 问题元信息
- **问题分类**：`[后端]`
- **严重程度**：`[中]`
- **影响范围**：`[AI 聊天接口 / 生产日志系统]`
- **发现日期**：`2025-12-12`
- **解决状态**：`[待解决]`

## 问题现象
AI 首页聊天启动后，`TokenAuthenticationFilter` 在 INFO 级别为每一笔 `/blw-edu-service-alc/permission/chats` 请求打印一条 `=================/...` 的日志。由于前端为轮询模式，短时间内会产生数十条日志，掩盖真实异常并放大日志存储压力。

## 复现步骤
1. 登录任一账号，进入首页聊天。
2. 打开后端日志，可见 `http-nio-*-exec-*` 线程每 200~500ms 打印一次 `=================/blw-edu-service-alc/permission/chats`。
3. 哪怕 AI 流式响应很快结束，日志仍继续刷屏，直至前端轮询彻底结束。

## 用户体验
- 运维难以在海量 INFO 中定位真实报错。
- 线上日志量激增，ELK 检索成本上升。
- 研发误以为服务被攻击或出现异常流量，造成排查时间浪费。

## 相关文件/模块
- **涉及文件**：
  - `service/service-alc/src/main/java/com/blw/edu/common/auth/filter/TokenAuthenticationFilter.java`：滤器实现 @app/service/service-alc/src/main/java/com/blw/edu/common/auth/filter/TokenAuthenticationFilter.java#42-71。
- **涉及模块**：
  - `common-auth` 模块：负责鉴权过滤。

## 技术原因 (❌)
1. 过滤器在 `doFilterInternal` 首行使用 `logger.info("=================" + req.getRequestURI());`，未做采样或路径过滤。
2. `/permission/chats` 请求频率极高（前端轮询+并发线程），导致日志线性增长。
3. 缺少统一的链路日志规范，导致调试日志与运行日志混淆。

```java
// ❌ 当前实现：每次请求都会打印 INFO
@Override
protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) {
    logger.info("=================" + req.getRequestURI());
    ...
}
```

## 正确实现方案 (✅)
1. 将该日志降级为 DEBUG，或仅在出现非法路径/鉴权失败时打印。
2. 引入可配置的采样机制，仅对关键路径/异常场景输出 INFO。
3. 在 `TokenAuthenticationFilter` 引入 MDC 请求 ID，与真正的访问日志区分开。

```java
// ✅ 建议实现：仅在调试开关开启时记录
if (logger.isDebugEnabled()) {
    logger.debug("Token filter pass: {}", req.getRequestURI());
}
```

## 关键代码/公式
- 过滤器核心逻辑：@app/service/service-alc/src/main/java/com/blw/edu/common/auth/filter/TokenAuthenticationFilter.java#42-71。

## 测试验证
- **测试场景**：
  - 场景1：开启 DEBUG，确认日志数量与预期一致。
  - 场景2：关闭 DEBUG，仅保留异常日志，检索接口访问趋势是否正常。
- **验证方法**：
  - 方法1：本地/测试环境发起 50 次轮询，统计日志条数。
  - 方法2：查看日志聚合平台，确认不再线性爆增。

## 预防措施
- 统一访问日志与调试日志输出规范，限制过滤器内的 INFO 输出。
- 对高频接口设置日志采样或速率限制。
- 在发布前使用压测脚本验证日志体量。

## 相关链接/参考
- `TokenAuthenticationFilter` 源码：`service/service-alc/src/main/java/com/blw/edu/common/auth/filter/TokenAuthenticationFilter.java`

## 可复用经验
- 高频接口的日志必须可控，否则对监控与排障均是噪音。
- 在过滤器这样的全局入口打印日志前，应评估 QPS 与日志后果。
- 建议使用统一的访问日志中间件，避免在业务过滤器里手写打印。
