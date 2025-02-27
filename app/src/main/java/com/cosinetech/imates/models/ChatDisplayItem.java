package com.cosinetech.imates.models;

public class ChatDisplayItem {
    public ChatMessage chatMessage; // 数据模型
    public boolean showWithTypingEffect; // 是否直接显示, 否则流式显示
    public int currentDisplayCharIndex;  // 流式显示的字符索引

    public ChatDisplayItem(ChatMessage msg, boolean showWithTypingEffect) {
        this.chatMessage = msg;
        this.showWithTypingEffect = showWithTypingEffect;
        currentDisplayCharIndex = 0;
    }
}
