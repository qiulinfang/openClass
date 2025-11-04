# Web持久化逻辑与新账号登录分析

## 一、持久化数据分类

### 1.1 用户凭证相关（登录时更新）
- `XUEBAN_TOKEN` - 学班管理员token（loginXueban中保存）
- `YANBAN_TOKEN` - 研伴学生token（loginYanban中保存）
- `userId` - 用户账号（loginXueban中保存）
- `userPassword` - 用户密码明文（loginXueban中保存）
- `studentUserId` - 学生用户ID（loginYanban中保存）
- `userInfo` - 用户信息JSON（getUserInfo中保存）
- `USER_INFO_CACHE` - 用户信息缓存（userStore中保存）
- `lastLoginTime` - 最后登录时间戳

### 1.2 业务数据（登录时不会清理）
#### 聊天相关
- `teacher_chat_*_session` - 教师会话信息（localStorage）
- `chat_history_*` - 题目聊天历史（IndexedDB，降级到localStorage）
- `teacher_chat_history_*` - 教师聊天历史（IndexedDB，降级到localStorage）
- `ai-general-sessions` - AI通用会话列表（localStorage）

#### 用户偏好
- `favorites` - 收藏列表（localStorage）
- `currentTeacherSubject` - 当前教师科目（localStorage）

#### 缓存数据
- `learning_packages_*` - 学习包缓存（localStorage）
- `knowledgeGraphDebugParams` - 知识图谱调试参数（localStorage）
- `perfData` - 性能数据（localStorage）

## 二、登录流程分析

### 2.1 学班管理员登录（loginXueban）
```typescript
// 位置：imates-web/src/services/api-service.ts:1008
public async loginXueban(account: string, password: string): Promise<string>
```

**流程：**
1. 第1步：发送登录请求到 `/blw-edu-xb/login`
2. 第2步：保存token和用户凭据到localStorage
   - `localStorage.setItem('XUEBAN_TOKEN', token)`
   - `localStorage.setItem('userId', account)`
   - `localStorage.setItem('userPassword', password)`
   - `localStorage.setItem('lastLoginTime', Date.now().toString())`
3. 第3步：返回token

**问题：** 只更新了凭证数据，**不会清理旧账号的业务数据**

### 2.2 获取用户信息（getUserInfo）
```typescript
// 位置：imates-web/src/services/api-service.ts:1053
public async getUserInfo(token: string): Promise<UserInfo>
```

**流程：**
1. 第1步：调用API获取用户信息 `/admin/info?token=xxx`
2. 第2步：持久化用户信息到localStorage
   - `localStorage.setItem('userInfo', JSON.stringify(userInfo))`
3. 第3步：同步到Android原生ViewModel（如果在Android环境）

**问题：** 只更新了用户信息，**不会清理旧账号的业务数据**

### 2.3 研伴学生登录（loginYanban）
```typescript
// 位置：imates-web/src/services/api-service.ts:1104
public async loginYanban(account: string, password: string): Promise<LoginResponse | null>
```

**流程：**
1. 第1步：使用MD5加密密码
2. 第2步：发送登录请求到 `/blw-edu-yb/login`
3. 第3步：保存token和用户ID到localStorage
   - `localStorage.setItem('YANBAN_TOKEN', token)`
   - `localStorage.setItem('studentUserId', userId)`
   - `localStorage.setItem('lastLoginTime', Date.now().toString())`

**问题：** 只更新了凭证数据，**不会清理旧账号的业务数据**

## 三、新账号登录会发生什么

### 3.1 会更新什么
✅ **用户凭证数据**（会被新账号覆盖）：
- `XUEBAN_TOKEN` / `YANBAN_TOKEN` - 新账号的token
- `userId` / `studentUserId` - 新账号ID
- `userPassword` - 新账号密码
- `userInfo` / `USER_INFO_CACHE` - 新账号的用户信息
- `lastLoginTime` - 新的登录时间

### 3.2 不会清理什么（问题所在）
❌ **业务数据**（旧账号数据仍然存在）：

1. **教师会话数据**
   - `teacher_chat_*_session` - 旧账号的会话列表仍然在localStorage中
   - 新账号登录后，会看到旧账号创建的会话

2. **聊天历史**
   - `chat_history_*` - 旧账号的题目聊天记录仍然在IndexedDB/localStorage中
   - `teacher_chat_history_*` - 旧账号的教师聊天记录仍然存在
   - 新账号可能看到旧账号的聊天内容

3. **收藏数据**
   - `favorites` - 旧账号的收藏列表仍然存在
   - 新账号会看到旧账号收藏的会话和题目

4. **AI通用会话**
   - `ai-general-sessions` - 旧账号的AI会话列表仍然存在
   - 新账号会看到旧账号的AI对话历史

5. **其他缓存**
   - `learning_packages_*` - 学习包缓存
   - `currentTeacherSubject` - 科目设置
   - 各种调试和配置数据

## 四、问题影响

### 4.1 数据隐私问题
- 新账号可以看到旧账号的聊天记录
- 新账号可以看到旧账号的会话列表
- 新账号可以看到旧账号的收藏数据
- **存在严重的数据泄露风险**

### 4.2 数据混淆问题
- 无法区分哪些数据属于哪个账号
- 会话列表混杂了多个账号的数据
- 收藏列表混杂了多个账号的数据
- **用户体验差，数据混乱**

### 4.3 功能异常问题
- 可能加载到旧账号的聊天历史
- 可能显示旧账号的会话信息
- 可能导致数据关联错误

## 五、数据加载逻辑分析

### 5.1 教师会话加载
```typescript
// 位置：imates-web/src/components/TeacherChatDialog.vue:122
const loadSessions = () => {
  // 遍历localStorage查找所有 teacher_chat_*_session
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('teacher_chat_') && key.endsWith('_session')) {
      // 加载会话数据
    }
  }
}
```

**问题：** 没有按用户ID过滤，会加载所有账号的会话

### 5.2 收藏数据加载
```typescript
// 位置：imates-web/src/utils/favorites.ts:60
export function getAllFavorites(): Favorite[] {
  const data = localStorage.getItem('favorites')
  return JSON.parse(data) || []
}
```

**问题：** 没有按用户ID过滤，会加载所有账号的收藏

### 5.3 聊天历史加载
```typescript
// 位置：imates-web/src/services/chat-storage.ts:162
async loadChatHistory(questionId: string): Promise<ChatHistoryData | null> {
  const key = `chat_history_${questionId}`
  return await localforage.getItem(key)
}
```

**问题：** 没有按用户ID隔离，不同账号的同一题目ID会共享聊天历史

## 六、解决方案建议

### 6.1 方案一：登录时清理旧数据（推荐）
在登录成功后，清理所有业务数据：
- 清理所有 `teacher_chat_*_session`
- 清理所有 `chat_history_*` 和 `teacher_chat_history_*`
- 清理 `favorites`
- 清理 `ai-general-sessions`
- 清理其他用户相关的缓存数据

**优点：** 简单直接，确保新账号数据干净
**缺点：** 如果用户切换账号，会丢失之前的数据

### 6.2 方案二：按用户ID隔离数据（最佳）
所有业务数据的key都加上用户ID前缀：
- `teacher_chat_${userId}_*_session`
- `chat_history_${userId}_*`
- `favorites_${userId}`
- `ai-general-sessions_${userId}`

**优点：** 多账号数据隔离，支持账号切换
**缺点：** 需要修改所有数据存储和读取逻辑

### 6.3 方案三：登录时检测并提示
检测到userId变化时，提示用户是否清理旧数据

**优点：** 用户可以选择是否保留旧数据
**缺点：** 需要用户操作，可能忘记清理

## 七、总结

### 当前状态
- ✅ 登录时会更新用户凭证数据
- ❌ 登录时不会清理旧账号的业务数据
- ❌ 业务数据没有按用户ID隔离
- ❌ 存在严重的数据隐私和混淆问题

### 建议
**优先实施方案一（登录时清理旧数据）**，因为：
1. 实现简单，风险低
2. 立即解决数据泄露问题
3. 大多数场景下用户不会频繁切换账号
4. 如果确实需要支持多账号，再升级到方案二

### 需要修改的文件
1. `imates-web/src/services/api-service.ts` - loginXueban和loginYanban方法
2. `imates-web/src/views/LoginView.vue` - 登录成功后调用清理逻辑
3. 创建新的清理工具函数，统一清理所有业务数据

