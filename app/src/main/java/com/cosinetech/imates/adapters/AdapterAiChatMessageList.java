package com.cosinetech.imates.adapters;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CheckBox;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.airbnb.lottie.LottieAnimationView;
import com.bumptech.glide.Glide;
import com.cosinetech.imates.activities.ImageViewerActivity;
import com.cosinetech.imates.audio.AudioPlayManager;
import com.cosinetech.imates.audio.IAudioPlayListener;
import com.cosinetech.imates.databinding.ItemMessageDateBinding;
import com.cosinetech.imates.models.ChatDisplayItem;
import com.cosinetech.imates.models.ChatMessage;
import com.cosinetech.imates.R;
import com.cosinetech.imates.util.ScreenUtils;
import com.cosinetech.imates.util.VoiceDbUtil;
import com.cosinetech.imates.views.ChatAiView;

import io.noties.markwon.Markwon;
import io.noties.markwon.recycler.MarkwonAdapter;

import java.util.ArrayList;
import java.util.List;

public class AdapterAiChatMessageList extends BaseBindingAdapter<ChatDisplayItem, androidx.databinding.ViewDataBinding> {

    public enum MessageDisplayType {
        TYPE_NONE(-1),
        TYPE_DATE(0),
        TYPE_IMAGE_LEFT(3),
        TYPE_IMAGE_RIGHT(4),
        TYPE_VOICE_LEFT(5),
        TYPE_VOICE_RIGHT(6),
        TYPE_TEXT_LEFT_MARKDOWN(7),
        TYPE_TEXT_RIGHT_MARKDOWN(8);

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

    private boolean mItemCanSelect = false;
    private int mAudioPlayingItemIndex = -1;
    private final RecyclerView mRecyclerView;

    public AdapterAiChatMessageList(Context context, List<ChatDisplayItem> msgList, RecyclerView view) {
        super(context);
        this.mRecyclerView = view;
        if (msgList != null) {
            this.items.addAll(msgList);
        }
    }

    public void setItemCanSelect(boolean canSelect) {
        mItemCanSelect = canSelect;
    }

    public List<ChatDisplayItem> getSelectedItem() {
        List<ChatDisplayItem> selectedItems = new ArrayList<>();
        for (ChatDisplayItem item : items) {
            if (item.isSelected) {
                selectedItems.add(item);
            }
        }
        return selectedItems;
    }

    @Override
    public int getItemViewType(int position) {
        ChatDisplayItem item = items.get(position);
        ChatMessage message = item.chatMessage;

        if (message.type == ChatMessage.MessageType.DATE) {
            return MessageDisplayType.TYPE_DATE.getValue();
        }
        if (message.type == ChatMessage.MessageType.TEXT) {
            if (message.isSelf) {
                return MessageDisplayType.TYPE_TEXT_RIGHT_MARKDOWN.getValue();
            } else {
                return MessageDisplayType.TYPE_TEXT_LEFT_MARKDOWN.getValue();
            }
        }
        if (message.type == ChatMessage.MessageType.IMAGE) {
            return message.isSelf ?
                    MessageDisplayType.TYPE_IMAGE_RIGHT.getValue() :
                    MessageDisplayType.TYPE_IMAGE_LEFT.getValue();
        }
        if (message.type == ChatMessage.MessageType.VOICE) {
            return message.isSelf ?
                    MessageDisplayType.TYPE_VOICE_RIGHT.getValue() :
                    MessageDisplayType.TYPE_VOICE_LEFT.getValue();
        }
        return MessageDisplayType.TYPE_NONE.getValue();
    }

    @Override
    protected int getLayoutResId(int viewType) {
        MessageDisplayType type = MessageDisplayType.fromValue(viewType);
        switch (type) {
            case TYPE_DATE:
                return R.layout.item_message_date;
            case TYPE_TEXT_LEFT_MARKDOWN:
                return R.layout.item_message_left_markdown;
            case TYPE_TEXT_RIGHT_MARKDOWN:
                return R.layout.item_message_right_markdown;
            case TYPE_IMAGE_LEFT:
                return R.layout.item_message_image_left;
            case TYPE_IMAGE_RIGHT:
                return R.layout.item_message_image_right;
            case TYPE_VOICE_LEFT:
                return R.layout.item_message_voice_left;
            case TYPE_VOICE_RIGHT:
                return R.layout.item_message_voice_right;
            default:
                return R.layout.item_message_date; // fallback
        }
    }

    @Override
    protected void onBindItem(androidx.databinding.ViewDataBinding binding, ChatDisplayItem item, int position) {
        ChatMessage message = item.chatMessage;
        MessageDisplayType type = MessageDisplayType.fromValue(getItemViewType(position));

        // Set common data for all binding types
        binding.setVariable(com.cosinetech.imates.BR.data, item);
        binding.setVariable(com.cosinetech.imates.BR.message, message);
        binding.setVariable(com.cosinetech.imates.BR.position, position);

        switch (type) {
            case TYPE_DATE:
                bindDateItem((ItemMessageDateBinding) binding, message);
                break;
            case TYPE_TEXT_LEFT_MARKDOWN:
                bindMarkdownItem(binding, item, message, position);
                break;
            case TYPE_TEXT_RIGHT_MARKDOWN:
                bindMarkdownItem(binding, item, message, position);
                break;
            case TYPE_IMAGE_LEFT:
                bindImageItem(binding, item, message);
                break;
            case TYPE_IMAGE_RIGHT:
                bindImageItem(binding, item, message);
                break;
            case TYPE_VOICE_LEFT:
                bindVoiceItem(binding, item, message, position);
                break;
            case TYPE_VOICE_RIGHT:
                bindVoiceItem(binding, item, message, position);
                break;
        }

        binding.executePendingBindings();
    }

    private void bindDateItem(ItemMessageDateBinding binding, ChatMessage message) {
        // 日期已经通过 Data Binding 自动设置了
        // android:text="@{message.content}" 在布局文件中
    }

    private void bindMarkdownItem(androidx.databinding.ViewDataBinding binding, ChatDisplayItem item, ChatMessage message, int position) {
        // 设置选择状态和头像
        setSelectionState(binding, item);
        setAvatarImage(binding, item);
        Log.e("bindMarkdownItem", "bindMarkdownItem!!!");
        // 获取 Markwon 和 MarkwonAdapter 实例
        final Markwon markwon = item.getMarkwon();
        final MarkwonAdapter adapter = item.getMarkwonAdapter();

        // 获取 RecyclerView
        RecyclerView recyclerView = binding.getRoot().findViewById(R.id.recycler_view);
        if (recyclerView != null) {
            recyclerView.setLayoutManager(new LinearLayoutManager(context));
            recyclerView.setAdapter(adapter);

            // 处理打字效果或直接显示
            if (item.shouldShowTypingEffect()) {
                item.startTypingEffect(new ChatDisplayItem.TypingEffectCallback() {
                    @Override
                    public void onContentUpdate(String content) {
                        adapter.setMarkdown(markwon, content);
                        adapter.notifyDataSetChanged();
                        //recyclerView.post(() -> );

                        // 滚动到底部
//                        if (mRecyclerView != null) {
//                            mRecyclerView.scrollToPosition(items.size() - 1);
//                        }
                    }

                    @Override
                    public void onTypingComplete(String content) {
                        adapter.setMarkdown(markwon, content);
                        //adapter.notifyDataSetChanged();
                        Log.d("TypingEffect", "Typing effect completed");
                    }
                });
            } else {
                // 直接显示完整内容，参考 VoiceListAdapter 的方式
                adapter.setMarkdown(markwon, message.content);
            }
        }
    }

    private void bindImageItem(androidx.databinding.ViewDataBinding binding, ChatDisplayItem item, ChatMessage message) {
        setSelectionState(binding, item);
        setAvatarImage(binding, item);

        // 获取 ImageView 并加载图片
        ImageView imageView = binding.getRoot().findViewById(R.id.iv_message_image);
        if (imageView != null) {
            Glide.with(context)
                    .load(message.content)
                    .into(imageView);

            imageView.setOnClickListener(v -> {
                Intent intent = new Intent(context, ImageViewerActivity.class);
                intent.putExtra("image_path", message.content);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            });
        }
    }

    @SuppressLint("SetTextI18n")
    private void bindVoiceItem(androidx.databinding.ViewDataBinding binding, ChatDisplayItem item, ChatMessage message, int position) {
        setSelectionState(binding, item);
        setAvatarImage(binding, item);

        VoiceDbUtil.VoiceDbItem vi = VoiceDbUtil.extractDbVoiceContent(message.content);

        // 获取控件
        View voiceLayout = binding.getRoot().findViewById(R.id.voice_layout);
        TextView tvVoiceLength = binding.getRoot().findViewById(R.id.tv_voice_length);
        LottieAnimationView ivVoiceIcon = binding.getRoot().findViewById(R.id.iv_voice_icon);

        if (voiceLayout != null && tvVoiceLength != null && ivVoiceIcon != null) {
            // 计算语音布局宽度
            int baseWidth = ScreenUtils.dpToPx(context, 100);
            int minWidth = ScreenUtils.dpToPx(context, 100);
            int maxWidth = ScreenUtils.dpToPx(context, 600);
            int calculatedWidth = baseWidth + (vi.duration * ScreenUtils.dpToPx(context, 5));
            calculatedWidth = Math.min(Math.max(calculatedWidth, minWidth), maxWidth);

            ViewGroup.LayoutParams params = voiceLayout.getLayoutParams();
            params.width = calculatedWidth;
            voiceLayout.setLayoutParams(params);

            tvVoiceLength.setText(vi.duration + "\"");

            // 处理动画状态
            if (mAudioPlayingItemIndex == position) {
                ivVoiceIcon.playAnimation();
            } else {
                ivVoiceIcon.cancelAnimation();
            }

            // 设置点击监听器
            ivVoiceIcon.setOnClickListener(v -> handleVoiceClick(position, vi.voicePath));
        }
    }

    private void handleVoiceClick(int position, String voicePath) {
        if (mAudioPlayingItemIndex >= 0) {
            notifyItemChanged(mAudioPlayingItemIndex);
        }

        if (mAudioPlayingItemIndex == position) {
            AudioPlayManager.getInstance().stopPlay();
            notifyItemChanged(position);
        } else {
            AudioPlayManager.getInstance().stopPlay();
            AudioPlayManager.getInstance().startPlay(context, voicePath, new IAudioPlayListener() {
                @Override
                public void onStart(Uri var1) {
                    mAudioPlayingItemIndex = position;
                }

                @Override
                public void onStop(Uri var1) {
                    mAudioPlayingItemIndex = -1;
                    notifyItemChanged(position);
                }

                @Override
                public void onComplete(Uri var1) {
                    mAudioPlayingItemIndex = -1;
                    notifyItemChanged(position);
                }
            });
            notifyItemChanged(position);
        }
    }

    private void setSelectionState(androidx.databinding.ViewDataBinding binding, ChatDisplayItem item) {
        CheckBox checkBox = binding.getRoot().findViewById(R.id.iv_select);
        if (checkBox != null) {
            checkBox.setChecked(item.isSelected);
            checkBox.setVisibility(mItemCanSelect ? View.VISIBLE : View.GONE);
            checkBox.setOnCheckedChangeListener((buttonView, isChecked) -> item.isSelected = isChecked);
        }
    }

    private void setAvatarImage(androidx.databinding.ViewDataBinding binding, ChatDisplayItem item) {
        ImageView avatarView = binding.getRoot().findViewById(R.id.iv_avatar);
        if (avatarView != null) {
            if (item.chatMessage.isSelf) {
                avatarView.setImageResource(R.drawable.chat_ai_avatar_user);
            } else {
                for (ChatAiView.ChatRole role : ChatAiView.ChatRole.values()) {
                    if (item.chatMessage.role == role.ordinal()) {
                        avatarView.setImageResource(role.getIconResId());
                        break;
                    }
                }
            }
        }
    }

    public void updateReceivingMessage(String msgId, boolean showWithTypingEffect, boolean msgIsFinished) {
        for (int i = items.size() - 1; i >= 0; i--) {
            if (items.get(i).chatMessage.messageId.equals(msgId)) {
                ChatDisplayItem displayMsg = items.get(i);
                displayMsg.showWithTypingEffect = showWithTypingEffect;
                displayMsg.msgIsFinished = msgIsFinished;

                //notifyDataSetChanged();
                break;
            }
        }
    }

    @Override
    public void onViewRecycled(@NonNull RecyclerView.ViewHolder holder) {
        super.onViewRecycled(holder);
        // 清理资源
        if (holder instanceof BaseBindingViewHolder) {
            // 可以在这里添加清理逻辑
        }
    }
}
