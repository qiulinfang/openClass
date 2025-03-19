package com.cosinetech.imates.mq;

import android.util.Log;

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
    private static final String HOST = "www.imates.com.cn";
    private static final int PORT = 5673;
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

            // 创建连接
            ConnectionFactory factory = new ConnectionFactory();
            factory.setHost(HOST);
            factory.setPort(PORT);
            factory.setUsername(USERNAME);
            factory.setPassword(PASSWORD);
            factory.setVirtualHost(VIRTUAL_HOST);
            factory.setAutomaticRecoveryEnabled(true); // 启用自动重连
            factory.setNetworkRecoveryInterval(5000);  // 重连间隔5秒

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
        if (!isConnected) {
            throw new IllegalStateException("RabbitMQ connection not initialized");
        }

        try {
            // 设置消息属性
            com.rabbitmq.client.AMQP.BasicProperties properties =
                    new com.rabbitmq.client.AMQP.BasicProperties.Builder()
                            .contentType("application/json")
                            .deliveryMode(2) // 持久化消息
                            .expiration("259200000") // 72小时过期时间
                            .build();

            // 发布消息到Exchange，使用ROUTE_TO_TEACHER路由键
            channel.basicPublish(
                    EXCHANGE_NAME,
                    ROUTE_KEY_STUDENT_TO_TEACHER,
                    properties,
                    message.toJsonString().getBytes(StandardCharsets.UTF_8)
            );

            Log.d(TAG, "Message sent to teacher with ID: " + message.getMessageId());
            return message.getMessageId();
        } catch (IOException e) {
            Log.e(TAG, "Failed to send message to teacher", e);
            // 检查连接状态
            if (!connection.isOpen()) {
                isConnected = false;
            }
            throw e; // 重新抛出异常以便上层处理
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

                try {
                    JSONObject jsonObject = new JSONObject(messageJson);
                    TeacherMessage message = new TeacherMessage(jsonObject);

                    Log.d(TAG, "Received teacher reply with ID: " + message.getMessageId());

                    // 调用回调
                    callback.onMessageReceived(message);

                    // 确认消息
                    channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
                } catch (JSONException | IOException e) {
                    Log.e(TAG, "Error processing teacher reply", e);

                    // 处理解析错误，拒绝消息并不重新入队
                    try {
                        channel.basicReject(delivery.getEnvelope().getDeliveryTag(), false);
                    } catch (IOException rejectError) {
                        Log.e(TAG, "Failed to reject message", rejectError);
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
     * 消息回调接口
     */
    public interface MessageCallback {
        void onMessageReceived(TeacherMessage message);
    }
}


