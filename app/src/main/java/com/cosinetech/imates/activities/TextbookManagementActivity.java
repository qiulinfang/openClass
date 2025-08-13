package com.cosinetech.imates.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.MenuItem;
import android.view.View;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.cosinetech.imates.R;
import com.cosinetech.imates.textbookservice.LearnResourceManager;
import com.cosinetech.imates.textbookservice.LoginResponse;
import com.cosinetech.imates.textbookservice.TextbookVersion;
import com.cosinetech.imates.textbookservice.UserTextbookInfo;
import com.cosinetech.imates.util.AppUtils;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class TextbookManagementActivity extends AppCompatActivity {
    private static final String TAG = "TextbookManagement";
    private TextbookAdapter textbookAdapter;
    private final List<UserTextbookInfo> allTextbooks = new ArrayList<>();
    private final List<UserTextbookInfo> filteredTextbooks = new ArrayList<>();
    private final Set<String> selectedSubjects = new HashSet<>();

    private ChipGroup chipGroupSubjects;
    private Button btnRefresh;
    private Button btnCheckUpdates;
    private ProgressBar progressLoading;
    private View layoutEmptyState;
    private RecyclerView recyclerViewTextbooks;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_textbook_management);
        
        initViews();
        initResourceManager();
        setupRecyclerView();
        setupEventListeners();
        
        // Load textbooks on startup
        loadTextbooks();
    }
    
    private void initViews() {
        // UI Components
        Toolbar toolbar = findViewById(R.id.toolbar);
        chipGroupSubjects = findViewById(R.id.chipGroupSubjects);
        btnRefresh = findViewById(R.id.btnRefresh);
        btnCheckUpdates = findViewById(R.id.btnCheckUpdates);
        progressLoading = findViewById(R.id.progressLoading);
        layoutEmptyState = findViewById(R.id.layoutEmptyState);
        recyclerViewTextbooks = findViewById(R.id.recyclerViewTextbooks);
        
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
        }
    }
    
    private void initResourceManager() {
        LearnResourceManager resourceManager = LearnResourceManager.getInstance();
        
        // Check if user is logged in
        if (!resourceManager.isLoggedIn()) {
            // Auto login with saved credentials
            String userId = AppUtils.getUserId();
            String password = AppUtils.getUserPassword();
            
            if (userId != null && password != null) {
                showLoading(true);
                resourceManager.login(userId, password, new LearnResourceManager.LoginCallback() {
                    @Override
                    public void onSuccess(LoginResponse response) {
                        showLoading(false);
                        loadTextbooks();
                    }
                    
                    @Override
                    public void onError(String error) {
                        showLoading(false);
                        showError("登录失败: " + error);
                        // Redirect to login activity
                        redirectToLogin();
                    }
                });
            } else {
                redirectToLogin();
            }
        }
    }
    
    private void setupRecyclerView() {
        textbookAdapter = new TextbookAdapter(filteredTextbooks, new TextbookAdapter.OnTextbookActionListener() {
            @Override
            public void onDownloadClick(UserTextbookInfo textbook) {
                downloadTextbook(textbook);
            }
            
            @Override
            public void onPauseClick(UserTextbookInfo textbook) {
                showMessage("暂停下载功能开发中");
            }
            
            @Override
            public void onViewClick(UserTextbookInfo textbook) {
                showMessage("查看教材功能开发中");
            }
            
            @Override
            public void onDeleteClick(UserTextbookInfo textbook) {
                showMessage("删除功能开发中");
            }
        });
        
        recyclerViewTextbooks.setLayoutManager(new LinearLayoutManager(this));
        recyclerViewTextbooks.setAdapter(textbookAdapter);
    }
    
    private void setupEventListeners() {
        btnRefresh.setOnClickListener(v -> loadTextbooks());
        btnCheckUpdates.setOnClickListener(v -> checkForUpdates());
        
        chipGroupSubjects.setOnCheckedStateChangeListener((group, checkedIds) -> {
            selectedSubjects.clear();
            for (int id : checkedIds) {
                Chip chip = findViewById(id);
                if (chip != null) {
                    selectedSubjects.add(chip.getText().toString());
                }
            }
            filterTextbooks();
        });
    }
    
    private void loadTextbooks() {
        showLoading(true);
        showEmptyState(false);

        LearnResourceManager.getInstance().loadAllUserTextbooks(new LearnResourceManager.AllTextbooksCallback() {
            @Override
            public void onSuccess(List<UserTextbookInfo> textbooks) {
                showLoading(false);
                allTextbooks.clear();
                allTextbooks.addAll(textbooks);
                
                updateSubjectChips();
                filterTextbooks();
                
                if (textbooks.isEmpty()) {
                    showEmptyState(true);
                }
            }
            
            @Override
            public void onError(String error) {
                showLoading(false);
                showError("加载教材失败: " + error);
                showEmptyState(true);
            }
        });
    }
    
    private void updateSubjectChips() {
        chipGroupSubjects.removeAllViews();
        Set<String> subjects = new HashSet<>();
        
        for (UserTextbookInfo textbook : allTextbooks) {
            subjects.add(textbook.textbookSubjectLabel);
        }
        
        // Add "All" chip
        Chip allChip = new Chip(this);
        allChip.setText("全部");
        allChip.setCheckable(true);
        allChip.setChecked(selectedSubjects.isEmpty());
        chipGroupSubjects.addView(allChip);
        
        // Add subject chips
        for (String subject : subjects) {
            Chip chip = new Chip(this);
            chip.setText(subject);
            chip.setCheckable(true);
            chip.setChecked(selectedSubjects.contains(subject));
            chipGroupSubjects.addView(chip);
        }
    }
    
    private void filterTextbooks() {
        filteredTextbooks.clear();
        
        if (selectedSubjects.isEmpty()) {
            filteredTextbooks.addAll(allTextbooks);
        } else {
            for (UserTextbookInfo textbook : allTextbooks) {
                if (selectedSubjects.contains(textbook.textbookSubjectLabel)) {
                    filteredTextbooks.add(textbook);
                }
            }
        }
        
        textbookAdapter.notifyDataSetChanged();
        showEmptyState(filteredTextbooks.isEmpty() && !allTextbooks.isEmpty());
    }
    
    private void checkForUpdates() {
        showLoading(true);

        LearnResourceManager.getInstance().checkForUpdates(new LearnResourceManager.UpdateCheckCallback() {
            @Override
            public void onUpdateAvailable(List<TextbookVersion> updatedTextbooks) {
                showLoading(false);
                showMessage("发现 " + updatedTextbooks.size() + " 个教材有更新");
                loadTextbooks(); // Refresh the list
            }
            
            @Override
            public void onNoUpdates() {
                showLoading(false);
                showMessage("所有教材都是最新版本");
            }
            
            @Override
            public void onError(String error) {
                showLoading(false);
                showError("检查更新失败: " + error);
            }
        });
    }
    
    private void downloadTextbook(UserTextbookInfo textbook) {
        // Create TextbookVersion from UserTextbookInfo for download
        TextbookVersion version = new TextbookVersion(textbook);

        LearnResourceManager.getInstance().downloadAllResources(version, new LearnResourceManager.DownloadProgressCallback() {
            @Override
            public void onProgress(String fileName, long downloadedBytes, long totalBytes, int percentage) {
                // Update progress in adapter
                textbookAdapter.updateDownloadProgress(textbook.textbookId, percentage);
            }
            
            @Override
            public void onFileCompleted(String fileName, String localPath) {
                // File completed - could show individual file progress
            }
            
            @Override
            public void onAllCompleted() {
                showMessage("《" + textbook.textbookName + "》下载完成");
                loadTextbooks(); // Refresh to update status
            }
            
            @Override
            public void onError(String fileName, String error) {
                showError("下载失败: " + error);
                loadTextbooks(); // Refresh to update status
            }
        });
    }
    
    private void showLoading(boolean show) {
        progressLoading.setVisibility(show ? View.VISIBLE : View.GONE);
        btnRefresh.setEnabled(!show);
        btnCheckUpdates.setEnabled(!show);
    }
    
    private void showEmptyState(boolean show) {
        layoutEmptyState.setVisibility(show ? View.VISIBLE : View.GONE);
        recyclerViewTextbooks.setVisibility(show ? View.GONE : View.VISIBLE);
    }
    
    private void showMessage(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }
    
    private void showError(String error) {
        Toast.makeText(this, error, Toast.LENGTH_LONG).show();
    }
    
    private void redirectToLogin() {
        Intent intent = new Intent(this, LoginActivity.class);
        startActivity(intent);
        finish();
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == android.R.id.home) { // 返回按钮的 ID 是 android.R.id.home
            finish();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }
    
    @Override
    protected void onDestroy() {
        super.onDestroy();
    }
}
