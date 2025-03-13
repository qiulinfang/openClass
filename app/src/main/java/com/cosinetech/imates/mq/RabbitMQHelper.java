package com.cosinetech.imates.mq;

import com.rabbitmq.client.ConnectionFactory;

public class RabbitMQHelper {
    //队列名称
    public static String QUEUE_NAME = "***";
    //MQ地址
    public static final String HOST = "0.0.0.0";
    //MQ端口号
    public static final int PORT = 5672;
    //MQ账号
    public static final String USERNAME = "admin";
    //MQ密码
    public static final String PASSWORD = "*********";

    public ConnectionFactory getConnectionFactory() {
        ConnectionFactory factory = new ConnectionFactory();
        factory.setHost(HOST);
        factory.setPort(PORT);
        factory.setUsername(USERNAME);
        factory.setPassword(PASSWORD);
        return factory;
    }
}
