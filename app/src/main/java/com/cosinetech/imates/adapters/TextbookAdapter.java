package com.cosinetech.imates.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.bumptech.glide.Glide;
import com.cosinetech.imates.R;
import com.cosinetech.imates.models.Textbook;

import java.util.List;

public class TextbookAdapter extends RecyclerView.Adapter<TextbookAdapter.TextbookViewHolder> {
    private Context context;
    private List<Textbook> textbooks;
    private OnTextbookClickListener listener;

    public interface OnTextbookClickListener {
        void onDownloadClick(Textbook textbook);
        void onTextbookClick(Textbook textbook);
    }

    public TextbookAdapter(Context context, List<Textbook> textbooks) {
        this.context = context;
        this.textbooks = textbooks;
    }

    public void setOnTextbookClickListener(OnTextbookClickListener listener) {
        this.listener = listener;
    }

    @NonNull
    @Override
    public TextbookViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_textbook, parent, false);
        return new TextbookViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull TextbookViewHolder holder, int position) {
        Textbook textbook = textbooks.get(position);
        holder.bind(textbook);
    }

    @Override
    public int getItemCount() {
        return textbooks != null ? textbooks.size() : 0;
    }

    public void updateTextbooks(List<Textbook> newTextbooks) {
        this.textbooks = newTextbooks;
        notifyDataSetChanged();
    }

    public void updateTextbook(Textbook textbook) {
        for (int i = 0; i < textbooks.size(); i++) {
            if (textbooks.get(i).getTitle().equals(textbook.getTitle())) {
                textbooks.set(i, textbook);
                notifyItemChanged(i);
                break;
            }
        }
    }

    class TextbookViewHolder extends RecyclerView.ViewHolder {
        ImageView coverImageView;
        TextView titleTextView;
        TextView fileSizeTextView;
        TextView statusTextView;
        Button downloadButton;
        ProgressBar progressBar;
        TextView progressTextView;

        public TextbookViewHolder(@NonNull View itemView) {
            super(itemView);
            coverImageView = itemView.findViewById(R.id.iv_cover);
            titleTextView = itemView.findViewById(R.id.tv_title);
            fileSizeTextView = itemView.findViewById(R.id.tv_file_size);
            statusTextView = itemView.findViewById(R.id.tv_status);
            downloadButton = itemView.findViewById(R.id.btn_download);
            progressBar = itemView.findViewById(R.id.progress_bar);
            progressTextView = itemView.findViewById(R.id.tv_progress);

            itemView.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onTextbookClick(textbooks.get(getAdapterPosition()));
                }
            });

            downloadButton.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onDownloadClick(textbooks.get(getAdapterPosition()));
                }
            });
        }

        public void bind(Textbook textbook) {
            titleTextView.setText(textbook.getTitle());
            fileSizeTextView.setText(textbook.getFormattedFileSize());

            // Load cover image
            Glide.with(context)
                    .load(textbook.getCoverUrl())
                    .placeholder(R.drawable.placeholder_book)
                    .error(R.drawable.placeholder_book)
                    .into(coverImageView);

            // Update UI based on download status
            updateDownloadStatus(textbook);
        }

        private void updateDownloadStatus(Textbook textbook) {
            switch (textbook.getDownloadStatus()) {
                case NOT_DOWNLOADED:
                    statusTextView.setText("未下载");
                    statusTextView.setTextColor(context.getResources().getColor(android.R.color.holo_orange_dark));
                    downloadButton.setText("下载");
                    downloadButton.setEnabled(true);
                    progressBar.setVisibility(View.GONE);
                    progressTextView.setVisibility(View.GONE);
                    break;

                case DOWNLOADING:
                    statusTextView.setText("下载中");
                    statusTextView.setTextColor(context.getResources().getColor(android.R.color.holo_blue_dark));
                    downloadButton.setText("取消");
                    downloadButton.setEnabled(true);
                    progressBar.setVisibility(View.VISIBLE);
                    progressTextView.setVisibility(View.VISIBLE);
                    progressBar.setProgress(textbook.getDownloadProgress());
                    progressTextView.setText(textbook.getDownloadProgress() + "%");
                    break;

                case DOWNLOADED:
                    statusTextView.setText("已下载");
                    statusTextView.setTextColor(context.getResources().getColor(android.R.color.holo_green_dark));
                    downloadButton.setText("已下载");
                    downloadButton.setEnabled(false);
                    progressBar.setVisibility(View.GONE);
                    progressTextView.setVisibility(View.GONE);
                    break;

                case UPDATE_AVAILABLE:
                    statusTextView.setText("有更新");
                    statusTextView.setTextColor(context.getResources().getColor(android.R.color.holo_red_dark));
                    downloadButton.setText("更新");
                    downloadButton.setEnabled(true);
                    progressBar.setVisibility(View.GONE);
                    progressTextView.setVisibility(View.GONE);
                    break;

                case DOWNLOAD_FAILED:
                    statusTextView.setText("下载失败");
                    statusTextView.setTextColor(context.getResources().getColor(android.R.color.holo_red_dark));
                    downloadButton.setText("重试");
                    downloadButton.setEnabled(true);
                    progressBar.setVisibility(View.GONE);
                    progressTextView.setVisibility(View.GONE);
                    break;
            }
        }
    }
}
