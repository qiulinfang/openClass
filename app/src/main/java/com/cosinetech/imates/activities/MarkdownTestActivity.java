package com.cosinetech.imates.activities;

import android.os.Bundle;
import android.view.View;
import android.widget.Button;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.R;
import com.cosinetech.imates.adapters.AdapterAiChatMessageList;
import com.cosinetech.imates.models.ChatDisplayItem;
import com.cosinetech.imates.models.ChatMessage;
import com.cosinetech.imates.views.ChatAiView;

import java.util.ArrayList;
import java.util.List;

public class MarkdownTestActivity extends AppCompatActivity {
    
    private RecyclerView recyclerView;
    private AdapterAiChatMessageList adapter;
    private List<ChatDisplayItem> messageList;
    private Button btnAddMarkdown;
    private Button btnAddTypingEffect;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_markdown_test);
        
        recyclerView = findViewById(R.id.recycler_view);
        btnAddMarkdown = findViewById(R.id.btn_add_markdown);
        btnAddTypingEffect = findViewById(R.id.btn_add_typing_effect);
        
        messageList = new ArrayList<>();
        adapter = new AdapterAiChatMessageList(this, messageList, recyclerView);
        
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        recyclerView.setAdapter(adapter);
        
        // 添加一些测试消息
        addTestMessages();
        
        btnAddMarkdown.setOnClickListener(v -> addMarkdownMessage());
        btnAddTypingEffect.setOnClickListener(v -> addTypingEffectMessage());
    }
    
    private void addTestMessages() {
        // 添加普通文本消息
        ChatMessage textMsg = new ChatMessage(
            "这是一个普通的文本消息",
            false,
            ChatMessage.MessageType.TEXT,
            "test_session",
            System.currentTimeMillis(),
            ChatAiView.ChatRole.CHAT_ROLE_AI_MATE
        );
                    messageList.add(new ChatDisplayItem(textMsg, false, this));
        
        // 添加带打字效果的 Markdown 消息
        ChatMessage markdownMsg = new ChatMessage(
            "这是一个 **Markdown** 消息，带有打字效果！\n\n" +
            "```java\n" +
            "public class Test {\n" +
            "    public static void main(String[] args) {\n" +
            "        System.out.println(\"Hello World!\");\n" +
            "    }\n" +
            "}\n" +
            "```\n\n" +
            "| 列1 | 列2 | 列3 |\n" +
            "|-----|-----|-----|\n" +
            "| 数据1 | 数据2 | 数据3 |\n" +
            "| 数据4 | 数据5 | 数据6 |\n\n" +
            "这是一个很长的消息，用来测试打字效果。它会逐字符显示，就像 AI 在实时回复一样。",
            false,
            ChatMessage.MessageType.TEXT,
            "test_session",
            System.currentTimeMillis(),
            ChatAiView.ChatRole.CHAT_ROLE_AI_MATE
        );
        messageList.add(new ChatDisplayItem(markdownMsg, true, this)); // 启用打字效果
        
        adapter.notifyDataSetChanged();
    }
    
    private void addMarkdownMessage() {
        ChatMessage markdownMsg = new ChatMessage(
            "用户发送的 **Markdown** 消息\n\n" +
            "```python\n" +
            "def hello_world():\n" +
            "    print(\"Hello from Python!\")\n" +
            "```\n\n" +
            "- 列表项 1\n" +
            "- 列表项 2\n" +
            "- 列表项 3",
            true,
            ChatMessage.MessageType.TEXT,
            "test_session",
            System.currentTimeMillis(),
            ChatAiView.ChatRole.CHAT_ROLE_MYSELF
        );
        messageList.add(new ChatDisplayItem(markdownMsg, false, this));
        adapter.notifyItemInserted(messageList.size() - 1);
        recyclerView.scrollToPosition(messageList.size() - 1);
    }
    
    private void addTypingEffectMessage() {
        ChatMessage typingMsg = new ChatMessage(
            "这是一个带有打字效果的 **AI 回复**！\n\n" +
            "```python\n" +
            "def ai_response():\n" +
            "    print(\"Hello from AI!\")\n" +
            "    return \"这是一个模拟的 AI 回复\"\n" +
            "```\n\n" +
            "| 功能 | 状态 | 说明 |\n" +
            "|------|------|------|\n" +
            "| 打字效果 | ✅ | 逐字符显示 |\n" +
            "| Markdown | ✅ | 支持格式 |\n" +
            "| 代码高亮 | ✅ | 语法高亮 |\n" +
            "| 表格 | ✅ | 完整表格 |\n\n" +
            "这个功能模拟了真实的 AI 聊天体验，用户可以看到消息逐字符出现，就像 AI 在实时思考和回复一样。",
            false,
            ChatMessage.MessageType.TEXT,
            "test_session",
            System.currentTimeMillis(),
            ChatAiView.ChatRole.CHAT_ROLE_AI_MATE
        );
        messageList.add(new ChatDisplayItem(typingMsg, true, this)); // 启用打字效果
        adapter.notifyItemInserted(messageList.size() - 1);
        recyclerView.scrollToPosition(messageList.size() - 1);
    }
} 