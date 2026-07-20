import type { ChatMessage } from '@/services/ai-chat-service';

export type AiChatScene = 'general' | 'textbook' | 'exercise';
export type AiChatWorkspaceTab = 'chat' | 'sessions';
export type AiChatRole = 'mate' | 'mentor' | 'researcher';

export interface AiChatAttachment {
  uri: string;
  dataUrl: string;
  label: string;
  pageNumber?: number;
}

export interface AiChatContext {
  scene: AiChatScene;
  scopeKey: string;
  title: string;
  subtitle?: string;
  resourceId?: string;
  resourceName?: string;
  subject?: string;
  sectionName?: string;
  initialAttachment?: AiChatAttachment | null;
  exerciseQuestion?: {
    id: string;
    content: string;
    answer?: string;
    analysis?: string;
    subject: string;
  };
}

export interface AiChatSession {
  id: string;
  scopeKey: string;
  scene: AiChatScene;
  title: string;
  summary: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  pinned?: boolean;
  thumbnailUri?: string;
  pageNumber?: number;
  resourceName?: string;
  subject?: string;
  sectionName?: string;
}

export interface AiChatConversationState {
  session: AiChatSession | null;
  messages: ChatMessage[];
}
