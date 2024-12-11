package com.cosinetech.imates;

public class ChatMessage {
    public static final int TYPE_TEXT = 0;
    public static final int TYPE_IMAGE = 1;
    public static final int TYPE_VOICE = 2;
    public static final int TYPE_DATE = 3;

    public StringBuffer content;  // 消息内容、图片路径或语音路径
    public boolean isSelf;  // 是否是自己发送的消息
    public boolean isHistory; // 是否是加载的历史消息
    public long timestamp;  // 消息时间戳
    public int type;        // 消息类型

    public ChatMessage(StringBuffer content, boolean isSelf, long timestamp, int type, boolean isHistory) {
        this.content = content;
        this.isSelf = isSelf;
        this.timestamp = timestamp;
        this.type = type;
        this.isHistory = isHistory;
    }

    public void appendContent(String newContent) {
        content.append(newContent);
    }
}

