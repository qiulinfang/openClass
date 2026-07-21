import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue'
import { getMqttService, type MqttMessage, type MqttConnectionStatus } from '@/services/mqtt/mqttService'

export interface UseMqttOptions {
  autoConnect?: boolean
  qos?: 0 | 1 | 2
}

/**
 * Vue 3 MQTT 订阅 Composable Hook
 * @param topic 订阅的主题，可以是 string, ref<string>, 或 string[]
 * @param onMessageCallback 收到消息时的回调函数
 * @param options 配置项
 */
export function useMqtt(
  topic?: string | Ref<string> | string[] | Ref<string[]>,
  onMessageCallback?: (message: MqttMessage) => void,
  options: UseMqttOptions = {}
) {
  const { autoConnect = true } = options
  const isConnected = ref(false)
  const connectionStatus = ref<MqttConnectionStatus>('disconnected')
  const error = ref<Error | null>(null)
  const lastMessage = ref<MqttMessage | null>(null)
  const messagesList = ref<MqttMessage[]>([])

  const mqttService = getMqttService()

  // 监视并更新状态
  const statusRef = mqttService.getConnectionStatus()
  const errorRef = mqttService.getError()

  watch(
    statusRef,
    (newStatus) => {
      connectionStatus.value = newStatus
      isConnected.value = newStatus === 'connected'
    },
    { immediate: true }
  )

  watch(
    errorRef,
    (newError) => {
      error.value = newError
    },
    { immediate: true }
  )

  // 处理消息分发到本 Hook 的内部状态
  const internalCallback = (message: MqttMessage) => {
    lastMessage.value = message
    messagesList.value.push(message)
    // 限制历史消息长度，防止内存泄露
    if (messagesList.value.length > 100) {
      messagesList.value.shift()
    }
    if (onMessageCallback) {
      onMessageCallback(message)
    }
  }

  // 获取当前订阅主题数组
  const getTopics = (): string[] => {
    if (!topic) return []
    const val = typeof topic === 'function' ? (topic as any)() : 'value' in topic ? topic.value : topic
    if (Array.isArray(val)) {
      return val
    }
    return val ? [val] : []
  }

  let subscribedTopics: string[] = []

  const subscribeAll = () => {
    const topics = getTopics()
    topics.forEach((t) => {
      mqttService.subscribe(t, internalCallback)
    })
    subscribedTopics = [...topics]
  }

  const unsubscribeAll = () => {
    subscribedTopics.forEach((t) => {
      mqttService.unsubscribe(t, internalCallback)
    })
    subscribedTopics = []
  }

  // 监听主题的变化
  if (topic && ('value' in topic || typeof topic === 'function')) {
    watch(
      () => (typeof topic === 'function' ? (topic as any)() : (topic as Ref<any>).value),
      () => {
        unsubscribeAll()
        subscribeAll()
      },
      { deep: true }
    )
  }

  onMounted(() => {
    if (autoConnect) {
      subscribeAll()
    }
  })

  onUnmounted(() => {
    unsubscribeAll()
  })

  /**
   * 手动发送消息
   */
  const publish = (targetTopic: string, message: string | object, qos: 0 | 1 | 2 = 1) => {
    mqttService.publish(targetTopic, message, qos)
  }

  return {
    isConnected,
    connectionStatus,
    error,
    lastMessage,
    messagesList,
    publish,
    subscribe: (t: string) => {
      if (!subscribedTopics.includes(t)) {
        mqttService.subscribe(t, internalCallback)
        subscribedTopics.push(t)
      }
    },
    unsubscribe: (t: string) => {
      const idx = subscribedTopics.indexOf(t)
      if (idx > -1) {
        mqttService.unsubscribe(t, internalCallback)
        subscribedTopics.splice(idx, 1)
      }
    }
  }
}
