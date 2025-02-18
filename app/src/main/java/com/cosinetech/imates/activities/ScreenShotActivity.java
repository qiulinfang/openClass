package com.cosinetech.imates.activities;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Bundle;
import android.os.Handler;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Toast;

import com.cosinetech.imates.util.ScreenCapture;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

public class ScreenShotActivity extends Activity {
    private static final int REQUEST_CODE_SCREEN_CAPTURE = 1;
    private MediaProjectionManager mediaProjectionManager;
    private MediaProjection mediaProjection;
    private ImageReader imageReader;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 设置透明背景
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS, WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);

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
                    new ScreenCapture(ScreenShotActivity.this, mediaProjection, "", "")
                            .setListener(new ScreenCapture.OnImageCaptureScreenListener() {
                                /**
                                 * @param image
                                 * @param filePath
                                 */
                                @Override
                                public void imageCaptured(byte[] image, String filePath) {
                                    //启动反馈Activity
                                    finish();
                                }
                            })
                            .startProjection();
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

    private void saveScreenshot(Bitmap bitmap) {
        try {
            File file = new File(getExternalFilesDir(null), "screenshot.png");
            FileOutputStream outputStream = new FileOutputStream(file);
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream);
            outputStream.flush();
            outputStream.close();
            Toast.makeText(this, "Screenshot saved", Toast.LENGTH_SHORT).show();
        } catch (IOException e) {
            e.printStackTrace();
            Toast.makeText(this, "Failed to save screenshot", Toast.LENGTH_SHORT).show();
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
