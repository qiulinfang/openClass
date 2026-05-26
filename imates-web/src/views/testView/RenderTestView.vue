<template>
  <div class="render-test-view">
    <div class="header">
      <div class="title">渲染测试页（无预处理）</div>
      <div class="desc">同一份 Raw 内容并排对比：MathJax vs KaTeX（katex plugin / texmath）</div>
    </div>

    <div class="grid">
      <div class="panel">
        <div class="panel-title">输入（Raw）</div>
        <textarea v-model="raw" class="editor" spellcheck="false" />
        <div class="actions">
          <button class="btn" @click="reset">重置示例</button>
          <button class="btn primary" @click="renderNow">重新渲染</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">输出（MathJax）</div>
        <div ref="previewMathJaxRef" class="preview" v-html="htmlMathJax"></div>
      </div>

      <div class="panel">
        <div class="panel-title">输出（KaTeX / markdown-it-katex）</div>
        <div class="preview" v-html="htmlKatex"></div>
      </div>

      <div class="panel">
        <div class="panel-title">输出（KaTeX / markdown-it-texmath）</div>
        <div class="preview" v-html="htmlTexmath"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import mathjax3 from 'markdown-it-mathjax3'
import katexPlugin from 'markdown-it-katex'
import texmath from 'markdown-it-texmath'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { MathJaxUtils } from '@/utils/math/mathjax'

defineOptions({
  name: 'RenderTestView',
})

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
}).use(mathjax3)

const mdKatex = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
}).use(katexPlugin)

const mdTexmath = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
}).use(texmath, {
  engine: katex,
  // mac: 支持 \(\) / \[\] 等 LaTeX 标准定界符
  delimiters: 'mac',
})

const example = `成功我们先看第一个不等式① \\\(ac^2 \\geq bc^2\\\)，已知 \\\(a > b\\\)，这里有没有需要注意的特殊情况呀？`

const raw = ref(example)
const htmlMathJax = ref('')
const htmlKatex = ref('')
const htmlTexmath = ref('')
const previewMathJaxRef = ref<HTMLElement | null>(null)

const renderNow = async () => {
  htmlMathJax.value = md.render(raw.value)
  htmlKatex.value = mdKatex.render(raw.value)
  htmlTexmath.value = mdTexmath.render(raw.value)
  await nextTick()
  if (previewMathJaxRef.value) {
    await MathJaxUtils.renderMathAndWait(previewMathJaxRef.value)
  }
}

const reset = async () => {
  raw.value = example
  await renderNow()
}

watch(
  () => raw.value,
  async () => {
    await renderNow()
  },
  { immediate: true },
)
</script>

<style scoped>
.render-test-view {
  padding: 16px;
  height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
  background: #f7f7fb;
}

.header {
  margin-bottom: 12px;
}

.title {
  font-size: 18px;
  font-weight: 600;
  color: #1f1f1f;
}

.desc {
  margin-top: 4px;
  font-size: 12px;
  color: #666;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 12px;
  height: calc(100vh - 72px);
}

.panel {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-title {
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  color: #333;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.editor {
  flex: 1;
  width: 100%;
  border: 0;
  outline: none;
  resize: none;
  padding: 12px;
  font-size: 13px;
  line-height: 1.6;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  box-sizing: border-box;
}

.preview {
  flex: 1;
  padding: 12px;
  overflow: auto;
  color: #222;
  line-height: 1.7;
  font-size: 14px;
  background: #fff;
}

.actions {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.btn {
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: #fff;
  color: #333;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
}

.btn.primary {
  border-color: #1976d2;
  background: #1976d2;
  color: #fff;
}
</style>
