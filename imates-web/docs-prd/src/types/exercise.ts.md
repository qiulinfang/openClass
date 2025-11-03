# exercise.ts PRD 文档

## 📋 概述

**文件路径**：`src/types/exercise.ts`  
**文件类型**：`TypeScript 服务/工具`  
**主要职责**：`位于 src/types 目录的 TypeScript 服务/工具`

## 🎯 功能需求

### 1. 核心功能
- `[功能点1]`：`待补充`
- `[功能点2]`：`待补充`

### 2. 功能边界
- `[负责的功能]`
- `[不负责的功能]`

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  ```typescript
  // 主要依赖
  ```
- **被依赖**：
  - `[文件路径]`：`[使用方式]`

### 2. 关键代码逻辑
```typescript
// exercise.ts 的核心代码
/**
 * 题目相关类型定义
 * 包含练习题目、相似题目、查找配置、API请求等所有题目相关类型
 */

import type { Subject } from './enums'

// ========== 基础题目类型 ==========

/** 练习题目接口 */
export interface ExerciseItem {
  id: string
  bmNo: string
  title: string
  question?: string // 题目内容，兼容旧版本
  answer: string
  explanation: string // aiExplanation
  analysisData: string // answerAnalysis
  subject?: string // 科目
  
  // 显示相关属性
  atUserList?: boolean
  isAiGuiding?: boolean
  userSelect?: boolean
  beginGuideToSolve?: boolean
}

/** 相似题
```

## 🔄 迁移到 React Native

### 1. 等价实现
- **当前实现**：`待补充`
- **React Native 实现**：`待补充`

### 2. 需要的第三方库
- `[库名]`：`[用途说明]`

### 3. 迁移步骤
1. `[步骤1]`
2. `[步骤2]`

### 4. 注意事项
- `[注意点1]`
- `[注意点2]`

## 📝 迁移代码示例

### Vue 实现
```typescript
// 当前 Vue 实现代码
```

### React Native 实现
```typescript
// React Native 实现代码
```

## ⚠️ 迁移风险

### 高风险项
- `[风险项]`：`[风险说明]` - `[解决方案]`

## 🧪 测试要点

### 功能测试
- `[测试场景1]`
- `[测试场景2]`

## 📚 参考资源

- `[相关文档链接]`

---

**文档版本**：v1.0  
**创建日期**：2025-11-03  
**维护者**：开发团队
