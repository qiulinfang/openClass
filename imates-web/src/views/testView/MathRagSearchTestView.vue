<template>
  <div class="math-rag-test-view q-pa-md">
    <!-- 头部卡片 -->
    <q-card flat bordered class="q-mb-md bg-grey-1">
      <q-card-section class="row items-center justify-between">
        <div>
          <div class="text-h5 text-weight-bold text-primary row items-center">
            <q-icon name="center_focus_strong" class="q-mr-sm" size="32px" />
            MathRAG v2 拍照搜题与同题判断测试台
          </div>
          <div class="text-subtitle2 text-grey-7 q-mt-xs">
            接口地址: <code class="bg-grey-3 q-px-xs rounded-borders">{{ baseUrl }}</code>
          </div>
        </div>

        <div class="row items-center q-gutter-sm">
          <q-chip
            :color="healthStatus.ok ? 'positive' : 'negative'"
            text-color="white"
            icon="favorite"
          >
            {{ healthStatus.text }}
          </q-chip>
          <q-btn color="primary" outline label="检查健康状态" icon="refresh" :loading="healthLoading" @click="checkHealth" />
        </div>
      </q-card-section>
    </q-card>

    <!-- 健康状态细项展示 -->
    <q-banner v-if="healthData" class="q-mb-md bg-blue-1 text-blue-10 rounded-borders">
      <template v-slot:avatar>
        <q-icon name="info" color="blue" />
      </template>
      <div>
        <strong>服务模式:</strong> {{ healthData.mode }} |
        <strong>索引题目数:</strong> {{ healthData.index_size }} |
        <strong>同题模型已加载:</strong> {{ healthData.same_question_model?.loaded ? '是 (true)' : '否 (false)' }}
      </div>
    </q-banner>

    <!-- 主测试选项卡 -->
    <q-card flat bordered>
      <q-tabs
        v-model="activeTab"
        dense
        class="text-grey"
        active-color="primary"
        indicator-color="primary"
        align="left"
        narrow-indicator
      >
        <q-tab name="searchImage" icon="photo_camera" label="1. 拍照搜题 (/v2/search_image)" />
        <q-tab name="searchText" icon="search" label="2. 文本搜题 (/v2/search)" />
        <q-tab name="sameQuestion" icon="compare_arrows" label="3. 基础同题对比 (/v2/same_question)" />
      </q-tabs>

      <q-separator />

      <q-tab-panels v-model="activeTab" animated>
        <!-- Tab 1: 拍照搜题 -->
        <q-tab-panel name="searchImage">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <div class="text-subtitle1 text-weight-bold q-mb-sm">请求参数配置</div>

              <q-input
                v-model="imageParams.ocr_text"
                type="textarea"
                rows="4"
                outlined
                label="OCR 识别题目文本 (ocr_text) *"
                placeholder="请输入 OCR 识别到的题目内容"
                class="q-mb-md"
              />

              <div class="row q-col-gutter-sm q-mb-md">
                <div class="col-6">
                  <q-input
                    v-model.number="imageParams.ocr_confidence"
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    outlined
                    dense
                    label="OCR 置信度 (0~1)"
                    hint="设置 < 0.6 可测试自动研判失败逻辑"
                  />
                </div>
                <div class="col-6">
                  <q-input
                    v-model.number="imageParams.k"
                    type="number"
                    min="1"
                    max="20"
                    outlined
                    dense
                    label="返回结果数 (k)"
                  />
                </div>
              </div>

              <div class="row items-center justify-between q-mb-md">
                <q-checkbox v-model="imageParams.explain" label="返回详细匹配特征 (explain)" />
                <div class="q-gutter-xs">
                  <q-btn size="sm" flat label="填预设示例 1 (正常匹配)" @click="setSearchImageSample(1)" />
                  <q-btn size="sm" flat label="填预设示例 2 (低置信)" @click="setSearchImageSample(2)" />
                </div>
              </div>

              <q-btn
                color="primary"
                class="full-width"
                label="发送 /v2/search_image 请求"
                icon="send"
                :loading="searchImageLoading"
                @click="doSearchImage"
              />
            </div>

            <!-- Tab 1 结果区域 -->
            <div class="col-12 col-md-6">
              <div class="text-subtitle1 text-weight-bold q-mb-sm">判定结果摘要</div>

              <div v-if="searchImageRes" class="q-mb-md">
                <div class="row q-gutter-xs q-mb-sm">
                  <q-badge :color="getHitBadgeColor(searchImageRes.same_question_label)" class="q-pa-xs">
                    同题标签: {{ searchImageRes.same_question_label || '无' }}
                  </q-badge>
                  <q-badge :color="searchImageRes.question_bank_auto_reusable ? 'positive' : 'warning'" class="q-pa-xs">
                    自动复用答案: {{ searchImageRes.question_bank_auto_reusable ? '允许 (true)' : '禁止 (false)' }}
                  </q-badge>
                  <q-badge v-if="searchImageRes.auto_judgement_failed" color="negative" class="q-pa-xs">
                    自动研判失败 ({{ searchImageRes.auto_judgement_failure_reason }})
                  </q-badge>
                </div>

                <q-banner v-if="searchImageRes.auto_judgement_failed" class="bg-red-1 text-red q-mb-sm rounded-borders">
                  ⚠️ OCR 置信度为 {{ searchImageRes.ocr_confidence }}，低于 0.6 阈值，系统已标记为自动研判失败，不能自动判罚。
                </q-banner>

                <div class="text-caption text-grey-8 q-mb-xs">
                  最匹配度得分 (best_score): <strong>{{ searchImageRes.best_score ?? 'N/A' }}</strong>
                </div>

                <div class="text-subtitle2 q-mt-md q-mb-xs">召回候选列表 (Top {{ searchImageRes.results?.length || 0 }}):</div>
                <q-list bordered separator class="rounded-borders">
                  <q-item v-for="(item, idx) in searchImageRes.results || []" :key="idx">
                    <q-item-section>
                      <q-item-label class="text-weight-bold">
                        #{{ idx + 1 }} ID: {{ item.id }} (相似综合分: {{ item.score }})
                      </q-item-label>
                      <q-item-label caption class="q-my-xs text-body2">
                        {{ item.question }}
                      </q-item-label>
                      <q-item-label caption class="row items-center q-gutter-xs">
                        <span class="text-primary">同题概率: {{ item.same_question?.probability }}</span>
                        <span class="text-grey-6">| 判定: {{ item.same_question?.label }}</span>
                        <span v-if="item.same_question?.conflicts?.length" class="text-negative">
                          | 冲突: {{ item.same_question?.conflicts.join(', ') }}
                        </span>
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </div>

              <!-- 原始 JSON 打印 -->
              <div class="text-subtitle2 text-grey-7 q-mb-xs">原始 JSON 响应:</div>
              <pre class="json-code-block">{{ JSON.stringify(searchImageRes || {}, null, 2) }}</pre>
            </div>
          </div>
        </q-tab-panel>

        <!-- Tab 2: 文本搜题 -->
        <q-tab-panel name="searchText">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <div class="text-subtitle1 text-weight-bold q-mb-sm">文本搜题参数配置</div>

              <q-input
                v-model="textParams.query"
                type="textarea"
                rows="4"
                outlined
                label="查询题目文本 (query) *"
                placeholder="请输入要搜索的题目"
                class="q-mb-md"
              />

              <div class="row q-col-gutter-sm q-mb-md">
                <div class="col-6">
                  <q-input v-model.number="textParams.k" type="number" min="1" max="20" outlined dense label="返回数量 (k)" />
                </div>
                <div class="col-6">
                  <q-input v-model.number="textParams.candidate_pool" type="number" min="10" max="200" outlined dense label="候选池大小" />
                </div>
              </div>

              <q-btn
                color="primary"
                class="full-width"
                label="发送 /v2/search 请求"
                icon="send"
                :loading="searchTextLoading"
                @click="doSearchText"
              />
            </div>

            <div class="col-12 col-md-6">
              <div class="text-subtitle1 text-weight-bold q-mb-sm">响应结果 (JSON)</div>
              <pre class="json-code-block">{{ JSON.stringify(searchTextRes || {}, null, 2) }}</pre>
            </div>
          </div>
        </q-tab-panel>

        <!-- Tab 3: 两题对比 -->
        <q-tab-panel name="sameQuestion">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <div class="text-subtitle1 text-weight-bold q-mb-sm">两题同题判定配置</div>

              <q-input
                v-model="sameParams.query"
                type="textarea"
                rows="3"
                outlined
                label="题目 A (query) *"
                class="q-mb-md"
              />

              <q-input
                v-model="sameParams.candidate"
                type="textarea"
                rows="3"
                outlined
                label="题目 B (candidate) *"
                class="q-mb-md"
              />

              <div class="row justify-between items-center q-mb-md">
                <q-btn size="sm" flat label="填数字冲突对比示例" @click="setSameQuestionSample(1)" />
                <q-btn size="sm" flat label="填条件完全相同示例" @click="setSameQuestionSample(2)" />
              </div>

              <q-btn
                color="primary"
                class="full-width"
                label="发送 /v2/same_question 对比请求"
                icon="compare"
                :loading="sameQuestionLoading"
                @click="doCompareSameQuestion"
              />
            </div>

            <div class="col-12 col-md-6">
              <div class="text-subtitle1 text-weight-bold q-mb-sm">同题判定详情</div>

              <div v-if="sameQuestionRes" class="q-mb-md">
                <div class="row items-center q-gutter-sm q-mb-sm">
                  <q-badge :color="getHitBadgeColor(sameQuestionRes.label)" size="lg" class="q-pa-xs">
                    判定结果: {{ sameQuestionRes.label }}
                  </q-badge>
                  <span class="text-subtitle2">
                    同题概率: <strong>{{ (sameQuestionRes.probability * 100).toFixed(1) }}%</strong>
                  </span>
                </div>

                <div v-if="sameQuestionRes.conflicts?.length" class="q-mb-sm">
                  <div class="text-subtitle2 text-negative">数学条件冲突项:</div>
                  <q-chip
                    v-for="(conf, cIdx) in sameQuestionRes.conflicts"
                    :key="cIdx"
                    color="red-1"
                    text-color="red"
                    size="sm"
                    icon="warning"
                  >
                    {{ conf }}
                  </q-chip>
                </div>
              </div>

              <div class="text-subtitle2 text-grey-7 q-mb-xs">原始 JSON 响应:</div>
              <pre class="json-code-block">{{ JSON.stringify(sameQuestionRes || {}, null, 2) }}</pre>
            </div>
          </div>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ADDRESS_CATALOG } from '@/config/env-config'
import { mathRagSearchApi } from '@/services/http/math-rag-search-api'
import type {
  SearchImageResponse,
  SearchTextResponse,
  SameQuestionResponse,
  MathRagHealthResponse,
} from '@/types'
import { showMessage } from '@/utils'

const baseUrl = ADDRESS_CATALOG.MATHRAG_V2_SEARCH
const activeTab = ref('searchImage')

// 健康检查状态
const healthLoading = ref(false)
const healthStatus = reactive({ ok: false, text: '未知' })
const healthData = ref<MathRagHealthResponse | null>(null)

const checkHealth = async () => {
  healthLoading.value = true
  try {
    const res = await mathRagSearchApi.getHealth()
    healthData.value = res
    if (res.status === 'ok' && res.same_question_model?.loaded) {
      healthStatus.ok = true
      healthStatus.text = '服务正常 (OK)'
    } else {
      healthStatus.ok = false
      healthStatus.text = `异常 (${res.status})`
    }
  } catch (error) {
    console.error('健康检查失败:', error)
    healthStatus.ok = false
    healthStatus.text = '连接失败'
    showMessage('无法连接到 MathRAG v2 拍照搜题服务', 'error')
  } finally {
    healthLoading.value = false
  }
}

// 1. 拍照搜题
const searchImageLoading = ref(false)
const imageParams = reactive({
  ocr_text: '函数 f(x)=e^x-x-1，证明 f(x)>=0',
  ocr_confidence: 0.92,
  k: 3,
  explain: true,
})
const searchImageRes = ref<SearchImageResponse | null>(null)

const doSearchImage = async () => {
  if (!imageParams.ocr_text.trim()) {
    showMessage('请输入 OCR 识别到的题目文本', 'warning')
    return
  }
  searchImageLoading.value = true
  try {
    const res = await mathRagSearchApi.searchImage(imageParams)
    searchImageRes.value = res
    showMessage('拍照搜题调用成功', 'success')
  } catch (err: any) {
    console.error('searchImage 错误:', err)
    showMessage(err.message || '拍照搜题请求失败', 'error')
  } finally {
    searchImageLoading.value = false
  }
}

const setSearchImageSample = (type: number) => {
  if (type === 1) {
    imageParams.ocr_text = '函数 f(x)=e^x-x-1，证明 f(x)>=0'
    imageParams.ocr_confidence = 0.92
  } else {
    imageParams.ocr_text = '若|a|=4且|b|=3，求a点乘b'
    imageParams.ocr_confidence = 0.45
  }
}

// 2. 文本搜题
const searchTextLoading = ref(false)
const textParams = reactive({
  query: '函数 f(x)=e^x-x-1，证明 f(x)>=0',
  k: 3,
  candidate_pool: 50,
})
const searchTextRes = ref<SearchTextResponse | null>(null)

const doSearchText = async () => {
  if (!textParams.query.trim()) {
    showMessage('请输入查询题目文本', 'warning')
    return
  }
  searchTextLoading.value = true
  try {
    const res = await mathRagSearchApi.searchText(textParams)
    searchTextRes.value = res
    showMessage('文本搜题调用成功', 'success')
  } catch (err: any) {
    showMessage(err.message || '文本搜题失败', 'error')
  } finally {
    searchTextLoading.value = false
  }
}

// 3. 两题对比
const sameQuestionLoading = ref(false)
const sameParams = reactive({
  query: '若|a|=4且|b|=3，夹角135度，求a点乘b',
  candidate: '若|a|=4且|b|=3，夹角60度，求a点乘b',
})
const sameQuestionRes = ref<SameQuestionResponse | null>(null)

const doCompareSameQuestion = async () => {
  if (!sameParams.query.trim() || !sameParams.candidate.trim()) {
    showMessage('请填入要对比的两道题目', 'warning')
    return
  }
  sameQuestionLoading.value = true
  try {
    const res = await mathRagSearchApi.compareSameQuestion(sameParams)
    sameQuestionRes.value = res
    showMessage('两题对比完成', 'success')
  } catch (err: any) {
    showMessage(err.message || '同题对比失败', 'error')
  } finally {
    sameQuestionLoading.value = false
  }
}

const setSameQuestionSample = (type: number) => {
  if (type === 1) {
    sameParams.query = '若|a|=4且|b|=3，夹角135度，求a点乘b'
    sameParams.candidate = '若|a|=4且|b|=3，夹角60度，求a点乘b'
  } else {
    sameParams.query = '已知函数 f(x) = e^x - x - 1，求 f(x) 最小值'
    sameParams.candidate = '已知函数 f(x) = e^x - x - 1，求 f(x) 最小值'
  }
}

// 辅助方法：标签 Badge 颜色
const getHitBadgeColor = (label?: string | null) => {
  switch (label) {
    case 'same':
      return 'positive'
    case 'likely_same':
      return 'orange'
    case 'similar':
      return 'blue'
    case 'different':
      return 'grey'
    default:
      return 'grey-6'
  }
}

onMounted(() => {
  checkHealth()
})
</script>

<style scoped>
.math-rag-test-view {
  max-width: 1400px;
  margin: 0 auto;
}

.json-code-block {
  background-color: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 6px;
  max-height: 400px;
  overflow-y: auto;
  font-family: Consolas, Monaco, 'Andale Mono', monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
