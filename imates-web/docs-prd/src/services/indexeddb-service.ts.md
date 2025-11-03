# indexeddb-service.ts PRD 文档

## 📋 概述

**文件路径**：`src/services/indexeddb-service.ts`  
**文件类型**：`IndexedDB 数据库服务`  
**主要职责**：封装 IndexedDB 操作，提供数据库初始化、CRUD 操作、事务处理和错误处理

## 🎯 功能需求

### 1. 核心功能
- **数据库初始化**：根据配置创建数据库和对象存储
- **CRUD 操作**：提供增删改查的通用方法
- **事务处理**：封装事务创建和管理
- **数据序列化**：自动序列化对象，支持复杂数据类型
- **索引查询**：支持根据索引查询数据
- **分页查询**：支持分页获取数据
- **批量操作**：支持批量添加数据

### 2. 功能边界
- **负责**：
  - IndexedDB 数据库操作
  - 数据序列化和反序列化
  - 事务管理
  - 错误处理
- **不负责**：
  - 具体的业务逻辑（由业务服务层负责）
  - 数据验证（由业务服务层负责）

### 3. 输入输出
- **输入**：
  - 数据库配置（dbName, version, stores）
  - 操作参数（storeName, data, key）
- **输出**：
  - 查询结果（单条或多条数据）
  - 操作结果（成功或错误）

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  ```typescript
  // 无外部依赖，使用浏览器原生 IndexedDB API
  ```
- **被依赖**：
  - `src/services/resource-storage.ts`：使用 IndexedDBService 存储资源数据
  - `src/services/chat-storage.ts`：使用 IndexedDBService 存储聊天数据
  - `src/services/question-storage.ts`：使用 IndexedDBService 存储习题数据

### 2. 关键代码逻辑

#### 单例模式
```typescript
export class IndexedDBService {
  private static instances: Map<string, IndexedDBService> = new Map()
  
  public static getInstance(config: IndexedDBConfig): IndexedDBService {
    const key = `${config.dbName}_${config.version}`
    if (!IndexedDBService.instances.has(key)) {
      IndexedDBService.instances.set(key, new IndexedDBService(config))
    }
    return IndexedDBService.instances.get(key)!
  }
}
```

#### 数据序列化
```typescript
public static deepSerialize<T = unknown>(obj: unknown): T {
  // 第1步：处理基础类型和null/undefined
  if (obj === null || obj === undefined) {
    return obj as T
  }
  
  // 第2步：排除函数
  if (typeof obj === 'function') {
    return undefined as T
  }
  
  // 第3步：处理日期对象
  if (obj instanceof Date) {
    return obj.toISOString() as T
  }
  
  // 第4步：处理ArrayBuffer和Uint8Array
  if (obj instanceof ArrayBuffer) {
    return new Uint8Array(obj) as T
  }
  
  // 第5步：处理数组和对象（递归序列化）
  // ...
}
```

### 3. 数据流
- **存储流程**：
  1. 接收数据对象
  2. 深度序列化（处理函数、日期等不可存储类型）
  3. 创建事务
  4. 存储到 IndexedDB
  5. 返回操作结果

- **查询流程**：
  1. 创建事务
  2. 打开游标或使用索引
  3. 读取数据
  4. 返回查询结果

## 🔄 迁移到 React Native

### 1. 等价实现
- **当前实现**：使用浏览器原生 IndexedDB API
- **React Native 实现**：
  - 简单数据：使用 AsyncStorage（键值存储）
  - 复杂数据：使用 Realm 或 SQLite（关系型数据库）
  - 文件数据：使用文件系统（react-native-fs）

### 2. 需要的第三方库
- `@react-native-async-storage/async-storage`：简单键值存储
- `realm`：关系型数据库（可选，用于复杂数据）
- `react-native-sqlite-2`：SQLite 数据库（可选）
- `react-native-fs`：文件系统操作（用于文件数据）

### 3. 迁移步骤
1. **选择存储方案**：
   - 简单数据（用户信息、配置）→ AsyncStorage
   - 复杂数据（教材、聊天记录）→ Realm 或 SQLite
   - 文件数据（PDF、图片）→ 文件系统

2. **创建存储服务抽象层**：
   - 创建统一的存储接口
   - 封装不同存储方案的实现

3. **迁移数据模型**：
   - 将 IndexedDB 的 store 映射到 Realm/SQLite 的表
   - 迁移索引配置

4. **迁移 CRUD 操作**：
   - 将 IndexedDB 操作转换为对应的存储方案操作
   - 保持接口兼容性

### 4. 注意事项
- **异步操作**：AsyncStorage 和 Realm 都是异步的，所有操作需要 await
- **数据迁移**：需要处理从 IndexedDB 到新存储方案的数据迁移
- **索引支持**：Realm 和 SQLite 都支持索引，但配置方式不同
- **事务支持**：Realm 和 SQLite 都支持事务，AsyncStorage 不支持
- **文件大小限制**：AsyncStorage 有大小限制（约 6MB），大文件需要使用文件系统

### 5. 迁移代码示例

#### IndexedDB 实现
```typescript
const service = IndexedDBService.getInstance(config)
await service.init()
await service.add('textbooks', textbookData)
const textbooks = await service.getAll('textbooks')
```

#### AsyncStorage 实现（简单数据）
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'

await AsyncStorage.setItem('textbooks', JSON.stringify(textbooks))
const data = await AsyncStorage.getItem('textbooks')
const textbooks = data ? JSON.parse(data) : []
```

#### Realm 实现（复杂数据）
```typescript
import Realm from 'realm'

const realm = await Realm.open({
  schema: [TextbookSchema, ChatSchema]
})

realm.write(() => {
  realm.create('Textbook', textbookData)
})

const textbooks = realm.objects('Textbook')
```

## ⚠️ 迁移风险

### 高风险项
- **数据迁移**：需要将现有 IndexedDB 数据迁移到新存储方案 - **解决方案**：编写数据迁移脚本，在应用首次启动时执行
- **性能差异**：不同存储方案的性能差异较大 - **解决方案**：根据数据特点选择合适的存储方案
- **事务支持**：AsyncStorage 不支持事务，复杂操作需要特殊处理 - **解决方案**：复杂数据使用 Realm 或 SQLite

### 低风险项
- **接口封装**：可以通过抽象层保持接口兼容性
- **查询语法**：需要适配不同存储方案的查询语法

## 🧪 测试要点

### 功能测试
- 测试数据库初始化是否正常
- 测试 CRUD 操作是否正常
- 测试事务处理是否正常
- 测试索引查询是否正常
- 测试分页查询是否正常
- 测试数据序列化是否正常

### 边界测试
- 测试大数据量存储的性能
- 测试并发操作的正确性
- 测试数据迁移的完整性

## 📚 参考资源

- [AsyncStorage 文档](https://react-native-async-storage.github.io/async-storage/)
- [Realm 文档](https://realm.io/docs/javascript/latest/)
- [SQLite 文档](https://github.com/andpor/react-native-sqlite-storage)
- [IndexedDB API](https://developer.mozilla.org/zh-CN/docs/Web/API/IndexedDB_API)

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**维护者**：开发团队
