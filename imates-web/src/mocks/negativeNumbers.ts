import type { ExerciseItem } from '@/types'

export interface HomeworkMockData {
  homeworkName: string
  questions: ExerciseItem[]
}

// 课前预习
export const PREVIEW_HOMEWORK: HomeworkMockData = {
  homeworkName: '负数的认识 - 课前预习',
  questions: [
    {
      id: 'pre-1',
      bmNo: 'PRE_MATH_001',
      title: '写出下列温度的负数表示：零上15℃（  ）、零下8℃（  ）',
      type: 'fill',
      structuredContent: {
        stem: '写出下列温度的负数表示：零上15℃（  ）、零下8℃（  ）',
        blanks: 2
      },
      answer: '零上15℃（+15℃或15℃）、零下8℃（-8℃）',
      explanation: '明确温度表示规则，零上温度用正数表示（可加“+”或省略），零下温度用负数表示（必须加“-”），结合生活常识推导答案。',
      analysisData: '明确温度表示规则，零上温度用正数表示（可加“+”或省略），零下温度用负数表示（必须加“-”），结合生活常识推导答案。',
      subject: 'math',
    },
    {
      id: 'pre-2',
      bmNo: 'PRE_MATH_002',
      title: '判断：0是正数（  ）（对/错）',
      type: 'judgment',
      structuredContent: {
        stem: '0是正数',
        judgmentResult: false
      },
      answer: '错',
      explanation: '回忆正数、负数的定义，正数是比0大的数，负数是比0小的数，0是正负数的分界点，据此判断对错。',
      analysisData: '回忆正数、负数的定义，正数是比0大的数，负数是比0小的数，0是正负数的分界点，据此判断对错。',
      subject: 'math',
    },
    {
      id: 'pre-3',
      bmNo: 'PRE_MATH_003',
      title: '判断：负数都比0小（  ）（对/错）',
      type: 'judgment',
      structuredContent: {
        stem: '负数都比0小',
        judgmentResult: true
      },
      answer: '对',
      explanation: '明确负数的核心特征，所有带“-”的负数都小于0，正数大于0，0是两者的分界，结合特征判断。',
      analysisData: '明确负数的核心特征，所有带“-”的负数都小于0，正数大于0，0是两者的分界，结合特征判断。',
      subject: 'math',
    },
    {
      id: 'pre-4',
      bmNo: 'PRE_MATH_004',
      title: '数轴的核心要素有（  ）、（  ）、（  ）',
      type: 'fill',
      structuredContent: {
        stem: '数轴的核心要素有（  ）、（  ）、（  ）',
        blanks: 3
      },
      answer: '原点、正方向、单位长度',
      explanation: '回忆数轴的定义，数轴是表示数的直线，必须具备三个关键要素，缺一不可，分别是原点、方向和单位。',
      analysisData: '回忆数轴的定义，数轴是表示数的直线，必须具备三个关键要素，缺一不可，分别是原点、方向和单位。',
      subject: 'math',
    },
    {
      id: 'pre-5',
      bmNo: 'PRE_MATH_005',
      title: '用负数表示：支出20元（  ）、下降5米（  ）',
      type: 'fill',
      structuredContent: {
        stem: '用负数表示：支出20元（  ）、下降5米（  ）',
        blanks: 2
      },
      answer: '支出20元（-20元）、下降5米（-5米）',
      explanation: '确定相反意义的量，支出对应收入、下降对应上升，通常将收入、上升看作正数，支出、下降看作负数，据此表示。',
      analysisData: '确定相反意义的量，支出对应收入、下降对应上升，通常将收入、上升看作正数，支出、下降看作负数，据此表示。',
      subject: 'math',
    },
    {
      id: 'pre-6',
      bmNo: 'PRE_MATH_006',
      title: '判断：“收入100元”和“支出50元”是相反意义的量（ ）（对/错）',
      type: 'judgment',
      structuredContent: {
        stem: '“收入100元”和“支出50元”是相反意义的量',
        judgmentResult: true
      },
      answer: '对',
      explanation: '相反意义的量需满足“含义相反、单位一致”，收入与支出含义相反，单位均为元，符合相反意义的量的特征。',
      analysisData: '相反意义的量需满足“含义相反、单位一致”，收入与支出含义相反，单位均为元，符合相反意义的量的特征。',
      subject: 'math',
    },
    {
      id: 'pre-7',
      bmNo: 'PRE_MATH_007',
      title: '北斗卫星在太空的温度为零下23℃，用负数表示为（  ），它在数轴上的位置在0的（  ）边',
      type: 'fill',
      structuredContent: {
        stem: '北斗卫星在太空的温度为零下23℃，用负数表示为（  ），它在数轴上的位置在0的（  ）边',
        blanks: 2
      },
      answer: '北斗卫星在太空的温度为零下23℃，用负数表示为（-23℃），它在数轴上的位置在0的（左）边',
      explanation: '结合题目1的温度表示规则，零下温度用负数表示；再根据数轴规律，负数在0的左边，正数在0的右边，推导答案。',
      analysisData: '结合题目1的温度表示规则，零下温度用负数表示；再根据数轴规律，负数在0的左边，正数在0的右边，推导答案。',
      subject: 'math',
    },
    {
      id: 'pre-8',
      bmNo: 'PRE_MATH_008',
      title: '简单画出一条数轴，标注出0和-3的位置',
      type: 'essay',
      structuredContent: {
        stem: '简单画出一条数轴，标注出0和-3的位置'
      },
      answer: '画一条水平直线，标注原点0，向右画箭头（正方向），每格代表1个单位长度，在0左边第3格的位置标注-3（按此标准绘制即可）。',
      explanation: '先画一条水平直线，依次标注数轴三要素（原点0、向右的正方向、统一的单位长度），再根据“负数在0的左边”，从原点向左数3个单位长度标注-3。',
      analysisData: '先画一条水平直线，依次标注数轴三要素（原点0、向右的正方向、统一的单位长度），再根据“负数在0的左边”，从原点向左数3个单位长度标注-3。',
      subject: 'math',
    },
  ],
}

// 核心探究
export const CORE_EXPLORATION: ExerciseItem[] = [
  {
    id: 'core-1',
    bmNo: 'CORE_MATH_001',
    title: '0为什么既不是正数也不是负数？',
    type: 'essay',
    structuredContent: {
      stem: '0为什么既不是正数也不是负数？'
    },
    answer: '0是正负数的分界点',
    explanation: '0既不是正数也不是负数，是正负数的分界点',
    analysisData: '0既不是正数也不是负数，是正负数的分界点',
    subject: 'math',
  },
  {
    id: 'core-2',
    bmNo: 'CORE_MATH_002',
    title: '负数和相反意义的量有什么区别？',
    type: 'essay',
    structuredContent: {
      stem: '负数和相反意义的量有什么区别？'
    },
    answer: '负数是小于0的数，相反意义的量是含义相反的量',
    explanation: '负数是小于0的数，相反意义的量是含义相反的量',
    analysisData: '负数是小于0的数，相反意义的量是含义相反的量',
    subject: 'math',
  },
  {
    id: 'core-3',
    bmNo: 'CORE_MATH_003',
    title: '怎样规范标记表示温度的直线（数轴），它有哪些核心要素？',
    type: 'essay',
    structuredContent: {
      stem: '怎样规范标记表示温度的直线（数轴），它有哪些核心要素？'
    },
    answer: '数轴的核心要素有原点、正方向、单位长度',
    explanation: '数轴的核心要素有原点、正方向、单位长度',
    analysisData: '数轴的核心要素有原点、正方向、单位长度',
    subject: 'math',
  },
  {
    id: 'core-4',
    bmNo: 'CORE_MATH_004',
    title: '观察数轴上的数，左边和右边的数在大小上有什么简单规律（不深入比较大小）？',
    type: 'essay',
    structuredContent: {
      stem: '观察数轴上的数，左边和右边的数在大小上有什么简单规律（不深入比较大小）？'
    },
    answer: '左边的数小于右边的数',
    explanation: '左边的数小于右边的数',
    analysisData: '左边的数小于右边的数',
    subject: 'math',
  },
]

// 课堂练习
export const CLASSROOM_EXERCISE: HomeworkMockData = {
  homeworkName: '负数的认识 - 课堂练习',
  questions: [
    // 基础题 (5道) - 选择/判断
    {
      id: 'exe-base-sel-1',
      bmNo: 'EXE_BASE_SEL_001',
      title: '【基础题】下列说法正确的是（ ）',
      type: 'choice',
      structuredContent: {
        stem: '下列说法正确的是',
        options: [
          { label: 'A', text: '0是正数' },
          { label: 'B', text: '0 is 负数' },
          { label: 'C', text: '0是正负数的分界点' },
          { label: 'D', text: '负数比正数大' }
        ]
      },
      answer: 'C',
      explanation: '0既不是正数也不是负数，是分界点，负数比正数小。',
      analysisData: '0既不是正数也不是负数，是分界点，负数比正数小。',
      subject: 'math',
    },
    {
      id: 'exe-base-sel-2',
      bmNo: 'EXE_BASE_SEL_002',
      title: '【基础题】下列数中，不是负数的是（ ）',
      type: 'choice',
      structuredContent: {
        stem: '下列数中，不是负数的是',
        options: [
          { label: 'A', text: '-3' },
          { label: 'B', text: '-1.5' },
          { label: 'C', text: '0' },
          { label: 'D', text: '-0.8' }
        ]
      },
      answer: 'C',
      explanation: '负数必须带有负号且不为0。0既不是正数也不是负数。',
      analysisData: '负数必须带有负号且不为0。0既不是正数也不是负数。',
      subject: 'math',
    },
    {
      id: 'exe-base-jud-1',
      bmNo: 'EXE_BASE_JUD_001',
      title: '【基础题】0是负数。（ ）',
      type: 'judgment',
      structuredContent: {
        stem: '0是负数',
        judgmentResult: false
      },
      answer: '×',
      explanation: '0是正负数的分界点，既不是正数也不是负数趋势。',
      analysisData: '0是正负数的分界点，既不是正数也不是负数趋势。',
      subject: 'math',
    },
    {
      id: 'exe-base-jud-2',
      bmNo: 'EXE_BASE_JUD_002',
      title: '【基础题】负数都比0小。（ ）',
      type: 'judgment',
      structuredContent: {
        stem: '负数都比0小',
        judgmentResult: true
      },
      answer: '√',
      explanation: '根据负数的定义，所有负数都小于0。',
      analysisData: '根据负数的定义，所有负数都小于0。',
      subject: 'math',
    },
    {
      id: 'exe-base-sel-3',
      bmNo: 'EXE_BASE_SEL_003',
      title: '【基础题】数轴上，正方向通常约定为（ ）',
      type: 'choice',
      structuredContent: {
        stem: '数轴上，正方向通常约定为',
        options: [
          { label: 'A', text: '向左' },
          { label: 'B', text: '向右' },
          { label: 'C', text: '向上' },
          { label: 'D', text: '向下' }
        ]
      },
      answer: 'B',
      explanation: '在水平数轴上，通常约定向右的方向为正方向。',
      analysisData: '在水平数轴上，通常约定向右的方向为正方向。',
      subject: 'math',
    },

    // 提升题 (3道) - 选择/判断
    {
      id: 'exe-adv-sel-1',
      bmNo: 'EXE_ADV_SEL_001',
      title: '【提升题】下列各组中，属于相反意义的量的是（ ）',
      type: 'choice',
      structuredContent: {
        stem: '下列各组中，属于相反意义的量的是',
        options: [
          { label: 'A', text: '收入100元和支出100元' },
          { label: 'B', text: '身高180cm和体重60kg' },
          { label: 'C', text: '向东走5米和向北走5米' },
          { label: 'D', text: '盈利200元和亏损-200元' }
        ]
      },
      answer: 'A',
      explanation: '相反意义的量需要单位一致且含义相反。收入和支出是典型的相反意义。',
      analysisData: '相反意义的量需要单位一致且含义相反。收入和支出是典型的相反意义。',
      subject: 'math',
    },
    {
      id: 'exe-adv-sel-2',
      bmNo: 'EXE_ADV_SEL_002',
      title: '【提升题】在数轴上，-2和1之间的整数有（ ）个',
      type: 'choice',
      structuredContent: {
        stem: '在数轴上，-2和1之间的整数有',
        options: [
          { label: 'A', text: '1' },
          { label: 'B', text: '2' },
          { label: 'C', text: '3' },
          { label: 'D', text: '4' }
        ]
      },
      answer: 'B',
      explanation: '-2和1之间的整数有-1和0，共2个。',
      analysisData: '-2和1之间的整数有-1和0，共2个。',
      subject: 'math',
    },
    {
      id: 'exe-adv-jud-1',
      bmNo: 'EXE_ADV_JUD_001',
      title: '【提升题】相反意义的量必须用正数和负数表示。（ ）',
      type: 'judgment',
      structuredContent: {
        stem: '相反意义的量必须用正数和负数表示',
        judgmentResult: false
      },
      answer: '×',
      explanation: '相反意义的量可以用正负数表示，也可以用文字描述，并非必须。',
      analysisData: '相反意义的量可以用正负数表示，也可以用文字描述，并非必须。',
      subject: 'math',
    },

    // 拓展题 (2道) - 选择/判断
    {
      id: 'exe-ext-sel-1',
      bmNo: 'EXE_EXT_SEL_001',
      title: '【拓展题】关于数轴的画法，下列说法正确的是（ ）',
      type: 'choice',
      structuredContent: {
        stem: '关于数轴的画法，下列说法正确的是',
        options: [
          { label: 'A', text: '只要有原点即可' },
          { label: 'B', text: '只要有正方向即可' },
          { label: 'C', text: '必须具备原点、正方向和单位长度' },
          { label: 'D', text: '单位长度可以不统一' }
        ]
      },
      answer: 'C',
      explanation: '数轴三要素：原点、正方向、单位长度，缺一不可。',
      analysisData: '数轴三要素：原点、正方向、单位长度，缺一不可。',
      subject: 'math',
    },
    {
      id: 'exe-ext-jud-1',
      bmNo: 'EXE_EXT_JUD_001',
      title: '【拓展题】在数轴上，离原点越远的数绝对值越大。（ ）',
      type: 'judgment',
      structuredContent: {
        stem: '在数轴上，离原点越远的数绝对值越大',
        judgmentResult: true
      },
      answer: '√',
      explanation: '数轴上点到原点的距离即为该数的绝对值，因此离原点越远，绝对值越大。',
      analysisData: '数轴上点到原点的距离即为该数的绝对值，因此离原点越远，绝对值越大。',
      subject: 'math',
    }
  ],
}

// 别名兼容，供外部使用
export const EXERCISE_HOMEWORK = CLASSROOM_EXERCISE

// 课后作业
export const POST_SCHOOL_HOMEWORK: HomeworkMockData = {
  homeworkName: '负数的认识 - 课后作业',
  questions: [
    // 基础层 - 读写负数
    {
      id: 'post-base-read-1',
      bmNo: 'POST_BASE_READ_001',
      title: '【基础层-读写负数】读出下列负数：-5（ ）、-12.8（ ）、+9（ ）、-3/5（ ）',
      type: 'fill',
      structuredContent: {
        stem: '读出下列负数：-5（ ）、-12.8（ ）、+9（ ）、-3/5（ ）',
        blanks: 4
      },
      answer: '-5（负五）、-12.8（负十二点八）、+9（正九）、-3/5（负五分之三）',
      explanation: '遵循正负数读写规则，“-”读作“负”，“+”读作“正”，数字（含小数、分数）正常读取，正数的“+”可省略不读；',
      analysisData: '遵循正负数读写规则，“-”读作“负”，“+”读作“正”，数字（含小数、分数）正常读取，正数的“+”可省略不读；',
      subject: 'math',
    },
    {
      id: 'post-base-read-2',
      bmNo: 'POST_BASE_READ_002',
      title: '【基础层-读写负数】写出下列描述对应的负数/正数：零上12℃（ ）、零下7℃（ ）、支出45元（ ）、收入30元（ ）',
      type: 'fill',
      structuredContent: {
        stem: '写出下列描述对应的负数/正数：零上12℃（ ）、零下7℃（ ）、支出45元（ ）、收入30元（ ）',
        blanks: 4
      },
      answer: '零上12℃（12℃或+12℃）、零下7℃（-7℃）、支出45元（-45元）、收入30元（30元或+30元）',
      explanation: '零上、收入对应正数，零下、支出对应负数，正数可加“+”或省略，负数必须加“-”；',
      analysisData: '零上、收入对应正数，零下、支出对应负数，正数可加“+”或省略，负数必须加“-”；',
      subject: 'math',
    },
    {
      id: 'post-base-read-3',
      bmNo: 'POST_BASE_READ_003',
      title: '【基础层-读写负数】读出数轴上标注的数：（数轴提示：原点0，正方向向右，单位长度1，标注数：-4、+2、-1.5、0），分别读出这四个数',
      type: 'fill',
      structuredContent: {
        stem: '读出数轴上标注的数：（数轴提示：原点0，正方向向右，单位长度1，标注数：-4、+2、-1.5、0），分别读出这四个数',
        blanks: 4
      },
      answer: '-4（负四）、+2（正二）、-1.5（负一点五）、0（零）',
      explanation: '结合数轴“左负右正”规律，先判断数的正负，再按正负数读写规则读取，0读作“零”；',
      analysisData: '结合数轴“左负右正”规律，先判断数的正负，再按正负数读写规则读取，0读作“零”；',
      subject: 'math',
    },
    // 基础层 - 判断题
    {
      id: 'post-base-jud-1',
      bmNo: 'POST_BASE_JUD_001',
      title: '【基础层-判断题】0既不是正数，也不是负数，是正负数的分界点。（ ）',
      type: 'judgment',
      structuredContent: {
        stem: '0既不是正数，也不是负数，是正负数的分界点',
        judgmentResult: true
      },
      answer: '√',
      explanation: '回顾课堂小结，明确0的归属，既不大于0也不小于0，不属于正数或负数，是两者的分界；',
      analysisData: '回顾课堂小结，明确0的归属，既不大于0也不小于0，不属于正数或负数，是两者的分界；',
      subject: 'math',
    },
    {
      id: 'post-base-jud-2',
      bmNo: 'POST_BASE_JUD_002',
      title: '【基础层-判断题】数轴只要有原点 和 单位长度，就可以规范表示数。（ ）',
      type: 'judgment',
      structuredContent: {
        stem: '数轴只要有原点 和 单位长度，就可以规范表示数',
        judgmentResult: false
      },
      answer: '×',
      explanation: '数轴三要素（原点、正方向、单位长度）缺一不可，缺少任何一个都无法规范表示数，结合课堂小结要点判断；',
      analysisData: '数轴三要素（原点、正方向、单位长度）缺一不可，缺少任何一个都无法规范表示数，结合课堂小结要点判断；',
      subject: 'math',
    },
    {
      id: 'post-base-jud-3',
      bmNo: 'POST_BASE_JUD_003',
      title: '【基础层-判断题】-10读作负十，+6读作正六，正数的“+”不能省略。（ ）',
      type: 'judgment',
      structuredContent: {
        stem: '-10读作负十，+6读作正六，正数的“+”不能省略',
        judgmentResult: false
      },
      answer: '×',
      explanation: '正数的“+”可以省略不读、不写，负数的“-”必须保留，据此判断；',
      analysisData: '正数的“+”可以省略不读、不写，负数的“-”必须保留，据此判断；',
      subject: 'math',
    },
    // 基础层 - 规范画数轴
    {
      id: 'post-base-draw-1',
      bmNo: 'POST_BASE_DRAW_001',
      title: '【基础层-规范画数轴】画一条规范的数轴，标注出原点、正方向、单位长度（单位长度为1）',
      type: 'essay',
      structuredContent: {
        stem: '画一条规范的数轴，标注出原点、正方向、单位长度（单位长度为1）'
      },
      answer: '画一条水平直线，标注原点0，向右画箭头（正方向），依次标注1、2、-1、-2等，单位长度统一为1（按此标准绘制即可）。',
      explanation: '按照课堂所学，先画水平直线，标注原点0，向右画箭头表示正方向，每格标注1个单位长度，确保三要素齐全、规范；',
      analysisData: '按照课堂所学，先画水平直线，标注原点0，向右画箭头表示正方向，每格标注1个单位长度，确保三要素齐全、规范；',
      subject: 'math',
    },
    {
      id: 'post-base-draw-2',
      bmNo: 'POST_BASE_DRAW_002',
      title: '【基础层-规范画数轴】画一条数轴，标注出0、-2、+3三个数的位置',
      type: 'essay',
      structuredContent: {
        stem: '画一条数轴，标注出0、-2、+3三个数的位置'
      },
      answer: '先画规范数轴（含三要素），在0左边第2格标注-2，0右边第3格标注+3，单位长度统一。',
      explanation: '先规范画出数轴三要素，再根据“左负右正”规律，原点左边标注负数（-2在0左边2个单位），右边标注正数（+3在0右边3个单位）；',
      analysisData: '先规范画出数轴三要素，再根据“左负右正”规律，原点左边标注负数（-2在0左边2个单位），右边标注正数（+3在0右边3个单位）；',
      subject: 'math',
    },
    // 提升层 - 举例说明
    {
      id: 'post-adv-ex-1',
      bmNo: 'POST_ADV_EX_001',
      title: '【提升层-举例说明】请写出3组成对的相反意义的量，并用正数、负数分别表示出来',
      type: 'essay',
      structuredContent: {
        stem: '请写出3组成对的相反意义的量，并用正数、负数分别表示出来'
      },
      answer: '示例1：上升5米（+5米）和下降3米（-3米）；示例2：盈利200元（+200元）和亏损80元（-80元）；示例3：向东走10米（+10米）和向西走6米（-6米）（答案不唯一，符合要求即可）',
      explanation: '结合课堂所学，相反意义的量需满足“含义相反、单位一致”，成对出现，正数表示其中一种量，负数表示另一种相反的量；',
      analysisData: '结合课堂所学，相反意义的量需满足“含义相反、单位一致”，成对出现，正数表示其中一种量，负数表示另一种相反的量；',
      subject: 'math',
    },
    {
      id: 'post-adv-ex-2',
      bmNo: 'POST_ADV_EX_002',
      title: '【提升层-举例说明】判断下列各组是否为相反意义的量，说明理由：（1）身高170cm 和 身高160cm；（2）收入500元 和 支出200元',
      type: 'essay',
      structuredContent: {
        stem: '判断下列各组是否为相反意义的量，说明理由：（1）身高170cm 和 身高160cm；（2）收入500元 和 支出200元'
      },
      answer: '（1）不是，理由：两组量均为身高，含义相同，只是数值不同，不构成相反意义；（2）是，理由：收入与支出含义相反，单位均为元，成对出现，符合相反意义的量的特征。',
      explanation: '相反意义的量核心是“含义相反”，而非数值不同，结合定义逐一分析两组量的含义；',
      analysisData: '相反意义的量核心是“含义相反”，而非数值不同，结合定义逐一分析两组量的含义；',
      subject: 'math',
    },
    // 提升层 - 数轴表示
    {
      id: 'post-adv-axis-1',
      bmNo: 'POST_ADV_AXIS_001',
      title: '【提升层-数轴表示】画一条数轴，标注出-4、-1、0、+1、+5五个数的位置',
      type: 'essay',
      structuredContent: {
        stem: '画一条数轴，标注出-4、-1、0、+1、+5五个数的位置'
      },
      answer: '数轴三要素齐全，-4在0左边4个单位，-1在0左边1个单位，0在原点，+1在0右边1个单位，+5在0右边5个单位，单位长度统一。',
      explanation: '先规范绘制数轴（含三要素），根据“左负右正”规律，负数在原点左边，正数在原点右边，按单位长度确定各数位置；',
      analysisData: '先规范绘制数轴（含三要素），根据“左负右正”规律，负数在原点左边，正数在原点右边，按单位长度确定各数位置；',
      subject: 'math',
    },
    {
      id: 'post-adv-axis-2',
      bmNo: 'POST_ADV_AXIS_002',
      title: '【提升层-数轴表示】写出数轴上A、B、C、D四个点表示的数（数轴提示：原点0，正方向向右，单位长度1，A在0左边3个单位，B在0左边1个单位，C在0右边2个单位，D在0右边4个单位）',
      type: 'fill',
      structuredContent: {
        stem: '写出数轴上A、B、C、D四个点表示的数（数轴提示：原点0，正方向向右，单位长度1，A在0左边3个单位，B在0左边1个单位，C在0右边2个单位，D在0右边4个单位）',
        blanks: 4
      },
      answer: 'A（-3）、B（-1）、C（+2）、D（+4）',
      explanation: '结合“左负右正”规律，原点左边的点表示负数，右边表示正数，数出各点距离原点的单位长度，确定对应数值；',
      analysisData: '结合“左负右正”规律，原点左边的点表示负数，右边表示正数，数出各点距离原点的单位长度，确定对应数值；',
      subject: 'math',
    },
    {
      id: 'post-adv-axis-3',
      bmNo: 'POST_ADV_AXIS_003',
      title: '【提升层-数轴表示】在数轴上找出表示-2.5 和 +1.5的位置，标注清楚并说明理由',
      type: 'essay',
      structuredContent: {
        stem: '在数轴上找出表示-2.5 和 +1.5的位置，标注清楚并说明理由'
      },
      answer: '数轴三要素齐全，在0左边2格半（2.5个单位）处标注-2.5，在0右边1格半（1.5个单位）处标注+1.5，理由：负数在原点左边，正数在原点右边，小数按单位长度拆分标注。',
      explanation: '先画规范数轴，-2.5是负数，在0左边2.5个单位长度处；+1.5是正数，在0右边1.5个单位长度处，明确小数在数轴上的表示方法；',
      analysisData: '先画规范数轴，-2.5是负数，在0左边2.5个单位长度处；+1.5是正数，在0右边1.5个单位长度处，明确小数在数轴上的表示方法；',
      subject: 'math',
    },
    // 拓展层 - 搜集案例
    {
      id: 'post-ext-case-1',
      bmNo: 'POST_EXT_CASE_001',
      title: '【拓展层-搜集案例】搜集3个生活或科技中负数的应用案例，简要描述案例内容，并说明负数表示的含义',
      type: 'essay',
      structuredContent: {
        stem: '搜集3个生活或科技中负数的应用案例，简要描述案例内容，并说明负数表示的含义'
      },
      answer: '示例1：天气预报中，哈尔滨冬季气温为-15℃，表示零下15℃，比0℃低15℃；示例2：海平面以下100米，记作-100米，表示低于海平面100米；示例3：北斗卫星在太空运行时，某时段温度为-180℃，表示零下180℃，是卫星运行的低温环境（答案不唯一，贴合负数含义即可）',
      explanation: '结合课堂所学负数的意义，从生活（温度、收支、海拔等）、科技（卫星温度、海拔等）中搜集案例，明确负数在案例中的具体含义；',
      analysisData: '结合课堂所学负数的意义，从生活（温度、收支、海拔等）、科技（卫星温度、海拔等）中搜集案例，明确负数在案例中的具体含义；',
      subject: 'math',
    },
    // 拓展层 - 综合应用
    {
      id: 'post-ext-app-1',
      bmNo: 'POST_EXT_APP_001',
      title: '【拓展层-综合应用】北斗卫星在太空运行时，某时段温度分别为：零下190℃、0℃、零下210℃、零上5℃，用负数/正数表示这四个温度',
      type: 'fill',
      structuredContent: {
        stem: '北斗卫星在太空运行时，某时段温度分别为：零下190℃、0℃、零下210℃、零上5℃，用负数/正数表示这四个温度',
        blanks: 4
      },
      answer: '零下190℃（-190℃）、0℃（0℃）、零下210℃（-210℃）、零上5℃（+5℃或5℃）',
      explanation: '零下温度用负数表示，零上温度用正数表示，0既不是正数也不是负数，结合温度表示规则推导；',
      analysisData: '零下温度用负数表示，零上温度用正数表示，0既不是正数也不是负数，结合温度表示规则推导；',
      subject: 'math',
    },
    {
      id: 'post-ext-app-2',
      bmNo: 'POST_EXT_APP_002',
      title: '【拓展层-综合应用】把上题中四个温度对应的数，标注 in 同一条数轴上（单位长度为50℃）',
      type: 'essay',
      structuredContent: {
        stem: '把上题中四个温度对应的数，标注在同一条数轴上（单位长度为50℃）'
      },
      answer: '画一条水平直线，标注原点0（表示0℃），向右画箭头（正方向），向左为负方向，每格代表50℃，依次标注-200、-150、0、50等刻度，在-190℃（接近-200℃）、0℃、-210℃（接近-200℃左侧）、+5℃（接近0℃右侧）位置标注对应温度及数值。',
      explanation: '先确定数轴三要素，原点0表示0℃，正方向向右（表示零上温度），负方向向左（表示零下温度），单位长度为50℃，按数值大小确定各温度在数轴上的位置；',
      analysisData: '先确定数轴三要素，原点0表示0℃，正方向向右（表示零上温度），负方向向左（表示零下温度），单位长度为50℃，按数值大小确定各温度在数轴上的位置；',
      subject: 'math',
    },
    {
      id: 'post-ext-app-3',
      bmNo: 'POST_EXT_APP_003',
      title: '【拓展层-综合应用】结合数轴上标注的北斗卫星温度数据，简要说明“左小右大”的规律（不深入比较大小）',
      type: 'essay',
      structuredContent: {
        stem: '结合数轴上标注的北斗卫星温度数据，简要说明“左小右大”的规律（不深入比较大小）'
      },
      answer: '观察数轴可知，-210℃（对应数-210）在最左边，其次是-190℃（对应数-190），然后是0℃（对应数0），最右边是+5℃（对应数+5），体现了“左小右大”的规律，即数轴上左边的数比右边的数小。',
      explanation: '观察数轴上各温度对应的数的位置，左边的数（负数）均小于右边的数（0或正数），结合课堂渗透的“左小右大”规律简要说明；',
      analysisData: '观察数轴上各温度对应的数的位置，左边的数（负数）均小于右边的数（0或正数），结合课堂渗透的“左小右大”规律简要说明；',
      subject: 'math',
    },
  ],
}
