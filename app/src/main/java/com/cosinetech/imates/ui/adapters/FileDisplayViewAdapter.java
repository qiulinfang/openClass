package com.cosinetech.imates.ui.adapters;

import android.content.Context;
import android.graphics.drawable.Drawable;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.R;
import com.cosinetech.imates.textbookservice.LocalFileInfo;
import com.cosinetech.imates.utils.FileShareUtils;

import java.util.ArrayList;
import java.util.List;

public class FileDisplayViewAdapter extends RecyclerView.Adapter<RecyclerView.ViewHolder> {
    
    public enum ViewType {
        LIST(0),
        GRID_SMALL(1), 
        GRID_LARGE(2);
        
        private final int value;
        ViewType(int value) { this.value = value; }
        public int getValue() { return value; }
    }
    
    public interface OnItemClickListener {
        void onItemClick(LocalFileInfo fileInfo);
    }
    
    private Context context;
    private List<LocalFileInfo> files;
    private ViewType displayMode = ViewType.LIST;
    private OnItemClickListener clickListener;
    private LocalFileInfo selectedFile;
    
    public FileDisplayViewAdapter(Context context) {
        this.context = context;
        this.files = new ArrayList<>();
    }
    
    public void setFiles(List<LocalFileInfo> files) {
        this.files = files != null ? files : new ArrayList<>();
        notifyDataSetChanged();
    }
    
    public void setDisplayMode(ViewType mode) {
        this.displayMode = mode;
        notifyDataSetChanged();
    }
    
    public void setOnItemClickListener(OnItemClickListener listener) {
        this.clickListener = listener;
    }
    
    public void setSelectedFile(LocalFileInfo file) {
        this.selectedFile = file;
        notifyDataSetChanged();
    }
    
    @Override
    public int getItemViewType(int position) {
        return displayMode.getValue();
    }
    
    @NonNull
    @Override
    public RecyclerView.ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        LayoutInflater inflater = LayoutInflater.from(context);
        
        if (viewType == ViewType.LIST.getValue()) {
            View view = inflater.inflate(R.layout.item_file_list, parent, false);
            return new ListViewHolder(view);
        } else if (viewType == ViewType.GRID_SMALL.getValue()) {
            View view = inflater.inflate(R.layout.item_file_grid_small, parent, false);
            return new GridSmallViewHolder(view);
        } else {
            View view = inflater.inflate(R.layout.item_file_grid_large, parent, false);
            return new GridLargeViewHolder(view);
        }
    }
    
    @Override
    public void onBindViewHolder(@NonNull RecyclerView.ViewHolder holder, int position) {
        LocalFileInfo file = files.get(position);
        boolean isSelected = file.equals(selectedFile);
        
        if (holder instanceof ListViewHolder) {
            ((ListViewHolder) holder).bind(file, isSelected);
        } else if (holder instanceof GridSmallViewHolder) {
            ((GridSmallViewHolder) holder).bind(file, isSelected);
        } else if (holder instanceof GridLargeViewHolder) {
            ((GridLargeViewHolder) holder).bind(file, isSelected);
        }
    }
    
    @Override
    public int getItemCount() {
        return files.size();
    }
    
    private Drawable getFileIcon(String fileName) {
        if (fileName == null) return ContextCompat.getDrawable(context, R.drawable.ic_file_default);
        
        String extension = "";
        int lastDot = fileName.lastIndexOf('.');
        if (lastDot > 0) {
            extension = fileName.substring(lastDot + 1).toLowerCase();
        }
        
        switch (extension) {
            case "pdf":
                return ContextCompat.getDrawable(context, R.drawable.ic_file_pdf);
            case "doc":
            case "docx":
                return ContextCompat.getDrawable(context, R.drawable.ic_file_doc);
            case "xls":
            case "xlsx":
                return ContextCompat.getDrawable(context, R.drawable.ic_file_excel);
            case "ppt":
            case "pptx":
                return ContextCompat.getDrawable(context, R.drawable.ic_file_ppt);
            case "jpg":
            case "jpeg":
            case "png":
            case "gif":
                return ContextCompat.getDrawable(context, R.drawable.ic_file_image);
            case "mp4":
            case "avi":
            case "mov":
                return ContextCompat.getDrawable(context, R.drawable.ic_file_video);
            case "mp3":
            case "wav":
                return ContextCompat.getDrawable(context, R.drawable.ic_file_audio);
            case "txt":
                return ContextCompat.getDrawable(context, R.drawable.ic_file_text);
            case "htm":
            case "html":
                return ContextCompat.getDrawable(context, R.drawable.ic_file_html);
            default:
                return ContextCompat.getDrawable(context, R.drawable.ic_file_default);
        }
    }
    
    // 列表模式ViewHolder
    class ListViewHolder extends RecyclerView.ViewHolder {
        ImageView iconView;
        TextView nameView;
        TextView sizeView;
        View rootView;
        
        ListViewHolder(View itemView) {
            super(itemView);
            iconView = itemView.findViewById(R.id.fileIcon);
            nameView = itemView.findViewById(R.id.fileName);
            sizeView = itemView.findViewById(R.id.fileSize);
            rootView = itemView;
            
            rootView.setOnClickListener(v -> {
                if (clickListener != null && getAdapterPosition() != RecyclerView.NO_POSITION) {
                    clickListener.onItemClick(files.get(getAdapterPosition()));
                }
            });
        }
        
        void bind(LocalFileInfo file, boolean isSelected) {
            iconView.setImageDrawable(getFileIcon(file.fileName));
            nameView.setText(FileShareUtils.getFileNameWithoutExtension(file.fileName));
            sizeView.setText(formatFileSize(file.fileSize));
            
            rootView.setSelected(isSelected);
            rootView.setBackgroundColor(isSelected ? 
                ContextCompat.getColor(context, R.color.selected_background) : 
                ContextCompat.getColor(context, android.R.color.transparent));
        }
    }
    
    // 小网格模式ViewHolder
    class GridSmallViewHolder extends RecyclerView.ViewHolder {
        ImageView iconView;
        TextView nameView;
        View rootView;
        
        GridSmallViewHolder(View itemView) {
            super(itemView);
            iconView = itemView.findViewById(R.id.fileIcon);
            nameView = itemView.findViewById(R.id.fileName);
            rootView = itemView;
            
            rootView.setOnClickListener(v -> {
                if (clickListener != null && getAdapterPosition() != RecyclerView.NO_POSITION) {
                    clickListener.onItemClick(files.get(getAdapterPosition()));
                }
            });
        }
        
        void bind(LocalFileInfo file, boolean isSelected) {
            iconView.setImageDrawable(getFileIcon(file.fileName));
            nameView.setText(FileShareUtils.getFileNameWithoutExtension(file.fileName));
            
            rootView.setSelected(isSelected);
            rootView.setBackgroundColor(isSelected ? 
                ContextCompat.getColor(context, R.color.selected_background) : 
                ContextCompat.getColor(context, android.R.color.transparent));
        }
    }
    
    // 大网格模式ViewHolder
    class GridLargeViewHolder extends RecyclerView.ViewHolder {
        ImageView iconView;
        TextView nameView;
        TextView sizeView;
        View rootView;
        
        GridLargeViewHolder(View itemView) {
            super(itemView);
            iconView = itemView.findViewById(R.id.fileIcon);
            nameView = itemView.findViewById(R.id.fileName);
            sizeView = itemView.findViewById(R.id.fileSize);
            rootView = itemView;
            
            rootView.setOnClickListener(v -> {
                if (clickListener != null && getAdapterPosition() != RecyclerView.NO_POSITION) {
                    clickListener.onItemClick(files.get(getAdapterPosition()));
                }
            });
        }
        
        void bind(LocalFileInfo file, boolean isSelected) {
            iconView.setImageDrawable(getFileIcon(file.fileName));
            nameView.setText(FileShareUtils.getFileNameWithoutExtension((file.displayName == null || file.displayName.isEmpty()) ? file.fileName : file.displayName));
            sizeView.setText(formatFileSize(file.fileSize));
            
            rootView.setSelected(isSelected);
            rootView.setBackgroundColor(isSelected ? 
                ContextCompat.getColor(context, R.color.selected_background) : 
                ContextCompat.getColor(context, android.R.color.transparent));
        }
    }
    
    private String formatFileSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1024 * 1024 * 1024) return String.format("%.1f MB", bytes / (1024.0 * 1024));
        return String.format("%.1f GB", bytes / (1024.0 * 1024 * 1024));
    }
}
