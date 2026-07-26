<template>
  <view class="chat-page-container">
    <ChatView type="ai-general" />
  </view>
</template>

<script setup lang="ts">
import ChatView from '@/components/chat/ChatView.vue'
</script>

<style lang="scss" scoped>
.chat-page-container {
  width: 100%;
  height: 100%;
}
</style>
