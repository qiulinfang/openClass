<template>
  <div class="jk2-page-wrapper">
    <MiniClass
      v-model="visible"
      class-url="https://www.imates.com.cn/wk/math/JK2.html"
      question-title="经开二中2 - 小练习"
      fullscreen
      :show-close-button="false"
    >
      <template #header>
        <div class="header-actions">
          <div class="spacer"></div>
          <button
            type="button"
            class="join-class-button"
            :class="{ 'in-class': isInClass }"
            @click="toggleJoinClass"
          >
            加入课堂
          </button>
        </div>
      </template>
    </MiniClass>

    <Dialog
      ref="joinClassDialogRef"
      :title="isInClass ? '确认退出课堂' : '课堂提示'"
      :confirmButtonText="isInClass ? '确认退出' : '确认加入'"
      :cancelButtonText="'取消'"
      @confirm="confirmJoinClass"
      @cancel="handleJoinClassDialogCancel"
    >
      {{ isInClass ? '确认退出课堂？' : '确认加入课堂？' }}
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import MiniClass from '@/components/MiniClass.vue'
import Dialog from '@/components/base/Dialog.vue'
import { AndroidBridge } from '@/services/business/android-bridge'
import { getUserId } from '@/services/http/auth-service'
import type { BridgeClassroomStatus, BridgeUserInfo } from '@/types/bridge'

const visible = ref(true)

const androidBridge = AndroidBridge.getInstance()
const joinClassDialogRef = ref<InstanceType<typeof Dialog> | null>(null)
const isInClass = ref(false)

const getStudentNameFromStorage = () => {
  try {
    const raw = localStorage.getItem('userInfo')
    if (!raw) return ''
    const parsed = JSON.parse(raw) as Partial<BridgeUserInfo> & Record<string, unknown>
    const name =
      (parsed as any)?.studentName ||
      (parsed as any)?.realName ||
      (parsed as any)?.name ||
      (parsed as any)?.nickName ||
      (parsed as any)?.account ||
      ''
    return typeof name === 'string' ? name : ''
  } catch {
    return ''
  }
}

const checkClassroomStatus = () => {
  try {
    const status = androidBridge.getClassroomStatus() as BridgeClassroomStatus | null
    isInClass.value = !!status?.isInClass
  } catch {
  }
}

const toggleJoinClass = () => {
  joinClassDialogRef.value?.openDialog()
}

const handleJoinClassDialogCancel = () => {
  joinClassDialogRef.value?.closeDialog()
}

const confirmJoinClass = () => {
  try {
    joinClassDialogRef.value?.closeDialog()

    if (isInClass.value) {
      const ok = androidBridge.exitClassroom()
      if (ok) {
        isInClass.value = false
      }
      return
    }

    const studentId = getUserId() || ''
    const studentName = getStudentNameFromStorage() || studentId || '用户'
    const isGuest = !studentId
    const ok = androidBridge.joinClassroom(studentId, studentName, isGuest)
    if (ok) {
      isInClass.value = true
    }
  } catch (e) {
    console.error('[PdfViewerViewJK2] confirmJoinClass failed:', e)
  }
}

onMounted(() => {
  checkClassroomStatus()
  androidBridge.onClassroomJoined(() => {
    isInClass.value = true
  })
  androidBridge.onClassroomExited(() => {
    isInClass.value = false
  })
  androidBridge.onClassroomStatusChanged((status: BridgeClassroomStatus) => {
    isInClass.value = !!status?.isInClass
  })
})
</script>

<style scoped>
.jk2-page-wrapper {
  width: 100vw;
  height: 100vh;
  background-color: #f5f5f5;
}

.header-actions {
  display: flex;
  align-items: center;
  width: 100%;
  justify-content: space-between;
}

.spacer {
  flex: 1;
}

.join-class-button {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 6px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
}

.join-class-button:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #1e293b;
}

.join-class-button.in-class {
  background: #6e55ff;
  border-color: #6e55ff;
  color: #ffffff;
  box-shadow: 0 0 12px rgba(110, 85, 255, 0.3);
  animation: join-class-glow 2s ease-in-out infinite;
}

@keyframes join-class-glow {
  0%, 100% {
    box-shadow: 0 0 12px rgba(110, 85, 255, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(110, 85, 255, 0.5);
  }
}
</style>
