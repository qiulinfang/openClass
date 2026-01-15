# QuestionList 策略模式

## 概述

QuestionList 组件现在支持策略模式，可以通过 `type` prop 切换不同的数据源和行为。

**重构状态：✅ 已完成**

## 使用方式

### 我的习题（默认）

```vue
<QuestionList type="exercise" />
<!-- 或者不传 type，默认就是 exercise -->
<QuestionList />
```

### 我的作业

```vue
<QuestionList type="homework" />
```

## 两种模式的区别

| 功能 | 我的习题 (exercise) | 我的作业 (homework) |
|------|---------------------|---------------------|
| 数据来源 | questionStore | homeworkStore |
| 发送给 AI | ✅ | ✅ |
| 微课 | ✅ | ❌ |
| 置顶 | ✅ | ❌ |
| 收藏 | ✅ | ❌ |
| 删除 | ✅ | ✅ |
| 拍照搜题 | ✅ | ❌ |
| 空状态文案 | "暂无题目" | "暂无作业" |

## 文件结构

```
src/components/question/
├── strategies/
│   ├── index.ts                 # 导出入口 + 工厂函数
│   ├── QuestionListStrategy.ts  # 策略接口定义
│   ├── types.ts                 # 类型定义
│   ├── MyExerciseStrategy.ts    # 我的习题策略
│   └── MyHomeworkStrategy.ts    # 我的作业策略
└── README.md                    # 本文档

src/stores/
├── questionStore.ts             # 习题 Store（原有）
└── homeworkStore.ts             # 作业 Store（新增）
```

## 扩展新策略

如果需要添加新的题目列表类型（如"错题本"），只需：

1. 在 `strategies/` 下新建策略类，实现 `QuestionListStrategy` 接口
2. 在 `strategies/index.ts` 的 `createQuestionListStrategy` 工厂函数中添加新类型
3. 在 `types.ts` 的 `QuestionListType` 中添加新类型

## TODO

- [ ] 在 ApiService 中实现 `getHomeworkList` 接口（目前临时回退到习题接口）
- [ ] 根据实际业务需求调整作业策略的能力配置
