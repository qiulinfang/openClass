package com.cosinetech.imates.mq;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.cosinetech.imates.models.ChatMessage;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 学生消息管理器 - 单例模式
 * 负责管理 RabbitMQ 连接，发送消息，监听回复
 */
public class MessagingManager {
    private static final String TAG = "MessagingManager";
    private static final int RECONNECT_DELAY_MS = 5000; // 重连间隔
    //private static final int MAX_RECONNECT_ATTEMPTS = 10; // 最大重连次数

    private static MessagingManager instance;
    private RabbitMQManager rabbitMQManager;
    private String userId;

    private final ExecutorService executorService;
    private final Handler mainHandler;
    private final AtomicBoolean isInitialized = new AtomicBoolean(false);
    private final AtomicBoolean isConnecting = new AtomicBoolean(false);
    private int reconnectAttempts = 0;

    private final List<MessageListener> messageListeners = new ArrayList<>();

    private MessagingManager() {
        executorService = Executors.newCachedThreadPool();
        mainHandler = new Handler(Looper.getMainLooper());
    }

    public static synchronized MessagingManager getInstance() {
        if (instance == null) {
            instance = new MessagingManager();
        }
        return instance;
    }

    public void initialize(Context context, String userId) {
        if (isInitialized.get() || isConnecting.get()) {
            Log.d(TAG, "Already initialized or connecting");
            return;
        }

        this.userId = userId;
        isConnecting.set(true);

        executorService.execute(() -> {
            try {
                Log.d(TAG, "Initializing messaging manager for user: " + userId);
                rabbitMQManager = new RabbitMQManager(userId);
                rabbitMQManager.initialize();

                // 监听老师回复
                rabbitMQManager.startListeningForTeacherReplies(message -> {
                    Log.d(TAG, "Received teacher message: " + message.getMessageId());
                    ChatMessage chatMsg = message.toChatMessage();
                    mainHandler.post(() -> {
                        for (MessageListener listener : messageListeners) {
                            listener.onTeacherMessageReceived(chatMsg);
                        }
                    });
                });

                isInitialized.set(true);
                isConnecting.set(false);
                reconnectAttempts = 0;
                Log.d(TAG, "Messaging manager initialized successfully");
            } catch (IOException | TimeoutException e) {
                Log.e(TAG, "Failed to initialize messaging manager", e);
                isConnecting.set(false);
                scheduleReconnect();
            }
        });
    }

    private void scheduleReconnect() {
//        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
//            Log.e(TAG, "Max reconnect attempts reached. Giving up.");
//            return;
//        }

        reconnectAttempts++;
        Log.d(TAG, "Scheduling reconnect attempt " + reconnectAttempts + " in " + RECONNECT_DELAY_MS + "ms");

        mainHandler.postDelayed(() -> {
            if (!isInitialized.get() && !isConnecting.get()) {
                initialize(null, userId);
            }
        }, RECONNECT_DELAY_MS);
    }

    public void sendMessageToTeacher(StudentMessage message, SendCallback callback) {
        if (!isInitialized.get()) {
            Log.e(TAG, "Cannot send message: Manager not initialized");
            if (callback != null) {
                mainHandler.post(() -> callback.onSendResult(false, null, "Manager not initialized"));
            }
            return;
        }

        executorService.execute(() -> {
            try {
                String messageId = rabbitMQManager.sendMessageToTeacher(message);
                Log.d(TAG, "Message sent successfully: " + messageId);

                if (callback != null) {
                    mainHandler.post(() -> callback.onSendResult(true, messageId, null));
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to send message", e);
                if (callback != null) {
                    mainHandler.post(() -> callback.onSendResult(false, null, e.getMessage()));
                }
                if (e instanceof IOException || e instanceof IllegalStateException) {
                    handleConnectionError();
                }
            }
        });
    }

    private void handleConnectionError() {
        if (rabbitMQManager != null && !rabbitMQManager.isConnected()) {
            isInitialized.set(false);
            rabbitMQManager.closeConnection();
            scheduleReconnect();
        }
    }

    public void addMessageListener(MessageListener listener) {
        if (!messageListeners.contains(listener)) {
            messageListeners.add(listener);
        }
    }

    public void removeMessageListener(MessageListener listener) {
        messageListeners.remove(listener);
    }

    public void shutdown() {
        if (rabbitMQManager != null) {
            rabbitMQManager.closeConnection();
        }
        messageListeners.clear();
        isInitialized.set(false);
        Log.d(TAG, "MessagingManager shutdown");
    }

    public boolean isInitialized() {
        return isInitialized.get();
    }

    public interface MessageListener {
        void onTeacherMessageReceived(ChatMessage message);
    }

    public interface SendCallback {
        void onSendResult(boolean success, String messageId, String errorMessage);
    }
}
