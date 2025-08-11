package com.cosinetech.imates.models;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;

import com.cosinetech.imates.R;

import org.commonmark.ext.gfm.tables.TableBlock;
import org.commonmark.node.FencedCodeBlock;

import io.noties.markwon.AbstractMarkwonPlugin;
import io.noties.markwon.Markwon;
import io.noties.markwon.MarkwonConfiguration;
import io.noties.markwon.MarkwonVisitor;
import io.noties.markwon.ext.latex.JLatexMathPlugin;
import io.noties.markwon.ext.strikethrough.StrikethroughPlugin;
import io.noties.markwon.ext.tasklist.TaskListPlugin;
import io.noties.markwon.html.HtmlPlugin;
import io.noties.markwon.image.ImagesPlugin;
import io.noties.markwon.image.glide.GlideImagesPlugin;
import io.noties.markwon.inlineparser.MarkwonInlineParserPlugin;
import io.noties.markwon.recycler.MarkwonAdapter;
import io.noties.markwon.recycler.SimpleEntry;
import io.noties.markwon.recycler.table.TableEntry;
import io.noties.markwon.recycler.table.TableEntryPlugin;

public class ChatDisplayItem {
    public ChatMessage chatMessage; // 数据模型
    public boolean showWithTypingEffect; // 是否显示打字效果
    public boolean msgIsFinished; // 消息是否完成
    public int currentDisplayCharIndex;  // 流式显示的字符索引

    public boolean canSelectItem;
    public boolean isSelected;

    // 流式显示相关字段
    private Handler typingHandler;
    private Runnable typingRunnable;
    private MarkwonAdapter markwonAdapter;
    private Markwon markwon;
    private boolean isTypingActive = false;
    private Context context;

    public ChatDisplayItem(ChatMessage msg, boolean showWithTypingEffect, Context context) {
        this.chatMessage = msg;
        this.showWithTypingEffect = showWithTypingEffect;
        this.currentDisplayCharIndex = 0;
        this.canSelectItem = false;
        this.isSelected = false;
        this.context = context;
        this.msgIsFinished = false;
    }

    /**
     * 创建 Markwon 实例
     */
    public Markwon createMarkwon() {
        if (markwon == null) {
            markwon = Markwon.builder(context)
                    .usePlugin(HtmlPlugin.create())
                    .usePlugin(ImagesPlugin.create())
                    .usePlugin(TableEntryPlugin.create(context))
                    .usePlugin(StrikethroughPlugin.create())
                    .usePlugin(TaskListPlugin.create(context))
                    .usePlugin(new AbstractMarkwonPlugin() {
                        @Override
                        public void configureConfiguration(@NonNull MarkwonConfiguration.Builder builder) {
                            //builder.imageDestinationProcessor(new GithubImageDestinationProcessor());
                        }

                        @Override
                        public void configureVisitor(@NonNull MarkwonVisitor.Builder builder) {
                            builder.on(FencedCodeBlock.class, (visitor, fencedCodeBlock) -> {
                                // we actually won't be applying code spans here, as our custom view will
                                // draw background and apply mono typeface
                                //
                                // NB the `trim` operation on literal (as code will have a new line at the end)
                                final CharSequence code = visitor.configuration()
                                        .syntaxHighlight()
                                        .highlight(fencedCodeBlock.getInfo(), fencedCodeBlock.getLiteral().trim());
                                visitor.builder().append(code);
                            });
                        }
                    })
                    .usePlugin(MarkwonInlineParserPlugin.create())
                    .usePlugin(GlideImagesPlugin.create(context))
                    .usePlugin(JLatexMathPlugin.create(36, builder -> {
                        // enable inlines (require `MarkwonInlineParserPlugin`), by default `false`
                        builder.inlinesEnabled(true);
                        builder.allowInlinesSingleDollar(true);
                    }))
                    .build();
        }
        return markwon;
    }

    /**
     * 创建 MarkwonAdapter 实例
     */
    public MarkwonAdapter createMarkwonAdapter() {
        if (markwonAdapter == null) {
            markwonAdapter = MarkwonAdapter.builderTextViewIsRoot(R.layout.adapter_node_chat)
                    .include(FencedCodeBlock.class, SimpleEntry.create(R.layout.adapter_node_code_block_chat, R.id.text_view))
                    .include(TableBlock.class, TableEntry.create(builder -> builder
                            .tableLayout(R.layout.adapter_node_table_block_chat, R.id.table_layout)
                            .textLayoutIsRoot(R.layout.view_table_entry_cell_chat)))
                    .build();
        }
        return markwonAdapter;
    }

    /**
     * 开始打字效果
     */
    public void startTypingEffect(TypingEffectCallback callback) {
        if (isTypingActive) {
            Log.d("ChatDisplayItem", "TypingEffect is already active");
            return;
        }

        if (!showWithTypingEffect || chatMessage.isSelf || msgIsFinished) {
            // 直接显示完整内容
            if (callback != null) {
                callback.onContentUpdate(chatMessage.content);
            }
            return;
        }

        // 初始化打字效果
        typingHandler = new Handler(Looper.getMainLooper());
        isTypingActive = true;

        // 开始打字效果
        typingRunnable = new Runnable() {
            @Override
            public void run() {
                if (currentDisplayCharIndex < chatMessage.content.length() && isTypingActive) {
                    String lastPartialContent = chatMessage.content.substring(0, currentDisplayCharIndex);
                    currentDisplayCharIndex += 10;
                    if(currentDisplayCharIndex >= chatMessage.content.length()) {
                        currentDisplayCharIndex = chatMessage.content.length();
                    }
                    String partialContent = chatMessage.content.substring(0, currentDisplayCharIndex);

                    if (callback != null && !partialContent.isEmpty() && !partialContent.equals(lastPartialContent)) {
                        callback.onContentUpdate(partialContent);
                    }
                }

                if (!msgIsFinished || currentDisplayCharIndex < chatMessage.content.length()) {
                    // 计算下一个字符的延迟时间
                    long delay = 50;
                    typingHandler.postDelayed(this, delay);
                } else {
                    if (callback != null) {
                        callback.onTypingComplete(chatMessage.content);
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
    }

    /**
     * 检查是否应该显示打字效果
     */
    public boolean shouldShowTypingEffect() {
        return showWithTypingEffect && !chatMessage.isSelf;
    }

    /**
     * 检查是否正在进行打字效果
     */
    public boolean isTypingInProgress() {
        return isTypingActive;
    }


    /**
     * 获取 Markwon 实例
     */
    public Markwon getMarkwon() {
        return markwon != null ? markwon : createMarkwon();
    }

    /**
     * 获取 MarkwonAdapter 实例
     */
    public MarkwonAdapter getMarkwonAdapter() {
        return markwonAdapter != null ? markwonAdapter : createMarkwonAdapter();
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
        void onTypingComplete(String content);
    }
}
