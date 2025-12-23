<template>
  <div class="api-debug-view">
    <div class="header">
      <div class="title">接口调试面板</div>
      <div class="sub">输入 URL / 方法 / JSON 请求体，一键调用并查看响应</div>
    </div>

    <div class="panel">
      <div class="row">
        <label class="label">方法</label>
        <select v-model="method" class="input select">
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </select>

        <label class="label">超时</label>
        <input v-model.number="timeoutMs" class="input" type="number" min="0" step="1000" placeholder="ms" />

        <label class="label">URL</label>
        <input v-model="url" class="input" placeholder="例如：/biologyTopicKnowledge/knowledgeTopicAndAck2" />

        <button class="btn" :disabled="loading" @click="callApi">调用</button>
        <button class="btn secondary" :disabled="loading" @click="fillKnowledgeTopicAndAck2">填充 knowledgeTopicAndAck2 模板</button>
      </div>

      <div class="row full">
        <label class="label">请求体（JSON，仅 POST/PUT 生效）</label>
        <textarea v-model="bodyText" class="textarea" spellcheck="false" placeholder='例如：{"bmNoList":"1001,1002"}'></textarea>
      </div>

      <div class="row full">
        <label class="label">请求日志</label>
        <pre class="pre">{{ requestLog }}</pre>
      </div>

      <div class="row full">
        <label class="label">响应</label>
        <pre class="pre" :class="{ error: !!errorText }">{{ errorText || responseText }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { httpClient } from '../services'

const method = ref<'GET' | 'POST' | 'PUT' | 'DELETE'>('POST')
const url = ref('/biologyTopicKnowledge/knowledgeTopicAndAck2')
const bodyText = ref('{\n  "bmNoList": "1001,1002,1003"\n}')
const timeoutMs = ref<number>(30000)

const loading = ref(false)
const errorText = ref('')
const responseText = ref('')

const requestLog = computed(() => {
  const lines: string[] = []
  lines.push(`${method.value} ${url.value}`)
  lines.push(`Timeout: ${timeoutMs.value}ms`)
  if (method.value === 'POST' || method.value === 'PUT') {
    lines.push('Body:')
    lines.push(bodyText.value || '')
  }
  return lines.join('\n')
})

function safePrettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function parseBody(): unknown {
  const t = (bodyText.value || '').trim()
  if (!t) return {}
  return JSON.parse(t)
}

async function callApi() {
  loading.value = true
  errorText.value = ''
  responseText.value = ''

  try {
    const u = (url.value || '').trim()
    if (!u) {
      throw new Error('URL 不能为空')
    }

    const requestConfig = {
      timeout: Math.max(0, Number(timeoutMs.value) || 0),
    }

    if (method.value === 'GET') {
      const resp = await httpClient.get<any>(u, requestConfig)
      responseText.value = safePrettyJson(resp)
      return
    }

    if (method.value === 'DELETE') {
      const resp = await httpClient.delete<any>(u, requestConfig)
      responseText.value = safePrettyJson(resp)
      return
    }

    const body = parseBody()

    if (method.value === 'POST') {
      const resp = await httpClient.post<any>(u, body, requestConfig)
      responseText.value = safePrettyJson(resp)
      return
    }

    const resp = await httpClient.put<any>(u, body, requestConfig)
    responseText.value = safePrettyJson(resp)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    errorText.value = message
  } finally {
    loading.value = false
  }
}

function fillKnowledgeTopicAndAck2() {
  method.value = 'POST'
  url.value = '/biologyTopicKnowledge/knowledgeTopicAndAck2'
  bodyText.value = '{\n  "bmNoList": "1001,1002,1003",\n  "exercisesId": ""\n}'
  timeoutMs.value = 30000
}
</script>

<style scoped>
.api-debug-view {
  min-height: 100vh;
  padding: 16px;
  box-sizing: border-box;
  background: #0b1220;
  color: #e5e7eb;
}

.header {
  margin-bottom: 12px;
}

.title {
  font-size: 18px;
  font-weight: 700;
}

.sub {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(229, 231, 235, 0.7);
}

.panel {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 12px;
}

.row {
  display: grid;
  grid-template-columns: 60px 120px 40px 120px 40px 1fr auto auto;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.row.full {
  grid-template-columns: 1fr;
}

.label {
  font-size: 12px;
  color: rgba(229, 231, 235, 0.7);
}

.input {
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #e5e7eb;
  padding: 0 10px;
  outline: none;
}

.select {
  padding-right: 6px;
}

.textarea {
  width: 100%;
  min-height: 140px;
  resize: vertical;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #e5e7eb;
  padding: 10px;
  outline: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  line-height: 1.45;
}

.btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(99, 102, 241, 0.85);
  color: #fff;
  cursor: pointer;
}

.btn.secondary {
  background: rgba(16, 185, 129, 0.75);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pre {
  width: 100%;
  white-space: pre-wrap;
  word-break: break-word;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
  color: #e5e7eb;
  padding: 10px;
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  line-height: 1.45;
}

.pre.error {
  border-color: rgba(239, 68, 68, 0.6);
  color: rgba(252, 165, 165, 1);
}
</style>
