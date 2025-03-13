package com.cosinetech.imates.mq;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 单例类，管理RabbitMQ连接和消息收发
 * 自动处理网络异常和重连
 */
public class MessageManager {
    private static final String TAG = "MessageManager";
    private static final int RECONNECT_DELAY_MS = 5000; // 重连延迟5秒
    private static final int MAX_RECONNECT_ATTEMPTS = 10; // 最大重连次数
    
    // 单例实例
    private static MessageManager instance;
    
    // RabbitMQ管理器
    private RabbitMQManager rabbitMQManager;
    private String userId;
    
    // 线程池用于后台任务
    private final ExecutorService executorService;
    
    // 主线程Handler用于回调
    private final Handler mainHandler;
    
    // 状态标志
    private final AtomicBoolean isInitialized = new AtomicBoolean(false);
    private final AtomicBoolean isConnecting = new AtomicBoolean(false);
    private int reconnectAttempts = 0;
    
    // 消息监听器列表
    private final List<MessageListener> messageListeners = new ArrayList<>();
    
    /**
     * 私有构造函数，防止外部实例化
     */
    private MessageManager() {
        executorService = Executors.newCachedThreadPool();
        mainHandler = new Handler(Looper.getMainLooper());
    }
    
    /**
     * 获取单例实例
     */
    public static synchronized MessageManager getInstance() {
        if (instance == null) {
            instance = new MessageManager();
        }
        return instance;
    }
    
    /**
     * 初始化消息管理器
     * @param context 应用上下文
     * @param userId 用户ID
     */
    public void initialize(Context context, String userId) {
        if (isInitialized.get() || isConnecting.get()) {
            Log.d(TAG, "Already initialized or connecting");
            return;
        }
        
        this.userId = userId;
        isConnecting.set(true);
        
        executorService.execute(() -> {
            try {
                Log.d(TAG, "Initializing RabbitMQ connection for user: " + userId);
                rabbitMQManager = new RabbitMQManager(userId);
                rabbitMQManager.initialize();
                
                // 开始监听教师消息
                startListeningForTeacherMessages();
                
                isInitialized.set(true);
                isConnecting.set(false);
                reconnectAttempts = 0;
                
                Log.d(TAG, "RabbitMQ connection initialized successfully");
            } catch (IOException | TimeoutException e) {
                Log.e(TAG, "Failed to initialize RabbitMQ connection", e);
                isConnecting.set(false);
                
                // 尝试重连
                scheduleReconnect();
            }
        });
    }
    
    /**
     * 安排重连任务
     */
    private void scheduleReconnect() {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            Log.e(TAG, "Max reconnect attempts reached. Giving up.");
            return;
        }
        
        reconnectAttempts++;
        Log.d(TAG, "Scheduling reconnect attempt " + reconnectAttempts + " in " + RECONNECT_DELAY_MS + "ms");
        
        mainHandler.postDelayed(() -> {
            if (!isInitialized.get() && !isConnecting.get()) {
                initialize(null, userId);
            }
        }, RECONNECT_DELAY_MS);
    }
    
    /**
     * 开始监听教师消息
     */
    private void startListeningForTeacherMessages() throws IOException {
        rabbitMQManager.startListeningForTeacherMessages(message -> {
            Log.d(TAG, "Received teacher message: " + message.getMessageId());
            
            // 在主线程上通知所有监听器
            mainHandler.post(() -> {
                for (MessageListener listener : messageListeners) {
                    listener.onMessageReceived(message);
                }
            });
        });
    }
    
    /**
     * 添加消息监听器
     * @param listener 消息监听器
     */
    public void addMessageListener(MessageListener listener) {
        if (!messageListeners.contains(listener)) {
            messageListeners.add(listener);
        }
    }
    
    /**
     * 移除消息监听器
     * @param listener 消息监听器
     */
    public void removeMessageListener(MessageListener listener) {
        messageListeners.remove(listener);
    }
    
    /**
     * 发送消息 - 可以从UI线程调用
     * @param message 要发送的学生消息
     * @param callback 发送结果回调
     */
    public void sendMessage(StudentMessage message, SendCallback callback) {
        if (!isInitialized.get()) {
            Log.e(TAG, "Cannot send message: RabbitMQ not initialized");
            if (callback != null) {
                mainHandler.post(() -> callback.onSendResult(false, null, "RabbitMQ not initialized"));
            }
            return;
        }
        
        executorService.execute(() -> {
            try {
                String messageId = rabbitMQManager.sendMessage(message);
                Log.d(TAG, "Message sent successfully: " + messageId);
                
                if (callback != null) {
                    mainHandler.post(() -> callback.onSendResult(true, messageId, null));
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to send message", e);
                
                if (callback != null) {
                    mainHandler.post(() -> callback.onSendResult(false, null, e.getMessage()));
                }
                
                // 如果发送失败，检查是否需要重新连接
                if (e instanceof IOException || e instanceof TimeoutException) {
                    handleConnectionError();
                }
            }
        });
    }
    
    /**
     * 发送消息 - 可以从UI线程调用
     * @param sessionId 会话ID
     * @param subjectId 科目ID
     * @param content 消息内容
     * @param callback 发送结果回调
     */
    public void sendMessage(String sessionId, String subjectId, String content, SendCallback callback) {
        if (userId == null) {
            Log.e(TAG, "Cannot send message: userId is null");
            if (callback != null) {
                mainHandler.post(() -> callback.onSendResult(false, null, "userId is null"));
            }
            return;
        }
        
        StudentMessage message = new StudentMessage(userId, sessionId, subjectId, 0, content);
        sendMessage(message, callback);
    }
    
    /**
     * 处理连接错误
     */
    private void handleConnectionError() {
        isInitialized.set(false);
        
        // 关闭现有连接
        try {
            if (rabbitMQManager != null) {
                rabbitMQManager.close();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error closing RabbitMQ connection", e);
        }
        
        // 尝试重连
        scheduleReconnect();
    }
    
    /**
     * 关闭连接并清理资源
     */
    public void shutdown() {
        executorService.execute(() -> {
            try {
                if (rabbitMQManager != null) {
                    rabbitMQManager.close();
                }
                Log.d(TAG, "RabbitMQ connection closed");
            } catch (IOException | TimeoutException e) {
                Log.e(TAG, "Error closing RabbitMQ connection", e);
            }
        });
        
        // 清理资源
        messageListeners.clear();
        isInitialized.set(false);
    }
    
    /**
     * 消息监听器接口
     */
    public interface MessageListener {
        void onMessageReceived(TeacherMessage message);
    }
    
    /**
     * 发送结果回调接口
     */
    public interface SendCallback {
        void onSendResult(boolean success, String messageId, String errorMessage);
    }
}

