package com.cosinetech.imates.activities;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.os.Bundle;

import com.cosinetech.imates.util.WindowUtils;

import androidx.appcompat.app.AppCompatActivity;

import android.widget.Button;
import android.widget.Toast;
import com.cosinetech.imates.databinding.ActivityVideoPlayBinding;
import com.cosinetech.imates.R;
import com.cosinetech.imates.views.VideoPlayView;

import java.io.File;

public class VideoPlayActivity extends AppCompatActivity {
    public static final String KEY_VIDEO_PATH = "VIDEO_PATH";
    public static final String KEY_TEXTBOOK_SECTION = "TEXTBOOK_SECTION";
    public static final String KEY_VIDEO_START_PLAY_POS_MS = "VIDEO_START_POS_MS";
    private VideoPlayView mVideoPlayView;
    private String mVideoFilePath;
    private String mSectionTitle;

    // Activity返回值相关
    public static int CODE_RESULT_VIDEO_PLAY_EXIT = RESULT_FIRST_USER + 1;
    public static final String KEY_RESULT_ACTION_KEY = "RESULT_ACTION";
    public static final int EXIT_ACTION_NONE = 0;
    public static final int EXIT_ACTION_FLOAT = 1;

    @SuppressLint("ClickableViewAccessibility")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 隐藏系统导航栏
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);

        com.cosinetech.imates.databinding.ActivityVideoPlayBinding binding = ActivityVideoPlayBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        mVideoPlayView = findViewById(R.id.video_play_view);
        int startPlayPos = getIntent().getIntExtra(KEY_VIDEO_START_PLAY_POS_MS, 0);

        mSectionTitle = getIntent().getStringExtra(KEY_TEXTBOOK_SECTION);
        if(mSectionTitle == null) {
            mSectionTitle = "";
        }
        mVideoFilePath = getIntent().getStringExtra(KEY_VIDEO_PATH);
        if(mVideoFilePath != null) {
            File file = new File(mVideoFilePath);
            if(file.exists()) {
                mVideoPlayView.setVideoInfo(mVideoFilePath, mSectionTitle, startPlayPos);
                mVideoPlayView.pausePlay();
            } else {
                Toast.makeText(this, "视频文件不存在", Toast.LENGTH_SHORT).show();
            }
        }
        Button buttonExitVideo = findViewById(R.id.btn_exit_video);
        buttonExitVideo.setOnClickListener(v->{
            mVideoPlayView.stopPlay();
            finish();
        });

        Button btnEnterPip = findViewById(R.id.btn_enter_pip);
        btnEnterPip.setOnClickListener(v-> {
            Intent resultIntent = new Intent();
            resultIntent.putExtra(KEY_RESULT_ACTION_KEY,  EXIT_ACTION_FLOAT);
            resultIntent.putExtra(KEY_VIDEO_PATH, mVideoFilePath);
            resultIntent.putExtra(KEY_TEXTBOOK_SECTION, mSectionTitle);
            resultIntent.putExtra(KEY_VIDEO_START_PLAY_POS_MS, mVideoPlayView.getCurrentPlayPosition());
            setResult(CODE_RESULT_VIDEO_PLAY_EXIT, resultIntent);
            finish();
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowUtils.hideSystemUI(this);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
    }
}