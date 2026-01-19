<template>
  <DraggableDialog
    v-model="isVisible"
    title="选择老师"
    :initial-width="300"
    :initial-height="200"
    :min-width="280"
    :min-height="180"
    :show-footer="true"
    :confirm-disabled="!selectedSubject"
    confirm-text="确定"
    cancel-text="取消"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  >
    <div class="teacher-selection-content">
      <div class="teacher-list">
        <div
          v-for="teacher in availableTeachers"
          :key="teacher.subject"
          :class="['teacher-item', { selected: selectedSubject === teacher.subject }]"
          @click="selectedSubject = teacher.subject"
        >
          <div class="teacher-avatar">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div class="teacher-name">{{ teacher.name }}</div>
          <div v-if="selectedSubject === teacher.subject" class="selection-indicator">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20,6 9,17 4,12"></polyline>
            </svg>
          </div>
        </div>
      </div>
    </div>
  </DraggableDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import DraggableDialog from '../base/Modal.vue'

interface Teacher {
  subject: 'BIOLOGY' | 'MATH'
  name: string
}

interface Props {
  modelValue: boolean
  availableTeachers?: Teacher[]
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  availableTeachers: () => [
    { subject: 'biology' as const, name: '生物老师' },
    { subject: 'math' as const, name: '数学老师' }
  ]
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': [subject: 'BIOLOGY' | 'MATH']
  'cancel': []
}>()

const isVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const selectedSubject = ref<'biology' | 'math' | null>(null)

// 当对话框打开时重置选择
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    selectedSubject.value = null
  }
})

const handleConfirm = () => {
  if (selectedSubject.value) {
    emit('confirm', selectedSubject.value)
    emit('update:modelValue', false)
  }
}

const handleCancel = () => {
  emit('cancel')
  emit('update:modelValue', false)
}
</script>

<style lang="scss" scoped>
.teacher-selection-content {
  padding: 16px 0;

  .teacher-list {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .teacher-item {
      display: flex;
      align-items: center;
      padding: 12px 20px;
      cursor: pointer;
      border-radius: 8px;
      transition: all 0.2s ease;
      position: relative;

      &:hover {
        background-color: #f5f5f5;
      }

      &.selected {
        background-color: #f0f4ff;
        border: 2px solid #6e55ff;
      }

      .teacher-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: #6e55ff;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 12px;
        color: white;

        svg {
          width: 20px;
          height: 20px;
        }
      }

      .teacher-name {
        font-size: 16px;
        font-weight: 500;
        color: #1e1e1e;
        flex: 1;
      }

      .selection-indicator {
        color: #6e55ff;

        svg {
          width: 16px;
          height: 16px;
        }
      }
    }
  }
}
</style>
