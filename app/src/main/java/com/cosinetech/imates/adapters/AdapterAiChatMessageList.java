package com.cosinetech.imates.adapters;

import android.content.Context;
import android.content.Intent;
import android.media.MediaPlayer;
import android.net.Uri;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CheckBox;
import android.widget.CompoundButton;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.core.content.FileProvider;
import androidx.recyclerview.widget.RecyclerView;

import com.airbnb.lottie.LottieAnimationView;
import com.bumptech.glide.Glide;
import com.cosinetech.imates.activities.ImageViewerActivity;
import com.cosinetech.imates.audio.AudioPlayManager;
import com.cosinetech.imates.audio.IAudioPlayListener;
import com.cosinetech.imates.models.ChatDisplayItem;
import com.cosinetech.imates.models.ChatMessage;
import com.cosinetech.imates.R;
import com.cosinetech.imates.util.ScreenUtils;
import com.cosinetech.imates.util.VoiceDbUtil;
import com.cosinetech.imates.views.MarkdownTextView;

import org.w3c.dom.Text;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class AdapterAiChatMessageList extends RecyclerView.Adapter<RecyclerView.ViewHolder> {
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

    //收到的消息显示哪个头像? 默认是机器人, 老师的消息显示人物头像
    private int mOtherAvastarIconRes = R.drawable. chat_ai_avatar_robot;

    public AdapterAiChatMessageList(Context context, List<ChatDisplayItem> mMsgList, RecyclerView view) {
        this.mMsgList = mMsgList; //groupMessagesWithDate(messageList);
        this.mContext = context;
        this.mRecyclerView = view;
    }

    public void setOtherAvastarIconRes(int res) {
        mOtherAvastarIconRes = res;
    }

//    private List<ChatDisplayItem> groupMessagesWithDate(List<ChatDisplayItem> messages) {
//        List<ChatDisplayItem> groupedMessages = new ArrayList<>();
//        long lastTimestamp = 0;
//
//        for (ChatDisplayItem message : messages) {
//            if (message.type != ChatMessage.TYPE_DATE && message.timestamp - lastTimestamp > 5 * 60 * 1000) {
//                groupedMessages.add(new ChatMessage(new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(new Date(message.timestamp)),
//                        false,
//                        ChatMessage.TYPE_DATE,
//                        true,
//                        message.sessionId,
//                        message.catalogId,
//                        message.timestamp
//                ));
//                lastTimestamp = message.timestamp;
//            }
//            groupedMessages.add(message);
//        }
//        return groupedMessages;
//    }

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
        Log.e("================",  "Create View Holder" );
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
                                R.layout.item_message_left :
                                R.layout.item_message_right,
                        parent,
                        false
                );
                return new TextViewHolder(view);
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
        } else if (holder instanceof TextViewHolder) {
            bindTextViewHolder((TextViewHolder) holder, item, message);
        } else if (holder instanceof ImageViewHolder) {
            bindImageViewHolder((ImageViewHolder) holder, message, item);
        } else if (holder instanceof VoiceViewHolder) {
            bindVoiceViewHolder((VoiceViewHolder) holder, pos, message, item);
        }
    }

    @Override
    public void onBindViewHolder(@NonNull RecyclerView.ViewHolder holder, int pos, @NonNull List<Object> payloads) {
        if (!payloads.isEmpty()) {
            // 仅更新 TextView 内容，避免重新布局
            ChatDisplayItem item = mMsgList.get(pos);
            //ChatMessage message = item.chatMessage;
            for (Object payload : payloads) {
                if (payload instanceof Boolean) {
                    boolean showTypingEffect = (Boolean) payload;
                    TextViewHolder viewHolder = (TextViewHolder) holder;
                    viewHolder.tvMessage.setTypingEffectDisplayItem(item);
                    if (showTypingEffect) {
                        viewHolder.tvMessage.enableTypingEffectDisplay();
                    } else {
                        viewHolder.tvMessage.setContent(mMsgList.get(pos).chatMessage.content);
                    }
                    return; // 只处理 payload，避免完整绑定
                }
            }
        }
        super.onBindViewHolder(holder, pos, payloads); // 默认情况走完整绑定
    }

    private void bindVoiceViewHolder(VoiceViewHolder holder, int pos, ChatMessage message, ChatDisplayItem item) {
        VoiceDbUtil.VoiceDbItem vi = VoiceDbUtil.extractDbVoiceContent(message.content);

        // 计算 voice_layout 的宽度
        int baseWidth = ScreenUtils.dpToPx(mContext, 100); // 基准宽度
        int minWidth = ScreenUtils.dpToPx(mContext, 100);   // 最小宽度
        int maxWidth = ScreenUtils.dpToPx(mContext, 600);  // 最大宽度
        int calculatedWidth = baseWidth + (vi.duration * ScreenUtils.dpToPx(mContext, 5)); // 根据语音时长调整宽度

        // 限制宽度在 minWidth 和 maxWidth 之间
        calculatedWidth = Math.min(Math.max(calculatedWidth, minWidth), maxWidth);

        // 设置 voice_layout 的宽度
        ViewGroup.LayoutParams params = holder.ivLayout.getLayoutParams();
        params.width = calculatedWidth;
        holder.ivLayout.setLayoutParams(params);

        holder.tvVoiceLength.setText(vi.duration + "\"");
        if (mAudioPlayingItemIndex == pos) {
            holder.ivVoiceIcon.playAnimation();
        } else {
            holder.ivVoiceIcon.cancelAnimation();
        }

        holder.ivVoiceIcon.setOnClickListener(v -> {
            if(mAudioPlayingItemIndex >= 0) {
                notifyItemChanged(mAudioPlayingItemIndex);
            }

            if(mAudioPlayingItemIndex == pos) {
                AudioPlayManager.getInstance().stopPlay();
                notifyItemChanged(pos);
            } else {
                AudioPlayManager.getInstance().stopPlay();
                AudioPlayManager.getInstance().startPlay(mContext, vi.voicePath, new IAudioPlayListener() {
                    @Override
                    public void onStart(Uri var1) {
                        mAudioPlayingItemIndex = pos;
                        //开播（一般是开始语音消息动画）
                    }

                    @Override
                    public void onStop(Uri var1) {
                        mAudioPlayingItemIndex = -1;
                        notifyItemChanged(pos);
                    }

                    @Override
                    public void onComplete(Uri var1) {
                        //播完（一般是停止语音消息动画）
                        mAudioPlayingItemIndex = -1;
                        notifyItemChanged(pos);
                    }
                });
                notifyItemChanged(pos);
            }
        });

        holder.tvSelected.setChecked(false);
        if (mItemCanSelect) {
            holder.tvSelected.setVisibility(View.VISIBLE);
        } else {
            holder.tvSelected.setVisibility(View.GONE);
        }

        holder.tvSelected.setOnCheckedChangeListener((buttonView, isChecked) -> {
            item.isSelected = isChecked;
        });

        if(!item.chatMessage.isSelf) {
            holder.ivAvastar.setImageResource(mOtherAvastarIconRes);
        }
    }

    private void bindImageViewHolder(ImageViewHolder holder, ChatMessage message, ChatDisplayItem item) {
        Glide.with(holder.itemView.getContext())
                .load(message.content)
                .into(holder.ivMessageImage);

        holder.ivMessageImage.setOnClickListener(v -> {
            // content是图片的本地路径
            Intent intent = new Intent(mContext, ImageViewerActivity.class);
            intent.putExtra("image_path", message.content);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); // 添加 FLAG_ACTIVITY_NEW_TASK
            mContext.startActivity(intent);
        });

        holder.tvSelected.setChecked(false);
        if(mItemCanSelect) {
            holder.tvSelected.setVisibility(View.VISIBLE);
        } else {
            holder.tvSelected.setVisibility(View.GONE);
        }

        holder.tvSelected.setOnCheckedChangeListener((buttonView, isChecked) -> {
            item.isSelected = isChecked;
        });

        if(!item.chatMessage.isSelf) {
            holder.ivAvastar.setImageResource(mOtherAvastarIconRes);
        }
    }

    private void bindTextViewHolder(TextViewHolder holder, ChatDisplayItem item, ChatMessage message) {
        holder.tvMessage.clearContent();
        holder.tvMessage.setTypingEffectDisplayItem(item);
        holder.tvMessage.disableTypingEffectDisplay();
        if(item.showWithTypingEffect) {
            holder.tvMessage.enableTypingEffectDisplay();
        } else {
            holder.tvMessage.setContent(message.content);
        }

        holder.tvSelected.setChecked(false);
        if(mItemCanSelect) {
            holder.tvSelected.setVisibility(View.VISIBLE);
        } else {
            holder.tvSelected.setVisibility(View.GONE);
        }
        holder.tvSelected.setOnCheckedChangeListener((buttonView, isChecked) -> {
            item.isSelected = isChecked;
        });

        if(!item.chatMessage.isSelf) {
            holder.ivAvastar.setImageResource(mOtherAvastarIconRes);
        }
    }

    @Override
    public void onViewAttachedToWindow(@NonNull RecyclerView.ViewHolder holder) {
        super.onViewAttachedToWindow(holder);
        if (holder instanceof TextViewHolder) {
            ((TextViewHolder) holder).tvMessage.setEnabled(false);
            ((TextViewHolder) holder).tvMessage.setEnabled(true);
            ((TextViewHolder) holder).tvMessage.setTextIsSelectable(true);
            ((TextViewHolder) holder).tvMessage.setFocusableInTouchMode(true);
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

    static class DateViewHolder extends RecyclerView.ViewHolder {
        private final TextView tvDate;
        public DateViewHolder(@NonNull View itemView) {
            super(itemView);
            tvDate = itemView.findViewById(R.id.tv_date);
            tvDate.setText("");
        }
    }

    static class TextViewHolder extends RecyclerView.ViewHolder {
        private final MarkdownTextView tvMessage;
        private final CheckBox tvSelected;
        private final ImageView ivAvastar;

        public TextViewHolder(@NonNull View itemView) {
            super(itemView);
            tvMessage = itemView.findViewById(R.id.tv_message);
            tvMessage.setTextIsSelectable(true);
            tvMessage.clearContent();
            tvSelected = itemView.findViewById(R.id.iv_select);
            ivAvastar = itemView.findViewById(R.id.iv_avatar);
        }
        // 添加回收时清理的方法
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
        private final LottieAnimationView ivVoiceIcon;
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
