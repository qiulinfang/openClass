<template>
  <q-dialog v-model="isPanelVisible" position="right" maximized>
    <q-card style="width: 900px; max-width: 95vw">
      <!-- 头部 -->
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">🗺️ 路由历史调试面板</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <!-- 标签页切换 -->
      <q-card-section class="q-pb-none">
        <q-tabs v-model="activeTab" dense class="text-grey" active-color="primary" indicator-color="primary">
          <q-tab name="current" label="当前状态" />
          <q-tab name="history" label="导航历史" />
          <q-tab name="modules" label="模块历史" />
        </q-tabs>
      </q-card-section>

      <!-- 操作按钮组 -->
      <q-card-section class="q-pt-none">
        <div class="row q-gutter-sm">
          <q-btn
            outline
            color="primary"
            icon="refresh"
            label="刷新"
            @click="refreshData"
            size="sm"
          />
          <q-btn
            outline
            color="negative"
            icon="delete_sweep"
            label="清空所有历史"
            @click="clearAllHistory"
            size="sm"
          />
        </div>
      </q-card-section>

      <!-- 内容区域 -->
      <q-separator />

      <q-card-section style="height: 600px; overflow-y: auto">
        <!-- 当前状态 Tab -->
        <div v-show="activeTab === 'current'">
          <div class="q-mb-md">
            <h4 class="q-mb-sm">📍 当前路由状态</h4>
            <q-markup-table flat bordered>
              <tbody>
                <tr>
                  <td class="text-weight-bold">当前路由</td>
                  <td>{{ currentRoute?.fullPath || 'N/A' }}</td>
                </tr>
                <tr>
                  <td class="text-weight-bold">路由名称</td>
                  <td>{{ currentRoute?.name || 'N/A' }}</td>
                </tr>
                <tr>
                  <td class="text-weight-bold">活跃导航项</td>
                  <td>{{ activeNavItem }}</td>
                </tr>
                <tr>
                  <td class="text-weight-bold">所属模块</td>
                  <td>{{ getModuleByRoute(currentRoute?.name) }}</td>
                </tr>
              </tbody>
            </q-markup-table>
          </div>

          <div class="q-mb-md">
            <h4 class="q-mb-sm">📊 历史记录统计</h4>
            <q-markup-table flat bordered>
              <tbody>
                <tr>
                  <td class="text-weight-bold">全局历史长度</td>
                  <td>{{ navigationHistory.length }}</td>
                </tr>
                <tr>
                  <td class="text-weight-bold">知识图谱模块历史</td>
                  <td>{{ moduleHistory.knowledge?.length || 0 }}</td>
                </tr>
                <tr>
                  <td class="text-weight-bold">习题模块历史</td>
                  <td>{{ moduleHistory.exercises?.length || 0 }}</td>
                </tr>
                <tr>
                  <td class="text-weight-bold">作业模块历史</td>
                  <td>{{ moduleHistory.homework?.length || 0 }}</td>
                </tr>
                <tr>
                  <td class="text-weight-bold">资源模块历史</td>
                  <td>{{ moduleHistory.resources?.length || 0 }}</td>
                </tr>
                <tr>
                  <td class="text-weight-bold">学习模块历史</td>
                  <td>{{ moduleHistory.learning?.length || 0 }}</td>
                </tr>
                <tr>
                  <td class="text-weight-bold">画板模块历史</td>
                  <td>{{ moduleHistory.drawingBoard?.length || 0 }}</td>
                </tr>
              </tbody>
            </q-markup-table>
          </div>
        </div>

        <!-- 导航历史 Tab -->
        <div v-show="activeTab === 'history'">
          <h4 class="q-mb-sm">📚 全局导航历史 (最近{{ navigationHistory.length }}条)</h4>
          <q-list bordered separator>
            <q-item v-for="(path, index) in navigationHistory.slice().reverse()" :key="index">
              <q-item-section>
                <q-item-label>{{ index + 1 }}. {{ path }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn
                  flat
                  round
                  dense
                  icon="content_copy"
                  @click="copyToClipboard(path)"
                  size="sm"
                >
                  <q-tooltip>复制路径</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
            <q-item v-if="navigationHistory.length === 0">
              <q-item-section>
                <q-item-label class="text-grey-5">暂无导航历史</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <!-- 模块历史 Tab -->
        <div v-show="activeTab === 'modules'">
          <div v-for="[moduleName, history] in Object.entries(moduleHistory)" :key="moduleName" class="q-mb-lg">
            <h4 class="q-mb-sm">{{ getModuleDisplayName(moduleName) }} 模块历史 ({{ Array.isArray(history) ? history.length : 0 }}条)</h4>
            <q-list bordered separator>
              <q-item v-for="(path, index) in (Array.isArray(history) ? history.slice().reverse() : [])" :key="index">
                <q-item-section>
                  <q-item-label>{{ index + 1 }}. {{ path }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-btn
                    flat
                    round
                    dense
                    icon="content_copy"
                    @click="copyToClipboard(path)"
                    size="sm"
                  >
                    <q-tooltip>复制路径</q-tooltip>
                  </q-btn>
                </q-item-section>
              </q-item>
              <q-item v-if="!history || history.length === 0">
                <q-item-section>
                  <q-item-label class="text-grey-5">暂无历史记录</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

// Props
interface Props {
  modelValue: boolean
  activeNavItem: string
  navigationHistory: string[]
  moduleHistory: Record<string, string[]>
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'clear-history': []
}>()

// 路由
const route = useRoute()

// 状态
const activeTab = ref('current')
const isPanelVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 计算属性
const currentRoute = computed(() => route)

// 工具函数
const getModuleByRoute = (routeName: string | symbol | undefined): string => {
  const moduleMap: Record<string, string> = {
    'knowledgeGraph': 'knowledge',
    'pdfViewer': 'knowledge',
    'htmlViewer': 'knowledge',
    'videoViewer': 'knowledge',
    'exerciseSolve': 'exercises',
    'homeworkExercise': 'homework',  // 作业答题跳转到学伴，属于homework模块
    'findExercise': 'knowledge',
    'myResources': 'resources',
    'myHomework': 'homework',
    'homeworkAnswer': 'homework',
    'learning': 'learning',
    'learningContent': 'learning',
    'drawingBoard': 'drawingBoard'
  }

  const name = typeof routeName === 'string' ? routeName : String(routeName)
  return name ? moduleMap[name] || 'knowledge' : 'knowledge'
}

const getModuleDisplayName = (module: string): string => {
  const displayNames: Record<string, string> = {
    knowledge: '🧠 知识图谱',
    exercises: '📝 习题',
    resources: '📚 资源',
    homework: '📓 作业',
    learning: '🎓 学习',
    drawingBoard: '🎨 画板'
  }
  return displayNames[module] || module
}

// 方法
const refreshData = () => {
  // 数据是响应式的，会自动刷新
  console.log('[路由历史调试] 刷新数据')
}

const clearAllHistory = () => {
  if (confirm('确定要清空所有路由历史记录吗？')) {
    emit('clear-history')
    console.log('[路由历史调试] 清空所有历史记录')
  }
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    console.log('[路由历史调试] 已复制到剪贴板:', text)
  } catch (error) {
    console.error('[路由历史调试] 复制失败:', error)
  }
}
</script>

<style scoped>
.text-weight-bold {
  font-weight: 600;
}

.q-card-section {
  padding: 16px;
}

.q-card-section.q-pb-none {
  padding-bottom: 0;
}

.q-card-section.q-pt-none {
  padding-top: 0;
}
</style>
