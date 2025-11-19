## 2025-11-19 Vue `<template v-for>` key 使用问题

### 2025-11-19 更新：新增 Vue `<template v-for>` key 放置位置问题记录

---

## 一、问题概述

- **现象**
  - 编辑 `imates-web/src/components/pdfpage.vue` 时，ESLint 报错：
    - `'<template v-for>' key should be placed on the <template> tag.`
  - 随后又出现 eslint-plugin-vue 的规则报错：
    - `[vue/no-v-for-template-key] '<template v-for>' cannot be keyed. Place the key on real elements instead.`

- **核心矛盾**
  - Vue 官方推荐：`<template v-for>` 的 **key 应加在 `<template>` 上**，否则整个 v-for block 没有稳定 key。
  - 但 `eslint-plugin-vue` 的 `vue/no-v-for-template-key` 规则：**禁止在 `<template v-for>` 上使用 key**，要求 key 放在真实元素上。
  - 导致：
    - key 只写在内部元素上：Vue 提示 `<template v-for>` 未正确 key。
    - key 写在 `<template>` 上：ESLint 规则报错。

---

## 二、问题代码与上下文

### 1. 原始代码片段

文件：`imates-web/src/components/pdfpage.vue`

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

### 2. 问题分析

- 外层：`page` 维度按 `index` key，没问题。
- 内层：`note` 维度使用 `<template v-for>` 包裹两个兄弟节点（标记点 + tooltip）。
- 实际渲染时：
  - `<template>` 自身不渲染为 DOM 元素，只展开内部子节点。
  - Vue 在 diff v-for 列表时希望 **针对每个 v-for 项有一个稳定 key**，而不是依赖内部多个元素的 key。
- ESLint 规则又不允许：

```vue
<template v-for="note in ..." :key="note.id">
```

---

## 三、解决思路

### 1. 避免使用 `<template v-for>`

- 这类场景本质是：**一个 note 项，对应一组兄弟 DOM 节点（marker + tooltip）**。
- 既然 `<template>` 是“只包不渲染”，又跟 ESLint 规则冲突，最简单的做法是：
  - 用一个真实元素（例如 `div`）作为 note 的“包裹容器”，
  - 把 `v-for` 和 `:key` 都放在这个容器上。

### 2. 修改后的代码

```vue
<div
  v-for="(layout, index) in pageLayouts"
  :key="index"
  class="page"
  :style="getPageStyle(layout)"
  @click="handlePageClick($event, index, layout)"
>
  <div v-for="note in pageNotesByIndex[index] || []" :key="note.id">
    <div
      class="note-marker"
      :style="getNoteStyle(note, layout)"
      @click.stop="toggleNoteTooltip(note)"
    >
      N
    </div>
    <div
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
  </div>
  <canvas :ref="(el) => setPageCanvasRef(el, index)" class="page-canvas"></canvas>
</div>
```

### 3. 修改效果

- **对 Vue 运行时**：
  - `note` 这一维度的 v-for 现在有了明确的、稳定的 `:key="note.id"` 容器元素。
  - diff 列表时可以以这个容器为单位进行 patch。
- **对 ESLint**：
  - 不再使用 `<template v-for>`，也就绕开了 `vue/no-v-for-template-key` 与 Vue 官方建议之间的冲突。
- **对实际 DOM 结构**：
  - 比原来多了一层包裹 `div`，但在这个场景下不会影响布局（marker 和 tooltip 本来就是绝对定位的）。

---

## 四、总结与实践建议

1. **尽量避免复杂的 `<template v-for>` 场景**
   - 尤其是在需要同时服务于 Vue 官方最佳实践和 ESLint 规则的时候。
   - 可以优先考虑通过“包裹容器 + v-for”来替代。

2. **需要为一组兄弟节点绑定同一个 v-for key 时**：
   - 用一个额外的包裹元素（`div` / `span` / `template + Fragment` 视场景而定）。
   - 推荐写法：

     ```vue
     <div v-for="item in list" :key="item.id">
       <!-- 该 item 对应的一组兄弟节点 -->
     </div>
     ```

3. **与 ESLint 规则冲突时的处理原则**
   - 优先保证 **运行时行为正确 & diff 稳定**。
   - 再根据规则信息，调整代码结构来规避规则冲突，而不是简单关闭规则。

4. **本次问题的经验复用点**
   - 在 PDF 阅读相关组件中，如果后续还有类似“同一业务项对应多个 DOM 节点”的需求（比如：截图框 + 其控制点、手写笔迹 + 操作按钮等），可直接复用“包裹 div + v-for + :key”的模式，避免 `<template v-for>`。
