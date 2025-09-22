package com.cosinetech.imates.utils;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;

public class SimpleImageCompressor {

    /**
     * 保持比例的就地压缩（最大不超过1920x1080）
     * @param filePath 图片路径（就地压缩）
     * @param quality 压缩质量(0-100)
     * @return 是否成功
     */
    public static boolean compressInPlace(String filePath, int quality) {
        final int MAX_WIDTH = 1920;
        final int MAX_HEIGHT = 1080;

        // 1. 创建临时文件
        File originalFile = new File(filePath);
        File tempFile = new File(originalFile.getParent(), "temp_compress_" + originalFile.getName());

        try {
            // 2. 获取原始图片尺寸
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(filePath, options);

            int originalWidth = options.outWidth;
            int originalHeight = options.outHeight;

            // 3. 计算保持比例的目标尺寸
            float widthRatio = (float) MAX_WIDTH / originalWidth;
            float heightRatio = (float) MAX_HEIGHT / originalHeight;
            float scaleRatio = Math.min(widthRatio, heightRatio);

            int targetWidth = (int) (originalWidth * scaleRatio);
            int targetHeight = (int) (originalHeight * scaleRatio);

            // 如果图片已经小于目标尺寸，则不放大
            if (originalWidth <= MAX_WIDTH && originalHeight <= MAX_HEIGHT) {
                targetWidth = originalWidth;
                targetHeight = originalHeight;
            }

            // 4. 加载并缩放图片
            options.inJustDecodeBounds = false;
            options.inSampleSize = calculateInSampleSize(options, targetWidth, targetHeight);

            Bitmap bitmap = BitmapFactory.decodeFile(filePath, options);
            if (bitmap == null) return false;

            // 精确调整到目标尺寸
            Bitmap scaledBitmap = Bitmap.createScaledBitmap(
                    bitmap, targetWidth, targetHeight, true);
            bitmap.recycle();

            // 5. 保存到临时文件
            FileOutputStream fos = new FileOutputStream(tempFile);
            boolean result = scaledBitmap.compress(Bitmap.CompressFormat.JPEG, quality, fos);
            fos.close();
            scaledBitmap.recycle();

            if (!result) {
                tempFile.delete();
                return false;
            }

            // 6. 替换原文件
            if (!originalFile.delete()) {
                tempFile.delete();
                return false;
            }

            if (!tempFile.renameTo(originalFile)) {
                // 重命名失败尝试复制
                return copyFile(tempFile, originalFile);
            }

            return true;
        } catch (Exception e) {
            e.printStackTrace();
            tempFile.delete();
            return false;
        }
    }

    private static int calculateInSampleSize(BitmapFactory.Options options,
                                             int reqWidth, int reqHeight) {
        final int height = options.outHeight;
        final int width = options.outWidth;
        int inSampleSize = 1;

        if (height > reqHeight || width > reqWidth) {
            final int halfHeight = height / 2;
            final int halfWidth = width / 2;

            while ((halfHeight / inSampleSize) >= reqHeight
                    && (halfWidth / inSampleSize) >= reqWidth) {
                inSampleSize *= 2;
            }
        }
        return inSampleSize;
    }

    private static boolean copyFile(File src, File dst) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Files.copy(src.toPath(), dst.toPath());
            }
            src.delete();
            return true;
        } catch (IOException e) {
            e.printStackTrace();
            return false;
        }
    }
}
