package com.cosinetech.imates.mq;

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
 * A manager class for RabbitMQ operations in a student-teacher messaging system.
 * Each student has two queues:
 * - userId_q: For messages sent by the student
 * - userId_a: For messages received from teachers
 */
public class RabbitMQManager {
    private static final String HOST = "192.168.40.149";
    private static final int PORT = 5672;
    private static final String USERNAME = "admin";
    private static final String PASSWORD = "admin";
    private static final String VIRTUAL_HOST = "/";

    private final String userId;
    private final String queueNameSend;    // userId_q
    private final String queueNameReceive; // userId_a
    
    private Connection connection;
    private Channel channel;
    
    /**
     * Constructor for RabbitMQManager
     * @param userId The unique ID of the student
     */
    public RabbitMQManager(String userId) {
        this.userId = userId;
        this.queueNameSend = userId + "_q";
        this.queueNameReceive = userId + "_a";
    }
    
    /**
     * Initialize the RabbitMQ connection and create queues
     * @throws IOException If connection fails
     * @throws TimeoutException If connection times out
     */
    public void initialize() throws IOException, TimeoutException {
        ConnectionFactory factory = new ConnectionFactory();
        factory.setHost(HOST);
        factory.setPort(PORT);
        factory.setUsername(USERNAME);
        factory.setPassword(PASSWORD);
        factory.setVirtualHost(VIRTUAL_HOST);
        
        connection = factory.newConnection();
        channel = connection.createChannel();
        
        // Declare both queues with durability to ensure messages aren't lost
        channel.queueDeclare(queueNameSend, true, false, false, null);
        channel.queueDeclare(queueNameReceive, true, false, false, null);
    }
    
    /**
     * Send a message from student to teacher
     * @param message The StudentMessage object to send
     * @return The message ID of the sent message
     * @throws IOException If sending fails
     * @throws JSONException If JSON creation fails
     */
    public String sendMessage(StudentMessage message) throws IOException, JSONException {
        // 设置消息属性，包括72小时的过期时间 (72 * 60 * 60 * 1000 = 259200000 毫秒)
        com.rabbitmq.client.AMQP.BasicProperties properties = 
            new com.rabbitmq.client.AMQP.BasicProperties.Builder()
                .expiration("259200000") // 72小时过期时间，以毫秒为单位的字符串
                .contentType("application/json")
                .deliveryMode(2) // 持久化消息
                .build();
        
        channel.basicPublish("", queueNameSend, properties, 
                            message.toJsonString().getBytes(StandardCharsets.UTF_8));
        
        return message.getMessageId();
    }
    
    /**
     * Create and send a message from student to teacher
     * @param sessionId The session ID for the conversation
     * @param subjectId The subject ID related to the question
     * @param messageType The type of message
     * @param content The content of the message
     * @return The message ID of the sent message
     * @throws IOException If sending fails
     * @throws JSONException If JSON creation fails
     */
    public String sendMessage(String sessionId, String subjectId, int messageType, 
                             String content) throws IOException, JSONException {
        StudentMessage message = new StudentMessage(userId, sessionId, subjectId, 
                                                   messageType, content);
        return sendMessage(message);
    }
    
    /**
     * Start listening for messages from teachers
     * @param messageCallback Callback to handle received messages
     * @throws IOException If listening setup fails
     */
    public void startListeningForTeacherMessages(MessageCallback messageCallback) throws IOException {
        DeliverCallback deliverCallback = (consumerTag, delivery) -> {
            String messageJson = new String(delivery.getBody(), StandardCharsets.UTF_8);
            try {
                JSONObject jsonObject = new JSONObject(messageJson);
                TeacherMessage message = new TeacherMessage(jsonObject);
                
                messageCallback.onMessageReceived(message);
                
                // Acknowledge the message
                channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
            } catch (JSONException | IOException e) {
                e.printStackTrace();
            }
        };
        
        // Start consuming with auto-ack set to false for manual acknowledgment
        channel.basicConsume(queueNameReceive, false, deliverCallback, consumerTag -> {});
    }
    
    /**
     * Close the RabbitMQ connection
     * @throws IOException If closing fails
     * @throws TimeoutException If closing times out
     */
    public void close() throws IOException, TimeoutException {
        if (channel != null && channel.isOpen()) {
            channel.close();
        }
        if (connection != null && connection.isOpen()) {
            connection.close();
        }
    }
    
    /**
     * Interface for message callbacks
     */
    public interface MessageCallback {
        void onMessageReceived(TeacherMessage message);
    }
}

