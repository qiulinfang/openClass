export function validateKnowledgeTopicAndAck2Request(request: { bmNoList?: string[]; exercisesId?: string }): void {
  if (!request.bmNoList || !Array.isArray(request.bmNoList) || request.bmNoList.length === 0) {
    throw new Error('bmNoList 不能为空')
  }
}
