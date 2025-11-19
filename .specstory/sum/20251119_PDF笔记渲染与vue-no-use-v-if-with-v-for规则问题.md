问题序号：PDF笔记渲染与vue/no-use-v-if-with-v-for规则问题

2025-11-19 更新：新增了 Vue 规则 `vue/no-use-v-if-with-v-for` 在 pdfpage.vue 中的具体问题与重构方案说明。

## 问题元信息
- **问题分类**：`前端 / Vue / 代码规范`
- **严重程度**：`低 ~ 中`（主要影响可维护性和潜在渲染性能）
- **影响范围**：`PDF 阅读页中笔记标记与气泡渲染结构`
- **发现日期**：`2025-11-19`
- **解决状态**：`已解决`

## 问题现象

- ESLint 在 `pdfpage.vue` 报错：

  - 规则：`vue/no-use-v-if-with-v-for`
  - 报错位置：`src/components/pdfpage.vue:L64-L75`
  - 报错信息（意译）：
    - 不应在 `v-for` 中直接使用 `notes.filter(...)` 这样的表达式，应使用 computed 预先过滤。
    - 不应在同一个元素上同时使用 `v-for` 和 `v-if`，应该把条件判断移到外层 `template` 或使用其他结构。

- 报错前的核心模板代码大致为：

  ```vue
  <div
    v-for="note in notes.filter((n) => n.pageIndex === index)"
    :key="note.id"
    class="note-marker"
    :style="getNoteStyle(note, layout)"
    @click.stop="toggleNoteTooltip(note)"
  >
    N
  </div>
  <div
    v-for="note in notes.filter((n) => n.pageIndex === index)"
    :key="note.id + '-tooltip'"
    v-if="activeNoteId === note.id"
    class="note-tooltip"
    :style="getNoteTooltipStyle(note, layout)"
    @click.stop
  >
    ...
  </div>
  ```

## 技术原因 (❌)

1. **在 `v-for` 中内联过滤数组**

   - `notes.filter((n) => n.pageIndex === index)` 会在每次渲染时重新构造一个新数组。
   - 对于多页 PDF + 多条笔记，这种多次 `filter` 的成本不必要。
   - ESLint 规则希望：
     - 数据过滤逻辑抽到 `computed` 中复用。
     - 视图层只消费“准备好的数据”。

2. **在同一元素上混用 `v-for` 与 `v-if`**

   - 虽然 Vue 运行时允许（并且渲染行为有明确规则：`v-if` 优先于 `v-for`），但维护成本高。
   - 同一个元素既负责“循环”又负责“条件显示”，不利于阅读和重构。
   - 规则 `vue/no-use-v-if-with-v-for` 推荐：
     - 将 `v-if` 移到外层 `<template>` 或通过其他方式拆开结构。

3. **工具提示与标记被拆成两份独立 `v-for`**

   - 标记 `N` 的 div 与 tooltip 的 div 各自有一套 `v-for`，且都用 `notes.filter(...)`。
   - 会有“数据源重复过滤 + 结构不对齐”的风险：
     - 一旦过滤条件改动/拼写错误，很容易出现“有 marker 没 tooltip”或反之。

## 正确实现方案 (✅)

### 方案 1：按页预分组笔记（当前采用）

1. **在脚本中引入按页分组的 computed**

   ```ts
   interface PageNote {
     id: string
     pageIndex: number
     x: number
     y: number
     text: string
   }

   const notes = ref<PageNote[]>([])

   const activeNoteId = ref<string | null>(null)
   const currentPageIndex = ref(0)

   const currentPageNotes = computed(() =>
     notes.value.filter((n) => n.pageIndex === currentPageIndex.value),
   )

   const pageNotesByIndex = computed(() => {
     const groups: Record<number, PageNote[]> = {}
     for (const note of notes.value) {
       if (!groups[note.pageIndex]) {
         groups[note.pageIndex] = []
       }
       groups[note.pageIndex].push(note)
     }
     return groups
   })
   ```

2. **模板中使用 `pageNotesByIndex`，并用 `<template v-for>` + 内层 `v-if` 拆开**

   ```vue
   <div
     v-for="(layout, index) in pageLayouts"
     :key="index"
     class="page"
     :style="getPageStyle(layout)"
     @click="handlePageClick($event, index, layout)"
   >
     <template v-for="note in pageNotesByIndex[index] || []">
       <div
         :key="note.id"
         class="note-marker"
         :style="getNoteStyle(note, layout)"
         @click.stop="toggleNoteTooltip(note)"
       >
         N
       </div>
       <div
         :key="note.id + '-tooltip'"
         v-if="activeNoteId === note.id"
         class="note-tooltip"
         :style="getNoteTooltipStyle(note, layout)"
         @click.stop
       >
         <div class="note-tooltip-text">{{ note.text }}</div>
         <div class="note-tooltip-actions">
           <button class="note-tooltip-btn" @click.stop="handleNoteClick(note)">编辑</button>
           <button class="note-tooltip-btn" @click.stop="deleteNote(note)">删除</button>
         </div>
       </div>
     </template>

     <canvas :ref="(el) => setPageCanvasRef(el, index)" class="page-canvas"></canvas>
   </div>
   ```

   - 循环数据来源从 `notes.filter(...)` 改为 `pageNotesByIndex[index] || []`。
   - `v-for` 写在 `template` 上，而 `v-if` 写在内部 tooltip 元素上：
     - 避免同一节点同时有 `v-for` 和 `v-if`。
   - `:key` 移到真实元素上（marker 与 tooltip 各自一个 key）。

## 关键代码/公式

- **按页分组逻辑**：

  ```ts
  const pageNotesByIndex = computed(() => {
    const groups: Record<number, PageNote[]> = {}
    for (const note of notes.value) {
      if (!groups[note.pageIndex]) {
        groups[note.pageIndex] = []
      }
      groups[note.pageIndex].push(note)
    }
    return groups
  })
  ```

## 测试验证

- **测试场景**：
  - 场景 1：单页少量笔记（1~3条）。
  - 场景 2：多页多条笔记（每页 10+ 条）。
  - 场景 3：快速添加/删除笔记，检查 marker 与 tooltip 是否一一对应。
- **验证点**：
  - ESLint 不再报 `vue/no-use-v-if-with-v-for`。
  - 页面笔记 marker 显示正常、tooltip 与 `activeNoteId` 逻辑一致。
  - 切换页码后，右侧“当前页笔记”列表与页面上的 marker 对应。

## 预防措施

- 遵循 Vue 模板的最佳实践：
  - 不在 `v-for` 中写 `array.filter(...)`、`array.map(...)` 等复杂表达式。
  - 对「按条件过滤的列表」优先用 `computed` 生成。
  - 避免在同一元素同时写 `v-for` 和 `v-if`，必要时使用 `<template>` 包裹。

## 可复用经验

- 先设计好数据结构，再写模板，比在模板里临时 filter/map 更易维护。
- 对同一业务实体（如笔记）在多个视图（marker、tooltip、侧边栏列表）中使用时，尽量保证“数据来源单一”。
- 使用 ESLint 规则（如 `vue/no-use-v-if-with-v-for`）可以帮助识别出潜在结构问题，而不仅仅是格式问题。
