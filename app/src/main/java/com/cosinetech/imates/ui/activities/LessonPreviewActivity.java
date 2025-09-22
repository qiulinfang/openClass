package com.cosinetech.imates.ui.activities;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import com.cosinetech.imates.R;
import com.cosinetech.imates.textbookservice.LocalFileInfo;
import com.cosinetech.imates.textbookservice.LocalPackageInfo;
import com.cosinetech.imates.ui.views.FileDisplayView;
import com.cosinetech.imates.ui.views.MarkdownTextView;
import com.cosinetech.imates.utils.FileShareUtils;
import com.cosinetech.imates.utils.WindowUtils;
import com.github.spareyaya.SimpleRatingView;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class LessonPreviewActivity extends AppCompatActivity {
    public static final String KEY_PREVIEW_SECTION_NAME = "PREVIEW_SECTION_NAME";
    public static final String KEY_LEARN_PACKAGE = "LEARN_PACKAGE";
    private String mPreviewSectionName = "";
    private int mCurrentSchemaIndex = -1;

    private FileDisplayView mFileDisplayView;
    private LocalFileInfo mCurrentSelectedFile;

    private SharedPreferences sharedPreferences;

    private List<LocalPackageInfo> mLocalPkgs = new ArrayList<>();
    private final String CONFIG_NAME = "SCHEMA_LEARN_STAT";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);

        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_preview_lession);
        mFileDisplayView = findViewById(R.id.fileDisplayView);
        String learnPackage = getIntent().getStringExtra(KEY_LEARN_PACKAGE);
        mLocalPkgs = new GsonBuilder()
                .setDateFormat("yyyy-MM-dd HH:mm:ss")
                .create().fromJson(learnPackage, new TypeToken<List<LocalPackageInfo>>(){}.getType());

        mFileDisplayView.setDisplayMode(FileDisplayView.DisplayMode.GRID_LARGE);
        mFileDisplayView.setOnFileSelectedListener(new FileDisplayView.OnFileSelectedListener() {
            @Override
            public void onFileSelected(LocalFileInfo fileInfo) {
                mCurrentSelectedFile = fileInfo;
            }

            @Override
            public void onFileDeselected() {
            }
        });
        mPreviewSectionName = getIntent().getStringExtra(KEY_PREVIEW_SECTION_NAME);

        String sectionId = "";//mPreviewSection.getSection();
        TextView textPreview = findViewById(R.id.label);
        textPreview.setOnClickListener(v -> finish());

        TextView textPreviewSectionName = findViewById(R.id.preview_section_name);
        textPreviewSectionName.setText(mPreviewSectionName);

        SimpleRatingView ratingView = findViewById(R.id.rating);
        ratingView.setOnRatingChangeListener((oldRating, newRating) ->  {
            if(mCurrentSchemaIndex >= 0) {
                SharedPreferences.Editor editor = sharedPreferences.edit();
                editor.putInt(sectionId + "schema_rating" + mCurrentSchemaIndex, newRating);
                editor.apply();
            }
        });

        SimpleRatingView ratingDifficult = findViewById(R.id.rating_difficulty);
        ratingDifficult.setOnRatingChangeListener((oldRating, newRating) -> {
            if(mCurrentSchemaIndex >= 0) {
                SharedPreferences.Editor editor = sharedPreferences.edit();
                editor.putInt(sectionId + "schema_rating_difficulty" + mCurrentSchemaIndex, newRating);
                editor.apply();
            }
        });

        ratingView.setEnabled(false);
        ratingDifficult.setEnabled(false);

        sharedPreferences = getSharedPreferences(CONFIG_NAME, Context.MODE_PRIVATE);

        int [] rdButtonIds = new int[] {
                R.id.opt_scheme_1, R.id.opt_scheme_2, R.id.opt_scheme_3,
                R.id.opt_scheme_4, R.id.opt_scheme_5, R.id.opt_scheme_6
        };


        for(int i = 0; i < rdButtonIds.length; i++) {
            RadioButton rdoButton = findViewById(rdButtonIds[i]);
            rdoButton.setVisibility(View.INVISIBLE);
        }

        for(int i = 0; i < mLocalPkgs.size() && i < rdButtonIds.length; i++) {
            RadioButton rdoButton = findViewById(rdButtonIds[i]);
            rdoButton.setVisibility(View.VISIBLE);
        }

        RadioGroup schemaGroup = findViewById(R.id.schema_group);
        schemaGroup.setOnCheckedChangeListener((group, checkedId) -> {
            ratingView.setEnabled(true);
            ratingDifficult.setEnabled(true);

            for(int i = 0; i < mLocalPkgs.size() && i < rdButtonIds.length; i++) {
                if(checkedId == rdButtonIds[i]) {
                    mCurrentSchemaIndex = i;
                    int rating = sharedPreferences.getInt(sectionId + "schema_rating_difficulty" + i, 0);
                    ratingDifficult.setRating(rating);

                    rating = sharedPreferences.getInt(sectionId + "schema_rating" + i, 0);
                    ratingView.setRating(rating);

                    ((MarkdownTextView)(findViewById(R.id.schema_intro))).setContent(
                            mLocalPkgs.get(mCurrentSchemaIndex).description == null ?
                            "" : mLocalPkgs.get(mCurrentSchemaIndex).description);
                    mFileDisplayView.setLearningPackage(mLocalPkgs.get(mCurrentSchemaIndex));

                    TextView v = findViewById(R.id.schema_stat);
                    boolean learned = sharedPreferences.getBoolean(sectionId + "_schema" + i, false);
                    if(learned) {
                        v.setText("已学习");
                        v.setTextColor(Color.GREEN);
                    } else {
                        v.setText("未学习");
                        v.setTextColor(Color.WHITE);
                    }
                    break;
                }
            }

        });
        schemaGroup.check(rdButtonIds[0]);

        Button goPreview = findViewById(R.id.btn_go_prepare);
        goPreview.setOnClickListener(v -> {
            for(int i = 0; i < rdButtonIds.length; i++) {
                RadioButton rdoButton = findViewById(rdButtonIds[i]);
                if(rdoButton.isChecked()) {
                    mCurrentSchemaIndex = i;
                    break;
                }
            }
            if(mCurrentSchemaIndex < 0) {
                Toast.makeText(this, "先选择一个学习方案", Toast.LENGTH_SHORT).show();
            } else {
                SharedPreferences.Editor editor = sharedPreferences.edit();
                editor.putBoolean(sectionId + "_schema" + mCurrentSchemaIndex, true);
                editor.apply();

                TextView textView = findViewById(R.id.schema_stat);
                textView.setText("已学习");
                textView.setTextColor(Color.GREEN);

                if(mCurrentSelectedFile == null) {
                    Toast.makeText(this, "先选择一个文件去学习", Toast.LENGTH_SHORT).show();
                    return;
                }

                File file = new File(mCurrentSelectedFile.localPath);
                if(!file.exists()) {
                    Toast.makeText(this, "文件未下载或不存在", Toast.LENGTH_SHORT).show();
                    return;
                }

                FileShareUtils.shareOpenFile(this,
                        mCurrentSelectedFile.localPath,
                        mPreviewSectionName,
                        getIntent().getStringExtra(KEY_LEARN_PACKAGE));
            }
        });
    }

    @Override
    protected void onSaveInstanceState(@androidx.annotation.NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putString(KEY_PREVIEW_SECTION_NAME, mPreviewSectionName);
    }

    @Override
    protected void onRestoreInstanceState(@androidx.annotation.NonNull Bundle savedInstanceState) {
        super.onRestoreInstanceState(savedInstanceState);
        mPreviewSectionName = savedInstanceState.getString(KEY_PREVIEW_SECTION_NAME);
    }

    private void playVideo(String path) {
        Intent videoPlayIntent = new Intent(this,
                VideoPlayActivity.class);

        videoPlayIntent.putExtra(VideoPlayActivity.KEY_VIDEO_PATH, path);
        videoPlayIntent.putExtra(VideoPlayActivity.KEY_TEXTBOOK_SECTION, mPreviewSectionName);
        startActivity(videoPlayIntent);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowUtils.hideSystemUI(this);
        }
    }
}