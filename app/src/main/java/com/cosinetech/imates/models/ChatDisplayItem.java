package com.cosinetech.imates.models;

import com.cosinetech.imates.views.MarkdownTextView;
import com.cosinetech.imates.views.SyntaxBuffer;

public class ChatDisplayItem {
    public ChatMessage chatMessage; // 数据模型
    public boolean showWithTypingEffect; // 是否直接显示, 否则流式显示
    public int currentDisplayCharIndex;  // 流式显示的字符索引
    public StringBuilder currentSafeDisplayString;

    public SyntaxBuffer mSyntaxBuffer;

    public boolean canSelectItem;

    public boolean isSelected;

    public ChatDisplayItem(ChatMessage msg, boolean showWithTypingEffect) {
        this.chatMessage = msg;
        this.showWithTypingEffect = showWithTypingEffect;
        this.currentDisplayCharIndex = 0;
        this.canSelectItem = false;
        this.isSelected = false;
        this.currentSafeDisplayString = new StringBuilder();
        this.mSyntaxBuffer  = new SyntaxBuffer();
    }
}
