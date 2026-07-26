import { request } from '@/utils/request'
import { getApiPaths } from '@/config/env-config'

export interface KnowledgeNode {
  id: string
  name: string
  label?: string
  children?: KnowledgeNode[]
  [key: string]: any
}

export class KnowledgeApi {
  /**
   * 获取生物/通用知识图谱大纲与确认节点
   */
  static async getKnowledgeTopicAndAck(params?: any): Promise<KnowledgeNode[]> {
    const paths = getApiPaths()
    try {
      const res = await request<any>({
        url: paths.xueban.biologyTopicKnowledge.knowledgeTopicAndAck,
        method: 'GET',
        data: params
      })
      const list = res?.data || res || []
      return Array.isArray(list) ? list : []
    } catch (e) {
      console.warn('[KnowledgeApi] 获取知识图谱数据失败:', e)
      return []
    }
  }
}
