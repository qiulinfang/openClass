package com.cosinetech.imates.activities;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Parcelable;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import androidx.camera.core.processing.SurfaceProcessorNode;

import com.cosinetech.imates.R;
import com.cosinetech.imates.util.MediaProjectionCapture;
import com.cosinetech.imates.util.WindowUtils;

import java.io.File;

import me.minetsh.imaging.IMGEditActivity;

public class ScreenShotActivity extends Activity {
    public static final String KEY_SET_STORE_DIR = "STORE_DIR";
    public static final String KEY_SET_FILE_NAME = "STORE_FILE_NAME";
    public static final String KEY_FINAL_IMAGE_PATH = "CAPTURE_IMAGE_PATH";

    // 截图完之后要干什么
    public static final String ACTION_START_FEED_BACK = "ACTION_FEED_BACK";
    public static final String ACTION_EDIT_IMAGE = "ACTION_EDIT_IMAGE";
    private static final int REQUEST_CODE_SCREEN_CAPTURE = 1;
    private static final int REQ_IMAGE_EDIT = 2;
    private String mAction = "";

    private MediaProjectionManager mediaProjectionManager;
    private MediaProjection mediaProjection;

    private View mContentView;
    private String mStoreDir;
    private String mFileName;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mStoreDir = getIntent().getStringExtra(KEY_SET_STORE_DIR);
        if(mStoreDir == null) {
            mStoreDir = "";
        }

        mFileName = getIntent().getStringExtra(KEY_SET_FILE_NAME);
        if(mFileName == null) {
            mFileName = "";
        }

        mAction = getIntent().getAction();

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
            if(resultCode != RESULT_OK) {
                // 用户拒绝授权，关闭 Activity
                finish();
                return;
            }

            // 获取 MediaProjection 实例
            mediaProjection = mediaProjectionManager.getMediaProjection(resultCode, data);
            if(mediaProjection == null) {
                finish();
                return;
            }

            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                mContentView.setVisibility(View.GONE);
                new MediaProjectionCapture(ScreenShotActivity.this, mediaProjection, mStoreDir, mFileName)
                        .setmCaptureListener(filePath -> {
                            if (mAction.equals(ACTION_START_FEED_BACK)) {
                                Intent intent = new Intent(ScreenShotActivity.this, FeedbackActivity.class);
                                intent.putExtra(FeedbackActivity.KEY_FEEDBACK_IMAGE, filePath);
                                startActivity(intent);
                                finish();
                            } else if (mAction.equals(ACTION_EDIT_IMAGE)) {
                                Intent intent = new Intent(ScreenShotActivity.this, IMGEditActivity.class)
                                        .putExtra(IMGEditActivity.EXTRA_IMAGE_URI, Uri.fromFile(new File(mStoreDir + "/" + mFileName)))
                                        .putExtra(IMGEditActivity.EXTRA_IMAGE_SAVE_PATH, mStoreDir + "/" + mFileName);

                                //等待编辑图片完成再finish
                                startActivityForResult(intent, REQ_IMAGE_EDIT);
                            }
                        })
                        .startProjection();
            }, 1000);

        } else if(requestCode == REQ_IMAGE_EDIT) {
            Intent editData = new Intent();
            editData.putExtra(KEY_FINAL_IMAGE_PATH, mStoreDir + "/" + mFileName);
            if(resultCode == RESULT_OK) {
                setResult(RESULT_OK, editData);
            } else {
                setResult(requestCode, editData);
            }
            finish();
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
    }
}
