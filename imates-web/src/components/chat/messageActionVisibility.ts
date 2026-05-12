export interface MessageActionVisibilityMessage {
  sender?: string | null
  id?: string | null
  content?: string | null
  isError?: boolean
  isStreaming?: boolean
}

export interface MessageActionVisibilityOptions {
  showActionButtons: boolean
  type: 'ai-general' | 'ai-exercise' | 'ai-homework' | 'ai-textbook' | 'teacher' | 'user-client'
  sender?: string | null
  isLastMessage: boolean
  isLastUserMessage: boolean
  messageId?: string | null
  content?: string | null
  isError?: boolean
  isStreaming?: boolean
}

export const findLastUserMessageIndex = (messages: MessageActionVisibilityMessage[]): number => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.sender === 'user') {
      return index
    }
  }

  return -1
}

export const canEditUserMessage = ({
  sender,
  isLastUserMessage,
}: Pick<MessageActionVisibilityOptions, 'sender' | 'isLastUserMessage'>): boolean => {
  return sender === 'user' && isLastUserMessage
}

export const shouldShowMessageActionButtons = ({
  showActionButtons,
  type,
  sender,
  isLastMessage,
  isLastUserMessage,
  messageId,
  content,
  isError,
  isStreaming,
}: MessageActionVisibilityOptions): boolean => {
  if (!showActionButtons) {
    return false
  }

  if (type === 'teacher') {
    return false
  }

  if (messageId?.startsWith('welcome_')) {
    return false
  }

  if (sender === 'user') {
    return isLastUserMessage
  }

  const hasContentOrError = !!content || !!isError
  return isLastMessage && !isStreaming && hasContentOrError
}
