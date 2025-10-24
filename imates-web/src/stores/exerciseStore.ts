import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { showMessage } from '../utils'
import { apiService } from '../services/api-service'
import { androidBridge } from '../services/android-bridge'
import { asyncStorage, type ChatHistoryData } from '../services/async-storage'

// 使用统一类型定义
import type { ExerciseItem, UserInfo, ChatBubble, AiChatMessageRequest } from '../types'

/**
 * 练习解题应用的主要状态管理Store
 * 负责管理题目列表、聊天记录、用户信息等核心数据
 */
export const useExerciseStore = defineStore('exercise', () => {
  // ==================== 响应式状态定义 ====================

  /** 题目列表 - 存储当前科目的所有题目 */
  const questions = ref<ExerciseItem[]>([])

  /** 相似题目列表 - 存储与当前题目相似的题目 */
  const similarQuestions = ref<ExerciseItem[]>([])

  /** 当前选中的题目索引 - -1表示未选中任何题目 */
  const currentQuestionIndex = ref(-1)

  /** AI题目消息记录 - 存储当前题目的AI指导对话历史 */
  const aiExerciseMessages = ref<ChatBubble[]>([])

  /** AI通用消息记录 - 存储AI通用对话历史 */
  const aiGeneralMessages = ref<ChatBubble[]>([])

  /** AI教材消息记录 - 存储AI教材对话历史 */
  const aiTextbookMessages = ref<ChatBubble[]>([])

  /** 老师消息记录 - 存储当前题目的老师对话历史 */
  const teacherMessages = ref<ChatBubble[]>([])

  /** 用户信息 - 当前登录用户的基本信息 */
  const userInfo = ref<UserInfo | null>(null)

  /** 联网搜索状态 */
  const enableWebSearch = ref(false)

  /** 当前科目 - 数学或生物 */
  const subject = ref<'MATH' | 'BIOLOGY'>('MATH')

  /** 聊天机器人URL - 用于AI指导功能的服务端点 */
  const chatBotUrl = ref('')

  /** 加载状态 - 标识是否正在进行异步操作 */
  const isLoading = ref(false)

  /** 聊天记录加载状态 - 标识是否正在加载聊天历史 */
  const isChatLoading = ref(false)

  /** 聊天记录分批次加载状态 - 标识是否正在进行分批次渲染 */
  const isChatRendering = ref(false)

  /** AI回复次数 - 记录当前题目的AI交互次数，用于解锁查看答案功能 */
  const chatResponseTimes = ref(0)

  /** 保存防抖定时器 - 避免频繁保存聊天记录 */
  let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null

  /** 查看答案所需的最小AI交互次数 */
  const VIEW_ANSWER_CHAT_TIMES = 3

  // ==================== 计算属性定义 ====================

  /**
   * 当前选中的题目
   * 根据currentQuestionIndex从questions数组中获取对应题目
   * @returns 当前题目对象或null（如果未选中）
   */
  const currentQuestion = computed(() => {
    if (currentQuestionIndex.value >= 0 && currentQuestionIndex.value < questions.value.length) {
      return questions.value[currentQuestionIndex.value]
    }
    return null
  })

  /**
   * 是否可以查看答案
   * 需要与AI交互达到指定次数才能解锁答案查看功能
   * @returns 是否达到查看答案的条件
   */
  const canViewAnswer = computed(() => {
    return chatResponseTimes.value >= VIEW_ANSWER_CHAT_TIMES
  })

  /**
   * 是否有题目数据
   * 用于判断题目列表是否为空
   * @returns 是否存在题目
   */
  const hasQuestions = computed(() => {
    return questions.value.length > 0
  })

  /**
   * 获取当前AI类型的消息记录
   * 根据当前AI类型返回对应的消息记录
   * @param aiType AI类型：'ai-general' | 'ai-exercise' | 'ai-textbook'
   * @returns 对应的消息记录数组
   */
  const getCurrentAiMessages = (aiType: string) => {
    switch (aiType) {
      case 'ai-general':
        return aiGeneralMessages.value
      case 'ai-exercise':
        return aiExerciseMessages.value
      case 'ai-textbook':
        return aiTextbookMessages.value
      default:
        return aiExerciseMessages.value
    }
  }

  // ==================== 动作方法定义 ====================

  /**
   * 初始化Store状态
   */
  const initializeStore = async (initData: unknown) => {
    const { getUserInfo, initializeAppConfig } = await import('../utils/config/config-utils')
    
    // 初始化应用配置（包括设置基础URL）
    await initializeAppConfig(initData)
    
    // 设置科目
    subject.value = (initData as any)?.subject || 'MATH'
    
    // 获取用户信息
    const userData = getUserInfo(initData)
    if (userData?.userId) {
      userInfo.value = {
        userId: userData.userId,
        userName: userData.userName || '',
        avatar: userData.avatar || '',
        grade: userData.grade || '',
        token: userData.token || '',
      }
    }
    
  }

  /**
   * 高效题目去重算法
   * 基于title字段进行去重，不依赖不可靠的ID/bmNo
   * 使用Set进行O(n)时间复杂度的去重
   * @param questionList 原始题目列表
   * @returns 去重后的题目列表
   */
  const deduplicateQuestions = (questionList: ExerciseItem[]): ExerciseItem[] => {
    if (!questionList || questionList.length === 0) {
      return []
    }

    // 使用Set记录已处理的题目内容哈希，用于内容去重
    const contentHashes = new Set<string>()
    // 存储去重后的题目列表
    const uniqueQuestions: ExerciseItem[] = []

    for (const question of questionList) {
      // 生成内容哈希：基于title字段进行去重
      const contentHash = generateContentHash(question)
      
      // 去重策略：只基于title哈希进行判断
      if (contentHashes.has(contentHash)) {
        // title重复，跳过
        continue
      } else {
        // title不重复，添加到结果中
        contentHashes.add(contentHash)
        uniqueQuestions.push(question)
      }
    }

    return uniqueQuestions
  }

  /**
   * 生成题目内容哈希（优化版本）
   * 基于title字段进行去重，用于检测题目是否重复
   * @param question 题目对象
   * @returns 内容哈希字符串
   */
  const generateContentHash = (question: ExerciseItem): string => {
    // 提取title字段并标准化
    const title = (question.title || '').trim()
    
    if (!title) {
      return 'empty_title'
    }
    
    // 简化处理逻辑，提高性能
    const normalizedContent = title
      .toLowerCase()
      .replace(/\s+/g, '') // 直接移除所有空白字符
      .substring(0, 50) // 限制长度提高性能
    
    // 使用更快的哈希算法
    let hash = 0
    for (let i = 0; i < normalizedContent.length; i++) {
      hash = ((hash << 5) - hash + normalizedContent.charCodeAt(i)) & 0xffffffff
    }
    
    return hash.toString(36)
  }

  /**
   * 获取题目列表
   * 从API服务获取当前科目的所有题目数据，并自动去重
   * @returns Promise<void>
   */
  const fetchQuestions = async () => {
    try {
      // 静默加载，不设置全局加载状态
      const subjectName = subject.value.toLowerCase()

      // HTTP请求使用API服务
      const questionList = await apiService.getExerciseList(subjectName)

      // 将原始数据转换为标准的Question格式（与Android原生保持一致）
      const mappedQuestions = questionList.map((q: any) => ({
        id: q.id || q.bmNo, // 使用id或bmNo作为唯一标识
        bmNo: q.bmNo || '',
        title: q.title || q.question || '', // Android原生字段
        question: q.title || q.question || '', // Vue扩展字段，从title派生
        answer: q.answer || '',
        explanation: q.explanation || q.aiExplanation || '', // Android原生字段
        analysisData: q.analysisData || q.answerAnalysis || '', // Android原生字段
        subject: subjectName,
        
        // 显示相关属性（与Android原生一致）
        atUserList: q.atUserList || false,
        isAiGuiding: false, // 初始状态：未进行AI指导
        userSelect: q.userSelect || false,
        beginGuideToSolve: false, // 初始状态：未开始解题引导
      }))

      // 应用高效去重算法
      const deduplicatedQuestions = deduplicateQuestions(mappedQuestions)
      
      // 记录去重统计信息
      const originalCount = mappedQuestions.length
      const deduplicatedCount = deduplicatedQuestions.length
      const removedCount = originalCount - deduplicatedCount
      
      if (removedCount > 0) {
        console.log(`题目去重完成: 原始${originalCount}题，去重后${deduplicatedCount}题，移除${removedCount}个重复题目`)
      }

      questions.value = deduplicatedQuestions
    } catch (error) {
      console.error('获取题目失败:', error)
      // 静默处理错误，不显示错误消息
    }
  }

  /**
   * 选择题目
   * 切换当前选中的题目，异步加载聊天历史但不开始AI指导
   * @param index 要选择的题目在数组中的索引
   */
  const selectQuestion = async (index: number) => {
    if (index >= 0 && index < questions.value.length) {
      const newQuestion = questions.value[index]
      const oldQuestion = currentQuestion.value
      
      console.log(`[CHAT_DEBUG] 🔄 题目切换开始: ${oldQuestion?.id || '无'} → ${newQuestion.id}`)
      console.log(`[CHAT_DEBUG] 📊 切换前聊天记录数量: ${aiExerciseMessages.value.length}`)
      
      // 保存当前题目的聊天记录到本地存储
      if (currentQuestion.value) {
        console.log(`[CHAT_DEBUG] 💾 保存当前题目聊天记录: ${currentQuestion.value.id}`)
        await saveChatHistory()
        console.log(`[CHAT_DEBUG] ✅ 当前题目聊天记录已保存`)
        
        // 保存当前题目的老师聊天记录到本地存储
        console.log(`[TEACHER_CHAT_DEBUG] 💾 保存当前题目老师聊天记录: ${currentQuestion.value.id}`)
        await saveTeacherChatHistory()
        console.log(`[TEACHER_CHAT_DEBUG] ✅ 当前题目老师聊天记录已保存`)
      }

      // 更新当前选中的题目索引
      currentQuestionIndex.value = index
      console.log(`[CHAT_DEBUG] 📍 题目索引已更新: ${index}`)

      // 只重置之前选中题目的AI指导状态，避免遍历所有题目
      const previousIndex = currentQuestionIndex.value
      if (previousIndex >= 0 && previousIndex < questions.value.length && previousIndex !== index) {
        questions.value[previousIndex].isAiGuiding = false
        questions.value[previousIndex].beginGuideToSolve = false
      }

      // 异步加载新选中题目的聊天历史记录
      console.log(`[CHAT_DEBUG] 📥 开始加载新题目聊天记录: ${newQuestion.id}`)
      await loadChatHistory()
      console.log(`[CHAT_DEBUG] 📊 切换后聊天记录数量: ${aiExerciseMessages.value.length}`)
      
      // 异步加载新选中题目的老师聊天历史记录
      console.log(`[TEACHER_CHAT_DEBUG] 📥 开始加载新题目老师聊天记录: ${newQuestion.id}`)
      await loadTeacherChatHistory()
      console.log(`[TEACHER_CHAT_DEBUG] 📊 切换后老师聊天记录数量: ${teacherMessages.value.length}`)
      
      console.log(`[CHAT_DEBUG] ✅ 题目切换完成: ${newQuestion.id}`)

      // 题目选择成功，无需显示提示
    }
  }

  /**
   * 删除题目
   * 从题目列表中删除指定索引的题目
   * @param index 要删除的题目索引
   */
  const deleteQuestion = async (index: number) => {
    if (index >= 0 && index < questions.value.length) {
      try {
        // TODO: 这里应该调用删除API，目前暂时直接从列表中移除
        questions.value.splice(index, 1)

        // 调整当前选中的题目索引
        if (currentQuestionIndex.value === index) {
          // 如果删除的是当前选中的题目，重置选中状态
          currentQuestionIndex.value = -1
        } else if (currentQuestionIndex.value > index) {
          // 如果删除的题目在当前选中题目之前，需要调整索引
          currentQuestionIndex.value--
        }

        // 题目删除成功，通过界面更新反馈
      } catch {
        showMessage('删除失败，请重试', 'error')
      }
    }
  }

  /**
   * 将题目移动到列表顶部（纯前端操作）
   * 将指定索引的题目移动到题目列表的第一位
   * @param index 要移动的题目索引
   */
  const moveQuestionToTop = (index: number) => {
    if (index > 0 && index < questions.value.length) {
      // 从原位置移除题目并插入到列表开头
      const question = questions.value.splice(index, 1)[0]
      questions.value.unshift(question)

      // 调整当前选中的题目索引
      if (currentQuestionIndex.value === index) {
        // 如果移动的是当前选中的题目，更新索引为0
        currentQuestionIndex.value = 0
      } else if (currentQuestionIndex.value < index) {
        // 如果当前选中的题目在被移动题目之前，索引需要+1
        currentQuestionIndex.value++
      }
    }
  }

  /**
   * 根据题目ID将题目移动到列表顶部（纯前端操作）
   * @param questionId 要移动的题目ID
   */
  const moveQuestionToTopById = (questionId: string) => {
    const index = questions.value.findIndex(q => q.id === questionId)
    if (index > 0) {
      moveQuestionToTop(index)
    }
  }

  /**
   * 查找相似题目
   * 基于当前选中的题目查找相似的题目
   * @returns Promise<void>
   */
  const findSimilarQuestions = async () => {
    if (!currentQuestion.value) return

    try {
      isLoading.value = true
      const subjectName = subject.value.toLowerCase()

      // HTTP请求使用API服务
      const similar = await apiService.findSimilarQuestions(currentQuestion.value, subjectName)

      // 将相似题目数据转换为标准格式
      similarQuestions.value = similar.map((q: any) => ({
        id: q.id || q.bmNo,
        bmNo: q.bmNo || '',
        title: q.title || q.question || '',
        question: q.title || q.question || '',
        answer: q.answer || '',
        explanation: q.explanation || q.aiExplanation || '',
        analysisData: q.analysisData || q.answerAnalysis || '',
        subject: subjectName,
        atUserList: false,
        isAiGuiding: false,
        userSelect: false,
        beginGuideToSolve: false,
      }))
    } catch {
      showMessage('查找相似题目失败', 'error')
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 将相似题目添加到我的题目列表
   * 将选中的相似题目添加到主题目列表中
   * @param similarQuestion 要添加的相似题目对象
   */
  const addSimilarQuestionToList = async (similarQuestion: ExerciseItem) => {
    try {
      // 检查题目是否已存在，避免重复添加
      // 只基于title字段进行重复检查，不依赖不可靠的ID/bmNo
      const isDuplicate = questions.value.some(existingQuestion => {
        const existingHash = generateContentHash(existingQuestion)
        const newHash = generateContentHash(similarQuestion)
        return existingHash === newHash
      })

      if (isDuplicate) {
        // 题目已存在，不进行添加操作
        throw new Error('该题目已存在于题目列表中，无法重复添加')
      }

      // 调用 API 接口添加题目到服务器
      const subjectName = subject.value.toLowerCase()
      const success = await apiService.addQuestionToList(similarQuestion, subjectName)
      
      if (success) {
        // API 调用成功，更新本地状态
        // 将相似题目添加到主题目列表
        questions.value.unshift(similarQuestion)

        // 更新当前题目索引：因为新题目添加到开头，原有题目索引都+1
        if (currentQuestionIndex.value >= 0) {
          currentQuestionIndex.value += 1
        }

        // 从相似题目列表中移除已添加的题目
        const index = similarQuestions.value.findIndex((q) => q.id === similarQuestion.id)
        if (index >= 0) {
          similarQuestions.value.splice(index, 1)
        }
      } else {
        // API 调用失败，但仍然更新本地状态（降级处理）
        questions.value.unshift(similarQuestion)

        // 更新当前题目索引：因为新题目添加到开头，原有题目索引都+1
        if (currentQuestionIndex.value >= 0) {
          currentQuestionIndex.value += 1
        }

        const index = similarQuestions.value.findIndex((q) => q.id === similarQuestion.id)
        if (index >= 0) {
          similarQuestions.value.splice(index, 1)
        }
      }
    } catch (error) {
      console.error('添加相似题目失败:', error)
      // 发生错误时仍然更新本地状态（降级处理）
      questions.value.unshift(similarQuestion)

      // 更新当前题目索引：因为新题目添加到开头，原有题目索引都+1
      if (currentQuestionIndex.value >= 0) {
        currentQuestionIndex.value += 1
        console.log('题目索引已更新:', currentQuestionIndex.value)
      }

      const index = similarQuestions.value.findIndex((q) => q.id === similarQuestion.id)
      if (index >= 0) {
        similarQuestions.value.splice(index, 1)
      }
      
      throw error // 重新抛出错误，让调用方处理
    }
  }

  /**
   * 设置题目列表到store
   * 将题目数据映射为标准格式并自动去重
   * @param questionData 原始题目数据数组
   */
  const setQuestions = (questionData: unknown[]) => {
    try {
      const mapped: ExerciseItem[] = (questionData || []).map((q: any) => ({
        id: q.id || q.bmNo || String(Date.now() + Math.random()),
        bmNo: q.bmNo || q.id || '',
        title: q.title || q.content || '',
        // 优先使用 content 作为题干，退化到 title
        question: q.content || q.title || '',
        answer: q.answer || '',
        explanation: q.explanation || q.aiExplanation || '',
        analysisData: q.analysisData || q.answerAnalysis || '',
        // store 内部 subject 主要用于调用原生接口；此处设一个安全默认值
        subject: 'MATH',
        atUserList: false,
        isAiGuiding: false,
        userSelect: false,
        beginGuideToSolve: false,
      }))

      // 应用高效去重算法
      const deduplicatedQuestions = deduplicateQuestions(mapped)
      
      // 记录去重统计信息
      const originalCount = mapped.length
      const deduplicatedCount = deduplicatedQuestions.length
      const removedCount = originalCount - deduplicatedCount
      
      if (removedCount > 0) {
        console.log(`题目去重完成: 原始${originalCount}题，去重后${deduplicatedCount}题，移除${removedCount}个重复题目`)
      }

      questions.value = deduplicatedQuestions
      // 若当前索引越界则重置
      if (currentQuestionIndex.value >= deduplicatedQuestions.length) {
        currentQuestionIndex.value = -1
      }
    } catch {
      console.error('设置题目列表失败')
    }
  }

  // ==================== 聊天消息处理辅助函数 ====================

  /**
   * 构建AI聊天消息对象
   * @param content 消息内容
   * @param chatRole 学习伙伴角色
   * @param imageData 图片数据
   * @returns AI聊天消息对象
   */
  const buildAiMessage = (content: string, chatRole: string, imageData?: { filePath: string, base64DataUrl?: string }): AiChatMessageRequest => {
    const isImageMessage = imageData && imageData.base64DataUrl
    
    return {
      sessionId: currentQuestion.value?.id || '',
      newValue: '1',
      coversation: content,
      question: isImageMessage 
        ? `<img src="${imageData.base64DataUrl}" />`
        : (currentQuestion.value?.question || currentQuestion.value?.title || ''),
      answer: currentQuestion.value?.answer || '',
      name: userInfo.value?.userName || 'User',
      reason: 'start',
      bmNo: currentQuestion.value?.bmNo || currentQuestion.value?.id || '',
      isWebSearch: enableWebSearch.value ? '1' : '0',
      chatRole: chatRole,
      dstUrl: isImageMessage ? '/permission/previewPictureQA' : undefined,
    }
  }

  /**
   * 创建用户消息对象
   * @param content 消息内容
   * @param imageData 图片数据
   * @param hidePrefix 是否隐藏前缀
   * @returns 用户消息对象
   */
  const createUserMessage = (content: string, imageData?: { filePath: string, base64DataUrl?: string }, hidePrefix: boolean = false): ChatBubble => {
    const isImageMessage = imageData && imageData.base64DataUrl
    
    // 处理显示内容：如果需要隐藏前缀，则去掉"我们开始吧"及后面的逗号
    let displayContent = content
    if (hidePrefix && content.startsWith('我们开始吧')) {
      displayContent = content.replace(/^我们开始吧[，,]\s*/, '')
    }

    return {
      id: Date.now().toString(),
      content: isImageMessage ? '' : displayContent,
      sender: 'user',
      type: 'user',
      timestamp: new Date().toISOString(),
      messageType: isImageMessage ? 'image' : 'text',
      imageData: isImageMessage ? {
        filePath: imageData.filePath,
        width: 0,
        height: 0,
        fileSize: 0
      } : undefined
    }
  }

  /**
   * 创建临时AI回复消息
   * @param type 消息类型
   * @returns 临时消息对象和ID
   */
  const createTempReplyMessage = (type: 'ai' | 'teacher'): { message: ChatBubble, id: string } => {
    const tempReplyId = (Date.now() + 1).toString()
    const tempReplyMessage: ChatBubble = {
      id: tempReplyId,
      content: '',
      sender: type,
      type,
      timestamp: new Date().toISOString(),
      messageId: 'temp_' + Date.now(),
      isStreaming: true,
    }
    return { message: tempReplyMessage, id: tempReplyId }
  }

  /**
   * 更新临时消息内容
   * @param tempReplyId 临时消息ID
   * @param updates 要更新的字段
   * @param aiType AI类型，用于确定更新哪个消息记录
   */
  const updateTempMessage = (tempReplyId: string, updates: Partial<ChatBubble>, aiType?: string) => {
    // 根据AI类型获取对应的消息记录
    const targetMessages = aiType ? getCurrentAiMessages(aiType) : aiExerciseMessages.value
    
    const tempIndex = targetMessages.findIndex((msg) => msg.id === tempReplyId)
    if (tempIndex !== -1) {
      targetMessages[tempIndex] = {
        ...targetMessages[tempIndex],
        ...updates
      }
    }
  }

  /**
   * 设置超时处理
   * @param tempReplyId 临时消息ID
   * @param content 原始消息内容
   * @param timeoutMs 超时时间（毫秒）
   * @param aiType AI类型，用于确定更新哪个消息记录
   * @returns 超时定时器ID
   */
  const setupTimeoutHandler = (tempReplyId: string, content: string, timeoutMs: number = 10000, aiType?: string): ReturnType<typeof setTimeout> => {
    return setTimeout(() => {
      // 根据AI类型获取对应的消息记录
      const targetMessages = aiType ? getCurrentAiMessages(aiType) : aiExerciseMessages.value
      
      const tempIndex = targetMessages.findIndex((msg) => msg.id === tempReplyId)
      if (tempIndex !== -1 && targetMessages[tempIndex].isStreaming) {
        updateTempMessage(tempReplyId, {
          content: '请求失败，请重试。',
          timestamp: new Date().toISOString(),
          messageId: 'timeout_' + Date.now(),
          isStreaming: false,
          isError: true,
          canRetry: true,
          retryCount: 0,
          originalMessage: content,
        }, aiType)
        saveChatHistory(false, aiType)
      }
    }, timeoutMs)
  }

  /**
   * 处理AI流式响应
   * @param tempReplyId 临时消息ID
   * @param timeoutId 超时定时器ID
   * @param streamContentRef 流式内容引用
   * @param aiType AI类型，用于确定更新哪个消息记录
   * @returns 流式响应处理函数
   */
  const createStreamHandler = (tempReplyId: string, timeoutId: ReturnType<typeof setTimeout>, streamContentRef: { current: string }, aiType?: string) => {
    return (chunk: string, isComplete: boolean) => {
      console.log('收到AI流式数据:', chunk, '是否完成:', isComplete)
      
      if (!isComplete && chunk) {
        streamContentRef.current += chunk
        updateTempMessage(tempReplyId, {
          content: streamContentRef.current,
          isStreaming: true,
        }, aiType)
      } else if (isComplete) {
        const finalContent = streamContentRef.current || '抱歉，我暂时无法回答这个问题。'
        const isError = !streamContentRef.current || streamContentRef.current === '抱歉，我暂时无法回答这个问题。'
        
        updateTempMessage(tempReplyId, {
          content: finalContent,
          isStreaming: false,
          isError: isError,
          canRetry: isError,
          retryCount: isError ? 0 : undefined,
          originalMessage: isError ? (chunk as any).originalContent : undefined,
        }, aiType)
        
        clearTimeout(timeoutId)
        saveChatHistory(false, aiType)
      }
    }
  }

  /**
   * 创建直接流处理器（用于重试，直接更新现有消息）
   * @param messageId 消息ID
   * @param timeoutId 超时定时器ID
   * @param streamContentRef 流式内容引用
   * @param aiType AI类型，用于确定更新哪个消息记录
   */
  const createDirectStreamHandler = (messageId: string, timeoutId: ReturnType<typeof setTimeout>, streamContentRef: { current: string }, aiType?: string) => {
    return (chunk: string, isComplete: boolean) => {
      console.log('收到AI流式数据（重试）:', chunk, '是否完成:', isComplete)
      
      // 根据AI类型获取对应的消息记录
      const targetMessages = aiType ? getCurrentAiMessages(aiType) : aiExerciseMessages.value
      
      const messageIndex = targetMessages.findIndex(msg => msg.id === messageId)
      if (messageIndex !== -1) {
        if (!isComplete && chunk) {
          streamContentRef.current += chunk
          targetMessages[messageIndex] = {
            ...targetMessages[messageIndex],
            content: streamContentRef.current,
            isStreaming: true,
          }
        } else if (isComplete) {
          const finalContent = streamContentRef.current || '抱歉，我暂时无法回答这个问题。'
          const isError = !streamContentRef.current || streamContentRef.current === '抱歉，我暂时无法回答这个问题。'
          
          targetMessages[messageIndex] = {
            ...targetMessages[messageIndex],
            content: finalContent,
            isStreaming: false,
            isError: isError,
            canRetry: isError,
            retryCount: isError ? (targetMessages[messageIndex].retryCount || 0) : undefined,
            originalMessage: isError ? (chunk as any).originalContent : undefined,
          }
          
          clearTimeout(timeoutId)
          saveChatHistory(false, aiType)
        }
      }
    }
  }

  /**
   * 处理AI完整响应回调
   * @param tempReplyId 临时消息ID
   * @param timeoutId 超时定时器ID
   * @param streamContentRef 流式内容引用
   * @param aiType AI类型，用于确定更新哪个消息记录
   * @returns 完整响应处理函数
   */
  const createCompleteHandler = (tempReplyId: string, timeoutId: ReturnType<typeof setTimeout>, streamContentRef: { current: string }, aiType?: string) => {
    return (asyncResponse: { reply?: string; timestamp?: number | string; messageId?: string; success?: boolean }) => {
      clearTimeout(timeoutId)
      
      const finalContent = streamContentRef.current || asyncResponse.reply || '抱歉，我暂时无法回答这个问题。'
      const isError = !asyncResponse.reply || asyncResponse.reply === '抱歉，我暂时无法回答这个问题。' || finalContent === '抱歉，我暂时无法回答这个问题。'
      
      updateTempMessage(tempReplyId, {
        content: finalContent,
        timestamp: typeof asyncResponse.timestamp === 'number'
          ? new Date(asyncResponse.timestamp).toISOString()
          : new Date().toISOString(),
        messageId: asyncResponse.messageId,
        isStreaming: false,
        isError: isError,
        canRetry: isError,
        retryCount: isError ? 0 : undefined,
        originalMessage: isError ? (asyncResponse as any).originalContent : undefined,
      }, aiType)

      if (asyncResponse.success) {
        chatResponseTimes.value++
      }

      saveChatHistory(false, aiType)
    }
  }

  /**
   * 创建直接完成处理器（用于重试，直接更新现有消息）
   * @param messageId 消息ID
   * @param timeoutId 超时定时器ID
   * @param streamContentRef 流式内容引用
   * @param aiType AI类型，用于确定更新哪个消息记录
   */
  const createDirectCompleteHandler = (messageId: string, timeoutId: ReturnType<typeof setTimeout>, streamContentRef: { current: string }, aiType?: string) => {
    return (asyncResponse: { reply?: string; timestamp?: number | string; messageId?: string; success?: boolean }) => {
      clearTimeout(timeoutId)
      
      // 根据AI类型获取对应的消息记录
      const targetMessages = aiType ? getCurrentAiMessages(aiType) : aiExerciseMessages.value
      
      const messageIndex = targetMessages.findIndex(msg => msg.id === messageId)
      if (messageIndex !== -1) {
        const finalContent = streamContentRef.current || asyncResponse.reply || '抱歉，我暂时无法回答这个问题。'
        const isError = !asyncResponse.reply || asyncResponse.reply === '抱歉，我暂时无法回答这个问题。'
        
        targetMessages[messageIndex] = {
          ...targetMessages[messageIndex],
          content: finalContent,
          timestamp: typeof asyncResponse.timestamp === 'number'
            ? new Date(asyncResponse.timestamp).toISOString()
            : new Date().toISOString(),
          messageId: asyncResponse.messageId,
          isStreaming: false,
          isError: isError,
          canRetry: isError,
          retryCount: isError ? (targetMessages[messageIndex].retryCount || 0) : undefined,
          originalMessage: isError ? (asyncResponse as any).originalContent : undefined,
        }

        if (asyncResponse.success) {
          chatResponseTimes.value++
        }

        saveChatHistory(false, aiType)
      }
    }
  }

  /**
   * 处理AI消息发送
   * @param aiMessage AI消息对象
   * @param tempReplyId 临时消息ID
   * @param content 原始消息内容
   * @param aiType AI类型，用于确定更新哪个消息记录
   * @returns Promise<any>
   */
  const handleAiMessage = async (aiMessage: AiChatMessageRequest, tempReplyId: string, content: string, aiType?: string): Promise<{ reply?: string; messageId?: string; success?: boolean }> => {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setupTimeoutHandler(tempReplyId, content, 10000, aiType)
      const streamContentRef = { current: '' }
      
      try {
        const response = await apiService.sendChatMessage(
          aiMessage,
          createCompleteHandler(tempReplyId, timeoutId, streamContentRef, aiType),
          createStreamHandler(tempReplyId, timeoutId, streamContentRef, aiType)
        )

        // 处理同步响应
        if (response) {
          clearTimeout(timeoutId)
          const replyContent = response.reply || '请求失败，请重试。'
          const isError = !response.reply || response.reply === '请求失败，请重试。'
          
          updateTempMessage(tempReplyId, {
            content: replyContent,
            timestamp: new Date().toISOString(),
            messageId: response.messageId,
            isStreaming: false,
            isError: isError,
            canRetry: isError,
            retryCount: isError ? 0 : undefined,
            originalMessage: isError ? content : undefined,
          }, aiType)
          saveChatHistory(false, aiType)
          resolve(response)
        }
      } catch (error) {
        clearTimeout(timeoutId)
        updateTempMessage(tempReplyId, {
          content: '抱歉，AI暂时无法回答这个问题，请稍后重试。',
          timestamp: new Date().toISOString(),
          messageId: 'error_' + Date.now(),
          isStreaming: false,
          isError: true,
          canRetry: true,
          retryCount: 0,
          originalMessage: content,
        }, aiType)
        saveChatHistory(false, aiType)
        reject(error)
      }
    })
  }

  /**
   * 直接处理AI消息（用于重试，不创建新消息）
   * @param aiMessage AI消息对象
   * @param messageId 现有消息ID
   * @param content 原始消息内容
   * @param aiType AI类型，用于确定更新哪个消息记录
   * @returns Promise<any>
   */
  const handleAiMessageDirectly = async (aiMessage: AiChatMessageRequest, messageId: string, content: string, aiType?: string): Promise<{ reply?: string; messageId?: string; success?: boolean }> => {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setupTimeoutHandler(messageId, content, 10000, aiType)
      const streamContentRef = { current: '' }
      
      try {
        const response = await apiService.sendChatMessage(
          aiMessage,
          createDirectCompleteHandler(messageId, timeoutId, streamContentRef, aiType),
          createDirectStreamHandler(messageId, timeoutId, streamContentRef, aiType)
        )

        // 处理同步响应
        if (response) {
          clearTimeout(timeoutId)
          resolve(response)
        }
      } catch (error) {
        clearTimeout(timeoutId)
        reject(error)
      }
    })
  }

  /**
   * 处理老师消息发送
   * @param content 消息内容
   * @param chatRole 学习伙伴角色
   * @param tempReplyId 临时消息ID
   * @returns Promise<any>
   */
  const handleTeacherMessage = async (content: string, chatRole: string, tempReplyId: string): Promise<{ status?: string; timestamp?: number | string; messageId?: string }> => {
    const teacherMessage: import('../types').BridgeChatMessageData = {
      content,
      type: 'teacher',
      exerciseId: currentQuestion.value?.id,
      chatRole,
    }
    
    const response = await apiService.sendMessageToTeacher(teacherMessage)
    
    const replyContent: string = response.status || '收到您的消息，正在处理中...'
    updateTempMessage(tempReplyId, {
      content: replyContent,
      timestamp: typeof response.timestamp === 'number'
        ? new Date(response.timestamp).toISOString()
        : response.timestamp || new Date().toISOString(),
      messageId: response.messageId,
    })
    
    saveChatHistory()
    return response
  }

  /**
   * 发送聊天消息（流式响应）
   * @param content 消息内容
   * @param type 消息类型：'ai' 或 'teacher'
   * @param chatRole 学习伙伴角色：'mate' | 'mentor' | 'researcher'
   * @param imageData 可选的图片数据，包含filePath和base64DataUrl
   * @param hidePrefix 是否隐藏"我们开始吧"前缀（默认false）
   * @param aiType AI类型，用于确定保存到哪个消息记录
   * @returns Promise<any> 服务端响应数据
   */
  const sendChatMessage = async (content: string, type: 'ai' | 'teacher' = 'ai', chatRole: string = 'mate', imageData?: { filePath: string, base64DataUrl?: string }, hidePrefix: boolean = false, aiType?: string) => {
    try {
      // 步骤1: 验证当前题目是否存在
      if (!currentQuestion.value) {
        throw new Error('请先选择一道题目')
      }

      // 步骤2: 构建AI消息对象（根据是否为图片消息）
      const aiMessage = buildAiMessage(content, chatRole, imageData)

      // 步骤3: 根据AI类型获取对应的消息记录
      const targetMessages = aiType ? getCurrentAiMessages(aiType) : aiExerciseMessages.value
      
      // 步骤4: 创建并添加用户消息到聊天记录
      const userMessage = createUserMessage(content, imageData, hidePrefix)
      targetMessages.push(userMessage)

      // 步骤5: 创建临时AI回复消息（用于流式更新）
      const { message: tempReplyMessage, id: tempReplyId } = createTempReplyMessage(type)
      targetMessages.push(tempReplyMessage)

      // 步骤6: 保存聊天记录到本地存储
      saveChatHistory(false, aiType)

      // 步骤7: 根据消息类型分别处理
      if (type === 'ai') {
        // AI消息：设置超时机制，处理流式响应和完整响应
        return await handleAiMessage(aiMessage, tempReplyId, content, aiType)
      } else {
        // 老师消息：直接发送并更新临时消息
        return await handleTeacherMessage(content, chatRole, tempReplyId)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      showMessage('发送消息失败: ' + (error as Error).message, 'error')
      throw error
    }
  }

  /**
   * 开始AI指导
   * 为当前选中的题目启动AI指导模式
   * @param aiType AI类型，用于确定使用哪个消息记录
   * @returns Promise<void>
   */
  const startAiGuidance = async (aiType?: string) => {
    if (!currentQuestion.value) {
      showMessage('请先选择一道题目', 'warning')
      return
    }

    try {
      // 标记当前题目正在进行AI指导
      currentQuestion.value.isAiGuiding = true
      currentQuestion.value.beginGuideToSolve = true

      // 先清除当前题目的聊天记录，确保每次都是重新开始对话
      await clearChatHistory(aiType)
      
      // 发送题目内容给AI进行分析（每次都是新的开始）
      const questionContent = currentQuestion.value.question || '题目内容为空'
      // 在开头加上"我们开始吧"，但不渲染显示
      const initialMessage = `我们开始吧，${questionContent}`

      await sendChatMessage(initialMessage, 'ai', 'mate', undefined, true, aiType) // 隐藏"我们开始吧"前缀

      // AI指导开始，通过界面状态变化反馈给用户
    } catch (error) {
      console.error('启动AI指导失败:', error)
      // 发生错误时重置AI指导状态
      if (currentQuestion.value) {
        currentQuestion.value.isAiGuiding = false
        currentQuestion.value.beginGuideToSolve = false
      }
      showMessage('启动AI指导失败', 'error')
    }
  }

  /**
   * 保存聊天历史记录（带防抖）
   * 将当前题目的聊天记录异步保存到本地存储，使用防抖机制避免频繁保存
   * @param aiType AI类型，用于确定保存到哪个消息记录
   */
  const saveChatHistory = async (immediate: boolean = false, aiType?: string) => {
    // 清除之前的防抖定时器
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer)
      saveDebounceTimer = null
    }

    const doSave = async () => {
      // 根据AI类型获取对应的消息记录
      const messagesToSave = aiType ? getCurrentAiMessages(aiType) : aiExerciseMessages.value
      
      if (currentQuestion.value && messagesToSave.length > 0) {
        const historyData: ChatHistoryData = {
          questionId: currentQuestion.value.id, //题目ID
          messages: messagesToSave,  // 对应的消息数组
          chatResponseTimes: chatResponseTimes.value, //AI回复次数
          lastUpdated: Date.now(), //最后更新时间
        }

        console.log(`[CHAT_DEBUG] 💾 保存聊天记录详情:`, {
          questionId: currentQuestion.value.id,
          aiType: aiType || 'default',
          messageCount: messagesToSave.length,
          chatResponseTimes: chatResponseTimes.value,
          lastUpdated: new Date(historyData.lastUpdated).toLocaleString()
        })

        try {
          // 根据AI类型使用不同的存储键
          const storageKey = aiType ? `${currentQuestion.value.id}_${aiType}` : currentQuestion.value.id
          await asyncStorage.saveChatHistory(storageKey, historyData)
          console.log(`[CHAT_DEBUG] ✅ 聊天记录保存成功: ${storageKey}`)
        } catch (error) {
          console.error('[CHAT_DEBUG] ❌ 保存聊天记录失败:', error)
        }
      } else {
        console.log(`[CHAT_DEBUG] ⚠️ 跳过保存聊天记录:`, {
          hasCurrentQuestion: !!currentQuestion.value,
          aiType: aiType || 'default',
          messageCount: messagesToSave.length,
          reason: !currentQuestion.value ? '无当前题目' : '无聊天记录'
        })
      }
    }

    if (immediate) {
      await doSave()
    } else {
      // 使用防抖，500ms内只保存一次
      saveDebounceTimer = setTimeout(doSave, 500)
    }
  }

  /**
   * 保存老师聊天历史记录（带防抖）
   * 将当前题目的老师对话记录异步保存到本地存储，使用防抖机制避免频繁保存
   */
  const saveTeacherChatHistory = async (immediate: boolean = false) => {
    // 清除之前的防抖定时器
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer)
      saveDebounceTimer = null
    }

    const doSave = async () => {
      if (currentQuestion.value && teacherMessages.value.length > 0) {
        const historyData: ChatHistoryData = {
          questionId: currentQuestion.value.id, // 题目ID
          messages: teacherMessages.value,  // 整个老师消息数组
          chatResponseTimes: 0, // 老师对话不计算AI回复次数
          lastUpdated: Date.now(), // 最后更新时间
        }

        console.log(`[TEACHER_CHAT_DEBUG] 💾 保存老师聊天记录详情:`, {
          questionId: currentQuestion.value.id,
          messageCount: teacherMessages.value.length,
          lastUpdated: new Date(historyData.lastUpdated).toLocaleString()
        })

        try {
          await asyncStorage.saveTeacherChatHistory(currentQuestion.value.id, historyData)
          console.log(`[TEACHER_CHAT_DEBUG] ✅ 老师聊天记录保存成功: ${currentQuestion.value.id}`)
        } catch (error) {
          console.error('[TEACHER_CHAT_DEBUG] ❌ 保存老师聊天记录失败:', error)
        }
      } else {
        console.log(`[TEACHER_CHAT_DEBUG] ⚠️ 跳过保存老师聊天记录:`, {
          hasCurrentQuestion: !!currentQuestion.value,
          messageCount: teacherMessages.value.length,
          reason: !currentQuestion.value ? '无当前题目' : '无老师聊天记录'
        })
      }
    }

    if (immediate) {
      await doSave()
    } else {
      // 使用防抖，500ms内只保存一次
      saveDebounceTimer = setTimeout(doSave, 500)
    }
  }

  /**
   * 加载聊天历史记录
   * 从本地存储中异步加载当前题目的聊天记录，支持分批次渲染
   * @param aiType AI类型，用于确定加载哪个消息记录
   */
  const loadChatHistory = async (aiType?: string) => {
    if (!currentQuestion.value) {
      console.log(`[CHAT_DEBUG] ⚠️ 跳过加载聊天记录: 无当前题目`)
      return
    }

    console.log(`[CHAT_DEBUG] 📥 开始加载聊天记录: ${currentQuestion.value.id}, AI类型: ${aiType || 'default'}`)

    try {
      isChatLoading.value = true
      
      // 根据AI类型使用不同的存储键
      const storageKey = aiType ? `${currentQuestion.value.id}_${aiType}` : currentQuestion.value.id
      
      // 异步从 IndexedDB 加载聊天记录
      const historyData = await asyncStorage.loadChatHistory(storageKey)
      
      if (historyData && historyData.messages) {
        console.log(`[CHAT_DEBUG] 📦 从存储加载到聊天记录:`, {
          questionId: historyData.questionId,
          aiType: aiType || 'default',
          messageCount: historyData.messages.length,
          chatResponseTimes: historyData.chatResponseTimes,
          lastUpdated: new Date(historyData.lastUpdated).toLocaleString()
        })
        
        // 更新聊天回复次数
        chatResponseTimes.value = historyData.chatResponseTimes || 0
        
        // 根据AI类型设置对应的消息记录
        if (aiType) {
          const targetMessages = getCurrentAiMessages(aiType)
          await renderMessagesInBatches(historyData.messages, targetMessages)
        } else {
          // 默认使用aiExerciseMessages
          await renderMessagesInBatches(historyData.messages, aiExerciseMessages.value)
        }
        
        console.log(`[CHAT_DEBUG] ✅ 聊天记录加载完成: ${historyData.messages.length}条消息`)
      } else {
        console.log(`[CHAT_DEBUG] 📭 无聊天记录: ${storageKey}`)
        // 如果没有历史记录，初始化为空
        if (aiType) {
          const targetMessages = getCurrentAiMessages(aiType)
          targetMessages.length = 0
        } else {
          aiExerciseMessages.value = []
        }
        chatResponseTimes.value = 0
      }
    } catch (error) {
      console.error('[CHAT_DEBUG] ❌ 加载聊天记录失败:', error)
      // 加载失败时初始化为空
      if (aiType) {
        const targetMessages = getCurrentAiMessages(aiType)
        targetMessages.length = 0
      } else {
        aiExerciseMessages.value = []
      }
      chatResponseTimes.value = 0
    } finally {
      isChatLoading.value = false
    }
  }

  /**
   * 加载老师聊天历史记录
   * 从本地存储中异步加载当前题目的老师对话记录
   */
  const loadTeacherChatHistory = async () => {
    if (!currentQuestion.value) {
      console.log(`[TEACHER_CHAT_DEBUG] ⚠️ 跳过加载老师聊天记录: 无当前题目`)
      return
    }

    console.log(`[TEACHER_CHAT_DEBUG] 📥 开始加载老师聊天记录: ${currentQuestion.value.id}`)

    try {
      isChatLoading.value = true
      
      // 异步从 IndexedDB 加载老师聊天记录
      const historyData = await asyncStorage.loadTeacherChatHistory(currentQuestion.value.id)
      
      if (historyData && historyData.messages) {
        console.log(`[TEACHER_CHAT_DEBUG] 📦 从存储加载到老师聊天记录:`, {
          questionId: historyData.questionId,
          messageCount: historyData.messages.length,
          lastUpdated: new Date(historyData.lastUpdated).toLocaleString()
        })
        
        // 直接设置老师消息，不需要分批次渲染（老师消息通常较少）
        teacherMessages.value = historyData.messages
        console.log(`[TEACHER_CHAT_DEBUG] ✅ 老师聊天记录加载完成: ${historyData.messages.length}条消息`)
      } else {
        console.log(`[TEACHER_CHAT_DEBUG] 📭 无老师聊天记录: ${currentQuestion.value.id}`)
        // 如果没有历史记录，初始化为空
        teacherMessages.value = []
      }
    } catch (error) {
      console.error('[TEACHER_CHAT_DEBUG] ❌ 加载老师聊天记录失败:', error)
      // 加载失败时初始化为空
      teacherMessages.value = []
    } finally {
      isChatLoading.value = false
    }
  }

  /**
   * 分批次渲染消息
   * 将大量消息分批次渲染，避免阻塞主线程
   * @param messages 要渲染的消息数组
   * @param targetMessages 目标消息数组，如果不指定则使用aiExerciseMessages
   */
  const renderMessagesInBatches = async (messages: ChatBubble[], targetMessages?: ChatBubble[]) => {
    if (!messages || messages.length === 0) return

    const BATCH_SIZE = 20 // 每批渲染20条消息
    const BATCH_DELAY = 16 // 16ms延迟，约60fps
    
    isChatRendering.value = true
    
    try {
      // 使用指定的目标消息数组，如果没有指定则使用aiExerciseMessages
      const target = targetMessages || aiExerciseMessages.value
      
      // 先渲染最新的消息（最后20条）
      const latestMessages = messages.slice(-BATCH_SIZE)
      target.length = 0
      target.push(...latestMessages)
      
      // 如果还有更多消息，分批加载更早的消息
      if (messages.length > BATCH_SIZE) {
        const remainingMessages = messages.slice(0, -BATCH_SIZE)
        
        // 从后往前分批插入消息
        for (let i = remainingMessages.length - BATCH_SIZE; i >= 0; i -= BATCH_SIZE) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY))
          
          const batch = remainingMessages.slice(Math.max(0, i), i + BATCH_SIZE)
          target.unshift(...batch)
        }
        
        // 处理剩余的消息
        if (remainingMessages.length % BATCH_SIZE !== 0) {
          const remainingBatch = remainingMessages.slice(0, remainingMessages.length % BATCH_SIZE)
          target.unshift(...remainingBatch)
        }
      }
    } finally {
      isChatRendering.value = false
    }
  }

  /**
   * 清除当前题目的聊天记录
   * 清空当前题目的所有对话历史和相关状态，并刷新消息列表
   * @param aiType AI类型，用于确定清除哪个消息记录
   */
  const clearChatHistory = async (aiType?: string) => {
    if (currentQuestion.value) {
      try {
        // 根据AI类型使用不同的存储键
        const storageKey = aiType ? `${currentQuestion.value.id}_${aiType}` : currentQuestion.value.id
        
        // 从异步存储中删除聊天记录
        await asyncStorage.removeChatHistory(storageKey)
        
        // 根据AI类型清空对应的消息记录
        if (aiType) {
          const targetMessages = getCurrentAiMessages(aiType)
          targetMessages.length = 0
        } else {
          // 清空内存中的聊天记录
          aiExerciseMessages.value = []
        }
        chatResponseTimes.value = 0
        
        // 重置AI指导状态
        currentQuestion.value.isAiGuiding = false
        currentQuestion.value.beginGuideToSolve = false
        
        console.log('聊天记录已清除:', storageKey)
      } catch (error) {
        console.warn('清除聊天记录失败:', error)
        throw error
      }
    }
  }

  /**
   * 清除当前题目的老师聊天记录
   * 清空当前题目的所有老师对话历史
   */
  const clearTeacherChatHistory = async () => {
    if (currentQuestion.value) {
      try {
        // 从异步存储中删除老师聊天记录
        await asyncStorage.removeTeacherChatHistory(currentQuestion.value.id)
        
        // 清空内存中的老师聊天记录
        teacherMessages.value = []
        
        console.log('老师聊天记录已清除:', currentQuestion.value.id)
      } catch (error) {
        console.warn('清除老师聊天记录失败:', error)
        throw error
      }
    }
  }

  /**
   * 重发AI消息
   * 重新发送失败的消息，最多重试3次
   * 直接在现有消息气泡内更新内容，不新增消息
   * @param messageId 要重发的消息ID
   * @param chatRole 学习伙伴角色
   * @param imageData 可选的图片数据
   * @param aiType AI类型，用于确定更新哪个消息记录
   */
  const retryAiMessage = async (messageId: string, chatRole: string = 'mate', imageData?: { filePath: string, base64DataUrl?: string }, aiType?: string) => {
    // 根据AI类型获取对应的消息记录
    const targetMessages = aiType ? getCurrentAiMessages(aiType) : aiExerciseMessages.value
    
    const messageIndex = targetMessages.findIndex(msg => msg.id === messageId)
    if (messageIndex === -1) {
      throw new Error('消息不存在')
    }

    const message = targetMessages[messageIndex]
    if (!message.canRetry || !message.originalMessage) {
      throw new Error('该消息不支持重发')
    }

    const maxRetries = 3
    const currentRetryCount = message.retryCount || 0
    
    if (currentRetryCount >= maxRetries) {
      throw new Error('已达到最大重试次数')
    }

    try {
      // 更新消息状态为重试中 - 显示友好的重试提示
      targetMessages[messageIndex] = {
        ...message,
        content: '',
        isError: false,
        isStreaming: true,
        canRetry: false,
        retryCount: currentRetryCount + 1,
      }
      saveChatHistory(false, aiType)

      // 构建AI消息对象
      const aiMessage = buildAiMessage(message.originalMessage, chatRole, imageData)
      
      // 直接处理AI消息，不创建新消息
      const response = await handleAiMessageDirectly(aiMessage, messageId, message.originalMessage, aiType)

      // 判断是否真正成功
      const isActuallySuccess = response.success && response.reply && response.reply !== '请求失败，请重试。'
      
      // 重试完成，更新消息内容
      targetMessages[messageIndex] = {
        ...message,
        content: response.reply || '请求失败，请重试。',
        timestamp: new Date().toISOString(),
        messageId: response.messageId,
        isStreaming: false,
        isError: !isActuallySuccess,
        canRetry: !isActuallySuccess && (currentRetryCount + 1 < maxRetries),
        retryCount: !isActuallySuccess ? currentRetryCount + 1 : undefined,
        originalMessage: !isActuallySuccess ? message.originalMessage : undefined,
      }
      saveChatHistory(false, aiType)

    } catch (error) {
      // 重发失败，更新错误状态
      targetMessages[messageIndex] = {
        ...message,
        content: `重试失败 (${currentRetryCount + 1}/${maxRetries})，请稍后重试。`,
        isError: true,
        isStreaming: false,
        canRetry: currentRetryCount + 1 < maxRetries, // 如果还有重试次数则允许重发
        retryCount: currentRetryCount + 1,
      }
      saveChatHistory(false, aiType)
      throw error
    }
  }


  /**
   * 拍照功能
   * 调用AndroidBridge的相机接口进行拍照
   * @returns Promise<string> 返回图片路径
   */
  const takePicture = async () => {
    try {
      const subjectName = subject.value.toLowerCase()
      // 拍照功能只能通过AndroidBridge实现
      if (androidBridge.isAndroidBridgeAvailable()) {
        const imagePath = await androidBridge.takePicture(subjectName)
        return imagePath
      } else {
        throw new Error('拍照功能仅在Android环境下可用')
      }
    } catch (error) {
      console.error('Failed to take picture:', error)
      showMessage('拍照失败', 'error')
      throw error
    }
  }

  /**
   * 保存学习进度
   * 将当前的学习状态保存到API服务
   */
  const saveProgress = async () => {
    const progress = {
      currentQuestionIndex: currentQuestionIndex.value,
      chatResponseTimes: chatResponseTimes.value,
      timestamp: Date.now(),
    }
    
    // HTTP请求使用API服务
    await apiService.saveExerciseProgress(progress)
  }

  /**
   * 快速保存学习进度（用于退出时）
   * 使用较短的超时时间，不阻塞退出操作
   */
  const quickSaveProgress = async () => {
    const progress = {
      currentQuestionIndex: currentQuestionIndex.value,
      chatResponseTimes: chatResponseTimes.value,
      timestamp: Date.now(),
    }
    
    // 使用较短的超时时间进行快速保存
    const savePromise = apiService.saveExerciseProgress(progress)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('快速保存超时')), 800) // 800ms超时
    })
    
    return Promise.race([savePromise, timeoutPromise])
  }

  /**
   * 退出应用
   * 调用AndroidBridge退出当前Activity
   */
  const exitActivity = () => {
    // 退出功能只能通过AndroidBridge实现
    if (androidBridge.isAndroidBridgeAvailable()) {
      androidBridge.exitActivity()
    }
  }

  // ==================== 联网搜索相关方法 ====================
  
  /**
   * 切换联网搜索状态
   */
  const toggleWebSearch = () => {
    enableWebSearch.value = !enableWebSearch.value
    console.log('🔍 Store中联网搜索状态切换:', enableWebSearch.value)
  }

  // ==================== 返回Store接口 ====================
  return {
    // 响应式状态
    questions, // 题目列表
    similarQuestions, // 相似题目列表
    currentQuestionIndex, // 当前选中题目索引
    aiExerciseMessages, // AI题目消息记录
    aiGeneralMessages, // AI通用消息记录
    aiTextbookMessages, // AI教材消息记录
    teacherMessages, // 老师消息记录
    userInfo, // 用户信息
    enableWebSearch, // 联网搜索状态
    subject, // 当前科目
    chatBotUrl, // 聊天机器人URL
    isLoading, // 加载状态
    isChatLoading, // 聊天记录加载状态
    isChatRendering, // 聊天记录分批次加载状态
    chatResponseTimes, // AI回复次数
    VIEW_ANSWER_CHAT_TIMES, // 查看答案所需最小交互次数

    // 计算属性
    currentQuestion, // 当前选中的题目
    canViewAnswer, // 是否可以查看答案
    hasQuestions, // 是否有题目数据

    // 动作方法
    initializeStore, // 初始化Store
    fetchQuestions, // 获取题目列表
    selectQuestion, // 选择题目
    deleteQuestion, // 删除题目
    moveQuestionToTop, // 移动题目到顶部
    moveQuestionToTopById, // 根据ID移动题目到顶部
    findSimilarQuestions, // 查找相似题目
    addSimilarQuestionToList, // 添加相似题目到列表
    setQuestions, // 设置题目列表到store
    sendChatMessage, // 发送聊天消息
    startAiGuidance, // 开始AI指导
    takePicture, // 拍照功能
    saveProgress, // 保存学习进度
    quickSaveProgress, // 快速保存学习进度
    exitActivity, // 退出应用
    saveChatHistory, // 保存聊天历史
    loadChatHistory, // 加载聊天历史
    saveTeacherChatHistory, // 保存老师聊天历史
    loadTeacherChatHistory, // 加载老师聊天历史
    clearChatHistory, // 清除当前题目聊天记录
    clearTeacherChatHistory, // 清除当前题目老师聊天记录
    retryAiMessage, // 重发AI消息
    toggleWebSearch, // 切换联网搜索状态
    renderMessagesInBatches, // 分批次渲染消息
    getCurrentAiMessages, // 获取当前AI类型的消息记录
    
    // 去重相关方法
    deduplicateQuestions, // 高效题目去重算法
    generateContentHash, // 生成题目内容哈希
  }
})
