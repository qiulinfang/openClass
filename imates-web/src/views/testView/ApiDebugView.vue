<template>
  <div class="api-debug-dashboard q-pa-md bg-dark text-white min-h-screen">
    <div class="row q-col-gutter-md">
      <!-- 左侧：预设与历史 -->
      <div class="col-12 col-md-3">
        <q-card flat bordered class="bg-card full-height overflow-hidden flex column">
          <q-card-section class="q-pb-none">
            <div class="text-h6 row items-center justify-between">
              <div class="row items-center">
                <q-icon name="dashboard" class="q-mr-sm" color="primary" />
                <span>API 控制台</span>
              </div>
              <div class="env-selector row items-center">
                <q-select
                  v-model="currentEnv"
                  :options="envOptions"
                  emit-value
                  map-options
                  outlined
                  dense
                  dark
                  options-dense
                  style="min-width: 120px"
                  @update:model-value="handleEnvChange"
                />
              </div>
            </div>
          </q-card-section>

          <q-tabs v-model="leftTab" dense class="text-grey" active-color="primary" indicator-color="primary" align="justify">
            <q-tab name="presets" label="预设模板" />
            <q-tab name="history" label="历史记录" />
          </q-tabs>

          <q-separator />

          <q-tab-panels v-model="leftTab" animated class="bg-transparent flex-1 overflow-auto">
            <q-tab-panel name="presets" class="q-pa-none">
              <q-list dense separator>
                <q-expansion-item
                  v-for="(group, gIndex) in apiPresets"
                  :key="gIndex"
                  :label="group.groupName"
                  header-class="text-weight-bold text-grey-4"
                >
                  <q-item
                    v-for="(api, aIndex) in group.items"
                    :key="aIndex"
                    clickable
                    @click="applyPreset(api)"
                    class="preset-item q-py-sm"
                  >
                    <q-item-section side>
                      <q-badge :color="getMethodColor(api.method)" :label="api.method" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label class="text-caption text-grey-2">{{ api.name }}</q-item-label>
                      <q-item-label caption class="text-grey-6 ellipsis">{{ api.url }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-expansion-item>
              </q-list>
            </q-tab-panel>

            <q-tab-panel name="history" class="q-pa-none">
              <div v-if="history.length === 0" class="text-center q-pa-md text-grey-6">
                暂无调用历史
              </div>
              <q-list v-else dense separator>
                <q-item
                  v-for="(item, index) in history"
                  :key="index"
                  clickable
                  @click="applyHistory(item)"
                  class="q-py-sm"
                >
                  <q-item-section side>
                    <q-badge :color="item.success ? 'positive' : 'negative'" :label="item.status" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="text-caption text-grey-2">{{ item.url }}</q-item-label>
                    <q-item-label caption class="text-grey-6">{{ item.time }} | {{ item.latency }}ms</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-tab-panel>
          </q-tab-panels>
        </q-card>
      </div>

      <!-- 右侧：主操作区 -->
      <div class="col-12 col-md-9">
        <div class="column q-gutter-y-md">
          <!-- 顶部统计 -->
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-4">
              <q-card flat bordered class="bg-card text-center q-pa-sm">
                <div class="text-grey-5 text-caption">总调用次数</div>
                <div class="text-h5 text-weight-bold text-primary">{{ stats.total }}</div>
              </q-card>
            </div>
            <div class="col-12 col-sm-4">
              <q-card flat bordered class="bg-card text-center q-pa-sm">
                <div class="text-grey-5 text-caption">平均响应时间</div>
                <div class="text-h5 text-weight-bold text-secondary">{{ stats.avgLatency }}ms</div>
              </q-card>
            </div>
            <div class="col-12 col-sm-4">
              <q-card flat bordered class="bg-card text-center q-pa-sm">
                <div class="text-grey-5 text-caption">成功率</div>
                <div class="text-h5 text-weight-bold" :class="stats.successRate >= 90 ? 'text-positive' : 'text-warning'">
                  {{ stats.successRate }}%
                </div>
              </q-card>
            </div>
          </div>

          <!-- 请求配置 -->
          <q-card flat bordered class="bg-card">
            <q-card-section class="q-pb-none">
              <div class="row items-center q-gutter-sm">
                <q-select
                  v-model="method"
                  :options="['GET', 'POST', 'PUT', 'DELETE']"
                  outlined
                  dense
                  dark
                  label="方法"
                  class="col-auto"
                  style="width: 100px"
                />
                <q-input
                  v-model="url"
                  outlined
                  dense
                  dark
                  label="URL"
                  class="col"
                  placeholder="请输入 API 路径..."
                />
                <q-input
                  v-model.number="timeoutMs"
                  outlined
                  dense
                  dark
                  type="number"
                  label="超时(ms)"
                  class="col-auto"
                  style="width: 100px"
                />
                <q-btn
                  color="primary"
                  label="发送请求"
                  :loading="loading"
                  @click="callApi"
                  class="q-px-lg"
                  unelevated
                />
              </div>
            </q-card-section>

            <q-card-section>
              <div class="text-caption text-grey-5 q-mb-xs">请求体 (JSON)</div>
              <q-input
                v-model="bodyText"
                type="textarea"
                outlined
                dark
                dense
                input-style="font-family: monospace; font-size: 12px; height: 120px"
                placeholder='{"key": "value"}'
              />
            </q-card-section>
          </q-card>

          <!-- 响应结果 -->
          <q-card flat bordered class="bg-card flex-1 min-h-[400px] column">
            <q-card-section class="row items-center justify-between q-pb-none">
              <div class="text-subtitle1 text-weight-bold">响应结果</div>
              <div v-if="lastResponse" class="row items-center q-gutter-x-md">
                <q-badge :color="lastResponse.success ? 'positive' : 'negative'" class="q-pa-xs">
                  Status: {{ lastResponse.status }}
                </q-badge>
                <q-badge color="grey-8" class="q-pa-xs">
                  Time: {{ lastResponse.latency }}ms
                </q-badge>
                <q-btn flat dense icon="content_copy" size="sm" color="grey-5" @click="copyToClipboard(responseText)">
                  <q-tooltip>复制响应</q-tooltip>
                </q-btn>
              </div>
            </q-card-section>

            <q-separator dark class="q-my-sm" />

            <q-card-section class="flex-1 overflow-auto q-pa-none relative-position">
              <div v-if="loading" class="absolute-full flex flex-center bg-dark-dim z-10">
                <q-spinner-dots color="primary" size="40px" />
              </div>

              <div v-if="!responseText && !errorText" class="absolute-full flex flex-center text-grey-7">
                等待请求发送...
              </div>

              <pre
                v-else
                class="response-pre"
                :class="{ 'text-negative': !!errorText }"
              >{{ errorText || responseText }}</pre>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, reactive } from 'vue'
import { httpClient } from '@/services'
import { useQuasar } from 'quasar'
import { getApiPaths, getCurrentEnvType, trySwitchEnv, AppEnvType } from '../../config/env-config'

const $q = useQuasar()
const currentEnv = ref<AppEnvType>(getCurrentEnvType())
const envOptions = [
  { label: '正式环境', value: AppEnvType.RELEASE },
  { label: '测试环境', value: AppEnvType.INTERNAL_TEST }
]

const handleEnvChange = (targetEnv: AppEnvType) => {
  const success = trySwitchEnv(targetEnv, '985211')
  if (success) {
    $q.notify({
      type: 'positive',
      message: `环境已成功切换为 ${targetEnv === AppEnvType.INTERNAL_TEST ? '测试环境' : '正式环境'}`,
      position: 'top',
      timeout: 1000
    })
    setTimeout(() => {
      window.location.reload()
    }, 500)
  } else {
    $q.notify({
      type: 'negative',
      message: '环境切换失败，请检查密码权限',
      position: 'top'
    })
  }
}

const apiPaths = getApiPaths()

const leftTab = ref('presets')
const method = ref<'GET' | 'POST' | 'PUT' | 'DELETE'>('POST')
const url = ref(apiPaths.xueban.biologyTopicKnowledge.knowledgeTopicAndAck2)
const bodyText = ref('{\n  "bmNoList": "1001,1002,1003"\n}')
const timeoutMs = ref<number>(30000)

const loading = ref(false)
const errorText = ref('')
const responseText = ref('')
const lastResponse = ref<{ status: number | string; latency: number; success: boolean } | null>(null)

// 历史记录
const history = ref<any[]>([])

// 统计数据
const stats = reactive({
  total: 0,
  avgLatency: 0,
  successRate: 0,
  successCount: 0,
  totalLatency: 0
})

// API 预设数据 - 根据 env-config.ts 梳理
const apiPresets = [
  {
    groupName: '学伴 AI 服务',
    items: [
      {
        name: '数学 AI 聊天',
        method: 'POST',
        url: apiPaths.xueban.ai.chatMath,
        body: '{\n  "content": "求导函数 y=x^2",\n  "subject": "math"\n}'
      },
      {
        name: '图片/截图问答',
        method: 'POST',
        url: apiPaths.xueban.ai.previewPictureQA,
        body: '{\n  "base64DataUrl": "data:image/png;base64,...",\n  "content": "这道题怎么做？"\n}'
      },
      {
        name: '多轮对话',
        method: 'POST',
        url: apiPaths.xueban.ai.chats,
        body: '{\n  "messages": [\n    {"role": "user", "content": "你好"}\n  ]\n}'
      }
    ]
  },
  {
    groupName: '题目与知识点',
    items: [
      {
        name: '知识点查相似题 (v2)',
        method: 'POST',
        url: apiPaths.xueban.biologyTopicKnowledge.knowledgeTopicAndAck2,
        body: '{\n  "bmNoList": "1001,1002,1003",\n  "exercisesId": ""\n}'
      },
      {
        name: '文本搜题 (数学)',
        method: 'GET',
        url: `${apiPaths.xueban.permission.textSearchMathBase}/勾股定理`,
        body: ''
      },
      {
        name: '题目详情',
        method: 'GET',
        url: `${apiPaths.xueban.permission.exercises}/1001`,
        body: ''
      }
    ]
  },
  {
    groupName: '研伴/作业服务',
    items: [
      {
        name: '作业提交批改详情',
        method: 'POST',
        url: apiPaths.yanban.homework.submitJudgeDetail,
        body: '{\n  "id": "437356903767269376"\n}'
      },
      {
        name: '学生登录',
        method: 'POST',
        url: apiPaths.yanban.auth.loginStudent,
        body: '{\n  "username": "test",\n  "password": "123"\n}'
      },
      {
        name: '获取未完成作业',
        method: 'POST',
        url: apiPaths.yanban.homework.undoList,
        body: '{\n  "userId": "123"\n}'
      },
      {
        name: '作业详情列表',
        method: 'POST',
        url: apiPaths.yanban.homework.detailList,
        body: '{\n  "homeworkId": "hw_001"\n}'
      }
    ]
  },
  {
    groupName: '教师与教材',
    items: [
      {
        name: '教师端聊天历史',
        method: 'POST',
        url: apiPaths.yanban.teacher.historyList,
        body: '{\n  "sessionId": "teacher_123_math",\n  "pageNum": 1,\n  "pageSize": 20\n}'
      },
      {
        name: '教师端教材树',
        method: 'GET',
        url: apiPaths.yanban.textbook.teacherTextbookSectionTree,
        body: ''
      },
      {
        name: '教材学习包',
        method: 'GET',
        url: apiPaths.yanban.textbook.teacherTextbookLearningPackage,
        body: ''
      }
    ]
  },
  {
    groupName: '外部/自建服务',
    items: [
      {
        name: '对话记忆管理 (删除)',
        method: 'POST',
        url: '/history_manage',
        body: '{\n  "type": "delete_all",\n  "question_bm_no": "1001"\n}'
      },
      {
        name: '手写公式识别',
        method: 'POST',
        url: '/api/recognize-handwritten-formula-image/json',
        body: '{\n  "base64DataUrl": "data:image/png;base64,..."\n}'
      },
      {
        name: '应用更新配置',
        method: 'GET',
        url: '/bj101/appupdate.json',
        body: ''
      }
    ]
  }
]

onMounted(() => {
  loadHistory()
  updateStats()
})

function getMethodColor(m: string) {
  switch (m) {
    case 'GET': return 'blue'
    case 'POST': return 'green'
    case 'PUT': return 'orange'
    case 'DELETE': return 'red'
    default: return 'grey'
  }
}

function applyPreset(api: any) {
  method.value = api.method
  url.value = api.url
  bodyText.value = api.body
  timeoutMs.value = 30000
}

function applyHistory(item: any) {
  method.value = item.method
  url.value = item.url
  bodyText.value = item.body
  timeoutMs.value = item.timeout || 30000
}

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
  try {
    return JSON.parse(t)
  } catch (e) {
    throw new Error('请求体 JSON 格式错误')
  }
}

async function callApi() {
  loading.value = true
  errorText.value = ''
  responseText.value = ''
  const startTime = Date.now()

  try {
    const u = (url.value || '').trim()
    if (!u) {
      throw new Error('URL 不能为空')
    }

    const requestConfig = {
      timeout: Math.max(0, Number(timeoutMs.value) || 0),
    }

    let resp: any
    if (method.value === 'GET') {
      resp = await httpClient.get<any>(u, requestConfig)
    } else if (method.value === 'DELETE') {
      resp = await httpClient.delete<any>(u, requestConfig)
    } else {
      const body = parseBody()
      if (method.value === 'POST') {
        resp = await httpClient.post<any>(u, body, requestConfig)
      } else {
        resp = await httpClient.put<any>(u, body, requestConfig)
      }
    }

    const latency = Date.now() - startTime
    responseText.value = safePrettyJson(resp)
    lastResponse.value = { status: 200, latency, success: true }
    
    saveToHistory({
      method: method.value,
      url: u,
      body: bodyText.value,
      success: true,
      status: 200,
      latency,
      time: new Date().toLocaleTimeString()
    })

  } catch (e: any) {
    const latency = Date.now() - startTime
    const message = e.message || String(e)
    errorText.value = message
    lastResponse.value = { status: e.status || 'ERROR', latency, success: false }

    saveToHistory({
      method: method.value,
      url: url.value,
      body: bodyText.value,
      success: false,
      status: e.status || 'ERR',
      latency,
      time: new Date().toLocaleTimeString()
    })
  } finally {
    loading.value = false
    updateStats()
  }
}

function saveToHistory(item: any) {
  history.value.unshift(item)
  if (history.value.length > 20) {
    history.value.pop()
  }
  localStorage.setItem('api_debug_history', JSON.stringify(history.value))
}

function loadHistory() {
  const saved = localStorage.getItem('api_debug_history')
  if (saved) {
    try {
      history.value = JSON.parse(saved)
    } catch {
      history.value = []
    }
  }
}

function updateStats() {
  if (history.value.length === 0) return
  
  stats.total = history.value.length
  stats.successCount = history.value.filter(h => h.success).length
  stats.successRate = Math.round((stats.successCount / stats.total) * 100)
  
  const totalLat = history.value.reduce((acc, h) => acc + (h.latency || 0), 0)
  stats.avgLatency = Math.round(totalLat / stats.total)
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    $q.notify({
      message: '已复制到剪贴板',
      color: 'positive',
      position: 'top',
      timeout: 1000
    })
  })
}
</script>

<style scoped>
.api-debug-dashboard {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.bg-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(8px);
  border-color: rgba(255, 255, 255, 0.1);
}

.bg-dark-dim {
  background: rgba(0, 0, 0, 0.4);
}

.preset-item {
  transition: background 0.2s;
}

.preset-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.response-pre {
  margin: 0;
  padding: 16px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  color: #d1d5db;
}

/* 隐藏滚动条但保留功能 */
.overflow-auto::-webkit-scrollbar {
  width: 4px;
}
.overflow-auto::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

:deep(.q-tab-panel) {
  padding: 0;
}
</style>

