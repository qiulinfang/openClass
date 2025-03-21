package com.cosinetech.imates.views;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.text.SpannableStringBuilder;
import android.util.AttributeSet;
import android.util.Log;

import androidx.appcompat.widget.AppCompatTextView;

import com.cosinetech.imates.models.ChatDisplayItem;

import java.util.ArrayDeque;
import java.util.Deque;

import io.noties.markwon.Markwon;
import io.noties.markwon.ext.tables.TablePlugin;
import io.noties.markwon.html.HtmlPlugin;
import io.noties.markwon.image.glide.GlideImagesPlugin;
import io.noties.markwon.inlineparser.MarkwonInlineParserPlugin;
import io.noties.markwon.ext.latex.JLatexMathPlugin;

public class MarkdownTextView extends AppCompatTextView {
    private static final String TAG = "MarkdownTextView";
    private ChatDisplayItem mTypingEffectDisplayItem;
    private Markwon mMarkwon;
    private Handler mMainHandler;
    private static final long UPDATE_DELAY = 100; // 延迟更新时间，单位毫秒
    private static final long LATEX_TIMEOUT = 5000;
    private boolean showWithTypingEffect;

    // 新增语法处理状态
    private final SyntaxBuffer mSyntaxBuffer = new SyntaxBuffer();
    private final Deque<Runnable> mPendingUpdates = new ArrayDeque<>();
    private boolean mIsRendering;

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
        mMainHandler = new Handler(Looper.getMainLooper());
        mMarkwon = Markwon.builder(getContext())
                .usePlugin(MarkwonInlineParserPlugin.create())
                .usePlugin(GlideImagesPlugin.create(getContext()))
                .usePlugin(HtmlPlugin.create())
                .usePlugin(JLatexMathPlugin.create(this.getTextSize(), builder -> {
                    // enable inlines (require `MarkwonInlineParserPlugin`), by default `false`
                    builder.inlinesEnabled(true);
                    builder.allowInlinesSingleDollar(true);
                }))
                .usePlugin(TablePlugin.create(context))
                .build();
    }

    public void setContent(String content) {
        String preFilterLatex = filterLatexString(content);
        mMarkwon.setMarkdown(this, preFilterLatex);
    }

    public void setTypingEffectDisplayItem(ChatDisplayItem msg) {
        mTypingEffectDisplayItem = msg;

        // 关键修改：当复用已有进度的项目时，恢复缓冲区状态
        if (msg.currentDisplayCharIndex > 0) {
            String processedContent = msg.chatMessage.content.substring(0, msg.currentDisplayCharIndex);
            mSyntaxBuffer.restoreState(processedContent);
        }
    }

    private String filterLatexString(String src) {
        return src // 处理块latex
                .replace("$$", "$$\n")
                //处理inline latex
                .replace("\\(", "$$")
                .replace("\\)", "$$")
                .replace("\\[", "$$")
                .replace("\\]", "$$");
    }

    public void disableTypingEffectDisplay() {
        showWithTypingEffect = false;
    }

    final Runnable streamDisplayRunnable = new Runnable() {
        @Override
        public void run() {
            if(!mTypingEffectDisplayItem.showWithTypingEffect) {
                setContent(mTypingEffectDisplayItem.chatMessage.content);
                return;
            }

            // 处理新内容块
            String newContent = getNextContentChunk();
            if (newContent == null || newContent.isEmpty()) return;

            // 1. 处理输入内容
            for (char c : newContent.toCharArray()) {
                mSyntaxBuffer.feed(c);
            }

            // 2. 获取并显示安全内容
            String safeContent = mSyntaxBuffer.flushSafeContent();
            if (!safeContent.isEmpty()) {
                appendContent(safeContent);
            }

            // 3. 显示占位符（关键位置）
            if (mSyntaxBuffer.hasPendingLatex()) {
                appendPlaceholder();
            } else {
                removePlaceholder();
            }

            // 4. 继续更新或完成
            if (mTypingEffectDisplayItem.currentDisplayCharIndex <
                    mTypingEffectDisplayItem.chatMessage.content.length()) {
                mMainHandler.postDelayed(this, UPDATE_DELAY);
            } else {
                handleStreamComplete();
            }

//            if (mTypingEffectDisplayItem.currentDisplayCharIndex < mTypingEffectDisplayItem.chatMessage.content.length()) {
//                // 逐字拼接内容
//                String displayContent = mTypingEffectDisplayItem.chatMessage.content.substring(0, ++mTypingEffectDisplayItem.currentDisplayCharIndex);
//                setContent(displayContent);
//                if(mTypingEffectDisplayItem.currentDisplayCharIndex < mTypingEffectDisplayItem.chatMessage.content.length()) {
//                    mMainHandler.postDelayed(this, UPDATE_DELAY); // 每 100ms 更新一次
//                }
//            } else {
//                showWithTypingEffect = false;
//
//                // recycleView复用上次相同view, 会调用到这里
//                setContent(mTypingEffectDisplayItem.chatMessage.content);
//            }
        }
    };

    public void enableTypingEffectDisplay() {
        if (showWithTypingEffect) {
            return; // 如果已经在流式显示，则直接返回
        }
        if(mTypingEffectDisplayItem == null) {
            return;
        }
        showWithTypingEffect = true;

        // 仅在首次启动时重置缓冲区
        if (mTypingEffectDisplayItem.currentDisplayCharIndex == 0) {
            mSyntaxBuffer.reset();
        }
        mMainHandler.post(streamDisplayRunnable);
        mMainHandler.postDelayed(latexTimeoutCheck, LATEX_TIMEOUT);
    }

    public boolean isShowWithTypingEffect() {
        return showWithTypingEffect;
    }

    public void clearContent() {
        setContent("");
    }

    // 新增占位符管理方法
    private void appendPlaceholder() {
        safeUpdateUI(() -> {
            SpannableStringBuilder sb = new SpannableStringBuilder(getText());
            String current = sb.toString();

            // 避免重复添加
            if (!current.endsWith("\u25AE")) {
                sb.append("\u25AE"); // ▮
                mMarkwon.setMarkdown(this, sb.toString());
            }
        });
    }

    private void removePlaceholder() {
        safeUpdateUI(() -> {
            String current = getText().toString();
            if (current.endsWith("\u25AE")) {
                SpannableStringBuilder sb = new SpannableStringBuilder(getText());
                sb.delete(sb.length()-1, sb.length());
                mMarkwon.setMarkdown(this, sb.toString());
            }
        });
    }

    // 在超时处理中移除占位符
    private final Runnable latexTimeoutCheck = () -> {
        if (mSyntaxBuffer.hasPendingLatex()) {
            Log.w(TAG, "LaTeX block timeout, flushing raw content");
            removePlaceholder(); // 先移除占位符
            appendContent(mSyntaxBuffer.flushAll());
        }
    };

    // 在流完成时清理
    private void handleStreamComplete() {
        removePlaceholder(); // 确保移除占位符
        flushRemainingContent();
        showWithTypingEffect = false;
        setContent(mTypingEffectDisplayItem.chatMessage.content);
    }

    private String getNextContentChunk() {
        if (mTypingEffectDisplayItem == null) {
            return null;
        }

        int endIndex = Math.min(
                mTypingEffectDisplayItem.currentDisplayCharIndex + 5,
                mTypingEffectDisplayItem.chatMessage.content.length()
        );

        String chunk = mTypingEffectDisplayItem.chatMessage.content.substring(
                mTypingEffectDisplayItem.currentDisplayCharIndex,
                endIndex
        );

        mTypingEffectDisplayItem.currentDisplayCharIndex = endIndex;
        return chunk;
    }

    private void appendContent(String newContent) {
        safeUpdateUI(() -> {
            SpannableStringBuilder fullContent = new SpannableStringBuilder(getText());
            fullContent.append(filterLatexString(newContent));

            // 优化：仅在内容变化时更新
            if (!fullContent.toString().equals(getText().toString())) {
                mMarkwon.setMarkdown(this, fullContent.toString());
            }
        });
    }

    private void flushRemainingContent() {
        String remaining = mSyntaxBuffer.flushAll();
        if (!remaining.isEmpty()) {
            appendContent(remaining);
        }
    }

    private void safeUpdateUI(Runnable action) {
        if (!showWithTypingEffect) return;

        if (mIsRendering) {
            mPendingUpdates.offer(action);
        } else {
            mIsRendering = true;
            post(() -> {
                try {
                    action.run();
                } finally {
                    mIsRendering = false;
                    processPendingUpdates();
                }
            });
        }
    }

    private void processPendingUpdates() {
        while (!mPendingUpdates.isEmpty()) {
            Runnable update = mPendingUpdates.poll();
            if (update != null) {
                update.run();
            }
        }
    }

    // 核心语法处理类
    private static class SyntaxBuffer {
        private final StringBuilder buffer = new StringBuilder();
        private int latexBlockDepth;
        private boolean inLatexInline;
        private boolean escaping; // 新增转义状态跟踪

        private void feed(char c) {
            buffer.append(c);
            updateState(c);
        }

        // 状态分析方法（支持转义字符）
        private void updateState(char c) {
            // 处理转义字符
            if (escaping) {
                escaping = false;
                return;
            }

            if (c == '\\') {
                escaping = true;
                return;
            }

            // 块级公式检测
            if (buffer.length() >= 2) {
                int pos = buffer.length() - 1;
                char prev = buffer.charAt(pos - 1);
                if (prev == '$' && c == '$' && !isEscaped(pos - 1)) {
                    latexBlockDepth += (latexBlockDepth % 2 == 0) ? 1 : -1;
                    return;
                }
            }

//            // 行内公式检测（排除块公式情况）
            if (c == '$' && latexBlockDepth % 2 == 0) {
                if (buffer.length() == 1 ||
                        buffer.charAt(buffer.length()-2) != '$' ||
                        isEscaped(buffer.length()-2)) {
                    inLatexInline = !inLatexInline;
                }
            }
        }

        // 状态重建核心方法
        private void reAnalyzeBufferState() {
            reset();
            escaping = false;

            // 临时禁用状态更新
            final StringBuilder temp = new StringBuilder(buffer);
            buffer.setLength(0);

            for (int i = 0; i < temp.length(); i++) {
                final char c = temp.charAt(i);
                buffer.append(c);
                updateState(c);
            }
        }

        private boolean isEscaped(int pos) {
            if (pos <= 0) return false;
            int escapeCount = 0;
            while (pos > 0 && buffer.charAt(pos-1) == '\\') {
                escapeCount++;
                pos--;
            }
            return escapeCount % 2 != 0;
        }

        public void restoreState(String processedContent) {
            buffer.setLength(0);
            buffer.append(processedContent);
            reAnalyzeBufferState();
        }

        String flushSafeContent() {
            if (hasPendingLatex()) {
                return "";
            }
            return flushContent();
        }

        String flushAll() {
            return flushContent();
        }

        private String flushContent() {
            String content = buffer.toString();
            buffer.setLength(0);
            reset();
            return content;
        }

        boolean hasPendingLatex() {
            return latexBlockDepth % 2 != 0 || inLatexInline;
        }

        void reset() {
            latexBlockDepth = 0;
            inLatexInline = false;
            escaping = false;
        }
    }
}
