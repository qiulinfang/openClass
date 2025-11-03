/**
 * UI 状态管理 Store
 * 用于管理全局 UI 状态，如对话框显示等
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUIStore = defineStore('ui', () => {
  // 第1步：AI聊天对话框显示状态
  const showAIChatDialog = ref(false)
  
  // 第2步：教师对话框显示状态
  const showTeacherChatDialog = ref(false)
  
  // 第3步：微课对话框显示状态
  const showMiniClassDialog = ref(false)
  const miniClassUrl = ref<string>('')
  const miniClassQuestionTitle = ref<string>('')
  
  // 第4步：打开 AI 聊天对话框
  const openAIChatDialog = () => {
    showAIChatDialog.value = true
  }
  
  // 第5步：关闭 AI 聊天对话框
  const closeAIChatDialog = () => {
    showAIChatDialog.value = false
  }
  
  // 第6步：打开教师对话框
  const openTeacherChatDialog = () => {
    showTeacherChatDialog.value = true
  }
  
  // 第7步：关闭教师对话框
  const closeTeacherChatDialog = () => {
    showTeacherChatDialog.value = false
  }
  
  // 第8步：打开微课对话框
  const openMiniClassDialog = (url: string, questionTitle?: string) => {
    miniClassUrl.value = url
    miniClassQuestionTitle.value = questionTitle || ''
    showMiniClassDialog.value = true
  }
  
  // 第9步：关闭微课对话框
  const closeMiniClassDialog = () => {
    showMiniClassDialog.value = false
    miniClassUrl.value = ''
    miniClassQuestionTitle.value = ''
  }
  
  return {
    showAIChatDialog,
    openAIChatDialog,
    closeAIChatDialog,
    showTeacherChatDialog,
    openTeacherChatDialog,
    closeTeacherChatDialog,
    showMiniClassDialog,
    miniClassUrl,
    miniClassQuestionTitle,
    openMiniClassDialog,
    closeMiniClassDialog
  }
})

