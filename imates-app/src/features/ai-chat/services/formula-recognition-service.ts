export interface FormulaRecognitionResult {
  latex: string;
  candidates: string[];
}

const FORMULA_RECOGNITION_PATH =
  '/api/recognize-handwritten-formula-image/json';
const DEFAULT_FORMULA_RECOGNITION_ORIGIN = 'http://49.232.39.212:9012';

const getFormulaRecognitionUrl = (): string => {
  const configuredUrl = process.env.EXPO_PUBLIC_FORMULA_RECOGNITION_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.endsWith(FORMULA_RECOGNITION_PATH)
      ? configuredUrl
      : `${configuredUrl.replace(/\/$/, '')}${FORMULA_RECOGNITION_PATH}`;
  }
  return `${DEFAULT_FORMULA_RECOGNITION_ORIGIN}${FORMULA_RECOGNITION_PATH}`;
};

const extractServerMessage = (payload: any): string =>
  String(
    payload?.message ||
      payload?.msg ||
      payload?.detail ||
      payload?.data?.message ||
      ''
  ).trim();

export class FormulaRecognitionService {
  public static async recognize(
    imageDataUrl: string
  ): Promise<FormulaRecognitionResult> {
    const file = imageDataUrl.replace(
      /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
      ''
    );
    if (!file) throw new Error('手写内容为空，请重新书写');

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 20000);
    try {
      const response = await fetch(getFormulaRecognitionUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file,
          filename: 'handwritten_formula.png',
        }),
        signal: abortController.signal,
      });
      const responseText = await response.text();
      let payload: any = null;
      try {
        payload = responseText ? JSON.parse(responseText) : null;
      } catch {
        if (/<!doctype html|<html[\s>]/i.test(responseText)) {
          throw new Error('公式识别接口地址配置错误，请检查 Web 代理或服务地址');
        }
        throw new Error('公式识别接口返回格式异常，请重试');
      }
      const data = payload?.data ?? payload;
      const latex = String(data?.latex || '').trim();
      if (!response.ok || !latex) {
        throw new Error(
          extractServerMessage(payload) || '未识别出公式，请重新书写'
        );
      }
      return {
        latex,
        candidates: Array.isArray(data?.candidates)
          ? data.candidates.map(String).filter(Boolean)
          : [],
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('网络请求超时，请重试');
      }
      throw error instanceof Error ? error : new Error('识别失败，请重试');
    } finally {
      clearTimeout(timeout);
    }
  }
}
