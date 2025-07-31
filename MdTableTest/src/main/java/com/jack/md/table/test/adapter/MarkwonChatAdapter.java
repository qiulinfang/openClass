package com.jack.md.table.test.adapter;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CheckBox;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.R;
import com.cosinetech.imates.models.ChatDisplayItem;
import com.cosinetech.imates.models.ChatMessage;
import com.cosinetech.imates.views.ChatAiView;
import com.cosinetech.imates.views.MarkdownTextView;

import org.commonmark.ext.gfm.tables.TableBlock;
import org.commonmark.node.FencedCodeBlock;

import java.util.ArrayList;
import java.util.List;

import io.noties.markwon.AbstractMarkwonPlugin;
import io.noties.markwon.Markwon;
import io.noties.markwon.MarkwonConfiguration;
import io.noties.markwon.MarkwonVisitor;
import io.noties.markwon.ext.strikethrough.StrikethroughPlugin;
import io.noties.markwon.ext.tasklist.TaskListPlugin;
import io.noties.markwon.html.HtmlPlugin;
import io.noties.markwon.image.ImagesPlugin;
import io.noties.markwon.recycler.MarkwonAdapter;
import io.noties.markwon.recycler.SimpleEntry;
import io.noties.markwon.recycler.table.TableEntry;
import io.noties.markwon.recycler.table.TableEntryPlugin;

public class MarkwonChatAdapter extends RecyclerView.Adapter<RecyclerView.ViewHolder> {
    
    public enum MessageDisplayType {
        TYPE_NONE(-1),
        TYPE_DATE(0),
        TYPE_TEXT_LEFT(1),
        TYPE_TEXT_RIGHT(2),
        TYPE_IMAGE_LEFT(3),
        TYPE_IMAGE_RIGHT(4),
        TYPE_VOICE_LEFT(5),
        TYPE_VOICE_RIGHT(6);

        private final int value;

        MessageDisplayType(int value) {
            this.value = value;
        }

        public int getValue() {
            return value;
        }

        public static MessageDisplayType fromValue(int value) {
            for (MessageDisplayType type : values()) {
                if (type.value == value) {
                    return type;
                }
            }
            throw new IllegalArgumentException("Unknown MessageType value: " + value);
        }
    }

    private final List<ChatDisplayItem> mMsgList;
    private boolean mItemCanSelect = false;
    private int mAudioPlayingItemIndex = -1;
    private final Context mContext;
    private final RecyclerView mRecyclerView;
    
    // Markwon 相关
    private Markwon markwon;
    private MarkwonAdapter markwonAdapter;

    public MarkwonChatAdapter(Context context, List<ChatDisplayItem> mMsgList, RecyclerView view) {
        this.mMsgList = mMsgList;
        this.mContext = context;
        this.mRecyclerView = view;
        
        // 初始化 Markwon
        initMarkwon();
    }

    private void initMarkwon() {
        markwon = Markwon.builder(mContext)
                .usePlugin(ImagesPlugin.create())
                .usePlugin(TableEntryPlugin.create(mContext))
                .usePlugin(HtmlPlugin.create())
                .usePlugin(StrikethroughPlugin.create())
                .usePlugin(TaskListPlugin.create(mContext))
                .usePlugin(new AbstractMarkwonPlugin() {
                    @Override
                    public void configureConfiguration(@NonNull MarkwonConfiguration.Builder builder) {
                        // 可以配置图片处理器
                    }

                    @Override
                    public void configureVisitor(@NonNull MarkwonVisitor.Builder builder) {
                        builder.on(FencedCodeBlock.class, (visitor, fencedCodeBlock) -> {
                            final CharSequence code = visitor.configuration()
                                    .syntaxHighlight()
                                    .highlight(fencedCodeBlock.getInfo(), fencedCodeBlock.getLiteral().trim());
                            visitor.builder().append(code);
                        });
                    }
                })
                .build();

        markwonAdapter = MarkwonAdapter.builderTextViewIsRoot(R.layout.adapter_node)
                .include(FencedCodeBlock.class, SimpleEntry.create(R.layout.adapter_node_code_block, R.id.text_view))
                .include(TableBlock.class, TableEntry.create(builder -> {
                    builder
                            .tableLayout(R.layout.adapter_node_table_block, R.id.table_layout)
                            .textLayoutIsRoot(R.layout.view_table_entry_cell);
                }))
                .build();
    }

    public void setItemCanSelect(boolean canSelect) {
        mItemCanSelect = canSelect;
    }

    public List<ChatDisplayItem> getSelectedItem() {
        List<ChatDisplayItem> items = new ArrayList<>();
        for(ChatDisplayItem item: mMsgList) {
            if(item.isSelected) {
                items.add(item);
            }
        }
        return items;
    }

    @Override
    public int getItemViewType(int position) {
        ChatDisplayItem item = mMsgList.get(position);
        ChatMessage message = item.chatMessage;
        if (message.type == ChatMessage.MessageType.DATE) {
            return MessageDisplayType.TYPE_DATE.getValue();
        }
        if (message.type == ChatMessage.MessageType.TEXT) {
            return message.isSelf ?
                    MessageDisplayType.TYPE_TEXT_RIGHT.value :
                    MessageDisplayType.TYPE_TEXT_LEFT.getValue();
        }
        if (message.type == ChatMessage.MessageType.IMAGE) {
            return message.isSelf ?
                    MessageDisplayType.TYPE_IMAGE_RIGHT.getValue() :
                    MessageDisplayType.TYPE_IMAGE_LEFT.getValue();
        }
        if (message.type == ChatMessage.MessageType.VOICE) {
            return message.isSelf ?
                    MessageDisplayType.TYPE_VOICE_RIGHT.getValue():
                    MessageDisplayType.TYPE_VOICE_LEFT.getValue();
        }
        return MessageDisplayType.TYPE_NONE.getValue();
    }

    @NonNull
    @Override
    public RecyclerView.ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType0) {
        View view;
        MessageDisplayType type = MessageDisplayType.fromValue(viewType0);
        switch (type) {
            case TYPE_DATE:
                view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_message_date, parent, false);
                return new DateViewHolder(view);
            case TYPE_TEXT_LEFT:
            case TYPE_TEXT_RIGHT:
                view = LayoutInflater.from(parent.getContext()).inflate(
                        type == MessageDisplayType.TYPE_TEXT_LEFT ?
                                R.layout.item_message_left_markdown :
                                R.layout.item_message_right_markdown,
                        parent,
                        false
                );
                return new MarkwonTextViewHolder(view);
            case TYPE_IMAGE_LEFT:
            case TYPE_IMAGE_RIGHT:
                view = LayoutInflater.from(parent.getContext()).inflate(
                        type == MessageDisplayType.TYPE_IMAGE_LEFT ?
                                R.layout.item_message_image_left :
                                R.layout.item_message_image_right,
                        parent,
                        false
                );
                return new ImageViewHolder(view);
            case TYPE_VOICE_LEFT:
            case TYPE_VOICE_RIGHT:
                view = LayoutInflater.from(parent.getContext()).inflate(
                        type == MessageDisplayType.TYPE_VOICE_LEFT ?
                                R.layout.item_message_voice_left :
                                R.layout.item_message_voice_right,
                        parent,
                        false
                );
                return new VoiceViewHolder(view);
        }
        return null;
    }

    @Override
    public void onBindViewHolder(@NonNull RecyclerView.ViewHolder holder, int pos) {
        ChatDisplayItem item = mMsgList.get(pos);
        ChatMessage message = item.chatMessage;

        if (holder instanceof DateViewHolder) {
            ((DateViewHolder) holder).tvDate.setText(message.content);
        } else if (holder instanceof MarkwonTextViewHolder) {
            bindMarkwonTextViewHolder((MarkwonTextViewHolder) holder, item, message);
        } else if (holder instanceof ImageViewHolder) {
            bindImageViewHolder((ImageViewHolder) holder, message, item);
        } else if (holder instanceof VoiceViewHolder) {
            bindVoiceViewHolder((VoiceViewHolder) holder, pos, message, item);
        }
    }

    @Override
    public void onBindViewHolder(@NonNull RecyclerView.ViewHolder holder, int pos, @NonNull List<Object> payloads) {
        if (!payloads.isEmpty()) {
            ChatDisplayItem item = mMsgList.get(pos);
            for (Object payload : payloads) {
                if (payload instanceof Boolean) {
                    boolean showTypingEffect = (Boolean) payload;
                    MarkwonTextViewHolder viewHolder = (MarkwonTextViewHolder) holder;
                    if (showTypingEffect) {
                        // 显示打字效果
                        viewHolder.markdownRecyclerView.setVisibility(View.GONE);
                        viewHolder.tvMessage.setVisibility(View.VISIBLE);
                        viewHolder.tvMessage.setTypingEffectDisplayItem(item);
                        viewHolder.tvMessage.enableTypingEffectDisplay();
                    } else {
                        // 显示 Markdown 渲染
                        viewHolder.tvMessage.setVisibility(View.GONE);
                        viewHolder.markdownRecyclerView.setVisibility(View.VISIBLE);
                        viewHolder.markdownRecyclerView.setLayoutManager(new LinearLayoutManager(mContext));
                        viewHolder.markdownRecyclerView.setAdapter(markwonAdapter);
                        markwonAdapter.setMarkdown(markwon, message.content);
                    }
                    return;
                }
            }
        }
        super.onBindViewHolder(holder, pos, payloads);
    }

    private void bindMarkwonTextViewHolder(MarkwonTextViewHolder holder, ChatDisplayItem item, ChatMessage message) {
        // 设置选择状态
        holder.tvSelected.setChecked(false);
        if(mItemCanSelect) {
            holder.tvSelected.setVisibility(View.VISIBLE);
        } else {
            holder.tvSelected.setVisibility(View.GONE);
        }
        holder.tvSelected.setOnCheckedChangeListener((buttonView, isChecked) -> {
            item.isSelected = isChecked;
        });

        // 设置头像
        if(item.chatMessage.isSelf) {
            holder.ivAvastar.setImageResource(R.drawable.chat_ai_avatar_user);
        } else {
            for (ChatAiView.ChatRole role : ChatAiView.ChatRole.values()) {
                if(item.chatMessage.role == role.ordinal()) {
                    holder.ivAvastar.setImageResource(role.getIconResId());
                    break;
                }
            }
        }

        // 根据是否显示打字效果来决定显示方式
        if(item.showWithTypingEffect) {
            holder.markdownRecyclerView.setVisibility(View.GONE);
            holder.tvMessage.setVisibility(View.VISIBLE);
            holder.tvMessage.setTypingEffectDisplayItem(item);
            holder.tvMessage.enableTypingEffectDisplay();
        } else {
            holder.tvMessage.setVisibility(View.GONE);
            holder.markdownRecyclerView.setVisibility(View.VISIBLE);
            holder.markdownRecyclerView.setLayoutManager(new LinearLayoutManager(mContext));
            holder.markdownRecyclerView.setAdapter(markwonAdapter);
            markwonAdapter.setMarkdown(markwon, message.content);
        }
    }

    private void bindImageViewHolder(ImageViewHolder holder, ChatMessage message, ChatDisplayItem item) {
        // 图片处理逻辑保持不变
        // ... 原有的图片绑定逻辑
    }

    private void bindVoiceViewHolder(VoiceViewHolder holder, int pos, ChatMessage message, ChatDisplayItem item) {
        // 语音处理逻辑保持不变
        // ... 原有的语音绑定逻辑
    }

    @Override
    public void onViewAttachedToWindow(@NonNull RecyclerView.ViewHolder holder) {
        super.onViewAttachedToWindow(holder);
        if (holder instanceof MarkwonTextViewHolder) {
            MarkwonTextViewHolder textHolder = (MarkwonTextViewHolder) holder;
            textHolder.tvMessage.setEnabled(false);
            textHolder.tvMessage.setEnabled(true);
            textHolder.tvMessage.setTextIsSelectable(true);
            textHolder.tvMessage.setFocusableInTouchMode(true);
        }
    }

    @Override
    public int getItemCount() {
        return mMsgList.size();
    }

    public void updateReceivingMessage(String msgId, boolean showWithTypingEffect) {
        for(int i = mMsgList.size() - 1; i >= 0; i--) {
            if(mMsgList.get(i).chatMessage.messageId.equals(msgId)) {
                ChatDisplayItem displayMsg = mMsgList.get(i);
                displayMsg.showWithTypingEffect = showWithTypingEffect;
                notifyItemChanged(i, showWithTypingEffect);
                break;
            }
        }
    }

    // ViewHolder 类
    static class DateViewHolder extends RecyclerView.ViewHolder {
        private final TextView tvDate;
        public DateViewHolder(@NonNull View itemView) {
            super(itemView);
            tvDate = itemView.findViewById(R.id.tv_date);
            tvDate.setText("");
        }
    }

    static class MarkwonTextViewHolder extends RecyclerView.ViewHolder {
        private final MarkdownTextView tvMessage;
        private final RecyclerView markdownRecyclerView;
        private final CheckBox tvSelected;
        private final ImageView ivAvastar;

        public MarkwonTextViewHolder(@NonNull View itemView) {
            super(itemView);
            tvMessage = itemView.findViewById(R.id.tv_message);
            markdownRecyclerView = itemView.findViewById(R.id.markdown_recycler_view);
            tvSelected = itemView.findViewById(R.id.iv_select);
            ivAvastar = itemView.findViewById(R.id.iv_avatar);
            
            tvMessage.setTextIsSelectable(true);
            tvMessage.clearContent();
        }
        
        public void cleanUp() {
            tvMessage.disableTypingEffectDisplay();
            tvMessage.clearContent();
        }
    }

    static class ImageViewHolder extends RecyclerView.ViewHolder {
        private final ImageView ivMessageImage;
        private final CheckBox tvSelected;
        private final ImageView ivAvastar;
        public ImageViewHolder(@NonNull View itemView) {
            super(itemView);
            ivMessageImage = itemView.findViewById(R.id.iv_message_image);
            ivMessageImage.setImageBitmap(null);
            tvSelected = itemView.findViewById(R.id.iv_select);
            ivAvastar = itemView.findViewById(R.id.iv_avatar);
        }
    }

    static class VoiceViewHolder extends RecyclerView.ViewHolder {
        private final ImageView ivVoiceIcon;
        private final TextView tvVoiceLength;
        private final CheckBox tvSelected;
        private final View ivLayout;
        private final ImageView ivAvastar;
        
        public VoiceViewHolder(@NonNull View itemView) {
            super(itemView);
            ivVoiceIcon = itemView.findViewById(R.id.iv_voice_icon);
            tvVoiceLength = itemView.findViewById(R.id.tv_voice_length);
            tvSelected = itemView.findViewById(R.id.iv_select);
            ivLayout = itemView.findViewById(R.id.voice_layout);
            ivAvastar = itemView.findViewById(R.id.iv_avatar);
        }
    }
} 