package com.cosinetech.imates.activities;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
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
import com.cosinetech.imates.models.Chapter;
import com.cosinetech.imates.mupdfviewer.activity.MuPDFActivity;
import com.cosinetech.imates.util.WindowUtils;
import com.github.spareyaya.SimpleRatingView;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;

public class LessonPreviewActivity extends AppCompatActivity {
    public static final String KEY_PREVIEW_SECTION_NAME = "PREVIEW_SECTION_NAME";
    public static final String KEY_SECTION_SCHEMA = "SECTION_SCHEMA";

    // TODO: Rename and change types of parameters
    private String mPreviewSectionName;

    private int mCurrentSchemaIndex = -1;

    private Chapter.Section mPreviewSection;

    private SharedPreferences sharedPreferences;
    private final String CONFIG_NAME = "SCHEMA_LEARN_STAT";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);

        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_preview_lession);

        mPreviewSectionName = getIntent().getStringExtra(KEY_PREVIEW_SECTION_NAME);
        mPreviewSection = getIntent().getParcelableExtra(KEY_SECTION_SCHEMA);

        if(!mPreviewSectionName.contains("5.1")) {
            findViewById(R.id.teacher_video1).setVisibility(View.GONE);
            findViewById(R.id.teacher_video2).setVisibility(View.GONE);
        }
        String sectionId = mPreviewSection.getSection();
        TextView textPreview = findViewById(R.id.label);
        textPreview.setOnClickListener(v -> finish());

        TextView textPreviewSectionName = findViewById(R.id.preview_section_name);
        textPreviewSectionName.setText(mPreviewSectionName);

        SimpleRatingView ratingView = findViewById(R.id.rating);
        ratingView.setOnRatingChangeListener((oldRating, newRating) ->  {
            //Toast.makeText(getContext(), "oldRating:" + oldRating + " newRating:" + newRating, Toast.LENGTH_SHORT).show();
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

        int [] rdoButonIds = new int[] {
                R.id.opt_scheme_1, R.id.opt_scheme_2, R.id.opt_scheme_3,
                R.id.opt_scheme_4, R.id.opt_scheme_5, R.id.opt_scheme_6
        };


        for(int i = 0; i < rdoButonIds.length; i++) {
            RadioButton rdoButton = findViewById(rdoButonIds[i]);
            rdoButton.setVisibility(View.INVISIBLE);
        }

        for(int i = 0; i < mPreviewSection.getSchemas().size() && i < rdoButonIds.length; i++) {
            RadioButton rdoButton = findViewById(rdoButonIds[i]);
            rdoButton.setVisibility(View.VISIBLE);
        }

        RadioGroup schemaGroup = findViewById(R.id.schema_group);
        schemaGroup.setOnCheckedChangeListener((group, checkedId) -> {
            ratingView.setEnabled(true);
            ratingDifficult.setEnabled(true);

            for(int i = 0; i < mPreviewSection.getSchemas().size() && i < rdoButonIds.length; i++) {
                if(checkedId == rdoButonIds[i]) {
                    mCurrentSchemaIndex = i;
                    int rating = sharedPreferences.getInt(sectionId + "schema_rating_difficulty" + i, 0);
                    ratingDifficult.setRating(rating);

                    rating = sharedPreferences.getInt(sectionId + "schema_rating" + i, 0);
                    ratingView.setRating(rating);

                    updateSchemaIntroduction(findViewById(R.id.schema_intro));

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

        Button goPreview = findViewById(R.id.btn_go_prepare);
        goPreview.setOnClickListener(v -> {
            for(int i = 0; i < rdoButonIds.length; i++) {
                RadioButton rdoButton = findViewById(rdoButonIds[i]);
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

//                Intent intent = new Intent(this, com.cosinetech.imates.pdfui.PDFActivity.class);
//                intent.putExtra("AssetsPdf", mPreviewSection.getSchemas().get(mCurrentSchemaIndex).getTextBook());
//                intent.putExtra("Schema", mPreviewSection.getSchemas().get(mCurrentSchemaIndex));
//                intent.putExtra("Section", mPreviewSection);
//                startActivity(intent);q

                String path = getExternalFilesDir(null) + "/" + mPreviewSection.getSchemas().get(mCurrentSchemaIndex).getTextBook();
                File file = new  File(path);
                if(!file.exists()) {
                    path = getExternalFilesDir(null) + "/" + mPreviewSection.getSchemas().get(mCurrentSchemaIndex).getLecture();
                    file = new File(path);
                }

                if(!file.exists()) {
                    path = getExternalFilesDir(null) + "/" + mPreviewSection.getSchemas().get(mCurrentSchemaIndex).getLearnGuide();
                    file = new File(path);
                }

                if(file.exists()) {
                    Intent intent = new Intent(this, MuPDFActivity.class);
                    intent.setAction(Intent.ACTION_VIEW);
                    intent.setData(Uri.fromFile(new File(path)));
                    intent.putExtra("AssetsPdf", path);
                    intent.putExtra("Schema", mPreviewSection.getSchemas().get(mCurrentSchemaIndex));
                    intent.putExtra("Section", mPreviewSection);
                    startActivity(intent);
                } else {
                    Toast.makeText(this, "没有可学习的资源", Toast.LENGTH_SHORT).show();
                }
            }
        });

        TextView textView1 = findViewById(R.id.teacher_video1);
        TextView textView2 = findViewById(R.id.teacher_video2);

        textView1.setOnClickListener(v->{
            String path = getExternalFilesDir(null) + "/videos/1.mp4";
            File file = new File(path);
            if(file.exists()) {
                playVideo(path);
            } else {
                Toast.makeText(this, "视频文件不存在", Toast.LENGTH_SHORT).show();
            }
        });

        textView2.setOnClickListener(v->{
            String path = getExternalFilesDir(null) + "/videos/2.mp4";
            File file = new File(path);
            if(file.exists()) {
                playVideo(path);
            } else {
                Toast.makeText(this, "视频文件不存在", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    protected void onSaveInstanceState(@androidx.annotation.NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putString(KEY_PREVIEW_SECTION_NAME, mPreviewSectionName);
        outState.putParcelable(KEY_SECTION_SCHEMA, mPreviewSection);
    }

    @Override
    protected void onRestoreInstanceState(@androidx.annotation.NonNull Bundle savedInstanceState) {
        super.onRestoreInstanceState(savedInstanceState);
        mPreviewSectionName = savedInstanceState.getString(KEY_PREVIEW_SECTION_NAME);
        mPreviewSection = savedInstanceState.getParcelable(KEY_SECTION_SCHEMA);
    }

    private void playVideo(String path) {
        Intent videoPlayIntent = new Intent(this,
                VideoPlayActivity.class);

        videoPlayIntent.putExtra(VideoPlayActivity.KEY_VIDEO_PATH, path);
        videoPlayIntent.putExtra(VideoPlayActivity.KEY_TEXTBOOK_SECTION, mPreviewSection.getTitle());
        startActivity(videoPlayIntent);
    }

    private void updateSchemaIntroduction(TextView view) {
        StringBuilder stringBuilder = new StringBuilder();
        InputStream inputStream = null;
        try {
            inputStream = getResources().getAssets().open(mPreviewSection.getSchemas().get(mCurrentSchemaIndex).getIntroduction());
            InputStreamReader isr = new InputStreamReader(inputStream);
            BufferedReader reader = new BufferedReader(isr);
            String line;
            while ((line = reader.readLine()) != null) {
                stringBuilder.append(line).append("\n");
            }
            reader.close();
            isr.close();
            inputStream.close();
            view.setText(stringBuilder.toString());
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowUtils.hideSystemUI(this);
        }
    }
}