<script setup>
import { ref, onMounted, nextTick, computed, watch } from 'vue'
import { useMessageRenderer } from '@/composables/useMessageRenderer'
import StudentHandwritingOcrOverlay from './StudentHandwritingOcrOverlay.vue'
import ScorePointCardList from './ScorePointCardList.vue'

const { renderMessageContent } = useMessageRenderer()

const props = defineProps({
  // 作业提交详情原始数据 (单条或者数组均可，也可以直接是 questionJudgeDataData 对象)
  detailData: {
    type: [Object, Array, String],
    default: null,
  },
  // 当前题目 ID（非必传，如果不传则自动使用第一条数据中的 questionId）
  questionId: {
    type: String,
    default: '',
  },
  // 标题
  titleText: {
    type: String,
    default: '',
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'change-hit'])

const activePointIndex = ref(null)
const hoverPointIndex = ref(null)
const selectedPointIndex = ref(null)
const imageMetaMap = ref({})
const judgeResult = ref(null)
const studentThinking = ref('')
const logicSuspectMessage = ref('')
const questionType = ref('')
const questionData = ref([])
const scorePointList = ref([])
const leftRef = ref(null)

const subQuestionList = ref([])
const activeQuestionId = ref('')

const activeSubQuestionStem = computed(() => {
  const item = subQuestionList.value.find((s) => s.id === activeQuestionId.value)
  return item?.stem || ''
})

const focusedPointIndex = computed(() => {
  if (hoverPointIndex.value !== null) return hoverPointIndex.value
  if (selectedPointIndex.value !== null) return selectedPointIndex.value
  return activePointIndex.value
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

const getRegionSourceIndex = (region) => region?.source_index ?? region?.sourceIndex ?? ''

const getRegionIdentity = (region) => {
  const bbox = getRegionBbox(region)
  if (!bbox) return ''
  return [getRegionSourceIndex(region), bbox.x1, bbox.y1, bbox.x2, bbox.y2].join('-')
}

const getNoHitRegionIdentitySet = () => {
  return new Set(
    (scorePointList.value || [])
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
  focusedPointIndex.value === null || focusedPointIndex.value === pointIndex

const parseJsonIfNeeded = (data) => {
  if (!data) return null
  if (typeof data === 'object') return data
  try {
    return JSON.parse(data)
  } catch (error) {
    console.error('[ViewDetailsRender] parseJson failed:', error)
    return null
  }
}

const findJudgeResult = (judgeData, targetQuestionId) => {
  const parsed = parseJsonIfNeeded(judgeData)
  const results = parsed?.results || parsed
  if (!Array.isArray(results)) return null
  if (!targetQuestionId) return results[0] || null

  return (
    results.find((item) => {
      const nodeId = item?.nodeId || ''
      const resultQuestionId = item?.questionId || ''
      return (
        nodeId === targetQuestionId ||
        resultQuestionId === targetQuestionId ||
        nodeId.endsWith(`.${targetQuestionId}`) ||
        nodeId.endsWith(`_${targetQuestionId}`) ||
        nodeId.includes(targetQuestionId) ||
        targetQuestionId.includes(resultQuestionId) ||
        targetQuestionId.includes(nodeId)
      )
    }) || results[0] || null
  )
}

const getJudgePayloadMap = (result) => {
  const payload = result?.route?.payload
  if (!Array.isArray(payload)) return {}
  return payload.reduce((map, item) => {
    if (item?.standard_node_id) {
      map[item.standard_node_id] = item
    }
    return map
  }, {})
}

const getNormalizedRegions = (regions) => {
  if (!Array.isArray(regions)) return []
  return regions.map((region) => ({
    ...region,
    text: region.text || region.corrected_text,
  }))
}

const getPointId = (item) => item?.pointId || item?.id || ''

const getDefaultLogicSuspectMessage = (result = judgeResult.value) => {
  const payload = result?.route?.payload
  if (!Array.isArray(payload)) return ''
  return payload.find((item) => item?.logic_suspect && item?.logic_suspect_message)?.logic_suspect_message || ''
}

const mergeJudgeDataToScorePoints = (points, result) => {
  const payloadMap = getJudgePayloadMap(result)
  return (Array.isArray(points) ? points : []).map((point) => {
    const judgePoint = payloadMap[getPointId(point)]
    if (!judgePoint) return point
    const matchedOcrRegions = getNormalizedRegions(judgePoint.matched_ocr_regions || point.matchedOcrRegions)
    return {
      ...point,
      matchedOcrRegions,
      hit: judgePoint.criterion_met ?? point.hit,
      potentialErrorType: judgePoint.potential_error_type,
      potentialErrorReason: judgePoint.potential_error_reason,
      logicSuspect: judgePoint.logic_suspect,
      logicSuspectMessage: judgePoint.logic_suspect_message,
      criterionReason: point.criterionReason,
      sourceText: point.sourceText || judgePoint.hit_description || '',
    }
  })
}

const setJudgeDisplayData = (result) => {
  judgeResult.value = result
  studentThinking.value = result?.rearrange_students_answer || ''
  logicSuspectMessage.value = getDefaultLogicSuspectMessage(result)
}

const buildSubQuestionList = (structureData, judgeData, revisedData, answerData, rawItemData) => {
  const list = []

  const subQuestions = structureData?.question?.subQuestions || structureData?.subQuestions
  if (Array.isArray(subQuestions) && subQuestions.length > 0) {
    subQuestions.forEach((sub, idx) => {
      const subId = sub.id || `${rawItemData?.questionId}_sub_${idx + 1}`
      const resultObj = findJudgeResult(judgeData, subId)
      const hitCount = resultObj?.scoreSummary?.hitCount ?? 0
      const pointCount = resultObj?.scoreSummary?.pointCount ?? (resultObj?.route?.payload?.length || 0)

      list.push({
        id: subId,
        label: `子题 ${idx + 1}`,
        stem: sub.stem || '',
        hitCount,
        pointCount,
        hitSummary: pointCount > 0 ? `${hitCount}/${pointCount} 采分点` : '',
        isAllHit: pointCount > 0 && hitCount === pointCount,
      })
    })
    return list
  }

  const parsedJudge = parseJsonIfNeeded(judgeData)
  const results = parsedJudge?.results
  if (Array.isArray(results) && results.length > 1) {
    results.forEach((res, idx) => {
      const subId = res.questionId || res.nodeId || `sub_${idx + 1}`
      const label = res.nodeLabel ? res.nodeLabel.replace(/^主题目\s*>\s*/, '') : `子题 ${idx + 1}`
      const hitCount = res.scoreSummary?.hitCount ?? 0
      const pointCount = res.scoreSummary?.pointCount ?? (res.route?.payload?.length || 0)

      list.push({
        id: subId,
        label,
        stem: '',
        hitCount,
        pointCount,
        hitSummary: pointCount > 0 ? `${hitCount}/${pointCount} 采分点` : '',
        isAllHit: pointCount > 0 && hitCount === pointCount,
      })
    })
    return list
  }

  if (Array.isArray(revisedData) && revisedData.length > 1) {
    revisedData.forEach((rev, idx) => {
      const subId = rev.questionId || `sub_${idx + 1}`
      const hitCount = rev.scoreSummary?.hitCount ?? 0
      const pointCount = rev.scoreSummary?.pointCount ?? 0

      list.push({
        id: subId,
        label: `子题 ${idx + 1}`,
        stem: '',
        hitCount,
        pointCount,
        hitSummary: pointCount > 0 ? `${hitCount}/${pointCount} 采分点` : '',
        isAllHit: pointCount > 0 && hitCount === pointCount,
      })
    })
    return list
  }

  if (Array.isArray(answerData) && answerData.length > 1) {
    answerData.forEach((ans, idx) => {
      const subId = ans.questionId || `sub_${idx + 1}`
      list.push({
        id: subId,
        label: `子题 ${idx + 1}`,
        stem: '',
        hitCount: 0,
        pointCount: 0,
        hitSummary: '',
        isAllHit: false,
      })
    })
    return list
  }

  return list
}

const selectSubQuestion = (targetQId) => {
  if (activeQuestionId.value === targetQId) return
  activeQuestionId.value = targetQId
  activePointIndex.value = null
  selectedPointIndex.value = null
  hoverPointIndex.value = null
  updateCurrentDisplayData(targetQId)
}

const updateCurrentDisplayData = (targetQId) => {
  if (!props.detailData) return

  let itemData = props.detailData
  if (Array.isArray(props.detailData)) {
    itemData = props.detailData[0] || {}
  }

  const structureData = parseJsonIfNeeded(itemData.questionStructureData)
  const answerData = parseJsonIfNeeded(itemData.questionAnswerData)
  const revisedData = parseJsonIfNeeded(itemData.questionRevisedData)
  const judgeData = parseJsonIfNeeded(itemData.questionJudgeDataData)

  const resultObj = findJudgeResult(judgeData, targetQId)
  setJudgeDisplayData(resultObj)

  if (Array.isArray(revisedData) && revisedData.length > 0) {
    const matched = revisedData.filter(
      (it) => targetQId && (it.questionId === targetQId || it.questionId?.includes(targetQId)),
    )
    questionData.value = matched.length > 0 ? matched : revisedData
  } else if (Array.isArray(answerData) && answerData.length > 0) {
    const matched = answerData.filter(
      (it) => targetQId && (it.questionId === targetQId || it.questionId?.includes(targetQId)),
    )
    questionData.value = matched.length > 0 ? matched : answerData
  } else {
    questionData.value = []
  }

  questionType.value = structureData?.question?.type || structureData?.type || 'subjective'

  let rawPoints = itemData.scorePointInfoMap ? itemData.scorePointInfoMap[targetQId] : null
  if (!rawPoints && resultObj?.route?.payload) {
    rawPoints = resultObj.route.payload.map((p, idx) => ({
      id: p.standard_node_id,
      pointId: p.standard_node_id,
      hit: p.criterion_met,
      sourceText: p.hit_description || `采分点 ${idx + 1}`,
      matchedOcrRegions: p.matched_ocr_regions,
      potentialErrorType: p.potential_error_type,
      potentialErrorReason: p.potential_error_reason,
    }))
  } else if (!rawPoints && resultObj?.scoreSummary?.points) {
    rawPoints = resultObj.scoreSummary.points.map((p, idx) => ({
      id: p.pointId,
      pointId: p.pointId,
      hit: p.hit,
      sourceText: `采分点 ${idx + 1}`,
      score: p.score,
      maxScore: p.maxScore,
    }))
  }

  scorePointList.value = mergeJudgeDataToScorePoints(rawPoints, resultObj)
}

const processDetailData = () => {
  if (!props.detailData) {
    judgeResult.value = null
    scorePointList.value = []
    questionData.value = []
    subQuestionList.value = []
    activeQuestionId.value = ''
    return
  }

  let itemData = props.detailData
  if (Array.isArray(props.detailData)) {
    itemData = props.detailData[0] || {}
  }

  const structureData = parseJsonIfNeeded(itemData.questionStructureData)
  const answerData = parseJsonIfNeeded(itemData.questionAnswerData)
  const revisedData = parseJsonIfNeeded(itemData.questionRevisedData)
  const judgeData = parseJsonIfNeeded(itemData.questionJudgeDataData)

  const list = buildSubQuestionList(structureData, judgeData, revisedData, answerData, itemData)
  subQuestionList.value = list

  let initialQId = props.questionId || itemData.questionId || ''
  if (list.length > 0) {
    const match = list.find((s) => s.id === initialQId || s.id.includes(initialQId))
    initialQId = match ? match.id : list[0].id
  }
  activeQuestionId.value = initialQId

  updateCurrentDisplayData(initialQId)
}

watch(() => [props.detailData, props.questionId], processDetailData, { immediate: true })

const handleImageLoad = (index, event) => {
  const img = event.target
  imageMetaMap.value[index] = {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
  }
}

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

const locatePoint = async (item, index) => {
  activePointIndex.value = index
  selectedPointIndex.value = index
  if (getPointRegions(item).length === 0) return

  await nextTick()
  const regionEl = leftRef.value?.querySelector(`[data-region-key="${index}-0-0"]`)
  const imageEl = leftRef.value?.querySelector(`[data-image-index="0"]`)
  ;(regionEl || imageEl)?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'center',
  })
}

const handlePointMouseEnter = (index) => {
  hoverPointIndex.value = index
}

const handlePointMouseLeave = () => {
  hoverPointIndex.value = null
}

const changeHit = (item) => {
  emit('change-hit', item)
}
</script>

<template>
  <div class="view-details-render-container">
    <div v-if="loading" class="loading-box">
      <q-spinner-dots color="primary" size="40px" />
      <span class="q-ml-sm text-grey-4">正在分析判题详情...</span>
    </div>

    <div v-else-if="!detailData" class="empty-box">
      <q-icon name="info" size="48px" color="grey-6" />
      <div class="text-grey-5 q-mt-sm">暂无判罚详情数据</div>
    </div>

    <div v-else class="render-main">
      <!-- 左侧：图像及 OCR 矩形标注区 -->
      <div class="left-section" ref="leftRef">
        <div class="section-title">
          题目作答与标注
          <span class="question-type-tag">{{ questionType === 'composite' ? '主观解答题' : '复合材料题' }}</span>
        </div>

        <!-- 子题切换 Tab 列表 -->
        <div v-if="subQuestionList && subQuestionList.length > 1" class="sub-questions-bar">
          <div
            v-for="sub in subQuestionList"
            :key="sub.id"
            :class="['sub-q-btn', activeQuestionId === sub.id ? 'is-active' : '']"
            @click="selectSubQuestion(sub.id)"
          >
            <span class="sub-q-label">{{ sub.label }}</span>
            <span v-if="sub.hitSummary" class="sub-q-badge" :class="sub.hitCount > 0 ? 'badge-hit' : 'badge-nohit'">
              {{ sub.hitSummary }}
            </span>
          </div>
        </div>

        <!-- 选中的子题题干 -->
        <div v-if="activeSubQuestionStem" class="sub-q-stem-box">
          <div class="sub-q-stem-title">子题题干：</div>
          <div class="sub-q-stem-content" v-html="renderMessageContent(activeSubQuestionStem)"></div>
        </div>

        <div v-if="logicSuspectMessage" class="warning-banner">
          <q-icon name="warning" color="warning" class="q-mr-xs" />
          <span v-html="renderMessageContent(logicSuspectMessage)"></span>
        </div>

        <div class="title-text" v-if="titleText" v-html="renderMessageContent(titleText)"></div>

        <!-- 学生手写图片 + OCR 划线覆盖图层组件 -->
        <StudentHandwritingOcrOverlay
          :question-data="questionData"
          :score-point-list="scorePointList"
          :focused-point-index="focusedPointIndex"
        />

        <div v-if="studentThinking" class="student-thinking-box">
          <div class="thinking-title">💡 学生思路解析：</div>
          <div class="thinking-content" v-html="renderMessageContent(studentThinking)"></div>
        </div>
      </div>

      <!-- 右侧：采分点判定与诊断细则 -->
      <div class="right-section">
        <div class="section-title">采分点判定明细</div>
        <ScorePointCardList
          :score-point-list="scorePointList"
          :active-point-index="activePointIndex"
          :hover-point-index="hoverPointIndex"
          :selected-point-index="selectedPointIndex"
          @locate-point="({ item, index }) => locatePoint(item, index)"
          @mouseenter-point="handlePointMouseEnter"
          @mouseleave-point="handlePointMouseLeave"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.view-details-render-container {
  width: 100%;
  height: 100%;
  min-height: 550px;
  display: flex;
  flex-direction: column;
  background: #181824;
  color: #fff;
  overflow: hidden;

  .loading-box, .empty-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
  }

  .render-main {
    flex: 1;
    display: flex;
    gap: 16px;
    overflow: hidden;
    padding: 12px;

    .left-section {
      flex: 1.3;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      background: #1e1e2d;
      border-radius: 8px;
      padding: 16px;

      .section-title {
        font-size: 16px;
        font-weight: bold;
        color: #fff;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 8px;

        .question-type-tag {
          font-size: 12px;
          padding: 2px 8px;
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          border-radius: 4px;
        }
      }

      .sub-questions-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        padding: 6px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        overflow-x: auto;

        .sub-q-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 6px;
          background: transparent;
          color: #909399;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          user-select: none;
          border: 1px solid transparent;
          white-space: nowrap;

          &:hover {
            background: rgba(255, 255, 255, 0.08);
            color: #fff;
          }

          &.is-active {
            background: #2b2b3d;
            color: #38ef7d;
            font-weight: 600;
            border-color: #38ef7d;
            box-shadow: 0 2px 8px rgba(56, 239, 125, 0.15);
          }

          .sub-q-badge {
            font-size: 11px;
            padding: 2px 6px;
            border-radius: 10px;
            line-height: 1;

            &.badge-hit {
              background: rgba(56, 239, 125, 0.2);
              color: #38ef7d;
            }
            &.badge-nohit {
              background: rgba(245, 108, 108, 0.2);
              color: #f56c6c;
            }
          }
        }
      }

      .sub-q-stem-box {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-left: 3px solid #38ef7d;
        border-radius: 6px;
        padding: 10px 14px;
        margin-bottom: 12px;

        .sub-q-stem-title {
          font-size: 12px;
          color: #38ef7d;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .sub-q-stem-content {
          font-size: 13px;
          line-height: 1.6;
          color: #e4e7ed;
        }
      }

      .warning-banner {
        background: rgba(245, 158, 11, 0.15);
        border: 1px solid rgba(245, 158, 11, 0.4);
        color: #fbbf24;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        margin-bottom: 12px;
      }

      .images-list {
        display: flex;
        flex-direction: column;
        gap: 16px;

        .answer-image-wrapper {
          position: relative;
          width: 100%;
          border-radius: 6px;
          overflow: hidden;
          background: #12121a;

          .student-image {
            width: 100%;
            display: block;
          }

          .ocr-region {
            position: absolute;
            border: 2px solid transparent;
            pointer-events: none;
            transition: all 0.2s ease;

            &.is-hit {
              border-color: #10b981;
              background: rgba(16, 185, 129, 0.15);
            }

            &.is-nohit {
              border-color: #ef4444;
              background: rgba(239, 68, 68, 0.15);
            }

            .region-marker {
              position: absolute;
              top: -12px;
              left: -12px;
              display: flex;
              align-items: center;
              gap: 2px;
              background: #1e1e2d;
              padding: 2px 6px;
              border-radius: 12px;
              border: 1px solid #374151;
              font-size: 12px;
            }
          }
        }
      }

      .student-thinking-box {
        margin-top: 16px;
        background: #12121a;
        padding: 12px;
        border-radius: 6px;
        border-left: 3px solid #3b82f6;

        .thinking-title {
          font-weight: bold;
          color: #93c5fd;
          font-size: 13px;
          margin-bottom: 6px;
        }

        .thinking-content {
          font-size: 13px;
          color: #d1d5db;
          line-height: 1.5;
        }
      }
    }

    .right-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      background: #1e1e2d;
      border-radius: 8px;
      padding: 16px;

      .section-title {
        font-size: 16px;
        font-weight: bold;
        color: #fff;
        margin-bottom: 12px;
      }

      .points-list {
        display: flex;
        flex-direction: column;
        gap: 10px;

        .knowledge-point-card {
          background: #12121a;
          border: 1px solid #2d2d3f;
          border-radius: 6px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.2s ease;

          &:hover, &.is-hover {
            border-color: #3b82f6;
            background: #1a1a28;
          }

          &.is-selected {
            border-color: #60a5fa;
            box-shadow: 0 0 8px rgba(96, 165, 250, 0.3);
          }

          .point-header {
            display: flex;
            align-items: flex-start;
            gap: 10px;

            .point-num {
              width: 20px;
              height: 20px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              font-weight: bold;
              color: #fff;
              flex-shrink: 0;
            }

            .point-text {
              font-size: 13px;
              color: #e5e7eb;
              line-height: 1.4;
            }
          }

          .point-body {
            margin-top: 8px;
            padding-left: 30px;
            font-size: 12px;

            .hit-reason {
              color: #10b981;
            }

            .error-reason {
              color: #f87171;

              .error-tag {
                font-weight: bold;
              }
            }
          }
        }
      }
    }
  }
}
</style>
