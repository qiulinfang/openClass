package com.cosinetech.imates.models;

import com.cosinetech.imates.views.ChatAiView;

import java.util.UUID;

public class ChatMessage {
    public enum MessageType {
        TEXT(0),
        IMAGE(1),
        VOICE(2),
        DATE(3);

        private final int value;

        MessageType(int value) {
            this.value = value;
        }

        public int getValue() {
            return value;
        }

        public static MessageType fromValue(int value) {
            for (MessageType type : values()) {
                if (type.value == value) {
                    return type;
                }
            }
            throw new IllegalArgumentException("Unknown MessageType value: " + value);
        }
    }

    public long id;  // 数据库自增的ID
    public String messageId; //消息id主键
    public String sessionId; // 所属的ChatSession
    public String content; // 消息内容
    public MessageType type; // 消息类型
    public int  role; // 角色
    public int status; // 预留的消息状态
    public boolean isSelf; // 是自己发送的还是收到的
    public long timestamp; //消息时间戳

    private ChatMessage() {
        this.messageId = "";
        this.content = "";
        this.isSelf = false;
        this.status = 0;
        this.type = MessageType.TEXT;
        this.timestamp = 0;
        this.sessionId = "";
    }

    public ChatMessage(String content, boolean isSelf, MessageType type, String sessionId, long timestamp, ChatAiView.ChatRole role) {
        this.messageId = UUID.randomUUID().toString();
        this.content = content;
        this.isSelf = isSelf;
        this.type = type;
        this.status = 0;
        this.sessionId = sessionId;
        this.timestamp = timestamp;
        this.role = role.ordinal();
    }

    public void appendContent(String newContent) {
        content += newContent;
    }
}

