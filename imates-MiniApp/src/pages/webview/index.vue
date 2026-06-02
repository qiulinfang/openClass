<template>
  <web-view :src="url"></web-view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const url = ref('')

onMounted(() => {
  if (route.query.url) {
    url.value = decodeURIComponent(route.query.url as string)
    if (route.query.title) {
      uni.setNavigationBarTitle({
        title: decodeURIComponent(route.query.title as string)
      })
    }
  }
})
</script>
