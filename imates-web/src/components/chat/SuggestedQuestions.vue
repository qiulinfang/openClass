<template>
  <div
    :class="[
      'empty-chat-state',
      size === 'small' ? 'empty-chat-state--small' : 'empty-chat-state--large',
    ]"
  >
    <div class="suggestion-header">
      <span class="header-icon">✨</span>
      {{ title }}
    </div>
    <div class="suggestion-list">
      <div 
        v-for="(suggestion, idx) in questions" 
        :key="idx" 
        class="suggestion-item"
      >
        <!-- 编辑模式：显示输入框 -->
        <template v-if="editingIndex === idx">
          <input
            ref="inputRef"
            v-model="localEditingText"
            class="suggestion-input"
            placeholder="输入你的常用问题"
            @keyup.enter="handleSave(idx)"
            @keyup.esc="handleCancel"
            @blur="handleSave(idx)"
          />
        </template>
        <!-- 显示模式 -->
        <template v-else>
          <div class="suggestion-content" @click="handleSelect(suggestion)">
            <span class="dot-icon">●</span>
            <span class="suggestion-text">{{ suggestion }}</span>
          </div>
          <!-- 操作按钮组 -->
          <div class="suggestion-actions">
            <button
              v-if="editable"
              class="suggestion-edit-btn"
              @click.stop="handleStartEdit(idx, suggestion)"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <div class="send-icon-wrapper" @click="handleSelect(suggestion)">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'

interface Props {
  questions: string[]
  title?: string
  size?: 'small' | 'large'
  editable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '猜你想问',
  size: 'large',
  editable: false,
})

const emit = defineEmits<{
  select: [string]
  update: [number, string]
}>()

const editingIndex = ref<number | null>(null)
const localEditingText = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const BACKGROUND_COLOR = '#f7f6ff'

const handleSelect = (question: string) => {
  if (editingIndex.value !== null) return
  if (props.editable && question === '点击编辑自定义问题...') {
    const idx = props.questions.indexOf(question)
    if (idx !== -1) {
      handleStartEdit(idx, question)
    }
    return
  }
  emit('select', question)
}

const handleStartEdit = (index: number, text: string) => {
  editingIndex.value = index
  localEditingText.value = text
  nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

const handleSave = (index: number) => {
  if (editingIndex.value !== index) return
  const trimmed = localEditingText.value.trim()
  if (trimmed && trimmed !== props.questions[index]) {
    emit('update', index, trimmed)
  }
  editingIndex.value = null
  localEditingText.value = ''
}

const handleCancel = () => {
  editingIndex.value = null
  localEditingText.value = ''
}
</script>

<style scoped>
.empty-chat-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  width: 100%;
  background: #f7f6ff;
}

.empty-chat-state--small {
  padding: 20px 16px;
}

.suggestion-header {
  font-size: 20px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  font-size: 22px;
  opacity: 0.8;
}

.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.suggestion-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f7f6ff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.suggestion-item:hover {
  background: #ffffff;
  border-color: #cbd5e1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.suggestion-content {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  text-align: left;
}

.dot-icon {
  color: #94a3b8;
  font-size: 8px;
  margin-top: 6px;
  transition: color 0.2s;
}

.suggestion-item:hover .dot-icon {
  color: #64748b;
}

.suggestion-text {
  font-size: 19px;
  color: #334155;
  font-weight: 500;
  line-height: 1.5;
  word-break: break-all;
  transition: color 0.2s;
}

.suggestion-item:hover .suggestion-text {
  color: #0f172a;
}

.suggestion-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 8px;
}

.suggestion-edit-btn {
  padding: 4px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
}

.suggestion-item:hover .suggestion-edit-btn {
  color: #64748b;
}

.send-icon-wrapper {
  width: 24px;
  height: 24px;
  background: transparent;
  color: #94a3b8;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.suggestion-item:hover .send-icon-wrapper {
  background: #f1f5f9;
  color: #475569;
}

.suggestion-input {
  width: 100%;
  border: none;
  background: transparent;
  font-size: 19px;
  font-weight: 500;
  color: #334155;
  outline: none;
  padding: 4px 0;
}

/* 针对不同尺寸的微调 */
.empty-chat-state--small .suggestion-item {
  padding: 8px 16px;
}

.empty-chat-state--small .suggestion-text {
  font-size: 18px;
}

.empty-chat-state--small .suggestion-header {
  font-size: 20px;
}
</style>