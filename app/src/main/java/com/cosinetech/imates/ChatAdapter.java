package com.cosinetech.imates;

import android.media.MediaPlayer;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.bumptech.glide.Glide;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class ChatAdapter extends RecyclerView.Adapter<RecyclerView.ViewHolder> {

    private static final int TYPE_DATE = 0;
    private static final int TYPE_TEXT_LEFT = 1;
    private static final int TYPE_TEXT_RIGHT = 2;
    private static final int TYPE_IMAGE_LEFT = 3;
    private static final int TYPE_IMAGE_RIGHT = 4;
    private static final int TYPE_VOICE_LEFT = 5;
    private static final int TYPE_VOICE_RIGHT = 6;

    private List<ChatMessage> messageList;

    public ChatAdapter(List<ChatMessage> messageList) {
        this.messageList = groupMessagesWithDate(messageList);
    }

    private List<ChatMessage> groupMessagesWithDate(List<ChatMessage> messages) {
        List<ChatMessage> groupedMessages = new ArrayList<>();
        long lastTimestamp = 0;

        for (ChatMessage message : messages) {
            if (message.type != ChatMessage.TYPE_DATE && message.timestamp - lastTimestamp > 5 * 60 * 1000) {
                groupedMessages.add(new ChatMessage(
                        new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(new Date(message.timestamp)),
                        false,
                        message.timestamp,
                        ChatMessage.TYPE_DATE
                ));
                lastTimestamp = message.timestamp;
            }
            groupedMessages.add(message);
        }
        return groupedMessages;
    }

    @Override
    public int getItemViewType(int position) {
       ChatMessage message = messageList.get(position);
        if (message.type == ChatMessage.TYPE_DATE) return TYPE_DATE;
        if (message.type == ChatMessage.TYPE_TEXT) return message.isSelf ? TYPE_TEXT_RIGHT : TYPE_TEXT_LEFT;
        if (message.type == ChatMessage.TYPE_IMAGE) return message.isSelf ? TYPE_IMAGE_RIGHT : TYPE_IMAGE_LEFT;
        if (message.type == ChatMessage.TYPE_VOICE) return message.isSelf ? TYPE_VOICE_RIGHT : TYPE_VOICE_LEFT;
        return -1;
    }

    @NonNull
    @Override
    public RecyclerView.ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view;
        switch (viewType) {
            case TYPE_DATE:
                view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_message_date, parent, false);
                return new DateViewHolder(view);
            case TYPE_TEXT_LEFT:
            case TYPE_TEXT_RIGHT:
                view = LayoutInflater.from(parent.getContext()).inflate(
                        viewType == TYPE_TEXT_LEFT ? R.layout.item_message_left : R.layout.item_message_right,
                        parent,
                        false
                );
                return new TextViewHolder(view);
            case TYPE_IMAGE_LEFT:
            case TYPE_IMAGE_RIGHT:
                view = LayoutInflater.from(parent.getContext()).inflate(
                        viewType == TYPE_IMAGE_LEFT ? R.layout.item_message_image_left : R.layout.item_message_image_right,
                        parent,
                        false
                );
                return new ImageViewHolder(view);
            case TYPE_VOICE_LEFT:
            case TYPE_VOICE_RIGHT:
                view = LayoutInflater.from(parent.getContext()).inflate(
                        viewType == TYPE_VOICE_LEFT ? R.layout.item_message_voice_left : R.layout.item_message_voice_right,
                        parent,
                        false
                );
                return new VoiceViewHolder(view);
        }
        return null;
    }

    @Override
    public void onBindViewHolder(@NonNull RecyclerView.ViewHolder holder, int position) {
        ChatMessage message = messageList.get(position);

        if (holder instanceof DateViewHolder) {
            ((DateViewHolder) holder).tvDate.setText(message.content);
        } else if (holder instanceof TextViewHolder) {
            ((TextViewHolder) holder).tvMessage.setText(message.content);
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
                    mediaPlayer.setDataSource(message.content);
                    mediaPlayer.prepare();
                    mediaPlayer.start();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        }
    }

    @Override
    public int getItemCount() {
        return messageList.size();
    }

    static class DateViewHolder extends RecyclerView.ViewHolder {
        TextView tvDate;
        public DateViewHolder(@NonNull View itemView) {
            super(itemView);
            tvDate = itemView.findViewById(R.id.tv_date);
        }
    }

    static class TextViewHolder extends RecyclerView.ViewHolder {
        TextView tvMessage;
        public TextViewHolder(@NonNull View itemView) {
            super(itemView);
            tvMessage = itemView.findViewById(R.id.tv_message);
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
