<template>
  <div v-if="visible" class="history-debug-panel">
    <div class="history-debug-header">
      <span>History Debug</span>
      <button type="button" class="history-debug-btn" @click="expanded = !expanded">
        {{ expanded ? '收起' : '展开' }}
      </button>
    </div>
    <div class="history-debug-summary">
      <div>history.length: {{ browserHistoryLength }}</div>
      <div>route: {{ route.fullPath }}</div>
      <div v-if="extraInfo">{{ extraInfo }}</div>
    </div>
    <div v-if="expanded" class="history-debug-tabs">
      <button
        type="button"
        class="history-debug-tab"
        :class="{ active: activeTab === 'events' }"
        @click="activeTab = 'events'"
      >
        事件日志
      </button>
      <button
        type="button"
        class="history-debug-tab"
        :class="{ active: activeTab === 'stack' }"
        @click="activeTab = 'stack'"
      >
        路径栈
      </button>
    </div>
    <div v-if="expanded" class="history-debug-actions">
      <button type="button" class="history-debug-btn" @click="refresh">刷新</button>
      <button type="button" class="history-debug-btn" @click="clear">清空</button>
    </div>
    <div v-if="expanded && activeTab === 'events'" class="history-debug-list">
      <div v-for="item in historyEvents" :key="item.id" class="history-debug-item">
        <div class="history-debug-item-head">
          <span>{{ item.type }}</span>
          <span>{{ item.ts }}</span>
        </div>
        <div class="history-debug-item-body">{{ item.detail }}</div>
      </div>
    </div>
    <div v-if="expanded && activeTab === 'stack'" class="history-debug-list">
      <div v-if="pathStack.length === 0" class="history-debug-empty">暂无路径记录</div>
      <div v-for="(path, index) in pathStack" :key="index" class="history-debug-item">
        <div class="history-debug-item-head">
          <span>#{{ index + 1 }}</span>
          <span class="history-debug-current" v-if="path === route.fullPath">当前</span>
        </div>
        <div class="history-debug-item-body">{{ path }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface Props {
  visible?: boolean
  extraInfo?: string
}

const props = withDefaults(defineProps<Props>(), {
  visible: true,
  extraInfo: ''
})

const route = useRoute()
const router = useRouter()

const expanded = ref(true)
const activeTab = ref<'events' | 'stack'>('events')
const browserHistoryLength = ref(typeof window !== 'undefined' ? window.history.length : 0)
const historyEvents = ref<Array<{ id: string; type: string; ts: string; detail: string }>>([])
const pathStack = ref<string[]>([])
let removeAfterEachHook: (() => void) | null = null

const addEvent = (type: string, detail: string) => {
  const now = new Date()
  historyEvents.value.unshift({
    id: `${now.getTime()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    ts: now.toLocaleTimeString(),
    detail,
  })
  browserHistoryLength.value = window.history.length
  if (historyEvents.value.length > 30) {
    historyEvents.value.length = 30
  }
}

const refresh = () => {
  browserHistoryLength.value = window.history.length
  addEvent('refresh', `route=${route.fullPath}`)
}

const clear = () => {
  historyEvents.value = []
  pathStack.value = []
  browserHistoryLength.value = window.history.length
}

const handlePopState = () => {
  addEvent('popstate', `route=${window.location.hash || window.location.href}`)
  // 移除最后一条路径，因为用户点击了返回
  if (pathStack.value.length > 0) {
    pathStack.value.pop()
  }
}

const updatePathStack = (path: string) => {
  const currentPath = pathStack.value[pathStack.value.length - 1]
  if (currentPath !== path) {
    pathStack.value.push(path)
    if (pathStack.value.length > 50) {
      pathStack.value.shift()
    }
  }
}

onMounted(() => {
  window.addEventListener('popstate', handlePopState)
  removeAfterEachHook = router.afterEach((to, from) => {
    addEvent('afterEach', `${from.fullPath} -> ${to.fullPath}`)
    updatePathStack(to.fullPath)
  })
  updatePathStack(route.fullPath)
  addEvent('mounted', `route=${route.fullPath}`)
})

onBeforeUnmount(() => {
  window.removeEventListener('popstate', handlePopState)
  removeAfterEachHook?.()
  removeAfterEachHook = null
})

defineExpose({
  addEvent,
  refresh,
  clear
})
</script>

<style scoped>
.history-debug-panel {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 360px;
  max-height: 50vh;
  overflow: visible;
  display: flex;
  flex-direction: column;
  z-index: 1200;
  background: rgba(12, 12, 18, 0.86);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24);
}

.history-debug-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 6px;
  font-size: 13px;
  font-weight: 600;
}

.history-debug-summary {
  padding: 0 12px 10px;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-all;
}

.history-debug-actions {
  display: flex;
  gap: 8px;
  padding: 0 12px 10px;
}

.history-debug-tabs {
  display: flex;
  gap: 8px;
  padding: 0 12px 10px;
}

.history-debug-tab {
  flex: 1;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.history-debug-tab.active {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.3);
}

.history-debug-btn {
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}

.history-debug-list {
  flex: 1;
  overflow: auto;
  min-height: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.history-debug-item {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
}

.history-debug-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
  color: #c5c9ff;
}

.history-debug-item-body {
  word-break: break-all;
  color: rgba(255, 255, 255, 0.88);
}

.history-debug-empty {
  padding: 20px 12px;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

.history-debug-current {
  color: #44ff44;
  font-size: 11px;
  font-weight: 600;
}
</style>
