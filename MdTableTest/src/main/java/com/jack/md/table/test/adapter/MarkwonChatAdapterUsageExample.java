package com.jack.md.table.test.adapter;

import android.content.Context;
import android.os.Bundle;
import android.view.View;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.R;
import com.cosinetech.imates.models.ChatDisplayItem;
import com.cosinetech.imates.models.ChatMessage;

import java.util.ArrayList;
import java.util.List;

/**
 * 使用 MarkwonChatAdapter 的示例
 * 
 * 主要特点：
 * 1. 支持 Markdown 渲染（表格、代码块、图片等）
 * 2. 支持打字效果
 * 3. 支持消息选择
 * 4. 保持原有的聊天界面功能
 */
public class MarkwonChatAdapterUsageExample extends AppCompatActivity {
    
    private RecyclerView recyclerView;
    private MarkwonChatAdapter adapter;
    private List<ChatDisplayItem> messageList;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_chat); // 你的聊天界面布局

        recyclerView = findViewById(R.id.recycler_view);
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        
        messageList = new ArrayList<>();
        adapter = new MarkwonChatAdapter(this, messageList, recyclerView);
        recyclerView.setAdapter(adapter);

        // 添加一些测试消息
        addTestMessages();
    }

    private void addTestMessages() {
        // 添加普通文本消息
        addTextMessage("Hello, this is a normal text message.", false);
        
        // 添加包含 Markdown 的消息
        addTextMessage("Here's some **bold text** and *italic text*.", false);
        
        // 添加包含代码的消息
        addTextMessage("```java\npublic class Hello {\n    System.out.println(\"Hello World\");\n}\n```", false);
        
        // 添加包含表格的消息
        addTextMessage("| Name | Age | City |\n|------|-----|------|\n| John | 25  | NYC  |\n| Jane | 30  | LA   |", false);
        
        // 添加用户消息
        addTextMessage("This is my message", true);
    }

    private void addTextMessage(String content, boolean isSelf) {
        ChatMessage message = new ChatMessage();
        message.type = ChatMessage.MessageType.TEXT;
        message.content = content;
        message.isSelf = isSelf;
        message.messageId = "msg_" + System.currentTimeMillis();
        
        ChatDisplayItem displayItem = new ChatDisplayItem();
        displayItem.chatMessage = message;
        displayItem.showWithTypingEffect = false; // 不显示打字效果
        
        messageList.add(displayItem);
        adapter.notifyItemInserted(messageList.size() - 1);
        
        // 滚动到底部
        recyclerView.scrollToPosition(messageList.size() - 1);
    }

    /**
     * 模拟接收消息时的打字效果
     */
    public void simulateReceivingMessage(String messageId) {
        // 首先显示打字效果
        adapter.updateReceivingMessage(messageId, true);
        
        // 3秒后显示完整内容
        recyclerView.postDelayed(() -> {
            adapter.updateReceivingMessage(messageId, false);
        }, 3000);
    }

    /**
     * 启用消息选择模式
     */
    public void enableMessageSelection() {
        adapter.setItemCanSelect(true);
        adapter.notifyDataSetChanged();
    }

    /**
     * 获取选中的消息
     */
    public List<ChatDisplayItem> getSelectedMessages() {
        return adapter.getSelectedItem();
    }

    /**
     * 添加新的 Markdown 消息
     */
    public void addMarkdownMessage(String markdownContent, boolean isSelf) {
        ChatMessage message = new ChatMessage();
        message.type = ChatMessage.MessageType.TEXT;
        message.content = markdownContent;
        message.isSelf = isSelf;
        message.messageId = "msg_" + System.currentTimeMillis();
        
        ChatDisplayItem displayItem = new ChatDisplayItem();
        displayItem.chatMessage = message;
        displayItem.showWithTypingEffect = false;
        
        messageList.add(displayItem);
        adapter.notifyItemInserted(messageList.size() - 1);
        recyclerView.scrollToPosition(messageList.size() - 1);
    }
} 