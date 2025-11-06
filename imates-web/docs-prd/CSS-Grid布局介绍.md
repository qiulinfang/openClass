# CSS Grid 布局介绍

## 一、Grid 布局概述

CSS Grid（网格布局）是一种二维布局系统，可以同时处理行和列，非常适合创建复杂的页面布局。与 Flexbox（一维布局）相比，Grid 更适合整体页面布局，而 Flexbox 更适合组件内部布局。

## 二、基本概念

### 2.1 容器和项目

- **Grid 容器（Grid Container）**：设置了 `display: grid` 的元素
- **Grid 项目（Grid Item）**：Grid 容器的直接子元素
- **网格线（Grid Line）**：组成网格的分界线
- **网格轨道（Grid Track）**：两条网格线之间的空间（行或列）
- **网格单元格（Grid Cell）**：四条网格线围成的区域
- **网格区域（Grid Area）**：一个或多个网格单元格组成的区域

### 2.2 行和列

- **行（Row）**：水平方向的网格轨道
- **列（Column）**：垂直方向的网格轨道
- **间距（Gap）**：行与行、列与列之间的间距

## 三、容器属性

### 3.1 display

定义网格容器：

```css
.container {
  display: grid;        /* 块级网格 */
  display: inline-grid; /* 行内网格 */
}
```

### 3.2 grid-template-columns 和 grid-template-rows

定义网格的行和列：

```css
.container {
  /* 定义3列，宽度分别为 200px 100px 200px */
  grid-template-columns: 200px 100px 200px;
  
  /* 定义2行，高度分别为 100px 200px */
  grid-template-rows: 100px 200px;
  
  /* 使用 fr 单位（fraction，分数） */
  grid-template-columns: 1fr 2fr 1fr; /* 1:2:1 的比例 */
  
  /* 使用 repeat() 函数 */
  grid-template-columns: repeat(3, 100px); /* 3列，每列100px */
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); /* 自动填充 */
  
  /* 使用 minmax() 函数 */
  grid-template-columns: minmax(100px, 1fr) 2fr 1fr;
  
  /* 使用 auto */
  grid-template-columns: auto 1fr auto; /* 自动宽度 */
}
```

### 3.3 grid-template-areas

通过命名区域定义网格布局：

```css
.container {
  grid-template-areas:
    "header header header"
    "sidebar main main"
    "footer footer footer";
}

.header { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main { grid-area: main; }
.footer { grid-area: footer; }
```

### 3.4 gap（grid-gap）

设置网格间距：

```css
.container {
  gap: 20px;              /* 行和列间距都是20px */
  row-gap: 20px;         /* 行间距 */
  column-gap: 30px;      /* 列间距 */
  gap: 20px 30px;        /* 行间距 列间距 */
}
```

### 3.5 grid-auto-flow

控制自动放置算法：

```css
.container {
  grid-auto-flow: row;        /* 默认，按行填充 */
  grid-auto-flow: column;     /* 按列填充 */
  grid-auto-flow: dense;      /* 密集模式，尝试填充空隙 */
  grid-auto-flow: row dense;  /* 按行密集填充 */
}
```

### 3.6 grid-auto-columns 和 grid-auto-rows

定义隐式网格轨道的大小：

```css
.container {
  grid-auto-columns: 100px;  /* 隐式列的宽度 */
  grid-auto-rows: 150px;     /* 隐式行的高度 */
  grid-auto-rows: minmax(100px, auto); /* 最小100px，最大自适应 */
}
```

### 3.7 justify-items 和 align-items

控制网格项目在单元格内的对齐方式：

```css
.container {
  justify-items: start;    /* 水平方向：左对齐 */
  justify-items: end;      /* 水平方向：右对齐 */
  justify-items: center;   /* 水平方向：居中 */
  justify-items: stretch;  /* 水平方向：拉伸（默认） */
  
  align-items: start;      /* 垂直方向：顶部对齐 */
  align-items: end;        /* 垂直方向：底部对齐 */
  align-items: center;     /* 垂直方向：居中 */
  align-items: stretch;    /* 垂直方向：拉伸（默认） */
  
  place-items: center;     /* 简写：align-items justify-items */
}
```

### 3.8 justify-content 和 align-content

控制整个网格在容器内的对齐方式（当网格总尺寸小于容器时）：

```css
.container {
  justify-content: start;      /* 水平方向：左对齐 */
  justify-content: end;        /* 水平方向：右对齐 */
  justify-content: center;     /* 水平方向：居中 */
  justify-content: stretch;    /* 水平方向：拉伸 */
  justify-content: space-around;  /* 水平方向：周围留白 */
  justify-content: space-between; /* 水平方向：两端对齐 */
  justify-content: space-evenly;   /* 水平方向：均匀分布 */
  
  align-content: start;        /* 垂直方向：顶部对齐 */
  align-content: end;          /* 垂直方向：底部对齐 */
  align-content: center;       /* 垂直方向：居中 */
  align-content: stretch;      /* 垂直方向：拉伸 */
  align-content: space-around; /* 垂直方向：周围留白 */
  align-content: space-between; /* 垂直方向：两端对齐 */
  align-content: space-evenly;   /* 垂直方向：均匀分布 */
  
  place-content: center;       /* 简写：align-content justify-content */
}
```

## 四、项目属性

### 4.1 grid-column-start、grid-column-end、grid-row-start、grid-row-end

指定项目占据的网格线：

```css
.item {
  grid-column-start: 1;    /* 从第1条列线开始 */
  grid-column-end: 3;      /* 到第3条列线结束（占据2列） */
  grid-row-start: 1;       /* 从第1条行线开始 */
  grid-row-end: 3;         /* 到第3条行线结束（占据2行） */
}
```

### 4.2 grid-column 和 grid-row

简写属性：

```css
.item {
  grid-column: 1 / 3;      /* 从第1条列线到第3条列线 */
  grid-row: 1 / 3;         /* 从第1条行线到第3条行线 */
  
  grid-column: 1 / span 2; /* 从第1条列线开始，跨越2列 */
  grid-row: 2 / span 3;    /* 从第2条行线开始，跨越3行 */
  
  grid-column: span 2;     /* 跨越2列（自动计算起始位置） */
}
```

### 4.3 grid-area

指定项目占据的区域：

```css
.item {
  /* 方式1：使用命名区域 */
  grid-area: header;
  
  /* 方式2：使用网格线 */
  grid-area: 1 / 1 / 3 / 3; /* row-start / column-start / row-end / column-end */
  grid-area: 1 / 1 / span 2 / span 2; /* 使用 span */
}
```

### 4.4 justify-self 和 align-self

控制单个项目在单元格内的对齐方式：

```css
.item {
  justify-self: start;    /* 水平方向：左对齐 */
  justify-self: end;      /* 水平方向：右对齐 */
  justify-self: center;   /* 水平方向：居中 */
  justify-self: stretch;  /* 水平方向：拉伸（默认） */
  
  align-self: start;      /* 垂直方向：顶部对齐 */
  align-self: end;        /* 垂直方向：底部对齐 */
  align-self: center;     /* 垂直方向：居中 */
  align-self: stretch;    /* 垂直方向：拉伸（默认） */
  
  place-self: center;     /* 简写：align-self justify-self */
}
```

## 五、常用布局模式

### 5.1 12列网格系统

```css
.container {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 20px;
}

.col-1 { grid-column: span 1; }
.col-2 { grid-column: span 2; }
.col-3 { grid-column: span 3; }
.col-4 { grid-column: span 4; }
.col-6 { grid-column: span 6; }
.col-12 { grid-column: span 12; }
```

### 5.2 响应式布局

```css
.container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

/* 或者使用媒体查询 */
.container {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

@media (min-width: 768px) {
  .container {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .container {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### 5.3 圣杯布局（Holy Grail Layout）

```css
.container {
  display: grid;
  grid-template-areas:
    "header header header"
    "nav main aside"
    "footer footer footer";
  grid-template-columns: 200px 1fr 200px;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
}

.header { grid-area: header; }
.nav { grid-area: nav; }
.main { grid-area: main; }
.aside { grid-area: aside; }
.footer { grid-area: footer; }
```

### 5.4 卡片网格布局

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  padding: 20px;
}
```

### 5.5 瀑布流布局（Masonry）

```css
.masonry {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  grid-auto-rows: 10px; /* 小行高，用于精确控制 */
  gap: 20px;
}

.masonry-item {
  grid-row-end: span var(--row-span); /* 通过 JS 计算行数 */
}
```

## 六、Grid vs Flexbox

| 特性 | Grid | Flexbox |
|------|------|---------|
| 维度 | 二维（行和列） | 一维（行或列） |
| 适用场景 | 整体页面布局 | 组件内部布局 |
| 对齐方式 | 更强大的对齐控制 | 简单的对齐控制 |
| 重叠 | 支持项目重叠 | 不支持重叠 |
| 浏览器支持 | 现代浏览器 | 更好的浏览器支持 |

**选择建议：**
- 使用 **Grid**：整体页面布局、复杂的二维布局
- 使用 **Flexbox**：组件内部布局、一维布局、对齐和分布

## 七、实际应用示例

### 7.1 Vue 组件中的 Grid 布局

```vue
<template>
  <div class="grid-container">
    <div class="item item-1">1</div>
    <div class="item item-2">2</div>
    <div class="item item-3">3</div>
    <div class="item item-4">4</div>
    <div class="item item-5">5</div>
    <div class="item item-6">6</div>
  </div>
</template>

<style scoped>
.grid-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  padding: 20px;
}

.item {
  background: #f0f0f0;
  padding: 20px;
  text-align: center;
}

.item-1 {
  grid-column: span 2; /* 占据2列 */
}

.item-4 {
  grid-row: span 2; /* 占据2行 */
}
</style>
```

### 7.2 响应式图片网格

```css
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.image-item {
  width: 100%;
  height: 0;
  padding-bottom: 100%; /* 1:1 宽高比 */
  position: relative;
  overflow: hidden;
}

.image-item img {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

## 八、浏览器兼容性

- **现代浏览器**：Chrome 57+、Firefox 52+、Safari 10.1+、Edge 16+
- **移动端**：iOS Safari 10.3+、Chrome Android 57+
- **IE 11**：部分支持（需要 `-ms-` 前缀）

## 九、最佳实践

1. **渐进增强**：为不支持 Grid 的浏览器提供回退方案
2. **使用 fr 单位**：更灵活的比例分配
3. **合理使用 gap**：替代 margin，避免间距问题
4. **命名区域**：使用 `grid-template-areas` 提高可读性
5. **响应式设计**：结合媒体查询或 `auto-fit/auto-fill` 实现响应式
6. **性能考虑**：Grid 性能优秀，适合复杂布局

## 十、总结

CSS Grid 布局是现代 Web 开发中强大的布局工具，特别适合：
- 复杂的二维布局
- 整体页面结构
- 响应式网格系统
- 需要精确控制项目位置的场景

掌握 Grid 布局可以大大提高布局开发的效率和灵活性。

