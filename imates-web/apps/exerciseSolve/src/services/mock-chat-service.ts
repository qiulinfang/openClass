/**
 * 模拟聊天服务
 * 用于测试聊天记录加载、自动回复和模拟发送功能
 */

import type { ChatBubble, AiChatMessageRequest } from '../types'

// 模拟AI回复数据
const MOCK_AI_RESPONSES = {
  // 数学题目相关回复
  math: [
    "让我来帮你分析这道数学题。首先，我们需要理解题目的要求...",
    "这是一个很好的问题！我们可以通过以下步骤来解决：\n1. 分析题目条件\n2. 建立数学模型\n3. 求解并验证答案",
    "我注意到你在这一步遇到了困难。让我换个角度来解释...",
    "根据题目给出的条件，我们可以设未知数为x，然后建立方程...",
    "这个解题思路很清晰！接下来我们需要考虑边界条件...",
    "让我用图形来帮你理解这个概念...",
    "这是一个典型的二次函数问题，我们可以用配方法来解决...",
    "很好！你已经掌握了基本思路。现在让我们来验证答案是否正确..."
  ],
  
  // 生物题目相关回复
  biology: [
    "这是一个很有趣的生物问题！让我来详细解释一下...",
    "从生物学的角度来看，这个过程涉及到细胞的基本功能...",
    "让我用图表来展示这个生物过程...",
    "这个问题涉及到生态系统的能量流动，我们可以这样分析...",
    "根据达尔文的进化理论，我们可以这样理解...",
    "这是一个关于遗传的问题，让我们从基因的角度来分析...",
    "从分子生物学的角度来看，这个过程是这样的...",
    "很好！你已经理解了基本概念。现在让我们深入探讨..."
  ],
  
  // 通用回复
  general: [
    "我理解你的问题，让我来帮你分析一下...",
    "这是一个很好的问题！让我详细解释...",
    "根据我的分析，这个问题的关键在于...",
    "让我换个角度来思考这个问题...",
    "我注意到你可能在这个概念上有些困惑，让我重新解释...",
    "这是一个复杂的问题，我们可以分步骤来解决...",
    "让我用更简单的方式来解释这个概念...",
    "你的思路很正确！让我们继续深入..."
  ]
}

// 模拟用户消息
const MOCK_USER_MESSAGES = [
  "我不太理解这道题",
  "能详细解释一下吗？",
  "这个步骤是怎么来的？",
  "还有其他解法吗？",
  "我这样理解对吗？",
  "能举个例子吗？",
  "这个公式怎么推导的？",
  "为什么是这个答案？"
]

export class MockChatService {
  private static instance: MockChatService
  private responseIndex = 0
  private userMessageIndex = 0

  private constructor() {}

  public static getInstance(): MockChatService {
    if (!MockChatService.instance) {
      MockChatService.instance = new MockChatService()
    }
    return MockChatService.instance
  }

  /**
   * 生成模拟AI回复
   */
  public generateMockResponse(subject: 'math' | 'biology' | 'general' = 'general'): string {
    const responses = MOCK_AI_RESPONSES[subject]
    const response = responses[this.responseIndex % responses.length]
    this.responseIndex++
    return response
  }

  /**
   * 生成模拟用户消息
   */
  public generateMockUserMessage(): string {
    const message = MOCK_USER_MESSAGES[this.userMessageIndex % MOCK_USER_MESSAGES.length]
    this.userMessageIndex++
    return message
  }

  /**
   * 模拟流式回复
   * 将回复内容分块返回，模拟打字机效果
   */
  public async simulateStreamResponse(
    content: string,
    onChunk: (chunk: string, isComplete: boolean) => void,
    delay: number = 50
  ): Promise<void> {
    const words = content.split('')
    
    for (let i = 0; i < words.length; i++) {
      await new Promise(resolve => setTimeout(resolve, delay))
      onChunk(words[i], false)
    }
    
    // 发送完成信号
    onChunk('', true)
  }

  /**
   * 生成模拟聊天历史记录
   */
  public generateMockChatHistory(questionId: string, messageCount: number = 10): ChatBubble[] {
    const messages: ChatBubble[] = []
    const now = Date.now()
    
    for (let i = 0; i < messageCount; i++) {
      const isUser = i % 2 === 0
      const timestamp = now - (messageCount - i) * 60000 // 每分钟一条消息
      
      if (isUser) {
        messages.push({
          id: `user_${questionId}_${i}`,
          content: this.generateMockUserMessage(),
          sender: 'user',
          type: 'user',
          timestamp: new Date(timestamp).toISOString(),
          messageType: 'text'
        })
      } else {
        messages.push({
          id: `ai_${questionId}_${i}`,
          content: this.generateMockResponse('math'),
          sender: 'ai',
          type: 'ai',
          timestamp: new Date(timestamp).toISOString(),
          messageId: `msg_${questionId}_${i}`,
          messageType: 'text'
        })
      }
    }
    
    return messages
  }

  /**
   * 模拟发送聊天消息（不调用真实API）
   */
  public async simulateSendMessage(
    message: AiChatMessageRequest,
    onComplete?: (response: any) => void,
    onStream?: (chunk: string, isComplete: boolean) => void,
    enableStream: boolean = true
  ): Promise<any> {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))
    
    const response = this.generateMockResponse('math')
    const messageId = `mock_${Date.now()}`
    
    if (enableStream && onStream) {
      // 模拟流式回复
      await this.simulateStreamResponse(response, onStream, 30)
    }
    
    const finalResponse = {
      success: true,
      messageId,
      reply: response,
      sessionId: message.sessionId,
      timestamp: Date.now()
    }
    
    if (onComplete) {
      onComplete(finalResponse)
    }
    
    return finalResponse
  }

  /**
   * 模拟自动回复功能
   * 每隔一定时间自动发送AI回复
   */
  public startAutoReply(
    questionId: string,
    onNewMessage: (message: ChatBubble) => void,
    interval: number = 10000 // 10秒间隔
  ): () => void {
    let isRunning = true
    let messageCounter = 0
    
    const autoReply = async () => {
      if (!isRunning) return
      
      messageCounter++
      const response = this.generateMockResponse('math')
      
      const message: ChatBubble = {
        id: `auto_${questionId}_${messageCounter}`,
        content: response,
        sender: 'ai',
        type: 'ai',
        timestamp: new Date().toISOString(),
        messageId: `auto_msg_${questionId}_${messageCounter}`,
        messageType: 'text'
      }
      
      onNewMessage(message)
      
      // 设置下次自动回复
      setTimeout(autoReply, interval)
    }
    
    // 启动自动回复
    setTimeout(autoReply, interval)
    
    // 返回停止函数
    return () => {
      isRunning = false
    }
  }

  /**
   * 生成测试用的聊天记录数据
   */
  public generateTestChatData(questionId: string) {
    return {
      questionId,
      messages: this.generateMockChatHistory(questionId, 8),
      chatResponseTimes: 4,
      lastUpdated: Date.now()
    }
  }

  /**
   * 重置计数器
   */
  public resetCounters(): void {
    this.responseIndex = 0
    this.userMessageIndex = 0
  }
}

// 创建默认实例
export const mockChatService = MockChatService.getInstance()
