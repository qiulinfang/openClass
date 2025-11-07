<template>
  <q-dialog v-model="isVisible" position="right" maximized>
    <q-card style="width: 600px; max-width: 90vw">
      <!-- 头部 -->
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">🔧 调试面板 - 会话管理</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <!-- 标签页切换 -->
      <q-card-section class="q-pb-none">
        <q-tabs v-model="activeTab" dense class="text-grey" active-color="primary" indicator-color="primary">
          <q-tab name="ai" label="学伴对话" />
          <q-tab name="teacher" label="老师对话" />
          <q-tab name="storage" label="存储调试" />
        </q-tabs>
      </q-card-section>

      <!-- 统计信息 -->
      <q-card-section>
        <q-banner class="bg-info text-white" rounded>
          <template v-slot:avatar>
            <q-icon name="analytics" size="md" />
          </template>
          <div class="text-subtitle2">存储统计</div>
          <div class="text-caption">
            总会话数: {{ totalSessionsCount }} | 
            总消息数: {{ totalMessages }} | 
            存储大小: {{ storageSize }}
          </div>
        </q-banner>
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
            label="清空所有会话"
            @click="clearAllSessions"
            size="sm"
          />
          <q-btn
            outline
            color="secondary"
            icon="download"
            label="导出数据"
            @click="exportData"
            size="sm"
          />
          <q-btn
            outline
            color="positive"
            icon="upload"
            label="导入数据"
            @click="importData"
            size="sm"
          />
        </div>
      </q-card-section>

      <!-- 会话列表 -->
      <q-separator />
      
      <q-card-section class="q-pa-none" style="max-height: 60vh; overflow-y: auto">
        <!-- 学伴对话列表 -->
        <q-list v-if="activeTab === 'ai'" separator>
          <q-item
            v-for="session in sortedAiSessions"
            :key="session.sessionId"
            clickable
            @click="selectAiSession(session)"
          >
            <q-item-section avatar>
              <q-avatar :color="session.pinned ? 'orange' : 'primary'" text-color="white">
                <q-icon :name="session.pinned ? 'push_pin' : 'chat'" />
              </q-avatar>
            </q-item-section>

            <q-item-section>
              <q-item-label>{{ session.sessionName }}</q-item-label>
              <q-item-label caption>
                ID: {{ session.sessionId.substring(0, 20) }}...
              </q-item-label>
              <q-item-label caption>
                创建: {{ formatDate(session.createTime) }} | 
                更新: {{ formatDate(session.updateTime) }} | 
                消息: {{ session.msgCount }}
              </q-item-label>
            </q-item-section>

            <q-item-section side>
              <div class="row q-gutter-xs">
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="info"
                  color="blue"
                  @click.stop="viewAiSessionDetail(session)"
                >
                  <q-tooltip>查看详情</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="delete"
                  color="negative"
                  @click.stop="deleteAiSession(session)"
                >
                  <q-tooltip>删除会话</q-tooltip>
                </q-btn>
              </div>
            </q-item-section>
          </q-item>

          <q-item v-if="aiSessions.length === 0">
            <q-item-section class="text-center text-grey-6">
              <div class="q-py-md">
                <q-icon name="inbox" size="48px" />
                <div class="q-mt-sm">暂无学伴对话数据</div>
              </div>
            </q-item-section>
          </q-item>
        </q-list>

        <!-- 老师对话列表 -->
        <q-list v-else-if="activeTab === 'teacher'" separator>
          <q-item
            v-for="session in sortedTeacherSessions"
            :key="session.sessionId"
            clickable
            @click="selectTeacherSession(session)"
          >
            <q-item-section avatar>
              <q-avatar :color="session.subject === 'biology' ? 'green' : 'purple'" text-color="white">
                <q-icon name="school" />
              </q-avatar>
            </q-item-section>

            <q-item-section>
              <q-item-label>{{ session.sessionName }}</q-item-label>
              <q-item-label caption>
                ID: {{ session.sessionId.substring(0, 20) }}...
              </q-item-label>
              <q-item-label caption>
                科目: {{ session.subject === 'biology' ? '生物' : '数学' }} | 
                创建: {{ formatDate(session.createTime) }} | 
                消息: {{ session.msgCount || 0 }}
              </q-item-label>
            </q-item-section>

            <q-item-section side>
              <div class="row q-gutter-xs">
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="info"
                  color="blue"
                  @click.stop="viewTeacherSessionDetail(session)"
                >
                  <q-tooltip>查看详情</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="delete"
                  color="negative"
                  @click.stop="deleteTeacherSession(session)"
                >
                  <q-tooltip>删除会话</q-tooltip>
                </q-btn>
              </div>
            </q-item-section>
          </q-item>

          <q-item v-if="teacherSessions.length === 0">
            <q-item-section class="text-center text-grey-6">
              <div class="q-py-md">
                <q-icon name="inbox" size="48px" />
                <div class="q-mt-sm">暂无老师对话数据</div>
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <!-- 存储调试标签页 -->
      <q-card-section v-if="activeTab === 'storage'" class="q-pa-none" style="max-height: 60vh; overflow-y: auto">
        <div class="q-pa-md">
          <!-- 当前会话信息 -->
          <q-card flat bordered class="q-mb-md">
            <q-card-section>
              <div class="text-subtitle2 q-mb-sm">📋 当前会话信息</div>
              <q-list dense>
                <q-item v-if="currentTeacherSession">
                  <q-item-section>
                    <q-item-label caption>会话ID</q-item-label>
                    <q-item-label>{{ currentTeacherSession.sessionId }}</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item v-if="currentTeacherSession">
                  <q-item-section>
                    <q-item-label caption>会话名称</q-item-label>
                    <q-item-label>{{ currentTeacherSession.sessionName }}</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>
                    <q-item-label caption>内存消息数</q-item-label>
                    <q-item-label>{{ memoryMessagesCount }} 条</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>
                    <q-item-label caption>IndexedDB消息数</q-item-label>
                    <q-item-label>{{ indexedDBMessagesCount }} 条</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>

          <!-- 存储位置信息 -->
          <q-card flat bordered class="q-mb-md">
            <q-card-section>
              <div class="text-subtitle2 q-mb-sm">🗂️ 存储位置</div>
              <q-list dense>
                <q-item>
                  <q-item-section>
                    <q-item-label caption>IndexedDB 键名</q-item-label>
                    <q-item-label class="text-caption text-grey-7">{{ indexedDBKey }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-btn flat dense size="sm" icon="content_copy" @click="copyToClipboard(indexedDBKey)" />
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>
                    <q-item-label caption>localStorage 会话键名</q-item-label>
                    <q-item-label class="text-caption text-grey-7">{{ localStorageSessionKey }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-btn flat dense size="sm" icon="content_copy" @click="copyToClipboard(localStorageSessionKey)" />
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>
                    <q-item-label caption>IndexedDB 数据库名</q-item-label>
                    <q-item-label class="text-caption text-grey-7">{{ indexedDBDatabaseName }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-btn flat dense size="sm" icon="content_copy" @click="copyToClipboard(indexedDBDatabaseName)" />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>

          <!-- 操作按钮 -->
          <q-card flat bordered class="q-mb-md">
            <q-card-section>
              <div class="text-subtitle2 q-mb-sm">⚙️ 操作</div>
              <div class="row q-gutter-sm">
                <q-btn
                  outline
                  color="primary"
                  icon="refresh"
                  label="刷新数据"
                  size="sm"
                  @click="refreshStorageData"
                />
                <q-btn
                  outline
                  color="positive"
                  icon="save"
                  label="手动保存"
                  size="sm"
                  @click="manualSave"
                />
                <q-btn
                  outline
                  color="info"
                  icon="download"
                  label="从IndexedDB加载"
                  size="sm"
                  @click="manualLoad"
                />
                <q-btn
                  outline
                  color="warning"
                  icon="storage"
                  label="查看存储详情"
                  size="sm"
                  @click="showStorageDetail = !showStorageDetail"
                />
              </div>
            </q-card-section>
          </q-card>

          <!-- 存储详情 -->
          <q-card v-if="showStorageDetail" flat bordered class="q-mb-md">
            <q-card-section>
              <div class="text-subtitle2 q-mb-sm">📊 存储详情</div>
              <q-tabs v-model="storageDetailTab" dense>
                <q-tab name="memory" label="内存消息" />
                <q-tab name="indexeddb" label="IndexedDB" />
                <q-tab name="localstorage" label="localStorage" />
              </q-tabs>
              
              <q-tab-panels v-model="storageDetailTab" class="q-mt-sm">
                <!-- 内存消息 -->
                <q-tab-panel name="memory">
                  <div class="text-caption text-grey-7 q-mb-sm">内存中的消息列表 ({{ memoryMessages.length }}条)</div>
                  <q-scroll-area style="height: 300px">
                    <q-list dense bordered separator>
                      <q-item v-for="(msg, index) in memoryMessages" :key="msg.id || index">
                        <q-item-section>
                          <q-item-label caption>#{{ index + 1 }} - {{ msg.messageType || 'text' }} - {{ formatDate(new Date(msg.timestamp).getTime()) }}</q-item-label>
                          <q-item-label class="text-caption">{{ msg.content?.substring(0, 100) || '[无内容]' }}</q-item-label>
                          <q-item-label caption class="text-grey-6">
                            ID: {{ msg.id }} | 
                            messageId: {{ msg.messageId || '无' }} |
                            sender: {{ msg.sender || '无' }}
                          </q-item-label>
                        </q-item-section>
                        <q-item-section side>
                          <q-btn flat dense size="sm" icon="code" @click="viewMessageJson(msg)" />
                        </q-item-section>
                      </q-item>
                      <q-item v-if="memoryMessages.length === 0">
                        <q-item-section class="text-center text-grey-6">
                          暂无消息
                        </q-item-section>
                      </q-item>
                    </q-list>
                  </q-scroll-area>
                </q-tab-panel>

                <!-- IndexedDB消息 -->
                <q-tab-panel name="indexeddb">
                  <div class="text-caption text-grey-7 q-mb-sm">IndexedDB 中存储的消息 ({{ indexedDBMessages.length }}条)</div>
                  <q-scroll-area style="height: 300px">
                    <q-list dense bordered separator>
                      <q-item v-for="(msg, index) in indexedDBMessages" :key="msg.id || index">
                        <q-item-section>
                          <q-item-label caption>#{{ index + 1 }} - {{ msg.messageType || 'text' }} - {{ formatDate(new Date(msg.timestamp).getTime()) }}</q-item-label>
                          <q-item-label class="text-caption">{{ msg.content?.substring(0, 100) || '[无内容]' }}</q-item-label>
                          <q-item-label caption class="text-grey-6">
                            ID: {{ msg.id }} | 
                            messageId: {{ msg.messageId || '无' }} |
                            sender: {{ msg.sender || '无' }}
                          </q-item-label>
                        </q-item-section>
                        <q-item-section side>
                          <q-btn flat dense size="sm" icon="code" @click="viewMessageJson(msg)" />
                        </q-item-section>
                      </q-item>
                      <q-item v-if="indexedDBMessages.length === 0">
                        <q-item-section class="text-center text-grey-6">
                          暂无消息
                        </q-item-section>
                      </q-item>
                    </q-list>
                  </q-scroll-area>
                </q-tab-panel>

                <!-- localStorage会话信息 -->
                <q-tab-panel name="localstorage">
                  <div class="text-caption text-grey-7 q-mb-sm">localStorage 中的会话信息</div>
                  <q-scroll-area style="height: 300px">
                    <q-card flat bordered>
                      <q-card-section>
                        <pre class="text-caption" style="white-space: pre-wrap; word-break: break-all;">{{ localStorageSessionData }}</pre>
                      </q-card-section>
                    </q-card>
                  </q-scroll-area>
                </q-tab-panel>
              </q-tab-panels>
            </q-card-section>
          </q-card>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>

  <!-- 消息JSON查看对话框 -->
  <q-dialog v-model="showMessageJsonDialog">
    <q-card style="width: 700px; max-width: 90vw">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">消息详情 (JSON)</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>
      <q-card-section>
        <q-scroll-area style="height: 400px">
          <pre class="text-caption" style="white-space: pre-wrap; word-break: break-all;">{{ messageJsonText }}</pre>
        </q-scroll-area>
      </q-card-section>
      <q-card-section class="q-pt-none">
        <q-btn flat color="primary" icon="content_copy" label="复制" @click="copyToClipboard(messageJsonText)" />
      </q-card-section>
    </q-card>
  </q-dialog>

  <!-- 学伴会话详情对话框 -->
  <q-dialog v-model="showAiDetailDialog" maximized>
    <q-card v-if="selectedAiSession" style="width: 800px; max-width: 95vw">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">学伴会话详情</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <q-list bordered separator>
          <q-item>
            <q-item-section>
              <q-item-label caption>会话ID</q-item-label>
              <q-item-label>{{ selectedAiSession.sessionId }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>会话名称</q-item-label>
              <q-item-label>{{ selectedAiSession.sessionName }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>创建时间</q-item-label>
              <q-item-label>{{ formatFullDate(selectedAiSession.createTime) }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>最后更新</q-item-label>
              <q-item-label>{{ formatFullDate(selectedAiSession.updateTime) }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>消息数量</q-item-label>
              <q-item-label>{{ selectedAiSession.msgCount }} 条</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>是否置顶</q-item-label>
              <q-item-label>{{ selectedAiSession.pinned ? '是' : '否' }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <!-- 消息列表 -->
      <q-card-section v-if="sessionMessages.length > 0">
        <div class="text-subtitle2 q-mb-md">消息列表 ({{ sessionMessages.length }}条)</div>
        <q-scroll-area style="height: 400px">
          <q-list bordered separator>
            <q-item v-for="(msg, index) in sessionMessages" :key="msg.id">
              <q-item-section avatar>
                <q-avatar :color="msg.type === 'user' ? 'primary' : 'secondary'" text-color="white">
                  {{ msg.type === 'user' ? '我' : 'AI' }}
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label caption>#{{ index + 1 }} - {{ formatDate(new Date(msg.timestamp).getTime()) }}</q-item-label>
                <q-item-label class="q-mt-xs">{{ msg.content }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </q-card-section>
    </q-card>
  </q-dialog>

  <!-- 老师会话详情对话框 -->
  <q-dialog v-model="showTeacherDetailDialog" maximized>
    <q-card v-if="selectedTeacherSession" style="width: 800px; max-width: 95vw">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">老师会话详情</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <q-list bordered separator>
          <q-item>
            <q-item-section>
              <q-item-label caption>会话ID</q-item-label>
              <q-item-label>{{ selectedTeacherSession.sessionId }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>会话名称</q-item-label>
              <q-item-label>{{ selectedTeacherSession.sessionName }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>科目</q-item-label>
              <q-item-label>{{ selectedTeacherSession.subject === 'biology' ? '生物' : '数学' }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>创建时间</q-item-label>
              <q-item-label>{{ formatFullDate(selectedTeacherSession.createTime) }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>消息数量</q-item-label>
              <q-item-label>{{ sessionMessages.length }} 条</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <!-- 消息列表 -->
      <q-card-section v-if="sessionMessages.length > 0">
        <div class="text-subtitle2 q-mb-md">消息列表 ({{ sessionMessages.length }}条)</div>
        <q-scroll-area style="height: 400px">
          <q-list bordered separator>
            <q-item v-for="(msg, index) in sessionMessages" :key="msg.id">
              <q-item-section avatar>
                <q-avatar :color="msg.type === 'user' ? 'primary' : 'orange'" text-color="white">
                  {{ msg.type === 'user' ? '我' : '老师' }}
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label caption>#{{ index + 1 }} - {{ formatDate(new Date(msg.timestamp).getTime()) }}</q-item-label>
                <q-item-label class="q-mt-xs">{{ msg.content }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </q-card-section>
    </q-card>
  </q-dialog>

  <!-- 导入文件输入 -->
  <input
    ref="fileInputRef"
    type="file"
    accept=".json"
    style="display: none"
    @change="handleFileImport"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import type { AiGeneralSession, ChatBubble } from '@/types'
import type { TeacherSession } from '@/stores/teacherChatStore'
import localforage from 'localforage'
import { getCurrentUserIdOrDefault } from '@/utils/user/userId'
import { asyncStorage } from '@/services/chat-storage'
import { showMessage } from '@/utils'

// Props
interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// Store
const aiGeneralStore = useAiGeneralChatStore()
const teacherStore = useTeacherChatStore()

// 响应式数据
const isVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const activeTab = ref<'ai' | 'teacher' | 'storage'>('ai')

// 学伴对话相关
const aiSessions = ref<AiGeneralSession[]>([])
const selectedAiSession = ref<AiGeneralSession | null>(null)
const showAiDetailDialog = ref(false)

// 老师对话相关
const teacherSessions = ref<(TeacherSession & { msgCount: number })[]>([])
const selectedTeacherSession = ref<(TeacherSession & { msgCount: number }) | null>(null)
const showTeacherDetailDialog = ref(false)

// 通用数据
const storageSize = ref('0 KB')
const sessionMessages = ref<ChatBubble[]>([])
const fileInputRef = ref<HTMLInputElement>()

// 存储调试相关
const showStorageDetail = ref(false)
const storageDetailTab = ref<'memory' | 'indexeddb' | 'localstorage'>('memory')
const memoryMessages = ref<ChatBubble[]>([])
const indexedDBMessages = ref<ChatBubble[]>([])
const localStorageSessionData = ref('')
const showMessageJsonDialog = ref(false)
const messageJsonText = ref('')

// 计算属性
const totalSessionsCount = computed(() => {
  return aiSessions.value.length + teacherSessions.value.length
})

const totalMessages = computed(() => {
  const aiMessages = aiSessions.value.reduce((sum, s) => sum + s.msgCount, 0)
  const teacherMessages = teacherSessions.value.reduce((sum, s) => sum + (s.msgCount || 0), 0)
  return aiMessages + teacherMessages
})

const sortedAiSessions = computed(() => {
  return [...aiSessions.value].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return b.updateTime - a.updateTime
  })
})

const sortedTeacherSessions = computed(() => {
  return [...teacherSessions.value].sort((a, b) => {
    return b.createTime - a.createTime
  })
})

// 监听标签页切换，自动刷新数据
watch(activeTab, (newTab) => {
  if (newTab === 'storage') {
    refreshStorageData()
  } else {
    refreshData()
  }
})

// 第1步：刷新数据
const refreshData = async () => {
  try {
    // 刷新学伴对话
    await aiGeneralStore.loadSessions()
    aiSessions.value = [...aiGeneralStore.sessions]
    
    // 刷新老师对话
    await loadTeacherSessions()
    
    // 计算存储大小
    await calculateStorageSize()
  } catch (error) {
    console.error('刷新失败:', error)
  }
}

// 第1.1步：加载教师会话列表
const loadTeacherSessions = async () => {
  const userId = getCurrentUserIdOrDefault()
  const sessionPrefix = `${userId}_teacher_chat_`
  
  const sessions: (TeacherSession & { msgCount: number })[] = []
  const sessionIds = new Set<string>()
  
  // 遍历localStorage查找所有教师会话
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(sessionPrefix) && key.endsWith('_session')) {
      try {
        const sessionData = localStorage.getItem(key)
        if (sessionData) {
          const session = JSON.parse(sessionData) as TeacherSession
          
          if (!session || !session.sessionId || !session.sessionName) {
            continue
          }
          
          if (sessionIds.has(session.sessionId)) {
            continue
          }
          
          // 加载消息数量
          const storageKey = `teacher_chat_${session.sessionId}`
          let msgCount = 0
          try {
            const history = await asyncStorage.loadChatHistory(storageKey)
            if (history && history.messages) {
              msgCount = history.messages.length
            }
          } catch (error) {
            console.warn('加载教师会话消息数量失败:', error)
          }
          
          sessions.push({
            ...session,
            msgCount
          })
          sessionIds.add(session.sessionId)
        }
      } catch (error) {
        console.error('解析教师会话数据失败:', key, error)
      }
    }
  }
  
  sessions.sort((a, b) => b.createTime - a.createTime)
  teacherSessions.value = sessions
}

// 第2步：计算存储大小
const calculateStorageSize = async () => {
  try {
    let totalSize = 0
    
    // 计算学伴会话列表大小
    const aiSessionsData = JSON.stringify(aiSessions.value)
    totalSize += new Blob([aiSessionsData]).size
    
    // 计算学伴会话消息大小
    for (const session of aiSessions.value) {
      const key = `chat_history_session_${session.sessionId}`
      const data = await localforage.getItem(key)
      if (data) {
        totalSize += new Blob([JSON.stringify(data)]).size
      }
    }
    
    // 计算教师会话列表大小
    const teacherSessionsData = JSON.stringify(teacherSessions.value)
    totalSize += new Blob([teacherSessionsData]).size
    
    // 计算教师会话消息大小
    for (const session of teacherSessions.value) {
      const storageKey = `teacher_chat_${session.sessionId}`
      try {
        const history = await asyncStorage.loadChatHistory(storageKey)
        if (history) {
          totalSize += new Blob([JSON.stringify(history)]).size
        }
      } catch (error) {
        console.warn('加载教师会话历史失败（计算大小）:', error)
      }
    }
    
    // 格式化大小
    if (totalSize < 1024) {
      storageSize.value = `${totalSize} B`
    } else if (totalSize < 1024 * 1024) {
      storageSize.value = `${(totalSize / 1024).toFixed(2)} KB`
    } else {
      storageSize.value = `${(totalSize / 1024 / 1024).toFixed(2)} MB`
    }
  } catch (error) {
    console.error('计算存储大小失败:', error)
    storageSize.value = '未知'
  }
}

// 第3步：清空所有会话
const clearAllSessions = async () => {
  try {
    // 删除所有学伴会话的聊天历史
    for (const session of aiSessions.value) {
      const key = `chat_history_session_${session.sessionId}`
      await localforage.removeItem(key)
    }
    
    // 清空学伴会话列表
    await localforage.removeItem('ai_general_sessions')
    
    // 重置学伴Store
    aiGeneralStore.sessions = []
    aiGeneralStore.currentSession = null
    aiGeneralStore.messages = []
    
    // 删除所有教师会话
    const userId = getCurrentUserIdOrDefault()
    for (const session of teacherSessions.value) {
      const storageKey = `teacher_chat_${session.sessionId}`
      await asyncStorage.removeChatHistory(storageKey)
      localStorage.removeItem(`${userId}_teacher_chat_${session.sessionId}_session`)
    }
    
    // 刷新数据
    await refreshData()
  } catch (error) {
    console.error('清空失败:', error)
  }
}

// 第4步：删除学伴会话
const deleteAiSession = async (session: AiGeneralSession) => {
  try {
    await aiGeneralStore.deleteSession(session.sessionId)
    await refreshData()
  } catch (error) {
    console.error('删除学伴会话失败:', error)
  }
}

// 第4.1步：删除教师会话
const deleteTeacherSession = async (session: TeacherSession & { msgCount: number }) => {
  try {
    const userId = getCurrentUserIdOrDefault()
    const storageKey = `teacher_chat_${session.sessionId}`
    
    // 删除聊天历史
    await asyncStorage.removeChatHistory(storageKey)
    
    // 删除会话信息
    localStorage.removeItem(`${userId}_teacher_chat_${session.sessionId}_session`)
    
    // 刷新数据
    await refreshData()
  } catch (error) {
    console.error('删除教师会话失败:', error)
  }
}

// 第5步：查看学伴会话详情
const viewAiSessionDetail = async (session: AiGeneralSession) => {
  try {
    selectedAiSession.value = session
    
    // 加载会话消息
    const key = `chat_history_session_${session.sessionId}`
    const historyData = await localforage.getItem(key) as any
    
    if (historyData && historyData.messages) {
      sessionMessages.value = historyData.messages
    } else {
      sessionMessages.value = []
    }
    
    showAiDetailDialog.value = true
  } catch (error) {
    console.error('加载学伴会话详情失败:', error)
  }
}

// 第5.1步：查看教师会话详情
const viewTeacherSessionDetail = async (session: TeacherSession & { msgCount: number }) => {
  try {
    selectedTeacherSession.value = session
    
    // 加载会话消息
    const storageKey = `teacher_chat_${session.sessionId}`
    const history = await asyncStorage.loadChatHistory(storageKey)
    
    if (history && history.messages) {
      sessionMessages.value = history.messages
    } else {
      sessionMessages.value = []
    }
    
    showTeacherDetailDialog.value = true
  } catch (error) {
    console.error('加载教师会话详情失败:', error)
  }
}

// 第6步：选择学伴会话
const selectAiSession = (session: AiGeneralSession) => {
  aiGeneralStore.switchSession(session.sessionId)
}

// 第6.1步：选择教师会话
const selectTeacherSession = (session: TeacherSession & { msgCount: number }) => {
  teacherStore.setSession(session)
  teacherStore.loadChatHistory(session.sessionId)
}

// 第7步：导出数据
const exportData = async () => {
  try {
    const exportData: any = {
      version: '1.0',
      exportTime: Date.now(),
      aiSessions: aiSessions.value,
      teacherSessions: teacherSessions.value,
      aiMessages: {},
      teacherMessages: {}
    }
    
    // 导出学伴会话的消息
    for (const session of aiSessions.value) {
      const key = `chat_history_session_${session.sessionId}`
      const data = await localforage.getItem(key)
      if (data) {
        exportData.aiMessages[session.sessionId] = data
      }
    }
    
    // 导出教师会话的消息
    for (const session of teacherSessions.value) {
      const storageKey = `teacher_chat_${session.sessionId}`
      try {
        const history = await asyncStorage.loadChatHistory(storageKey)
        if (history) {
          exportData.teacherMessages[session.sessionId] = history
        }
      } catch (error) {
        console.warn('导出教师会话消息失败:', error)
      }
    }
    
    // 创建下载
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-sessions-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('导出失败:', error)
  }
}

// 第8步：导入数据
const importData = () => {
  fileInputRef.value?.click()
}

// 第9步：处理文件导入
const handleFileImport = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  
  try {
    const text = await file.text()
    const importData = JSON.parse(text)
    
    try {
      // 导入学伴会话（兼容旧格式）
      if (importData.sessions && importData.messages) {
        await localforage.setItem('ai_general_sessions', importData.sessions)
        for (const sessionId in importData.messages) {
          const key = `chat_history_session_${sessionId}`
          await localforage.setItem(key, importData.messages[sessionId])
        }
      }
      
      // 导入新格式的学伴会话
      if (importData.aiSessions && importData.aiMessages) {
        await localforage.setItem('ai_general_sessions', importData.aiSessions)
        for (const sessionId in importData.aiMessages) {
          const key = `chat_history_session_${sessionId}`
          await localforage.setItem(key, importData.aiMessages[sessionId])
        }
      }
      
      // 导入教师会话
      if (importData.teacherSessions && importData.teacherMessages) {
        const userId = getCurrentUserIdOrDefault()
        for (const session of importData.teacherSessions) {
          const sessionKey = `${userId}_teacher_chat_${session.sessionId}_session`
          localStorage.setItem(sessionKey, JSON.stringify(session))
        }
        
        for (const sessionId in importData.teacherMessages) {
          const storageKey = `teacher_chat_${sessionId}`
          await asyncStorage.saveChatHistory(storageKey, importData.teacherMessages[sessionId])
        }
      }
      
      // 刷新数据
      await refreshData()
      await aiGeneralStore.loadSessions()
    } catch (error) {
      console.error('导入失败:', error)
    }
  } catch (error) {
    console.error('读取文件失败:', error)
  }
  
  // 清空文件输入
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

// 格式化日期
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}

const formatFullDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN')
}

// 存储调试相关计算属性
const currentTeacherSession = computed(() => teacherStore.currentSession)
const memoryMessagesCount = computed(() => memoryMessages.value.length)
const indexedDBMessagesCount = computed(() => indexedDBMessages.value.length)
const indexedDBKey = computed(() => {
  if (!currentTeacherSession.value) return '无当前会话'
  const userId = getCurrentUserIdOrDefault()
  return `${userId}_chat_history_teacher_chat_${currentTeacherSession.value.sessionId}`
})
const localStorageSessionKey = computed(() => {
  if (!currentTeacherSession.value) return '无当前会话'
  const userId = getCurrentUserIdOrDefault()
  return `${userId}_teacher_chat_${currentTeacherSession.value.sessionId}_session`
})
const indexedDBDatabaseName = computed(() => {
  const userId = getCurrentUserIdOrDefault()
  return `ExerciseSolveApp_${userId}`
})

// 刷新存储调试数据
const refreshStorageData = async () => {
  try {
    // 刷新内存消息
    memoryMessages.value = [...teacherStore.messages]
    
    // 刷新IndexedDB消息
    if (currentTeacherSession.value) {
      const storageKey = `teacher_chat_${currentTeacherSession.value.sessionId}`
      const history = await asyncStorage.loadChatHistory(storageKey)
      if (history && history.messages) {
        indexedDBMessages.value = history.messages
      } else {
        indexedDBMessages.value = []
      }
    } else {
      indexedDBMessages.value = []
    }
    
    // 刷新localStorage会话信息
    if (currentTeacherSession.value) {
      const userId = getCurrentUserIdOrDefault()
      const sessionKey = `${userId}_teacher_chat_${currentTeacherSession.value.sessionId}_session`
      const sessionData = localStorage.getItem(sessionKey)
      localStorageSessionData.value = sessionData ? JSON.stringify(JSON.parse(sessionData), null, 2) : '无数据'
    } else {
      localStorageSessionData.value = '无当前会话'
    }
  } catch (error) {
    console.error('刷新存储数据失败:', error)
  }
}

// 手动保存
const manualSave = async () => {
  try {
    if (!currentTeacherSession.value) {
      showMessage('无当前会话，无法保存', 'warning')
      return
    }
    await teacherStore.saveChatHistory(true)
    await refreshStorageData()
    showMessage('手动保存成功', 'success')
  } catch (error) {
    console.error('手动保存失败:', error)
    showMessage('手动保存失败', 'error')
  }
}

// 手动加载
const manualLoad = async () => {
  try {
    if (!currentTeacherSession.value) {
      showMessage('无当前会话，无法加载', 'warning')
      return
    }
    await teacherStore.loadChatHistory(currentTeacherSession.value.sessionId)
    await refreshStorageData()
    showMessage('手动加载成功', 'success')
  } catch (error) {
    console.error('手动加载失败:', error)
    showMessage('手动加载失败', 'error')
  }
}

// 查看消息JSON
const viewMessageJson = (msg: ChatBubble) => {
  messageJsonText.value = JSON.stringify(msg, null, 2)
  showMessageJsonDialog.value = true
}

// 复制到剪贴板
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    showMessage('已复制到剪贴板', 'success')
  } catch (error) {
    console.error('复制失败:', error)
    // 降级方案
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      showMessage('已复制到剪贴板', 'success')
    } catch (fallbackError) {
      showMessage('复制失败', 'error')
    }
  }
}

// 组件挂载时加载数据
onMounted(() => {
  refreshData()
})
</script>

<style lang="scss" scoped>
:deep(.q-dialog__inner) {
  max-width: 600px;
}
</style>
