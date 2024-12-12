package com.cosinetech.imates.util;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import java.io.ByteArrayOutputStream;
import java.io.FileOutputStream;
import java.io.IOException;

public class ImageUtils {

    /**
     * 将图片文件转换为Base64编码的字符串
     *
     * @param imagePath 图片文件的路径
     * @return Base64编码的字符串
     */

    public static String convertImageToBase64(String imagePath) {
        // 加载图片
        Bitmap bitmap = BitmapFactory.decodeFile(imagePath);
        if (bitmap == null) {
            return null;
        }

        // 将Bitmap压缩为字节数组
        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, byteArrayOutputStream);
        byte[] byteArray = byteArrayOutputStream.toByteArray();

        // 将字节数组转换为Base64字符串
        String base64String = Base64.encodeToString(byteArray, Base64.DEFAULT);

        // 释放Bitmap资源
        bitmap.recycle();

        return base64String;
    }


    /**
     * 将 Bitmap 转换为 JPEG 文件并保存到指定路径。
     *
     * @param bitmap 需要转换的 Bitmap 对象。
     * @param filePath 保存的文件路径。
     * @param quality 图像质量（0-100），100 表示最高质量。
     */
    public static void saveBitmapAsJpeg(Bitmap bitmap, String filePath, int quality) {
        // 创建一个字节输出流
        ByteArrayOutputStream stream = new ByteArrayOutputStream();

        // 将 Bitmap 压缩为 JPEG 格式，并写入到字节流中
        boolean compressed = bitmap.compress(Bitmap.CompressFormat.JPEG, quality, stream);

        if (compressed) {
            try {
                // 将字节流转换为字节数组
                byte[] byteArray = stream.toByteArray();

                // 创建文件输出流以保存 JPEG 文件
                FileOutputStream fos = new FileOutputStream(filePath);

                // 写入字节数组到文件
                fos.write(byteArray);
                fos.flush();
                fos.close();

                System.out.println("JPEG 文件已成功保存！");
            } catch (IOException e) {
                e.printStackTrace();
            } finally {
                try {
                    stream.close();
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }
        } else {
            System.err.println("压缩失败");
        }
    }
}
