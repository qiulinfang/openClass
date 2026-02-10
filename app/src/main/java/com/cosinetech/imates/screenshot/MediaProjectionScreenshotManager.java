package com.cosinetech.imates.screenshot;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Looper;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.WindowManager;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

/**
 * MediaProjection 截图管理器
 * 解决 rootView.draw() 无法截取某些层（如 SurfaceView、Canvas 实时层）的问题
 */
public class MediaProjectionScreenshotManager {
    private static final String TAG = "MediaProjectionScreenshot";
    
    private Context mContext;
    private MediaProjectionManager mMediaProjectionManager;
    private MediaProjection mMediaProjection;
    private VirtualDisplay mVirtualDisplay;
    private ImageReader mImageReader;
    private HandlerThread mBackgroundThread;
    private Handler mBackgroundHandler;
    
    private int mScreenWidth;
    private int mScreenHeight;
    private int mScreenDensity;
    
    // 截图回调接口
    public interface ScreenshotCallback {
        void onSuccess(String dataUrl, int width, int height);
        void onError(String error);
    }
    
    public MediaProjectionScreenshotManager(Context context) {
        mContext = context;
        mMediaProjectionManager = (MediaProjectionManager) context.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        initScreenMetrics();
        startBackgroundThread();
    }
    
    private void initScreenMetrics() {
        WindowManager wm = (WindowManager) mContext.getSystemService(Context.WINDOW_SERVICE);
        DisplayMetrics metrics = new DisplayMetrics();
        wm.getDefaultDisplay().getRealMetrics(metrics);
        mScreenWidth = metrics.widthPixels;
        mScreenHeight = metrics.heightPixels;
        mScreenDensity = metrics.densityDpi;
        
        Log.d(TAG, "屏幕尺寸: " + mScreenWidth + "x" + mScreenHeight + ", 密度: " + mScreenDensity);
    }
    
    private void startBackgroundThread() {
        mBackgroundThread = new HandlerThread("ScreenshotBackground", Thread.NORM_PRIORITY);
        mBackgroundThread.start();
        mBackgroundHandler = new Handler(mBackgroundThread.getLooper());
    }
    
    private void stopBackgroundThread() {
        if (mBackgroundThread != null) {
            mBackgroundThread.quitSafely();
            try {
                mBackgroundThread.join();
                mBackgroundThread = null;
                mBackgroundHandler = null;
            } catch (InterruptedException e) {
                Log.e(TAG, "停止后台线程失败", e);
            }
        }
    }
    
    /**
     * 检查是否有 MediaProjection 权限
     */
    public boolean hasMediaProjectionPermission() {
        return mMediaProjection != null;
    }
    
    /**
     * 设置 MediaProjection（从 ActivityResult 获取）
     */
    public void setMediaProjection(MediaProjection mediaProjection) {
        if (mMediaProjection != null) {
            mMediaProjection.stop();
        }
        mMediaProjection = mediaProjection;
        Log.d(TAG, "MediaProjection 已设置");
    }
    
    /**
     * 请求 MediaProjection 权限
     */
    public void requestMediaProjectionPermission(Activity activity, int requestCode) {
        if (mMediaProjectionManager != null) {
            Intent intent = mMediaProjectionManager.createScreenCaptureIntent();
            activity.startActivityForResult(intent, requestCode);
        }
    }
    
    /**
     * 执行截图
     */
    public void takeScreenshot(String commandId, ScreenshotCallback callback) {
        if (mMediaProjection == null) {
            Log.e(TAG, "MediaProjection 未初始化");
            callback.onError("MediaProjection 未初始化，请先授权");
            return;
        }
        
        mBackgroundHandler.post(() -> {
            try {
                // 创建 ImageReader
                mImageReader = ImageReader.newInstance(mScreenWidth, mScreenHeight, PixelFormat.RGBA_8888, 2);
                
                // 设置图片可用监听
                mImageReader.setOnImageAvailableListener(reader -> {
                    mBackgroundHandler.post(() -> {
                        try (Image image = reader.acquireLatestImage()) {
                            if (image != null) {
                                Bitmap bitmap = imageToBitmap(image);
                                if (bitmap != null) {
                                    String dataUrl = bitmapToDataUrl(bitmap);
                                    callback.onSuccess(dataUrl, bitmap.getWidth(), bitmap.getHeight());
                                    bitmap.recycle();
                                } else {
                                    callback.onError("图片转换失败");
                                }
                            } else {
                                callback.onError("无法获取图片");
                            }
                        }
                        
                        // 清理资源
                        cleanupVirtualDisplay();
                    });
                }, mBackgroundHandler);
                
                // 创建 VirtualDisplay
                mVirtualDisplay = mMediaProjection.createVirtualDisplay(
                    "Screenshot",
                    mScreenWidth,
                    mScreenHeight,
                    mScreenDensity,
                    DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                    mImageReader.getSurface(),
                    null,
                    null
                );
                
                Log.d(TAG, "VirtualDisplay 已创建，等待截图完成");
                
            } catch (Exception e) {
                Log.e(TAG, "截图失败", e);
                callback.onError("截图失败: " + e.getMessage());
                cleanupVirtualDisplay();
            }
        });
    }
    
    /**
     * Image 转 Bitmap
     */
    private Bitmap imageToBitmap(Image image) {
        try {
            Image.Plane[] planes = image.getPlanes();
            ByteBuffer buffer = planes[0].getBuffer();
            int pixelStride = planes[0].getPixelStride();
            int rowStride = planes[0].getRowStride();
            int rowPadding = rowStride - pixelStride * mScreenWidth;
            
            int bitmapWidth = mScreenWidth;
            int bitmapHeight = mScreenHeight;
            
            // 创建 Bitmap
            Bitmap bitmap = Bitmap.createBitmap(
                bitmapWidth + rowPadding / pixelStride,
                bitmapHeight,
                Bitmap.Config.ARGB_8888
            );
            bitmap.copyPixelsFromBuffer(buffer);
            
            // 如果有行填充，裁剪掉
            if (rowPadding > 0) {
                Bitmap croppedBitmap = Bitmap.createBitmap(bitmap, 0, 0, bitmapWidth, bitmapHeight);
                bitmap.recycle();
                return croppedBitmap;
            }
            
            return bitmap;
        } catch (Exception e) {
            Log.e(TAG, "Image 转 Bitmap 失败", e);
            return null;
        }
    }
    
    /**
     * Bitmap 转 DataUrl
     */
    private String bitmapToDataUrl(Bitmap bitmap) {
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, baos);
            byte[] bytes = baos.toByteArray();
            String b64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
            return "data:image/png;base64," + b64;
        } catch (Exception e) {
            Log.e(TAG, "Bitmap 转 DataUrl 失败", e);
            return null;
        }
    }
    
    /**
     * 清理 VirtualDisplay
     */
    private void cleanupVirtualDisplay() {
        if (mVirtualDisplay != null) {
            mVirtualDisplay.release();
            mVirtualDisplay = null;
        }
        if (mImageReader != null) {
            mImageReader.close();
            mImageReader = null;
        }
    }
    
    /**
     * 释放资源
     */
    public void release() {
        cleanupVirtualDisplay();
        if (mMediaProjection != null) {
            mMediaProjection.stop();
            mMediaProjection = null;
        }
        stopBackgroundThread();
        Log.d(TAG, "MediaProjectionScreenshotManager 已释放");
    }
}
