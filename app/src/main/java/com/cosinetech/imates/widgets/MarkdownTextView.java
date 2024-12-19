package com.cosinetech.imates.widgets;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.AttributeSet;

import androidx.appcompat.widget.AppCompatTextView;

import com.cosinetech.imates.models.ChatMessage;

import io.noties.markwon.Markwon;
import io.noties.markwon.html.HtmlPlugin;
import io.noties.markwon.image.glide.GlideImagesPlugin;
import io.noties.markwon.inlineparser.MarkwonInlineParserPlugin;
import io.noties.markwon.ext.latex.JLatexMathPlugin;

public class MarkdownTextView extends AppCompatTextView {
    private final Object sync = new  Object();

    private ChatMessage chatMsg;
    private Markwon markwon;
    private Handler mainHandler;
    private static final long UPDATE_DELAY = 100; // 延迟更新时间，单位毫秒
    private boolean isStreaming;

    public MarkdownTextView(Context context) {
        this(context, null);
        init(context);
    }

    public MarkdownTextView(Context context, AttributeSet attrs) {
        this(context, attrs, 0);
        init(context);
    }

    public MarkdownTextView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        init(context);
    }

    private void init(Context context) {
        mainHandler = new Handler(Looper.getMainLooper());
        markwon = Markwon.builder(getContext())
                .usePlugin(MarkwonInlineParserPlugin.create())
                .usePlugin(GlideImagesPlugin.create(getContext()))
                .usePlugin(HtmlPlugin.create())
                .usePlugin(JLatexMathPlugin.create(this.getTextSize(), builder -> {
                    // enable inlines (require `MarkwonInlineParserPlugin`), by default `false`
                    builder.inlinesEnabled(true);
                    builder.allowInlinesSingleDollar(true);
                }))
                .build();
    }

    public void setContent(String content) {
        String preFilterLatex = content.replace("\\(", "$")
                .replace("\\)", "$")
                .replace("$$", "$$\n");
        markwon.setMarkdown(this, preFilterLatex);
    }

    public void setChatMessage(ChatMessage msg) {
        synchronized (sync) {
            chatMsg = msg;
        }
        // 如果正在流式显示，则继续流式显示
        if (!isStreaming) {
            startStreaming();
        }
//        else {
//            // 否则，直接渲染当前内容
//            markwon.setMarkdown(this, chatMsg.content);
//        }
    }

    public void startStreaming() {
        if (isStreaming) {
            return; // 如果已经在流式显示，则直接返回
        }
        isStreaming = true;

        Runnable runnable = new Runnable() {
            @Override
            public void run() {
                if (chatMsg.currentDisplayCharIndex < chatMsg.content.length()) {
                    // 逐字拼接内容
                    String displayContent = chatMsg.content.substring(0, ++chatMsg.currentDisplayCharIndex);
                    markwon.setMarkdown(MarkdownTextView.this, displayContent);
                    mainHandler.postDelayed(this, UPDATE_DELAY); // 每 100ms 更新一次
                } else {
                    isStreaming = false; // 流式显示结束
                }
            }
        };

        mainHandler.post(runnable);
    }

    public boolean isStreaming() {
        return isStreaming;
    }

    public void clearContent() {
        setText("");
    }
}
