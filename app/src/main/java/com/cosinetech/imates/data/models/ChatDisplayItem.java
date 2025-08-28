package com.cosinetech.imates.data.models;

import android.content.Context;
import android.graphics.Color;
import android.os.Handler;
import android.os.HandlerThread;
import android.util.Log;

import androidx.annotation.NonNull;

import com.cosinetech.imates.R;

import org.commonmark.ext.gfm.tables.TableBlock;
import org.commonmark.node.FencedCodeBlock;
import org.commonmark.node.Node;

import java.util.regex.Pattern;

import io.noties.markwon.AbstractMarkwonPlugin;
import io.noties.markwon.Markwon;
import io.noties.markwon.MarkwonConfiguration;
import io.noties.markwon.MarkwonPlugin;
import io.noties.markwon.MarkwonVisitor;
import io.noties.markwon.core.MarkwonTheme;
import io.noties.markwon.ext.latex.JLatexMathNode;
import io.noties.markwon.ext.latex.JLatexMathPlugin;
import io.noties.markwon.ext.latex.JLatexMathTheme;
import io.noties.markwon.ext.strikethrough.StrikethroughPlugin;
import io.noties.markwon.ext.tables.TablePlugin;
import io.noties.markwon.ext.tasklist.TaskListPlugin;
import io.noties.markwon.html.HtmlPlugin;
import io.noties.markwon.image.ImagesPlugin;
import io.noties.markwon.image.glide.GlideImagesPlugin;
import io.noties.markwon.inlineparser.InlineProcessor;
import io.noties.markwon.inlineparser.MarkwonInlineParserPlugin;
import io.noties.markwon.linkify.LinkifyPlugin;
import io.noties.markwon.recycler.MarkwonAdapter;
import io.noties.markwon.recycler.SimpleEntry;
import io.noties.markwon.recycler.table.TableEntry;
import io.noties.markwon.recycler.table.TableEntryPlugin;
import ru.noties.jlatexmath.JLatexMathDrawable;

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

    public boolean initialDisplayed = false;

    private IncrementalStringProcessor processor = new  IncrementalStringProcessor();

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
    public static Markwon createMarkwon(Context context, float textSize, boolean hasTableLayout) {
        MarkwonPlugin tablePlugin;
        if (hasTableLayout) {
            tablePlugin = TableEntryPlugin.create(context);
        } else {
            tablePlugin = TablePlugin.create(context);
        }
//        MarkwonInlineParserPlugin markwonInlineParserPlugin = MarkwonInlineParserPlugin.create();
//        markwonInlineParserPlugin.factoryBuilder()
//                // 块级
//                .addInlineProcessor(new LatexMarkProcessor("$$", "$$", true))    // 块级
//                .addInlineProcessor(new LatexMarkProcessor("\\[", "\\]", true))  // 块级
//                // 行内其次
//                .addInlineProcessor(new LatexMarkProcessor("$", "$", false))     // 行内
//                .addInlineProcessor(new LatexMarkProcessor("\\(", "\\)", false));// 行内
        return Markwon.builder(context)
                .usePlugin(HtmlPlugin.create())
                .usePlugin(ImagesPlugin.create())
                .usePlugin(tablePlugin)
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

                    @Override
                    public void configureTheme(@NonNull MarkwonTheme.Builder builder) {
                        builder.codeBackgroundColor(Color.GRAY)
                                .blockQuoteColor(Color.GRAY);
                    }
                })
                .usePlugin(MarkwonInlineParserPlugin.create())
                .usePlugin(GlideImagesPlugin.create(context))
                .usePlugin(JLatexMathPlugin.create(textSize, builder -> {
                    // background provider for both inlines and blocks
                    //  or more specific: `inlineBackgroundProvider` & `blockBackgroundProvider`
                    builder.inlinesEnabled(true);
                    builder.blocksEnabled(true);
                    //builder.allowInlinesSingleDollar(true);
//                        builder.theme().backgroundProvider(new JLatexMathTheme.BackgroundProvider() {
//                            @NonNull
//                            @Override
//                            public Drawable provide() {
//                                return new ColorDrawable(0xFFff0000);
//                            }
//                        });

                    // should block fit the whole canvas width, by default true
                    builder.theme().blockFitCanvas(true);

                    // horizontal alignment for block, by default ALIGN_CENTER
                    builder.theme().blockHorizontalAlignment(JLatexMathDrawable.ALIGN_CENTER);

                    // padding for both inlines and blocks
                    //builder.theme().padding(JLatexMathTheme.Padding.all(8));

                    // padding for inlines
                    builder.theme().inlinePadding(JLatexMathTheme.Padding.symmetric(16, 8));
                    // padding for blocks
                    //builder.theme().blockPadding(new JLatexMathTheme.Padding(0, 1, 2, 3));

                    // text color of LaTeX content for both inlines and blocks
                    //  or more specific: `inlineTextColor` & `blockTextColor`
                    //builder.theme().textColor(Color.BLUE);
                }))
                .usePlugin(LinkifyPlugin.create())
                .build();
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

        if (!showWithTypingEffect
                || chatMessage.isSelf
                || (msgIsFinished && currentDisplayCharIndex >= chatMessage.content.length())) {
            // 直接显示完整内容
            if (callback != null) {
                callback.onContentUpdate(chatMessage.content, chatMessage.content);
            }
            return;
        }

        // 初始化打字效果
        typingHandler = TypingScheduler.getHandler();
        isTypingActive = true;

        // 开始打字效果
        typingRunnable = new Runnable() {
            @Override
            public void run() {
                if (currentDisplayCharIndex < chatMessage.content.length() && isTypingActive) {
                    String lastPartialContent = chatMessage.content.substring(0, currentDisplayCharIndex);
                    currentDisplayCharIndex += 5;
                    if(currentDisplayCharIndex >= chatMessage.content.length()) {
                        currentDisplayCharIndex = chatMessage.content.length();
                    }
                    String partialContent = chatMessage.content.substring(0, currentDisplayCharIndex);

                    if (callback != null && !partialContent.isEmpty() && !partialContent.equals(lastPartialContent)) {
                        callback.onContentUpdate(lastPartialContent, processor.process(partialContent));
                    }
                }

                if (!msgIsFinished || currentDisplayCharIndex < chatMessage.content.length()) {
                    // 计算下一个字符的延迟时间
                    long delay = 100;
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
    public Markwon getMarkwon(float textSize, boolean hasTableLayout) {
        return markwon != null ? markwon : (markwon = createMarkwon(context, textSize, hasTableLayout));
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

    public static String filterLatexString(String src) {
        src = "   \n\f" + src + "   \n\f";
        return new IncrementalStringProcessor().process(src);
    }

    /**
     * 打字效果回调接口
     */
    public interface TypingEffectCallback {
        void onContentUpdate(String oldContent, String newContent);
        void onTypingComplete(String content);
    }

    // 处理$latex$形式
    public static class LatexMarkProcessor extends InlineProcessor {
        private final String open;
        private final String close;
        private final boolean isBlock;
        private final Pattern pattern;

        public LatexMarkProcessor(String open, String close, boolean isBlock) {
            this.open = open;
            this.close = close;
            this.isBlock = isBlock;

            if ("$".equals(open) && "$".equals(close)) {
                // 特殊处理单 $
                this.pattern = Pattern.compile("(?<!\\\\)\\$(?!\\$)(.+?)(?<!\\\\)\\$(?!\\$)");
            } else {
                // 普通情况，支持多字符定界符
                this.pattern = Pattern.compile(
                        Pattern.quote(open) + "(.+?)" + Pattern.quote(close),
                        Pattern.DOTALL
                );
            }
        }

        @Override
        public char specialCharacter() {
            return open.charAt(0); // 用起始符的首字符触发
        }

        @Override
        public Node parse() {
            String latex = match(pattern);
            if (latex == null) return null;

            // 截取公式内容
            String content = latex.substring(open.length(), latex.length() - close.length());

            JLatexMathNode node = new JLatexMathNode(content);

            if (isBlock) {
                org.commonmark.node.Paragraph paragraph = new org.commonmark.node.Paragraph();
                paragraph.appendChild(node);
                return paragraph;
            }

            return node;
        }
    }

    public static class IncrementalStringProcessor {

        // 内部状态类
        private static class State {
            int col = 0;              // 当前列
            int leadingSpaces = 0;    // 当前行首空格数
        }

        private final StringBuilder sb = new StringBuilder(); // 累积处理结果
        private final State state = new State();
        private int processedLength = 0; // 上次已处理的原始字符串长度

        public IncrementalStringProcessor() {}

        /**
         * 处理完整字符串，只处理新增部分
         * @param fullText 新完整字符串
         * @return 处理后的完整字符串
         */
        public String process(String fullText) {
            int len = fullText.length();
            int i = processedLength; // 从上次处理结束处开始

            while (i < len) {
                char ch = fullText.charAt(i);

                // 换行处理
                if (ch == '\n' || ch == '\r') {
                    sb.append(ch);
                    i++;
                    state.col = 0;
                    state.leadingSpaces = 0; // 新行重置空格计数
                    continue;
                }

                // 行首空格统计
                if (state.col == state.leadingSpaces && ch == ' ') {
                    state.leadingSpaces++;
                    sb.append(ch);
                    i++; state.col++;
                    continue;
                }

                // 1️⃣ 转义序列
                if (ch == '\\') {
                    if (i + 1 < len) {
                        char next = fullText.charAt(i + 1);
                        if (next == '\\') { // e0 或 ea/eb
                            if (i + 2 < len) {
                                char next2 = fullText.charAt(i + 2);
                                if (next2 == '[') { // ea
                                    sb.append("\\\\[");
                                    i += 3; state.col += 3; state.leadingSpaces = 0; continue;
                                } else if (next2 == ']') { // eb
                                    sb.append("\\\\]");
                                    i += 3; state.col += 3; state.leadingSpaces = 0; continue;
                                }
                            }
                            // e0
                            sb.append("\\\\");
                            i += 2; state.col += 2; state.leadingSpaces = 0; continue;
                        } else if (next == '$') { // ec
                            sb.append("\\$");
                            i += 2; state.col += 2; state.leadingSpaces = 0; continue;
                        }
                    }
                }

                // 2️⃣ <p> 和 </p>
                if (ch == '<') {
                    if (i + 2 < len && fullText.charAt(i + 1) == 'p' && fullText.charAt(i + 2) == '>') {
                        i += 3; continue; // 删除 <p>
                    } else if (i + 3 < len && fullText.charAt(i + 1) == '/' && fullText.charAt(i + 2) == 'p' && fullText.charAt(i + 3) == '>') {
                        sb.append("  \n");
                        i += 4; state.col = 0; state.leadingSpaces = 0; continue;
                    }
                }

                // 3️⃣ 定界符独占一行
                boolean isDelimiter = false;
                int delimiterLength = 0;
                if (ch == '\\' && i + 1 < len && (fullText.charAt(i + 1) == '[' || fullText.charAt(i + 1) == ']')) {
                    isDelimiter = true; delimiterLength = 2;
                } else if (ch == '$' && i + 1 < len && fullText.charAt(i + 1) == '$') {
                    isDelimiter = true; delimiterLength = 2;
                }

                if (isDelimiter) {
                    // 前置换行判断
                    if (state.leadingSpaces > 8 || state.col > state.leadingSpaces) {
                        sb.append('\n');
                    }

                    // 输出定界符
                    sb.append(fullText, i, i + delimiterLength);
                    i += delimiterLength;
                    state.col = delimiterLength;
                    state.leadingSpaces = 0;

                    // 后置换行判断
                    // 扫描定界符后连续空格，直到遇到换行或非空格
                    int j = i;
                    boolean needAppendNewline = true;
                    while (j < len) {
                        char nextChar = fullText.charAt(j);
                        if (nextChar == ' ') {
                            j++;
                            // 跳过空格
                        } else if (nextChar == '\n' || nextChar == '\r') {
                            needAppendNewline = false; // 已有换行，不加
                            break;
                        } else {
                            break; // 遇到其他字符，需要换行
                        }
                    }

                    if (needAppendNewline) {
                        sb.append('\n');
                        state.col = 0;
                        state.leadingSpaces = 0;
                    }

                    continue;
                }

                // 4️⃣ 普通字符
                sb.append(ch);
                i++; state.col++; state.leadingSpaces = 0;
            }

            processedLength = len; // 更新已处理长度
            return sb.toString();  // 返回完整处理结果
        }
    }

    public static class TypingScheduler {
        private static HandlerThread handlerThread;
        private static Handler handler;

        private TypingScheduler() {
            // 私有构造，禁止实例化
        }

        private static void ensureInit() {
            if (handlerThread == null) {
                synchronized (TypingScheduler.class) {
                    if (handlerThread == null) {
                        handlerThread = new HandlerThread("TypingSchedulerThread");
                        handlerThread.start();
                        handler = new Handler(handlerThread.getLooper());
                    }
                }
            }
        }

        /** 获取全局后台 Handler */
        public static Handler getHandler() {
            ensureInit();
            return handler;
        }

        /** 退出调度器 */
        public static void shutdown() {
            synchronized (TypingScheduler.class) {
                if (handlerThread != null) {
                    handlerThread.quitSafely();
                    handlerThread = null;
                    handler = null;
                }
            }
        }
    }

}
