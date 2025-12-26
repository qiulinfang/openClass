问题2：Vite开发代理permission请求ECONNRESET问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`高`
- **影响范围**：`imates-web 开发环境调用 /permission/* 接口（如 imgMath/exercises/chats）`
- **发现日期**：`2025-12-18`
- **解决状态**：`待解决`

## 问题现象
- Vite 开发服务器访问接口时出现代理错误：
  - `http proxy error: /permission/exercises Error: read ECONNRESET`
  - `POST http://localhost:5173/permission/imgMath net::ERR_ABORTED 500 (Internal Server Error)`
- 表现为：前端请求在 `localhost:5173` 侧变成 500，控制台/终端看到 `ECONNRESET`。

## 复现步骤
1. 启动 `imates-web` Vite dev server
2. 在页面触发调用 `/permission/exercises` 或 `/permission/imgMath` 等接口
3. 观察控制台/终端日志
4. 结果：Vite 代理报 `ECONNRESET`，浏览器侧请求 500

## 用户体验
- AI/拍照搜题/题目相关接口在开发环境不可用
- 影响本地调试效率，且错误信息容易被误解为“前端代码 bug”

## 相关文件/模块
- **涉及文件**：
  - `imates-web/vite.config.ts`：devServer proxy 配置（`/permission`、`/ai` 等）
  - `imates-web/src/services/http/http-client.ts`：构建请求 URL、file 环境路由映射、token header
  - `imates-web/src/config/env-config.ts`：环境 baseUrl/resourceBaseUrl/yanbanBaseUrl
- **涉及模块**：
  - Vite devServer 代理（http-proxy）
  - 学伴服务后端网关（`EDU_SERVICE_BASE`）

## 技术原因 (❌)
1. **后端 target 可达性/稳定性不确定**：
   - `/permission` proxy target 指向 `http://www.imates.com.cn:9222/blw-edu-service-alc`，若该服务在当前网络不可达/被防火墙或网关重置，会直接触发 `ECONNRESET`
2. **路径前缀可能不匹配**：
   - Vite 会把 `/permission/imgMath` 拼到 target 之后：
     - `http://www.imates.com.cn:9222/blw-edu-service-alc/permission/imgMath`
   - 若后端实际期望的网关路径不是这种拼法，则可能 404/500，甚至被网关直接 reset
3. **缺少超时/上传相关配置**：
   - 大图片/慢上传时，代理链路可能提前断开，表现为 `ECONNRESET`
4. **排查信息可能被误导**：
   - `http-client.ts` 设置 token 使用 `Token` header（大写），而 `vite.config.ts` 里日志读取 `req.headers['token']`（小写）；Node 侧 header 会被标准化，导致“是否携带 token”的日志判断不可靠

错误示例（现象层面）：
```text
http proxy error: /permission/exercises Error: read ECONNRESET
POST http://localhost:5173/permission/imgMath 500 (Internal Server Error)
```

## 正确实现方案 (✅)
1. **先验证后端真实可用的基础地址与接口形态**：
   - 明确 `/permission/*` 在后端应落到哪个 host/port/path（9222/9099/50013 等），必要时增加 `rewrite`
2. **为 `/permission` 代理增加超时配置**（适配上传/慢请求）：
   - `timeout`、`proxyTimeout` 等
3. **完善可观测性**：
   - 代理侧输出最终 target URL、状态码、响应体片段
   - 修正 token 检测：读取 `req.headers['token'] || req.headers['Token']`（仅用于日志）
4. **开发环境兜底策略**：
   - 若后端只在内网/特定网络可达，提供切换到可达后端（或直连 mock）的方式，避免 dev server 代理成为单点阻塞

示例（增加超时，伪代码）：
```ts
'/permission': {
  target: EDU_SERVICE_BASE,
  changeOrigin: true,
  secure: false,
  timeout: 60_000,
  proxyTimeout: 60_000,
}
```

## 关键代码/公式
- Vite proxy 关键片段：
```ts
'/permission': {
  target: EDU_SERVICE_BASE,
  changeOrigin: true,
  secure: false,
}
```

- http-client 路由映射（file 环境）与 token header：
```ts
if (url.startsWith('/permission')) {
  selectedToken = localStorage.getItem('XUEBAN_TOKEN')
  authConfig['Token'] = selectedToken
}
```

## 测试验证
- **测试场景**：
  - 场景1：GET `/permission/exercises`
    - 预期：返回 200 或明确业务错误，不再出现 `ECONNRESET`
  - 场景2：POST `/permission/imgMath`（上传图片/大 body）
    - 预期：在合理超时内完成；失败应返回后端可读错误而非代理 reset
- **验证方法**：
  - 方法1：在 Vite 终端查看 proxy 日志（proxyReq/proxyRes/error）确认请求落到正确 target
  - 方法2：直接用 curl/postman 访问 target 的最终 URL，验证服务可达

## 预防措施
- 将各环境的后端 baseUrl 统一收敛（避免 Vite 与运行时配置出现“两个真相”）
- 为大上传接口制定统一超时策略
- 建立最小可用的本地 mock/测试后端，降低对远端环境依赖

## 相关链接/参考
- 相关文件：`imates-web/vite.config.ts`、`imates-web/src/services/http/http-client.ts`

## 可复用经验
- `ECONNRESET` 多数不是前端业务代码错误，而是链路/后端主动断开
- 代理 target + path 拼接方式一定要与后端网关路由对齐
- 排查代理问题应先验证“target 可达 + 最终 URL 正确 + 超时策略合理”
