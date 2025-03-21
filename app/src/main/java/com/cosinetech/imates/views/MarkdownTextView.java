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
    }

    private String filterLatexString(String src) {
        return src.replace("\\(", "$")
                .replace("\\)", "$")
                .replace("$$", "$$\n")
                .replace("\\[", "$")
                .replace("\\]", "$");
    }

    public void disableTypingEffectDisplay() {
        showWithTypingEffect = false;
    }

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
            mTypingEffectDisplayItem.mSyntaxBuffer.reset();
        }
        mMainHandler.post(streamDisplayRunnable);
        //mMainHandler.postDelayed(latexTimeoutCheck, LATEX_TIMEOUT);
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
            if (newContent == null || newContent.isEmpty()) {
                return;
            }
            Log.e(TAG, "new：" + newContent);

            // 1. 处理输入内容
            for (char c : newContent.toCharArray()) {
                mTypingEffectDisplayItem.mSyntaxBuffer.feed(c);
            }

            // 2. 获取并显示安全内容
            String safeContent = mTypingEffectDisplayItem.mSyntaxBuffer.flushSafeContent();
            Log.e(TAG, "safe：" + safeContent);
            if (!safeContent.isEmpty()) {
                appendContent(safeContent);
            }

            // 3. 显示占位符（关键位置）
            if (mTypingEffectDisplayItem.mSyntaxBuffer.hasPendingLatex()) {
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
        if (mTypingEffectDisplayItem.mSyntaxBuffer.hasPendingLatex()) {
            Log.w(TAG, "LaTeX block timeout, flushing raw content");
            removePlaceholder(); // 先移除占位符
            appendContent(mTypingEffectDisplayItem.mSyntaxBuffer.flushAll());
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
            mTypingEffectDisplayItem.currentSafeDisplayString.append(newContent);
            Log.e(TAG, "full：" + mTypingEffectDisplayItem.currentSafeDisplayString.toString());
            // 优化：仅在内容变化时更新
            //if (!fullContent.toString().equals(getText().toString())) {
                mMarkwon.setMarkdown(this, mTypingEffectDisplayItem.currentSafeDisplayString.toString());
            //}
        });
    }

    private void flushRemainingContent() {
        String remaining = mTypingEffectDisplayItem.mSyntaxBuffer.flushAll();
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

}
