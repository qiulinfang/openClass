package com.cosinetech.imates.ui.views;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.AttributeSet;
import android.util.Log;

import androidx.appcompat.widget.AppCompatTextView;

import com.cosinetech.imates.data.models.ChatDisplayItem;
import io.noties.markwon.Markwon;
import io.noties.markwon.ext.tables.TablePlugin;
import io.noties.markwon.html.HtmlPlugin;
import io.noties.markwon.image.glide.GlideImagesPlugin;
import io.noties.markwon.inlineparser.MarkwonInlineParserPlugin;
import io.noties.markwon.ext.latex.JLatexMathPlugin;

public class MarkdownTextView extends AppCompatTextView {
    private ChatDisplayItem mTypingEffectDisplayItem;
    private Markwon mMarkwon;
    private Handler mMainHandler;
    private static final long UPDATE_DELAY = 50; // 延迟更新时间，单位毫秒
    private boolean showWithTypingEffect;

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
        Log.e("MarkdownTextView", content);
        String preFilterLatex = filterLatexString(content);
        mMarkwon.setMarkdown(this, preFilterLatex);
    }

    public void setTypingEffectDisplayItem(ChatDisplayItem msg) {
        mTypingEffectDisplayItem = msg;
    }

    public static String filterLatexString(String src) {
        src = "   \n\f" + src + "   \n\f";
        return src.replace("<p>", "")
                .replace("</p>", "  \n");
    }

    public void disableTypingEffectDisplay() {
        showWithTypingEffect = false;
    }

    final Runnable displayOneChar = new Runnable() {
        @Override
        public void run() {
            if(!mTypingEffectDisplayItem.showWithTypingEffect) {
                setContent(mTypingEffectDisplayItem.chatMessage.content);
                return;
            }

            if (mTypingEffectDisplayItem.currentDisplayCharIndex < mTypingEffectDisplayItem.chatMessage.content.length()) {
                // 逐字拼接内容
                String displayContent = mTypingEffectDisplayItem.chatMessage.content.substring(0, ++mTypingEffectDisplayItem.currentDisplayCharIndex);

//                String displayContent = mTypingEffectDisplayItem.chatMessage.content;
//                mTypingEffectDisplayItem.currentDisplayCharIndex = mTypingEffectDisplayItem.chatMessage.content.length();

                setContent(displayContent);
                if(mTypingEffectDisplayItem.currentDisplayCharIndex < mTypingEffectDisplayItem.chatMessage.content.length()) {
                    mMainHandler.postDelayed(this, UPDATE_DELAY); // 每 100ms 更新一次
                }
            } else {
                showWithTypingEffect = false;
                // recycleView复用上次相同view, 会调用到这里
                setContent(mTypingEffectDisplayItem.chatMessage.content);
            }
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

        mMainHandler.post(displayOneChar);
    }

    public boolean isShowWithTypingEffect() {
        return showWithTypingEffect;
    }

    public void clearContent() {
        setContent("");
    }
}
