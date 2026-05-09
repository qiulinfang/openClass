# SSE-to-Polling Proxy Server

## 解决的问题
Android WebView 中的 `EventSource` (SSE) 连接极易因为系统拦截、网络切换或长时间闲置而断开。本后端服务作为一个“代理缓存层”，维持与 AI 端的长连接，并为前端提供稳定的 HTTP 短连接轮询接口。

## 运行要求
- Node.js 16+
- Redis (默认端口 6379)

## 快速开始
1. 进入目录：`cd imates-web/src/views/SDSF/sse-server`
2. 安装依赖：`npm install`
3. 启动服务：`npm start`

## 前端对接方式
1. **修改 API 基地址**：将前端请求的地址指向此服务（例如 `http://your-server-ip:3001`）。
2. **发起对话**：调用 `POST /api/chat`。
3. **开始轮询**：前端收到成功响应后，每隔 1-1.5 秒调用一次 `GET /api/poll?thread_id=xxx` 获取增量数据。

## 并发性能设计
- **Redis 队列**：每个 `thread_id` 拥有独立的 Redis List 缓存，支持多客户端并发。
- **内存安全**：为每个缓存设置了 30 分钟过期时间，防止异常断开导致的内存泄漏。
- **原子操作**：轮询时使用 Redis `MULTI` 命令，确保“读取”和“清空”在一次事务中完成，防止并发轮询导致的数据丢失。
