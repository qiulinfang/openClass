问题序号：MainView用户名显示未使用userInfo.name问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`低`
- **影响范围**：`主页左侧功能菜单用户昵称显示`
- **发现日期**：`2025-12-26`
- **解决状态**：`已解决`

## 问题现象
主页左侧菜单头像下方用户名 `displayUserName` 显示的是 `userId`（或截断后的 userId），而不是 localStorage 中 `userInfo.name`，导致用户看到的是 ID 而不是昵称。

## 复现步骤
1. 步骤1：确保 localStorage 已写入 `userInfo`，且包含 `name` 字段。
2. 步骤2：进入主页 `MainView`。
3. 步骤3：观察左侧菜单用户名仍显示 userId，而非 `userInfo.name`。

## 用户体验
- 影响点1：用户识别度差（ID 不如昵称直观）。
- 影响点2：多个账号切换时更容易混淆。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/views/MainView.vue`：`displayUserName` 计算逻辑。
- **涉及模块**：
  - localStorage：`userInfo`

## 技术原因 (❌)
1. `displayUserName` 只读取 `getUserId()`，未解析 `localStorage.userInfo`。

错误代码示例（节选）：
```ts
// ❌ 仅显示 userId
const raw = (getUserId() || '').trim()
return raw.length > 6 ? raw.slice(-8) : raw
```

## 正确实现方案 (✅)
1. 优先从 `localStorage.getItem('userInfo')` 解析 JSON。
2. 优先使用解析出的 `name` 字段作为显示名。
3. JSON 解析失败时要兜底，避免页面报错。

正确代码示例（节选）：
```ts
const displayUserName = computed(() => {
  try {
    const rawUserInfo = localStorage.getItem('userInfo')
    if (rawUserInfo) {
      const parsed = JSON.parse(rawUserInfo)
      const name = (parsed?.name || '').toString().trim()
      if (name) return name
    }
  } catch (error) {
    console.warn('[MainView] parse userInfo from localStorage failed', error)
  }

  return '未登录'
})
```

## 关键代码/公式
- 代码片段1：`MainView.vue`：`displayUserName` computed

## 测试验证
- **测试场景**：
  - 场景1：localStorage.userInfo.name 有值：应显示 name。
  - 场景2：localStorage.userInfo 缺失/非 JSON：应不报错，显示兜底值。
- **验证方法**：
  - 方法1：手动修改 localStorage 并刷新页面观察显示。

## 预防措施
- 措施1：对 localStorage 读取的 JSON 统一封装 parse 工具，避免散落 try/catch。
- 措施2：明确“昵称显示优先级”的产品规则并写入注释/文档。

## 相关链接/参考
- 相关文档：`imates-web/src/views/MainView.vue`

## 可复用经验
- 经验1：展示层字段应优先使用“可读信息”（name），ID 仅作为兜底。
- 经验2：localStorage 读取的 JSON 必须容错解析，避免影响主 UI。
