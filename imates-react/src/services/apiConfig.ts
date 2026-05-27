const isDev = import.meta.env.DEV

export const API_PATHS = {
  ai: {
    base: isDev ? '/xb-test/ai' : '/xb-release/ai',
    chats: isDev ? '/xb-test/ai/2.0/chats' : '/xb-release/ai/2.0/chats',
    previewPictureQA: isDev ? '/xb-test/ai/2.0/previewPictureQA' : '/xb-release/ai/2.0/previewPictureQA',
    chat: isDev ? '/xb-test/ai/2.0/chat' : '/xb-release/ai/2.0/chat',
    chatMath: isDev ? '/xb-test/ai/2.0/chatMath' : '/xb-release/ai/2.0/chatMath',
  },
  yanban: {
    base: isDev ? '/xb-test' : '/xb-release',
    teacher: {
      wsPath: '/ws',
    },
  },
}

export const getAiChatUrl = (useScreenshot = false) => {
  return useScreenshot 
    ? API_PATHS.ai.previewPictureQA 
    : API_PATHS.ai.chats
}

export const getAiExerciseUrl = (subject: 'MATH' | 'BIOLOGY' = 'BIOLOGY') => {
  const path = subject === 'MATH' ? API_PATHS.ai.chatMath : API_PATHS.ai.chat
  return path
}
