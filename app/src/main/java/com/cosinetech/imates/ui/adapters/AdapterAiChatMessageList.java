package com.cosinetech.imates.ui.adapters;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.graphics.drawable.AnimatedVectorDrawable;
import android.net.Uri;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CheckBox;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.databinding.ViewDataBinding;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.airbnb.lottie.LottieAnimationView;
import com.bumptech.glide.Glide;
import com.cosinetech.imates.databinding.ItemMessageImageLeftBinding;
import com.cosinetech.imates.databinding.ItemMessageImageRightBinding;
import com.cosinetech.imates.databinding.ItemMessageLeftMarkdownBinding;
import com.cosinetech.imates.databinding.ItemMessageVoiceLeftBinding;
import com.cosinetech.imates.databinding.ItemMessageVoiceRightBinding;
import com.cosinetech.imates.ui.activities.ImageViewerActivity;
import com.cosinetech.imates.audio.AudioPlayManager;
import com.cosinetech.imates.audio.IAudioPlayListener;
import com.cosinetech.imates.databinding.ItemMessageDateBinding;
import com.cosinetech.imates.data.models.ChatDisplayItem;
import com.cosinetech.imates.data.models.ChatMessage;
import com.cosinetech.imates.R;
import com.cosinetech.imates.utils.ScreenUtils;
import com.cosinetech.imates.utils.VoiceDbUtil;
import com.cosinetech.imates.ui.views.ChatAiView;
import com.cosinetech.imates.ui.views.MarkdownTextView;

import io.noties.markwon.Markwon;
import io.noties.markwon.recycler.MarkwonAdapter;

import java.util.ArrayList;
import java.util.List;

public class AdapterAiChatMessageList extends BaseBindingAdapter<ChatDisplayItem, androidx.databinding.ViewDataBinding> {
    private static final String TAG = "AdapterAiChatMessageList";
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
        return switch (type) {
            case TYPE_DATE -> R.layout.item_message_date;
            case TYPE_TEXT_LEFT_MARKDOWN -> R.layout.item_message_left_markdown;
            case TYPE_TEXT_RIGHT_MARKDOWN -> R.layout.item_message_right_markdown;
            case TYPE_IMAGE_LEFT -> R.layout.item_message_image_left;
            case TYPE_IMAGE_RIGHT -> R.layout.item_message_image_right;
            case TYPE_VOICE_LEFT -> R.layout.item_message_voice_left;
            case TYPE_VOICE_RIGHT -> R.layout.item_message_voice_right;
            default -> R.layout.item_message_date; // fallback
        };
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
            case TYPE_TEXT_LEFT_MARKDOWN, TYPE_TEXT_RIGHT_MARKDOWN:
                bindMarkdownItem(binding, item, message, position);
                break;
            case TYPE_IMAGE_LEFT, TYPE_IMAGE_RIGHT:
                bindImageItem(binding, item, message);
                break;
            case TYPE_VOICE_LEFT, TYPE_VOICE_RIGHT:
                bindVoiceItem(binding, item, message, position);
                break;
        }

        binding.executePendingBindings();
    }

    private void bindDateItem(ItemMessageDateBinding binding, ChatMessage message) {
        // 日期已经通过 Data Binding 自动设置了
        // android:text="@{message.content}" 在布局文件中
    }

    private void setMarkdownTextLegacy(MarkdownTextView tvMessage, ChatDisplayItem item) {
        ChatMessage message = item.chatMessage;
        tvMessage.clearContent();
        tvMessage.setTypingEffectDisplayItem(item);
        tvMessage.disableTypingEffectDisplay();
        if(item.showTypingAnimation) {
            tvMessage.enableTypingEffectDisplay();
        } else {
            tvMessage.setContent(message.content);
        }
    }

    private void bindMarkdownItem(androidx.databinding.ViewDataBinding binding, ChatDisplayItem item, ChatMessage message, int position) {
        // 设置选择状态和头像
        setItemSelectionState(binding, item);
        setItemAvatarImage(binding, item);
        setMarkdownItemContent(binding, item, message);
        setMarkdownAiItemAnimate(binding, item, message);
    }

    private void setMarkdownItemContent(ViewDataBinding binding, ChatDisplayItem item, ChatMessage message) {
        // 获取 RecyclerView
        // 获取 Markwon 和 MarkwonAdapter 实例
        final Markwon markwon = item.getMarkwon(32, true);
        final MarkwonAdapter adapter = item.getMarkwonAdapter();
        RecyclerView recyclerView = binding.getRoot().findViewById(R.id.recycler_view);
        if(!item.initialDisplayed) {
            recyclerView.setItemViewCacheSize(-100);
            recyclerView.setItemAnimator(null);
            recyclerView.setLayoutManager(new LinearLayoutManager(context));
            recyclerView.setAdapter(adapter);
        }
        // 处理打字效果或直接显示
        if (item.shouldShowTypingEffect()) {
            item.startTypingEffect(new ChatDisplayItem.TypingEffectCallback() {
                @Override
                public void onContentUpdate(String oldContent, String content) {
                    recyclerView.post(() -> {
                        adapter.setMarkdown(markwon, content);
                        adapter.notifyDataSetChanged();
                        updateMarkdownAiItemAnimate(binding, item, message);
                    });
                }

                @Override
                public void onTypingComplete(String content) {
                    recyclerView.post(() -> {
                        updateMarkdownAiItemAnimate(binding, item, message);
                    });

                }
            });
        } else {
            adapter.setMarkdown(markwon, ChatDisplayItem.filterLatexString(message.content));
            adapter.notifyDataSetChanged();
        }

        item.initialDisplayed = true;
    }

    private void setMarkdownAiItemAnimate(ViewDataBinding binding, ChatDisplayItem item, ChatMessage message) {
        if(item.chatMessage.isSelf) {
            Log.d(TAG, "Sending animation");
        } else {
            ImageView loading = ((ItemMessageLeftMarkdownBinding)binding).ivLoadingDots;
            if (loading.getDrawable() instanceof AnimatedVectorDrawable drawable) {
                if(!drawable.isRunning()) {
                    drawable.start();
                }
            }

            updateMarkdownAiItemAnimate(binding, item, message);
        }
    }

    private void updateMarkdownAiItemAnimate(ViewDataBinding binding, ChatDisplayItem item, ChatMessage message) {
        if(item.chatMessage.isSelf) {
            return;
        }
        View messageContainer = ((ItemMessageLeftMarkdownBinding)binding).messageContainer;
        ImageView loading = ((ItemMessageLeftMarkdownBinding)binding).ivLoadingDots;
        if(message.content.isEmpty()) {
            if (messageContainer.getVisibility() != View.GONE) {
                messageContainer.setVisibility(View.GONE);
            }
        } else {
            if (messageContainer.getVisibility() != View.VISIBLE) {
                messageContainer.setVisibility(View.VISIBLE);
            }
        }

        if(item.shouldShowTypingEffect()) {
            if(loading.getVisibility() != View.VISIBLE){
                loading.setVisibility(View.VISIBLE);
            }
        } else {
            if(loading.getVisibility() != View.INVISIBLE) {
                loading.setVisibility(View.INVISIBLE);
            }
        }
    }

    private void bindImageItem(androidx.databinding.ViewDataBinding binding, ChatDisplayItem item, ChatMessage message) {
        setItemSelectionState(binding, item);
        setItemAvatarImage(binding, item);

        // 获取 ImageView 并加载图片
        ImageView imageView;
        if(item.chatMessage.isSelf) {
            imageView = ((ItemMessageImageLeftBinding)binding).ivMessageImage;
        } else {
            imageView = ((ItemMessageImageRightBinding)binding).ivMessageImage;
        }
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

    @SuppressLint("SetTextI18n")
    private void bindVoiceItem(androidx.databinding.ViewDataBinding binding, ChatDisplayItem item, ChatMessage message, int position) {
        setItemSelectionState(binding, item);
        setItemAvatarImage(binding, item);

        VoiceDbUtil.VoiceDbItem vi = VoiceDbUtil.extractDbVoiceContent(message.content);

        // 获取控件
        View voiceLayout;
        TextView tvVoiceLength;
        LottieAnimationView ivVoiceIcon;
        if(item.chatMessage.isSelf) {
            voiceLayout = ((ItemMessageVoiceLeftBinding)binding).voiceLayout;
            tvVoiceLength = ((ItemMessageVoiceLeftBinding)binding).tvVoiceLength;
            ivVoiceIcon = ((ItemMessageVoiceLeftBinding)binding).ivVoiceIcon;
        } else {
            voiceLayout = ((ItemMessageVoiceRightBinding)binding).voiceLayout;
            tvVoiceLength = ((ItemMessageVoiceRightBinding)binding).tvVoiceLength;
            ivVoiceIcon = ((ItemMessageVoiceRightBinding)binding).ivVoiceIcon;
        }

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

    private void setItemSelectionState(androidx.databinding.ViewDataBinding binding, ChatDisplayItem item) {
        CheckBox checkBox = binding.getRoot().findViewById(R.id.iv_select);
        if (checkBox != null) {
            checkBox.setChecked(item.isSelected);
            checkBox.setVisibility(mItemCanSelect ? View.VISIBLE : View.GONE);
            checkBox.setOnCheckedChangeListener((buttonView, isChecked) -> item.isSelected = isChecked);
        }
    }

    private void setItemAvatarImage(androidx.databinding.ViewDataBinding binding, ChatDisplayItem item) {
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
                displayMsg.showTypingAnimation = showWithTypingEffect;
                displayMsg.msgContentIsFinished = msgIsFinished;

                notifyItemChanged(i, displayMsg.showTypingAnimation);
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
            int position = holder.getBindingAdapterPosition();
            if (position == RecyclerView.NO_POSITION) return;

            ChatDisplayItem item = items.get(position);
            if (item == null) return;
            item.getMarkwonAdapter().clear();

            int viewType = getItemViewType(position);
            MessageDisplayType type = MessageDisplayType.fromValue(viewType);

            switch (type) {
                case TYPE_TEXT_LEFT_MARKDOWN:
                    item.stopTypingEffect();
                    View msgContainer = holder.itemView.findViewById(R.id.message_container);
                    msgContainer.setVisibility(View.GONE);
                    ImageView loading = holder.itemView.findViewById(R.id.iv_loading_dots);
                    loading.setVisibility(View.VISIBLE);
                    break;
                case TYPE_TEXT_RIGHT_MARKDOWN:
                    break;

                case TYPE_IMAGE_LEFT:
                case TYPE_IMAGE_RIGHT:
                    // 清理 Glide 图片
                    ImageView imageView = holder.itemView.findViewById(R.id.iv_message_image);
                    if (imageView != null) {
                        Glide.with(imageView.getContext()).clear(imageView);
                    }
                    break;

                case TYPE_VOICE_LEFT:
                case TYPE_VOICE_RIGHT:
                    // 停止 Lottie 动画
                    LottieAnimationView ivVoiceIcon = holder.itemView.findViewById(R.id.iv_voice_icon);
                    if (ivVoiceIcon != null) ivVoiceIcon.cancelAnimation();

                    // 停止音频播放（如果当前播放的是这个 item）
                    if (position == mAudioPlayingItemIndex) {
                        AudioPlayManager.getInstance().stopPlay();
                        mAudioPlayingItemIndex = -1;
                    }
                    break;

                case TYPE_DATE:
                default:
                    // 一般不需要额外清理
                    break;
            }

            // 公共清理
            CheckBox checkBox = holder.itemView.findViewById(R.id.iv_select);
            if (checkBox != null) checkBox.setOnCheckedChangeListener(null);
        }
    }

    @Override
    public void onViewAttachedToWindow(@NonNull RecyclerView.ViewHolder holder) {
        super.onViewAttachedToWindow(holder);

        int pos = holder.getBindingAdapterPosition();
        if(pos == RecyclerView.NO_POSITION) {
            return;
        }
        MessageDisplayType type = MessageDisplayType.fromValue(getItemViewType(pos));
        if(type == MessageDisplayType.TYPE_TEXT_LEFT_MARKDOWN
            || type == MessageDisplayType.TYPE_TEXT_RIGHT_MARKDOWN)  {
            ChatDisplayItem item = items.get(pos);
            //setMarkdownTextLegacy(holder.itemView.findViewById(R.id.tv_message), item);
            MarkwonAdapter adapter = item.getMarkwonAdapter();
            adapter.notifyDataSetChanged();
            Log.e(TAG, "View Displayed");
        }
    }
}
