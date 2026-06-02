import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Sender, type ChatBubble } from '../types';
import { getImWebSocketUrl, getImBaseUrl } from '../config/env-config';
import { useUserStore } from './userStore';
import { authService } from '../services/auth-service';

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatBubble[]>([]);
  const isConnected = ref(false);
  const isSending = ref(false);
  const socketTask = ref<any>(null);
  
  const userStore = useUserStore();

  const connect = async () => {
    if (isConnected.value) return;

    try {
      const userId = userStore.userId;
      if (!userId) return;

      // Use authService to ensure tokens are valid
      // In a real scenario, we might need a specific IM token
      const authUrl = `${getImBaseUrl()}/api/auth/user-login`;
      
      const authRes = await uni.request({
        url: authUrl,
        method: 'POST',
        header: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: `userId=${encodeURIComponent(userId)}`
      });

      const authData = authRes.data as any;
      if (!authData || !authData.success) {
        console.error('IM Auth failed', authData);
        return;
      }

      const imToken = authData.data.token;
      const wsUrl = `${getImWebSocketUrl()}?token=${encodeURIComponent(imToken)}&role=user`;

      socketTask.value = uni.connectSocket({
        url: wsUrl,
        complete: () => {}
      });

      uni.onSocketOpen(() => {
        isConnected.value = true;
        console.log('WebSocket connected');
      });

      uni.onSocketMessage((res) => {
        try {
          const msg = JSON.parse(res.data as string);
          if (msg.type === 'CHAT') {
            addReceivedMessage(msg);
          }
        } catch (e) {
          console.error('Parse WS message failed', e);
        }
      });

      uni.onSocketClose(() => {
        isConnected.value = false;
        socketTask.value = null;
      });

      uni.onSocketError((err) => {
        console.error('WebSocket error', err);
        isConnected.value = false;
      });

    } catch (error) {
      console.error('Connect failed', error);
    }
  };

  const disconnect = () => {
    if (socketTask.value) {
      uni.closeSocket();
    }
    isConnected.value = false;
  };

  const sendMessage = (content: string) => {
    if (!content.trim() || !socketTask.value || !isConnected.value) return;

    const messageId = `msg_${Date.now()}`;
    const payload = {
      type: 'CHAT',
      content,
      timestamp: new Date().toISOString(),
      from: userStore.userId,
      to: 'Agent_007',
      messageId,
      conversationId: `user-client-session-${userStore.userId}`
    };

    socketTask.value.send({
      data: JSON.stringify(payload),
      success: () => {
        addSentMessage(payload);
      }
    });
  };

  const addSentMessage = (msg: any) => {
    messages.value.push({
      id: msg.messageId,
      sender: Sender.USER,
      type: Sender.USER,
      content: msg.content,
      timestamp: msg.timestamp,
      sessionId: msg.conversationId,
    });
  };

  const addReceivedMessage = (msg: any) => {
    messages.value.push({
      id: msg.messageId || `msg_${Date.now()}`,
      sender: Sender.TEACHER,
      type: Sender.TEACHER,
      content: msg.content,
      timestamp: msg.timestamp || new Date().toISOString(),
      sessionId: msg.conversationId || '',
    });
  };

  return {
    messages,
    isConnected,
    isSending,
    connect,
    sendMessage,
  };
});
