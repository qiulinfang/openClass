/**
 * MathLive加载器 - 负责MathLive库的懒加载和实例管理
 */

export class MathLiveLoader {
  private static instance: MathLiveLoader | null = null
  private mathLivePromise: Promise<unknown> | null = null
  private MathfieldElement: unknown = null
  private isLoaded = false

  // 单例模式
  static getInstance(): MathLiveLoader {
    if (!MathLiveLoader.instance) {
      MathLiveLoader.instance = new MathLiveLoader()
    }
    return MathLiveLoader.instance
  }

  // 加载MathLive库
  async loadMathLive(): Promise<unknown> {
    if (this.isLoaded && this.MathfieldElement) {
      return this.MathfieldElement
    }

    if (this.mathLivePromise) {
      return this.mathLivePromise
    }

    try {
      this.mathLivePromise = this.doLoadMathLive()
      const mathlive = await this.mathLivePromise
      
      this.MathfieldElement = (mathlive as any).MathfieldElement
      this.isLoaded = true
      
      return this.MathfieldElement
    } catch (error) {
      this.mathLivePromise = null
      throw error
    }
  }

  // 创建MathField实例
  async createMathField(): Promise<unknown> {
    const MathfieldElement = await this.loadMathLive()
    const mathField = new (MathfieldElement as any)()
    return mathField
  }

  // 检查是否已加载
  isMathLiveLoaded(): boolean {
    return this.isLoaded && this.MathfieldElement !== null
  }

  // 获取MathfieldElement类
  getMathfieldElement(): unknown {
    if (!this.isLoaded) {
      throw new Error('MathLive库尚未加载')
    }
    return this.MathfieldElement
  }

  // 实际加载MathLive库的方法
  private async doLoadMathLive(): Promise<unknown> {
    try {
      const mathlive = await import('mathlive')
      return mathlive
    } catch (error) {
      throw new Error(`MathLive库加载失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 重置加载状态
  reset(): void {
    this.mathLivePromise = null
    this.MathfieldElement = null
    this.isLoaded = false
  }
}
