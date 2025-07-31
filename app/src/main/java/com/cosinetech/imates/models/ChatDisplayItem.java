package com.cosinetech.imates.models;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;

import io.noties.markwon.Markwon;
import io.noties.markwon.recycler.MarkwonAdapter;

public class ChatDisplayItem {
    public ChatMessage chatMessage; // 数据模型
    public boolean showWithTypingEffect; // 是否直接显示, 否则流式显示
    public int currentDisplayCharIndex;  // 流式显示的字符索引

    public boolean canSelectItem;
    public boolean isSelected;

    // 流式显示相关字段
    private Handler typingHandler;
    private Runnable typingRunnable;
    private MarkwonAdapter typingAdapter;
    private Markwon typingMarkwon;
    private boolean isTypingActive = false;

    public ChatDisplayItem(ChatMessage msg, boolean showWithTypingEffect) {
        this.chatMessage = msg;
        this.showWithTypingEffect = showWithTypingEffect;
        this.currentDisplayCharIndex = 0;
        this.canSelectItem = false;
        this.isSelected = false;
    }

    // 流式显示相关方法

    /**
     * 开始打字效果
     */
    public void startTypingEffect(MarkwonAdapter adapter, Markwon markwon, TypingEffectCallback callback) {
        if (isTypingActive) {
            Log.d("ChatDisplayItem", "TypingEffect is already active");
            return;
            //stopTypingEffect();
        }

        if (!showWithTypingEffect || chatMessage.isSelf) {
            // 直接显示完整内容
            if (callback != null) {
                callback.onContentUpdate(chatMessage.content);
            }
            return;
        }

        // 初始化打字效果
        typingHandler = new Handler(Looper.getMainLooper());
        typingAdapter = adapter;
        typingMarkwon = markwon;
        isTypingActive = true;

        // 开始打字效果
        typingRunnable = new Runnable() {
            @Override
            public void run() {
                if (currentDisplayCharIndex <= chatMessage.content.length() && isTypingActive) {
                    String partialContent = chatMessage.content.substring(0, currentDisplayCharIndex);
                    
                    if (callback != null) {
                        callback.onContentUpdate(partialContent);
                    }
                    
                    currentDisplayCharIndex++;
                    
                    // 计算下一个字符的延迟时间
                    long delay = calculateTypingDelay(chatMessage.content, currentDisplayCharIndex - 1);
                    typingHandler.postDelayed(this, delay);
                } else {
                    // 打字效果完成
                    //stopTypingEffect();
                    if (callback != null) {
                        callback.onTypingComplete();
                    }
                }
            }
        };

        // 开始执行
        typingHandler.post(typingRunnable);
    }

    /**
     * 停止打字效果
     */
    public void stopTypingEffect() {
        isTypingActive = false;
        if (typingHandler != null) {
            typingHandler.removeCallbacksAndMessages(null);
            typingHandler = null;
        }
        if (typingRunnable != null) {
            typingRunnable = null;
        }
    }

    /**
     * 清理资源
     */
    public void cleanup() {
        stopTypingEffect();
        typingAdapter = null;
        typingMarkwon = null;
    }

    /**
     * 计算打字延迟时间
     */
    private long calculateTypingDelay(String content, int currentIndex) {
        if (currentIndex >= content.length()) {
            return 0;
        }
        
        char currentChar = content.charAt(currentIndex);
        
        // 根据字符类型调整延迟时间
        if (currentChar == '\n') {
            return 200; // 换行符延迟较长
        } else if (currentChar == ' ' || currentChar == '\t') {
            return 50; // 空格延迟较短
        } else if (currentChar == '.' || currentChar == '!' || currentChar == '?') {
            return 300; // 句号等标点符号延迟较长
        } else if (currentChar == ',' || currentChar == ';' || currentChar == ':') {
            return 150; // 逗号等标点符号延迟中等
        } else {
            return 30; // 普通字符延迟最短
        }
    }

    /**
     * 检查是否应该显示打字效果
     */
    public boolean shouldShowTypingEffect() {
        return showWithTypingEffect && !chatMessage.isSelf;
    }

    /**
     * 获取当前应该显示的内容
     */
    public String getCurrentContent() {
        if (shouldShowTypingEffect()) {
            return chatMessage.content.substring(0, currentDisplayCharIndex);
        } else {
            return chatMessage.content;
        }
    }

    /**
     * 打字效果回调接口
     */
    public interface TypingEffectCallback {
        void onContentUpdate(String content);
        void onTypingComplete();
    }
}
