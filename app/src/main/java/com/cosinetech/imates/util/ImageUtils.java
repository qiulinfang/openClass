package com.cosinetech.imates.util;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import java.io.ByteArrayOutputStream;

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
}
