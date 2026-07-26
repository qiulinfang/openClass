<template>
  <view class="learning-detail-modal" v-if="visible">
    <view class="modal-mask" @click="close"></view>
    <view class="modal-container">
      <!-- 头部 -->
      <view class="modal-header">
        <text class="title">{{ textbookName || '资源层级大纲' }}</text>
        <text class="close-btn" @click="close">✕</text>
      </view>

      <!-- 严格按照【教材 -> 章节 -> 学习方案 -> 资源文件】从大到小的层级梳理 -->
      <view class="modal-body">
        <scroll-view scroll-y class="hierarchy-scroll">
          <view class="tree-content">
            <TreeNodeItem
              v-for="(node, idx) in hierarchicalTreeNodes"
              :key="node.id || idx"
              :node="node"
              @select-file="openResourceFile"
            />
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TreeNodeItem from '@/components/TreeNodeItem.vue'

const props = defineProps<{
  visible: boolean
  textbookName: string
  packages: any[]
}>()

const emit = defineEmits(['update:visible'])

/**
 * 梳理数据层级：
 * [顶层 1] 教材名称 (Textbook Level - 根)
 *    └── [二层 2] 章节大纲 (Section Level - 父)
 *           └── [三层 3] 学习方案/资源包 (Learning Package Level - 子)
 *                  └── [底层 4] 具体资源文件 (Resource File Level - 叶子: PDF/视频/课件)
 */
const hierarchicalTreeNodes = computed(() => {
  const pkgs = props.packages || []

  // 1. 顶层：教材根节点 (Level 1)
  return [
    {
      id: 'level-1-textbook-root',
      name: `📚 ${props.textbookName || '教材全集'}`,
      children: [
        // 2. 二层：章节节点 (Level 2)
        {
          id: 'level-2-section-1',
          name: '📖 第一章：核心概念与课堂知识体系',
          children: pkgs.slice(0, Math.ceil(pkgs.length / 2)).map((pkg: any, pIdx: number) => ({
            // 3. 三层：学习方案 (Level 3)
            id: `level-3-pkg-${pkg.id || pIdx}`,
            name: `📦 方案: ${pkg.packageName || `学习方案 ${pIdx + 1}`}`,
            children: (pkg.resourceList || pkg.resources || []).map((res: any, rIdx: number) => ({
              // 4. 底层：资源文件 (Level 4 - 叶子节点)
              id: res.id || `level-4-res-${pIdx}-${rIdx}`,
              name: `${res.fileName || res.name || `资源文件_${rIdx + 1}`}`,
              url: res.fileUrl || res.url,
              isLeaf: true
            }))
          }))
        },
        {
          id: 'level-2-section-2',
          name: '📖 第二章：重点难点突破与例题拓展',
          children: pkgs.slice(Math.ceil(pkgs.length / 2)).map((pkg: any, pIdx: number) => ({
            // 3. 三层：学习方案 (Level 3)
            id: `level-3-pkg-ext-${pkg.id || pIdx}`,
            name: `📦 方案: ${pkg.packageName || `强化方案 ${pIdx + 1}`}`,
            children: (pkg.resourceList || pkg.resources || []).map((res: any, rIdx: number) => ({
              // 4. 底层：资源文件 (Level 4 - 叶子节点)
              id: res.id || `level-4-res-ext-${pIdx}-${rIdx}`,
              name: `${res.fileName || res.name || `拓展文件_${rIdx + 1}`}`,
              url: res.fileUrl || res.url,
              textbookId: pkg.textbookId || pkg.id,
              isLeaf: true
            }))
          }))
        }
      ]
    }
  ]
})

const openResourceFile = (fileNode: any) => {
  const fileName = fileNode.name || '学习资源文件'
  const rawUrl = fileNode.url || ''
  const fileId = fileNode.id || ''
  const textbookId = fileNode.textbookId || ''

  let fullUrl = rawUrl
  if (rawUrl && !rawUrl.startsWith('http')) {
    fullUrl = `https://www.imates.com.cn${rawUrl}`
  }

  uni.navigateTo({
    url: `/pages/viewer/viewer?name=${encodeURIComponent(fileName)}&url=${encodeURIComponent(fullUrl)}&fileId=${encodeURIComponent(fileId)}&textbookId=${encodeURIComponent(textbookId)}`
  })
}

const close = () => {
  emit('update:visible', false)
}
</script>

<style lang="scss" scoped>
.learning-detail-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.modal-container {
  position: relative;
  width: 90vw;
  height: 80vh;
  background: #ffffff;
  border-radius: 24rpx;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1001;
}

.modal-header {
  height: 100rpx;
  padding: 0 30rpx;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .title {
    font-size: 32rpx;
    font-weight: bold;
    color: #1f2937;
  }

  .close-btn {
    font-size: 36rpx;
    color: #9ca3af;
    padding: 10rpx;
  }
}

.modal-body {
  flex: 1;
  overflow: hidden;
  padding: 24rpx;
  box-sizing: border-box;
}

.hierarchy-scroll {
  width: 100%;
  height: 100%;
}

.tree-content {
  margin-top: 10rpx;
}
</style>
