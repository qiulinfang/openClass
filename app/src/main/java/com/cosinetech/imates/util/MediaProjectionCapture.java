package com.cosinetech.imates.util;

import android.content.Context;
import android.graphics.Bitmap;
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
import android.view.WindowManager;
import android.widget.Toast;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;

public class MediaProjectionCapture {
    private static MediaProjection mMediaProjection;
    boolean mIsCaptureStarted;
    boolean mCanGetCapureImage = false;
    OnImageCaptureScreenListener mCaptureListener;
    private ImageReader mImageReader;
    private VirtualDisplay mVirtualDisplay;
    private Handler mHandler;
    private String STORE_DIR;
    private String mImageFileName;
    private final Context mContext;

    public MediaProjectionCapture(Context context, MediaProjection mediaProjection, String savePath, String fileName) {
        mMediaProjection = mediaProjection;
        mContext = context;

        mIsCaptureStarted = false;

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
            mImageFileName = "myScreenshot.jpg";
        }
    }

    public String getImageStorePath() {
        return STORE_DIR + "/" + mImageFileName;
    }

    public MediaProjectionCapture startProjection() {
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

        mIsCaptureStarted = true;
        captureScreen();

        return this;
    }

    private void captureScreen() {
        WindowManager window = (WindowManager) mContext.getSystemService(Context.WINDOW_SERVICE);
        Display mDisplay = window.getDefaultDisplay();
        final DisplayMetrics metrics = new DisplayMetrics();
        // use getMetrics is 2030, use getRealMetrics is 2160, the diff is NavigationBar's height
        mDisplay.getRealMetrics(metrics);
        int mDensity = metrics.densityDpi;
        Log.e("WOW", "metrics.widthPixels is " + metrics.widthPixels);
        Log.e("WOW", "metrics.heightPixels is " + metrics.heightPixels);
        int mWidth = metrics.widthPixels;//size.x;
        int mHeight = metrics.heightPixels;//size.y;

        //start capture reader
        mImageReader = ImageReader.newInstance(mWidth, mHeight, PixelFormat.RGBA_8888, 2);
        registerImageReaderCallback();

        mMediaProjection.registerCallback(new MediaProjectionStopCallback(), mHandler);
        mVirtualDisplay = mMediaProjection.createVirtualDisplay(
                "ScreenShot",
                mWidth,
                mHeight,
                mDensity,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                mImageReader.getSurface(),
                null,
                mHandler);


        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            mCanGetCapureImage = true;
        }, 1000);

    }

    private void registerImageReaderCallback() {
        mImageReader.setOnImageAvailableListener(reader -> {
            if (mIsCaptureStarted) {
                Image image = null;
                FileOutputStream fos = null;
                Bitmap bitmap = null;

                try {
                    image = reader.acquireLatestImage();
                    if (image != null) {
                        bitmap = ImageUtils.image_2_bitmap(image, Bitmap.Config.ARGB_8888);
                        if(mCanGetCapureImage) {
                            String fileName = getImageStorePath();
                            fos = new FileOutputStream(fileName);
                            bitmap.compress(Bitmap.CompressFormat.JPEG, 50, fos);
                            Log.e("WOW", "End now!!!!!!  Screenshot saved in " + fileName);
                            stopProjection();
                        }
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

    public MediaProjectionCapture stopProjection() {
        mIsCaptureStarted = false;
        Log.e("WOW", "Screen captured, Now stop");
        mHandler.post(() -> {
            if (mMediaProjection != null) {
                mMediaProjection.stop();
            }
        });

        if (null != mCaptureListener) {
            mCaptureListener.imageCaptured(getImageStorePath());
        }

        return this;
    }

    public MediaProjectionCapture setmCaptureListener(OnImageCaptureScreenListener mCaptureListener) {
        this.mCaptureListener = mCaptureListener;
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
                mMediaProjection.unregisterCallback(MediaProjectionStopCallback.this);
            });
        }
    }
}
