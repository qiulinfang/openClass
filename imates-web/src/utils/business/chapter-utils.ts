/**
 * 章节相关的工具函数
 * 提供章节名称转换、数字提取和排序等功能
 */

/**
 * 将中文数字转换为阿拉伯数字
 * @param chineseNum 中文数字字符串（如一、二、三、十、十一等）
 * @returns 阿拉伯数字，如果无法转换则返回 9999
 */
export function convertChineseNumberToArabic(chineseNum: string): number {
  const chineseNumbers: { [key: string]: number } = {
    '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
    '十': 10, '十一': 11, '十二': 12, '十三': 13, '十四': 14,
    '十五': 15, '十六': 16, '十七': 17, '十八': 18, '十九': 19,
    '二十': 20, '三十': 30, '四十': 40, '五十': 50,
    '六十': 60, '七十': 70, '八十': 80, '九十': 90
  }
  
  // 直接匹配
  if (chineseNumbers[chineseNum] !== undefined) {
    return chineseNumbers[chineseNum]
  }
  
  // 处理"二十X"、"三十X"等格式
  const tensMatch = chineseNum.match(/^([二三四五六七八九])十(.+)$/)
  if (tensMatch) {
    const tens = chineseNumbers[tensMatch[1]] * 10
    const ones = chineseNumbers[tensMatch[2]] || 0
    return tens + ones
  }
  
  // 处理"十X"格式（如"十一"、"十二"等）
  if (chineseNum.startsWith('十')) {
    const remainder = chineseNum.substring(1)
    if (remainder === '') {
      return 10
    }
    return 10 + (chineseNumbers[remainder] || 0)
  }
  
  return 9999
}

/**
 * 将阿拉伯数字转换为中文数字
 * @param str 包含阿拉伯数字的字符串（如"第1章"、"第2章"等）
 * @returns 转换后的字符串（如"第一章"、"第二章"等）
 */
export function convertToChineseNumber(str: string): string {
  const chineseNumbers = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  
  // 检查是否已经是中文数字格式（包含"第一章"、"第二章"等）
  const alreadyChinesePattern = /第[一二三四五六七八九十]+章/
  if (alreadyChinesePattern.test(str)) {
    // 已经是中文数字格式，无需转换
    return str
  }
  
  // 尝试匹配阿拉伯数字格式（"第1章"、"第2章"等）
  const result = str.replace(/第(\d+)章/g, (match, num) => {
    const number = parseInt(num)
    if (number >= 1 && number <= 9) {
      return `第${chineseNumbers[number]}章`
    } else if (number >= 10) {
      // 处理两位数的情况
      const tens = Math.floor(number / 10)
      const ones = number % 10
      if (tens === 1) {
        return ones === 0 ? '第十章' : `第十${chineseNumbers[ones]}章`
      } else {
        return ones === 0 ? `第${chineseNumbers[tens]}十章` : `第${chineseNumbers[tens]}十${chineseNumbers[ones]}章`
      }
    }
    return match
  })
  
  return result
}

/**
 * 提取章节名称的前缀类型（用于分组排序）
 * @param originalName 原始章节名称
 * @returns 前缀类型：'chapter'（第X章）、'directory'（目录X）、'topic'（专题X）、'other'（其他）
 */
export function getChapterPrefixType(originalName: string): string {
  // 匹配"第X章"格式（阿拉伯数字或中文数字）
  if (/第(\d+|[一二三四五六七八九十]+)章/.test(originalName)) {
    return 'chapter'
  }
  
  // 匹配"目录X"格式（阿拉伯数字或中文数字）
  if (/目录(\d+|[一二三四五六七八九十]+)/.test(originalName)) {
    return 'directory'
  }
  
  // 匹配"专题X"格式（阿拉伯数字或中文数字）
  if (/专题(\d+|[一二三四五六七八九十]+)/.test(originalName)) {
    return 'topic'
  }
  
  return 'other'
}

/**
 * 获取前缀类型的排序优先级
 * @param prefixType 前缀类型
 * @returns 优先级数字，数字越小优先级越高
 */
function getPrefixTypePriority(prefixType: string): number {
  const priorities: { [key: string]: number } = {
    'chapter': 1,    // 第X章（优先级最高）
    'directory': 2,  // 目录X
    'topic': 3,      // 专题X
    'other': 99      // 其他（排在最后）
  }
  return priorities[prefixType] || 99
}

/**
 * 提取章节名称中的数字用于排序（支持阿拉伯数字和中文数字）
 * 主要用于章节列表的排序
 * @param originalName 原始章节名称（如"第1章"、"第一章"、"第一章 集合与常用逻辑用语"、"专题一"、"专题2"、"目录1"、"目录一"等）
 * @returns 提取到的数字，如果无法提取则返回 9999（排在最后）
 */
export function extractChapterNumberFromName(originalName: string): number {
  // 尝试匹配阿拉伯数字格式"第X章"
  const arabicMatch = originalName.match(/第(\d+)章/)
  if (arabicMatch) {
    return parseInt(arabicMatch[1], 10)
  }
  
  // 尝试匹配中文数字格式"第X章"（如"第一章"、"第二章"等）
  const chineseMatch = originalName.match(/第([一二三四五六七八九十]+)章/)
  if (chineseMatch) {
    return convertChineseNumberToArabic(chineseMatch[1])
  }
  
  // 尝试匹配"目录X"格式（阿拉伯数字）
  const directoryArabicMatch = originalName.match(/目录(\d+)/)
  if (directoryArabicMatch) {
    return parseInt(directoryArabicMatch[1], 10)
  }
  
  // 尝试匹配"目录X"格式（中文数字，如"目录一"、"目录二"等）
  const directoryChineseMatch = originalName.match(/目录([一二三四五六七八九十]+)/)
  if (directoryChineseMatch) {
    return convertChineseNumberToArabic(directoryChineseMatch[1])
  }
  
  // 尝试匹配"专题X"格式（阿拉伯数字）
  const topicArabicMatch = originalName.match(/专题(\d+)/)
  if (topicArabicMatch) {
    return parseInt(topicArabicMatch[1], 10)
  }
  
  // 尝试匹配"专题X"格式（中文数字，如"专题一"、"专题二"等）
  const topicChineseMatch = originalName.match(/专题([一二三四五六七八九十]+)/)
  if (topicChineseMatch) {
    return convertChineseNumberToArabic(topicChineseMatch[1])
  }
  
  // 尝试匹配开头的阿拉伯数字
  const numberMatch = originalName.match(/^(\d+)/)
  if (numberMatch) {
    return parseInt(numberMatch[1], 10)
  }
  
  // 如果无法提取数字，返回一个很大的数字，排在最后
  return 9999
}

/**
 * 解析文件名中的章节顺序（支持多种格式）
 * 主要用于文件排序，支持更多命名模式
 * @param fileName 文件名
 * @returns 章节顺序数字，如果无法解析则返回 9999
 */
export function parseChapterOrderFromFileName(fileName: string): number {
  // 常见的章节命名模式
  const patterns = [
    // 模式1: 第X章、第X节、第X课（阿拉伯数字）
    { pattern: /第(\d+)[章节课]/, type: 'arabic' },
    // 模式2: 第X章、第X节、第X课（中文数字）
    { pattern: /第([一二三四五六七八九十]+)[章节课]/, type: 'chinese' },
    // 模式3: 目录X（阿拉伯数字，如"目录1"、"目录2"等）
    { pattern: /目录(\d+)/, type: 'arabic' },
    // 模式4: 目录X（中文数字，如"目录一"、"目录二"等）
    { pattern: /目录([一二三四五六七八九十]+)/, type: 'chinese' },
    // 模式5: 专题X（阿拉伯数字，如"专题1"、"专题2"等）
    { pattern: /专题(\d+)/, type: 'arabic' },
    // 模式6: 专题X（中文数字，如"专题一"、"专题二"等）
    { pattern: /专题([一二三四五六七八九十]+)/, type: 'chinese' },
    // 模式7: Chapter X、ChapterX
    { pattern: /Chapter\s*(\d+)/i, type: 'arabic' },
    // 模式8: 纯数字开头
    { pattern: /^(\d+)/, type: 'arabic' },
    // 模式9: 数字-数字格式 (如: 1-1, 2-3)
    { pattern: /^(\d+)-\d+/, type: 'arabic' },
    // 模式10: 数字.数字格式 (如: 1.1, 2.3)
    { pattern: /^(\d+)\.\d+/, type: 'arabic' },
    // 模式11: 数字_数字格式 (如: 1_1, 2_3)
    { pattern: /^(\d+)_\d+/, type: 'arabic' },
    // 模式12: 数字-数字-数字格式 (如: 1-1-1)
    { pattern: /^(\d+)-\d+-\d+/, type: 'arabic' },
    // 模式13: 数字.数字.数字格式 (如: 1.1.1)
    { pattern: /^(\d+)\.\d+\.\d+/, type: 'arabic' },
    // 模式14: 数字_数字_数字格式 (如: 1_1_1)
    { pattern: /^(\d+)_\d+_\d+/, type: 'arabic' },
    // 模式15: 中文数字（不在"第X章"、"目录X"或"专题X"格式中的中文数字）
    { pattern: /[一二三四五六七八九十百千万]+/, type: 'chinese_standalone' }
  ]
  
  for (const { pattern, type } of patterns) {
    const match = fileName.match(pattern)
    if (match) {
      if (type === 'chinese') {
        // 中文数字转换（从捕获组中提取）
        return convertChineseNumberToArabic(match[1])
      } else if (type === 'chinese_standalone') {
        // 独立的中文数字转换
        return convertChineseNumberToArabic(match[0])
      } else {
        // 阿拉伯数字
        return parseInt(match[1], 10)
      }
    }
  }
  
  // 如果没有匹配到任何模式，返回一个很大的数字，排在最后
  return 9999
}

/**
 * 章节排序函数（支持阿拉伯数字和中文数字，按前缀类型分组排序）
 * 排序规则：
 * 1. 先按前缀类型分组（第X章、目录X、专题X等）
 * 2. 在同一组内按数字大小排序
 * 3. 最终顺序：第X章 → 目录X → 专题X → 其他
 * @param a 章节A（需要包含name属性）
 * @param b 章节B（需要包含name属性）
 * @returns 排序结果：负数表示a排在b前面，正数表示a排在b后面，0表示相等
 */
export function sortChaptersByNumber<T extends { name: string }>(a: T, b: T): number {
  // 获取前缀类型
  const aPrefixType = getChapterPrefixType(a.name)
  const bPrefixType = getChapterPrefixType(b.name)
  
  // 获取前缀类型的优先级
  const aPriority = getPrefixTypePriority(aPrefixType)
  const bPriority = getPrefixTypePriority(bPrefixType)
  
  // 如果前缀类型不同，按优先级排序
  if (aPriority !== bPriority) {
    return aPriority - bPriority
  }
  
  // 前缀类型相同，提取数字进行排序
  const aNumber = extractChapterNumberFromName(a.name)
  const bNumber = extractChapterNumberFromName(b.name)
  
  // 如果两个章节都提取到了数字，按数字大小排序
  if (aNumber !== 9999 && bNumber !== 9999) {
    return aNumber - bNumber
  }
  
  // 如果只有一个提取到了数字，有数字的排在前面
  if (aNumber !== 9999 && bNumber === 9999) {
    return -1
  }
  if (aNumber === 9999 && bNumber !== 9999) {
    return 1
  }
  
  // 如果都无法提取数字，按名称排序
  return a.name.localeCompare(b.name)
}

