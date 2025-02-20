package com.cosinetech.imates.models;

public class ChatMessageSession {
    public long id;  // 数据库自增的ID
    public String sessionId; //主键
    public String catalogId;
    public String sessionName;
    public int type; // 0表示和AI对话的消息; 1表示和老师对话的消息
    public long lastMessageTime; // 最后一次阅读消息的时间戳
    public long  createTime;
    public long  updateTime;
}
