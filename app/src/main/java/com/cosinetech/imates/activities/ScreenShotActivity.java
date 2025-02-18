package com.cosinetech.imates.activities;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import com.cosinetech.imates.FeedbackActivity;
import com.cosinetech.imates.R;
import com.cosinetech.imates.util.ScreenCapture;
import com.cosinetech.imates.util.WindowUtils;

import java.util.zip.Inflater;

public class ScreenShotActivity extends Activity {
    private static final int REQUEST_CODE_SCREEN_CAPTURE = 1;
    private MediaProjectionManager mediaProjectionManager;
    private MediaProjection mediaProjection;
    private ImageReader imageReader;

    private View mContentView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 设置透明背景
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS, WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        mContentView = getLayoutInflater().inflate(R.layout.activity_screen_shot, null);
        setContentView(mContentView);

        mediaProjectionManager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        // 请求用户授权
        startActivityForResult(mediaProjectionManager.createScreenCaptureIntent(), REQUEST_CODE_SCREEN_CAPTURE);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_CODE_SCREEN_CAPTURE) {
            if (resultCode == RESULT_OK) {
                // 获取 MediaProjection 实例
                mediaProjection = mediaProjectionManager.getMediaProjection(resultCode, data);
                if(mediaProjection != null) {
//                    new ScreenCapture(ScreenShotActivity.this, mediaProjection, "", "")
//                            .setListener(new ScreenCapture.OnImageCaptureScreenListener() {
//                                /**
//                                 * @param filePath
//                                 */
//                                @Override
//                                public void imageCaptured(String filePath) {
//                                    //启动反馈Activity
//                                    Intent intent = new Intent(ScreenShotActivity.this, FeedbackActivity.class);
//                                    intent.putExtra(FeedbackActivity.KEY_FEEDBACK_IMAGE, filePath);
//                                    startActivity(intent);
//                                    finish();
//                                }
//                            })
//                            .startProjection();

                    new Handler(Looper.getMainLooper()).postDelayed(() -> {
                        mContentView.setVisibility(View.GONE);
                        new ScreenCapture(ScreenShotActivity.this, mediaProjection, "", "")
                                .setListener(new ScreenCapture.OnImageCaptureScreenListener() {
                                    /**
                                     * @param filePath
                                     */
                                    @Override
                                    public void imageCaptured(String filePath) {
                                        //启动反馈Activity
                                        Intent intent = new Intent(ScreenShotActivity.this, FeedbackActivity.class);
                                        intent.putExtra(FeedbackActivity.KEY_FEEDBACK_IMAGE, filePath);
                                        startActivity(intent);
                                        finish();
                                    }
                                })
                                .startProjection();
                    }, 1000);

                } else {
                    finish();
                }
            } else {
                // 用户拒绝授权，关闭 Activity
                finish();
            }
        } else {
            finish();
        }
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
        if (mediaProjection != null) {
            mediaProjection.stop();
        }
        if (imageReader != null) {
            imageReader.close();
        }
    }
}
