<template>
  <div class="mini-exercise-page">
    <MiniClass
      v-model="visible"
      class-url="https://www.imates.com.cn/wk/math/miniExercise.html"
      question-title="小练习"
      fullscreen
      :show-close-button="false"
    >
      <template #header>
        <div class="header-actions">
          <button class="back-button" @click="handleBack">
            <span class="back-icon">←</span> 返回登录
          </button>
        </div>
      </template>
    </MiniClass>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import MiniClass from '@/components/MiniClass.vue'

const router = useRouter()
const visible = ref(true)

const handleBack = () => {
  router.push('/login')
}
</script>

<style scoped>
.mini-exercise-page {
  width: 100vw;
  height: 100vh;
  background-color: #f5f5f5;
}

.header-actions {
  display: flex;
  align-items: center;
  width: 100%;
}

.back-button {
  background: none;
  border: none;
  color: #6e55ff;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.back-button:hover {
  background-color: #f0edff;
}

.back-icon {
  margin-right: 4px;
  font-size: 18px;
}
</style>
