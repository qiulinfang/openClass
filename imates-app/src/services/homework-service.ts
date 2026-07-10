import { storage } from './storage';
import { AppEnvType, getCurrentEnvType } from './env-config';

// 接口定义符合 MyHomeworkView.vue
export interface HomeworkUndoItem {
  id: string;
  title: string;
  subject: string;
  totalScore: string;
  releaseTime: string;
  deadline: string;
  fullSubmit: string;
  lateSubmit: string;
  resubmit: string;
  status: string;
  remark: string;
}

// 模拟学科 ID 到名字的映射
export const SUBJECT_ID_TO_NAME: Record<string, string> = {
  '1': '数学',
  '2': '化学',
  '3': '物理',
  '4': '英语',
  '5': '语文',
  '6': '生物',
  '7': '历史',
  '8': '地理',
  '9': '政治',
  'MATH': '数学',
  'BIOLOGY': '生物',
};

// 作业状态映射表
export const HOMEWORK_STATUS_MAP: Record<string, string> = {
  '0': '草稿',
  '1': '进行中',
  '2': '已撤销',
  '3': '已结束',
};

// 获取作业状态文本
export const getHomeworkStatusText = (status: string, deadline?: string): string => {
  if (deadline) {
    const deadlineDate = new Date(deadline);
    const currentDate = new Date();
    if (currentDate > deadlineDate) {
      return HOMEWORK_STATUS_MAP['3']; // 已结束
    }
  }
  return HOMEWORK_STATUS_MAP[status] || '进行中';
};

// 获取作业状态标签颜色
export const getHomeworkStatusTagColor = (status: string, deadline?: string): string => {
  if (deadline) {
    const deadlineDate = new Date(deadline);
    const currentDate = new Date();
    if (currentDate > deadlineDate) {
      return '#64748B'; // 已截止使用灰色 (slate-500)
    }
  }
  if (status === '3') return '#64748B';
  if (status === '0') return '#8B5CF6'; // 紫色 (violet-500)
  return '#10B981'; // 进行中等使用绿色 (emerald-500)
};

// 纯 JS 实现的 MD5 散列算法，用于研伴登录密码加密
function md5(string: string): string {
  function RotateLeft(lValue: number, iShiftBits: number) {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  }
  function AddUnsigned(lX: number, lY: number) {
    var lX4, lY4, lX8, lY8, lResult;
    lX8 = (lX & 0x80000000);
    lY8 = (lY & 0x80000000);
    lX4 = (lX & 0x40000000);
    lY4 = (lY & 0x40000000);
    lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
    if (lX4 & lY4) {
      return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
    }
    if (lX4 | lY4) {
      if (lResult & 0x40000000) {
        return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
      } else {
        return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
      }
    } else {
      return (lResult ^ lX8 ^ lY8);
    }
  }
  function F(x: number, y: number, z: number) { return (x & y) | ((~x) & z); }
  function G(x: number, y: number, z: number) { return (x & z) | (y & (~z)); }
  function H(x: number, y: number, z: number) { return (x ^ y ^ z); }
  function I(x: number, y: number, z: number) { return (y ^ (x | (~z))); }
  function FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac));
    return AddUnsigned(RotateLeft(a, s), b);
  }
  function GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac));
    return AddUnsigned(RotateLeft(a, s), b);
  }
  function HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac));
    return AddUnsigned(RotateLeft(a, s), b);
  }
  function II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac));
    return AddUnsigned(RotateLeft(a, s), b);
  }
  function ConvertToWordArray(string: string) {
    var lWordCount;
    var lMessageLength = string.length;
    var lNumberOfWords_temp1 = lMessageLength + 8;
    var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
    var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
    var lWordArray = Array(lNumberOfWords - 1);
    var lBytePosition = 0;
    var lByteCount = 0;
    while (lByteCount < lMessageLength) {
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
      lByteCount++;
    }
    lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordArray;
  }
  function WordToHex(lValue: number) {
    var WordToHexValue = "", WordToHexValue_temp = "", lByte, lCount;
    for (lCount = 0; lCount <= 3; lCount++) {
      lByte = (lValue >>> (lCount * 8)) & 255;
      WordToHexValue_temp = "0" + lByte.toString(16);
      WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
    }
    return WordToHexValue;
  }
  function Utf8Encode(string: string) {
    string = string.replace(/\r\n/g, "\n");
    var utftext = "";
    for (var n = 0; n < string.length; n++) {
      var c = string.charCodeAt(n);
      if (c < 128) {
        utftext += String.fromCharCode(c);
      } else if ((c > 127) && (c < 2048)) {
        utftext += String.fromCharCode((c >> 6) | 192);
        utftext += String.fromCharCode((c & 63) | 128);
      } else {
        utftext += String.fromCharCode((c >> 12) | 224);
        utftext += String.fromCharCode(((c >> 6) & 63) | 128);
        utftext += String.fromCharCode((c & 63) | 128);
      }
    }
    return utftext;
  }
  var x = Array();
  var k, AA, BB, CC, DD, a, b, c, d;
  var S11 = 7, S12 = 12, S13 = 17, S14 = 22;
  var S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  var S31 = 4, S32 = 11, S33 = 16, S34 = 23;
  var S41 = 6, S42 = 10, S43 = 15, S44 = 21;
  string = Utf8Encode(string);
  x = ConvertToWordArray(string);
  a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
  for (k = 0; k < x.length; k += 16) {
    AA = a; BB = b; CC = c; DD = d;
    a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
    d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
    c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB);
    b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
    a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
    d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
    c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613);
    b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
    a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8);
    d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
    c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
    b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
    a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122);
    d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
    c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E);
    b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
    a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
    d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
    c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51);
    b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
    a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
    d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
    c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
    b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
    a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
    d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
    c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
    b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
    a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
    d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
    c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9);
    b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
    a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
    d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
    c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
    b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
    a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
    d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
    c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
    b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
    a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
    d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
    c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
    b = HH(b, c, d, a, x[k + 6], S34, 0x4881D05);
    a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
    d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
    c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
    b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
    a = II(a, b, c, d, x[k + 0], S41, 0xF4292244);
    d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
    c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
    b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
    a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3);
    d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
    c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
    b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
    a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
    d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
    c = II(c, d, a, b, x[k + 6], S43, 0xA3014314);
    b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
    a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82);
    d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
    c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
    b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
    a = AddUnsigned(a, AA); b = AddUnsigned(b, BB); c = AddUnsigned(c, CC); d = AddUnsigned(d, DD);
  }
  var temp = WordToHex(a) + WordToHex(b) + WordToHex(c) + WordToHex(d);
  return temp.toLowerCase();
}

export class HomeworkService {
  /**
   * 获取当前环境下的作业 API 终点 URL
   */
  private static getApiUrl(): string {
    const env = getCurrentEnvType();
    if (env === AppEnvType.INTERNAL_TEST) {
      return 'https://www.imates.com.cn/yb-test/blw-edu-yb/api/app/homework-undo-list';
    }
    return 'https://www.imates.com.cn/yb-release/blw-edu-yb/api/app/homework-undo-list';
  }

  /**
   * 登录研伴系统获取 YANBAN_TOKEN
   */
  public static async loginYanban(account: string, pass: string): Promise<string> {
    const md5Password = md5(pass);
    const env = getCurrentEnvType();
    const url = env === AppEnvType.INTERNAL_TEST
      ? 'https://www.imates.com.cn/yb-test/blw-edu-yb/auth/login-student'
      : 'https://www.imates.com.cn/yb-release/blw-edu-yb/auth/login-student';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account,
        password: md5Password,
      }),
    });

    if (!response.ok) {
      throw new Error(`研伴自动登录失败 (HTTP ${response.status})`);
    }

    const resJson = await response.json();
    const token = resJson.data?.data?.token || resJson.data?.token || resJson.token;
    if (!token) {
      throw new Error('未获取到有效的研伴 Token');
    }

    await storage.setItem('YANBAN_TOKEN', token);
    return token;
  }

  /**
   * 拉取作业列表数据
   */
  public static async fetchHomeworkList(params: {
    pageNumber: number;
    pageSize: number;
    subject?: string;
    date?: string;
  }): Promise<HomeworkUndoItem[]> {
    let token = await storage.getItem('YANBAN_TOKEN');
    if (!token || token === 'undefined' || token.trim() === '') {
      // 动态自动重试登录研伴系统
      const account = await storage.getItem('xuebanuserid');
      const password = await storage.getItem('userPassword');
      if (account && password) {
        try {
          console.log('[HomeworkService] YANBAN_TOKEN 缺失，正在静默登录研伴...');
          token = await this.loginYanban(account, password);
        } catch (loginError) {
          console.error('[HomeworkService] 自动静默登录研伴异常:', loginError);
        }
      }
    }

    const url = this.getApiUrl();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Token': token || '',
      'sa-token': token || '',
      'authorization': token || '',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        pageNumber: params.pageNumber,
        pageSize: params.pageSize,
        subject: params.subject || undefined,
        date: params.date || undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`获取作业列表接口异常 (HTTP ${response.status})`);
    }

    const resJson = await response.json();
    if (resJson.success && resJson.code === 200) {
      const resData = resJson.data;
      if (Array.isArray(resData)) {
        return resData;
      } else if (resData && Array.isArray(resData.records)) {
        return resData.records;
      }
    }
    return [];
  }

  /**
   * 获取作业详情（题目列表）
   */
  public static async getHomeworkDetailList(homeworkId: string): Promise<HomeworkQuestionDetail[]> {
    let token = await storage.getItem('YANBAN_TOKEN');
    if (!token || token === 'undefined' || token.trim() === '') {
      const account = await storage.getItem('xuebanuserid');
      const password = await storage.getItem('userPassword');
      if (account && password) {
        try {
          token = await this.loginYanban(account, password);
        } catch (e) {
          console.error('[HomeworkService] getHomeworkDetailList 自动登录失败:', e);
        }
      }
    }

    const env = getCurrentEnvType();
    const url = env === AppEnvType.INTERNAL_TEST
      ? 'https://www.imates.com.cn/yb-test/blw-edu-yb/api/app/homework-detail-list'
      : 'https://www.imates.com.cn/yb-release/blw-edu-yb/api/app/homework-detail-list';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Token': token || '',
      'sa-token': token || '',
      'authorization': token || '',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: homeworkId }),
    });

    if (!response.ok) {
      throw new Error(`获取作业详情失败 (HTTP ${response.status})`);
    }

    const resJson = await response.json();
    if (resJson.success && resJson.code === 200) {
      return resJson.data || [];
    }
    return [];
  }

  /**
   * 提交保存作业
   */
  public static async submitHomework(req: HomeworkSubmitSaveReq): Promise<boolean> {
    let token = await storage.getItem('YANBAN_TOKEN');
    if (!token || token === 'undefined' || token.trim() === '') {
      const account = await storage.getItem('xuebanuserid');
      const password = await storage.getItem('userPassword');
      if (account && password) {
        try {
          token = await this.loginYanban(account, password);
        } catch (e) {
          console.error('[HomeworkService] submitHomework 自动登录失败:', e);
        }
      }
    }

    const env = getCurrentEnvType();
    const url = env === AppEnvType.INTERNAL_TEST
      ? 'https://www.imates.com.cn/yb-test/blw-edu-yb/api/app/homework-submit-save'
      : 'https://www.imates.com.cn/yb-release/blw-edu-yb/api/app/homework-submit-save';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Token': token || '',
      'sa-token': token || '',
      'authorization': token || '',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(req),
    });

    if (!response.ok) {
      throw new Error(`提交作业失败 (HTTP ${response.status})`);
    }

    const resJson = await response.json();
    return !!(resJson.success || resJson.data?.success || resJson.code === 200);
  }
}

export interface HomeworkQuestionDetail {
  id: string;
  questionId: string;
  questionContent: string;
  questionAnswer?: string;
  questionAnalysis?: string;
  questionChooseInfo?: string;
  questionChooseList?: string[];
}

export interface HomeworkSubmitSaveReq {
  homeworkId: string;
  questionAnswerList: {
    questionId: string;
    answerData?: string[];
    answerList?: string[];
    chooseList?: string[];
  }[];
}

