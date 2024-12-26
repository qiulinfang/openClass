package com.cosinetech.imates.activities;

import android.os.Bundle;

import com.cosinetech.imates.util.WindowUtils;
import com.google.android.material.snackbar.Snackbar;

import androidx.appcompat.app.AppCompatActivity;

import android.view.View;
import android.widget.Button;
import android.widget.MediaController;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.VideoView;

import androidx.navigation.NavController;
import androidx.navigation.Navigation;
import androidx.navigation.ui.AppBarConfiguration;
import androidx.navigation.ui.NavigationUI;

import com.cosinetech.imates.databinding.ActivityVideoPlayBinding;

import com.cosinetech.imates.R;

import java.io.File;

public class ActivityVideoPlay extends AppCompatActivity {
    public static final String KEY_VIDEO_PATH = "VIDEO_PATH";
    private ActivityVideoPlayBinding binding;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 隐藏系统导航栏
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);

        binding = ActivityVideoPlayBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());


        String videoPath = getIntent().getStringExtra(KEY_VIDEO_PATH);
        if(videoPath != null) {
            VideoView videoView = findViewById(R.id.video_view);
            View video_layout = findViewById(R.id.video_area);

            File file = new File(videoPath);
            if(file.exists()) {
                video_layout.setVisibility(View.VISIBLE);
                videoView.setVideoPath(videoPath);
                videoView.start();
            } else {
                Toast.makeText(this, "视频文件不存在", Toast.LENGTH_SHORT).show();
            }

            MediaController mediaController = new MediaController(this);
            mediaController.setAnchorView(videoView);
            // 控制 MediaController 显示时间
            mediaController.setVisibility(View.VISIBLE);
            videoView.setMediaController(mediaController);

            videoView.setOnPreparedListener(mp -> {
                float videoRatio = mp.getVideoWidth() / (float) mp.getVideoHeight();
                float screenRatio = videoView.getWidth() / (float) videoView.getHeight();
                float scaleX = videoRatio / screenRatio;
                if (scaleX >= 1f) {
                    videoView.setScaleX(scaleX);
                } else {
                    videoView.setScaleY(1f / scaleX);
                }
            });

            videoView.setOnCompletionListener(mp-> {
                finish();
            });

            Button buttonExitVideo = findViewById(R.id.btn_exit_video);
            buttonExitVideo.setOnClickListener(v->{
                videoView.stopPlayback();
                finish();
            });
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