<template>
  <div class="main-view-jk">
    <!-- 左上角退出登录按钮（仅开发环境显示） -->
    <button v-if="isDev" class="logout-btn-top" @click="handleLogout">
      <img src="/icons/logout.svg" alt="退出" />
      <span>退出登录</span>
    </button>

    <!-- 使用 MainView 组件内容 -->
    <MainView />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import MainView from './MainView.vue'

const router = useRouter()

// 是否为开发环境
const isDev = computed(() => import.meta.env.DEV)

const handleLogout = () => {
  localStorage.removeItem('XUEBAN_TOKEN')
  router.push({ name: 'login' })
}
</script>

<style scoped>
.main-view-jk {
  position: relative;
  width: 100vw;
  height: 100vh;
}

/* 左上角退出登录按钮 */
.logout-btn-top {
  position: absolute;
  top: 20px;
  left: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  transition: all 0.2s;
  z-index: 100;
}

.logout-btn-top:hover {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  color: #ff4d4f;
}

.logout-btn-top img {
  width: 16px;
  height: 16px;
}
</style>
