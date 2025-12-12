问题序号：permissionChats接口基础路径说明

## 问题元信息
- **问题分类**：`[前端]`
- **严重程度**：`[低]`
- **影响范围**：`[AI聊天接口请求配置]`
- **发现日期**：`2025-12-12`
- **解决状态**：`[已记录]`

## 问题背景
需要明确 WebView 环境下调用 `/permission/chats` 时的完整 URL，以确保打到测试环境真实地址，消除“file:// 中相对路径映射”疑惑。

## 结论摘要
- `http-client` 将 `'/permission'` 相对路径映射到 `apiBaseUrl`。
- 在 `AppEnvType.INTERNAL_TEST` 下，`apiBaseUrl = http://www.imates.com.cn:9222/blw-edu-service-alc`。
- 因此 `/permission/chats` 实际访问：`http://www.imates.com.cn:9222/blw-edu-service-alc/permission/chats`，无论页面是否运行在 `file://` WebView。

## 关键依据
- `http-client.ts` 中 `buildFullUrl` / `routeMap` 逻辑，优先使用 `apiBaseUrl` 映射。
- `env-config` 的 INTERNAL_TEST 配置指定 9222 端口服务。

## 建议
- 在接口文档中显式列出各环境的 `apiBaseUrl`。
- 调试排查时使用 Network 面板确认最终 URL，避免误判为本地 `file://` 请求。
