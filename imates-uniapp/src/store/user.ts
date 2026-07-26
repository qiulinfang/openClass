import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  // state
  const token = ref<string>(uni.getStorageSync('XUEBAN_TOKEN') || '')
  const userInfo = ref<any>(null)

  // actions
  function setToken(newToken: string) {
    token.value = newToken
    uni.setStorageSync('XUEBAN_TOKEN', newToken)
  }

  function setUserInfo(info: any) {
    userInfo.value = info
    uni.setStorageSync('userInfo', JSON.stringify(info))
  }

  function logout() {
    token.value = ''
    userInfo.value = null
    uni.removeStorageSync('XUEBAN_TOKEN')
    uni.removeStorageSync('userInfo')
  }

  return {
    token,
    userInfo,
    setToken,
    setUserInfo,
    logout
  }
})
