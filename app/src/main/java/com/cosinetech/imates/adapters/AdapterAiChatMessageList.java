package com.cosinetech.imates.adapters;

import android.media.MediaPlayer;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.bumptech.glide.Glide;
import com.cosinetech.imates.models.ChatDisplayItem;
import com.cosinetech.imates.models.ChatMessage;
import com.cosinetech.imates.R;
import com.cosinetech.imates.views.MarkdownTextView;

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

    private List<ChatDisplayItem> mMsgList;

    public AdapterAiChatMessageList(List<ChatDisplayItem> mMsgList) {
        this.mMsgList = mMsgList; //groupMessagesWithDate(messageList);
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
            if(message.isSelf || item.isDirectDisplay) {
                ((TextViewHolder) holder).tvMessage.setContent(message.content);
            } else {
                ((TextViewHolder) holder).tvMessage.setChatMessage(item);
                if(message.content.isEmpty()) {
                    ((TextViewHolder) holder).tvMessage.clearContent();
                }
                ((TextViewHolder) holder).tvMessage.startStreaming();
                Log.d("@@@@@@@@", pos + "-" + message.content);
            }
        } else if (holder instanceof ImageViewHolder) {
            Glide.with(holder.itemView.getContext())
                    .load(message.content)
                    .into(((ImageViewHolder) holder).ivMessageImage);

            ((ImageViewHolder) holder).ivMessageImage.setOnClickListener(v -> {
                // 图片预览逻辑
            });
        } else if (holder instanceof VoiceViewHolder) {
            ((VoiceViewHolder) holder).tvVoiceLength.setText("语音时长");
            ((VoiceViewHolder) holder).ivVoiceIcon.setOnClickListener(v -> {
                MediaPlayer mediaPlayer = new MediaPlayer();
                try {
                    mediaPlayer.setDataSource(message.content.toString());
                    mediaPlayer.prepare();
                    mediaPlayer.start();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
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

    public void updateLastMessage(String newContent, boolean isStream) {
        if (!mMsgList.isEmpty()) {
            ChatDisplayItem lastMessage = mMsgList.get(mMsgList.size() - 1);
            lastMessage.chatMessage.appendContent(newContent);
            lastMessage.isDirectDisplay = !isStream;
            notifyItemChanged(mMsgList.size() - 1); // 更新最后一个消息
        }
    }
    public void updateLastMessage(String newContent) {
        if (!mMsgList.isEmpty()) {
            ChatDisplayItem lastMessage = mMsgList.get(mMsgList.size() - 1);
            lastMessage.chatMessage.appendContent(newContent);
            notifyItemChanged(mMsgList.size() - 1); // 更新最后一个消息
        }
    }

    static class DateViewHolder extends RecyclerView.ViewHolder {
        TextView tvDate;
        public DateViewHolder(@NonNull View itemView) {
            super(itemView);
            tvDate = itemView.findViewById(R.id.tv_date);
        }
    }

    static class TextViewHolder extends RecyclerView.ViewHolder {
        private MarkdownTextView tvMessage;

        public TextViewHolder(@NonNull View itemView) {
            super(itemView);
            tvMessage = itemView.findViewById(R.id.tv_message);
            tvMessage.setTextIsSelectable(true);
        }
    }

    static class ImageViewHolder extends RecyclerView.ViewHolder {
        ImageView ivMessageImage;
        public ImageViewHolder(@NonNull View itemView) {
            super(itemView);
            ivMessageImage = itemView.findViewById(R.id.iv_message_image);
        }
    }

    static class VoiceViewHolder extends RecyclerView.ViewHolder {
        ImageView ivVoiceIcon;
        TextView tvVoiceLength;
        public VoiceViewHolder(@NonNull View itemView) {
            super(itemView);
            ivVoiceIcon = itemView.findViewById(R.id.iv_voice_icon);
            tvVoiceLength = itemView.findViewById(R.id.tv_voice_length);
        }
    }
}
