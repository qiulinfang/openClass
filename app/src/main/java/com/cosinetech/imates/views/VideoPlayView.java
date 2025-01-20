package com.cosinetech.imates.views;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ObjectAnimator;
import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.SurfaceTexture;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.util.AttributeSet;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.RelativeLayout;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.activities.VideoPlayActivity;
import com.cosinetech.imates.colorpicker.ColorListener;
import com.cosinetech.imates.colorpicker.ColorPickerDialog;
import com.cosinetech.imates.models.Subject;
import com.cosinetech.imates.notes.NoteManager;
import com.cosinetech.imates.util.ImageUtils;
import com.cosinetech.imates.webservice.AiChatMessageRequest;
import com.cosinetech.imates.webservice.ApiUrl;
import com.litao.slider.NiftySlider;
import com.lzf.easyfloat.EasyFloat;

import java.io.File;
import java.io.FileOutputStream;
import java.util.UUID;

public class VideoPlayView extends RelativeLayout {
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

    private String mSectionTitle;
    private String mVideoPath;
    private int mStartPlayPos = 0;

    public VideoPlayView(Context context) {
        super(context);
        init(context);
    }

    public VideoPlayView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init(context);
    }

    public VideoPlayView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        init(context);
    }

    @SuppressLint("ClickableViewAccessibility")
    private void init(Context context) {
        View view = LayoutInflater.from(context).inflate(R.layout.view_video_play, this, true);
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
        scratchToolsView.setAskAiContextPrompt(mSectionTitle);
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
    }

    public void setVideoInfo(String videoPath, String sectionTitle, int startPlayPos) {
        mVideoPath = videoPath;
        mSectionTitle = sectionTitle;
        mStartPlayPos = startPlayPos;

        scratchToolsView.setAskAiContextPrompt(mSectionTitle);
        setupVideoPlayer(mVideoPath);
    }

    public void hideScratchTools() {
        scratchToolsView.setVisibility(INVISIBLE);
    }
    public int getCurrentPlayPosition() {
        if(mediaPlayer != null) {
            return mediaPlayer.getCurrentPosition();
        }
        return 0;
    }

    public void startPlay() {
        if (mediaPlayer == null) return;
        if(!isPlaying) {
            togglePlayPause();
        }
    }

    public void stopPlay() {
        if (mediaPlayer == null) return;
        isPlaying = false;
        mediaPlayer.seekTo(0);
        mediaPlayer.stop();
        buttonPlayPause.setBackgroundResource(R.drawable.video_play_button_start_bg);
        mediaPlayer.release();
        mediaPlayer = null;
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
                    mediaPlayer.setDataSource(getContext(), Uri.fromFile(file));

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
                        mediaPlayer.seekTo(mStartPlayPos);
                        togglePlayPause(); // 自动开始播放
                        updateSeekBar();
                    });

                    // 播放完成监听器
                    mediaPlayer.setOnCompletionListener(mp -> {
                        // 播放完成后的处理逻辑
                        isPlaying = false;
                        buttonPlayPause.setText("Play");
                        mediaPlayer.seekTo(0);
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

    private void adjustScratchViewLayout() {
        RelativeLayout.LayoutParams textureLayout = (RelativeLayout.LayoutParams) textureView.getLayoutParams();
        RelativeLayout.LayoutParams layoutParams = (RelativeLayout.LayoutParams) scratchToolsView.getLayoutParams();
        layoutParams.addRule(RelativeLayout.CENTER_IN_PARENT, RelativeLayout.TRUE);
        layoutParams.width = textureLayout.width;
        layoutParams.height = textureLayout.height;
        scratchToolsView.requestLayout();
    }
    private void adjustAspectRatio(int videoWidth, int videoHeight) {
        // 获取 TextureView 当前的布局参数
        RelativeLayout.LayoutParams layoutParams = (RelativeLayout.LayoutParams) textureView.getLayoutParams();

        // 设置居中对齐方式
        layoutParams.addRule(RelativeLayout.CENTER_IN_PARENT, RelativeLayout.TRUE);
        int viewWidth = getWidth();
        int viewHeight = getHeight();

        // 根据视频的宽高比和屏幕的宽高比，计算需要调整的宽高
        float videoAspectRatio = (float) videoWidth / (float) videoHeight;
        float screenAspectRatio = (float) viewWidth / (float) viewHeight;

        if (videoAspectRatio > screenAspectRatio) {
            // 如果视频宽高比大于屏幕宽高比，视频宽度应该匹配屏幕宽度，保持视频比例
            int newHeight = (int) (viewWidth / videoAspectRatio);
            textureView.getLayoutParams().width = viewWidth;
            textureView.getLayoutParams().height = newHeight;
        } else {
            // 如果视频宽高比小于或等于屏幕宽高比，视频高度应该匹配屏幕高度，保持视频比例
            int newWidth = (int) (viewHeight * videoAspectRatio);
            textureView.getLayoutParams().height = viewHeight;
            textureView.getLayoutParams().width = newWidth;
        }

        // 更新 TextureView 的布局
        textureView.requestLayout();

        adjustScratchViewLayout();
    }

    private void adjustAspectRatio0(int videoWidth, int videoHeight) {
        // 获取屏幕的宽高
//        WindowManager wm = (WindowManager) getContext().getSystemService(Context.WINDOW_SERVICE);
//        int screenWidth = wm.getDefaultDisplay().getWidth();
//        int screenHeight = wm.getDefaultDisplay().getHeight();

        int viewWidth = getWidth();
        int viewHeight = getHeight();

        // 根据视频的宽高比和屏幕的宽高比，计算需要调整的宽高
        float videoAspectRatio = (float) videoWidth / (float) videoHeight;
        float screenAspectRatio = (float) viewWidth / (float) viewHeight;

        if (videoAspectRatio > screenAspectRatio) {
            // 如果视频宽高比大于屏幕宽高比，视频宽度应该匹配屏幕宽度，保持视频比例
            int newHeight = (int) (viewWidth / videoAspectRatio);
            textureView.getLayoutParams().width = viewWidth;
            textureView.getLayoutParams().height = newHeight;
        } else {
            // 如果视频宽高比小于或等于屏幕宽高比，视频高度应该匹配屏幕高度，保持视频比例
            int newWidth = (int) (viewHeight * videoAspectRatio);
            textureView.getLayoutParams().height = viewHeight;
            textureView.getLayoutParams().width = newWidth;
        }

        // 更新 TextureView 的布局
        textureView.requestLayout();
    }

    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        if(w <= 0 || h <= 0) {
            return;
        }

        if(mediaPlayer == null) {
            return;
        }

        int videoWidth = mediaPlayer.getVideoWidth();
        int videoHeight = mediaPlayer.getVideoHeight();

        // 调整 TextureView 的宽高比
        if(videoWidth > 0 && videoHeight > 0) {
            adjustAspectRatio(videoWidth, videoHeight);
        }
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        // 执行附加到窗口时的操作
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        // 清理资源，防止内存泄漏
        if (mediaPlayer != null) {
            mediaPlayer.stop();
            mediaPlayer.release();
            mediaPlayer = null;
        }
    }
}
