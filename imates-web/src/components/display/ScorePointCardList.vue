<script setup>
import { ref, watch, nextTick } from 'vue'
import { useMessageRenderer } from '@/composables/useMessageRenderer'

const { renderMessageContent } = useMessageRenderer()

const props = defineProps({
  scorePointList: {
    type: Array,
    default: () => [],
  },
  activePointIndex: {
    type: Number,
    default: null,
  },
  hoverPointIndex: {
    type: Number,
    default: null,
  },
  selectedPointIndex: {
    type: Number,
    default: null,
  },
})

const emit = defineEmits(['locate-point', 'mouseenter-point', 'mouseleave-point', 'change-hit'])

const pointsListRef = ref(null)
const cardRefs = ref([])

const scrollToPoint = (index) => {
  if (index === null || index === undefined || index < 0) return
  nextTick(() => {
    const cardEl = cardRefs.value[index]
    if (cardEl && cardEl.scrollIntoView) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  })
}

watch(
  () => props.selectedPointIndex,
  (newIdx) => {
    if (newIdx !== null && newIdx !== undefined) {
      scrollToPoint(newIdx)
    }
  },
  { immediate: true },
)

defineExpose({
  scrollToPoint,
})

const getRegionBbox = (region) => {
  if (!Array.isArray(region?.bbox) || region.bbox.length < 4) return null
  const [x1, y1, x2, y2] = region.bbox.slice(0, 4).map(Number)
  if ([x1, y1, x2, y2].some((value) => Number.isNaN(value))) return null
  if (x2 <= x1 || y2 <= y1) return null
  return { x1, y1, x2, y2 }
}

const isVirtualRegion = (region) => {
  const bbox = getRegionBbox(region)
  return bbox && bbox.x1 === 0 && bbox.y1 === 0 && bbox.x2 === 1 && bbox.y2 === 1
}

const getPointRegions = (item) => {
  return Array.isArray(item?.matchedOcrRegions)
    ? item.matchedOcrRegions.filter(
        (region) => getRegionBbox(region) && !isVirtualRegion(region),
      )
    : []
}

const hasPointRegions = (item) => getPointRegions(item).length > 0

const handleLocatePoint = (item, index) => {
  emit('locate-point', { item, index })
}

const handleMouseEnter = (index) => {
  emit('mouseenter-point', index)
}

const handleMouseLeave = () => {
  emit('mouseleave-point')
}

const toggleHit = (item, targetHitState) => {
  if (item.hit === targetHitState) return
  item.hit = targetHitState
  emit('change-hit', { item, hit: targetHitState })
}

const getHeaderText = (item) => {
  const text = item?.sourceText || ''
  if (!text) return ''
  const match = text.match(/“([^”]+)”/)
  if (match && match[1]) {
    return match[1].trim()
  }
  return text.trim()
}

const isDev = import.meta.env.DEV

const logCardDebugInfo = (item, index) => {
  console.log(`📌 [DEBUG] 卡片 #${item.displayIndex || index + 1} 字段 1:1 映射数据:`, {
    pointId: item.id || item.pointId,
    hit: item.hit,
    sourceText: item.sourceText,
    potentialErrorType: item.potentialErrorType,
    potentialErrorReason: item.potentialErrorReason,
    matchedOcrRegions: item.matchedOcrRegions,
    applicableSigns: item.applicableSigns,
    rawObject: item,
  })
}
</script>

<template>
  <div v-if="scorePointList && scorePointList.length > 0" ref="pointsListRef" class="points-list">
    <div
      v-for="(item, index) in scorePointList"
      :key="item.id || item.pointId || index"
      :ref="(el) => (cardRefs[index] = el)"
      :class="[
        'knowledge-point-card',
        item.hit ? 'is-hit-card' : 'is-nohit-card',
        activePointIndex === index ? 'is-active' : '',
        hoverPointIndex === index ? 'is-hover' : '',
        selectedPointIndex === index ? 'is-selected' : '',
        hasPointRegions(item) ? 'is-locatable' : '',
      ]"
      @mouseenter="handleMouseEnter(index)"
      @mouseleave="handleMouseLeave"
      @click="handleLocatePoint(item, index)"
    >
      <!-- 卡片头部：圆圈序号 + 采分点精简公式/标准要求 + Debug 按钮 -->
      <div class="card-header-bar">
        <span class="point-num-badge">{{ item.displayIndex || index + 1 }}</span>
        <div class="point-header-text" v-html="renderMessageContent(getHeaderText(item))"></div>
        <q-btn
          v-if="isDev"
          flat
          dense
          round
          size="xs"
          icon="bug_report"
          color="grey-6"
          title="打印卡片 Debug 数据"
          @click.stop="logCardDebugInfo(item, index)"
          class="card-debug-btn"
          style="margin-left: auto; flex-shrink: 0;"
        />
      </div>

      <!-- 卡片主体：知识点标签 + 判罚描述 -->
      <div class="card-body-content">
        <!-- 标签行 -->
        <div v-if="item.applicableSigns && item.applicableSigns.length > 0" class="point-tags-row">
          <span v-for="(tag, tIdx) in item.applicableSigns" :key="tIdx" class="tag-pill">
            <span class="dot-icon">●</span> {{ tag }}
          </span>
        </div>

        <!-- 命中原因说明 -->
        <div v-if="item.hit && (item.potentialErrorReason || item.criterionReason || item.sourceText)" class="hit-reason-text" v-html="renderMessageContent(item.potentialErrorReason || item.criterionReason || item.sourceText)"></div>

        <!-- 未命中/错误说明 -->
        <div v-if="!item.hit" class="error-reason-box">
          <div v-if="item.potentialErrorType" class="error-type-tag">
            「{{ item.potentialErrorType }}」
          </div>
          <div v-if="item.potentialErrorReason || item.criterionReason || item.sourceText" class="error-reason-text" v-html="renderMessageContent(item.potentialErrorReason || item.criterionReason || item.sourceText)"></div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="empty-points-tip">暂无采分点明细数据</div>
</template>

<style scoped lang="scss">
.points-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 4px 16px 4px;

  .empty-points-tip {
    color: #908da8;
    text-align: center;
    padding: 24px;
    font-size: 14px;
  }

  .knowledge-point-card {
    border-radius: 14px;
    background: #ffffff;
    box-shadow: 0 2px 10px rgba(110, 85, 255, 0.04);
    border: 1px solid transparent;
    overflow: hidden;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover, &.is-hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(110, 85, 255, 0.12);
    }

    &.is-selected {
      border-color: #6e55ff !important;
      box-shadow: 0 0 0 2px rgba(110, 85, 255, 0.2), 0 6px 18px rgba(110, 85, 255, 0.12);
    }

    /* 命中/正确卡片样式 */
    &.is-hit-card {
      background: #fbf9ff;
      border: 1px solid #eae5ff;

      .card-header-bar {
        background: #f0ecff;

        .point-num-badge {
          background: #6e55ff;
          color: #ffffff;
        }

        .point-header-text {
          color: #2b2640;
        }
      }

      .tag-pill {
        color: #7b7899;
        .dot-icon {
          color: #8c76ff;
        }
      }

      .hit-reason-text {
        color: #787599;
      }
    }

    /* 未命中/错误卡片样式 */
    &.is-nohit-card {
      background: #fffafa;
      border: 1px solid #ffe8e8;

      .card-header-bar {
        background: #fff0f0;

        .point-num-badge {
          background: #ff5a5a;
          color: #ffffff;
        }

        .point-header-text {
          color: #3b2323;
        }
      }

      .tag-pill {
        color: #8f7979;
        .dot-icon {
          color: #ff7575;
        }
      }

      .error-type-tag {
        color: #ff5a5a;
        font-weight: 700;
        font-size: 13px;
        margin-bottom: 2px;
      }

      .error-reason-text {
        color: #877676;
      }
    }

    /* 头部栏 */
    .card-header-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;

      .point-num-badge {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
        flex-shrink: 0;
      }

      .point-header-text {
        font-size: 14px;
        font-weight: 700;
        line-height: 1.4;
      }
    }

    /* 主体内容 */
    .card-body-content {
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .point-tags-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        font-size: 13px;

        .tag-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;

          .dot-icon {
            font-size: 10px;
          }
        }
      }

      .hit-reason-text, .error-reason-text {
        font-size: 13px;
        line-height: 1.55;
      }
    }
  }
}
</style>
