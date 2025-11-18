问题序号：PDF笔记列表BetterScroll点击无效问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`PDF 阅读页右侧笔记列表的点击与“更多”菜单交互`
- **发现日期**：`2025-11-18`
- **解决状态**：`已解决`

## 问题现象
在 `PdfNoteListPanel.vue` 中引入 BetterScroll 为右侧笔记列表提供橡皮筋滚动效果后，出现以下异常：

- 点击列表项 `q-item` 没有高亮，不触发选中逻辑。
- 点击“更多”按钮的图标可以弹出菜单，但点击菜单项（删除）没有任何视觉反馈，且对应行也不会被标记为选中。

## 复现步骤
1. 打开 PDF 阅读页，保证右侧笔记列表面板 `PdfNoteListPanel` 处于可见状态。
2. 列表中已有多条笔记，能够出现滚动条。
3. 使用 BetterScroll 包裹列表容器后：
   1. 在列表中点击任意一条 `q-item`，期望高亮该行并滚动到对应 PDF 位置。
   2. 点击该行右侧的“更多”按钮图标，弹出菜单，再点击“删除”菜单项。
4. 实际表现：
   - 步骤 3.1：列表行点击后没有高亮，右侧列表选中状态未变化。
   - 步骤 3.2：点击“删除”没有改变行的背景色，用户很难感知当前操作作用于哪一行。

## 用户体验
- 影响点1：用户点击右侧笔记列表行没有任何高亮反馈，难以判断当前选中的是哪条笔记。
- 影响点2：点击“更多”菜单的删除项时也没有选中高亮，用户无法直观确认删除的是哪一条笔记，存在误操作风险。
- 影响点3：与左侧 PDF 页面气泡锚点点击后会高亮列表项的行为不一致，整体交互体验不连贯。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/PdfNoteListPanel.vue`：右侧笔记列表组件，引入 BetterScroll 并负责列表项点击与“更多”菜单事件。
  - `imates-web/src/components/PdfPage.vue`：PDF 页面组件，接收 `PdfNoteListPanel` 的 `select` 事件，更新 `selectedNoteId`，并滚动 PDF 到对应位置。
  - `imates-web/src/composables/useBetterScroll.ts`：BetterScroll 组合式函数封装，用于初始化、刷新和销毁 BScroll 实例。
- **涉及模块**：
  - 笔记列表面板模块：显示和管理 PDF 笔记列表。
  - BetterScroll 滚动模块：为列表提供橡皮筋滚动和滚动容器封装。

## 技术原因 (❌)
1. 原因1：直接使用 `new BScroll` 初始化时，未开启 `click` / `tap` 配置，BetterScroll 默认会拦截或阻止原生点击事件，导致 `q-item` 和 `q-menu` 内的点击不生效。
2. 原因2：在“更多”菜单的删除项中，仅触发了 `handleDelete(note)`，没有显式调用 `handleSelect(note)`，因此不会更新 `selectedNoteId`，列表行不会呈现选中背景色。
3. 原因3：BetterScroll 初始化与数据刷新逻辑分散在组件内部，未统一使用封装好的组合式函数 `useBetterScroll`，导致刷新、销毁等逻辑容易遗漏或写法不一致。

❌ 错误代码示例 1（未开启 click/tap，且使用原始 BScroll 实例）：
```ts
// PdfNoteListPanel.vue
import BScroll from '@better-scroll/core'

const scrollWrapper = ref<HTMLDivElement | null>(null)
let bs: BScroll | null = null

onMounted(() => {
  if (!scrollWrapper.value) return
  bs = new BScroll(scrollWrapper.value, {
    scrollY: true,
    bounce: true,
    mouseWheel: true,
    probeType: 0,
    // ❌ 未设置 click: true / tap: true
  })
})

onBeforeUnmount(() => {
  if (bs) {
    bs.destroy()
    bs = null
  }
})
```

❌ 错误代码示例 2（菜单项只删除，不更新选中状态）：
```vue
<q-item-section side>
  <q-btn flat round dense icon="more_vert">
    <q-menu>
      <q-list dense>
        <q-item clickable @click.stop="handleDelete(note)">
          <q-item-section>删除</q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </q-btn>
</q-item-section>
```

## 正确实现方案 (✅)
1. 方案1：统一使用 `useBetterScroll` 组合式函数封装 BetterScroll 初始化逻辑，在默认配置中开启 `click: true`，确保 Quasar 的 `q-item`、`q-btn`、`q-menu` 等组件内部点击事件可以正常触发。
2. 方案2：在“更多”菜单的删除项点击时，先调 `handleSelect(note)` 再调 `handleDelete(note)`，这样会先高亮对应行，再执行删除逻辑，让用户明确当前操作对象。
3. 方案3：通过 `autoWatch` 和 `watchSources` 让 `useBetterScroll` 在 `notes.length` 或 `selectedNoteId` 变化时自动 `init/refresh`，保证滚动高度和内容更新保持一致。

✅ 正确代码示例 1（使用 `useBetterScroll` 封装 BetterScroll）：
```ts
// PdfNoteListPanel.vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBetterScroll } from '../composables/useBetterScroll'

interface PageNote {
  id: string
  pageIndex: number
  x: number
  y: number
  text: string
  createdAt?: string | number
}

const props = defineProps<{
  notes: PageNote[]
  selectedNoteId?: string | null
}>()

const emit = defineEmits<{
  (e: 'select', note: PageNote): void
  (e: 'delete', note: PageNote): void
}>()

const handleDelete = (note: PageNote) => {
  emit('delete', note)
}

// ============== BetterScroll ==============
const scrollWrapper = ref<HTMLDivElement | null>(null)

const { init: initScroll } = useBetterScroll(
  scrollWrapper,
  {
    scrollY: true,
    click: true, // ✅ 允许容器内的点击事件
    bounce: {
      top: true,
      bottom: true,
      left: false,
      right: false,
    },
  },
  true,
  [
    () => props.notes.length,
    () => props.selectedNoteId,
  ]
)

// 首次挂载时初始化 BetterScroll
initScroll()

const handleSelect = (note: PageNote) => {
  emit('select', note)
}
</script>
```

✅ 正确代码示例 2（删除菜单项先选中后删除，保证高亮）：
```vue
<!-- PdfNoteListPanel.vue 模板片段 -->
<q-item
  v-for="note in notes"
  :key="note.id"
  clickable
  @click="handleSelect(note)"
  :class="['note-item', { 'note-item--active': note.id === selectedNoteId }]"
>
  <!-- ...左侧头像与内容省略... -->

  <!-- 右侧操作 -->
  <q-item-section side>
    <q-btn flat round dense icon="more_vert">
      <q-menu>
        <q-list dense>
          <q-item
            clickable
            @click.stop="() => { handleSelect(note); handleDelete(note) }"
          >
            <q-item-section>删除</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>
  </q-item-section>
</q-item>
```

## 关键代码/公式
- 代码片段1：使用 `useBetterScroll` 封装 BetterScroll 初始化和刷新逻辑。
- 代码片段2：通过 `selectedNoteId` 控制列表项高亮的 class 绑定。

```ts
// 关键：class 绑定
:class="['note-item', { 'note-item--active': note.id === selectedNoteId }]"
```

```ts
// useBetterScroll 核心封装（节选）
export function useBetterScroll(
  wrapperRef: Ref<HTMLElement | null>,
  options?: Partial<BScrollOptions>,
  autoWatch: boolean = false,
  watchSources?: Array<() => unknown>
) {
  let bscrollInstance: BScroll | null = null

  const defaultOptions: Partial<BScrollOptions> = {
    scrollY: true,
    scrollX: false,
    click: true, // ✅ 默认允许点击
    bounce: {
      top: true,
      bottom: true,
      left: false,
      right: false,
    },
    deceleration: 0.003,
    useTransition: true,
    HWCompositing: true,
    ...options,
  }

  const init = async () => {
    await nextTick()
    if (wrapperRef.value) {
      if (bscrollInstance) {
        destroy()
      }
      bscrollInstance = new BScroll(wrapperRef.value, defaultOptions)
    }
  }

  const refresh = async () => {
    await nextTick()
    bscrollInstance?.refresh()
  }

  // 组件卸载时自动清理
  onUnmounted(() => {
    destroy()
  })

  return {
    init,
    refresh,
    // ...
  }
}
```

## 测试验证
- **测试场景**：
  - 场景1：在笔记很多的情况下滚动右侧列表，点击任意一条 `q-item`，观察是否高亮，并检查左侧 PDF 是否滚动到对应笔记位置。
  - 场景2：点击某条笔记的“更多”按钮，展开菜单后点击“删除”，观察该行是否先高亮再从列表中消失。
- **验证方法**：
  - 方法1：在浏览器开发者工具中监控 `selectedNoteId` 的变化，确认点击行为会更新该值。
  - 方法2：检查 BetterScroll 的实例是否存在且在数据变化后调用了 `refresh()`，滚动区域高度与内容一致。

## 预防措施
- 措施1：在所有使用 BetterScroll 的列表组件中统一通过 `useBetterScroll` 组合式函数初始化，避免手动 new BScroll 导致配置不一致。
- 措施2：在引入第三方滚动库时，明确检查是否需要开启原生 `click`/`tap` 支持，以避免点击事件被拦截。
- 措施3：交互中凡涉及“更多菜单 + 删除/操作”的场景，优先在 UI 上给出当前作用行的高亮反馈，确保用户能确认操作对象。

## 相关链接/参考
- 相关文档：BetterScroll 官方文档（点击事件配置）
- 相关Issue：无
- 参考资源：项目内 `useBetterScroll.ts` 作为统一封装示例。

## 可复用经验
- 经验1：引入 BetterScroll 这类滚动库时，必须开启 `click: true` 等配置，才能保证 UI 库组件（如 Quasar）的点击行为正常。
- 经验2：列表项的“更多”操作应与选中状态联动，建议统一在点击操作前显式设置当前行选中，以提供清晰的视觉反馈。
- 经验3：通过组合式函数封装第三方库初始化逻辑，可以减少重复代码，提高配置一致性和可维护性。
