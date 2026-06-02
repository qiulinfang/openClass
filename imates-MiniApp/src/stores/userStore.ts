import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUserStore = defineStore('user', () => {
  const userId = ref(uni.getStorageSync('userId') || '');
  const token = ref(uni.getStorageSync('XUEBAN_TOKEN') || '');

  const setUserId = (id: string) => {
    userId.value = id;
    uni.setStorageSync('userId', id);
  };

  const setToken = (t: string) => {
    token.value = t;
    uni.setStorageSync('XUEBAN_TOKEN', t);
  };

  const logout = () => {
    userId.value = '';
    token.value = '';
    uni.removeStorageSync('userId');
    uni.removeStorageSync('XUEBAN_TOKEN');
  };

  return {
    userId,
    token,
    setUserId,
    setToken,
    logout,
  };
});
