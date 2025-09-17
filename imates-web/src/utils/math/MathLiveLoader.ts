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
    console.log('📚 [MATHLIVE-LOADER] 开始加载MathLive库')
    
    if (this.isLoaded && this.MathfieldElement) {
      console.log('📚 [MATHLIVE-LOADER] MathLive库已加载，直接返回')
      return this.MathfieldElement
    }

    if (this.mathLivePromise) {
      console.log('📚 [MATHLIVE-LOADER] MathLive库正在加载中，等待完成')
      return this.mathLivePromise
    }

    try {
      this.mathLivePromise = this.doLoadMathLive()
      const mathlive = await this.mathLivePromise
      
      this.MathfieldElement = mathlive.MathfieldElement
      this.isLoaded = true
      
      console.log('✅ [MATHLIVE-LOADER] MathLive库加载完成')
      return this.MathfieldElement
    } catch (error) {
      console.error('❌ [MATHLIVE-LOADER] MathLive库加载失败', error)
      this.mathLivePromise = null
      throw error
    }
  }

  // 创建MathField实例
  async createMathField(): Promise<unknown> {
    console.log('🔧 [MATHLIVE-LOADER] 创建MathField实例')
    
    const MathfieldElement = await this.loadMathLive()
    const mathField = new MathfieldElement()
    
    console.log('✅ [MATHLIVE-LOADER] MathField实例创建完成')
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
    console.log('📚 [MATHLIVE-LOADER] 执行MathLive库动态导入')
    
    try {
      const mathlive = await import('mathlive')
      console.log('✅ [MATHLIVE-LOADER] MathLive库动态导入成功')
      return mathlive
    } catch (error) {
      console.error('❌ [MATHLIVE-LOADER] MathLive库动态导入失败', error)
      throw new Error(`MathLive库加载失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 重置加载状态
  reset(): void {
    console.log('🔄 [MATHLIVE-LOADER] 重置加载状态')
    
    this.mathLivePromise = null
    this.MathfieldElement = null
    this.isLoaded = false
    
    console.log('✅ [MATHLIVE-LOADER] 加载状态重置完成')
  }
}
