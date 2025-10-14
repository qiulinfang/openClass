package com.cosinetech.imates.ui.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.bumptech.glide.load.resource.bitmap.RoundedCorners;
import com.bumptech.glide.request.RequestOptions;
import com.cosinetech.imates.R;
import com.cosinetech.imates.textbookservice.UserTextbookInfo;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class TextbookAdapter extends RecyclerView.Adapter<TextbookAdapter.TextbookViewHolder> {
    
    private final List<UserTextbookInfo> textbooks;
    private final OnTextbookActionListener listener;
    private final Map<String, Integer> downloadProgressMap = new HashMap<>();
    
    public interface OnTextbookActionListener {
        void onDownloadClick(UserTextbookInfo textbook);
        void onPauseClick(UserTextbookInfo textbook);
        void onViewClick(UserTextbookInfo textbook);
        void onDeleteClick(UserTextbookInfo textbook);
    }
    
    public TextbookAdapter(List<UserTextbookInfo> textbooks, OnTextbookActionListener listener) {
        this.textbooks = textbooks;
        this.listener = listener;
    }
    
    @NonNull
    @Override
    public TextbookViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_textbook, parent, false);
        return new TextbookViewHolder(view);
    }
    
    @Override
    public void onBindViewHolder(@NonNull TextbookViewHolder holder, int position) {
        UserTextbookInfo textbook = textbooks.get(position);
        holder.bind(textbook);
    }
    
    @Override
    public int getItemCount() {
        return textbooks.size();
    }
    
    public void updateDownloadProgress(String textbookId, int progress) {
        downloadProgressMap.put(textbookId, progress);
        // Find and update the specific item
        for (int i = 0; i < textbooks.size(); i++) {
            if (textbooks.get(i).textbookId.equals(textbookId)) {
                notifyItemChanged(i);
                break;
            }
        }
    }
    
    public class TextbookViewHolder extends RecyclerView.ViewHolder {
        private final ImageView imgTextbookCover;
        private final TextView txtTextbookName;
        private final TextView txtGradeInfo;
        private final TextView txtSubject;
        private final TextView txtPublisher;
        private final TextView txtDownloadStatus;
        private final TextView txtFileInfo;
        private final TextView txtSizeInfo;
        private final ProgressBar progressDownload;
        private final ImageButton btnAction;
        private final TextView txtActionLabel;
        
        public TextbookViewHolder(@NonNull View itemView) {
            super(itemView);
            imgTextbookCover = itemView.findViewById(R.id.imgTextbookCover);
            txtTextbookName = itemView.findViewById(R.id.txtTextbookName);
            txtGradeInfo = itemView.findViewById(R.id.txtGradeInfo);
            txtSubject = itemView.findViewById(R.id.txtSubject);
            txtPublisher = itemView.findViewById(R.id.txtPublisher);
            txtDownloadStatus = itemView.findViewById(R.id.txtDownloadStatus);
            txtFileInfo = itemView.findViewById(R.id.txtFileInfo);
            txtSizeInfo = itemView.findViewById(R.id.txtSizeInfo);
            progressDownload = itemView.findViewById(R.id.progressDownload);
            btnAction = itemView.findViewById(R.id.btnAction);
            txtActionLabel = itemView.findViewById(R.id.txtActionLabel);
        }
        
        public void bind(UserTextbookInfo textbook) {
            Context context = itemView.getContext();
            
            // Load textbook cover
            if (textbook.textbookCover != null && !textbook.textbookCover.isEmpty()) {
                Glide.with(context)
                        .load(textbook.textbookCover)
                        .apply(new RequestOptions()
                                .transform(new RoundedCorners(8))
                                .placeholder(R.drawable.placeholder_book)
                                .error(R.drawable.placeholder_book))
                        .into(imgTextbookCover);
            } else {
                imgTextbookCover.setImageResource(R.drawable.placeholder_book);
            }
            
            // Set textbook info
            txtTextbookName.setText(textbook.textbookName);
            txtGradeInfo.setText(textbook.textbookGradeLabel + textbook.textbookSemesterLabel);
            txtSubject.setText(textbook.textbookSubjectLabel);
            txtPublisher.setText(textbook.textbookPublisher != null ? textbook.textbookPublisher : "未知出版社");
            
            // Set file info
            txtFileInfo.setText(textbook.downloadedFiles + "/" + textbook.totalFiles + " 文件");
            txtSizeInfo.setText(textbook.getFormattedSize());
            
            // Set download status and action button
            UserTextbookInfo.DownloadStatus status = textbook.getDownloadStatus();
            Integer currentProgress = downloadProgressMap.get(textbook.textbookId);
            
            if (currentProgress != null && currentProgress < 100) {
                // Currently downloading
                txtDownloadStatus.setText("下载中 " + currentProgress + "%");
                txtDownloadStatus.setTextColor(context.getResources().getColor(R.color.colorPrimary));
                progressDownload.setVisibility(View.VISIBLE);
                progressDownload.setProgress(currentProgress);
                
                btnAction.setImageResource(R.drawable.ic_pause);
                txtActionLabel.setText("暂停");
                btnAction.setOnClickListener(v -> listener.onPauseClick(textbook));
                
            } else {
                progressDownload.setVisibility(View.GONE);
                
                switch (status) {
                    case NOT_DOWNLOADED:
                        txtDownloadStatus.setText("未下载");
                        txtDownloadStatus.setTextColor(context.getResources().getColor(R.color.colorError));
                        btnAction.setImageResource(R.drawable.ic_download);
                        txtActionLabel.setText("下载");
                        btnAction.setOnClickListener(v -> {
                            if(!textbook.downloadBeginning) {
                                updateDownloadProgress(textbook.textbookId, 0);
                                textbook.downloadBeginning = true;
                                listener.onDownloadClick(textbook);
                            }
                        });
                        break;
                        
                    case PARTIALLY_DOWNLOADED:
                        txtDownloadStatus.setText("部分下载 " + textbook.getDownloadProgress() + "%");
                        txtDownloadStatus.setTextColor(context.getResources().getColor(R.color.colorWarning));
                        btnAction.setImageResource(R.drawable.ic_download);
                        txtActionLabel.setText("继续");
                        btnAction.setOnClickListener(v -> {
                            if(!textbook.downloadBeginning) {
                                updateDownloadProgress(textbook.textbookId, textbook.getDownloadProgress());
                                textbook.downloadBeginning = true;
                                listener.onDownloadClick(textbook);
                            }
                        });
                        break;
                        
                    case FULLY_DOWNLOADED:
                        txtDownloadStatus.setText("已下载");
                        txtDownloadStatus.setTextColor(context.getResources().getColor(R.color.colorSuccess));
                        btnAction.setImageResource(R.drawable.ic_view);
                        txtActionLabel.setText("查看");
                        textbook.downloadBeginning = false;
                        btnAction.setOnClickListener(v -> listener.onViewClick(textbook));
                        break;
                        
                    case UPDATE_AVAILABLE:
                        txtDownloadStatus.setText("有更新");
                        txtDownloadStatus.setTextColor(context.getResources().getColor(R.color.colorPrimary));
                        btnAction.setImageResource(R.drawable.ic_update);
                        txtActionLabel.setText("更新");
                        btnAction.setOnClickListener(v -> {
                            if(!textbook.downloadBeginning) {
                                updateDownloadProgress(textbook.textbookId, 0);
                                textbook.downloadBeginning = true;
                                listener.onDownloadClick(textbook);
                            }
                        });
                        break;
                }
            }
            
            // Long click for delete option
            itemView.setOnLongClickListener(v -> {
                if (status == UserTextbookInfo.DownloadStatus.FULLY_DOWNLOADED || 
                    status == UserTextbookInfo.DownloadStatus.PARTIALLY_DOWNLOADED) {
                    listener.onDeleteClick(textbook);
                    return true;
                }
                return false;
            });
        }
    }
}
