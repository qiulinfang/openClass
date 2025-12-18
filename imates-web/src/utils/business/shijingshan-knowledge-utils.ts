/**
 * 石景山学校知识点查询特殊业务逻辑
 *
 * 业务背景：
 * - textbookId为342839470708592640的章节结构包含342841755937378304和342841783456206848这两本书的章节结构
 * - 当342839470708592640这本书中知识图谱去练习时，如果342841755937378304和342841783456206848中有名字相同的节点，
 *   使用342841755937378304和342841783456206848中的知识点的id
 */

import { apiService } from '../../services/http/api-service'
import type { ChapterNode } from '../../types'

/**
 * 石景山学校的特殊textbookId
 */
const SHIJINGSHAN_TEXTBOOK_ID = '342839470708592640'

/**
 * 石景山学校包含的其他两本书的textbookId
 */
const SHIJINGSHAN_RELATED_TEXTBOOK_IDS = ['482719563849102837', '729384610293847561']

/**
 * 持久化存储的键名
 */
const TEXTBOOK_STRUCTURE_STORAGE_KEY_PREFIX = 'knowledge_graph_chapter_structure_'
const MAPPING_INITIALIZED_KEY = 'SHIJINGSHAN_MAPPING_INITIALIZED'
const MERGED_DATA_STORAGE_KEY = 'SHIJINGSHAN_MERGED_FLATTEN_DATA'

/**
 * 硬编码的知识点映射数据
 * 第一个数组包含 nodeId, nodeName, knowledge 等字段
 */
const HARDCODED_KNOWLEDGE_MAPPING = [
  [
    {
      nodeId: '342839812707946496',
      nodeName: '【专题一】 隐圆与最值专题训练',
      bmNoList:
        '7136,7137,7138,7139,7140,7141,7142,7143,7144,7145,7146,7147,7148,7149,7150,7151,7152,7153,7154,7155',
      id: '342839812707946496',
      name: '【专题一】 隐圆与最值专题训练',
    },
    {
      nodeId: '342840516679929856',
      nodeName: '【专题二】辅助圆模型及应用',
      bmNoList:
        '7202,7203,7204,7205,7206,7207,7208,7209,7210,7211,7212,7213,7214,7215,7216,7217,7218,7219,7220,7221,7222,7223',
      id: '342840516679929856',
      name: '【专题二】辅助圆模型及应用',
    },
    {
      nodeId: '342840656350253056',
      nodeName: '【专题三】主从联动模型及应用',
      bmNoList: '7224,7225,7226,7227,7228,7229,7230,7231,7232,7233,7234,7235',
      id: '342840656350253056',
      name: '【专题三】主从联动模型及应用',
    },
    {
      nodeId: '342840699467698176',
      nodeName: '【专题四】圆综专题突破',
      bmNoList: '7156,7157,7158,7159,7160,7161',
      id: '342840699467698176',
      name: '【专题四】圆综专题突破',
    },
    {
      nodeId: '342840735366746112',
      nodeName: '【专题五】代数综合',
      bmNoList:
        '7162,7163,7164,7165,7166,7167,7168,7169,7170,7171,7172,7173,7174,7175,7176,7177,7178,7179,7180,7181,7182,7183,7184,7185,7186,7187,7188,7189,7190,7191,7192,7193,7194,7195,7196,7197,7198,7199,7200,7201',
      id: '342840735366746112',
      name: '【专题五】代数综合',
    },
    {
      nodeId: '342840772616359936',
      nodeName: '【专题六】几何综合',
      bmNoList:
        '7235,7236,7237,7238,7239,7240,7241,7242,7243,7244,7245,7246,7247,7248,7249,7250,7251,7252,7253,7254,7255,7256,7257,7258,7259,7260,7261,7262,7263,7264,7265,7266,7267,7268,7269,7270,7271',
      id: '342840772616359936',
      name: '【专题六】几何综合',
    },
    {
      nodeId: '342840814391627776',
      nodeName: '【专题七】新定义专题',
      bmNoList:
        '7272,7273,7274,7275,7276,7277,7278,7279,7280,7281,7282,7283,7284,7285,7286,7287,7288,7289,7290,7291,7292,7293,7294,7295,7296,7297,7298,7299,7300,7301,7302',
      id: '342840814391627776',
      name: '【专题七】新定义专题',
    },
    {
      nodeId: 'c33c917c-89d4-48be-802d-568c3a97c277',
      nodeName: '1.1.1 集合及其表示方法',
      knowledge:
        '1942495553952468996,1942495553952468994,1942495554015383555,1942495553826639874,1942495553952468998,1942495553889554437,1942495554015383553,1942495552635457538,1942495553952468995,1942495553889554434,1942495553889554436,1942495554015383554,1942495554015383556,1942495553889554435,1942495553952468997,1942495554015383557',
      id: '342842183076909056',
      name: '1.1.1 集合及其表示方法',
    },
    {
      nodeId: '6c3c31bc-d453-4fcd-8f05-01de68830ad1',
      nodeName: '1.1.2 集合的基本关系',
      knowledge:
        '1942495777605332994,1942495777538224129,1942495777668247554,1942495777605332997,1942495777605332995,1942495777668247555,1942495777605332996,1942495775860502530,1942495777538224131,1942495777538224130',
      id: '342842787643887616',
      name: '1.1.2 集合的基本关系',
    },
    {
      nodeId: 'fa156eb3-694d-47b0-8647-39c7abeeb022',
      nodeName: '1.1.3 集合的基本运算',
      knowledge:
        '1942495952851763202,1942495952851763204,1942495952788848644,1942495952721739781,1942495952788848643,1942495952721739779,1942495950800748546,1942495952788848641,1942495952721739778,1942495952788848642,1942495952851763201,1942495952721739780,1942495952851763203',
      id: '342842824281133056',
      name: '1.1.3 集合的基本运算（一）',
    },
    {
      nodeId: '8297454f-e573-4cf9-80fa-52befecf22bc',
      nodeName: '1.2.1 命题与量词',
      knowledge: '1942496302778347521,1942496301260009473,1942496302841262083,1942496302841262082',
      id: '342843222924562432',
      name: '1.2.1 命题与量词',
    },
    {
      nodeId: 'a4e35797-2bfc-4f10-8924-d28d982ae97a',
      nodeName: '1.2.2 全称量词命题与存在量词命题的否定',
      knowledge:
        '1942496502670442499,1942496502733357059,1942496502670442500,1942496502670442497,1942496501252767745,1942496502733357060,1942496502670442501,1942496502733357061,1942496502733357062,1942496502733357058,1942496502670442498',
      id: '342843253144522752',
      name: '1.2.2 全称量词命题与存在量词命题的否定',
    },
    {
      nodeId: '932e3125-0c67-4c18-99ce-58d4557351e9',
      nodeName: '1.2.3 充分条件、必要条件',
      knowledge:
        '1942496739468263429,1942496739405348866,1942496738130280450,1942496739468263426,1942496739468263428,1942496739405348865,1942496739468263427,1942496739468263430',
      id: '342843283490312192',
      name: '1.2.3 充分条件、必要条件',
    },
    {
      nodeId: '4dac13d6-b2ad-4289-8fb7-58250936dcfb',
      nodeName: '2.1.1 等式的性质与方程的解集',
      knowledge:
        '1942497161348165635,1942497161348165633,1942497161411080193,1942497161348165634,1942497161348165636,1942497160106651649',
      id: '342843554442350592',
      name: '2.1.1 等式的性质与方程的解集',
    },
    {
      nodeId: '2e6909eb-8329-4b0e-a82d-f12d78a40b92',
      nodeName: '2.1.2 一元二次方程的解集及其根与系数的关系',
      knowledge:
        '1942497531541671941,1942497531671695362,1942497531734609922,1942497531604586499,1942497531541671938,1942497531604586501,1942497531541671939,1942497531604586500,1942497531671695364,1942497531671695365,1942497531734609921,1942497529507434498,1942497531604586502,1942497531478757377,1942497531604586498,1942497531671695363,1942497531541671940',
      id: '342843606116175872',
      name: '2.1.2 一元二次方程的解集及其根与系数的关系',
    },
    {
      nodeId: '369d470f-500d-400e-80bb-f501e5eb2e9c',
      nodeName: '2.1.3 方程组的解集',
      knowledge: '1942505191452209154',
      id: '342843640845012992',
      name: '2.1.3 方程组的解集',
    },
    {
      nodeId: '4d4ef18b-f1e3-48ce-9392-660636ada25a',
      nodeName: '2.2.1 不等式及其性质',
      knowledge:
        '1942499081483837442,1942499081483837441,1942499081416728579,1942499081416728578,1942499081483837443,1942499080007442434',
      id: '342843832273047552',
      name: '2.2.1 不等式及其性质',
    },
    {
      nodeId: '608bc66b-ea83-4d3c-8a8d-867e05dda362',
      nodeName: '2.2.2 不等式的解集',
      knowledge:
        '1942499293417762818,1942499294910935043,1942499294843826178,1942499294910935045,1942499294978043906,1942499294978043907,1942499294843826177,1942499294910935046,1942499294776717313,1942499294843826179,1942499294910935042,1942499294910935044',
      id: '342843870105669632',
      name: '2.2.2 不等式的解集', 
    },
    {
      nodeId: '0df7e8ff-9c28-4a4c-bf33-3aea202fc811',
      nodeName: '2.2.3 一元二次不等式的解法',
      knowledge:
        '1942499475500916737,1942499475563831299,1942499475500916739,1942499473777057793,1942499475500916738,1942499475626745857,1942499475370893315,1942499475433807875,1942499475563831300,1942499475626745858,1942499475433807874,1942499475563831298,1942499475370893313,1942499475303784450,1942499475433807873,1942499475433807876,1942499475370893314',
      id: '342843899553878016',
      name: '2.2.3 一元二次不等式的解法',
    },
    {
      nodeId: '313ca7f1-8554-47ff-9eea-c72dba15ab61',
      nodeName: '2.2.4 均值不等式及其应用',
      knowledge:
        '1942499643046539266,1942499644468408321,1942499644468408323,1942499644598431745,1942499644535517186,1942499644598431747,1942499644468408322,1942499644598431746,1942499644535517187,1942499644535517189,1942499644661346306,1942499644535517188',
      id: '342843938095337472',
      name: '2.2.4 均值不等式及其应用',
    },
    {
      nodeId: '3b884b8a-00df-406e-91ed-4ed90178ceee',
      nodeName: '3.1.1 函数及其表示方法',
      knowledge:
        '1942500049596239875,1942500049596239873,1942500049596239877,1942500049596239876,1942500049533325318,1942500049533325316,1942500049470410754,1942500049470410755,1942500049533325317,1942500048090484737,1942500049533325315,1942500049470410753,1942500049533325314,1942500049596239874',
      id: '342844042135048192',
      name: '3.1.1 函数及其表示方法',
    },
    {
      nodeId: '2a13cd44-65fb-4a2d-8ed6-53e078a2c0a2',
      nodeName: '3.1.2 函数的单调性',
      knowledge:
        '1942500590757912578,1942500592188170245,1942500592318193666,1942500592058146818,1942500592058146820,1942500592058146817,1942500592125255686,1942500592255279106,1942500592125255685,1942500592255279107,1942500592188170243,1942500592125255683,1942500592058146819,1942500592125255682,1942500592255279109,1942500592188170241,1942500592125255684,1942500592255279110,1942500592188170244,1942500592058146821,1942500592188170242,1942500592255279108,1942500592318193667',
      id: '342844476266483712',
      name: '3.1.2 函数的单调性',
    },
    {
      nodeId: '3983a26f-19cc-4bba-869c-7d3164ee0571',
      nodeName: '3.1.3 函数的奇偶性',
      knowledge:
        '1942500773361201154,1942500773424115715,1942500773491224577,1942500773491224578,1942500773424115716,1942500773491224579,1942500773424115714,1942500772031606785',
      id: '342844687747485696',
      name: '3.1.3 函数的奇偶性（1）',
    },
    {
      nodeId: 'dbaac650-49cc-4f27-8bb6-659f1271ddad',
      nodeName: '3.2 函数与方程、不等式之间的关系',
      knowledge:
        '1942501003330646018,1942501003204816897,1942501003141902339,1942501003141902338,1942501003078987777,1942501003011878917,1942501003011878915,1942501003330646017,1942501001132830721,1942501002944770049,1942501003267731458,1942501003204816899,1942501003204816898,1942501003078987778,1942501003141902340,1942501003267731457,1942501003011878914,1942501003267731459,1942501003011878916,1942501003267731460,1942501003078987779,1942501003141902341',
      id: '342844844949999616',
      name: '3.2 函数的零点 函数方程不等式之间的关系',
    },
    {
      nodeId: 'f6b39f9f-0979-4156-b3d8-548ea9b2da63',
      nodeName: '3.3 函数的应用（一）',
      knowledge: '1942503484144005122,1942503485733646338,1942503485670731777',
      id: '342845586167402496',
      name: '4.6 函数的应用（2）',
    },
    {
      nodeId: '12328b7b-4114-4c7f-be2a-28c7bd8d2a1e',
      nodeName: '4.1.1 实数指数幂及其运算',
      knowledge:
        '1947924893235740673,1947924896507297793,1947924898969354241,1947924895148343298,1947924703254740994,1947924859182186498,1947924897815920642',
      id: '342844980090474496',
      name: '4.1.1 实数指数幂及其运算',
    },
    {
      nodeId: '5d5cc96d-45ca-480f-ba40-00d152f63553',
      nodeName: '4.1.2 指数函数的性质与图象',
      knowledge:
        '1947924907328602114,1947924918829383681,1947924926433656833,1947924939008180225,1947924929709408258,1947924908414926850,1947924906049339393,1947924914538610689,1947924920951701505,1947924934948093953,1947924909476085761,1947924922755252226,1947924902773587970,1947924904774270978,1947924937238183937,1947924912630202370,1947924932259545089,1947924910503690241,1947924928002326529,1947924916627374081,1947924924940484609',
      id: '342845053490794496',
      name: '4.1.2 指数函数的性质与图像',
    },
    {
      nodeId: '6d4d9401-f737-4017-9b32-c74a63bde603',
      nodeName: '4.2.1 对数运算',
      knowledge: '1947924940740427777,1947924948952875009',
      id: '342845153147457536',
      name: '4.2.1 对数运算',
    },
    {
      nodeId: '28d16798-371f-4d9d-8fa3-53d0f946c60a',
      nodeName: '4.2.2 对数运算法则',
      knowledge: '1947924959430246401,1947924956078997505,1947924957874159617,1947924953717604354',
      id: '342845192615858176',
      name: '4.2.2 对数运算法则',
    },
    {
      nodeId: '056dcf14-edcc-4cf7-8d31-6c73852388fc',
      nodeName: '4.2.3 对数函数的性质与图象',
      knowledge:
        '1947924983690100737,1947924978342363137,1947924987041349634,1947924981932687361,1947924997514526721,1947924991088852994,1947924970561929217,1947924985439125506,1947924988723265537,1947924979969753089,1947924976786276353,1947924967269400577,1947924960814366721,1947924993169227777,1947924973296615426,1947924969072951297,1947924971925078018,1947924999980777474,1947924965541347329,1947924974852702210,1947924995266379777',
      id: '342845340880310272',
      name: '4.2.3 对数函数的性质与图像',
    },
    {
      nodeId: '14bf9776-94c0-45a5-812e-348c121e650a',
      nodeName: '4.3 指数函数与对数函数的关系',
      knowledge: '1947925164976308227,1947925164972113922,1947925111423434754,1947925164976308226',
      id: '342845434753028096',
      name: '4.3 指数函数与对数函数的关系',
    },
    {
      nodeId: '352a8cf1-beda-4b5f-98d9-06d2231de0e4',
      nodeName: '4.4 幂函数',
      knowledge:
        '1947925165764837378,1947925165827751938,1947925166024884226,1947925166024884227,1947925165961969666,1947925166154907650,1947925165827751940,1947925165961969667,1947925166091993090,1947925165894860802,1947925166154907649,1947925165961969665,1947925166091993089,1947925166024884228,1947925165764837379,1947925165827751939,1947925165961969668,1947925165894860803,1947925165894860804',
      id: '342845467888029696',
      name: '4.4 幂函数',
    },
    {
      nodeId: 'ae1d680f-df3b-4767-b723-6ebbf02ee46b',
      nodeName: '4.5 增长速度的比较',
      knowledge: '1947925166477869057,1947925166414954497',
      id: '342845520191000576',
      name: '4.5 增长速度的比较',
    },
    {
      nodeId: 'e5325598-6faf-4c50-9112-af779aed25ac',
      nodeName: '4.6 函数的应用（二）',
      knowledge: '1947925166742110210,1947925166742110211',
    },
    {
      nodeId: '4108bbf8-645c-4ae3-9e0c-5e353f67d031',
      nodeName: '4.7 数学建模活动：生长规律的描述',
      knowledge: '1947925167060877314,1947925167123791875,1947925167123791874',
    },
    {
      nodeId: '243e19a9-62c0-49f5-8f56-4bb27ae99077',
      nodeName: '5.1.1 数据的收集',
      knowledge: '1947925167715188738,1947925167715188739,1947925167782297601',
      id: '342845980578779136',
      name: '5.1.1 数据的收集',
    },
    {
      nodeId: 'b72097a3-ecad-4ed9-8210-a93c5d6727c2',
      nodeName: '5.1.2 数据的数字特征',
      knowledge:
        '1947925168109453316,1947925168109453314,1947925168109453315,1947925168109453317,1947925168176562177',
      id: '342846019858436096',
      name: '5.1.2 数据的数字特征',
    },
    {
      nodeId: '1f282422-740f-403b-bd2f-f4078286deae',
      nodeName: '5.1.3 数据的直观表示',
      knowledge:
        '1947925168499523588,1947925168562438146,1947925168436609026,1947925168436609028,1947925168499523587,1947925168436609027,1947925168499523586,1947925168499523585',
      id: '342846061382045696',
      name: '5.1.3 数据的直观表示',
    },
    {
      nodeId: '37e41d38-888a-40a4-bb8a-0de0e4202e0b',
      nodeName: '5.3.1 样本空间与事件',
      knowledge: '1947925169673928706,1947925169673928707,1947925169673928708',
      id: '342846379398369280',
      name: '5.2.1 样本空间与事件',
    },
    {
      nodeId: '83c1abe9-9b2c-409d-8c2d-09e076e710af',
      nodeName: '5.3.2 事件之间的关系与运算',
      knowledge: '1947925170068193283,1947925170001084417,1947925170068193282',
      id: '342846526589079552',
      name: '5.2.2 事件之间的关系与运算',
    },
    {
      nodeId: 'c0e14c98-12e4-4057-ad64-9a411d67de0c',
      nodeName: '5.3.3 古典概型',
      knowledge:
        '1947925170458263555,1947925170328240130,1947925170458263553,1947925170391154692,1947925170391154690,1947925170391154691,1947925170458263554',
      id: '342846579546361856',
      name: '5.2.3 古典概型',
    },
    {
      nodeId: 'a67f838b-3337-48fc-81f6-5237dcfef794',
      nodeName: '5.3.4 频率与概率',
      knowledge: '1947925170781224962,1947925170781224964,1947925170781224963',
      id: '342846629714432000',
      name: '5.2.4 频率与概率',
    },
    {
      nodeId: '6592b51e-2360-493a-ac2f-5b8b5a103578',
      nodeName: '5.3.5 随机事件的独立性',
      knowledge:
        '1947925171234209795,1947925171171295235,1947925171234209797,1947925171234209794,1947925171234209796,1947925171301318658,1947925171171295236,1947925171171295234,1947925171301318657',
      id: '342846674731896832',
      name: '5.2.5 随机事件的独立性',
    },
    {
      nodeId: '8f6afe4c-1950-4d1f-bbf2-789bdc41fb4f',
      nodeName: '5.4统计与概率的应用',
      knowledge:
        '194792517168719462b,1947925171620085761,194792517168719462a,194792517168719462c,1947925171687194625',
      id: '342846723998191616',
      name: '5.3 统计与概率的应用',
    },
    {
      nodeId: '30f783ae-1793-4530-93b4-e9376d4075d4',
      nodeName: '6.1.1 向量的概念',
      knowledge:
        '1947925172345700354,1947925172278591490,1947925172345700356,1947925172278591491,1947925172345700355',
    },
    {
      nodeId: '00f8b9da-1b42-48de-96f3-56e29d8784c7',
      nodeName: '6.1.2 向量的加法',
      knowledge: '1947925172668661763,1947925172668661764,1947925172668661762',
    },
    {
      nodeId: '823c9f9a-bf24-4ac1-8374-ee45b7a8aa56',
      nodeName: '6.1.3 向量的减法',
      knowledge: '1947925173050343426,1947925173050343427,1947925172987428866,1947925172987428865',
    },
    {
      nodeId: '9c398985-4f53-47d9-8b79-b7c38e14e4a8',
      nodeName: '6.1.4 数乘向量',
      knowledge:
        '1947925173369110530,1947925173436219394,1947925173503328257,1947925173369110529,1947925173436219393',
    },
    {
      nodeId: '2e55faf4-56b2-4f7e-b4f2-491f0091cfec',
      nodeName: '6.1.5 向量的线性运算',
      knowledge: '1947925173830483972,1947925173830483971,1947925173830483970,1947925173897592834',
    },
    {
      nodeId: '5bcc8e48-e6ca-4407-9ad5-6befe9e88886',
      nodeName: '6.2.1 向量基本定理',
      knowledge: '1947925174484795396,1947925174551904258,1947925174484795394,1947925174484795395',
    },
    {
      nodeId: '4e95ab47-0e87-493b-97ea-491258f74b86',
      nodeName: '6.2.3 平面向量的坐标及其运算',
      knowledge:
        '1947925175210409987,1947925175210409986,1947925175336239105,1947925175403347969,1947925175403347970,1947925175273324547,1947925175336239107,1947925175470456833,1947925175273324546,1947925175336239108,1947925175273324548,1947925175403347971,1947925175336239106',
    },
    {
      nodeId: '37009ecb-dd85-4115-836d-9fc2eed64cac',
      nodeName: '6.3 平面向量线性运算的应用',
      knowledge:
        '1947925175860527106,1947925175860527108,1947925175923441666,1947925175793418241,1947925175793418242,1947925175793418243,1947925175860527107,1947925175860527105,1947925175923441665',
    },
    {
      id: '342842863892140032',
      knowledge:
        '1942495952851763202,1942495952851763204,1942495952788848644,1942495952721739781,1942495952788848643,1942495952721739779,1942495950800748546,1942495952788848641,1942495952721739778,1942495952788848642,1942495952851763201,1942495952721739780,1942495952851763203',
      name: '1.1.4 集合的基本运算（二）',
    },
    {
      id: '342846112971984896',
      name: '5.1.4 用样本估计总体',
      knowledge:
        '194792517168719462b,1947925171620085761,194792517168719462a,194792517168719462c,1947925171687194625',
    },
  ],
]
/**
 * 数组元素接口 - 第一个数组（包含 nodeId, nodeName, knowledge）
 */
interface Array1Element {
  nodeId?: string
  nodeName?: string
  knowledge?: string
  [key: string]: unknown
}

/**
 * 数组元素接口 - 第二个数组（包含 id, name）
 */
interface Array2Element {
  id?: string
  name?: string
  [key: string]: unknown
}

/**
 * 合并后的元素接口
 */
interface MergedElement extends Array1Element, Array2Element {}

/**
 * 合并后的扁平化数据接口（持久化格式）
 */
interface MergedFlattenData {
  subject: string
  data: MergedElement[]
  timestamp: number
}

/**
 * 提取中文核心内容（去除数字、标点、空格）
 * @param text 原始文本
 * @returns 提取的中文核心内容
 */
function extractChineseCore(text: string): string {
  return text.replace(/[\d\s\.\-\(\)（）【】\[\]\/\\]/g, '').replace(/[^\u4e00-\u9fa5]/g, '')
}

/**
 * 计算最长公共子序列长度
 * @param str1 字符串1
 * @param str2 字符串2
 * @returns 最长公共子序列长度
 */
function longestCommonSubsequence(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  return dp[m][n]
}

/**
 * 计算两个字符串的相似度（基于最长公共子序列）
 * @param str1 字符串1
 * @param str2 字符串2
 * @returns 相似度（0-1之间）
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0
  const lcs = longestCommonSubsequence(str1, str2)
  const maxLen = Math.max(str1.length, str2.length)
  return maxLen === 0 ? 0 : lcs / maxLen
}

/**
 * 合并两个数组，基于中文名称进行模糊匹配
 *
 * 匹配逻辑：
 * 1. 提取每个元素的中文核心内容（去除数字、标点、空格）
 * 2. 使用最长公共子序列算法计算相似度
 * 3. 相似度 >= 0.5 的元素进行合并
 *
 * @param array1 第一个数组（包含 nodeId, nodeName, knowledge）
 * @param array2 第二个数组（包含 id, name）
 * @param similarityThreshold 相似度阈值，默认0.5
 * @returns 合并后的数组
 */
export function mergeArraysByChineseName(
  array1: Array1Element[],
  array2: Array2Element[],
  similarityThreshold: number = 0.5,
): MergedElement[] {
  const result: MergedElement[] = []
  const usedIndices2 = new Set<number>()

  // 为每个 array1 元素查找最佳匹配
  for (const elem1 of array1) {
    const name1 = String(elem1.nodeName || elem1.name || '')
    const core1 = extractChineseCore(name1)

    if (!core1) {
      // 如果没有中文内容，直接添加
      result.push({ ...elem1 })
      continue
    }

    let bestMatch: { index: number; similarity: number } | null = null

    // 在 array2 中查找最佳匹配
    for (let i = 0; i < array2.length; i++) {
      if (usedIndices2.has(i)) continue

      const name2 = String(array2[i].name || '')
      const core2 = extractChineseCore(name2)

      if (!core2) continue

      const similarity = calculateSimilarity(core1, core2)
      if (similarity >= similarityThreshold && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { index: i, similarity }
      }
    }

    if (bestMatch) {
      // 找到匹配，合并属性
      const matchedElem2 = array2[bestMatch.index]
      result.push({
        ...elem1,
        ...matchedElem2,
      })
      usedIndices2.add(bestMatch.index)
    } else {
      // 未找到匹配，保留原元素
      result.push({ ...elem1 })
    }
  }

  // 添加未匹配的 array2 元素
  for (let i = 0; i < array2.length; i++) {
    if (!usedIndices2.has(i)) {
      result.push({ ...array2[i] })
    }
  }

  return result
}

/**
 * 检查是否是石景山学校的textbookId
 * @param textbookId 教材ID
 * @returns 是否是石景山学校的textbookId
 */
export function isShijingshanTextbook(textbookId: string | undefined): boolean {
  return textbookId === SHIJINGSHAN_TEXTBOOK_ID
}

/**
 * 从localStorage获取教材的章节结构
 * @param textbookId 教材ID
 * @returns 章节结构，如果没找到返回null
 */
function getPersistedTextbookStructure(textbookId: string): ChapterNode[] | null {
  try {
    const key = `${TEXTBOOK_STRUCTURE_STORAGE_KEY_PREFIX}${textbookId}`
    const stored = localStorage.getItem(key)
    if (!stored) {
      return null
    }
    const data = JSON.parse(stored)
    // 检查数据是否过期（可选：可以设置过期时间，比如24小时）
    // 这里暂时不设置过期时间，章节结构变化不频繁
    return data.structure || null
  } catch {
    return null
  }
}

/**
 * 递归收集章节树中的所有节点
 * @param nodes 章节节点列表
 * @returns 所有节点的数组
 */
function collectAllNodes(nodes: ChapterNode[]): ChapterNode[] {
  const result: ChapterNode[] = []

  for (const node of nodes) {
    result.push(node)
    if (node.children && node.children.length > 0) {
      result.push(...collectAllNodes(node.children))
    }
  }

  return result
}

/**
 * 检查映射是否已初始化（按学科）
 * @param subject 学科类型
 * @returns 是否已初始化
 */
function isMappingInitialized(subject: string): boolean {
  try {
    const key = `${MAPPING_INITIALIZED_KEY}_${subject.toLowerCase()}`
    const initialized = localStorage.getItem(key)
    return initialized === 'true'
  } catch {
    return false
  }
}

/**
 * 标记映射已初始化（按学科）
 * @param subject 学科类型
 */
function markMappingInitialized(subject: string): void {
  try {
    const key = `${MAPPING_INITIALIZED_KEY}_${subject.toLowerCase()}`
    localStorage.setItem(key, 'true')
  } catch {
    // 忽略错误
  }
}

/**
 * 保存教材的章节结构到localStorage
 * @param textbookId 教材ID
 * @param structure 章节结构
 */
function savePersistedTextbookStructure(textbookId: string, structure: ChapterNode[]): void {
  try {
    const key = `${TEXTBOOK_STRUCTURE_STORAGE_KEY_PREFIX}${textbookId}`
    const data = {
      structure,
      timestamp: Date.now(),
    }
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // 忽略错误
  }
}

/**
 * 保存合并后的扁平化数据到持久化存储（按学科）
 * @param subject 学科类型
 * @param mergedData 合并后的数据数组
 */
function saveMergedFlattenData(subject: string, mergedData: MergedElement[]): void {
  try {
    const key = `${MERGED_DATA_STORAGE_KEY}_${subject.toLowerCase()}`
    const data: MergedFlattenData = {
      subject: subject.toLowerCase(),
      data: mergedData,
      timestamp: Date.now(),
    }
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // 忽略错误
  }
}

/**
 * 从持久化存储获取合并后的扁平化数据（按学科）
 * @param subject 学科类型
 * @returns 合并后的数据数组，如果没找到返回null
 */
function getMergedFlattenData(subject: string): MergedElement[] | null {
  try {
    const key = `${MERGED_DATA_STORAGE_KEY}_${subject.toLowerCase()}`
    const stored = localStorage.getItem(key)
    if (!stored) {
      return null
    }
    const data: MergedFlattenData = JSON.parse(stored)
    return data.data || null
  } catch {
    return null
  }
}

/**
 * 从合并后的扁平化数据中查找知识点ID
 * @param nodeId 节点ID
 * @param nodeName 节点名称
 * @param subject 学科类型
 * @returns 知识点ID字符串（逗号分隔），如果没找到返回null
 */
function getKnowledgeFromMergedData(
  nodeId: string,
  nodeName: string,
  subject: string,
): string | null {
  const mergedData = getMergedFlattenData(subject)
  if (!mergedData || mergedData.length === 0) {
    return null
  }

  // 优先精确匹配 nodeId
  const exactMatch = mergedData.find((item) => item.nodeId === nodeId && item.nodeName === nodeName)
  if (exactMatch && exactMatch.knowledge) {
    return String(exactMatch.knowledge)
  }

  // 如果精确匹配失败，尝试只匹配 nodeId
  const nodeIdMatch = mergedData.find((item) => item.nodeId === nodeId)
  if (nodeIdMatch && nodeIdMatch.knowledge) {
    return String(nodeIdMatch.knowledge)
  }

  // 如果 nodeId 匹配失败，尝试通过名称匹配（使用中文名称相似度）
  const name1 = String(nodeName || '')
  const core1 = extractChineseCore(name1)

  if (core1) {
    let bestMatch: { item: MergedElement; similarity: number } | null = null

    for (const item of mergedData) {
      const name2 = String(item.nodeName || item.name || '')
      const core2 = extractChineseCore(name2)

      if (!core2) continue

      const similarity = calculateSimilarity(core1, core2)
      if (
        similarity >= 0.5 &&
        (!bestMatch || similarity > bestMatch.similarity) &&
        item.knowledge
      ) {
        bestMatch = { item, similarity }
      }
    }

    if (bestMatch && bestMatch.item.knowledge) {
      return String(bestMatch.item.knowledge)
    }
  }

  return null
}

/**
 * 初始化完整的映射map（包含扁平化和合并逻辑）
 * @param subject 学科类型
 * @returns 是否初始化成功
 */
async function initializeMappingMap(subject: string): Promise<boolean> {
  try {
    // 1. 获取主教材的章节结构
    let mainStructure = getPersistedTextbookStructure(SHIJINGSHAN_TEXTBOOK_ID)
    if (!mainStructure || mainStructure.length === 0) {
      mainStructure = await apiService.getTextbookStructure(SHIJINGSHAN_TEXTBOOK_ID)
      if (mainStructure && mainStructure.length > 0) {
        savePersistedTextbookStructure(SHIJINGSHAN_TEXTBOOK_ID, mainStructure)
      }
    }

    if (!mainStructure || mainStructure.length === 0) {
      return false
    }

    // 2. 获取相关教材的章节结构
    const relatedTextbookStructuresMap = new Map<string, ChapterNode[]>()

    for (const relatedTextbookId of SHIJINGSHAN_RELATED_TEXTBOOK_IDS) {
      try {
        let structure = getPersistedTextbookStructure(relatedTextbookId)
        if (!structure || structure.length === 0) {
          structure = await apiService.getTextbookStructure(relatedTextbookId)
          if (structure && structure.length > 0) {
            savePersistedTextbookStructure(relatedTextbookId, structure)
          }
        }

        if (structure && structure.length > 0) {
          relatedTextbookStructuresMap.set(relatedTextbookId, structure)
        }
      } catch {
        // 忽略错误
      }
    }

    if (relatedTextbookStructuresMap.size === 0) {
      return false
    }

    // 3. 扁平化主教材的所有节点，构建数组1（包含 nodeId, nodeName）
    const allMainNodes = collectAllNodes(mainStructure)
    const array1: Array1Element[] = allMainNodes
      .filter((node) => node.id && node.name)
      .map((node) => ({
        nodeId: node.id!,
        nodeName: node.name!,
      }))

    // 4. 扁平化所有相关教材的节点，获取每个节点的 knowledge，构建数组2（包含 id, name, knowledge）
    const array2: Array2Element[] = []

    for (const relatedTextbookId of SHIJINGSHAN_RELATED_TEXTBOOK_IDS) {
      const structure = relatedTextbookStructuresMap.get(relatedTextbookId)
      if (!structure) {
        continue
      }

      const allRelatedNodes = collectAllNodes(structure)

      for (const node of allRelatedNodes) {
        if (!node.id || !node.name) {
          continue
        }

        try {
          const knowledgeRequest = {
            subject: subject.toLowerCase(),
            param: [
              {
                textbook_id: relatedTextbookId,
                section_id: node.id,
              },
            ],
          }

          const knowledgeId = await apiService.queryKnowledgeIdsByNodeId(knowledgeRequest)
          if (knowledgeId && knowledgeId.trim()) {
            array2.push({
              id: node.id,
              name: node.name,
              knowledge: knowledgeId.trim(),
            })
          }

          // 添加小延迟，避免请求过快
          await new Promise((resolve) => setTimeout(resolve, 50))
        } catch {
          // 忽略错误，继续处理下一个节点
        }
      }
    }

    // 5. 使用 mergeArraysByChineseName 合并两个数组
    const mergedData = mergeArraysByChineseName(array1, array2, 0.5)

    // 6. 保存合并后的扁平化数据
    if (mergedData.length > 0) {
      saveMergedFlattenData(subject, mergedData)
    }

    // 只要合并数据保存成功，就认为初始化成功
    return mergedData.length > 0
  } catch {
    return false
  }
}

/**
 * 从硬编码数据中查找知识点ID
 *
 * 查找逻辑：
 * 1. 优先通过 nodeId 精确匹配
 * 2. 如果 nodeId 不匹配，则通过 nodeName 精确匹配
 * 3. 如果精确匹配失败，则通过 nodeName 模糊匹配（包含关系）
 *
 * @param nodeId 节点ID
 * @param nodeName 节点名称
 * @returns 知识点ID字符串（逗号分隔），如果未找到则返回null
 */
function getKnowledgeFromHardcodedMapping(nodeId: string, nodeName: string): string | null {
  // 硬编码数据是二维数组，第一个数组包含映射数据
  const mappingArray = HARDCODED_KNOWLEDGE_MAPPING[0] as Array1Element[]

  if (!mappingArray || !Array.isArray(mappingArray)) {
    return null
  }

  // 第1步：优先通过 nodeId 精确匹配
  if (nodeId) {
    const matchById = mappingArray.find((item) => item.nodeId === nodeId)
    if (matchById && matchById.knowledge) {
      return String(matchById.knowledge)
    }
  }

  // 第2步：通过 nodeName 精确匹配
  if (nodeName) {
    const matchByName = mappingArray.find(
      (item) => item.nodeName === nodeName || item.name === nodeName,
    )
    if (matchByName && matchByName.knowledge) {
      return String(matchByName.knowledge)
    }

    // 第3步：通过 nodeName 模糊匹配（包含关系）
    const matchByContains = mappingArray.find((item) => {
      const itemName = String(item.nodeName || item.name || '')
      return itemName.includes(nodeName) || nodeName.includes(itemName)
    })
    if (matchByContains && matchByContains.knowledge) {
      return String(matchByContains.knowledge)
    }
  }

  return null
}

function getBmNoListFromHardcodedMapping(nodeId: string, nodeName: string): string | null {
  const mappingArray = HARDCODED_KNOWLEDGE_MAPPING[0] as Array1Element[]

  if (!mappingArray || !Array.isArray(mappingArray)) {
    return null
  }

  if (nodeId) {
    const matchById = mappingArray.find((item) => item.nodeId === nodeId)
    const bmNoList = (matchById as any)?.bmNoList
    if (bmNoList && typeof bmNoList === 'string') {
      return bmNoList
    }
  }

  if (nodeName) {
    const matchByName = mappingArray.find(
      (item) => item.nodeName === nodeName || item.name === nodeName,
    ) as any
    const bmNoList = matchByName?.bmNoList
    if (bmNoList && typeof bmNoList === 'string') {
      return bmNoList
    }
  }

  return null
}

/**
 * 石景山学校特殊业务逻辑：查询知识点ID
 *
 * 当使用石景山学校的textbookId（342839470708592640）进行知识图谱去练习时：
 * 1. 优先从硬编码映射数据中获取（最快、最准确）
 * 2. 如果硬编码数据中没有，从合并后的扁平化数据中获取（持久化存储）
 * 3. 如果合并数据中没有，初始化映射后再次尝试
 * 4. 如果动态获取失败，返回null，使用默认逻辑
 *
 * @param textbookId 当前教材ID
 * @param nodeId 当前节点ID
 * @param nodeName 当前节点名称
 * @param subject 学科类型（math/biology）
 * @returns 知识点ID字符串（逗号分隔），如果不需要特殊处理则返回null
 */
export async function queryShijingshanKnowledgeId(
  textbookId: string | undefined,
  nodeId: string,
  nodeName: string,
  subject: string,
): Promise<string | null> {
  // 第1步：检查是否是石景山学校的textbookId
  if (!isShijingshanTextbook(textbookId)) {
    return null
  }

  // 第2步：优先从硬编码映射数据中获取（最快、最准确）
  const knowledgeFromHardcoded = getKnowledgeFromHardcodedMapping(nodeId, nodeName)
  if (knowledgeFromHardcoded) {
    return knowledgeFromHardcoded
  }

  // 第3步：从合并后的扁平化数据中获取（持久化存储）
  const knowledgeFromMergedData = getKnowledgeFromMergedData(nodeId, nodeName, subject)
  if (knowledgeFromMergedData) {
    return knowledgeFromMergedData
  }

  // 第4步：检查映射是否已初始化（按学科）
  const initialized = isMappingInitialized(subject)

  if (!initialized) {
    // 首次调用该学科，初始化完整的映射map（包含扁平化和合并）
    const initSuccess = await initializeMappingMap(subject)

    if (initSuccess) {
      // 标记该学科为已初始化
      markMappingInitialized(subject)
      // 初始化完成后，再次从合并数据中获取（因为初始化过程中已经保存了合并数据）
      const knowledgeAfterInit = getKnowledgeFromMergedData(nodeId, nodeName, subject)
      if (knowledgeAfterInit) {
        return knowledgeAfterInit
      }
    }
    // 如果初始化失败或未找到映射，返回null
    return null
  } else {
    // 已初始化，从合并数据中获取
    const knowledgeFromMerged = getKnowledgeFromMergedData(nodeId, nodeName, subject)
    if (knowledgeFromMerged) {
      return knowledgeFromMerged
    }
  }

  // 如果都没有找到映射，返回null，使用默认逻辑
  return null
}

export async function queryShijingshanBmNoList(
  textbookId: string | undefined,
  nodeId: string,
  nodeName: string,
  subject: string,
): Promise<string | null> {
  if (!isShijingshanTextbook(textbookId)) {
    return null
  }

  const bmNoList = getBmNoListFromHardcodedMapping(nodeId, nodeName)
  if (bmNoList && bmNoList.trim()) {
    return bmNoList.trim()
  }

  return null
}
