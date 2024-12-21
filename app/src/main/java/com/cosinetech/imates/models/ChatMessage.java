package com.cosinetech.imates.models;

import com.cosinetech.imates.util.TimeUtils;

public class ChatMessage {
    public static final int TYPE_TEXT = 0;
    public static final int TYPE_IMAGE = 1;
    public static final int TYPE_VOICE = 2;
    public static final int TYPE_DATE = 3;

    public String date;
    public String subject;
    public String content;
    public String sessionId;
    public int type;
    public boolean isSelf;
    public long timestamp;
    public boolean isHistory; // 是否是加载的历史消息
    public int currentDisplayCharIndex;  //流式显示的字符索引

    public ChatMessage(String content, boolean isSelf, int type, boolean isHistory, String sessionId) {
        this.content = content;
        this.isSelf = isSelf;
        this.type = type;
        this.isHistory = isHistory;
        this.currentDisplayCharIndex = 0;
        this.timestamp =  System.currentTimeMillis();
        this.date = TimeUtils.timestampToDateString(timestamp);
    }

    public void appendContent(String newContent) {
        content += newContent;
    }

}

