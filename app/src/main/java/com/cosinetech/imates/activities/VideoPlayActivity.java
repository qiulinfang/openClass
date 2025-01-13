package com.cosinetech.imates.activities;

import android.app.PendingIntent;
import android.app.PictureInPictureParams;
import android.app.RemoteAction;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.SurfaceTexture;
import android.graphics.drawable.Icon;
import android.media.MediaPlayer;
import android.os.Bundle;

import android.animation.ObjectAnimator;
import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.net.Uri;
import android.os.Build;
import android.util.Rational;
import android.view.MotionEvent;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.view.animation.AccelerateDecelerateInterpolator;

import com.cosinetech.imates.views.ScratchToolsView;
import com.cosinetech.imates.util.WindowUtils;

import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.Lifecycle;

import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.Toast;

import com.cosinetech.imates.databinding.ActivityVideoPlayBinding;

import com.cosinetech.imates.R;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

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
    private static final String ACTION_MEDIA = "com.cosinetech.imates.videoplayer.MEDIA";
    private static final String ACTION_SEEK = "com.cosinetech.imates.videoplayer.SEEK";
    private static final String ACTION_SPEED = "com.cosinetech.imates.videoplayer.SPEED";
    private static final int REQUEST_CODE = 100;
    private BroadcastReceiver receiver;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 隐藏系统导航栏
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);

        binding = ActivityVideoPlayBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        setupBroadcastReceiver();

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

        Button btnEnterPip = findViewById(R.id.btn_enter_pip);
        btnEnterPip.setOnClickListener(v-> {
            enterPiPMode();
        });
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

    //监听pip模式
    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode,
                                              Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        if(isInPictureInPictureMode) {
            findViewById(R.id.btn_enter_pip).setVisibility(View.INVISIBLE);
            findViewById(R.id.btn_exit_video).setVisibility(View.INVISIBLE);
            findViewById(R.id.scratch_tool).setVisibility(View.INVISIBLE);
            controlLayout.setVisibility(View.INVISIBLE);
        } else {
            findViewById(R.id.btn_enter_pip).setVisibility(View.VISIBLE);
            findViewById(R.id.btn_exit_video).setVisibility(View.VISIBLE);
            findViewById(R.id.scratch_tool).setVisibility(View.INVISIBLE);
            controlLayout.setVisibility(View.VISIBLE);

            if (getLifecycle().getCurrentState() == Lifecycle.State.CREATED) {
                // 用户点击“关闭”按钮
                finish();
            } else if (getLifecycle().getCurrentState() == Lifecycle.State.STARTED){
                // 用户点击”最大化“按钮
            }
        }
    }

    private void togglePlayPause() {
        if (mediaPlayer == null) return;

        if (isPlaying) {
            mediaPlayer.pause();
            //buttonPlayPause.setText("Play");
            buttonPlayPause.setBackgroundResource(R.drawable.video_play_button_start_bg);
        } else {
            mediaPlayer.start();
            //buttonPlayPause.setText("Pause");
            buttonPlayPause.setBackgroundResource(R.drawable.video_play_button_pause_bg);
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
        if(!isControlsVisible) {
            controlLayout.setVisibility(View.VISIBLE);
            ObjectAnimator fadeIn = ObjectAnimator.ofFloat(controlLayout, "alpha", 0f, 1f);
            fadeIn.setDuration(300);
            fadeIn.setInterpolator(new AccelerateDecelerateInterpolator());
            fadeIn.start();
            isControlsVisible = true;

            // 3 秒后自动隐藏
            //controlLayout.postDelayed(this::fadeOutControls, 3000);
        }
    }

    private void fadeOutControls() {
        if(isControlsVisible) {
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

    private void setupBroadcastReceiver() {
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                switch (intent.getAction()) {
                    case ACTION_MEDIA:
                        if (isPlaying) {
                            mediaPlayer.pause();
                            isPlaying = false;
                        } else {
                            mediaPlayer.start();
                            isPlaying = true;
                        }
                        updatePiPActions();
                        break;
                    case ACTION_SEEK:
                        int progress = intent.getIntExtra("progress", 0);
                        int seekTo = progress * mediaPlayer.getDuration() / 100;
                        mediaPlayer.seekTo(seekTo);
                        break;
                    case ACTION_SPEED:
                        currentSpeed = (currentSpeed == 1.0f) ? 1.5f : 1.0f;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            mediaPlayer.setPlaybackParams(mediaPlayer.getPlaybackParams().setSpeed(currentSpeed));
                        }
                        updatePiPActions();
                        break;
                }
            }
        };

        IntentFilter filter = new IntentFilter();
        filter.addAction(ACTION_MEDIA);
        filter.addAction(ACTION_SEEK);
        filter.addAction(ACTION_SPEED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            registerReceiver(receiver, filter, RECEIVER_EXPORTED);
        }
    }

    private void enterPiPMode() {
        int videoWidth = 16;
        int videoHeight = 9;
        if(mediaPlayer != null) {
            videoWidth = mediaPlayer.getVideoWidth();
            videoHeight = mediaPlayer.getVideoHeight();
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Rational aspectRatio = new Rational(videoWidth, videoHeight);
            PictureInPictureParams params = new PictureInPictureParams.Builder()
                    .setAspectRatio(aspectRatio)
                    .setActions(createRemoteActions())
                    .build();
            enterPictureInPictureMode(params);
        }
    }

    private void updatePiPActions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            PictureInPictureParams params = new PictureInPictureParams.Builder()
                    .setActions(createRemoteActions())
                    .build();
            setPictureInPictureParams(params);
        }
    }

    private ArrayList<RemoteAction> createRemoteActions() {
        ArrayList<RemoteAction> actions = new ArrayList<>();

        // Play/Pause action
        Intent mediaIntent = new Intent(ACTION_MEDIA);
        PendingIntent mediaPendingIntent = PendingIntent.getBroadcast(this, REQUEST_CODE, mediaIntent, PendingIntent.FLAG_IMMUTABLE);
        RemoteAction mediaAction = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            mediaAction = new RemoteAction(
                    Icon.createWithResource(this, isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play),
                    isPlaying ? "暂停" : "播放",
                    isPlaying ? "暂停" : "播放",
                    mediaPendingIntent
            );
        }

        // Seek action (progress bar)
        Intent seekIntent = new Intent(ACTION_SEEK);
        PendingIntent seekPendingIntent = PendingIntent.getBroadcast(this, REQUEST_CODE, seekIntent, PendingIntent.FLAG_IMMUTABLE);
        RemoteAction seekAction = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            seekAction = new RemoteAction(
                    Icon.createWithResource(this, R.id.seekBar),
                    "进度",
                    "播放进度",
                    seekPendingIntent
            );
        }

        // Speed action
        Intent speedIntent = new Intent(ACTION_SPEED);
        PendingIntent speedPendingIntent = PendingIntent.getBroadcast(this, REQUEST_CODE, speedIntent, PendingIntent.FLAG_IMMUTABLE);
        RemoteAction speedAction = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            speedAction = new RemoteAction(
                    Icon.createWithResource(this, android.R.drawable.ic_menu_rotate),
                    currentSpeed == 1.0f ? "1.5x" : "1.0x",
                    "播放速度",
                    speedPendingIntent
            );
        }

        actions.add(mediaAction);
        actions.add(seekAction);
        actions.add(speedAction);

        return actions;
    }

    @Override
    protected void onDestroy() {
        if (mediaPlayer != null) {
            mediaPlayer.release();
            mediaPlayer = null;
        }

        if (receiver != null) {
            unregisterReceiver(receiver);
            receiver = null;
        }

        super.onDestroy();
    }

}