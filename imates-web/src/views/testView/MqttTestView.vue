<template>
  <div class="mqtt-test-view q-pa-lg">
    <!-- Header -->
    <div class="row items-center justify-between q-mb-md">
      <div>
        <h1 class="text-h5 text-weight-bold q-ma-none">MQTT over WebSocket 调试中心</h1>
        <p class="text-caption text-grey-7 q-ma-none">测试底层 MQTT 连接、主题订阅及消息推送</p>
      </div>
      <q-btn flat rounded icon="arrow_back" label="返回控制台" to="/test-nav" color="primary" />
    </div>

    <div class="row q-col-gutter-md">
      <!-- Left Column: Connection & Subscription Controls -->
      <div class="col-12 col-md-5">
        <!-- Connection Configuration -->
        <q-card class="glass-card q-mb-md">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold row items-center justify-between">
              <span>连接配置</span>
              <q-badge :color="statusColor" :label="connectionStatus.toUpperCase()" />
            </div>
          </q-card-section>

          <q-separator />

          <q-card-section class="q-gutter-y-sm">
            <q-input
              v-model="brokerUrl"
              label="Broker WS URL"
              outlined
              dense
              placeholder="ws:// or wss://地址"
              :disable="isConnected"
            />
            <div class="row q-col-gutter-sm">
              <div class="col-6">
                <q-input
                  v-model="username"
                  label="用户名 (可选)"
                  outlined
                  dense
                  :disable="isConnected"
                />
              </div>
              <div class="col-6">
                <q-input
                  v-model="password"
                  label="密码 (可选)"
                  type="password"
                  outlined
                  dense
                  :disable="isConnected"
                />
              </div>
            </div>

            <div class="row justify-end q-mt-md">
              <q-btn
                v-if="!isConnected"
                color="primary"
                label="连接 Broker"
                @click="handleConnect"
                :loading="connectionStatus === 'reconnecting'"
              />
              <q-btn
                v-else
                color="negative"
                label="断开连接"
                @click="handleDisconnect"
              />
            </div>
          </q-card-section>
        </q-card>

        <!-- Subscription Management -->
        <q-card class="glass-card">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold">主题订阅</div>
          </q-card-section>

          <q-separator />

          <q-card-section class="q-gutter-y-md">
            <div class="row q-gutter-sm">
              <q-input
                v-model="newTopic"
                label="新增订阅主题"
                outlined
                dense
                class="col"
                placeholder="例如: test/topic 或 device/+/status"
                @keyup.enter="handleSubscribe"
              />
              <q-btn
                color="secondary"
                icon="add"
                label="订阅"
                @click="handleSubscribe"
                :disable="!newTopic"
              />
            </div>

            <div>
              <div class="text-caption text-grey-7 q-mb-xs">当前已订阅的主题:</div>
              <div v-if="subscribedTopics.length === 0" class="text-body2 text-grey-5 italic">
                暂无订阅主题
              </div>
              <div class="row q-gutter-xs" v-else>
                <q-chip
                  v-for="t in subscribedTopics"
                  :key="t"
                  removable
                  @remove="handleUnsubscribe(t)"
                  color="teal-1"
                  text-color="teal-9"
                  icon="bookmark"
                >
                  {{ t }}
                </q-chip>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Right Column: Publish & Message Logs -->
      <div class="col-12 col-md-7">
        <!-- Publish Message -->
        <q-card class="glass-card q-mb-md">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold">发布消息</div>
          </q-card-section>

          <q-separator />

          <q-card-section class="q-gutter-y-sm">
            <div class="row q-col-gutter-sm">
              <div class="col-8">
                <q-input
                  v-model="pubTopic"
                  label="发布主题"
                  outlined
                  dense
                  placeholder="例如: test/topic"
                />
              </div>
              <div class="col-4">
                <q-select
                  v-model="pubQos"
                  :options="[0, 1, 2]"
                  label="QoS"
                  outlined
                  dense
                />
              </div>
            </div>

            <q-input
              v-model="pubPayload"
              type="textarea"
              label="消息内容 (支持 JSON 格式)"
              outlined
              dense
              rows="3"
            />

            <div class="row justify-end q-mt-sm">
              <q-btn
                color="primary"
                icon="send"
                label="发送消息"
                @click="handlePublish"
                :disable="!isConnected || !pubTopic"
              />
            </div>
          </q-card-section>
        </q-card>

        <!-- Message Logs -->
        <q-card class="glass-card message-logs-card">
          <q-card-section class="row items-center justify-between">
            <div class="text-subtitle1 text-weight-bold">实时消息日志</div>
            <q-btn
              flat
              round
              dense
              icon="delete_outline"
              color="grey-6"
              @click="clearLogs"
            >
              <q-tooltip>清空日志</q-tooltip>
            </q-btn>
          </q-card-section>

          <q-separator />

          <q-card-section class="log-container">
            <div v-if="logs.length === 0" class="empty-logs text-center text-grey-5 q-pa-xl">
              <q-icon name="hourglass_empty" size="48px" />
              <div class="q-mt-sm">等待接收消息...</div>
            </div>
            
            <div v-else class="log-list">
              <div
                v-for="(log, idx) in logs"
                :key="idx"
                class="log-item q-pa-sm q-mb-xs"
                :class="log.type"
              >
                <div class="row items-center justify-between text-caption text-grey-6 q-mb-xs">
                  <span class="text-weight-bold text-teal-8">
                    {{ log.topic ? `[Topic: ${log.topic}]` : `[System]` }}
                  </span>
                  <span>{{ log.time }}</span>
                </div>
                <pre class="log-payload text-body2 q-ma-none">{{ log.content }}</pre>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { getMqttWsUrl } from '@/config/env-config'
import { getMqttService, destroyMqttService, type MqttMessage } from '@/services/mqtt/mqttService'
import { useMqtt } from '@/composables/useMqtt'

defineOptions({
  name: 'MqttTestView'
})

const brokerUrl = ref(getMqttWsUrl())
const username = ref('admin')
const password = ref('admin')

const newTopic = ref('imates/test/topic')
const subscribedTopics = ref<string[]>([])

const pubTopic = ref('imates/test/topic')
const pubQos = ref<0 | 1 | 2>(1)
const pubPayload = ref('{\n  "message": "Hello from imates-web!",\n  "timestamp": ' + Date.now() + '\n}')

interface LogEntry {
  type: 'system' | 'message' | 'error'
  topic?: string
  content: string
  time: string
}
const logs = ref<LogEntry[]>([])

// 获取或初始化 MQTT 服务
let mqttService = getMqttService({
  url: brokerUrl.value,
  options: {
    username: username.value || undefined,
    password: password.value || undefined
  }
})

const addLog = (type: 'system' | 'message' | 'error', content: string, topic?: string) => {
  logs.value.unshift({
    type,
    topic,
    content,
    time: new Date().toLocaleTimeString()
  })
}

// 绑定通用连接事件监听
mqttService.on('connect', () => addLog('system', 'MQTT 客户端连接成功'))
mqttService.on('reconnect', () => addLog('system', 'MQTT 客户端正在尝试重连接...'))
mqttService.on('close', () => addLog('system', 'MQTT 客户端连接已关闭'))
mqttService.on('offline', () => addLog('system', 'MQTT 客户端已离线'))
mqttService.on('error', () => addLog('error', 'MQTT 发生错误: ' + (mqttService.getError().value?.message || '未知错误')))

// 使用 useMqtt Hook 实现状态联动
const { isConnected, connectionStatus, publish, subscribe, unsubscribe } = useMqtt(
  undefined,
  (msg: MqttMessage) => {
    addLog('message', msg.payload, msg.topic)
  },
  { autoConnect: false }
)

const statusColor = computed(() => {
  switch (connectionStatus.value) {
    case 'connected':
      return 'positive'
    case 'reconnecting':
      return 'warning'
    case 'offline':
      return 'grey-7'
    default:
      return 'negative'
  }
})

const handleConnect = () => {
  // 如果配置改变了，销毁并创建新服务
  destroyMqttService()
  mqttService = getMqttService({
    url: brokerUrl.value,
    options: {
      username: username.value || undefined,
      password: password.value || undefined
    }
  })
  
  // 重新订阅组件中记录的主题
  subscribedTopics.value.forEach(t => {
    subscribe(t)
  })
}

const handleDisconnect = () => {
  mqttService.disconnect()
}

const handleSubscribe = () => {
  const topic = newTopic.value.trim()
  if (topic && !subscribedTopics.value.includes(topic)) {
    subscribe(topic)
    subscribedTopics.value.push(topic)
    addLog('system', `已注册本地订阅并向服务器发送 Subscribe: ${topic}`)
    newTopic.value = ''
  }
}

const handleUnsubscribe = (topic: string) => {
  unsubscribe(topic)
  subscribedTopics.value = subscribedTopics.value.filter(t => t !== topic)
  addLog('system', `已取消订阅: ${topic}`)
}

const handlePublish = () => {
  try {
    let payload = pubPayload.value
    // 自动整理 JSON 格式
    try {
      const parsed = JSON.parse(pubPayload.value)
      payload = JSON.stringify(parsed, null, 2)
    } catch (_) {
      // Keep original text
    }
    publish(pubTopic.value, payload, pubQos.value)
    addLog('system', `已发布消息至 [${pubTopic.value}] (QoS ${pubQos.value})`)
  } catch (e: any) {
    addLog('error', '消息发布失败: ' + e.message)
  }
}

const clearLogs = () => {
  logs.value = []
}

onUnmounted(() => {
  // 组件卸载时断开调试连接，避免干扰
  destroyMqttService()
})
</script>

<style scoped>
.mqtt-test-view {
  min-height: 100vh;
  background-color: #f8f9fa;
}

.glass-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
}

.message-logs-card {
  display: flex;
  flex-direction: column;
  height: 580px;
}

.log-container {
  flex: 1;
  overflow-y: auto;
  background: #1e1e1e;
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
  padding: 16px;
}

.log-list {
  display: flex;
  flex-direction: column;
}

.log-item {
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-left: 4px solid #9e9e9e;
}

.log-item.system {
  border-left-color: #2196f3;
  background: rgba(33, 150, 243, 0.08);
}

.log-item.message {
  border-left-color: #4caf50;
  background: rgba(76, 175, 80, 0.08);
}

.log-item.error {
  border-left-color: #f44336;
  background: rgba(244, 67, 54, 0.08);
}

.log-payload {
  font-family: 'Courier New', Courier, monospace;
  color: #e0e0e0;
  white-space: pre-wrap;
  word-break: break-all;
}

.empty-logs {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #757575;
}
</style>
