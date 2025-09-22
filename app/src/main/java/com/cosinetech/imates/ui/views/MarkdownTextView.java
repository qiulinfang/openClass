package com.cosinetech.imates.ui.views;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.AttributeSet;
import android.util.Log;

import androidx.appcompat.widget.AppCompatTextView;

import com.cosinetech.imates.data.models.ChatDisplayItem;

import io.noties.markwon.Markwon;

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
        mMarkwon = ChatDisplayItem.createMarkwon(getContext(), getTextSize(), false);
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
//        return src.replace("<p>", "")
//                .replace("</p>", "  \n")
//                .replace("\\(", "$")
//                .replace("\\)", "$")
//                .replace("\\[", "$$")
//                .replace("\\]", "$$")
//                .replace("$$", "\n$$\n");

        StringBuilder sb = new StringBuilder(src.length() * 2);
        int length = src.length();
        int i = 0;
        boolean inDoubleDollar = false; // 标记是否在 $$...$$ 块内

        while (i < length) {
            // 处理 <p>
            if (i + 2 < length && src.charAt(i) == '<' && src.charAt(i + 1) == 'p' && src.charAt(i + 2) == '>') {
                i += 3; // 跳过 <p>
            }
            // 处理 </p>
            else if (i + 3 < length && src.startsWith("</p>", i)) {
                sb.append("  \n");
                i += 4;
            }
            // 处理 \(...\) 和 \[...\]
            else if (i + 1 < length && src.charAt(i) == '\\') {
                char next = src.charAt(i + 1);
                if (next == '(' || next == ')') {
                    sb.append('$');
                    i += 2;
                } else if (next == '[' || next == ']') {
                    // 如果前面不是换行，先加换行
                    if (sb.length() > 0 && sb.charAt(sb.length() - 1) != '\n') sb.append('\n');
                    sb.append("$$");
                    inDoubleDollar = !inDoubleDollar; // 切换 $$ 状态
                    if(inDoubleDollar) sb.append('\n');
                    i += 2;
                    // 如果切换到关闭 $$，在后面加换行
                    if (!inDoubleDollar) sb.append('\n');
                } else {
                    sb.append(src.charAt(i++));
                }
            }
            // 普通字符
            else {
                sb.append(src.charAt(i++));
            }
        }

        return sb.toString();
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
