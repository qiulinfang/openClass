# 📋 章节信息Store化测试用例

## 🎯 测试目标
验证章节信息完全通过 `aiTextbookStore` 传递，移除URL query参数的修改是否正常工作。

## 🧪 测试环境
- 浏览器: Chrome/Firefox
- 测试账号: 任意有效账号
- 测试教材: 包含章节信息的教材

---

## ✅ 正常流程测试

### 测试用例 1.1: 标准学习流程
**前置条件:**
- 用户已登录
- 选择包含章节信息的教材

**测试步骤:**
1. 进入知识图谱页面
2. 点击任意知识节点，打开学习对话框
3. 在学习对话框中选择学习方案
4. 点击"进入学习"按钮跳转到PDF查看器
5. 在PDF查看器中点击返回按钮
6. 返回知识图谱，验证学习对话框重新打开

**预期结果:**
- ✅ PDF URL不包含章节参数 (`chapterGrade`, `chapterSubject`, `chapterTextbook`, `chapterTitle`)
- ✅ PDF查看器能正常显示微课按钮（如果章节信息匹配）
- ✅ 返回后学习对话框能正确显示章节信息
- ✅ 控制台无错误信息

**验证点:**
```javascript
// PDF URL应该类似：
// /pdf-viewer?id=123&textbookName=xxx&sectionName=yyy&resourceId=zzz&packageId=aaa&packageName=bbb&fromLearning=true&learningNodeId=nnn&learningSectionName=sss&learningLevel=1
// 不应该包含：chapterGrade=xxx&chapterSubject=yyy&chapterTextbook=zzz&chapterTitle=aaa
```

---

### 测试用例 1.2: 重复进入同一PDF
**前置条件:**
- 完成测试用例1.1

**测试步骤:**
1. 在学习对话框中再次点击"进入学习"
2. 验证PDF查看器正常加载
3. 重复步骤5-6，返回并重新进入

**预期结果:**
- ✅ 章节信息在多次进出间保持一致
- ✅ store状态正确维护

---

## ⚠️ 边界情况测试

### 测试用例 2.1: 直接访问PDF URL（无章节参数）
**前置条件:**
- 从其他地方复制PDF URL（不包含章节参数）

**测试步骤:**
1. 在新标签页中直接访问PDF URL（如书签或分享链接）
2. 观察PDF查看器行为
3. 检查微课按钮显示状态

**预期结果:**
- ✅ PDF能正常加载和显示
- ❌ 微课按钮不显示（因为章节信息为空）
- ✅ 无控制台错误

**验证点:**
```javascript
// aiTextbookStore.chapterInfo 应该为 null 或空对象
console.log(aiTextbookStore.chapterInfo) // null 或 {}
```

---

### 测试用例 2.2: 直接访问PDF URL（包含章节参数）- 向后兼容性
**前置条件:**
- 手动构造包含章节参数的URL

**测试步骤:**
1. 构造URL: `/pdf-viewer?id=123&chapterGrade=初一&chapterSubject=数学&chapterTextbook=探究型公开课&chapterTitle=最短路径的基本原理&...其他参数`
2. 在新标签页中访问该URL
3. 观察章节信息是否正确设置到store

**预期结果:**
- ✅ PDF正常加载
- ✅ 章节信息自动设置到 `aiTextbookStore.chapterInfo`
- ✅ 如果章节信息匹配，微课按钮显示

**验证点:**
```javascript
// 访问后检查store状态
console.log(aiTextbookStore.chapterInfo)
// 应该输出:
// {
//   grade: "初一",
//   subject: "数学",
//   textbook: "探究型公开课",
//   chapter_title: "最短路径的基本原理"
// }
```

---

### 测试用例 2.3: 页面刷新测试
**前置条件:**
- 完成测试用例1.1，处于PDF查看器页面

**测试步骤:**
1. 在PDF查看器页面按F5刷新
2. 观察页面行为
3. 检查store状态

**预期结果:**
- ✅ PDF重新加载
- ❌ 章节信息丢失（store被清空）
- ❌ 微课按钮不显示
- ✅ 无崩溃或错误

**验证点:**
```javascript
// 刷新后检查
console.log(aiTextbookStore.chapterInfo) // null
```

---

### 测试用例 2.4: LearningView章节信息为空
**前置条件:**
- 找到或构造一个章节信息为空的学习节点

**测试步骤:**
1. 点击章节信息不完整的节点
2. 进入PDF查看器
3. 检查store状态和微课按钮

**预期结果:**
- ✅ PDF正常工作
- ✅ store设置为空对象或null
- ❌ 微课按钮不显示

---

## 🚨 异常情况测试

### 测试用例 3.1: 多标签页同时操作
**前置条件:**
- 打开两个标签页

**测试步骤:**
1. 在标签页1中完成标准学习流程
2. 在标签页2中进行不同的学习操作
3. 切换回标签页1，检查章节信息是否被污染

**预期结果:**
- ⚠️ store是全局共享的，可能出现状态混乱
- 需要记录实际表现，可能需要后续改进

---

### 测试用例 3.2: store状态异常
**前置条件:**
- 通过开发者工具手动修改store状态

**测试步骤:**
1. 完成标准流程
2. 在控制台执行: `aiTextbookStore.setChapterInfo(null)`
3. 观察后续操作行为

**预期结果:**
- ✅ 不会崩溃
- ❌ 章节相关功能降级（微课按钮消失等）

---

## 🔍 自动化验证脚本

### 验证store状态的工具函数
```javascript
// 添加到浏览器控制台的验证脚本
window.testChapterInfo = {
  // 检查当前store状态
  checkStore: () => {
    console.log('Current chapterInfo:', aiTextbookStore.chapterInfo)
    return aiTextbookStore.chapterInfo
  },

  // 验证微课按钮状态
  checkMiniClassButton: () => {
    const button = document.querySelector('[data-testid="mini-class-fab"]')
    console.log('Mini class button visible:', !!button)
    return !!button
  },

  // 检查URL是否包含章节参数
  checkUrlParams: () => {
    const url = new URL(window.location.href)
    const chapterParams = ['chapterGrade', 'chapterSubject', 'chapterTextbook', 'chapterTitle']
    const found = chapterParams.filter(param => url.searchParams.has(param))
    console.log('Chapter params in URL:', found)
    return found.length === 0 // 应该返回true（无章节参数）
  }
}

// 使用方法:
// testChapterInfo.checkStore()
// testChapterInfo.checkMiniClassButton()
// testChapterInfo.checkUrlParams()
```

---

## 📊 测试结果记录表

| 测试用例 | 状态 | 结果 | 备注 |
|---------|------|------|------|
| 1.1 标准学习流程 | ⏳ |  |  |
| 1.2 重复进入 | ⏳ |  |  |
| 2.1 直接访问（无参数） | ⏳ |  |  |
| 2.2 直接访问（有参数） | ⏳ |  |  |
| 2.3 页面刷新 | ⏳ |  |  |
| 2.4 章节信息为空 | ⏳ |  |  |
| 3.1 多标签页 | ⏳ |  |  |
| 3.2 store异常 | ⏳ |  |  |

**状态说明:**
- ⏳ 未测试
- ✅ 通过
- ❌ 失败
- ⚠️ 部分问题

---

## 🎯 验收标准

### 必须通过的标准 (Blocking)
- [ ] 测试用例1.1完全通过
- [ ] PDF URL不包含任何章节参数
- [ ] 正常流程下微课按钮正确显示
- [ ] 返回功能正常工作

### 推荐标准 (Should)
- [ ] 测试用例2.2通过（向后兼容性）
- [ ] 无控制台错误
- [ ] 页面刷新后 graceful degradation

### 可选标准 (Could)
- [ ] 多标签页状态隔离
- [ ] store状态持久化

---

## 🐛 已知问题和改进建议

### 当前已知问题
1. **页面刷新后状态丢失**: store是内存状态，刷新后清空
2. **多标签页状态污染**: 全局store可能被其他标签页影响

### 改进建议
1. **添加sessionStorage持久化**: 在store中添加持久化逻辑
2. **标签页隔离**: 为每个标签页生成唯一ID
3. **状态同步**: 添加store状态变化监听

---

## 🧪 单元测试代码示例

### Vitest 测试文件示例
```typescript
// tests/stores/aiTextbookStore-chapterInfo.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAiTextbookChatStore } from '@/stores/aiTextbookChatStore'

describe('aiTextbookStore - ChapterInfo Management', () => {
  let store: ReturnType<typeof useAiTextbookChatStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useAiTextbookChatStore()
  })

  describe('setChapterInfo', () => {
    it('should set chapter info correctly', () => {
      const chapterInfo = {
        grade: '初一',
        subject: '数学',
        textbook: '探究型公开课',
        chapter_title: '最短路径的基本原理'
      }

      store.setChapterInfo(chapterInfo)

      expect(store.chapterInfo).toEqual(chapterInfo)
    })

    it('should set null when info is empty', () => {
      const emptyInfo = {
        grade: '',
        subject: '',
        textbook: '',
        chapter_title: ''
      }

      store.setChapterInfo(emptyInfo)

      expect(store.chapterInfo).toBeNull()
    })

    it('should set info when at least one field has value', () => {
      const partialInfo = {
        grade: '初一',
        subject: '',
        textbook: '',
        chapter_title: ''
      }

      store.setChapterInfo(partialInfo)

      expect(store.chapterInfo).toEqual(partialInfo)
    })
  })
})
```

### 组件集成测试示例
```typescript
// tests/components/LearningView-chapterInfo.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import LearningView from '@/views/LearningView.vue'
import { useAiTextbookChatStore } from '@/stores/aiTextbookChatStore'

describe('LearningView - ChapterInfo Integration', () => {
  it('should set chapterInfo to store before navigation', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const store = useAiTextbookChatStore(pinia)

    const wrapper = mount(LearningView, {
      global: { plugins: [pinia] },
      props: {
        chapterGrade: '初一',
        chapterSubject: '数学',
        chapterTextbook: '探究型公开课',
        chapterTitle: '最短路径的基本原理'
      }
    })

    // 模拟点击进入学习按钮
    await wrapper.find('[data-testid="enter-learning-btn"]').trigger('click')

    // 验证store是否被正确设置
    expect(store.setChapterInfo).toHaveBeenCalledWith({
      grade: '初一',
      subject: '数学',
      textbook: '探究型公开课',
      chapter_title: '最短路径的基本原理'
    })
  })
})
```

---

## 🔧 调试和监控

### 开发环境调试配置
```typescript
// 在开发环境中添加调试日志
if (import.meta.env.DEV) {
  // 监听store变化
  watch(
    () => aiTextbookStore.chapterInfo,
    (newInfo, oldInfo) => {
      console.log('[DEBUG] ChapterInfo changed:', { old: oldInfo, new: newInfo })
    },
    { immediate: true }
  )

  // 监听路由变化
  watch(
    () => route.query,
    (newQuery) => {
      const chapterParams = Object.keys(newQuery).filter(key =>
        key.toLowerCase().includes('chapter')
      )
      if (chapterParams.length > 0) {
        console.warn('[WARN] Chapter params found in URL:', chapterParams)
      }
    }
  )
}
```

### 生产环境监控
```typescript
// 错误边界和监控
try {
  // 关键操作
  aiTextbookStore.setChapterInfo(chapterInfo)
} catch (error) {
  console.error('[ERROR] Failed to set chapter info:', error)
  // 可以上报到错误监控系统
  reportError(error, { component: 'LearningView', action: 'setChapterInfo' })
}
```

---

## 📞 测试完成检查清单

- [ ] 所有blocking测试通过
- [ ] 测试结果记录完整
- [ ] 发现的问题已记录
- [ ] 改进建议已提出
- [ ] 验证脚本可正常使用
- [ ] 单元测试覆盖关键逻辑
- [ ] 集成测试验证组件交互
