<template>
  <Dialog
    ref="dialogRef"
    title="选择老师"
    confirm-button-text="确定"
    cancel-button-text="取消"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  >
    <view class="teacher-selection-content">
      <view class="teacher-list">
        <view
          v-for="teacher in availableTeachers"
          :key="teacher.subject"
          :class="['teacher-item', { selected: selectedSubject === teacher.subject }]"
          @click="selectedSubject = teacher.subject"
        >
          <view class="teacher-avatar">
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
          </view>
          <view class="teacher-name">{{ teacher.name }}</view>
          <view v-if="selectedSubject === teacher.subject" class="selection-indicator">
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
          </view>
        </view>
      </view>
    </view>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from '../base/Dialog.vue'

interface Teacher {
  subject: 'biology' | 'math'
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
  'confirm': [subject: 'biology' | 'math']
  'cancel': []
}>()

const dialogRef = ref<InstanceType<typeof Dialog>>()

const selectedSubject = ref<'biology' | 'math' | null>(null)

// 当对话框打开时显示对话框并重置选择
watch(() => props.modelValue, (newValue) => {
  if (newValue && dialogRef.value) {
    selectedSubject.value = null
    dialogRef.value.openDialog()
  } else if (!newValue && dialogRef.value) {
    dialogRef.value.closeDialog()
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
      padding: 8px 16px;
      cursor: pointer;
      border-radius: 6px;
      position: relative;

      &:hover {
        background-color: #f5f5f5;
      }

      &.selected {
        background-color: #f0f4ff;
        border: 2px solid #6e55ff;
      }

      .teacher-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background-color: #6e55ff;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 10px;
        color: white;
        flex-shrink: 0;

        svg {
          width: 16px;
          height: 16px;
        }
      }

      .teacher-name {
        font-size: 14px;
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
