<template>
  <div class="api-test-index q-pa-md">
    <div class="header q-mb-xl text-center">
      <h1 class="text-h4 text-primary q-mb-sm">API 调试与测试中心</h1>
      <p class="text-subtitle1 text-grey-7">整合系统内所有接口测试与调试工具</p>
    </div>

    <div class="row q-col-gutter-lg justify-center">
      <!-- 题目结构化测试 -->
      <div class="col-12 col-sm-6 col-md-4">
        <q-card class="test-card cursor-pointer" flat bordered @click="goTo('/api-test/structure')">
          <q-card-section class="column items-center q-py-xl">
            <q-icon name="psychology" size="64px" color="primary" class="q-mb-md" />
            <div class="text-h6">题目结构化测试</div>
            <div class="text-caption text-grey-7 text-center q-mt-sm">
              测试 AI 算法将原文解析为结构化数据 (Choice, Fill, etc.)
            </div>
          </q-card-section>
          <q-separator />
          <q-card-actions align="center">
            <q-btn flat label="进入测试" color="primary" />
          </q-card-actions>
        </q-card>
      </div>

      <!-- 教师端调试 -->
      <div class="col-12 col-sm-6 col-md-4">
        <q-card class="test-card cursor-pointer" flat bordered @click="goTo('/teacher-debug')">
          <q-card-section class="column items-center q-py-xl">
            <q-icon name="forum" size="64px" color="secondary" class="q-mb-md" />
            <div class="text-h6">教师端调试</div>
            <div class="text-caption text-grey-7 text-center q-mt-sm">
              模拟教师端 WebSocket 连接、会话管理与消息收发测试
            </div>
          </q-card-section>
          <q-separator />
          <q-card-actions align="center">
            <q-btn flat label="进入测试" color="secondary" />
          </q-card-actions>
        </q-card>
      </div>

      <!-- 原有 API 调试 -->
      <div class="col-12 col-sm-6 col-md-4">
        <q-card class="test-card cursor-pointer" flat bordered @click="goTo('/debug-api')">
          <q-card-section class="column items-center q-py-xl">
            <q-icon name="terminal" size="64px" color="orange" class="q-mb-md" />
            <div class="text-h6">通用 API 调试</div>
            <div class="text-caption text-grey-7 text-center q-mt-sm">
              系统基础 API 接口调用与原始数据响应调试工具
            </div>
          </q-card-section>
          <q-separator />
          <q-card-actions align="center">
            <q-btn flat label="进入测试" color="orange" />
          </q-card-actions>
        </q-card>
      </div>

      <!-- 渲染测试 -->
      <div class="col-12 col-sm-6 col-md-4">
        <q-card class="test-card cursor-pointer" flat bordered @click="goTo('/render-test')">
          <q-card-section class="column items-center q-py-xl">
            <q-icon name="html" size="64px" color="green" class="q-mb-md" />
            <div class="text-h6">渲染测试</div>
            <div class="text-caption text-grey-7 text-center q-mt-sm">
              测试各种复杂内容（MathJax, Markdown, HTML）的显示效果
            </div>
          </q-card-section>
          <q-separator />
          <q-card-actions align="center">
            <q-btn flat label="进入测试" color="green" />
          </q-card-actions>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goTo = (path: string) => {
  router.push(path)
}
</script>

<style scoped>
.api-test-index {
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100vh;
  background: #f5f7fa;
}

.test-card {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  border-radius: 12px;
}

.test-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important;
  border-color: var(--q-primary);
}
</style>
