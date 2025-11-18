问题序号：PDF笔记display输入只读行为调整问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`低`
- **影响范围**：`PDF 阅读页已保存笔记的 display 输入框交互`
- **发现日期**：`2025-11-18`
- **解决状态**：`已解决`

## 问题现象
`PdfNoteAnchor.vue` 中的 display 模式用于展示已保存的笔记内容，最初实现使用了只读的 `q-input`：

- display 模式下渲染一个 `q-input`，`type="textarea"`，用于展示笔记内容。
- 设置了 `readonly` 属性，使得该输入框仅用于展示，无法直接修改。
- 后续需求调整为：display 模式下可以直接编辑已保存的笔记内容，不再依赖单独的编辑对话框。

## 复现步骤
1. 打开 PDF 阅读页，确保存在已保存的笔记。
2. 点击某个笔记锚点气泡 icon，展开 display 模式气泡。
3. 在显示的 `q-input` 中尝试修改文本内容。
4. 实际表现（调整前）：
   - 输入框为只读（`readonly`），无法修改内容。
5. 预期行为：
   - display 模式下可以直接修改文本，用于未来支持就地编辑（即使当前保存逻辑尚未完全打通）。

## 用户体验
- 影响点1：用户看到的是类似可编辑文本域的 UI（`q-input type="textarea"`），但实际却是只读，容易造成误解。
- 影响点2：后续计划将编辑功能从弹窗迁移到 display 气泡中，若保留 `readonly` 会导致功能无法实现。
- 影响点3：界面组件的外观与行为不一致，降低可用性与直觉性。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/PdfNoteAnchor.vue`：笔记锚点组件，负责 create/display 模式的输入与展示。
- **涉及模块**：
  - PDF 笔记展示与未来就地编辑模块。

## 技术原因 (❌)
1. 原因1：初期设计 display 模式仅作为“只读展示卡片”，直接给 `q-input` 加了 `readonly` 属性，没有为后续就地编辑预留空间。
2. 原因2：视觉上延续了输入框的形式，但功能上是纯展示，造成组件语义与行为不一致。
3. 原因3：未及时根据产品需求变化调整 display 模式的交互设计。

❌ 错误代码示例：
```vue
<!-- PdfNoteAnchor.vue（问题前，节选） -->
<!-- 已保存笔记提示卡片（display 模式且 active 时渲染） -->
<div
  v-if="mode === 'display' && active"
  class="note-tooltip"
  :style="tooltipStyle"
  @click.stop
>
  <q-card flat bordered class="note-input-card">
    <!-- 第一行：笔记内容 -->
    <q-input
      :model-value="text"
      type="textarea"
      autogrow
      borderless
      dense
      placeholder="暂无内容"
      :input-style="{ fontSize: '12px' }"
      readonly  <!-- ❌ 只读，无法支持就地编辑 -->
    />
  </q-card>
</div>
```

## 正确实现方案 (✅)
1. 方案1：移除 display 模式下 `q-input` 的 `readonly` 属性，让其可以接受用户输入，为后续的编辑保存逻辑铺路。
2. 方案2：保留现有的 `:model-value="text"` 展示方式，并在未来根据需要增加 `@update:model-value` 或单独的编辑确认逻辑，将修改后的文本同步回父组件。
3. 方案3：确保 display 模式仍通过 `active` 受控显示，避免在编辑时被误关闭或多个气泡同时展开。

✅ 正确代码示例：
```vue
<!-- PdfNoteAnchor.vue（修复后，节选） -->
<!-- 已保存笔记提示卡片（display 模式且 active 时渲染） -->
<div
  v-if="mode === 'display' && active"
  class="note-tooltip"
  :style="tooltipStyle"
  @click.stop
>
  <q-card flat bordered class="note-input-card">
    <q-input
      :model-value="text"
      type="textarea"
      autogrow
      borderless
      dense
      placeholder="暂无内容"
      :input-style="{ fontSize: '12px' }"
      <!-- ✅ 去掉 readonly，允许用户在此基础上输入 -->
    />
  </q-card>
</div>
```

> 说明：当前阶段仅去掉 `readonly`，display 模式下的修改暂未与实际持久化逻辑完全打通。但 UI 行为已与“可编辑”预期保持一致，为后续扩展编辑与保存逻辑提供基础。

## 关键代码/公式
- 代码片段1：`q-input` display 模式中去除 `readonly`。

```vue
<q-input
  :model-value="text"
  type="textarea"
  autogrow
  borderless
  dense
  placeholder="暂无内容"
  :input-style="{ fontSize: '12px' }"
/>
```

## 测试验证
- **测试场景**：
  - 场景1：点击已保存笔记锚点，展开 display 气泡，在输入框中尝试修改文本，确认光标可以移动、删除和输入字符。
- **验证方法**：
  - 方法1：手动输入测试文本，确认组件不再是只读状态。
  - 方法2：确保去掉 `readonly` 后没有引入其它副作用（如意外提交），后续再结合保存逻辑进行集成测试。

## 预防措施
- 措施1：在 UI 设计阶段明确组件的语义：如果采用输入框外观，应考虑是否真的只读，否则使用更明确的展示组件（如 `div`）。
- 措施2：在需求变更时，及时梳理相关组件的属性（如 `readonly`、`disabled` 等），避免遗留旧逻辑影响新功能。
- 措施3：对于计划扩展为“就地编辑”的区域，提前避免使用强约束属性（如 `readonly`），以降低后续改造成本。

## 相关链接/参考
- 相关文档：Quasar `QInput` 组件文档中关于 `readonly` 属性的说明。
- 相关Issue：无。
- 参考资源：无。

## 可复用经验
- 经验1：组件外观与行为必须一致，避免“看起来可编辑但实际不可编辑”的混淆情况。
- 经验2：对于展示型区域使用输入组件时，一定要明确未来是否会支持就地编辑，从而决定是否使用 `readonly`。
- 经验3：在演进设计（从只读展示到可编辑）时，应优先做减法（移除多余约束），再逐步增加保存与校验逻辑。
