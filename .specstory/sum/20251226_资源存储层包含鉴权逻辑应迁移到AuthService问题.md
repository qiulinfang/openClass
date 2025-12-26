问题序号：资源存储层包含鉴权逻辑应迁移到AuthService问题

## 问题元信息
- **问题分类**：`架构`
- **严重程度**：`中`
- **影响范围**：`imates-web 资源管理/IndexedDB 存储层（ResourceManager）及其调用方`
- **发现日期**：`2025-12-26`
- **解决状态**：`已解决`

## 问题现象
`imates-web/src/services/storage/resource-storage.ts` 中出现了与“研伴登录态判断/当前用户 token + userId 读取”相关的逻辑（例如直接读取 `localStorage` 的 `YANBAN_TOKEN`、`CURRENT_USER_ID`、`studentUserId` 并拼装返回）。

该类逻辑属于认证/鉴权领域，应归一到 `auth-service.ts`，否则会导致：
- 存储层与鉴权领域耦合
- 登录态判定规则分散，后续改动容易遗漏
- 不同模块可能各自实现一套“undefined/空字符串兜底”规则，产生行为不一致

## 复现步骤
1. 打开文件 `imates-web/src/services/storage/resource-storage.ts`。
2. 定位 `ResourceManager.isLoggedIn()`、`ResourceManager.getCurrentUser()`。
3. 可见其内部直接访问 `localStorage` 并处理 token/userId，有明显 auth 领域逻辑。

## 用户体验
- 存储/资源相关功能在登录状态边界下更容易出现“偶发不可用/判定不一致”。
- 账号切换、登录过期、token 刷新等场景下更容易出现行为漂移（某处判定已登录，另一处判定未登录）。
- 研发排查成本增加：问题可能散落在多个业务文件中。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/services/storage/resource-storage.ts`：原先包含 `isLoggedIn/getCurrentUser` 的登录态/用户读取逻辑
  - `imates-web/src/services/http/auth-service.ts`：认证领域的统一服务文件，适合作为权威入口
- **涉及模块**：
  - ResourceManager（资源/存储层）
  - AuthService / auth-service（认证/登录态）

## 技术原因 (❌)
1. **职责边界不清**：存储层直接承担了认证领域的“token + userId”组合与有效性判断。
2. **规则重复/分散**：登录态判定包含 `undefined` 字符串处理、`CURRENT_USER_ID` 与 `studentUserId` 的兜底，这类规则应集中管理。
3. **可维护性差**：后续若 localStorage key 或兜底逻辑变化，需要在多个文件手动同步。

错误示例（摘自改造前 `resource-storage.ts` 的核心逻辑，示意）：
```typescript
// ❌ resource-storage.ts（存储层）里不应直接出现这类 auth 逻辑
public async isLoggedIn(): Promise<boolean> {
  const token = getYanbanToken()
  const currentUserId = getCurrentUserId() || localStorage.getItem('studentUserId')
  return !!(token && currentUserId && token !== 'undefined' && currentUserId !== 'undefined')
}

public async getCurrentUser(): Promise<{ token: string; username: string } | null> {
  const token = getYanbanToken()
  const userId = getCurrentUserId() || localStorage.getItem('studentUserId')
  if (token && userId && token !== 'undefined') {
    return { token, username: userId }
  }
  return null
}
```

## 正确实现方案 (✅)
1. **在 `auth-service.ts` 提供权威、可复用的研伴登录态接口**：
   - `getCurrentYanbanUserId()`：统一 userId 来源与 sanitize
   - `isYanbanLoggedIn()`：统一登录态判定
   - `getCurrentYanbanAuth()`：统一返回 `{ token, username }`
2. **`resource-storage.ts` 仅调用 auth-service 暴露的接口**，不再直接读取/拼装 localStorage。
3. **保证行为兼容**：沿用原有 `CURRENT_USER_ID` 与 `studentUserId` 的兜底关系，并复用 `sanitize` 规则避免 `'undefined'` 干扰。

正确示例：
```typescript
// ✅ auth-service.ts
export const getCurrentYanbanUserId = (): string | null => {
  return sanitize(getCurrentUserId() || localStorage.getItem('studentUserId'))
}

export const isYanbanLoggedIn = (): boolean => {
  const token = getYanbanToken()
  const userId = getCurrentYanbanUserId()
  return !!(token && userId)
}

export const getCurrentYanbanAuth = (): { token: string; username: string } | null => {
  const token = getYanbanToken()
  const userId = getCurrentYanbanUserId()
  if (token && userId) return { token, username: userId }
  return null
}
```

```typescript
// ✅ resource-storage.ts
public async isLoggedIn(): Promise<boolean> {
  return isYanbanLoggedIn()
}

public async getCurrentUser(): Promise<{ token: string; username: string } | null> {
  return getCurrentYanbanAuth()
}
```

## 关键代码/公式
- 关键点1：`sanitize()` 统一清洗 `null/undefined/空字符串`，避免把 `'undefined'` 当成有效值。
- 关键点2：研伴 userId 统一来源：`CURRENT_USER_ID`（优先） -> `studentUserId`（兜底）。

## 测试验证
- **测试场景**：
  - 场景1：localStorage 同时存在 `YANBAN_TOKEN` + `CURRENT_USER_ID`。
    - 预期：`isYanbanLoggedIn()` 为 true，`getCurrentYanbanAuth()` 返回对应 token 与 userId。
  - 场景2：无 `CURRENT_USER_ID`，但存在 `YANBAN_TOKEN` + `studentUserId`。
    - 预期：仍判定为已登录，userId 取 `studentUserId`。
  - 场景3：token 或 userId 为 `'undefined'` 或空字符串。
    - 预期：统一被 `sanitize()` 清洗为 null，判定为未登录。
- **验证方法**：
  - 方法1：在浏览器控制台手动设置/清空相关 localStorage key，调用上述函数观察返回值。
  - 方法2：走一遍资源页/教材资源加载流程，确认不会因登录态读取变化导致异常。

## 预防措施
- 措施1：建立服务层边界约束：storage 层禁止直接读写 auth 关键字段（token/userId），统一通过 auth-service。
- 措施2：对关键领域（auth）提供“单一权威接口”，并在 code review 中检查重复实现。
- 措施3：对 localStorage key 的读取规则集中管理（例如继续补充 `getCurrentXuebanAuth` 等），避免散落。

## 相关链接/参考
- 相关文档：`imates-web/src/services/http/auth-service.ts`
- 相关文档：`imates-web/src/services/storage/resource-storage.ts`

## 可复用经验
- 经验1：领域逻辑（认证/鉴权）应集中到 service 层，避免在业务/存储层散落。
- 经验2：对“易变规则”（localStorage key、兜底逻辑、sanitize）应提供统一封装点。
- 经验3：当发现“同一规则多处重复实现”时，优先抽象为单一权威方法并替换调用方。
