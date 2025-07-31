package com.cosinetech.imates.models;

import android.content.Context;

public class ChatDisplayItem {
    public ChatMessage chatMessage; // 数据模型
    public boolean showWithTypingEffect; // 是否直接显示, 否则流式显示
    public boolean msgIsFinished;
    public int currentDisplayCharIndex;  // 流式显示的字符索引

    public boolean canSelectItem;

    public boolean isSelected;

    public Context mContext;

    public ChatDisplayItem(ChatMessage msg, boolean showWithTypingEffect, Context context) {
        this.chatMessage = msg;
        this.showWithTypingEffect = showWithTypingEffect;
        this.currentDisplayCharIndex = 0;
        this.canSelectItem = false;
        this.isSelected = false;
        this.mContext = context;
        this.msgIsFinished = false;
    }
}
