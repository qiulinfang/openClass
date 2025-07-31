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

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_markdown_test);
        
        recyclerView = findViewById(R.id.recycler_view);
        btnAddMarkdown = findViewById(R.id.btn_add_markdown);
        
        messageList = new ArrayList<>();
        adapter = new AdapterAiChatMessageList(this, messageList, recyclerView);
        
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        recyclerView.setAdapter(adapter);
        
        // 添加一些测试消息
        addTestMessages();
        
        btnAddMarkdown.setOnClickListener(v -> addMarkdownMessage());
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
        messageList.add(new ChatDisplayItem(textMsg, false));
        
        // 添加 Markdown 消息
        ChatMessage markdownMsg = new ChatMessage(
            "这是一个 **Markdown** 消息\n\n" +
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
            "| 数据4 | 数据5 | 数据6 |",
            false,
            ChatMessage.MessageType.TEXT,
            "test_session",
            System.currentTimeMillis(),
            ChatAiView.ChatRole.CHAT_ROLE_AI_MATE
        );
        messageList.add(new ChatDisplayItem(markdownMsg, false));
        
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
        messageList.add(new ChatDisplayItem(markdownMsg, false));
        adapter.notifyItemInserted(messageList.size() - 1);
        recyclerView.scrollToPosition(messageList.size() - 1);
    }
} 