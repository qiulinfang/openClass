<template>
  <div class="chat-session-test-view">
    <div class="test-container">
      <h2>ChatSessionList 组件测试</h2>
      
      <div class="component-wrapper">
        <!-- 组件内部已处理卡片宽度，这里只需要让容器 100% 宽度即可 -->
        <ChatSessionList />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ChatSessionList from '@/components/ChatSessionList.vue'

defineOptions({
  name: 'ChatSessionTestView',
})
</script>

<style scoped>
.chat-session-test-view {
  width: 100%;
  height: 100vh;
  background: #f5f5f5;
  overflow-y: auto;
  padding: 20px;
}

.test-container {
  max-width: 480px;
  margin: 0 auto;
}

h2 {
  margin: 0 0 20px 0;
  color: #333;
  font-size: 24px;
}

.component-wrapper {
  width: 100%;
  height: 600px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}
</style>
