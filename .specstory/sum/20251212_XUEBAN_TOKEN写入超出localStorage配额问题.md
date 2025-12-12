问题序号：XUEBAN_TOKEN写入超出localStorage配额问题

## 问题元信息
- **问题分类**：前端
- **严重程度**：中
- **影响范围**：Android WebView/Web 调试环境登录学班账号
- **发现日期**：2025-12-12
- **解决状态**：待解决

## 问题现象
点击“登录”进行学班登录时，浏览器抛出 `Failed to execute 'setItem' on 'Storage': Setting the value of 'XUEBAN_TOKEN' exceeded the quota`，导致登录流程中断。

## 复现步骤
1. 在 Web/WebView 中打开登录页。
2. 输入账号密码点击“登录”。
3. 登录请求成功后，本地缓存凭证时抛出 quota exceeded 错误。

## 用户体验
- 登录按钮报错，用户无法完成登录。
- 页面没有明显的提示告诉用户如何处理缓存。
- 登录流程被迫终止，阻塞了后续操作。

## 相关文件/模块
- **涉及文件**：
  - `src/services/api-service.ts`：`loginXueban` 中直接调用 `localStorage.setItem('XUEBAN_TOKEN', token)`。
  - `src/services/auth-storage-service.ts`：`setXuebanToken` 封装了清空/写入逻辑。
- **涉及模块**：
  - 学班登录 API 封装。
  - 本地认证缓存模块。

## 技术原因 (❌)
1. `localStorage` 总容量已被其它键占满，写入任意新值都会触发配额异常。
2. `loginXueban` 在写 token 前没有检测或清理冗余缓存。
3. 页面没有捕获 `QuotaExceededError`，也没有给出 fallback 处理。

```typescript
// ❌ 直接写入，当 localStorage 被撑爆时抛错
localStorage.setItem('XUEBAN_TOKEN', token)
```

## 正确实现方案 (✅)
1. 写 token 前检测配额：捕获 `QuotaExceededError`，提示或自动释放空间。
2. 在 `auth-storage-service.ts` 中实现统一的“清理后重试”逻辑，例如删除大体积的缓存键后再次写入。
3. 对登录流程增加兜底提示，让用户可以清理缓存后重试。

```typescript
try {
  localStorage.setItem('XUEBAN_TOKEN', token)
} catch (error) {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    cleanupLargeKeys()
    localStorage.setItem('XUEBAN_TOKEN', token)
  } else {
    throw error
  }
}
```

## 关键代码/公式
- `src/services/api-service.ts` `loginXueban`
- `src/services/auth-storage-service.ts` `setXuebanToken`

## 测试验证
- **测试场景**：
  - 场景1：模拟 localStorage 填满后登录，应自动清理并写入成功。
  - 场景2：正常容量环境登录，不应触发清理逻辑。
- **验证方法**：
  - 观察浏览器控制台无 `QuotaExceededError`。
  - 登录成功后重新刷新页面，确认 token 仍可读取。

## 预防措施
- 定期清理大型缓存字段或迁移到 IndexedDB。
- 增加本地缓存容量使用监控日志。
- 在构建调试工具时提供“一键清缓存”按钮。

## 相关链接/参考
- 无

## 可复用经验
- 对关键 localStorage 写入操作应统一封装并处理配额异常。
- 登录类流程需保证兜底逻辑，避免因缓存问题彻底失败。
