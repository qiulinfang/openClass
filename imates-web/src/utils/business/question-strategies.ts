import type { ExerciseItem, HomeworkQuestionAnswer } from '@/types'

export interface QuestionStrategy {
  /**
   * 获取题型的默认作答值
   */
  getDefaultAnswer(): any

  /**
   * 校验作答内容是否为空
   * @param val 作答内容 (userAnswer)
   */
  isEmpty(val: any): boolean

  /**
   * 校验用户作答是否正确
   * @param val 用户作答值
   * @param standardAnswer 标准答案
   */
  checkCorrect(val: any, standardAnswer: any): boolean

  /**
   * 格式化作答数据，用于提交作业接口
   * @param val 用户作答值
   * @param questionIndex 题目在列表中的索引值
   * @param buildSubAnswer 辅助递归函数，供复合题使用
   */
  formatForSubmit(val: any, questionIndex: number, buildSubAnswer?: (subQ: any, subIndex: number, parentVal?: any) => any): any

  /**
   * 构建错题本所需要的特定作答结构对象
   * @param val 用户作答值
   */
  buildOriginalAnswer(val: any): any
}

// 1. 选择题策略 (单选 / 多选)
class ChoiceStrategy implements QuestionStrategy {
  getDefaultAnswer() {
    return []
  }

  isEmpty(val: any): boolean {
    return !Array.isArray(val) || val.length === 0
  }

  checkCorrect(val: any, standardAnswer: any): boolean {
    if (!val || !Array.isArray(val) || val.length === 0) return false
    const standardChoices = Array.isArray(standardAnswer)
      ? standardAnswer
      : [String(standardAnswer)]
    if (val.length !== standardChoices.length) return false
    return val.every((c) => standardChoices.includes(c))
  }

  formatForSubmit(val: any) {
    return Array.isArray(val) ? val.map(String) : []
  }

  buildOriginalAnswer(val: any) {
    return { chooseList: val || [] }
  }
}

// 2. 判断题策略
class JudgmentStrategy implements QuestionStrategy {
  getDefaultAnswer() {
    return ''
  }

  isEmpty(val: any): boolean {
    return val === undefined || val === null || val === ''
  }

  checkCorrect(val: any, standardAnswer: any): boolean {
    if (val === undefined || val === null || val === '') return false
    return String(standardAnswer) === String(val)
  }

  formatForSubmit(val: any) {
    return val !== undefined && val !== null && val !== '' ? String(val) : ''
  }

  buildOriginalAnswer(val: any) {
    return { judgmentValue: val || '' }
  }
}

// 3. 填空题策略
class FillBlankStrategy implements QuestionStrategy {
  getDefaultAnswer() {
    return []
  }

  isEmpty(val: any): boolean {
    if (!Array.isArray(val) || val.length === 0) return true
    // 判断是否有任何一空已经作答
    return !val.some((item) => {
      if (!item) return false
      if (typeof item === 'object') {
        if (item.type === 'photo') {
          return !!item.photoUrl
        }
        const boardData = item.boardData || item
        return Array.isArray(boardData?.objects) && boardData.objects.length > 0
      }
      return !!item.trim()
    })
  }

  checkCorrect(): boolean {
    return false // 填空题非客观自动判定
  }

  formatForSubmit(val: any) {
    if (!Array.isArray(val)) return []
    return val.map((item: any) => {
      if (typeof item === 'object' && item !== null) {
        if (item.type === 'photo') {
          return item.photoUrl || ''
        }
        return item.boardImg || ''
      }
      return ''
    })
  }

  buildOriginalAnswer(val: any) {
    return { fillList: val || [] }
  }
}

// 4. 主观题策略
class SubjectiveStrategy implements QuestionStrategy {
  getDefaultAnswer() {
    return { type: 'board' }
  }

  isEmpty(val: any): boolean {
    if (!val) return true
    if (typeof val === 'object') {
      if (val.type === 'photo') {
        return !val.photoUrl
      }
      const boardData = val.boardData || val
      return !(Array.isArray(boardData?.objects) && boardData.objects.length > 0)
    }
    return !val.trim()
  }

  checkCorrect(): boolean {
    return false // 主观题非自动判定
  }

  formatForSubmit(val: any) {
    if (typeof val === 'object' && val !== null) {
      if (val.type === 'photo') {
        return val.photoUrl || ''
      }
      return val.boardImg || ''
    }
    return ''
  }

  buildOriginalAnswer(val: any) {
    return { subjectiveData: val || { type: 'board' } }
  }
}

// 5. 复合题策略
class CompositeStrategy implements QuestionStrategy {
  getDefaultAnswer() {
    return {}
  }

  isEmpty(val: any): boolean {
    return !val || typeof val !== 'object' || Object.keys(val).length === 0
  }

  checkCorrect(): boolean {
    return false // 复合题非整题客观自动判定
  }

  formatForSubmit(val: any, questionIndex: number, buildSubAnswer?: (subQ: any, subIndex: number, parentVal?: any) => any) {
    const nestedAnswers: any[] = []
    if (buildSubAnswer) {
      // 实际逻辑在 buildAnswerForQuestion 中通过回调实现
    }
    return nestedAnswers
  }

  buildOriginalAnswer(val: any) {
    return { compositeAnswers: val || {} }
  }
}

// 策略导出字典
const strategies: Record<string, QuestionStrategy> = {
  single_choice: new ChoiceStrategy(),
  multiple_choice: new ChoiceStrategy(),
  true_false: new JudgmentStrategy(),
  judgment: new JudgmentStrategy(),
  fill_in_blank: new FillBlankStrategy(),
  subjective: new SubjectiveStrategy(),
  composite: new CompositeStrategy(),
}

// 默认兜底策略
class DefaultStrategy implements QuestionStrategy {
  getDefaultAnswer() {
    return null
  }
  isEmpty() {
    return true
  }
  checkCorrect() {
    return false
  }
  formatForSubmit() {
    return null
  }
  buildOriginalAnswer() {
    return {}
  }
}

const defaultStrategy = new DefaultStrategy()

/**
 * 根据题目类型获取题型策略实例
 * @param type 题目类型
 */
export const getQuestionStrategy = (type?: string): QuestionStrategy => {
  if (!type) return defaultStrategy
  return strategies[type] || defaultStrategy
}
