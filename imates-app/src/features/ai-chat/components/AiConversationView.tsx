import React, { useCallback, useRef } from 'react';
import type { ChatMessage } from '@/services/ai-chat-service';
import type {
  AiChatAttachment,
  AiChatContext,
  AiChatRole,
} from '../types';
import { AiChatComposer } from './AiChatComposer';
import { AiMessageList } from './AiMessageList';
import {
  ChatKeyboardAvoidingView,
  type ChatKeyboardAvoidanceMode,
} from './ChatKeyboardAvoidingView';

const EMPTY_SELECTED_MESSAGE_IDS = new Set<string>();
const ignoreForwardToggle = () => undefined;

interface AiConversationViewProps {
  context: AiChatContext;
  messages: ChatMessage[];
  inputText: string;
  attachment: AiChatAttachment | null;
  isInitializing: boolean;
  isSending: boolean;
  role: AiChatRole;
  enableWebSearch: boolean;
  bottomInset: number;
  keyboardAvoidanceMode: ChatKeyboardAvoidanceMode;
  onInputChange: (value: string) => void;
  onSend: (prompt?: string) => void;
  onStop: () => void;
  onPickImage?: (source: 'camera' | 'library') => void;
  onRemoveAttachment: () => void;
  onReselect?: () => void;
  onRoleChange: (role: AiChatRole) => void;
  onToggleWebSearch: () => void;
  editingMessageId: string | null;
  onCancelEdit: () => void;
  onEditMessage: (message: ChatMessage) => void;
  onRetryMessage: (message: ChatMessage) => void;
}

export function AiConversationView({
  context,
  messages,
  inputText,
  attachment,
  isInitializing,
  isSending,
  role,
  enableWebSearch,
  bottomInset,
  keyboardAvoidanceMode,
  onInputChange,
  onSend,
  onStop,
  onPickImage,
  onRemoveAttachment,
  onReselect,
  onRoleChange,
  onToggleWebSearch,
  editingMessageId,
  onCancelEdit,
  onEditMessage,
  onRetryMessage,
}: AiConversationViewProps) {
  const latestCallbacksRef = useRef({
    onInputChange,
    onSend,
    onStop,
    onPickImage,
    onRemoveAttachment,
    onReselect,
    onRoleChange,
    onToggleWebSearch,
    onCancelEdit,
    onEditMessage,
    onRetryMessage,
  });
  latestCallbacksRef.current = {
    onInputChange,
    onSend,
    onStop,
    onPickImage,
    onRemoveAttachment,
    onReselect,
    onRoleChange,
    onToggleWebSearch,
    onCancelEdit,
    onEditMessage,
    onRetryMessage,
  };

  const send = useCallback((prompt?: string) => {
    latestCallbacksRef.current.onSend(prompt);
  }, []);

  const changeInput = useCallback((value: string) => {
    latestCallbacksRef.current.onInputChange(value);
  }, []);

  const stop = useCallback(() => latestCallbacksRef.current.onStop(), []);
  const pickImage = useCallback((source: 'camera' | 'library') => {
    latestCallbacksRef.current.onPickImage?.(source);
  }, []);
  const removeAttachment = useCallback(
    () => latestCallbacksRef.current.onRemoveAttachment(),
    []
  );
  const reselect = useCallback(
    () => latestCallbacksRef.current.onReselect?.(),
    []
  );
  const changeRole = useCallback(
    (nextRole: AiChatRole) => latestCallbacksRef.current.onRoleChange(nextRole),
    []
  );
  const toggleWebSearch = useCallback(
    () => latestCallbacksRef.current.onToggleWebSearch(),
    []
  );
  const cancelEdit = useCallback(
    () => latestCallbacksRef.current.onCancelEdit(),
    []
  );

  const editMessage = useCallback((message: ChatMessage) => {
    latestCallbacksRef.current.onEditMessage(message);
  }, []);

  const retryMessage = useCallback((message: ChatMessage) => {
    latestCallbacksRef.current.onRetryMessage(message);
  }, []);

  return (
    <ChatKeyboardAvoidingView mode={keyboardAvoidanceMode}>
      <AiMessageList
        context={context}
        messages={messages}
        isInitializing={isInitializing}
        isSending={isSending}
        isForwardSelecting={false}
        selectedMessageIds={EMPTY_SELECTED_MESSAGE_IDS}
        onSend={send}
        onToggleForwardMessage={ignoreForwardToggle}
        onEditMessage={editMessage}
        onRetryMessage={retryMessage}
      />
      <AiChatComposer
        context={context}
        inputText={inputText}
        attachment={attachment}
        isSending={isSending}
        role={role}
        enableWebSearch={enableWebSearch}
        bottomInset={bottomInset}
        editingMessageId={editingMessageId}
        onInputChange={changeInput}
        onSend={send}
        onStop={stop}
        onPickImage={onPickImage ? pickImage : undefined}
        onRemoveAttachment={removeAttachment}
        onReselect={onReselect ? reselect : undefined}
        onRoleChange={changeRole}
        onToggleWebSearch={toggleWebSearch}
        onCancelEdit={cancelEdit}
      />
    </ChatKeyboardAvoidingView>
  );
}
