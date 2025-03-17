package com.cosinetech.imates.util;

import android.graphics.Bitmap;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Base64;

public class VoiceDbUtil {
    public static class VoiceDbItem {
        //时长,秒
        public int duration;

        //路径
        public String voicePath;
    }

    public static void saveVoiceFile(String base64Voice, String filePath) {
        if (base64Voice == null || base64Voice.isEmpty()) {
            Log.e("VoiceUtils", "Base64数据为空，无法保存：" + filePath);
            return;
        }

        // 解码 Base64 数据
        byte[] decodedBytes;
        try {
            decodedBytes = Base64.getDecoder().decode(base64Voice);
        } catch (IllegalArgumentException e) {
            Log.e("VoiceUtils", "Base64 解码失败：" + filePath + "\n" + e);
            return;
        }

        // 确保目标目录存在
        File file = new File(filePath);
        File parentDir = file.getParentFile();
        if (parentDir != null && !parentDir.exists()) {
            boolean dirCreated = parentDir.mkdirs();
            if (!dirCreated) {
                Log.e("VoiceUtils", "无法创建目标目录：" + parentDir.getAbsolutePath());
                return;
            }
        }

        // 保存文件
        try (FileOutputStream fos = new FileOutputStream(file)) {
            fos.write(decodedBytes);
            fos.flush();
            Log.e("VoiceUtils", "音频文件保存成功：" + filePath);
        } catch (IOException e) {
            Log.e("VoiceUtils", "音频文件保存失败：" + filePath + "\n" + e);
        }
    }

    public static String getRawVoiceBase64(String voicePath) {
        try {
            // 读取文件内容为字节数组
            byte[] fileContent = Files.readAllBytes(Paths.get(voicePath));

            // 将字节数组编码为 Base64 字符串
            return Base64.getEncoder().encodeToString(fileContent);
        } catch (Exception e) {
            // 处理异常
            Log.e(VoiceDbUtil.class.toString(),"读取文件或编码失败: " + e.getMessage());
            return "null"; // 返回 null 表示失败
        }
    }

    // 生成数据库存储的语音格式
    public static String makeVoiceDbContent(VoiceDbItem item) {
        return item.duration + "," + item.voicePath;
    }

    // 从数据库记录的数据里解码出实际路径, 格式: 时长,路径
    public static VoiceDbItem extractDbVoiceContent(String dbContent) {
        VoiceDbItem vi = new VoiceDbItem();
        vi.duration = Integer.valueOf(dbContent.split(",")[0]);
        vi.voicePath = dbContent.split(",")[1];

        return  vi;
    }
}
