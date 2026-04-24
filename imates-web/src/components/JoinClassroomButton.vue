<template>
  <Teleport to="body">
    <div class="fixed-join-classroom-container">
      <button
        type="button"
        class="join-class-button"
        :class="{ 'in-class': isInClass }"
        @click="toggleJoinClass"
      >
        <slot>{{ isInClass ? '退出课堂' : '加入课堂' }}</slot>
      </button>

      <Dialog
        ref="joinClassDialogRef"
        :title="isInClass ? '确认退出课堂' : '课堂提示'"
        :confirmButtonText="isInClass ? '确认退出' : '确认加入'"
        :cancelButtonText="'取消'"
        @confirm="handleConfirm"
        @cancel="handleCancel"
      >
        {{ isInClass ? '确认退出课堂？' : '确认加入课堂？' }}
      </Dialog>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Dialog from './base/Dialog.vue'
import { AndroidBridge } from '@/services/business/android-bridge'
import { getUserId } from '@/services/http/auth-service'
import type { BridgeClassroomStatus, BridgeUserInfo } from '@/types/bridge'

// --- 全局单例状态 ---
// 将状态定义在 setup 外部（script 块作用域内），确保所有组件实例共享同一个响应式引用
const isInClass = ref(false)
let isInitialized = false

// --- 课堂逻辑 ---
const androidBridge = AndroidBridge.getInstance()

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
  } catch (e) {
    console.error('[JoinClassroomButton] checkClassroomStatus failed:', e)
  }
}

const joinClass = () => {
  try {
    const studentId = getUserId() || ''
    const studentName = getStudentNameFromStorage() || studentId || '用户'
    const isGuest = !studentId
    const ok = androidBridge.joinClassroom(studentId, studentName, isGuest)
    if (ok) {
      isInClass.value = true
    }
    return ok
  } catch (e) {
    console.error('[JoinClassroomButton] joinClass failed:', e)
    return false
  }
}

const exitClass = () => {
  try {
    const ok = androidBridge.exitClassroom()
    if (ok) {
      isInClass.value = false
    }
    return ok
  } catch (e) {
    console.error('[JoinClassroomButton] exitClass failed:', e)
    return false
  }
}

onMounted(() => {
  // 只有第一次挂载时初始化监听，避免重复监听
  if (!isInitialized) {
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
    isInitialized = true
  } else {
    // 后续组件挂载时，只刷新一次当前状态
    checkClassroomStatus()
  }
})

const joinClassDialogRef = ref<InstanceType<typeof Dialog> | null>(null)

const toggleJoinClass = () => {
  joinClassDialogRef.value?.openDialog()
}

const handleCancel = () => {
  joinClassDialogRef.value?.closeDialog()
}

const handleConfirm = () => {
  joinClassDialogRef.value?.closeDialog()
  if (isInClass.value) {
    exitClass()
  } else {
    joinClass()
  }
}
</script>

<style scoped>
.fixed-join-classroom-container {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 12500;
}

.join-class-button {
  background: #ffffff;
  border: none;
  padding: 6px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #666666;
  font-size: 14px;
  line-height: 1;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
}

.join-class-button.in-class {
  box-shadow: 0 0 0 2px rgba(252, 253, 82, 0.65), 0 0 16px rgba(252, 253, 82, 0.75),
    0 0 28px rgba(252, 253, 82, 0.4);
  animation: join-class-glow 1.8s ease-in-out infinite;
}

@keyframes join-class-glow {
  0% {
    box-shadow: 0 0 0 2px rgba(252, 253, 82, 0.6);
  }
  50% {
    box-shadow: 0 0 0 3px rgba(252, 253, 82, 0.75);
  }
  100% {
    box-shadow: 0 0 0 2px rgba(252, 253, 82, 0.6);
  }
}
</style>
