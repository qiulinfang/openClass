import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import type { ChatMessage } from '@/services/ai-chat-service';
import type {
  AiChatAttachment,
  AiChatContext,
  AiChatRole,
} from '../types';
import { AiChatComposer } from './AiChatComposer';
import { AiForwardSelectionToolbar } from './AiForwardSelectionToolbar';
import { AiMessageList } from './AiMessageList';

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
  onInputChange: (value: string) => void;
  onSend: (prompt?: string) => void;
  onStop: () => void;
  onPickImage?: () => void;
  onCreateConversation: () => void;
  onRemoveAttachment: () => void;
  onReselect?: () => void;
  onRoleChange: (role: AiChatRole) => void;
  onToggleWebSearch: () => void;
  editingMessageId: string | null;
  onCancelEdit: () => void;
  onEditMessage: (message: ChatMessage) => void;
  onRetryMessage: (message: ChatMessage) => void;
  onAskTeacher: (messages: ChatMessage[]) => void;
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
  onInputChange,
  onSend,
  onStop,
  onPickImage,
  onCreateConversation,
  onRemoveAttachment,
  onReselect,
  onRoleChange,
  onToggleWebSearch,
  editingMessageId,
  onCancelEdit,
  onEditMessage,
  onRetryMessage,
  onAskTeacher,
}: AiConversationViewProps) {
  const latestCallbacksRef = useRef({
    onInputChange,
    onSend,
    onStop,
    onPickImage,
    onCreateConversation,
    onRemoveAttachment,
    onReselect,
    onRoleChange,
    onToggleWebSearch,
    onCancelEdit,
    onEditMessage,
    onRetryMessage,
    onAskTeacher,
  });
  latestCallbacksRef.current = {
    onInputChange,
    onSend,
    onStop,
    onPickImage,
    onCreateConversation,
    onRemoveAttachment,
    onReselect,
    onRoleChange,
    onToggleWebSearch,
    onCancelEdit,
    onEditMessage,
    onRetryMessage,
    onAskTeacher,
  };

  const [isForwardSelecting, setIsForwardSelecting] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    setIsForwardSelecting(false);
    setSelectedMessageIds(new Set());
  }, [context.scopeKey]);

  const selectedMessages = useMemo(
    () =>
      messages.filter((message) => selectedMessageIds.has(message.id)),
    [messages, selectedMessageIds]
  );

  const send = useCallback((prompt?: string) => {
    latestCallbacksRef.current.onSend(prompt);
  }, []);

  const changeInput = useCallback((value: string) => {
    latestCallbacksRef.current.onInputChange(value);
  }, []);

  const stop = useCallback(() => latestCallbacksRef.current.onStop(), []);
  const pickImage = useCallback(
    () => latestCallbacksRef.current.onPickImage?.(),
    []
  );
  const createConversation = useCallback(
    () => latestCallbacksRef.current.onCreateConversation(),
    []
  );
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

  const toggleForwardMessage = useCallback((messageId: string) => {
    setSelectedMessageIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }, []);

  const beginAskTeacher = useCallback(() => {
    if (messages.length === 0) {
      latestCallbacksRef.current.onAskTeacher([]);
      return;
    }
    setSelectedMessageIds(new Set());
    setIsForwardSelecting(true);
  }, [messages.length]);

  const toggleSelectAll = useCallback(() => {
    setSelectedMessageIds((current) =>
      current.size === messages.length
        ? new Set()
        : new Set(messages.map((message) => message.id))
    );
  }, [messages]);

  const cancelAskTeacher = useCallback(() => {
    setIsForwardSelecting(false);
    setSelectedMessageIds(new Set());
  }, []);

  const confirmAskTeacher = useCallback(() => {
    if (selectedMessages.length === 0) return;
    setIsForwardSelecting(false);
    setSelectedMessageIds(new Set());
    latestCallbacksRef.current.onAskTeacher(selectedMessages);
  }, [selectedMessages]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 6 : 0}
    >
      <AiMessageList
        context={context}
        messages={messages}
        isInitializing={isInitializing}
        isSending={isSending}
        isForwardSelecting={isForwardSelecting}
        selectedMessageIds={selectedMessageIds}
        onSend={send}
        onToggleForwardMessage={toggleForwardMessage}
        onEditMessage={editMessage}
        onRetryMessage={retryMessage}
      />

      {isForwardSelecting ? (
        <AiForwardSelectionToolbar
          selectedCount={selectedMessageIds.size}
          totalCount={messages.length}
          bottomInset={bottomInset}
          onToggleSelectAll={toggleSelectAll}
          onCancel={cancelAskTeacher}
          onConfirm={confirmAskTeacher}
        />
      ) : (
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
          onCreateConversation={createConversation}
          onRemoveAttachment={removeAttachment}
          onReselect={onReselect ? reselect : undefined}
          onRoleChange={changeRole}
          onToggleWebSearch={toggleWebSearch}
          onCancelEdit={cancelEdit}
          onAskTeacher={beginAskTeacher}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
