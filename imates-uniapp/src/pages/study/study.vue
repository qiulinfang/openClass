<template>
  <view class="study-page">
    <!-- 侧边栏/顶部：学科与教材选择 -->
    <view class="sidebar-header">
      <view class="selector-item">
        <text class="label">学科:</text>
        <picker
          mode="selector"
          :range="subjectOptions"
          range-key="label"
          :value="subjectIndex"
          @change="onSubjectChange"
        >
          <view class="picker-box">
            <text>{{ subjectOptions[subjectIndex]?.label }}</text>
            <text class="arrow">▼</text>
          </view>
        </picker>
      </view>

      <!-- 搜索节点 -->
      <view class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索知识点节点..."
          class="search-input"
        />
      </view>
    </view>

    <!-- 知识点树与列表区域 -->
    <scroll-view scroll-y class="chapter-scroll">
      <view v-if="filteredChapters.length > 0" class="chapter-list">
        <view
          v-for="(item, idx) in filteredChapters"
          :key="item.id || idx"
          class="chapter-card"
          :class="{ active: currentChapterId === item.id }"
          @click="selectChapter(item)"
        >
          <view class="chapter-info">
            <text class="chapter-icon">📖</text>
            <text class="chapter-name">{{ item.name || item.chapter }}</text>
          </view>
          <text class="arrow-right">›</text>
        </view>
      </view>

      <view v-else class="empty-box">
        <text class="empty-icon">🌳</text>
        <text class="empty-text">暂无关联知识点目录</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ResourceApi, type ChapterNode } from '@/services/api/resourceApi'

const subjectOptions = [
  { label: '数学', value: 'MATH' },
  { label: '生物', value: 'BIOLOGY' }
]
const subjectIndex = ref(0)
const searchQuery = ref('')
const currentChapterId = ref('')
const chapterList = ref<ChapterNode[]>([])

const onSubjectChange = (e: any) => {
  subjectIndex.value = e.detail.value
  loadChapters()
}

const loadChapters = async () => {
  // 先获取已有的教材章节树
  const list = await ResourceApi.getSectionTree('default_textbook')
  if (list && list.length > 0) {
    chapterList.value = list
  } else {
    // 基础演示节点
    chapterList.value = [
      { id: '1', name: '第一章 集合与常用逻辑用语' },
      { id: '2', name: '第二章 一元二次函数、方程和不等式' },
      { id: '3', name: '第三章 函数的概念与性质' },
      { id: '4', name: '第四章 指数函数与对数函数' }
    ]
  }
}

const filteredChapters = computed(() => {
  if (!searchQuery.value.trim()) return chapterList.value
  return chapterList.value.filter(c => c.name.includes(searchQuery.value.trim()))
})

const selectChapter = (item: ChapterNode) => {
  currentChapterId.value = item.id
  uni.showToast({ title: `选中: ${item.name}`, icon: 'none' })
}

onMounted(() => {
  loadChapters()
})
</script>

<style lang="scss" scoped>
.study-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #f5f7fa;
}

.sidebar-header {
  background: #ffffff;
  padding: 24rpx 30rpx;
  border-bottom: 1px solid #e5e7eb;
}

.selector-item {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
}

.label {
  font-size: 28rpx;
  color: #4b5563;
  margin-right: 16rpx;
}

.picker-box {
  display: flex;
  align-items: center;
  background: #f3f4f6;
  padding: 10rpx 20rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #1f2937;

  .arrow {
    font-size: 20rpx;
    margin-left: 12rpx;
    color: #9ca3af;
  }
}

.search-box {
  width: 100%;
}

.search-input {
  width: 100%;
  height: 72rpx;
  background: #f3f4f6;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 26rpx;
  box-sizing: border-box;
}

.chapter-scroll {
  flex: 1;
  padding: 24rpx 30rpx;
  box-sizing: border-box;
}

.chapter-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.chapter-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
  padding: 30rpx 24rpx;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.03);

  &.active {
    border: 1px solid #6e55ff;
    background: #f5f3ff;
  }
}

.chapter-info {
  display: flex;
  align-items: center;
}

.chapter-icon {
  font-size: 36rpx;
  margin-right: 16rpx;
}

.chapter-name {
  font-size: 30rpx;
  color: #1f2937;
  font-weight: 500;
}

.arrow-right {
  font-size: 36rpx;
  color: #9ca3af;
}

.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 150rpx;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.empty-text {
  color: #9ca3af;
  font-size: 28rpx;
}
</style>
