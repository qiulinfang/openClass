package com.cosinetech.imates.decoder;

import android.graphics.Bitmap;
import android.util.Log;
import android.util.LruCache;

/**
 * Bitmap 对象池，用于重用 Bitmap 对象以减少内存分配和垃圾回收
 */
public class BitmapPool {
    private static final String TAG = "BitmapPool";

    // 使用 LruCache 作为缓存机制
    private final LruCache<String, Bitmap> bitmapCache;

    /**
     * 构造函数
     * @param maxSize 池的最大大小（以字节为单位）
     */
    public BitmapPool(int maxSize) {
        bitmapCache = new LruCache<String, Bitmap>(maxSize) {
            @Override
            protected int sizeOf(String key, Bitmap bitmap) {
                // 返回 Bitmap 的大小（以字节为单位）
                return bitmap.getAllocationByteCount();
            }

            @Override
            protected void entryRemoved(boolean evicted, String key, Bitmap oldValue, Bitmap newValue) {
                // 当 Bitmap 从缓存中移除时，如果它没有被回收，则回收它
                if (evicted && oldValue != null && !oldValue.isRecycled()) {
                    oldValue.recycle();
                    Log.d(TAG, "Bitmap 已从池中回收: " + key);
                }
            }
        };
    }

    /**
     * 从池中获取 Bitmap，如果没有可用的，则创建一个新的
     * @param width 宽度
     * @param height 高度
     * @param config Bitmap 配置
     * @return Bitmap 对象
     */
    public Bitmap getBitmap(int width, int height, Bitmap.Config config) {
        String key = createKey(width, height, config);
        Bitmap bitmap = bitmapCache.get(key);

        if (bitmap != null && !bitmap.isRecycled() &&
                bitmap.getWidth() == width &&
                bitmap.getHeight() == height &&
                bitmap.getConfig() == config) {
            // 找到可重用的 Bitmap
            bitmapCache.remove(key);
            Log.d(TAG, "从池中获取 Bitmap: " + key);
            return bitmap;
        }

        // 创建新的 Bitmap
        Log.d(TAG, "创建新的 Bitmap: " + key);
        return Bitmap.createBitmap(width, height, config);
    }

    /**
     * 将 Bitmap 放回池中以供重用
     * @param bitmap 要重用的 Bitmap
     */
    public void recycleBitmap(Bitmap bitmap) {
        if (bitmap == null || bitmap.isRecycled()) {
            return;
        }

        String key = createKey(bitmap.getWidth(), bitmap.getHeight(), bitmap.getConfig());
        bitmapCache.put(key, bitmap);
        Log.d(TAG, "Bitmap 已放回池中: " + key);
    }

    /**
     * 清除池中的所有 Bitmap
     */
    public void clear() {
        bitmapCache.evictAll();
        Log.d(TAG, "Bitmap 池已清除");
    }

    /**
     * 创建 Bitmap 的唯一键
     * @param width 宽度
     * @param height 高度
     * @param config Bitmap 配置
     * @return 唯一键
     */
    private String createKey(int width, int height, Bitmap.Config config) {
        return width + "x" + height + "_" + config.name();
    }
}