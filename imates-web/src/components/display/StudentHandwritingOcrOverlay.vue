<script setup>
import { ref } from 'vue'
import correctIcon from '/icons/correct.svg'
import operationErrorIcon from '/icons/operation_error.svg'
import topicReviewErrorIcon from '/icons/topic_review_error.svg'
import thoughtErrorIcon from '/icons/thought_error.svg'

const props = defineProps({
  questionData: {
    type: Array,
    default: () => [],
  },
  scorePointList: {
    type: Array,
    default: () => [],
  },
  focusedPointIndex: {
    type: Number,
    default: null,
  },
  activePointId: {
    type: String,
    default: '',
  },
})

const isPointActive = (point, pointIndex) => {
  const pId = String(point?.pointId || point?.id || '')
  if (props.activePointId && pId === String(props.activePointId)) {
    return true
  }
  if (props.focusedPointIndex !== null && props.focusedPointIndex === pointIndex) {
    return true
  }
  return false
}

const emit = defineEmits(['select-point', 'select-region'])

const handleRegionClick = (point, pointIndex, region) => {
  console.log('[StudentHandwritingOcrOverlay] 🎯 OCR 划线区域被点击:', { pointIndex, point, region })
  emit('select-point', { point, index: pointIndex, region })
  emit('select-region', { point, pointIndex, region })
}

const imageMetaMap = ref({})

const handleImageLoad = (index, event) => {
  const img = event.target
  imageMetaMap.value[index] = {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
  }
}

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

const getRegionSourceIndex = (region) => region?.source_index ?? region?.sourceIndex ?? ''

const getRegionIdentity = (region) => {
  const bbox = getRegionBbox(region)
  if (!bbox) return ''
  return [getRegionSourceIndex(region), bbox.x1, bbox.y1, bbox.x2, bbox.y2].join('-')
}

const getNoHitRegionIdentitySet = () => {
  return new Set(
    (props.scorePointList || [])
      .filter((point) => !point?.hit)
      .flatMap((point) => getPointRegions(point).map(getRegionIdentity))
      .filter(Boolean),
  )
}

const getOverlayPointRegions = (point) => {
  const noHitRegionSet = getNoHitRegionIdentitySet()
  return getPointRegions(point).map((region) => ({
    ...region,
    suppressMarker: !!point?.hit && noHitRegionSet.has(getRegionIdentity(region)),
  }))
}

const shouldShowPointRegions = (pointIndex) =>
  props.focusedPointIndex === null || props.focusedPointIndex === pointIndex

const getRegionStyle = (region, imageIndex) => {
  const meta = imageMetaMap.value[imageIndex]
  if (!meta?.width || !meta?.height || !Array.isArray(region?.bbox)) {
    return { display: 'none' }
  }

  const bbox = getRegionBbox(region)
  if (!bbox || isVirtualRegion(region)) {
    return { display: 'none' }
  }

  const x1 = Math.max(0, Math.min(bbox.x1, meta.width))
  const y1 = Math.max(0, Math.min(bbox.y1, meta.height))
  const x2 = Math.max(0, Math.min(bbox.x2, meta.width))
  const y2 = Math.max(0, Math.min(bbox.y2, meta.height))
  const width = Math.max(0, x2 - x1)
  const height = Math.max(0, y2 - y1)

  return {
    left: `${(x1 / meta.width) * 100}%`,
    top: `${(y1 / meta.height) * 100}%`,
    width: `${Math.min(100, (width / meta.width) * 100)}%`,
    height: `${Math.min(100, (height / meta.height) * 100)}%`,
  }
}

const getIconForPoint = (point) => {
  if (point?.hit) {
    return correctIcon
  }
  const errType = String(point?.potentialErrorType || '')
  if (errType.includes('操作')) {
    return operationErrorIcon
  }
  if (errType.includes('审题')) {
    return topicReviewErrorIcon
  }
  return thoughtErrorIcon
}
</script>

<template>
  <div v-if="questionData && questionData.length > 0" class="images-list">
    <div
      v-for="(item, index) in questionData"
      :key="item.questionId || index"
      class="answer-image-wrapper"
      :data-image-index="index"
    >
      <template v-if="Array.isArray(item.answerData)">
        <img
          v-for="(imgUrl, imgIdx) in item.answerData"
          :key="imgIdx"
          class="student-image"
          :src="imgUrl"
          alt="学生作答图片"
          @load="handleImageLoad(index, $event)"
        />
      </template>
      <img
        v-else-if="typeof item.answerData === 'string'"
        class="student-image"
        :src="item.answerData"
        alt="学生作答图片"
        @load="handleImageLoad(index, $event)"
      />

      <!-- OCR 划线覆盖图层 -->
      <template v-if="index === 0">
        <template
          v-for="(point, pointIndex) in scorePointList || []"
          :key="point.pointId || point.id || pointIndex"
        >
          <template v-if="shouldShowPointRegions(pointIndex)">
            <div
              v-for="(region, regionIndex) in getOverlayPointRegions(point)"
              :key="`${point.pointId || point.id || pointIndex}-${regionIndex}`"
              :data-region-key="`${pointIndex}-${index}-${regionIndex}`"
              :class="[
                'ocr-region',
                point.hit ? 'is-hit' : 'is-nohit',
                region.suppressMarker ? 'is-suppressed' : '',
                isPointActive(point, pointIndex) ? 'is-active-point' : '',
              ]"
              :style="getRegionStyle(region, index)"
              @click.stop="handleRegionClick(point, pointIndex, region)"
            >
              <span v-if="!region.suppressMarker" class="region-marker">
                <span class="region-status-icon">
                  <img
                    :src="getIconForPoint(point)"
                    :alt="point.hit ? '命中' : '未命中'"
                    class="marker-svg-icon"
                  />
                </span>
                <span
                  class="region-index"
                  :class="point.hit ? 'is-hit-badge' : 'is-nohit-badge'"
                >
                  {{ point.displayIndex || pointIndex + 1 }}
                </span>
              </span>
            </div>
          </template>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.images-list {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .answer-image-wrapper {
    position: relative;
    width: 100%;
    border-radius: 6px;
    overflow: visible;

    .student-image {
      width: 100%;
      display: block;
    }

    .ocr-region {
      position: absolute;
      border: none;
      pointer-events: auto;
      cursor: pointer;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      outline: none;

      &:hover,
      &:active,
      &:focus {
        outline: none;
        box-shadow: none;
      }

      /* 激活/选中的采分点：增加 2px 边框 */
      &.is-active-point {
        border: 2px solid #6e55ff !important;
        box-shadow: none !important;
        border-radius: 4px;
        z-index: 20;
      }

      /* 命中遮罩（柔和紫色半透明） */
      &.is-hit {
        background: rgba(110, 85, 255, 0.22);
      }

      /* 未命中遮罩（柔和粉红半透明） */
      &.is-nohit {
        background: rgba(220, 100, 100, 0.25);
      }

      &.is-suppressed {
        opacity: 0.5;
      }

      /* 右侧标志容器 (SVG 图标 + 圆形序号) */
      .region-marker {
        position: absolute;
        top: 50%;
        right: -56px;
        transform: translateY(-50%);
        display: flex;
        align-items: center;
        gap: 4px;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0;
        z-index: 10;

        .region-status-icon {
          display: flex;
          align-items: center;
          justify-content: center;

          .marker-svg-icon {
            width: 30px;
            height: 30px;
            display: block;
            object-fit: contain;
          }
        }

        .region-index {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: #ffffff;
          flex-shrink: 0;

          &.is-hit-badge {
            background: #6e55ff;
          }

          &.is-nohit-badge {
            background: #ff3b30;
          }
        }
      }
    }
  }
}
</style>
