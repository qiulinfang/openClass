package com.cosinetech.imates.teachermessagemq;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.cosinetech.imates.data.models.ChatMessage;

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
        Log.d(TAG, "initialize: 被调用, userId=" + userId + ", context=" + (context != null ? "可用" : "null"));
        Log.d(TAG, "initialize: 当前状态 - isInitialized=" + isInitialized.get() + ", isConnecting=" + isConnecting.get());
        
        if (isInitialized.get()) {
            Log.d(TAG, "initialize: 已经初始化，跳过");
            return;
        }
        
        if (isConnecting.get()) {
            Log.d(TAG, "initialize: 正在初始化中，跳过重复调用");
            return;
        }

        this.userId = userId;
        isConnecting.set(true);
        Log.d(TAG, "initialize: 设置isConnecting=true，提交到线程池执行");

        executorService.execute(() -> {
            long startTime = System.currentTimeMillis();
            try {
                Log.d(TAG, "initialize: [线程池] 开始初始化MessagingManager, userId=" + userId);
                
                Log.d(TAG, "initialize: [线程池] 创建RabbitMQManager实例");
                rabbitMQManager = new RabbitMQManager(userId);
                
                Log.d(TAG, "initialize: [线程池] 调用RabbitMQManager.initialize()");
                rabbitMQManager.initialize();
                Log.d(TAG, "initialize: [线程池] RabbitMQManager.initialize()完成");

                // 监听老师回复
                Log.d(TAG, "initialize: [线程池] 开始监听老师回复");
                rabbitMQManager.startListeningForTeacherReplies(message -> {
                    Log.d(TAG, "initialize: [回调线程] 收到老师消息, messageId=" + message.getMessageId());
                    try {
                        ChatMessage chatMsg = message.toChatMessage();
                        if (chatMsg == null) {
                            Log.e(TAG, "initialize: [回调线程] toChatMessage() returned null, messageId=" + message.getMessageId() + ", type=" + message.getMessageType());
                            return; // 跳过此消息
                        }
                        mainHandler.post(() -> {
                            Log.d(TAG, "initialize: [主线程] 分发老师消息到" + messageListeners.size() + "个监听器");
                            for (MessageListener listener : messageListeners) {
                                listener.onTeacherMessageReceived(chatMsg);
                            }
                        });
                    } catch (Exception e) {
                        Log.e(TAG, "initialize: [回调线程] Error converting teacher message to ChatMessage, messageId=" + message.getMessageId(), e);
                        // 不抛出异常，避免影响消息监听
                    }
                });
                Log.d(TAG, "initialize: [线程池] 监听老师回复设置完成");

                isInitialized.set(true);
                isConnecting.set(false);
                reconnectAttempts = 0;
                
                long duration = System.currentTimeMillis() - startTime;
                Log.d(TAG, "initialize: [线程池] MessagingManager初始化成功, 耗时=" + duration + "ms");
            } catch (IllegalStateException e) {
                long duration = System.currentTimeMillis() - startTime;
                Log.e(TAG, "initialize: [线程池] 初始化失败 - 配置未初始化, 耗时=" + duration + "ms", e);
                Log.e(TAG, "initialize: [线程池] IllegalStateException消息=" + e.getMessage());
                isConnecting.set(false);
                // 配置未初始化时不立即重试，等待配置初始化完成
                // 延迟更长时间重试，给配置初始化留出时间
                reconnectAttempts++;
                Log.w(TAG, "RabbitMQ配置未初始化，延迟30秒后重试（等待配置初始化完成）");
                mainHandler.postDelayed(() -> {
                    if (!isInitialized.get() && !isConnecting.get()) {
                        Log.d(TAG, "配置初始化等待完成，重新尝试初始化MessagingManager");
                        initialize(context, userId);
                    }
                }, 30000); // 30秒后重试
            } catch (IOException e) {
                long duration = System.currentTimeMillis() - startTime;
                Log.e(TAG, "initialize: [线程池] 初始化失败 - IOException, 耗时=" + duration + "ms", e);
                Log.e(TAG, "initialize: [线程池] IOException消息=" + e.getMessage());
                isConnecting.set(false);
                scheduleReconnect();
            } catch (TimeoutException e) {
                long duration = System.currentTimeMillis() - startTime;
                Log.e(TAG, "initialize: [线程池] 初始化失败 - TimeoutException, 耗时=" + duration + "ms", e);
                Log.e(TAG, "initialize: [线程池] TimeoutException消息=" + e.getMessage());
                isConnecting.set(false);
                scheduleReconnect();
            } catch (Exception e) {
                long duration = System.currentTimeMillis() - startTime;
                Log.e(TAG, "initialize: [线程池] 初始化失败 - 未知异常, 耗时=" + duration + "ms", e);
                Log.e(TAG, "initialize: [线程池] 异常类型=" + e.getClass().getSimpleName() + ", 消息=" + e.getMessage());
                isConnecting.set(false);
                scheduleReconnect();
            }
        });
        
        Log.d(TAG, "initialize: 已提交到线程池，方法返回");
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
        String messageId = message != null ? message.getMessageId() : "null";
        String userId = message != null ? message.getUserId() : "null";
        int messageType = message != null ? message.getMessageType() : -1;
        
        Log.d(TAG, "sendMessageToTeacher: 开始发送消息");
        Log.d(TAG, "sendMessageToTeacher: messageId=" + messageId + 
                ", userId=" + userId + ", messageType=" + messageType);
        
        if (!isInitialized.get()) {
            Log.e(TAG, "sendMessageToTeacher: Manager未初始化，无法发送消息");
            if (callback != null) {
                mainHandler.post(() -> {
                    Log.d(TAG, "sendMessageToTeacher: 执行回调 - 失败（未初始化）");
                    callback.onSendResult(false, null, "Manager not initialized");
                });
            }
            return;
        }
        
        Log.d(TAG, "sendMessageToTeacher: Manager已初始化，提交到线程池执行");

        executorService.execute(() -> {
            long startTime = System.currentTimeMillis();
            try {
                Log.d(TAG, "sendMessageToTeacher: [线程池] 开始调用RabbitMQManager发送消息");
                String resultMessageId = rabbitMQManager.sendMessageToTeacher(message);
                long duration = System.currentTimeMillis() - startTime;
                Log.d(TAG, "sendMessageToTeacher: [线程池] 消息发送成功, messageId=" + resultMessageId + 
                        ", 耗时=" + duration + "ms");

                if (callback != null) {
                    mainHandler.post(() -> {
                        Log.d(TAG, "sendMessageToTeacher: [主线程] 执行回调 - 成功, messageId=" + resultMessageId);
                        callback.onSendResult(true, resultMessageId, null);
                    });
                }
            } catch (Exception e) {
                long duration = System.currentTimeMillis() - startTime;
                Log.e(TAG, "sendMessageToTeacher: [线程池] 发送消息失败, 耗时=" + duration + "ms", e);
                Log.e(TAG, "sendMessageToTeacher: [线程池] 异常类型=" + e.getClass().getSimpleName() + 
                        ", 异常消息=" + e.getMessage());
                
                // 检查是否是通道关闭错误
                boolean isChannelClosed = e.getMessage() != null && 
                        (e.getMessage().contains("channel is already closed") ||
                         e.getMessage().contains("通道已关闭") ||
                         e.getMessage().contains("connection not initialized"));
                
                if (callback != null) {
                    String errorMsg = e.getMessage() != null ? e.getMessage() : "Unknown error";
                    mainHandler.post(() -> {
                        Log.d(TAG, "sendMessageToTeacher: [主线程] 执行回调 - 失败, error=" + errorMsg);
                        callback.onSendResult(false, null, errorMsg);
                    });
                }
                
                // 如果是连接或通道错误，触发重连
                if (e instanceof IOException || e instanceof IllegalStateException || isChannelClosed) {
                    Log.w(TAG, "sendMessageToTeacher: [线程池] 检测到连接/通道错误，触发重连处理");
                    handleConnectionError();
                }
            }
        });
    }

    private void handleConnectionError() {
        Log.d(TAG, "handleConnectionError: 开始处理连接错误");
        Log.d(TAG, "handleConnectionError: isInitialized=" + isInitialized.get() + 
                ", rabbitMQManager=" + (rabbitMQManager != null ? "存在" : "null"));
        
        // 如果已经初始化但连接状态异常，重置状态并重连
        if (isInitialized.get()) {
            Log.w(TAG, "handleConnectionError: 检测到已初始化但连接异常，重置状态并重连");
            isInitialized.set(false);
            if (rabbitMQManager != null) {
                rabbitMQManager.closeConnection();
            }
            scheduleReconnect();
        } else if (rabbitMQManager != null && !rabbitMQManager.isConnected()) {
            Log.w(TAG, "handleConnectionError: 连接未建立，关闭连接并重连");
            rabbitMQManager.closeConnection();
            scheduleReconnect();
        } else {
            Log.d(TAG, "handleConnectionError: 连接状态正常或RabbitMQManager为null，无需重连");
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
        new Thread(() -> {
            if (rabbitMQManager != null) {
                rabbitMQManager.closeConnection();
            }
            messageListeners.clear();
            isInitialized.set(false);
            Log.d(TAG, "MessagingManager shutdown");
        }).start();
//
//        if (rabbitMQManager != null) {
//            rabbitMQManager.closeConnection();
//        }
//        messageListeners.clear();
//        isInitialized.set(false);
//        Log.d(TAG, "MessagingManager shutdown");
    }

    public boolean isInitialized() {
        return isInitialized.get();
    }

    public boolean isConnecting() {
        return isConnecting.get();
    }

    public interface MessageListener {
        void onTeacherMessageReceived(ChatMessage message);
    }

    public interface SendCallback {
        void onSendResult(boolean success, String messageId, String errorMessage);
    }
}
