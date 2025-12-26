问题序号：imates-web测试体系搭建方案

## 问题元信息
- **问题分类**：`架构`
- **严重程度**：`中`
- **影响范围**：`imates-web（Vue3/Vite/TS）开发质量保障、回归效率、线上稳定性`
- **发现日期**：`2025-12-26`
- **解决状态**：`进行中`

## 问题现象
imates-web 当前缺少系统化测试体系与质量门禁：
- 缺少明确的测试分层（单元/组件/集成/E2E）与工具链选型
- 缺少 Mock/fixture/契约等可复用测试基建
- 缺少 CI 质量门禁（typecheck/lint/coverage/e2e 冒烟）与报告归档
- 业务迭代后回归依赖人工点测，效率低且容易漏测

## 复现步骤
1. 步骤1：对 imates-web 任意核心页面或 store 做功能改动（例如作业列表/练习作答/解析页）
2. 步骤2：尝试通过自动化测试验证改动未引入回归
3. 步骤3：发现缺少可直接运行的测试框架、Mock 基建和 CI 门禁，无法自动化验证

## 用户体验
- 回归成本高：每次发版需要大量人工验证
- 回归不稳定：容易遗漏边界场景（错误态/空态/超时/弱网）
- 问题定位慢：缺少覆盖率与可复现的 fixture，难以快速定位回归来源

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/views/MainView.vue`：核心页面之一，适合作为组件/集成测试首批落点
  - `imates-web/src/views/ExerciseSolveView.vue`：练习作答闭环页面，适合作为集成/E2E 冒烟链路
  - `imates-web/src/views/MyHomeworkView.vue`：作业列表与入口页面，适合作为集成/E2E 冒烟链路
  - `imates-web/src/views/HomeworkAnswerView.vue`：答案/解析页，适合作为组件/集成测试落点
  - `imates-web/src/stores/utils/requestValidator.ts`：纯函数/规则校验模块，适合作为单元测试首批落点
  - `imates-web/src/stores/aiTextbookChatStore.ts`：Pinia store，适合作为 store 单测与集成测试落点
- **涉及模块**：
  - 请求层/接口调用：需要统一 Mock 策略（建议 MSW）
  - Pinia 状态管理：需要 store 单测与 view+store 集成测试
  - 路由与页面生命周期：需要集成/E2E 关注初始化链路
  - WebView/原生通信（如存在）：需要桥接层 mock 策略

## 技术原因 (❌)
1. 原因1：缺少统一测试分层与目标，导致测试编写无明确边界与优先级
2. 原因2：缺少网络 Mock 与 fixture 管理机制，测试难以稳定复现，或只能大量手写 mock
3. 原因3：缺少 CI 质量门禁与报告，无法形成“可持续”的自动化回归体系

❌ 错误示例（仅靠人工点测，无自动化兜底）：
```text
- 修改页面/接口逻辑后：只在本地手动打开页面验证
- 未覆盖：错误码/超时/空数据/弱网/权限变化/缓存状态等
- 未形成：可复用测试数据、可回放响应、覆盖率基线
```

## 正确实现方案 (✅)
1. 方案1：采用 Testing Trophy 思路建立分层
- 静态门禁（lint/typecheck）优先落地
- 单元/组件/集成测试为主（性价比最高）
- 少量 E2E 作为关键主链路冒烟兜底

2. 方案2：工具链选型（与 Vite/Vue3 生态适配）
- 单元/组件/集成：`Vitest` + `@vue/test-utils`（可选 `@testing-library/vue`）
- 覆盖率：`@vitest/coverage-v8`
- 网络 Mock：`MSW`（node 环境拦截，组件/集成测试复用）
- E2E：`Playwright`（少量冒烟、并行、trace）

3. 方案3：建立可复用测试基建与约定
- 统一 fixture：`tests/fixtures/**`
- 统一 MSW handlers：`tests/msw/handlers.ts`
- 测试目录规范：`src/**/__tests__/*.test.ts` 或 `tests/unit|integration/**`
- WebView/原生通信：抽象 bridge 适配层并在测试注入 stub（如存在）

✅ 正确示例（分层与脚本约定，示例）：
```json
{
  "scripts": {
    "lint": "eslint .",
    "typecheck": "vue-tsc --noEmit",
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  }
}
```

## 关键代码/公式
- 关键点1：网络 Mock 建议使用 MSW（伪代码示例）
```ts
// handlers.ts（示意）
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('/api/homework/list', () => {
    return HttpResponse.json({ code: 0, data: [] })
  })
]
```

- 关键点2：Pinia store 测试关注 action 对 state 的影响（伪代码示例）
```ts
// store.test.ts（示意）
import { createPinia, setActivePinia } from 'pinia'

beforeEach(() => {
  setActivePinia(createPinia())
})

// 断言：action 调用后 state/getter 的变化
```

## 测试验证
- **测试场景**：
  - 场景1：`requestValidator.ts` 输入边界（缺字段/类型错误/合法输入）应得到确定输出
  - 场景2：作业列表页初始化请求：成功/空数据/错误码/超时，UI 应展示对应状态
  - 场景3：练习作答主链路冒烟：进入 -> 作答 -> 提交（E2E 兜底）
- **验证方法**：
  - 方法1：本地执行 `lint + typecheck + test:coverage` 全绿
  - 方法2：CI 上启用门禁，PR 必须通过并产出覆盖率与 E2E trace（失败保留）

## 预防措施
- 措施1：把 `lint/typecheck/test` 纳入 CI 必选门禁
- 措施2：按目录/模块逐步设定覆盖率基线（先关键目录，后全局提升）
- 措施3：每次修复线上/回归 bug 必须补对应测试（回归测试用例沉淀）

## 相关链接/参考
- 相关文档：`.specstory/sum/接口文档-imates-web.md`
- 参考资源：Vitest / Vue Test Utils / Testing Trophy / MSW / Playwright 官方文档

## 可复用经验
- 经验1：优先建设“快且硬”的质量门禁（typecheck/lint），立刻降低低级错误成本
- 经验2：以集成测试为主、E2E 为辅，避免维护成本失控
- 经验3：统一 Mock 与 fixture 管理，比堆测试数量更能提升长期可维护性
