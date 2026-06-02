<template>
  <view class="html-chat-panel">
    <!-- 对话面板头部 -->
    <ChatPanelHeader
      v-model="activeTab"
      :tabs="tabOptions"
      :show-close-button="props.showCloseButton"
      @close="emit('close')"
    >
      <template #tabs>
        <view class="header-title">AI 问答</view>
      </template>
    </ChatPanelHeader>

    <!-- Tab 内容区域 -->
    <view class="chat-content-container">
      <!-- AI 问答 Tab -->
      <view v-show="activeTab === 'ai-chat'" class="tab-content">
        <ChatView
          ref="chatViewRef"
          type="html-preview"
          :compressed-height="360"
          :toolbar-tools="toolbarToolNames"
          :hide-history="true"
          :disable-history-save="true"
          @screenshot-click="emit('screenshot-click')"
          @request-screenshot="emit('request-screenshot', $event)"
        />
      </view>
      <!-- 会话记录 Tab -->
      <view v-show="activeTab === 'question-record'" class="tab-content">
        <view class="session-card-wrapper">
          <view class="snapshot-empty">暂无会话记录</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ChatView from '@/components/chat/ChatView.vue'
import ChatPanelHeader from '@/components/header/ChatPanelHeader.vue'

interface AttachedScreenshot {
  id: string
  base64DataUrl: string
}

const props = withDefaults(
  defineProps<{
    showCloseButton?: boolean
  }>(),
  {
    showCloseButton: true,
  }
)

const toolbarToolNames: ('screenshot' | 'formula' | 'ask-teacher')[] = ['screenshot']

const emit = defineEmits<{
  close: []
  'screenshot-click': []
  'request-screenshot': [payload: { kind: 'screen_snapshot' | 'pdf_page' }]
  'open-html-preview': []
}>()

const chatViewRef = ref<InstanceType<typeof ChatView> | null>(null)

// Tab 相关
const activeTab = ref<'ai-chat' | 'question-record'>('ai-chat')

const tabOptions = [
  { label: 'AI 问答', value: 'ai-chat' as const },
]

defineExpose({
  onImageSelected: (imageInfo: {
    filePath: string
    width: number
    height: number
    fileSize: number
    base64DataUrl?: string
  }) => {
    chatViewRef.value?.onImageSelected?.(imageInfo)
  },
})
</script>

<style scoped>
.html-chat-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.header-title {
  font-size: 16px;
  font-weight: bold;
  color: #504b64;
  padding-bottom: 8px;
  flex: 1;
  text-align: center;
}

.chat-content-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tab-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.session-card-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.snapshot-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #8e89a3;
  font-size: 14px;
}
</style>
