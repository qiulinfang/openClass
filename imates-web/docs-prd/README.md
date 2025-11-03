# imates-web 项目 PRD 文档

本目录包含 imates-web 项目的详细 PRD（Product Requirements Document，产品需求文档）文档。

## 📋 目录说明

本文档目录结构完全对应 imates-web 项目的源码结构，每个文件都有对应的 PRD 文档，详细说明：

1. **功能需求**：该文件实现的核心功能
2. **技术实现**：实现方式和技术选型
3. **依赖关系**：与其他模块的依赖关系
4. **迁移方案**：迁移到 React Native 的具体方案
5. **注意事项**：迁移过程中需要注意的问题

## 📂 文档结构

```
docs-prd/
├── README.md (本文档)
├── 配置文件/
│   ├── package.json.md
│   ├── vite.config.ts.md
│   ├── tsconfig.json.md
│   └── ...
├── 入口文件/
│   ├── src-main.ts.md
│   ├── src-App.vue.md
│   └── ...
├── 路由/
│   └── src-router-index.ts.md
├── 服务层/
│   ├── src-services-index.ts.md
│   ├── src-services-api-service.ts.md
│   └── ...
├── 状态管理/
│   ├── src-stores-userStore.ts.md
│   └── ...
├── 组件/
│   ├── src-components-ChatView.vue.md
│   └── ...
├── 视图/
│   ├── src-views-MainView.vue.md
│   └── ...
├── 工具函数/
│   └── src-utils-*.md
├── 类型定义/
│   └── src-types-*.md
└── 脚本/
    └── scripts-*.md
```

## 🎯 文档用途

### 1. 项目理解
- 帮助团队成员快速理解每个文件的功能和职责
- 明确模块间的依赖关系
- 了解技术选型和实现细节

### 2. 迁移规划
- 为 React Native 迁移提供详细的参考
- 识别需要特殊处理的部分
- 规划迁移顺序和优先级

### 3. 开发参考
- 新成员入职的参考资料
- 代码重构的技术文档
- 功能扩展的设计依据

## 📝 文档编写规范

每个 PRD 文档应包含以下章节：

### 1. 概述
- 文件路径和名称
- 主要功能和职责
- 在项目中的地位

### 2. 功能需求
- 核心功能点
- 功能边界
- 输入输出

### 3. 技术实现
- 使用的技术栈
- 关键代码逻辑
- 依赖关系

### 4. 迁移到 React Native
- React Native 等价实现
- 需要的第三方库
- 迁移步骤
- 注意事项

### 5. 测试要点
- 需要测试的功能点
- 测试场景

### 6. 参考资源
- 相关文档链接
- 第三方库文档

## 🚀 快速开始

### 1. 生成 PRD 文档

可以使用提供的脚本自动生成 PRD 文档框架：

```bash
cd imates-web/docs-prd
node generate-prd.js
```

脚本会为 `src/` 和 `scripts/` 目录下的所有文件生成 PRD 文档框架。

**注意**：生成的 PRD 文档都是框架，需要手动补充详细内容。

### 2. 阅读 PRD 文档

1. **查看整体架构**：先阅读 [项目总体架构.md](./项目总体架构.md)
2. **了解迁移方案**：阅读 [React-Native-迁移方案.md](./React-Native-迁移方案.md)
3. **查看依赖对照**：阅读 [依赖库迁移对照表.md](./依赖库迁移对照表.md)
4. **按模块阅读**：根据自己的需求，从对应目录查看相关模块的 PRD
5. **迁移参考**：查看每个文件的"迁移到 React Native"章节

### 3. 编写新的 PRD

参考 [PRD-模板.md](./PRD-模板.md) 编写新的 PRD 文档。

## 📚 相关文档

- [React Native 迁移方案](./React-Native-迁移方案.md)
- [项目总体架构](./项目总体架构.md)
- [依赖库迁移对照表](./依赖库迁移对照表.md)

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**维护者**：开发团队

