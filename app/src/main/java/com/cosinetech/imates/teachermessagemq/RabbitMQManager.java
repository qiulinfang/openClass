package com.cosinetech.imates.teachermessagemq;

import android.util.Log;

import com.cosinetech.imates.coreapiservice.ApiUrl;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;
import com.rabbitmq.client.DeliverCallback;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeoutException;

/**
 * 学生端RabbitMQ管理器
 * 实现学生发送消息和接收老师回复
 * RabbitMQ 设计规则：
 * Exchange:
 * ✔ student_teacher_exchange（Direct 类型）
 * Routing Key:
 * ✔ 学生 → 老师：student_route_teacher
 * ✔ 老师 → 学生：teacher_route_student_userId
 * Queue:
 * ✔ 老师的共享队列：TEACHER_Q
 * ✔ 学生的私有队列：userId_a
 */
public class RabbitMQManager {
    private static final String TAG = "RabbitMQManager";

    // RabbitMQ连接参数
    private static final String HOST = ApiUrl.MQ_HOST_BASE;
    private static final int PORT = ApiUrl.MQ_HOST_PORT;
    private static final String USERNAME = "admin";
    private static final String PASSWORD = "admin";
    private static final String VIRTUAL_HOST = "/";

    // Exchange配置
    private static final String EXCHANGE_NAME = "student_teacher_exchange";
    private static final String EXCHANGE_TYPE = "direct";

    // 路由键配置
    private static final String ROUTE_KEY_STUDENT_TO_TEACHER = "student_route_teacher";

    // 队列配置
    private static final String TEACHER_QUEUE_NAME = "QUESTION_RECEIVE_QUEUE";

    private final String userId;
    private final String studentQueueName; // userId_a
    private final String routeKeyTeacherToStudent; // teacher_route_student_userId

    private Connection connection;
    private Channel channel;
    private boolean isConnected = false;

    /**
     * 构造函数
     * @param userId 学生ID
     */
    public RabbitMQManager(String userId) {
        this.userId = userId;
        this.studentQueueName = userId + "_a";
        this.routeKeyTeacherToStudent = "teacher_route_student_" + userId;
    }

    /**
     * 初始化RabbitMQ连接
     * @throws IOException 连接异常
     * @throws TimeoutException 连接超时
     */
    public void initialize() throws IOException, TimeoutException {
        try {
            Log.d(TAG, "Initializing RabbitMQ connection for student: " + userId);
            
            // 验证配置
            if (HOST == null || HOST.isEmpty()) {
                String errorMsg = "RabbitMQ HOST配置未初始化 (HOST is null or empty). 请确保ApiUrl.switchEnv()已被调用";
                Log.e(TAG, errorMsg);
                throw new IllegalStateException(errorMsg);
            }
            
            if (PORT <= 0 || PORT > 65535) {
                String errorMsg = String.format("RabbitMQ PORT配置无效 (PORT=%d). 请确保ApiUrl.switchEnv()已被调用", PORT);
                Log.e(TAG, errorMsg);
                throw new IllegalStateException(errorMsg);
            }
            
            Log.d(TAG, "RabbitMQ配置: HOST=" + HOST + ", PORT=" + PORT + ", USERNAME=" + USERNAME + ", VIRTUAL_HOST=" + VIRTUAL_HOST);

            // 创建连接
            ConnectionFactory factory = new ConnectionFactory();
            factory.setHost(HOST);
            factory.setPort(PORT);
            factory.setUsername(USERNAME);
            factory.setPassword(PASSWORD);
            factory.setVirtualHost(VIRTUAL_HOST);
            factory.setAutomaticRecoveryEnabled(true); // 启用自动重连
            factory.setNetworkRecoveryInterval(5000);  // 重连间隔5秒
            
            Log.d(TAG, "尝试连接到RabbitMQ服务器: " + HOST + ":" + PORT);

            connection = factory.newConnection();
            channel = connection.createChannel();

            // 声明Exchange
            channel.exchangeDeclare(EXCHANGE_NAME, EXCHANGE_TYPE, true);

            // 声明队列参数
//            Map<String, Object> queueArgs = new HashMap<>();
//            queueArgs.put("x-message-ttl", 259200000); // 72小时 = 259200000毫秒

            // 声明教师队列（被动声明，如果不存在则会抛出异常）
//            try {
//                channel.queueDeclarePassive(TEACHER_QUEUE_NAME);
//                Log.d(TAG, "Teacher queue already exists");
//            } catch (IOException e) {
//                // 队列不存在，创建它
//                Log.d(TAG, "Creating teacher queue");
//
//            }
            // 声明教师队列
            channel.queueDeclare(TEACHER_QUEUE_NAME, true, false, false, null);

            // 声明学生接收队列
            channel.queueDeclare(studentQueueName, true, false, false, null);

            // 绑定教师队列到Exchange
            channel.queueBind(TEACHER_QUEUE_NAME, EXCHANGE_NAME, ROUTE_KEY_STUDENT_TO_TEACHER);

            // 绑定学生队列到Exchange
            channel.queueBind(studentQueueName, EXCHANGE_NAME, routeKeyTeacherToStudent);

            isConnected = true;
            Log.d(TAG, "RabbitMQ connection initialized successfully for student: " + userId);
        } catch (IOException | TimeoutException e) {
            Log.e(TAG, "Failed to initialize RabbitMQ connection", e);
            closeConnection();
            throw e; // 重新抛出异常以便上层处理
        }
    }

    /**
     * 发送消息给老师
     * @param message 学生消息对象
     * @return 消息ID
     * @throws IOException 发送异常
     * @throws JSONException JSON处理异常
     * @throws IllegalStateException 连接未初始化异常
     */
    public String sendMessageToTeacher(StudentMessage message)
            throws IOException, JSONException, IllegalStateException {
        String messageId = message != null ? message.getMessageId() : "null";
        String userId = message != null ? message.getUserId() : "null";
        String sessionId = message != null ? message.getSessionId() : "null";
        int messageType = message != null ? message.getMessageType() : -1;
        
        Log.d(TAG, "RabbitMQManager.sendMessageToTeacher: 开始发送消息到RabbitMQ");
        Log.d(TAG, "RabbitMQManager.sendMessageToTeacher: messageId=" + messageId + 
                ", userId=" + userId + ", sessionId=" + sessionId + ", messageType=" + messageType);
        
        if (!isConnected) {
            Log.e(TAG, "RabbitMQManager.sendMessageToTeacher: RabbitMQ连接未初始化");
            throw new IllegalStateException("RabbitMQ connection not initialized");
        }
        
        Log.d(TAG, "RabbitMQManager.sendMessageToTeacher: 连接状态正常, isConnected=" + isConnected);
        Log.d(TAG, "RabbitMQManager.sendMessageToTeacher: connection.isOpen()=" + 
                (connection != null ? connection.isOpen() : "null"));
        Log.d(TAG, "RabbitMQManager.sendMessageToTeacher: channel.isOpen()=" + 
                (channel != null ? channel.isOpen() : "null"));

        // 检查通道和连接是否真的打开
        boolean connectionOpen = connection != null && connection.isOpen();
        boolean channelOpen = channel != null && channel.isOpen();
        
        if (!connectionOpen || !channelOpen) {
            String errorMsg = String.format("RabbitMQ通道已关闭: connection.isOpen()=%s, channel.isOpen()=%s", 
                    connectionOpen, channelOpen);
            Log.e(TAG, "RabbitMQManager.sendMessageToTeacher: " + errorMsg);
            isConnected = false;
            throw new IllegalStateException(errorMsg);
        }

        try {
            // 设置消息属性
            com.rabbitmq.client.AMQP.BasicProperties properties =
                    new com.rabbitmq.client.AMQP.BasicProperties.Builder()
                            .contentType("application/json")
                            .deliveryMode(2) // 持久化消息
                            .expiration("259200000") // 72小时过期时间
                            .build();

            Log.d(TAG, "RabbitMQManager.sendMessageToTeacher: 消息属性设置完成");
            Log.d(TAG, "RabbitMQManager.sendMessageToTeacher: Exchange=" + EXCHANGE_NAME + 
                    ", RoutingKey=" + ROUTE_KEY_STUDENT_TO_TEACHER);

            // 将消息转换为JSON字符串
            String jsonMessage = message.toJsonString();
            int messageSize = jsonMessage.getBytes(StandardCharsets.UTF_8).length;
            Log.d(TAG, "RabbitMQManager.sendMessageToTeacher: JSON消息大小=" + messageSize + " bytes");
            Log.d(TAG, "RabbitMQManager.sendMessageToTeacher: JSON消息预览=" + 
                    (jsonMessage.length() > 200 ? jsonMessage.substring(0, 200) + "..." : jsonMessage));

            // 发布消息到Exchange，使用ROUTE_TO_TEACHER路由键
            long publishStartTime = System.currentTimeMillis();
            channel.basicPublish(
                    EXCHANGE_NAME,
                    ROUTE_KEY_STUDENT_TO_TEACHER,
                    properties,
                    jsonMessage.getBytes(StandardCharsets.UTF_8)
            );
            long publishDuration = System.currentTimeMillis() - publishStartTime;
            
            Log.d(TAG, "RabbitMQManager.sendMessageToTeacher: 消息已发布到RabbitMQ, messageId=" + messageId + 
                    ", 发布耗时=" + publishDuration + "ms");
            Log.d(TAG, "RabbitMQManager.sendMessageToTeacher: 发送成功");
            return message.getMessageId();
        } catch (IOException e) {
            Log.e(TAG, "RabbitMQManager.sendMessageToTeacher: 发送消息到RabbitMQ失败", e);
            Log.e(TAG, "RabbitMQManager.sendMessageToTeacher: IOException - " + e.getMessage());
            
            // 检查连接状态（使用已有的变量检查结果）
            boolean connectionOpenAfterError = connection != null && connection.isOpen();
            boolean channelOpenAfterError = channel != null && channel.isOpen();
            Log.e(TAG, "RabbitMQManager.sendMessageToTeacher: 连接状态检查 - connection.isOpen()=" + 
                    connectionOpenAfterError + ", channel.isOpen()=" + channelOpenAfterError);
            
            if (!connectionOpenAfterError || !channelOpenAfterError) {
                Log.w(TAG, "RabbitMQManager.sendMessageToTeacher: 检测到连接/通道已关闭，更新isConnected状态");
                isConnected = false;
            }
            throw e; // 重新抛出异常以便上层处理
        } catch (JSONException e) {
            Log.e(TAG, "RabbitMQManager.sendMessageToTeacher: JSON序列化失败", e);
            Log.e(TAG, "RabbitMQManager.sendMessageToTeacher: JSONException - " + e.getMessage());
            throw e;
        } catch (IllegalStateException e) {
            Log.e(TAG, "RabbitMQManager.sendMessageToTeacher: 非法状态异常", e);
            Log.e(TAG, "RabbitMQManager.sendMessageToTeacher: IllegalStateException - " + e.getMessage());
            throw e;
        }
    }

    /**
     * 开始监听老师回复
     * @param callback 消息回调
     * @throws IOException 监听异常
     * @throws IllegalStateException 连接未初始化异常
     */
    public void startListeningForTeacherReplies(MessageCallback callback)
            throws IOException, IllegalStateException {
        if (!isConnected) {
            throw new IllegalStateException("RabbitMQ connection not initialized");
        }

        try {
            Log.d(TAG, "Starting to listen for teacher replies on queue: " + studentQueueName);

            DeliverCallback deliverCallback = (consumerTag, delivery) -> {
                String messageJson = new String(delivery.getBody(), StandardCharsets.UTF_8);
                long deliveryTag = delivery.getEnvelope().getDeliveryTag();

                try {
                    JSONObject jsonObject = new JSONObject(messageJson);
                    TeacherMessage message = new TeacherMessage(jsonObject);

                    Log.d(TAG, "Received teacher reply with ID: " + message.getMessageId());

                    // 调用回调 - 使用try-catch包装，防止回调中的异常导致通道关闭
                    try {
                        callback.onMessageReceived(message);
                    } catch (Exception callbackException) {
                        Log.e(TAG, "Error in message callback handler", callbackException);
                        // 回调异常不应该导致消息被拒绝，记录日志即可
                    }

                    // 确认消息 - 无论回调是否成功，都确认消息
                    try {
                        if (channel != null && channel.isOpen()) {
                            channel.basicAck(deliveryTag, false);
                            Log.d(TAG, "Message acknowledged successfully, deliveryTag=" + deliveryTag);
                        } else {
                            Log.w(TAG, "Cannot acknowledge message: channel is closed, deliveryTag=" + deliveryTag);
                        }
                    } catch (IOException ackError) {
                        Log.e(TAG, "Failed to acknowledge message, deliveryTag=" + deliveryTag, ackError);
                    }
                } catch (JSONException e) {
                    Log.e(TAG, "Error parsing teacher reply JSON, deliveryTag=" + deliveryTag, e);
                    Log.e(TAG, "Message content preview: " + 
                            (messageJson.length() > 200 ? messageJson.substring(0, 200) + "..." : messageJson));

                    // 处理解析错误，拒绝消息并不重新入队
                    try {
                        if (channel != null && channel.isOpen()) {
                            channel.basicReject(deliveryTag, false);
                            Log.d(TAG, "Message rejected due to parse error, deliveryTag=" + deliveryTag);
                        } else {
                            Log.w(TAG, "Cannot reject message: channel is closed, deliveryTag=" + deliveryTag);
                        }
                    } catch (IOException rejectError) {
                        Log.e(TAG, "Failed to reject message, deliveryTag=" + deliveryTag, rejectError);
                    }
                } catch (Exception e) {
                    // 捕获所有其他异常，防止通道关闭
                    Log.e(TAG, "Unexpected error processing teacher reply, deliveryTag=" + deliveryTag, e);
                    Log.e(TAG, "Exception type: " + e.getClass().getSimpleName() + ", message: " + e.getMessage());

                    // 尝试拒绝消息
                    try {
                        if (channel != null && channel.isOpen()) {
                            channel.basicReject(deliveryTag, false);
                            Log.d(TAG, "Message rejected due to unexpected error, deliveryTag=" + deliveryTag);
                        } else {
                            Log.w(TAG, "Cannot reject message: channel is closed, deliveryTag=" + deliveryTag);
                        }
                    } catch (Exception rejectError) {
                        Log.e(TAG, "Failed to reject message, deliveryTag=" + deliveryTag, rejectError);
                    }
                }
            };

            // 从学生接收队列消费消息，不自动确认
            channel.basicConsume(studentQueueName, false, deliverCallback, consumerTag -> {
                Log.d(TAG, "Consumer cancelled: " + consumerTag);
            });
        } catch (IOException e) {
            Log.e(TAG, "Failed to start listening for teacher replies", e);
            // 检查连接状态
            if (!connection.isOpen()) {
                isConnected = false;
            }
            throw e; // 重新抛出异常以便上层处理
        }
    }

    /**
     * 关闭连接
     */
    public void closeConnection() {
        try {
            if (channel != null && channel.isOpen()) {
                channel.close();
            }
        } catch (IOException | TimeoutException e) {
            Log.e(TAG, "Error closing channel", e);
        }

        try {
            if (connection != null && connection.isOpen()) {
                connection.close();
            }
        } catch (IOException e) {
            Log.e(TAG, "Error closing connection", e);
        }

        isConnected = false;
        Log.d(TAG, "RabbitMQ connection closed");
    }

    /**
     * 检查连接状态
     * @return 是否已连接
     */
    public boolean isConnected() {
        return isConnected && connection != null && connection.isOpen();
    }

    /**
     * 日志回调接口（用于将日志传递到Web端）
     */
    public interface LogCallback {
        void onLog(String level, String tag, String message);
    }
    
    private LogCallback logCallback;
    
    /**
     * 设置日志回调
     */
    public void setLogCallback(LogCallback callback) {
        this.logCallback = callback;
    }
    
    /**
     * 发送日志（同时输出到Logcat和回调）
     */
    private void sendLog(String level, String tag, String message) {
        // 输出到Android Logcat
        switch (level.toUpperCase()) {
            case "DEBUG":
                Log.d(tag, message);
                break;
            case "INFO":
                Log.i(tag, message);
                break;
            case "WARN":
                Log.w(tag, message);
                break;
            case "ERROR":
                Log.e(tag, message);
                break;
            default:
                Log.i(tag, message);
                break;
        }
        
        // 发送到回调（如果设置了）
        if (logCallback != null) {
            try {
                logCallback.onLog(level, tag, message);
            } catch (Exception e) {
                Log.e(TAG, "日志回调执行失败", e);
            }
        }
    }
    
    /**
     * 消息回调接口
     */
    public interface MessageCallback {
        void onMessageReceived(TeacherMessage message);
    }
}


