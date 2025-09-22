package com.cosinetech.imates.ui.activities;

import android.os.Bundle;
import android.widget.Button;
import android.widget.ImageView;

import androidx.appcompat.app.AppCompatActivity;

import com.cosinetech.imates.R;
import com.cosinetech.imates.data.models.Subject;
import com.cosinetech.imates.utils.WindowUtils;

public class MyHistoryActivity extends AppCompatActivity {
    public  static String KEY_SUBJECT_NAME = "SUBJECT_NAME";
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);
        setContentView(R.layout.popup_window_history_image);

        String subjectName = getIntent().getStringExtra(KEY_SUBJECT_NAME);
        if(subjectName == null || subjectName.isEmpty()) {
            subjectName = Subject.SUBJECT_BIOLOGY.name();
        }

        // 关闭按钮点击事件
        Button closeButton = findViewById(R.id.close);
        closeButton.setOnClickListener(v-> finish());

        ImageView imageView = findViewById(R.id.img_view);

        if(subjectName.equals(Subject.SUBJECT_BIOLOGY.name())) {
            // 设置图片
            imageView.setImageResource(R.drawable.history_biology);
        } else if(subjectName.equals(Subject.SUBJECT_MATH.name())) {
            imageView.setImageResource(R.drawable.history_math);
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