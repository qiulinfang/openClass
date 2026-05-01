<template>
  <div class="api-test-page q-pa-md">
    <div class="header q-mb-lg">
      <h1 class="text-h5 q-my-none">题目结构化接口测试</h1>
      <p class="text-subtitle2 text-grey-7">测试将原文解析为结构化数据 (Choice, Fill, etc.)</p>
    </div>

    <div class="row q-col-gutter-md">
      <!-- 输入区域 -->
      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle1 q-mb-sm">测试输入</div>
            <q-select
              v-model="form.subject"
              :options="subjectOptions"
              label="科目"
              outlined
              dense
              class="q-mb-md"
            />
            <q-select
              v-model="form.type_hint"
              :options="typeOptions"
              label="类型建议 (type_hint)"
              outlined
              dense
              emit-value
              map-options
              class="q-mb-md"
              clearable
            />
            <q-input
              v-model="form.question"
              label="题目题干 (question)"
              type="textarea"
              outlined
              rows="6"
              class="q-mb-md"
              placeholder="请输入题目原文..."
            />
            <q-input
              v-model="form.answer"
              label="题目答案 (answer)"
              type="textarea"
              outlined
              rows="3"
              class="q-mb-md"
              placeholder="请输入答案原文..."
            />
            
            <div class="q-gutter-sm q-mb-md">
              <q-toggle
                v-model="useDirectUrl"
                label="直接调用后端 IP (跳过代理)"
                color="orange"
                dense
              />
              <div class="text-caption text-grey-7 q-ml-md" v-if="useDirectUrl">
                目标: http://49.232.39.212:8055/structure_question
              </div>
            </div>
          </q-card-section>

          <q-card-actions align="right" class="q-pb-md q-px-md">
            <q-btn
              label="加载示例 (选择题)"
              color="grey-7"
              flat
              @click="loadSample('choice')"
            />
            <q-btn
              label="加载示例 (填空题)"
              color="grey-7"
              flat
              @click="loadSample('fill')"
            />
            <q-btn
              label="开始结构化"
              color="primary"
              :loading="loading"
              @click="handleTest"
              unelevated
            />
          </q-card-actions>
        </q-card>
      </div>

      <!-- 结果展示区域 -->
      <div class="col-12 col-md-6">
        <q-card flat bordered class="fill-height column">
          <q-card-section>
            <div class="text-subtitle1">结构化结果</div>
          </q-card-section>
          
          <q-separator />

          <q-card-section class="col scroll">
            <div v-if="result" class="result-container">
              <div class="q-mb-md">
                <span class="text-weight-bold">状态: </span>
                <q-badge :color="result.success ? 'positive' : 'negative'">
                  {{ result.success ? '成功' : '失败' }}
                </q-badge>
              </div>

              <div v-if="result.data">
                <div class="text-weight-bold q-mb-xs">JSON 数据:</div>
                <pre class="json-block">{{ JSON.stringify(result.data, null, 2) }}</pre>
                
                <q-separator class="q-my-md" />

                <div class="text-weight-bold q-mb-sm">预览渲染:</div>
                <div class="preview-render bordered q-pa-md bg-grey-1 rounded-borders">
                   <!-- 动态加载预览组件 -->
                   <component 
                    :is="getQuestionComponent(result.data.type)"
                    v-if="result.data.type"
                    :question="mockExerciseItem(result.data)"
                    show-title
                    show-analysis
                    disabled
                   />
                   <div v-else class="text-grey-6 text-italic">
                     暂不支持该类型的自动预览
                   </div>
                </div>
              </div>

              <div v-else-if="result.message" class="text-negative">
                错误信息: {{ result.message }}
              </div>
            </div>
            
            <div v-else class="flex flex-center full-height text-grey-5">
              等待测试运行...
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, defineAsyncComponent } from 'vue'
import { apiService } from '@/services/http/api-service'
import type { StructureQuestionReq } from '@/services/http/question-structurer-api'

// 动态导入题目展示组件
const ChoiceQuestion = defineAsyncComponent(() => import('@/components/exercise/ChoiceQuestion.vue'))
const FillBlankQuestion = defineAsyncComponent(() => import('@/components/exercise/FillBlankQuestion.vue'))
const BaseQuestion = defineAsyncComponent(() => import('@/components/exercise/BaseQuestion.vue'))

const loading = ref(false)
const result = ref<any>(null)
const useDirectUrl = ref(false) // 新增控制变量

const subjectOptions = ['math', 'physics', 'chemistry', 'english', 'chinese']
const typeOptions = [
  { label: '选择题', value: 'choice' },
  { label: '填空题', value: 'fill' },
  { label: '判断题', value: 'judgment' },
  { label: '简答题', value: 'essay' }
]

const form = reactive<StructureQuestionReq>({
  id: 'test_' + Date.now(),
  subject: 'math',
  question: '',
  answer: '',
  type_hint: ''
})

const loadSample = (type: 'choice' | 'fill') => {
  if (type === 'choice') {
    form.question = '已知集合A={1, 2, 3}, B={2, 3, 4}, 则A∩B等于（ ）\nA. {1, 2, 3, 4}\nB. {2, 3}\nC. {1, 4}\nD. {2}'
    form.answer = 'B'
    form.type_hint = 'choice'
  } else {
    form.question = '一元二次方程 ax^2 + bx + c = 0 的求根公式是 x = (________)'
    form.answer = '(-b±√(b²-4ac))/(2a)'
    form.type_hint = 'fill'
  }
}

const handleTest = async () => {
  if (!form.question || !form.answer) {
    alert('请输入题干和答案')
    return
  }

  loading.value = true
  result.value = null
  
  try {
    let res;
    if (useDirectUrl.value) {
      // 直接调用完整路径 (绕过 apiService 内部的相对路径逻辑)
      const directUrl = 'http://49.232.39.212:8055/structure/structure_question';
      // 注意：httpClient.post 第三个参数可以传入 config，但这里我们直接传 URL
      // 由于 HttpClient.buildFullUrl 会处理 http 开头的绝对路径，所以这里直接传是可以的
      // 但为了保证能访问到 httpClient，我们需要从 apiService 中间接获取或直接导入
      res = await apiService.structureQuestion({
        ...form,
        id: 'test_' + Date.now()
      });
      
      // 这里的逻辑有点微妙：apiService 内部写死了相对路径。
      // 如果要真正“直接”调用，应该直接用 fetch 或导入 httpClient。
      // 这里我改为直接构造请求以实现真正的“直接调用”。
      const response = await fetch(directUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          id: 'test_' + Date.now()
        })
      });
      const data = await response.json();
      res = { success: response.ok, data };
    } else {
      res = await apiService.structureQuestion({
        ...form,
        id: 'test_' + Date.now()
      })
    }
    result.value = res
  } catch (error: any) {
    result.value = {
      success: false,
      message: error.message || '请求发生异常'
    }
  } finally {
    loading.value = false
  }
}

// 模拟 ExerciseItem 数据用于预览
const mockExerciseItem = (data: any) => {
  return {
    id: data.id || 'test',
    bmNo: 'TEST-001',
    title: data.question || form.question,
    answer: data.answer || form.answer,
    explanation: data.analysis || '',
    type: data.type || form.type_hint,
    structuredContent: data.structuredContent || data // 兼容不同的后端返回结构
  }
}

const getQuestionComponent = (type: string) => {
  if (type === 'choice') return ChoiceQuestion
  if (type === 'fill') return FillBlankQuestion
  return BaseQuestion
}
</script>

<style scoped>
.api-test-page {
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100vh;
  background: #f5f7fa;
}

.fill-height {
  height: calc(100vh - 150px);
}

.json-block {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 4px;
  font-family: 'Fira Code', monospace;
  font-size: 12px;
  overflow: auto;
  max-height: 300px;
}

.preview-render {
  border: 1px solid #e0e0e0;
}
</style>
