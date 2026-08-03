/**
 * 作业管理 Store
 * 职责：管理作业列表、作业选择
 * 与 questionStore 结构类似，但数据来源和持久化 key 不同
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ExerciseItem, HomeworkUndoItem } from '../types'
import { saveQuestionsToIndexedDB } from '../services/storage/question-storage'
import {
  saveHomeworkSubmission,
  loadHomeworkSubmission,
  clearAllHomeworkSubmissions,
} from '../services/storage/homework-storage'
import { showMessage } from '@/utils'
import { apiService } from '@/services/http/api-service'
import {
  hydrateQuestionsFromStorage,
  toHomeworkSubmissionPayload,
  mergeApiQuestionsWithLocalStore,
} from '@/services/boundary/homework'
import type { LegacyAnswerCacheItem } from '@/services/boundary/homework'

// 作业存储的 key 前缀（区别于习题）
const HOMEWORK_STORAGE_PREFIX = 'homework_'

export const useHomeworkStore = defineStore('homework', () => {
  // ==================== 状态定义 ====================

  /** 作业列表 */
  const questions = ref<ExerciseItem[]>([])

  /** 当前选中的作业索引 */
  const currentQuestionIndex = ref(-1)

  /** 当前作业名称（来自 MyHomeworkView 选中的那份作业） */
  const homeworkName = ref('')

  /** 当前作业是否允许重复提交：'0' 不允许，'1' 允许 */
  const resubmitType = ref('0')

  /** 作业列表缓存：key = 查询条件，value = 作业列表数据 */
  const homeworkListCache = ref(new Map<string, HomeworkUndoItem[]>())

  /** 当前作业的原始信息 */
  const currentHomeworkInfo = ref<HomeworkUndoItem | null>(null)

  /** 当前作业的批改判罚详情数据 (来自 getHomeworkSubmitJudgeDetail API) */
  const judgeDetailData = ref<any>(null)

  /** 当前作业题目 ID 到采分点的预索引 Map 映射 */
  const judgePointsMap = ref(new Map<string, any[]>())

  /** 当前作业题目 ID 到作答图片 (questionData) 的预索引 Map 映射 */
  const questionDataMap = ref(new Map<string, any[]>())

  // 从 localStorage 读取未读作业消息计数的初始值
  const loadInitialUnreadCount = (): number => {
    try {
      const stored = localStorage.getItem('unread_homework_count')
      return stored ? parseInt(stored, 10) || 0 : 0
    } catch {
      return 0
    }
  }

  /** 未读作业消息数量 */
  const unreadHomeworkCount = ref<number>(loadInitialUnreadCount())

  /** 是否有未读作业消息通知 */
  const hasHomeworkNotification = computed(() => unreadHomeworkCount.value > 0)

  /** 增加未读作业数量 */
  const incrementUnreadHomework = (amount: number = 1): void => {
    unreadHomeworkCount.value += amount
    try {
      localStorage.setItem('unread_homework_count', unreadHomeworkCount.value.toString())
    } catch (e) {
      console.warn('[HOMEWORK] 保存未读作业数失败:', e)
    }
  }

  /** 清空未读作业消息标记（标记已读） */
  const clearUnreadHomework = (): void => {
    unreadHomeworkCount.value = 0
    try {
      localStorage.setItem('unread_homework_count', '0')
    } catch (e) {
      console.warn('[HOMEWORK] 清理未读作业数失败:', e)
    }
  }

  // ==================== 计算属性 ====================

  /** 当前选中的作业 */
  const currentQuestion = computed(() => {
    if (currentQuestionIndex.value >= 0 && currentQuestionIndex.value < questions.value.length) {
      return questions.value[currentQuestionIndex.value]
    }
    return null
  })

  /** 是否有作业数据 */
  const hasQuestions = computed(() => questions.value.length > 0)

  // ==================== 方法 ====================

  /**
   * 设置当前作业名称
   */
  const setHomeworkName = (name: string): void => {
    homeworkName.value = name
  }

  /**
   * 设置当前作业的重复提交类型
   */
  const setResubmitType = (type: string): void => {
    resubmitType.value = type
  }

  /**
   * 设置当前作业详情
   */
  const setCurrentHomeworkInfo = (info: HomeworkUndoItem): void => {
    currentHomeworkInfo.value = info
  }

  /**
   * 选择作业
   * @param index 作业索引
   */
  const selectQuestion = async (index: number): Promise<void> => {
    if (index < 0 || index >= questions.value.length) {
      console.error('[HOMEWORK] ❌ 无效的作业索引:', index)
      showMessage('无效的作业索引', 'error')
      return
    }

    currentQuestionIndex.value = index
  }

  /**
   * 设置作业列表
   * @param newQuestions 新的作业列表
   * @param subject 科目类型（可选，用于保存到 IndexedDB）
   */
  const setQuestions = async (newQuestions: ExerciseItem[], subject?: string): Promise<void> => {
    questions.value = deduplicateQuestions(newQuestions)

    if (subject) {
      const storageKey = `${HOMEWORK_STORAGE_PREFIX}${subject}`
      try {
        await saveQuestionsToIndexedDB(storageKey, questions.value)
      } catch (error) {
        console.error('[HOMEWORK] ❌ 保存作业列表到 IndexedDB 失败:', error)
      }
    }
  }

  /**
   * 作业去重算法
   */
  const deduplicateQuestions = (questionList: ExerciseItem[]): ExerciseItem[] => {
    const uniqueMap = new Map<string, ExerciseItem>()

    for (const question of questionList) {
      const key = question.bmNo || question.id || question.title
      if (key && !uniqueMap.has(key)) {
        uniqueMap.set(key, question)
      }
    }

    return Array.from(uniqueMap.values())
  }

  /**
   * 清空当前选中的作业
   */
  const clearCurrentQuestion = (): void => {
    currentQuestionIndex.value = -1
  }

  /**
   * 获取作业列表（带缓存）
   * @param params 查询参数
   * @param forceRefresh 是否强制刷新（忽略缓存）
   * @returns 作业列表
   */
  const fetchHomeworkList = async (
    params: {
      pageNumber: number
      pageSize: number
      subject?: string
      date?: string
    },
    forceRefresh: boolean = false,
  ): Promise<HomeworkUndoItem[]> => {
    // 生成缓存键
    const cacheKey = `${params.date || ''}_${params.subject || ''}_${params.pageNumber}_${params.pageSize}`

    // 检查缓存（除非强制刷新）
    if (!forceRefresh && homeworkListCache.value.has(cacheKey)) {
      console.log('[HOMEWORK] 📦 从缓存获取作业列表', { cacheKey })
      return homeworkListCache.value.get(cacheKey)!
    }

    try {
      console.log('[HOMEWORK] 🌐 请求作业列表', { params, forceRefresh })
      const result = await apiService.getHomeworkUndoList(params)

      // 缓存结果
      homeworkListCache.value.set(cacheKey, result)
      console.log('[HOMEWORK] 💾 缓存作业列表', { cacheKey, count: result.length })

      return result
    } catch (error) {
      console.error('[HOMEWORK] ❌ 获取作业列表失败:', error)
      throw error
    }
  }

  /**
   * 清空作业列表缓存
   */
  const clearHomeworkListCache = (): void => {
    homeworkListCache.value.clear()
    console.log('[HOMEWORK] 🗑️ 已清空作业列表缓存')
  }

  /**
   * 保存当前作业的所有内容到 IndexedDB
   */
  const saveCurrentHomeworkSubmission = async (
    homeworkId: string,
    isSubmitted: boolean,
  ): Promise<void> => {
    if (!homeworkId) {
      console.warn('[HOMEWORK_STORAGE] saveCurrentHomeworkSubmission: homeworkId 缺失')
      return
    }

    try {
      console.log(`[HOMEWORK_STORAGE] 开始持久化任务: ${homeworkId}, 提交状态: ${isSubmitted}`)
      const payload = toHomeworkSubmissionPayload({
        homeworkId,
        homeworkName: homeworkName.value,
        isSubmitted,
        questions: questions.value,
      })
      await saveHomeworkSubmission(payload)
      console.log('[HOMEWORK_STORAGE] ✅ 数据已成功存入存储层 (IndexedDB)')
    } catch (error) {
      console.error('[HOMEWORK_STORAGE] ❌ 持久化任务失败:', error)
    }
  }

  /**
   * 仅更新 IndexedDB 中的题目列表，保留已有的作答记录
   * 用于 MyHomeworkView.vue 获取到新题目后覆盖旧缓存
   */
  const updateQuestionsInDB = async (homeworkId: string): Promise<void> => {
    if (!homeworkId) return

    try {
      const existing = await loadHomeworkSubmission(homeworkId)
      let mergedQuestions = questions.value
      if (existing) {
        mergedQuestions = mergeApiQuestionsWithLocalStore(questions.value, existing)
        questions.value = mergedQuestions
      }

      const payload = toHomeworkSubmissionPayload({
        homeworkId,
        homeworkName: homeworkName.value || existing?.homeworkName || '',
        isSubmitted: existing?.isSubmitted || false,
        questions: mergedQuestions,
      })
      await saveHomeworkSubmission(payload)
      console.log(`[HOMEWORK_STORAGE] ✅ 题目列表已无损合并并更新到 IndexedDB: ${homeworkId}`)
    } catch (error) {
      console.error('[HOMEWORK_STORAGE] ❌ 更新题目列表失败:', error)
    }
  }

  /**
   * 从 IndexedDB 加载指定作业的内容
   */
  const loadHomeworkSubmissionFromDB = async (
    homeworkId: string,
  ): Promise<{ isSubmitted: boolean } | null> => {
    if (!homeworkId) return null

    try {
      console.log(`[HOMEWORK_STORAGE] 正在尝试从存储层加载数据: ${homeworkId}`)
      const data = await loadHomeworkSubmission(homeworkId)
      if (data) {
        homeworkName.value = data.homeworkName
        if (data.questions && data.questions.length > 0) {
          const loadedQuestions = hydrateQuestionsFromStorage(data.questions as ExerciseItem[], {
            legacyCache: (data.answerDataCache || {}) as Record<string, LegacyAnswerCacheItem>,
          })
          questions.value = loadedQuestions
        }
        console.log(`[HOMEWORK_STORAGE] ✅ 加载成功, 题目数: ${questions.value.length}`)
        return { isSubmitted: data.isSubmitted }
      }
      console.log(`[HOMEWORK_STORAGE] 存储层中不存在 ID 为 ${homeworkId} 的数据`)
    } catch (error) {
      console.error('[HOMEWORK_STORAGE] ❌ 加载存储数据失败:', error)
    }
    return null
  }

  /**
   * 条件清除作业列表缓存 Map 中的特定 Key
   */
  const clearHomeworkListCacheByCondition = (condition: (key: string) => boolean): void => {
    for (const key of homeworkListCache.value.keys()) {
      if (condition(key)) {
        homeworkListCache.value.delete(key)
      }
    }
  }

  const parseJsonIfNeeded = (val: any) => {
    if (!val) return null
    if (typeof val === 'object') return val
    if (typeof val === 'string') {
      try {
        return JSON.parse(val)
      } catch {
        return null
      }
    }
    return null
  }

  const extractScorePointsFromJudgeNode = (judgeNode: any, imgUrls?: string[]): any[] => {
    if (!judgeNode) return []

    const rawList = Array.isArray(judgeNode.route?.payload)
      ? judgeNode.route.payload
      : Array.isArray(judgeNode.scoreSummary?.points)
        ? judgeNode.scoreSummary.points
        : []

    return rawList.map((p: any, idx: number) => {
      const pId = String(p.standard_node_id ?? p.pointId ?? p.id ?? (idx + 1))
      return {
        id: pId,
        pointId: pId,
        hit: Boolean(p.criterion_met ?? p.hit),
        sourceText: p.hit_description ?? p.sourceText ?? '',
        nodeId: p.node_id ?? p.nodeId ?? '',
        nodeLabel: p.node_label ?? p.nodeLabel ?? '',
        solutionMethodId: p.solution_method_id ?? p.solutionMethodId ?? '',
        methodLabel: p.method_label ?? p.methodLabel ?? '',
        criterionType: p.criterion_type ?? p.criterionType ?? '',
        criterionText: p.criterion_text ?? p.criterionText ?? '',
        criterionReason: p.potential_error_reason ?? p.criterionReason ?? '',
        score: p.score_awarded ?? p.score ?? 0,
        pointScore: p.score_awarded ?? p.pointScore ?? null,
        maxScore: p.score_max ?? p.maxScore ?? 0,
        potentialErrorType: p.potential_error_type ?? p.potentialErrorType ?? '',
        potentialErrorReason: p.potential_error_reason ?? p.potentialErrorReason ?? '',
        preconditionType: p.precondition_type ?? p.preconditionType ?? null,
        preconditionRequired: p.precondition_required ?? p.preconditionRequired ?? null,
        knowledgePoints: p.knowledge_points ?? p.knowledgePoints ?? [],
        applicableSigns: p.applicable_signs ?? p.applicableSigns ?? [],
        recommended: p.recommended ?? null,
        matchedOcrRegions: p.matched_ocr_regions ?? p.matchedOcrRegions ?? [],
        answerData: imgUrls && imgUrls.length > 0 ? imgUrls : undefined,
        studentAnswerImage: imgUrls && imgUrls.length > 0 ? imgUrls[0] : (judgeNode.rearrange_students_answer || judgeNode.student_answer_image || ''),
      }
    })
  }

  /**
   * 重置作业作答相关状态
   */
  const resetAnswerState = (): void => {
    questions.value = []
    currentQuestionIndex.value = -1
    homeworkName.value = ''
    resubmitType.value = '0'
    currentHomeworkInfo.value = null
    judgeDetailData.value = null
    judgePointsMap.value.clear()
    questionDataMap.value.clear()
    console.log('[HOMEWORK] 🧹 已重置作业作答状态')
  }

  /**
   * 从 IndexedDB 清空所有作业作答和提交状态数据
   */
  const clearAllHomeworkSubmissionsFromDB = async (): Promise<void> => {
    try {
      await clearAllHomeworkSubmissions()
      console.log('[HOMEWORK_STORAGE] ✅ 已清空所有本地作业数据')
    } catch (error) {
      console.error('[HOMEWORK_STORAGE] ❌ 清空所有本地作业数据失败:', error)
    }
  }

  /**
   * 设置当前作业的判罚详情数据并一键预建索引 Map
   */
  const setJudgeDetailData = (data: any): void => {
    console.log('[HOMEWORK_STORE] 📥 接收到判罚详情原始数据, 正在执行解包建表:', data)
    judgeDetailData.value = data
    const map = new Map<string, any[]>()
    const qDataMap = new Map<string, any[]>()

    if (!data) {
      console.warn('[HOMEWORK_STORE] ⚠️ 传入的判罚详情数据为空，清空索引 Map')
      judgePointsMap.value = map
      questionDataMap.value = qDataMap
      return
    }

    const rawList = Array.isArray(data) ? data : data?.data || [data]
    console.log(`[HOMEWORK_STORE] 📦 已解包数据源，包含 ${rawList.length} 项题目判罚包`)

    const indexJudgeNode = (node: any, imgUrls?: string[]) => {
      if (!node) return
      const rawNId = String(node.nodeId || node.questionId || '').trim()
      const nId = rawNId.replace(/^root\./, '')
      if (nId) {
        const points = extractScorePointsFromJudgeNode(node, imgUrls)
        if (points.length > 0) {
          const existing = map.get(nId) || []
          if (existing.length === 0) {
            map.set(nId, points)
          } else {
            const mergedMap = new Map<string, any>()
            for (const p of existing) mergedMap.set(p.id, { ...p })
            for (const p of points) {
              const oldP = mergedMap.get(p.id)
              if (oldP) {
                mergedMap.set(p.id, {
                  ...oldP,
                  hit: p.hit ?? oldP.hit,
                  sourceText:
                    p.sourceText && p.sourceText !== p.id ? p.sourceText : oldP.sourceText,
                  criterionReason: p.criterionReason || oldP.criterionReason,
                  answerData: p.answerData || oldP.answerData,
                  studentAnswerImage: p.studentAnswerImage || oldP.studentAnswerImage,
                })
              } else {
                mergedMap.set(p.id, p)
              }
            }
            map.set(nId, Array.from(mergedMap.values()))
          }
          console.log(
            `[HOMEWORK_STORE] 📌 [KEY_NODE] 索引节点成功: [${nId}] -> ${map.get(nId)?.length} 个采分点`,
          )
        }
      }
    }

    for (let index = 0; index < rawList.length; index++) {
      const item = rawList[index]
      if (!item) continue

      const parsedJudge = parseJsonIfNeeded(item.questionJudgeDataData || item.questionJudgeData)
      const parsedRevised = parseJsonIfNeeded(item.questionRevisedData)
      const parsedAnswer = parseJsonIfNeeded(item.questionAnswerData)

      const answerList = Array.isArray(parsedAnswer) ? parsedAnswer : (Array.isArray(parsedRevised) ? parsedRevised : [])
      for (const aItem of answerList) {
        if (!aItem) continue
        const rawQId = String(aItem.questionId || aItem.nodeId || '').trim()
        const qId = rawQId.replace(/^root\./, '')
        if (qId && Array.isArray(aItem.answerData) && aItem.answerData.length > 0) {
          qDataMap.set(qId, [aItem])
        }
      }

      if (item.questionId) {
        const parentQId = String(item.questionId).trim().replace(/^root\./, '')
        if (parentQId && !qDataMap.has(parentQId) && answerList.length > 0) {
          qDataMap.set(parentQId, answerList)
        }
      }

      if (parsedJudge?.results) {
        for (const res of parsedJudge.results) {
          const nId = String(res.nodeId || res.questionId || '').trim().replace(/^root\./, '')
          const qImgs = (qDataMap.get(nId)?.[0]?.answerData) || (res.rearrange_students_answer ? [res.rearrange_students_answer] : [])
          indexJudgeNode(res, qImgs)
          if (nId && !qDataMap.has(nId)) {
            if (qImgs.length > 0) {
              qDataMap.set(nId, [{ questionId: nId, answerData: qImgs }])
            }
          }
        }
      }

      if (Array.isArray(parsedRevised)) {
        for (const revItem of parsedRevised) {
          const nId = String(revItem.questionId || revItem.nodeId || '').trim().replace(/^root\./, '')
          const qImgs = (qDataMap.get(nId)?.[0]?.answerData) || (revItem.answerData) || []
          indexJudgeNode(revItem, qImgs)
        }
      }
    }

    judgePointsMap.value = map
    questionDataMap.value = qDataMap
    console.log('[HOMEWORK_STORE] ⚡ 判罚详情索引建表完成!', {
      indexedNodeCount: map.size,
      indexedQuestionDataCount: qDataMap.size,
      indexedKeys: Array.from(map.keys()),
    })
  }

  /**
   * 根据题目 (支持单题及复合题) 从预索引 Map 中 O(1) 获取采分点数组
   */
  const getJudgePointsForQuestion = (question: any): any[] => {
    if (!question || judgePointsMap.value.size === 0) return []

    const targetQIds = [
      String(question.id || '').trim(),
      String(question.bmNo || '').trim(),
      ...(question.subQuestions || []).flatMap((sq: any) => [
        String(sq.id || '').trim(),
        String(sq.bmNo || '').trim(),
      ]),
    ].filter(Boolean)

    const resultPoints: any[] = []
    const visitedPoints = new Set<string>()
    const matchedNodeIds: string[] = []

    for (const qId of targetQIds) {
      const points = judgePointsMap.value.get(qId)
      if (Array.isArray(points)) {
        matchedNodeIds.push(qId)
        for (const p of points) {
          const key = p.id || p.sourceText
          if (!visitedPoints.has(key)) {
            visitedPoints.add(key)
            resultPoints.push(p)
          }
        }
      }
    }

    const hitCount = resultPoints.filter((p: any) => p.hit).length
    console.log('[HOMEWORK_STORE] ✅ [KEY_NODE] 采分点 O(1) 检索匹配完成:', {
      questionTitle: question.title || question.question || question.stem,
      targetQIds,
      matchedNodeIds,
      totalPoints: resultPoints.length,
      hitCount,
      scoreText: resultPoints.length > 0 ? `${hitCount}/${resultPoints.length} 采分点` : '无',
      resultPoints,
    })

    return resultPoints
  }

  // ==================== 返回接口 ====================

  return {
    // 状态
    questions,
    currentQuestionIndex,
    homeworkName,
    resubmitType,
    currentHomeworkInfo,
    judgeDetailData,
    judgePointsMap,
    questionDataMap,
    homeworkListCache,
    unreadHomeworkCount,
    hasHomeworkNotification,

    // 计算属性
    currentQuestion,
    hasQuestions,

    // 方法
    selectQuestion,
    setHomeworkName,
    setCurrentHomeworkInfo,
    setResubmitType,
    setQuestions,
    setJudgeDetailData,
    getJudgePointsForQuestion,
    deduplicateQuestions,
    clearCurrentQuestion,
    fetchHomeworkList,
    clearHomeworkListCache,
    clearHomeworkListCacheByCondition,
    saveCurrentHomeworkSubmission,
    updateQuestionsInDB,
    loadHomeworkSubmissionFromDB,
    resetAnswerState,
    clearAllHomeworkSubmissionsFromDB,
    incrementUnreadHomework,
    clearUnreadHomework,
  }
})
