package com.cosinetech.imates.models;

import com.cosinetech.imates.util.TimeUtils;

public class ChatMessage {
    public static final int TYPE_TEXT = 0;
    public static final int TYPE_IMAGE = 1;
    public static final int TYPE_VOICE = 2;
    public static final int TYPE_DATE = 3;

    public long id;  // 数据库自增的ID
    public String sessionId; //主键
    public String content;
    public int type; //消息类型: 0:文本  1:图片 2:语音 3:日期(用于分割对话)
    public boolean isSelf; // 是自己发送的还是收到的
    public long timestamp; //消息时间戳

    public boolean isHistory; // 是否是加载的历史消息
    public int currentDisplayCharIndex;  //流式显示的字符索引

    public ChatMessage() {
        this.content = "";
        this.isSelf = false;
        this.type = TYPE_TEXT;
        this.timestamp =  0;
        this.sessionId = "";

        this.isHistory = false;
        this.currentDisplayCharIndex = 0;
    }

    public ChatMessage(String content, boolean isSelf, int type, boolean isHistory, String sessionId, long timestamp) {
        this.content = content;
        this.isSelf = isSelf;
        this.type = type;
        this.isHistory = isHistory;
        this.currentDisplayCharIndex = 0;
        this.timestamp =  timestamp;
        this.sessionId = sessionId;
    }

    public void appendContent(String newContent) {
        content += newContent;
    }

}

