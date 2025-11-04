package com.cosinetech.imates.utils;

import android.media.MediaMetadataRetriever;
import android.util.Log;

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

    public static void saveVoiceFile(String base64VoiceData, String filePath) {
        String base64Voice;
        if(!base64VoiceData.startsWith("data:audio")) {
            base64Voice = base64VoiceData;
        } else {
            // 安全地分割字符串，检查数组长度
            String[] parts = base64VoiceData.split(",");
            if (parts.length >= 2) {
                base64Voice = parts[1];
            } else {
                Log.e("VoiceUtils", "Base64数据格式错误（缺少逗号分隔符），无法保存：" + filePath);
                Log.e("VoiceUtils", "原始数据：" + base64VoiceData.substring(0, Math.min(100, base64VoiceData.length())));
                return;
            }
        }
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

            // 将字节数组编码为 Base64 字符串, 带audio前缀
            return "data:audio/aac;base64," + Base64.getEncoder().encodeToString(fileContent);
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
        // 安全地分割字符串，检查数组长度
        String[] parts = dbContent.split(",");
        if (parts.length >= 2) {
            vi.duration = Integer.valueOf(parts[0]);
            vi.voicePath = parts[1];
        } else {
            Log.e("VoiceUtils", "数据库内容格式错误（缺少逗号分隔符）：" + dbContent);
            // 设置默认值，避免返回null导致后续错误
            vi.duration = 0;
            vi.voicePath = "";
        }

        return  vi;
    }

    // 直接返回秒数，失败返回 -1
    public static long getDuration(String filePath) {

        try (MediaMetadataRetriever retriever = new MediaMetadataRetriever()){
            retriever.setDataSource(filePath);
            String durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
            return durationMs != null ? Long.parseLong(durationMs) / 1000 : 0;
        } catch (Exception e) {
            return 0;
        }
    }
}
