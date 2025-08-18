package com.cosinetech.imates.ui.views;

import android.content.Context;
import android.util.AttributeSet;
import android.view.LayoutInflater;
import android.widget.LinearLayout;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.R;
import com.cosinetech.imates.textbookservice.LocalFileInfo;
import com.cosinetech.imates.textbookservice.LocalPackageInfo;
import com.cosinetech.imates.ui.adapters.FileAdapter;
import java.util.ArrayList;
import java.util.List;

public class FileDisplayView extends LinearLayout {
    
    public enum DisplayMode {
        LIST,           // 列表模式
        GRID_SMALL,     // 小图标网格
        GRID_LARGE      // 大图标网格
    }
    
    public interface OnFileSelectedListener {
        void onFileSelected(LocalFileInfo fileInfo);
        void onFileDeselected();
    }
    
    private RecyclerView recyclerView;
    private FileAdapter adapter;
    private DisplayMode currentMode = DisplayMode.LIST;
    private OnFileSelectedListener listener;
    private LocalFileInfo selectedFile;
    
    public FileDisplayView(Context context) {
        super(context);
        init(context);
    }
    
    public FileDisplayView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init(context);
    }
    
    public FileDisplayView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        init(context);
    }
    
    private void init(Context context) {
        setOrientation(VERTICAL);
        LayoutInflater.from(context).inflate(R.layout.view_file_display, this, true);
        
        recyclerView = findViewById(R.id.recyclerView);
        adapter = new FileAdapter(context);
        adapter.setOnItemClickListener(this::onFileItemClick);
        recyclerView.setAdapter(adapter);
        
        setDisplayMode(currentMode);
    }
    
    public void setLearningPackage(LocalPackageInfo packageInfo) {
        if (packageInfo != null && packageInfo.localFiles != null) {
            // 只显示已下载的文件
            List<LocalFileInfo> downloadedFiles = new ArrayList<>();
            for (LocalFileInfo file : packageInfo.localFiles) {
                if (file.isDownloaded) {
                    downloadedFiles.add(file);
                }
            }
            adapter.setFiles(downloadedFiles);
        } else {
            adapter.setFiles(new ArrayList<>());
        }
        clearSelection();
    }
    
    public void setDisplayMode(DisplayMode mode) {
        this.currentMode = mode;
        
        switch (mode) {
            case LIST:
                recyclerView.setLayoutManager(new LinearLayoutManager(getContext()));
                adapter.setDisplayMode(FileAdapter.ViewType.LIST);
                break;
            case GRID_SMALL:
                recyclerView.setLayoutManager(new GridLayoutManager(getContext(), 8));
                adapter.setDisplayMode(FileAdapter.ViewType.GRID_SMALL);
                break;
            case GRID_LARGE:
                recyclerView.setLayoutManager(new GridLayoutManager(getContext(), 4));
                adapter.setDisplayMode(FileAdapter.ViewType.GRID_LARGE);
                break;
        }
    }
    
    public DisplayMode getDisplayMode() {
        return currentMode;
    }
    
    public void setOnFileSelectedListener(OnFileSelectedListener listener) {
        this.listener = listener;
    }
    
    public LocalFileInfo getSelectedFile() {
        return selectedFile;
    }
    
    public String getSelectedFilePath() {
        return selectedFile != null ? selectedFile.localPath : null;
    }
    
    public void clearSelection() {
        if (selectedFile != null) {
            selectedFile = null;
            adapter.setSelectedFile(null);
            if (listener != null) {
                listener.onFileDeselected();
            }
        }
    }
    
    private void onFileItemClick(LocalFileInfo fileInfo) {
        selectedFile = fileInfo;
        adapter.setSelectedFile(fileInfo);
        if (listener != null) {
            listener.onFileSelected(fileInfo);
        }
    }
    
    public void refreshFiles() {
        adapter.notifyDataSetChanged();
    }
}
