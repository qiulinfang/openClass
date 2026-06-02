<template>
  <view class="question-list-skeleton" :class="[animationSpeedClass, columnsClass]">
    <!-- 骨架屏题目卡片列表 -->
    <view class="skeleton-cards-container">
      <view 
        v-for="n in skeletonCount" 
        :key="n"
        class="skeleton-question-card"
      >
        <view class="skeleton-question-block">
          <!-- 题目头部骨架 -->
          <view class="skeleton-question-header">
            <!-- 左侧：题目序号骨架 -->
            <view class="skeleton-question-number"></view>
            
            <!-- 右侧：复选框骨架 -->
            <view class="skeleton-checkbox">
              <view class="skeleton-checkbox-inner"></view>
            </view>
          </view>

          <!-- 题目内容骨架 -->
          <view class="skeleton-question-content-area">
            <view class="skeleton-content">
              <!-- 多行文本骨架 -->
              <view class="skeleton-line skeleton-line-long"></view>
              <view class="skeleton-line skeleton-line-medium"></view>
              <view class="skeleton-line skeleton-line-short"></view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

// 定义props
interface Props {
  // 动画速度（字符串）
  animationSpeed?: 'fast' | 'normal' | 'slow'
  // 骨架屏数量
  skeletonCount?: number
  // 列数（1 或 2）
  columns?: 1 | 2
}

const props = withDefaults(defineProps<Props>(), {
  animationSpeed: 'normal',
  skeletonCount: 6,
  columns: 2
})

// 骨架屏数量
const skeletonCount = ref(props.skeletonCount)

// 计算动画速度类名
const animationSpeedClass = computed(() => {
  return `skeleton-${props.animationSpeed}`
})

// 计算列数类名
const columnsClass = computed(() => {
  return `skeleton-columns-${props.columns}`
})

// 组件挂载后随机化骨架屏数量，增加真实感
onMounted(() => {
  // 随机生成5-8个骨架屏
  skeletonCount.value = Math.floor(Math.random() * 4) + 5
})
</script>

<style lang="scss" scoped>
// ===== 骨架屏变量定义 =====
$skeleton-bg: #f0f0f0;
$skeleton-shimmer: #e0e0e0;
$skeleton-highlight: #ffffff;
$skeleton-border-radius: 12px;
$skeleton-card-padding: 4px;

// ===== 与QuestionList.vue保持一致的变量 =====
$primary-color: #1a73e8;
$border-color: rgba(0, 0, 0, 0.06);
$background-white: #ffffff;
$shadow-subtle: 0 1px 2px 0 rgba(60, 64, 67, 0.1);

// ===== 混合器定义 =====
@mixin responsive-padding($mobile: 12px 16px, $tablet: 16px 20px) {
  padding: $tablet;
  
  @media (max-width: 768px) {
    padding: $mobile;
  }
}

// ===== 骨架屏动画 =====
@keyframes skeleton-shimmer {
  0% {
    background-position: -200px 0;
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
  100% {
    background-position: calc(200px + 100%) 0;
    opacity: 0.6;
  }
}

@keyframes skeleton-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

// 为不同元素添加不同的动画效果
@keyframes skeleton-wave {
  0% {
    transform: translateX(-100%);
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translateX(100%);
    opacity: 0;
  }
}

// ===== 主容器样式 =====
.question-list-skeleton {
  width: 100%;
  height: 100%;
  
  // 动画速度类
  &.skeleton-fast {
    --animation-duration: 0.6s;
  }
  
  &.skeleton-normal {
    --animation-duration: 1.5s;
  }
  
  &.skeleton-slow {
    --animation-duration: 3.6s;
  }
  
  .skeleton-cards-container {
    display: grid;
    gap: 12px;
    padding: 12px 16px;
    
    // 响应式设计
    @media (max-width: 768px) {
      gap: 8px;
      padding: 8px 12px;
    }
    
    @media (max-width: 480px) {
      gap: 8px;
      padding: 8px 12px;
    }
  }
  
  // 单列布局
  &.skeleton-columns-1 {
    .skeleton-cards-container {
      grid-template-columns: 1fr;
    }
  }
  
  // 双列布局
  &.skeleton-columns-2 {
    .skeleton-cards-container {
      grid-template-columns: repeat(2, 1fr);
    }
  }
}

// ===== 骨架屏题目卡片 =====
.skeleton-question-card {
  cursor: default;
  transform: translateZ(0);
  backface-visibility: hidden;
  border: none;
  border-radius: 16px;
  background-color: transparent;
  padding: $skeleton-card-padding;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  
  .skeleton-question-block {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 150px; // 与真实题目卡片保持一致的高度（桌面端）
    background-color: $background-white;
    border-radius: $skeleton-border-radius;
    overflow: hidden; // 与真实题目卡片保持一致
    border: 1px solid $border-color;
    box-shadow: $shadow-subtle;
    min-width: 0;
  }
}

// ===== 骨架屏题目头部 =====
.skeleton-question-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: transparent;
  border-bottom: none;
  @include responsive-padding(12px 16px, 16px 20px);
  
  .skeleton-question-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
    min-width: 48px;
    height: 28px;
    background: linear-gradient(90deg, $skeleton-bg 25%, $skeleton-shimmer 50%, $skeleton-bg 75%);
    background-size: 200px 100%;
    border-radius: 14px;
    animation: skeleton-shimmer var(--animation-duration, 1.5s) infinite;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
    
    // 添加光泽效果
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
      animation: skeleton-wave var(--animation-duration, 1.5s) infinite;
    }
  }
  
  .skeleton-checkbox {
    flex-shrink: 0;
    padding: 4px;
    margin: -4px;
    
    .skeleton-checkbox-inner {
      width: 20px;
      height: 20px;
      background: linear-gradient(90deg, $skeleton-bg 25%, $skeleton-shimmer 50%, $skeleton-bg 75%);
      background-size: 200px 100%;
      border-radius: 6px;
      border: 2px solid $skeleton-shimmer;
      animation: skeleton-shimmer var(--animation-duration, 1.5s) infinite;
      position: relative;
      overflow: hidden;
      
      // 添加光泽效果
      &::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
        animation: skeleton-wave var(--animation-duration, 1.5s) infinite;
      }
    }
  }
}

// ===== 骨架屏题目内容区域 =====
.skeleton-question-content-area {
  flex: 1;
  background-color: transparent;
  @include responsive-padding(12px 16px 16px 16px, 16px 20px 20px 20px);
  overflow-x: auto;
  overflow-y: hidden;
  min-width: 0;
  min-height: 0;
  
  .skeleton-content {
    min-width: 0;
    
    .skeleton-line {
      height: 16px;
      background: linear-gradient(90deg, $skeleton-bg 25%, $skeleton-shimmer 50%, $skeleton-bg 75%);
      background-size: 200px 100%;
      border-radius: 8px;
      margin-bottom: 8px;
      animation: skeleton-shimmer var(--animation-duration, 1.5s) infinite;
      position: relative;
      overflow: hidden;
      
      &:last-child {
        margin-bottom: 0;
      }
      
      // 添加光泽效果
      &::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
        animation: skeleton-wave var(--animation-duration, 1.5s) infinite;
      }
      
      // 不同长度的文本行
      &.skeleton-line-long {
        width: 95%;
        animation-delay: 0s;
      }
      
      &.skeleton-line-medium {
        width: 75%;
        animation-delay: 0.1s;
      }
      
      &.skeleton-line-short {
        width: 60%;
        animation-delay: 0.2s;
      }
    }
  }
}

// ===== 响应式设计 =====
@media (max-width: 768px) {
  .skeleton-question-card {
    .skeleton-question-block {
      height: 280px; // 与真实题目卡片保持一致
      
      .skeleton-question-header {
        .skeleton-question-number {
          min-width: 40px;
          height: 24px;
          padding: 3px 6px;
          border-radius: 12px;
        }
        
        .skeleton-checkbox {
          .skeleton-checkbox-inner {
            width: 18px;
            height: 18px;
            border-width: 2px;
          }
        }
      }
      
      .skeleton-question-content-area {
        .skeleton-content {
          .skeleton-line {
            height: 14px;
            border-radius: 7px;
            margin-bottom: 6px;
          }
        }
      }
    }
  }
}

@media (max-width: 480px) {
  .skeleton-question-card {
    .skeleton-question-block {
      height: 260px; // 与真实题目卡片保持一致
      
      .skeleton-question-header {
        .skeleton-question-number {
          min-width: 36px;
          height: 22px;
          padding: 2px 5px;
          border-radius: 11px;
        }
        
        .skeleton-checkbox {
          .skeleton-checkbox-inner {
            width: 16px;
            height: 16px;
            border-width: 1.5px;
          }
        }
      }
      
      .skeleton-question-content-area {
        .skeleton-content {
          .skeleton-line {
            height: 13px;
            border-radius: 6px;
            margin-bottom: 5px;
          }
        }
      }
    }
  }
}
</style>
