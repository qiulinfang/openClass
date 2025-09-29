# 公式编辑器显示优化功能

## 功能概述

优化了公式编辑器的用户体验，实现了以下功能：

1. **失焦时隐藏公式编辑器**：当公式编辑器失去焦点时，自动隐藏MathLive编辑器，显示纯文本内容
2. **点击纯文本激活编辑器**：点击纯文本显示区域时，隐藏纯文本，显示公式编辑器并自动聚焦
3. **内容同步**：纯文本显示内容与公式编辑器内容实时同步

## 实现细节

### 1. 修改的文件

- `imates-web/src/utils/math/FormulaNodeBuilder.ts` - 核心实现
- `imates-web/src/components/chat/TiptapEditor.vue` - CSS样式支持

### 2. 新增功能

#### FormulaNodeBuilder.ts 新增方法：

- `createTextDisplay()` - 创建纯文本显示元素
- `updateTextDisplayStyle()` - 更新纯文本显示样式
- `handleTextDisplayClick()` - 处理纯文本点击事件
- `toggleDisplayMode()` - 切换显示模式（纯文本/公式编辑器）
- `updateTextDisplayContent()` - 更新纯文本显示内容

#### 修改的事件处理：

- **聚焦事件**：在聚焦时切换到公式编辑器显示模式
- **失焦事件**：在失焦时切换到纯文本显示模式
- **输入事件**：在输入时同步更新纯文本显示内容

### 3. CSS样式

#### TiptapEditor.vue 新增样式：

```css
/* 纯文本显示样式 */
:deep(.formula-text-display) {
  display: inline-block;
  padding: 2px 6px;
  margin: 0 2px;
  border: 1px solid #e0e0e0;
  border-radius: 3px;
  background: #f8f9fa;
  color: #333;
  cursor: pointer;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.2;
  min-width: 20px;
  min-height: 20px;
  transition: all 0.2s ease;
  user-select: none;
}

:deep(.formula-text-display:hover) {
  border-color: #007bff;
  background: rgba(0, 123, 255, 0.05);
}
```

## 使用方式

1. 在TiptapEditor中插入数学公式
2. 当公式编辑器失去焦点时，会自动显示为纯文本
3. 点击纯文本区域可以重新激活公式编辑器
4. 编辑过程中内容会实时同步

## 技术特点

- **无缝切换**：纯文本和公式编辑器之间的切换是平滑的
- **内容同步**：确保两种显示模式的内容始终保持一致
- **用户体验**：减少了视觉干扰，提供了更清晰的编辑界面
- **性能优化**：只在需要时显示复杂的MathLive编辑器

## 测试方法

1. 启动开发服务器：`npm run dev`
2. 访问应用并进入聊天界面
3. 插入数学公式进行测试
4. 观察失焦和聚焦时的显示切换效果

## 注意事项

- 纯文本显示使用等宽字体（monospace）以确保格式一致性
- 点击事件已阻止冒泡，避免与编辑器其他功能冲突
- 样式设计考虑了与现有UI的一致性
