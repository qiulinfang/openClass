# KnowledgeGraphView 认证失败问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`高`
- **影响范围**：`KnowledgeGraphView 组件初始化`
- **发现日期**：`2025-12-12`
- **解决状态**：`进行中`

## 问题现象
KnowledgeGraphView 组件初始化时出现认证失败错误，控制台输出：
```
KnowledgeGraphView.vue:1246 ❌ [KnowledgeGraphView] 认证失败，终止初始化
```

## 复现步骤
1. 访问 KnowledgeGraphView 页面
2. 检查控制台输出
3. 观察页面是否正常渲染

## 相关文件/模块
- **涉及文件**：
  - `src/views/KnowledgeGraphView.vue`：KnowledgeGraphView 组件
  - `src/services/http/auth-service.ts`：认证服务
  - `src/services/business/api-service.ts`：API 服务

## 技术原因 (❌)
1. `authService.autoLogin` 方法返回 `false`
2. `apiService.loginYanban` 方法在某些情况下返回 `null`，尽管 HTTP 请求返回了 200 状态码

## 当前进展
- 已添加详细日志到 `authService.autoLogin` 和 `apiService.loginYanban`
- 确认 `localStorage` 中存在有效的 `userId` 和 `userPassword`
- 确认 HTTP 请求返回了 200 状态码和有效的 token

## 待解决问题
- 为什么 `loginYanban` 方法在收到有效响应后仍然返回 `null`？
- 响应解析逻辑是否存在问题？

## 下一步计划
1. 检查 `apiService.callYanban` 的响应处理逻辑
2. 验证 token 解析逻辑
3. 检查响应数据格式是否符合预期

## 相关链接/参考
- 相关 Issue：`[待补充]`

## 可复用经验
- 在认证流程中添加详细日志有助于快速定位问题
- 响应处理需要考虑多种数据格式和错误情况
