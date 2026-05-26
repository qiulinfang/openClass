<template>
  <div class="markdown-render-test">
    <div class="header-bar q-pa-md bg-white shadow-1 row items-center justify-between">
      <div class="text-h6">Markdown & LaTeX 渲染测试</div>
      <div class="row q-gutter-sm">
        <q-btn flat dense icon="arrow_back" label="返回" @click="$router.back()" />
        <q-btn color="primary" icon="refresh" label="重置示例" @click="resetToDefault" />
      </div>
    </div>

    <div class="main-content row">
      <!-- 左侧：输入区 -->
      <div class="input-panel col-6 q-pa-md border-right">
        <div class="section-title q-mb-sm row items-center">
          <q-icon name="edit" size="xs" class="q-mr-xs" />
          Markdown 输入
        </div>
        <q-input
          v-model="markdownInput"
          type="textarea"
          filled
          class="full-height-input"
          placeholder="在此输入 Markdown 或 LaTeX 内容..."
          spellcheck="false"
        />
        <div class="examples-grid q-mt-md">
          <div class="text-subtitle2 q-mb-xs">快速示例：</div>
          <div class="row q-gutter-xs">
            <q-btn
              v-for="(ex, index) in examples"
              :key="index"
              size="xs"
              outline
              color="grey-7"
              :label="ex.name"
              @click="markdownInput = ex.content"
            />
          </div>
        </div>
      </div>

      <!-- 右侧：渲染区 -->
      <div class="render-panel col-6 q-pa-md bg-grey-1">
        <div class="section-title q-mb-sm row items-center">
          <q-icon name="visibility" size="xs" class="q-mr-xs" />
          渲染效果 (useMessageRenderer)
        </div>
        <div class="render-container shadow-2 bg-white q-pa-lg">
          <div 
            class="markdown-content" 
            v-html="renderedHtml"
            ref="renderTarget"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useMessageRenderer } from '@/composables/useMessageRenderer'
import { MathJaxUtils } from '@/utils/math/mathjax'

const { renderMessageContent } = useMessageRenderer()
const renderTarget = ref<HTMLElement | null>(null)

// 默认测试内容
const defaultContent = `
# 标题测试 H1
## 标题测试 H2
### 标题测试 H3

**加粗文本**，*斜体文本*，~~删除线~~。

#### 数学公式测试

行内公式： \\\( E = mc^2 \\\) 或者 $x^2 + y^2 = r^2$

块级公式：
$$
\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$

分段函数：
\\\(
f(x) = \\begin{cases} 
x, & x > 0 \\\\
0, & x \\leq 0
\\end{cases}
\\\)

#### 列表与表格

1. 第一项
2. 第二项
   - 子项 A
   - 子项 B

| 姓名 | 年龄 | 角色 |
| :--- | :--- | :--- |
| 张三 | 18 | 学生 |
| 老师 | 35 | 辅导员 |

#### 代码块

\`\`\`javascript
const hello = "world";
console.log(hello);
\`\`\`
`

const markdownInput = ref(defaultContent)

const examples = [
  {
    name: '基础语法',
    content: defaultContent
  },
  {
    name: '复杂数学',
    content: `#### 线性代数
$$
A = \\begin{pmatrix}
a & b \\\\
c & d
\\end{pmatrix}, \\quad \\det(A) = ad - bc
$$

#### 积分与极限
$$
\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$
$$
\\lim_{n \\to \\infty} \\left(1 + \\frac{1}{n}\\right)^n = e
$$
`
  },
  {
    name: '混合文本',
    content: '已知点 \\\(P(x,y)\\\) 在圆 $x^2+y^2=1$ 上，求 $x+y$ 的最大值。\\n\\n**解析：**\\n可以使用三角代换，设 $x=\\cos\\theta, y=\\sin\\theta$，则 $x+y=\\cos\\theta+\\sin\\theta=\\sqrt{2}\\sin(\\theta+\\frac{\\pi}{4})$。'
  }
]

const renderedHtml = computed(() => {
  return renderMessageContent(markdownInput.value)
})

const resetToDefault = () => {
  markdownInput.value = defaultContent
}

// 监听内容变化，手动触发 MathJax 重新渲染
watch(() => renderedHtml.value, async () => {
  await nextTick()
  if (renderTarget.value) {
    await MathJaxUtils.renderMathAndWait(renderTarget.value)
  }
}, { immediate: true })

onMounted(async () => {
  await nextTick()
  if (renderTarget.value) {
    await MathJaxUtils.renderMathAndWait(renderTarget.value)
  }
})
</script>

<style scoped>
.markdown-render-test {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
  overflow: hidden;
}

.header-bar {
  height: 64px;
  z-index: 10;
}

.main-content {
  flex: 1;
  overflow: hidden;
}

.input-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.full-height-input {
  flex: 1;
  font-family: 'Fira Code', 'Consolas', monospace;
}

:deep(.full-height-input .q-field__control),
:deep(.full-height-input .q-field__control-container),
:deep(.full-height-input .q-field__native) {
  height: 100% !important;
}

.render-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.render-container {
  flex: 1;
  overflow-y: auto;
  border-radius: 8px;
  min-height: 200px;
}

.section-title {
  font-weight: bold;
  color: #555;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.border-right {
  border-right: 1px solid #ddd;
}

/* 模拟聊天气泡中的标题样式，确保测试效果与实际一致 */
.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  font-size: 16px;
  line-height: 1.5;
  font-weight: 600;
  margin: 8px 0;
}

.markdown-content :deep(p) {
  margin: 8px 0;
  line-height: 1.6;
}

.markdown-content :deep(img) {
  max-width: 100%;
}
</style>
