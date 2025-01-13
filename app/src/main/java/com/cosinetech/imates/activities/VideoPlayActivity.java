package com.cosinetech.imates.activities;

import android.annotation.SuppressLint;
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
    private ActivityVideoPlayBinding binding;
    private VideoPlayView mVideoPlayView;

    @SuppressLint("ClickableViewAccessibility")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 隐藏系统导航栏
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);

        binding = ActivityVideoPlayBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        mVideoPlayView = findViewById(R.id.video_play_view);
        int startPlayPos = getIntent().getIntExtra(KEY_VIDEO_START_PLAY_POS_MS, 0);

        String videoPath = getIntent().getStringExtra(KEY_VIDEO_PATH);
        if(videoPath != null) {
            File file = new File(videoPath);
            if(file.exists()) {
                String sectionTitle = getIntent().getStringExtra(KEY_TEXTBOOK_SECTION);
                if(sectionTitle == null) {
                    sectionTitle = "";
                }
                mVideoPlayView.setVideoInfo(videoPath, sectionTitle, startPlayPos);
                mVideoPlayView.startPlay();
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