<template>
  <div class="judge-detail-panel">
    <!-- 顶部题目切换导航 -->
    <div class="panel-nav" v-if="questions.length > 1">
      <button
        v-for="(q, idx) in questions"
        :key="q.id || idx"
        :class="['nav-tab', { 'is-active': activeIndex === idx }]"
        @click="activeIndex = idx"
      >
        题目 {{ idx + 1 }}
      </button>
    </div>
    <!-- 加载态 -->
    <div v-if="loading || isLoadingScorePoint" class="loading-state">
      <div class="loading-spinner"></div>
      <span>正在加载批改详情...</span>
    </div>
    <!-- 空状态 -->
    <div v-else-if="!currentQuestion" class="empty-state">
      <p>暂无批改详情数据</p>
    </div>
    <!-- 主内容 -->
    <div v-else class="panel-main">
      <!-- 左侧：题干 + 学生图片 + OCR框 -->
      <div class="panel-left" ref="leftRef">
        <div class="section-title">题目</div>
        <div v-if="logicSuspectMessage" class="waring-info is-active">
          <span v-html="logicSuspectMessage"></span>
        </div>
        <div class="stem-html" v-if="stemHtml" v-html="stemHtml"></div>
        <div
          v-for="(answerItem, imgIdx) in answerDataList"
          :key="imgIdx"
          class="answer-image-wrapper"
          :data-image-index="imgIdx"
        >
          <img
            class="student-image"
            :src="answerItem.answerData"
            alt="学生作答图片"
            @load="handleImageLoad(imgIdx, $event)"
          />
          <template v-if="imgIdx === 0">
            <template
              v-for="(point, pointIndex) in scorePointList || []"
              :key="point.pointId || point.id || pointIndex"
            >
              <template v-if="shouldShowPointRegions(pointIndex)">
                <div
                  v-for="(region, regionIndex) in getOverlayPointRegions(point)"
                  :key="`${pointIndex}-${regionIndex}`"
                  :data-region-key="`${pointIndex}-${imgIdx}-${regionIndex}`"
                  :class="['ocr-region', point.hit ? 'is-hit' : 'is-nohit', region.suppressMarker ? 'is-suppressed' : '']"
                  :style="getRegionStyle(region, imgIdx)"
                >
                  <span v-if="!region.suppressMarker" class="region-marker">
                    <span class="region-status-icon">
                      <svg v-if="point.hit" width="20" height="20" viewBox="0 0 28 28" fill="none">
                        <circle cx="14" cy="14" r="11" fill="currentColor" opacity="0.15"/>
                        <path d="M8 14l4 4 8-8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      <svg v-else width="20" height="20" viewBox="0 0 28 28" fill="none">
                        <circle cx="14" cy="14" r="11" fill="currentColor" opacity="0.15"/>
                        <path d="M10 10l8 8M18 10l-8 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </span>
                    <span class="region-index">{{ pointIndex + 1 }}</span>
                  </span>
                </div>
              </template>
            </template>
          </template>
        </div>
        <div v-if="studentThinking" class="student-thinking">
          <div class="thinking-title">学生思路：</div>
          <div class="thinking-content" v-html="studentThinking"></div>
        </div>
      </div>
      <!-- 右侧：采分点明细 -->
      <div class="panel-right">
        <div class="section-title">采分点明细</div>
        <div v-if="scorePointList && scorePointList.length > 0">
          <div
            v-for="(item, index) in scorePointList"
            :key="item.id || index"
            :class="[
              'knowledge-point',
              item.hit ? 'is-hit' : 'is-nohit',
              activePointIndex === index ? 'is-active' : '',
              hoverPointIndex === index ? 'is-hover' : '',
              selectedPointIndex === index ? 'is-selected' : '',
              hasPointRegions(item) ? 'is-locatable' : '',
            ]"
            @mouseenter="handlePointMouseEnter(index)"
            @mouseleave="handlePointMouseLeave"
            @click="locatePoint(item, index)"
          >
            <div class="title-content">
              <div class="top">
                <div class="number">{{ index + 1 }}</div>
                <div class="text" v-html="item.sourceText || ''"></div>
              </div>
            </div>
            <div class="text-content">
              <div class="content">
                <div
                  v-for="(kp, kIdx) in item.knowledgePoints || []"
                  :key="kIdx"
                  class="point"
                >
                  <div class="dot"></div>
                  <div>{{ kp }}</div>
                </div>
              </div>
              <div v-if="item.hit" class="hit-reason" v-html="item.criterionReason || ''"></div>
              <div v-if="!item.hit && item.potentialErrorType" class="error-style">
                <span class="error-type">{{ item.potentialErrorType }}</span>
                <span class="error-info" v-html="item.potentialErrorReason || ''"></span>
              </div>
              <div class="bottom">
                <div
                  v-if="item.hit && item.logicSuspect && item.logicSuspectMessage"
                  class="has-question"
                  @mouseenter.stop="handleIssueMouseEnter(item)"
                  @mouseleave.stop="handleIssueMouseLeave"
                >
                  <span>逻辑存疑</span>
                </div>
                <div :class="['hit-badge', item.hit ? 'is-hit-badge' : 'is-nohit-badge']">
                  <span class="hit-dot"></span>
                  {{ item.hit ? '命中' : '未命中' }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="no-score-points">暂无采分点明细</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { apiService } from '@/services/http/api-service'

const props = defineProps<{
  judgeDetails: any[] | null
  loading?: boolean
}>()

const activeIndex = ref(0)
const questions = computed(() => props.judgeDetails || [])
const currentQuestion = computed(() => questions.value[activeIndex.value] || null)

const leftRef = ref<HTMLDivElement | null>(null)
const activePointIndex = ref<number | null>(null)
const hoverPointIndex = ref<number | null>(null)
const selectedPointIndex = ref<number | null>(null)
const imageMetaMap = ref<Record<number, { width: number; height: number }>>({})
const judgeResult = ref<any>(null)
const studentThinking = ref('')
const logicSuspectMessage = ref('')
const scorePointList = ref<any[]>([])
const stemHtml = ref('')
const answerDataList = ref<any[]>([])
const isLoadingScorePoint = ref(false)

const focusedPointIndex = computed(() => {
  if (hoverPointIndex.value !== null) return hoverPointIndex.value
  if (selectedPointIndex.value !== null) return selectedPointIndex.value
  return activePointIndex.value
})

const resetPointState = () => {
  activePointIndex.value = null
  hoverPointIndex.value = null
  selectedPointIndex.value = null
  imageMetaMap.value = {}
  judgeResult.value = null
  studentThinking.value = ''
  logicSuspectMessage.value = ''
  scorePointList.value = []
  stemHtml.value = ''
  answerDataList.value = []
}

const getRegionBbox = (region: any) => {
  if (!Array.isArray(region?.bbox) || region.bbox.length < 4) return null
  const [x1, y1, x2, y2] = region.bbox.slice(0, 4).map(Number)
  if ([x1, y1, x2, y2].some((v) => Number.isNaN(v))) return null
  if (x2 <= x1 || y2 <= y1) return null
  return { x1, y1, x2, y2 }
}

const isVirtualRegion = (region: any) => {
  const bbox = getRegionBbox(region)
  return bbox && bbox.x1 === 0 && bbox.y1 === 0 && bbox.x2 === 1 && bbox.y2 === 1
}

const getPointRegions = (item: any) =>
  Array.isArray(item?.matchedOcrRegions)
    ? item.matchedOcrRegions.filter((r: any) => getRegionBbox(r) && !isVirtualRegion(r))
    : []

const hasPointRegions = (item: any) => getPointRegions(item).length > 0

const getRegionSourceIndex = (region: any) => region?.source_index ?? region?.sourceIndex ?? ''

const getRegionIdentity = (region: any) => {
  const bbox = getRegionBbox(region)
  if (!bbox) return ''
  return [getRegionSourceIndex(region), bbox.x1, bbox.y1, bbox.x2, bbox.y2].join('-')
}

const getNoHitRegionIdentitySet = () =>
  new Set(
    (scorePointList.value || [])
      .filter((p) => !p?.hit)
      .flatMap((p) => getPointRegions(p).map(getRegionIdentity))
      .filter(Boolean),
  )

const getOverlayPointRegions = (point: any) => {
  const noHitSet = getNoHitRegionIdentitySet()
  return getPointRegions(point).map((r: any) => ({
    ...r,
    suppressMarker: !!point?.hit && noHitSet.has(getRegionIdentity(r)),
  }))
}

const shouldShowPointRegions = (pointIndex: number) =>
  focusedPointIndex.value === null || focusedPointIndex.value === pointIndex

const getRegionStyle = (region: any, imageIndex: number) => {
  const meta = imageMetaMap.value[imageIndex]
  if (!meta?.width || !meta?.height || !Array.isArray(region?.bbox)) return { display: 'none' }
  const bbox = getRegionBbox(region)
  if (!bbox || isVirtualRegion(region)) return { display: 'none' }
  const x1 = Math.max(0, Math.min(bbox.x1, meta.width))
  const y1 = Math.max(0, Math.min(bbox.y1, meta.height))
  const x2 = Math.max(0, Math.min(bbox.x2, meta.width))
  const y2 = Math.max(0, Math.min(bbox.y2, meta.height))
  const w = Math.max(0, x2 - x1)
  const h = Math.max(0, y2 - y1)
  return {
    left: `${(x1 / meta.width) * 100}%`,
    top: `${(y1 / meta.height) * 100}%`,
    width: `${Math.min(100, (w / meta.width) * 100)}%`,
    height: `${Math.min(100, (h / meta.height) * 100)}%`,
  }
}

const handleImageLoad = (index: number, event: Event) => {
  const img = event.target as HTMLImageElement
  imageMetaMap.value[index] = {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
  }
}

const locatePoint = async (item: any, index: number) => {
  activePointIndex.value = index
  selectedPointIndex.value = index
  if (getPointRegions(item).length === 0) return
  await nextTick()
  const regionEl = leftRef.value?.querySelector(`[data-region-key="${index}-0-0"]`)
  const imageEl = leftRef.value?.querySelector('[data-image-index="0"]')
  ;(regionEl || imageEl)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
}

const handlePointMouseEnter = (index: number) => { hoverPointIndex.value = index }
const handlePointMouseLeave = () => { hoverPointIndex.value = null }

const parseJson = (data: any) => {
  if (!data) return null
  if (typeof data === 'object') return data
  try { return JSON.parse(data) } catch { return null }
}

const getDefaultLogicSuspectMessage = (result: any) => {
  const payload = result?.route?.payload
  if (!Array.isArray(payload)) return ''
  return payload.find((i: any) => i?.logic_suspect && i?.logic_suspect_message)?.logic_suspect_message || ''
}

const handleIssueMouseEnter = (item: any) => {
  logicSuspectMessage.value = item?.logicSuspectMessage || ''
}
const handleIssueMouseLeave = () => {
  logicSuspectMessage.value = getDefaultLogicSuspectMessage(judgeResult.value)
}

const getNormalizedRegions = (regions: any[]) => {
  if (!Array.isArray(regions)) return []
  return regions.map((r) => ({ ...r, text: r.text || r.corrected_text }))
}

const getPointId = (item: any) => item?.pointId || item?.id || ''

const getJudgePayloadMap = (result: any) => {
  const payload = result?.route?.payload
  if (!Array.isArray(payload)) return {}
  return payload.reduce((map: any, item: any) => {
    if (item?.standard_node_id) map[item.standard_node_id] = item
    return map
  }, {})
}

const mergeJudgeDataToScorePoints = (points: any[], result: any) => {
  const payloadMap = getJudgePayloadMap(result)
  return (Array.isArray(points) ? points : []).map((point) => {
    const judgePoint = payloadMap[getPointId(point)]
    if (!judgePoint) return point
    return {
      ...point,
      matchedOcrRegions: getNormalizedRegions(judgePoint.matched_ocr_regions || point.matchedOcrRegions),
      potentialErrorType: judgePoint.potential_error_type,
      potentialErrorReason: judgePoint.potential_error_reason,
      logicSuspect: judgePoint.logic_suspect,
      logicSuspectMessage: judgePoint.logic_suspect_message,
      criterionReason: point.criterionReason,
    }
  })
}

const loadScorePointForCurrent = async () => {
  const q = currentQuestion.value
  if (!q) {
    resetPointState()
    return
  }
  resetPointState()
  isLoadingScorePoint.value = true
  try {
    const structData = parseJson(q.questionStructureData)
    stemHtml.value = structData?.question?.stem || ''

    let rawAnswerData: any[] = []
    if (q.questionAnswerData) {
      const parsed = parseJson(q.questionAnswerData)
      rawAnswerData = Array.isArray(parsed) ? parsed : []
    } else if (q.questionRevisedData) {
      const parsed = parseJson(q.questionRevisedData)
      rawAnswerData = Array.isArray(parsed) ? parsed : []
    }
    answerDataList.value = rawAnswerData.filter((item: any) => item?.answerData)

    const judgeDataRaw = q.questionJudgeDataData || q.judgeData
    const judgeDataParsed = parseJson(judgeDataRaw)
    if (judgeDataParsed) {
      const results = judgeDataParsed?.results
      const currentQuestionId = q.questionId
      let result: any = null
      if (Array.isArray(results)) {
        result = results.find((item: any) => {
          const nodeId = item?.nodeId || ''
          const rQId = item?.questionId || ''
          return (
            nodeId === currentQuestionId ||
            rQId === currentQuestionId ||
            nodeId.endsWith(`.${currentQuestionId}`) ||
            nodeId.endsWith(`_${currentQuestionId}`) ||
            nodeId.includes(currentQuestionId)
          )
        }) || null
      }
      judgeResult.value = result
      studentThinking.value = result?.rearrange_students_answer || ''
      logicSuspectMessage.value = getDefaultLogicSuspectMessage(result)
    }

    const scorePointApi = (apiService.homeworkApi as any).homeworkSubmitDetailScorePointMap
    if (scorePointApi && q.id) {
      const scorePointRes = await scorePointApi({ id: q.id })
      if (scorePointRes?.success && q.questionId) {
        const rawPoints = scorePointRes.data?.scorePointInfoMap?.[q.questionId]
        scorePointList.value = mergeJudgeDataToScorePoints(rawPoints || [], judgeResult.value)
      }
    }
  } catch (err) {
    console.error('[HomeworkJudgeDetailPanel] 加载采分点失败:', err)
  } finally {
    isLoadingScorePoint.value = false
  }
}

watch(() => props.judgeDetails, () => { activeIndex.value = 0; resetPointState() })
watch(() => currentQuestion.value, () => { loadScorePointForCurrent() }, { immediate: true })
</script>

<style scoped lang="scss">
.judge-detail-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}

.panel-nav {
  display: flex;
  gap: 6px;
  padding: 12px 16px 0;
  flex-shrink: 0;
  border-bottom: 1px solid #f0eef8;
  overflow-x: auto;

  .nav-tab {
    padding: 6px 14px;
    border: none;
    border-radius: 20px 20px 0 0;
    background: #f5f4fb;
    color: #7b78a0;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;

    &:hover { background: #ece9ff; color: #5a5ce2; }
    &.is-active { background: #7a7cff; color: #fff; font-weight: 600; }
  }
}

.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #9792ac;
  font-size: 14px;

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #ece9ff;
    border-top-color: #7a7cff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
}

@keyframes spin { to { transform: rotate(360deg); } }

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9792ac;
  font-size: 14px;
}

.panel-main {
  flex: 1;
  display: flex;
  gap: 12px;
  padding: 16px;
  overflow: hidden;
  min-height: 0;
}

.panel-left {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  border: 1px solid #e8e5f5;
  padding: 16px;
  border-radius: 12px;
  box-sizing: border-box;
  font-size: 14px;

  &::after { content: ''; display: block; height: 20px; width: 100%; }
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #e0ddf5; border-radius: 4px; }
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #3d3d3d;
  margin-bottom: 12px;
}

.waring-info {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 6px 12px;
  margin-bottom: 12px;
  border-radius: 6px;
  background: rgba(255, 151, 103, 0.12);
  font-size: 12px;
  font-weight: 600;
  color: #ff9767;
  line-height: 18px;
  border: 1px solid transparent;

  &.is-active { color: #ff793c; border-color: #ff793c; }
}

.stem-html {
  margin-bottom: 12px;
  line-height: 1.7;
  color: #3d3d3d;
  font-size: 14px;
}

.answer-image-wrapper {
  position: relative;
  margin-top: 8px;
  width: 100%;
  line-height: 0;

  .student-image {
    width: 100%;
    display: block;
    border: 1px solid rgba(197, 193, 212, 0.3);
    border-radius: 8px;
    box-sizing: border-box;
  }

  .ocr-region {
    --region-main-color: #7b7dff;
    --region-fill-color: rgba(93, 39, 255, 0.12);
    position: absolute;
    z-index: 2;
    box-sizing: border-box;
    border-radius: 4px;
    background: var(--region-fill-color);
    pointer-events: none;
    transition: box-shadow 0.1s ease, background 0.1s ease;

    .region-marker {
      position: absolute;
      top: 50%;
      right: -42px;
      display: flex;
      align-items: center;
      gap: 4px;
      transform: translateY(-50%);
      line-height: 1;
      white-space: nowrap;
    }

    .region-status-icon {
      width: 20px;
      height: 20px;
      svg { color: var(--region-main-color); }
    }

    .region-index {
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      background: var(--region-main-color);
      width: 16px;
      height: 16px;
      font-size: 10px;
      font-weight: 600;
    }

    &.is-nohit {
      --region-main-color: #e40011;
      --region-fill-color: rgba(255, 103, 103, 0.12);
    }
    &.is-suppressed { z-index: 1; background: transparent; }
  }
}

.student-thinking {
  margin-top: 12px;
  border-radius: 10px;
  background: #f7f7f9;
  padding: 12px;
  font-size: 12px;

  .thinking-title { color: #3d3d3d; font-weight: 500; margin-bottom: 4px; }
  .thinking-content { color: #9792ac; }
}

.panel-right {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  border: 1px solid #e8e5f5;
  padding: 16px;
  border-radius: 12px;
  box-sizing: border-box;
  font-size: 14px;
  background: #fff;

  &::after { content: ''; display: block; height: 20px; width: 100%; }
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #e0ddf5; border-radius: 4px; }
}

.no-score-points { color: #9792ac; font-size: 14px; padding: 12px 0; }

.knowledge-point {
  --point-hover-border: transparent;
  --point-hover-shadow: none;
  --point-hover-title-bg: transparent;
  --point-selected-border: transparent;
  --point-selected-shadow: none;
  --point-selected-title-bg: transparent;

  position: relative;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  margin-bottom: 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.1s ease, box-shadow 0.1s ease, border-color 0.1s ease;

  &.is-locatable { cursor: pointer; }

  &.is-hover {
    border-color: var(--point-hover-border);
    box-shadow: var(--point-hover-shadow);
    .title-content .top { background: var(--point-hover-title-bg); }
  }

  &.is-selected {
    border-color: var(--point-selected-border);
    box-shadow: var(--point-selected-shadow);
    .title-content .top { background: var(--point-selected-title-bg); }
  }

  .title-content {
    width: 100%;
    flex-shrink: 0;

    .top {
      padding: 10px 12px;
      display: flex;
      align-items: flex-start;
      border-radius: 12px 12px 0 0;
      transition: background-color 0.1s ease;

      .number {
        flex-shrink: 0;
        font-size: 12px;
        font-weight: 600;
        color: #fff;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 6px;
      }

      .text {
        flex: 1;
        line-height: 1.5;
        word-break: break-all;
        color: #3d3d3d;
        font-size: 13px;
        font-weight: 600;
      }
    }
  }

  .text-content {
    padding: 8px 12px 4px;
    transition: background-color 0.1s ease;

    .content { display: flex; flex-wrap: wrap; }

    .point {
      display: flex;
      align-items: flex-start;
      gap: 4px;
      margin-right: 12px;
      line-height: 1.4;
      color: #3d3d3d;
      font-size: 12px;

      .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
    }

    .hit-reason { margin-top: 4px; font-size: 12px; color: #9792ac; }

    .error-style {
      font-size: 12px;
      margin-top: 4px;
      .error-type { display: inline-block; color: #ff6767; font-weight: 600; padding: 2px 0; }
      .error-info { color: #9792ac; }
    }

    .bottom {
      padding: 8px 0 4px;
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: space-between;

      .has-question {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 600;
        color: #ff9767;
        cursor: pointer;
      }

      .hit-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 12px;
        margin-left: auto;

        .hit-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

        &.is-hit-badge { background: #f0eeff; color: #7a7cff; }
        &.is-nohit-badge { background: #fff0f0; color: #ff6767; }
      }
    }
  }

  &.is-hit {
    --point-hover-border: rgba(123, 125, 255, 0.5);
    --point-hover-shadow: 0px 0px 10px 0px rgba(96, 98, 234, 0.24);
    --point-hover-title-bg: #f3f1ff;
    --point-selected-border: rgba(123, 125, 255, 0.5);
    --point-selected-shadow: 0px 0px 10px 0px rgba(96, 98, 234, 0.24);
    --point-selected-title-bg: #e9e5ff;

    .title-content .top { background: #f3f1ff; .number { background: #7a7cff; } }
    .text-content { background: #fcfcff; .point .dot { background: #bbbcff; } }
  }

  &.is-nohit {
    --point-hover-border: #ff9b9b;
    --point-hover-shadow: 0px 0px 10px 0px #ffdede;
    --point-hover-title-bg: #ffeded;
    --point-selected-border: #ff9b9b;
    --point-selected-shadow: 0px 0px 10px 0px #ffdede;
    --point-selected-title-bg: #ffd3d3;

    .title-content .top { background: #ffeded; .number { background: #ff6767; } }
    .text-content { background: rgba(255, 247, 247, 0.5); .point .dot { background: #ffb0b0; } }
  }
}
</style>
