package com.cosinetech.imates.util;

import android.util.Log;

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
