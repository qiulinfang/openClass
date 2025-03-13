package com.cosinetech.imates.mq;

import android.os.AsyncTask;
import android.util.Log;

import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;

/**
 * 功能:MQ发送消息工具类
 * 作者:Jin
 * 日期:2024年05月27日
 */
public class SendMessageTask extends AsyncTask<String, Void, Void> {
    @Override
    protected Void doInBackground(String... messages) {
        RabbitMQHelper helper = new RabbitMQHelper();
        ConnectionFactory factory = helper.getConnectionFactory();
        try (Connection connection = factory.newConnection(); Channel channel = connection.createChannel()) {
            String exchangeName = "my_exchange";
            String routingKey = "my_routing_key";
            String queueName = "hello";

            // 声明交换和停止，并约束他们
            channel.exchangeDeclare(exchangeName, "direct", true);  // durable exchange
            channel.queueDeclare(queueName, true, false, false, null);  // durable queue
            channel.queueBind(queueName, exchangeName, routingKey);

            // 以持久模式发布消息
            String message = messages[0];
            channel.basicPublish(exchangeName, routingKey,
                    new com.rabbitmq.client.AMQP.BasicProperties.Builder()
                            .deliveryMode(2)  // make message persistent
                            .build(),
                    message.getBytes("UTF-8"));
            System.out.println(" [x] Sent '" + message + "'");
            Log.i("发送的消息是",message);
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }
}
