package com.cosinetech.imates.activities;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.cosinetech.imates.R;
import com.cosinetech.imates.adapters.TextbookAdapter;
import com.cosinetech.imates.models.Textbook;
import com.cosinetech.imates.models.TextbookResponse;
import com.cosinetech.imates.models.TextbookVersion;
import com.cosinetech.imates.webservice.TextbookApiClient;
import com.cosinetech.imates.webservice.TextbookDownloadManager;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class TextbookDownloadActivity extends AppCompatActivity implements
        TextbookAdapter.OnTextbookClickListener,
        TextbookDownloadManager.DownloadListener {
    private static final int PERMISSION_REQUEST_CODE = 1001;

    private ChipGroup subjectChipGroup;
    private ChipGroup versionChipGroup;
    private RecyclerView textbookRecyclerView;
    private TextbookAdapter textbookAdapter;

    private Map<String, TextbookResponse> subjectData = new HashMap<>();
    private String currentSubject = "biology";
    private String currentVersion = "";
    private List<Textbook> currentTextbooks = new ArrayList<>();

    private TextbookDownloadManager downloadManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_textbook_download);

        initViews();
        checkPermissions();
        setupRecyclerView();
        loadSubjectData();

        downloadManager = TextbookDownloadManager.getInstance(this);
    }

    private void initViews() {
        subjectChipGroup = findViewById(R.id.chip_group_subjects);
        versionChipGroup = findViewById(R.id.chip_group_versions);
        textbookRecyclerView = findViewById(R.id.rv_textbooks);
    }

    private void checkPermissions() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE},
                    PERMISSION_REQUEST_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] != PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "需要存储权限才能下载文件", Toast.LENGTH_LONG).show();
            }
        }
    }

    private void setupRecyclerView() {
        textbookAdapter = new TextbookAdapter(this, currentTextbooks);
        textbookAdapter.setOnTextbookClickListener(this);

        GridLayoutManager layoutManager = new GridLayoutManager(this, 4);
        textbookRecyclerView.setLayoutManager(layoutManager);
        textbookRecyclerView.setAdapter(textbookAdapter);

        // 根据屏幕宽度动态计算列数，确保图书显示合理
//        int screenWidth = getResources().getDisplayMetrics().widthPixels;
//        int itemWidth = (int) (160 * getResources().getDisplayMetrics().density); // 160dp转换为px
//        int spanCount = Math.max(2, (screenWidth - 280 * (int)getResources().getDisplayMetrics().density) / itemWidth); // 减去侧边栏宽度
//
//        GridLayoutManager layoutManager = new GridLayoutManager(this, spanCount);
//        textbookRecyclerView.setLayoutManager(layoutManager);
//        textbookRecyclerView.setAdapter(textbookAdapter);
    }

    private void loadSubjectData() {
        setupSubjectChips();
        loadBiologyData();
        loadMathData();
    }

    private void setupSubjectChips() {
        // Biology chip
        Chip biologyChip = new Chip(this);
        biologyChip.setText("生物");
        biologyChip.setCheckable(true);
        biologyChip.setChecked(true);
        biologyChip.setOnClickListener(v -> selectSubject("biology"));
        subjectChipGroup.addView(biologyChip);

        // Math chip
        Chip mathChip = new Chip(this);
        mathChip.setText("数学");
        mathChip.setCheckable(true);
        mathChip.setOnClickListener(v -> selectSubject("math"));
        subjectChipGroup.addView(mathChip);
    }

    private void selectSubject(String subject) {
        currentSubject = subject;
        updateVersionChips();

        // Update subject chip selection
        for (int i = 0; i < subjectChipGroup.getChildCount(); i++) {
            Chip chip = (Chip) subjectChipGroup.getChildAt(i);
            chip.setChecked(false);
        }

        if ("biology".equals(subject)) {
            ((Chip) subjectChipGroup.getChildAt(0)).setChecked(true);
        } else if ("math".equals(subject)) {
            ((Chip) subjectChipGroup.getChildAt(1)).setChecked(true);
        }
    }

    private void updateVersionChips() {
        versionChipGroup.removeAllViews();

        TextbookResponse response = subjectData.get(currentSubject);
        if (response != null && response.getTextbooks() != null) {
            for (int i = 0; i < response.getTextbooks().size(); i++) {
                TextbookVersion version = response.getTextbooks().get(i);
                Chip versionChip = new Chip(this);
                versionChip.setText(version.getVersionName());
                versionChip.setCheckable(true);
                versionChip.setChecked(i == 0); // Select first version by default

                final String versionName = version.getVersionName();
                versionChip.setOnClickListener(v -> selectVersion(versionName));
                versionChipGroup.addView(versionChip);
            }

            if (!response.getTextbooks().isEmpty()) {
                selectVersion(response.getTextbooks().get(0).getVersionName());
            }
        }
    }

    private void selectVersion(String versionName) {
        currentVersion = versionName;
        updateTextbookList();

        // Update version chip selection
        for (int i = 0; i < versionChipGroup.getChildCount(); i++) {
            Chip chip = (Chip) versionChipGroup.getChildAt(i);
            chip.setChecked(chip.getText().toString().equals(versionName));
        }
    }

    private void updateTextbookList() {
        TextbookResponse response = subjectData.get(currentSubject);
        if (response != null) {
            for (TextbookVersion version : response.getTextbooks()) {
                if (version.getVersionName().equals(currentVersion)) {
                    currentTextbooks.clear();
                    currentTextbooks.addAll(version.getBooks());
                    textbookAdapter.updateTextbooks(currentTextbooks);
                    break;
                }
            }
        }
    }

    private void loadBiologyData() {
        TextbookApiClient.getApiService().getTextbooks("http://172.168.0.99/bj10/resources.json")
                .enqueue(new Callback<TextbookResponse>() {
                    @Override
                    public void onResponse(Call<TextbookResponse> call, Response<TextbookResponse> response) {
                        if (response.isSuccessful() && response.body() != null) {
                            subjectData.put("biology", response.body());
                            if ("biology".equals(currentSubject)) {
                                updateVersionChips();
                            }
                        }
                    }

                    @Override
                    public void onFailure(Call<TextbookResponse> call, Throwable t) {
                        Toast.makeText(TextbookDownloadActivity.this, "加载生物数据失败: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                });
    }

    private void loadMathData() {
        TextbookApiClient.getApiService().getTextbooks("http://172.168.0.99/bj10/resources.json")
                .enqueue(new Callback<TextbookResponse>() {
                    @Override
                    public void onResponse(Call<TextbookResponse> call, Response<TextbookResponse> response) {
                        if (response.isSuccessful() && response.body() != null) {
                            subjectData.put("math", response.body());
                            if ("math".equals(currentSubject)) {
                                updateVersionChips();
                            }
                        }
                    }

                    @Override
                    public void onFailure(Call<TextbookResponse> call, Throwable t) {
                        Toast.makeText(TextbookDownloadActivity.this, "加载数学数据失败: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                });
    }

    @Override
    public void onDownloadClick(Textbook textbook) {
        if (textbook.getDownloadStatus() == Textbook.DownloadStatus.DOWNLOADING) {
            downloadManager.cancelDownload(textbook);
            textbook.setDownloadStatus(Textbook.DownloadStatus.NOT_DOWNLOADED);
            textbook.setDownloadProgress(0);
            textbookAdapter.updateTextbook(textbook);
        } else {
            downloadManager.downloadTextbook(textbook, this);
        }
    }

    @Override
    public void onTextbookClick(Textbook textbook) {
        Toast.makeText(this, "点击了: " + textbook.getTitle(), Toast.LENGTH_SHORT).show();
    }

    // DownloadManager.DownloadListener implementation
    @Override
    public void onDownloadStart(Textbook textbook) {
        runOnUiThread(() -> {
            textbook.setDownloadStatus(Textbook.DownloadStatus.DOWNLOADING);
            textbook.setDownloadProgress(0);
            textbookAdapter.updateTextbook(textbook);
        });
    }

    @Override
    public void onDownloadProgress(Textbook textbook, int progress) {
        runOnUiThread(() -> {
            textbook.setDownloadProgress(progress);
            textbookAdapter.updateTextbook(textbook);
        });
    }

    @Override
    public void onDownloadComplete(Textbook textbook, String filePath) {
        runOnUiThread(() -> {
            textbook.setDownloadStatus(Textbook.DownloadStatus.DOWNLOADED);
            textbook.setDownloadProgress(100);
            textbookAdapter.updateTextbook(textbook);
            Toast.makeText(this, textbook.getTitle() + " 下载完成", Toast.LENGTH_SHORT).show();
        });
    }

    @Override
    public void onDownloadError(Textbook textbook, String error) {
        runOnUiThread(() -> {
            textbook.setDownloadStatus(Textbook.DownloadStatus.DOWNLOAD_FAILED);
            textbook.setDownloadProgress(0);
            textbookAdapter.updateTextbook(textbook);
            Toast.makeText(this, textbook.getTitle() + " 下载失败: " + error, Toast.LENGTH_SHORT).show();
        });
    }
}
