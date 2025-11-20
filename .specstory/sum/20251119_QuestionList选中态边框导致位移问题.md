问题序号：QuestionList选中态边框导致位移问题

## 问题元信息
- **问题分类**：`[前端]`
- **严重程度**：`[中]`
- **影响范围**：`[imates-web 题目列表 QuestionList 组件的选中高亮效果]`
- **发现日期**：`2025-11-19`
- **解决状态**：`[已解决]`

## 问题现象
在 `QuestionList` 组件中，用户点击某一题目卡片使其进入选中态时，卡片会发生轻微的“位移/跳动”现象，表现为：

- 未选中时卡片位置对齐正常；
- 一旦选中（添加紫色描边后），卡片整体向内缩了一小截；
- 再次切换选中/未选中时，列表中的卡片出现不自然的抖动感。

## 复现步骤
1. 打开包含 `QuestionList` 的练习解题页面（ExerciseSolveView）。
2. 确保题目列表中存在多道题目。
3. 使用鼠标依次点击不同题目卡片，使其进入选中态/取消选中态。
4. 观察选中态切换瞬间，卡片布局是否有轻微位移。

## 用户体验
- 影响点1：选中某一题目时，卡片发生偏移，给人一种“界面在抖”的不稳定感。
- 影响点2：当频繁切换题目时，列表整体显得不够平滑和专业，影响视觉体验。
- 影响点3：对部分用户（尤其是对 UI 敏感的用户）会误以为是布局 bug 或排版错误。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/QuestionList.vue`：题目列表组件，包含题目卡片的结构与样式。
- **涉及模块**：
  - 题目列表呈现模块：负责题目卡片的 UI 布局和选中态样式。

## 技术原因 (❌)
1. 选中态使用 border 增加了元素尺寸：
   - 在 `.question-item` 的选中态样式中：
   ```scss
   &.question-selected {
     .question-block {
       background-color: $background-white;
       border: 1px solid #8b5cf6;
       border-radius: 12px;
       box-shadow: none;
     }
   }
   ```
   - 未选中状态下，`.question-block` 没有 border；
   - 选中状态加上 `1px` 边框后，元素总宽高发生变化，导致卡片在 Flex 布局中重新排布时出现细微位移。
2. 卡片外层容器没有为边框预留空间：
   - `.question-card` 原样式中还定义了 `padding: 4px;`（后续为配合伪元素方案已移除）。
   - 在不同状态下 padding + border 的总和不一致，更容易导致视觉上的“跳动”。

## 正确实现方案 (✅)
1. 去掉真实 border，改为使用伪元素渲染高亮描边：
   - 在 `.question-item` 的选中态中，不再给 `.question-block` 添加 `border`：
   ```scss
   &.question-selected {
     position: relative; // 确保可以相对定位伪元素

     .question-block {
       background-color: $background-white;
       border-radius: 12px;
       box-shadow: none;
     }

     // 用 ::before 画出紫色描边，不影响布局
     &::before {
       content: '';
       position: absolute;
       inset: 0;               // 覆盖整个 li 区域
       border-radius: 12px;
       pointer-events: none;
       box-shadow: 0 0 0 1px #8b5cf6; // 相当于 1px 边框，但不占空间
     }
   }
   ```
2. 保持选中/未选中时元素尺寸一致：
   - 通过伪元素 `::before` 绘制描边，实质上是绘制在“外层 overlay”上，而不是改变 DOM 元素本身的盒模型；
   - 这样无论是否选中，`.question-block` 的 `width/height` 保持不变，消除位移问题。
3. 清理多余 padding，减少布局干扰：
   - 将 `.question-card` 上原有的 `padding: 4px;` 移除，以保证整体布局更可控：
   ```scss
   .question-card {
     cursor: pointer;
     overflow: visible;
     transform: translateZ(0);
     backface-visibility: hidden;
     border: none;
     border-radius: 16px;
     background-color: transparent;
     transition: $transition-smooth;
     box-shadow: none;
     min-width: 0; // 允许卡片收缩以处理长内容

     &.question-deleting {
       opacity: 0.6;
       pointer-events: none;
     }
   }
   ```

## 关键代码/公式
- **错误实现（❌）**：
  ```scss
  &.question-selected {
    .question-block {
      background-color: $background-white;
      border: 1px solid #8b5cf6; // 改变盒模型，导致位移
      border-radius: 12px;
      box-shadow: none;
    }
  }
  ```

- **正确实现（✅）**：
  ```scss
  &.question-selected {
    position: relative;
    .question-block {
      background-color: $background-white;
      border-radius: 12px;
      box-shadow: none;
    }

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 12px;
      pointer-events: none;
      box-shadow: 0 0 0 1px #8b5cf6;
    }
  }
  ```

## 测试验证
- **测试场景**：
  - 场景1：单个题目选中/取消
    - 步骤：在 QuestionList 中反复点击同一题目卡片切换选中态。
    - 预期：卡片位置固定不动，仅描边出现/消失，没有“跳动”感。
  - 场景2：多题之间快速切换
    - 步骤：快速在多道题目之间切换选中状态。
    - 预期：列表整体布局稳定，不会因为选中效果导致每行高度/位置抖动。
- **验证方法**：
  - 方法1：使用浏览器 DevTools 查看选中前后元素的 `offsetTop/offsetLeft` 是否变化。
  - 方法2：在高缩放比（如 150%）下人工观察，确认视觉上没有抖动。

## 预防措施
- 措施1：在设计选中态、高亮态时，尽量避免使用会改变盒模型（box model）的属性（如 border、padding）来实现视觉效果。
- 措施2：优先使用 `box-shadow`、`outline` 或伪元素来实现描边和高亮，降低对布局的影响。
- 措施3：对列表/卡片类组件，在引入新样式前，可先在浏览器中对比元素尺寸，避免引入“动态抖动”。

## 相关链接/参考
- 相关文档：`20250111_QuestionList批量渲染加载逻辑改造.md`（如需了解 QuestionList 其他优化背景）。

## 可复用经验
- 经验1：列表/卡片选中态的视觉效果应尽量不改变元素的几何尺寸，防止重排和位移。
- 经验2：伪元素 + `box-shadow` 是实现“无侵入描边”的通用方案，适用于多种 UI 高亮需求。
- 经验3：在组件级别抽象样式时，优先考虑“视觉状态”和“布局状态”解耦，提高 UI 的稳定性。
