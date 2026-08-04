/**
 * imates-app 题目数据结构化解析与标准化工具
 * 对标 imates-web/src/services/boundary/exercise
 */

export interface StructuredOption {
  id: string;
  content: string;
}

export interface StructuredQuestionContent {
  id?: string;
  subject?: string;
  score?: number;
  type?: string;
  stem?: string;
  analysis?: string;
  options?: StructuredOption[];
  answer?: any;
  blanks?: any[];
  userAnswer?: any;
  boardData?: any;
  draftData?: any;
}

export interface StandardQuestionItem {
  id: string;
  bmNo: string;
  questionId: string;
  title: string;
  question: string;
  questionContent: string;
  answer: string;
  explanation?: string;
  analysisData?: string;
  questionAnalysis?: string;
  questionReason?: string;
  questionChooseInfo?: string;
  questionChooseList?: string[];
  questionStructureData?: string | object;
  type: string;
  structuredContent?: StructuredQuestionContent;
  material?: string;
  subQuestions?: StandardQuestionItem[];
  subject?: string;
}

/** 标准化题目内容，移除常见的前缀标识符并将 [blank_n] 占位符替换为下划线 */
export function normalizeQuestionContent(content?: string): string {
  if (!content) return '';
  let result = content.replace(/^\s*main\s*[:：]\s*/i, '');
  result = result.replace(/^\s*(?:[a-z]+[a-z0-9_]*?)\s*[:：]\s*/gim, '');
  // 将填空题 [blank_1]、[blank_2]、{blank_1}、blank_1 等占位符替换为标准的下划线 ______
  result = result.replace(/(\[blank_\d+\]|\{blank_\d+\}|blank_\d+)/gi, ' ______ ');
  return result;
}

/** 标准化学科编码，对标 imates-web/src/constants/subjects.ts */
export function normalizeSubject(raw?: string): string {
  const str = (raw || '').toString().trim();
  if (!str) return 'math';

  const idMap: Record<string, string> = {
    '1': 'chinese',
    '2': 'math',
    '3': 'english',
    '4': 'physics',
    '5': 'chemistry',
    '6': 'biology',
    '7': 'history',
    '8': 'geography',
    '9': 'politics',
  };
  if (idMap[str]) return idMap[str];

  const upper = str.toUpperCase();
  const noPrefix = upper.startsWith('SUBJECT_') ? upper.slice(8) : upper;

  const subjectsCN: Record<string, string> = {
    '数学': 'math',
    '生物': 'biology',
    '生物学': 'biology',
    '化学': 'chemistry',
    '物理': 'physics',
    '物理学': 'physics',
    '语文': 'chinese',
    '英语': 'english',
    '地理': 'geography',
    '历史': 'history',
    '政治': 'politics',
  };
  if (subjectsCN[noPrefix]) return subjectsCN[noPrefix];

  const baseName = noPrefix.replace(/[学科]$/, '');
  if (subjectsCN[baseName]) return subjectsCN[baseName];

  const lower = str.toLowerCase();
  const allSubs = ['math', 'biology', 'chemistry', 'physics', 'chinese', 'english', 'geography', 'history', 'politics'];
  if (allSubs.includes(lower)) return lower;

  if (noPrefix.includes('MATH')) return 'math';
  if (noPrefix.includes('BIOLOGY')) return 'biology';
  if (noPrefix.includes('CHEMISTRY')) return 'chemistry';
  if (noPrefix.includes('PHYSICS')) return 'physics';
  if (noPrefix.includes('CHINESE')) return 'chinese';
  if (noPrefix.includes('ENGLISH')) return 'english';
  if (noPrefix.includes('GEOGRAPHY')) return 'geography';
  if (noPrefix.includes('HISTORY')) return 'history';
  if (noPrefix.includes('POLITICS')) return 'politics';

  return 'math';
}

/** 映射后端题目类型到前端组件类型 */
export function mapBackendTypeToFrontend(type?: string): string {
  if (!type) return 'subjective';
  const raw = String(type).toLowerCase();
  const map: Record<string, string> = {
    single_choice: 'single_choice',
    multiple_choice: 'multiple_choice',
    choice: 'single_choice',
    true_false: 'true_false',
    judgment: 'true_false',
    fill_in_blank: 'fill_in_blank',
    blank: 'fill_in_blank',
    subjective: 'subjective',
    essay: 'subjective',
    composite: 'composite',
  };
  return map[raw] || 'subjective';
}

/** 解析题目结构化 JSON (questionStructureData) */
export function parseQuestionStructure(jsonStr?: string | object): StructuredQuestionContent | null {
  if (!jsonStr) return null;
  try {
    const raw = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    const q = raw.status === 'success' && raw.question ? raw.question : raw;
    if (!q) return null;

    const options = (q.options || []) as Array<{ id?: string; content?: string; label?: string; text?: string }>;

    return {
      id: q.id || '',
      subject: q.subject || '',
      score: q.score,
      type: q.type || 'subjective',
      stem: q.stem || '',
      analysis: q.analysis || '',
      options: options.map((opt, idx) => ({
        id: opt.id || opt.label || String.fromCharCode(65 + idx),
        content: opt.content || opt.text || '',
      })),
      answer: q.answer,
      blanks: q.blanks,
    };
  } catch (e) {
    console.warn('[ExerciseParser] Failed to parse questionStructureData:', e);
    return null;
  }
}

/** 从 questionStructureData 原始数据中提取复合题字段 */
export function extractCompositeFields(questionStructureData: string | object): {
  material?: string;
  subQuestions?: any[];
} {
  try {
    const raw =
      typeof questionStructureData === 'string'
        ? JSON.parse(questionStructureData)
        : questionStructureData;
    const q = raw.status === 'success' && raw.question ? raw.question : raw;
    return {
      material: q.material,
      subQuestions: Array.isArray(q.subQuestions) ? q.subQuestions : undefined,
    };
  } catch (e) {
    console.warn('[ExerciseParser] Failed to extract composite fields:', e);
    return {};
  }
}

function convertSubQuestionToStandard(
  sub: Record<string, any>,
  parentId: string,
  index: number
): StandardQuestionItem {
  const id = String(sub.id || `${parentId}_sub_${index}`);
  const rawType = String(sub.type || 'subjective');
  const type = mapBackendTypeToFrontend(rawType);

  const structuredContent: StructuredQuestionContent = {
    id,
    type: rawType,
    stem: String(sub.stem || ''),
    analysis: String(sub.analysis || ''),
    options: ((sub.options as Array<Record<string, any>>) || []).map((opt, idx) => ({
      id: String(opt.id || opt.label || String.fromCharCode(65 + idx)),
      content: String(opt.content || opt.text || ''),
    })),
    answer: sub.answer,
    blanks: sub.blanks,
  };

  const item: StandardQuestionItem = {
    id,
    bmNo: `${parentId}.${index + 1}`,
    questionId: id,
    type,
    structuredContent,
    title: String(sub.stem || ''),
    question: String(sub.stem || ''),
    questionContent: String(sub.stem || ''),
    answer: typeof sub.answer === 'boolean' ? (sub.answer ? '对' : '错') : (Array.isArray(sub.answer) ? sub.answer.join(', ') : String(sub.answer ?? '')),
    explanation: String(sub.analysis || ''),
    questionAnalysis: String(sub.analysis || ''),
    material: String(sub.material || ''),
  };

  const nestedSubs = sub.subQuestions;
  if (Array.isArray(nestedSubs) && nestedSubs.length > 0) {
    item.subQuestions = nestedSubs.map((nestedSub, nestedIdx) =>
      convertSubQuestionToStandard(nestedSub, id, nestedIdx)
    );
  }

  return item;
}

/**
 * 核心标准化转换函数：确保传入组件的题目对象包含结构化的 structuredContent, material, subQuestions 等
 */
export function normalizeQuestion(rawQuestion: any, index: number = 0, subject: string = ''): StandardQuestionItem {
  if (!rawQuestion) {
    return {
      id: '',
      bmNo: '1',
      questionId: '',
      title: '',
      question: '',
      questionContent: '',
      answer: '',
      type: 'subjective',
    };
  }

  const qId = String(rawQuestion.questionId || rawQuestion.id || rawQuestion.bmNo || index + 1);
  const bmNo = String(rawQuestion.bmNo || rawQuestion.questionId || rawQuestion.id || index + 1);

  let rawContent = rawQuestion.questionContent || rawQuestion.content || rawQuestion.question || rawQuestion.title || '';
  let normalizedTitle = normalizeQuestionContent(rawContent);

  const cleanAnalysis = (str?: string) => (str && !str.includes('###') ? str : (str || ''));

  const result: StandardQuestionItem = {
    ...rawQuestion,
    id: qId,
    bmNo,
    questionId: qId,
    title: normalizedTitle,
    question: normalizedTitle,
    questionContent: normalizedTitle,
    answer: String(rawQuestion.questionAnswer || rawQuestion.answer || ''),
    explanation: cleanAnalysis(rawQuestion.questionAnalysis || rawQuestion.explanation || rawQuestion.analysisData),
    analysisData: cleanAnalysis(rawQuestion.questionAnalysis || rawQuestion.explanation || rawQuestion.analysisData),
    questionAnalysis: cleanAnalysis(rawQuestion.questionAnalysis || rawQuestion.explanation || rawQuestion.analysisData),
    subject: rawQuestion.subject || subject,
    type: mapBackendTypeToFrontend(rawQuestion.type || rawQuestion.structuredContent?.type),
    structuredContent: rawQuestion.structuredContent,
    material: rawQuestion.material,
    subQuestions: rawQuestion.subQuestions,
  };

  const rawStructure = rawQuestion.questionStructureData || (typeof rawQuestion.structuredContent === 'string' ? rawQuestion.structuredContent : null);

  if (rawStructure) {
    const structured = parseQuestionStructure(rawStructure);
    if (structured) {
      result.structuredContent = {
        ...(result.structuredContent || {}),
        ...structured,
      };
      result.type = mapBackendTypeToFrontend(structured.type || result.type);

      const { material, subQuestions } = extractCompositeFields(rawStructure);
      if (material && !result.material) {
        result.material = material;
      }
      if (Array.isArray(subQuestions) && subQuestions.length > 0) {
        result.subQuestions = subQuestions.map((sub, subIdx) =>
          convertSubQuestionToStandard(sub, qId, subIdx)
        );
      }

      if (structured.stem) {
        const normalizedStem = normalizeQuestionContent(structured.stem);
        result.title = normalizedStem;
        result.question = normalizedStem;
      }

      if (structured.answer !== undefined && structured.answer !== null) {
        if (typeof structured.answer === 'boolean') {
          result.answer = structured.answer ? '对' : '错';
        } else {
          result.answer = Array.isArray(structured.answer)
            ? structured.answer.join(', ')
            : String(structured.answer);
        }
      }

      if (structured.analysis) {
        const clean = cleanAnalysis(structured.analysis);
        result.explanation = clean;
        result.questionAnalysis = clean;
        result.analysisData = clean;
      }
    }
  }

  // 兜底：若未设置 subQuestions 但原对象中含有子题目数组
  if (!result.subQuestions && Array.isArray(rawQuestion.subQuestions)) {
    result.subQuestions = rawQuestion.subQuestions.map((sub: any, subIdx: number) =>
      typeof sub === 'object' && sub.structuredContent
        ? sub
        : convertSubQuestionToStandard(sub, qId, subIdx)
    );
  }

  // 兜底：若类型判断为复合题，但没有结构化 stem 时，将 material 作为材料
  if (result.type === 'composite' || (result.subQuestions && result.subQuestions.length > 0)) {
    result.type = 'composite';
    if (!result.material && rawQuestion.material) {
      result.material = rawQuestion.material;
    }
  }

  return result;
}

export interface HomeworkSubmitItem {
  questionId: string;
  answerData: string[];
  answerList?: string[];
}

export interface IntermediateQuestionAnswer {
  questionId: string;
  type: string;
  answers: any;
  images?: string[];
}

/**
 * 阶段 1：从题目列表提取中间作答结构 (100% 对标 imates-web/src/services/boundary/homework/to-submit.ts prepareHomeworkSubmitAnswers)
 */
export function prepareHomeworkSubmitAnswers(
  questions: any[],
  answersMap: Record<string, any> = {},
  answersImageMap: Record<string, string> = {}
): IntermediateQuestionAnswer[] {
  const result: IntermediateQuestionAnswer[] = [];

  const buildAnswerForQuestion = (q: any, parentUserAns?: any): IntermediateQuestionAnswer | null => {
    if (!q) return null;
    const normalized = normalizeQuestion(q);
    const qId = String(normalized.questionId || normalized.id || q.questionId || q.id || '').trim();
    const type = normalized.type || q.type || 'subjective';

    let currentParentUserAns = parentUserAns;
    if (!currentParentUserAns) {
      const parentAns = answersMap[qId] || answersMap[normalized.bmNo] || answersMap[q.id] || answersMap[q.questionId];
      if (typeof parentAns === 'object' && parentAns !== null) {
        currentParentUserAns = parentAns;
      } else if (typeof parentAns === 'string' && parentAns.trim().startsWith('{')) {
        try {
          currentParentUserAns = JSON.parse(parentAns);
        } catch {
          // ignore
        }
      }
    }

    const subQs = normalized.subQuestions || q.subQuestions || q.structuredContent?.subQuestions;
    if (type === 'composite' || (Array.isArray(subQs) && subQs.length > 0)) {
      const nestedAnswers: IntermediateQuestionAnswer[] = [];
      if (Array.isArray(subQs)) {
        subQs.forEach((subQ) => {
          const subAns = buildAnswerForQuestion(subQ, currentParentUserAns);
          if (subAns) nestedAnswers.push(subAns);
        });
      }
      return {
        questionId: qId,
        type: 'composite',
        answers: nestedAnswers,
      };
    }

    const keysToTry = [qId, normalized.bmNo, q.bmNo, q.id, q.questionId].filter(Boolean);
    let rawTextAns: any = undefined;
    let rawImgAns: string = '';

    for (const key of keysToTry) {
      if (answersMap[key] !== undefined && answersMap[key] !== null && answersMap[key] !== '') {
        rawTextAns = answersMap[key];
        break;
      }
    }

    if ((rawTextAns === undefined || rawTextAns === null || rawTextAns === '') && currentParentUserAns && typeof currentParentUserAns === 'object') {
      for (const key of keysToTry) {
        if (currentParentUserAns[key] !== undefined && currentParentUserAns[key] !== null && currentParentUserAns[key] !== '') {
          rawTextAns = currentParentUserAns[key];
          break;
        }
      }
    }

    for (const key of keysToTry) {
      if (answersImageMap[key]) {
        rawImgAns = answersImageMap[key];
        break;
      }
    }

    if (!rawImgAns && typeof rawTextAns === 'object' && rawTextAns !== null) {
      if (rawTextAns.photoUrl) rawImgAns = rawTextAns.photoUrl;
      else if (rawTextAns.boardImg) rawImgAns = rawTextAns.boardImg;
      else if (rawTextAns.type === 'img' && rawTextAns.content) rawImgAns = rawTextAns.content;
    } else if (!rawImgAns && typeof rawTextAns === 'string' && (rawTextAns.startsWith('http') || rawTextAns.startsWith('file:') || rawTextAns.startsWith('data:image') || rawTextAns.startsWith('blob:'))) {
      rawImgAns = rawTextAns;
    }

    return {
      questionId: qId,
      type,
      answers: rawTextAns !== undefined ? rawTextAns : '',
      images: rawImgAns ? [rawImgAns] : undefined,
    };
  };

  (questions || []).forEach((q) => {
    const ans = buildAnswerForQuestion(q);
    if (ans) result.push(ans);
  });

  return result;
}

function isNeedUploadImage(uri: string): boolean {
  if (typeof uri !== 'string') return false;
  const str = uri.trim();
  if (!str) return false;

  // 已是 http/https 网络 CDN 链接，无需重复上传
  if (str.startsWith('http://') || str.startsWith('https://')) return false;

  // 仅当为真正的本地文件 URI / Data URL / Blob / 相册路径 / 类似临时图片路径时才上传
  const isImage = (
    str.startsWith('file:') ||
    str.startsWith('blob:') ||
    str.startsWith('data:image') ||
    str.startsWith('ph://') ||
    str.startsWith('assets-library://') ||
    str.startsWith('content://') ||
    /\.(png|jpe?g|gif|webp|bmp|heic|svg)(\?.*)?$/i.test(str)
  );

  if (isImage) {
    console.log('[ExerciseParser] 🔍 识别到需要上传的本地图片 URI:', str);
  }
  return isImage;
}

/**
 * 阶段 2：递归上传中间结构中所有本地图片/手写板 URI，并就地替换为 CDN 链接 (100% 对标 imates-web uploadAnswersImages)
 */
export async function uploadAnswersImages(
  questionAnswerList: IntermediateQuestionAnswer[],
  uploadFn: (uri: string) => Promise<string>
): Promise<void> {
  for (const qAns of questionAnswerList) {
    console.log('[ExerciseParser] 📸 uploadAnswersImages 检查题目:', qAns.questionId, 'type:', qAns.type, 'answers:', qAns.answers, 'images:', qAns.images);
    if (qAns.type === 'composite' && Array.isArray(qAns.answers)) {
      await uploadAnswersImages(qAns.answers as IntermediateQuestionAnswer[], uploadFn);
    } else {
      if (qAns.images && Array.isArray(qAns.images)) {
        for (let i = 0; i < qAns.images.length; i++) {
          const imgUri = qAns.images[i];
          if (imgUri && typeof imgUri === 'string' && isNeedUploadImage(imgUri)) {
            console.log('[ExerciseParser] 开始上传图片 (images[' + i + ']):', imgUri);
            const cdnUrl = await uploadFn(imgUri);
            console.log('[ExerciseParser] 图片 (images[' + i + ']) 上传成功 -> CDN:', cdnUrl);
            qAns.images[i] = cdnUrl;
            if (!qAns.answers || qAns.answers === '' || qAns.answers === imgUri) {
              qAns.answers = cdnUrl;
            }
          }
        }
      }
      if (typeof qAns.answers === 'string' && isNeedUploadImage(qAns.answers)) {
        console.log('[ExerciseParser] 开始上传图片 (answers 文本):', qAns.answers);
        const cdnUrl = await uploadFn(qAns.answers);
        console.log('[ExerciseParser] 图片 (answers 文本) 上传成功 -> CDN:', cdnUrl);
        qAns.answers = cdnUrl;
      }
    }
  }
}

/**
 * 阶段 3：将中间结构扁平化为后端 HomeworkSubmitItem 列表 (100% 对标 imates-web flattenHomeworkSubmitAnswers)
 */
export function flattenHomeworkSubmitAnswers(
  list: IntermediateQuestionAnswer[]
): HomeworkSubmitItem[] {
  const result: HomeworkSubmitItem[] = [];

  const traverse = (item: IntermediateQuestionAnswer) => {
    if (item.type === 'composite') {
      if (Array.isArray(item.answers)) {
        item.answers.forEach((subItem) => {
          traverse(subItem as IntermediateQuestionAnswer);
        });
      }
      return;
    }

    let answerData: string[] = [];
    let rawImgAns: string = (item.images && item.images.length > 0) ? item.images[0] : '';

    if (Array.isArray(item.answers)) {
      answerData = item.answers.map((v) => String(v ?? '')).filter((v) => v !== '');
    } else if (typeof item.answers === 'object' && item.answers !== null) {
      const objAns: any = item.answers;
      if (objAns.type === 'img' && objAns.content) {
        if (!rawImgAns) rawImgAns = objAns.content;
      } else if (objAns.content) {
        answerData = [String(objAns.content)];
      } else {
        answerData = Object.values(objAns)
          .map((v: any) => (typeof v === 'object' ? (v?.content || String(v || '')) : String(v || '')))
          .filter((v) => typeof v === 'string' && v.trim().length > 0);
      }
    } else if (item.answers !== undefined && item.answers !== null && item.answers !== '') {
      const strVal = String(item.answers).trim();
      if (strVal.length > 0) {
        if (strVal.startsWith('[') && strVal.endsWith(']')) {
          try {
            const parsed = JSON.parse(strVal);
            if (Array.isArray(parsed)) {
              answerData = parsed.map(String).filter((v) => v !== '');
            } else {
              answerData = [strVal];
            }
          } catch {
            answerData = [strVal];
          }
        } else {
          answerData = [strVal];
        }
      }
    }

    // 对标 imates-web：如果 answerData 为空且存在图片 CDN URL，把 CDN URL 填入 answerData
    if (answerData.length === 0 && rawImgAns && rawImgAns.trim().length > 0) {
      answerData = [rawImgAns.trim()];
    }

    const submitItem: HomeworkSubmitItem = {
      questionId: item.questionId,
      answerData,
    };

    if (rawImgAns && rawImgAns.trim().length > 0) {
      submitItem.answerList = [rawImgAns.trim()];
    }

    result.push(submitItem);
  };

  list.forEach(traverse);
  return result;
}

/**
 * 递归扁平化题目及其子题目作答数据，生成与后端完全一致的 HomeworkSubmitItem 列表
 * 100% 对标 imates-web/src/services/boundary/homework/to-submit.ts flattenHomeworkSubmitAnswers
 */
export function formatHomeworkSubmitAnswers(
  questions: any[],
  answersMap: Record<string, any> = {},
  answersImageMap: Record<string, string> = {}
): HomeworkSubmitItem[] {
  const intermediateList = prepareHomeworkSubmitAnswers(questions, answersMap, answersImageMap);
  return flattenHomeworkSubmitAnswers(intermediateList);
}


/**
 * 判断题目（或包含子题目的复合题）是否被作答
 */
export function isQuestionAnsweredHelper(
  q: any,
  answersMap: Record<string, any> = {},
  answersImageMap: Record<string, string> = {}
): boolean {
  if (!q) return false;
  const normalized = normalizeQuestion(q);
  const subQs = normalized.subQuestions || q.subQuestions || q.structuredContent?.subQuestions;

  if (normalized.type === 'composite' || (Array.isArray(subQs) && subQs.length > 0)) {
    if (Array.isArray(subQs) && subQs.length > 0) {
      return subQs.some((subQ) => isQuestionAnsweredHelper(subQ, answersMap, answersImageMap));
    }
    return false;
  }

  const qId = String(normalized.questionId || normalized.id || q.questionId || q.id || '').trim();
  const keysToTry = [
    qId,
    normalized.bmNo,
    q.bmNo,
    q.id,
    q.questionId,
  ].filter(Boolean);

  for (const key of keysToTry) {
    const textAns = answersMap[key];
    const imgAns = answersImageMap[key];

    if (imgAns && String(imgAns).trim().length > 0) return true;
    if (textAns !== undefined && textAns !== null) {
      if (typeof textAns === 'string' && textAns.trim().length > 0) return true;
      if (Array.isArray(textAns) && textAns.length > 0) return true;
      if (typeof textAns === 'object' && Object.keys(textAns).length > 0) return true;
    }
  }

  return false;
}
