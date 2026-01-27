# 问题总结：全站选择器字典统一到 constants 管理

## 问题元信息
- **问题分类**：`[前端]`
- **严重程度**：`[中]`
- **影响范围**：`[全项目所有下拉选择器、筛选项、Tab、角色、预设等静态字典]`
- **发现日期**：`2026-01-27`
- **解决状态**：`[已解决]`

## 问题现象
项目内存在大量页面内硬编码的静态选择器字典，包括：
- 学科筛选下拉（`subjectOptions`、`subjects`）
- 资源下载页筛选项（`gradeOptions`、`versionOptions`、`statusOptions`）
- 调试面板配置项（`presetOptions`、`easingOptions`）
- 聊天面板 Tab 选项（`tabOptions`）
- AI 角色选项（`aiRoleOptions`）
- 画板缩放预设（`zoomPresetOptions`）

这些硬编码导致：
1. 同一类型选项在多个页面重复定义
2. 修改选项需要全局搜索替换，维护成本高
3. 类型不统一，容易出现不一致问题
4. 缺乏统一的命名和组织规范

## 复现步骤
1. 搜索项目内所有 `const xxxOptions = ref([...])` 或 `const xxxOptions = [...]`
2. 发现大量重复的学科、年级、版本、状态等选项定义
3. 确认这些选项都是静态不变的，适合统一管理
4. 验证各页面使用这些选项的功能逻辑

## 用户体验
- 影响点1：开发维护成本高，修改选项需要多处同步
- 影响点2：容易出现选项不一致，导致功能异常
- 影响点3：代码重复，增加项目体积
- 影响点4：缺乏统一规范，新开发人员难以快速理解

## 相关文件/模块
- **涉及文件**：
  - `src/constants/subjects.ts`：学科相关常量（已存在）
  - `src/constants/options.ts`：通用静态选项字典（新增）
  - `src/views/MyResourcesView.vue`：资源页筛选项
  - `src/views/MyHomeworkView.vue`：作业页学科选项
  - `src/components/debug/PerfectFreehandConfigDialog.vue`：调试面板配置
  - `src/components/MainChatPanel.vue`：聊天面板 Tab
  - `src/components/PdfChatPanel.vue`：PDF 聊天 Tab
  - `src/views/VideoViewerView.vue`：视频页 Tab
  - `src/components/chat/ChatInput.vue`：AI 角色选项
  - `src/components/chat/SimpleChatInput.vue`：简化 AI 角色选项
  - `src/components/drawingBoardNew.vue`：画板缩放预设
- **涉及模块**：
  - 学科管理模块：统一学科码、学科ID、映射关系
  - 筛选器模块：统一年级、版本、状态等筛选项
  - UI 组件模块：统一 Tab、角色、预设等选项

## 技术原因 (❌)
1. 原因1：缺乏统一的常量管理策略，各页面自行定义选项
2. 原因2：项目初期快速开发，未考虑长期维护成本
3. 原因3：没有建立代码规范，导致重复定义

错误代码示例：
```typescript
// MyResourcesView.vue - 硬编码
const subjectOptions = ref([
  { label: '全部', value: '' },
  { label: '数学', value: '数学' },
  { label: '语文', value: '语文' },
  // ...
])

// MyHomeworkView.vue - 重复定义
const subjects = [
  { label: '全部', value: '' },
  { label: '语文', value: '1' },
  { label: '数学', value: '2' },
  // ...
]

// ChatInput.vue - 又一次重复
const aiRoleOptions = [
  { label: '同桌', value: 'mate' },
  { label: '课代表', value: 'mentor' },
  // ...
]
```

## 正确实现方案 (✅)
1. 方案1：创建统一的常量文件结构
   - `subjects.ts`：学科相关常量和映射
   - `options.ts`：通用静态选项字典

2. 方案2：定义类型安全的选项结构
   - `SelectOption<T>`：支持 string 和 number 类型
   - 按功能域分组导出常量

3. 方案3：页面改为引用常量
   - 移除本地硬编码数组
   - 使用 `import` 引入常量
   - 保持功能逻辑不变

正确代码示例：
```typescript
// src/constants/options.ts
export type SelectOption<T extends string | number = string> = {
  label: string
  value: T
}

export const RESOURCE_SUBJECT_OPTIONS: SelectOption[] = [
  { label: '全部', value: '' },
  { label: '数学', value: '数学' },
  { label: '语文', value: '语文' },
  // ...
]

export const HOMEWORK_SUBJECT_OPTIONS: SelectOption[] = [
  { label: '全部', value: '' },
  { label: '语文', value: '1' },
  { label: '数学', value: '2' },
  // ...
]

export const AI_ROLE_OPTIONS: SelectOption[] = [
  { label: '同桌', value: 'mate' },
  { label: '课代表', value: 'mentor' },
  { label: '大神', value: 'researcher' },
]

// 页面中使用
import { RESOURCE_SUBJECT_OPTIONS } from '@/constants/options'
const subjectOptions = ref(RESOURCE_SUBJECT_OPTIONS)
```

## 关键代码/公式
- 代码片段1：统一类型定义
```typescript
export type SelectOption<T extends string | number = string> = {
  label: string
  value: T
}
```

- 代码片段2：学科常量扩展示例
```typescript
// src/constants/subjects.ts
export const HOMEWORK_SUBJECT_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '全部', value: '' },
  { label: '语文', value: '1' },
  { label: '数学', value: '2' },
  // ...
]
```

- 代码片段3：页面引用方式
```typescript
import { CHAT_TAB_OPTIONS } from '../constants/options'
const tabOptions = CHAT_TAB_OPTIONS
```

## 测试验证
- **测试场景**：
  - 场景1：资源页学科筛选功能正常
  - 场景2：作业页学科筛选功能正常
  - 场景3：调试面板配置选项正常
  - 场景4：聊天面板 Tab 切换正常
  - 场景5：AI 角色切换正常
  - 场景6：画板缩放预设正常
- **验证方法**：
  - 方法1：手动测试各页面下拉选择器功能
  - 方法2：检查网络请求参数格式未改变
  - 方法3：确认 UI 显示与之前一致

## 预防措施
- 措施1：建立代码规范，要求所有静态选项必须从 constants 导入
- 措施2：在 Code Review 中检查硬编码选项
- 措施3：定期扫描项目，发现新的硬编码选项
- 措施4：为新功能提供 constants 使用指南

## 相关链接/参考
- 相关文档：`src/constants/subjects.ts`、`src/constants/options.ts`
- 相关Issue：无
- 参考资源：Vue 3 组合式 API、TypeScript 类型系统

## 可复用经验
- 经验1：**分层管理常量**：按业务域（学科、通用选项）分层组织，便于维护
- 经验2：**类型安全优先**：使用泛型 `SelectOption<T>` 确保类型安全，支持不同值类型
- 经验3：**渐进式迁移**：先扫描识别，再逐个迁移，避免一次性大改动
- 经验4：**保持向后兼容**：迁移时不改变功能逻辑，只改变数据来源
- 经验5：**命名规范统一**：使用 `DOMAIN_XXX_OPTIONS` 格式，便于识别用途
- 经验6：**文档先行**：在 constants 文件中添加注释，说明各选项用途
- 经验7：**工具辅助**：使用全局搜索工具快速定位硬编码位置
- 经验8：**测试覆盖**：迁移后必须验证功能正常，避免回归问题
