package com.cosinetech.imates.mq;

import android.os.AsyncTask;
import android.util.Log;

import com.rabbitmq.client.AMQP;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;
import com.rabbitmq.client.DefaultConsumer;
import com.rabbitmq.client.Envelope;

import java.io.IOException;

/**
 * 功能:MQ接收消息工具类
 * 作者:Jin
 * 日期:2024年05月27日
 */
public class ReceiveMessageTask extends AsyncTask<Void, String, Void> {
    @Override
    protected Void doInBackground(Void... voids) {
        RabbitMQHelper helper = new RabbitMQHelper();
        ConnectionFactory factory = helper.getConnectionFactory();
        try (Connection connection = factory.newConnection(); Channel channel = connection.createChannel()) {
            String queueName = "hello";

            // 声明队列
            channel.queueDeclare(queueName, true, false, false, null);

            // 定义消费者
            channel.basicConsume(queueName, false, new DefaultConsumer(channel) {
                @Override
                public void handleDelivery(String consumerTag, Envelope envelope, AMQP.BasicProperties properties, byte[] body) throws IOException {
                    String message = new String(body, "UTF-8");
                    System.out.println(" [x] Received '" + message + "'");

                    // 手动确认消息
                    channel.basicAck(envelope.getDeliveryTag(), false);

                    // 在这里，可以添加处理消息的代码
                    onProgressUpdate(message);
                    //  Log.i("这是啥",message);
                }
            });

            // 保持频道打开以侦听消息。
            synchronized (this) {
                this.wait();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    @Override
    protected void onProgressUpdate(String... messages) {
        // 将您的UI与接收到的消息联合使用
        System.out.println(" [x] Processed '" + messages[0] + "'");
        Log.i("接收的消息为",messages[0]);
    }
}
