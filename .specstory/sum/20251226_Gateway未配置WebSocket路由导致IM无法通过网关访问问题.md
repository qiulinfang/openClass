问题序号：01：Gateway未配置WebSocket路由导致IM无法通过网关访问问题

## 问题元信息
- **问题分类**：`架构`
- **严重程度**：`高`
- **影响范围**：`IM WebSocket连接、前端统一入口、测试/生产联调`
- **发现日期**：`2025-12-26`
- **解决状态**：`已解决`

## 问题现象
- 前端按“统一从网关进入”的方式连接 WebSocket 时，无法建立连接或连接后无消息。
- 只能绕过网关直连 `service-im-wss`（例如 `ws://localhost:50600/ws/im`），导致环境切换、鉴权、跨域策略难统一。

## 复现步骤
1. 步骤1：启动 `gateway`（8223）与 `service-im-wss`（50600）。
2. 步骤2：前端连接 `ws://localhost:8223/ws/im?token=...&role=user`。
3. 步骤3：观察到无法建立 WS 或 Upgrade 未被正确转发。

## 用户体验
- 无法使用“统一入口”的连接方式，导致联调成本高。
- 需要手动切换连接地址（直连 vs 网关），易出错。
- 上线后域名/路径不统一，排障困难。

## 相关文件/模块
- **涉及文件**：
  - `gateway/src/main/resources/application.yml`：Spring Cloud Gateway 路由配置
- **涉及模块**：
  - Gateway
  - IM WebSocket 服务（service-im-wss）

## 技术原因 (❌)
1. 原因1：Gateway 未配置 WebSocket 类型路由（`uri` 未使用 `ws://`/`wss://`），导致升级请求无法代理。
2. 原因2：前端使用网关路径 `/ws/im` 时，网关找不到匹配 route 或错误地当作普通 HTTP 路由处理。

（错误示例）
```yaml
# ❌ 缺少 /ws/im 路由，或用 http:// 误配
spring:
  cloud:
    gateway:
      routes:
        - id: blw-edu-service-im-wss
          uri: http://localhost:50600
          predicates:
            - Path=/ws/im/**
```

## 正确实现方案 (✅)
1. 方案1：为 IM WS 增加单独 route，并使用 `ws://` 协议。
2. 方案2：同时匹配 `/ws/im` 与 `/ws/im/**`，避免路径带尾斜杠/子路径差异导致匹配失败。
3. 方案3（可选）：后续上注册中心后切换为 `lb:ws://service-im-wss`。

（正确示例）
```yaml
# ✅ WebSocket Route
spring:
  cloud:
    gateway:
      routes:
        - id: blw-edu-service-im-wss
          uri: ws://localhost:50600
          predicates:
            - Path=/ws/im,/ws/im/**
```

## 关键代码/公式
- **关键配置片段**：
```yaml
- id: blw-edu-service-im-wss
  uri: ws://localhost:50600
  predicates:
    - Path=/ws/im,/ws/im/**
```

## 测试验证
- **测试场景**：
  - 场景1：用户端通过网关建立 WS：`ws://localhost:8223/ws/im?token=...&role=user`，应连接成功。
  - 场景2：客服端通过网关建立 WS：`ws://localhost:8223/ws/im?token=...&role=agent`，应连接成功。
  - 场景3：用户发送 `PING`，应收到 `PONG`。
- **验证方法**：
  - 方法1：网关日志无 404/路由未匹配，WS Upgrade 正常。
  - 方法2：`service-im-wss` 能收到连接建立事件与消息处理日志。

## 预防措施
- 措施1：网关新增服务时，明确区分 HTTP 与 WS 路由（协议、path、测试用例）。
- 措施2：在联调文档里固定“前端只连网关”的连接地址模板。
- 措施3：为 WS 路由加入自动化 smoke test（启动后尝试 connect+PING）。

## 相关链接/参考
- 相关文档：`d:\Project\imates-service\docs\im-ws-architecture.md`

## 可复用经验
- 经验1：WebSocket 代理必须显式使用 `ws://`/`wss://`，否则 Upgrade 无法正确转发。
- 经验2：路径匹配建议同时覆盖不带 `/**` 与带 `/**` 的情况，减少环境差异问题。
- 经验3：统一入口（网关）能显著降低前端配置复杂度与上线风险。
