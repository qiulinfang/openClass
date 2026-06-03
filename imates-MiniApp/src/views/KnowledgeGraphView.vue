<template>
  <view class="knowledge-graph-content">
    <!-- 第二列：章节目录 -->
    <view class="chapter-sidebar">
      <!-- 科目和版本 -->
      <view class="subject-header">
        <image :src="bookIcon" class="subject-icon" mode="aspectFit" />
        <CommonSelect
          v-model="selectedSubject"
          :options="subjectOptions"
          class="subject-select"
          placeholder="请选择学科"
          @change="onSubjectChange"
        />
      </view>
      <!-- 教材选择器 -->
      <view class="textbook-info" v-if="textbookOptions.length > 0">
        <CommonSelect
          v-model="selectedTextbook"
          :options="textbookOptions"
          class="textbook-select"
          placeholder="请选择教材"
          @change="onTextbookChange"
        >
          <template #label>
            {{ selectedTextbookLabel }}
          </template>
        </CommonSelect>
      </view>

      <!-- 搜索框 -->
      <view v-show="showNodeSearch" class="chapter-search">
        <input
          v-model="searchQuery"
          placeholder="搜索节点..."
          class="search-input"
          @input="handleSearchInput"
        />
      </view>

      <!-- 章节列表 -->
      <RubberBandList class="chapter-list">
        <template v-if="searchQuery && searchResults.length > 0">
          <view
            v-for="result in searchResults"
            :key="`${result.chapterIndex}-${result.node.id}`"
            class="chapter-item search-result-item"
            @click="handleSearchResultClick(result)"
          >
            <view class="search-result-content">
              <rich-text class="search-result-node" :nodes="highlightText(result.node.name || result.node.label)"></rich-text>
              <text class="search-result-chapter">{{ result.chapterName }}</text>
            </view>
          </view>
        </template>
        <view v-else-if="searchQuery && searchResults.length === 0" class="empty-chapters">
          <text class="empty-text">未找到匹配的节点</text>
        </view>
        <template v-else-if="!searchQuery">
          <view v-if="filteredChapters.length === 0" class="empty-chapters">
            <text class="empty-text">未下载任何教材</text>
          </view>
          <view
            v-else
            v-for="item in filteredChapters"
            :key="item.index"
            class="chapter-item"
            :class="{ active: item.index === getCurrentChapter() }"
            @click="onChapterClick(item.index)"
          >
            <rich-text class="chapter-text" :nodes="highlightText(convertBrackets(item.chapter))"></rich-text>
          </view>
        </template>
      </RubberBandList>
    </view>

    <!-- 第三列：核心内容 -->
    <view class="main-content">
      <view class="top-right-toolbar">
        <view class="toolbar-icon-btn" @click="toggleNodeSearch">
          <image :src="chapterSearchIcon" class="toolbar-icon" mode="aspectFit" />
        </view>
      </view>

      <view class="circular-graphs-container" v-if="newGrapData">
        <NewGrap ref="newGrapRef" :data="newGrapData" @action="handleNewGrapAction" />
      </view>

      <view v-if="selectedChapterDetails" class="status-indicators">
        <view class="status-item">
          <image :src="notLearnedStarIcon" class="status-icon" mode="aspectFit" />
          <text class="status-label">未学习</text>
        </view>
        <view class="status-item">
          <image :src="learnedStarIcon" class="status-icon" mode="aspectFit" />
          <text class="status-label">已学习</text>
        </view>
        <view class="status-item">
          <image :src="lastLearnedStarIcon" class="status-icon" mode="aspectFit" />
          <text class="status-label">上次学到</text>
        </view>
      </view>
    </view>

    <!-- 学习对话框 -->
    <LearningView
      v-if="learningDialogData"
      v-model="learningDialogVisible"
      :node-id="learningDialogData.nodeId"
      :section-name="learningDialogData.sectionName"
      :level="learningDialogData.level"
      :textbook-id="learningDialogData.textbookId"
      @update:model-value="handleLearningDialogClose"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import NewGrap from '../components/knowledge-graph/newGrap.vue'
import RubberBandList from '../components/base/VirtualScroll.vue'
import CommonSelect from '../components/base/Select.vue'
import LearningView from './LearningView.vue'
import { useKnowledgeGraphStore } from '../stores/KnowledgeGraphStore'
import { resourceManager } from '../services/storage/resource-storage'
import { apiService } from '../services/http/api-service'
import { KNOWLEDGE_GRAPH_SUBJECT_OPTIONS } from '../constants/subjects'

const bookIcon = '/static/images/book.png'
const notLearnedStarIcon = '/static/icons/notLearnedStar.svg'
const learnedStarIcon = '/static/icons/learnedStar.svg'
const lastLearnedStarIcon = '/static/icons/lastLearnedStar.svg'
const chapterSearchIcon = '/static/icons/chapter_search.svg'

const {
  setCurrentChapter,
  setCurrentTextbook,
  getCurrentTextbook,
  getCurrentChapter,
  getCurrentSubject,
} = useKnowledgeGraphStore()

const selectedSubject = ref('')
const subjectOptions = ref(KNOWLEDGE_GRAPH_SUBJECT_OPTIONS)
const selectedTextbook = ref('')
const textbookOptions = ref<any[]>([])
const chapterStructure = ref<any[]>([])
const chapters = ref<string[]>([])
const selectedChapterDetails = ref<any>(null)
const showNodeSearch = ref(false)
const searchQuery = ref('')
const searchResults = ref<any[]>([])
const learningDialogVisible = ref(false)
const learningDialogData = ref<any>(null)

const selectedTextbookLabel = computed(() => {
  const option = textbookOptions.value.find((opt: any) => opt.value === selectedTextbook.value)
  return option ? option.label : ''
})

const filteredChapters = computed(() => {
  return chapters.value.map((chapter: string, index: number) => ({ chapter, index }))
})

const newGrapData = computed(() => {
  return selectedChapterDetails.value
})

const onSubjectChange = async (val: string) => {
  // 加载教材逻辑
}

const onTextbookChange = async (val: string) => {
  // 加载章节逻辑
}

const onChapterClick = (index: number) => {
  setCurrentChapter(index)
  selectedChapterDetails.value = chapterStructure.value[index]
}

const toggleNodeSearch = () => {
  showNodeSearch.value = !showNodeSearch.value
}

const handleSearchInput = () => {
  // 搜索逻辑
}

const handleNewGrapAction = (action: any) => {
  learningDialogData.value = {
    nodeId: action.data.id,
    sectionName: action.data.name,
    textbookId: selectedTextbook.value.split('-').pop(),
  }
  learningDialogVisible.value = true
}

const handleLearningDialogClose = () => {
  learningDialogVisible.value = false
}

const highlightText = (text: string) => {
  return text // 简化版，不带高亮
}

const convertBrackets = (text: string) => {
  return text.replace(/\[/g, '【').replace(/\]/g, '】')
}

onMounted(() => {
  // 初始化逻辑
})
</script>

<style scoped>
.knowledge-graph-content {
  display: flex;
  height: 100vh;
  background-color: #271a43;
}

.chapter-sidebar {
  width: 400rpx;
  background-color: rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  padding: 24rpx;
}

.subject-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.subject-icon {
  width: 48rpx;
  height: 48rpx;
}

.textbook-info {
  margin-bottom: 24rpx;
}

.chapter-search {
  margin-bottom: 24rpx;
}

.search-input {
  width: 100%;
  height: 72rpx;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 36rpx;
  padding: 0 32rpx;
  color: #fff;
  font-size: 26rpx;
}

.chapter-list {
  flex: 1;
}

.chapter-item {
  padding: 24rpx;
  border-radius: 12rpx;
  margin-bottom: 8rpx;
}

.chapter-item.active {
  background-color: rgba(255, 255, 255, 0.1);
}

.chapter-text {
  color: #fff;
  font-size: 28rpx;
}

.main-content {
  flex: 1;
  position: relative;
}

.top-right-toolbar {
  position: absolute;
  top: 32rpx;
  right: 32rpx;
  z-index: 10;
}

.toolbar-icon-btn {
  width: 80rpx;
  height: 80rpx;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toolbar-icon {
  width: 48rpx;
  height: 48rpx;
}

.circular-graphs-container {
  width: 100%;
  height: 100%;
}

.status-indicators {
  position: absolute;
  bottom: 48rpx;
  left: 32rpx;
  display: flex;
  gap: 32rpx;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.status-icon {
  width: 32rpx;
  height: 32rpx;
}

.status-label {
  color: #fff;
  font-size: 22rpx;
}
</style>
