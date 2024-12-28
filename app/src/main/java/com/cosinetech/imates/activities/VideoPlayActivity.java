package com.cosinetech.imates.activities;

import android.graphics.Bitmap;
import android.graphics.SurfaceTexture;
import android.media.MediaPlayer;
import android.os.Bundle;

import android.animation.ObjectAnimator;
import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.net.Uri;
import android.os.Build;
import android.view.MotionEvent;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.view.animation.AccelerateDecelerateInterpolator;

import com.cosinetech.imates.ScratchToolsView;
import com.cosinetech.imates.util.WindowUtils;

import androidx.appcompat.app.AppCompatActivity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.MediaController;
import android.widget.SeekBar;
import android.widget.Toast;

import com.cosinetech.imates.databinding.ActivityVideoPlayBinding;

import com.cosinetech.imates.R;

import java.io.File;

public class VideoPlayActivity extends AppCompatActivity {
    public static final String KEY_VIDEO_PATH = "VIDEO_PATH";
    public static final String KEY_TEXTBOOK_SECTION = "TEXTBOOK_SECTION";
    private ActivityVideoPlayBinding binding;

    private ScratchToolsView scratchToolsView;

    //视频播放相关
    private TextureView textureView;
    private MediaPlayer mediaPlayer;
    private LinearLayout controlLayout;
    private Button buttonPlayPause, buttonSpeed;
    private SeekBar seekBar;
    // 视频控制相关
    private boolean isControlsVisible = false;
    private boolean isPlaying = false;
    private float currentSpeed = 1.0f; // 默认倍速播放为 1x


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 隐藏系统导航栏
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);

        binding = ActivityVideoPlayBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        textureView = findViewById(R.id.textureView);
        textureView = findViewById(R.id.textureView);
        controlLayout = findViewById(R.id.controlLayout);
        buttonPlayPause = findViewById(R.id.buttonPlayPause);
        buttonSpeed = findViewById(R.id.buttonSpeed);
        seekBar = findViewById(R.id.seekBar);

        // 播放/暂停按钮
        buttonPlayPause.setOnClickListener(v -> togglePlayPause());

        // 倍速播放按钮
        buttonSpeed.setOnClickListener(v -> togglePlaybackSpeed());

        // 点击 TextureView 显示/隐藏控件
        textureView.setOnTouchListener((v, event) -> {
            if (event.getAction() == MotionEvent.ACTION_DOWN) {
                toggleControls();
            }
            return true;
        });

        // 进度条拖动事件
        seekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                if (fromUser && mediaPlayer != null) {
                    mediaPlayer.seekTo(progress);
                }
            }

            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {}

            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {}
        });


        scratchToolsView = findViewById(R.id.scratch_tool);
        String sectionTitle = getIntent().getStringExtra(KEY_TEXTBOOK_SECTION);
        if(sectionTitle == null) {
            sectionTitle = "";
        }
        scratchToolsView.setAskAiContextPrompt(sectionTitle);

        scratchToolsView.setOnScratchToolsListener(new ScratchToolsView.OnScratchToolsListener() {
            @Override
            public void onEnterScratchMode() {
                isPlaying = true;
                togglePlayPause();
            }

            @Override
            public void onExitScratchMode() {
                isPlaying = false;
                togglePlayPause();
            }

            @Override
            public Bitmap onGetScratchCanvasBitmap() {
                Bitmap bitmap = textureView.getBitmap(); // 获取当前帧
                return bitmap;
            }
        });

        String videoPath = getIntent().getStringExtra(KEY_VIDEO_PATH);
        if(videoPath != null) {

            File file = new File(videoPath);
            if(file.exists()) {
                setupVideoPlayer(videoPath);
            } else {
                Toast.makeText(this, "视频文件不存在", Toast.LENGTH_SHORT).show();
            }

            Button buttonExitVideo = findViewById(R.id.btn_exit_video);
            buttonExitVideo.setOnClickListener(v->{
                mediaPlayer.stop();
                finish();
            });
        }
    }

    private void setupVideoPlayer(String filePath) {
        textureView.setSurfaceTextureListener(new TextureView.SurfaceTextureListener() {
            @Override
            public void onSurfaceTextureAvailable(SurfaceTexture surface, int width, int height) {
                Surface videoSurface = new Surface(surface);
                mediaPlayer = new MediaPlayer();
                try {
                    // 播放应用资源文件 (R.raw.sample_video)
                    File file = new File(filePath);
                    mediaPlayer.setDataSource(VideoPlayActivity.this, Uri.fromFile(file));

                    // 或者播放本地文件：
                    // File file = new File(Environment.getExternalStorageDirectory(), "example.mp4");
                    // mediaPlayer.setDataSource(file.getAbsolutePath());

                    // 或者播放网络视频：
                    // mediaPlayer.setDataSource("https://example.com/video.mp4");

                    mediaPlayer.setSurface(videoSurface);
                    mediaPlayer.prepare();
                    mediaPlayer.setOnPreparedListener(mp -> {
                        // 获取视频的宽高比
                        int videoWidth = mediaPlayer.getVideoWidth();
                        int videoHeight = mediaPlayer.getVideoHeight();

                        // 调整 TextureView 的宽高比
                        adjustAspectRatio(videoWidth, videoHeight);

                        seekBar.setMax(mediaPlayer.getDuration());
                        togglePlayPause(); // 自动开始播放
                        updateSeekBar();
                    });

                    // 播放完成监听器
                    mediaPlayer.setOnCompletionListener(mp -> {
                        // 播放完成后的处理逻辑
                        isPlaying = false;
                        buttonPlayPause.setText("Play");
                        mediaPlayer.seekTo(0);
                        finish();
                    });

                } catch (Exception e) {
                    e.printStackTrace();
                }
            }

            @Override
            public void onSurfaceTextureSizeChanged(SurfaceTexture surface, int width, int height) {}

            @Override
            public boolean onSurfaceTextureDestroyed(SurfaceTexture surface) {
                if (mediaPlayer != null) {
                    mediaPlayer.release();
                    mediaPlayer = null;
                }
                return true;
            }

            @Override
            public void onSurfaceTextureUpdated(SurfaceTexture surface) {}
        });
    }

    private void togglePlayPause() {
        if (mediaPlayer == null) return;

        if (isPlaying) {
            mediaPlayer.pause();
            //buttonPlayPause.setText("Play");
            buttonPlayPause.setBackgroundResource(R.drawable.video_play);
        } else {
            mediaPlayer.start();
            //buttonPlayPause.setText("Pause");
            buttonPlayPause.setBackgroundResource(R.drawable.video_pause);
        }
        isPlaying = !isPlaying;
    }

    private void togglePlaybackSpeed() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && mediaPlayer != null) {
            // 切换倍速
            if (currentSpeed == 1.0f) {
                currentSpeed = 1.5f;
            } else if (currentSpeed == 1.5f) {
                currentSpeed = 2.0f;
            } else if (currentSpeed == 2.0f) {
                currentSpeed = 0.5f;
            } else {
                currentSpeed = 1.0f;
            }
            mediaPlayer.setPlaybackParams(mediaPlayer.getPlaybackParams().setSpeed(currentSpeed));
            buttonSpeed.setText(currentSpeed + "x");
        }
    }

    private void toggleControls() {
        if (isControlsVisible) {
            fadeOutControls();
        } else {
            fadeInControls();
        }
    }

    private void fadeInControls() {
        controlLayout.setVisibility(View.VISIBLE);
        ObjectAnimator fadeIn = ObjectAnimator.ofFloat(controlLayout, "alpha", 0f, 1f);
        fadeIn.setDuration(300);
        fadeIn.setInterpolator(new AccelerateDecelerateInterpolator());
        fadeIn.start();
        isControlsVisible = true;

        // 3 秒后自动隐藏
        controlLayout.postDelayed(this::fadeOutControls, 3000);
    }

    private void fadeOutControls() {
        ObjectAnimator fadeOut = ObjectAnimator.ofFloat(controlLayout, "alpha", 1f, 0f);
        fadeOut.setDuration(300);
        fadeOut.setInterpolator(new AccelerateDecelerateInterpolator());
        fadeOut.addListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(Animator animation) {
                controlLayout.setVisibility(View.GONE);
            }
        });
        fadeOut.start();
        isControlsVisible = false;
    }

    private void updateSeekBar() {
        if (mediaPlayer != null && isPlaying) {
            seekBar.setProgress(mediaPlayer.getCurrentPosition());
        }

        // 每 500 毫秒更新一次进度条
        seekBar.postDelayed(this::updateSeekBar, 500);
    }

    private void adjustAspectRatio(int videoWidth, int videoHeight) {
        // 获取屏幕的宽高
        int screenWidth = getWindowManager().getDefaultDisplay().getWidth();
        int screenHeight = getWindowManager().getDefaultDisplay().getHeight();

        // 根据视频的宽高比和屏幕的宽高比，计算需要调整的宽高
        float videoAspectRatio = (float) videoWidth / (float) videoHeight;
        float screenAspectRatio = (float) screenWidth / (float) screenHeight;

        if (videoAspectRatio > screenAspectRatio) {
            // 如果视频宽高比大于屏幕宽高比，视频宽度应该匹配屏幕宽度，保持视频比例
            int newHeight = (int) (screenWidth / videoAspectRatio);
            textureView.getLayoutParams().width = screenWidth;
            textureView.getLayoutParams().height = newHeight;
        } else {
            // 如果视频宽高比小于或等于屏幕宽高比，视频高度应该匹配屏幕高度，保持视频比例
            int newWidth = (int) (screenHeight * videoAspectRatio);
            textureView.getLayoutParams().height = screenHeight;
            textureView.getLayoutParams().width = newWidth;
        }

        // 更新 TextureView 的布局
        textureView.requestLayout();
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
        if (mediaPlayer != null) {
            mediaPlayer.release();
        }
        super.onDestroy();
    }

}