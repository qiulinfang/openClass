## 任务背景
- 模块：`screenshotSessions` 本地会话存储
- 需求：将本地存储键由全局 `screenshot_sessions` 调整为按用户区分的 `{userid}_ai-textbook-sessions`

## 现状梳理
- `STORAGE_KEY` 常量固定为 `screenshot_sessions`
- 所有增删改查均直接操作该键，导致不同用户共享同一份会话列表
- 相关使用点：`PdfViewerView` 通过 `getScreenshotSessions()` 加载列表
- 用户工具：`getStorageKeyWithUserId(key)` 可生成带用户前缀的键

## 设计方案
1. 在 `screenshotSessions.ts` 中改用 `getStorageKeyWithUserId('ai-textbook-sessions')` 生成键
2. 所有读写 `localStorage` 的位置统一调用该动态键
3. 保持 API 形态不变，向调用方透明

## 兼容策略
- 按需求不再处理旧键 `screenshot_sessions`
- 依赖 `getStorageKeyWithUserId` 默认回退至 `default_ai-textbook-sessions`

## 测试建议
- 切换到无用户登录环境，确认默认键行为
- 模拟不同用户（写入不同 `CURRENT_USER_KEY`）确保数据隔离

## 风险与关注点
- `getStorageKeyWithUserId` 依赖 localStorage 可用性，需要保持与当前实现一致

