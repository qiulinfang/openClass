package com.cosinetech.imates.util;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Display;
import android.view.View;
import android.view.WindowManager;
import android.widget.Toast;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
public class ScreenCapture {
    private static MediaProjection sMediaProjection;
    boolean isScreenCaptureStarted;
    OnImageCaptureScreenListener listener;
    private int mDensity;
    private Display mDisplay;
    private int mWidth;
    private int mHeight;
    private ImageReader mImageReader;
    private VirtualDisplay mVirtualDisplay;
    private Handler mHandler;
    private String STORE_DIR;
    private String imageFileName;
    private Context mContext;

    public ScreenCapture(Context context, MediaProjection mediaProjection, String savePath, String fileName) {
        sMediaProjection = mediaProjection;
        mContext = context;

        isScreenCaptureStarted = false;

        new Thread() {
            @Override
            public void run() {
                Looper.prepare();
                mHandler = new Handler();
                Looper.loop();
            }
        }.start();


        if (TextUtils.isEmpty(savePath)) {
            File externalFilesDir = mContext.getExternalFilesDir(null);
            Log.e("WOW", "externalFilesDir:" + externalFilesDir.getAbsolutePath());
            if (externalFilesDir != null) {
                STORE_DIR = externalFilesDir.getAbsolutePath() + "/myScreenshots";
            } else {
                Toast.makeText(mContext, "No save path assigned!", Toast.LENGTH_SHORT);
            }
        } else {
            STORE_DIR = savePath;
        }

        if(TextUtils.isEmpty(fileName)) {
//            Date currentDate = new Date();
//            SimpleDateFormat date = new SimpleDateFormat("yyyyMMddhhmmss");
//            imageFileName = "myScreen_" + date.format(
//                    currentDate) + ".jpg";
            imageFileName = "myScreenshot.jpg";
        }
    }

    public String getImageStorePath() {
        return STORE_DIR + "/" + imageFileName;
    }

    public ScreenCapture startProjection() {
        File storeDir = new File(STORE_DIR);
        if (!storeDir.exists()) {
            boolean success = storeDir.mkdirs();
            if (!success) {
                Log.e("WOW", "mkdir " + storeDir + "  failed");
                return this;
            } else {
                Log.e("WOW", "mkdir " + storeDir + "  success");
            }
        } else {
            Log.e("WOW", " " + storeDir + "  exist");
        }

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            isScreenCaptureStarted = true;
            captureScreen();
        }, 500);

//        isScreenCaptureStarted = true;
//        captureScreen();
        return this;
    }

    private void captureScreen() {
        WindowManager window = (WindowManager) mContext.getSystemService(Context.WINDOW_SERVICE);
        mDisplay = window.getDefaultDisplay();
        final DisplayMetrics metrics = new DisplayMetrics();
        // use getMetrics is 2030, use getRealMetrics is 2160, the diff is NavigationBar's height
        mDisplay.getRealMetrics(metrics);
        mDensity = metrics.densityDpi;
        Log.e("WOW", "metrics.widthPixels is " + metrics.widthPixels);
        Log.e("WOW", "metrics.heightPixels is " + metrics.heightPixels);
        mWidth = metrics.widthPixels;//size.x;
        mHeight = metrics.heightPixels;//size.y;

        //start capture reader
        mImageReader = ImageReader.newInstance(mWidth, mHeight, PixelFormat.RGBA_8888, 2);
        sMediaProjection.registerCallback(new MediaProjectionStopCallback(), mHandler);
        mVirtualDisplay = sMediaProjection.createVirtualDisplay(
                "ScreenShot",
                mWidth,
                mHeight,
                mDensity,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                mImageReader.getSurface(),
                null,
                mHandler);

        mImageReader.setOnImageAvailableListener(reader -> {
            if (isScreenCaptureStarted) {
                Image image = null;
                FileOutputStream fos = null;
                Bitmap bitmap = null;

                try {
                    image = reader.acquireLatestImage();
                    if (image != null && image.getPlanes().length > 0) {
                        bitmap = ImageUtils.image_2_bitmap(image, Bitmap.Config.ARGB_8888);

                        String fileName = getImageStorePath();
                        fos = new FileOutputStream(fileName);
                        bitmap.compress(Bitmap.CompressFormat.JPEG, 50, fos);
                        Log.e("WOW", "End now!!!!!!  Screenshot saved in " + fileName);
                        stopProjection();
                    }
                } catch (FileNotFoundException e) {
                    e.printStackTrace();
                } finally {
                    if (null != fos) {
                        try {
                            fos.close();
                        } catch (IOException e) {
                            e.printStackTrace();
                        }
                    }
                    if (null != bitmap) {
                        bitmap.recycle();
                    }
                    if (null != image) {
                        image.close(); // close it when used and
                    }
                }
            }
        }, mHandler);
    }

    public ScreenCapture stopProjection() {
        isScreenCaptureStarted = false;
        Log.e("WOW", "Screen captured, Now stop");
        mHandler.post(() -> {
            if (sMediaProjection != null) {
                sMediaProjection.stop();
            }
        });

        if (null != listener) {
            listener.imageCaptured(getImageStorePath());
        }

        return this;
    }

    public ScreenCapture setListener(OnImageCaptureScreenListener listener) {
        this.listener = listener;
        return this;
    }

    public interface OnImageCaptureScreenListener {
        void imageCaptured(String filePath);
    }

    private class MediaProjectionStopCallback extends MediaProjection.Callback {
        @Override
        public void onStop() {
            mHandler.post(() -> {
                if (mVirtualDisplay != null) {
                    mVirtualDisplay.release();
                }
                if (mImageReader != null) {
                    mImageReader.setOnImageAvailableListener(null, null);
                }
                sMediaProjection.unregisterCallback(MediaProjectionStopCallback.this);
            });
        }
    }
}
