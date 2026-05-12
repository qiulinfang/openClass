<template>
  <div class="jk2-page-wrapper">
    <MiniClass
      v-model="visible"
      class-url="https://www.imates.com.cn/wk/math/JK2.html"
      question-title=""
      fullscreen
      :show-close-button="false"
    >
      <template #header>
        <div class="header-actions">
          <div class="user-id">{{ xuebanUserId }}</div>
          <div class="spacer"></div>
          <JoinClassroomButton />
        </div>
      </template>
    </MiniClass>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import MiniClass from '@/components/MiniClass.vue'
import JoinClassroomButton from '@/components/JoinClassroomButton.vue'

const visible = ref(true)
const xuebanUserId = ref('')

const syncXuebanUserIdFromStorage = () => {
  try {
    const id = localStorage.getItem('xuebanuserid') || ''
    xuebanUserId.value = id
  } catch {
    xuebanUserId.value = ''
  }
}

const handleStorageChange = (e: StorageEvent) => {
  if (e.key === 'xuebanuserid') {
    syncXuebanUserIdFromStorage()
  }
}

onMounted(() => {
  syncXuebanUserIdFromStorage()
  window.addEventListener('storage', handleStorageChange)
})

onUnmounted(() => {
  window.removeEventListener('storage', handleStorageChange)
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
  position: relative;
  height: 100%;
}

.user-id {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 14px;
  color: #2f2a45;
  opacity: 0.8;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
}

.spacer {
  flex: 1;
}
</style>
