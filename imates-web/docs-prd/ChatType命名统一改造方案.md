# ChatType 命名统一改造方案

## 一、问题分析

### 现状
当前代码中 `ChatType` 的定义如下：
```typescript
type ChatType = 'ai-general' | 'ai-exercise' | 'ai-textbook' | 'teacher' | 'teacher-exercise'
```

**问题：** 命名不统一
- AI 对话类型使用 `ai-*` 前缀：`'ai-general'`, `'ai-exercise'`, `'ai-textbook'`
- 教师对话类型出现 `'teacher'` 和 `'teacher-exercise'` 两种命名格式
- 为了保持一致性，应该将 `'teacher'` 改为 `'teacher-general'`

### 影响范围

通过代码搜索，`'teacher'` 在以下文件中被引用：

| 文件 | 用途 | 修改量 |
|------|------|--------|
| `src/components/ChatView.vue` | 主聊天组件，最多的使用 | ~12处 |
| `src/components/chat/ChatInput.vue` | 输入框逻辑 | 2处 |
| `src/components/chat/ChatMessage.vue` | 消息展示 | 1处 |
| `src/components/TeacherChatDialog.vue` | 教师对话框 | 1处 |
| `src/components/UnifiedChatDialog.vue` | 统一对话框 | 2处 |
| `src/components/QuestionList.vue` | 题目列表 | 1处 |
| `src/views/MainView.vue` | 主视图 | 1处 |
| `src/views/MyFavoritesView.vue` | 收藏页面 | 3处 |
| `src/components/chat/strategies/ChatStrategyFactory.ts` | 策略工厂 | 1处（类型定义+case分支） |

**总计：** ~24处需要修改

---

## 二、改造方案设计

### 2.1 核心改动

**1. 类型定义更新** - 在 `ChatStrategyFactory.ts`
```typescript
// 修改前
export type ChatType = 'ai-general' | 'ai-exercise' | 'ai-textbook' | 'teacher' | 'teacher-exercise'

// 修改后
export type ChatType = 'ai-general' | 'ai-exercise' | 'ai-textbook' | 'teacher-general' | 'teacher-exercise'
```

**2. Props 定义更新** - 在 `ChatView.vue`
```typescript
// 修改前
type: 'ai-general' | 'ai-exercise' | 'ai-textbook' | 'teacher' | 'teacher-exercise'

// 修改后
type: 'ai-general' | 'ai-exercise' | 'ai-textbook' | 'teacher-general' | 'teacher-exercise'
```

**3. 条件判断全局替换**
- `props.type === 'teacher'` → `props.type === 'teacher-general'`
- `type === 'teacher'` → `type === 'teacher-general'`
- `chatType.type === 'teacher'` → `chatType.type === 'teacher-general'`

**4. 字符串值替换**
- `type="teacher"` → `type="teacher-general"`

**5. 策略工厂分支更新** - 在 `ChatStrategyFactory.ts`
```typescript
// 修改前
case 'teacher':
  return new TeacherStrategy(options.session)

// 修改后
case 'teacher-general':
  return new TeacherStrategy(options.session)
```

### 2.2 改造步骤

**步骤1：** 更新 `ChatStrategyFactory.ts` 中的类型定义和工厂方法
- 更新 `ChatType` 类型定义
- 更新 switch 分支

**步骤2：** 更新 `ChatView.vue` 中的 props 定义
- 更新 defineProps 中的类型

**步骤3：** 使用全局查找替换更新所有条件判断
- 替换所有 `=== 'teacher'` 为 `=== 'teacher-general'`
- 替换所有 `!== 'teacher'` 为 `!== 'teacher-general'`

**步骤4：** 更新 props 传值和模板中的字符串
- `type="teacher"` → `type="teacher-general"`

**步骤5：** 更新特殊逻辑和三元表达式
- `type === 'teacher'` 的其他形式

**步骤6：** 验证和测试

### 2.3 改造的优势

✅ **命名统一性**
- 所有类型都采用统一的格式：`[分类]-[场景]`
- AI对话：`ai-*`, 教师对话：`teacher-*`

✅ **代码一致性**
- 便于后续类型推断和代码维护
- 减少命名误解

✅ **易于扩展**
- 未来增加新的聊天类型时遵循统一的规则

---

## 三、技术细节

### 3.1 受影响的关键逻辑

#### ChatView.vue 中的策略模式
```typescript
watch(() => [props.type, props.sessionId] as const, ([newType, sessionId]) => {
  chatStrategy.value = ChatStrategyFactory.create(newType, {
    subject: currentSubject.value,
    session: teacherSession.value
  })
})
```
这里的 `newType` 会自动包含 `'teacher-general'`

#### 条件判断示例
```typescript
// 修改前
if (props.type === 'teacher') {
  // 教师对话特殊逻辑
}

// 修改后
if (props.type === 'teacher-general') {
  // 教师对话特殊逻辑
}
```

### 3.2 无需修改的地方

- 存储键名（如 `teacher-general-{sessionId}`）不变，只是代码中的类型名称变化
- Store 的命名（`teacherGeneralChatStore`）不变
- 类名（`TeacherStrategy`）不变
- API 调用逻辑不变

---

## 四、实施清单

- [ ] 更新 `src/components/chat/strategies/ChatStrategyFactory.ts`
  - [ ] 更新 `ChatType` 类型定义
  - [ ] 更新 `case 'teacher'` 为 `case 'teacher-general'`

- [ ] 更新 `src/components/ChatView.vue`
  - [ ] 更新 props 类型定义
  - [ ] 替换所有 `=== 'teacher'` 为 `=== 'teacher-general'`
  - [ ] 替换所有 `!== 'teacher'` 为 `!== 'teacher-general'`

- [ ] 更新 `src/components/chat/ChatInput.vue`
  - [ ] 替换 `=== 'teacher'` 为 `=== 'teacher-general'`
  - [ ] 替换 `!== 'teacher'` 为 `!== 'teacher-general'`

- [ ] 更新 `src/components/chat/ChatMessage.vue`
  - [ ] 替换 `=== 'teacher'` 为 `=== 'teacher-general'`

- [ ] 更新 `src/components/TeacherChatDialog.vue`
  - [ ] 替换 `type="teacher"` 为 `type="teacher-general"`

- [ ] 更新 `src/components/UnifiedChatDialog.vue`
  - [ ] 替换 `type="teacher"` 为 `type="teacher-general"`
  - [ ] 更新三元表达式中的 `'teacher'` 判断

- [ ] 更新 `src/components/QuestionList.vue`
  - [ ] 替换 `=== 'teacher'` 为 `=== 'teacher-general'`

- [ ] 更新 `src/views/MainView.vue`
  - [ ] 替换 `=== 'teacher'` 为 `=== 'teacher-general'`

- [ ] 更新 `src/views/MyFavoritesView.vue`
  - [ ] 替换所有 `=== 'teacher'` 为 `=== 'teacher-general'`

- [ ] 验证类型检查（`npm run type-check`）通过

---

## 五、迁移验证

修改完成后的验证步骤：

1. **类型检查**
   ```bash
   npm run type-check
   ```
   确保没有 TypeScript 类型错误

2. **代码构建**
   ```bash
   npm run build
   ```
   确保构建成功

3. **功能测试**
   - 在通用对话页面测试老师对话功能
   - 在题目页面测试题目老师对话功能
   - 测试消息转发功能

---

## 总结

这是一个纯粹的**命名统一改造**，涉及 ~24 处代码修改，都是直接的字符串替换和类型定义更新。改造完成后，代码的一致性和可维护性会显著提高。

**预计工作量：** 低（主要是机械性替换）
**风险等级：** 低（只涉及字符串和类型名称）
**测试范围：** 中等（需验证所有涉及教师对话的功能）
