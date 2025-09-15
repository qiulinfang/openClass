<template>
  <!-- 这个组件现在通过方法调用显示对话框，不需要模板 -->
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar'

const $q = useQuasar()

const emit = defineEmits<{
  'confirm': []
  'cancel': []
}>()

const showDialog = () => {
  $q.dialog({
    title: '退出编辑模式',
    message: '您正在编辑消息，切换题目将退出编辑模式并清空输入内容。是否确认切换？',
    persistent: true,
    class: 'gemini-dialog-small',
    ok: {
      label: '确认切换',
      color: 'primary',
      unelevated: true,
      class: 'gemini-primary-btn'
    },
    cancel: {
      label: '取消',
      color: 'grey-7',
      flat: true,
      class: 'gemini-secondary-btn'
    }
  }).onOk(() => {
    emit('confirm')
  }).onCancel(() => {
    emit('cancel')
  })
}

// 暴露方法给父组件
defineExpose({
  showDialog
})
</script>

<style scoped>
@import '../../styles/gemini-dialogs.scss';
</style>
