# ResourceDebugPanel.vue PRD 文档

## 📋 概述

**文件路径**：`src/components/debug/ResourceDebugPanel.vue`  
**文件类型**：`Vue 组件`  
**主要职责**：`位于 src/components/debug 目录的 Vue 组件`

## 🎯 功能需求

### 1. 核心功能
- **资源统计查看**：显示教材总数、已下载数量、下载中数量、存储大小等统计信息
- **教材列表管理**：查看所有教材信息，支持按状态、学科、年级排序
- **教材详情查看**：查看单个教材的详细信息，包括学习资源包和本地文件列表
- **删除单个元素**：支持删除 `localFiles` 和 `learningPackages` 中的具体某个元素
- **滚动测试工具**：提供滚动功能的诊断、监控、测试等调试工具
- **数据导出**：导出教材数据为 JSON 文件
- **数据清理**：清理过期数据和清空所有资源

### 2. 功能边界
- **负责的功能**：
  - 资源调试面板的显示和交互
  - 教材信息的查看和管理
  - 单个元素的删除操作（localFiles 和 learningPackages）
  - 滚动测试工具的集成
- **不负责的功能**：
  - 教材的下载和更新（由资源管理服务负责）
  - 文件的预览和播放（由其他视图组件负责）

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  ```typescript
  import { resourceManager } from '@/services/resource-storage'
  import type { UserTextbookInfo } from '@/types'
  import { useQuasar } from 'quasar'
  ```
- **被依赖**：
  - `src/views/MyResourcesView.vue`：在资源管理页面中调用调试面板

### 2. 关键代码逻辑

#### 删除单个本地文件
```typescript
// 第8步：删除单个本地文件
const deleteLocalFile = async (index: number) => {
  // 第1步：确认删除
  // 第2步：删除textbook_files表中的文件数据
  // 第3步：从localFiles数组中移除该文件
  // 第4步：更新下载文件数
  // 第5步：如果所有文件都被删除，更新下载状态
  // 第6步：更新教材数据到IndexedDB
  // 第7步：刷新主列表数据
}
```

#### 删除单个学习资源包
```typescript
// 第9步：删除单个学习资源包
const deleteLearningPackage = async (index: number) => {
  // 第1步：确认删除
  // 第2步：从learningPackages数组中移除该资源包
  // 第3步：更新教材数据到IndexedDB
  // 第4步：刷新主列表数据
}
```

#### 列表项删除按钮
```vue
<!-- 学习资源包列表项 -->
<q-item-section side>
  <q-btn
    flat
    round
    dense
    size="sm"
    icon="delete"
    color="negative"
    @click.stop="deleteLearningPackage(index)"
  >
    <q-tooltip>删除此学习资源包</q-tooltip>
  </q-btn>
</q-item-section>

<!-- 本地文件列表项 -->
<q-item-section side>
  <q-btn
    flat
    round
    dense
    size="sm"
    icon="delete"
    color="negative"
    @click.stop="deleteLocalFile(index)"
  >
    <q-tooltip>删除此本地文件</q-tooltip>
  </q-btn>
</q-item-section>
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
- **删除本地文件测试**：
  - 在教材详情对话框中，点击本地文件列表项的删除按钮
  - 确认删除对话框正常显示
  - 验证文件从列表中移除
  - 验证 textbook_files 表中的数据被删除
  - 验证教材的下载文件数正确更新
  - 验证当所有文件删除后，下载状态正确更新
- **删除学习资源包测试**：
  - 在教材详情对话框中，点击学习资源包列表项的删除按钮
  - 确认删除对话框正常显示
  - 验证资源包从列表中移除
  - 验证教材数据正确更新到 IndexedDB
- **数据一致性测试**：
  - 删除操作后，主列表数据自动刷新
  - 删除操作后，详情对话框中的统计信息正确更新

## 📚 参考资源

- `[相关文档链接]`

---

**文档版本**：v1.0  
**创建日期**：2025-11-03  
**维护者**：开发团队
