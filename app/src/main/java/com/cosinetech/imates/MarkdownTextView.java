package com.cosinetech.imates;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.AttributeSet;
import android.util.Log;

import androidx.appcompat.widget.AppCompatTextView;
import io.noties.markwon.Markwon;
import io.noties.markwon.image.glide.GlideImagesPlugin;
import io.noties.markwon.inlineparser.MarkwonInlineParserPlugin;
import io.noties.markwon.ext.latex.JLatexMathPlugin;

public class MarkdownTextView extends AppCompatTextView {
    private Markwon markwon;
    private final StringBuffer contentBuffer = new StringBuffer();
    private Handler mainHandler;
    private static final long UPDATE_DELAY = 100; // 延迟更新时间，单位毫秒
    private boolean isStreaming;
    private String fullContent;
    private int currentIndex = 0;

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
                .usePlugin(JLatexMathPlugin.create(this.getTextSize(), builder -> {
                    // enable inlines (require `MarkwonInlineParserPlugin`), by default `false`
                    builder.inlinesEnabled(true);
                    builder.allowInlinesSingleDollar(true);
                }))
                .build();
    }

    public void appendContent(String newContent) {
        synchronized (contentBuffer) {
            contentBuffer.append(newContent);
            Log.d("########Thread-" + Thread.currentThread().getName(), newContent);
            Log.d("$$$$$$$$Thread-" + Thread.currentThread().getName(), contentBuffer.toString());
        }
        // 如果正在流式显示，则继续流式显示
        if (isStreaming) {
            startStreaming();
        } else {
            // 否则，直接渲染当前内容
            markwon.setMarkdown(this, contentBuffer.toString());
        }
    }

    public void startStreaming() {
        if (isStreaming) {
            return; // 如果已经在流式显示，则直接返回
        }
        isStreaming = true;

        Runnable runnable = new Runnable() {
            @Override
            public void run() {
                synchronized (contentBuffer) {
                    fullContent = contentBuffer.toString();
                }
                if (currentIndex < fullContent.length()) {
                    // 逐字拼接内容
                    String displayContent = fullContent.substring(0, ++currentIndex);
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
        synchronized (contentBuffer) {
            contentBuffer.setLength(0);
            setText("");
        }
    }
}
